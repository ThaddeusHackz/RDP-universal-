#!/bin/sh
# =============================================================================
#  THADD OS — first-boot welcome (runs once per home directory)
# =============================================================================
MARK="$HOME/.config/thadd/welcomed-v1"
[ -f "$MARK" ] && exit 0
mkdir -p "$HOME/.config/thadd"

sleep 8
if command -v xfce4-terminal >/dev/null 2>&1; then
    xfce4-terminal --hide-menubar --hide-toolbar \
        --title="Welcome to THADD OS" \
        --command="/usr/local/bin/thadd welcome" &
fi
touch "$MARK"
exit 0
