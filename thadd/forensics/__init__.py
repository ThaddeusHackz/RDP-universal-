"""
THADD OS Forensics — native partition + filesystem readers.

This package contains **dependency-free** readers for the filesystems used by the
major operating systems, so THADD can inspect (and therefore "reverse engineer")
a disk image or a live block device without mounting it and without libtsk:

===============  ==========================================================
 Reader           What it parses
===============  ==========================================================
 ``partitions``   MBR, GPT (+ backup GPT, CRC32 validation), superfloppy
 ``fat``          FAT12/16/32 + exFAT (EFI System Partition forensics)
 ``ext4``         ext2/3/4 — superblocks, block groups, extents, htree dirs
 ``ntfs``         Windows NTFS — $MFT enumeration, runlists, ADS, $UsnJrnl
 ``hfs``          HFS+ / HFSX (classic macOS) — B-tree catalog
 ``apfs``         APFS container + volume superblocks (modern macOS)
 ``registry``     Windows registry hives (regf) — keys + values
 ``triage``       Cross-OS artifact rules + evidence report generator
===============  ==========================================================

Everything is read-only by construction: every reader takes a block-device
object and only ever calls ``pread``.  Nothing in here writes to the evidence.
"""

from .device import BlockDevice, FileDevice, open_device  # noqa: F401
from . import apfs, ext4, fat, hfs, ntfs, partitions, registry, triage  # noqa: F401

__all__ = [
    "BlockDevice",
    "FileDevice",
    "open_device",
    "partitions",
    "ext4",
    "ntfs",
    "hfs",
    "apfs",
    "fat",
    "registry",
    "triage",
]

VERSION = "1.0"
