> **Evidence boundary (2026-10-15):** this guide describes intended build configuration, not a runtime-verified baseline for every release. Security packages are optional/tolerant installs: check `thadd-toolbox --status`, `systemctl`, `sudo ufw status verbose` and `sudo aa-status` in the exact guest. No real ISO VM test was run here. The desktop source configures public `thadd` / `thadd` and LightDM autologin; change it privately using `passwd`. Changes/logs are lost without tested persistent storage. No confirmed installer is supplied (`--debian-installer none`). See [quick start](QUICKSTART.md) and [AI safety caveats](AI.md), especially the older offline approval bypass.

# THADD OS — security baseline

This is the full description of what `0400-thadd-security` applies to every THADD OS
image, what it deliberately does *not* do, and how to inspect or undo any of it. The
same text ships inside the ISO at `/usr/share/doc/thadd/SECURITY.md`, and the short
version is always readable on a running system:

```bash
cat /etc/thadd/security-posture     # what this image claims
thadd security                      # live checks: firewall, hardening, updates, services
thadd-scan --summary                # forensic snapshot: accounts, listeners, persistence, setuid
```

Nothing here is exotic and nothing is hidden: a security baseline you cannot read is
one you cannot trust, and one you cannot undo is one you cannot work with.

---

## The live user

| | |
| --- | --- |
| User | `thadd` (uid 1000), member of `sudo` |
| Password | `thadd` — **a documented password on a live image is a design decision, not an accident** |
| Change it | `thadd-passwd` (or `passwd`) before you connect this machine to any network you do not control |
| Autologin | enabled for the live session (`/etc/lightdm/lightdm.conf.d/`), so the desktop is usable without a login |
| Root | no password login, no root session; use `sudo` |

The image is a *live* image: it boots read-only from the disc, so changes live in RAM and
vanish on reboot unless you enable persistence. That is why a well-known password is
acceptable here — and why you should set your own on an installed system.

## Kernel and network hardening

Written to `/etc/sysctl.d/99-thadd-hardening.conf`:

| Setting | Value | Why |
| --- | --- | --- |
| `net.ipv4.conf.all.rp_filter`, `…default.rp_filter` | `1` | reverse-path filtering (anti-spoofing) |
| `net.ipv4.tcp_syncookies` | `1` | survives SYN floods |
| `net.ipv4.conf.all.accept_redirects`, `…default…`, IPv6 equivalents | `0` | ignore ICMP redirects |
| `net.ipv4.conf.all.secure_redirects` | `0` | no "secure" ICMP redirects either |
| `net.ipv4.conf.all.accept_source_route`, IPv6 equivalent | `0` | no source-routed traffic |
| `net.ipv4.conf.all.send_redirects` | `0` | this box is not a router |
| `net.ipv4.conf.all.log_martians` | `1` | log impossible source addresses |
| `net.ipv4.icmp_echo_ignore_broadcasts`, `…bogus_error_responses` | `1` | ignore broadcast pings and bogus ICMP |
| `kernel.randomize_va_space` | `2` | full ASLR |
| `kernel.kptr_restrict` | `2` | no kernel pointers in `/proc` for anyone |
| `kernel.dmesg_restrict` | `1` | kernel log needs privileges (it leaks addresses) |
| `kernel.unprivileged_bpf_disabled` | `1` | no unprivileged BPF (a modern exploit primitive); `bpftrace` still works via sudo |
| `net.core.bpf_jit_harden` | `2` | hardened BPF JIT |
| `fs.suid_dumpable` | `0` | no core dumps from setuid programs |
| `kernel.yama.ptrace_scope` | `1` | a process may only trace its own children |
| `kernel.perf_event_paranoid` | `3` | perf is root-only |
| `fs.protected_hardlinks`, `fs.protected_symlinks` | `1` | classic `/tmp` link attacks |
| `fs.protected_fifos`, `fs.protected_regular` | `2` | unsafe FIFO/regular-file opens in sticky dirs |
| `net.core.somaxconn` | `1024` | server workloads on a workstation |
| `net.ipv4.tcp_fastopen` | `3` | client and server TFO |

Inspect: `sysctl -a | grep -E 'randomize_va_space|kptr_restrict|dmesg_restrict|ptrace_scope|protected_'`

## Modules, devices, limits

