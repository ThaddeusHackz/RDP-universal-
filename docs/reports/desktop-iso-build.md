# THADD OS desktop ISO - live-build report

- run: [38481305384](https://github.com/ThaddeusHackz/THADD-OS---THE-REVERSE-ENGINEERED-OS-/actions/runs/38481305384)
- commit: `b20cb8ca2d5b8439cf70c46515afeb7460cbd252`
- result: **failed**

```
== ls dist ==
total 16
drwxr-xr-x  2 runner runner 4096 Oct 13 22:58 .
drwxr-xr-x 17 runner runner 4096 Oct 13 22:58 ..
-rw-r--r--  1 runner runner 7517 Oct 13 22:59 desktop-build-trace.log
== ls iso ==
total 36
drwxr-xr-x  3 runner runner 4096 Oct 13 22:58 .
drwxr-xr-x 17 runner runner 4096 Oct 13 22:58 ..
-rwxr-xr-x  1 runner runner 9063 Oct 13 22:58 build.sh
drwxr-xr-x  7 runner runner 4096 Oct 13 22:59 config
-rw-r--r--  1 runner runner 7740 Oct 13 22:58 verify.sh
-rw-r--r--  1 runner runner   53 Oct 13 22:58 version.env

===== dist/desktop-build-trace.log (last 150 lines) =====
debconf: delaying package configuration, since apt-utils is not installed
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
+ ((  0  ))
+ command -v lb
++ nproc
+ log 'THADD OS 2026.10.13 (aurora) · profile=desktop · 4 cores'
+ printf '%s[thadd-iso]%s %s\n' '[38;5;39m' '[0m' 'THADD OS 2026.10.13 (aurora) · profile=desktop · 4 cores'
[38;5;39m[thadd-iso][0m THADD OS 2026.10.13 (aurora) · profile=desktop · 4 cores
+ mkdir -p /work/dist
+ OVERLAY=/work/iso/config/includes.chroot
++ realpath --relative-to=/work /work/iso/config/includes.chroot
+ log 'staging overlay -> iso/config/includes.chroot'
+ printf '%s[thadd-iso]%s %s\n' '[38;5;39m' '[0m' 'staging overlay -> iso/config/includes.chroot'
[38;5;39m[thadd-iso][0m staging overlay -> iso/config/includes.chroot
+ stage os/etc etc
+ local src=/work/os/etc dest=/work/iso/config/includes.chroot/etc
+ [[ -e /work/os/etc ]]
++ dirname /work/iso/config/includes.chroot/etc
+ mkdir -p /work/iso/config/includes.chroot
+ rm -rf /work/iso/config/includes.chroot/etc
+ rsync -a --exclude node_modules/ --exclude __pycache__/ --exclude '*.pyc' --exclude bundle.js --exclude '*.log' --exclude .git/ --exclude package-lock.json /work/os/etc /work/iso/config/includes.chroot/etc
[38;5;42m  ✓[0m os/etc -> /etc
+ ok 'os/etc -> /etc'
+ printf '%s  ✓%s %s\n' '[38;5;42m' '[0m' 'os/etc -> /etc'
+ stage os/usr/local usr/local
+ local src=/work/os/usr/local dest=/work/iso/config/includes.chroot/usr/local
+ [[ -e /work/os/usr/local ]]
++ dirname /work/iso/config/includes.chroot/usr/local
+ mkdir -p /work/iso/config/includes.chroot/usr
+ rm -rf /work/iso/config/includes.chroot/usr/local
+ rsync -a --exclude node_modules/ --exclude __pycache__/ --exclude '*.pyc' --exclude bundle.js --exclude '*.log' --exclude .git/ --exclude package-lock.json /work/os/usr/local /work/iso/config/includes.chroot/usr/local
[38;5;42m  ✓[0m os/usr/local -> /usr/local
+ ok 'os/usr/local -> /usr/local'
+ printf '%s  ✓%s %s\n' '[38;5;42m' '[0m' 'os/usr/local -> /usr/local'
+ stage cloud/skel etc/skel
+ local src=/work/cloud/skel dest=/work/iso/config/includes.chroot/etc/skel
+ [[ -e /work/cloud/skel ]]
++ dirname /work/iso/config/includes.chroot/etc/skel
+ mkdir -p /work/iso/config/includes.chroot/etc
+ rm -rf /work/iso/config/includes.chroot/etc/skel
+ rsync -a --exclude node_modules/ --exclude __pycache__/ --exclude '*.pyc' --exclude bundle.js --exclude '*.log' --exclude .git/ --exclude package-lock.json /work/cloud/skel /work/iso/config/includes.chroot/etc/skel
+ ok 'cloud/skel -> /etc/skel'
+ printf '%s  ✓%s %s\n' '[38;5;42m' '[0m' 'cloud/skel -> /etc/skel'
+ stage ai opt/thadd/ai
+ local src=/work/ai dest=/work/iso/config/includes.chroot/opt/thadd/ai
+ [[ -e /work/ai ]]
[38;5;42m  ✓[0m cloud/skel -> /etc/skel
++ dirname /work/iso/config/includes.chroot/opt/thadd/ai
+ mkdir -p /work/iso/config/includes.chroot/opt/thadd
+ rm -rf /work/iso/config/includes.chroot/opt/thadd/ai
+ rsync -a --exclude node_modules/ --exclude __pycache__/ --exclude '*.pyc' --exclude bundle.js --exclude '*.log' --exclude .git/ --exclude package-lock.json /work/ai /work/iso/config/includes.chroot/opt/thadd/ai
[38;5;42m  ✓[0m ai -> /opt/thadd/ai
+ ok 'ai -> /opt/thadd/ai'
+ printf '%s  ✓%s %s\n' '[38;5;42m' '[0m' 'ai -> /opt/thadd/ai'
+ stage desktop opt/thadd/desktop
+ local src=/work/desktop dest=/work/iso/config/includes.chroot/opt/thadd/desktop
+ [[ -e /work/desktop ]]
++ dirname /work/iso/config/includes.chroot/opt/thadd/desktop
+ mkdir -p /work/iso/config/includes.chroot/opt/thadd
+ rm -rf /work/iso/config/includes.chroot/opt/thadd/desktop
+ rsync -a --exclude node_modules/ --exclude __pycache__/ --exclude '*.pyc' --exclude bundle.js --exclude '*.log' --exclude .git/ --exclude package-lock.json /work/desktop /work/iso/config/includes.chroot/opt/thadd/desktop
+ ok 'desktop -> /opt/thadd/desktop'
+ printf '%s  ✓%s %s\n' '[38;5;42m' '[0m' 'desktop -> /opt/thadd/desktop'
+ stage security opt/thadd/security
+ local src=/work/security dest=/work/iso/config/includes.chroot/opt/thadd/security
+ [[ -e /work/security ]]
[38;5;42m  ✓[0m desktop -> /opt/thadd/desktop
++ dirname /work/iso/config/includes.chroot/opt/thadd/security
+ mkdir -p /work/iso/config/includes.chroot/opt/thadd
+ rm -rf /work/iso/config/includes.chroot/opt/thadd/security
+ rsync -a --exclude node_modules/ --exclude __pycache__/ --exclude '*.pyc' --exclude bundle.js --exclude '*.log' --exclude .git/ --exclude package-lock.json /work/security /work/iso/config/includes.chroot/opt/thadd/security
+ ok 'security -> /opt/thadd/security'
+ printf '%s  ✓%s %s\n' '[38;5;42m' '[0m' 'security -> /opt/thadd/security'
+ stage tools opt/thadd/tools
[38;5;42m  ✓[0m security -> /opt/thadd/security
+ local src=/work/tools dest=/work/iso/config/includes.chroot/opt/thadd/tools
+ [[ -e /work/tools ]]
++ dirname /work/iso/config/includes.chroot/opt/thadd/tools
+ mkdir -p /work/iso/config/includes.chroot/opt/thadd
+ rm -rf /work/iso/config/includes.chroot/opt/thadd/tools
+ rsync -a --exclude node_modules/ --exclude __pycache__/ --exclude '*.pyc' --exclude bundle.js --exclude '*.log' --exclude .git/ --exclude package-lock.json /work/tools /work/iso/config/includes.chroot/opt/thadd/tools
+ ok 'tools -> /opt/thadd/tools'
+ printf '%s  ✓%s %s\n' '[38;5;42m' '[0m' 'tools -> /opt/thadd/tools'
+ stage reverse-engineering opt/thadd/reverse-engineering
+ local src=/work/reverse-engineering dest=/work/iso/config/includes.chroot/opt/thadd/reverse-engineering
+ [[ -e /work/reverse-engineering ]]
[38;5;42m  ✓[0m tools -> /opt/thadd/tools
+ warn 'skip staging reverse-engineering (missing)'
+ printf '%s  !%s %s\n' '[38;5;214m' '[0m' 'skip staging reverse-engineering (missing)'
+ return 0
+ mkdir -p /work/iso/config/includes.chroot/opt/thadd/iso-packages
[38;5;214m  ![0m skip staging reverse-engineering (missing)
+ cp -f /work/iso/config/packages/optional-desktop.txt /work/iso/config/packages/optional-dev.txt /work/iso/config/packages/optional-extras.txt /work/iso/config/packages/optional-forensics.txt /work/iso/config/packages/optional-security.txt /work/iso/config/includes.chroot/opt/thadd/iso-packages/
++ ls -1 /work/iso/config/includes.chroot/opt/thadd/iso-packages
++ wc -l
+ ok 'package sets -> /opt/thadd/iso-packages (5 lists)'
+ printf '%s  ✓%s %s\n' '[38;5;42m' '[0m' 'package sets -> /opt/thadd/iso-packages (5 lists)'
[38;5;42m  ✓[0m package sets -> /opt/thadd/iso-packages (5 lists)
+ [[ desktop == \m\i\n\i\m\a\l ]]
+ [[ -d /work/iso/config/includes.chroot/opt/thadd/desktop/skel ]]
./iso/build.sh: line 129: /work/iso/config/includes.chroot/etc/thadd/build-info: No such file or directory
```
