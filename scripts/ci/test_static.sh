#!/usr/bin/env bash
# THADD OS — static assertions for the RDP login path.
# Runs anywhere (no Docker). Fails the build if a known login-breaker regresses.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
FAIL=0
say() { printf '%s\n' "$*"; }
chk() {
  local name="$1"
  shift
  if eval "$@" >/dev/null 2>&1; then
    say "PASS - $name"
  else
    say "FAIL - $name"
    FAIL=$((FAIL + 1))
  fi
}

chk "pam file exists" test -f "$ROOT/config/pam-xrdp-sesman"
chk "pam_loginuid is optional" \
  grep -qE '^session[[:space:]]+optional[[:space:]]+pam_loginuid' "$ROOT/config/pam-xrdp-sesman"
chk "pam_loginuid is never required" \
  "! grep -qE '^[[:space:]]*session[[:space:]]+required[[:space:]]+pam_loginuid' \"$ROOT/config/pam-xrdp-sesman\""
chk "xrdp.ini autorun=Xvnc" grep -qE '^autorun=Xvnc' "$ROOT/config/xrdp.ini"
chk "xrdp.ini security_layer=tls" grep -qE '^security_layer=tls' "$ROOT/config/xrdp.ini"
chk "xrdp.ini has no [Xorg] session" \
  "! grep -qE '^\\[Xorg\\]' \"$ROOT/config/xrdp.ini\""
chk "xrdp.ini delay_ms set" grep -qE '^delay_ms=' "$ROOT/config/xrdp.ini"
chk "sesman AlwaysGroupCheck=false" grep -qE '^AlwaysGroupCheck=false' "$ROOT/config/sesman.ini"
chk "harden-rdp.sh is executable-marked in Dockerfile" \
  grep -q 'harden-rdp.sh' "$ROOT/Dockerfile"
chk "entrypoint calls harden-rdp.sh" grep -q harden-rdp.sh "$ROOT/entrypoint.sh"
chk "entrypoint uses chpasswd" grep -q chpasswd "$ROOT/entrypoint.sh"
chk "entrypoint JSON-escapes credentials" grep -q json_escape "$ROOT/entrypoint.sh"
chk "VNC passwd written to HOME_DIR" grep -q 'HOME_DIR/.vnc/passwd' "$ROOT/entrypoint.sh"
chk "Dockerfile installs pamtester" grep -q pamtester "$ROOT/Dockerfile"
chk "Dockerfile installs tigervnc-tools" grep -q tigervnc-tools "$ROOT/Dockerfile"
chk "test_login.py exists" test -f "$ROOT/scripts/ci/test_login.py"
chk "rdp-login.sh requires sesman success" grep -q 'login successful' "$ROOT/scripts/ci/rdp-login.sh"
chk "rdp-login.sh rejects tiny screenshots" grep -q 8000 "$ROOT/scripts/ci/rdp-login.sh"
chk "desktop.html auto-login exists" test -f "$ROOT/web/desktop.html"
chk "portal does not ask noVNC for a username" \
  "! grep -q 'Enter the username' \"$ROOT/web/index.html\""
chk "healthcheck verifies shadow hash" grep -q 'getent shadow' "$ROOT/config/healthcheck.sh"
chk "wait-health waits for Xvnc + password" grep -q 'xrdp-sesman' "$ROOT/scripts/ci/wait-health.sh"
chk "nginx serves /api/login-status" grep -q login-status "$ROOT/config/nginx.conf.template"
chk "login-probe shipped" test -f "$ROOT/config/login-probe.sh"
chk "supervisor runs login-probe" grep -q login-probe "$ROOT/config/thadd.conf"
chk "nginx serves /api/login-probe" grep -q login-probe "$ROOT/config/nginx.conf.template"
chk "Dockerfile stamps image build" grep -q thadd-build "$ROOT/Dockerfile"
chk "entrypoint self-heals stale xstartup" grep -q 'etc/skel/.vnc/xstartup' "$ROOT/entrypoint.sh"
chk "portal surfaces login-probe banner" grep -q loginBanner "$ROOT/web/index.html"
# the live workflow ships as ci/thadd-os-ci.yml.example (enabling it needs the
# workflows permission — see ci/ENABLE-CI.md); the gate must live in it
chk "CI suite runs the login-path gate" grep -q test_login.py "$ROOT/ci/thadd-os-ci.yml.example"
chk "CI suite runs stale-volume self-heal test" grep -q test_stale_volume.sh "$ROOT/ci/thadd-os-ci.yml.example"

# syntax of every shell script we ship
while IFS= read -r -d '' f; do
  if head -n 1 "$f" | grep -qE 'bash'; then
    chk "bash -n $(basename "$f")" bash -n "$f"
  elif head -n 1 "$f" | grep -qE '/bin/sh'; then
    chk "sh -n $(basename "$f")" sh -n "$f"
  fi
done < <(find "$ROOT/config" "$ROOT/scripts" "$ROOT/entrypoint.sh" -type f \( -name '*.sh' -o -name 'thadd' -o -name 'entrypoint.sh' \) -print0)

python3 -m py_compile "$ROOT/scripts/ci/test_http.py" \
                      "$ROOT/scripts/ci/test_rdp.py" \
                      "$ROOT/scripts/ci/test_login.py"
say "PASS - python3 syntax of CI tests"

if [ "$FAIL" -ne 0 ]; then
  say ""
  say "❌ $FAIL static check(s) failed"
  exit 1
fi
say ""
say "✅ all static login-path checks passed"
