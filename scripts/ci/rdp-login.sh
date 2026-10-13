#!/usr/bin/env bash
# THADD OS CI — full RDP login with a real RDP client (FreeRDP) + screenshot.
# Runs under xvfb-run on the CI runner and captures what the desktop renders.
#
# This script *fails* unless xrdp-sesman records a successful login. A
# FreeRDP process that is merely still alive (stuck on a login dialog or
# a black window) is NOT success — that was the previous false green.
set -euo pipefail

USER_NAME="${THADD_USER:-thadd}"
PASS="${THADD_PASSWORD:-ThaddTest123!}"
export DISPLAY="${DISPLAY:-:99}"
OUT=/tmp/thadd-ci
mkdir -p "$OUT"

# Force TLS to match xrdp.ini security_layer=tls. /cert:ignore accepts the
# self-signed boot-time certificate. Without /sec:tls FreeRDP may try NLA
# first and confuse the failure mode.
xfreerdp /v:127.0.0.1:3389 /u:"$USER_NAME" /p:"$PASS" \
  /cert:ignore /sec:tls /size:1280x800 /bpp:32 /network:auto +glyph-cache \
  >"$OUT/freerdp.log" 2>&1 &
FREERDP_PID=$!

echo "⏳ letting the THADD OS desktop render over RDP (28s)…"
sleep 28

if ! kill -0 "$FREERDP_PID" 2>/dev/null; then
  echo "❌ FreeRDP exited early — client log:"
  cat "$OUT/freerdp.log"
  exit 1
fi

if grep -qiE 'authentication failure|ERRCONNECT|ERRINFO_LOGOFF_BY_USER|login failed' \
      "$OUT/freerdp.log"; then
  echo "❌ FreeRDP reported a login/auth error:"
  cat "$OUT/freerdp.log"
  kill "$FREERDP_PID" 2>/dev/null || true
  exit 1
fi

# The smoking-gun check: sesman must have accepted the password and created
# a session. Anything else is a black screen wearing a green badge.
SESMAN_HIT="$(docker exec thadd sh -c \
  'grep -Ei "login successful|created session" /var/log/xrdp-sesman.log 2>/dev/null | tail -n 5' \
  || true)"
if [ -z "$SESMAN_HIT" ]; then
  echo "❌ xrdp-sesman never recorded a successful login for ${USER_NAME}"
  echo "--- freerdp.log ---"
  cat "$OUT/freerdp.log"
  echo "--- xrdp-sesman.log ---"
  docker exec thadd sh -c 'tail -n 80 /var/log/xrdp-sesman.log 2>/dev/null' || true
  echo "--- xrdp.log ---"
  docker exec thadd sh -c 'tail -n 80 /var/log/xrdp.log 2>/dev/null' || true
  kill "$FREERDP_PID" 2>/dev/null || true
  exit 1
fi
echo "✅ sesman accepted the credentials:"
printf '%s\n' "$SESMAN_HIT"

# An RDP session starts at display :10+ (X11DisplayOffset=10). The browser
# desktop lives on :1 — we require the *RDP* display, not the browser one.
RDP_DISPLAY="$(docker exec thadd sh -c \
  'ls /tmp/.X11-unix 2>/dev/null | tr " " "\n" | grep -E "^X(1[0-9]|[2-9][0-9])$" | head -n 1' \
  || true)"
if [ -z "$RDP_DISPLAY" ]; then
  echo "⚠️  no :10+ X socket yet — sesman logged success, display may still be coming up"
else
  echo "✅ RDP X socket present: $RDP_DISPLAY"
fi

# capture the live desktop as it appears to a Windows RDP user
import -window root "$OUT/thadd-desktop.png"
convert "$OUT/thadd-desktop.png" -resize 1024 -quality 82 "$OUT/screenshot.jpg"

# A 2 KB black JPEG is not proof. Reject near-empty captures.
BYTES="$(wc -c < "$OUT/screenshot.jpg" | tr -d ' ')"
if [ "${BYTES:-0}" -lt 8000 ]; then
  echo "❌ screenshot is only ${BYTES} bytes — almost certainly a black frame, not a desktop"
  ls -la "$OUT"
  kill "$FREERDP_PID" 2>/dev/null || true
  exit 1
fi

echo "✅ RDP login successful — THADD OS desktop rendered (${BYTES} bytes)"
ls -la "$OUT/screenshot.jpg"
kill "$FREERDP_PID" 2>/dev/null || true
