#!/usr/bin/env bash
# =============================================================================
#  Publish the freshly built THADD OS ISO to a GitHub Release.
#  Assets >1900 MiB are split by iso/build.sh (GitHub's per-file cap is 2 GiB).
#  Safe to re-run: an existing release for the version gets its assets replaced.
# =============================================================================
set -Eeuo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DIST="$REPO_ROOT/dist"
REPO_SLUG="${GH_REPO:-ThaddeusHackz/RDP-universal-}"

VERSION="$(sed -n 's/^THADD_OS_VERSION=//p' "$REPO_ROOT/iso/config/includes.chroot/etc/thadd/build-info" 2>/dev/null | head -1 || true)"
: "${VERSION:=$(date -u +%Y.%m.%d)}"
CODENAME="$(sed -n 's/^THADD_OS_CODENAME=//p' "$REPO_ROOT/iso/config/includes.chroot/etc/thadd/build-info" 2>/dev/null | head -1 || true)"
: "${CODENAME:=aurora}"
TAG="v${VERSION}"

ISO="$(ls -1 "$DIST"/*.iso 2>/dev/null | head -1 || true)"
[[ -n "$ISO" ]] || { echo "✗ no ISO in dist/ — nothing to publish"; exit 1; }
ISO_NAME="$(basename "$ISO")"
SIZE_MB=$(( $(stat -c%s "$ISO") / 1024 / 1024 ))

echo "── publishing THADD OS ${VERSION} (${CODENAME}) ← ${ISO_NAME} (${SIZE_MB} MiB) ──"

# ---------- assemble release body -------------------------------------------
NOTES="$DIST/RELEASE-NOTES.md"
SHA="$(sha256sum "$ISO" | awk '{print $1}')"
cat > "$DIST/RELEASE-BODY.md" <<EOF
# 🧿 THADD OS ${VERSION} "${CODENAME}"

**One OS. Every capability.** Bootable amd64 live image — Legacy BIOS **and** UEFI.
Runs in VirtualBox, VMware, QEMU/KVM and on bare metal. Optional encrypted persistence.

| | |
|---|---|
| **ISO** | \`${ISO_NAME}\` |
| **Size** | ${SIZE_MB} MiB |
| **SHA-256** | \`${SHA}\` |
| **Base** | Debian 12 \`bookworm\` (live, reproducible from this repo) |
| **Desktop** | THADD Hybrid Shell — Windows 11 geometry × macOS Sequoia material |
| **Assistant** | THADD AI · Groq (bring your own key) + local tool-calling |
| **Security** | THADD Security Suite + Parrot/Kali toolbox (on demand) |
| **Reverse eng.** | REA (\`rea-agents\`) — binaries, Electron, .NET, websites |

## Verify before you boot

\`\`\`bash
sha256sum -c ${ISO_NAME}.sha256
\`\`\`

## VirtualBox (5 commands)

\`\`\`bash
VBoxManage createvm --name "THADD OS" --ostype Debian_64 --register
VBoxManage modifyvm  "THADD OS" --memory 4096 --cpus 2 --vram 128 --graphicscontroller vmsvga --firmware efi
VBoxManage createhd    --filename "\$HOME/THADD-OS/disk.vdi" --size 40960
VBoxManage storagectl  "THADD OS" --name SATA --add sata --controller IntelAhci --portcount 2
VBoxManage storageattach "THADD OS" --storagectl SATA --port 0 --device 0 --type hdd --medium "\$HOME/THADD-OS/disk.vdi"
VBoxManage storageattach "THADD OS" --storagectl SATA --port 1 --device 0 --type dvddrive --medium "${ISO_NAME}"
VBoxManage startvm "THADD OS"
\`\`\`

> First login: user **\`thadd\`**, password **\`thadd\`** — then immediately run
> \`thadd-passwd\`. sshd ships **disabled** on purpose: \`thadd-ssh on\` when you want it.

## What is inside

$(sed -n '1,80p' "$NOTES" 2>/dev/null || echo "See dist/RELEASE-NOTES.md in the build artefact.")

Full documentation, screenshots and the architecture map live in the
[repository README](https://github.com/${REPO_SLUG}#readme).
EOF

# ---------- collect assets ---------------------------------------------------
mapfile -t ASSETS < <(ls -1 "$DIST"/*.iso "$DIST"/*.sha256 "$DIST"/parts.sha256 "$DIST"/*.part-* 2>/dev/null || true)
printf '   assets: %d\n' "${#ASSETS[@]}"
for a in "${ASSETS[@]}"; do printf '     · %s (%s MiB)\n' "$(basename "$a")" "$(( $(stat -c%s "$a")/1024/1024 ))"; done

# ---------- create or refresh the release -----------------------------------
if gh release view "$TAG" --repo "$REPO_SLUG" >/dev/null 2>&1; then
  echo "   release $TAG exists — replacing assets"
  gh release delete-asset "$TAG" --repo "$REPO_SLUG" --yes \
     $(gh release view "$TAG" --repo "$REPO_SLUG" --json assets -q '.assets[].name' | tr '\n' ' ') >/dev/null 2>&1 || true
  gh release edit "$TAG" --repo "$REPO_SLUG" --title "THADD OS ${VERSION} \"${CODENAME}\"" --notes-file "$DIST/RELEASE-BODY.md" >/dev/null
else
  echo "   creating release $TAG"
  gh release create "$TAG" --repo "$REPO_SLUG" \
     --title "THADD OS ${VERSION} \"${CODENAME}\"" \
     --notes-file "$DIST/RELEASE-BODY.md" \
     --target "${GITHUB_SHA:-$(git -C "$REPO_ROOT" rev-parse HEAD)}" >/dev/null
fi

echo "   uploading ${#ASSETS[@]} asset(s) — this can take a few minutes for a multi-GB image"
gh release upload "$TAG" --repo "$REPO_SLUG" --clobber "${ASSETS[@]}"

gh release view "$TAG" --repo "$REPO_SLUG" --json url,tagName,assets \
  -q '"release: \(.url)\nassets: \(.assets|length)\n" + ([.assets[]|"  · \(.name)  \(.size/1048576|floor) MiB"]|join("\n"))'
echo "✓ published"
