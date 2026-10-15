#!/usr/bin/env python3
"""Tests for the assistant's entry point (``ai/thadd-ai.py``).

This module used to print "THADD AI tests: placeholder OK" and exit 0 — a test
that could not fail, guarding a file that could not work.  It now checks the
things that actually broke:

1. the entry point runs at all (it once printed a placeholder and exited 0 while
   the real assistant shipped somewhere else);
2. it reports *this* system's identity, not a constant that drifted from it;
3. it fails loudly, with a useful message, when the assistant package is absent —
   instead of printing something reassuring and exiting 0;
4. the offline assistant answers without a network key, because a live ISO with no
   network still has to be able to help.

Run it directly (``python3 ai/test_ai.py``) or via the CI step that calls it.
"""

from __future__ import annotations

import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent
ENTRY = HERE / "thadd-ai.py"

FAILURES: list[str] = []
CHECKS = 0


def check(what: str, ok: bool, detail: str = "") -> None:
    global CHECKS
    CHECKS += 1
    if ok:
        print(f"  \033[32m✓\033[0m {what}")
    else:
        print(f"  \033[31m✗ {what}\033[0m")
        if detail:
            print(f"      {detail.strip()[:300]}")
        FAILURES.append(what)


def run(args: list[str], env: dict | None = None, cwd: str | None = None, timeout: int = 120):
    merged = dict(os.environ)
    merged.pop("GROQ_API_KEY", None)          # the offline path is what a live ISO has
    merged["PYTHONPATH"] = str(REPO)
    if env:
        merged.update(env)
    return subprocess.run([sys.executable, str(ENTRY), *args], capture_output=True,
                          text=True, timeout=timeout, env=merged, cwd=cwd or str(REPO))


def main() -> int:
    print("THADD AI — entry point tests\n")

    # the placeholder's signature was a banner nobody could miss, and no call into
    # the real assistant anywhere in the file
    source = ENTRY.read_text(encoding="utf-8") if ENTRY.is_file() else ""
    check("the entry point is a front door to the real assistant, not a stub",
          ENTRY.is_file() and "thadd.server.ai.cli" in source and "PLACEHOLDER_BANNER" not in source,
          "ai/thadd-ai.py does not call thadd.server.ai.cli")

    proc = run(["--version"])
    check("`thadd-ai.py --version` runs and names the assistant",
          proc.returncode == 0 and "THADD AI" in proc.stdout,
          proc.stdout + proc.stderr)

    # the identity has to come from the running system, not from a constant that
    # said "1.0 Nebula Prime" while the image said 2026.10 aurora
    with tempfile.TemporaryDirectory() as tmp:
        info = Path(tmp) / "build-info"
        info.write_text("THADD_OS_VERSION=9.9-test\nTHADD_OS_CODENAME=test-codename\n", encoding="utf-8")
        proc_env = run(["--version"], env={"THADD_BUILD_INFO": str(info)})
        # the file is only read from /etc/thadd/build-info; simulate it by asking
        # the config module what it would report with that file in place
        sim = subprocess.run(
            [sys.executable, "-c",
             "import pathlib, sys, types\n"
             f"sys.path.insert(0, {str(REPO)!r})\n"
             "import thadd.server.config as c\n"
             "c.BUILD_INFO = " + repr(str(info)) + "\n"
             "v, n, _ = c._identity_from_os()\n"
             "print(v, n)\n"],
            capture_output=True, text=True, timeout=60)
        check("the identity comes from /etc/thadd/build-info when it exists",
              "9.9-test test-codename" in sim.stdout.strip(),
              sim.stdout + sim.stderr)
        check("`--version` still answers with no build-info present", proc_env.returncode == 0)

    proc = run(["selftest"], timeout=300)
    check("`thadd-ai.py selftest` passes offline (no key, no network)",
          proc.returncode == 0 and re.search(r"(\d+)/(\d+) checks passed", proc.stdout or "")
          and "0 failed" not in (proc.stdout or ""),
          (proc.stdout or "")[-400:] + (proc.stderr or "")[-200:])

    proc = run(["--selftest"], timeout=300)
    check("the old `--selftest` spelling still works", proc.returncode == 0,
          (proc.stdout or "")[-200:])

    proc = run(["ask", "what operating system is this?"], timeout=300)
    check("the offline assistant answers a real question",
          proc.returncode == 0 and len(proc.stdout.strip()) > 40,
          (proc.stdout or "")[-300:] + (proc.stderr or "")[-200:])

    # absent package: the entry point must refuse, not reassure.  This is checked
    # from a copy outside the repository, otherwise the checkout *is* the package
    # and the honest answer is simply to run.
    with tempfile.TemporaryDirectory() as tmp:
        lonely = Path(tmp) / "ai" / "thadd-ai.py"
        lonely.parent.mkdir(parents=True, exist_ok=True)
        lonely.write_text(ENTRY.read_text(encoding="utf-8"), encoding="utf-8")
        proc = subprocess.run([sys.executable, str(lonely), "--version"], capture_output=True,
                              text=True, timeout=60,
                              env={**os.environ, "THADD_LIB": "/nonexistent/thadd-app"})
        check("a missing assistant package fails loudly instead of exiting 0",
              proc.returncode != 0 and "not installed" in (proc.stderr + proc.stdout),
              f"rc={proc.returncode} {proc.stdout}{proc.stderr}")

    print(f"\n{'-' * 46}")
    if FAILURES:
        print(f"\033[31m{len(FAILURES)} of {CHECKS} checks failed\033[0m")
        return 1
    print(f"\033[32mall {CHECKS} checks passed\033[0m")
    return 0


if __name__ == "__main__":
    sys.exit(main())
