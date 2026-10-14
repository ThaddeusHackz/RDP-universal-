<p align="center">
  <img src="cloud/web/logo.png" alt="THADD OS" width="132" />
</p>

<h1 align="center">THADD OS</h1>

<p align="center"><strong>One OS. All the Best.</strong><br/>
<em>A complete operating system — a bootable live ISO, a browser desktop, an RDP/cloud
workstation, a security lab, an AI operator and a forensics workbench — in one repository.</em></p>

<p align="center">
  <a href="https://github.com/ThaddeusHackz/THADD-OS---THE-REVERSE-ENGINEERED-OS-/actions/workflows/thadd-iso.yml"><img alt="THADD OS ISO" src="https://github.com/ThaddeusHackz/THADD-OS---THE-REVERSE-ENGINEERED-OS-/actions/workflows/thadd-iso.yml/badge.svg"></a>
  <a href="https://github.com/ThaddeusHackz/THADD-OS---THE-REVERSE-ENGINEERED-OS-/actions/workflows/thadd-os-ci.yml"><img alt="THADD OS CI" src="https://github.com/ThaddeusHackz/THADD-OS---THE-REVERSE-ENGINEERED-OS-/actions/workflows/thadd-os-ci.yml/badge.svg"></a>
  <a href="https://github.com/ThaddeusHackz/THADD-OS---THE-REVERSE-ENGINEERED-OS-/releases"><img alt="Download the ISO" src="https://img.shields.io/badge/download-.iso%20releases-3b82f6"></a>
  <img alt="Boot" src="https://img.shields.io/badge/boot-UEFI%20%2B%20BIOS%20%2F%20CSM-0ea5e9">
  <img alt="Base" src="https://img.shields.io/badge/base-Debian%2012%20%2B%20own%20userland-d70a53">
  <img alt="Desktop" src="https://img.shields.io/badge/desktop-Windows%2011%20%C3%97%20macOS%20Sequoia-8b5cf6">
  <img alt="Methods" src="https://img.shields.io/badge/RPC%20methods-105-22c55e">
</p>

---

## ⬇️ Get THADD OS

| Disc | What it is | Built by |
| --- | --- | --- |
| **`THADD-OS-1.0-x86_64.iso`** (78 MB) | The THADD live system: own boot chain, own userland, the THADD service (105 RPC methods), forensic engine, AI operator and the desktop shell. UEFI. | `thadd/boot/*` — pure Python, no xorriso/mtools/live-build |
| **`THADD-OS-<version>-aurora-amd64.iso`** (~2 GB) | The full Debian-live desktop: XFCE skinned as a Windows 11 × macOS Sequoia fusion, Firefox ESR + Chromium and the rest of the browser family, the dev toolchain, the Parrot/HTB-class security and forensics sets, plus the in-OS AI assistant and forensic scanner. **Hybrid BIOS + UEFI.** | `iso/build.sh` — live-build |

