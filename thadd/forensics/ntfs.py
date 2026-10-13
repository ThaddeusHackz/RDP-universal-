"""THADD OS Forensics — NTFS reader (the Windows filesystem).

Implements enough of NTFS to do real DFIR work without libtsk:

* boot sector + cluster geometry
* $MFT parsing (record size, runlists) and full record enumeration
* resident and non-resident ``$DATA`` extraction, including named streams (ADS)
* ``$FILE_NAME`` namespaces (POSIX / Win32 / DOS / Win32&DOS)
* ``$STANDARD_INFORMATION`` timestamps -> timestomping detection
* deleted-record recovery (unallocated ``FILE`` records still holding data)
* directory listing via ``INDEX_ROOT``/``INDEX_ALLOCATION``
* forensic flags: ADS, hidden/system files, tunnel-ish timestamp anomalies

References: linux-ntfs "NTFS Documentation", Microsoft [MS-FSCC]/[MS-NTFS].
"""

from __future__ import annotations

import struct
import time
from typing import Iterator, Optional

ATTR_STANDARD_INFORMATION = 0x10
ATTR_ATTRIBUTE_LIST = 0x20
ATTR_FILE_NAME = 0x30
ATTR_OBJECT_ID = 0x40
ATTR_VOLUME_NAME = 0x60
ATTR_VOLUME_INFORMATION = 0x70
ATTR_DATA = 0x80
ATTR_INDEX_ROOT = 0x90
ATTR_INDEX_ALLOCATION = 0xA0
ATTR_BITMAP = 0xB0
ATTR_REPARSE_POINT = 0xC0
ATTR_EA_INFORMATION = 0xD0
ATTR_EA = 0xE0
ATTR_LOGGED_UTILITY_STREAM = 0x100
ATTR_END = 0xFFFFFFFF

NAMESPACES = {0: "POSIX", 1: "Win32", 2: "DOS", 3: "Win32&DOS"}

SYSTEM_FILES = {
    0: "$MFT", 1: "$MFTMirr", 2: "$LogFile", 3: "$Volume", 4: "$AttrDef", 5: ".", 6: "$Bitmap",
    7: "$Boot", 8: "$BadClus", 9: "$Secure", 10: "$UpCase", 11: "$Extend", 12: "$Extend",
    13: "$Extend", 14: "$Extend", 15: "$Extend", 16: "$Extend", 17: "$Extend", 18: "$Extend",
    19: "$Extend", 20: "$Extend", 21: "$Extend", 22: "$Extend", 23: "$Extend", 24: "$Extend",
}


def _ft(ts: int) -> float:
    """Windows FILETIME (100ns since 1601) → unix epoch seconds."""
    if not ts:
        return 0.0
    return (ts / 10_000_000) - 11644473600


def _iso(ts: float) -> str:
    if not ts or ts < -11644473600:
        return ""
    try:
        return time.strftime("%Y-%m-%d %H:%M:%S", time.gmtime(ts))
    except (ValueError, OSError):
        return ""


