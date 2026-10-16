<p align="center"><img src="cloud/web/logo.png" alt="THADD OS logo" width="110"></p>

# THADD OS

<p align="center">
  <a href="https://github.com/ThaddeusHackz/THADD-OS---THE-REVERSE-ENGINEERED-OS-/releases/tag/v1.6"><img src="https://img.shields.io/github/v/release/ThaddeusHackz/THADD-OS---THE-REVERSE-ENGINEERED-OS-?style=for-the-badge&color=blue" alt="Release"></a>
  <a href="https://github.com/ThaddeusHackz/THADD-OS---THE-REVERSE-ENGINEERED-OS-/stargazers"><img src="https://img.shields.io/github/stars/ThaddeusHackz/THADD-OS---THE-REVERSE-ENGINEERED-OS-?style=for-the-badge&color=yellow" alt="Stars"></a>
  <a href="https://github.com/ThaddeusHackz/THADD-OS---THE-REVERSE-ENGINEERED-OS-/forks"><img src="https://img.shields.io/github/forks/ThaddeusHackz/THADD-OS---THE-REVERSE-ENGINEERED-OS-?style=for-the-badge&color=green" alt="Forks"></a>
  <a href="https://github.com/ThaddeusHackz/THADD-OS---THE-REVERSE-ENGINEERED-OS-/issues"><img src="https://img.shields.io/github/issues/ThaddeusHackz/THADD-OS---THE-REVERSE-ENGINEERED-OS-?style=for-the-badge&color=red" alt="Issues"></a>
  <a href="https://github.com/ThaddeusHackz/THADD-OS---THE-REVERSE-ENGINEERED-OS-/commits/main"><img src="https://img.shields.io/github/last-commit/ThaddeusHackz/THADD-OS---THE-REVERSE-ENGINEERED-OS-?style=for-the-badge&color=purple" alt="Last commit"></a>
  <img src="https://img.shields.io/badge/platform-amd64%20%2F%20x86__64-lightgrey?style=for-the-badge" alt="Platform">
  <img src="https://img.shields.io/badge/base-Debian%2012%20bookworm-orange?style=for-the-badge" alt="Base">
</p>


**A Debian-based live desktop, experimental Linux live-image tooling, and a browser/cloud workstation project—not a new kernel.** THADD combines Linux and Debian userland with XFCE, a custom web desktop, Python OS services, an AI assistant and security/forensics utilities.