Both are attached to every [**Release**](https://github.com/ThaddeusHackz/THADD-OS---THE-REVERSE-ENGINEERED-OS-/releases)
by CI, which builds them from source on every run. The desktop image is larger than GitHub's 2 GiB
per-asset limit, so it ships as `*.part-00`, `*.part-01`, … plus a `parts.sha256` — rejoin it with:

```bash
cat THADD-OS-*-aurora-amd64.iso.part-* > thadd-os.iso
sha256sum -c parts.sha256
```

**Use `v1.4` or newer.** Earlier releases were published while `iso/verify.sh` was broken — the file
had lost its executable bit, CI skipped it, and the one run that did reach it had its verdict thrown
away by a `tee` pipeline. They are marked as pre-releases and say so on the release page.

### Boot it in VirtualBox

1. **New VM** → Type *Linux*, Version *Other Linux (64-bit)*, RAM **2 GB+**, disk: none needed (live).
2. **Settings → System → Motherboard → ✅ Enable EFI** — the from-scratch ISO is UEFI-only.
   *(The desktop ISO also boots on legacy BIOS/CSM, so you can leave EFI on either way.)*
3. **Settings → Storage** → attach the `.iso` to the optical drive.
4. Start. The THADD loader prints every step to the firmware console, then hands over to Linux.
5. Optional but recommended: **Settings → Network → Adapter 1 → Advanced → Port Forwarding**,
   add host `8080` → guest `8080`. The full GUI shell is then on **your** browser at
   <http://127.0.0.1:8080>.

Nothing on the discs writes to your disks unless you ask it to.

---

## 🎬 THADD OS in motion

<video src="docs/media/thadd-os-demo.mp4" controls muted playsinline width="100%"></video>

▶ **[`docs/media/thadd-os-demo.mp4`](docs/media/thadd-os-demo.mp4)** — 1280×720 H.264, 49 s, 1.2 MB,
31 scenes: boot splash → lock screen → desktop → launcher → AI operator → terminal →
PowerShell → files → editor → security centre → forensic lab → task manager → settings →
app store → snapshots → recorder → media → multi-window → VMs → productivity suite.

Every frame is rendered from the same code that draws the shell
(`thadd/server/video.py`), so the video, the gallery below and the ISO stay in sync:
`python3 -c "from thadd.server import video; video.render_demo()"`.

### Live desktop gallery — 31 snapshots

|  |  |  |
| --- | --- | --- |
| ![boot](docs/snapshots/01-boot-splash.png) | ![services](docs/snapshots/02-boot-services.png) | ![lock](docs/snapshots/03-lock-screen.png) |
| ![desktop](docs/snapshots/04-desktop.png) | ![launcher](docs/snapshots/05-launcher.png) | ![ai search](docs/snapshots/06-launcher-ai-search.png) |
| ![control centre](docs/snapshots/07-control-center.png) | ![notifications](docs/snapshots/08-notification-center.png) | ![ai chat](docs/snapshots/09-ai-agent-chat.png) |
| ![ai done](docs/snapshots/10-ai-agent-complete.png) | ![terminal](docs/snapshots/11-terminal-neofetch.png) | ![powershell](docs/snapshots/12-powershell.png) |
| ![files](docs/snapshots/13-files.png) | ![editor](docs/snapshots/14-code-editor.png) | ![security](docs/snapshots/15-security-center.png) |
| ![scan](docs/snapshots/16-security-scan-live.png) | ![forensics](docs/snapshots/17-forensics-lab.png) | ![dfir](docs/snapshots/18-dfir-cross-os.png) |
| ![taskmgr](docs/snapshots/19-task-manager.png) | ![monitor](docs/snapshots/20-system-monitor.png) | ![appearance](docs/snapshots/21-settings-appearance.png) |
| ![ai settings](docs/snapshots/22-settings-ai.png) | ![store](docs/snapshots/23-app-store.png) | ![installing](docs/snapshots/24-app-store-installing.png) |
| ![snapshots](docs/snapshots/25-snapshots.png) | ![recorder](docs/snapshots/26-screen-recorder.png) | ![media](docs/snapshots/27-media-player.png) |
| ![multi window](docs/snapshots/28-multi-window.png) | ![vms](docs/snapshots/29-vms-windows-macos.png) | ![productivity](docs/snapshots/30-productivity-suite.png) |

…and `docs/snapshots/31-endcard.png` closes the set. All 31 files are in
[`docs/snapshots/`](docs/snapshots) at 1600×900, PNG.

---

## 🧠 What is inside

```
                 ┌────────────────────────────── THADD OS ──────────────────────────────┐
  firmware ──▶   │  UEFI loader   →  Linux kernel  →  live userland  →  the OS services  │
                 │  \EFI\BOOT\      \boot\vmlinuz    own initramfs      thadd server     │
                 │  BOOTX64.EFI     \boot\initrd.img  (PID 1: /init)   desktop shell    │
                 └──────────────────────────────────────────────────────────────────────┘
```

| Layer | Where | What it does |
| --- | --- | --- |
| **Boot & ISO** | `thadd/boot/` | Freestanding PE32+ UEFI loader, FAT16 writer, newc cpio writer, rootfs stager, ISO 9660 + El Torito assembler. Pure Python + gcc. |
| **Service** | `thadd/server/` | HTTP + WebSocket core, `Registry`/`EventBus`/`Stream`, **105 RPC methods**, REST mirror, real PTYs, snapshots, settings. |
| **Desktop shell** | `thadd/shell/` | The GUI: menubar, dock, launcher (⌘K), windows, notifications, 38 apps. |
| **Security** | `thadd/forensics/` | Dependency-free read-only readers for **MBR/GPT, ext4, NTFS ($MFT, ADS, deleted records), HFS+, APFS, FAT/exFAT and Windows registry hives**, plus a triage engine that reverse-engineers an OS from a disk. |
| **AI operator** | `thadd/server/ai/` | Groq-backed agent with ~25 OS tools, approval gates, JSONL audit log, saved conversations — and a fully offline fallback assistant. |
| **Cloud / RDP** | `cloud/`, `desktop/`, `scripts/` | The other face of THADD OS: a Debian 12 + XFCE workstation in the cloud, reachable from any browser (noVNC) and from any RDP client on port 3389, with the web portal in `cloud/web/`. |
| **Desktop ISO** | `iso/` | live-build pipeline that turns the repo into a hybrid BIOS+UEFI Debian-live ISO with the XFCE fusion desktop and real browsers/tooling. |

**Terminals** bash · zsh · fish · PowerShell (`pwsh`) · python · node · sqlite
**Toolchain** gcc/g++, make, git, python3 + pip, node + npm, nano/vim, tar/xz/zip, openssl, curl
**In the live system** `thadd` (toolbox), `thadd-ai` (assistant), `thadd-status`, shells on `tty1`/`tty2` and the serial line
**Hidden gems** macOS-style ⌘K spotlight with AI search, Windows-style task manager and notification centre,
Linux power tools, `Ctrl+Alt+F2` break-glass shell, `sysrq` recovery, live forensic triage of any disk.

---

## 🔍 Verified before shipping

The repository does not trust the ISOs — it proves them, on every push:

| Check | Where |
| --- | --- |
| The loader runs against **two mock firmwares** and every handover check passes (protocol 2.15, `boot_params` ramdisk fields, `rdinit=/init`): one with a filesystem, one that exposes **only raw blocks** — in which case the loader parses ISO 9660 itself and pulls the kernel and initramfs off the disc **byte-identically** | `thadd/boot/tests/run_loader_test.py` |
| The staged userland **actually runs**: Python 3.11 in a chroot imports, Pillow renders text with DejaVu fonts | `thadd/boot/stage_rootfs.py` + `chroot` |
| The THADD service **boots inside that guest userland** — `/healthz`, `system.info`, 105 methods registered | `python3 -m thadd.server` |
| Every file extracted from the finished ISO is **hash-identical** to its source; the El Torito entry is spec-correct (platform `0xEF`, no-emulation, 4,152 sectors) | `thadd-iso.yml` → *Verify the disc* |
| The cloud OS is **logged into over a real RDP connection** and photographed | `thadd-os-ci.yml` |
| The forensic readers are fed images with known content — a nested directory, a multi-cluster file, a deleted entry, an MBR, a GPT — and must return the exact bytes, and 3 KB of random data and must answer "Unknown" | `thadd/forensics/tests/test_triage.py` |
| The gallery and the demo video still render on a clean machine — at the full design size **and** down-scaled, so no scene can overflow its own window | `thadd-tests.yml` |
| The desktop-ISO **build driver** runs against a stub live-build: the configuration in `iso/auto/config` is proven to reach `lb config`, and a wrong suite, a main-only archive area or a lost bootloader set is refused in seconds instead of after 45 minutes | `iso/tests/test_build_sh.py` |
| The **finished desktop ISO is read back**: ISO 9660 + hybrid MBR + El Torito (BIOS **and** EFI) boot records, the ISO layout file by file, the squashfs inventory, and the contents the OS promises — THADD identity, the XFCE/`picom`/LightDM stack, `thadd-shell-session`, the AI agent loop and its tool registry, the DFIR engine, `thadd-scan`, browsers, the security toolchain, and the verdict of the image's **own** self-test. `0 failure(s)` or the build is not published | `iso/verify.sh` → `docs/reports/desktop-iso-verify.md` |
| The image **tests itself from the inside** during the build (`42 passed · 0 failed` in the current release) and that verdict is read back out of the shipped squashfs | `desktop/thadd-desktop-selftest` → `/etc/thadd/selfcheck.txt` |
| The **optional package sets** report what they did, and the verification fails if fewer than four of the seven ran — the tolerant installer writes its report into the image precisely so "did the security/dev/forensics/browser tooling actually install?" is answerable, and packages Debian does not ship (Metasploit and PowerShell come from Rapid7's and Microsoft's own repositories; radare2 is not packaged for Debian 12) are named instead of quietly missing | `tools/bin/thadd-apt-safe`, `iso/config/hooks/normal/0450-thadd-thirdparty-tools.hook.chroot` |
| The verifier is tested in **both directions**: a broken ISO must be refused (and `build.sh` must die rather than publish it), and a healthy synthetic ISO must come back `RESULT: SHIPPABLE` | `iso/tests/test_build_sh.py` (56 checks) |

![THADD OS desktop, captured over a real RDP session inside CI](ci/thadd-os-screenshot.jpg)

*Not a mock-up: this is the running THADD OS desktop, screenshotted over an RDP login inside the CI
runner and pushed back into the repository by `thadd-os-ci.yml` on every boot test.*

The kernel and initramfs are kept on the ISO 9660 volume rather than in the El Torito boot image,
because that image's size is a 16-bit field in the boot catalog (32 MB ceiling). To make that safe on
firmwares that do **not** mount a CD's ISO 9660 volume, the loader reads the disc's blocks directly
with its own ISO 9660 parser — fallback order: any SimpleFileSystem volume first, then raw blocks.
Firmware 2 above is that exact scenario, tested on a real ISO built by the same code as the shipped one.

**Honest limits.** No hypervisor exists on the build host, so neither ISO has been *booted* here:
the from-scratch loader is proven against two mock firmwares (the handover contract, byte-identical
kernel/initramfs reads), and the desktop ISO is proven structurally — boot records, ISO layout,
squashfs contents, kernel and initramfs — plus by the image's own self-test running inside its
chroot during the build. Nothing in this repository claims an observed VirtualBox boot. The
Debian-live desktop ISO carries the heavyweight stack (browsers, the security and dev sets, office,
IDEs) because it installs them from apt during its build; that is also why it is ~2 GB and shipped
in parts. Packages that have vanished from a Debian release are logged and skipped by
`thadd-apt-safe` rather than failing the build — the verification report lists exactly which ones.

---

## 🛠 Build it yourself

```bash
# the from-scratch ISO (pure Python + gcc, no root, ~1 minute)
python3 thadd/boot/build_bootloaders.py                              # -> build/boot/BOOTX64.EFI
python3 thadd/boot/tests/run_loader_test.py                          # mock-firmware test
python3 thadd/boot/stage_rootfs.py build/live/rootfs                 # ~96 MB userland
python3 thadd/boot/mkinitramfs.py build/live/rootfs build/iso/boot/initrd.img.gz
python3 -m thadd.boot.assemble_iso                                   # -> build/iso/THADD-OS-1.0-x86_64.iso

# run the service + shell on this machine
python3 -m thadd.server --host 0.0.0.0 --port 8080 --shell thadd/shell

# the Debian-live desktop ISO (needs live-build/xorriso, ~20 min)
sudo apt-get install live-build debootstrap xorriso squashfs-tools mtools dosfstools rsync
sudo python3 iso/tests/test_build_sh.py                              # prove the driver first (~1 s)
sudo ./iso/build.sh                                                  # -> dist/THADD-OS-*.iso

# the media in this README
python3 -c "from thadd.server import video; video.render_demo()"     # gallery + MP4
python3 thadd/server/tests/test_render.py                            # ...and prove it renders
```

CI runs all of it on every push: [`thadd-iso.yml`](.github/workflows/thadd-iso.yml) builds and
publishes the live ISO, [`iso-build.yml`](.github/workflows/iso-build.yml) builds the desktop ISO,
[`thadd-os-ci.yml`](.github/workflows/thadd-os-ci.yml) boots the cloud OS and logs into it over RDP.

---

## 📂 Repository map

```
thadd/            the OS itself: boot/ (loader + ISO builders), server/ (105 methods, AI),
                  shell/ (desktop), forensics/ (disk readers + triage)
iso/              live-build pipeline for the Debian-live desktop ISO
cloud/            the cloud/RDP deployment: xrdp, XFCE skin, noVNC portal, Railway config
desktop/          the browser desktop shell used by the cloud portal
tools/            helper scripts, test suites, welcome screens
scripts/ci/       CI helpers (wait-health, RDP login, screenshot publishing)
docs/snapshots/   the 31 desktop snapshots above
docs/media/       the demo video
FORENSIC_SCAN.md  the forensic method, the CLI, the readers and the tests
                  (method reference: morluto/rea)
```

## License & credits

Built by **ThaddeusHackz**. THADD OS boots a Linux kernel built by
[gokrazy](https://github.com/gokrazy/kernel.amd64); the desktop ISO is assembled with
[Debian live-build](https://wiki.debian.org/DebianLive). Everything else — boot chain, userland
stager, ISO writer, service, shell, forensic engine, AI operator and the media in this README —
is written from scratch in this repository.
