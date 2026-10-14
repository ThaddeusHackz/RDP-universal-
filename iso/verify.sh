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
# The workspace holds the extracted squashfs (2-6 GB), so it is configurable: CI
# points it at a larger volume when the runner's root filesystem is tight.
if [[ -n "${THADD_VERIFY_WORK:-}" ]]; then
  mkdir -p "$THADD_VERIFY_WORK" && WORK="$THADD_VERIFY_WORK" || WORK="$(mktemp -d /tmp/thadd-verify.XXXXXX)"
else
  WORK="$(mktemp -d /tmp/thadd-verify.XXXXXX)"
fi
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
printf '  workspace: %s\n  disk: %s\n' "$WORK" "$(df -h "$WORK" | tail -1 | tr -s ' ')"
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
LIST_RAW="$(xorriso -indev "$ISO_PATH" -find / -type f 2>/dev/null || true)"
# xorriso prints paths in whatever shape it likes (with or without a leading
# "./", sometimes with an ISO 9660 ";1" version).  Normalise before grepping.
LIST="$(sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e 's/^\.\///' -e 's/;[0-9]*$//' \
        <<<"$LIST_RAW" | sed 's#^/*#/#' | sort -u | grep '^/' || true)"
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
if iso_has "isolinux/isolinux.bin"; then
  pass "isolinux/isolinux.bin present (legacy BIOS boot)"
else
  warn "isolinux/isolinux.bin missing — legacy BIOS boot degraded"
fi
# debian-live writes isolinux/isolinux.cfg; some builds keep the syslinux name
for cfg in isolinux/isolinux.cfg isolinux/syslinux.cfg syslinux/syslinux.cfg; do
  if iso_has "$cfg"; then pass "$cfg present (BIOS boot menu)"; CFG_FOUND="$cfg"; break; fi
done
[[ -n "${CFG_FOUND:-}" ]] || warn "no syslinux/isolinux boot menu config found — BIOS boot may be menu-less"

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
if iso_has "isolinux/isohdpfx.bin"; then
  pass "isolinux/isohdpfx.bin present (the ISO also boots as a USB disk)"
elif grep -qE '^/(isolinux|syslinux)/' <<<"$LIST"; then
  pass "isolinux boot files present (the ISO also boots as a disk)"
fi

head1 "boot menus (what the firmware actually offers)"
# The files being present is not the same as the menus being usable: a live ISO
# whose isolinux.cfg points at a kernel that is not on the disc boots to a
# prompt, and a menu without the live parameters boots to a kernel panic.  These
# are the entries a VirtualBox user picks, so they are read and checked.
# debian-live splits this: isolinux.cfg holds `default vesamenu.c32` and an
# `include` of the file that carries the actual entries (menu.cfg / live.cfg /
# stdmenu.cfg, depending on version).  Reading only isolinux.cfg made a perfectly
# good menu look like three failures - so every candidate is read and the checks
# run over the union, with the sources named.
MENU_FILE="$WORK/isolinux-menu.txt"
: > "$MENU_FILE"
MENU_SOURCES=""
for cfgpath in isolinux/isolinux.cfg isolinux/syslinux.cfg isolinux/menu.cfg isolinux/live.cfg \
               isolinux/stdmenu.cfg isolinux/splash.cfg syslinux/syslinux.cfg; do
  dest="$WORK/menu-$(tr '/' '_' <<<"$cfgpath")"
  if xorriso -indev "$ISO_PATH" -osirrox on -extract "/$cfgpath" "$dest" >/dev/null 2>&1 && [[ -s "$dest" ]]; then
    printf '\n# ===== %s =====\n' "$cfgpath" >> "$MENU_FILE"
    cat "$dest" >> "$MENU_FILE"
    MENU_SOURCES="$MENU_SOURCES $cfgpath"
  fi
