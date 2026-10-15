# Real VM acceptance test and five-minute recording

[README](../README.md) · [download/VM setup](QUICKSTART.md) · [build](BUILDING.md)

## Status and blocker — 2026-10-15

**OUTSTANDING: real desktop ISO boot, approximately 300-second MP4, footage-derived GIF, durable hosted video link and completed acceptance results.** No video or GIF has been fabricated to satisfy this deliverable.

Environment probe found no `/dev/kvm`, `qemu-system-x86_64`, `VBoxManage`, `ffmpeg`, `Xvfb` or Docker. Missing KVM alone does not exclude QEMU software emulation, but no emulator is installed here and access to Debian package mirrors is unavailable. `gh release view` succeeded; `gh release download v1.6` failed at the blocked `release-assets.githubusercontent.com` redirect. Thus neither a released desktop image nor a build with Debian dependencies could be booted/recorded here. Available disk was about 20 GB; that is not a comfortable full build + capture workspace. Source tests are **not** substituted for a VM acceptance pass.

Existing `docs/media/thadd-os-demo.mp4` and generated snapshots are rendered illustrations; `ci/thadd-os-screenshot.jpg` is cloud/RDP evidence, not a released ISO boot.

## Prerequisites and image provenance

Use a capable x86_64 host, preferably a Linux X11 desktop for the supplied capture script. Install VirtualBox **or** QEMU/KVM with OVMF, plus ffmpeg (libx264), ffprobe and Python 3. Have sufficient free disk and 8 GB guest RAM if feasible. Download/verify/join the released desktop as documented, or build from the exact source commit under test.

Because this checkout fixes offline AI safety gates, prefer a **freshly built desktop ISO from this checkout's final commit** for file-write approval tests. A release capture may be useful too, but do not imply the fix is in v1.6. For older releases, restrict AI demonstration to harmless reads and mark write-gate tests skipped.

Record before the test:

| Field | Required value (fill in, do not guess) |
| --- | --- |
| ISO filename and byte count | Exact joined/built basename and size |
| SHA-256 | Full locally computed hash; separately say whether publisher sidecar verified |
| Source commit | Full SHA from image build-info/build logs; `UNKNOWN` if not established |
| Dirty source | Diff/patch used, if any; source-base SHA alone is insufficient |
| VM software | Actual VirtualBox/QEMU version |
| Firmware | EFI/OVMF (record firmware version/path) or BIOS if deliberately tested |
| Resources | RAM, CPUs, GPU/VRAM/3D, virtual disk size/type, NAT and guest display size |
| Host | OS, CPU, virtualization availability (no private identifiers) |

Do not infer a release commit merely from the mutable `targetCommitish: main` or from an unrelated verification report.

## Booting

