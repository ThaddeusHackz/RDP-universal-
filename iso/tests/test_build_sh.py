#!/usr/bin/env python3
"""THADD OS · iso/build.sh driver test — runs the *real* build script against a
stub `lb`, so the parts of the desktop-ISO build that are the repository's own
logic are verified in seconds instead of 45 minutes:

* the configuration in `iso/auto/config` really is applied on the command line
  (its documented location is `<build-dir>/auto/config` — as `iso/config/auto/`
  it was never read, and the build bootstrapped Debian 11 with a main-only
  archive area, which is exactly the failure this test exists to prevent);
* the script refuses to start a long build when the suite, the archive areas,
  the mirrors, the bootloaders or the live boot parameters came out wrong;
* the happy path still collects, renames and checksums the produced ISO.

The stub mimics live-build 1:20230502 including its defaults (suite=bullseye,
archive areas=main), so a configuration that does not override them fails here
the way it would on a runner.

Usage:  sudo python3 iso/tests/test_build_sh.py     # sudo is only needed for
                                                    # build.sh's root check
Exit:   0 when every check passes, 1 otherwise.
"""
from __future__ import annotations

import os
import re
import shutil
import stat
import subprocess
import sys
import tempfile
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
ISO = REPO / "iso"
AUTO = ISO / "auto" / "config"

STUB_LB = r"""#!/bin/sh
# Stub of live-build 1:20230502: same command line, same *defaults*
# (notably suite=bullseye and archive areas=main) and the same config files.
CMD="$1"; shift
if [ "$CMD" = "config" ]; then
  [ "${1:-}" = "noauto" ] && shift
  DIST=bullseye; PARENT=bullseye; ARCH=amd64; AREAS=main; PARENT_AREAS=main
  BOOTLOADERS="syslinux"; COMPRESSION=xz; VOLUME=""; IMAGE_NAME=""; INITSYSTEM=sysvinit
  BOOTAPPEND=""; MBOOT="http://deb.debian.org/debian/"; MCHROOT="$MBOOT"; MBIN="$MBOOT"
  while [ $# -gt 0 ]; do
    case "$1" in
      --distribution) DIST="$2"; shift 2;;
      --parent-distribution) PARENT="$2"; shift 2;;
      --architecture) ARCH="$2"; shift 2;;
      --archive-areas) AREAS="$2"; shift 2;;
      --parent-archive-areas) PARENT_AREAS="$2"; shift 2;;
      --bootloaders) BOOTLOADERS="$(printf '%s' "$2" | tr ',' ' ')"; shift 2;;
      --compression) COMPRESSION="$2"; shift 2;;
      --iso-volume) VOLUME="$2"; shift 2;;
      --image-name) IMAGE_NAME="$2"; shift 2;;
      --initsystem) INITSYSTEM="$2"; shift 2;;
      --bootappend-live) BOOTAPPEND="$2"; shift 2;;
      --mirror-bootstrap) MBOOT="$2"; shift 2;;
      --mirror-chroot) MCHROOT="$2"; shift 2;;
      --mirror-binary) MBIN="$2"; shift 2;;
      *) shift;;
    esac
  done
  mkdir -p config
  echo "P: Creating config tree for a debian/$DIST/$ARCH system"
  printf 'LB_APT="apt"\nLB_APT_RECOMMENDS="false"\nLB_INITSYSTEM="%s"\nLB_IMAGE_NAME="%s"\n' \
    "$INITSYSTEM" "$IMAGE_NAME" > config/common
  printf 'LB_ARCHITECTURE="%s"\nLB_DISTRIBUTION="%s"\nLB_PARENT_DISTRIBUTION="%s"\nLB_ARCHIVE_AREAS="%s"\nLB_PARENT_ARCHIVE_AREAS="%s"\nLB_MIRROR_BOOTSTRAP="%s"\nLB_MIRROR_CHROOT="%s"\n' \
    "$ARCH" "$DIST" "$PARENT" "$AREAS" "$PARENT_AREAS" "$MBOOT" "$MCHROOT" > config/bootstrap
  printf 'LB_SECURITY="true"\n' > config/chroot
  printf 'LB_IMAGE_TYPE="iso-hybrid"\nLB_BOOTAPPEND_LIVE="%s"\nLB_BOOTLOADERS="%s"\nLB_COMPRESSION="%s"\nLB_ISO_VOLUME="%s"\n' \
    "$BOOTAPPEND" "$BOOTLOADERS" "$COMPRESSION" "$VOLUME" > config/binary
  printf 'LB_SOURCE="false"\n' > config/source
  exit 0
fi
if [ "$CMD" = "build" ]; then
  echo "P: Begin building binary iso image (stub)"
  dd if=/dev/zero of=THADD-OS-stub.hybrid.iso bs=1024 count=2048 status=none
  echo "P: stub build finished"
  exit 0
fi
echo "stub lb: unhandled command $CMD" >&2
exit 1
"""

