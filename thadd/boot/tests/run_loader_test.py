#!/usr/bin/env python3
"""Build and run the host-side test for the THADD UEFI boot loader.

The loader is compiled exactly as it is for the real ISO (freestanding, no libc)
and linked against a mock UEFI firmware that serves a fake kernel + initramfs
from memory.  If the loader mis-parses the bzImage header, mis-places the
kernel, or jumps to the wrong entry, the test fails.
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

    r = run([exe, kernel if kernel.exists() else "build/payload/vmlinuz"], cwd=ROOT)
    print(r.stdout + r.stderr)
    return r.returncode


if __name__ == "__main__":
    raise SystemExit(main())