The [VirtualBox guide](QUICKSTART.md#3-create-a-virtualbox-vm) specifies Debian 64-bit, unattended off, 4–8 GB RAM, 2 CPUs, 40 GB dynamic VDI, EFI, VMSVGA/128 MB, 3D off and NAT. Do not attach host raw disks. Select normal live boot (`live-amd64`, `boot=live`).

Alternative QEMU example on a capable Linux host (check your distribution's OVMF paths):

```bash
mkdir -p dist/qemu-test
qemu-img create -f qcow2 dist/qemu-test/disposable.qcow2 40G
cp /usr/share/OVMF/OVMF_VARS_4M.fd dist/qemu-test/OVMF_VARS.fd
qemu-system-x86_64 -enable-kvm -machine q35 -cpu host -smp 2 -m 8192 \
  -drive if=pflash,format=raw,readonly=on,file=/usr/share/OVMF/OVMF_CODE_4M.fd \
  -drive if=pflash,format=raw,file=dist/qemu-test/OVMF_VARS.fd \
  -drive file=dist/qemu-test/disposable.qcow2,format=qcow2 \
  -cdrom /absolute/path/THADD-OS-2026.10.14-aurora-amd64.iso \
  -boot menu=on -vga virtio -display gtk \
  -nic user,model=virtio-net-pci
```

For software emulation, replace `-enable-kvm -cpu host` with `-accel tcg -cpu max`; expect much slower boot, not necessarily a five-minute usable run. OVMF CODE/VARS must be a matching pair. Do not expose a remote management socket/VNC listener. This recipe is provided for external execution, **not run here**.

## Continuous recording procedure

1. Make one dry run privately to locate menus/terminal and check display size. Reboot for the recorded run. Record its limitations, not invented successes.
2. Set guest display to at least **1280×720**. On an X11 host, place its VM viewport in a clean capture region; verify no host notifications, terminals, private tabs or secrets overlap. `CAPTURE_INPUT=:0.0+X,Y` gives the top-left coordinates; `CAPTURE_SIZE` must match the real VM viewport, not crop useful text. Wayland users should use OBS/window capture or VirtualBox's own recording, then convert with ffmpeg.
3. Prepare the VM powered off, start the capture script in a terminal **outside the captured region**, then power on the VM immediately. The script captures the host pixels of that real VM continuously for 300 seconds; it does not boot a VM for you. If boot exceeds the first segment, keep recording and document the actual timing; never replace slow boot with rendered scenes.

```bash
DISPLAY=:0 CAPTURE_INPUT=:0.0+0,0 CAPTURE_SIZE=1280x720 \
  bash scripts/record-vm.sh /absolute/path/desktop.iso FULL_SHA_OR_UNKNOWN \
  'VirtualBox ACTUAL_VERSION; 8192 MB; 2 CPU; VMSVGA 128 MB; 3D off; 40 GB VDI; NAT' \
  EFI dist/real-vm-test
```

4. Use the timeline below. Keep terminal fonts legible. Show a section heading in the guest terminal (`printf '\n=== AI: OFFLINE ===\n'`) before each segment. Narration or captions can explain actions, but must not disguise skipped/failing tests. The script produces a silent continuous MP4; headings provide section labels.
5. Watch the whole MP4 after capture. The script checks duration (295–305 s), H.264/dimensions and full decoding, then generates a 12-second, 640-pixel-wide, 8-fps optimized GIF from second 60 onward. Review that this interval actually shows useful real footage; adjust the excerpt if needed. Check the GIF opens/loops. The capture script itself is syntax-checked only here, not end-to-end tested without an X11 VM host.

## Checklist and actual results

All VM results below are **NOT RUN** in this environment. Copy this table to a dated report, replacing each status with PASS / FAIL / SKIPPED and concrete observations, timestamps, sanitized log paths and exit codes. A fail is a finding, not something to hide.

| Target time | Action / evidence to capture | Current result |
| --- | --- | --- |
| 0:00–0:45 | Boot menu, selected live entry, actual boot/login; `thadd version`, `/etc/thadd/build-info` | NOT RUN |
| 0:45–1:30 | Menu, dock, move/resize windows, Settings, Thunar; distinguish native XFCE from custom shell | NOT RUN |
| 1:30–2:15 | `thadd doctor`, `free -h`, `df -h`, `nmcli device status`, `ip route`; launch Firefox/Chromium; authorized public page if connectivity allows; `git --version`, `python3 --version`, `gcc --version`, `node --version` (show missing tools) | NOT RUN |
| 2:15–3:15 | `thadd-ai doctor`, `selftest`; isolated no-key config; read/hash fixture; on fixed build only, deny then approve a harmless file operation with Confirm; show resulting file and sanitized audit entry | NOT RUN |
| 3:15–4:15 | `thadd security`, `thadd-toolbox --status`, `command -v nmap tshark binwalk fls rea`; `rea --identify/--report` against fixture; `thadd-scan --quick --summary` if time permits | NOT RUN |
| 4:15–5:00 | Check `/proc/cmdline`, `findmnt /`, `lsblk -f`, `command -v debian-installer-launcher calamares`; report installer absent/unverified; summarize actual passes/fails and persistence limitations | NOT RUN |

The fixture and isolated AI configuration procedure are in [AI.md](AI.md#disposable-demonstration). Do not show cloud mode unless a key is securely available off-camera. Do not print environment/settings files containing secrets. Never enable autopilot to speed up the recording. No third-party target scanning or operations on host disks/user data.

Persistence requires a separate, safe reboot test: create a marker on **disposable configured guest persistence storage**, reboot, check content and report the volume/parameters. Merely finding a label or setting up a VDI is not a persistence PASS. Do not repartition or install anything for the video; report no confirmed installer if that remains the finding.

**This is a representative acceptance test—not proof that every application, hardware combination, approval path or filesystem works.** If commands exceed their allotted segment, report them skipped or include extra separately labeled test logs; do not fabricate completion.

## Publication and GitHub presentation

Keep large MP4s in ignored `dist/` while reviewing. Upload the reviewed MP4 to a **GitHub Release asset** (durable repository-owned hosting, not a short-lived Actions artifact). For example, after choosing the correct release and confirming publication permission:

```bash
gh release upload RELEASE_TAG dist/real-vm-test/thadd-os-real-vm-5min.mp4
```

Do not overwrite unrelated release assets. Obtain the actual asset URL using `gh release view RELEASE_TAG --json assets`; do not paste a guessed link. Publish the sanitized checklist/provenance beside it. Copy the optimized GIF into `docs/media/` only after privacy/playback review and if reasonably small; otherwise host it as an asset too. Replace the README outstanding notice with a linked image using the **actual** full-video URL:

```markdown
[![Actual THADD OS VM acceptance preview](docs/media/thadd-os-real-vm-preview.gif)](ACTUAL_RELEASE_ASSET_URL)
```

This is a publication template, **not an existing link**. State release tag, host (GitHub Releases), duration/resolution, exact ISO/hash/source, test date, and remaining failures/skips. Markdown image + link works on GitHub without assuming arbitrary HTML video playback. Until upload and verification occur, the video/GIF remain outstanding.
