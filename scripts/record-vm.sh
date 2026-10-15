#!/usr/bin/env bash
# Record an ACTUAL VM display region on an X11 host. Never renders a mock OS.
set -Eeuo pipefail
if [[ $# -ne 5 ]]; then
  echo "Usage: $0 ISO SOURCE_COMMIT VM_DESCRIPTION FIRMWARE OUTPUT_DIR" >&2
  echo 'Example: DISPLAY=:0 CAPTURE_INPUT=:0.0+0,0 bash scripts/record-vm.sh /data/desktop.iso UNKNOWN "VirtualBox 7.x; 2 CPU; 8192 MB; VMSVGA; 40 GB VDI; NAT" EFI dist/vm-test' >&2
  exit 2
fi
iso=$(realpath "$1"); commit=$2; vm=$3; firmware=$4; out=$5
[[ -f "$iso" && "$iso" == *.iso ]] || { echo 'Need a reconstructed ISO, not a part' >&2; exit 1; }
for cmd in ffmpeg ffprobe sha256sum; do command -v "$cmd" >/dev/null; done
: "${DISPLAY:?An X11 display with the real VM window is required}"
[[ ! -e "$out" ]] || { echo 'Use a new output directory to avoid overwriting evidence' >&2; exit 1; }
mkdir -p "$out"
{
  printf 'Recorded UTC: '; date -u +%FT%TZ
  printf 'ISO: %s\n' "$iso"
  sha256sum "$iso"
  printf 'Source commit: %s\nVM: %s\nFirmware: %s\n' "$commit" "$vm" "$firmware"
  printf 'Capture input: %s; size: %s; target duration: 300s\n' "${CAPTURE_INPUT:-$DISPLAY}" "${CAPTURE_SIZE:-1280x720}"
  ffmpeg -version | sed -n '1p'
} > "$out/provenance.txt"
echo 'Show ONLY the real VM display in the capture region. No secrets or other windows.'
echo 'Start recording BEFORE powering on the VM, then follow docs/VM-TESTING.md.'
read -r -p 'Type RECORD to begin a continuous 300-second capture: ' answer
[[ "$answer" == RECORD ]] || exit 1
ffmpeg -nostdin -hide_banner -f x11grab -framerate 25 \
  -video_size "${CAPTURE_SIZE:-1280x720}" -i "${CAPTURE_INPUT:-$DISPLAY}" \
  -t 300 -an -c:v libx264 -preset veryfast -crf 23 -pix_fmt yuv420p \
  -movflags +faststart "$out/thadd-os-real-vm-5min.mp4"
ffprobe -v error -show_entries format=duration:stream=codec_name,width,height,pix_fmt \
  -of json "$out/thadd-os-real-vm-5min.mp4" > "$out/video-probe.json"
python3 - "$out/video-probe.json" <<'PY'
import json, sys
p = json.load(open(sys.argv[1]))
assert 295 <= float(p['format']['duration']) <= 305, p
assert any(s.get('codec_name') == 'h264' and s.get('width', 0) >= 1280 and s.get('height', 0) >= 720 for s in p['streams']), p
PY
# Decode the entire file as a basic corruption check. Human playback is still required.
ffmpeg -v error -i "$out/thadd-os-real-vm-5min.mp4" -f null -
# Short, silent preview from the actual continuous footage, not screenshots.
ffmpeg -nostdin -v warning -ss 60 -t 12 -i "$out/thadd-os-real-vm-5min.mp4" \
  -filter_complex '[0:v]fps=8,scale=640:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96[p];[b][p]paletteuse=dither=bayer' \
  -loop 0 "$out/thadd-os-real-vm-preview.gif"
echo "Saved actual-display recording and GIF to $out. Review privacy, playback and checklist before uploading."
