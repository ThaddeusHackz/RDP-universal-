#!/usr/bin/env python3
"""Build THADD OS initramfs images (cpio "newc") without needing the `cpio` tool.

Usage:
    python3 thadd/boot/mkinitramfs.py <root-dir> <out.cpio[.gz|.xz]>

The kernel unpacks a "newc" archive straight into the initial ramfs.  We write
the archive ourselves so the ISO build works on any machine with Python 3 --
no cpio, no squashfs tools, no root privileges.  Hard links are preserved via
shared inode numbers, symlinks and device nodes are supported.
"""
from __future__ import annotations

import gzip
import lzma
import os
import stat
import sys
import time
from pathlib import Path

S_IFMT = 0o170000
S_IFREG = 0o100000
S_IFDIR = 0o040000
S_IFLNK = 0o120000
S_IFCHR = 0o020000
S_IFBLK = 0o060000
S_IFIFO = 0o010000


def _hdr(name: str, ino: int, mode: int, nlink: int, size: int, mtime: int,
         rdevmajor: int = 0, rdevminor: int = 0) -> bytes:
    name_b = name.encode() + b"\x00"
    fields = [
        ino & 0xFFFFFFFF, mode & 0xFFFFFFFF, 0, 0, nlink & 0xFFFFFFFF,
        mtime & 0xFFFFFFFF, size & 0xFFFFFFFF, 0, 0, rdevmajor & 0xFF, rdevminor & 0xFF,
        len(name_b), 0,
    ]
    head = b"070701" + b"".join(b"%08X" % f for f in fields)
    assert len(head) == 110, len(head)
    pad = (-(110 + len(name_b))) % 4
    return head + name_b + b"\x00" * pad


def _data_pad(size: int) -> bytes:
    return b"\x00" * ((-size) % 4)


class Writer:
    def __init__(self, out, mtime: int | None = None):
        self.out = out
        self.ino = 0
        self.mtime = mtime if mtime is not None else int(time.time())
        self.bytes_written = 0
        self.files = 0
        self.inodes: dict[tuple[int, int], int] = {}

    def _w(self, blob: bytes) -> None:
        self.out.write(blob)
        self.bytes_written += len(blob)

    def add_dir(self, arcname: str, st: os.stat_result) -> None:
        self.ino += 1
        self._w(_hdr(arcname, self.ino, st.st_mode, 2, 0, int(st.st_mtime)))
        self.files += 1

    def add_symlink(self, arcname: str, target: str, st: os.stat_result) -> None:
        self.ino += 1
        t = target.encode()
        self._w(_hdr(arcname, self.ino, stat.S_IFLNK | 0o777, 1, len(t), int(st.st_mtime)))
        self._w(t)
        self._w(_data_pad(len(t)))
        self.files += 1

    def add_device(self, arcname: str, st: os.stat_result) -> None:
        self.ino += 1
        major = os.major(st.st_rdev)
        minor = os.minor(st.st_rdev)
        self._w(_hdr(arcname, self.ino, st.st_mode, 1, 0, int(st.st_mtime), major, minor))
        self.files += 1

    def add_file(self, arcname: str, path: Path, st: os.stat_result) -> None:
        key = (st.st_dev, st.st_ino)
        if st.st_nlink > 1 and key in self.inodes:
            ino = self.inodes[key]
            nlink = st.st_nlink
            data = b""
            self._w(_hdr(arcname, ino, st.st_mode, nlink, 0, int(st.st_mtime)))
            self.files += 1
            return
        self.ino += 1
        self.inodes[key] = self.ino
        size = st.st_size
        self._w(_hdr(arcname, self.ino, st.st_mode, st.st_nlink, size, int(st.st_mtime)))
        with open(path, "rb") as fh:
            while True:
                chunk = fh.read(1 << 20)
                if not chunk:
                    break
                self._w(chunk)
        self._w(_data_pad(size))
        self.files += 1

    def finish(self) -> None:
        self.ino += 1
        self._w(_hdr("TRAILER!!!", self.ino, 0, 1, 0, self.mtime))
        while self.bytes_written % 512:
            self._w(b"\x00")


