#!/usr/bin/env bash
# =============================================================================
#  THADD OS — ISO verifier
# =============================================================================
#  Proves that the artefact we are about to hand a human is actually the OS we
#  promised. No booting required, no guessing: the ISO's boot records are read,
#  the squashfs is unpacked, and the *contents of the shipped image* are
#  asserted file by file. Hard checks fail the run; soft checks warn.
#
#  Usage:  sudo ./iso/verify.sh [path/to.iso]      (no args = newest in dist/)
#  Exit :  0 = shippable, 1 = do not ship
# =============================================================================
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ISO_PATH="${1:-$(ls -1t "$REPO_ROOT"/dist/*.iso 2>/dev/null | head -1 || true)}"
WORK="$(mktemp -d /tmp/thadd-verify.XXXXXX)"
FATAL=0; WARN=0

C_R=$'\033[0m'; C_OK=$'\033[38;5;42m'; C_BAD=$'\033[38;5;203m'; C_W=$'\033[38;5;214m'; C_A=$'\033[38;5;39m'
pass() { printf '%s  ✓ PASS%s %s\n' "$C_OK" "$C_R" "$1"; }
fail() { printf '%s  ✗ FAIL%s %s\n' "$C_BAD" "$C_R" "$1"; FATAL=$((FATAL+1)); }
warn() { printf '%s  ! WARN%s %s\n' "$C_W" "$C_R" "$1"; WARN=$((WARN+1)); }
head1() { printf '\n%s── %s ──%s\n' "$C_A" "$1" "$C_R"; }
cleanup() { rm -rf "$WORK"; }
trap cleanup EXIT

head1 "artefact"
if [[ -z "$ISO_PATH" || ! -f "$ISO_PATH" ]]; then
  fail "no ISO found (build it first: sudo ./iso/build.sh)"
  exit 1
fi
SIZE_BYTES=$(stat -c%s "$ISO_PATH"); SIZE_MB=$((SIZE_BYTES/1024/1024))
printf '  %s\n  %s MiB  ·  %s\n' "$ISO_PATH" "$SIZE_MB" "$(sha256sum "$ISO_PATH" | cut -c1-32)…"
(( SIZE_MB >= 250 )) && pass "size is a plausible full desktop image (${SIZE_MB} MiB)" \
                     || fail "image is suspiciously small (${SIZE_MB} MiB) — packages likely missing"
(( SIZE_MB <= 4200 )) && pass "fits a DVD / release asset split threshold" \
                      || warn "very large (${SIZE_MB} MiB) — release will be split into parts"

# checksum sidecar
if [[ -f "$ISO_PATH.sha256" ]]; then
  if ( cd "$(dirname "$ISO_PATH")" && sha256sum -c "$(basename "$ISO_PATH").sha256" >/dev/null 2>&1 ); then
    pass "sha256 sidecar verifies"
  else
    fail "sha256 sidecar does NOT match the ISO"
  fi
else
  warn "no .sha256 sidecar next to the ISO"
fi

head1 "boot records (hybrid BIOS + UEFI)"
# `file` gives the friendliest answer, but it is not installed everywhere - and a
# missing `file` used to look exactly like a non-ISO image.  The bytes are the
# truth: the ISO 9660 primary volume descriptor sits at 0x8001, and a bootable
# disk (hybrid ISO) carries 0x55AA at offset 510.
FILE_OUT="$(command -v file >/dev/null 2>&1 && file "$ISO_PATH" 2>/dev/null || true)"
PVD="$(dd if="$ISO_PATH" bs=1 skip=32769 count=5 status=none 2>/dev/null || true)"
if grep -qi 'ISO 9660' <<<"$FILE_OUT"; then pass "ISO 9660 filesystem (file: $(cut -d: -f2- <<<"$FILE_OUT" | cut -c2-60))";
elif [[ "$PVD" == "CD001" ]]; then pass "ISO 9660 filesystem (volume descriptor at 0x8001)";
else fail "not an ISO 9660 image (no CD001 volume descriptor)"; fi
MBR_SIG="$(dd if="$ISO_PATH" bs=1 skip=510 count=2 status=none 2>/dev/null | od -An -tx1 2>/dev/null | tr -d ' \n' || true)"
if grep -qiE 'DOS/MBR boot sector|hybrid' <<<"$FILE_OUT"; then pass "MBR/El Torito boot sector present (BIOS boot)";
elif [[ "$MBR_SIG" == "55aa" ]]; then pass "MBR boot signature 0x55AA at offset 510 (hybrid ISO)";
else warn "no MBR boot sector signature — BIOS/legacy boot may fail in VirtualBox"; fi

