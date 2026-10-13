"""THADD OS — system, process, power, network and package APIs (all real, no mocks)."""

from __future__ import annotations

import glob
import json
import os
import platform
import pwd
import re
import shlex
import shutil
import socket
import subprocess
import threading
import time
from pathlib import Path

from ..config import Config, data_dir, os_pretty_name
from ..core import RpcError, Stream, json_dumps

START_TIME = time.time()
_CPU_SAMPLE_LOCK = threading.Lock()
_CPU_LAST: dict = {}


def _read(path: str) -> str:
    try:
        return Path(path).read_text()
    except OSError:
        return ""


def _have(cmd: str) -> bool:
    return shutil.which(cmd) is not None


def _run(cmd: list[str], timeout: float = 20.0, **kw) -> dict:
    """Run a command, never raise, always return a structured result."""
    try:
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
            **kw,
        )
        return {
            "cmd": " ".join(shlex.quote(c) for c in cmd),
            "code": proc.returncode,
            "stdout": proc.stdout[-200000:],
            "stderr": proc.stderr[-40000:],
            "ok": proc.returncode == 0,
        }
    except FileNotFoundError:
        return {"cmd": " ".join(cmd), "code": 127, "stdout": "", "stderr": f"not found: {cmd[0]}", "ok": False}
    except subprocess.TimeoutExpired:
        return {"cmd": " ".join(cmd), "code": 124, "stdout": "", "stderr": "timeout", "ok": False}
    except Exception as exc:
        return {"cmd": " ".join(cmd), "code": 1, "stdout": "", "stderr": str(exc), "ok": False}


# --------------------------------------------------------------------------- info
def cmd_info(session=None, **_):
    """Static system identification (OS, CPU, memory, GPU, displays)."""
    cpu_model = ""
    for line in _read("/proc/cpuinfo").splitlines():
        if line.lower().startswith("model name"):
            cpu_model = line.split(":", 1)[1].strip()
            break
    virt = "physical"
    di = _read("/sys/class/dmi/id/product_name").strip()
    if os.path.exists("/sys/module/vboxguest") or "VirtualBox" in _read("/sys/class/dmi/id/sys_vendor"):
        virt = "VirtualBox"
    elif os.path.exists("/sys/module/vmw_vmci") or "VMware" in _read("/sys/class/dmi/id/product_name"):
        virt = "VMware"
    elif os.path.exists("/dev/kvm_caps") or "QEMU" in _read("/sys/class/dmi/id/product_name"):
        virt = "QEMU/KVM"
    osr = {}
    for line in _read("/etc/os-release").splitlines():
        if "=" in line:
            k, v = line.split("=", 1)
            osr[k] = v.strip().strip('"')
    return {
        "os": {
            "pretty": os_pretty_name(),
            "thadd_version": osr.get("THADD_VERSION", "1.0"),
            "codename": osr.get("THADD_CODENAME", "Nebula Prime"),
            "build": osr.get("THADD_BUILD", "dev"),
            "edition": osr.get("THADD_EDITION", "Development"),
            "base": osr.get("PRETTY_NAME", platform.platform()),
            "kernel": platform.release(),
            "arch": platform.machine(),
            "hostname": socket.gethostname(),
            "virtualization": virt,
            "product": di or "unknown",
            "live": os.path.exists("/run/live/medium") or os.environ.get("THADD_LIVE") == "1",
            "uptime": time.time() - START_TIME,
            "boot_time": time.time() - (float(_read("/proc/uptime").split()[0] or 0.0)),
        },
        "cpu": {
            "model": cpu_model or platform.processor() or "unknown",
            "cores": os.cpu_count() or 1,
            "max_mhz": _max_freq(),
            "flags": _cpu_flags()[:64],
        },
        "memory": _memory(),
        "gpu": _gpu(),
        "displays": _displays(),
        "tools": _tool_inventory(),
        "python": platform.python_version(),
        "thadd_data": str(data_dir()),
    }


def _max_freq() -> int:
    try:
        return int(int(_read("/sys/devices/system/cpu/cpu0/cpufreq/cpuinfo_max_freq").strip()) / 1000)
    except Exception:
        return 0


