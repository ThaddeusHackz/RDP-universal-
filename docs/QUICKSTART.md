# THADD OS — quick start

`docs/QUICKSTART.md` · ships inside the image as `/usr/share/doc/thadd/QUICKSTART.md`.

## 1. Get the ISO

Every [release](https://github.com/ThaddeusHackz/THADD-OS---THE-REVERSE-ENGINEERED-OS-/releases)
carries two images:

| Image | What it is |
| --- | --- |
| `THADD-OS-<version>-aurora-amd64.iso` (~5.6 GB, **three parts**) | The full desktop: XFCE skinned as a Windows 11 × macOS Sequoia fusion, every browser, the dev/security/forensics toolchain, the AI assistant and the forensic scanner |
| `THADD-OS-1.0-x86_64.iso` (78 MB) | The minimal from-scratch live system (own boot chain, own userland, the THADD service and shell) |

The desktop image is bigger than GitHub's 2 GiB per-asset limit, so it is split. Rejoin it:

```bash
cat THADD-OS-*-aurora-amd64.iso.part-* > thadd-os.iso
sha256sum -c parts.sha256
```

Every release page also links `docs/reports/desktop-iso-verify.md` — the report from
`iso/verify.sh`, which reads the finished ISO back and asserts its boot records, its
layout and the contents of the shipped squashfs. If that report does not end in
`RESULT: SHIPPABLE`, do not boot it.

## 2. Boot it in VirtualBox

```bash
VBoxManage createvm --name "THADD OS" --ostype Debian_64 --register
VBoxManage modifyvm  "THADD OS" --memory 4096 --cpus 2 --vram 128 \
                     --graphicscontroller vmsvga --firmware efi
VBoxManage createhd    --filename "$HOME/THADD-OS/disk.vdi" --size 40960
VBoxManage storagectl  "THADD OS" --name "SATA" --add sata --controller IntelAhci --portcount 2
VBoxManage storageattach "THADD OS" --storagectl "SATA" --port 0 --device 0 --type hdd \
                       --medium "$HOME/THADD-OS/disk.vdi"
VBoxManage storageattach "THADD OS" --storagectl "SATA" --port 1 --device 0 --type dvddrive \
                       --medium "$PWD/thadd-os.iso"
VBoxManage startvm "THADD OS"
```

Or in the GUI: **New VM** → Type *Linux*, Version *Debian (64-bit)* → **4 GB RAM, 2 CPUs,
128 MB VRAM** → attach the ISO as a DVD → start.

* The image is a **hybrid ISO**: it boots with EFI *and* with legacy BIOS, so the
  firmware setting does not have to match anything.
* Guest additions are already installed in the image (`virtualbox-guest-utils`,
  `virtualbox-guest-x11`), so the mouse integrates, the display resizes and shared
  folders work without running anything.
* 4 GB RAM is comfortable; 2 GB works. The desktop itself is on the disc, so the VM
  needs no disk — attach one only if you want to install.

## 3. Log in

The session starts by itself (autologin, `/etc/lightdm/`), and the password for the
live user `thadd` is `thadd`. Change it before you connect to a network you do not
control (`thadd-passwd`) — there is a full description in `docs/SECURITY.md`.

The desktop is XFCE wearing a Windows 11 × macOS Sequoia skin: a top bar and an
application menu on one side, a Plank dock on the other, rounded translucent windows
by way of `picom`. Nothing is a screenshot — it is a real window manager with a real
theme, so every application behaves natively.

### Keyboard

| Shortcut | Action |
| --- | --- |
| `Ctrl+Alt+T` | Terminal (maximised) |
| `Ctrl+Alt+F` | Files (Thunar) |
| `Ctrl+Alt+B` | Firefox ESR |
| `Ctrl+Alt+M` | Task manager |
| `Ctrl+Alt+S` | THADD doctor — environment and health report |
| `Ctrl+Alt+J` | THADD AI ("Jarvis") |
| `Ctrl+Alt+X` | Switch desktop mode (native XFCE ↔ THADD shell) |
| `Print` | Screenshot to `~/Pictures` |

### Hidden features (the ones that are usually a registry hack somewhere else)

* **Both worlds at once**: `Ctrl+Alt+X` switches between the native XFCE desktop and
  the THADD shell, without logging out — `thadd-desktop-mode xfce|shell`.
* **The AI is not a browser tab**: `thadd-ai` in any terminal, or the dock's assistant,
  drive the same agent with real tools over the local bridge (`127.0.0.1:8787`).
* **Hidden files, power menu, workspace overview**: standard XFCE behaviour with the
  THADD shortcut map on top, so nothing that works on Debian stops working here.

## 4. What is installed

```bash
thadd doctor            # environment, tool groups, what is missing
thadd-ai doctor         # the assistant's view: models, key, autonomy, tools
thadd-scan --summary    # forensic snapshot of this machine
rea --help              # reverse-engineer one file: identify, unpack, strings, report
thadd --help            # the control centre
```

* **Browsers**: Firefox ESR, Chromium, Google Chrome, Microsoft Edge, Brave, Epiphany,
  qutebrowser, Falkon, Tor Browser launcher, and `w3m`/`lynx`/`links2` on a bare TTY.
* **Development**: gcc/g++/make, git, Python 3 with pip/venv, Node.js with npm/npx,
  VS Code, PowerShell 7, gdb, strace, and the usual Debian build tooling.
* **Security and forensics (Parrot/HTB class)**: Metasploit, nmap, sqlmap, hydra,
  aircrack-ng, hashcat, John the Ripper, bettercap, mitmproxy, impacket,
  Wireshark/tshark, tcpdump, nikto, whatweb, dirb, wfuzz, gobuster, binwalk, sleuthkit,
  radare2/rizin where the release packages them.
* **Everything else**: LibreOffice, Thunderbird, GIMP, VLC, Calibre, Remmina, qBittorrent,
  printing and scanning, Bluetooth and camera support, guest additions for VirtualBox,
  VMware and QEMU.

Tools that Debian 12 does not carry (Metasploit and PowerShell come from Rapid7's and
Microsoft's own repositories; Chrome, Edge, Brave and VS Code from their vendors') are
installed by a tolerant hook, and the verification report names anything that did not
land instead of leaving you to discover it.

## 5. Leaving no trace / keeping your work

The live system runs from the disc: your files live in RAM and are gone at shutdown.
To keep them, either

* attach the VM's disk and install THADD OS with the desktop's installer
  (`Installer` in the app menu, or `sudo debian-installer-launcher`), or
* mount a shared folder (`VBoxManage sharedfolder add …`) or USB stick and work there.

Persistence on the live media itself (a `persistence` partition) is a supported
Debian-live feature; the boot menu's second entry (`Persistence`) uses it if you create
one.

## 6. If something looks wrong

| Symptom | Where to look |
| --- | --- |
| Black screen after the boot menu | Boot the **`safe mode`** entry (nomodeset) — `VirtualBox → Settings → Display → VMSVGA` is what the image is built for |
| No network | `nmcli device status`, then `thadd doctor` |
| A tool is missing | `thadd-scan --summary` (its "toolkit" section lists what is really installed) and `/usr/share/thadd/apt-safe-report.txt` |
| The boot failed entirely | `docs/reports/desktop-iso-verify.md` for that release tells you whether the disc was sound before it reached you |
| Anything else | `thadd doctor`, `/var/log/thadd/`, and the release's verification report |
