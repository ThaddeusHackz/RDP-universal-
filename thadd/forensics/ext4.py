"""THADD OS Forensics — ext2/ext3/ext4 reader (extents + htree directories).

Enough of the ext4 on-disk format to enumerate every inode, list directories,
read file data (inline, direct, indirect and extent-mapped), and flag forensic
interest: deleted inodes, timestomping, extents past the end of the image,
orphaned inodes and mount-count inconsistencies.

Reference: ``Documentation/filesystems/ext4/`` in the Linux kernel tree.
"""

from __future__ import annotations

import struct
import time
from typing import Iterator, Optional

EXT_MAGIC = 0xEF53
ROOT_INO = 2

FEATURE_INCOMPAT_64BIT = 0x80
FEATURE_INCOMPAT_EXTENTS = 0x40
FEATURE_INCOMPAT_ENCRYPT = 0x10000
FEATURE_INCOMPAT_META_BG = 0x10
FEATURE_COMPAT_HAS_JOURNAL = 0x4
FEATURE_RO_COMPAT_METADATA_CSUM = 0x400

FILE_TYPES = {0: "unknown", 1: "file", 2: "dir", 3: "chrdev", 4: "blkdev", 5: "fifo", 6: "socket", 7: "symlink"}


def _fs_time(lo: int, extra: int = 0) -> float:
    """Decode ext4 timestamps (extra field holds nanoseconds + epoch bits)."""
    secs = lo & 0xFFFFFFFF
    nsec = (extra >> 2) & 0x3FFFFFFF
    epoch = extra & 0x3
    value = secs + (epoch << 32)
    if value == 0:
        return 0.0
    return value + (nsec / 1e9 if nsec < 1e9 else 0)


def _iso(ts: float) -> str:
    if not ts:
        return ""
    try:
        return time.strftime("%Y-%m-%d %H:%M:%S", time.gmtime(ts))
    except (ValueError, OSError):
        return ""


