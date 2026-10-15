# THADD OS ISO build report

- run: [38658798796](https://github.com/ThaddeusHackz/THADD-OS---THE-REVERSE-ENGINEERED-OS-/actions/runs/38658798796)
- commit: `050302571743367c30408b935136f5c07270a53a`  (arena/6e1ad65e-rdp-universal)
- host: Python 3.12.3 (main, Aug 31 2026, 10:18:26) [GCC 13.3.0]

## Sizes

```
153M	build/live/rootfs
57M	build/iso/boot/initrd.img.gz
75M	build/iso/THADD-OS-1.0-x86_64.iso
16M	build/payload/vmlinuz

-- staged rootfs: biggest directories --
148M	build/live/rootfs/usr
4.5M	build/live/rootfs/opt
232K	build/live/rootfs/etc
20K	build/live/rootfs/var
12K	build/live/rootfs/init
8.0K	build/live/rootfs/home
4.0K	build/live/rootfs/tmp
4.0K	build/live/rootfs/sys
4.0K	build/live/rootfs/srv
4.0K	build/live/rootfs/run
4.0K	build/live/rootfs/root
4.0K	build/live/rootfs/proc

-- biggest files in the userland --
14678690 build/live/rootfs/usr/lib/python3.12/config-3.12-x86_64-linux-gnu/libpython3.12.a
13336338 build/live/rootfs/usr/lib/python3.12/config-3.12-x86_64-linux-gnu/libpython3.12-pic.a
9061000 build/live/rootfs/usr/lib/x86_64-linux-gnu/libpython3.12.so.1.0
8020928 build/live/rootfs/usr/bin/python3.12
5309400 build/live/rootfs/usr/lib/x86_64-linux-gnu/libcrypto.so.3
5203513 build/live/rootfs/usr/local/lib/python3.12/dist-packages/pillow.libs/libavif-8a7f9d56.so.16.4.2
4576040 build/live/rootfs/usr/bin/git
4130640 build/live/rootfs/usr/bin/vim.basic
3755032 build/live/rootfs/usr/lib/x86_64-linux-gnu/systemd/libsystemd-shared-255.so
3402345 build/live/rootfs/usr/local/lib/python3.12/dist-packages/PIL/_imaging.cpython-312-x86_64-linux-gnu.so
```

## Manifest

```json
{
  "os": "THADD OS",
  "version": "1.0",
  "codename": "Nebula Prime",
  "built": "2026-10-15T00:14:01Z",
  "iso": "THADD-OS-1.0-x86_64.iso",
  "bytes": 77848576,
  "sha256": "bb696b0e598d5b2005ee713f158055701480a841284558faef8e1efd2b39ae10",
  "boot": "UEFI (El Torito, platform 0xEF, FAT16 efi.img)",
  "kernel_sha256": "f00a3601177b27462ebf23697f219acb8f995ffab2c930e1df30d335d5b9ab37",
  "initramfs_sha256": "3adfb3ffe09359a758676264c64c24d63611ead2fca512c16685e9cfbf160377",
  "initramfs_bytes": 58934738,
  "loader_sha256": "7dd78baa24b80d3aeee9c5dbecf3dbd47c5581f3312ee54e640fa1498a4b0b01"
}
```