def _cpu_flags() -> list[str]:
    for line in _read("/proc/cpuinfo").splitlines():
        if line.lower().startswith("flags"):
            return line.split(":", 1)[1].split()
    return []


def _memory() -> dict:
    mem = {}
    for line in _read("/proc/meminfo").splitlines():
        k, _, v = line.partition(":")
        mem[k.strip()] = int(v.strip().split()[0]) * 1024 if v.strip().split() else 0
    total = mem.get("MemTotal", 0)
    avail = mem.get("MemAvailable", 0)
    swap_total = mem.get("SwapTotal", 0)
    swap_free = mem.get("SwapFree", 0)
    return {
        "total": total,
        "available": avail,
        "used": max(0, total - avail),
        "percent": round(100 * (total - avail) / total, 1) if total else 0.0,
        "cached": mem.get("Cached", 0),
        "buffers": mem.get("Buffers", 0),
        "swap_total": swap_total,
        "swap_used": max(0, swap_total - swap_free),
    }


def _gpu() -> list[dict]:
    out = []
    if _have("lspci"):
        res = _run(["lspci", "-mm"], timeout=6)
        for line in res["stdout"].splitlines():
            low = line.lower()
            if "vga" in low or "3d controller" in low or "display" in low:
                parts = re.findall(r'"([^"]*)"', line)
                out.append({"raw": line, "vendor": parts[1] if len(parts) > 1 else "", "device": parts[2] if len(parts) > 2 else ""})
    if not out:
        for card in glob.glob("/sys/class/drm/card*/device/vendor"):
            out.append({"raw": Path(card).read_text().strip(), "vendor": "", "device": ""})
    return out


def _displays() -> list[dict]:
    out = []
    for mode in glob.glob("/sys/class/drm/*/modes"):
        txt = _read(mode)
        if txt.strip():
            name = Path(mode).parent.name
            out.append({"connector": name, "modes": txt.split()[:6]})
    return out


TOOL_GROUPS = {
    "languages": ["python3", "node", "npm", "gcc", "g++", "clang", "make", "cmake", "go", "rustc", "cargo", "java", "dotnet", "perl", "ruby", "php", "lua", "quickjs"],
    "shells": ["bash", "zsh", "fish", "sh", "dash", "pwsh", "tmux", "screen"],
    "vcs": ["git", "gh", "svn", "hg"],
    "security": ["nmap", "msfconsole", "hashcat", "john", "hydra", "sqlmap", "aircrack-ng", "wireshark", "tshark", "gobuster", "nikto", "wpscan", "yara", "clamscan", "rkhunter", "lynis", "aide", "firejail", "bwrap", "openssl", "gpg", "age"],
    "forensics": ["binwalk", "radare2", "r2", "objdump", "readelf", "strings", "foremost", "scalpel", "testdisk", "photorec", "ddrescue", "sleuthkit", "fls", "icat", "mmls", "volatility3", "exiftool", "steghide", "zsteg", "gdb", "ltrace", "strace", "perf", "ghex", "xxd", "hexdump", "capinfos", "tsk_recover"],
    "pwn": ["gdb", "gdb-multiarch", "pwntools", "ropgadget", "one_gadget", "checksec", "nasm", "ndisasm", "ghidra", "cutter"],
    "network": ["curl", "wget", "ip", "ss", "nft", "ufw", "iptables", "tcpdump", "ncat", "socat", "ssh", "ssh-keygen", "openvpn", "wireguard", "dig", "host", "nslookup", "whois", "traceroute", "mtr", "masscan", "hping3", "ettercap"],
    "browsers": ["firefox", "firefox-esr", "chromium", "chromium-browser", "google-chrome", "brave-browser", "epiphany", "lynx", "w3m", "elinks", "links2", "qutebrowser", "vivaldi", "opera"],
    "media": ["ffmpeg", "ffprobe", "convert", "magick", "sox", "mpv", "vlc", "gimp", "inkscape", "scrot", "import", "xdotool", "recordmydesktop"],
    "office": ["libreoffice", "pandoc", "zathura", "evince", "okular", "pdftotext", "qpdf"],
    "virt": ["qemu-system-x86_64", "virt-manager", "docker", "podman", "lxc", "wine", "winecfg", "dosbox", "virtualbox", "VBoxClient"],
    "ai": ["ollama", "llama-cli", "python3", "jupyter", "pip3"],
}


