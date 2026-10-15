#!/usr/bin/env python3
"""THADD OS · renderer regression test  (gallery + demo video).

The desktop gallery and the demo MP4 are shipped build artefacts, so they are
tested like one.  What this catches:

* a scene that cannot draw on the canvas it is handed - PIL raises
  ``ValueError: y1 must be greater than or equal to y0`` on an inverted
  rectangle, and one scene used to take the entire render down with it;
* a small ("preview"/"half size") request, which is rendered on the 1280x720
  layout floor and downscaled, so the media comes out at the size that was
  asked for instead of the size the layout happens to want;
* a silent fallback away from H.264: the demo must be a real MP4 encode, not
  the animated-GIF last resort.

Usage:
    python3 thadd/server/tests/test_render.py          # ~30 s
    python3 thadd/server/tests/test_render.py --quick   # few scenes only

Exit status is 0 only when every check passes; a failure prints the traceback
so the CI job can publish it verbatim.
"""
from __future__ import annotations

import os
import sys
import tempfile
import traceback

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))

from PIL import Image  # noqa: E402

from thadd.server import video  # noqa: E402

CHECKS = 0
FAILURES: list[str] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    global CHECKS
    CHECKS += 1
    print(f"  {'✓' if ok else '✗'} {name}{('  — ' + detail) if detail else ''}")
    if not ok:
        FAILURES.append(f"{name}: {detail}")


def main() -> int:
    quick = "--quick" in sys.argv
    limit = 4 if quick else 0
    tmp = tempfile.mkdtemp(prefix="thadd-render-")
    print(f"THADD renderer test · tmp={tmp} · limit={limit or 'all scenes'}")

    print("\n[1] gallery at the design size (1600x900, the shipped snapshots)")
    shots = video.render_snapshots(os.path.join(tmp, "design"), limit=limit)
    sizes = {Image.open(p).size for p in shots}
    check("gallery renders", len(shots) >= (4 if quick else 30), f"{len(shots)} scenes")
    check("gallery is 1600x900", sizes == {(1600, 900)}, f"sizes={sizes}")

    print("\n[2] gallery below the layout floor (640x360, the downscale path)")
    small = video.render_snapshots(os.path.join(tmp, "small"), width=640, height=360, limit=limit)
    ssizes = {Image.open(p).size for p in small}
    check("scaled gallery renders", len(small) == len(shots), f"{len(small)} scenes")
    check("scaled gallery is 640x360", ssizes == {(640, 360)}, f"sizes={ssizes}")

    print("\n[3] one scene printed large (1920x1080, the direct path)")
    big = video.render_snapshots(os.path.join(tmp, "big"), width=1920, height=1080, limit=1)
    check("large canvas renders", len(big) == 1 and Image.open(big[0]).size == (1920, 1080))

    print("\n[4] demo MP4 (H.264, 640x360, 0.4 s per scene)")
    mp4 = os.path.join(tmp, "demo.mp4")
    info = video.render_video(mp4, width=640, height=360, seconds_per_scene=0.4, limit=limit)
    expected_scenes = limit or len(video.SCENES)
    check("video encoded with H.264", info.get("mode") in ("pyav-h264", "ffmpeg-h264"), f"mode={info.get('mode')}")
    check("video has frames", info.get("frames", 0) > (30 if quick else 100), f"frames={info.get('frames')}")
    check("video has bytes", info.get("bytes", 0) > 20_000, f"bytes={info.get('bytes')}")
    check("video covers every scene", info.get("scenes") == expected_scenes,
          f"scenes={info.get('scenes')} expected={expected_scenes}")
    if info.get("path", "").endswith(".mp4"):
        with open(info["path"], "rb") as fh:
            head = fh.read(12)
        check("mp4 container header", head[4:8] == b"ftyp", f"head={head!r}")

    print("\n[5] every scene can be drawn on the 1280x720 floor")
    floored = video.render_snapshots(os.path.join(tmp, "floor"), width=1280, height=720, limit=limit)
    fsizes = {Image.open(p).size for p in floored}
    check("floor gallery renders", len(floored) == len(shots) and fsizes == {(1280, 720)}, f"sizes={fsizes}")

    print(f"\n{CHECKS - len(FAILURES)}/{CHECKS} checks passed")
    for f in FAILURES:
        print(f"  FAILED {f}")
    if FAILURES:
        print(f"\nartefacts kept for inspection: {tmp}")
        return 1
    print(f"artefacts: {tmp}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except SystemExit:
        raise
    except Exception:
        traceback.print_exc()
        raise SystemExit(1)
