#!/bin/bash
# =============================================================================
#  THADD OS — persistent desktop engine
#  Starts TigerVNC (Xvnc) on :1 with the THADD user's XFCE desktop and keeps
#  it alive forever. websockify bridges :1 to browsers; supervisord restarts
#  this process the instant anything stops it.
# =============================================================================
set -u

export HOME="${HOME:-/home/thadd}"
export USER="${USER:-thadd}"
export DISPLAY=:1
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/tmp/xdg-$USER}"

mkdir -p "$XDG_RUNTIME_DIR" "$HOME/.vnc"
chmod 700 "$XDG_RUNTIME_DIR" 2>/dev/null || true

cleanup() {
    [ -n "${XVNC_PID:-}" ] && kill "$XVNC_PID" 2>/dev/null
}
trap cleanup EXIT TERM INT

# Locate the server binary: Debian exposes Xvnc via update-alternatives, but
# fail over to Xtigervnc so a missing alternative can never kill the desktop.
VNCBIN="$(command -v Xvnc || command -v Xtigervnc || true)"
if [ -z "$VNCBIN" ]; then
    echo "[thadd-desktop] FATAL: no VNC server binary found (Xvnc / Xtigervnc)."
    echo "[thadd-desktop]        install tigervnc-standalone-server."
    exit 1
fi

# Never start without a password file: Xvnc -rfbauth with a missing file exits
# instantly and supervisord would hot-loop the desktop forever. Wait politely
# for the entrypoint/provisioning, then fail loudly (supervisord retries).
PASSWD_FILE="$HOME/.vnc/passwd"
for i in $(seq 1 60); do
    [ -s "$PASSWD_FILE" ] && break
    [ "$i" -eq 1 ] && echo "[thadd-desktop] waiting for $PASSWD_FILE to be provisioned…"
    sleep 1
done
if [ ! -s "$PASSWD_FILE" ]; then
    echo "[thadd-desktop] FATAL: $PASSWD_FILE missing after 60s — refusing to start"
    echo "[thadd-desktop]        an unauthenticated desktop. Entrypoint must run"
    echo "[thadd-desktop]        vncpasswd/tigervncpasswd for user $USER."
    exit 1
fi

echo "[thadd-desktop] starting $VNCBIN on :1 (${RESOLUTION:-1600x900})"
# NOTE: -rfbwait was removed in TigerVNC 1.12 (Debian 12) — passing it makes
# Xvnc abort with "Unrecognized option". Do not re-add it.
"$VNCBIN" :1 \
    -geometry "${RESOLUTION:-1600x900}" \
    -depth 24 \
    -rfbauth "$HOME/.vnc/passwd" \
    -SecurityTypes VncAuth \
    -localhost \
    -AlwaysShared \
    -desktop "THADD OS" \
    >/tmp/xvnc.log 2>&1 &
XVNC_PID=$!

sleep 2
if ! kill -0 "$XVNC_PID" 2>/dev/null; then
    echo "[thadd-desktop] Xvnc failed to start:"
    cat /tmp/xvnc.log 2>/dev/null
    exit 1
fi

# launch the desktop session
"$HOME/.vnc/xstartup" >>/tmp/xstartup.log 2>&1 &
XS_PID=$!

wait "$XVNC_PID"