def _tool_inventory() -> dict:
    inv: dict[str, list[str]] = {}
    for group, bins in TOOL_GROUPS.items():
        inv[group] = [b for b in bins if _have(b)]
    return inv


def cmd_tools(session=None, **_):
    """Which of the ~200 tracked tools are present on this system."""
    return {"groups": _tool_inventory(), "count": sum(len(v) for v in _tool_inventory().values())}


# ------------------------------------------------------------------------ metrics
def cmd_metrics(session=None, **_):
    """Live CPU / memory / network / disk / temperature sample."""
    return _metrics()


def _metrics() -> dict:
    with _CPU_SAMPLE_LOCK:
        stat = _read("/proc/stat")
        line = stat.split("\n", 1)[0]
        parts = [int(x) for x in line.split()[1:]]
        idle = parts[3] + (parts[4] if len(parts) > 4 else 0)
        total = sum(parts)
        last = _CPU_LAST.get("cpu")
        if last:
            dt = max(1, total - last[0])
            usage = round(100 * (1 - (idle - last[1]) / dt), 1)
        else:
            usage = 0.0
        _CPU_LAST["cpu"] = (total, idle)
    per_core = []
    with _CPU_SAMPLE_LOCK:
        for i, cline in enumerate(_read("/proc/stat").splitlines()):
            if not cline.startswith("cpu") or cline.startswith("cpu "):
                continue
            try:
                parts = [int(x) for x in cline.split()[1:]]
                idle = parts[3] + (parts[4] if len(parts) > 4 else 0)
                tot = sum(parts)
                key = f"cpu{i}"
                last = _CPU_LAST.get(key)
                if last:
                    dt = max(1, tot - last[0])
                    per_core.append(round(100 * (1 - (idle - last[1]) / dt), 1))
                else:
                    per_core.append(0.0)
                _CPU_LAST[key] = (tot, idle)
            except (ValueError, IndexError):
                per_core.append(0.0)
    load = [float(x) for x in _read("/proc/loadavg").split()[:3]]
    temp = None
    for zone in glob.glob("/sys/class/thermal/thermal_zone*/temp"):
        try:
            temp = round(int(Path(zone).read_text().strip()) / 1000, 1)
            break
        except Exception:
            pass
    net = {}
    for line in _read("/proc/net/dev").splitlines()[2:]:
        name, _, rest = line.partition(":")
        fields = rest.split()
        if len(fields) >= 9:
            net[name.strip()] = {"rx": int(fields[0]), "tx": int(fields[8])}
    return {
        "cpu": {"percent": usage, "cores": per_core or [usage], "load": load, "temp": temp},
        "memory": _memory(),
        "net": net,
        "disk": _disk(),
        "uptime": float(_read("/proc/uptime").split()[0] or 0.0),
        "processes": len(glob.glob("/proc/[0-9]*")),
        "timestamp": time.time(),
    }


def _disk() -> list[dict]:
    out = []
    seen = set()
    for line in _read("/proc/mounts").splitlines():
        parts = line.split()
        if len(parts) < 3:
            continue
        dev, mnt, fstype = parts[0], parts[1].replace("\\040", " "), parts[2]
        if fstype in ("proc", "sysfs", "devpts", "cgroup", "cgroup2", "tmpfs", "devtmpfs", "overlay", "squashfs", "securityfs", "pstore", "debugfs", "tracefs", "fusectl", "configfs", "mqueue", "hugetlbfs", "binfmt_misc", "autofs", "ramfs", "efivarfs", "bpf", "rpc_pipefs"):
            continue
        if mnt in seen:
            continue
        seen.add(mnt)
        try:
            st = os.statvfs(mnt)
            total = st.f_blocks * st.f_frsize
            free = st.f_bavail * st.f_frsize
            out.append(
                {
                    "device": dev,
                    "mount": mnt,
                    "fstype": fstype,
                    "total": total,
                    "used": total - free,
                    "free": free,
                    "percent": round(100 * (total - free) / total, 1) if total else 0.0,
                }
            )
        except OSError:
            continue
    return out