done
ISO_CFG="$(cat "$MENU_FILE" 2>/dev/null || true)"
if [[ -z "${MENU_SOURCES// /}" ]]; then
  warn "no isolinux configuration on the ISO — the BIOS menu cannot be checked"
else
  printf '  %s\n' "menu source(s):$MENU_SOURCES"
  menus_seen="$(grep -cE '^[[:space:]]*label ' <<<"$ISO_CFG" || true)"
  if (( menus_seen >= 1 )); then
    pass "$menus_seen BIOS boot entr(ies) defined: $(grep -hoE '^[[:space:]]*label [^ ]+' <<<"$ISO_CFG" | awk '{print $2}' | tr '\n' ' ')"
  else
    warn "no BIOS boot entries found in any menu file ($MENU_SOURCES)"
  fi
  grep -qE '^\s*default ' <<<"$ISO_CFG" && pass "default entry: $(grep -m1 -E '^\s*default ' <<<"$ISO_CFG" | tr -s ' ')"
  if grep -q 'boot=live' <<<"$ISO_CFG"; then
    pass "the live parameters are on the menu (boot=live)"
  else
    fail "no boot=live in the BIOS menu — the image would boot without a live root"
  fi
  for ref in vmlinuz initrd; do
    if grep -q "$ref" <<<"$ISO_CFG"; then
      pass "menu references $ref: $(grep -m1 -oE "[^ ]*${ref}[^ ]*" <<<"$ISO_CFG")"
    else
      fail "the BIOS menu never references $ref"
    fi
  done
fi
GRUB_CFG="$(xorriso -indev "$ISO_PATH" -osirrox on -extract /boot/grub/grub.cfg "$WORK/grub.cfg" >/dev/null 2>&1 && cat "$WORK/grub.cfg" 2>/dev/null || true)"
if [[ -n "$GRUB_CFG" ]]; then
  grep -q 'boot=live' <<<"$GRUB_CFG" && pass "the UEFI/GRUB menu carries the live parameters too" \
                                      || warn "the GRUB menu does not mention boot=live"
else
  warn "no /boot/grub/grub.cfg on the ISO — UEFI boot is provided by the EFI image alone"
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
command -v unsquashfs >/dev/null 2>&1 || { fail "unsquashfs missing (apt-get install squashfs-tools)" || true; exit 1; }

# The contents of the image are checked against ONE inventory of the squashfs,
# taken here.  The obvious alternative - `unsquashfs -ll "$SQ" <path>` per file -
# is silently useless: in squashfs-tools' listing mode the extra argument is a
# *filter*, not a file to stat, so a path that does not exist simply produces no
# output and unsquashfs still exits 0.  Every "PASS" in an earlier report was
# that: nmap was reported present on an image whose security package set had
# never been installed.  A full listing cannot pass by accident: either the exact
# entry is in it or it is not.
SQ_LIST="$WORK/squashfs-inventory.txt"
if ! unsquashfs -ll "$SQ" > "$SQ_LIST" 2>/dev/null; then
  warn "could not list the squashfs (unsquashfs -ll failed) — falling back to extraction probes"
  : > "$SQ_LIST"
fi
if [[ -s "$SQ_LIST" ]]; then
  pass "squashfs inventory: $(wc -l < "$SQ_LIST") entries"
fi

