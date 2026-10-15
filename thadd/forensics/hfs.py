"""THADD OS Forensics — HFS+ / HFSX reader (classic macOS volumes).

Parses the volume header (at offset 1024) and walks the **catalog B-tree** to
enumerate files and folders, decode HFS+ timestamps and expose Finder metadata.
Used for macOS targets up to High Sierra/Mojave, Time Machine backups and
external drives formatted "Mac OS Extended".
"""

from __future__ import annotations

import struct
import time
from typing import Iterator, Optional

HFS_MAGIC = 0x482B   # 'H+'
HFSX_MAGIC = 0x4858  # 'HX'

CATALOG_KEY = (0x0001, 0x0002, 0x0003, 0x0004)  # folder, file, folder thread, file thread

_EPOCH_DELTA = 2082844800  # seconds between 1904-01-01 and 1970-01-01


def _unix(ts: int) -> float:
    return (ts - _EPOCH_DELTA) if ts else 0.0


def _iso(ts: float) -> str:
    if not ts or ts < 0:
        return ""
    try:
        return time.strftime("%Y-%m-%d %H:%M:%S", time.gmtime(ts))
    except (ValueError, OSError):
        return ""


class HFS:
    def __init__(self, dev, offset: int = 0):
        self.dev = dev
        self.offset = offset
        self.header = self._load_header()
        self.valid = self.header is not None
        if self.valid:
            self.block_size = self.header["block_size"]
            self.catalog = self.header["catalog_fork"]

    def _load_header(self) -> Optional[dict]:
        raw = self.dev.pread(self.offset + 1024, 512)
        if len(raw) < 512:
            return None
        magic = struct.unpack_from(">H", raw, 0)[0]
        if magic not in (HFS_MAGIC, HFSX_MAGIC):
            return None
        sig = {HFS_MAGIC: "H+", HFSX_MAGIC: "HX"}[magic]
        h = {
            "signature": sig,
            "version": struct.unpack_from(">H", raw, 2)[0],
            "attributes": struct.unpack_from(">I", raw, 4)[0],
            "last_mounted_version": struct.unpack_from(">I", raw, 8)[0],
            "journal_info_block": struct.unpack_from(">I", raw, 12)[0],
            "created": _unix(struct.unpack_from(">I", raw, 16)[0]),
            "modified": _unix(struct.unpack_from(">I", raw, 20)[0]),
            "backup": _unix(struct.unpack_from(">I", raw, 24)[0]),
            "checked": _unix(struct.unpack_from(">I", raw, 28)[0]),
            "file_count": struct.unpack_from(">I", raw, 32)[0],
            "folder_count": struct.unpack_from(">I", raw, 36)[0],
            "block_size": struct.unpack_from(">I", raw, 40)[0],
            "total_blocks": struct.unpack_from(">I", raw, 44)[0],
            "free_blocks": struct.unpack_from(">I", raw, 48)[0],
            "case_sensitive": magic == HFSX_MAGIC,
        }
        h["catalog_fork"] = self._fork(raw, 272)
        h["extents_fork"] = self._fork(raw, 192)
        h["allocation_fork"] = self._fork(raw, 112)
        return h

    def _fork(self, raw: bytes, off: int) -> dict:
        if off + 80 > len(raw):
            return {}
        logical, clump = struct.unpack_from(">II", raw, off)
        total, extents = struct.unpack_from(">II", raw, off + 12)
        ext_list = []
        for i in range(min(extents, 8)):
            start, count = struct.unpack_from(">II", raw, off + 16 + i * 8)
            if count:
                ext_list.append((start, count))
        return {"logical_size": logical, "total_blocks": total, "extents": ext_list}

    def info(self) -> dict:
        if not self.valid:
            return {"valid": False, "error": "not an HFS+ volume"}
        h = self.header
        return {
            "valid": True,
            "type": "HFSX (case sensitive)" if h["case_sensitive"] else "HFS+",
            "block_size": h["block_size"],
            "size": h["total_blocks"] * h["block_size"],
            "free": h["free_blocks"] * h["block_size"],
            "files": h["file_count"],
            "folders": h["folder_count"],
            "created": _iso(h["created"]),
            "modified": _iso(h["modified"]),
            "backup": _iso(h["backup"]),
            "last_mounted_version": f"{h['last_mounted_version'] >> 16}.{(h['last_mounted_version'] >> 8) & 0xFF}",
            "journaled": bool(h["attributes"] & 0x200),
            "journal_info_block": h["journal_info_block"],
            "case_sensitive": h["case_sensitive"],
        }

    def read_fork(self, fork: dict, max_bytes: int = 16 << 20) -> bytes:
        out = bytearray()
        for start, count in fork.get("extents", []):
            if len(out) >= max_bytes:
                break
            span = min(count * self.block_size, max_bytes - len(out))
            out.extend(self.dev.pread(self.offset + start * self.block_size, span))
        size = min(fork.get("logical_size", len(out)), max_bytes)
        return bytes(out[:size])

    # ---------------------------------------------------------------- B-tree walk
    def catalog_entries(self, limit: int = 40000) -> list[dict]:
        """Walk the catalog B-tree and return folder/file records."""
        if not self.valid or not self.catalog.get("extents"):
            return []
        data = self.read_fork(self.catalog, 32 << 20)
        if len(data) < 16:
            return []
        entries: list[dict] = []

        def node_at(index: int) -> bytes:
            off = index * 8192
            return data[off : off + 8192]

        def walk(index: int, depth: int = 0) -> None:
            if depth > 8 or len(entries) >= limit:
                return
            node = node_at(index)
            if len(node) < 14:
                return
            fnum, fsize = struct.unpack_from(">IH", node, 0)
            num_records = struct.unpack_from(">H", node, 10)[0]
            if not num_records or fnum != index:
                return
            rec_offs = [
                struct.unpack_from(">H", node, 14 + i * 2)[0]
                for i in range(min(num_records + 1, fsize // 2 - 7))
                if 14 + i * 2 + 2 <= len(node)
            ]
            for i in range(num_records):
                if i + 1 >= len(rec_offs):
                    break
                start, end = rec_offs[i], rec_offs[i + 1]
                if not (0 < start < end <= len(node)):
                    continue
                rec = node[start:end]
                if not rec:
                    continue
                key_len = struct.unpack_from(">H", rec, 0)[0]
                key = rec[2 : 2 + key_len]
                if not key:
                    continue
                parent_id, name_len = struct.unpack_from(">IH", key, 0)
                name = key[6 : 6 + name_len * 2].decode("utf-16-be", "replace")
                body = rec[2 + key_len + (key_len % 2) :]
                if not body:
                    continue
                record_type = struct.unpack_from(">H", body, 0)[0]
                if record_type == 0x0001 and len(body) >= 88:      # folder record
                    entries.append(self._folder(parent_id, name, body))
                elif record_type == 0x0002 and len(body) >= 248:   # file record
                    entries.append(self._file(parent_id, name, body))
                elif record_type in (0xFF, 0x0000) and len(body) >= 8:
                    child = struct.unpack_from(">I", body, 0)[0]
                    walk(child, depth + 1)

        walk(0)
        if not entries:  # header node may be elsewhere in unusual volumes
            for idx in range(1, min(len(data) // 8192, 32)):
                walk(idx)
                if entries:
                    break
        return entries

    def _folder(self, parent_id: int, name: str, body: bytes) -> dict:
        flags, valence = struct.unpack_from(">IH", body, 2)
        ctime, mtime = struct.unpack_from(">II", body, 12)
        acctime, btime = struct.unpack_from(">II", body, 24)
        return {"id": struct.unpack_from(">I", body, 8)[0], "parent": parent_id, "name": name, "type": "folder",
                "flags": flags, "items": valence, "created": _iso(_unix(ctime)), "modified": _iso(_unix(mtime)),
                "accessed": _iso(_unix(acctime)), "backup": _iso(_unix(btime)),
                "hidden": bool(flags & 0x4000), "invisible": bool(flags & 0x4000),
                "custom_icon": bool(flags & 0x20)}

    def _file(self, parent_id: int, name: str, body: bytes) -> dict:
        flags = struct.unpack_from(">H", body, 2)[0]
        ctime, mtime = struct.unpack_from(">II", body, 12)
        acctime, btime = struct.unpack_from(">II", body, 24)
        type_creator = body[32:40]
        finder_flags = struct.unpack_from(">H", body, 22)[0]
        data_fork = struct.unpack_from(">I", body, 88)[0] if len(body) > 92 else 0
        return {
            "id": struct.unpack_from(">I", body, 8)[0], "parent": parent_id, "name": name, "type": "file",
            "flags": flags, "size": data_fork, "created": _iso(_unix(ctime)), "modified": _iso(_unix(mtime)),
            "accessed": _iso(_unix(acctime)), "backup": _iso(_unix(btime)),
            "hidden": bool(finder_flags & 0x4000), "locked": bool(finder_flags & 0x1000),
            "os_type": type_creator[:4].decode("latin-1", "replace"),
            "os_creator": type_creator[4:].decode("latin-1", "replace"),
        }

    def tree(self, limit: int = 8000) -> list[dict]:
        """Entries with a materialised path (best effort from the flat catalog)."""
        entries = self.catalog_entries(limit)
        by_id = {e["id"]: e for e in entries if e.get("id")}
        out = []
        for e in entries[:limit]:
            parts = []
            cur, hops = e, 0
            while cur and hops < 32:
                parts.append(cur.get("name", ""))
                cur = by_id.get(cur.get("parent"))
                hops += 1
            out.append({**e, "path": "/" + "/".join(reversed(parts))})
        return out

    def system_artifacts(self, limit: int = 400) -> dict:
        """macOS-specific forensic artefacts present on this volume."""
        found = {"plists": [], "quarantine": [], "spotlight": [], "launch_agents": [], "users": [], "trash": []}
        for e in self.tree(limit=20000):
            path = e.get("path", "")
            low = path.lower()
            if low.endswith(".plist") and len(found["plists"]) < limit:
                found["plists"].append({"path": path, "size": e.get("size", 0), "modified": e.get("modified", "")})
            if "/library/launchagents" in low or "/library/launchdaemons" in low:
                found["launch_agents"].append({"path": path, "modified": e.get("modified", "")})
            if "/.trash" in low:
                found["trash"].append({"path": path, "size": e.get("size", 0)})
            if low.startswith("/users/") and path.count("/") == 2:
                found["users"].append(path.split("/")[2])
            if "/.spotlight-v100" in low:
                found["spotlight"].append(path)
        found["users"] = sorted(set(found["users"]))
        return found
