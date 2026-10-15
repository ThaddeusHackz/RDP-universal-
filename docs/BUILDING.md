# Building THADD OS and understanding CI

[README](../README.md) · [VM acceptance test](VM-TESTING.md)

## Debian-live desktop (primary download)

Use a disposable, **privileged amd64 Debian/Ubuntu machine**, root access, working Debian/vendor network access, and substantial free disk (plan at least 40–60 GB, more for caches and media). A normal restricted container may lack mounts/chroot even as root. Build duration and disk requirements vary with repositories and optional packages; package versions are not fully pinned, so identical source does not guarantee byte-identical output.

```bash
git clone https://github.com/ThaddeusHackz/THADD-OS---THE-REVERSE-ENGINEERED-OS-.git
cd THADD-OS---THE-REVERSE-ENGINEERED-OS-
git rev-parse HEAD  # record exact tested source, plus git diff if modified
sudo apt-get update
sudo apt-get install -y live-build debootstrap xorriso squashfs-tools mtools dosfstools rsync isolinux syslinux-common grub-efi-amd64-bin grub-pc-bin
sudo bash iso/build.sh --profile desktop
(cd dist && sha256sum -c THADD-OS-*.iso.sha256)
bash iso/verify.sh dist/THADD-OS-YYYY.MM.DD-aurora-amd64.iso
# Substitute the actual date from dist; keep the filename for the test record.
```

Outputs: `dist/*.iso`, basename-matching `.iso.sha256`, `build.log`, `verify.log`, release notes and (above 1900 MiB) numbered pieces + `parts.sha256`. Verify pieces **before joining**, then verify the whole ISO from the directory containing the sidecar. The release publication workflow has a whole-ISO upload step, but the current v1.6 asset inventory lacks the desktop sidecar: pipeline intent does not establish asset presence.

`THADD_VERSION` overrides the date-based build name; `iso/version.env` supplies codename `aurora`. Preserve `/etc/thadd/build-info`, source SHA and logs. Optional apt lists and vendor hooks are tolerant: read the resulting installer report. Do not claim every requested package was installed. Avoid `THADD_SKIP_VERIFY=1`; a bypassed build is not a verified release. The build's `--profile minimal` is **not** the distinct 78 MB custom UEFI image pipeline.

## Separate experimental minimal image

Follow [`.github/workflows/thadd-iso.yml`](../.github/workflows/thadd-iso.yml) for the authoritative dependency, kernel download and staging steps. The sequence uses `thadd/boot/build_bootloaders.py`, `stage_rootfs.py`, `mkinitramfs.py`, and `python3 -m thadd.boot.assemble_iso --no-initramfs` after their inputs are prepared. Run each script's `--help`; do not assume the Debian-live desktop packages or credentials apply. This path produces `THADD-OS-1.0-x86_64.iso`, uses the custom UEFI loader and must be tested separately.

## Local checks

```bash
python3 scripts/tests/test_documented_interfaces.py
python3 ai/test_ai.py
python3 thadd/forensics/tests/test_triage.py
python3 iso/tests/test_build_sh.py
python3 iso/tests/test_release_publish.py
python3 scripts/ci/tests/test_publish_file.py
bash tools/syntax-check.sh
```

Some build tests need root/dependencies. See [browser harness](../tools/tests/README.md) for Node/Playwright prerequisites and shell smoke/deep tests. Generated build/media outputs belong in ignored `build/` or `dist/`, not Git.

## What CI proves—and doesn't

- [`thadd-tests.yml`](../.github/workflows/thadd-tests.yml): Python compilation, AI and synthetic forensic checks, mock UEFI firmware, build/publication guards and **rendered** media tests. Rendered scenes are not boot recordings.
- [`iso-build.yml`](../.github/workflows/iso-build.yml): live-build desktop and `iso/verify.sh` inspection of boot records, menu parameters, squashfs contents and in-image self-checks. `RESULT: SHIPPABLE` is an artefact-inspection verdict, not demonstrated hardware compatibility.
- [`thadd-iso.yml`](../.github/workflows/thadd-iso.yml): separate minimal image assembly/structural verification.
- [`thadd-os-ci.yml`](../.github/workflows/thadd-os-ci.yml): Docker cloud workstation health, RDP/browser protocol and desktop login—not ISO firmware boot.

Reports under `docs/reports/` include their build SHA/date. The current `desktop-iso-verify.md` describes **2026.10.15** at `d383e3929c1c2477b4e92e9b38ae9914d003c2bc`, not a confirmed hash match to the v1.6 desktop dated 2026.10.14. Never transfer a verdict between images without matching hashes. CI result badges are not proof of “zero errors” or every application working. Run the real-VM checklist against the **exact** released or freshly built ISO to close that gap.
