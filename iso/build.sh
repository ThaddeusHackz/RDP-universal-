#!/usr/bin/env bash
# =============================================================================
#  THADD OS — ISO build driver
# =============================================================================
#  Turns the repository into a bootable, hybrid (BIOS + UEFI) live ISO that
#  runs identically in VirtualBox, VMware, QEMU/KVM and on bare metal.
#
#  Usage:
#      sudo ./iso/build.sh                    # full build -> dist/*.iso
#      sudo ./iso/build.sh --clean            # purge previous build tree
#      sudo ./iso/build.sh --profile desktop   # desktop | minimal
#
#  Requires (on the build host, NOT in this repo's sandbox):
#      apt-get install live-build debootstrap xorriso squashfs-tools \
#                      mtools dosfstools rsync
#
#  The same script is what .github/workflows/iso-build.yml runs on a clean
#  ubuntu runner — so a local build and a CI build produce the same artefact.
# =============================================================================
set -Eeuo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ISO_DIR="$REPO_ROOT/iso"
DIST_DIR="$REPO_ROOT/dist"
PROFILE="${THADD_PROFILE:-desktop}"
VERSION="${THADD_VERSION:-$(date -u +%Y.%m.%d)}"
CODENAME="$(sed -n 's/^THADD_CODENAME=//p' "$ISO_DIR/version.env" 2>/dev/null || true)"
CODENAME="${CODENAME:-aurora}"

C_RESET=$'\033[0m'; C_DIM=$'\033[2m'; C_ACC=$'\033[38;5;39m'
C_OK=$'\033[38;5;42m'; C_WARN=$'\033[38;5;214m'; C_ERR=$'\033[38;5;203m'