in_squashfs() { # in_squashfs <path-in-image>
  [[ -s "$SQ_LIST" ]] || return 2
  awk -v want="$1" '
    { for (i = 1; i <= NF; i++) { p = $i; sub(/^squashfs-root\//, "", p); sub(/^\.\//, "", p); if (p == want) found = 1 } }
    END { exit(found ? 0 : 1) }' "$SQ_LIST"
}

need_any() { # need_any <human name> <hard|soft> <path>...
  local name="$1" level="$2"; shift 2
  local found="" path
  for path in "$@"; do
    if in_squashfs "$path"; then found="$path"; break; fi
  done
  if [[ -n "$found" ]]; then
    pass "$name  ($found)"
  elif [[ "$level" == hard ]]; then
    fail "$name MISSING (looked in: $*)"
  else
    warn "$name missing (looked in: $*)"
  fi
}

need_file() { # need_file <path-in-image> <human name> <hard|soft>
  in_squashfs "$1"
  case $? in
    0) pass "$2  ($1)" ;;
    2) # no inventory: probe by extracting the bytes instead
       if unsquashfs -cat "$SQ" "$1" >/dev/null 2>&1; then pass "$2  ($1)";
       elif [[ "$3" == hard ]]; then fail "$2 MISSING ($1)"; else warn "$2 missing ($1)"; fi ;;
    *) if [[ "$3" == hard ]]; then fail "$2 MISSING ($1)"; else warn "$2 missing ($1)"; fi ;;
  esac
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
need_file usr/bin/chromium               "Chromium binary"           soft
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

# ---- what the image's own self-test concluded during the build -------------
# 0500-thadd-cleanup runs /usr/local/bin/thadd-desktop-selftest inside the
# chroot and records the output.  That is the one check made from *inside* the
# system being shipped, so its verdict is read here: a desktop that could not
# prove itself at build time must not be published as if it could.
SELFCHECK="$(unsquashfs -cat "$SQ" etc/thadd/selfcheck.txt 2>/dev/null || true)"
if [[ -z "$SELFCHECK" ]]; then
  warn "no /etc/thadd/selfcheck.txt — the in-image self-test did not run during the build"
elif grep -qE '^ *FAIL ' <<<"$SELFCHECK"; then
  fail "the in-image self-test reported problems: $(grep -m3 -E '^ *FAIL ' <<<"$SELFCHECK" | tr -s ' ' | tr '\n' ';')"
elif grep -qi 'THADD desktop: OK' <<<"$SELFCHECK"; then
  pass "in-image self-test: $(grep -m1 -E 'passed' <<<"$SELFCHECK" | tr -s ' ' | sed 's/^ *//')"
else
  warn "in-image self-test output present but no verdict line: $(head -1 <<<"$SELFCHECK")"
fi

head1 "documentation shipped with the image"
# The login banner and /etc/thadd/security-posture point at these files; a pointer
# to a missing file is worse than no pointer.
for doc in SECURITY.md QUICKSTART.md AI.md; do
  need_file "usr/share/doc/thadd/$doc" "documentation: $doc" soft
done

head1 "optional package sets (what the tolerant installer did)"
# thadd-apt-safe logs every run to /var/log/thadd/apt-safe.log.  Reading it out of
# the image is the only way to answer "did the security/dev/forensics/browser
# sets actually install?" - and an earlier hook bug (only one of the six lists
# was staged) left five of them skipped while the build looked perfectly fine.
SETS_LOG="$(unsquashfs -cat "$SQ" usr/share/thadd/apt-safe-report.txt 2>/dev/null || true)"
[[ -n "$SETS_LOG" ]] || SETS_LOG="$(unsquashfs -cat "$SQ" var/log/thadd/apt-safe.log 2>/dev/null || true)"
EXPECTED_SETS=7
if [[ -z "$SETS_LOG" ]]; then
  warn "the installer left no report in the image — the optional sets never ran (or its log was trimmed)"
  # say what IS under the two places it should have written, so the next run does
  # not have to guess between "never ran" and "log trimmed away"
  for dir in usr/share/thadd var/log/thadd; do
    entries="$(awk -v d="squashfs-root/$dir/" 'index($0, d) { n++ } END { print n+0 }' "$SQ_LIST" 2>/dev/null || echo 0)"
    printf '  %s\n' "$dir holds ${entries:-0} entr(ies) in the image"
  done
else
  SETS_RUN="$(grep -c 'thadd-apt-safe: .* resolvable' <<<"$SETS_LOG" || true)"
  if (( SETS_RUN >= EXPECTED_SETS )); then
    pass "installer ran $SETS_RUN optional set(s)"
  elif (( SETS_RUN >= 4 )); then
    warn "installer ran only $SETS_RUN of $EXPECTED_SETS optional sets — some packages are missing"
  else
    fail "installer ran only ${SETS_RUN:-0} of $EXPECTED_SETS optional sets — the image is missing whole tool groups"
  fi
  while IFS= read -r line; do pass "$line"; done \
    < <(grep 'thadd-apt-safe: .* resolvable' <<<"$SETS_LOG" | sed 's/^ *//' | head -12)
  if grep -q 'batch install OK' <<<"$SETS_LOG"; then
    pass "at least one set installed in a single batch ($(grep -c 'batch install OK' <<<"$SETS_LOG") of $SETS_RUN)"
  fi
  if grep -q 'salvage' <<<"$SETS_LOG"; then
    warn "a set needed the per-package salvage path ($(grep -c 'salvage complete' <<<"$SETS_LOG") set(s))"
  fi
fi
SKIPPED="$(unsquashfs -cat "$SQ" var/log/thadd/apt-safe-skipped.txt 2>/dev/null || true)"
[[ -n "$SKIPPED" ]] || SKIPPED="$(sed -n 's/^not in any configured repo (skipped): //p' <<<"$SETS_LOG" | tr ' ' '\n' | grep -v '^$' || true)"
if [[ -n "$SKIPPED" ]]; then
  warn "$(grep -c . <<<"$SKIPPED") requested package(s) are not in this release's repos: $(tr '\n' ' ' <<<"$SKIPPED" | cut -c1-160)"
fi
FAILED_PKGS="$(unsquashfs -cat "$SQ" var/log/thadd/apt-safe-failed.txt 2>/dev/null || true)"
[[ -n "$FAILED_PKGS" ]] || FAILED_PKGS="$(sed -n 's/^ *✗ \([^ ]*\).*/\1/p' <<<"$SETS_LOG" || true)"
if [[ -n "$FAILED_PKGS" ]]; then
  warn "$(grep -c . <<<"$FAILED_PKGS") package(s) failed to install: $(tr '\n' ' ' <<<"$FAILED_PKGS" | cut -c1-160)"
fi

THIRD_PARTY="$(unsquashfs -cat "$SQ" usr/share/thadd/thirdparty-report.txt 2>/dev/null || true)"
if [[ -n "$THIRD_PARTY" ]]; then
  while IFS= read -r line; do
    case "$line" in
      *"=installed") pass "third-party: $(sed 's/^ *//' <<<"$line")" ;;
      *"=not-packaged") warn "third-party: $(sed 's/^ *//' <<<"$line") (not in Debian, not installed)" ;;
      *) [[ -n "${line// /}" ]] && warn "third-party: $(sed 's/^ *//' <<<"$line")" ;;
    esac
  done < <(grep -E '=' <<<"$THIRD_PARTY" || true)
