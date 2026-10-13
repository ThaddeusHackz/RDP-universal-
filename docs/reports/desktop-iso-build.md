# THADD OS desktop ISO - live-build report

- run: [38486586285](https://github.com/ThaddeusHackz/THADD-OS---THE-REVERSE-ENGINEERED-OS-/actions/runs/38486586285)
- commit: `dd368f875d00ac3bdc9c1450c1c4c96df4336fbb`
- result: **failed**

```
== ls dist ==
total 32
drwxr-xr-x  2 runner runner  4096 Oct 13 23:50 .
drwxr-xr-x 17 runner runner  4096 Oct 13 23:50 ..
-rw-r--r--  1 runner runner 20839 Oct 13 23:50 desktop-build-trace.log
== ls iso ==
total 52
drwxr-xr-x  6 runner runner  4096 Oct 13 23:50 .
drwxr-xr-x 17 runner runner  4096 Oct 13 23:50 ..
drwxr-xr-x  2 root   root    4096 Oct 13 23:50 .build
drwxr-xr-x  2 root   root    4096 Oct 13 23:50 auto
-rwxr-xr-x  1 runner runner 14503 Oct 13 23:49 build.sh
drwxr-xr-x 22 runner runner  4096 Oct 13 23:50 config
drwxr-xr-x  3 root   root    4096 Oct 13 23:50 local
-rw-r--r--  1 runner runner  7740 Oct 13 23:49 verify.sh
-rw-r--r--  1 runner runner    53 Oct 13 23:49 version.env

== effective live-build config (iso/config/common) ==
LB_INITSYSTEM="systemd"

===== dist/desktop-build-trace.log (first 40 lines) =====
container: Debian GNU/Linux 12 (bookworm) / debian_version=12.15
debconf: delaying package configuration, since apt-utils is not installed
live-build: 20230502
live-build package: live-build	1:20230502
+ set -Eeuo pipefail
+++ dirname ./iso/build.sh
++ cd ./iso/..
++ pwd
+ REPO_ROOT=/work
+ ISO_DIR=/work/iso
+ DIST_DIR=/work/dist
+ PROFILE=desktop
++ date -u +%Y.%m.%d
+ VERSION=2026.10.13
++ sed -n 's/^THADD_CODENAME=//p' /work/iso/version.env
+ CODENAME=aurora
+ CODENAME=aurora
+ C_RESET='[0m'
+ C_DIM='[2m'
+ C_ACC='[38;5;39m'
+ C_OK='[38;5;42m'
+ C_WARN='[38;5;214m'
+ C_ERR='[38;5;203m'
+ [[ 0 -gt 0 ]]
++ id -u
+ [[ 0 == \0 ]]
++ uname -m
+ [[ x86_64 == \x\8\6\_\6\4 ]]
+ [[ 0 != \1 ]]
+ missing=()
+ for t in lb debootstrap xorriso mksquashfs rsync
+ command -v lb
+ for t in lb debootstrap xorriso mksquashfs rsync
+ command -v debootstrap
+ for t in lb debootstrap xorriso mksquashfs rsync
+ command -v xorriso
+ for t in lb debootstrap xorriso mksquashfs rsync
+ command -v mksquashfs
+ for t in lb debootstrap xorriso mksquashfs rsync
+ command -v rsync

===== dist/desktop-build-trace.log (last 120 lines) =====
+ [[ LB_DISTRIBUTION == \L\B\_\D\I\S\T\R\I\B\U\T\I\O\N ]]
+ grep -q '^LB_DISTRIBUTION=' config/bootstrap
+ force LB_PARENT_DISTRIBUTION bookworm
+ local var=LB_PARENT_DISTRIBUTION val=bookworm f
+ for f in config/bootstrap config/common config/binary
+ [[ -f config/bootstrap ]]
+ grep -q '^LB_PARENT_DISTRIBUTION=' config/bootstrap
+ sed -i 's|^LB_PARENT_DISTRIBUTION=.*|LB_PARENT_DISTRIBUTION="bookworm"|' config/bootstrap
+ for f in config/bootstrap config/common config/binary
+ [[ -f config/common ]]
+ grep -q '^LB_PARENT_DISTRIBUTION=' config/common
+ for f in config/bootstrap config/common config/binary
+ [[ -f config/binary ]]
+ grep -q '^LB_PARENT_DISTRIBUTION=' config/binary
+ [[ LB_PARENT_DISTRIBUTION == \L\B\_\D\I\S\T\R\I\B\U\T\I\O\N ]]
+ force LB_MIRROR_CHROOT http://deb.debian.org/debian/
+ local var=LB_MIRROR_CHROOT val=http://deb.debian.org/debian/ f
+ for f in config/bootstrap config/common config/binary
+ [[ -f config/bootstrap ]]
+ grep -q '^LB_MIRROR_CHROOT=' config/bootstrap
+ sed -i 's|^LB_MIRROR_CHROOT=.*|LB_MIRROR_CHROOT="http://deb.debian.org/debian/"|' config/bootstrap
+ for f in config/bootstrap config/common config/binary
+ [[ -f config/common ]]
+ grep -q '^LB_MIRROR_CHROOT=' config/common
+ for f in config/bootstrap config/common config/binary
+ [[ -f config/binary ]]
+ grep -q '^LB_MIRROR_CHROOT=' config/binary
+ [[ LB_MIRROR_CHROOT == \L\B\_\D\I\S\T\R\I\B\U\T\I\O\N ]]
+ force LB_MIRROR_CHROOT_SECURITY http://security.debian.org/debian-security/
+ local var=LB_MIRROR_CHROOT_SECURITY val=http://security.debian.org/debian-security/ f
+ for f in config/bootstrap config/common config/binary
+ [[ -f config/bootstrap ]]
+ grep -q '^LB_MIRROR_CHROOT_SECURITY=' config/bootstrap
+ sed -i 's|^LB_MIRROR_CHROOT_SECURITY=.*|LB_MIRROR_CHROOT_SECURITY="http://security.debian.org/debian-security/"|' config/bootstrap
+ for f in config/bootstrap config/common config/binary
+ [[ -f config/common ]]
+ grep -q '^LB_MIRROR_CHROOT_SECURITY=' config/common
+ for f in config/bootstrap config/common config/binary
+ [[ -f config/binary ]]
+ grep -q '^LB_MIRROR_CHROOT_SECURITY=' config/binary
+ [[ LB_MIRROR_CHROOT_SECURITY == \L\B\_\D\I\S\T\R\I\B\U\T\I\O\N ]]
+ force LB_MIRROR_BINARY http://deb.debian.org/debian/
+ local var=LB_MIRROR_BINARY val=http://deb.debian.org/debian/ f
+ for f in config/bootstrap config/common config/binary
+ [[ -f config/bootstrap ]]
+ grep -q '^LB_MIRROR_BINARY=' config/bootstrap
+ sed -i 's|^LB_MIRROR_BINARY=.*|LB_MIRROR_BINARY="http://deb.debian.org/debian/"|' config/bootstrap
+ for f in config/bootstrap config/common config/binary
+ [[ -f config/common ]]
+ grep -q '^LB_MIRROR_BINARY=' config/common
+ for f in config/bootstrap config/common config/binary
+ [[ -f config/binary ]]
+ grep -q '^LB_MIRROR_BINARY=' config/binary
+ [[ LB_MIRROR_BINARY == \L\B\_\D\I\S\T\R\I\B\U\T\I\O\N ]]
+ force LB_MIRROR_BINARY_SECURITY http://security.debian.org/debian-security/
+ local var=LB_MIRROR_BINARY_SECURITY val=http://security.debian.org/debian-security/ f
+ for f in config/bootstrap config/common config/binary
+ [[ -f config/bootstrap ]]
+ grep -q '^LB_MIRROR_BINARY_SECURITY=' config/bootstrap
+ sed -i 's|^LB_MIRROR_BINARY_SECURITY=.*|LB_MIRROR_BINARY_SECURITY="http://security.debian.org/debian-security/"|' config/bootstrap
+ for f in config/bootstrap config/common config/binary
+ [[ -f config/common ]]
+ grep -q '^LB_MIRROR_BINARY_SECURITY=' config/common
+ for f in config/bootstrap config/common config/binary
+ [[ -f config/binary ]]
+ grep -q '^LB_MIRROR_BINARY_SECURITY=' config/binary
+ [[ LB_MIRROR_BINARY_SECURITY == \L\B\_\D\I\S\T\R\I\B\U\T\I\O\N ]]
+ ok 'suite + mirrors pinned to bookworm (printed above, before the fix-up)'
+ printf '%s  ✓%s %s\n' '[38;5;42m' '[0m' 'suite + mirrors pinned to bookworm (printed above, before the fix-up)'
+ log 'after the fix-up'
+ printf '%s[thadd-iso]%s %s\n' '[38;5;39m' '[0m' 'after the fix-up'
+ for f in config/bootstrap config/common
+ [[ -f config/bootstrap ]]
[38;5;42m  ✓[0m suite + mirrors pinned to bookworm (printed above, before the fix-up)
[38;5;39m[thadd-iso][0m after the fix-up
+ echo '  --- config/bootstrap'
  --- config/bootstrap
+ grep -E '^LB_(DISTRIBUTION|MIRROR_BOOTSTRAP|MIRROR_CHROOT_SECURITY)=' config/bootstrap
+ sed 's/^/      /'
      LB_DISTRIBUTION="bookworm"
      LB_MIRROR_BOOTSTRAP="http://deb.debian.org/debian/"
      LB_MIRROR_CHROOT_SECURITY="http://security.debian.org/debian-security/"
+ for f in config/bootstrap config/common
+ [[ -f config/common ]]
+ echo '  --- config/common'
  --- config/common
+ sed 's/^/      /'
+ grep -E '^LB_(DISTRIBUTION|MIRROR_BOOTSTRAP|MIRROR_CHROOT_SECURITY)=' config/common
+ true
+ bad_config=0
+ for want in 'LB_DISTRIBUTION=.*bookworm' 'LB_ARCHIVE_AREAS=.*non-free-firmware' 'LB_BOOTLOADERS=.*grub-efi' 'LB_IMAGE_NAME=.*THADD-OS'
+ grep -qE 'LB_DISTRIBUTION=.*bookworm' config/binary
+ echo '  ✗ config/binary does not carry: LB_DISTRIBUTION=.*bookworm'
  ✗ config/binary does not carry: LB_DISTRIBUTION=.*bookworm
+ bad_config=1
+ for want in 'LB_DISTRIBUTION=.*bookworm' 'LB_ARCHIVE_AREAS=.*non-free-firmware' 'LB_BOOTLOADERS=.*grub-efi' 'LB_IMAGE_NAME=.*THADD-OS'
+ grep -qE 'LB_ARCHIVE_AREAS=.*non-free-firmware' config/binary
+ echo '  ✗ config/binary does not carry: LB_ARCHIVE_AREAS=.*non-free-firmware'
  ✗ config/binary does not carry: LB_ARCHIVE_AREAS=.*non-free-firmware
+ bad_config=1
+ for want in 'LB_DISTRIBUTION=.*bookworm' 'LB_ARCHIVE_AREAS=.*non-free-firmware' 'LB_BOOTLOADERS=.*grub-efi' 'LB_IMAGE_NAME=.*THADD-OS'
+ grep -qE 'LB_BOOTLOADERS=.*grub-efi' config/binary
+ ok 'config/binary: LB_BOOTLOADERS=.*grub-efi'
+ printf '%s  ✓%s %s\n' '[38;5;42m' '[0m' 'config/binary: LB_BOOTLOADERS=.*grub-efi'
[38;5;42m  ✓[0m config/binary: LB_BOOTLOADERS=.*grub-efi
+ for want in 'LB_DISTRIBUTION=.*bookworm' 'LB_ARCHIVE_AREAS=.*non-free-firmware' 'LB_BOOTLOADERS=.*grub-efi' 'LB_IMAGE_NAME=.*THADD-OS'
+ grep -qE 'LB_IMAGE_NAME=.*THADD-OS' config/binary
+ echo '  ✗ config/binary does not carry: LB_IMAGE_NAME=.*THADD-OS'
  ✗ config/binary does not carry: LB_IMAGE_NAME=.*THADD-OS
+ bad_config=1
+ ((  bad_config  ))
+ echo '  --- what live-build actually kept ---'
  --- what live-build actually kept ---
+ grep -E '^LB_(DISTRIBUTION|ARCHIVE_AREAS|BOOTLOADERS|IMAGE_NAME|BOOTAPPEND|COMPRESSION|APT_OPTIONS|BINARY_IMAGE)=' config/binary
LB_BOOTLOADERS="syslinux grub-efi"
LB_COMPRESSION="xz"
+ die 'live-build kept the wrong configuration (see the dump above)'
+ printf '%s  ✗ %s%s\n' '[38;5;203m' 'live-build kept the wrong configuration (see the dump above)' '[0m'
[38;5;203m  ✗ live-build kept the wrong configuration (see the dump above)[0m
+ exit 1

===== suites and mirrors the build actually contacted =====
```