log()  { printf '%s[thadd-iso]%s %s\n' "$C_ACC" "$C_RESET" "$*"; }
ok()   { printf '%s  ✓%s %s\n' "$C_OK" "$C_RESET" "$*"; }
warn() { printf '%s  !%s %s\n' "$C_WARN" "$C_RESET" "$*"; }
die()  { printf '%s  ✗ %s%s\n' "$C_ERR" "$*" "$C_RESET" >&2; exit 1; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --clean)   rm -rf "$ISO_DIR/.build" "$ISO_DIR"/config/{binary,chroot,bootstrap,common,source} \
                      "$ISO_DIR"/*.iso "$ISO_DIR"/*.list 2>/dev/null || true
               ok "build tree purged"; shift ;;
    --profile) PROFILE="$2"; shift 2 ;;
    --no-install-deps) NO_DEPS=1; shift ;;
    -h|--help) sed -n '3,20p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) die "unknown option: $1" ;;
  esac
done

# ---------------------------------------------------------------------------
# 0. Preconditions
# ---------------------------------------------------------------------------
[[ "$(id -u)" == "0" ]] || die "run as root (live-build needs mount/chroot): sudo $0"
[[ "$(uname -m)" == "x86_64" ]] || die "ISO builds are amd64-only for now"

if [[ "${NO_DEPS:-0}" != "1" ]]; then
  missing=()
  for t in lb debootstrap xorriso mksquashfs rsync; do command -v "$t" >/dev/null || missing+=("$t"); done
  if (( ${#missing[@]} )); then
    log "installing build deps: ${missing[*]}"
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -qq
    apt-get install -y -qq live-build debootstrap xorriso squashfs-tools mtools dosfstools rsync \
      isolinux syslinux-common grub-efi-amd64-bin grub-pc-bin >/dev/null
  fi
  command -v lb >/dev/null || die "live-build not available"
fi

log "THADD OS ${VERSION} (${CODENAME}) · profile=${PROFILE} · $(nproc) cores"
mkdir -p "$DIST_DIR"

# ---------------------------------------------------------------------------
# 1. Assemble the chroot overlay (includes.chroot) from the repo.
#    live-build does not follow symlinks outside config/, so we COPY the real
#    source trees into the overlay. This is the step that makes the repo and
#    the shipped ISO the *same* artefact — no drift, no vendoring.
# ---------------------------------------------------------------------------
OVERLAY="$ISO_DIR/config/includes.chroot"
log "staging overlay -> $(realpath --relative-to="$REPO_ROOT" "$OVERLAY" 2>/dev/null || echo "$OVERLAY")"

stage() { # stage <src-relative-to-repo> <dest-in-image>
  local src="$REPO_ROOT/$1" dest="$OVERLAY/$2"
  [[ -e "$src" ]] || { warn "skip staging $1 (missing)"; return 0; }
  mkdir -p "$(dirname "$dest")"
  rm -rf "$dest"
  # node_modules, build logs and the test bundle must never reach the image
  rsync -a --exclude 'node_modules/' --exclude '__pycache__/' --exclude '*.pyc' \
        --exclude 'bundle.js' --exclude '*.log' --exclude '.git/' \
        --exclude 'package-lock.json' "$src" "$dest"
  ok "$1 -> /$2"
}

# THADD identity + tooling
stage os/etc      etc
stage os/usr/local usr/local          # thadd-shell-session + /bridge server
stage cloud/skel  etc/skel            # XFCE fallback profile (panel, dock, prompt)
stage ai       opt/thadd/ai
stage desktop  opt/thadd/desktop
stage security opt/thadd/security
stage tools    opt/thadd/tools
stage reverse-engineering opt/thadd/reverse-engineering

# Optional package sets (installed inside the chroot by thadd-apt-safe)
mkdir -p "$OVERLAY/opt/thadd/iso-packages"
cp -f "$ISO_DIR"/config/packages/*.txt "$OVERLAY/opt/thadd/iso-packages/" 2>/dev/null \
  && ok "package sets -> /opt/thadd/iso-packages ($(ls -1 "$OVERLAY/opt/thadd/iso-packages" | wc -l) lists)" \
  || warn "no package set lists found"

# The desktop profile ships the full hybrid theme + AI assistant; the minimal
# profile is a rescue/forensic image (~700 MB) with terminals only.
if [[ "$PROFILE" == "minimal" ]]; then
  rm -rf "$OVERLAY/opt/thadd/desktop/theme" 2>/dev/null || true
fi

# /etc/skel gets the hybrid desktop look for every new user
if [[ -d "$OVERLAY/opt/thadd/desktop/skel" ]]; then
  mkdir -p "$OVERLAY/etc/skel"
  cp -a "$OVERLAY/opt/thadd/desktop/skel/." "$OVERLAY/etc/skel/"
  ok "skel -> /etc/skel"
fi

# Build fingerprint: the ISO and the OS can always prove what they were built from
# (the directory has to exist before the redirect: with `set -e` a failed
#  redirect used to end the build here, before live-build ever started)
mkdir -p "$OVERLAY/etc/thadd"
{
  echo "THADD_OS_VERSION=${VERSION}"
  echo "THADD_OS_CODENAME=${CODENAME}"
  echo "THADD_OS_PROFILE=${PROFILE}"
  echo "THADD_OS_COMMIT=${GITHUB_SHA:-$(git -C "$REPO_ROOT" rev-parse HEAD 2>/dev/null || echo unknown)}"
  echo "THADD_OS_BUILT=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
} > "$OVERLAY/etc/thadd/build-info"

# ---------------------------------------------------------------------------
# 2. Configure + build
# ---------------------------------------------------------------------------
cd "$ISO_DIR"
export THADD_PROFILE="$PROFILE" THADD_VERSION="$VERSION"

# hooks must be executable — live-build runs .hook.chroot files directly
find "$ISO_DIR/config/hooks" -name '*.hook.chroot' -exec chmod 0755 {} + 2>/dev/null || true

log "lb config"
rm -rf config/binary config/chroot config/bootstrap config/common 2>/dev/null || true

# The suite and the mirrors are decided HERE, not only in config/auto/config:
# live-build 20230502 defaults to "bullseye" and does not always pick the auto
# script up, which is how this build spent an hour installing Debian 11 and then
# died on 404s.  The environment is the one input live-build always honours
# (command line > environment > defaults), and config/auto/config still wins
# when it does run - with the same values.
export LB_DISTRIBUTION="bookworm"
export LB_PARENT_DISTRIBUTION="bookworm"
export LB_ARCHITECTURE="amd64"
export LB_MIRROR_CHROOT="http://deb.debian.org/debian/"
export LB_MIRROR_CHROOT_SECURITY="http://security.debian.org/debian-security/"
export LB_MIRROR_BINARY="http://deb.debian.org/debian/"
export LB_MIRROR_BINARY_SECURITY="http://security.debian.org/debian-security/"
export LB_MIRROR_BOOTSTRAP="http://deb.debian.org/debian/"

lb config

# Refuse to spend an hour bootstrapping the wrong release.
if grep -rqs "bullseye" config/ 2>/dev/null; then
  echo "  ✗ live-build still wants bullseye:" >&2
  grep -rn "bullseye" config/ 2>/dev/null | head -5 >&2
  die "live-build configuration is for the wrong Debian release (expected bookworm)"
fi
ok "suite is bookworm (live-build 20230502's default is bullseye - it is pinned here)"

# ---------------------------------------------------------------------------
# 1b. Trust nothing: print the configuration live-build actually kept, and pin
#     the values that decide whether this is a bookworm image (a wrong suite or
#     an obsolete security mirror is what turns a build into 404s at the very
#     end, after an hour of work).
# ---------------------------------------------------------------------------
log "effective live-build configuration"
for f in config/bootstrap config/common config/binary; do
  [[ -f "$f" ]] || continue
  echo "  --- $f"
  grep -E '^LB_(DISTRIBUTION|PARENT_DISTRIBUTION|ARCHITECTURE|MIRROR_BOOTSTRAP|MIRROR_CHROOT|MIRROR_CHROOT_SECURITY|MIRROR_BINARY|MIRROR_BINARY_SECURITY|BINARY_IMAGE|DEBOOTSTRAP|BOOTLOADERS|INITSYSTEM)=' "$f" | sed 's/^/      /' || true
done

if [[ -f config/common ]]; then
  force() { # force <VAR> <value>   - in every config file that declares it
    local var="$1" val="$2" f
    for f in config/bootstrap config/common config/binary; do
      [[ -f "$f" ]] || continue
      if grep -q "^$var=" "$f"; then
        sed -i "s|^$var=.*|$var=\"$val\"|" "$f"
      fi
    done
    # bootstrap needs the distribution even when it did not set one
    if [[ "$var" == "LB_DISTRIBUTION" ]] && ! grep -q "^LB_DISTRIBUTION=" config/bootstrap 2>/dev/null; then
      echo "$var=\"$val\"" >> config/bootstrap
    fi
  }
  force LB_DISTRIBUTION "bookworm"
  force LB_PARENT_DISTRIBUTION "bookworm"
  force LB_MIRROR_CHROOT "http://deb.debian.org/debian/"
  force LB_MIRROR_CHROOT_SECURITY "http://security.debian.org/debian-security/"
  force LB_MIRROR_BINARY "http://deb.debian.org/debian/"
  force LB_MIRROR_BINARY_SECURITY "http://security.debian.org/debian-security/"
  ok "suite + mirrors pinned to bookworm (printed above, before the fix-up)"
  log "after the fix-up"
  for f in config/bootstrap config/common; do
    [[ -f "$f" ]] || continue
    echo "  --- $f"
    grep -E '^LB_(DISTRIBUTION|MIRROR_BOOTSTRAP|MIRROR_CHROOT_SECURITY)=' "$f" | sed 's/^/      /' || true
  done
else
  warn "no config/common after lb config - live-build printed its own diagnostics above"
fi

log "lb build  (this is the long one — 15-45 min depending on cores/disk)"
: > "$DIST_DIR/build.log"
if ! lb build 2>&1 | tee -a "$DIST_DIR/build.log"; then
  tail -n 60 "$DIST_DIR/build.log" >&2 || true
  die "lb build failed — full log: dist/build.log"
fi

# ---------------------------------------------------------------------------
# 3. Collect, checksum, publish-ready naming
# ---------------------------------------------------------------------------
ISO_SRC="$(ls -1 "$ISO_DIR"/*.hybrid.iso "$ISO_DIR"/*.iso 2>/dev/null | head -1 || true)"
[[ -f "$ISO_SRC" ]] || die "no ISO produced"

ISO_OUT="$DIST_DIR/THADD-OS-${VERSION}-${CODENAME}-amd64.iso"
mv -f "$ISO_SRC" "$ISO_OUT"
SIZE_MB=$(( $(stat -c%s "$ISO_OUT") / 1024 / 1024 ))
ok "ISO: $(basename "$ISO_OUT")  (${SIZE_MB} MiB)"

( cd "$DIST_DIR" && sha256sum "$(basename "$ISO_OUT")" > "$(basename "$ISO_OUT").sha256" )
ok "sha256 written"

# GitHub release assets are capped at 2 GiB — split so ANY build can ship.
if (( SIZE_MB > 1900 )); then
  log "splitting for release (>1900 MiB)"
  ( cd "$DIST_DIR" && split -b 1900M -d --suffix-length=2 "$(basename "$ISO_OUT")" "$(basename "$ISO_OUT").part-" \
    && ls -1 "$(basename "$ISO_OUT").part-"* | xargs sha256sum > parts.sha256 )
  ok "parts ready: $(ls -1 "$DIST_DIR"/*.part-* | wc -l)"
fi

cat > "$DIST_DIR/RELEASE-NOTES.md" <<EOF
## THADD OS ${VERSION} "${CODENAME}" — amd64 live/installable ISO

- Profile: \`${PROFILE}\`
- Size: ${SIZE_MB} MiB
- Boots: Legacy BIOS **and** UEFI (hybrid ISO) — VirtualBox, VMware, QEMU/KVM, bare metal
- Verify: \`sha256sum -c $(basename "$ISO_OUT").sha256\`

\`\`\`bash
# VirtualBox quick start
VBoxManage createvm --name "THADD OS" --ostype Debian_64 --register
VBoxManage modifyvm  "THADD OS" --memory 4096 --cpus 2 --vram 128 --graphicscontroller vmsvga --firmware efi
VBoxManage createhd    --filename "$HOME/THADD-OS/disk.vdi" --size 40960
VBoxManage storagectl  "THADD OS" --name "SATA" --add sata --controller IntelAhci --portcount 2
VBoxManage storageattach "THADD OS" --storagectl "SATA" --port 0 --device 0 --type hdd --medium "$HOME/THADD-OS/disk.vdi"
VBoxManage storageattach "THADD OS" --storagectl "SATA" --port 1 --device 0 --type dvddrive --medium "$PWD/$(basename "$ISO_OUT")"
VBoxManage startvm "THADD OS"
\`\`\`
EOF

printf '\n'
log "done — artefacts in dist/"
ls -lh "$DIST_DIR" | sed 's/^/    /'