else
  warn "no /usr/share/thadd/thirdparty-report.txt — the third-party tool step did not run"
fi

head1 "toolkit the user was promised"
# Soft by design: a live image must be able to degrade (a package may be pulled
# upstream between releases) - but the report should say exactly what is there.
need_any  "Metasploit (msfconsole/msfvenom)" soft usr/bin/msfconsole usr/bin/msfvenom
need_any  "impacket-scripts"              soft usr/bin/impacket-scripts usr/share/impacket
need_any  "CrackMapExec"                  soft usr/bin/crackmapexec usr/bin/cme
need_any  "bettercap"                     soft usr/bin/bettercap
need_any  "mitmproxy"                     soft usr/bin/mitmproxy usr/bin/mitmweb
need_file usr/bin/tshark                "Wireshark/tshark"            soft
need_any  "radare2 / rizin"               soft usr/bin/radare2 usr/bin/r2 usr/bin/rizin
need_any  "John the Ripper"               soft usr/bin/john usr/sbin/john
need_file usr/bin/nikto                  "nikto"                       soft
need_file usr/bin/whatweb                "whatweb"                     soft
need_file usr/bin/dirb                   "dirb"                        soft
need_file usr/bin/ghidra                 "Ghidra"                      soft
need_file usr/bin/hashcat               "hashcat"                     soft
need_file usr/bin/sqlmap                 "sqlmap"                      soft
need_file usr/bin/wfuzz                  "wfuzz"                       soft
need_file usr/bin/binwalk                "binwalk"                     soft
need_file usr/bin/fls                    "sleuthkit (fls)"             soft
need_file usr/bin/hydra                 "hydra"                       soft
need_file usr/bin/aircrack-ng           "aircrack-ng"                 soft
need_file usr/bin/gobuster              "gobuster"                    soft
need_file usr/bin/gdb                   "gdb"                         soft
need_file usr/bin/strace                "strace"                      soft
need_file usr/bin/tcpdump               "tcpdump"                     soft
need_file usr/bin/gcc                   "gcc (C toolchain)"           soft
need_file usr/bin/node                  "node"                        soft
need_file usr/bin/ffmpeg                "ffmpeg"                      soft
need_file usr/bin/nmap                  "nmap (security suite)"       soft
# these two are in the mandatory core list: if they are missing, the image is
# wrong, not degraded
need_file usr/bin/git                   "git"                         hard
need_file usr/bin/python3               "python3"                     hard
need_any  "PowerShell 7"                  soft opt/microsoft/powershell/7/pwsh usr/bin/pwsh
need_any  "VS Code"                       soft usr/bin/code usr/share/code/code
need_any  "Google Chrome"                 soft opt/google/chrome/chrome
need_any  "Microsoft Edge"                soft opt/microsoft/msedge/msedge
need_any  "Brave"                         soft usr/bin/brave-browser opt/brave.com/brave/brave-browser
need_file usr/bin/epiphany              "Epiphany browser"            soft
need_file usr/bin/qutebrowser           "qutebrowser"                 soft
need_file usr/bin/falkon                "Falkon browser"              soft
need_file usr/bin/w3m                   "w3m (text browser)"          soft
need_file usr/bin/lynx                  "lynx (text browser)"         soft
need_file usr/bin/torbrowser-launcher   "Tor Browser launcher"        soft
need_file usr/share/applications/firefox-esr.desktop "Firefox ESR"     soft