class NTFS:
    def __init__(self, dev, offset: int = 0):
        self.dev = dev
        self.offset = offset
        boot = dev.pread(offset, 512)
        self.valid = len(boot) >= 512 and boot[3:11] == b"NTFS    "
        if not self.valid:
            return
        self.bytes_per_sector = struct.unpack_from("<H", boot, 0x0B)[0] or 512
        spc = boot[0x0D]
        self.sectors_per_cluster = spc if spc < 128 else 2 ** (256 - spc)
        self.cluster_size = self.bytes_per_sector * self.sectors_per_cluster
        self.total_sectors = struct.unpack_from("<Q", boot, 0x28)[0]
        self.mft_lcn = struct.unpack_from("<Q", boot, 0x30)[0]
        self.mft_mirror_lcn = struct.unpack_from("<Q", boot, 0x38)[0]
        rec = struct.unpack_from("<b", boot, 0x40)[0]
        self.record_size = 1 << (-rec) if rec < 0 else rec * self.cluster_size
        self.index_record_size = 1 << (-struct.unpack_from("<b", boot, 0x44)[0]) if struct.unpack_from("<b", boot, 0x44)[0] < 0 else self.cluster_size
        self.serial = struct.unpack_from("<Q", boot, 0x48)[0]
        self.volume_size = self.total_sectors * self.bytes_per_sector
        self.mft_start = self.offset + self.mft_lcn * self.cluster_size
        self.mft_runs: list[tuple[int, int, int]] = [(0, 0, self.mft_lcn)]  # (vcn, count, lcn)
        self.record_count = 0
        self._load_mft_runs()

    # ------------------------------------------------------------------ geometry
    def info(self) -> dict:
        if not self.valid:
            return {"valid": False, "error": "not an NTFS volume"}
        ver = self.dev.pread(self.offset + 0x30 * self.cluster_size + 0x48, 8)  # $Volume version
        return {
            "valid": True,
            "type": "NTFS",
            "serial": f"{self.serial:016X}",
            "bytes_per_sector": self.bytes_per_sector,
            "cluster_size": self.cluster_size,
            "record_size": self.record_size,
            "volume_size": self.volume_size,
            "mft_lcn": self.mft_lcn,
            "mft_mirror_lcn": self.mft_mirror_lcn,
            "mft_records": self.record_count,
            "version": ver.hex() if len(ver) == 8 else "",
            "label": self.volume_label(),
        }

    def volume_label(self) -> str:
        raw = self.pread_mft(3, 0x60, 0)  # $Volume : $VOLUME_NAME
        if not raw:
            return ""
        return raw.decode("utf-16-le", "replace").strip("\x00")

    # ---------------------------------------------------------------------- $MFT
    def _load_mft_runs(self) -> None:
        rec = self.record(0, allow_missing=True)
        if not rec:
            return
        for attr in rec["attrs"]:
            if attr["type"] == ATTR_DATA and not attr.get("resident"):
                runs = self._runlist(attr.get("runs_raw", b""))
                if runs:
                    self.mft_runs = runs
                    span = sum(count for _vcn, count, lcn in runs if lcn >= 0)
                    self.record_count = (span * self.cluster_size) // self.record_size
                    return

    def mft_offset_for(self, record_number: int) -> Optional[int]:
        target = record_number * self.record_size
        for vcn, count, lcn in self.mft_runs:
            start = vcn * self.cluster_size
            end = start + count * self.cluster_size
            if start <= target < end and lcn >= 0:
                return self.offset + lcn * self.cluster_size + (target - start)
        return None

    def record(self, number: int, allow_missing: bool = False) -> Optional[dict]:
        off = self.mft_offset_for(number)
        if off is None:
            if allow_missing:
                return None
            raise KeyError(f"MFT record {number} is not reachable through the $MFT runlist")
        raw = self.dev.pread(off, self.record_size)
        if len(raw) < 48 or raw[:4] not in (b"FILE", b"BAAD"):
            return None
        if raw[:4] == b"BAAD":
            return {"record": number, "bad": True, "attrs": [], "names": [], "in_use": False}
        usa_off = struct.unpack_from("<H", raw, 4)[0]
        usa_count = struct.unpack_from("<H", raw, 6)[0]
        if 0 < usa_off < len(raw) - 1:
            usn = raw[usa_off : usa_off + 2]
            for i in range(1, usa_count):
                pos = i * self.bytes_per_sector - 2
                if pos + 2 <= len(raw):
                    raw = raw[:pos] + usn + raw[pos + 2 :]
        lsn = struct.unpack_from("<Q", raw, 8)[0]
        flags = struct.unpack_from("<H", raw, 22)[0]
        used = struct.unpack_from("<I", raw, 24)[0]
        allocated = struct.unpack_from("<I", raw, 28)[0]
        base_record = struct.unpack_from("<Q", raw, 32)[0] & 0xFFFFFFFFFFFF
        attrs = list(self._attrs(raw, used))
        names = [a for a in attrs if a["type"] == ATTR_FILE_NAME]
        best = None
        for n in names:
            if best is None or n["namespace"] in (1, 3):
                best = n
        return {
            "record": number,
            "record_number": number,
            "in_use": bool(flags & 1),
            "is_dir": bool(flags & 2),
            "lsn": lsn,
            "flags": flags,
            "used_size": used,
            "allocated_size": allocated,
            "base_record": base_record,
            "hardlink_names": names,
            "name": (best or {}).get("name", SYSTEM_FILES.get(number, "")),
            "namespace": NAMESPACES.get((best or {}).get("namespace", 2), "?"),
            "parent": (best or {}).get("parent", 0),
            "parent_seq": (best or {}).get("parent_seq", 0),
            "si": next((a for a in attrs if a["type"] == ATTR_STANDARD_INFORMATION), None),
            "attrs": attrs,
            "deleted": not bool(flags & 1),
        }

    def _attrs(self, raw: bytes, used: int) -> Iterator[dict]:
        pos = struct.unpack_from("<H", raw, 20)[0]
        limit = min(used or len(raw), len(raw))
        while pos + 8 <= limit:
            atype = struct.unpack_from("<I", raw, pos)[0]
            if atype == ATTR_END or atype == 0:
                break
            length = struct.unpack_from("<I", raw, pos + 4)[0]
            if length < 16 or pos + length > len(raw):
                break
            nonresident = raw[pos + 8]
            name_len = raw[pos + 9]
            name_off = struct.unpack_from("<H", raw, pos + 10)[0]
            flags = struct.unpack_from("<H", raw, pos + 12)[0]
            attr_id = struct.unpack_from("<H", raw, pos + 14)[0]
            name = ""
            if name_len and name_off and pos + name_off + name_len * 2 <= len(raw):
                name = raw[pos + name_off : pos + name_off + name_len * 2].decode("utf-16-le", "replace")
            info: dict = {"type": atype, "type_name": _attr_name(atype), "id": attr_id, "name": name,
                          "resident": not nonresident, "flags": flags, "offset": pos, "length": length}
            if nonresident:
                start_vcn = struct.unpack_from("<Q", raw, pos + 16)[0]
                last_vcn = struct.unpack_from("<Q", raw, pos + 24)[0]
                run_off = struct.unpack_from("<H", raw, pos + 32)[0]
                alloc = struct.unpack_from("<Q", raw, pos + 40)[0]
                size = struct.unpack_from("<Q", raw, pos + 48)[0]
                initialized = struct.unpack_from("<Q", raw, pos + 56)[0]
                runs_raw = raw[pos + run_off : pos + length]
                info.update({"start_vcn": start_vcn, "last_vcn": last_vcn, "allocated": alloc, "size": size,
                             "initialized": initialized, "runs_raw": runs_raw,
                             "runs": self._runlist(runs_raw)})
            else:
                val_len = struct.unpack_from("<I", raw, pos + 16)[0]
                val_off = struct.unpack_from("<H", raw, pos + 20)[0]
                value = raw[pos + val_off : pos + val_off + val_len]
                info.update({"size": val_len, "value": value})
                if atype == ATTR_FILE_NAME and len(value) >= 66:
                    info.update(self._file_name(value))
                elif atype == ATTR_STANDARD_INFORMATION and len(value) >= 48:
                    info.update(self._standard_information(value))
                elif atype == ATTR_INDEX_ROOT:
                    info["index_root"] = self._index_root(value)
                elif atype == ATTR_VOLUME_NAME or atype == ATTR_OBJECT_ID:
                    info["text"] = value.decode("utf-16-le", "replace").strip("\x00")
            yield info
            pos += length

    def _file_name(self, value: bytes) -> dict:
        parent = struct.unpack_from("<Q", value, 0)[0]
        ctime, atime, mtime, rtime = (struct.unpack_from("<Q", value, o)[0] for o in (8, 16, 24, 32))
        alloc, size = struct.unpack_from("<Q", value, 40)[0], struct.unpack_from("<Q", value, 48)[0]
        flags = struct.unpack_from("<I", value, 56)[0]
        ns = value[65]
        name = value[66:].decode("utf-16-le", "replace")
        return {"parent": parent & 0xFFFFFFFFFFFF, "parent_seq": parent >> 48,
                "namespace": ns, "name": name, "name_size": size, "alloc_size": alloc,
                "flags": flags, "hidden": bool(flags & 2), "system": bool(flags & 4),
                "created": _ft(ctime), "modified": _ft(mtime), "accessed": _ft(atime), "mft_modified": _ft(rtime),
                "created_iso": _iso(_ft(ctime)), "modified_iso": _iso(_ft(mtime)),
                "accessed_iso": _iso(_ft(atime)), "mft_modified_iso": _iso(_ft(rtime))}

    def _standard_information(self, value: bytes) -> dict:
        ctime, atime, mtime, rtime = (struct.unpack_from("<Q", value, o)[0] for o in (0, 8, 16, 24))
        attrs = struct.unpack_from("<I", value, 32)[0]
        owner = struct.unpack_from("<I", value, 48)[0] if len(value) >= 52 else 0
        return {"si_created": _ft(ctime), "si_modified": _ft(mtime), "si_accessed": _ft(atime), "si_mft_modified": _ft(rtime),
                "si_created_iso": _iso(_ft(ctime)), "si_modified_iso": _iso(_ft(mtime)),
                "si_accessed_iso": _iso(_ft(atime)), "si_mft_modified_iso": _iso(_ft(rtime)),
                "file_attrs": attrs, "readonly": bool(attrs & 1), "hidden_flag": bool(attrs & 2),
                "system_flag": bool(attrs & 4), "archive": bool(attrs & 0x20), "compressed": bool(attrs & 0x800),
                "encrypted": bool(attrs & 0x4000), "owner_id": owner}

    def _index_root(self, value: bytes) -> dict:
        if len(value) < 16:
            return {}
        attr_type, collation, size = struct.unpack_from("<III", value, 0)
        clusters = struct.unpack_from("<I", value, 12)[0]
        node_off = 16
        entries = self._index_entries(value, node_off)
        return {"indexed_attr": attr_type, "collation": collation, "index_size": size,
                "node_clusters": clusters, "entries": entries, "count": len(entries)}

    def _index_entries(self, buf: bytes, offset: int, depth: int = 0) -> list[dict]:
        out: list[dict] = []
        if depth > 6 or offset + 16 > len(buf):
            return out
        entries_off = struct.unpack_from("<I", buf, offset)[0]
        count = struct.unpack_from("<I", buf, offset + 4)[0]
        end = struct.unpack_from("<I", buf, offset + 8)[0]
        pos = offset + entries_off
        for _ in range(min(count, 4096)):
            if pos + 16 > len(buf):
                break
            file_ref = struct.unpack_from("<Q", buf, pos)[0]
            entry_size = struct.unpack_from("<H", buf, pos + 8)[0]
            flags = struct.unpack_from("<H", buf, pos + 12)[0]
            name_len = buf[pos + 10]
            if entry_size < 16:
                break
            if flags & 2:  # last entry == sub-node pointer
                child_vcn = struct.unpack_from("<Q", buf, pos + 16)[0] if pos + 24 <= len(buf) else 0
                out.append({"subnode_vcn": child_vcn, "flags": flags})
                pos += entry_size
                continue
            name = buf[pos + 16 : pos + 16 + name_len * 2].decode("utf-16-le", "replace")
            out.append({"record": file_ref & 0xFFFFFFFFFFFF, "sequence": file_ref >> 48,
                        "name": name, "namespace": buf[pos + 65] if pos + 65 < len(buf) else 0,
                        "flags": flags, "size": entry_size})
            pos += entry_size
            if pos >= offset + end:
                break
        return out

    def _runlist(self, raw: bytes) -> list[tuple[int, int, int]]:
        """Decode an NTFS runlist into ``[(start_vcn, cluster_count, lcn)]``."""
        runs: list[tuple[int, int, int]] = []
        vcn = 0
        lcn = 0
        i = 0
        while i < len(raw):
            header = raw[i]
            if header == 0:
                break
            len_bytes = header & 0x0F
            off_bytes = (header >> 4) & 0x0F
            i += 1
            if i + len_bytes + off_bytes > len(raw) or len_bytes == 0:
                break
            count = int.from_bytes(raw[i : i + len_bytes], "little")
            i += len_bytes
            delta = int.from_bytes(raw[i : i + off_bytes], "little", signed=True) if off_bytes else 0
            i += off_bytes
            lcn += delta
            runs.append((vcn, count, lcn))
            vcn += count
        return runs

    # -------------------------------------------------------------------- data
    def read_attr(self, attr: dict, max_bytes: int = 8 << 20) -> bytes:
        if attr.get("resident"):
            return attr.get("value", b"")[:max_bytes]
        out = bytearray()
        for _vcn, count, lcn in attr.get("runs", []):
            if lcn < 0:
                break
            span = min(count * self.cluster_size, max_bytes - len(out))
            if span <= 0:
                break
            out.extend(self.dev.pread(self.offset + lcn * self.cluster_size, span))
        return bytes(out[:max_bytes])

    def data_attrs(self, rec: dict) -> list[dict]:
        return [a for a in rec["attrs"] if a["type"] == ATTR_DATA]

    def ads_names(self, rec: dict) -> list[str]:
        return [a["name"] for a in self.data_attrs(rec) if a.get("name")]

    def read_path(self, path: str, max_bytes: int = 8 << 20) -> Optional[dict]:
        """Resolve ``\\Windows\\System32\\config\\SYSTEM`` style paths from the root."""
        parts = [p for p in path.replace("/", "\\").strip("\\").split("\\") if p and p != "."]
        current = 5  # NTFS root directory record
        for i, part in enumerate(parts):
            entries = self.list_dir(current)
            match = next((e for e in entries if e["name"].lower() == part.lower()), None)
            if not match:
                return None
            current = match["record"]
            if i == len(parts) - 1:
                rec = self.record(current)
                if not rec:
                    return None
                datas = [a for a in self.data_attrs(rec) if not a.get("name")]
                if not datas:
                    return {"record": current, "name": rec["name"], "is_dir": rec["is_dir"], "data": b""}
                attr = max(datas, key=lambda a: a.get("size", 0))
                return {"record": current, "name": rec["name"], "is_dir": rec["is_dir"],
                        "size": attr.get("size", 0), "data": self.read_attr(attr, max_bytes), "attr": attr}
        return None

    # --------------------------------------------------------------- directories
    def list_dir(self, record_number: int = 5, max_entries: int = 20000) -> list[dict]:
        rec = self.record(record_number)
        if not rec or not rec["is_dir"]:
            return []
        entries: list[dict] = []
        for attr in rec["attrs"]:
            if attr["type"] == ATTR_INDEX_ROOT:
                # root entries are in the resident value's node header, not the parsed copy
                pass
        for attr in rec["attrs"]:
            if attr["type"] == ATTR_INDEX_ROOT and attr.get("resident"):
                value = attr.get("value", b"")
                if len(value) < 32:
                    continue
                # node header starts at 16; entries live inside the value buffer
                for e in self._index_entries(value, 16):
                    if "record" in e:
                        entries.append(self._entry(e))
        # big directories keep the rest in $INDEX_ALLOCATION
        for attr in rec["attrs"]:
            if attr["type"] == ATTR_INDEX_ALLOCATION and not attr.get("resident"):
                buf = self.read_attr(attr, 32 << 20)
                for off in range(0, len(buf), self.index_record_size):
                    block = buf[off : off + self.index_record_size]
                    if len(block) < 32 or block[:4] != b"INDX":
                        continue
                    shift = struct.unpack_from("<H", block, 4)[0]
                    if 0 < shift < len(block) - 1:
                        usn = block[shift : shift + 2]
                        for i in range(1, struct.unpack_from("<H", block, 6)[0]):
                            pos = shift + i * self.bytes_per_sector - 2
                            if pos + 2 <= len(block):
                                block = block[:pos] + usn + block[pos + 2 :]
                    for e in self._index_entries(block, 24):
                        if "record" in e:
                            entries.append(self._entry(e))
        seen = set()
        unique = []
        for e in entries:
            if e["record"] in seen:
                continue
            seen.add(e["record"])
            unique.append(e)
        return unique[:max_entries]

    def _entry(self, index_entry: dict) -> dict:
        rec = self.record(index_entry["record"], allow_missing=True) or {}
        si = rec.get("si") or {}
        return {
            "record": index_entry["record"],
            "name": index_entry["name"],
            "namespace": NAMESPACES.get(index_entry.get("namespace", 1), "?"),
            "is_dir": rec.get("is_dir", False),
            "size": (rec.get("hardlink_names") or [{}])[0].get("name_size", 0),
            "alloc": (rec.get("hardlink_names") or [{}])[0].get("alloc_size", 0),
            "modified": si.get("si_modified", 0),
            "modified_iso": si.get("si_modified_iso", ""),
            "created_iso": si.get("si_created_iso", ""),
            "attributes": si.get("file_attrs", 0),
            "hidden": si.get("hidden_flag", False),
            "system": si.get("system_flag", False),
            "ads": self.ads_names(rec) if rec else [],
        }

    # -------------------------------------------------------------- enumeration
    def iter_records(self, limit: int = 200000, skip_unused: bool = True) -> Iterator[dict]:
        total = min(self.record_count or 100000, limit)
        for n in range(total):
            try:
                rec = self.record(n, allow_missing=True)
            except (KeyError, struct.error):
                continue
            if not rec:
                continue
            if skip_unused and not rec["in_use"]:
                continue
            yield rec

    def deleted_files(self, limit: int = 300) -> list[dict]:
        out = []
        for rec in self.iter_records(limit=limit * 20, skip_unused=False):
            if rec["in_use"] or not rec.get("name"):
                continue
            datas = self.data_attrs(rec)
            size = max((a.get("size", 0) for a in datas), default=0)
            out.append({
                "record": rec["record"], "name": rec["name"], "is_dir": rec["is_dir"], "size": size,
                "deleted": True,
                "recoverable": bool(datas and size),
                "mft_modified_iso": ((rec.get("si") or {}).get("si_mft_modified_iso", "")),
                "ads": self.ads_names(rec),
            })
            if len(out) >= limit:
                break
        return out

    def timestomp_candidates(self, limit: int = 200) -> list[dict]:
        """$STANDARD_INFORMATION vs $FILE_NAME mismatch == classic timestomping."""
        out = []
        for rec in self.iter_records(limit=60000):
            si = rec.get("si") or {}
            names = rec.get("hardlink_names") or []
            if not names or not si:
                continue
            fn = names[0]
            diffs = {
                "modified": abs((si.get("si_modified", 0) or 0) - (fn.get("modified", 0) or 0)),
                "created": abs((si.get("si_created", 0) or 0) - (fn.get("created", 0) or 0)),
                "mft": abs((si.get("si_mft_modified", 0) or 0) - (fn.get("mft_modified", 0) or 0)),
            }
            worst = max(diffs.values()) if diffs else 0
            if worst > 1.0:  # sub-second drift is normal for some drivers
                out.append({"record": rec["record"], "name": rec["name"], "skew_seconds": round(worst, 2),
                            "detail": {k: round(v, 2) for k, v in diffs.items()},
                            "si_modified_iso": si.get("si_modified_iso", ""), "fn_modified_iso": fn.get("modified_iso", "")})
                if len(out) >= limit:
                    break
        return out

    def all_streams(self) -> list[dict]:
        """Every named data stream on the volume (ADS hunting)."""
        out = []
        for rec in self.iter_records(limit=120000):
            for attr in self.data_attrs(rec):
                if attr.get("name"):
                    out.append({"record": rec["record"], "file": rec["name"], "stream": attr["name"],
                                "size": attr.get("size", 0)})
        return out

    def timeline(self, limit: int = 500) -> list[dict]:
        """Newest modified files — quick triage timeline."""
        events = []
        for rec in self.iter_records(limit=60000):
            si = rec.get("si") or {}
            if not si.get("si_modified"):
                continue
            events.append({"time": si["si_modified"], "iso": si.get("si_modified_iso", ""), "record": rec["record"],
                           "name": rec.get("name", ""), "is_dir": rec["is_dir"], "size": (rec.get("hardlink_names") or [{}])[0].get("name_size", 0),
                           "source": "$SI", "action": "modified"})
        events.sort(key=lambda e: e["time"], reverse=True)
        return events[:limit]


def _attr_name(t: int) -> str:
    return {
        0x10: "$STANDARD_INFORMATION", 0x20: "$ATTRIBUTE_LIST", 0x30: "$FILE_NAME", 0x40: "$OBJECT_ID",
        0x50: "$SECURITY_DESCRIPTOR", 0x60: "$VOLUME_NAME", 0x70: "$VOLUME_INFORMATION", 0x80: "$DATA",
        0x90: "$INDEX_ROOT", 0xA0: "$INDEX_ALLOCATION", 0xB0: "$BITMAP", 0xC0: "$REPARSE_POINT",
        0xD0: "$EA_INFORMATION", 0xE0: "$EA", 0x100: "$LOGGED_UTILITY_STREAM",
    }.get(t, f"0x{t:x}")
