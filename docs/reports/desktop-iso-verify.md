# THADD OS desktop ISO - verification report

- run: [38666819457](https://github.com/ThaddeusHackz/THADD-OS---THE-REVERSE-ENGINEERED-OS-/actions/runs/38666819457)
- commit: `d383e3929c1c2477b4e92e9b38ae9914d003c2bc`
- verify step: **success**
- full log: artifact `THADD-OS-desktop-verify-log` (30 days) and `dist/verify.log`

`iso/verify.sh` read the built ISO back: boot records, ISO layout, and the contents
of the shipped squashfs (identity, desktop profile, session, assistant, scanner, toolchain).

```

── artefact ──
  workspace: /tmp/thadd-verify.LMS1b7
  disk: /dev/root 145G 71G 74G 49% /
  /home/runner/work/THADD-OS---THE-REVERSE-ENGINEERED-OS-/THADD-OS---THE-REVERSE-ENGINEERED-OS-/dist/THADD-OS-2026.10.15-aurora-amd64.iso
  5625 MiB  ·  e0e29876d42656fa1b663972234f3ca4…
  ✓ PASS size is a plausible full desktop image (5625 MiB)
  ! WARN very large (5625 MiB) — release will be split into parts
  ✓ PASS sha256 sidecar verifies

── boot records (hybrid BIOS + UEFI) ──
  ✓ PASS ISO 9660 filesystem (file: ISO 9660 CD-ROM filesystem data (DOS/MBR boot sector) 'THAD)
  ✓ PASS MBR/El Torito boot sector present (BIOS boot)
  ✓ PASS El Torito boot catalog readable
  ✓ PASS BIOS boot image referenced
  ✓ PASS EFI boot image referenced (UEFI boot)

── image layout ──
  554 file(s) listed on the ISO
  ✓ PASS live/vmlinuz present (8230848 bytes)
  ✓ PASS live/initrd.img present (62685969 bytes)
  ✓ PASS isolinux/isolinux.bin present (legacy BIOS boot)
  ✓ PASS isolinux/isolinux.cfg present (BIOS boot menu)
  ✓ PASS UEFI boot image present: /boot/grub/efi.img (917504 bytes)

── boot menus (what the firmware actually offers) ──
  menu source(s): isolinux/isolinux.cfg isolinux/menu.cfg isolinux/live.cfg isolinux/stdmenu.cfg
  ✓ PASS 3 BIOS boot entr(ies) defined: mainmenu live-amd64 live-amd64-failsafe 
  ✓ PASS default entry: default vesamenu.c32
  ✓ PASS the live parameters are on the menu (boot=live)
  ✓ PASS menu references vmlinuz: /live/vmlinuz
  ✓ PASS menu references initrd: 	initrd
/live/initrd.img
  ✓ PASS the UEFI/GRUB menu carries the live parameters too

── ship contents (deeper look inside the squashfs) ──
  ✓ PASS live/filesystem.squashfs present and extractable (5.5G)
  ✓ PASS squashfs inventory: 589236 entries
  ✓ PASS THADD identity  (etc/os-release)
  ✓ PASS LSB identity  (etc/lsb-release)
  ✓ PASS build fingerprint  (etc/thadd/build-info)
  ✓ PASS desktop profile  (etc/skel/.config/xfce4/xfconf/xfce-perchannel-xml/xfce4-panel.xml)
  ✓ PASS window session  (usr/bin/xfce4-session)
  ✓ PASS desktop shell  (usr/bin/xfdesktop)
  ✓ PASS window manager  (usr/bin/xfwm4)
  ✓ PASS compositor  (usr/bin/picom)
  ✓ PASS display manager  (usr/sbin/lightdm)
  ✓ PASS THADD control centre  (usr/local/bin/thadd)
  ✓ PASS THADD toolbox (on-demand sets)  (usr/local/bin/thadd-toolbox)
  ✓ PASS optional set lists in the image  (usr/share/thadd/packages/optional-security.txt)
  ✓ PASS THADD AI assistant  (usr/local/bin/thadd-ai)
  ✓ PASS forensic scanner  (usr/local/bin/thadd-scan)
  ✓ PASS in-image self-test  (usr/local/bin/thadd-desktop-selftest)
  ✓ PASS THADD session (the desktop the user lands in)  (usr/local/bin/thadd-shell-session)
  ✓ PASS desktop shell entry  (opt/thadd/desktop/index.html)
  ✓ PASS AI agent loop  (opt/thadd/app/thadd/server/ai/agent.py)
  ✓ PASS AI tool registry  (opt/thadd/app/thadd/server/ai/tools.py)
  ✓ PASS DFIR triage engine  (opt/thadd/app/thadd/forensics/triage.py)
  ✓ PASS THADD Scan engine  (opt/thadd/security/thadd-scan)
  ✓ PASS tolerant package installer  (opt/thadd/tools/bin/thadd-apt-safe)
  ✓ PASS Firefox browser  (usr/share/applications/firefox-esr.desktop)
  ✓ PASS Chromium binary  (usr/bin/chromium)
  ✓ PASS REA reverse-engineering  (usr/local/bin/rea)
  ✓ PASS REA implementation (as staged)  (opt/thadd/reverse-engineering/rea)
  ✓ PASS os-release brands the system THADD OS
  ✓ PASS ID=thadd
  ✓ PASS in-image self-test: 54 passed · 0 failed · 3 warned

── the login banner vs the image ──
  ✓ PASS the banner advertises rea, and it is in the image
  ✓ PASS the banner advertises thadd, and it is in the image
  ✓ PASS the banner advertises thadd-ai, and it is in the image
  ✓ PASS the banner advertises thadd-scan, and it is in the image
  ✓ PASS the banner advertises thadd-ssh, and it is in the image
  ✓ PASS the banner advertises thadd-toolbox, and it is in the image

── the image's own commands are real programs, not placeholders ──
  ✓ PASS the control centre delegates to the forensic scanner
  ✓ PASS the control centre carries the doctor it advertises
  ✓ PASS the toolbox replays the shipped set lists
  ✓ PASS the assistant wrapper runs the real assistant
  ✓ PASS the assistant entry point runs the real assistant
  ✓ PASS rea knows the container formats it unpacks
  ✓ PASS no command shipped in this image is a placeholder

── documentation shipped with the image ──
  ✓ PASS documentation: SECURITY.md  (usr/share/doc/thadd/SECURITY.md)
  ✓ PASS documentation: QUICKSTART.md  (usr/share/doc/thadd/QUICKSTART.md)
  ✓ PASS documentation: AI.md  (usr/share/doc/thadd/AI.md)
  ✓ PASS documentation: FORENSIC_SCAN.md  (usr/share/doc/thadd/FORENSIC_SCAN.md)
  ✓ PASS documentation: REA.md  (usr/share/doc/thadd/REA.md)

── optional package sets (what the tolerant installer did) ──
  ✓ PASS installer ran 7 optional set(s)
  ✓ PASS thadd-apt-safe: 10 resolvable / 10 requested
  ✓ PASS thadd-apt-safe: 83 resolvable / 89 requested
  ✓ PASS thadd-apt-safe: 183 resolvable / 202 requested
  ✓ PASS thadd-apt-safe: 95 resolvable / 159 requested
  ✓ PASS thadd-apt-safe: 121 resolvable / 174 requested
  ✓ PASS thadd-apt-safe: 58 resolvable / 64 requested
  ✓ PASS thadd-apt-safe: 10 resolvable / 10 requested
  ✓ PASS at least one set installed in a single batch (7 of 7)
  ! WARN 148 requested package(s) are not in this release's repos: cmusphinx-en-us python3-sounddevice python3-speechrecognition virtualbox-guest-utils virtualbox-guest-x11 xserver-xorg-input-vmmouse chezmoi gir1.2-appindicator
  ! WARN third-party: ==============================
  ✓ PASS third-party: powershell=installed
  ✓ PASS third-party: metasploit=installed
  ✓ PASS third-party: code=installed
  ✓ PASS third-party: microsoft-edge-stable=installed
  ✓ PASS third-party: google-chrome-stable=installed
  ✓ PASS third-party: brave-browser=installed
  ! WARN third-party: radare2=not-packaged (not in Debian, not installed)

── toolkit the user was promised ──
  ✓ PASS Metasploit (msfconsole/msfvenom)  (usr/bin/msfconsole)
  ✓ PASS impacket-scripts  (usr/share/impacket)
  ! WARN CrackMapExec missing (looked in: usr/bin/crackmapexec usr/bin/cme)
  ✓ PASS bettercap  (usr/bin/bettercap)
  ✓ PASS mitmproxy  (usr/bin/mitmproxy)
  ✓ PASS Wireshark/tshark  (usr/bin/tshark)
  ! WARN radare2 / rizin missing (looked in: usr/bin/radare2 usr/bin/r2 usr/bin/rizin)
  ✓ PASS John the Ripper  (usr/sbin/john)
  ✓ PASS nikto  (usr/bin/nikto)
  ✓ PASS whatweb  (usr/bin/whatweb)
  ✓ PASS dirb  (usr/bin/dirb)
  ! WARN Ghidra missing (usr/bin/ghidra)
  ✓ PASS hashcat  (usr/bin/hashcat)
  ✓ PASS sqlmap  (usr/bin/sqlmap)
  ✓ PASS wfuzz  (usr/bin/wfuzz)
  ✓ PASS binwalk  (usr/bin/binwalk)
  ✓ PASS sleuthkit (fls)  (usr/bin/fls)
  ✓ PASS hydra  (usr/bin/hydra)
  ✓ PASS aircrack-ng  (usr/bin/aircrack-ng)
  ✓ PASS gobuster  (usr/bin/gobuster)
  ✓ PASS gdb  (usr/bin/gdb)
  ✓ PASS strace  (usr/bin/strace)
  ✓ PASS tcpdump  (usr/bin/tcpdump)
  ✓ PASS gcc (C toolchain)  (usr/bin/gcc)
  ✓ PASS node  (usr/bin/node)
  ✓ PASS ffmpeg  (usr/bin/ffmpeg)
  ✓ PASS nmap (security suite)  (usr/bin/nmap)
  ✓ PASS git  (usr/bin/git)
  ✓ PASS python3  (usr/bin/python3)
  ✓ PASS PowerShell 7  (opt/microsoft/powershell/7/pwsh)
  ✓ PASS VS Code  (usr/bin/code)
  ✓ PASS Google Chrome  (opt/google/chrome/chrome)
  ✓ PASS Microsoft Edge  (opt/microsoft/msedge/msedge)
  ✓ PASS Brave  (usr/bin/brave-browser)
  ✓ PASS Epiphany browser  (usr/bin/epiphany)
  ✓ PASS qutebrowser  (usr/bin/qutebrowser)
  ✓ PASS Falkon browser  (usr/bin/falkon)
  ✓ PASS w3m (text browser)  (usr/bin/w3m)
  ✓ PASS lynx (text browser)  (usr/bin/lynx)
  ✓ PASS Tor Browser launcher  (usr/bin/torbrowser-launcher)
  ✓ PASS Firefox ESR  (usr/share/applications/firefox-esr.desktop)

── kernel + initramfs ──
  ✓ PASS kernel present: boot/firmware/vmlinuz-6.1.0-53-amd64
  ✓ PASS initramfs present: boot/firmware/initrd.img-6.1.0-53-amd64

═══ verification: 0 failure(s), 7 warning(s) ═══
  RESULT: SHIPPABLE
```
