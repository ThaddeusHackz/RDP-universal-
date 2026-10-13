# THADD OS ISO build report

- run: [38478256712](https://github.com/ThaddeusHackz/THADD-OS---THE-REVERSE-ENGINEERED-OS-/actions/runs/38478256712)
- commit: `107869179ddaa733425aa5a1caab208dfd354d4e`  (arena/6e1ad65e-rdp-universal)
- host: Python 3.12.3 (main, Aug 31 2026, 10:18:26) [GCC 13.3.0]

## Sizes

```
968M	build/live/rootfs
395M	build/iso/boot/initrd.img.gz
413M	build/iso/THADD-OS-1.0-x86_64.iso
16M	build/payload/vmlinuz

-- staged rootfs: biggest directories --
816M	build/live/rootfs/etc
148M	build/live/rootfs/usr
4.4M	build/live/rootfs/opt
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
208094144 build/live/rootfs/etc/skel/.rustup/toolchains/stable-x86_64-unknown-linux-gnu/lib/libLLVM.so.23.1-rust-1.99.0-stable
158319840 build/live/rootfs/etc/skel/.rustup/toolchains/stable-x86_64-unknown-linux-gnu/lib/librustc_driver-999a121de2f042be.so
67966588 build/live/rootfs/etc/skel/.rustup/toolchains/stable-x86_64-unknown-linux-gnu/lib/rustlib/x86_64-unknown-linux-gnu/lib/libcore-667b96598095cbda.rmeta
43062112 build/live/rootfs/etc/skel/.dotnet/tools/.store/nbgv/3.10.94/nbgv/3.10.94/nbgv.nupkg
43062112 build/live/rootfs/etc/skel/.dotnet/tools/.store/nbgv/3.10.94/nbgv/3.10.94/nbgv.3.10.94.nupkg
36160240 build/live/rootfs/etc/skel/.rustup/toolchains/stable-x86_64-unknown-linux-gnu/bin/cargo
21113232 build/live/rootfs/etc/skel/.cargo/bin/rustup
16256512 build/live/rootfs/etc/skel/.rustup/toolchains/stable-x86_64-unknown-linux-gnu/bin/clippy-driver
14678690 build/live/rootfs/usr/lib/python3.12/config-3.12-x86_64-linux-gnu/libpython3.12.a
14423589 build/live/rootfs/etc/skel/.rustup/toolchains/stable-x86_64-unknown-linux-gnu/share/doc/rust/COPYRIGHT.html
13336338 build/live/rootfs/usr/lib/python3.12/config-3.12-x86_64-linux-gnu/libpython3.12-pic.a
12568360 build/live/rootfs/etc/skel/.rustup/toolchains/stable-x86_64-unknown-linux-gnu/bin/rustdoc
```

## Manifest

```json
{
  "os": "THADD OS",
  "version": "1.0",
  "codename": "Nebula Prime",
  "built": "2026-10-13T22:31:47Z",
  "iso": "THADD-OS-1.0-x86_64.iso",
  "bytes": 432388096,
  "sha256": "cc059312bed19565836ee4d4aa9a97df3f6e319fee17c193f335d54931992c91",
  "boot": "UEFI (El Torito, platform 0xEF, FAT16 efi.img)",
  "kernel_sha256": "f00a3601177b27462ebf23697f219acb8f995ffab2c930e1df30d335d5b9ab37",
  "initramfs_sha256": "b88ca3df7df7a8ff37f42a726d7cfd139391fb77e68b8d4e1444a97c28a6f7ee",
  "initramfs_bytes": 413476711,
  "loader_sha256": "b77f71a873fef977632cac24497c0f39202f8d678c3eb35446a1362a8244142d"
}
```