def build(root: Path, out_path: Path, compress: str = "none",
          exclude: tuple[str, ...] = (), quiet: bool = False) -> dict:
    root = root.resolve()
    compress = (compress or "none").lower()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    tmp = out_path.with_suffix(out_path.suffix + ".raw")

    if compress in ("gz", "gzip"):
        raw = gzip.open(tmp, "wb", compresslevel=6)
    elif compress in ("xz", "lzma"):
        raw = lzma.open(tmp, "wb", preset=6)
    else:
        raw = open(tmp, "wb")

    entries = 0
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames.sort()
        filenames.sort()
        rel = Path(dirpath).relative_to(root)
        entries += len(dirnames) + len(filenames)

    with raw as fh:
        w = Writer(fh)
        for dirpath, dirnames, filenames in os.walk(root):
            dirnames.sort()
            dirnames[:] = [d for d in dirnames if d not in exclude]
            filenames.sort()
            rel = Path(dirpath).relative_to(root)
            arc_dir = "." if str(rel) == "." else "./" + rel.as_posix()
            if str(rel) != ".":
                st = os.lstat(dirpath)
                w.add_dir(arc_dir, st)
            for name in filenames:
                p = Path(dirpath) / name
                arc = (arc_dir + "/" + name) if arc_dir != "." else name
                st = os.lstat(p)
                kind = stat.S_IFMT(st.st_mode)
                if kind == S_IFLNK:
                    w.add_symlink(arc, os.readlink(p), st)
                elif kind in (S_IFCHR, S_IFBLK):
                    w.add_device(arc, st)
                elif kind == S_IFREG:
                    w.add_file(arc, p, st)
        w.finish()
        meta = {"files": w.files, "raw_bytes": w.bytes_written, "compress": compress}

    tmp.replace(out_path)
    meta["size"] = out_path.stat().st_size
    if not quiet:
        print(f"  initramfs  {meta['files']:>6} entries  "
              f"{meta['raw_bytes'] / 1e6:8.1f} MB raw  {meta['size'] / 1e6:8.1f} MB "
              f"({compress})  -> {out_path}")
    return meta


def read_archive(path: Path, limit: int = 0) -> list[dict]:
    """Minimal reader used by the tests to verify the archive we just wrote."""
    data = path.read_bytes()
    if data[:2] == b"\x1f\x8b":
        data = gzip.decompress(data)
    elif data[:6] == b"\xfd7zXZ\x00":
        data = lzma.decompress(data)
    out: list[dict] = []
    off = 0
    while off + 110 <= len(data):
        magic = data[off:off + 6]
        if magic != b"070701":
            raise ValueError(f"bad magic at {off}: {magic!r}")
        f = [int(data[off + 6 + i * 8: off + 14 + i * 8], 16) for i in range(13)]
        namesize = f[11]
        size = f[6]
        name = data[off + 110: off + 110 + namesize - 1].decode(errors="replace")
        off += 110 + namesize
        off += (-off) % 4
        if name == "TRAILER!!!":
            break
        out.append({"name": name, "size": size, "mode": f[1], "offset": off})
        off += size
        off += (-off) % 4
        if limit and len(out) >= limit:
            break
    return out


# Runtime directories: the kernel and /init create and mount these, so their
# (host or live) contents must never be baked into the image.
DEFAULT_EXCLUDE = ("proc", "sys", "dev", "tmp", "run", "var/tmp", "var/run",
                   "var/log", "media", "mnt", "__pycache__")


def main(argv: list[str]) -> int:
    if len(argv) < 3:
        print(__doc__)
        return 2
    src, dst = Path(argv[1]), Path(argv[2])
    compress = "none"
    if dst.suffix in (".gz", ".gzip"):
        compress = "gz"
    elif dst.suffix in (".xz", ".lzma"):
        compress = "xz"
    build(src, dst, compress, exclude=DEFAULT_EXCLUDE)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