def cmd_disk(session=None, **_):
    """Mounted filesystem usage."""
    return {"filesystems": _disk()}


# ---------------------------------------------------------------------- processes
def cmd_processes(session=None, sort: str = "cpu", limit: int = 200, **_):
    """Process table read straight from /proc."""
    procs = []
    total_mem = _memory()["total"] or 1
    clk = os.sysconf("SC_CLK_TCK") if hasattr(os, "sysconf") else 100
    for path in glob.glob("/proc/[0-9]*"):
        pid = int(Path(path).name)
        try:
            stat = Path(path, "stat").read_text()
            rp = stat.rfind(")")
            name = stat[stat.find("(") + 1 : rp]
            rest = stat[rp + 2 :].split()
            state = rest[0]
            utime, stime = int(rest[11]), int(rest[12])
            rss_pages = int(rest[21])
            threads = int(rest[17])
            cmdline = Path(path, "cmdline").read_bytes().replace(b"\x00", b" ").decode("utf-8", "replace").strip()
            status = Path(path, "status").read_text()
            uid = 0
            for line in status.splitlines():
                if line.startswith("Uid:"):
                    uid = int(line.split()[1])
                    break
            try:
                user = pwd.getpwuid(uid).pw_name
            except KeyError:
                user = str(uid)
            mem = rss_pages * 4096
            procs.append(
                {
                    "pid": pid,
                    "ppid": int(rest[1]),
                    "name": name,
                    "state": state,
                    "cpu_ticks": utime + stime,
                    "cpu_time": round((utime + stime) / clk, 2),
                    "mem": mem,
                    "mem_percent": round(100 * mem / total_mem, 2),
                    "threads": threads,
                    "user": user,
                    "cmdline": cmdline or f"[{name}]",
                }
            )
        except (OSError, ValueError, IndexError):
            continue
    procs.sort(key=lambda p: p["mem"] if sort == "mem" else p["cpu_time"], reverse=True)
    return {"processes": procs[:limit], "total": len(procs)}


def cmd_kill(session=None, pid: int = 0, signal: str = "TERM", **_):
    """Terminate a process (SIGTERM/SIGKILL/SIGSTOP/SIGCONT)."""
    if pid <= 1:
        raise RpcError("refusing to signal pid <= 1", "denied")
    sig = {"TERM": 15, "KILL": 9, "STOP": 19, "CONT": 18, "HUP": 1, "INT": 2}.get(str(signal).upper())
    if sig is None:
        raise RpcError(f"unsupported signal {signal}", "bad_signal")
    try:
        os.kill(pid, sig)
    except ProcessLookupError:
        raise RpcError("no such process", "not_found")
    except PermissionError:
        raise RpcError("permission denied", "denied")
    return {"killed": pid, "signal": signal}


# ------------------------------------------------------------------------ network
def cmd_network(session=None, **_):
    """Interfaces, addresses, routes, firewall and connectivity summary."""
    res = {"interfaces": [], "default_route": "", "dns": [], "firewall": _firewall_state()}
    if _have("ip"):
        j = _run(["ip", "-j", "addr"], timeout=6)
        try:
            res["interfaces"] = json.loads(j["stdout"])
        except Exception:
            res["interfaces"] = []
        r = _run(["ip", "route", "show", "default"], timeout=6)
        res["default_route"] = r["stdout"].strip()
    dns = []
    for line in _read("/etc/resolv.conf").splitlines():
        if line.startswith("nameserver"):
            dns.append(line.split()[1])
    res["dns"] = dns
    res["hostname"] = socket.gethostname()
    res["online"] = _online()
    return res


def _firewall_state() -> dict:
    state = {"tool": "none", "active": False, "detail": "no firewall front-end detected"}
    if _have("ufw"):
        r = _run(["ufw", "status"], timeout=8)
        state = {"tool": "ufw", "active": "Status: active" in r["stdout"], "detail": r["stdout"].strip()[:2000]}
    elif _have("nft"):
        r = _run(["nft", "list", "ruleset"], timeout=8)
        state = {"tool": "nftables", "active": bool(r["stdout"].strip()), "detail": r["stdout"].strip()[:2000]}
    elif _have("iptables"):
        r = _run(["iptables", "-S"], timeout=8)
        state = {"tool": "iptables", "active": bool(r["stdout"].strip()), "detail": r["stdout"].strip()[:2000]}
    return state


