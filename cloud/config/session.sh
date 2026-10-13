#!/bin/sh
# =============================================================================
#  THADD OS — unified desktop session bootstrap (used by RDP and browser)
#  Applies the THADD look, runs the one-time welcome, starts XFCE.
# =============================================================================
export XDG_SESSION_TYPE=x11
export GDK_BACKEND=x11
export QT_QPA_PLATFORM=xcb
export GTK_THEME=Arc-Dark
export XCURSOR_THEME=breeze_cursors
export LANG=C.UTF-8
export LC_ALL=C.UTF-8

# per-user runtime dir (pulseaudio & friends)
XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/tmp/xdg-$(id -un)}"
mkdir -p "$XDG_RUNTIME_DIR"
chmod 700 "$XDG_RUNTIME_DIR"
export XDG_RUNTIME_DIR

# one-time welcome terminal (first boot of this home only)
/opt/thadd/welcome.sh &

exec startxfce4
