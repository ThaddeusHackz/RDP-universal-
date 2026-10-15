# THADD OS ISO build report

- run: [38666819369](https://github.com/ThaddeusHackz/THADD-OS---THE-REVERSE-ENGINEERED-OS-/actions/runs/38666819369)
- commit: `d383e3929c1c2477b4e92e9b38ae9914d003c2bc`  (arena/6e1ad65e-rdp-universal)
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
  "built": "2026-10-15T01:39:50Z",
  "iso": "THADD-OS-1.0-x86_64.iso",
  "bytes": 77848576,
  "sha256": "c5aabbcb674d2c33dfd5ac7061f03d80a7e072942ea28c8f93a1637665ccb6dd",
  "boot": "UEFI (El Torito, platform 0xEF, FAT16 efi.img)",
  "kernel_sha256": "f00a3601177b27462ebf23697f219acb8f995ffab2c930e1df30d335d5b9ab37",
  "initramfs_sha256": "4c99d9b0e3e68149d457b12159dd5082475db2e5fc0003a86a605243c9f91809",
  "initramfs_bytes": 58933568,
  "loader_sha256": "962fb36f41fb2d66c5426d67cdcc2eaf41a7f2386e6a2aecb889e884fbe60ced"
}
```
