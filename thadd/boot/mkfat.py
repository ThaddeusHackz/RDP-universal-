#!/usr/bin/env python3
"""Write a FAT16 image the UEFI firmware can read - no mtools, no mkfs.vfat.

The image becomes the El Torito EFI boot image of the THADD OS ISO, so it is a
*bare* FAT filesystem (no MBR) exactly like the efi.img files mkisofs produces:
UEFI mounts it and runs \\EFI\\BOOT\\BOOTX64.EFI from it, and our loader then reads
\\boot\\vmlinuz and \\boot\\initrd.img from the very same volume.

FAT16 (not FAT32) is used because the FAT flavour is defined by the *cluster
count*, and an ESP of a few hundred MB lands squarely in FAT16 territory.
VFAT long file names are written too, so the volume stays usable normally.
"""
from __future__ import annotations

import math
import struct
import time
from dataclasses import dataclass, field
from pathlib import Path

ATTR_READ_ONLY = 0x01
ATTR_HIDDEN = 0x02
ATTR_SYSTEM = 0x04
ATTR_VOLUME_ID = 0x08
ATTR_DIRECTORY = 0x10
ATTR_ARCHIVE = 0x20
ATTR_LFN = ATTR_READ_ONLY | ATTR_HIDDEN | ATTR_SYSTEM | ATTR_VOLUME_ID

ALLOWED = set("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789$%'-_@~`!(){}^#&")


def _checksum(short_name: bytes) -> int:
    s = 0
    for b in short_name:
        s = (((s & 1) << 7) + (s >> 1) + b) & 0xFF
    return s


def _lfn_entries(long_name: str, short_name: bytes) -> bytes:
    chk = _checksum(short_name)
    raw = long_name.encode("utf-16-le") + b"\x00\x00"
    while len(raw) % 26:
        raw += b"\xff\xff"
    chunks = [raw[i:i + 26] for i in range(0, len(raw), 26)]
    out = b""
    for idx, chunk in enumerate(reversed(chunks)):
        seq = len(chunks) - idx
        if idx == 0:
            seq |= 0x40
        entry = (bytes([seq]) + chunk[0:10] + bytes([ATTR_LFN, 0x00, chk]) +
                 chunk[10:22] + b"\x00\x00" + chunk[22:26])
        assert len(entry) == 32
        out += entry
    return out


def _needs_lfn(name: str, short: bytes) -> bool:
    """A long-file-name entry is needed unless the canonical 8.3 rendering of the
    short name is byte-identical to the name the caller used - case included, so
    "readme.txt" keeps a VFAT entry even though README.TXT would fit 8.3."""
    got_base = short[:8].decode().rstrip(" ")
    got_ext = short[8:].decode().rstrip(" ")
    canonical = f"{got_base}.{got_ext}" if got_ext else got_base
    return canonical != name


def _short_name(name: str, taken: set[bytes]) -> bytes:
    base, _, ext = name.upper().partition(".")
    base = "".join(ch for ch in base if ch in ALLOWED)[:8] or "FILE"
    ext = "".join(ch for ch in ext if ch in ALLOWED)[:3]
    cand = base.encode().ljust(8) + ext.encode().ljust(3)
    n = 1
    while cand in taken or cand == b"           ":
        tail = f"~{n}"
        stem = (base[:8 - len(tail)] + tail).encode()
        cand = stem.ljust(8) + ext.encode().ljust(3)
        n += 1
    taken.add(cand)
    return cand


@dataclass
class Node:
    name: str
    is_dir: bool
    children: list["Node"] = field(default_factory=list)
    data: bytes = b""
    cluster: int = 0
    size: int = 0
    parent: "Node | None" = None

    def find_dir(self, name: str) -> "Node | None":
        for c in self.children:
            if c.is_dir and c.name.lower() == name.lower():
                return c
        return None

    def add_dir(self, path: str) -> "Node":
        node = self
        for part in [p for p in path.replace("\\", "/").split("/") if p]:
            nxt = node.find_dir(part)
            if nxt is None:
                nxt = Node(name=part, is_dir=True, parent=node)
                node.children.append(nxt)
            node = nxt
        return node

    def add_file(self, path: str, data: bytes) -> "Node":
        parts = [p for p in path.replace("\\", "/").split("/") if p]
        parent = self.add_dir("/".join(parts[:-1])) if len(parts) > 1 else self
        f = Node(name=parts[-1], is_dir=False, data=data, size=len(data), parent=parent)
        parent.children.append(f)
        return f


