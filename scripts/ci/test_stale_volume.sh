#!/usr/bin/env bash
# THADD OS CI — stale persistent-volume self-heal test.
#
# Real deployments mount a Railway volume at /home/thadd that may have been
# seeded by an OLDER, broken image (this repo's history shipped crash-loops
# and dead session files). A stale ~/.vnc/xstartup kills the desktop right
# after a correct authentication — "my password is right but I can't log in".
#
# This test plants exactly that: a volume that claims to be seeded
# (.thadd-seeded) but contains a broken, non-executable xstartup. The
# entrypoint must heal it at boot; the instance must then accept logins
# (login-probe ready).
set -euo pipefail

STALE=/tmp/thadd-stale-home
rm -rf "$STALE"
mkdir -p "$STALE/.vnc"

# the broken era: dead session bootstrap, wrong perms, "already seeded"
printf '#!/bin/sh\n# stale artifact from an older broken image\nexit 1\n' \
    > "$STALE/.vnc/xstartup"
chmod 644 "$STALE/.vnc/xstartup"
touch "$STALE/.thadd-seeded"

echo "⏳ booting THADD OS over a stale volume…"
docker run -d --name thadd2 \
    -p 8081:8080 -p 3390:3389 \
    -v "$STALE":/home/thadd \
    -e PORT=8080 \
    -e THADD_USER=thadd \
    -e THADD_PASSWORD='ThaddTest123!' \
    -e SWAP_MB=0 \
    thadd-os

cleanup() { docker rm -f thadd2 >/dev/null 2>&1 || true; }
trap cleanup EXIT

for i in $(seq 1 90); do
    curl -fsS --max-time 3 http://127.0.0.1:8081/healthz >/dev/null 2>&1 && break
    sleep 2
    if [ "$i" -eq 90 ]; then
        echo "❌ stale-volume instance never became healthy"
        docker logs thadd2 2>&1 | tail -n 60 || true
        exit 1
    fi
done
echo "✅ portal up on stale-volume instance (entrypoint ran — heal window over)"

docker exec thadd2 bash -lc '
    set -e
    test -x /home/thadd/.vnc/xstartup
    grep -q "startxfce4\|session.sh" /home/thadd/.vnc/xstartup
    ! grep -q "stale artifact" /home/thadd/.vnc/xstartup
    getent shadow thadd | awk -F: "{exit (\$2 ~ /^\\\\\$/ ? 0 : 1)}"
'
echo "✅ stale xstartup re-installed from image (executable, live session bootstrap)"

# the strongest end-to-end signal: the instance's own login probe must flip
# to ready (pamtester accept/reject + listeners) within 3 minutes.
for i in $(seq 1 90); do
    READY="$(docker exec thadd2 cat /opt/thadd/login-probe.json 2>/dev/null \
        | python3 -c 'import json,sys; print(json.load(sys.stdin).get("ready", False))' 2>/dev/null || echo False)"
    [ "$READY" = "True" ] && break
    sleep 2
done
if [ "$READY" != "True" ]; then
    echo "❌ login-probe never reported ready on the stale-volume instance"
    docker exec thadd2 cat /opt/thadd/login-probe.json 2>/dev/null || true
    docker logs thadd2 2>&1 | tail -n 60 || true
    exit 1
fi
echo "✅ stale-volume instance accepts the credentials (login-probe ready)"
echo "✅ stale-volume self-heal test passed"
