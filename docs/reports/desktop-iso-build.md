# THADD OS desktop ISO - live-build report

- run: [38485285177](https://github.com/ThaddeusHackz/THADD-OS---THE-REVERSE-ENGINEERED-OS-/actions/runs/38485285177)
- commit: `df4b9db3247b127358a71bc8ab462cfef9c9d77c`
- result: **failed**

```
== ls dist ==
total 260
drwxr-xr-x  2 runner runner   4096 Oct 13 23:37 .
drwxr-xr-x 17 runner runner   4096 Oct 13 23:37 ..
-rw-r--r--  1 root   root   115426 Oct 13 23:38 build.log
-rw-r--r--  1 runner runner 136908 Oct 13 23:38 desktop-build-trace.log
== ls iso ==
total 60
drwxr-xr-x  8 runner runner  4096 Oct 13 23:38 .
drwxr-xr-x 17 runner runner  4096 Oct 13 23:37 ..
drwxr-xr-x  2 root   root    4096 Oct 13 23:38 .build
drwxr-xr-x  2 root   root    4096 Oct 13 23:37 auto
-rwxr-xr-x  1 runner runner 12438 Oct 13 23:36 build.sh
drwxr-xr-x  6 root   root    4096 Oct 13 23:38 cache
drwxr-xr-x 17 root   root    4096 Oct 13 23:38 chroot
drwxr-xr-x 22 runner runner  4096 Oct 13 23:37 config
drwxr-xr-x  3 root   root    4096 Oct 13 23:37 local
-rw-r--r--  1 runner runner  7740 Oct 13 23:36 verify.sh
-rw-r--r--  1 runner runner    53 Oct 13 23:36 version.env

== effective live-build config (iso/config/common) ==
LB_INITSYSTEM="systemd"

===== dist/build.log (first 40 lines) =====
[2026-10-13 23:37:19] lb build 
P: live-build 20230502
P: Building for a debian/bookworm/amd64 system
[2026-10-13 23:37:20] lb bootstrap 
P: Setting up clean exit handler
[2026-10-13 23:37:20] lb bootstrap_cache restore
[2026-10-13 23:37:20] lb bootstrap_debootstrap 
P: Begin bootstrapping system...
P: If the following stage fails, the most likely cause of the problem is with your mirror configuration or a caching proxy.
P: Running debootstrap (download-only)...
I: Retrieving InRelease 
I: Checking Release signature
I: Valid Release signature (key id 4D64FEC119C2029067D6E791F8D2585B8783D481)
I: Retrieving Packages 
I: Validating Packages 
I: Resolving dependencies of required packages...
I: Resolving dependencies of base packages...
I: Checking component main on http://deb.debian.org/debian...
I: Retrieving adduser 3.134
I: Validating adduser 3.134
I: Retrieving apt 2.6.1
I: Validating apt 2.6.1
I: Retrieving apt-utils 2.6.1
I: Validating apt-utils 2.6.1
I: Retrieving base-files 12.4+deb12u15
I: Validating base-files 12.4+deb12u15
I: Retrieving base-passwd 3.6.1
I: Validating base-passwd 3.6.1
I: Retrieving bash 5.2.15-2+b13
I: Validating bash 5.2.15-2+b13
I: Retrieving bsdutils 1:2.38.1-5+deb12u3
I: Validating bsdutils 1:2.38.1-5+deb12u3
I: Retrieving coreutils 9.1-1
I: Validating coreutils 9.1-1
I: Retrieving cpio 2.13+dfsg-7.1
I: Validating cpio 2.13+dfsg-7.1
I: Retrieving cron 3.0pl1-162
I: Validating cron 3.0pl1-162
I: Retrieving cron-daemon-common 3.0pl1-162
I: Validating cron-daemon-common 3.0pl1-162

===== dist/build.log (last 120 lines) =====
  9150K .......... .......... .......... .......... .......... 81% 48.1M 0s
  9200K .......... .......... .......... .......... .......... 81% 73.6M 0s
  9250K .......... .......... .......... .......... .......... 81%  138M 0s
  9300K .......... .......... .......... .......... .......... 82% 36.0M 0s
  9350K .......... .......... .......... .......... .......... 82%  267M 0s
  9400K .......... .......... .......... .......... .......... 83% 68.1M 0s
  9450K .......... .......... .......... .......... .......... 83% 51.7M 0s
  9500K .......... .......... .......... .......... .......... 84%  136M 0s
  9550K .......... .......... .......... .......... .......... 84% 95.6M 0s
  9600K .......... .......... .......... .......... .......... 84% 55.3M 0s
  9650K .......... .......... .......... .......... .......... 85% 53.0M 0s
  9700K .......... .......... .......... .......... .......... 85% 44.7M 0s
  9750K .......... .......... .......... .......... .......... 86%  336M 0s
  9800K .......... .......... .......... .......... .......... 86%  101M 0s
  9850K .......... .......... .......... .......... .......... 87% 65.7M 0s
  9900K .......... .......... .......... .......... .......... 87% 55.2M 0s
  9950K .......... .......... .......... .......... .......... 88% 61.1M 0s
 10000K .......... .......... .......... .......... .......... 88% 57.9M 0s
 10050K .......... .......... .......... .......... .......... 88%  251M 0s
 10100K .......... .......... .......... .......... .......... 89% 48.8M 0s
 10150K .......... .......... .......... .......... .......... 89% 68.6M 0s
 10200K .......... .......... .......... .......... .......... 90% 57.9M 0s
 10250K .......... .......... .......... .......... .......... 90% 37.5M 0s
 10300K .......... .......... .......... .......... .......... 91%  265M 0s
 10350K .......... .......... .......... .......... .......... 91%  142M 0s
 10400K .......... .......... .......... .......... .......... 92% 57.8M 0s
 10450K .......... .......... .......... .......... .......... 92% 57.1M 0s
 10500K .......... .......... .......... .......... .......... 92% 52.9M 0s
 10550K .......... .......... .......... .......... .......... 93%  282M 0s
 10600K .......... .......... .......... .......... .......... 93% 83.2M 0s
 10650K .......... .......... .......... .......... .......... 94% 57.8M 0s
 10700K .......... .......... .......... .......... .......... 94% 48.8M 0s
 10750K .......... .......... .......... .......... .......... 95% 69.8M 0s
 10800K .......... .......... .......... .......... .......... 95% 47.3M 0s
 10850K .......... .......... .......... .......... .......... 95%  256M 0s
 10900K .......... .......... .......... .......... .......... 96% 38.5M 0s
 10950K .......... .......... .......... .......... .......... 96%  185M 0s
 11000K .......... .......... .......... .......... .......... 97% 59.3M 0s
 11050K .......... .......... .......... .......... .......... 97%  907K 0s
 11100K .......... .......... .......... .......... .......... 98% 37.3M 0s
 11150K .......... .......... .......... .......... .......... 98% 88.9M 0s
 11200K .......... .......... .......... .......... .......... 99% 42.5M 0s
 11250K .......... .......... .......... .......... .......... 99% 98.5M 0s
 11300K .......... .......... .......... .......... .......... 99% 44.9M 0s
 11350K ......                                                100%  143M=0.3s

2026-10-13 23:38:29 (40.9 MB/s) - 'cache/contents.chroot/bookworm/main/contents-amd64.gz' saved [11629145/11629145]

[2026-10-13 23:38:30] lb chroot_preseed 
P: Begin executing local preseeds...
[2026-10-13 23:38:30] lb chroot_includes_before_packages 
P: Begin copying chroot includes before packages have been installed...
[2026-10-13 23:38:30] lb chroot_package-lists install
P: Begin queueing installation of package lists (install pass)...
Reading package lists...
Building dependency tree...
Reading state information...
Suggested packages:
  debtags
The following NEW packages will be installed:
  dctrl-tools
0 upgraded, 1 newly installed, 0 to remove and 0 not upgraded.
Need to get 104 kB of archives.
After this operation, 432 kB of additional disk space will be used.
Get:1 http://deb.debian.org/debian bookworm/main amd64 dctrl-tools amd64 2.24-3+b1 [104 kB]
Fetched 104 kB in 0s (1095 kB/s)
Selecting previously unselected package dctrl-tools.
(Reading database ... (Reading database ... 5%(Reading database ... 10%(Reading database ... 15%(Reading database ... 20%(Reading database ... 25%(Reading database ... 30%(Reading database ... 35%(Reading database ... 40%(Reading database ... 45%(Reading database ... 50%(Reading database ... 55%(Reading database ... 60%(Reading database ... 65%(Reading database ... 70%(Reading database ... 75%(Reading database ... 80%(Reading database ... 85%(Reading database ... 90%(Reading database ... 95%(Reading database ... 100%(Reading database ... 8747 files and directories currently installed.)
Preparing to unpack .../dctrl-tools_2.24-3+b1_amd64.deb ...
Unpacking dctrl-tools (2.24-3+b1) ...
Setting up dctrl-tools (2.24-3+b1) ...
Reading package lists...
Building dependency tree...
Reading state information...
The following packages will be REMOVED:
  dctrl-tools*
0 upgraded, 0 newly installed, 1 to remove and 0 not upgraded.
After this operation, 432 kB disk space will be freed.
(Reading database ... (Reading database ... 5%(Reading database ... 10%(Reading database ... 15%(Reading database ... 20%(Reading database ... 25%(Reading database ... 30%(Reading database ... 35%(Reading database ... 40%(Reading database ... 45%(Reading database ... 50%(Reading database ... 55%(Reading database ... 60%(Reading database ... 65%(Reading database ... 70%(Reading database ... 75%(Reading database ... 80%(Reading database ... 85%(Reading database ... 90%(Reading database ... 95%(Reading database ... 100%(Reading database ... 8788 files and directories currently installed.)
Removing dctrl-tools (2.24-3+b1) ...
(Reading database ... (Reading database ... 5%(Reading database ... 10%(Reading database ... 15%(Reading database ... 20%(Reading database ... 25%(Reading database ... 30%(Reading database ... 35%(Reading database ... 40%(Reading database ... 45%(Reading database ... 50%(Reading database ... 55%(Reading database ... 60%(Reading database ... 65%(Reading database ... 70%(Reading database ... 75%(Reading database ... 80%(Reading database ... 85%(Reading database ... 90%(Reading database ... 95%(Reading database ... 100%(Reading database ... 8747 files and directories currently installed.)
Purging configuration files for dctrl-tools (2.24-3+b1) ...
Reading package lists...
Building dependency tree...
Reading state information...
[2026-10-13 23:38:32] lb chroot_install-packages install
P: Begin installing packages (install pass)...
Reading package lists...
Building dependency tree...
Reading state information...
Package firmware-linux-nonfree is not available, but is referred to by another package.
This may mean that the package is missing, has been obsoleted, or
is only available from another source

Package firmware-misc-nonfree is not available, but is referred to by another package.
This may mean that the package is missing, has been obsoleted, or
is only available from another source

Package firmware-atheros is not available, but is referred to by another package.
This may mean that the package is missing, has been obsoleted, or
is only available from another source
However the following packages replace it:
  firmware-ath9k-htc

Package firmware-realtek is not available, but is referred to by another package.
This may mean that the package is missing, has been obsoleted, or
is only available from another source

E: Package 'firmware-linux-nonfree' has no installation candidate
E: Package 'firmware-misc-nonfree' has no installation candidate
E: Package 'firmware-realtek' has no installation candidate
E: Unable to locate package firmware-iwlwifi
E: Package 'firmware-atheros' has no installation candidate
E: Unable to locate package firmware-brcm80211
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
Fetched 104 kB in 0s (1095 kB/s)
Selecting previously unselected package dctrl-tools.
(Reading database ... (Reading database ... 5%(Reading database ... 10%(Reading database ... 15%(Reading database ... 20%(Reading database ... 25%(Reading database ... 30%(Reading database ... 35%(Reading database ... 40%(Reading database ... 45%(Reading database ... 50%(Reading database ... 55%(Reading database ... 60%(Reading database ... 65%(Reading database ... 70%(Reading database ... 75%(Reading database ... 80%(Reading database ... 85%(Reading database ... 90%(Reading database ... 95%(Reading database ... 100%(Reading database ... 8747 files and directories currently installed.)
Preparing to unpack .../dctrl-tools_2.24-3+b1_amd64.deb ...
Unpacking dctrl-tools (2.24-3+b1) ...
Setting up dctrl-tools (2.24-3+b1) ...
Reading package lists...
Building dependency tree...
Reading state information...
The following packages will be REMOVED:
  dctrl-tools*
0 upgraded, 0 newly installed, 1 to remove and 0 not upgraded.
After this operation, 432 kB disk space will be freed.
(Reading database ... (Reading database ... 5%(Reading database ... 10%(Reading database ... 15%(Reading database ... 20%(Reading database ... 25%(Reading database ... 30%(Reading database ... 35%(Reading database ... 40%(Reading database ... 45%(Reading database ... 50%(Reading database ... 55%(Reading database ... 60%(Reading database ... 65%(Reading database ... 70%(Reading database ... 75%(Reading database ... 80%(Reading database ... 85%(Reading database ... 90%(Reading database ... 95%(Reading database ... 100%(Reading database ... 8788 files and directories currently installed.)
Removing dctrl-tools (2.24-3+b1) ...
(Reading database ... (Reading database ... 5%(Reading database ... 10%(Reading database ... 15%(Reading database ... 20%(Reading database ... 25%(Reading database ... 30%(Reading database ... 35%(Reading database ... 40%(Reading database ... 45%(Reading database ... 50%(Reading database ... 55%(Reading database ... 60%(Reading database ... 65%(Reading database ... 70%(Reading database ... 75%(Reading database ... 80%(Reading database ... 85%(Reading database ... 90%(Reading database ... 95%(Reading database ... 100%(Reading database ... 8747 files and directories currently installed.)
Purging configuration files for dctrl-tools (2.24-3+b1) ...
Reading package lists...
Building dependency tree...
Reading state information...
[2026-10-13 23:38:32] lb chroot_install-packages install
P: Begin installing packages (install pass)...
Reading package lists...
Building dependency tree...
Reading state information...
Package firmware-linux-nonfree is not available, but is referred to by another package.
This may mean that the package is missing, has been obsoleted, or
is only available from another source

Package firmware-misc-nonfree is not available, but is referred to by another package.
This may mean that the package is missing, has been obsoleted, or
is only available from another source

Package firmware-atheros is not available, but is referred to by another package.
This may mean that the package is missing, has been obsoleted, or
is only available from another source
However the following packages replace it:
  firmware-ath9k-htc

Package firmware-realtek is not available, but is referred to by another package.
This may mean that the package is missing, has been obsoleted, or
is only available from another source

E: Package 'firmware-linux-nonfree' has no installation candidate
E: Package 'firmware-misc-nonfree' has no installation candidate
E: Package 'firmware-realtek' has no installation candidate
E: Unable to locate package firmware-iwlwifi
E: Package 'firmware-atheros' has no installation candidate
E: Unable to locate package firmware-brcm80211
E: An unexpected failure occurred, exiting...
P: Begin unmounting filesystems...
P: Saving caches...
Reading package lists...
Building dependency tree...
Reading state information...
+ tail -n 60 /work/dist/build.log
  dctrl-tools
0 upgraded, 1 newly installed, 0 to remove and 0 not upgraded.
Need to get 104 kB of archives.
After this operation, 432 kB of additional disk space will be used.
Get:1 http://deb.debian.org/debian bookworm/main amd64 dctrl-tools amd64 2.24-3+b1 [104 kB]
Fetched 104 kB in 0s (1095 kB/s)
Selecting previously unselected package dctrl-tools.
(Reading database ... (Reading database ... 5%(Reading database ... 10%(Reading database ... 15%(Reading database ... 20%(Reading database ... 25%(Reading database ... 30%(Reading database ... 35%(Reading database ... 40%(Reading database ... 45%(Reading database ... 50%(Reading database ... 55%(Reading database ... 60%(Reading database ... 65%(Reading database ... 70%(Reading database ... 75%(Reading database ... 80%(Reading database ... 85%(Reading database ... 90%(Reading database ... 95%(Reading database ... 100%(Reading database ... 8747 files and directories currently installed.)
Preparing to unpack .../dctrl-tools_2.24-3+b1_amd64.deb ...
Unpacking dctrl-tools (2.24-3+b1) ...
Setting up dctrl-tools (2.24-3+b1) ...
Reading package lists...
Building dependency tree...
Reading state information...
The following packages will be REMOVED:
  dctrl-tools*
0 upgraded, 0 newly installed, 1 to remove and 0 not upgraded.
After this operation, 432 kB disk space will be freed.
(Reading database ... (Reading database ... 5%(Reading database ... 10%(Reading database ... 15%(Reading database ... 20%(Reading database ... 25%(Reading database ... 30%(Reading database ... 35%(Reading database ... 40%(Reading database ... 45%(Reading database ... 50%(Reading database ... 55%(Reading database ... 60%(Reading database ... 65%(Reading database ... 70%(Reading database ... 75%(Reading database ... 80%(Reading database ... 85%(Reading database ... 90%(Reading database ... 95%(Reading database ... 100%(Reading database ... 8788 files and directories currently installed.)
Removing dctrl-tools (2.24-3+b1) ...
(Reading database ... (Reading database ... 5%(Reading database ... 10%(Reading database ... 15%(Reading database ... 20%(Reading database ... 25%(Reading database ... 30%(Reading database ... 35%(Reading database ... 40%(Reading database ... 45%(Reading database ... 50%(Reading database ... 55%(Reading database ... 60%(Reading database ... 65%(Reading database ... 70%(Reading database ... 75%(Reading database ... 80%(Reading database ... 85%(Reading database ... 90%(Reading database ... 95%(Reading database ... 100%(Reading database ... 8747 files and directories currently installed.)
Purging configuration files for dctrl-tools (2.24-3+b1) ...
Reading package lists...
Building dependency tree...
Reading state information...
[2026-10-13 23:38:32] lb chroot_install-packages install
P: Begin installing packages (install pass)...
Reading package lists...
Building dependency tree...
Reading state information...
Package firmware-linux-nonfree is not available, but is referred to by another package.
This may mean that the package is missing, has been obsoleted, or
is only available from another source

Package firmware-misc-nonfree is not available, but is referred to by another package.
This may mean that the package is missing, has been obsoleted, or
is only available from another source

Package firmware-atheros is not available, but is referred to by another package.
This may mean that the package is missing, has been obsoleted, or
is only available from another source
However the following packages replace it:
  firmware-ath9k-htc

Package firmware-realtek is not available, but is referred to by another package.
This may mean that the package is missing, has been obsoleted, or
is only available from another source

E: Package 'firmware-linux-nonfree' has no installation candidate
E: Package 'firmware-misc-nonfree' has no installation candidate
E: Package 'firmware-realtek' has no installation candidate
E: Unable to locate package firmware-iwlwifi
E: Package 'firmware-atheros' has no installation candidate
E: Unable to locate package firmware-brcm80211
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
http://deb.debian.org/debian bookworm/main
http://security.debian.org/debian-security bookworm-security
http://security.debian.org/debian-security bookworm-security/main
```