STUB_RSYNC = r"""#!/bin/sh
# Stub of the `rsync -a [--exclude P]... src dest` subset build.sh uses.
SRC=""; DEST=""
while [ $# -gt 0 ]; do
  case "$1" in
    --exclude) shift 2;;
    -a|-av|-aH|-aHAX) shift;;
    *) if [ -z "$SRC" ]; then SRC="$1"; else DEST="$1"; fi; shift;;
  esac
done
[ -n "$SRC" ] && [ -n "$DEST" ] || exit 0
mkdir -p "$(dirname "$DEST")" 2>/dev/null || true
cp -a "$SRC" "$DEST" 2>/dev/null || cp -a "$SRC/." "$DEST/" 2>/dev/null || true
"""

# --- stubs for the verification gate -----------------------------------------
# A real ISO gets verified by iso/verify.sh.  These stubs make the verifier fail
# on the stub ISO (which is 2 MiB of zeros), so the test can prove that build.sh
# refuses to publish an ISO that does not verify.
STUB_XORRISO = r"""#!/bin/sh
# no boot records, no squashfs: pretend the ISO is unreadable
exit 0
"""

STUB_UNSQUASHFS = r"""#!/bin/sh
exit 1
"""

# --- stubs for a healthy ISO, so the verifier itself is tested ---------------
# The verifier has two ways to be wrong: refusing an image that is fine, and
# accepting one that is broken.  These stubs emulate a healthy ISO (layout,
# boot records, extractable files, branded squashfs) so the accepting path is
# exercised too - refusing good builds is exactly what happened in CI.
STUB_XORRISO_GOOD = r"""#!/bin/sh
# `-indev X -report_el_torito plain` | `-find / -type f` | `-osirrox on -extract P DEST`
ISO=""
EXTRACT=""; DEST=""
LIST=0; TORITO=0
while [ $# -gt 0 ]; do
  case "$1" in
    -indev) ISO="$2"; shift 2;;
    -find) LIST=1; shift;;
    -report_el_torito) TORITO=1; shift 2;;
    -osirrox) shift 2;;
    -extract) EXTRACT="$2"; DEST="$3"; shift 3;;
    -type|-exec|--|plain) shift;;
    *) shift;;
  esac
done
if [ -n "$EXTRACT" ]; then
  [ -n "$DEST" ] || exit 1
  mkdir -p "$(dirname "$DEST")" 2>/dev/null
  case "$EXTRACT" in
    /live/filesystem.squashfs) dd if=/dev/zero of="$DEST" bs=1024 count=512 status=none;;
    /isolinux/isolinux.cfg)
      # debian-live's real shape: a pointer file that *includes* the entries - the
      # verifier has to follow it, which it once did not
      {
        echo "default vesamenu.c32"
        echo "prompt 0"
        echo "timeout 0"
        echo "include menu.cfg"
      } > "$DEST";;
    /isolinux/syslinux.cfg)
      echo "default vesamenu.c32" > "$DEST";;
    /isolinux/menu.cfg)
      {
        echo "menu title THADD OS"
        echo "label live"
        echo "  menu label ^Live (amd64)"
        echo "  kernel /live/vmlinuz"
        echo "  append initrd=/live/initrd.img boot=live components quiet splash"
        echo "label safe"
        echo "  menu label ^Safe mode"
        echo "  kernel /live/vmlinuz"
        echo "  append initrd=/live/initrd.img boot=live components nomodeset"
      } > "$DEST";;
    /boot/grub/grub.cfg)
      {
        echo "menuentry 'THADD OS live' {"
        echo "  linux /live/vmlinuz boot=live components quiet splash"
        echo "  initrd /live/initrd.img"
        echo "}"
      } > "$DEST";;
    *) printf 'THADD-STUB:%s\n' "$EXTRACT" > "$DEST";;
  esac
  [ -s "$DEST" ] || exit 1
  exit 0
fi
if [ "$TORITO" = 1 ]; then
  echo "xorriso : NOTE : El Torito boot catalog found"
  echo "El Torito catalog  -  2 images  1 cat"
  echo "El Torito boot img : 1  BIOS  y  img : isolinux/isolinux.bin"
  echo "El Torito boot img : 2  UEFI  y  img : boot/grub/efi.img"
  exit 0
fi
if [ "$LIST" = 1 ]; then
  for f in /live/filesystem.squashfs /live/vmlinuz /live/initrd.img \
           /isolinux/isolinux.bin /isolinux/isolinux.cfg /isolinux/menu.cfg /isolinux/isohdpfx.bin \
           /boot/grub/efi.img /boot/grub/grub.cfg; do echo "$f"; done
  exit 0
fi
exit 0
"""

