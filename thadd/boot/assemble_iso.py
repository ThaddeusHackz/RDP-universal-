#!/usr/bin/env python3
"""Build the THADD OS ISO - a bootable UEFI image, in pure Python.

No xorriso, no mkisofs, no mtools: the El Torito EFI boot image is written with
thadd/boot/mkfat.py and the ISO 9660 filesystem with pycdlib.

Result (default: build/iso/THADD-OS-1.0-x86_64.iso)
    <ISO>  /EFI/BOOT/BOOTX64.EFI   the THADD UEFI loader
           /boot/vmlinuz           compressed Linux kernel
           /boot/initrd.img        the whole live OS (initramfs, gzip)
           /README.TXT             what this is + how to boot it
    El Torito EFI section points at efi.img, a small FAT16 volume holding
    \\EFI\\BOOT\\BOOTX64.EFI + \\boot\\vmlinuz + \\boot\\initrd.img, which is where the
    loader reads the kernel and the initramfs from.

Usage
    python3 -m thadd.boot.assemble_iso [--out PATH] [--no-initramfs]
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
BUILD = ROOT / "build"

VERSION = "1.0"
CODENAME = "Nebula Prime"
LABEL = "THADD_OS"
OUT_NAME = f"THADD-OS-{VERSION}-x86_64.iso"

README = """\
THADD OS {ver} ({code})
=========================================================================
One OS. All the Best.  https://github.com/ThaddeusHackz/RDP-universal-

This disc boots a complete THADD OS live system on any 64-bit UEFI machine
(VirtualBox: enable EFI in Settings -> System -> Motherboard).

  * boot menu   : the firmware's own boot manager - pick the CD/DVD entry
  * firmware    : UEFI only (no legacy BIOS / CSM required)
  * the desktop : text desktop on tty1, shells on tty2 and ttyS0 (115200)
  * the service : http://127.0.0.1:8080 - full GUI, 105 RPC methods
  * toolbox     : run `thadd` in any shell for the command list
  * assistant   : `thadd-ai "..."` (set a Groq key in Settings -> AI)

Files on this disc
  /ELF/BOOT/BOOTX64.EFI   THADD UEFI loader
  /boot/vmlinuz           Linux kernel (compressed)
  /boot/initrd.img        the live system image (initramfs)
  /EFI/BOOT/efi.img       the FAT boot volume the loader reads from

