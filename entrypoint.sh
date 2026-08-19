#!/bin/bash
# =============================================================================
#  THADD OS — entrypoint
#  Idempotent, self-healing, Railway-ready.
#  Handles users, credentials, volume seeding, keys, config rendering and
#  optional swap, then hands control to supervisord.
# =============================================================================
set -euo pipefail

export THADD_USER="${THADD_USER:-thadd}"
export THADD_PASSWORD="${THADD_PASSWORD:-thadd}"
export THADD_ROOT_PASSWORD="${THADD_ROOT_PASSWORD:-}"
export RESOLUTION="${RESOLUTION:-1600x900}"
export PORT="${PORT:-8080}"
export SWAP_MB="${SWAP_MB:-512}"

log() { printf '\033[1;36m[THADD]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[THADD]\033[0m %s\n' "$*"; }

# ------------------------------------------------------------------ timezone
if [ -n "${TZ:-}" ] && [ -f "/usr/share/zoneinfo/${TZ}" ]; then
  ln -sf "/usr/share/zoneinfo/${TZ}" /etc/localtime
fi

# ------------------------------------------------------- user & credentials
if ! id -u "$THADD_USER" >/dev/null 2>&1; then
  log "Creating user '$THADD_USER'"
  useradd -m -s /bin/bash -G sudo "$THADD_USER"
fi
echo "$THADD_USER:$THADD_PASSWORD" | chpasswd
if [ -n "$THADD_ROOT_PASSWORD" ]; then
  echo "root:$THADD_ROOT_PASSWORD" | chpasswd
fi
echo "$THADD_USER ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/zz-thadd
chmod 440 /etc/sudoers.d/zz-thadd

# ----------------------------------------- persistent home (Railway volume)
HOME_DIR="$(getent passwd "$THADD_USER" | cut -d: -f6)"
if [ ! -f "$HOME_DIR/.thadd-seeded" ]; then
  log "Seeding THADD OS desktop profile into ${HOME_DIR} (fresh volume)"
  mkdir -p "$HOME_DIR"
  cp -a /etc/skel/. "$HOME_DIR/"
  chown -R "$THADD_USER":"$(id -gn "$THADD_USER" 2>/dev/null || echo "$THADD_USER")" "$HOME_DIR"
  touch "$HOME_DIR/.thadd-seeded"
fi

# -------------------------------------------------------- profile safeguards
# Runs on EVERY boot (not only fresh seeds) so a stale or hand-populated
# volume can't break the persistent browser desktop.
[ -f "$HOME_DIR/.vnc/xstartup" ] && chmod +x "$HOME_DIR/.vnc/xstartup" || true

# -------------------- VNC password (browser desktop) syncs with THADD_PASSWORD
# `vncpasswd` lives in the tigervnc-tools package on Debian 12 (a mere
# Recommends of tigervnc-standalone-server). A missing binary must NEVER kill
# the boot again: try both tool names, warn loudly on failure, keep going —
# supervisord + nginx must always come up so the portal and healthchecks work.
write_vnc_passwd() {
  local tool=""
  if command -v vncpasswd >/dev/null 2>&1; then
    tool="vncpasswd"
  elif command -v tigervncpasswd >/dev/null 2>&1; then
    tool="tigervncpasswd"
  else
    warn "no VNC password tool found (install tigervnc-tools) — VNC credential sync skipped"
    return 0
  fi
  su -s /bin/bash "$THADD_USER" -c 'mkdir -p "$HOME/.vnc"' || return 1
  # single input line: a second line would be stored as a duplicate
  # *view-only* password in the obfuscated passwd file.
  printf '%s\n' "$THADD_PASSWORD" | \
    su -s /bin/bash "$THADD_USER" -c "$tool -f > \"\$HOME/.vnc/passwd\"" || return 1
  su -s /bin/bash "$THADD_USER" -c 'chmod 600 "$HOME/.vnc/passwd"' || return 1
  log "VNC credential synced (${tool}) — browser desktop login ready"
}
write_vnc_passwd || \
  warn "VNC password provisioning failed — the browser desktop may reject logins until fixed"