def _online(timeout: float = 2.0) -> bool:
    for host, port in (("1.1.1.1", 53), ("8.8.8.8", 53), ("api.groq.com", 443)):
        try:
            with socket.create_connection((host, port), timeout=timeout):
                return True
        except OSError:
            continue
    return False


def cmd_net_test(session=None, host: str = "1.1.1.1", count: int = 2, **_):
    """ping/traceroute style reachability probe (uses ping when available)."""
    if _have("ping"):
        return _run(["ping", "-c", str(max(1, min(int(count), 5))), "-W", "2", host], timeout=20)
    ok = _online()
    return {"ok": ok, "stdout": "ping unavailable; socket probe: " + ("online" if ok else "offline"), "code": 0 if ok else 1, "stderr": ""}


def cmd_net_fetch(session=None, url: str = "", timeout: float = 20.0, max_bytes: int = 400000, **_):
    """Fetch a URL (used by the AI for live documentation/web lookups)."""
    if not url.startswith(("http://", "https://")):
        raise RpcError("only http/https urls are allowed", "bad_url")
    from urllib import request as urlreq

    req = urlreq.Request(url, headers={"User-Agent": "THADD-OS/1.0 (+shell)"})
    try:
        with urlreq.urlopen(req, timeout=timeout) as resp:
            raw = resp.read(max_bytes)
            ctype = resp.headers.get("Content-Type", "")
    except Exception as exc:
        raise RpcError(f"fetch failed: {exc}", "network")
    text = raw.decode("utf-8", "replace")
    if "html" in ctype:
        text = re.sub(r"(?is)<(script|style)[^>]*>.*?</\1>", " ", text)
        text = re.sub(r"(?s)<[^>]+>", " ", text)
        text = re.sub(r"\s+", " ", text)
    return {"url": url, "content_type": ctype, "text": text[:max_bytes], "bytes": len(raw)}


# ------------------------------------------------------------------------- power
def cmd_power(session=None, action: str = "status", **_):
    """Session/power control: lock, logout, reboot, shutdown, suspend, status."""
    mapping = {
        "reboot": ["systemctl", "reboot"],
        "shutdown": ["systemctl", "poweroff"],
        "poweroff": ["systemctl", "poweroff"],
        "suspend": ["systemctl", "suspend"],
        "hibernate": ["systemctl", "hibernate"],
        "logout": ["loginctl", "terminate-user", os.environ.get("USER", "root")],
        "lock": ["loginctl", "lock-session"],
    }
    if action == "status":
        return {"uptime": float(_read("/proc/uptime").split()[0] or 0.0), "action": "status"}
    if action == "cancel":
        return _run(["shutdown", "-c"], timeout=5)
    if action not in mapping:
        raise RpcError(f"unknown action {action}", "bad_action")
    cmd = mapping[action]
    if not _have(cmd[0]):
        raise RpcError(f"{cmd[0]} is not available in this environment", "unavailable")
    if action in ("reboot", "shutdown", "poweroff", "hibernate"):
        # delayed so the shell can show a graceful animation first
        threading.Thread(target=lambda: (time.sleep(1.0), _run(cmd, timeout=30)), daemon=True).start()
        return {"scheduled": action}
    return _run(cmd, timeout=15)


def cmd_logs(session=None, unit: str = "", lines: int = 200, path: str = "", **_):
    """Read the journal or a log file (used by diagnostics + AI)."""
    lines = max(10, min(int(lines), 5000))
    if path:
        p = Path(path)
        if not p.is_file():
            raise RpcError("log not found", "not_found")
        content = p.read_text(errors="replace").splitlines()[-lines:]
        return {"path": path, "lines": content}
    if _have("journalctl"):
        cmd = ["journalctl", "-n", str(lines), "--no-pager", "-o", "short"]
        if unit:
            cmd += ["-u", unit]
        elif _have("systemctl") and os.path.isdir("/run/systemd/system"):
            cmd += ["-b"]
        return _run(cmd, timeout=20)
    for candidate in ("/var/log/syslog", "/var/log/messages", "/var/log/kern.log"):
        if os.path.exists(candidate):
            return {"path": candidate, "lines": Path(candidate).read_text(errors="replace").splitlines()[-lines:]}
    return {"path": "", "lines": []}


