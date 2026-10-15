#!/usr/bin/env python3
"""THADD OS — the assistant's entry point inside the image.

This file lives at ``/opt/thadd/ai/thadd-ai.py`` in a booted THADD OS and is the
path the build, the verification report and the self-check all point at when they
mean "the AI assistant".  The assistant itself is the package staged next to it
at ``/opt/thadd/app/thadd/server/ai`` — this is a thin, honest front door to it,
not a second implementation:

    /opt/thadd/ai/thadd-ai.py --version
    /opt/thadd/ai/thadd-ai.py "free up 5 GB in /var"
    /opt/thadd/ai/thadd-ai.py selftest

The version banner comes from ``thadd.server.config``, which reads the running
system's own ``/etc/thadd/build-info`` — so this prints the version of the OS it
is running in (2026.10 "aurora" for the desktop image) rather than a constant
that drifted from it.

For years this file was a three-line placeholder: it printed a placeholder banner
and exited 0, while the real assistant shipped elsewhere and every existence check
passed.  If the package is not where it should be, say so and
exit non-zero instead of pretending.
"""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

LIB_CANDIDATES = ("/opt/thadd/app",)


def find_app() -> Path | None:
    """The directory that has to be on PYTHONPATH for `import thadd` to work.

    THADD_LIB is an explicit instruction, so an unusable value is an error rather
    than something to quietly step over: otherwise "run the assistant from over
    there" would silently run it from here, and a test that points THADD_LIB at
    nothing would pass on any machine that happens to have THADD OS installed.
    """
    env = os.environ.get("THADD_LIB")
    if env:
        return Path(env) if (Path(env) / "thadd").is_dir() else None
    for candidate in LIB_CANDIDATES:
        if (Path(candidate) / "thadd").is_dir():
            return Path(candidate)
    # a repository checkout: this file is <repo>/ai/thadd-ai.py
    repo = Path(__file__).resolve().parent.parent
    if (repo / "thadd").is_dir():
        return repo
    return None


def main(argv: list[str]) -> int:
    app = find_app()
    if app is None:
        where = [f"{env} (THADD_LIB)"] if (env := os.environ.get("THADD_LIB")) else []
        where += ["/opt/thadd/app/thadd (the image layout)",
                  f"{Path(__file__).resolve().parent.parent / 'thadd'} (a checkout)"]
        sys.stderr.write(
            "THADD AI: the assistant package is not installed here.\n"
            + "".join(f"  looked for: {path}\n" for path in where)
            + "  the image stages it with `stage thadd opt/thadd/app/thadd`;\n"
              "  in a checkout, run this file from the repository root.\n")
        return 1

    # `--selftest` was the placeholder's only flag; keep it working as the real
    # subcommand so any older pointer to it still does something true.
    if argv and argv[0] == "--selftest":
        argv = ["selftest", *argv[1:]]

    env = dict(os.environ)
    existing = env.get("PYTHONPATH", "")
    parts = [p for p in existing.split(os.pathsep) if p]
    if str(app) not in parts:
        env["PYTHONPATH"] = os.pathsep.join([str(app), *parts])
    env.setdefault("PYTHONUNBUFFERED", "1")

    try:
        return subprocess.call([sys.executable, "-m", "thadd.server.ai.cli", *argv], env=env)
    except FileNotFoundError:
        sys.stderr.write("THADD AI: python3 is not available on this system.\n")
        return 1
    except KeyboardInterrupt:
        return 130


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