STUB_UNSQUASHFS_GOOD = r"""#!/bin/sh
# Models the REAL semantics of squashfs-tools, which are the reason the verifier
# was rewritten: in `-ll IMG [PATH]` the extra argument is a *filter*, so a path
# that does not exist produces no output and unsquashfs still exits 0.  The
# verifier therefore reads one full inventory instead.
MODE="$1"; IMG="$2"; shift 2
case "$MODE" in
  -ll)
    if [ -n "${THADD_STUB_INVENTORY:-}" ] && [ -r "$THADD_STUB_INVENTORY" ]; then
      # full inventory (no path argument): dump it
      if [ $# -eq 0 ]; then
        cat "$THADD_STUB_INVENTORY"
        exit 0
      fi
      # filtered listing: only matching entries, still exit 0 either way
      for want in "$@"; do
        grep -F "squashfs-root/$want" "$THADD_STUB_INVENTORY" || true
      done
      exit 0
    fi
    echo "drwxr-xr-x root/root 0 squashfs-root/"
    echo "-rw-r--r-- root/root 16512872 squashfs-root/boot/firmware/vmlinuz-6.1.0-53-amd64"
    echo "-rw-r--r-- root/root 57010176 squashfs-root/boot/firmware/initrd.img-6.1.0-53-amd64"
    exit 0
    ;;
  -cat)
    case "${1:-}" in
      usr/lib/os-release|etc/os-release)
        echo 'PRETTY_NAME="THADD OS 1.0 (aurora)"'
        echo 'ID=thadd'
        exit 0
        ;;
      etc/thadd/selfcheck.txt)
        echo "  PASS  desktop shell"
        echo "  31 passed · 0 failed · 9 warned"
        echo "  THADD desktop: OK"
        exit 0
        ;;
      etc/motd)
        echo "    THADD OS 1.0 \"aurora\""
        echo "     · thadd              system control centre (status/doctor/ai)"
        echo "     · thadd-ai chat      Groq-powered assistant for this machine"
        echo "     · thadd-scan         forensic snapshot of this system"
        echo "     · thadd-toolbox      install offensive/RE tools on demand"
        echo "     · rea --help         reverse engineering (binaries/Electron/.NET)"
        echo "     · thadd-ssh on       enable remote shell (off by default)"
        exit 0
        ;;
      usr/local/bin/thadd)
        if [ "${THADD_STUB_PLACEHOLDER:-0}" = "1" ]; then
          echo "#!/usr/bin/env bash"
          echo "# THADD OS control centre (build placeholder)"
          echo "exit 0"
        else
          echo "#!/usr/bin/env bash"
          echo "# control centre: status, doctor, security, scan, dfir, ai, toolbox"
          echo "cmd_doctor() { :; }"
          echo "delegate thadd-scan \"the forensic scanner is missing from this image\""
          echo "delegate thadd-toolbox \"the toolbox is missing from this image\""
        fi
        exit 0
        ;;
      usr/local/bin/thadd-toolbox)
        echo "#!/usr/bin/env bash"
        echo "PKG_DIR=/usr/share/thadd/packages"
        echo "for f in \"\$PKG_DIR\"/optional-*.txt; do list_set \"\$f\"; done"
        exit 0
        ;;
      usr/local/bin/thadd-ai|opt/thadd/ai/thadd-ai.py)
        echo "#!/bin/sh"
        echo "exec python3 -m thadd.server.ai.cli \"\$@\""
        exit 0
        ;;
      usr/local/bin/rea)
        echo "#!/usr/bin/env python3"
        echo "# identify, unpack (ZIP, tar, ar/deb, ASAR), strings, report"
        exit 0
        ;;
      usr/share/thadd/thirdparty-report.txt)
        echo "THADD OS third-party toolchain"
        echo "=============================="
        echo "  powershell=installed"
        echo "  metasploit=installed"
        echo "  radare2=not-packaged"
        exit 0
        ;;
      usr/share/thadd/apt-safe-report.txt|var/log/thadd/apt-safe.log)
        echo "THADD OS optional package sets"
        echo "=============================="
        for n in 10 105 203 164 176 64 10; do
          echo "thadd-apt-safe: $n resolvable / $n requested"
          echo "installing $n packages in one batch"
          echo "batch install OK"
        done
        echo "not in any configured repo (skipped): metasploit-framework radare2 powershell"
        exit 0
        ;;
    esac
    exit 1
    ;;
esac
exit 0
"""

