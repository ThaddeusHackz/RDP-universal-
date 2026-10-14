# THADD OS desktop ISO - verification report

- run: [38584362319](https://github.com/ThaddeusHackz/THADD-OS---THE-REVERSE-ENGINEERED-OS-/actions/runs/38584362319)
- commit: `38bd5146967b46c6ea00461bb6c843df514bd6fe`
- verify step: **success**
- full log: artifact `THADD-OS-desktop-verify-log` (30 days) and `dist/verify.log`

`iso/verify.sh` read the built ISO back: boot records, ISO layout, and the contents
of the shipped squashfs (identity, desktop profile, session, assistant, scanner, toolchain).

```

── artefact ──
  /home/runner/work/THADD-OS---THE-REVERSE-ENGINEERED-OS-/THADD-OS---THE-REVERSE-ENGINEERED-OS-/dist/THADD-OS-2026.10.14-aurora-amd64.iso
  2042 MiB  ·  39ce7438cf4ae71dd28863086431e823…
  ✓ PASS size is a plausible full desktop image (2042 MiB)
  ✓ PASS fits a DVD / release asset split threshold
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
  ✓ PASS live/initrd.img present (61583219 bytes)
  ✓ PASS isolinux/isolinux.bin present (legacy BIOS boot)
  ✓ PASS isolinux/isolinux.cfg present (BIOS boot menu)
  ✓ PASS UEFI boot image present: /boot/grub/efi.img (917504 bytes)

── ship contents (deeper look inside the squashfs) ──
  ✓ PASS live/filesystem.squashfs present and extractable (2.0G)
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
  ✓ PASS Firefox binary  (usr/bin/firefox-esr)
  ✓ PASS Chromium binary  (usr/bin/chromium)
  ✓ PASS nmap (security suite)  (usr/bin/nmap)
  ✓ PASS git  (usr/bin/git)
  ✓ PASS python3  (usr/bin/python3)
  ✓ PASS REA reverse-engineering  (usr/local/bin/rea)
  ✓ PASS os-release brands the system THADD OS
  ✓ PASS ID=thadd

── kernel + initramfs ──
  ✓ PASS kernel present: squashfs-root/boot/firmware/vmlinuz-6.1.0-53-amd64
  ✓ PASS initramfs present: squashfs-root/boot/firmware/initrd.img-6.1.0-53-amd64

═══ verification: 0 failure(s), 0 warning(s) ═══
  RESULT: SHIPPABLE
```
