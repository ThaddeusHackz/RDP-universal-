#!/usr/bin/env python3
"""
THADD OS CI — HTTP & WebSocket end-to-end checks.

Verifies the exact path a browser takes:
  portal → /healthz → noVNC client → WebSocket handshake → Xvnc RFB banner.

Pure stdlib — runs anywhere.

Observability: every failed check is ALSO emitted as a GitHub Actions
workflow annotation (::error title=...::...) so the exact failure is visible
on the run summary page even when raw action logs are unavailable.
"""
import base64
import json
import os
import shutil
import socket
import struct
import subprocess
import sys
import time
import urllib.request

HOST = "127.0.0.1"
PORT = int(os.environ.get("PORT", "8080"))
FAILURES = []


def _ann_escape(msg):
    return msg.replace("%", "%25").replace("\r", " ").replace("\n", "|")[:3000]


def _annotate(title, body):
    """Emit a GitHub Actions error annotation (visible without raw logs)."""
    print(f"::error title={title}::{_ann_escape(body)}", flush=True)


def check(name, cond, extra=""):
    status = "PASS" if cond else "FAIL"
    print(f"{status} - {name} {extra}", flush=True)
    if not cond:
        FAILURES.append(name)
        _annotate("THADD-CI", f"{name} failed. {extra}")


def dump_container_diagnostics():
    """Surface live container forensics as workflow annotations.

    Runs only on failure, only when the docker daemon + test container exist.
    Raw action logs can be unreachable in restricted environments; annotations
    always render on the run summary page, so the root cause stays visible.
    """
    if FAILURES == [] or not shutil.which("docker"):
        return
    probes = {
        "supervisorctl": "docker exec thadd supervisorctl status",
        "xvnc.log": "docker exec thadd sh -c 'tail -n 30 /tmp/xvnc.log 2>/dev/null'",
        "xstartup.log": "docker exec thadd sh -c 'tail -n 20 /tmp/xstartup.log 2>/dev/null'",
        "listeners": "docker exec thadd sh -c 'command -v ss >/dev/null && ss -tlnp || true'",
        "container logs (tail)": "docker logs --tail 40 thadd 2>&1",
    }
    for title, cmd in probes.items():
        try:
            out = subprocess.run(
                cmd, shell=True, capture_output=True, text=True, timeout=45
            )
            body = (out.stdout + out.stderr).strip()
        except Exception as e:
            body = f"probe failed: {e}"
        if body:
            _annotate(f"THADD-CI diagnostic: {title}", body)


def get(path):
    """GET path; never raises — returns (0, error-bytes) on failure so every
    check runs and is reported, instead of dying on the first bad hop."""
    try:
        with urllib.request.urlopen(f"http://{HOST}:{PORT}{path}", timeout=10) as r:
            return r.status, r.read()
    except Exception as e:
        return 0, repr(e).encode()


def read_ws_frame(sock, timeout=15):
    """Read one server→client WebSocket frame and return its payload."""
    sock.settimeout(timeout)
    hdr = sock.recv(2)
    if len(hdr) < 2:
        return b""
    length = hdr[1] & 0x7F
    if length == 126:
        length = struct.unpack(">H", sock.recv(2))[0]
    elif length == 127:
        length = struct.unpack(">Q", sock.recv(8))[0]
    data = b""
    while len(data) < length:
        chunk = sock.recv(length - len(data))
        if not chunk:
            break
        data += chunk
    return data


def ws_handshake(path, banner_timeout=15):
    """Perform a WebSocket upgrade and read the first frame payload bytes."""
    s = socket.create_connection((HOST, PORT), timeout=10)
    key = base64.b64encode(os.urandom(16)).decode()
    req = (
        f"GET {path} HTTP/1.1\r\n"
        f"Host: {HOST}:{PORT}\r\n"
        "Upgrade: websocket\r\n"
        "Connection: Upgrade\r\n"
        f"Sec-WebSocket-Key: {key}\r\n"
        "Sec-WebSocket-Version: 13\r\n\r\n"
    )
    s.sendall(req.encode())
    s.settimeout(15)
    resp = b""
    while b"\r\n\r\n" not in resp:
        chunk = s.recv(4096)
        if not chunk:
            break
        resp += chunk
    assert b"101" in resp.split(b"\r\n")[0], f"no upgrade: {resp[:200]!r}"
    # websockify bridges us straight to Xvnc:1 → first bytes are the RFB banner
    data = read_ws_frame(s, timeout=banner_timeout)
    s.close()
    return data


def wait_for_desktop(timeout=150, interval=5):
    """Poll the browser-desktop path until Xvnc answers with an RFB banner.

    The portal can be healthy seconds before Xvnc finishes its first bind
    (supervisord starts the desktop last). Poll instead of racing it.
    """
    deadline = time.time() + timeout
    last = "no attempt completed"
    while time.time() < deadline:
        try:
            banner = ws_handshake("/websockify", banner_timeout=10)
            if banner.startswith(b"RFB "):
                return True, banner
            last = f"unexpected payload {banner[:32]!r}"
        except Exception as e:
            last = str(e)
        time.sleep(interval)
    return False, last


# --- HTTP surface -----------------------------------------------------------
status, body = get("/healthz")
check("GET /healthz → 200 + ok", status == 200 and b'\"ok\"' in body, f"[{status}]")

status, body = get("/")
check("GET / → THADD portal", status == 200 and b"THADD OS" in body, f"[{status}]")

status, body = get("/style.css")
check("GET /style.css", status == 200, f"[{status}]")

status, body = get("/vnc/vnc.html")
check("GET /vnc/vnc.html → noVNC client", status == 200 and b"noVNC" in body, f"[{status}]")

status, body = get("/api/creds")
try:
    creds = json.loads(body)
    check("GET /api/creds → JSON with username", status == 200 and bool(creds.get("username")), f"[{status}]")
except Exception:
    check("GET /api/creds → JSON with username", False, f"[{status}] body={body[:80]!r}")

# --- the real browser path: WebSocket → Xvnc ---------------------------------
desktop_ok, info = wait_for_desktop()
check(
    "WS /websockify → RFB banner from live desktop",
    desktop_ok,
    repr(info[:24]) if desktop_ok else f"no live desktop after wait: {info}",
)

if desktop_ok:
    try:
        banner = ws_handshake("/vnc/websockify")
        check("WS /vnc/websockify → RFB banner", banner.startswith(b"RFB "), repr(banner[:24]))
    except Exception as e:
        check("WS /vnc/websockify → RFB banner", False, str(e))
else:
    check("WS /vnc/websockify → RFB banner", False, "skipped — desktop never came up")

if FAILURES:
    print(f"\n❌ {len(FAILURES)} check(s) failed: {FAILURES}", flush=True)
    dump_container_diagnostics()
    sys.exit(1)
print("\n✅ all HTTP/WebSocket checks passed", flush=True)
