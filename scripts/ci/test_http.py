#!/usr/bin/env python3
"""
THADD OS CI — HTTP & WebSocket end-to-end checks.

Verifies the exact path a browser takes:
  portal → /healthz → noVNC client → WebSocket handshake → Xvnc RFB banner.

Pure stdlib — runs anywhere.
"""
import base64
import json
import os
import socket
import sys
import urllib.request

HOST = "127.0.0.1"
PORT = int(os.environ.get("PORT", "8080"))
FAILURES = []


def check(name, cond, extra=""):
    status = "PASS" if cond else "FAIL"
    print(f"{status} - {name} {extra}")
    if not cond:
        FAILURES.append(name)


def get(path):
    with urllib.request.urlopen(f"http://{HOST}:{PORT}{path}", timeout=10) as r:
        return r.status, r.read()


def ws_handshake(path):
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
    data = s.recv(64)
    s.close()
    return data


# --- HTTP surface -----------------------------------------------------------
status, body = get("/healthz")
check("GET /healthz → 200 + ok", status == 200 and b'"ok"' in body, f"[{status}]")

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
try:
    banner = ws_handshake("/websockify")
    check("WS /websockify → RFB banner from live desktop", banner.startswith(b"RFB "), repr(banner[:24]))
except Exception as e:
    check("WS /websockify → RFB banner from live desktop", False, str(e))

try:
    banner = ws_handshake("/vnc/websockify")
    check("WS /vnc/websockify → RFB banner", banner.startswith(b"RFB "), repr(banner[:24]))
except Exception as e:
    check("WS /vnc/websockify → RFB banner", False, str(e))

if FAILURES:
    print(f"\n❌ {len(FAILURES)} check(s) failed: {FAILURES}")
    sys.exit(1)
print("\n✅ all HTTP/WebSocket checks passed")
