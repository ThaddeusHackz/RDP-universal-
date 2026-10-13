#!/usr/bin/env python3
"""Build THADD OS boot loaders with the host toolchain (gcc + binutils).

Outputs (into build/boot/):
    BOOTX64.EFI        UEFI application (El Torito EFI boot image payload)
    mbr.bin            legacy BIOS first stage (512 bytes, El Torito HD emulation)

No external assemblers or SDKs are needed: the UEFI loader is freestanding C
linked as PE32+ with GNU ld's i386pep emulation, and the BIOS stage is written
in GNU asm (`.code16`).
"""
from __future__ import annotations

import os
import shutil
import struct
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BOOT = ROOT / "thadd" / "boot"
OUT = ROOT / "build" / "boot"

CFLAGS = [
    "-ffreestanding", "-fno-stack-protector", "-fno-builtin", "-fshort-wchar",
    "-fno-pic", "-fno-pie",
    "-fno-asynchronous-unwind-tables", "-fno-unwind-tables",
    "-mno-red-zone", "-mno-sse", "-mno-sse2", "-mno-mmx", "-mno-80387",
    "-mno-avx", "-Os", "-Wall", "-Wextra",
    "-Wno-unused-parameter", "-std=gnu11",
]


def run(cmd: list[str], **kw) -> subprocess.CompletedProcess:
    proc = subprocess.run(cmd, capture_output=True, text=True, **kw)
    if proc.returncode != 0:
        sys.stderr.write(" ".join(cmd) + "\n" + (proc.stdout or "") + (proc.stderr or ""))
        raise SystemExit(f"command failed: {cmd[0]}")
    return proc


def need(tool: str) -> str:
    path = shutil.which(tool)
    if not path:
        raise SystemExit(f"missing build tool: {tool}")
    return path


def build_uefi() -> Path:
    cc, ld = need("gcc"), need("ld")
    obj = OUT / "loader.o"
    efi = OUT / "BOOTX64.EFI"
    run([cc, *CFLAGS, "-c", str(BOOT / "uefi" / "loader.c"), "-o", str(obj)])
    run([
        ld, "-mi386pep", "--subsystem", "10",
        "--image-base", "0x0",
        "--section-alignment", "0x1000", "--file-alignment", "0x200",
        "--disable-reloc-section" if False else "--enable-reloc-section",
        "-e", "efi_main", "-o", str(efi), str(obj),
    ])
    data = efi.read_bytes()
    if data[:2] != b"MZ":
        raise SystemExit("UEFI loader is not a PE image")
    pe_off = struct.unpack_from("<I", data, 0x3C)[0]
    if data[pe_off:pe_off + 4] != b"PE\0\0":
        raise SystemExit("bad PE signature")
    subsystem = struct.unpack_from("<H", data, pe_off + 24 + 68)[0]
    if subsystem != 10:
        raise SystemExit(f"wrong PE subsystem {subsystem}, expected 10 (EFI application)")
    reloc = subprocess.run([need("objdump"), "-h", str(efi)], capture_output=True, text=True).stdout
    has_reloc = ".reloc" in reloc
    print(f"  BOOTX64.EFI  {len(data):>8} bytes  subsystem={subsystem}  reloc={'yes' if has_reloc else 'NO'}"
          f"  size_of_image={struct.unpack_from('<I', data, pe_off + 24 + 56)[0]:#x}")
    if not has_reloc:
        raise SystemExit("PE image has no .reloc section - the firmware cannot relocate it")
    return efi


def build_bios() -> Path | None:
    """Legacy BIOS stage: assembled with GNU as (.code16), linked to a flat blob."""
    src = BOOT / "bios" / "mbr.S"
    if not src.exists():
        print("  mbr.bin      (skipped: no thadd/boot/bios/mbr.S yet)")
        return None
    asm, ld, objcopy = need("as"), need("ld"), need("objcopy")
    obj = OUT / "mbr.o"
    elf = OUT / "mbr.elf"
    raw = OUT / "mbr.bin"
    run([asm, "--32", "-o", str(obj), str(src)])
    linker = BOOT / "bios" / "mbr.ld"
    args = [ld, "-m", "elf_i386", "-T", str(linker), "--oformat", "elf32-i386", "-o", str(elf), str(obj)] \
        if linker.exists() else [ld, "-m", "elf_i386", "-Ttext", "0x7c00", "--oformat", "elf32-i386", "-o", str(elf), str(obj)]
    run(args)
    run([objcopy, "-O", "binary", str(elf), str(raw)])
    blob = raw.read_bytes()
    if len(blob) > 512:
        raise SystemExit(f"BIOS stage is {len(blob)} bytes, must fit in one sector")
    blob = blob + b"\x00" * (510 - len(blob)) + b"\x55\xaa"
    raw.write_bytes(blob)
    print(f"  mbr.bin      {len(blob):>8} bytes  (.code16 real-mode stage)")
    return raw


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    print("building THADD OS boot loaders")
    build_uefi()
    build_bios()
    print("ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