command -v xorriso >/dev/null 2>&1 || { fail "xorriso missing (apt-get install xorriso)"; exit 1; }
XORRISO_OPTS=( -indev "$ISO_PATH" -report_el_torito plain )
BOOT_OUT="$(xorriso -indev "$ISO_PATH" -report_el_torito plain 2>&1 || true)"
grep -qi 'El Torito' <<<"$BOOT_OUT" && pass "El Torito boot catalog readable" || warn "El Torito report unavailable"
grep -qiE 'BIOS|0x0 ' <<<"$BOOT_OUT" && pass "BIOS boot image referenced" || warn "BIOS boot image not listed"
grep -qiE 'EFI|efiboot' <<<"$BOOT_OUT" && pass "EFI boot image referenced (UEFI boot)" || warn "no EFI boot image — UEFI boot may fail"

head1 "image layout"
# Two ways of asking whether a file is on the ISO, because no single one is
# trustworthy across xorriso versions:
#   * `-find / -type f` prints the tree on some builds and nothing at all on
#     others (an empty listing made every layout check fail on a perfectly good
#     ISO - the failure that hid in this pipeline for two runs);
#   * `-osirrox on -extract` either produces the bytes or it does not, and it is
#     the same call the squashfs extraction below depends on.
# So: list for the report, and *probe* for the verdict.
LIST="$(xorriso -indev "$ISO_PATH" -find / -type f 2>/dev/null || true)"
if [[ -n "$LIST" ]]; then
  printf '  %s\n' "$(wc -l <<<"$LIST") file(s) listed on the ISO"
else
  warn "xorriso -find listed nothing ($(xorriso --version 2>/dev/null | head -1)) — using extraction probes"
fi

ISO_PROBE_BYTES=""
iso_file() { # iso_file <path-in-iso> -> 0 when the bytes really can be extracted
  local dest="$WORK/probe.$$"
  rm -f "$dest"
  if xorriso -indev "$ISO_PATH" -osirrox on -extract "$1" "$dest" >/dev/null 2>&1 && [[ -s "$dest" ]]; then
    ISO_PROBE_BYTES="$(stat -c%s "$dest" 2>/dev/null || echo '?')"
    rm -f "$dest"
    return 0
  fi
  rm -f "$dest"
  ISO_PROBE_BYTES=""
  return 1
}
iso_has() { grep -qx "/$1" <<<"$LIST" || iso_file "/$1"; }

# live/filesystem.squashfs is proven by the extraction in the next section (it is
# 2 GB - no point pulling it twice).
for required in live/vmlinuz live/initrd.img; do
  if iso_has "$required"; then
    pass "$required present (${ISO_PROBE_BYTES} bytes)"
  else
    fail "$required MISSING — image is not bootable"
  fi
done
for optional in isolinux/isolinux.bin isolinux/syslinux.cfg; do
  if iso_has "$optional"; then pass "$optional present (legacy BIOS boot)";
  else warn "$optional missing — legacy BIOS boot degraded"; fi
done

# UEFI: live-build ships the EFI system partition as a FAT image (efi.img) or as
# EFI/BOOT/BOOTX64.EFI on the ISO root, depending on version/bootloader choice.
EFI_FOUND=""
for candidate in boot/grub/efi.img efi.img EFI/BOOT/BOOTX64.EFI EFI/boot/bootx64.efi; do
  if iso_has "$candidate"; then EFI_FOUND="$candidate"; break; fi
done
if [[ -n "$EFI_FOUND" ]]; then
  pass "UEFI boot image present: /$EFI_FOUND (${ISO_PROBE_BYTES} bytes)"
else
  warn "no EFI boot image found — UEFI-only machines will not boot (BIOS still works)"
fi
if iso_has "isolinux/isohdpfx.bin" || grep -qE '^/(isolinux|syslinux)/' <<<"$LIST"; then
  pass "hybrid MBR boot files present (the ISO boots as a disk too)"
fi

head1 "ship contents (deeper look inside the squashfs)"
SQ="$WORK/filesystem.squashfs"
[[ -n "${THADD_VERIFY_KEEP:-}" ]] || true
if xorriso -indev "$ISO_PATH" -osirrox on -extract /live/filesystem.squashfs "$SQ" >/dev/null 2>&1 && [[ -s "$SQ" ]]; then
  pass "live/filesystem.squashfs present and extractable ($(du -h "$SQ" | cut -f1))"
else
  fail "could not extract /live/filesystem.squashfs — the ISO has no root filesystem"
  printf '\n%s═══ verification: %d failure(s), %d warning(s) ═══%s\n' "$C_A" "$FATAL" "$WARN" "$C_R"
  printf '%s  RESULT: NOT SHIPPABLE%s\n' "$C_BAD" "$C_R"
  exit 1
