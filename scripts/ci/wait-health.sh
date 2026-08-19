#!/usr/bin/env bash
# THADD OS CI — wait until the container reports healthy
set -e
PORT="${PORT:-8080}"
for i in $(seq 1 120); do
  if curl -fsS --max-time 3 "http://127.0.0.1:${PORT}/healthz" >/dev/null 2>&1; then
    echo "✅ healthy after $((i * 2))s"
    exit 0
  fi
  sleep 2
done
echo "❌ container never became healthy — last logs:"
docker logs thadd 2>&1 | tail -n 80 || true
exit 1
