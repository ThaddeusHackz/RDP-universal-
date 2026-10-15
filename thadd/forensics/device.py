"""THADD OS Forensics — block device abstraction.

``BlockDevice`` is a positional-read interface implemented for regular files
(disk images) and block devices (``/dev/sdb``) alike.  It carries the evidence
integrity metadata (size, sha256, whether the source is writable) that every
downstream reader needs.
"""

from __future__ import annotations

import hashlib
import os
import stat as statmod
from typing import Iterator, Optional

SECTOR = 512


class BlockDevice:
    """Random-access, read-only view over an image file or block device."""

    def __init__(self, path: str):
        self.path = path
        self._fd = os.open(path, os.O_RDONLY)
        st = os.fstat(self._fd)
        self.is_block = statmod.S_ISBLK(st.st_mode)
        self.size = self._device_size(st)
        self.readonly = True
        self._hash_cache: Optional[str] = None

    # ------------------------------------------------------------------ plumbing
    def _device_size(self, st) -> int:
        if statmod.S_ISREG(st.st_mode):
            return st.st_size
        try:
            return int(open(f"/sys/class/block/{os.path.basename(self.path)}/size").read()) * SECTOR
        except OSError:
            try:
                import fcntl
                import struct

                return struct.unpack("Q", fcntl.ioctl(self._fd, 0x80081272, b"\0" * 8))[0]
            except Exception:
                return 0

    def pread(self, offset: int, length: int) -> bytes:
        if offset < 0:
            raise ValueError("negative offset")
        return os.pread(self._fd, length, offset)

    def read_at(self, offset: int, length: int) -> bytes:
        return self.pread(offset, length)

    def sectors(self, count: int, start: int = 0) -> bytes:
        return self.pread(start * SECTOR, count * SECTOR)

    def close(self) -> None:
        try:
            os.close(self._fd)
        except OSError:
            pass

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.close()

    def __repr__(self) -> str:
        return f"<BlockDevice {self.path} {self.size} bytes{' (block)' if self.is_block else ''}>"

    # ------------------------------------------------------------------- evidence
    def sha256(self, progress=None) -> str:
        """Full-image SHA-256 (streamed, only computed once)."""
        if self._hash_cache:
            return self._hash_cache
        h = hashlib.sha256()
        offset = 0
        span = 8 << 20
        while offset < self.size:
            chunk = self.pread(offset, min(span, self.size - offset))
            if not chunk:
                break
            h.update(chunk)
            offset += len(chunk)
            if progress:
                progress(offset, self.size)
        self._hash_cache = h.hexdigest()
        return self._hash_cache

    def hash_range(self, offset: int, length: int, algo: str = "sha256") -> str:
        h = hashlib.new(algo)
        span = 1 << 20
        done = 0
        while done < length:
            chunk = self.pread(offset + done, min(span, length - done))
            if not chunk:
                break
            h.update(chunk)
            done += len(chunk)
        return h.hexdigest()

    def zeros(self, offset: int, length: int) -> bool:
        return self.pread(offset, length) == b"\0" * length

    def entropy(self, offset: int = 0, length: int = 1 << 20) -> float:
        """Shannon entropy of a sample (8.0 == encrypted/compressed)."""
        import math

        data = self.pread(offset, min(length, self.size - offset))
        if not data:
            return 0.0
        counts = [0] * 256
        for b in data:
            counts[b] += 1
        total = len(data)
        ent = 0.0
        for c in counts:
            if c:
                p = c / total
                ent -= p * math.log2(p)
        return round(ent, 4)


class FileDevice(BlockDevice):
    """Convenience alias kept for API clarity in docs/tests."""


class SliceDevice(BlockDevice):
    """A byte range of another device (one partition, presented as its own device)."""

    def __init__(self, parent: BlockDevice, offset: int, length: int, label: str = ""):
        self.parent = parent
        self.offset = offset
        self.path = f"{parent.path}@{offset}+{length}"
        self.size = min(length, max(0, parent.size - offset))
        self.is_block = False
        self.readonly = True
        self._fd = None
        self._hash_cache = None
        self.label = label

    def pread(self, offset: int, length: int) -> bytes:
        if offset < 0 or offset >= self.size:
            return b""
        length = min(length, self.size - offset)
        return self.parent.pread(self.offset + offset, length)

    def close(self) -> None:  # the parent owns the fd
        pass


def open_device(path: str) -> BlockDevice:
    """Open an image/block device read-only, expanding ``/dev/sdX1`` automatically."""
    if not os.path.exists(path):
        raise FileNotFoundError(path)
    return BlockDevice(path)


def iter_sectors(dev: BlockDevice, start: int = 0, count: int = 1, span: int = 64) -> Iterator[bytes]:
    for i in range(count):
        yield dev.pread((start + i * span) * SECTOR, span * SECTOR)