class FatImage:
    """A minimal but spec-correct FAT16 writer."""

    def __init__(self, volume_label: str = "THADD_ESP", sectors_per_cluster: int = 8,
                 oem: str = "THADDOS "):
        self.root = Node(name="/", is_dir=True)
        self.spc = sectors_per_cluster
        self.label = volume_label
        self.oem = oem[:8].ljust(8)
        self.root_entries = 512

    # ------------------------------------------------------------------ build
    def build(self, out_path: Path, *, verbose: bool = False) -> dict:
        bps = 512

        files: list[Node] = []
        dirs: list[Node] = []

        def walk(n: Node) -> None:
            for c in n.children:
                if c.is_dir:
                    dirs.append(c)
                    walk(c)
                else:
                    files.append(c)

        walk(self.root)

        def dir_entries_needed(d: Node) -> int:
            """Number of 32-byte entries a directory needs (short names are
            deterministic, so this is stable across layout attempts)."""
            n = 2 if d is not self.root else 0          # "." and ".."
            taken: set[bytes] = set()
            for c in d.children:
                short = _short_name(c.name, taken)
                n += 1 + (len(_lfn_entries(c.name, short)) // 32 if _needs_lfn(c.name, short) else 0)
            return n

        def layout(cluster_size: int) -> tuple[dict, dict, int]:
            per_cluster = cluster_size // 32
            dc = {id(d): max(1, math.ceil(dir_entries_needed(d) / per_cluster))
                  for d in dirs}
            fc = {id(f): (math.ceil(f.size / cluster_size) if f.size else 0) for f in files}
            return dc, fc, sum(dc.values()) + sum(fc.values())

        # Pick a cluster size that makes the volume a *valid* FAT16: the FAT
        # flavour is defined by the cluster count (4085 .. 65524), not by the
        # BPB string.  Tiny volumes (a loader-only ESP) are padded up to the
        # FAT16 minimum, which is exactly what an ESP looks like in the wild.
        chosen = None
        fallback = None
        for spc in (8, 16, 4, 32, 2, 64, 1, 128):
            cs = spc * bps
            dc, fc, total = layout(cs)
            if chosen is None and 4085 <= total < 0xFFF0:
                chosen = (spc, cs, dc, fc, total)
            padded = max(total, 4085)
            if padded < 0xFFF0:
                size = padded * cs + 4096
                if fallback is None or size < fallback[0]:
                    fallback = (size, spc, cs, dc, fc, padded)
        if chosen is None:
            if fallback is None:
                raise SystemExit("nothing to put on the image")
            _, spc, cs, dc, fc, total = fallback
            chosen = (spc, cs, dc, fc, total)
            padded_note = True
        spc, cluster_size, dir_clusters, file_clusters, total_clusters = chosen
        self.spc = spc                             # data area size must use it
        if total_clusters < 4085:
            raise SystemExit(f"this volume would have {total_clusters} clusters, which is not a "
                             f"valid FAT16 volume (need 4085..65524)")

        fat_sectors = max(1, math.ceil((total_clusters + 2) * 2 / bps))
        root_dir_sectors = self.root_entries * 32 // bps
        reserved = 1
        data_sectors = total_clusters * self.spc
        total_sectors = reserved + fat_sectors * 2 + root_dir_sectors + data_sectors
        max_clusters = (total_sectors - reserved - fat_sectors * 2 - root_dir_sectors) // self.spc
        if total_clusters > max_clusters:
            raise SystemExit("FAT16 image too small for its contents")

        # ---------------- FAT table (clusters are handed out in layout order)
        fat = [0] * (total_clusters + 2)
        fat[0] = 0xFFF8
        fat[1] = 0xFFFF

        def alloc_chain(count: int) -> int:
            """Reserve `count` clusters and return the first one."""
            nonlocal nxt
            first = nxt
            for i in range(count):
                fat[nxt] = (nxt + 1) if i < count - 1 else 0xFFFF
                nxt += 1
            return first

        nxt = 2
        self.root.cluster = 0                      # the FAT16 root has no cluster chain
        for d in dirs:
            d.cluster = alloc_chain(dir_clusters[id(d)])
        for f in files:
            f.cluster = alloc_chain(file_clusters[id(f)]) if f.size else 0

        # ---------------- serialise
        img = bytearray(total_sectors * bps)

        def dos_stamp() -> tuple[int, int]:
            t = time.localtime()
            return ((t.tm_hour << 11) | (t.tm_min << 5) | (t.tm_sec // 2),
                    ((max(t.tm_year, 1980) - 1980) << 9) | (t.tm_mon << 5) | t.tm_mday)

        def dirent(short: bytes, attr: int, cluster: int, size: int) -> bytes:
            """A 32-byte FAT directory entry."""
            t, d = dos_stamp()
            out = (short + bytes([attr, 0, 0]) +                     # name, attr, NTRes, CrtTimeTenth
                   struct.pack("<H", 0) +                            # CrtTime
                   struct.pack("<H", 0) +                            # CrtDate
                   struct.pack("<H", d) +                            # LstAccessDate
                   struct.pack("<H", (cluster >> 16) & 0xFFFF) +     # FstClusHI
                   struct.pack("<HH", t, d) +                        # WrtTime, WrtDate
                   struct.pack("<H", cluster & 0xFFFF) +             # FstClusLO
                   struct.pack("<I", size))                          # FileSize
            assert len(out) == 32, len(out)
            return out

        def dir_blob(node: Node) -> bytes:
            out = bytearray()
            if node is not self.root:
                out += dirent(b".          ", ATTR_DIRECTORY, node.cluster, 0)
                out += dirent(b"..         ", ATTR_DIRECTORY,
                              node.parent.cluster if node.parent else 0, 0)
            taken: set[bytes] = set()
            for child in node.children:
                short = _short_name(child.name, taken)
                if _needs_lfn(child.name, short):
                    out += _lfn_entries(child.name, short)
                out += dirent(short, ATTR_DIRECTORY if child.is_dir else ATTR_ARCHIVE,
                              child.cluster, 0 if child.is_dir else child.size)
            return bytes(out)

        # ---------------- boot sector
        bs = bytearray(bps)
        bs[0:3] = b"\xeb\x3c\x90"
        bs[3:11] = self.oem.encode()
        struct.pack_into("<H", bs, 11, bps)
        bs[13] = self.spc
        struct.pack_into("<H", bs, 14, reserved)
        bs[16] = 2
        struct.pack_into("<H", bs, 17, self.root_entries)
        struct.pack_into("<H", bs, 19, total_sectors if total_sectors < 0x10000 else 0)
        bs[21] = 0xF8
        struct.pack_into("<H", bs, 22, fat_sectors)
        struct.pack_into("<H", bs, 24, 32)                     # sectors per track
        struct.pack_into("<H", bs, 26, 64)                     # heads
        struct.pack_into("<I", bs, 28, 0)                      # hidden sectors
        struct.pack_into("<I", bs, 32, total_sectors if total_sectors >= 0x10000 else 0)
        bs[36] = 0x80                                          # drive number
        bs[38] = 0x29                                          # extended boot signature
        struct.pack_into("<I", bs, 39, 0x7ADD05E7)             # volume id
        bs[43:54] = self.label.upper().ljust(11)[:11].encode()
        bs[54:62] = b"FAT16   "
        bs[510:512] = b"\x55\xaa"
        img[0:bps] = bs

        fat_off = reserved * bps
        root_off = (reserved + fat_sectors * 2) * bps
        data_off = root_off + root_dir_sectors * bps

        fat_bytes = bytearray(fat_sectors * bps)
        struct.pack_into("<%dH" % len(fat), fat_bytes, 0, *fat)
        img[fat_off:fat_off + fat_sectors * bps] = fat_bytes
        img[fat_off + fat_sectors * bps:fat_off + 2 * fat_sectors * bps] = fat_bytes

        def write_chain(first: int, blob: bytes, data_start: int) -> None:
            """Walk a FAT chain, writing `blob` cluster by cluster."""
            c = first
            pos = 0
            while pos < len(blob):
                chunk = blob[pos:pos + cluster_size]
                base = data_start + (c - 2) * cluster_size
                img[base:base + len(chunk)] = chunk
                pos += cluster_size
                nxt_c = fat[c]
                if nxt_c >= 0xFFF8:
                    break
                c = nxt_c

        # the root directory of FAT16 is a fixed contiguous area
        root_blob = dir_blob(self.root)
        if len(root_blob) > root_dir_sectors * bps:
            raise SystemExit("root directory does not fit - increase root_entries")
        img[root_off:root_off + len(root_blob)] = root_blob
        for d in dirs:
            write_chain(d.cluster, dir_blob(d), data_off)
        for f in files:
            if f.size:
                write_chain(f.cluster, f.data, data_off)

        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_bytes(img)
        info = {"path": str(out_path), "bytes": len(img), "clusters": total_clusters,
                "fat_sectors": fat_sectors, "cluster_size": cluster_size,
                "files": len(files), "dirs": len(dirs) + 1}
        if verbose:
            print(f"    FAT16 image: {len(img)/1e6:.1f} MB, {total_clusters} clusters of "
                  f"{cluster_size} B, {fat_sectors} FAT sectors, {len(files)} files")
        return info

    # -------------------------------------------------------------------- api
    def add(self, path: str, data: bytes) -> None:
        self.root.add_file(path, data)

    def add_file(self, path: str, src: Path) -> None:
        self.root.add_file(path, Path(src).read_bytes())

    def mkdir(self, path: str) -> None:
        self.root.add_dir(path)


def main(argv: list[str]) -> int:
    if len(argv) < 3:
        print(__doc__)
        return 2
    img = FatImage()
    img.add_file("hello.txt", Path(argv[1]))
    print(img.build(Path(argv[2]), verbose=True))
    return 0


if __name__ == "__main__":
    import sys
    raise SystemExit(main(sys.argv))
