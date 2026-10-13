#!/usr/bin/env python3
"""Command line forensic scan - `python3 -m thadd.forensics.cli <target>`.

Runs the THADD triage engine over a disk, a partition or an image file and
prints (and optionally saves) the report.  Read-only: the target is opened
without write intent and never mounted.

    python3 -m thadd.forensics.cli /dev/sdX
    python3 -m thadd.forensics.cli evidence.img --out ./case-01 --json
    python3 -m thadd.forensics.cli disk.img --quick --quiet

Inside a running THADD OS the same thing is `thadd dfir /dev/sdX`.
"""
from __future__ import annotations

import argparse
import json
import sys
import time

from . import triage


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="thadd-dfir",
                                 description="THADD OS forensic triage — read-only, no mounts")
    ap.add_argument("target", help="block device (/dev/sdX) or image file")
    ap.add_argument("--out", default="", help="directory to save report.json + report.md")
    ap.add_argument("--json", action="store_true", help="print JSON instead of markdown")
    ap.add_argument("--quick", action="store_true", help="structure only (skip deep scans)")
    ap.add_argument("--quiet", action="store_true", help="no progress output")
    ap.add_argument("--summary", action="store_true", help="only the verdict lines")
    args = ap.parse_args(argv)

    started = time.time()
    last = [0.0]

    def progress(msg: str) -> None:
        if args.quiet or args.summary:
            return
        now = time.time()
        if now - last[0] > 0.15:
            last[0] = now
            print(f"  · {msg}", file=sys.stderr)

    report = triage.analyze(args.target, deep=not args.quick, progress=progress)
    elapsed = time.time() - started

    if args.summary:
        sizes = report.get("evidence", {}).get("size", 0)
        print(f"target      : {report.get('target')}")
        print(f"size        : {sizes} bytes ({sizes / 1e9:.2f} GB)" if sizes else "size        : ?")
        print(f"sha256      : {report.get('evidence', {}).get('sha256', '?')[:32]}…")
        for p in report.get("partitions", []):
            print(f"partition   : #{p.get('number')} {p.get('type')} at {p.get('offset')} "
                  f"({p.get('size')} bytes)")
        for f in report.get("filesystems", []):
            print(f"filesystem  : {f.get('fs')} on partition {f.get('partition')}")
        for o in report.get("os_detected", []):
            print(f"os          : {o.get('family')} {o.get('distro', '')} "
                  f"(confidence {o.get('confidence')}) — {'; '.join(o.get('evidence', []))[:100]}")
        for w in report.get("warnings", []):
            print(f"warning     : {w}")
        print(f"elapsed     : {elapsed:.1f}s")
        return 0

    if args.json:
        print(json.dumps(report, indent=2, default=str))
    else:
        print(triage.report_markdown(report))

    if args.out:
        saved = triage.save_report(report, args.out)
        print(f"\nsaved: {saved}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
