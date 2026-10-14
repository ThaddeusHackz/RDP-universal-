# THADD OS desktop ISO - verification report

- run: [38576308531](https://github.com/ThaddeusHackz/THADD-OS---THE-REVERSE-ENGINEERED-OS-/actions/runs/38576308531)
- commit: `b3986935dcca1c618c854da7feedbbff6feb149f`
- verify step: **success**
- full log: artifact `THADD-OS-desktop-verify-log` (30 days) and `dist/verify.log`

`iso/verify.sh` read the built ISO back: boot records, ISO layout, and the contents
of the shipped squashfs (identity, desktop profile, session, assistant, scanner, toolchain).

```

── artefact ──
  /home/runner/work/THADD-OS---THE-REVERSE-ENGINEERED-OS-/THADD-OS---THE-REVERSE-ENGINEERED-OS-/dist/THADD-OS-2026.10.14-aurora-amd64.iso
  2042 MiB  ·  3a0a1845d139e23f8221f056d7d0fa9e…
  ✓ PASS size is a plausible full desktop image (2042 MiB)
  ✓ PASS fits a DVD / release asset split threshold
  ✓ PASS sha256 sidecar verifies

── boot records (hybrid BIOS + UEFI) ──
  ✓ PASS ISO 9660 filesystem
  ✓ PASS MBR/El Torito boot sector present (BIOS boot)
  ✓ PASS El Torito boot catalog readable
  ✓ PASS BIOS boot image referenced
  ✓ PASS EFI boot image referenced (UEFI boot)

── image layout ──
  ✗ FAIL live/filesystem.squashfs MISSING — image is not bootable
  ✗ FAIL live/vmlinuz MISSING — image is not bootable
  ✗ FAIL live/initrd.img MISSING — image is not bootable
  ! WARN isolinux/isolinux.bin missing — legacy BIOS boot degraded
  ! WARN isolinux/syslinux.cfg missing — legacy BIOS boot degraded
  ! WARN no EFI boot image found — UEFI-only machines will not boot (BIOS still works)

── ship contents (deeper look inside the squashfs) ──
  ✓ PASS squashfs extracted (2.0G)
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

═══ verification: 3 failure(s), 3 warning(s) ═══
  RESULT: NOT SHIPPABLE
```
