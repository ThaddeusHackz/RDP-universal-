#!/usr/bin/env python3
"""Report publisher contract; fake gh, no GitHub access or credentials needed."""
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / 'publish-file.sh'


class PublishFile(unittest.TestCase):
    def run_publisher(self, mode='success', tag=False):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / 'report.md').write_text('evidence\n')
            (root / 'gh').write_text('''#!/bin/bash
if [[ "$*" != *"-X PUT"* ]]; then echo blob-sha; exit 0; fi
printf 'PUT\\n' >> "$CALLS"
case "$MODE" in
  fail) echo 'simulated API failure' >&2; exit 1 ;;
  conflict) [[ $(wc -l < "$CALLS") -gt 1 ]] || exit 1 ;;
esac
''')
            (root / 'gh').chmod(0o755)
            # Avoid real retry delays in these isolated tests.
            (root / 'sleep').write_text('#!/bin/sh\nexit 0\n')
            (root / 'sleep').chmod(0o755)
            env = {**os.environ, 'PATH': f'{root}:{os.environ["PATH"]}',
                   'GITHUB_REPOSITORY': 'test/repo', 'GITHUB_REF_NAME': 'v9' if tag else 'arena/test',
                   'GITHUB_REF_TYPE': 'tag' if tag else 'branch',
                   'GITHUB_REF': 'refs/tags/v9' if tag else 'refs/heads/arena/test',
                   'CALLS': str(root / 'calls'), 'MODE': mode}
            proc = subprocess.run(['bash', str(SCRIPT), 'report.md'], cwd=root, env=env,
                                  capture_output=True, text=True)
            calls = (root / 'calls').read_text().splitlines() if (root / 'calls').exists() else []
            return proc, calls

    def test_success(self):
        proc, calls = self.run_publisher()
        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertIn('committed report.md', proc.stdout)
        self.assertEqual(len(calls), 1)

    def test_conflict_retries(self):
        proc, calls = self.run_publisher('conflict')
        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertEqual(len(calls), 2)

    def test_exhausted_retries_fail_loudly(self):
        proc, calls = self.run_publisher('fail')
        self.assertNotEqual(proc.returncode, 0)
        self.assertIn('::error::', proc.stdout)
        self.assertNotIn('committed report.md', proc.stdout)
        self.assertEqual(len(calls), 3)

    def test_tag_does_not_write_to_a_branch(self):
        proc, calls = self.run_publisher(tag=True)
        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertIn('skipping repository commit for tag', proc.stdout)
        self.assertEqual(calls, [])


if __name__ == '__main__':
    unittest.main()
