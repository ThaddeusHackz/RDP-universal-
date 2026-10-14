# THADD OS desktop ISO - live-build report

- run: [38488668111](https://github.com/ThaddeusHackz/THADD-OS---THE-REVERSE-ENGINEERED-OS-/actions/runs/38488668111)
- commit: `88470ae727178f374e0b8cfd203df69264436136`
- result: **failed**

```
== ls dist ==
total 968
drwxr-xr-x  2 runner runner   4096 Oct 14 00:11 .
drwxr-xr-x 17 runner runner   4096 Oct 14 00:11 ..
-rw-r--r--  1 root   root   474504 Oct 14 00:16 build.log
-rw-r--r--  1 runner runner 507330 Oct 14 00:16 desktop-build-trace.log
== ls iso ==
total 96
drwxr-xr-x  9 runner runner  4096 Oct 14 00:16 .
drwxr-xr-x 17 runner runner  4096 Oct 14 00:11 ..
drwxr-xr-x  2 root   root    4096 Oct 14 00:16 .build
drwxr-xr-x  2 runner runner  4096 Oct 14 00:10 auto
-rwxr-xr-x  1 runner runner 15156 Oct 14 00:10 build.sh
drwxr-xr-x  6 root   root    4096 Oct 14 00:12 cache
drwxr-xr-x 18 root   root    4096 Oct 14 00:15 chroot
-rw-r--r--  1 root   root   30062 Oct 14 00:15 chroot.packages.install
drwxr-xr-x 21 runner runner  4096 Oct 14 00:11 config
drwxr-xr-x  3 root   root    4096 Oct 14 00:11 local
drwxr-xr-x  2 runner runner  4096 Oct 14 00:10 tests
-rw-r--r--  1 runner runner  7740 Oct 14 00:10 verify.sh
-rw-r--r--  1 runner runner    53 Oct 14 00:10 version.env

== iso/config/common ==
LB_CONFIGURATION_VERSION="20230502"
LB_APT="apt"
LB_APT_HTTP_PROXY=""
LB_APT_PIPELINE=""
LB_APT_RECOMMENDS="false"
LB_APT_SECURE="true"
LB_APT_SOURCE_ARCHIVES="true"
LB_CACHE="true"
LB_CACHE_INDICES="false"
LB_CACHE_PACKAGES="true"
LB_CACHE_STAGES="bootstrap"
LB_DEBCONF_FRONTEND="noninteractive"
LB_DEBCONF_PRIORITY="critical"
LB_INITRAMFS="live-boot"
LB_INITRAMFS_COMPRESSION="gzip"
LB_INITSYSTEM="systemd"
LB_MODE="debian"
LB_SYSTEM="live"
LB_IMAGE_NAME="THADD-OS-2026.10.14"
APT_OPTIONS="--yes --no-install-recommends -o Acquire::Retries=5"
APTITUDE_OPTIONS="--assume-yes -o Acquire::Retries=5"
DEBOOTSTRAP_OPTIONS="--variant=minbase --include=ca-certificates,apt-transport-https,gnupg"
DEBOOTSTRAP_SCRIPT=""
GZIP_OPTIONS="-6 --rsyncable"
LB_UTC_TIME="false"
== iso/config/bootstrap ==
LB_ARCHITECTURE="amd64"
LB_DISTRIBUTION="bookworm"
LB_PARENT_DISTRIBUTION="bookworm"
LB_DISTRIBUTION_CHROOT="bookworm"
LB_PARENT_DISTRIBUTION_CHROOT="bookworm"
LB_DISTRIBUTION_BINARY="bookworm"
LB_PARENT_DISTRIBUTION_BINARY="bookworm"
LB_PARENT_DEBIAN_INSTALLER_DISTRIBUTION="bookworm"
LB_ARCHIVE_AREAS="main contrib non-free non-free-firmware"
LB_PARENT_ARCHIVE_AREAS="main contrib non-free non-free-firmware"
LB_PARENT_MIRROR_BOOTSTRAP="http://deb.debian.org/debian/"
LB_PARENT_MIRROR_CHROOT="http://deb.debian.org/debian/"
LB_PARENT_MIRROR_CHROOT_SECURITY="http://security.debian.org/debian-security/"
LB_PARENT_MIRROR_BINARY="http://deb.debian.org/debian/"
LB_PARENT_MIRROR_BINARY_SECURITY="http://security.debian.org/debian-security/"
LB_PARENT_MIRROR_DEBIAN_INSTALLER="http://deb.debian.org/debian/"
LB_MIRROR_BOOTSTRAP="http://deb.debian.org/debian/"
LB_MIRROR_CHROOT="http://deb.debian.org/debian/"
LB_MIRROR_CHROOT_SECURITY="http://security.debian.org/debian-security/"
LB_MIRROR_BINARY="http://deb.debian.org/debian/"
LB_MIRROR_BINARY_SECURITY="http://security.debian.org/debian-security/"
LB_MIRROR_DEBIAN_INSTALLER="http://deb.debian.org/debian/"
LB_BOOTSTRAP_QEMU_ARCHITECTURE=""
LB_BOOTSTRAP_QEMU_EXCLUDE=""
LB_BOOTSTRAP_QEMU_STATIC=""
== iso/config/chroot ==
LB_CHROOT_FILESYSTEM="squashfs"
LB_CHROOT_SQUASHFS_COMPRESSION_LEVEL=""
LB_CHROOT_SQUASHFS_COMPRESSION_TYPE="xz"
LB_UNION_FILESYSTEM="overlay"
LB_INTERACTIVE="false"
LB_KEYRING_PACKAGES="debian-archive-keyring"
LB_LINUX_FLAVOURS_WITH_ARCH="amd64"
LB_LINUX_PACKAGES="linux-image"
LB_SECURITY="true"
LB_UPDATES="true"
LB_BACKPORTS="false"
== iso/config/binary ==
LB_IMAGE_TYPE="iso-hybrid"
LB_BINARY_FILESYSTEM="fat32"
LB_APT_INDICES="false"
LB_BOOTAPPEND_LIVE="boot=live components quiet noswap username=thadd user-fullname=THADD hostname=thadd-os locales=en_US.UTF-8 keyboard-layouts=us timezone=UTC persistence persistence-label=THADD-PERSISTENCE"
LB_BOOTAPPEND_INSTALL=""
LB_BOOTAPPEND_LIVE_FAILSAFE="boot=live components username=thadd hostname=thadd-os locales=en_US.UTF-8 keyboard-layouts=us timezone=UTC nox11"
LB_BOOTLOADER_BIOS="syslinux"
LB_BOOTLOADER_EFI="grub-efi"
LB_BOOTLOADERS="syslinux grub-efi"
LB_CHECKSUMS="sha256"
LB_COMPRESSION="xz"
LB_DM_VERITY=""
LB_DM_VERITY_FEC_ROOTS=""
LB_DM_VERITY_SIGN=""
LB_ZSYNC="false"
LB_BUILD_WITH_CHROOT="true"
LB_DEBIAN_INSTALLER="none"
LB_DEBIAN_INSTALLER_DISTRIBUTION="bookworm"
LB_DEBIAN_INSTALLER_PRESEEDFILE=""
LB_DEBIAN_INSTALLER_GUI="true"
LB_HDD_LABEL="DEBIAN_LIVE"
LB_HDD_SIZE="auto"
LB_HDD_PARTITION_START=""
LB_ISO_APPLICATION="THADD OS 2026.10.14 — One OS. Every Capability."
LB_ISO_PREPARER="THADD OS build system <noreply@thadd.os>"
LB_ISO_PUBLISHER="THADD OS Project — https://github.com/ThaddeusHackz/RDP-universal-"
LB_ISO_VOLUME="THADD_OS"
LB_MEMTEST="none"
LB_LOADLIN="false"
LB_NET_TARBALL="true"
LB_ONIE="false"
LB_ONIE_KERNEL_CMDLINE=""
LB_FIRMWARE_BINARY="true"
LB_FIRMWARE_CHROOT="true"
LB_SWAP_FILE_PATH=""
LB_SWAP_FILE_SIZE="512"
LB_UEFI_SECURE_BOOT="disable"
== iso/config/source ==
LB_SOURCE="false"
LB_SOURCE_IMAGES="tar"
== did iso/auto/config run? ==
164:+ [[ -f auto/config ]]
165:+ chmod +x auto/config
186:+ ./auto/config
188:P: Updating config tree for a debian/bookworm/amd64 system
190:[38;5;42m  ✓[0m iso/auto/config applied (every flag on the lb config command line)
191:+ ok 'iso/auto/config applied (every flag on the lb config command line)'
192:+ printf '%s  ✓%s %s\n' '[38;5;42m' '[0m' 'iso/auto/config applied (every flag on the lb config command line)'
== what the staged lists ask for ==
   68 iso/config/package-lists/00-core.list.chroot
   88 iso/config/package-lists/10-desktop.list.chroot
    4 iso/config/package-lists/live.list.chroot
   67 iso/config/packages/optional-desktop.txt
  205 iso/config/packages/optional-dev.txt
  113 iso/config/packages/optional-extras.txt
   21 iso/config/packages/optional-firmware.txt
  180 iso/config/packages/optional-forensics.txt
  168 iso/config/packages/optional-security.txt
  914 total
iso/config/package-lists/00-core.list.chroot:68:firmware-linux-free
iso/config/packages/optional-firmware.txt:12:firmware-linux-free
iso/config/packages/optional-firmware.txt:13:firmware-linux-nonfree
iso/config/packages/optional-firmware.txt:14:firmware-misc-nonfree
iso/config/packages/optional-firmware.txt:15:firmware-realtek
iso/config/packages/optional-firmware.txt:16:firmware-iwlwifi
iso/config/packages/optional-firmware.txt:17:firmware-atheros
iso/config/packages/optional-firmware.txt:18:firmware-brcm80211
iso/config/packages/optional-firmware.txt:19:firmware-amd-graphics

===== dist/build.log (first 40 lines) =====
[2026-10-14 00:11:20] lb build 
P: live-build 20230502
P: Building for a debian/bookworm/amd64 system
[2026-10-14 00:11:20] lb bootstrap 
P: Setting up clean exit handler
[2026-10-14 00:11:20] lb bootstrap_cache restore
[2026-10-14 00:11:20] lb bootstrap_debootstrap 
P: Begin bootstrapping system...
P: If the following stage fails, the most likely cause of the problem is with your mirror configuration or a caching proxy.
P: Running debootstrap (download-only)...
I: Retrieving InRelease 
I: Checking Release signature
I: Valid Release signature (key id 4D64FEC119C2029067D6E791F8D2585B8783D481)
I: Retrieving Packages 
I: Validating Packages 
I: Retrieving Packages 
I: Validating Packages 
I: Retrieving Packages 
I: Validating Packages 
I: Retrieving Packages 
I: Validating Packages 
I: Resolving dependencies of required packages...
I: Resolving dependencies of base packages...
I: Checking component main on http://deb.debian.org/debian...
I: Retrieving adduser 3.134
I: Validating adduser 3.134
I: Retrieving apt 2.6.1
I: Validating apt 2.6.1
I: Retrieving apt-transport-https 2.6.1
I: Validating apt-transport-https 2.6.1
I: Retrieving base-files 12.4+deb12u15
I: Validating base-files 12.4+deb12u15
I: Retrieving base-passwd 3.6.1
I: Validating base-passwd 3.6.1
I: Retrieving bash 5.2.15-2+b13
I: Validating bash 5.2.15-2+b13
I: Retrieving bsdutils 1:2.38.1-5+deb12u3
I: Validating bsdutils 1:2.38.1-5+deb12u3
I: Retrieving ca-certificates 20230311+deb12u1
I: Validating ca-certificates 20230311+deb12u1

===== dist/build.log (last 120 lines) =====
etc/skel/skel/.config/plank/
etc/skel/skel/.config/plank/dock1/
etc/skel/skel/.config/plank/dock1/settings
etc/skel/skel/.config/plank/dock1/launchers/
etc/skel/skel/.config/plank/dock1/launchers/files.dockitem
etc/skel/skel/.config/plank/dock1/launchers/firefox.dockitem
etc/skel/skel/.config/plank/dock1/launchers/logout.dockitem
etc/skel/skel/.config/plank/dock1/launchers/monitor.dockitem
etc/skel/skel/.config/plank/dock1/launchers/settings.dockitem
etc/skel/skel/.config/plank/dock1/launchers/terminal.dockitem
etc/skel/skel/.config/xfce4/
etc/skel/skel/.config/xfce4/terminal/
etc/skel/skel/.config/xfce4/terminal/terminalrc
etc/skel/skel/.config/xfce4/xfconf/
etc/skel/skel/.config/xfce4/xfconf/xfce-perchannel-xml/
etc/skel/skel/.config/xfce4/xfconf/xfce-perchannel-xml/xfce4-desktop.xml
etc/skel/skel/.config/xfce4/xfconf/xfce-perchannel-xml/xfce4-panel.xml
etc/skel/skel/.config/xfce4/xfconf/xfce-perchannel-xml/xfwm4.xml
etc/skel/skel/.config/xfce4/xfconf/xfce-perchannel-xml/xsettings.xml
etc/skel/skel/.vnc/
etc/skel/skel/.vnc/xstartup
etc/skel/skel/Desktop/
etc/skel/skel/Desktop/THADD-OS-README.txt
etc/thadd/
etc/thadd/build-info
opt/thadd/
opt/thadd/ai/
opt/thadd/ai/ai/
opt/thadd/ai/ai/test_ai.py
opt/thadd/ai/ai/thadd-ai.py
opt/thadd/desktop/
opt/thadd/desktop/desktop/
opt/thadd/desktop/desktop/favicon.png
opt/thadd/desktop/desktop/index.html
opt/thadd/desktop/desktop/logo.png
opt/thadd/desktop/desktop/shell.html
opt/thadd/desktop/desktop/css/
opt/thadd/desktop/desktop/css/apps.css
opt/thadd/desktop/desktop/css/base.css
opt/thadd/desktop/desktop/dist/
opt/thadd/desktop/desktop/dist/thadd-shell.js
opt/thadd/desktop/desktop/js/
opt/thadd/desktop/desktop/js/core.js
opt/thadd/desktop/desktop/js/kernel.js
opt/thadd/desktop/desktop/js/native.js
opt/thadd/desktop/desktop/js/registry.js
opt/thadd/desktop/desktop/js/shell.js
opt/thadd/desktop/desktop/js/wm.js
opt/thadd/desktop/desktop/js/apps/
opt/thadd/desktop/desktop/js/apps/browser.js
opt/thadd/desktop/desktop/js/apps/dev.js
opt/thadd/desktop/desktop/js/apps/editor.js
opt/thadd/desktop/desktop/js/apps/files.js
opt/thadd/desktop/desktop/js/apps/guide.js
opt/thadd/desktop/desktop/js/apps/index.js
opt/thadd/desktop/desktop/js/apps/jarvis.js
opt/thadd/desktop/desktop/js/apps/misc.js
opt/thadd/desktop/desktop/js/apps/monitor.js
opt/thadd/desktop/desktop/js/apps/parrot.js
opt/thadd/desktop/desktop/js/apps/screenshot.js
opt/thadd/desktop/desktop/js/apps/settings.js
opt/thadd/desktop/desktop/js/apps/shield.js
opt/thadd/desktop/desktop/js/apps/store.js
opt/thadd/desktop/desktop/js/apps/system.js
opt/thadd/desktop/desktop/js/apps/terminal.js
opt/thadd/iso-packages/
opt/thadd/iso-packages/optional-desktop.txt
opt/thadd/iso-packages/optional-dev.txt
opt/thadd/iso-packages/optional-extras.txt
opt/thadd/iso-packages/optional-firmware.txt
opt/thadd/iso-packages/optional-forensics.txt
opt/thadd/iso-packages/optional-security.txt
opt/thadd/security/
opt/thadd/security/security/
opt/thadd/security/security/thadd-scan
opt/thadd/tools/
opt/thadd/tools/tools/
opt/thadd/tools/tools/build-shell.sh
opt/thadd/tools/tools/install-iso-workflow.sh
opt/thadd/tools/tools/syntax-check.sh
opt/thadd/tools/tools/thadd-welcome
opt/thadd/tools/tools/bin/
opt/thadd/tools/tools/bin/thadd-apt-safe
opt/thadd/tools/tools/tests/
opt/thadd/tools/tools/tests/README.md
opt/thadd/tools/tools/tests/bundle.mjs
opt/thadd/tools/tools/tests/deep.mjs
opt/thadd/tools/tools/tests/package.json
opt/thadd/tools/tools/tests/smoke.mjs
usr/local/local/
usr/local/local/bin/
usr/local/local/bin/thadd
usr/local/local/bin/thadd-desktop-server
usr/local/local/bin/thadd-shell-session

sent 1,163,287 bytes  received 1,743 bytes  2,330,060.00 bytes/sec
total size is 1,156,224  speedup is 0.99
[2026-10-14 00:15:27] lb chroot_hooks 
P: Begin executing hooks...
P: Executing hook config/hooks/normal/0000-thadd-apt-safe.hook.chroot...
──────────────────────────────────────────────────────────
 THADD OS · optional package sets (tolerant install)
──────────────────────────────────────────────────────────
thadd-apt-safe not staged — skipping optional sets
P: Executing hook config/hooks/normal/0100-thadd-runtimes.hook.chroot...
── THADD OS · runtimes ──
! nodejs.org unreachable — falling back to the distro package
✓ npm globals: rea-agents typescript ts-node pnpm yarn eslint prettier
✓ REA available: installed
✓ runtimes stage complete
P: Executing hook config/hooks/normal/0200-thadd-identity.hook.chroot...
── THADD OS · identity 2026.10.14 (aurora) ──
useradd: group thadd exists - if you want to add this user to that group, use -g.
E: config/hooks/normal/0200-thadd-identity.hook.chroot failed (exit non-zero). You should check for errors.
E: An unexpected failure occurred, exiting...
P: Begin unmounting filesystems...
P: Saving caches...
Reading package lists...
Building dependency tree...
Reading state information...

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
+ VERSION=2026.10.14
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
opt/thadd/iso-packages/
opt/thadd/iso-packages/optional-desktop.txt
opt/thadd/iso-packages/optional-dev.txt
opt/thadd/iso-packages/optional-extras.txt
opt/thadd/iso-packages/optional-firmware.txt
opt/thadd/iso-packages/optional-forensics.txt
opt/thadd/iso-packages/optional-security.txt
opt/thadd/security/
opt/thadd/security/security/
opt/thadd/security/security/thadd-scan
opt/thadd/tools/
opt/thadd/tools/tools/
opt/thadd/tools/tools/build-shell.sh
opt/thadd/tools/tools/install-iso-workflow.sh
opt/thadd/tools/tools/syntax-check.sh
opt/thadd/tools/tools/thadd-welcome
opt/thadd/tools/tools/bin/
opt/thadd/tools/tools/bin/thadd-apt-safe
opt/thadd/tools/tools/tests/
opt/thadd/tools/tools/tests/README.md
opt/thadd/tools/tools/tests/bundle.mjs
opt/thadd/tools/tools/tests/deep.mjs
opt/thadd/tools/tools/tests/package.json
opt/thadd/tools/tools/tests/smoke.mjs
usr/local/local/
usr/local/local/bin/
usr/local/local/bin/thadd
usr/local/local/bin/thadd-desktop-server
usr/local/local/bin/thadd-shell-session

sent 1,163,287 bytes  received 1,743 bytes  2,330,060.00 bytes/sec
total size is 1,156,224  speedup is 0.99
[2026-10-14 00:15:27] lb chroot_hooks 
P: Begin executing hooks...
P: Executing hook config/hooks/normal/0000-thadd-apt-safe.hook.chroot...
──────────────────────────────────────────────────────────
 THADD OS · optional package sets (tolerant install)
──────────────────────────────────────────────────────────
thadd-apt-safe not staged — skipping optional sets
P: Executing hook config/hooks/normal/0100-thadd-runtimes.hook.chroot...
── THADD OS · runtimes ──
! nodejs.org unreachable — falling back to the distro package
✓ npm globals: rea-agents typescript ts-node pnpm yarn eslint prettier
✓ REA available: installed
✓ runtimes stage complete
P: Executing hook config/hooks/normal/0200-thadd-identity.hook.chroot...
── THADD OS · identity 2026.10.14 (aurora) ──
useradd: group thadd exists - if you want to add this user to that group, use -g.
E: config/hooks/normal/0200-thadd-identity.hook.chroot failed (exit non-zero). You should check for errors.
E: An unexpected failure occurred, exiting...
P: Begin unmounting filesystems...
P: Saving caches...
Reading package lists...
Building dependency tree...
Reading state information...
+ tail -n 60 /work/dist/build.log
opt/thadd/desktop/desktop/js/apps/settings.js
opt/thadd/desktop/desktop/js/apps/shield.js
opt/thadd/desktop/desktop/js/apps/store.js
opt/thadd/desktop/desktop/js/apps/system.js
opt/thadd/desktop/desktop/js/apps/terminal.js
opt/thadd/iso-packages/
opt/thadd/iso-packages/optional-desktop.txt
opt/thadd/iso-packages/optional-dev.txt
opt/thadd/iso-packages/optional-extras.txt
opt/thadd/iso-packages/optional-firmware.txt
opt/thadd/iso-packages/optional-forensics.txt
opt/thadd/iso-packages/optional-security.txt
opt/thadd/security/
opt/thadd/security/security/
opt/thadd/security/security/thadd-scan
opt/thadd/tools/
opt/thadd/tools/tools/
opt/thadd/tools/tools/build-shell.sh
opt/thadd/tools/tools/install-iso-workflow.sh
opt/thadd/tools/tools/syntax-check.sh
opt/thadd/tools/tools/thadd-welcome
opt/thadd/tools/tools/bin/
opt/thadd/tools/tools/bin/thadd-apt-safe
opt/thadd/tools/tools/tests/
opt/thadd/tools/tools/tests/README.md
opt/thadd/tools/tools/tests/bundle.mjs
opt/thadd/tools/tools/tests/deep.mjs
opt/thadd/tools/tools/tests/package.json
opt/thadd/tools/tools/tests/smoke.mjs
usr/local/local/
usr/local/local/bin/
usr/local/local/bin/thadd
usr/local/local/bin/thadd-desktop-server
usr/local/local/bin/thadd-shell-session

sent 1,163,287 bytes  received 1,743 bytes  2,330,060.00 bytes/sec
total size is 1,156,224  speedup is 0.99
[2026-10-14 00:15:27] lb chroot_hooks 
P: Begin executing hooks...
P: Executing hook config/hooks/normal/0000-thadd-apt-safe.hook.chroot...
──────────────────────────────────────────────────────────
 THADD OS · optional package sets (tolerant install)
──────────────────────────────────────────────────────────
thadd-apt-safe not staged — skipping optional sets
P: Executing hook config/hooks/normal/0100-thadd-runtimes.hook.chroot...
── THADD OS · runtimes ──
! nodejs.org unreachable — falling back to the distro package
✓ npm globals: rea-agents typescript ts-node pnpm yarn eslint prettier
✓ REA available: installed
✓ runtimes stage complete
P: Executing hook config/hooks/normal/0200-thadd-identity.hook.chroot...
── THADD OS · identity 2026.10.14 (aurora) ──
useradd: group thadd exists - if you want to add this user to that group, use -g.
E: config/hooks/normal/0200-thadd-identity.hook.chroot failed (exit non-zero). You should check for errors.
E: An unexpected failure occurred, exiting...
P: Begin unmounting filesystems...
P: Saving caches...
Reading package lists...
Building dependency tree...
Reading state information...
+ die 'lb build failed — full log: dist/build.log'
+ printf '%s  ✗ %s%s\n' '[38;5;203m' 'lb build failed — full log: dist/build.log' '[0m'
[38;5;203m  ✗ lb build failed — full log: dist/build.log[0m
+ exit 1

===== suites and mirrors the build actually contacted =====
http://deb.debian.org/debian bookworm
http://deb.debian.org/debian bookworm-updates
http://deb.debian.org/debian bookworm-updates/main
http://deb.debian.org/debian bookworm/contrib
http://deb.debian.org/debian bookworm/main
http://deb.debian.org/debian bookworm/non-free
http://deb.debian.org/debian bookworm/non-free-firmware
http://security.debian.org/debian-security bookworm-security
http://security.debian.org/debian-security bookworm-security/contrib
http://security.debian.org/debian-security bookworm-security/main
http://security.debian.org/debian-security bookworm-security/non-free
http://security.debian.org/debian-security bookworm-security/non-free-firmware
```