CHECKS = 0
FAILURES: list[str] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    """Print the detail only when something is wrong: a passing run stays quiet."""
    global CHECKS
    CHECKS += 1
    if ok:
        print(f"  OK   {name}")
        return
    print(f"  FAIL {name}{('  — ' + detail) if detail else ''}")
    FAILURES.append(f"{name}: {detail}")


def run_build(env: dict) -> subprocess.CompletedProcess:
    return subprocess.run([str(ISO / "build.sh"), "--no-install-deps"], cwd=str(REPO), env=env,
                          capture_output=True, text=True, timeout=600)


def snapshot() -> set[str]:
    """Everything the build can create, so cleanup only removes new entries."""
    out = set()
    for root in (REPO / "dist", ISO, ISO / "config"):
        if root.exists():
            for p in root.iterdir():
                out.add(str(p))
    return out


def main() -> int:
    if os.geteuid() != 0:
        # build.sh refuses to run unprivileged (it mounts and chroots for real)
        os.execvp("sudo", ["sudo", "-E", sys.executable, *sys.argv])

    tmp = Path(tempfile.mkdtemp(prefix="thadd-isotest-"))
    stub_bin = tmp / "bin"
    stub_bin.mkdir()
    for name, body in (("lb", STUB_LB), ("rsync", STUB_RSYNC)):
        p = stub_bin / name
        p.write_text(body)
        p.chmod(p.stat().st_mode | stat.S_IEXEC | stat.S_IXGRP | stat.S_IXOTH)
    # a second directory holding only the "verification fails" stubs, so the
    # gate can be tested without lying about the other scenarios
    verify_bin = tmp / "verify-bin"
    verify_bin.mkdir()
    for name, body in (("xorriso", STUB_XORRISO), ("unsquashfs", STUB_UNSQUASHFS)):
        p = verify_bin / name
        p.write_text(body)
        p.chmod(p.stat().st_mode | stat.S_IEXEC | stat.S_IXGRP | stat.S_IXOTH)
    good_bin = tmp / "good-bin"
    good_bin.mkdir()
    for name, body in (("xorriso", STUB_XORRISO_GOOD), ("unsquashfs", STUB_UNSQUASHFS_GOOD)):
        p = good_bin / name
        p.write_text(body)
        p.chmod(p.stat().st_mode | stat.S_IEXEC | stat.S_IXGRP | stat.S_IXOTH)

    env = dict(os.environ)
    env["PATH"] = f"{stub_bin}:{env.get('PATH', '')}"
    env["THADD_VERSION"] = "0.0-test"
    env["THADD_PROFILE"] = "desktop"
    # the stub ISO is not a real image: iso/verify.sh would (correctly) refuse it
    env["THADD_SKIP_VERIFY"] = "1"

    before = snapshot()
    saved_auto = AUTO.read_bytes()
    saved_mode = AUTO.stat().st_mode
    print(f"THADD ISO driver test · stubs in {stub_bin} · repo {REPO}")

    try:
        print("\n[1] the repository's own auto/config drives the build")
        proc = run_build(env)
        check("build.sh exits 0", proc.returncode == 0, f"rc={proc.returncode}")
        for want in ("iso/auto/config applied", "suite: bookworm", "archive areas: main contrib non-free non-free-firmware",
                     "UEFI bootloader: grub-efi", "live boot parameters", "every release-critical setting is in place"):
            check(f"reported: {want}", want in proc.stdout, "missing from the build log")
        check("lb build ran", "stub build finished" in proc.stdout)
        overlay = ISO / "config" / "includes.chroot"
        for want in ("etc/skel/.config", "usr/local/bin/thadd-shell-session",
                     "opt/thadd/tools/bin/thadd-apt-safe", "opt/thadd/desktop/index.html",
                     "opt/thadd/ai/thadd-ai.py", "opt/thadd/security/thadd-scan",
                     "usr/local/bin/thadd-ai", "usr/local/bin/thadd-scan",
                     "opt/thadd/app/thadd/server/ai/cli.py", "opt/thadd/app/thadd/server/ai/agent.py",
                     "opt/thadd/app/thadd/forensics/triage.py",
                     "opt/thadd/desktop/thadd-desktop-selftest",
                     "opt/thadd/desktop/bundle/thadd-shell.js",
                     "usr/share/doc/thadd/SECURITY.md",
                     "usr/local/bin/thadd", "usr/local/bin/thadd-toolbox",
                     # the sets are staged under /opt/thadd/iso-packages/ and the
                     # 0000 hook copies them to /usr/share/thadd/packages/ in the
                     # chroot - assert the layer that actually carries them
                     "opt/thadd/iso-packages/optional-security.txt",
                     "opt/thadd/reverse-engineering/rea"):
            check(f"overlay has /{want}", (overlay / want).exists())
        for doubled in ("etc/skel/skel", "usr/local/local", "opt/thadd/tools/tools", "opt/thadd/ai/ai",
                        "opt/thadd/app/thadd/thadd"):
            check(f"overlay is not nested at /{doubled}", not (overlay / doubled).exists())
        # the ISO's own commands have to be executable inside the image
        for tool in ("usr/local/bin/thadd-ai", "usr/local/bin/thadd-scan",
                     "usr/local/bin/thadd", "usr/local/bin/thadd-toolbox",
                     "opt/thadd/security/thadd-scan", "opt/thadd/tools/bin/thadd-apt-safe",
                     "opt/thadd/desktop/thadd-desktop-selftest",
                     "opt/thadd/reverse-engineering/rea"):
            path = overlay / tool
            check(f"/{tool} is executable", path.exists() and os.access(path, os.X_OK))

        # The control centre is a real program, not a placeholder: run it against
        # the staged tree and require the commands the banner promises to answer.
        staged_thadd = overlay / "usr/local/bin/thadd"
        for sub in ("help", "version", "status"):
            proc_thadd = subprocess.run(["bash", str(staged_thadd), sub], capture_output=True,
                                        text=True, timeout=120)
            check(f"staged `thadd {sub}` runs (exit 0)", proc_thadd.returncode == 0,
                  (proc_thadd.stdout + proc_thadd.stderr)[-200:])
        check("staged `thadd help` lists the toolbox and dfir, not just a placeholder",
              "thadd toolbox" in subprocess.run(["bash", str(staged_thadd), "help"],
                                                capture_output=True, text=True).stdout
              and "thadd dfir" in subprocess.run(["bash", str(staged_thadd), "help"],
                                                 capture_output=True, text=True).stdout)
        proc_tb = subprocess.run(["bash", str(overlay / "usr/local/bin/thadd-toolbox"), "--list"],
                                 capture_output=True, text=True, timeout=120)
        check("staged `thadd-toolbox --list` reads the shipped set lists", proc_tb.returncode == 0,
              (proc_tb.stdout + proc_tb.stderr)[-200:])

        # rea has to be more than present: it must read a real container.  Build a
        # genuine Electron ASAR (the layout asar and chromium-pickle-js write:
        # [4][headerSize][payloadSize][jsonLength][json][data]) and require the
        # extracted file to come back byte for byte.
        import json as _json
        import struct as _struct
        payload = b"const k='gsk_" + b"a" * 30 + b"';\n"
        header = _json.dumps({"files": {"main.js": {"size": len(payload), "offset": "0"}}}).encode()
        padded = header + b"\x00" * ((-len(header)) % 4)
        header_pickle = _struct.pack("<I", 4 + len(padded)) + _struct.pack("<I", len(header)) + padded
        asar_bytes = _struct.pack("<I", 4) + _struct.pack("<I", len(header_pickle)) + header_pickle + payload
        asar_path = tmp / "fixture.asar"
        asar_path.write_bytes(asar_bytes)
        extracted = tmp / "fixture.asar.unpacked"
        proc_rea = subprocess.run([sys.executable, str(overlay / "opt/thadd/reverse-engineering/rea"),
                                   "-x", str(asar_path), "--out", str(extracted)],
                                  capture_output=True, text=True, timeout=180)
        got = (extracted / "main.js")
        check("staged rea unpacks a real ASAR byte for byte",
              proc_rea.returncode == 0 and got.exists() and got.read_bytes() == payload,
              (proc_rea.stdout + proc_rea.stderr)[-200:])
        proc_rea_id = subprocess.run([sys.executable, str(overlay / "opt/thadd/reverse-engineering/rea"),
                                      "--identify", str(asar_path), "--json"],
                                     capture_output=True, text=True, timeout=120)
        check("staged rea identifies the container it just unpacked",
              proc_rea_id.returncode == 0 and "Electron ASAR" in proc_rea_id.stdout,
              proc_rea_id.stdout[-200:])

        produced = REPO / "dist" / "THADD-OS-0.0-test-aurora-amd64.iso"
        check("ISO collected into dist/", produced.is_file(),
              f"{[p.name for p in (REPO / 'dist').glob('*.iso')]}")
        check("ISO named after the version", "0.0-test" in produced.name)
        check("the stub ISO reached the expected size", produced.is_file() and produced.stat().st_size == 2 * 1024 * 1024)
        check("sha256 written", bool(list((REPO / "dist").glob("*.sha256"))))
        check("release notes written", (REPO / "dist" / "RELEASE-NOTES.md").is_file())
        check("the build log was kept", (REPO / "dist" / "build.log").is_file())
        check("verification can be skipped explicitly (THADD_SKIP_VERIFY=1)",
              "THADD_SKIP_VERIFY=1" in proc.stdout, proc.stdout[-300:])
        if proc.returncode != 0:
            print(proc.stdout[-2000:])
            print(proc.stderr[-2000:])

        print("\n[2] a config that forgets non-free-firmware is rejected before the long build")
        AUTO.write_text("#!/bin/sh\nset -e\nlb config noauto --mode debian --distribution bookworm --architecture amd64\n")
        AUTO.chmod(0o755)
        proc = run_build(env)
        check("build.sh exits non-zero", proc.returncode != 0, f"rc={proc.returncode}")
        check("it fails fast (no lb build)", "stub build finished" not in proc.stdout)
        check("it says why", ("non-free-firmware" in proc.stdout + proc.stderr)
              or ("bullseye" in proc.stdout + proc.stderr), proc.stdout[-400:])

        print("\n[3] a missing auto/config is refused outright")
        AUTO.unlink()
        proc = run_build(env)
        check("build.sh exits non-zero", proc.returncode != 0, f"rc={proc.returncode}")
        check("it names the missing file", "iso/auto/config is missing" in proc.stdout + proc.stderr)
        check("it fails fast (no lb build)", "stub build finished" not in proc.stdout)

        print("\n[4] an ISO that does not verify is refused, not published")
        AUTO.write_bytes(saved_auto)
        AUTO.chmod(0o755)
        gated = dict(env)
        gated.pop("THADD_SKIP_VERIFY", None)
        gated["PATH"] = f"{verify_bin}:{gated['PATH']}"
        proc = run_build(gated)
        combined = proc.stdout + proc.stderr
        check("build.sh exits non-zero", proc.returncode != 0, f"rc={proc.returncode}")
        check("it built the ISO first (so the gate is what stopped it)",
              "stub build finished" in proc.stdout)
        check("it ran the verifier", "verifying the ISO" in combined)
        check("it says the ISO did not pass verification", "did not pass verification" in combined,
              combined[-300:])
        print("\n[5] a healthy ISO is recognised as shippable (the verifier itself)")
        # A synthetic hybrid ISO: 300 MiB (a real desktop image is >250), the ISO
        # 9660 primary volume descriptor at 0x8001, the MBR signature at 510, and
        # a matching checksum sidecar.  xorriso/unsquashfs are stubbed to answer
        # like a good image, so this asserts the *verifier's* verdict - it must
        # not refuse an image that is fine (it did exactly that in CI once).
        import hashlib

        good_iso = REPO / "dist" / "GOOD-arena.iso"
        good_iso.parent.mkdir(parents=True, exist_ok=True)
        with open(good_iso, "wb") as fh:
            fh.truncate(300 * 1024 * 1024)
            fh.seek(32769); fh.write(b"CD001")
            fh.seek(510);  fh.write(b"\x55\xaa")
        digest = hashlib.sha256()
        with open(good_iso, "rb") as fh:
            for chunk in iter(lambda: fh.read(1 << 20), b""):
                digest.update(chunk)
        (good_iso.parent / (good_iso.name + ".sha256")).write_text(
            f"{digest.hexdigest()}  {good_iso.name}\n")

        # The inventory the stub answers with is derived from what verify.sh
        # actually demands - every `need_file <path>` in the script - minus
        # Chromium, which is deliberately withheld to prove the inventory is
        # consulted rather than assumed (a missing path must WARN, not PASS).
        wanted = set()
        for line in (ISO / "verify.sh").read_text().splitlines():
            parts = line.split()
            if len(parts) >= 2 and parts[0] == "need_file":
                wanted.add(parts[1])
            elif len(parts) >= 4 and parts[0] == "need_any":
                # need_any <name> <hard|soft> <path>...: provide the first path
                wanted.add(parts[3])
        withheld = "usr/bin/chromium"
        wanted.discard(withheld)
        inventory = tmp / "inventory.txt"
        inventory.write_text("".join(
            f"-rwxr-xr-x root/root 1234 2026-10-14 12:00 squashfs-root/{path}\n"
            for path in sorted(wanted)
        ) + "-rw-r--r-- root/root 16512872 2026-10-14 12:00 squashfs-root/boot/firmware/vmlinuz-6.1.0-53-amd64\n"
          + "-rw-r--r-- root/root 57010176 2026-10-14 12:00 squashfs-root/boot/firmware/initrd.img-6.1.0-53-amd64\n"
          + "-rw-r--r-- root/root 8466 2026-10-14 12:00 squashfs-root/usr/share/doc/thadd/SECURITY.md\n"
          + "-rw-r--r-- root/root 6706 2026-10-14 12:00 squashfs-root/usr/share/doc/thadd/QUICKSTART.md\n"
          + "-rw-r--r-- root/root 6054 2026-10-14 12:00 squashfs-root/usr/share/doc/thadd/AI.md\n"
          + "-rw-r--r-- root/root 9216 2026-10-14 12:00 squashfs-root/usr/share/doc/thadd/FORENSIC_SCAN.md\n"
          + "-rw-r--r-- root/root 4215 2026-10-14 12:00 squashfs-root/usr/share/doc/thadd/REA.md\n"
          + "-rwxr-xr-x root/root 1234 2026-10-14 12:00 squashfs-root/usr/local/bin/thadd\n"
          + "-rwxr-xr-x root/root 1234 2026-10-14 12:00 squashfs-root/usr/local/bin/thadd-toolbox\n"
          + "-rwxr-xr-x root/root 1234 2026-10-14 12:00 squashfs-root/usr/local/bin/thadd-ssh\n"
          + "-rwxr-xr-x root/root 1234 2026-10-14 12:00 squashfs-root/usr/local/bin/thadd-passwd\n"
          + "-rw-r--r-- root/root 1234 2026-10-14 12:00 squashfs-root/usr/share/thadd/packages/optional-security.txt\n"
          + "-rwxr-xr-x root/root 24680 2026-10-14 12:00 squashfs-root/usr/local/bin/rea\n"
          + "-rwxr-xr-x root/root 24680 2026-10-14 12:00 squashfs-root/opt/thadd/reverse-engineering/rea\n")

        good_env = dict(env)
        good_env["PATH"] = f"{good_bin}:{good_env['PATH']}"
        good_env["THADD_STUB_INVENTORY"] = str(inventory)
        proc = subprocess.run(["bash", str(ISO / "verify.sh"), str(good_iso)], cwd=str(REPO),
                              env=good_env, capture_output=True, text=True, timeout=900)
        out = proc.stdout + proc.stderr
        # the verifier colourises even when not on a tty, so strip escapes before
        # matching on phrases that span a colour boundary ("PASS" + reset + " git")
        out = re.sub(r"\x1b\[[0-9;]*m", "", out)
        check("the verifier accepts a good ISO", proc.returncode == 0,
              f"rc={proc.returncode} :: " + " | ".join(l for l in out.splitlines() if "FAIL" in l)[:300])
        check("it says RESULT: SHIPPABLE", "RESULT: SHIPPABLE" in out,
              [l for l in out.splitlines() if "RESULT" in l])
        check("with zero failures counted", " 0 failure(s)" in out,
              [l for l in out.splitlines() if "verification:" in l])
        check("and it checked the ISO layout, not just the contents",
              "live/vmlinuz present" in out and "UEFI boot image present" in out)
        check("it read a real squashfs inventory",
              "squashfs inventory:" in out and "entries" in out,
              [l for l in out.splitlines() if "inventory" in l])
        check("a path missing from the inventory warns instead of passing",
              "WARN Chromium binary missing" in out or "WARN" in out and "Chromium" in out,
              [l for l in out.splitlines() if "Chromium" in l][:2])
        check("everything present is still reported as present",
              f"PASS git" in out and "PASS python3" in out)
        check("the BIOS boot menu is read and its live parameters checked",
              "boot=live" in out and "BIOS boot entr" in out,
              [l for l in out.splitlines() if "menu" in l][:3])
        check("it follows the included menu file (debian-live splits the entries out)",
              "menu.cfg" in out and "2 BIOS boot entr" in out,
              [l for l in out.splitlines() if "menu source" in l or "entr(ies)" in l][:3])
        check("the documentation inside the image is checked, not assumed",
              "PASS documentation: SECURITY.md" in out,
              [l for l in out.splitlines() if "documentation" in l][:3])
        check("the forensic method and the reverse-engineering guide ship too",
              "PASS documentation: FORENSIC_SCAN.md" in out
              and "PASS documentation: REA.md" in out,
              [l for l in out.splitlines() if "documentation:" in l])
        check("no shell errors leaked into the verification report",
              "command not found" not in out,
              [l for l in out.splitlines() if "command not found" in l][:2])
        check("the UEFI menu is checked too", "GRUB menu carries the live parameters" in out,
              [l for l in out.splitlines() if "GRUB" in l][:2])
        check("the image's commands are checked for content, not just existence",
              "no command shipped in this image is a placeholder" in out,
              [l for l in out.splitlines() if "placeholder" in l][:3])
        check("and each one is required to name what it actually runs",
              "the assistant entry point runs the real assistant" in out
              and "the toolbox replays the shipped set lists" in out,
              [l for l in out.splitlines() if "replays" in l or "entry point" in l][:3])
        check("the login banner is checked against the image, command by command",
              "the banner advertises thadd-toolbox, and it is in the image" in out,
              [l for l in out.splitlines() if "banner" in l][:4])
        check("the optional sets are reported from the installer's own report",
              "installer ran 7 optional" in out,
              [l for l in out.splitlines() if "optional set" in l][:3])
        check("the third-party step is reported too",
              "third-party: powershell=installed" in out and "radare2=not-packaged" in out,
              [l for l in out.splitlines() if "third-party" in l][:4])
        check("packages Debian does not ship are surfaced, not hidden",
              "not in this release's repos" in out and "metasploit-framework" in out,
              [l for l in out.splitlines() if "repos" in l][:2])
        print("\n[6] a placeholder in the image is caught (the defect that hid for six releases)")
        # The whole point of the content checks: this ISO is healthy in every other
        # way, its paths all exist, and `thadd` is the stub it used to be.  The
        # verifier must refuse it.
        stub_env = dict(good_env)
        stub_env["THADD_STUB_PLACEHOLDER"] = "1"
        proc = subprocess.run(["bash", str(ISO / "verify.sh"), str(good_iso)], cwd=str(REPO),
                              env=stub_env, capture_output=True, text=True, timeout=900)
        stub_out = re.sub(r"\x1b\[[0-9;]*m", "", proc.stdout + proc.stderr)
        check("the verifier refuses an image whose command is a placeholder",
              proc.returncode != 0, f"rc={proc.returncode}")
        check("it names the placeholder it found",
              "still announces itself as a placeholder" in stub_out,
              [l for l in stub_out.splitlines() if "placeholder" in l][:3])
        check("and the verdict is not SHIPPABLE",
              "RESULT: SHIPPABLE" not in stub_out,
              [l for l in stub_out.splitlines() if "RESULT" in l][:2])
    finally:
        AUTO.write_bytes(saved_auto)
        AUTO.chmod(stat.S_IMODE(saved_mode))
        for p in sorted(snapshot() - before, key=len, reverse=True):
            path = Path(p)
            try:
                shutil.rmtree(path) if path.is_dir() else path.unlink()
            except OSError as exc:
                print(f"  (cleanup: {path}: {exc})")
        shutil.rmtree(tmp, ignore_errors=True)
        # the staged overlay and the generated config are build products
        for stale in (ISO / "config" / "includes.chroot",):
            shutil.rmtree(stale, ignore_errors=True)

    print(f"\n{CHECKS - len(FAILURES)}/{CHECKS} checks passed")
    for f in FAILURES:
        print(f"  FAILED {f}")
    return 1 if FAILURES else 0


if __name__ == "__main__":
    raise SystemExit(main())