# -------------------------------------------------------- runtime plumbing
install -d -o root -g root -m 755 /run/dbus /run/xrdp
ln -sfn /run/dbus /var/run/dbus 2>/dev/null || true

[ -f /etc/xrdp/rsakeys.ini ] || xrdp-keygen xrdp /etc/xrdp/rsakeys.ini >/dev/null 2>&1 || true

# Deterministic TLS for xrdp (security_layer=negotiate): regenerate the pair
# if EITHER half is missing (never a mismatched cert/key), then pin xrdp.ini
# to these exact paths instead of relying on distro defaults, and let the
# `xrdp` group read the private key.
if [ ! -s /etc/xrdp/cert.pem ] || [ ! -s /etc/xrdp/key.pem ]; then
  openssl req -x509 -newkey rsa:2048 -nodes -keyout /etc/xrdp/key.pem \
    -out /etc/xrdp/cert.pem -days 3650 -subj "/CN=THADD-OS" >/dev/null 2>&1 || true
fi
if [ -s /etc/xrdp/cert.pem ] && [ -s /etc/xrdp/key.pem ]; then
  sed -i \
    -e 's|^certificate=.*|certificate=/etc/xrdp/cert.pem|' \
    -e 's|^key_file=.*|key_file=/etc/xrdp/key.pem|' \
    /etc/xrdp/xrdp.ini || true
  ( chgrp xrdp /etc/xrdp/key.pem 2>/dev/null \
    || chgrp ssl-cert /etc/xrdp/key.pem 2>/dev/null \
    || true ) && chmod 640 /etc/xrdp/key.pem || true
fi

envsubst '${PORT}' \
  < /etc/nginx/sites-available/thadd.conf.template \
  > /etc/nginx/sites-enabled/thadd.conf

# Portal credentials endpoint (regenerated at every boot)
mkdir -p /opt/thadd
cat > /opt/thadd/credentials.json <<EOF
{
  "os": "THADD OS",
  "version": "1.0.0 (Nebula)",
  "username": "$THADD_USER",
  "password": "$THADD_PASSWORD",
  "rdp_port": 3389,
  "resolution": "$RESOLUTION",
  "hint": "Use these credentials in the browser desktop (noVNC) and in any RDP client: Microsoft Remote Desktop, Remmina, FreeRDP, Jump Desktop..."
}
EOF
chmod 644 /opt/thadd/credentials.json

# --------------------------------------------------- performance: swap/zram
if [ "${SWAP_MB:-0}" -gt 0 ] && ! swapon --show 2>/dev/null | grep -q .; then
  ( fallocate -l "${SWAP_MB}M" /swapfile \
      && chmod 600 /swapfile \
      && mkswap /swapfile >/dev/null \
      && swapon /swapfile ) >/dev/null 2>&1 \
    || warn "swap unavailable in this environment (container runs fine without it)"
fi

# --------------------------------------------------------------- showtime
log "THADD OS 1.0 (Nebula) is booting"
log "  Web desktop : 0.0.0.0:${PORT}   (noVNC — open in any browser)"
log "  RDP         : 0.0.0.0:3389     (Microsoft Remote Desktop compatible)"
log "  Login       : ${THADD_USER} / ${THADD_PASSWORD}"
if [ -n "${RAILWAY_TCP_PROXY_DOMAIN:-}" ]; then
  log "  Railway TCP : ${RAILWAY_TCP_PROXY_DOMAIN}:${RAILWAY_TCP_PROXY_PORT:-?}  → 3389"
fi
if [ -n "${RAILWAY_PUBLIC_DOMAIN:-}" ]; then
  log "  Railway web : https://${RAILWAY_PUBLIC_DOMAIN}"
fi

exec /usr/bin/supervisord -n -c /etc/supervisor/supervisord.conf
