#!/usr/bin/env python3
"""Exercise the workflow's publishing shell without GitHub or large assets."""
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]


class ReleasePublishing(unittest.TestCase):
    def publish(self, ref):
        workflow = (ROOT / '.github/workflows/iso-build.yml').read_text()
        block = workflow.split('      - name: Publish Release\n', 1)[1].split('        run: |\n', 1)[1]
        script = '\n'.join(line[10:] for line in block.splitlines())
        script = script.replace('${{ github.ref_name }}', ref.removeprefix('refs/tags/').removeprefix('refs/heads/'))
        script = script.replace('${{ github.ref }}', ref)
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / 'dist').mkdir()
            for name in ('test.iso.part-00', 'parts.sha256', 'test.iso.sha256', 'RELEASE-NOTES.md', 'README.txt'):
                (root / 'dist' / name).write_text('fixture\n')
            (root / 'gh').write_text('#!/bin/bash\nprintf "%s\\n" "$*" >> "$CALLS"\n')
            (root / 'gh').chmod(0o755)
            env = {**os.environ, 'PATH': f'{root}:{os.environ["PATH"]}', 'CALLS': str(root / 'calls')}
            proc = subprocess.run(['bash', '-eo', 'pipefail', '-c', script], cwd=root, env=env,
                                  capture_output=True, text=True)
            calls = (root / 'calls').read_text() if (root / 'calls').exists() else ''
            return proc, calls

    def test_branch_cannot_overwrite_v1(self):
        proc, calls = self.publish('refs/heads/arena/test')
        self.assertNotEqual(proc.returncode, 0)
        self.assertIn('Publishing requires a version tag', proc.stdout)
        self.assertEqual(calls, '')

    def test_tag_uploads_parts_and_both_checksums(self):
        proc, calls = self.publish('refs/tags/v9.9')
        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertIn('release upload v9.9 dist/test.iso.part-00 dist/parts.sha256', calls)
        self.assertIn('release upload v9.9 dist/test.iso.sha256 dist/RELEASE-NOTES.md', calls)
        self.assertNotIn('v1.0', calls)


if __name__ == '__main__':
    unittest.main()
