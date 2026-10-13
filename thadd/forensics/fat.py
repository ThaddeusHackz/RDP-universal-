"""THADD OS Forensics — FAT12/16/32 + exFAT reader.

EFI System Partitions, USB sticks, camera cards and firmware volumes are all FAT,
which makes this reader essential when hunting for bootkits: ``EFI/Microsoft/Boot``,
``EFI/BOOT/BOOTX64.EFI``, ``EFI/APPLE`` firmware, and unsigned loaders.
"""

from __future__ import annotations

import struct
import time
from typing import Optional

ATTR_READONLY, ATTR_HIDDEN, ATTR_SYSTEM, ATTR_VOLUME_ID, ATTR_DIRECTORY, ATTR_ARCHIVE = 1, 2, 4, 8, 16, 32
ATTR_LFN = 0x0F


def _iso(ts: float) -> str:
    if not ts:
        return ""
    try:
        return time.strftime("%Y-%m-%d %H:%M:%S", time.gmtime(ts))
    except (ValueError, OSError):
        return ""


class FAT:
    def __init__(self, dev, offset: int = 0):
        self.dev = dev
        self.offset = offset
        boot = dev.pread(offset, 512)
        self.valid = False
        self.exfat = False
        if len(boot) < 512:
            return
        if boot[3:11] == b"EXFAT   ":
            self.exfat = True
            self._init_exfat(boot)
            return
        if boot[510:512] != b"\x55\xaa":
            return
        self.bytes_per_sector = struct.unpack_from("<H", boot, 0x0B)[0]
        if self.bytes_per_sector not in (512, 1024, 2048, 4096):
            return
        self.sectors_per_cluster = boot[0x0D] or 1
        self.reserved_sectors = struct.unpack_from("<H", boot, 0x0E)[0]
        self.num_fats = boot[0x10] or 1
        self.root_entries = struct.unpack_from("<H", boot, 0x11)[0]
        self.total_sectors = struct.unpack_from("<H", boot, 0x13)[0] or struct.unpack_from("<I", boot, 0x20)[0]
        self.fat_size = struct.unpack_from("<H", boot, 0x16)[0] or struct.unpack_from("<I", boot, 0x24)[0]
        self.root_cluster = struct.unpack_from("<I", boot, 0x2C)[0] if self.fat_size else 0
        self.cluster_size = self.bytes_per_sector * self.sectors_per_cluster
        self.cluster_count = (self.total_sectors - self.reserved_sectors - self.num_fats * self.fat_size -
                              (self.root_entries * 32) // self.bytes_per_sector) // self.sectors_per_cluster
        if self.cluster_count < 4085:
            self.fstype = "FAT12"
            self.fat_bits = 12
        elif self.cluster_count < 65525:
            self.fstype = "FAT16"
            self.fat_bits = 16
        else:
            self.fstype = "FAT32"
            self.fat_bits = 32
        self.data_start = self.offset + (self.reserved_sectors + self.num_fats * self.fat_size) * self.bytes_per_sector
        self.root_dir_offset = self.offset + (self.reserved_sectors + self.num_fats * self.fat_size) * self.bytes_per_sector
        self.fat_offset = self.offset + self.reserved_sectors * self.bytes_per_sector
        self.volume_label = ""
        self.volume_id = struct.unpack_from("<I", boot, 0x27)[0] if len(boot) > 0x2B else 0
        self.valid = True

    def _init_exfat(self, boot: bytes) -> None:
        self.bytes_per_sector = 1 << boot[0x6C]
        self.sectors_per_cluster = 1 << boot[0x6D]
        self.cluster_size = self.bytes_per_sector * self.sectors_per_cluster
        self.fat_offset = self.offset + struct.unpack_from("<I", boot, 0x50)[0] * self.bytes_per_sector
        self.data_start = self.offset + struct.unpack_from("<I", boot, 0x58)[0] * self.bytes_per_sector
        self.cluster_count = struct.unpack_from("<I", boot, 0x5C)[0]
        self.root_cluster = struct.unpack_from("<I", boot, 0x60)[0]
        self.serial = struct.unpack_from("<I", boot, 0x64)[0]
        self.fstype = "exFAT"
        self.fat_bits = 32
        self.volume_label = ""
        self.valid = True

    # ---------------------------------------------------------------------- info
    def info(self) -> dict:
        if not self.valid:
            return {"valid": False, "error": "not a FAT/exFAT volume"}
        return {
            "valid": True, "type": self.fstype,
            "bytes_per_sector": self.bytes_per_sector, "cluster_size": self.cluster_size,
            "clusters": self.cluster_count,
            "size": self.cluster_count * self.cluster_size,
            "fat_offset": self.fat_offset - self.offset,
            "root_cluster": self.root_cluster,
            "label": self.volume_label or self._scan_label(),
            "serial": f"{getattr(self, 'volume_id', getattr(self, 'serial', 0)):08X}",
        }

    def _scan_label(self) -> str:
        for e in self.list_dir(self.root_cluster or 0, limit=200):
            if e.get("is_volume_label"):
                return e["name"]
        return ""

    # ------------------------------------------------------------------- clusters
    def next_cluster(self, cluster: int) -> int:
        if self.fat_bits == 32:
            raw = self.dev.pread(self.fat_offset + cluster * 4, 4)
            return struct.unpack("<I", raw)[0] & 0x0FFFFFFF if len(raw) == 4 else 0x0FFFFFF8
        if self.fat_bits == 16:
            raw = self.dev.pread(self.fat_offset + cluster * 2, 2)
            return struct.unpack("<H", raw)[0] if len(raw) == 2 else 0xFFFF
        pos = cluster + cluster // 2
        raw = self.dev.pread(self.fat_offset + pos, 2)
        if len(raw) < 2:
            return 0xFFF
        val = struct.unpack("<H", raw)[0]
        return (val >> 4) if cluster & 1 else (val & 0x0FFF)

    def is_eoc(self, cluster: int) -> bool:
        limit = {12: 0xFF8, 16: 0xFFF8, 32: 0x0FFFFFF8}[self.fat_bits]
        return cluster >= limit or cluster < 2

    def chain(self, start: int, limit: int = 100000) -> list[int]:
        out = []
        cluster = start
        guard = 0
        while not self.is_eoc(cluster) and guard < limit:
            out.append(cluster)
            cluster = self.next_cluster(cluster)
            guard += 1
            if cluster in out[-100:]:
                break  # loop protection on corrupt tables
        return out

    def cluster_offset(self, cluster: int) -> int:
        return self.data_start + (cluster - 2) * self.cluster_size

    def read_chain(self, start: int, size: int = 0, max_bytes: int = 16 << 20) -> bytes:
        out = bytearray()
        for c in self.chain(start):
            if len(out) >= (size or max_bytes):
                break
            out.extend(self.dev.pread(self.cluster_offset(c), self.cluster_size))
        return bytes(out[: size or max_bytes])

    # --------------------------------------------------------------- directories
    def list_dir(self, cluster: int, limit: int = 20000) -> list[dict]:
        if self.exfat:
            return self._list_exfat(cluster, limit)
        entries: list[dict] = []
        if cluster in (0, None):  # FAT12/16 fixed root
            raw = self.dev.pread(self.root_dir_offset, self.root_entries * 32 or self.cluster_size * 2)
            return self._parse_dir(raw, limit)
        while cluster and len(entries) < limit:
            raw = self.dev.pread(self.cluster_offset(cluster), self.cluster_size)
            entries.extend(self._parse_dir(raw, limit - len(entries), subdir=True))
            cluster = self.next_cluster(cluster)
            if self.is_eoc(cluster):
                break
        return entries

    def _parse_dir(self, raw: bytes, limit: int, subdir: bool = False) -> list[dict]:
        out: list[dict] = []
        lfn_parts: list[tuple[int, str]] = []
        for i in range(0, len(raw) - 31, 32):
            e = raw[i : i + 32]
            if e[0] == 0x00:
                break
            if e[0] == 0xE5:
                lfn_parts = []
                continue
            if e[11] == ATTR_LFN:
                seq = e[0] & 0x3F
                chunk = (e[1:11] + e[14:26] + e[28:32]).decode("utf-16-le", "replace")
                lfn_parts.append((seq, chunk.replace("\uffff", "").rstrip("\x00")))
                continue
            name = self._short_name(e)
            if lfn_parts:
                ordered = "".join(chunk for _seq, chunk in sorted(lfn_parts))
                name = ordered.rstrip("\x00") or name
                lfn_parts = []
            attrs = e[11]
            cluster = struct.unpack_from("<H", e, 26)[0] | (struct.unpack_from("<H", e, 20)[0] << 16) if self.fat_bits == 32 else struct.unpack_from("<H", e, 26)[0]
            size = struct.unpack_from("<I", e, 28)[0]
            mtime = self._dos_time(struct.unpack_from("<H", e, 24)[0], struct.unpack_from("<H", e, 22)[0])
            ctime = self._dos_time(struct.unpack_from("<H", e, 16)[0], struct.unpack_from("<H", e, 14)[0])
            out.append({
                "name": name, "cluster": cluster, "size": size,
                "is_dir": bool(attrs & ATTR_DIRECTORY), "hidden": bool(attrs & ATTR_HIDDEN),
                "system": bool(attrs & ATTR_SYSTEM), "readonly": bool(attrs & ATTR_READONLY),
                "archive": bool(attrs & ATTR_ARCHIVE), "is_volume_label": bool(attrs & ATTR_VOLUME_ID),
                "modified": _iso(mtime), "created": _iso(ctime), "attributes": attrs,
                "deleted": False, "long_name": bool(lfn_parts),
            })
            if len(out) >= limit:
                break
        return out

    def _short_name(self, e: bytes) -> str:
        base = e[0:8].decode("cp437", "replace").strip()
        ext = e[8:11].decode("cp437", "replace").strip()
        return f"{base}.{ext}" if ext else base

    def _dos_time(self, date: int, time_: int) -> float:
        if not date:
            return 0.0
        try:
            import calendar

            return calendar.timegm((
                ((date >> 9) & 0x7F) + 1980, (date >> 5) & 0x0F, date & 0x1F,
                (time_ >> 11) & 0x1F, (time_ >> 5) & 0x3F, (time_ & 0x1F) * 2, 0, 0, 0))
        except Exception:
            return 0.0

    def _list_exfat(self, cluster: int, limit: int) -> list[dict]:
        raw = self.read_chain(cluster, max_bytes=self.cluster_size * 64)
        out: list[dict] = []
        i = 0
        while i + 32 <= len(raw) and len(out) < limit:
            e = raw[i : i + 32]
            etype = e[0]
            if etype == 0x00:
                break
            if etype == 0x85:  # file entry
                secondary = e[1]
                attrs = struct.unpack_from("<H", e, 4)[0]
                ctime = struct.unpack_from("<I", e, 8)[0]
                mtime = struct.unpack_from("<I", e, 12)[0]
                atime = struct.unpack_from("<I", e, 16)[0]
                size = struct.unpack_from("<Q", e, 24)[0] if len(e) >= 32 else 0
                name = ""
                first_cluster = 0
                if secondary and i + 64 <= len(raw):
                    s = raw[i + 32 : i + 64]
                    if s[0] == 0xC0:
                        name = s[2:32].decode("utf-16-le", "replace").rstrip("\x00")
                        first_cluster = struct.unpack_from("<I", s, 20)[0]
                out.append({
                    "name": name or "<unnamed>", "cluster": first_cluster, "size": size,
                    "is_dir": bool(attrs & 0x10), "hidden": bool(attrs & 0x02), "system": bool(attrs & 0x04),
                    "readonly": bool(attrs & 0x01), "archive": bool(attrs & 0x20),
                    "created": _iso(ctime), "modified": _iso(mtime), "accessed": _iso(atime),
                    "deleted": False,
                })
                i += 32 * (secondary + 1)
                continue
            i += 32
        return out

    # ------------------------------------------------------------------ forensics
    def deleted_entries(self, limit: int = 300) -> list[dict]:
        """First byte 0xE5 == deleted directory entry (data may still be intact)."""
        out: list[dict] = []
        if self.exfat:
            return out
        raw = self.dev.pread(self.root_dir_offset, min(self.root_entries * 32 or self.cluster_size * 8, 1 << 20))
        for i in range(0, len(raw) - 31, 32):
            e = raw[i : i + 32]
            if e[0] != 0xE5 or e[11] == ATTR_LFN:
                continue
            name = e[1:11].decode("cp437", "replace").strip()
            out.append({"name": name, "cluster": struct.unpack_from("<H", e, 26)[0],
                        "size": struct.unpack_from("<I", e, 28)[0],
                        "is_dir": bool(e[11] & ATTR_DIRECTORY), "deleted": True,
                        "note": "cluster chain may be partially overwritten"})
            if len(out) >= limit:
                break
        return out

    def efi_artifacts(self) -> dict:
        """Everything an attacker would touch on an EFI System Partition."""
        result = {"bootloaders": [], "windows_boot": [], "apple_firmware": [], "linux_grub": [], "shells": []}
        try:
            root = self.list_dir(self.root_cluster or 0)
        except Exception:
            return result
        result["bootloaders"] = [e["name"] for e in root]
        efi = next((e for e in root if e["name"].upper() == "EFI"), None)
        if not efi:
            return result
        for vendor in self.list_dir(efi["cluster"]):
            sub = self._walk(vendor["cluster"], f"/EFI/{vendor['name']}", 4, 400)
            if vendor["name"].upper() == "MICROSOFT":
                result["windows_boot"] = [s["path"] for s in sub][:200]
            elif vendor["name"].upper() == "APPLE":
                result["apple_firmware"] = [s["path"] for s in sub][:200]
            elif vendor["name"].upper() in ("BOOT", "GRUB", "UBUNTU", "DEBIAN", "FEDORA", "ARCH"):
                result["linux_grub"].append({"vendor": vendor["name"], "files": [s["path"] for s in sub][:200]})
            if any(s["path"].lower().endswith("shellx64.efi") for s in sub):
                result["shells"].append(vendor["name"])
        return result

    def _walk(self, cluster: int, prefix: str, depth: int, limit: int) -> list[dict]:
        out: list[dict] = []
        if depth <= 0:
            return out
        for e in self.list_dir(cluster, limit=limit):
            path = f"{prefix}/{e['name']}"
            out.append({**e, "path": path})
            if e["is_dir"] and len(out) < limit:
                out.extend(self._walk(e["cluster"], path, depth - 1, limit - len(out)))
        return out
