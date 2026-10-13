#!/usr/bin/env bash
# THADD OS CI — wait until the container is actually ready to log in.
# nginx /healthz is a static 200 the instant nginx binds — that is NOT
# "the OS can accept RDP credentials". We also require port 3389, Xvnc,
# a real shadow hash and the VNC password file.
set -e
PORT="${PORT:-8080}"
USER_NAME="${THADD_USER:-thadd}"

for i in $(seq 1 120); do
  ok=1
  curl -fsS --max-time 3 "http://127.0.0.1:${PORT}/healthz" >/dev/null 2>&1 || ok=0
  if [ "$ok" -eq 1 ]; then
    docker exec thadd bash -lc "
      set -e
      (exec 3<>/dev/tcp/127.0.0.1/3389)
      pgrep -x xrdp >/dev/null
      pgrep -x xrdp-sesman >/dev/null
      pgrep -x Xvnc >/dev/null || pgrep -x Xtigervnc >/dev/null
      getent shadow ${USER_NAME} | awk -F: '{exit (\$2 ~ /^\\\$/ ? 0 : 1)}'
      test -s /home/${USER_NAME}/.vnc/passwd
    " >/dev/null 2>&1 || ok=0
  fi
  if [ "$ok" -eq 1 ]; then
    echo "✅ healthy (portal + RDP + Xvnc + credentials) after $((i * 2))s"
    exit 0
  fi
  sleep 2
done
echo "❌ container never became login-ready — last logs:"
docker logs thadd 2>&1 | tail -n 80 || true
echo "--- supervisor ---"
docker exec thadd supervisorctl status 2>&1 || true
echo "--- login-status ---"
docker exec thadd cat /opt/thadd/login-status.json 2>&1 || true
exit 1