Nothing on this disc writes to your disks unless you ask it to.
"""


def sha256(path: Path, chunk: int = 1 << 20) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        while True:
            block = fh.read(chunk)
            if not block:
                break
            h.update(block)
    return h.hexdigest()


def find_file(*candidates: Path, what: str, required: bool = True) -> Path | None:
    for c in candidates:
        if c.exists() and c.stat().st_size:
            return c
    if required:
        raise SystemExit(f"[iso] missing {what}: looked for " +
                         ", ".join(str(c) for c in candidates))
    print(f"[iso] optional {what} not found - skipping")
    return None


# --------------------------------------------------------------------------- #
def build_esp(loader: Path, kernel: Path, initrd: Path | None, out: Path,
              quiet: bool = False, carry_kernel: bool = False) -> Path:
    """The El Torito EFI boot volume: a bare FAT16 image (no MBR)."""
    sys.path.insert(0, str(HERE))
    import mkfat                                    # noqa: E402  (local module)

    img = mkfat.FatImage(volume_label="THADD_ESP")
    img.add("EFI/BOOT/BOOTX64.EFI", loader.read_bytes())
    # El Torito stores the boot image size as a 16-bit count of 512-byte
    # sectors (32 MB max), so the kernel and initramfs stay on the ISO 9660
    # volume - the loader finds them there by scanning every volume.
    if carry_kernel:
        img.add("boot/vmlinuz", kernel.read_bytes())
        if initrd is not None:
            img.add("boot/initrd.img", initrd.read_bytes())
    img.add("EFI/BOOT/startup.nsh", b"fs0:\\EFI\\BOOT\\BOOTX64.EFI\r\n")
    img.add("readme.txt", (README.format(ver=VERSION, code=CODENAME)).encode())
    img.add("EFI/THADD/version.txt",
            f"THADD OS {VERSION} ({CODENAME}) built {time.strftime('%Y-%m-%d %H:%M UTC', time.gmtime())}\n".encode())
    info = img.build(out, verbose=not quiet)
    if not quiet:
        print(f"[iso] boot volume {out.name}: {info['bytes'] / 1e6:.1f} MB FAT16 "
              f"({info['files']} files)")
    return out


def build_iso(esp: Path, kernel: Path, initrd: Path | None, out: Path,
              quiet: bool = False, loader: Path | None = None) -> dict:
    try:
        import pycdlib
    except ImportError:
        raise SystemExit("[iso] pycdlib is required:  pip3 install --break-system-packages pycdlib")

    iso = pycdlib.PyCdlib()
    iso.new(interchange_level=3, joliet=3, rock_ridge="1.09", vol_ident=LABEL)

    # ISO9660 needs the A-Z0-9_ names; Rock Ridge and Joliet carry the pretty
    # (real) names, which is what Linux and Windows see.
    handles: list = []          # pycdlib streams from these at write() time

    def add(iso_path: str, src: Path, rr: str, joliet: str) -> None:
        fh = open(src, "rb")
        handles.append(fh)
        iso.add_fp(fh, src.stat().st_size, iso_path, rr_name=rr,
                   joliet_path=joliet)

    iso.add_directory("/EFI", rr_name="EFI", joliet_path="/EFI")
    iso.add_directory("/EFI/BOOT", rr_name="BOOT", joliet_path="/EFI/BOOT")
    iso.add_directory("/EFI/THADD", rr_name="THADD", joliet_path="/EFI/THADD")
    iso.add_directory("/BOOT", rr_name="boot", joliet_path="/boot")

    if loader is not None and loader.exists():
        add("/EFI/BOOT/BOOTX64.EFI;1", loader, "BOOTX64.EFI", "/EFI/BOOT/BOOTX64.EFI")
    add("/EFI/BOOT/EFI.IMG;1", esp, "efi.img", "/EFI/BOOT/efi.img")
    version = out.parent / "VERSION.TXT"
    version.write_text(f"THADD OS {VERSION} ({CODENAME})\n"
                       f"built {time.strftime('%Y-%m-%d %H:%M UTC', time.gmtime())}\n"
                       f"boot: UEFI only (El Torito platform 0xEF, FAT16 efi.img)\n")
    add("/EFI/THADD/VERSION.TXT;1", version, "VERSION.TXT", "/EFI/THADD/VERSION.TXT")
    add("/BOOT/VMLINUZ.;1", kernel, "vmlinuz", "/boot/vmlinuz")
    if initrd is not None:
        add("/BOOT/INITRD.IMG;1", initrd, "initrd.img", "/boot/initrd.img")

    readme = out.parent / "README.TXT"
    readme.write_text(README.format(ver=VERSION, code=CODENAME))
    add("/README.TXT;1", readme, "README.TXT", "/README.TXT")

    # ---- El Torito: EFI platform, no emulation, the FAT image as the volume
    # NB: bootfile_path is an *ISO* path - the image must be on the disc first.
    iso.add_eltorito("/EFI/BOOT/EFI.IMG;1", bootcatfile="/BOOT.CAT;1", rr_bootcatname="boot.cat",
                     joliet_bootcatfile="/boot.cat", efi=True, platform_id=0xEF,
                     media_name="noemul")

    out.parent.mkdir(parents=True, exist_ok=True)
    iso.write(str(out))
    iso.close()
    for fh in handles:
        fh.close()
    return {"path": str(out), "bytes": out.stat().st_size, "sha256": sha256(out)}


# --------------------------------------------------------------------------- #
def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="build a bootable THADD OS ISO")
    ap.add_argument("--out", default=str(BUILD / "iso" / OUT_NAME))
    ap.add_argument("--kernel", default=str(BUILD / "payload" / "vmlinuz"))
    ap.add_argument("--initrd", default=str(BUILD / "iso" / "boot" / "initrd.img.gz"))
    ap.add_argument("--loader", default=str(BUILD / "boot" / "BOOTX64.EFI"))
    ap.add_argument("--rootfs", default=str(BUILD / "live" / "rootfs"))
    ap.add_argument("--fat-carry-kernel", action="store_true",
                    help="also put vmlinuz/initrd.img in the FAT boot volume "
                         "(only possible below the 32 MB El Torito limit)")
    ap.add_argument("--no-initramfs", action="store_true",
                    help="do not build the initramfs, just use what is there")
    ap.add_argument("--quiet", action="store_true")
    args = ap.parse_args(argv)

    out = Path(args.out)
    kernel = find_file(Path(args.kernel), what="kernel (build/payload/vmlinuz)")
    loader = find_file(Path(args.loader), what="UEFI loader (build/boot/BOOTX64.EFI)")

    initrd: Path | None = Path(args.initrd)
    if args.no_initramfs:
        initrd = initrd if initrd.exists() else None
    else:
        rootfs = Path(args.rootfs)
        if rootfs.is_dir() and any(rootfs.iterdir()):
            import subprocess
            print(f"[iso] packing initramfs from {rootfs} ...")
            rc = subprocess.call([sys.executable, str(HERE / "mkinitramfs.py"),
                                  str(rootfs), str(initrd)])
            if rc:
                raise SystemExit(f"[iso] mkinitramfs failed ({rc})")
        else:
            print("[iso] no staged rootfs - building the ISO without an initramfs")
            initrd = initrd if initrd.exists() else None

    print(f"  THADD OS {VERSION} ({CODENAME}) - assembling the disc")
    print(f"    kernel   : {kernel.name}  {kernel.stat().st_size / 1e6:.1f} MB")
    if initrd:
        print(f"    initramfs: {initrd.name}  {initrd.stat().st_size / 1e6:.1f} MB (gz)")
    print(f"    loader   : {loader.name}  {loader.stat().st_size} bytes")

    esp = out.parent / "efi.img"
    build_esp(loader, kernel, initrd, esp, quiet=args.quiet,
              carry_kernel=args.fat_carry_kernel)
    info = build_iso(esp, kernel, initrd, out, quiet=args.quiet, loader=loader)

    manifest = {
        "os": "THADD OS", "version": VERSION, "codename": CODENAME,
        "built": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "iso": os.path.basename(info["path"]), "bytes": info["bytes"],
        "sha256": info["sha256"],
        "boot": "UEFI (El Torito, platform 0xEF, FAT16 efi.img)",
        "kernel_sha256": sha256(kernel),
        "initramfs_sha256": sha256(initrd) if initrd else None,
        "initramfs_bytes": initrd.stat().st_size if initrd else None,
        "loader_sha256": sha256(loader),
    }
    (out.parent / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    (out.parent / (out.name + ".sha256")).write_text(f"{info['sha256']}  {out.name}\n")

    print(f"\n  ISO ready : {info['path']}")
    print(f"  size      : {info['bytes'] / 1e6:.1f} MB")
    print(f"  sha256    : {info['sha256']}")
    print(f"  boot      : UEFI - attach the ISO to a VM with EFI firmware enabled")
    print(f"  manifest  : {out.parent / 'manifest.json'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
