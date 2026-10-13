#!/bin/bash
# =============================================================================
#  THADD OS — healthcheck (Docker HEALTHCHECK + Railway /healthz)
#  Verifies: portal up, RDP listening, desktop renderer alive, xrdp running,
#  and that a login is actually possible (password hash + VNC passwd present).
# =============================================================================
set +e

USER_NAME="${THADD_USER:-thadd}"
HOME_DIR="$(getent passwd "$USER_NAME" 2>/dev/null | cut -d: -f6)"
HOME_DIR="${HOME_DIR:-/home/$USER_NAME}"

curl -fsS --max-time 5 "http://127.0.0.1:${PORT:-8080}/healthz" >/dev/null 2>&1 || exit 1
(exec 3<>/dev/tcp/127.0.0.1/3389) >/dev/null 2>&1 || exit 1
# desktop renderer: Xvnc via update-alternatives, or Xtigervnc directly
{ pgrep -x Xvnc || pgrep -x Xtigervnc; } >/dev/null 2>&1 || exit 1
pgrep -x xrdp  >/dev/null 2>&1 || exit 1
pgrep -x xrdp-sesman >/dev/null 2>&1 || exit 1

# A listening RDP port is useless if the account is locked or the VNC
# password file was never written — those are the two ways "I typed the
# credentials and nothing happened" actually happens.
hash="$(getent shadow "$USER_NAME" 2>/dev/null | cut -d: -f2)"
case "$hash" in \$*) ;; *) exit 1 ;; esac
[ -s "$HOME_DIR/.vnc/passwd" ] || exit 1

exit 0