def cmd_hostname(session=None, name: str = "", **_):
    """Change the hostname (live + persisted in the THADD config)."""
    name = re.sub(r"[^a-zA-Z0-9-]", "", name)[:63]
    if not name:
        raise RpcError("invalid hostname", "bad_value")
    if _have("hostnamectl"):
        _run(["hostnamectl", "set-hostname", name], timeout=10)
    else:
        _run(["hostname", name], timeout=5)
    Config().set("system", "hostname", name)
    return {"hostname": name}


# ---------------------------------------------------------------------- packages
def cmd_packages(session=None, query: str = "", **_) -> dict:
    """Query the apt package database (installed + searchable)."""
    if _have("dpkg-query") and not query:
        r = _run(["dpkg-query", "-W", "-f=${Package}\t${Version}\t${Status}\n"], timeout=60)
        pkgs = []
        for line in r["stdout"].splitlines():
            parts = line.split("\t")
            if len(parts) >= 3 and "installed" in parts[2]:
                pkgs.append({"name": parts[0], "version": parts[1], "installed": True})
        return {"packages": pkgs, "count": len(pkgs), "manager": "dpkg"}
    if _have("apt-cache") and query:
        r = _run(["apt-cache", "search", "--names-only", query], timeout=30)
        out = []
        for line in r["stdout"].splitlines()[:60]:
            name, _, desc = line.partition(" - ")
            out.append({"name": name.strip(), "description": desc.strip()})
        return {"results": out, "query": query, "manager": "apt"}
    return {"packages": [], "count": 0, "manager": "none"}


def cmd_install_package(session=None, package: str = "", **_):
    """Install a package through the OS package manager (requires root)."""
    if not re.fullmatch(r"[a-zA-Z0-9][a-zA-Z0-9+._-]{0,80}", package or ""):
        raise RpcError("invalid package name", "bad_value")
    if not _have("apt-get"):
        raise RpcError("apt-get not present on this system", "unavailable")
    return _run(["apt-get", "install", "-y", "--no-install-recommends", package], timeout=900)


def cmd_services(session=None, **_):
    """List systemd units and their state."""
    if not _have("systemctl"):
        return {"units": [], "manager": "init"}
    r = _run(["systemctl", "list-units", "--type=service", "--all", "--no-pager", "--plain", "--no-legend"], timeout=20)
    units = []
    for line in r["stdout"].splitlines():
        parts = line.split()
        if len(parts) >= 4:
            units.append({"unit": parts[0], "load": parts[1], "active": parts[2], "sub": parts[3], "description": " ".join(parts[4:])})
    return {"units": units, "manager": "systemd"}


def cmd_service_action(session=None, unit: str = "", action: str = "status", **_):
    """Start/stop/restart/enable a systemd unit."""
    if not re.fullmatch(r"[A-Za-z0-9@._-]{1,80}", unit or ""):
        raise RpcError("invalid unit", "bad_value")
    if action not in ("start", "stop", "restart", "enable", "disable", "status", "reload"):
        raise RpcError("invalid action", "bad_value")
    if not _have("systemctl"):
        raise RpcError("systemd not available", "unavailable")
    cmd = ["systemctl", action, unit] if action != "status" else ["systemctl", "status", unit, "--no-pager"]
    return _run(cmd, timeout=60)


def cmd_env_info(session=None, **_):
    """Which THADD subsystems are live in this environment (dev vs ISO)."""
    return {
        "mode": os.environ.get("THADD_MODE", "dev"),
        "live_iso": os.path.exists("/run/live/medium"),
        "sessions": _have("loginctl"),
        "x11": bool(os.environ.get("DISPLAY")),
        "wayland": os.environ.get("XDG_SESSION_TYPE") == "wayland",
        "kiosk": os.environ.get("THADD_KIOSK") == "1",
        "serial": os.path.exists("/dev/ttyS0"),
        "ffmpeg": _have("ffmpeg"),
        "xdotool": _have("xdotool"),
        "scrot": _have("scrot"),
        "root": os.geteuid() == 0,
    }
