#!/bin/bash
# =============================================================================
#  THADD OS — healthcheck (Docker HEALTHCHECK + Railway /healthz)
#  Verifies: portal up, RDP listening, desktop renderer alive, xrdp running.
# =============================================================================
set +e

curl -fsS --max-time 5 "http://127.0.0.1:${PORT:-8080}/healthz" >/dev/null 2>&1 || exit 1
(exec 3<>/dev/tcp/127.0.0.1/3389) >/dev/null 2>&1 || exit 1
pgrep -x Xvnc  >/dev/null 2>&1 || exit 1
pgrep -x xrdp  >/dev/null 2>&1 || exit 1
exit 0
