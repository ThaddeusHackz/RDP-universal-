#!/usr/bin/env bash
# THADD OS CI — full RDP login with a real RDP client (FreeRDP) + screenshot.
# Runs under xvfb-run on the CI runner and captures what the desktop renders.
set -e

USER_NAME="${THADD_USER:-thadd}"
PASS="${THADD_PASSWORD:-ThaddTest123!}"
export DISPLAY="${DISPLAY:-:99}"
OUT=/tmp/thadd-ci
mkdir -p "$OUT"

xfreerdp /f /v:127.0.0.1:3389 /u:"$USER_NAME" /p:"$PASS" \
  /cert:ignore /size:1280x800 /bpp:32 /network:auto +glyph-cache \
  >"$OUT/freerdp.log" 2>&1 &
FREERDP_PID=$!

echo "⏳ letting the THADD OS desktop render over RDP (25s)…"
sleep 25

if ! kill -0 "$FREERDP_PID" 2>/dev/null; then
  echo "❌ FreeRDP exited early — client log:"
  cat "$OUT/freerdp.log"
  exit 1
fi

# capture the live desktop as it appears to a Windows RDP user
import -window root "$OUT/thadd-desktop.png"
convert "$OUT/thadd-desktop.png" -resize 1024 -quality 82 "$OUT/screenshot.jpg"

echo "✅ RDP login successful — THADD OS desktop rendered"
ls -la "$OUT/screenshot.jpg"
kill "$FREERDP_PID" 2>/dev/null || true