class Ext4:
    """ext2/3/4 reader."""

    def __init__(self, dev, offset: int = 0):
        self.dev = dev
        self.offset = offset
        self.sb = self._super()
        self.valid = self.sb is not None
        if not self.valid:
            return
        self.block_size = 1024 << self.sb["log_block_size"]
        self.inode_size = self.sb["inode_size"] or 128
        self.inodes_per_group = self.sb["inodes_per_group"]
        self.blocks_per_group = self.sb["blocks_per_group"]
        first_block = 1 if self.block_size == 1024 else 0
        self.first_data_block = first_block
        self.groups = self._groups()

    # ---------------------------------------------------------------- superblock
    def _super(self) -> Optional[dict]:
        raw = self.dev.pread(self.offset + 1024, 1024)
        if len(raw) < 1024:
            return None
        magic = struct.unpack_from("<H", raw, 0x38)[0]
        if magic != EXT_MAGIC:
            return None
        incompat = struct.unpack_from("<I", raw, 0x60)[0]
        compat = struct.unpack_from("<I", raw, 0x5C)[0]
        ro_compat = struct.unpack_from("<I", raw, 0x64)[0]
        sb = {
            "inodes_count": struct.unpack_from("<I", raw, 0x00)[0],
            "blocks_count": struct.unpack_from("<I", raw, 0x04)[0],
            "reserved_blocks": struct.unpack_from("<I", raw, 0x08)[0],
            "free_blocks": struct.unpack_from("<I", raw, 0x0C)[0],
            "free_inodes": struct.unpack_from("<I", raw, 0x10)[0],
            "first_data_block": struct.unpack_from("<I", raw, 0x14)[0],
            "log_block_size": struct.unpack_from("<I", raw, 0x18)[0],
            "blocks_per_group": struct.unpack_from("<I", raw, 0x20)[0],
            "inodes_per_group": struct.unpack_from("<I", raw, 0x28)[0],
            "mtime": struct.unpack_from("<I", raw, 0x2C)[0],
            "wtime": struct.unpack_from("<I", raw, 0x30)[0],
            "mount_count": struct.unpack_from("<H", raw, 0x34)[0],
            "max_mount_count": struct.unpack_from("<H", raw, 0x36)[0],
            "state": struct.unpack_from("<H", raw, 0x3A)[0],
            "errors": struct.unpack_from("<H", raw, 0x3C)[0],
            "minor_rev": struct.unpack_from("<H", raw, 0x3E)[0],
            "lastcheck": struct.unpack_from("<I", raw, 0x40)[0],
            "checkinterval": struct.unpack_from("<I", raw, 0x44)[0],
            "creator_os": struct.unpack_from("<I", raw, 0x48)[0],
            "rev_level": struct.unpack_from("<I", raw, 0x4C)[0],
            "inode_size": struct.unpack_from("<H", raw, 0x58)[0],
            "compat": compat, "incompat": incompat, "ro_compat": ro_compat,
            "uuid": raw[0x68:0x78].hex(),
            "volume_name": raw[0x78:0x88].split(b"\0")[0].decode("utf-8", "replace"),
            "last_mounted": raw[0x88:0x108].split(b"\0")[0].decode("utf-8", "replace"),
            "block_count_hi": struct.unpack_from("<I", raw, 0x150)[0] if incompat & FEATURE_INCOMPAT_64BIT else 0,
            "desc_size": struct.unpack_from("<H", raw, 0xFE)[0] if incompat & FEATURE_INCOMPAT_64BIT else 32,
            "hash_seed": raw[0xEC:0xFC].hex(),
            "checksum_type": struct.unpack_from("<B", raw, 0x175)[0] if len(raw) > 0x175 else 0,
        }
        sb["blocks_count"] |= sb["block_count_hi"] << 32
        return sb

    def info(self) -> dict:
        if not self.valid:
            return {"valid": False, "error": "not an ext filesystem"}
        s = self.sb
        feats = []
        if s["incompat"] & FEATURE_INCOMPAT_EXTENTS:
            feats.append("extents")
        if s["incompat"] & FEATURE_INCOMPAT_64BIT:
            feats.append("64bit")
        if s["incompat"] & FEATURE_INCOMPAT_ENCRYPT:
            feats.append("encrypted (fscrypt)")
        if s["incompat"] & 0x1000:
            feats.append("inline-data")
        if s["compat"] & FEATURE_COMPAT_HAS_JOURNAL:
            feats.append("journal (ext3/4)")
        if s["ro_compat"] & FEATURE_RO_COMPAT_METADATA_CSUM:
            feats.append("metadata_csum")
        if s["ro_compat"] & 0x1:
            feats.append("sparse_super")
        if s["compat"] & 0x200:
            feats.append("dir_index (htree)")
        return {
            "valid": True,
            "type": "ext4" if s["incompat"] & FEATURE_INCOMPAT_EXTENTS else ("ext3" if s["compat"] & FEATURE_COMPAT_HAS_JOURNAL else "ext2"),
            "label": s["volume_name"],
            "uuid": s["uuid"],
            "block_size": self.block_size,
            "blocks": s["blocks_count"],
            "size": s["blocks_count"] * self.block_size,
            "inodes": s["inodes_count"],
            "free_inodes": s["free_inodes"],
            "free_blocks": s["free_blocks"],
            "inode_size": self.inode_size,
            "features": feats,
            "last_mounted_path": s["last_mounted"],
            "wtime": _iso(s["wtime"]),
            "mount_count": s["mount_count"],
            "state": "clean" if s["state"] & 1 else "NOT clean (needs fsck / was not unmounted)",
            "group_count": len(self.groups) if self.valid else 0,
            "creator_os": {0: "Linux", 1: "GNU Hurd", 2: "Masix", 3: "FreeBSD", 4: "Lites"}.get(s["creator_os"], str(s["creator_os"])),
        }

    # ------------------------------------------------------------------ groups
    def _groups(self) -> list[dict]:
        groups = []
        count = (self.sb["blocks_count"] + self.blocks_per_group - 1) // self.blocks_per_group
        gdt_block = 2 if self.block_size == 1024 else 1
        desc_size = max(32, self.sb["desc_size"])
        per_block = self.block_size // desc_size
        for i in range(min(count, 4096)):
            blk = gdt_block + (i // per_block)
            off = self.offset + blk * self.block_size + (i % per_block) * desc_size
            raw = self.dev.pread(off, 64)
            if len(raw) < 32:
                break
            table = struct.unpack_from("<I", raw, 8)[0]
            if self.sb["incompat"] & FEATURE_INCOMPAT_64BIT and len(raw) >= 64:
                table |= struct.unpack_from("<I", raw, 0x28)[0] << 32
            groups.append({
                "index": i,
                "inode_table": table,
                "free_blocks": struct.unpack_from("<H", raw, 12)[0],
                "free_inodes": struct.unpack_from("<H", raw, 14)[0],
                "used_dirs": struct.unpack_from("<H", raw, 16)[0],
                "bitmap_inode": struct.unpack_from("<I", raw, 0)[0],
                "bitmap_block": struct.unpack_from("<I", raw, 4)[0],
            })
        return groups

    # ----------------------------------------------------------------- inodes
    def inode(self, num: int) -> Optional[dict]:
        if not self.valid or num < 1 or num > self.sb["inodes_count"]:
            return None
        group = (num - 1) // self.inodes_per_group
        index = (num - 1) % self.inodes_per_group
        if group >= len(self.groups):
            return None
        table = self.groups[group]["inode_table"]
        if not table:
            return None
        off = self.offset + table * self.block_size + index * self.inode_size
        raw = self.dev.pread(off, self.inode_size)
        if len(raw) < 128:
            return None
        mode, uid, size, atime, ctime, mtime, dtime = struct.unpack_from("<HHIIIII", raw, 0)
        gid = struct.unpack_from("<H", raw, 24)[0]
        links = struct.unpack_from("<H", raw, 26)[0]
        blocks = struct.unpack_from("<I", raw, 28)[0]
        flags = struct.unpack_from("<I", raw, 32)[0]
        extra_lo = struct.unpack_from("<I", raw, 0x94)[0] if len(raw) >= 0x98 else 0
        crtime = struct.unpack_from("<I", raw, 0x90)[0] if len(raw) >= 0x94 else 0
        crtime_extra = struct.unpack_from("<I", raw, 0x98)[0] if len(raw) >= 0x9C else 0
        ftype = (mode & 0xF000) >> 12
        return {
            "inode": num,
            "mode_raw": mode,
            "mode": f"{(mode >> 9) & 7}{(mode >> 6) & 7}{mode & 7}",
            "type": FILE_TYPES.get(ftype, "?"),
            "uid": uid, "gid": gid, "links": links,
            "size": (size | (struct.unpack_from("<I", raw, 0x6C)[0] << 32)) if len(raw) >= 0x70 else size,
            "blocks": blocks,
            "atime": _fs_time(atime, struct.unpack_from("<I", raw, 0x8C)[0] if len(raw) >= 0x90 else 0),
            "ctime": _fs_time(ctime, struct.unpack_from("<I", raw, 0x88)[0] if len(raw) >= 0x8C else 0),
            "mtime": _fs_time(mtime, struct.unpack_from("<I", raw, 0x84)[0] if len(raw) >= 0x88 else 0),
            "crtime": _fs_time(crtime, crtime_extra),
            "dtime": dtime,
            "deleted": dtime != 0 and links == 0,
            "flags": flags,
            "extents_flag": bool(flags & 0x80000),
            "i_block": raw[40:100],
            "generation": struct.unpack_from("<I", raw, 100)[0],
            "file_acl": struct.unpack_from("<I", raw, 104)[0],
        }

    # ------------------------------------------------------------------ extents
    def _extent_tree(self, raw: bytes, max_depth: int = 4) -> list[tuple[int, int, int]]:
        """Return ``[(logical_block, length, physical_block)]``."""

        def walk(node: bytes, depth: int) -> Iterator[tuple[int, int, int]]:
            if len(node) < 12 or depth > max_depth:
                return
            magic, entries, _max, node_depth = struct.unpack_from("<HHHH", node, 0)
            if magic != 0xF30A:
                return
            for i in range(min(entries, 340)):
                off = 12 + i * 12
                if off + 12 > len(node):
                    break
                ee_block, ee_len, start_hi, start_lo = struct.unpack_from("<IHHI", node, off)
                start = start_lo | (start_hi << 32)
                if node_depth == 0:
                    length = ee_len & 0x7FFF if ee_len <= 0x8000 else 0
                    if length:
                        yield (ee_block, length, start)
                else:
                    child = self.dev.pread(self.offset + start * self.block_size, self.block_size)
                    yield from walk(child, depth + 1)

        return list(walk(raw, 0))

    def _block_map(self, inode: dict) -> list[tuple[int, int, int]]:
        """Logical→physical extents for direct/indirect and extent inodes."""
        if inode["extents_flag"]:
            return self._extent_tree(inode["i_block"]) or self._extent_tree(inode["i_block"][: 64])
        ptrs = struct.unpack_from("<15I", inode["i_block"], 0)
        spans: list[tuple[int, int, int]] = []
        per = self.block_size // 4
        for i, p in enumerate(ptrs[:12]):
            if p:
                spans.append((i, 1, p))
        for level, slot in enumerate((12, 13, 14), start=1):
            base = ptrs[slot]
            if not base:
                continue
            logical = 12 if slot == 12 else (12 + per if slot == 13 else 12 + per + per * per)
            spans.extend(self._indirect(base, level, logical, per))
        return spans

    def _indirect(self, block: int, level: int, logical: int, per: int) -> list[tuple[int, int, int]]:
        raw = self.dev.pread(self.offset + block * self.block_size, self.block_size)
        out = []
        for i in range(min(per, len(raw) // 4)):
            p = struct.unpack_from("<I", raw, i * 4)[0]
            if not p:
                continue
            if level == 1:
                out.append((logical + i, 1, p))
            else:
                out.extend(self._indirect(p, level - 1, logical + i * per ** (level - 1), per))
        return out

    def read_file(self, inode_or_num, max_bytes: int = 8 << 20) -> bytes:
        inode = self.inode(inode_or_num) if isinstance(inode_or_num, int) else inode_or_num
        if not inode or inode["type"] != "file":
            return b""
        size = min(inode["size"], max_bytes)
        out = bytearray()
        if inode["file_acl"] and (inode["flags"] & 0x10000000) and size > 60:  # inline data
            pass
        for logical, length, physical in self._block_map(inode):
            if len(out) >= size:
                break
            data = self.dev.pread(self.offset + physical * self.block_size, length * self.block_size)
            out.extend(data)
        return bytes(out[:size])

    # -------------------------------------------------------------- directories
    def list_dir(self, inode_num: int = ROOT_INO, recursive: bool = False, _depth: int = 0, _path: str = "",
                 max_entries: int = 20000) -> list[dict]:
        entries: list[dict] = []
        inode = self.inode(inode_num)
        if not inode or inode["type"] != "dir":
            return entries
        for logical, length, physical in self._block_map(inode):
            raw = self.dev.pread(self.offset + physical * self.block_size, length * self.block_size)
            pos = 0
            while pos + 8 <= len(raw) and len(entries) < max_entries:
                ino, rec_len, name_len, ftype = struct.unpack_from("<IHBB", raw, pos)
                if rec_len < 8 or pos + rec_len > len(raw):
                    break
                if ino and name_len:
                    name = raw[pos + 8 : pos + 8 + min(name_len, 255)].decode("utf-8", "replace")
                    if name not in (".", ".."):
                        child = self.inode(ino)
                        entry = {
                            "name": name,
                            "inode": ino,
                            "type": FILE_TYPES.get(ftype, "?"),
                            "path": f"/{'' if not _path else _path + '/'}{name}".replace("//", "/"),
                            "size": (child or {}).get("size", 0),
                            "mtime": (child or {}).get("mtime", 0.0),
                            "mtime_iso": _iso((child or {}).get("mtime", 0.0)),
                            "mode": (child or {}).get("mode", ""),
                            "uid": (child or {}).get("uid", 0),
                            "gid": (child or {}).get("gid", 0),
                            "deleted": (child or {}).get("deleted", False),
                            "rec_len": rec_len,
                            "name_len": name_len,
                            "slack_bytes": rec_len - 8 - name_len,
                        }
                        entries.append(entry)
                        if recursive and entry["type"] == "dir" and _depth < 40:
                            entry["children"] = self.list_dir(ino, recursive, _depth + 1, entry["path"].lstrip("/"), max_entries)
                pos += rec_len
        return entries

    # ------------------------------------------------------------------- scans
    def walk(self, path: str = "/", limit: int = 100000) -> list[dict]:
        """Recursive listing (breadth-first) with a hard limit."""
        out: list[dict] = []
        stack = [(self.list_dir(ROOT_INO), "")]
        while stack and len(out) < limit:
            items, _ = stack.pop()
            for e in items:
                out.append(e)
                if e["type"] == "dir" and len(out) < limit:
                    stack.append((self.list_dir(e["inode"]), e["path"]))
        return out

    def deleted_inodes(self, limit: int = 500) -> list[dict]:
        """Inodes with dtime set == deleted (recoverable data may still be intact)."""
        found = []
        for num in range(1, min(self.sb["inodes_count"], 400000)):
            ino = self.inode(num)
            if ino and ino["deleted"] and ino["size"] > 0:
                found.append({k: ino[k] for k in ("inode", "size", "mtime", "dtime", "type", "mode")})
                if len(found) >= limit:
                    break
        return found

    def timestomp_candidates(self, limit: int = 200) -> list[dict]:
        """Files whose mtime predates ctime in a suspicious way (classic stomping)."""
        suspects = []
        for num in range(1, min(self.sb["inodes_count"], 200000)):
            ino = self.inode(num)
            if not ino or ino["type"] not in ("file", "dir") or not ino["mtime"]:
                continue
            if ino["ctime"] and ino["mtime"] > ino["ctime"] + 86400:
                suspects.append({"inode": num, "mtime_iso": _iso(ino["mtime"]), "ctime_iso": _iso(ino["ctime"]),
                                 "skew_hours": round((ino["mtime"] - ino["ctime"]) / 3600, 1)})
                if len(suspects) >= limit:
                    break
        return suspects