* Rare, historically buggy protocols with no desktop use case are disabled via
  `/etc/modprobe.d/thadd-blacklist.conf`: `dccp`, `sctp`, `rds`, `tipc`, `firewire-core`
  (`install … /bin/false` — the module cannot be loaded even by root's tooling).
* USB storage is **allowed**; `/etc/modprobe.d/thadd-usb-storage.conf` contains the
  one-line change to forbid it for kiosk/high-security builds.
* `/etc/security/limits.d/99-thadd.conf`: core dumps 0 for everyone, `maxlogins 10`
  (3 for root), `nofile 65536` soft / `262144` hard.
* `umask 027` for interactive shells (`/etc/profile.d/99-thadd-umask.sh`) — new files
  are private by default.

## Authentication

* `pwquality` (`/etc/security/pwquality.conf`): minimum 12 characters, at least one
  digit, upper, lower and symbol, `retry = 3`, `enforce_for_root`.
* `sudo` (`/etc/sudoers.d/00-thadd-hardening`): `use_pty` (no TTY-escape tricks),
  full session logging to `/var/log/thadd/sudo.log` with `log_input`/`log_output`,
  `passwd_tries=3`, `timestamp_timeout=5`, `env_reset`, explicit `secure_path`.
* Read it back with: `sudo cat /var/log/thadd/sudo.log`, or `sudo lastcomm` on an
  installed system with process accounting.

## Auditing

`/etc/audit/rules.d/99-thadd.rules` (auditd) watches the things an intrusion touches
first, with an 8192-entry backlog and `-f 1` (errors are fatal to audit startup, not
silently dropped):

| Watch | Key |
| --- | --- |
| `/etc/passwd`, `/etc/shadow`, `/etc/group` (write, attribute change) | `identity` |
| `/etc/sudoers`, `/etc/sudoers.d/` | `privilege` |
| `/etc/ssh/sshd_config` | `sshd` |
| `/etc/thadd/` | `thadd` |
| `/var/log/thadd/` | `thadd-logs` |
| `execve` with `uid != euid` and `euid == 0` | `setuid-exec` |
| `ptrace`, `init_module`/`finit_module`/`delete_module`, `mount` | `ptrace`, `modules`, `mount` |
| `/usr/bin/sudo`, `/usr/bin/su` executed | `sudo`, `su` |

Query: `sudo ausearch -k identity --start today`, `sudo aureport --auth`.

## Mandatory access control

AppArmor is left in the distro's enforcing mode; the profiles Debian ships for
`tcpdump` and friends are loaded at build time. Check with
`sudo aa-status`. SELinux is available but not enabled — Debian's default is AppArmor,
and switching both on is how you get a machine nobody can debug.

## Firewall

`ufw`, default-deny inbound, applied at boot:

* default: **deny incoming**, **allow outgoing**
* allowed out: `53,67,68,123/udp` (DNS, DHCP, NTP) and `22,53,80,123,443,8080,8443/tcp`
* allowed in: loopback only, plus mDNS on a trusted LAN when you enable it

Inspect: `sudo ufw status verbose`. Change: `sudo ufw allow 3000/tcp`, or turn it off
with `sudo ufw disable` (not recommended on an untrusted network).

## Remote access

OpenSSH is **installed and hardened but not running** — a live image with a documented
password must never listen on port 22 by accident.

```
Port 22 · PermitRootLogin no · PasswordAuthentication yes (live media has no keys yet)
PubkeyAuthentication yes · KbdInteractiveAuthentication no · PermitEmptyPasswords no
X11Forwarding no · AllowAgentForwarding no · AllowTcpForwarding no
MaxAuthTries 3 · MaxSessions 4 · LoginGraceTime 20 · ClientAliveInterval 300
ClientAliveCountMax 2 · UseDNS no · LogLevel VERBOSE · AllowUsers thadd
```

Control it with `thadd-ssh`:

```bash
thadd-ssh status     # default action
thadd-ssh key        # paste a public key into ~/.ssh/authorized_keys
passwd              # change the public password first, privately
sudo thadd-ssh on    # starts sshd (asks for confirmation first)
sudo thadd-ssh off   # stops and disables it
```

`fail2ban` is installed and armed (`/etc/fail2ban/jail.d/thadd.local`: `maxretry 3`,
`bantime 1h`, `findtime 10m`, systemd backend) — it simply has nothing to watch until
you start sshd.

## Filesystem and services

* The root filesystem is the read-only squashfs on the disc; `/home/thadd` and `/tmp`
  are RAM or overlay. Nothing in the audit or hardening above survives a reboot unless
  you enable persistence (see `docs/QUICKSTART.md`).
* Services that are not needed on a desktop (ssh, cups-browsed, avahi where unused)
  are disabled at build time; `systemctl list-unit-files --state=enabled` shows what
  actually starts.
* AppArmor, auditd, ufw and fail2ban are the exceptions: auditing and the firewall are
  on by default, because a security baseline that has to be switched on is not one.

## What this baseline does *not* claim

* It is not a hardened server profile: no SELinux, no measured boot, no Secure Boot
  key management, no disk encryption on the live image.
* It does not stop an attacker who already has your user account or physical access to
  the machine — nothing userland does.
* It does not make a live session persistent or safe to run as your daily driver
  without changing the password first.

For the tooling side of THADD OS — the assistant's approval gate, the audit log, the
reverse-engineering engine — see `docs/AI.md` and `docs/QUICKSTART.md`, both of which
ship alongside this file inside the image.
