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

Xvnc :1 \
    -geometry "${RESOLUTION:-1600x900}" \
    -depth 24 \
    -rfbauth "$HOME/.vnc/passwd" \
    -SecurityTypes VncAuth \
    -localhost \
    -AlwaysShared \
    -desktop "THADD OS" \
    -rfbwait 30000 \
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
