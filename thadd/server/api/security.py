"""THADD OS — Security Center API.

Combines three things:

1. **Posture scoring** — a deterministic 0-100 audit (firewall, sysctls, updates,
   accounts, services, encryption, SSH, sudo) computed from real system state.
2. **Scans** — quick/full/rootkit/audit/virus/network/web.  Each scan uses the
   native tool when present (rkhunter, lynis, clamav, nmap…) and falls back to a
   built-in pure-Python scan so the Security Center is never a dead button.
3. **Reverse engineering / DFIR** — file hashing, type/entropy/section analysis,
   embedded-file carving, indicator hunting, and full disk-image triage through
   :mod:`thadd.forensics` (Windows/macOS/Linux filesystems).
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
import socket
import struct
import subprocess
import time
import uuid
from pathlib import Path

from ..config import Config, data_dir
from ..core import RpcError, Stream
try:
    from ..forensics import triage as triage_mod
except ImportError:  # the server can run without the readers (report-only mode)
    from thadd.forensics import triage as triage_mod

# ------------------------------------------------------------------ posture
SYSCTL_EXPECTED = {
    "kernel.randomize_va_space": ("2", "ASLR fully enabled", "medium"),
    "net.ipv4.tcp_syncookies": ("1", "SYN-flood protection", "medium"),
    "net.ipv4.ip_forward": ("0", "IP forwarding disabled", "low"),
    "net.ipv4.conf.all.accept_redirects": ("0", "ICMP redirects refused", "medium"),
    "net.ipv4.conf.all.send_redirects": ("0", "No ICMP redirects sent", "low"),
    "net.ipv4.conf.all.accept_source_route": ("0", "Source routing refused", "high"),
    "net.ipv4.conf.all.rp_filter": ("1", "Reverse-path filtering on", "medium"),
    "kernel.dmesg_restrict": ("1", "dmesg restricted to root", "medium"),
    "kernel.kptr_restrict": ("1", "Kernel pointers hidden", "medium"),
    "kernel.yama.ptrace_scope": ("1", "ptrace restricted", "high"),
    "fs.protected_hardlinks": ("1", "Hardlink protection", "low"),
    "fs.protected_symlinks": ("1", "Symlink protection", "low"),
    "net.ipv6.conf.all.accept_ra": ("0", "IPv6 router advertisements refused", "low"),
    "kernel.unprivileged_bpf_disabled": ("1", "Unprivileged BPF disabled", "medium"),
}

SENSITIVE_PATHS = [
    ("/etc/shadow", 0o640, "shadow file permissions"),
    ("/etc/gshadow", 0o640, "group shadow permissions"),
    ("/etc/passwd", 0o644, "passwd file permissions"),
    ("/etc/ssh/sshd_config", 0o600, "sshd config permissions"),
    ("/root", 0o700, "root home permissions"),
    ("/boot", 0o755, "boot directory permissions"),
]


def _read(path: str) -> str:
    try:
        return Path(path).read_text(errors="replace")
    except OSError:
        return ""


def _sysctl(name: str) -> str:
    return _read("/proc/sys/" + name.replace(".", "/")).strip()


def _have(cmd: str) -> bool:
    return shutil.which(cmd) is not None


def cmd_posture(session=None, **_):
    """Full security posture with a score, grade and prioritised fixes."""
    findings: list[dict] = []

    def add(ok: bool, title: str, detail: str, severity: str, fix: str = "", category: str = "system"):
        findings.append({"ok": ok, "title": title, "detail": detail, "severity": severity, "fix": fix,
                         "category": category})

    # ---- firewall -------------------------------------------------------------
    fw_active, fw_tool, fw_detail = False, "none", ""
    for tool, probe in (("ufw", ["ufw", "status"]), ("firewalld", ["firewall-cmd", "--state"]),
                        ("nftables", ["nft", "list", "ruleset"]), ("iptables", ["iptables", "-S"])):
        if _have(tool.split()[0]):
            r = subprocess.run(probe, capture_output=True, text=True, timeout=15)
            fw_tool = tool
            if tool == "ufw":
                fw_active = "Status: active" in r.stdout
                fw_detail = r.stdout.strip()[:200]
            else:
                fw_active = bool(r.stdout.strip())
                fw_detail = f"{len(r.stdout.splitlines())} rules"
            break
    add(fw_active, "Host firewall active",
        fw_detail or "no firewall front-end detected", "high" if not fw_active else "low",
        "sudo ufw default deny incoming && sudo ufw enable", "network")

    # ---- sysctls --------------------------------------------------------------
    for name, (want, label, sev) in SYSCTL_EXPECTED.items():
        got = _sysctl(name)
        if not got:
            continue
        ok = got == want
        add(ok, label, f"{name} = {got} (expected {want})", sev if not ok else "low",
            f"echo '{name}={want}' | sudo tee /etc/sysctl.d/99-thadd-hardening.conf && sudo sysctl --system", "hardening")

    # ---- updates --------------------------------------------------------------
    upgradable = 0
    if _have("apt-get"):
        r = subprocess.run(["apt-get", "-s", "-o", "Debug::NoLocking=true", "upgrade"], capture_output=True,
                           text=True, timeout=90)
        upgradable = sum(1 for line in r.stdout.splitlines() if line.startswith("Inst "))
        add(upgradable == 0, "System packages up to date", f"{upgradable} package(s) upgradable",
            "medium" if upgradable else "low", "sudo apt update && sudo apt full-upgrade", "updates")

    # ---- accounts -------------------------------------------------------------
    rootlogin = ""
    for line in _read("/etc/passwd").splitlines():
        if line.startswith("root:"):
            rootlogin = line.split(":")[6]
    weak = []
    for line in _read("/etc/shadow").splitlines():
        parts = line.split(":")
        if len(parts) > 1 and parts[1] and not parts[1].startswith(("!", "*", "$y$", "$6$")):
            weak.append(parts[0])
    add(not weak, "Strong password hashing", f"weak/legacy hashes: {', '.join(weak) if weak else 'none'}",
        "high" if weak else "low", "sudo passwd --expire <user>  /  switch to yescrypt (login.defs)", "accounts")
    sudoers = _read("/etc/sudoers")
    nopasswd = [l for l in sudoers.splitlines() if "NOPASSWD" in l and not l.strip().startswith("#")]
    add(not nopasswd, "No passwordless sudo", f"{len(nopasswd)} NOPASSWD rule(s)" if nopasswd else "no NOPASSWD rules",
        "high" if nopasswd else "low", "remove NOPASSWD from /etc/sudoers.d/*", "accounts")

    # ---- services / ports -----------------------------------------------------
    listening = _listening_ports()
    risky = [p for p in listening if p["port"] in (23, 21, 512, 513, 514, 111, 2049) or p["exposed"]]
    add(not risky, "No risky exposed services",
        "; ".join(f"{p['port']}/{p['proto']} {p['process']}" for p in risky[:6]) or f"{len(listening)} listening sockets, all local",
        "high" if risky else "low", "close unnecessary ports / bind to 127.0.0.1", "network")

    # ---- ssh ------------------------------------------------------------------
    sshd = _read("/etc/ssh/sshd_config")
    if sshd:
        permit_root = re.search(r"^\s*PermitRootLogin\s+(\S+)", sshd, re.M)
        pw_auth = re.search(r"^\s*PasswordAuthentication\s+(\S+)", sshd, re.M)
        val = (permit_root.group(1) if permit_root else "prohibit-password")
        add(val in ("no", "prohibit-password"), "SSH root login restricted", f"PermitRootLogin {val}",
            "medium" if val == "yes" else "low", "set PermitRootLogin no in /etc/ssh/sshd_config", "ssh")
        pv = (pw_auth.group(1) if pw_auth else "yes")
        add(pv == "no", "SSH key-only authentication", f"PasswordAuthentication {pv}",
            "medium" if pv == "yes" else "low", "set PasswordAuthentication no and use keys", "ssh")

    # ---- file permissions -----------------------------------------------------
    for path, want, label in SENSITIVE_PATHS:
        if not os.path.exists(path):
            continue
        mode = os.stat(path).st_mode & 0o777
        ok = mode <= want
        add(ok, label.title(), f"{path} is {oct(mode)} (max {oct(want)})", "medium" if not ok else "low",
            f"sudo chmod {oct(want)[2:]} {path}", "files")

    # ---- encryption / integrity ----------------------------------------------
    luks = _have("cryptsetup") and "crypto" in _read("/proc/modules")
    add(luks or os.path.exists("/run/live/medium"), "Data-at-rest encryption or live session",
        "LUKS tooling present" if luks else "running from the THADD live medium (nothing persisted)",
        "info", "encrypt the system volume at install time (THADD installer → Full disk encryption)", "crypto")
    add(_have("clamscan") or _have("rkhunter") or _have("lynis"), "Security tooling installed",
        "clamav/rkhunter/lynis available" if (_have("clamscan") or _have("rkhunter") or _have("lynis")) else "no scanners found",
        "medium", "sudo apt install -y clamav rkhunter lynis chkrootkit aide", "tools")

    # ---- THADD specific -------------------------------------------------------
    cfg = Config()
    add(not cfg.get("security", "wipe_on_shutdown", False), "Session data retention policy",
        "RAM is wiped on shutdown (wipe_on_shutdown enabled)" if cfg.get("security", "wipe_on_shutdown") else
        "user data persists in the home directory", "info", "", "privacy")
    audit = data_dir() / "agent-audit.jsonl"
    add(audit.exists(), "AI action audit log", str(audit) if audit.exists() else "not yet created (first AI action creates it)",
        "info", "", "ai")

    passed = sum(1 for f in findings if f["ok"])
    score = round(100 * passed / max(1, len(findings)))
    grade = ("A+" if score >= 97 else "A" if score >= 90 else "B" if score >= 80 else "C" if score >= 70
             else "D" if score >= 60 else "F")
    severities = {"high": 0, "medium": 0, "low": 0, "info": 0}
    for f in findings:
        if not f["ok"]:
            severities[f["severity"]] = severities.get(f["severity"], 0) + 1
    return {
        "score": score, "grade": grade, "findings": findings,
        "passed": passed, "total": len(findings), "open_by_severity": severities,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "tools_detected": {t: _have(t) for t in ("ufw", "nft", "iptables", "clamscan", "rkhunter", "lynis",
                                                 "chkrootkit", "aide", "firejail", "fail2ban", "auditd",
                                                 "yara", "nmap", "wireshark", "hashcat", "john", "hydra",
                                                 "sqlmap", "metasploit", "aircrack-ng", "gobuster")},
        "hardening_snippet": "\n".join(f"{k} = {v[0]}" for k, v in SYSCTL_EXPECTED.items()),
    }


def _listening_ports() -> list[dict]:
    """Parse /proc/net/{tcp,tcp6,udp,udp6} into socket records."""
    out = []
    for proto, path, is_v6 in (("tcp", "/proc/net/tcp", False), ("tcp", "/proc/net/tcp6", True),
                               ("udp", "/proc/net/udp", False), ("udp", "/proc/net/udp6", True)):
        for line in _read(path).splitlines()[1:]:
            parts = line.split()
            if len(parts) < 4:
                continue
            try:
                local, state = parts[1], parts[3]
                ip_hex, port_hex = local.split(":")
            except ValueError:
                continue
            port = int(port_hex, 16)
            if state not in ("0A", "01", "07"):  # LISTEN, ESTABLISHED, CLOSE_WAIT
                continue
            if proto == "udp" and state != "07":
                continue
            if is_v6:
                addr = _v6_from_hex(ip_hex)
            else:
                b = bytes.fromhex(ip_hex)[::-1]
                addr = ".".join(str(x) for x in b)
            exposed = addr not in ("127.0.0.1", "::1", "0.0.0.0::") and not addr.startswith("127.")
            if addr in ("0.0.0.0", "::", "0:0:0:0:0:0:0:0"):
                exposed = True
            out.append({"proto": proto, "local": f"{addr}:{port}", "port": port, "addr": addr,
                        "state": state, "exposed": exposed, "process": _pid_for(port, proto)})
    uniq = {}
    for item in out:
        uniq[(item["proto"], item["port"])] = item
    return sorted(uniq.values(), key=lambda x: x["port"])


def _v6_from_hex(hexstr: str) -> str:
    try:
        raw = bytes.fromhex(hexstr)
        groups = [raw[i : i + 4][::-1].hex() for i in range(0, 16, 4)]
        return ":".join(groups)
    except Exception:
        return hexstr


def _pid_for(port: int, proto: str) -> str:
    hexport = f"{port:04X}"
    for inode_dir in ("/proc/net",):
        pass
    try:
        for pid in os.listdir("/proc"):
            if not pid.isdigit():
                continue
            fd_dir = f"/proc/{pid}/fd"
            try:
                for fd in os.listdir(fd_dir):
                    try:
                        target = os.readlink(os.path.join(fd_dir, fd))
                    except OSError:
                        continue
                    if target == f"socket:[{_inode(port, proto)}]":
                        return Path(f"/proc/{pid}/comm").read_text().strip()
            except OSError:
                continue
    except OSError:
        pass
    return ""


_SOCKET_INODE_CACHE: dict = {}


def _inode(port: int, proto: str) -> str:
    key = (port, proto)
    if key in _SOCKET_INODE_CACHE:
        return _SOCKET_INODE_CACHE[key]
    inode = ""
    for path in ("/proc/net/tcp", "/proc/net/tcp6", "/proc/net/udp", "/proc/net/udp6"):
        for line in _read(path).splitlines()[1:]:
            parts = line.split()
            if len(parts) < 10:
                continue
            try:
                p = int(parts[1].split(":")[1], 16)
            except (IndexError, ValueError):
                continue
            if p == port:
                inode = parts[9]
                break
        if inode:
            break
    _SOCKET_INODE_CACHE[key] = inode
    return inode


def cmd_ports(session=None, **_):
    """Listening sockets with exposure classification."""
    ports = _listening_ports()
    return {"ports": ports, "exposed": [p for p in ports if p["exposed"]], "count": len(ports)}


def _quick_scan() -> dict:
    """Built-in anomaly scan that needs no external tooling."""
    findings = []
    suid = []
    for root in ("/usr/bin", "/usr/sbin", "/bin", "/sbin", "/usr/local/bin", "/opt"):
        if not os.path.isdir(root):
            continue
        try:
            for name in os.listdir(root):
                p = os.path.join(root, name)
                try:
                    st = os.stat(p)
                except OSError:
                    continue
                if not (st.st_mode & 0o4000) or os.path.islink(p):
                    continue
                suid.append(p)
                if os.path.getsize(p) < 8192:  # tiny suid binaries are suspicious
                    findings.append({"severity": "medium", "title": "Unusually small SUID binary",
                                     "detail": f"{p} ({os.path.getsize(p)} bytes)"})
        except OSError:
            continue
    world_writable = []
    for root in ("/etc", "/usr/lib/systemd/system", "/etc/systemd/system"):
        try:
            for dirpath, _dirs, files in os.walk(root):
                for f in files:
                    p = os.path.join(dirpath, f)
                    try:
                        mode = os.stat(p).st_mode
                    except OSError:
                        continue
                    if mode & 0o002:
                        world_writable.append(p)
        except OSError:
            pass
    if world_writable:
        findings.append({"severity": "high", "title": "World-writable system files",
                         "detail": ", ".join(world_writable[:8])})

    # suspicious processes: deleted binaries, /tmp execution, weird parents
    for pid in os.listdir("/proc"):
        if not pid.isdigit():
            continue
        try:
            exe = os.readlink(f"/proc/{pid}/exe")
            cmdline = Path(f"/proc/{pid}/cmdline").read_bytes().replace(b"\0", b" ").decode("utf-8", "replace").strip()
        except OSError:
            continue
        if "(deleted)" in exe:
            findings.append({"severity": "high", "title": "Process running a deleted binary",
                             "detail": f"pid {pid}: {exe} — {cmdline[:120]}"})
        elif exe.startswith(("/tmp/", "/dev/shm/", "/var/tmp/")):
            findings.append({"severity": "high", "title": "Process running from a temporary directory",
                             "detail": f"pid {pid}: {exe}"})

    # persistence
    for unit_dir in ("/etc/systemd/system", "/lib/systemd/system"):
        pending = data_dir() / "unit-baseline.json"
        current = {}
        try:
            for name in os.listdir(unit_dir):
                if name.endswith((".service", ".timer", ".socket")):
                    p = os.path.join(unit_dir, name)
                    current[name] = round(os.stat(p).st_mtime)
        except OSError:
            continue
        if pending.exists():
            try:
                baseline = json.loads(pending.read_text())
                new_units = [n for n in current if n not in baseline and not n.endswith(".wants")]
                if new_units:
                    findings.append({"severity": "medium", "title": "New systemd units since last baseline",
                                     "detail": ", ".join(new_units[:10])})
            except Exception:
                pass
        try:
            pending.write_text(json.dumps(current))
        except OSError:
            pass

    # cron + rc.local + profile.d
    susp = []
    for path in ("/etc/crontab", "/etc/rc.local"):
        txt = _read(path)
        for line in txt.splitlines():
            if re.search(r"(curl|wget).*\|.*(sh|bash)|/dev/tcp|base64 -d|nc -e|python -c", line):
                susp.append(f"{path}: {line.strip()[:140]}")
    for root in ("/etc/profile.d", "/etc/cron.d", "/etc/cron.daily"):
        try:
            for name in os.listdir(root):
                p = os.path.join(root, name)
                txt = _read(p)
                if "curl" in txt or "wget" in txt or "/dev/tcp" in txt:
                    susp.append(f"{p}: remote fetch in startup script")
        except OSError:
            pass
    if susp:
        findings.append({"severity": "high", "title": "Suspicious persistence entries",
                         "detail": "; ".join(susp[:5])})

    # SSH keys + history
    keys = []
    for home in (os.path.expanduser("~"), "/root"):
        auth = Path(home) / ".ssh" / "authorized_keys"
        if auth.exists() and auth.stat().st_size:
            keys.append(f"{auth} ({len(auth.read_text().splitlines())} keys)")
        hist = Path(home) / ".bash_history"
        if hist.exists():
            for line in hist.read_text(errors="replace").splitlines()[-300:]:
                if re.search(r"(curl|wget).*\|.*(sh|bash)|/dev/tcp/|chmod \+x /tmp|history -c", line):
                    findings.append({"severity": "medium", "title": "Suspicious shell history entry",
                                     "detail": f"{hist}: {line[:120]}"})
    if keys:
        findings.append({"severity": "info", "title": "Authorised SSH keys present", "detail": ", ".join(keys)})

    # kernel module integrity vs module list file
    tainted = _read("/proc/sys/kernel/tainted").strip()
    if tainted and tainted != "0":
        findings.append({"severity": "medium", "title": "Kernel is tainted",
                         "detail": f"taint flags = {tainted} (unsigned/out-of-tree module loaded)"})
    return {
        "findings": findings, "suid_binaries": len(suid), "suid_sample": suid[:40],
        "world_writable": world_writable[:40],
        "checks": 8, "engine": "thadd-native",
    }


def cmd_scan(session, kind: str = "quick", target: str = "", stream_id: str = "", deep: bool = False, **_):
    """Launch a security scan and stream its output."""
    sid = stream_id or f"scan-{uuid.uuid4().hex[:8]}"
    cfg = Config()

    def producer(stream: Stream) -> None:
        stream.meta = {"kind": kind, "target": target}
        emit = lambda obj: stream.push(json.dumps(obj) + "\n")  # noqa: E731
        emit({"type": "scan_start", "kind": kind, "target": target, "time": time.strftime("%H:%M:%S")})
        try:
            if kind == "posture":
                res = cmd_posture()
                emit({"type": "posture", "data": res})
            elif kind == "quick":
                emit({"type": "log", "line": "Running native anomaly scan (SUID, persistence, world-writable, deleted binaries)…"})
                res = _quick_scan()
                for f in res["findings"]:
                    emit({"type": "finding", **f})
                emit({"type": "log", "line": f"Checked {res['checks']} heuristics · {res['suid_binaries']} SUID binaries"})
            elif kind == "rootkit":
                if _have("rkhunter"):
                    _stream_cmd(stream, ["rkhunter", "--check", "--sk", "--nocolors"], timeout=900)
                elif _have("chkrootkit"):
                    _stream_cmd(stream, ["chkrootkit"], timeout=900)
                else:
                    emit({"type": "log", "line": "rkhunter/chkrootkit not installed — running THADD native rootkit heuristics"})
                    res = _quick_scan()
                    rootkit_findings = [f for f in res["findings"] if f["severity"] in ("high", "medium")]
                    for f in rootkit_findings:
                        emit({"type": "finding", **f})
                    emit({"type": "log", "line": "install with: sudo apt install -y rkhunter chkrootkit"})
            elif kind == "audit":
                if _have("lynis"):
                    _stream_cmd(stream, ["lynis", "audit", "system", "--quick", "--no-colors"], timeout=1200)
                else:
                    res = cmd_posture()
                    emit({"type": "posture", "data": res})
                    emit({"type": "log", "line": "lynis not installed — THADD posture engine used instead"})
            elif kind == "virus":
                if _have("clamscan"):
                    path = os.path.expanduser("~")
                    _stream_cmd(stream, ["clamscan", "-r", "--bell", "-i", path], timeout=3600)
                else:
                    emit({"type": "log", "line": "ClamAV not installed. Install: sudo apt install -y clamav && sudo freshclam"})
                    emit({"type": "finding", "severity": "info", "title": "Malware scanner unavailable",
                          "detail": "THADD recommends ClamAV for on-demand and on-access scanning"})
            elif kind == "network":
                if _have("nmap"):
                    _stream_cmd(stream, ["nmap", "-sV", "-T4", "--top-ports", "200", "127.0.0.1"], timeout=900)
                else:
                    ports = _listening_ports()
                    for p in ports:
                        emit({"type": "port", **p})
            elif kind == "web":
                if not target:
                    emit({"type": "error", "message": "web scan needs a target host"})
                elif _have("nikto"):
                    _stream_cmd(stream, ["nikto", "-h", target], timeout=1800)
                elif _have("nmap"):
                    _stream_cmd(stream, ["nmap", "-sV", "--script", "http-title,http-headers", target], timeout=900)
                else:
                    emit({"type": "error", "message": "nikto/nmap not installed — install with: sudo apt install -y nikto nmap"})
            elif kind == "hardening":
                res = cmd_posture()
                script = _hardening_script(res)
                from ..api import fs as fsapi

                out = fsapi.cmd_fs_write(None, path="~/Scripts/thadd-harden.sh", text=script)
                emit({"type": "log", "line": f"Hardening script written to {out['path']}"})
                emit({"type": "log", "line": "Review it, then run: sudo bash ~/Scripts/thadd-harden.sh"})
            else:
                emit({"type": "error", "message": f"unknown scan kind: {kind}"})
        except Exception as exc:
            emit({"type": "error", "message": f"{type(exc).__name__}: {exc}"})
        finally:
            emit({"type": "scan_end", "kind": kind, "time": time.strftime("%H:%M:%S")})

    Stream(session, sid, producer).start()
    return {"stream_id": sid, "kind": kind, "note": "streaming results to the Security Center"}


def _stream_cmd(stream: Stream, cmd: list[str], timeout: int = 600) -> None:
    stream.push(json.dumps({"type": "log", "line": "$ " + " ".join(cmd)}) + "\n")
    try:
        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1)
    except OSError as exc:
        stream.push(json.dumps({"type": "error", "message": str(exc)}) + "\n")
        return
    started = time.time()
    try:
        for line in proc.stdout:  # type: ignore[union-attr]
            stream.push(json.dumps({"type": "log", "line": line.rstrip()}) + "\n")
            if time.time() - started > timeout or stream._stop.is_set():
                proc.kill()
                break
        proc.wait(timeout=10)
    except Exception:
        proc.kill()
    stream.push(json.dumps({"type": "log", "line": f"[exit {proc.returncode}]"}) + "\n")


def _hardening_script(posture: dict) -> str:
    lines = ["#!/usr/bin/env bash", "# THADD OS generated hardening script — review before running", "set -euo pipefail", ""]
    fixes = [f for f in posture["findings"] if not f["ok"] and f.get("fix")]
    lines.append(f"# posture before hardening: {posture['score']}/100 ({posture['grade']})")
    for f in fixes:
        lines.append(f"# {f['severity'].upper()}: {f['title']} — {f['detail']}")
        lines.append(f["fix"])
        lines.append("")
    lines += ["echo 'Hardening steps applied. Re-run THADD Security Center to see the new score.'"]
    return "\n".join(lines)


# --------------------------------------------------------------- hashing/analysis
def cmd_hash(session=None, path: str = "", **_):
    """Multi-algorithm hashing of a file (chain of custody)."""
    p = Path(os.path.expanduser(path))
    if not p.is_file():
        raise RpcError(f"not a file: {path}", "not_found")
    algos = ["sha256", "md5", "sha1", "sha512", "blake2b"]
    hashes = {a: hashlib.new(a) for a in algos}
    size = 0
    with p.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            size += len(chunk)
            for h in hashes.values():
                h.update(chunk)
    return {"path": str(p), "size": size, "sha256": hashes["sha256"].hexdigest(),
            "md5": hashes["md5"].hexdigest(), "sha1": hashes["sha1"].hexdigest(),
            "sha512": hashes["sha512"].hexdigest(), "blake2b": hashes["blake2b"].hexdigest(),
            "hashed_at": time.strftime("%Y-%m-%dT%H:%M:%S")}


SIGNATURES = [
    (b"MZ", "Windows PE executable (DOS stub)"),
    (b"\x7fELF", "ELF executable (Linux/Unix)"),
    (b"\xca\xfe\xba\xbe", "Mach-O fat binary (macOS universal)"),
    (b"\xfe\xed\xfa\xce", "Mach-O 32-bit (macOS)"),
    (b"\xfe\xed\xfa\xcf", "Mach-O 64-bit (macOS)"),
    (b"PK\x03\x04", "ZIP archive / OOXML / APK / JAR"),
    (b"7z\xbc\xaf\x27\x1c", "7-Zip archive"),
    (b"Rar!\x1a\x07", "RAR archive"),
    (b"\x1f\x8b", "gzip stream"),
    (b"BZh", "bzip2 stream"),
    (b"\xfd7zXZ\x00", "xz stream"),
    (b"\x28\xb5\x2f\xfd", "zstandard stream"),
    (b"hsqs", "squashfs filesystem (live ISO root)"),
    (b"\x53\xef", "ext2/3/4 superblock"),
    (b"regf", "Windows registry hive"),
    (b"SQLite format 3\x00", "SQLite database"),
    (b"%PDF", "PDF document"),
    (b"\x89PNG\r\n\x1a\n", "PNG image"),
    (b"\xff\xd8\xff", "JPEG image"),
    (b"GIF8", "GIF image"),
    (b"RIFF", "RIFF container (WAV/AVI/WebP)"),
    (b"\x00\x00\x01\x00", "ICO image"),
    (b"BM", "BMP image"),
    (b"\x50\x4b\x05\x06", "ZIP end-of-central-directory"),
    (b"\xd0\xcf\x11\xe0", "OLE2 (legacy Office / MSI)"),
    (b"MSCF", "Microsoft cabinet (CAB)"),
    (b"\x4c\x00\x00\x00\x01\x14\x02\x00", "Windows shortcut (LNK)"),
    (b"ITSF", "Microsoft compiled HTML help (CHM)"),
    (b"\x03\x00\x00\x00", "Windows event log (EVTX header part)"),
    (b"ElfFile\x00", "Windows event log (EVTX)"),
    (b"LUKS\xba\xbe", "LUKS encrypted volume"),
    (b"APSB", "APFS volume superblock"),
    (b"NXSB", "APFS container"),
    (b"H+", "HFS+ volume"),
    (b"NTFS    ", "NTFS boot sector"),
    (b"EXFAT   ", "exFAT boot sector"),
    (b"ssh-rsa", "SSH RSA public key"),
    (b"-----BEGIN", "PEM key/certificate"),
    (b"$y$", "yescrypt password hash"),
    (b"$6$", "SHA-512 crypt password hash"),
    (b"\x55\xaa", "MBR boot signature (offset-dependent)"),
]

SUSPICIOUS_STRINGS = [
    (r"(?i)cmd\.exe\s*/c", "Windows shell command execution"),
    (r"(?i)powershell.*-enc", "Base64-encoded PowerShell (fileless)"),
    (r"(?i)base64_decode", "Base64 payload decoding (webshell pattern)"),
    (r"(?i)/dev/tcp/", "Bash reverse-shell trick"),
    (r"(?i)nc\s+-[el]", "Netcat listener / shell"),
    (r"(?i)chmod\s+\+x\s+/tmp", "Execute from /tmp"),
    (r"(?i)wget|curl.*\|\s*(sh|bash)", "Remote script piping"),
    (r"(?i)Mimikatz|sekurlsa", "Credential dumping tool"),
    (r"(?i)meterpreter|msfvenom|shellcode", "Exploitation framework artefact"),
    (r"(?i)ransom|decrypt_instruction|your files have been encrypted", "Ransomware note pattern"),
    (r"(?i)keylog|GetAsyncKeyState|SetWindowsHookEx", "Keystroke interception"),
    (r"(?i)VirtualAllocEx|WriteProcessMemory|CreateRemoteThread", "Process injection APIs"),
    (r"(?i)/etc/shadow", "Credential file access"),
    (r"(?i)TOR|onion", "Anonymity network reference"),
    (r"(?i)schtasks|at\.exe|systemd.*timer", "Scheduled persistence"),
    (r"(?i)gateway\.php|c99\.php|r57", "Known webshell names"),
]


def cmd_analyze(session=None, path: str = "", max_strings: int = 4000, carve: bool = False, **_):
    """Reverse-engineer / forensically analyse a single file."""
    p = Path(os.path.expanduser(path))
    if not p.exists():
        raise RpcError(f"not found: {path}", "not_found")
    if p.is_dir():
        raise RpcError("target is a directory — use a file or an image", "bad_value")
    size = p.stat().st_size
    report: dict = {"path": str(p), "size": size, "name": p.name,
                    "modified": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(p.stat().st_mtime)),
                    "hashes": {}, "notes": []}
    algos = ["sha256", "md5", "sha1"]
    hashes = {a: hashlib.new(a) for a in algos}
    head = b""
    with p.open("rb") as fh:
        first = True
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            if first:
                head = chunk[:4096]
                first = False
            for h in hashes.values():
                h.update(chunk)
    report["hashes"] = {a: h.hexdigest() for a, h in hashes.items()}
    report["sha256"] = report["hashes"]["sha256"]

    # ---- type detection
    matched = []
    for sig, name in SIGNATURES:
        if head.startswith(sig):
            matched.append(name)
    if b"MZ" == head[:2]:
        report["pe"] = _pe_info(p)
    if head[:4] == b"\x7fELF":
        report["elf"] = _elf_info(p)
    report["filetype"] = "; ".join(matched) if matched else "unknown/data"
    report["magic"] = head[:16].hex()

    # ---- entropy (overall + windows, to find packing/encryption)
    windows = []
    with p.open("rb") as fh:
        offset = 0
        while offset < size and len(windows) < 256:
            chunk = fh.read(1 << 20)
            if not chunk:
                break
            windows.append({"offset": offset, "entropy": _entropy(chunk)})
            offset += len(chunk)
    report["entropy_windows"] = windows[:64]
    report["entropy"] = round(sum(w["entropy"] for w in windows) / len(windows), 4) if windows else 0.0
    report["entropy_verdict"] = ("encrypted or compressed (packed malware body, archive or crypto container)"
                                 if report["entropy"] > 7.5 else
                                 "high entropy, likely compressed" if report["entropy"] > 6.5 else
                                 "normal executable/data entropy" if report["entropy"] > 4 else
                                 "low entropy (text, code, structured data)")
    # ---- strings + indicators
    strings = _extract_strings(p, max_strings)
    report["strings"] = [s for s in strings if len(s) > 7][:120]
    indicators = []
    blob = "\n".join(strings)
    for pattern, label in SUSPICIOUS_STRINGS:
        hits = re.findall(pattern, blob)
        if hits:
            indicators.append(f"{label} ({len(hits)} hit(s))")
    urls = sorted(set(re.findall(r"https?://[^\s\"'<>]{4,120}", blob)))[:40]
    ips = sorted(set(re.findall(r"\b(?:\d{1,3}\.){3}\d{1,3}\b", blob)))[:40]
    emails = sorted(set(re.findall(r"[\w.+-]+@[\w-]+\.[\w.]{2,}", blob)))[:20]
    if urls:
        indicators.append(f"{len(urls)} embedded URL(s)")
    if ips:
        indicators.append(f"{len(ips)} IP address(es)")
    report["urls"], report["ips"], report["emails"] = urls, ips, emails
    report["indicators"] = indicators

    # ---- embedded files (carving signatures inside this file)
    embedded = _carve(p, size)
    report["embedded"] = embedded
    if embedded:
        report["notes"].append("embedded container(s) found — nested payloads are common in droppers/ISO-wrapped malware")

    # ---- disk image?  run the full OS analysis
    if size > 512 * 1024 and (head[510:512] == b"\x55\xaa" or head[0x20:0x24] == b"NXSB" or
                              head[3:11] == b"NTFS    " or head[54:58] in (b"FAT1", b"FAT3") or
                              head[0x438:0x43A] == b"\x53\xef" or head[1024:1026] in (b"H+", b"HX")):
        report["notes"].append("disk image detected — running full OS reverse-engineering triage")
        tr = triage_mod.analyze(str(p), deep=True)
        report["disk_image"] = {
            "scheme": tr.get("partition_table", {}).get("scheme"),
            "os_detected": tr.get("os_detected"),
            "filesystems": tr.get("filesystems"),
            "indicators": tr.get("indicators"),
            "artifacts_summary": {k: (len(v) if isinstance(v, (list, dict)) else v) for k, v in (tr.get("artifacts") or {}).items()},
        }
        report["notes"].append("full report available via Security → Forensics → Analyze image")
    if carve:
        out_dir = data_dir() / "carved" / p.stem
        out_dir.mkdir(parents=True, exist_ok=True)
        extracted = []
        for sig, name in ((b"PK\x03\x04", "zip"), (b"\x89PNG", "png"), (b"\xff\xd8\xff", "jpg"), (b"%PDF", "pdf"), (b"MZ", "pe")):
            idx = head.find(sig)
            if idx >= 0:
                extracted.append({"signature": name, "offset": idx})
        report["carved"] = extracted
    return report


def _entropy(data: bytes) -> float:
    import math

    if not data:
        return 0.0
    counts = [0] * 256
    for b in data:
        counts[b] += 1
    total = len(data)
    ent = 0.0
    for c in counts:
        if c:
            p = c / total
            ent -= p * math.log2(p)
    return round(ent, 4)


def _extract_strings(p: Path, limit: int) -> list[str]:
    out = []
    ascii_buf = bytearray()
    uni_buf = bytearray()
    with p.open("rb") as fh:
        while len(out) < limit:
            chunk = fh.read(1 << 20)
            if not chunk:
                break
            for b in chunk:
                if 32 <= b < 127:
                    ascii_buf.append(b)
                else:
                    if len(ascii_buf) >= 5:
                        out.append(ascii_buf.decode("latin-1"))
                        if len(out) >= limit:
                            break
                    ascii_buf.clear()
            if len(out) >= limit:
                break
    return out


def _carve(p: Path, size: int) -> list[dict]:
    """Find embedded container signatures and their offsets."""
    found = []
    sigs = [(b"PK\x03\x04", "ZIP/Office/APK archive"), (b"\x1f\x8b\x08", "gzip stream"),
            (b"7z\xbc\xaf\x27\x1c", "7-Zip archive"), (b"Rar!\x1a\x07", "RAR archive"),
            (b"%PDF-", "PDF document"), (b"\x89PNG\r\n\x1a\n", "PNG image"),
            (b"\xff\xd8\xff\xe0", "JPEG image"), (b"MZ", "PE executable"),
            (b"\x7fELF", "ELF executable"), (b"hsqs", "squashfs filesystem"),
            (b"regf", "registry hive"), (b"SQLite format 3\x00", "SQLite database"),
            (b"ssh-rsa ", "SSH public key")]
    with p.open("rb") as fh:
        data = fh.read(min(size, 64 << 20))
    for sig, name in sigs:
        start = 0
        count = 0
        while count < 6:
            idx = data.find(sig, start)
            if idx < 0:
                break
            if idx > 0 or sig not in (b"MZ", b"regf"):
                found.append({"signature": name, "offset": idx, "context": data[max(0, idx - 8):idx + 8].hex(),
                              "note": "" if idx == 0 else "nested (not at file start)"})
                count += 1
            start = idx + 1
    return found[:40]


def _pe_info(p: Path) -> dict:
    with p.open("rb") as fh:
        data = fh.read(1 << 20)
    info: dict = {}
    try:
        pe_off = struct.unpack_from("<I", data, 0x3C)[0]
        if data[pe_off : pe_off + 4] != b"PE\0\0":
            return info
        machine = struct.unpack_from("<H", data, pe_off + 4)[0]
        num_sections = struct.unpack_from("<H", data, pe_off + 6)[0]
        ts = struct.unpack_from("<I", data, pe_off + 8)[0]
        characteristics = struct.unpack_from("<H", data, pe_off + 22)[0]
        magic = struct.unpack_from("<H", data, pe_off + 24)[0]
        subsystem = struct.unpack_from("<H", data, pe_off + 92)[0] if magic == 0x20B else struct.unpack_from("<H", data, pe_off + 68)[0]
        dll = bool(characteristics & 0x2000)
        info = {
            "machine": {0x8664: "x86-64", 0x14C: "i386", 0xAA64: "ARM64"}.get(machine, hex(machine)),
            "timestamp": ts, "timestamp_iso": time.strftime("%Y-%m-%d %H:%M:%S", time.gmtime(ts)) if 0 < ts < 4102444800 else "",
            "sections": num_sections, "subsystem": {2: "Windows GUI", 3: "Windows console"}.get(subsystem, subsystem),
            "type": "DLL" if dll else "EXE",
            "compile_hint": "possible timestomping/future timestamp" if ts > time.time() else "plausible",
        }
        sections = []
        opt_size = struct.unpack_from("<H", data, pe_off + 20)[0]
        sec_off = pe_off + 24 + opt_size
        for i in range(min(num_sections, 96)):
            off = sec_off + i * 40
            if off + 40 > len(data):
                break
            name = data[off : off + 8].rstrip(b"\x00").decode("latin-1", "replace")
            vaddr, vsize, raw_size, raw_ptr = struct.unpack_from("<IIII", data, off + 8)
            chars = struct.unpack_from("<I", data, off + 36)[0]
            ent = 0.0
            if raw_size and raw_ptr + raw_size <= len(data):
                ent = _entropy(data[raw_ptr : raw_ptr + min(raw_size, 1 << 20)])
            sections.append({"name": name, "vaddr": hex(vaddr), "vsize": vsize, "raw_size": raw_size,
                             "entropy": ent, "executable": bool(chars & 0x20000000), "writable": bool(chars & 0x80000000)})
        info["section_detail"] = sections
        if any(s["entropy"] > 7.4 for s in sections):
            info["packed"] = "high-entropy section(s) — likely packed/encrypted (UPX, Themida, custom crypter)"
    except (struct.error, IndexError):
        pass
    return info


def _elf_info(p: Path) -> dict:
    with p.open("rb") as fh:
        data = fh.read(4096)
    info: dict = {}
    try:
        bits = data[4]
        endian = "<" if data[5] == 1 else ">"
        machine = struct.unpack_from(endian + "H", data, 18)[0]
        type_ = struct.unpack_from(endian + "H", data, 16)[0]
        info = {
            "class": "64-bit" if bits == 2 else "32-bit",
            "endianness": "little" if endian == "<" else "big",
            "machine": {0x3E: "x86-64", 0x03: "i386", 0xB7: "AArch64", 0x28: "ARM"}.get(machine, hex(machine)),
            "type": {1: "REL (object)", 2: "EXEC", 3: "DYN (PIE/shared)", 4: "CORE (memory dump)"}.get(type_, type_),
            "stripped": b".symtab" not in data,
        }
    except (struct.error, IndexError):
        pass
    return info


# ------------------------------------------------------- disk image triage API
def cmd_forensic_analyze_image(session, path: str = "", stream_id: str = "", save_dir: str = "", **_):
    """Run full OS reverse-engineering over a disk image, streaming progress."""
    sid = stream_id or f"dfir-{uuid.uuid4().hex[:8]}"
    target = os.path.expanduser(path)

    def producer(stream: Stream) -> None:
        stream.meta = {"path": target}
        emit = lambda obj: stream.push(json.dumps(obj) + "\n")  # noqa: E731
        emit({"type": "dfir_start", "path": target})
        try:
            report = triage_mod.analyze(target, deep=True, progress=lambda msg: emit({"type": "log", "line": msg}))
        except Exception as exc:
            emit({"type": "error", "message": f"{type(exc).__name__}: {exc}"})
            emit({"type": "dfir_end"})
            return
        for osd in report.get("os_detected", []):
            emit({"type": "os", **osd})
        for f in report.get("filesystems", []):
            emit({"type": "filesystem", **{k: v for k, v in f.items() if k != "details"}})
        for ind in report.get("indicators", []):
            emit({"type": "indicator", **ind})
        out_dir = os.path.expanduser(save_dir) if save_dir else str(data_dir() / "forensics" / Path(target).stem)
        try:
            saved = triage_mod.save_report(report, out_dir)
            emit({"type": "report", **saved})
        except Exception as exc:
            emit({"type": "error", "message": f"could not save report: {exc}"})
        emit({"type": "summary", **report.get("stats", {})})
        emit({"type": "dfir_end"})

    Stream(session, sid, producer).start()
    return {"stream_id": sid, "target": target}


def cmd_devices(session=None, **_):
    """Enumerate block devices/partitions available for analysis."""
    out = []
    base = Path("/sys/class/block")
    if base.is_dir():
        for dev in sorted(base.iterdir()):
            try:
                size = int((dev / "size").read_text()) * 512
                removable = (dev / "removable").read_text().strip() == "1"
                model = ""
                for candidate in ("device/model", "device/vendor"):
                    f = dev / candidate
                    if f.exists():
                        model += f.read_text(errors="replace").strip() + " "
                out.append({"device": f"/dev/{dev.name}", "size": size, "removable": removable,
                            "model": model.strip(), "loop": dev.name.startswith("loop"),
                            "mounts": _mounts_for(dev.name)})
            except OSError:
                continue
    for path in ("/dev/sr0", "/dev/sr1"):
        if os.path.exists(path):
            out.append({"device": path, "size": 0, "removable": True, "model": "optical drive", "loop": False, "mounts": []})
    return {"devices": out, "images_hint": "Point this at any .img/.dd/.iso/.vhd in ~/Downloads or choose a device"}


def _mounts_for(name: str) -> list[str]:
    mounts = []
    for line in _read("/proc/mounts").splitlines():
        parts = line.split()
        if len(parts) >= 2 and name in parts[0]:
            mounts.append(parts[1])
    return mounts


def cmd_capabilities(session=None, **_):
    """The honest capability matrix for every OS THADD can reverse."""
    return {"matrix": triage_mod.os_capability_matrix(),
            "filesystems": ["NTFS", "FAT12/16/32", "exFAT", "ext2/3/4", "HFS+", "HFSX", "APFS",
                            "Windows registry hives", "MBR", "GPT"],
            "not_parsed": ["btrfs", "XFS", "ZFS", "ReFS", "BitLocker contents", "FileVault contents",
                           "encrypted LUKS contents", "HFS+ file data (catalog only)"],
            "evidence": "All readers are read-only; every report is SHA-256 hashed for chain of custody."}
