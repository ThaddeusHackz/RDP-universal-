#!/bin/bash
# =============================================================================
#  THADD OS — RDP / PAM / login hardening (idempotent, runs every boot)
#  Makes "username + password" actually work against xrdp-sesman in a
#  Docker/Railway container. Safe to re-run.
# =============================================================================
set -u

THADD_USER="${THADD_USER:-thadd}"
THADD_PASSWORD="${THADD_PASSWORD:-thadd}"
HOME_DIR="${HOME_DIR:-$(getent passwd "$THADD_USER" 2>/dev/null | cut -d: -f6)}"
HOME_DIR="${HOME_DIR:-/home/$THADD_USER}"

log()  { printf '\033[1;36m[THADD]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[THADD]\033[0m %s\n' "$*"; }

json_escape() {
    # Escape a string so it is safe inside a JSON double-quoted value.
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

# ------------------------------------------------------------------ groups
# tsusers is what sesman.ini names as TerminalServerUsers. Create it even
# though AlwaysGroupCheck=false, so flipping that flag later cannot lock
# everyone out. Other groups are best-effort (package may not ship them).
groupadd -f tsusers 2>/dev/null || true
groupadd -f tsadmins 2>/dev/null || true
for g in sudo ssl-cert video audio tty xrdp tsusers; do
    getent group "$g" >/dev/null 2>&1 || continue
    usermod -aG "$g" "$THADD_USER" 2>/dev/null || true
done

# ---------------------------------------------------------- account unlock
# useradd without -p leaves '!' in shadow (locked). chpasswd sets a hash,
# but we also force-unlock and clear any expiry so a stale volume / prior
# lock cannot reject a correct password.
if command -v passwd >/dev/null 2>&1; then
    passwd -u "$THADD_USER" >/dev/null 2>&1 || true
fi
if command -v chage >/dev/null 2>&1; then
    chage -E -1 -m 0 -M 99999 "$THADD_USER" >/dev/null 2>&1 || true
fi
# Reject locked / empty shadow entries loudly — this is the #1 "I typed
# the password and it failed" cause after a partial boot.
shadow_hash="$(getent shadow "$THADD_USER" 2>/dev/null | cut -d: -f2 || true)"
case "$shadow_hash" in
    \$*) : ;;  # $6$ / $y$ / $5$ … a real hash
    *)   warn "user '$THADD_USER' has no usable password hash (shadow='$shadow_hash') — RDP login will fail" ;;
esac

# ----------------------------------------------------------- runtime dirs
install -d -o root -g root -m 755 /run/xrdp /var/run/xrdp /var/log
install -d -m 1777 /tmp/.X11-unix /tmp/.ICE-unix
rm -f /var/run/xrdp/xrdp.pid /var/run/xrdp/xrdp-sesman.pid \
      /run/xrdp/xrdp.pid /run/xrdp/xrdp-sesman.pid \
      /etc/nologin /var/run/nologin 2>/dev/null || true

# dbus machine-id is required by XFCE / at-spi; a missing one looks like
# a "logged in but black desktop" bug.
if [ ! -s /etc/machine-id ]; then
    if command -v dbus-uuidgen >/dev/null 2>&1; then
        dbus-uuidgen > /etc/machine-id
    else
        openssl rand -hex 16 > /etc/machine-id 2>/dev/null || true
    fi
fi
[ -s /var/lib/dbus/machine-id ] || ln -sfn /etc/machine-id /var/lib/dbus/machine-id 2>/dev/null || true

# -------------------------------------------------------- install configs
# Re-copy every boot so an apt-upgraded conffile or a bind-mount cannot
# silently restore Debian's broken-in-containers defaults.
if [ -f /opt/thadd/pam-xrdp-sesman ]; then
    install -m 644 /opt/thadd/pam-xrdp-sesman /etc/pam.d/xrdp-sesman
fi
if [ -f /opt/thadd/xrdp.ini ]; then
    install -m 644 /opt/thadd/xrdp.ini /etc/xrdp/xrdp.ini
fi
if [ -f /opt/thadd/sesman.ini ]; then
    install -m 644 /opt/thadd/sesman.ini /etc/xrdp/sesman.ini
fi
if [ -f /opt/thadd/startwm.sh ]; then
    install -m 755 /opt/thadd/startwm.sh /etc/xrdp/startwm.sh
fi

# Belt-and-braces: even if our PAM file was not installed, never leave
# pam_loginuid as required — that single word is enough to reject logins.
if [ -f /etc/pam.d/xrdp-sesman ]; then
    sed -i -E 's/^(session[[:space:]]+)required([[:space:]]+pam_loginuid\.so)/\1optional\2/' \
        /etc/pam.d/xrdp-sesman || true
fi

# Pin TLS material paths (entrypoint also generates the files).
if [ -s /etc/xrdp/cert.pem ] && [ -s /etc/xrdp/key.pem ]; then
    sed -i \
        -e 's|^certificate=.*|certificate=/etc/xrdp/cert.pem|' \
        -e 's|^key_file=.*|key_file=/etc/xrdp/key.pem|' \
        /etc/xrdp/xrdp.ini || true
fi

# ------------------------------------------------------ login-status.json
pam_ok=false
grep -q 'pam_unix' /etc/pam.d/xrdp-sesman 2>/dev/null && pam_ok=true
loginuid_required=false
grep -E '^[[:space:]]*session[[:space:]]+required[[:space:]]+pam_loginuid' \
    /etc/pam.d/xrdp-sesman >/dev/null 2>&1 && loginuid_required=true
autorun_xvnc=false
grep -E '^[[:space:]]*autorun=Xvnc' /etc/xrdp/xrdp.ini >/dev/null 2>&1 && autorun_xvnc=true
sec_tls=false
grep -E '^[[:space:]]*security_layer=tls' /etc/xrdp/xrdp.ini >/dev/null 2>&1 && sec_tls=true
vnc_passwd=false
[ -s "$HOME_DIR/.vnc/passwd" ] && vnc_passwd=true
password_set=false
case "$shadow_hash" in \$*) password_set=true ;; esac

pamtester_auth="skipped"
if command -v pamtester >/dev/null 2>&1 && [ -n "$THADD_PASSWORD" ]; then
    if pamtester xrdp-sesman "$THADD_USER" authenticate \
            "authtok=${THADD_PASSWORD}" >/dev/null 2>&1; then
        pamtester_auth="ok"
        log "PAM xrdp-sesman accepts '${THADD_USER}' — RDP login is live"
    else
        pamtester_auth="FAIL"
        warn "PAM xrdp-sesman rejected '${THADD_USER}' — RDP clients will see 'login failed for display 0'"
    fi
fi

mkdir -p /opt/thadd
cat > /opt/thadd/login-status.json <<EOF
{
  "user": "$(json_escape "$THADD_USER")",
  "build": "$(json_escape "$(cat /etc/thadd-build 2>/dev/null || echo unknown)")",
  "password_set": ${password_set},
  "vnc_passwd": ${vnc_passwd},
  "pam_hardened": ${pam_ok},
  "pam_loginuid_required": ${loginuid_required},
  "xrdp_autorun_xvnc": ${autorun_xvnc},
  "xrdp_security_layer_tls": ${sec_tls},
  "pamtester": "$(json_escape "$pamtester_auth")",
  "ready": $([ "$password_set" = true ] && [ "$pam_ok" = true ] && [ "$loginuid_required" = false ] && [ "$autorun_xvnc" = true ] && echo true || echo false)
}
EOF
chmod 644 /opt/thadd/login-status.json
