<p align="center"><img src="cloud/web/logo.png" alt="THADD OS logo" width="110"></p>

# THADD OS

**A Debian-based live desktop, experimental Linux live-image tooling, and a browser/cloud workstation project—not a new kernel.** THADD combines Linux and Debian userland with XFCE, a custom web desktop, Python OS services, an AI assistant and security/forensics utilities.

> **Start here:** [Download and join the desktop ISO](docs/QUICKSTART.md#1-download-the-desktop-image), then [try it safely in VirtualBox](docs/QUICKSTART.md#3-create-a-virtualbox-vm). Download **all three numbered parts from the same release**. They are pieces of **one** image, not bootable ISOs. Do not extract them or rename a part to `.iso`.
>
> **Evidence status (2026-10-15):** release metadata and source interfaces reviewed; no real desktop VM boot performed in this environment. The required five-minute real-VM video and new footage-derived GIF are **outstanding**, not replaced by the existing rendered demo. [Blocker, checklist and runnable recording procedure](docs/VM-TESTING.md).

<p align="center"><img src="docs/snapshots/04-desktop.png" alt="THADD OS desktop (rendered illustration)" width="85%"></p>
<p align="center"><em>Rendered illustration of the intended THADD OS desktop — not evidence of a real ISO boot.</em></p>

## Contents

- [What it is and how it looks](#what-it-is-and-how-it-looks)
- [Versions, architectures and downloads](#versions-architectures-and-downloads)
- [Quick install (3 parts)](#quick-install-3-parts)
- [Hardware and VM resources](#hardware-and-vm-resources)
- [Login and safe use](#login-and-safe-use)
- [Applications and availability](#applications-and-availability)
- [Command-line quick reference](#command-line-quick-reference)
- [AI setup and limitations](#ai-setup-and-limitations)
- [Live sessions, persistence and installation](#live-sessions-persistence-and-installation)
- [Screenshots, GIF and video](#screenshots-gif-and-video)
- [Troubleshooting and diagnostics](#troubleshooting-and-diagnostics)
- [Build and CI](#build-and-ci)
- [Licensing, credits and guides](#licensing-credits-and-guides)

## What it is and how it looks

There are distinct systems in this repository; screenshots or tests of one do not prove another works.

| Component | Implementation and role |
| --- | --- |
| **Full desktop ISO** | `iso/`: Debian 12 **bookworm**, Linux amd64, live-build, squashfs + live-boot overlay; hybrid BIOS/UEFI configuration (Secure Boot disabled). |
| **Native desktop** | Xorg, LightDM, XFCE/xfwm4, Thunar, Plank dock, picom compositor, Arc/Papirus themes. Windows 11/macOS-inspired styling is not Windows or macOS compatibility. |
| **Custom desktop** | `desktop/` bundled JavaScript shell plus `os/usr/local/bin/thadd-desktop-server` bridge; `thadd/shell/` is the Python-service-served shell. Web windows and app launchers do not establish native package availability. |
| **OS services** | `thadd/server/`: Python HTTP/WebSocket/RPC APIs, PTYs, settings, snapshots, AI tools. |
| **AI and forensics** | `thadd/server/ai/`, `thadd/forensics/`, `security/thadd-scan`, `reverse-engineering/rea`: local operations, triage and artefact reports. These are not guarantees of malware detection or complete filesystem support. |
| **Experimental minimal ISO** | `thadd/boot/`: custom UEFI loader and Python FAT/cpio/ISO construction around a Linux kernel and staged userland. Separate boot path, not a small edition of the Debian XFCE desktop. |
| **Cloud workstation** | `Dockerfile`, `cloud/`, `scripts/`: Debian/XFCE, RDP and browser/noVNC access. A container shares the host kernel; it does not test ISO firmware boot. |

The intended native layout is a top panel/application menu and bottom dock, with themed windows. The custom shell provides its own launcher, windows, settings and assistant. See the [desktop quick start](docs/QUICKSTART.md); runtime desktop integration remains to be tested in a real VM.

## Versions, architectures and downloads

[**Current release: v1.6 — THADD OS 1.6**](https://github.com/ThaddeusHackz/THADD-OS---THE-REVERSE-ENGINEERED-OS-/releases/tag/v1.6), checked 2026-10-15. Release tag, desktop build date and minimal-image version are different identifiers:

| Actual asset | Purpose / size |
| --- | --- |
| `THADD-OS-2026.10.14-aurora-amd64.iso.part-00` | Desktop part 1: 1,992,294,400 bytes |
| `THADD-OS-2026.10.14-aurora-amd64.iso.part-01` | Desktop part 2: 1,992,294,400 bytes |
| `THADD-OS-2026.10.14-aurora-amd64.iso.part-02` | Desktop part 3: 1,914,388,480 bytes |
| `parts.sha256` | Checksums of the desktop pieces |
| `RELEASE-NOTES.md` | Release attachment; read before booting |
| `THADD-OS-1.0-x86_64.iso` | **Separate minimal experimental ISO**, 77,848,576 bytes (about 78 MB); not the full desktop |
| `THADD-OS-1.0-x86_64.iso.sha256`, `manifest.json` | Minimal-image integrity/metadata; do not use its checksum for the desktop |

The reconstructed desktop filename is **`THADD-OS-2026.10.14-aurora-amd64.iso`**, 5,898,977,280 bytes (about 5.90 GB / 5.49 GiB), codename **aurora**. Only **amd64/x86_64** images are published; ARM/Apple Silicon native boot and 32-bit x86 are not supported by these assets. Source fallbacks may show `1.0` / `Nebula Prime`; use `/etc/thadd/build-info` and `thadd version` for the running image's identity.

**There is no desktop `.iso.sha256` attachment listed in v1.6.** Download it if the maintainer adds one; do not invent a checksum or borrow one from another build. The [download guide](docs/QUICKSTART.md) includes exact Windows CMD joining, native PowerShell hashing and Linux commands, storage requirements and separate whole-image verification. Release asset bytes could not be retrieved here because the redirected download host is blocked.

## Quick install (3 parts)

**TL;DR:** download the three `.part-*` files + `parts.sha256` from [v1.6](https://github.com/ThaddeusHackz/THADD-OS---THE-REVERSE-ENGINEERED-OS-/releases/tag/v1.6), verify them, join them into one ISO, then attach that ISO to a VirtualBox VM. Full beginner steps: [docs/QUICKSTART.md](docs/QUICKSTART.md).

### 1. Download (all from the same release)
```text
THADD-OS-2026.10.14-aurora-amd64.iso.part-00   (1,992,294,400 bytes)
THADD-OS-2026.10.14-aurora-amd64.iso.part-01   (1,992,294,400 bytes)
THADD-OS-2026.10.14-aurora-amd64.iso.part-02   (1,914,388,480 bytes)
parts.sha256
RELEASE-NOTES.md
```
Keep them in one folder. **Do not** mix releases, extract them, or rename a part to `.iso`.

### 2. Verify the pieces
```bash
sha256sum -c parts.sha256
```
Stop if anything fails.

### 3. Join the three parts (Linux/macOS)
```bash
cat THADD-OS-2026.10.14-aurora-amd64.iso.part-* > THADD-OS-2026.10.14-aurora-amd64.iso
stat -c %s THADD-OS-2026.10.14-aurora-amd64.iso
# Expected: 5898977280
```
Windows CMD:
```bat
copy /b "THADD-OS-2026.10.14-aurora-amd64.iso.part-00"+"THADD-OS-2026.10.14-aurora-amd64.iso.part-01"+"THADD-OS-2026.10.14-aurora-amd64.iso.part-02" "THADD-OS-2026.10.14-aurora-amd64.iso"
```

### 4. Create a VirtualBox VM and boot
- Linux → Debian (64-bit), skip unattended install, EFI on, Secure Boot off.
- 4 GB RAM (8 GB recommended), 2 vCPUs, 40 GB dynamic VDI.
- Display: VMSVGA, 128 MB VRAM, 3D off.
- Network: NAT.
- Storage: attach **`THADD-OS-2026.10.14-aurora-amd64.iso`** (the joined file), not a part.
- Boot the normal **Live** entry. Login (if asked): `thadd` / `thadd`, then run `passwd`.

### 5. After boot
```bash
thadd version
thadd doctor
thadd-ai doctor
```
Live sessions are not persistent by default — save work to a separate disk/shared folder.

---
## Hardware and VM resources

Conservative **initial test configuration**, not measured hardware minima: x86_64 CPU with VT-x/AMD-V for a responsive VM, **4 GB guest RAM minimum**, **8 GB recommended** if the host has sufficient spare memory, **2 vCPUs**, and a **40 GB dynamically allocated virtual disk**. Leave memory/CPU for the host. Budget at least **12 GB free just for desktop parts + joined ISO**, plus VM disk growth and recordings; FAT32 cannot hold the reconstructed file.

VirtualBox: **Linux → Debian (64-bit)**, skip unattended installation, EFI on, VMSVGA, 128 MB video RAM, **3D off initially**, NAT. Attach the **joined ISO**, not a numbered part. [Full beginner steps](docs/QUICKSTART.md#3-create-a-virtualbox-vm). Guest integration packages are optional; resizing/shared folders/3D are not universally verified. Physical GPU, Wi-Fi, firmware and laptop support need hardware-specific tests.

## Login and safe use

The desktop build source sets user **`thadd`**, public password **`thadd`**, with LightDM autologin (`0200-thadd-identity` and `0350-thadd-shell` hooks). This is **source-confirmed, not a login observed in a released VM here**. These credentials are not a claim about the experimental minimal or cloud images.

Immediately run **`passwd`** as `thadd` and choose a unique password privately. Autologin bypasses a login prompt; changing the password does not disable autologin. In a nonpersistent live session this change is lost on reboot. Never show the new password, API keys or private files in recordings.

Use NAT, avoid bridged networking and port forwarding initially, and do not expose RDP, VNC, SSH or web bridges to untrusted networks. Inspect actual listeners with `ss -lntup` and security status with `thadd security`; installed packages/configuration do not prove protections are active. Never scan third-party targets without permission. AI runs with your privileges; avoid root. See [security configuration and cautions](docs/SECURITY.md).

## Applications and availability

**Status vocabulary:** “core” means required by source package lists, not runtime-tested here; “optional” means attempted by tolerant hooks and may be skipped; “unavailable” requires a negative result for that build; “unverified” means no matching runtime evidence. There is no evidence for “every browser” or “all tools.”

| Category | Core/build-required | Optional / best effort / unverified for v1.6 runtime |
| --- | --- | --- |
| Desktop/apps | XFCE, Thunar, Mousepad, Evince, Ristretto, VLC, mpv, archive tools, NetworkManager | LibreOffice, GIMP, Blender, Calibre, Thunderbird, Remmina, qBittorrent, OBS |
| Browsers | **Firefox ESR, Chromium** | Epiphany, qutebrowser, Falkon, w3m/lynx/links2; Tor **launcher** is not a predownloaded Tor Browser; Chrome, Edge, Brave via vendor hook |
| Development | Git, Python 3, pip/venv, nano, vim-tiny | gcc/g++, make, clang, gdb, strace, Node/npm, Go, Rust, Java, Docker, VS Code (`code`), PowerShell (`pwsh`) |
| Terminals/shells | xfce4-terminal, Bash, tmux, screen | zsh, fish, alternate terminals, PowerShell; Python/Node REPLs are not terminal emulators |
| Security | THADD command sources staged | nmap, Wireshark/tshark, tcpdump, sqlmap, hydra, aircrack-ng, hashcat, John, mitmproxy, impacket; Metasploit via vendor hook; AppArmor/auditd/ufw/fail2ban also need runtime service checks |
| Forensics/RE | `rea`, THADD scanner and Python DFIR source staged | Sleuth Kit, binwalk, testdisk, YARA, exiftool, radare2/rizin/Ghidra/Volatility depend on package availability; not guaranteed installed |

[Required lists](iso/config/package-lists/), [optional package requests](iso/config/packages/) and [third-party hook](iso/config/hooks/normal/0450-thadd-thirdparty-tools.hook.chroot) are the source of intent. Opera/Vivaldi and proprietary IDA/Hopper are **not guaranteed supplied**; a name in an optional list does not make it available in Debian. Inspect the guest:

```bash
thadd-toolbox --status
cat /usr/share/thadd/apt-safe-report.txt
command -v firefox-esr chromium code pwsh msfconsole nmap wireshark rea
# Confirm a particular Debian package, not just a launcher:
dpkg-query -W -f='${Status}\n' firefox-esr
```

The [latest committed verification report](docs/reports/desktop-iso-verify.md) concerns a **2026.10.15** ISO at commit `d383e3929c1c2477b4e92e9b38ae9914d003c2bc`, **not necessarily the 2026.10.14 release image**. It verifies contents, not a real VM session. Missing software should be reported as missing/unavailable for the tested image, not silently advertised as installed.

## Command-line quick reference

Interfaces checked against current scripts/help. Commands below target the desktop guest; health checks on a generic checkout host are not OS acceptance tests.

```bash
thadd help
thadd version
thadd status
thadd doctor                 # advisory; a zero exit code is not an all-pass verdict
thadd security
thadd scan --summary         # delegates to thadd-scan
thadd-ai --help
thadd-ai doctor
thadd-ai selftest
thadd-ai tools
thadd-ai --autonomy readonly ask "list files in /tmp"
thadd-scan --help
thadd-scan --quick --summary  # running-system snapshot, not an antivirus guarantee
thadd-scan --quick --out /tmp/thadd-evidence
thadd-toolbox --list
thadd-toolbox --status
thadd-toolbox --dry-run dev   # inspect requests; does not install
# Optional, needs repositories/network/root and enough overlay storage:
# sudo thadd-toolbox dev
```

Harmless single-file analysis (never execute an unknown artefact):

```bash
case_dir=$(mktemp -d /tmp/thadd-case.XXXXXX)
printf 'Harmless THADD acceptance fixture\n' > "$case_dir/fixture.txt"
rea --identify "$case_dir/fixture.txt"
rea --strings "$case_dir/fixture.txt"
rea --report --out "$case_dir/report.md" "$case_dir/fixture.txt"
thadd rea --identify "$case_dir/fixture.txt"
# For an authorized disposable disk IMAGE, not your real host disk:
# thadd-scan --device /path/to/test.img
# thadd dfir /path/to/test.img
```

See [`rea` guide](reverse-engineering/README.md) and [forensic method](FORENSIC_SCAN.md). Scanner reports can contain usernames, listeners, paths and other sensitive evidence: review before publishing.

## AI setup and limitations

`thadd-ai` is a Python assistant with real filesystem, shell, package, service and desktop tools. **No key → deterministic offline helper**, not a bundled general-purpose local language model. It can list/read/hash/analyse files and gather system facts; cloud reasoning requires connectivity and an endpoint/model that is available to your account.

For Groq, enter a key privately in Settings → AI, or in Bash without placing the literal key in shell history:

```bash
read -rsp 'Groq API key: ' GROQ_API_KEY; echo
export GROQ_API_KEY
thadd-ai doctor
thadd-ai --autonomy readonly ask "Explain this system's memory usage"
unset GROQ_API_KEY
```

Do this **off camera**. Environment variables are not a secret vault. `unset` does not remove a key saved in settings. Do not use the `--key` flag on shared machines (process arguments may expose it). Cloud prompts/tool results may leave the machine.

Modes are `readonly`, `confirm` (default) and `autopilot`. Confirm prompts may offer `a` to switch to autopilot: **do not select it for the demonstration**. Approval gates/blocklists are not an OS sandbox; snapshots cover configured paths, not entire disks. Offline safety behavior in older releases must not be assumed identical to the current checkout. [Detailed setup, audit paths and safety limitations](docs/AI.md).

## Live sessions, persistence and installation

A normal live boot uses squashfs plus a temporary overlay: files, package installs, logs and password changes may disappear at shutdown. **Creating a VM disk alone does not make a live session persistent.** Save selected work to a deliberately mounted disposable disk/shared folder and verify it after reboot.

Source enables Debian live-boot persistence discovery with label **`THADD-PERSISTENCE`**. Persistence needs an appropriately prepared volume and `persistence.conf`; it is **not configured merely by downloading the ISO**, and runtime persistence has not been tested here. Do not repartition the host just to try the VM.

**No confirmed end-user installer:** `iso/auto/config` explicitly uses `--debian-installer none`; no working desktop installation path was established. Do not follow older instructions invoking `debian-installer-launcher` or promise a dedicated “Persistence” menu entry. Use a VM live session for evaluation. [Persistence/installation boundaries](docs/QUICKSTART.md#5-live-data-and-installation).

## Screenshots, GIF and video

### Demo video (rendered illustration)

The repository ships a **49-second rendered demo** (`docs/media/thadd-os-demo.mp4`). It is a programmatically generated illustration (`thadd/server/video.py`), **not** real VM footage and not acceptance evidence.

<p align="center">
  <video src="https://raw.githubusercontent.com/ThaddeusHackz/THADD-OS---THE-REVERSE-ENGINEERED-OS-/main/docs/media/thadd-os-demo.mp4" controls width="100%" poster="https://raw.githubusercontent.com/ThaddeusHackz/THADD-OS---THE-REVERSE-ENGINEERED-OS-/main/docs/snapshots/04-desktop.png">
    Your browser does not support inline video. <a href="docs/media/thadd-os-demo.mp4">Download the MP4</a>.
  </video>
</p>

<p align="center">
  <a href="docs/media/thadd-os-demo.mp4"><img src="docs/snapshots/04-desktop.png" width="640" alt="THADD OS demo thumbnail — click to open the full MP4"></a><br>
  <em>Click the thumbnail to open the full 49-second MP4.</em>
</p>

### OS screenshots

Representative screens from the rendered snapshot set (1600×900). These are illustrations of the intended desktop; they are not proof of a real ISO boot.

<p align="center">
<img src="docs/snapshots/04-desktop.png" width="49%" alt="Desktop" title="Desktop">
<img src="docs/snapshots/05-launcher.png" width="49%" alt="Application launcher" title="Application launcher">
<img src="docs/snapshots/09-ai-agent-chat.png" width="49%" alt="AI agent chat" title="AI agent chat">
<img src="docs/snapshots/11-terminal-neofetch.png" width="49%" alt="Terminal (neofetch)" title="Terminal (neofetch)">
<img src="docs/snapshots/15-security-center.png" width="49%" alt="Security center" title="Security center">
<img src="docs/snapshots/17-forensics-lab.png" width="49%" alt="Forensics lab" title="Forensics lab">
<img src="docs/snapshots/23-app-store.png" width="49%" alt="App store" title="App store">
<img src="docs/snapshots/28-multi-window.png" width="49%" alt="Multi-window" title="Multi-window">
</p>

<details>
<summary>Full snapshot gallery (31 images)</summary>

| Screenshot | Caption |
| --- | --- |
| ![Boot splash](docs/snapshots/01-boot-splash.png) | **Boot splash** |
| ![Boot services](docs/snapshots/02-boot-services.png) | **Boot services** |
| ![Lock screen](docs/snapshots/03-lock-screen.png) | **Lock screen** |
| ![Desktop](docs/snapshots/04-desktop.png) | **Desktop** |
| ![Application launcher](docs/snapshots/05-launcher.png) | **Application launcher** |
| ![Launcher AI search](docs/snapshots/06-launcher-ai-search.png) | **Launcher AI search** |
| ![Control center](docs/snapshots/07-control-center.png) | **Control center** |
| ![Notification center](docs/snapshots/08-notification-center.png) | **Notification center** |
| ![AI agent chat](docs/snapshots/09-ai-agent-chat.png) | **AI agent chat** |
| ![AI agent task complete](docs/snapshots/10-ai-agent-complete.png) | **AI agent task complete** |
| ![Terminal (neofetch)](docs/snapshots/11-terminal-neofetch.png) | **Terminal (neofetch)** |
| ![PowerShell](docs/snapshots/12-powershell.png) | **PowerShell** |
| ![Files](docs/snapshots/13-files.png) | **Files** |
| ![Code editor](docs/snapshots/14-code-editor.png) | **Code editor** |
| ![Security center](docs/snapshots/15-security-center.png) | **Security center** |
| ![Security scan (live)](docs/snapshots/16-security-scan-live.png) | **Security scan (live)** |
| ![Forensics lab](docs/snapshots/17-forensics-lab.png) | **Forensics lab** |
| ![DFIR cross-OS](docs/snapshots/18-dfir-cross-os.png) | **DFIR cross-OS** |
| ![Task manager](docs/snapshots/19-task-manager.png) | **Task manager** |
| ![System monitor](docs/snapshots/20-system-monitor.png) | **System monitor** |
| ![Settings — appearance](docs/snapshots/21-settings-appearance.png) | **Settings — appearance** |
| ![Settings — AI](docs/snapshots/22-settings-ai.png) | **Settings — AI** |
| ![App store](docs/snapshots/23-app-store.png) | **App store** |
| ![App store installing](docs/snapshots/24-app-store-installing.png) | **App store installing** |
| ![Snapshots](docs/snapshots/25-snapshots.png) | **Snapshots** |
| ![Screen recorder](docs/snapshots/26-screen-recorder.png) | **Screen recorder** |
| ![Media player](docs/snapshots/27-media-player.png) | **Media player** |
| ![Multi-window](docs/snapshots/28-multi-window.png) | **Multi-window** |
| ![VMs (Windows/macOS)](docs/snapshots/29-vms-windows-macos.png) | **VMs (Windows/macOS)** |
| ![Productivity suite](docs/snapshots/30-productivity-suite.png) | **Productivity suite** |
| ![End card](docs/snapshots/31-endcard.png) | **End card** |

</details>

[![Cloud XFCE/RDP desktop capture — not an ISO boot](ci/thadd-os-screenshot.jpg)](ci/thadd-os-screenshot.jpg)

Above: repository cloud/RDP CI screenshot, **not** evidence of a desktop ISO boot.

**Status:** the [snapshot gallery](docs/snapshots/) and the MP4 above are programmatically rendered illustrations. **New real-footage GIF: outstanding. Five-minute real-VM MP4: outstanding.** There is no uploaded full-video URL or hosting claim yet. Use the [recording procedure](docs/VM-TESTING.md) to capture actual VM output, validate duration/encoding, generate an optimized GIF, then publish the MP4 as a GitHub Release asset and embed the GIF as a linked image. A Markdown thumbnail/link works on GitHub. Do not label generated scenes as testing footage.

## Troubleshooting and diagnostics

| Symptom | Checks / safe next step |
| --- | --- |
| ISO won't attach/boot | Confirm all three parts, exact names/date, `parts.sha256`, joined size and optional whole-image checksum. Never attach `.part-00`. |
| EFI/boot issue | Check EFI enabled and Secure Boot disabled; use live menu entry `live-amd64` (normal **Live**, usually “Live system (amd64)”). Exact displayed wording depends on generated menu; inspect its kernel parameters for `boot=live`. |
| Black/slow graphics | VMSVGA, 128 MB VRAM, 3D off; try failsafe (`live-amd64-failsafe`) and inspect its parameters. Source failsafe includes `nox11`, so it may give a console rather than a desktop; it is not a verified `nomodeset` desktop mode. |
| No network | `nmcli device status`, `ip addr`, `ip route`, `resolvectl status` if present; NAT adapter enabled/cable connected. Restricted networks may block vendors/Groq. |
| Missing packages | `thadd-toolbox --status`, installer report, `/var/log/thadd/apt-safe.log`; inspect logs for skipped/unresolvable names. |
| Assistant doesn't reason | `thadd-ai doctor`, configured endpoint/model/key, connectivity; offline helper is intentionally limited. |
| Desktop/service problem | `thadd doctor`, `thadd-desktop-selftest`, `journalctl -b -p warning`, `systemctl --failed`, `free -h`, `df -h`, `ss -lntup`. |
| Lost work after reboot | Expected without tested persistence/external storage; a blank VDI is not automatic persistence. |

Known limitations: no real-VM/hardware acceptance run here, optional dependencies may be missing, graphics/guest integration unverified, no confirmed installer, no desktop whole-image hash asset in current release, source/report/release dates differ, minimal-image features must not be inferred from desktop packages. Checksums detect byte changes but do not authenticate a publisher without a trusted signed channel. Preserve exact ISO filename/hash/commit and sanitized logs when [reporting an issue](https://github.com/ThaddeusHackz/THADD-OS---THE-REVERSE-ENGINEERED-OS-/issues).

## Build and CI

See [build-from-source guide](docs/BUILDING.md). On a suitable privileged amd64 Debian/Ubuntu host with network access:

```bash
sudo bash iso/build.sh --profile desktop
(cd dist && sha256sum -c THADD-OS-*.iso.sha256)
```

The actual checksum command must run **inside `dist`** because sidecars contain basenames. Never set `THADD_SKIP_VERIFY=1` for a publishable image. CI/source tests, mocked firmware tests, squashfs inspection, browser tests and cloud RDP login are useful but **not a substitute for booting the released ISO**. [Real-VM checklist and results status](docs/VM-TESTING.md). [This review’s actual local test results](docs/reports/documentation-review-2026-10-15.md).

## Licensing, credits and guides

No top-level `LICENSE` file was found in this checkout. **Do not infer an MIT/GPL license for all project code**; obtain maintainer clarification before reuse/redistribution. Debian packages, Linux, firmware, browsers and vendor tools retain their individual licenses and redistribution/trademark restrictions; inspect `/usr/share/doc/<package>/copyright` and vendor terms. Shipping an optional vendor installer is not a grant of rights.

Upstream foundations include [Debian/live-build](https://live-team.pages.debian.net/live-manual/), [Linux](https://www.kernel.org/), [XFCE](https://xfce.org/), [Xorg](https://www.x.org/), LightDM, Plank, picom, Arc/Papirus, Python, noVNC/xrdp and the individual security/forensics tool authors. `rea` credits the method of [morluto/rea](https://github.com/morluto/rea); this is not a claim that upstream endorses THADD OS. AI cloud service: [Groq](https://groq.com/).

- [Download, Windows/Linux checksums, VirtualBox, login](docs/QUICKSTART.md)
- [AI configuration, permissions and audit limitations](docs/AI.md)
- [Security configuration](docs/SECURITY.md) — intended baseline; confirm runtime state
- [Forensic scanning](FORENSIC_SCAN.md) · [`rea`](reverse-engineering/README.md)
- [Builds and verification](docs/BUILDING.md) · [real VM recording/test procedure](docs/VM-TESTING.md)
- [CI workflows](.github/workflows/) · [verification reports](docs/reports/)
