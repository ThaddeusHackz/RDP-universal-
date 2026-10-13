# THADD OS desktop ISO - live-build report

- run: [38481738473](https://github.com/ThaddeusHackz/THADD-OS---THE-REVERSE-ENGINEERED-OS-/actions/runs/38481738473)
- commit: `56128ca2879e37da7eeaecd040734ed2a082fecd`
- result: **failed**

```
== ls dist ==
total 120
drwxr-xr-x  2 runner runner  4096 Oct 13 23:03 .
drwxr-xr-x 17 runner runner  4096 Oct 13 23:02 ..
-rw-r--r--  1 root   root   46640 Oct 13 23:04 build.log
-rw-r--r--  1 runner runner 62613 Oct 13 23:04 desktop-build-trace.log
== ls iso ==
total 56
drwxr-xr-x  8 runner runner 4096 Oct 13 23:04 .
drwxr-xr-x 17 runner runner 4096 Oct 13 23:02 ..
drwxr-xr-x  2 root   root   4096 Oct 13 23:04 .build
drwxr-xr-x  2 root   root   4096 Oct 13 23:03 auto
-rwxr-xr-x  1 runner runner 9027 Oct 13 23:02 build.sh
drwxr-xr-x  4 root   root   4096 Oct 13 23:03 cache
drwxr-xr-x 17 root   root   4096 Oct 13 23:03 chroot
drwxr-xr-x 22 runner runner 4096 Oct 13 23:03 config
drwxr-xr-x  3 root   root   4096 Oct 13 23:03 local
-rw-r--r--  1 runner runner 7740 Oct 13 23:02 verify.sh
-rw-r--r--  1 runner runner   53 Oct 13 23:02 version.env

===== dist/build.log (last 150 lines) =====
Get:5 http://security.debian.org bullseye-security/main Sources [311 kB]
Get:6 http://security.debian.org bullseye-security/main amd64 Packages [475 kB]
Get:7 http://security.debian.org bullseye-security/main Translation-en [318 kB]
Get:8 http://deb.debian.org/debian bullseye/main Translation-en [6235 kB]
Get:9 http://deb.debian.org/debian bullseye-updates/main Sources [7908 B]
Get:10 http://deb.debian.org/debian bullseye-updates/main amd64 Packages [18.8 kB]
Get:11 http://deb.debian.org/debian bullseye-updates/main Translation-en [10.5 kB]
Fetched 15.9 MB in 2s (7621 kB/s)
Reading package lists...
Reading package lists...
Building dependency tree...
debian-archive-keyring is already the newest version (2021.1.1+deb11u1).
0 upgraded, 0 newly installed, 0 to remove and 38 not upgraded.
Hit:1 http://deb.debian.org/debian bullseye InRelease
Hit:2 http://deb.debian.org/debian bullseye-updates InRelease
Hit:3 http://security.debian.org bullseye-security InRelease
Reading package lists...
Reading package lists...
Building dependency tree...
Calculating upgrade...
The following packages will be upgraded:
  dpkg e2fsprogs gpgv libbpf0 libc-bin libc6 libcap2 libcap2-bin libcom-err2
  libext2fs2 libfastjson4 libgnutls30 libgssapi-krb5-2 libk5crypto3 libkrb5-3
  libkrb5support0 liblzma5 libpam-modules libpam-modules-bin libpam-runtime
  libpam0g libsepol1 libss2 libssl1.1 libsystemd0 libtasn1-6 libudev1 login
  logsave passwd perl-base systemd systemd-sysv tzdata udev vim-common
  vim-tiny xxd
38 upgraded, 0 newly installed, 0 to remove and 0 not upgraded.
Need to get 24.4 MB of archives.
After this operation, 78.8 kB of additional disk space will be used.
Err:1 http://security.debian.org bullseye-security/main amd64 dpkg amd64 1.20.14
  404  Not Found [IP: 140.248.146.132 80]
Err:2 http://security.debian.org bullseye-security/main amd64 login amd64 1:4.8.1-1+deb11u1
  404  Not Found [IP: 140.248.146.132 80]
Err:3 http://security.debian.org bullseye-security/main amd64 perl-base amd64 5.32.1-4+deb11u5
  404  Not Found [IP: 140.248.146.132 80]
Err:4 http://security.debian.org bullseye-security/main amd64 libc6 amd64 2.31-13+deb11u14
  404  Not Found [IP: 140.248.146.132 80]
Err:5 http://security.debian.org bullseye-security/main amd64 libc-bin amd64 2.31-13+deb11u14
  404  Not Found [IP: 140.248.146.132 80]
Err:6 http://security.debian.org bullseye-security/main amd64 libpam0g amd64 1.4.0-9+deb11u2
  404  Not Found [IP: 140.248.146.132 80]
Err:7 http://security.debian.org bullseye-security/main amd64 libpam-modules-bin amd64 1.4.0-9+deb11u2
  404  Not Found [IP: 140.248.146.132 80]
Err:8 http://security.debian.org bullseye-security/main amd64 libpam-modules amd64 1.4.0-9+deb11u2
  404  Not Found [IP: 140.248.146.132 80]
Err:9 http://security.debian.org bullseye-security/main amd64 libsystemd0 amd64 247.3-7+deb11u8
  404  Not Found [IP: 140.248.146.132 80]
Err:10 http://security.debian.org bullseye-security/main amd64 systemd amd64 247.3-7+deb11u8
  404  Not Found [IP: 140.248.146.132 80]
Err:11 http://security.debian.org bullseye-security/main amd64 udev amd64 247.3-7+deb11u8
  404  Not Found [IP: 140.248.146.132 80]
Err:12 http://security.debian.org bullseye-security/main amd64 libudev1 amd64 247.3-7+deb11u8
  404  Not Found [IP: 140.248.146.132 80]
Err:13 http://security.debian.org bullseye-security/main amd64 systemd-sysv amd64 247.3-7+deb11u8
  404  Not Found [IP: 140.248.146.132 80]
Err:14 http://security.debian.org bullseye-security/main amd64 libcap2 amd64 1:2.44-1+deb11u1
  404  Not Found [IP: 140.248.146.132 80]
Err:15 http://security.debian.org bullseye-security/main amd64 libtasn1-6 amd64 4.16.0-2+deb11u2
  404  Not Found [IP: 140.248.146.132 80]
Err:16 http://security.debian.org bullseye-security/main amd64 libgnutls30 amd64 3.7.1-5+deb11u10
  404  Not Found [IP: 140.248.146.132 80]
Err:17 http://security.debian.org bullseye-security/main amd64 logsave amd64 1.46.2-2+deb11u1
  404  Not Found [IP: 140.248.146.132 80]
Err:18 http://security.debian.org bullseye-security/main amd64 libext2fs2 amd64 1.46.2-2+deb11u1
  404  Not Found [IP: 140.248.146.132 80]
Err:19 http://security.debian.org bullseye-security/main amd64 e2fsprogs amd64 1.46.2-2+deb11u1
  404  Not Found [IP: 140.248.146.132 80]
Err:20 http://security.debian.org bullseye-security/main amd64 libpam-runtime all 1.4.0-9+deb11u2
  404  Not Found [IP: 140.248.146.132 80]
Err:21 http://security.debian.org bullseye-security/main amd64 passwd amd64 1:4.8.1-1+deb11u1
  404  Not Found [IP: 140.248.146.132 80]
Err:22 http://security.debian.org bullseye-security/main amd64 gpgv amd64 2.2.27-2+deb11u3
  404  Not Found [IP: 140.248.146.132 80]
Err:23 http://security.debian.org bullseye-security/main amd64 libcom-err2 amd64 1.46.2-2+deb11u1
  404  Not Found [IP: 140.248.146.132 80]
Err:24 http://security.debian.org bullseye-security/main amd64 libk5crypto3 amd64 1.18.3-6+deb11u8
  404  Not Found [IP: 140.248.146.132 80]
Err:25 http://security.debian.org bullseye-security/main amd64 libkrb5support0 amd64 1.18.3-6+deb11u8
  404  Not Found [IP: 140.248.146.132 80]
Err:26 http://security.debian.org bullseye-security/main amd64 libkrb5-3 amd64 1.18.3-6+deb11u8
  404  Not Found [IP: 140.248.146.132 80]
Err:27 http://security.debian.org bullseye-security/main amd64 libgssapi-krb5-2 amd64 1.18.3-6+deb11u8
  404  Not Found [IP: 140.248.146.132 80]
Err:28 http://security.debian.org bullseye-security/main amd64 libssl1.1 amd64 1.1.1w-0+deb11u8
  404  Not Found [IP: 140.248.146.132 80]
Err:29 http://security.debian.org bullseye-security/main amd64 liblzma5 amd64 5.2.5-2.1~deb11u2
  404  Not Found [IP: 140.248.146.132 80]
Err:30 http://security.debian.org bullseye-security/main amd64 libsepol1 amd64 3.1-1+deb11u1
  404  Not Found [IP: 140.248.146.132 80]
Err:31 http://security.debian.org bullseye-security/main amd64 tzdata all 2026b-0+deb11u1
  404  Not Found [IP: 140.248.146.132 80]
Err:32 http://security.debian.org bullseye-security/main amd64 xxd amd64 2:8.2.2434-3+deb11u3
  404  Not Found [IP: 140.248.146.132 80]
Err:33 http://security.debian.org bullseye-security/main amd64 vim-tiny amd64 2:8.2.2434-3+deb11u3
  404  Not Found [IP: 140.248.146.132 80]
Err:34 http://security.debian.org bullseye-security/main amd64 vim-common all 2:8.2.2434-3+deb11u3
  404  Not Found [IP: 140.248.146.132 80]
Err:35 http://security.debian.org bullseye-security/main amd64 libbpf0 amd64 1:0.3-2+deb11u1
  404  Not Found [IP: 140.248.146.132 80]
Err:36 http://security.debian.org bullseye-security/main amd64 libcap2-bin amd64 1:2.44-1+deb11u1
  404  Not Found [IP: 140.248.146.132 80]
Err:37 http://security.debian.org bullseye-security/main amd64 libfastjson4 amd64 0.99.9-1+deb11u1
  404  Not Found [IP: 140.248.146.132 80]
Err:38 http://security.debian.org bullseye-security/main amd64 libss2 amd64 1.46.2-2+deb11u1
  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/d/dpkg/dpkg_1.20.14_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/s/shadow/login_4.8.1-1%2bdeb11u1_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/p/perl/perl-base_5.32.1-4%2bdeb11u5_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/g/glibc/libc6_2.31-13%2bdeb11u14_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/g/glibc/libc-bin_2.31-13%2bdeb11u14_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/p/pam/libpam0g_1.4.0-9%2bdeb11u2_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/p/pam/libpam-modules-bin_1.4.0-9%2bdeb11u2_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/p/pam/libpam-modules_1.4.0-9%2bdeb11u2_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/s/systemd/libsystemd0_247.3-7%2bdeb11u8_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/s/systemd/systemd_247.3-7%2bdeb11u8_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/s/systemd/udev_247.3-7%2bdeb11u8_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/s/systemd/libudev1_247.3-7%2bdeb11u8_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/s/systemd/systemd-sysv_247.3-7%2bdeb11u8_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/libc/libcap2/libcap2_2.44-1%2bdeb11u1_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/libt/libtasn1-6/libtasn1-6_4.16.0-2%2bdeb11u2_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/g/gnutls28/libgnutls30_3.7.1-5%2bdeb11u10_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/e/e2fsprogs/logsave_1.46.2-2%2bdeb11u1_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/e/e2fsprogs/libext2fs2_1.46.2-2%2bdeb11u1_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/e/e2fsprogs/e2fsprogs_1.46.2-2%2bdeb11u1_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/p/pam/libpam-runtime_1.4.0-9%2bdeb11u2_all.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/s/shadow/passwd_4.8.1-1%2bdeb11u1_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/g/gnupg2/gpgv_2.2.27-2%2bdeb11u3_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/e/e2fsprogs/libcom-err2_1.46.2-2%2bdeb11u1_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/k/krb5/libk5crypto3_1.18.3-6%2bdeb11u8_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/k/krb5/libkrb5support0_1.18.3-6%2bdeb11u8_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/k/krb5/libkrb5-3_1.18.3-6%2bdeb11u8_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/k/krb5/libgssapi-krb5-2_1.18.3-6%2bdeb11u8_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/o/openssl/libssl1.1_1.1.1w-0%2bdeb11u8_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/x/xz-utils/liblzma5_5.2.5-2.1%7edeb11u2_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/libs/libsepol/libsepol1_3.1-1%2bdeb11u1_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/t/tzdata/tzdata_2026b-0%2bdeb11u1_all.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/v/vim/xxd_8.2.2434-3%2bdeb11u3_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/v/vim/vim-tiny_8.2.2434-3%2bdeb11u3_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/v/vim/vim-common_8.2.2434-3%2bdeb11u3_all.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/libb/libbpf/libbpf0_0.3-2%2bdeb11u1_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/libc/libcap2/libcap2-bin_2.44-1%2bdeb11u1_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/libf/libfastjson/libfastjson4_0.99.9-1%2bdeb11u1_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/e/e2fsprogs/libss2_1.46.2-2%2bdeb11u1_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Unable to fetch some archives, maybe run apt-get update or try with --fix-missing?
E: An unexpected failure occurred, exiting...
P: Begin unmounting filesystems...
P: Saving caches...
Reading package lists...
Building dependency tree...

===== dist/desktop-build-trace.log (last 150 lines) =====
  404  Not Found [IP: 140.248.146.132 80]
Err:19 http://security.debian.org bullseye-security/main amd64 e2fsprogs amd64 1.46.2-2+deb11u1
  404  Not Found [IP: 140.248.146.132 80]
Err:20 http://security.debian.org bullseye-security/main amd64 libpam-runtime all 1.4.0-9+deb11u2
  404  Not Found [IP: 140.248.146.132 80]
Err:21 http://security.debian.org bullseye-security/main amd64 passwd amd64 1:4.8.1-1+deb11u1
  404  Not Found [IP: 140.248.146.132 80]
Err:22 http://security.debian.org bullseye-security/main amd64 gpgv amd64 2.2.27-2+deb11u3
  404  Not Found [IP: 140.248.146.132 80]
Err:23 http://security.debian.org bullseye-security/main amd64 libcom-err2 amd64 1.46.2-2+deb11u1
  404  Not Found [IP: 140.248.146.132 80]
Err:24 http://security.debian.org bullseye-security/main amd64 libk5crypto3 amd64 1.18.3-6+deb11u8
  404  Not Found [IP: 140.248.146.132 80]
Err:25 http://security.debian.org bullseye-security/main amd64 libkrb5support0 amd64 1.18.3-6+deb11u8
  404  Not Found [IP: 140.248.146.132 80]
Err:26 http://security.debian.org bullseye-security/main amd64 libkrb5-3 amd64 1.18.3-6+deb11u8
  404  Not Found [IP: 140.248.146.132 80]
Err:27 http://security.debian.org bullseye-security/main amd64 libgssapi-krb5-2 amd64 1.18.3-6+deb11u8
  404  Not Found [IP: 140.248.146.132 80]
Err:28 http://security.debian.org bullseye-security/main amd64 libssl1.1 amd64 1.1.1w-0+deb11u8
  404  Not Found [IP: 140.248.146.132 80]
Err:29 http://security.debian.org bullseye-security/main amd64 liblzma5 amd64 5.2.5-2.1~deb11u2
  404  Not Found [IP: 140.248.146.132 80]
Err:30 http://security.debian.org bullseye-security/main amd64 libsepol1 amd64 3.1-1+deb11u1
  404  Not Found [IP: 140.248.146.132 80]
Err:31 http://security.debian.org bullseye-security/main amd64 tzdata all 2026b-0+deb11u1
  404  Not Found [IP: 140.248.146.132 80]
Err:32 http://security.debian.org bullseye-security/main amd64 xxd amd64 2:8.2.2434-3+deb11u3
  404  Not Found [IP: 140.248.146.132 80]
Err:33 http://security.debian.org bullseye-security/main amd64 vim-tiny amd64 2:8.2.2434-3+deb11u3
  404  Not Found [IP: 140.248.146.132 80]
Err:34 http://security.debian.org bullseye-security/main amd64 vim-common all 2:8.2.2434-3+deb11u3
  404  Not Found [IP: 140.248.146.132 80]
Err:35 http://security.debian.org bullseye-security/main amd64 libbpf0 amd64 1:0.3-2+deb11u1
  404  Not Found [IP: 140.248.146.132 80]
Err:36 http://security.debian.org bullseye-security/main amd64 libcap2-bin amd64 1:2.44-1+deb11u1
  404  Not Found [IP: 140.248.146.132 80]
Err:37 http://security.debian.org bullseye-security/main amd64 libfastjson4 amd64 0.99.9-1+deb11u1
  404  Not Found [IP: 140.248.146.132 80]
Err:38 http://security.debian.org bullseye-security/main amd64 libss2 amd64 1.46.2-2+deb11u1
  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/d/dpkg/dpkg_1.20.14_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/s/shadow/login_4.8.1-1%2bdeb11u1_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/p/perl/perl-base_5.32.1-4%2bdeb11u5_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/g/glibc/libc6_2.31-13%2bdeb11u14_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/g/glibc/libc-bin_2.31-13%2bdeb11u14_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/p/pam/libpam0g_1.4.0-9%2bdeb11u2_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/p/pam/libpam-modules-bin_1.4.0-9%2bdeb11u2_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/p/pam/libpam-modules_1.4.0-9%2bdeb11u2_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/s/systemd/libsystemd0_247.3-7%2bdeb11u8_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/s/systemd/systemd_247.3-7%2bdeb11u8_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/s/systemd/udev_247.3-7%2bdeb11u8_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/s/systemd/libudev1_247.3-7%2bdeb11u8_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/s/systemd/systemd-sysv_247.3-7%2bdeb11u8_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/libc/libcap2/libcap2_2.44-1%2bdeb11u1_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/libt/libtasn1-6/libtasn1-6_4.16.0-2%2bdeb11u2_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/g/gnutls28/libgnutls30_3.7.1-5%2bdeb11u10_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/e/e2fsprogs/logsave_1.46.2-2%2bdeb11u1_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/e/e2fsprogs/libext2fs2_1.46.2-2%2bdeb11u1_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/e/e2fsprogs/e2fsprogs_1.46.2-2%2bdeb11u1_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/p/pam/libpam-runtime_1.4.0-9%2bdeb11u2_all.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/s/shadow/passwd_4.8.1-1%2bdeb11u1_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/g/gnupg2/gpgv_2.2.27-2%2bdeb11u3_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/e/e2fsprogs/libcom-err2_1.46.2-2%2bdeb11u1_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/k/krb5/libk5crypto3_1.18.3-6%2bdeb11u8_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/k/krb5/libkrb5support0_1.18.3-6%2bdeb11u8_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/k/krb5/libkrb5-3_1.18.3-6%2bdeb11u8_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/k/krb5/libgssapi-krb5-2_1.18.3-6%2bdeb11u8_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/o/openssl/libssl1.1_1.1.1w-0%2bdeb11u8_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/x/xz-utils/liblzma5_5.2.5-2.1%7edeb11u2_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/libs/libsepol/libsepol1_3.1-1%2bdeb11u1_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/t/tzdata/tzdata_2026b-0%2bdeb11u1_all.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/v/vim/xxd_8.2.2434-3%2bdeb11u3_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/v/vim/vim-tiny_8.2.2434-3%2bdeb11u3_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/v/vim/vim-common_8.2.2434-3%2bdeb11u3_all.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/libb/libbpf/libbpf0_0.3-2%2bdeb11u1_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/libc/libcap2/libcap2-bin_2.44-1%2bdeb11u1_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/libf/libfastjson/libfastjson4_0.99.9-1%2bdeb11u1_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/e/e2fsprogs/libss2_1.46.2-2%2bdeb11u1_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Unable to fetch some archives, maybe run apt-get update or try with --fix-missing?
E: An unexpected failure occurred, exiting...
P: Begin unmounting filesystems...
P: Saving caches...
Reading package lists...
Building dependency tree...
+ tail -n 60 /work/dist/build.log
Err:31 http://security.debian.org bullseye-security/main amd64 tzdata all 2026b-0+deb11u1
  404  Not Found [IP: 140.248.146.132 80]
Err:32 http://security.debian.org bullseye-security/main amd64 xxd amd64 2:8.2.2434-3+deb11u3
  404  Not Found [IP: 140.248.146.132 80]
Err:33 http://security.debian.org bullseye-security/main amd64 vim-tiny amd64 2:8.2.2434-3+deb11u3
  404  Not Found [IP: 140.248.146.132 80]
Err:34 http://security.debian.org bullseye-security/main amd64 vim-common all 2:8.2.2434-3+deb11u3
  404  Not Found [IP: 140.248.146.132 80]
Err:35 http://security.debian.org bullseye-security/main amd64 libbpf0 amd64 1:0.3-2+deb11u1
  404  Not Found [IP: 140.248.146.132 80]
Err:36 http://security.debian.org bullseye-security/main amd64 libcap2-bin amd64 1:2.44-1+deb11u1
  404  Not Found [IP: 140.248.146.132 80]
Err:37 http://security.debian.org bullseye-security/main amd64 libfastjson4 amd64 0.99.9-1+deb11u1
  404  Not Found [IP: 140.248.146.132 80]
Err:38 http://security.debian.org bullseye-security/main amd64 libss2 amd64 1.46.2-2+deb11u1
  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/d/dpkg/dpkg_1.20.14_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/s/shadow/login_4.8.1-1%2bdeb11u1_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/p/perl/perl-base_5.32.1-4%2bdeb11u5_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/g/glibc/libc6_2.31-13%2bdeb11u14_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/g/glibc/libc-bin_2.31-13%2bdeb11u14_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/p/pam/libpam0g_1.4.0-9%2bdeb11u2_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/p/pam/libpam-modules-bin_1.4.0-9%2bdeb11u2_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/p/pam/libpam-modules_1.4.0-9%2bdeb11u2_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/s/systemd/libsystemd0_247.3-7%2bdeb11u8_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/s/systemd/systemd_247.3-7%2bdeb11u8_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/s/systemd/udev_247.3-7%2bdeb11u8_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/s/systemd/libudev1_247.3-7%2bdeb11u8_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/s/systemd/systemd-sysv_247.3-7%2bdeb11u8_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/libc/libcap2/libcap2_2.44-1%2bdeb11u1_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/libt/libtasn1-6/libtasn1-6_4.16.0-2%2bdeb11u2_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/g/gnutls28/libgnutls30_3.7.1-5%2bdeb11u10_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/e/e2fsprogs/logsave_1.46.2-2%2bdeb11u1_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/e/e2fsprogs/libext2fs2_1.46.2-2%2bdeb11u1_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/e/e2fsprogs/e2fsprogs_1.46.2-2%2bdeb11u1_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/p/pam/libpam-runtime_1.4.0-9%2bdeb11u2_all.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/s/shadow/passwd_4.8.1-1%2bdeb11u1_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/g/gnupg2/gpgv_2.2.27-2%2bdeb11u3_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/e/e2fsprogs/libcom-err2_1.46.2-2%2bdeb11u1_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/k/krb5/libk5crypto3_1.18.3-6%2bdeb11u8_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/k/krb5/libkrb5support0_1.18.3-6%2bdeb11u8_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/k/krb5/libkrb5-3_1.18.3-6%2bdeb11u8_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/k/krb5/libgssapi-krb5-2_1.18.3-6%2bdeb11u8_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/o/openssl/libssl1.1_1.1.1w-0%2bdeb11u8_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/x/xz-utils/liblzma5_5.2.5-2.1%7edeb11u2_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/libs/libsepol/libsepol1_3.1-1%2bdeb11u1_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/t/tzdata/tzdata_2026b-0%2bdeb11u1_all.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/v/vim/xxd_8.2.2434-3%2bdeb11u3_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/v/vim/vim-tiny_8.2.2434-3%2bdeb11u3_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/v/vim/vim-common_8.2.2434-3%2bdeb11u3_all.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/libb/libbpf/libbpf0_0.3-2%2bdeb11u1_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/libc/libcap2/libcap2-bin_2.44-1%2bdeb11u1_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/libf/libfastjson/libfastjson4_0.99.9-1%2bdeb11u1_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Failed to fetch http://security.debian.org/pool/updates/main/e/e2fsprogs/libss2_1.46.2-2%2bdeb11u1_amd64.deb  404  Not Found [IP: 140.248.146.132 80]
E: Unable to fetch some archives, maybe run apt-get update or try with --fix-missing?
E: An unexpected failure occurred, exiting...
P: Begin unmounting filesystems...
P: Saving caches...
Reading package lists...
Building dependency tree...
+ die 'lb build failed — full log: dist/build.log'
+ printf '%s  ✗ %s%s\n' '[38;5;203m' 'lb build failed — full log: dist/build.log' '[0m'
[38;5;203m  ✗ lb build failed — full log: dist/build.log[0m
+ exit 1
```
