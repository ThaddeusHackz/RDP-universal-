#!/usr/bin/env python3
"""Build and run the host-side tests for the THADD UEFI boot loader.

Two firmwares are emulated, because the loader has to survive both:

  1. "fat" - a firmware with a SimpleFileSystem (the usual FAT ESP).  The loader
     scans every volume for \\boot\\vmlinuz and \\boot\\initrd.img.
  2. "iso" - a firmware that exposes ONLY raw block devices: no filesystem at
     all.  This is the case the real disc depends on, because the El Torito boot
     image is capped at 32 MB, so the kernel and initramfs live on the disc's
     ISO 9660 volume.  The mock serves an ISO this repository just built, block
     by block, and the loader must parse ISO 9660 itself and pull both files out
     byte-for-byte.

The loader is compiled exactly as it is for the real ISO (freestanding, no libc).
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
TESTS = ROOT / "thadd" / "boot" / "tests"
OUT = ROOT / "build" / "boot-tests"

CFLAGS = [
    "-ffreestanding", "-fno-stack-protector", "-fno-builtin", "-fshort-wchar",
    "-fno-pic", "-fno-pie", "-fno-asynchronous-unwind-tables",
    "-mno-red-zone", "-mno-sse", "-mno-sse2", "-mno-mmx", "-mno-80387",
    "-Os", "-Wall", "-Wextra", "-Wno-unused-parameter", "-std=gnu11",
    "-DTHADD_LOADER_UNDER_TEST=0",
]


def run(cmd, **kw):
    return subprocess.run([str(c) for c in cmd], capture_output=True, text=True, **kw)


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    kernel = ROOT / "build" / "payload" / "vmlinuz"

    loader_obj = OUT / "loader-host.o"
    mock_obj = OUT / "mock_efi_test.o"
    exe = OUT / "loader_test"

    r = run(["gcc", *CFLAGS, "-c", ROOT / "thadd/boot/uefi/loader.c", "-o", loader_obj])
    if r.returncode:
        print(r.stdout + r.stderr)
        return 1
    r = run(["gcc", *CFLAGS, "-Wno-unused-function", "-c", TESTS / "mock_efi_test.c", "-o", mock_obj])
    if r.returncode:
        print(r.stdout + r.stderr)
        return 1
    # link with the host libc: the mock uses stdio/mmap
    r = run(["gcc", "-no-pie", "-o", exe, mock_obj, loader_obj])
    if r.returncode:
        print(r.stdout + r.stderr)
        return 1

    failures = 0

    # ---------------------------------------------------------------- firmware 1
    print("--- firmware A: a volume with a filesystem (FAT) ---")
    r = run([exe, kernel if kernel.exists() else "build/payload/vmlinuz", "fat"], cwd=ROOT)
    print(r.stdout + r.stderr)
    failures += r.returncode != 0

    # ---------------------------------------------------------------- firmware 2
    print("--- firmware B: raw blocks only, no filesystem (the real disc) ---")
    work = ROOT / "build" / "boot-tests" / "iso"
    work.mkdir(parents=True, exist_ok=True)
    fake_kernel, fake_initrd = work / "vmlinuz", work / "initrd.img"
    r = run([exe, kernel if kernel.exists() else "build/payload/vmlinuz",
             "dump", fake_kernel, fake_initrd], cwd=ROOT)
    print(r.stdout + r.stderr)
    if r.returncode:
        return 1

    # build a real ISO with those two files on its ISO 9660 volume, using the
    # very same builder that produces the shipped disc
    sys.path.insert(0, str(ROOT))
    from thadd.boot import assemble_iso  # noqa: E402

    loader = ROOT / "build" / "boot" / "BOOTX64.EFI"
    if not loader.exists():
        print("build the loader first:  python3 thadd/boot/build_bootloaders.py")
        return 1
    iso_path = work / "loader-test.iso"
    esp = work / "efi.img"
    assemble_iso.build_esp(loader, fake_kernel, fake_initrd, esp, quiet=True)
    info = assemble_iso.build_iso(esp, fake_kernel, fake_initrd, iso_path, quiet=True,
                                  loader=loader)
    print(f"   test disc  : {iso_path.name}  {info['bytes']} bytes  sha256 {info['sha256'][:16]}")

    r = run([exe, kernel if kernel.exists() else "build/payload/vmlinuz", "iso",
             iso_path, fake_kernel, fake_initrd], cwd=ROOT)
    print(r.stdout + r.stderr)
    failures += r.returncode != 0

    if failures:
        print(f"=== {failures} firmware(s) FAILED ===")
        return 1
    print("=== both firmwares: all loader checks passed ===")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