fi
command -v unsquashfs >/dev/null 2>&1 || { fail "unsquashfs missing (apt-get install squashfs-tools)"; exit 1; }

need_file() { # need_file <path-in-image> <human name> <hard|soft>
  if unsquashfs -ll "$SQ" "$1" >/dev/null 2>&1; then pass "$2  ($1)";
  else
    if [[ "$3" == hard ]]; then fail "$2 MISSING ($1)"; else warn "$2 missing ($1)"; fi
  fi
}
need_file etc/os-release                 "THADD identity"            hard
need_file etc/lsb-release                "LSB identity"              soft
need_file etc/thadd/build-info           "build fingerprint"         hard
need_file etc/skel/.config/xfce4/xfconf/xfce-perchannel-xml/xfce4-panel.xml "desktop profile" hard
need_file usr/bin/xfce4-session          "window session"            hard
need_file usr/bin/xfdesktop              "desktop shell"             hard
need_file usr/bin/xfwm4                  "window manager"            hard
need_file usr/bin/picom                  "compositor"                hard
need_file usr/sbin/lightdm               "display manager"           hard
need_file usr/local/bin/thadd            "THADD control centre"      hard
need_file usr/local/bin/thadd-ai         "THADD AI assistant"        hard
need_file usr/local/bin/thadd-scan       "forensic scanner"          hard
need_file usr/local/bin/thadd-desktop-selftest "in-image self-test"  hard
need_file usr/local/bin/thadd-shell-session "THADD session (the desktop the user lands in)" hard
need_file opt/thadd/desktop/index.html  "desktop shell entry"       hard
need_file opt/thadd/app/thadd/server/ai/agent.py "AI agent loop"    hard
need_file opt/thadd/app/thadd/server/ai/tools.py "AI tool registry" hard
need_file opt/thadd/app/thadd/forensics/triage.py "DFIR triage engine" hard
need_file opt/thadd/security/thadd-scan "THADD Scan engine"         hard
need_file opt/thadd/tools/bin/thadd-apt-safe "tolerant package installer" soft
need_file usr/share/applications/firefox-esr.desktop "Firefox browser"  soft
need_file usr/bin/firefox-esr            "Firefox binary"            soft
need_file usr/bin/chromium               "Chromium binary"           soft
need_file usr/bin/nmap                   "nmap (security suite)"     soft
need_file usr/bin/git                    "git"                       hard
need_file usr/bin/python3                "python3"                   hard
need_file usr/local/bin/rea              "REA reverse-engineering"   soft

# Identity must literally say THADD OS.  /etc/os-release is a symlink to
# ../usr/lib/os-release in this image, and `unsquashfs -cat` does not promise to
# follow the final symlink, so try the real file first and the link second.
OSR=""
for candidate in usr/lib/os-release etc/os-release; do
  text="$(unsquashfs -cat "$SQ" "$candidate" 2>/dev/null || true)"
  if grep -q 'THADD OS' <<<"$text"; then OSR="$text"; break; fi
  [[ -n "$text" ]] && OSR="$text"
done
if [[ -z "$OSR" ]]; then
  fail "os-release unreadable inside the squashfs (tried usr/lib/os-release and etc/os-release)"
else
  grep -q 'THADD OS' <<<"$OSR" && pass "os-release brands the system THADD OS" || fail "os-release does not say THADD OS"
  grep -q 'ID=thadd' <<<"$OSR" && pass "ID=thadd" || warn "ID=thadd missing"
fi

head1 "kernel + initramfs"
if unsquashfs -ll "$SQ" "boot" >/dev/null 2>&1; then
  K="$(unsquashfs -ll "$SQ" boot 2>/dev/null | awk '/vmlinuz/{print $NF}' | head -1)"
  I="$(unsquashfs -ll "$SQ" boot 2>/dev/null | awk '/initrd/{print $NF}' | head -1)"
  [[ -n "$K" ]] && pass "kernel present: ${K}" || warn "no vmlinuz inside squashfs (lives on ISO instead)"
  [[ -n "$I" ]] && pass "initramfs present: ${I}" || warn "no initrd inside squashfs (lives on ISO instead)"
fi

printf '\n%s═══ verification: %d failure(s), %d warning(s) ═══%s\n' "$C_A" "$FATAL" "$WARN" "$C_R"
if (( FATAL > 0 )); then
  printf '%s  RESULT: NOT SHIPPABLE%s\n' "$C_BAD" "$C_R"; exit 1
fi
printf '%s  RESULT: SHIPPABLE%s\n' "$C_OK" "$C_R"
exit 0