head1 "kernel + initramfs"
K="$(awk '{ for (i = 1; i <= NF; i++) { p = $i; sub(/^squashfs-root\//, "", p); if (p ~ /^boot\/firmware\/vmlinuz-/ || p ~ /^boot\/vmlinuz-/) { print p; exit } } }' "$SQ_LIST" 2>/dev/null || true)"
I="$(awk '{ for (i = 1; i <= NF; i++) { p = $i; sub(/^squashfs-root\//, "", p); if (p ~ /^boot\/firmware\/initrd/ || p ~ /^boot\/initrd/) { print p; exit } } }' "$SQ_LIST" 2>/dev/null || true)"
[[ -n "$K" ]] && pass "kernel present: $K" || warn "no vmlinuz inside the squashfs (it lives on the ISO instead)"
[[ -n "$I" ]] && pass "initramfs present: $I" || warn "no initrd inside the squashfs (it lives on the ISO instead)"

printf '\n%s═══ verification: %d failure(s), %d warning(s) ═══%s\n' "$C_A" "$FATAL" "$WARN" "$C_R"
if (( FATAL > 0 )); then
  printf '%s  RESULT: NOT SHIPPABLE%s\n' "$C_BAD" "$C_R"; exit 1
fi
printf '%s  RESULT: SHIPPABLE%s\n' "$C_OK" "$C_R"
exit 0
