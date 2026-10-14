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

    env = dict(os.environ)
    env["PATH"] = f"{stub_bin}:{env.get('PATH', '')}"
    env["THADD_VERSION"] = "0.0-test"
    env["THADD_PROFILE"] = "desktop"

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
                     "opt/thadd/app/thadd/forensics/triage.py"):
            check(f"overlay has /{want}", (overlay / want).exists())
        for doubled in ("etc/skel/skel", "usr/local/local", "opt/thadd/tools/tools", "opt/thadd/ai/ai",
                        "opt/thadd/app/thadd/thadd"):
            check(f"overlay is not nested at /{doubled}", not (overlay / doubled).exists())
        # the ISO's own commands have to be executable inside the image
        for tool in ("usr/local/bin/thadd-ai", "usr/local/bin/thadd-scan",
                     "opt/thadd/security/thadd-scan", "opt/thadd/tools/bin/thadd-apt-safe"):
            path = overlay / tool
            check(f"/{tool} is executable", path.exists() and os.access(path, os.X_OK))

        produced = REPO / "dist" / "THADD-OS-0.0-test-aurora-amd64.iso"
        check("ISO collected into dist/", produced.is_file(),
              f"{[p.name for p in (REPO / 'dist').glob('*.iso')]}")
        check("ISO named after the version", "0.0-test" in produced.name)
        check("the stub ISO reached the expected size", produced.is_file() and produced.stat().st_size == 2 * 1024 * 1024)
        check("sha256 written", bool(list((REPO / "dist").glob("*.sha256"))))
        check("release notes written", (REPO / "dist" / "RELEASE-NOTES.md").is_file())
        check("the build log was kept", (REPO / "dist" / "build.log").is_file())
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
