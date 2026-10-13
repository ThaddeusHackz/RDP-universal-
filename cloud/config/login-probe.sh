#!/bin/bash
# =============================================================================
#  THADD OS — continuous login-path probe
#  CI proves the image can log in; this proves the *deployed instance* can,
#  right now, and — if it cannot — records the exact reason so the portal,
#  `thadd doctor` and the logs can say WHY instead of silently rejecting the
#  correct credentials. Runs every minute forever under supervisord.
# =============================================================================
set -u

USER_NAME="${THADD_USER:-thadd}"
PASS="${THADD_PASSWORD:-thadd}"
OUT=/opt/thadd/login-probe.json

log()  { printf '\033[1;36m[THADD]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[THADD]\033[0m %s\n' "$*"; }

json_escape() {
    local s=$1 out="" c
    local -i i n=${#s}
    for ((i = 0; i < n; i++)); do
        c=${s:i:1}
        case $c in
            '"')  out+='\"' ;;
            '\\') out+='\\' ;;
            $'\n') out+='\n' ;;
            $'\r') out+='\r' ;;
            $'\t') out+='\t' ;;
            *)    out+=$c ;;
        esac
    done
    printf '%s' "$out"
}

probe_once() {
    local reasons="" ready=true

    # 1 — the account must hold a real crypt hash (locked '!' rejects all)
    local hash
    hash="$(getent shadow "$USER_NAME" 2>/dev/null | cut -d: -f2)"
    case "$hash" in
        \$*) ;;
        *) ready=false; reasons+="account '$USER_NAME' has no usable password hash (shadow locked or empty); " ;;
    esac

    # 2 — RDP front door must be listening
    if ! (exec 3<>/dev/tcp/127.0.0.1/3389) 2>/dev/null; then
        ready=false; reasons+="xrdp is not listening on 3389; "
    fi

    # 3 — sesman must be alive (it performs the PAM authentication)
    if ! pgrep -x xrdp-sesman >/dev/null 2>&1; then
        ready=false; reasons+="xrdp-sesman is not running; "
    fi

    # 4 — PAM must accept the REAL password and reject a wrong one.
    #    This is exactly the check a credential takes inside sesman.
    if command -v pamtester >/dev/null 2>&1 && [ -n "$PASS" ]; then
        if pamtester xrdp-sesman "$USER_NAME" authenticate \
                "authtok=$PASS" >/dev/null 2>&1; then
            :
        else
            ready=false; reasons+="PAM xrdp-sesman rejects the correct password (check /etc/pam.d/xrdp-sesman, account lock, expiry); "
        fi
        if pamtester xrdp-sesman "$USER_NAME" authenticate \
                "authtok=definitely-wrong-probe" >/dev/null 2>&1; then
            ready=false; reasons+="PAM xrdp-sesman accepts ANY password — open door, not a login; "
        fi
    fi

    # 5 — the container-killer: pam_loginuid must not be 'required'
    if grep -qE '^[[:space:]]*session[[:space:]]+required[[:space:]]+pam_loginuid' \
         /etc/pam.d/xrdp-sesman 2>/dev/null; then
        ready=false; reasons+="PAM requires pam_loginuid (always fails inside containers — 'login failed for display 0'); "
    fi

    # 6 — xrdp must not offer the broken Xorg path or NLA it cannot finish
    if ! grep -qE '^[[:space:]]*autorun=Xvnc' /etc/xrdp/xrdp.ini 2>/dev/null; then
        ready=false; reasons+="xrdp.ini lacks autorun=Xvnc (Xorg/xorgxrdp is not installed); "
    fi
    if ! grep -qE '^[[:space:]]*security_layer=tls' /etc/xrdp/xrdp.ini 2>/dev/null; then
        ready=false; reasons+="xrdp.ini security_layer is not tls (NLA/HYBRID cannot complete on Debian xrdp); "
    fi

    # 7 — TLS material must exist and be pinned
    if [ ! -s /etc/xrdp/cert.pem ] || [ ! -s /etc/xrdp/key.pem ]; then
        ready=false; reasons+="xrdp TLS certificate/key missing; "
    fi

    # 8 — browser desktop credential file (noVNC path)
    local home
    home="$(getent passwd "$USER_NAME" 2>/dev/null | cut -d: -f6)"
    home="${home:-/home/$USER_NAME}"
    if [ ! -s "$home/.vnc/passwd" ]; then
        ready=false; reasons+="browser-desktop VNC password file missing at $home/.vnc/passwd; "
    fi

    PROBE_READY=$ready
    PROBE_REASONS=$reasons
}

# first run waits for boot to settle (supervisord brings services up in
# priority order; sesman lands ~seconds after this program starts)
sleep 15

while true; do
    probe_once
    if [ "$PROBE_READY" = true ]; then
        log "login probe: READY — '$USER_NAME' authenticates on this instance"
        reasons_json="[]"
    else
        warn "login probe: NOT READY — $PROBE_REASONS"
        reasons_json="[\"$(json_escape "${PROBE_REASONS%; }")\"]"
    fi
    cat > "$OUT" <<EOF
{
  "ready": ${PROBE_READY},
  "user": "$(json_escape "$USER_NAME")",
  "build": "$(json_escape "$(cat /etc/thadd-build 2>/dev/null || echo unknown)")",
  "checked_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "reasons": ${reasons_json}
}
EOF
    chmod 644 "$OUT"
    sleep 60
done