> **Start here:** [Download every desktop part and reconstruct the ISO in a separate folder](#windows-reconstruct-separate-folder), then [try it in VirtualBox](docs/QUICKSTART.md#3-create-a-virtualbox-vm). Download **every numbered part of this one desktop ISO from the same release**. The parts are pieces of one image, not bootable ISOs. Do not extract them, rename a part to `.iso`, or attach a numbered part or an old incomplete image.
>
> **Evidence status (2026-10-15):** release metadata and source interfaces reviewed; no real desktop VM boot performed in this environment. The required five-minute real-VM video and new footage-derived GIF are **outstanding**, not replaced by the existing rendered demo. [Blocker, checklist and runnable recording procedure](docs/VM-TESTING.md).

<p align="center"><img src="docs/snapshots/04-desktop.png" alt="THADD OS desktop (rendered illustration)" width="85%"></p>
<p align="center"><em>Rendered illustration of the intended THADD OS desktop — not evidence of a real ISO boot.</em></p>

## Contents

- [What it is and how it looks](#what-it-is-and-how-it-looks)
- [Why THADD OS?](#why-thadd-os)
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
- [Contributing](#contributing)
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

## Why THADD OS?

- 🐧 **Debian 12 live desktop** you can boot in VirtualBox in minutes (download 3 parts → join → boot).
- 🖥️ **XFCE desktop** with a custom web shell, dock, launcher and control center.
- 🤖 **Built-in AI assistant** (`thadd-ai`) with filesystem/shell tools and offline fallback.
- 🔐 **Security & forensics tooling** — scanner, `rea`, DFIR helpers, hardening checks.
- 🧪 **Experimental minimal ISO** (~78 MB) with a custom UEFI boot path.
- ☁️ **Cloud workstation** via Docker + noVNC/RDP.
- 📸 **31 rendered desktop snapshots** + a 49-second demo video in the repo.

## Versions, architectures and downloads

[**Current release: v1.6 — THADD OS 1.6**](https://github.com/ThaddeusHackz/THADD-OS---THE-REVERSE-ENGINEERED-OS-/releases/tag/v1.6). Asset **names and sizes** were rechecked on **2026-10-16** with the GitHub Releases API; the latest tag was still v1.6, with the same three desktop parts below. Release tag, desktop build date and minimal-image version are different identifiers. Do not combine filenames or checksums from another release with this table:

| Actual asset | Purpose / size |
| --- | --- |
| `THADD-OS-2026.10.14-aurora-amd64.iso.part-00` | Desktop part 1: 1,992,294,400 bytes |
| `THADD-OS-2026.10.14-aurora-amd64.iso.part-01` | Desktop part 2: 1,992,294,400 bytes |
| `THADD-OS-2026.10.14-aurora-amd64.iso.part-02` | Desktop part 3: 1,914,388,480 bytes |
| `parts.sha256` | Checksums of the desktop pieces |
| `RELEASE-NOTES.md` | Release attachment; read before booting |
| `THADD-OS-1.0-x86_64.iso` | **Separate minimal experimental ISO**, 77,848,576 bytes (about 78 MB); not the full desktop |
| `THADD-OS-1.0-x86_64.iso.sha256`, `manifest.json` | Minimal-image integrity/metadata; do not use its checksum for the desktop |

The reconstructed desktop filename is **`THADD-OS-2026.10.14-aurora-amd64.iso`**, 5,898,977,280 bytes (about 5.90 GB / 5.49 GiB), codename **aurora**. That size is the sum of the three part sizes above. Only **amd64/x86_64** images are published; ARM/Apple Silicon native boot and 32-bit x86 are not supported by these assets. Source fallbacks may show `1.0` / `Nebula Prime`; use `/etc/thadd/build-info` and `thadd version` for the running image's identity.

**There is no desktop `.iso.sha256` attachment in the v1.6 asset list** (rechecked 2026-10-16). Do not invent a checksum, borrow one from another release, or use `THADD-OS-1.0-x86_64.iso.sha256` / `manifest.json` for the desktop image. Windows reconstruction into a **separate output folder** is in [Quick install](#windows-reconstruct-separate-folder). [VirtualBox and Linux notes](docs/QUICKSTART.md) are not a second Windows join procedure: on Windows, do not use a shorter `copy /b` that writes the `.iso` into the parts folder. Release asset **bodies**, including the hash text inside `parts.sha256`, could not be retrieved here because the redirected download host is blocked. The byte sizes above are published asset sizes, not hashes computed in this environment.

## Quick install (3 parts)

**TL;DR:** From the [v1.6 release](https://github.com/ThaddeusHackz/THADD-OS---THE-REVERSE-ENGINEERED-OS-/releases/tag/v1.6), download **all three** desktop `.part-*` files and `parts.sha256` into one source folder. Check the names in **Command Prompt**, verify each part in **Windows PowerShell**, then join them in **Command Prompt** into a **different** output folder. Attach only that joined ISO. A correct size does not prove integrity, and it does not promise that the graphical desktop will boot.

**Before you download or join:**

- Download **every** numbered part for **one** desktop ISO from the **same** release. This section is only for the v1.6 assets named below. Do not mix in files from another tag.
- The parts are pieces of one image, not separate bootable ISOs.
- Do not extract them with archive software (7-Zip, WinRAR, Explorer **Extract all**, and similar). `copy /b` concatenates bytes; it does not unpack an archive.
- Do not rename one part to `.iso`.
- Keep the original parts until integrity checks and boot testing are complete. Joining only **reads** them. It does not rename, move, extract, or modify the parts.
- After the parts are already on disk, have at least **6 GB free** for the output, **in addition to** the storage those parts occupy. Allow extra headroom. The output file is 5,898,977,280 bytes.
- The output filesystem must support files larger than 4 GB. **NTFS and exFAT are suitable. FAT32 is not.**
- The Windows paths in this section are examples: `C:\Users\User\Desktop\THADDOS` and `C:\Users\User\Desktop\THADDOS-Joined`. If yours differ, substitute your paths in **every** command. Keep the output folder separate from the source folder.
- A changed file icon, or a Windows file association, does not itself prove that the file contents changed.
- Enable File Explorer's **File name extensions** option when checking filenames (Windows 11: **View → Show → File name extensions**; Windows 10: **View → File name extensions**).
- A correct byte size is necessary but does **not** prove integrity.
- Do not expect the GUI to boot merely because the joined size is correct.

> **Incomplete image and GRUB:** An incomplete or incorrectly joined image can cause GRUB to show `error: attempt to read or write outside of disk 'cd0'.` and `error: you need to load the kernel first.` Attaching a numbered part, omitting a part, or booting a partial download renamed to `.iso` can produce that kind of failure. An image of about 3 GB is not this desktop ISO. Those messages are **not** proof of the only possible cause, and reconstructing the ISO does **not** guarantee that every boot failure will be fixed.

The large split image is the Debian-live desktop. The separate **`THADD-OS-1.0-x86_64.iso`** (77,848,576 bytes, about 78 MB) is an experimental minimal ISO with a different boot path. It is already one file. It is **not** a fourth desktop part and **not** a small copy of the desktop. Do not join it to the parts, do not attach it when you meant to boot the desktop, and do not use its `.sha256` or `manifest.json` as the desktop checksum.

On Windows, use two shells for two different jobs. Do not mix the commands.

| Job | Shell | Do not use |
| --- | --- | --- |
| Check part names, join the three parts, and print the joined size | Command Prompt (`cmd.exe`) | PowerShell, Git Bash, WSL, or an archive tool |
| Compare SHA-256 hashes with `Get-FileHash` | Windows PowerShell | The `copy /b` window, or the experimental ISO's checksum |

### 1. Download (all from the same v1.6 release)

Open [v1.6](https://github.com/ThaddeusHackz/THADD-OS---THE-REVERSE-ENGINEERED-OS-/releases/tag/v1.6) and download these desktop files into one source folder, for example `C:\Users\User\Desktop\THADDOS`:

```text
THADD-OS-2026.10.14-aurora-amd64.iso.part-00   (1,992,294,400 bytes)
THADD-OS-2026.10.14-aurora-amd64.iso.part-01   (1,992,294,400 bytes)
THADD-OS-2026.10.14-aurora-amd64.iso.part-02   (1,914,388,480 bytes)
parts.sha256                                   (333 bytes — checksum list, not an ISO part)
RELEASE-NOTES.md
```

The release page also lists `THADD-OS-1.0-x86_64.iso`. Leave that experimental image out of this folder so it cannot be joined or attached by mistake. The website may round sizes; the checks below use exact bytes.

`part-02` is required even though it is smaller than the other two. `part-00` and `part-01` are the same size and are still different pieces. Do not omit `part-02`, and do not rename a different part to replace it. Wait until each browser download has finished. A name ending in `.crdownload` or `.partial`, or a copy with ` (1)` in the name, is not one of the three parts.

`parts.sha256` must be the file from this same v1.6 release. Its published size is 333 bytes. That length is only a sanity check that the small file finished downloading. It is not a hash of the parts. The hash text itself was not downloaded in this documentation environment, so this README does not reprint those hashes. Read them from the file you downloaded.

<a id="windows-reconstruct-separate-folder"></a>

### Windows Command Prompt: reconstruct into a separate folder

**Label: Command Prompt (`cmd.exe`) — names, joining, and the joined size. Not PowerShell.**

Leave this Command Prompt window open. After step 3, verify the parts in the PowerShell block below, then come back to this same window for steps 4-6. The three source parts are only read: they are not renamed, moved, extracted, or modified.

**1. Open Command Prompt (`cmd.exe`), not PowerShell.**

Start menu → type `cmd` → open **Command Prompt**. If Windows Terminal opens, the tab must say **Command Prompt**, not PowerShell or a Linux profile. A PowerShell window will not run the join command below correctly.

**2. Enter the source folder:**

```bat
cd /d "C:\Users\User\Desktop\THADDOS"
```

`/d` changes drive as well as folder. If your parts are somewhere else, substitute that folder here and in the later commands. The joined ISO must not be written into this folder.

**3. Check the original parts:**

```bat
dir /a:-d "THADD-OS-2026.10.14-aurora-amd64.iso.part-*"
```

All three exact filenames and expected sizes must be present:

- `THADD-OS-2026.10.14-aurora-amd64.iso.part-00` — 1,992,294,400 bytes
- `THADD-OS-2026.10.14-aurora-amd64.iso.part-01` — 1,992,294,400 bytes
- `THADD-OS-2026.10.14-aurora-amd64.iso.part-02` — 1,914,388,480 bytes

There must be three files, not two and not four. `dir` shows the real filename, including the extension. Thousands separators in the size column, if shown, do not change the number. Also enable File Explorer's **File name extensions** option so Explorer is not hiding `.txt`, `.crdownload`, or `.iso`.

Stop if a part is missing, incomplete, or incorrectly named — including `(1)`, `.partial`, `.crdownload`, or any extra name the pattern lists. Do not omit `part-02` because it is smaller. Do not rename a different part to replace it. The equal sizes of `part-00` and `part-01` do not make them interchangeable. Use the size in `dir`, or Properties → **Size**, not **Size on disk**. A disc icon, or any other icon, does not prove that the file contents are complete. A correct size is required before you continue, but it does not prove integrity. Do the PowerShell comparison next, before step 5.

**Windows PowerShell (`powershell.exe`) — verify each part before joining. Checksums only. This does not join the ISO.**

Do this after step 3 and before step 5. Open a second window: Start menu → **Windows PowerShell**. Do not close the Command Prompt window, and do not paste the `copy /b` line here. In PowerShell, `copy` is a different command and will not binary-join the parts.

If your source folder is not the example, substitute your path in every command. Each `Get-FileHash` reads the whole part and can take several minutes. That wait is normal.

```powershell
Get-Content -LiteralPath 'C:\Users\User\Desktop\THADDOS\parts.sha256'
Get-FileHash -Algorithm SHA256 -LiteralPath 'C:\Users\User\Desktop\THADDOS\THADD-OS-2026.10.14-aurora-amd64.iso.part-00'
Get-FileHash -Algorithm SHA256 -LiteralPath 'C:\Users\User\Desktop\THADDOS\THADD-OS-2026.10.14-aurora-amd64.iso.part-01'
Get-FileHash -Algorithm SHA256 -LiteralPath 'C:\Users\User\Desktop\THADDOS\THADD-OS-2026.10.14-aurora-amd64.iso.part-02'
```

Compare the **complete** hash against the **matching filename**. These letters are not the Command Prompt steps above:

- **a.** `Get-Content` prints `parts.sha256`. On each line, the hash is the 64-character hexadecimal value. The filename is the rest of that line after the hash and any spaces or `*` that follow it. Read those hashes from **your** v1.6 download. Do not copy a hash from another release, from this README, or from the experimental ISO.
- **b.** Each `Get-FileHash` result has a `Hash` of 64 hexadecimal characters and a `Path`. `Get-FileHash` usually prints uppercase letters. A `parts.sha256` line may use lowercase. Letter case does not matter.
- **c.** For `part-00`, find the checksum line whose filename is exactly `THADD-OS-2026.10.14-aurora-amd64.iso.part-00`. Compare **all 64** hash characters on that line with the `Hash` from the `Get-FileHash` command for that same file. A matching prefix or suffix is not enough. Finding the same hash on a different line is not a match.
- **d.** Repeat for `part-01`, and then for `part-02`, each against its own line. Do not compare one part's hash to another part's line.
- **e.** Stop if a part is missing, a line is missing, the filename does not match, or any complete hash differs. Re-download only the failing file from **v1.6**. Do not omit `part-02`. Do not rename a different part to replace it. Do not continue to `copy /b`.

Do not compare any desktop part to `THADD-OS-1.0-x86_64.iso.sha256`. That checksum belongs only to the separate experimental ISO.

**Back in Command Prompt (`cmd.exe`), not PowerShell.**

**4. Create the separate output folder** (the same Command Prompt window from steps 1-3):

```bat
mkdir "C:\Users\User\Desktop\THADDOS-Joined"
```

An existing directory is okay. If Command Prompt reports that the folder already exists, it has not deleted that folder; continue only if you intend to use it. An existing output ISO should not be overwritten accidentally. If that folder already contains `THADD-OS-2026.10.14-aurora-amd64.iso`, do not reuse that path. Create a new empty folder, for example `C:\Users\User\Desktop\THADDOS-Joined-2`, and use the new path in the `copy` destination, the size check, and VirtualBox. If `copy` asks to overwrite the ISO, choose **N**, then use a new empty output folder and update the destination path accordingly.

These Windows paths are examples. If you substitute your own, change every later path to match, and do not make the output folder the same folder as the parts. The drive that holds the output needs at least 6 GB free **in addition to** the space the parts already occupy; allow extra headroom. In File Explorer, right-click that drive → **Properties** and confirm the file system is **NTFS** or **exFAT**. FAT32 cannot store this ISO. If the copy fails, or the size check in step 6 is short, do not attach the result.

**5. Join the parts with this one-line command.** Run it in the Command Prompt window that is still in the source folder from step 2. The three source names are relative; the destination is a full path. Do not insert a line break. Do not remove `/b` or the quotes. Do not drop `part-02`. Do not add the experimental ISO. Do not paste this line into PowerShell.

```bat
copy /b "THADD-OS-2026.10.14-aurora-amd64.iso.part-00"+"THADD-OS-2026.10.14-aurora-amd64.iso.part-01"+"THADD-OS-2026.10.14-aurora-amd64.iso.part-02" "C:\Users\User\Desktop\THADDOS-Joined\THADD-OS-2026.10.14-aurora-amd64.iso"
```

The three source parts are only read: they are not renamed, moved, extracted, or modified. After this command they should still be in `C:\Users\User\Desktop\THADDOS` with the same sizes. Keep them there until integrity checks and boot testing are complete. The new file is written only under `C:\Users\User\Desktop\THADDOS-Joined`. Do not point the destination at an old incomplete image. If the copy is interrupted, do not attach the partial output. Use a new empty output folder, update the destination path, and run this one-line command again. Do not delete or rename the original parts.

**6. Check the reconstructed size in interactive Command Prompt:**

```bat
for %I in ("C:\Users\User\Desktop\THADDOS-Joined\THADD-OS-2026.10.14-aurora-amd64.iso") do @echo %~zI bytes
```

Expected output:

```text
5898977280 bytes
```

That is 5,898,977,280 bytes, the sum of the three part sizes. This uses `%I` in interactive CMD. Type `%I` exactly once, as shown. A saved `.bat` file requires `%%I` instead (including `%%~zI`); do not double the percent signs in the open Command Prompt window. Do not run this `for` line in PowerShell. Explorer → Properties → **Size** for that output file should also show 5,898,977,280 bytes, not a rounded gigabyte figure and not **Size on disk**.

If the number differs, stop. Do not attach the output. Do not try to repair the size by renaming a part or by copying the output back over a part. A matching size is necessary but does not prove integrity. It also does not prove that the GUI will boot. The output may show a disc icon because the name ends in `.iso`. That icon, or any file association, does not itself prove that the contents changed or that the file is a complete bootable image.

**Windows PowerShell (`powershell.exe`) — whole reconstructed ISO, only if a publisher checksum exists. Not Command Prompt, and not the join step.**

Part hashes do not check the joined file. Verify the reconstructed ISO separately against its matching publisher checksum **if one is available**.

Rechecked on 2026-10-16, v1.6 does **not** list `THADD-OS-2026.10.14-aurora-amd64.iso.sha256` or any other desktop whole-image checksum. Do not invent one. Do not substitute `THADD-OS-1.0-x86_64.iso.sha256`, `manifest.json`, a hash from another release, or a hash printed for a different build date. Until a matching publisher checksum exists, this check is **unavailable**. You may keep a `Get-FileHash` printout of the joined file with your own notes; that self-computed value is not a publisher verification. Do not run the commands below unless you actually have that desktop sidecar from the same release. It is not in the v1.6 asset list checked for this README.

If the maintainer adds a sidecar whose filename matches the desktop ISO, compare the complete hash in PowerShell:

```powershell
Get-Content -LiteralPath 'C:\Users\User\Desktop\THADDOS\THADD-OS-2026.10.14-aurora-amd64.iso.sha256'
Get-FileHash -Algorithm SHA256 -LiteralPath 'C:\Users\User\Desktop\THADDOS-Joined\THADD-OS-2026.10.14-aurora-amd64.iso'
```

The sidecar line must name `THADD-OS-2026.10.14-aurora-amd64.iso`, not a `.part-*` file and not `THADD-OS-1.0-x86_64.iso`. All 64 hexadecimal characters must match. Letter case does not matter. Substitute your paths if you did not use the examples. A failed or missing whole-image check is not fixed by renaming the file or by reusing the experimental ISO's checksum.

**7. In VirtualBox, power off the VM and replace the old optical-drive attachment** with:

```text
C:\Users\User\Desktop\THADDOS-Joined\THADD-OS-2026.10.14-aurora-amd64.iso
```

Power off fully (not Save State) so the previous disc file is not locked. Then Settings → Storage → the optical drive → choose that joined file. If your paths differ from these examples, select the joined ISO in **your** output folder. Never attach a numbered part. Never attach the old incomplete image, including one that was about 3 GB, a file still named `.part-00`, `.part-01`, or `.part-02`, or an earlier `.iso` left in the source folder.

Replacing the attachment can address a boot failure caused by an incomplete or incorrectly joined image, including the GRUB `cd0` and `you need to load the kernel first` messages above. It is not the only possible cause of those messages. A successful join does not guarantee that every boot failure will be fixed, or that the graphical desktop will appear.

**First-time VM, if you do not already have one:**

- Linux → Debian (64-bit), skip unattended install, EFI on, Secure Boot off.
- 4 GB RAM (8 GB recommended), 2 vCPUs, 40 GB dynamic VDI.
- Display: VMSVGA, 128 MB VRAM, 3D off.
- Network: NAT.
- Storage: attach `C:\Users\User\Desktop\THADDOS-Joined\THADD-OS-2026.10.14-aurora-amd64.iso`, not a part and not an old incomplete image.
- Boot the normal **Live** entry. Login, if asked, is the source-configured `thadd` / `thadd` — then run `passwd`. See [Login and safe use](#login-and-safe-use).

More VirtualBox clicks are in [docs/QUICKSTART.md](docs/QUICKSTART.md#3-create-a-virtualbox-vm). On Windows, still use the separate-folder `copy /b` in this README. Do not use a shorter `copy /b` that writes `THADD-OS-2026.10.14-aurora-amd64.iso` into the folder you are already in, including the shorter example in that quick-start page. That form can mix the result with the parts or overwrite an incomplete image.

**Not executed on Windows here:** the Command Prompt and PowerShell examples were checked for filenames, order, sizes, quoting, and output paths against the v1.6 asset list. They were not run on Windows in this environment, and the release file bodies were not re-downloaded here.

### Linux: verify, then join into a separate directory

This is not the Windows procedure. Do not type it into Command Prompt or PowerShell. From the directory that contains the three parts and `parts.sha256`:

```bash
sha256sum -c parts.sha256 && \
mkdir -p "$HOME/THADDOS-Joined" && \
cat \
  THADD-OS-2026.10.14-aurora-amd64.iso.part-00 \
  THADD-OS-2026.10.14-aurora-amd64.iso.part-01 \
  THADD-OS-2026.10.14-aurora-amd64.iso.part-02 \
  > "$HOME/THADDOS-Joined/THADD-OS-2026.10.14-aurora-amd64.iso" && \
stat -c %s "$HOME/THADDOS-Joined/THADD-OS-2026.10.14-aurora-amd64.iso"
# Expected: 5898977280
```

`&&` stops the rest of the command if a checksum fails, so a bad part is not joined. The `cat` order is `part-00`, then `part-01`, then `part-02`. It only reads the parts; it does not rename or delete them. `>` replaces an existing file at that output path without asking — use a new directory if you need to keep an older ISO. On macOS, print the size with `stat -f %z` on that same output path instead of `stat -c`. There is still no v1.6 desktop whole-image sidecar to check. Do not use the experimental ISO's checksum in its place. The `cat` order and the `&&` stop-on-failure behavior were checked here only with tiny synthetic files, not with the v1.6 release image.

### After boot

```bash
thadd version
thadd doctor
thadd-ai doctor
```

Live sessions are not persistent by default — save work to a separate disk/shared folder. Reaching a boot menu, or having a joined file of the expected size, is not a promise that the graphical desktop will appear.

---
## Hardware and VM resources

Conservative **initial test configuration**, not measured hardware minima: x86_64 CPU with VT-x/AMD-V for a responsive VM, **4 GB guest RAM minimum**, **8 GB recommended** if the host has sufficient spare memory, **2 vCPUs**, and a **40 GB dynamically allocated virtual disk**. Leave memory/CPU for the host. After the parts are downloaded, keep at least **6 GB free for the joined output in addition to the space those parts already occupy**, with extra headroom (about **12 GB** combined for parts plus ISO, before VM disk growth and recordings). The output filesystem must allow files over 4 GB: NTFS and exFAT are suitable; FAT32 is not.

VirtualBox: **Linux → Debian (64-bit)**, skip unattended installation, EFI on, VMSVGA, 128 MB video RAM, **3D off initially**, NAT. Power off the VM before changing media. Attach the **joined ISO from the separate output folder**, never a numbered part and never an old incomplete image. Windows reconstruction: [Quick install](#windows-reconstruct-separate-folder). Other VM clicks: [QUICKSTART](docs/QUICKSTART.md#3-create-a-virtualbox-vm). Guest integration packages are optional; resizing/shared folders/3D are not universally verified. Physical GPU, Wi-Fi, firmware and laptop support need hardware-specific tests.

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

**Status:** the [snapshot gallery](docs/snapshots/) and the MP4 above are programmatically rendered illustrations. **New real-footage GIF: outstanding. Five-minute real-VM MP4: outstanding.** There is no uploaded full-video URL or hosting claim yet. Use the [recording procedure](docs/VM-TESTING.md) to capture actual VM output, validate duration/encoding, generate an optimized GIF, then publish the MP4 as a GitHub Release asset and embed the GIF as a linked image. A Markdown thumbnail/link works on GitHub. Do not label generated scenes as testing footage.

## Troubleshooting and diagnostics

| Symptom | Checks / safe next step |
| --- | --- |
| ISO won't attach/boot | Confirm all three v1.6 parts, exact names, `parts.sha256`, and joined size `5898977280` in the separate output folder. Never attach a numbered part or an old incomplete image. |
| GRUB: `attempt to read or write outside of disk 'cd0'` and/or `you need to load the kernel first` | An incomplete or incorrectly joined image can cause this. It is not the only possible cause, and reconstructing the ISO does not guarantee every boot failure will be fixed. Power off the VM and attach only the joined file in the separate output folder (example: `C:\Users\User\Desktop\THADDOS-Joined\THADD-OS-2026.10.14-aurora-amd64.iso`). A correct size does not prove integrity or that the GUI will boot. |
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

## Contributing

Contributions, bug reports and VM test results are welcome. Please:
- Keep claims evidence-based — label anything not actually booted/tested as unverified.
- Preserve exact ISO filename/hash/commit and sanitized logs when [reporting an issue](https://github.com/ThaddeusHackz/THADD-OS---THE-REVERSE-ENGINEERED-OS-/issues).
- Do not commit build output (`build/`, `dist/`, `out/`, `iso/chroot/`).

If this project helped you, please ⭐ **star the repo** — it helps others discover it.

## Licensing, credits and guides

No top-level `LICENSE` file was found in this checkout. **Do not infer an MIT/GPL license for all project code**; obtain maintainer clarification before reuse/redistribution. Debian packages, Linux, firmware, browsers and vendor tools retain their individual licenses and redistribution/trademark restrictions; inspect `/usr/share/doc/<package>/copyright` and vendor terms. Shipping an optional vendor installer is not a grant of rights.

Upstream foundations include [Debian/live-build](https://live-team.pages.debian.net/live-manual/), [Linux](https://www.kernel.org/), [XFCE](https://xfce.org/), [Xorg](https://www.x.org/), LightDM, Plank, picom, Arc/Papirus, Python, noVNC/xrdp and the individual security/forensics tool authors. `rea` credits the method of [morluto/rea](https://github.com/morluto/rea); this is not a claim that upstream endorses THADD OS. AI cloud service: [Groq](https://groq.com/).

- [Windows: reconstruct the desktop ISO in a separate folder](#windows-reconstruct-separate-folder) · [VirtualBox, login, and Linux notes](docs/QUICKSTART.md)
- [AI configuration, permissions and audit limitations](docs/AI.md)
- [Security configuration](docs/SECURITY.md) — intended baseline; confirm runtime state
- [Forensic scanning](FORENSIC_SCAN.md) · [`rea`](reverse-engineering/README.md)
- [Builds and verification](docs/BUILDING.md) · [real VM recording/test procedure](docs/VM-TESTING.md)
- [CI workflows](.github/workflows/) · [verification reports](docs/reports/)
