# THADD OS ISO build report

- run: [38486586286](https://github.com/ThaddeusHackz/THADD-OS---THE-REVERSE-ENGINEERED-OS-/actions/runs/38486586286)
- commit: `dd368f875d00ac3bdc9c1450c1c4c96df4336fbb`  (arena/6e1ad65e-rdp-universal)
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
  "built": "2026-10-13T23:50:12Z",
  "iso": "THADD-OS-1.0-x86_64.iso",
  "bytes": 77830144,
  "sha256": "23997eed8dbd0b29369a6e0be281f832dc6654b570f703f65def0c9050ac5870",
  "boot": "UEFI (El Torito, platform 0xEF, FAT16 efi.img)",
  "kernel_sha256": "f00a3601177b27462ebf23697f219acb8f995ffab2c930e1df30d335d5b9ab37",
  "initramfs_sha256": "2c48fbe72ca6b4a2cf48e5848235ebc6631bfde193d0ae4c1d18ec1326372398",
  "initramfs_bytes": 58916209,
  "loader_sha256": "fea60a2abdb56f369d0c4bd00aa8250e8e662b2e9f9989e501588bba6533c80a"
}
```
