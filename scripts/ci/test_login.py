#!/usr/bin/env python3
"""
THADD OS CI — prove the username+password actually authenticate.

The previous suite could go green while RDP login was broken:
  * wait-health.sh only curled a static nginx /healthz
  * rdp-login.sh treated "FreeRDP still running after 25s" as success
  * the desktop audit looked at the *browser* Xvnc session, not the RDP one
  * the committed screenshot was a 2 KB black JPEG

This script inspects the running container the way a forensic examiner
would: shadow hash, PAM stack, xrdp.ini, VNC passwd, pamtester against
the real xrdp-sesman service (correct password MUST pass, wrong password
MUST fail), and the /api/creds + /api/login-status HTTP surface.
"""
import json
import os
import shutil
import subprocess
import sys
import urllib.request

USER = os.environ.get("THADD_USER", "thadd")
PASSWORD = os.environ.get("THADD_PASSWORD", "ThaddTest123!")
PORT = int(os.environ.get("PORT", "8080"))
FAILURES = []


def annotate(title, body):
    body = body.replace("%", "%25").replace("\r", " ").replace("\n", "|")[:3000]
    print(f"::error title={title}::{body}", flush=True)


def check(name, cond, extra=""):
    status = "PASS" if cond else "FAIL"
    print(f"{status} - {name} {extra}", flush=True)
    if not cond:
        FAILURES.append(name)
        annotate("THADD-CI login", f"{name} failed. {extra}")


def docker_exec(inner, timeout=45):
    if not shutil.which("docker"):
        return 127, "docker not available"
    cmd = ["docker", "exec", "thadd", "bash", "-lc", inner]
    try:
        out = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    except Exception as e:
        return 1, str(e)
    return out.returncode, (out.stdout + out.stderr).strip()


def http_json(path):
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{PORT}{path}", timeout=10) as r:
            return r.status, json.loads(r.read().decode())
    except Exception as e:
        return 0, {"error": repr(e)}


# --- in-container login path ------------------------------------------------
rc, out = docker_exec(
    f"getent shadow {USER} | awk -F: '{{print $2}}'"
)
check("shadow hash is a real crypt hash", rc == 0 and out.startswith("$"), out[:40])

rc, out = docker_exec(
    "grep -E '^[[:space:]]*session[[:space:]]+required[[:space:]]+pam_loginuid' "
    "/etc/pam.d/xrdp-sesman; test $? -ne 0"
)
check("PAM does not require pam_loginuid (container-safe)", rc == 0, out)

rc, out = docker_exec("grep -E '^[[:space:]]*autorun=Xvnc' /etc/xrdp/xrdp.ini")
check("xrdp.ini autorun=Xvnc (Xorg is not installed)", rc == 0, out)

rc, out = docker_exec("grep -E '^[[:space:]]*security_layer=tls' /etc/xrdp/xrdp.ini")
check("xrdp.ini security_layer=tls (no broken NLA/HYBRID)", rc == 0, out)

rc, out = docker_exec(
    f"test -s /home/{USER}/.vnc/passwd && echo present"
)
check("VNC password file exists in the user's home", rc == 0, out)

rc, out = docker_exec(f"id -nG {USER}")
check("user is in tsusers", rc == 0 and "tsusers" in out.split(), out)

def sh_single(value):
    """Wrap value in POSIX single quotes for bash -lc."""
    return "'" + value.replace("'", "'\"'\"'") + "'"


# Correct password must be accepted by the *xrdp-sesman* PAM service —
# this is exactly what mstsc / FreeRDP hit after the TLS handshake.
rc, out = docker_exec(
    f"pamtester xrdp-sesman {sh_single(USER)} authenticate authtok={sh_single(PASSWORD)}",
    timeout=20,
)
check("pamtester xrdp-sesman accepts the real password", rc == 0, out)

# Wrong password must be rejected, otherwise we have an open door, not a login.
rc, out = docker_exec(
    f"pamtester xrdp-sesman {sh_single(USER)} authenticate authtok='definitely-not-the-password'",
    timeout=20,
)
check("pamtester xrdp-sesman rejects a wrong password", rc != 0, out)

# Session open is where pam_loginuid used to kill a valid login.
rc, out = docker_exec(
    f"pamtester xrdp-sesman {sh_single(USER)} authenticate acct_mgmt open_session close_session "
    f"authtok={sh_single(PASSWORD)}",
    timeout=20,
)
check("pamtester can open+close an xrdp-sesman session", rc == 0, out)

# --- HTTP surface -----------------------------------------------------------
status, creds = http_json("/api/creds")
check(
    "/api/creds returns the live username",
    status == 200 and creds.get("username") == USER,
    f"[{status}] {creds!r}"[:200],
)
check(
    "/api/creds returns a non-empty password",
    status == 200 and bool(creds.get("password")),
    f"[{status}]",
)

status, info = http_json("/api/login-status")
check(
    "/api/login-status reports ready",
    status == 200 and info.get("ready") is True,
    f"[{status}] {info!r}"[:300],
)
check(
    "/api/login-status pam_loginuid_required is false",
    status == 200 and info.get("pam_loginuid_required") is False,
    f"[{status}]",
)

if FAILURES:
    print(f"\n❌ {len(FAILURES)} login-path check(s) failed: {FAILURES}", flush=True)
    rc, logs = docker_exec(
        "echo '--- pam ---'; cat /etc/pam.d/xrdp-sesman; "
        "echo '--- xrdp.ini (head) ---'; grep -E '^(autorun|security_layer|certificate|key_file)=' /etc/xrdp/xrdp.ini; "
        "echo '--- login-status ---'; cat /opt/thadd/login-status.json; "
        "echo '--- shadow ---'; getent shadow " + USER + " | awk -F: '{print $1,$2}' | sed 's/\\$.*$/$HASH/'"
    )
    if logs:
        annotate("THADD-CI login diagnostics", logs)
    sys.exit(1)

print("\n✅ login-path checks passed — credentials will authenticate", flush=True)
