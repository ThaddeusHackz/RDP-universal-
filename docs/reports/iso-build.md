# THADD OS ISO build report

- run: [38779081768](https://github.com/ThaddeusHackz/THADD-OS---THE-REVERSE-ENGINEERED-OS-/actions/runs/38779081768)
- commit: `5a515891ce700920c23c58d31664c8f19af46749`  (arena/120d312d-thadd-os-the-reverse-engineere)
- host: Python 3.12.3 (main, Aug 31 2026, 10:18:26) [GCC 13.3.0]

## Sizes

```
153M	build/live/rootfs
57M	build/iso/boot/initrd.img.gz
75M	build/iso/THADD-OS-1.0-x86_64.iso
16M	build/payload/vmlinuz

-- staged rootfs: biggest directories --
148M	build/live/rootfs/usr
4.6M	build/live/rootfs/opt
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
  "built": "2026-10-15T17:39:30Z",
  "iso": "THADD-OS-1.0-x86_64.iso",
  "bytes": 77864960,
  "sha256": "efb47a56cd111afc9f55bfa72d207ea6b73b0b38ae71a165224167337ae3a3ba",
  "boot": "UEFI (El Torito, platform 0xEF, FAT16 efi.img)",
  "kernel_sha256": "f00a3601177b27462ebf23697f219acb8f995ffab2c930e1df30d335d5b9ab37",
  "initramfs_sha256": "d3755e0feb79cdf1e251bbf75d0d075657b0c3b7a69b0c4e64625a9b0872c26e",
  "initramfs_bytes": 58950683,
  "loader_sha256": "6b34baac39bc616d46da5c09f533601dc5918b1b1bff2bb4607a5911b858b36e"
}
```
