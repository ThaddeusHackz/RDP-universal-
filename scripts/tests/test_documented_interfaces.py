#!/usr/bin/env python3
"""Small offline regressions; synthetic checks, not Windows or VM acceptance."""
import hashlib
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))


class Interfaces(unittest.TestCase):
    def test_checkout_wrappers_outside_repo(self):
        with tempfile.TemporaryDirectory() as d:
            env = dict(os.environ, HOME=d, THADD_CONFIG=d + '/config.json', THADD_DATA=d + '/data')
            env.pop('GROQ_API_KEY', None)
            env.pop('PYTHONPATH', None)
            for name in ('thadd', 'thadd-ai', 'thadd-scan', 'thadd-toolbox'):
                p = subprocess.run([str(ROOT / 'os/usr/local/bin' / name), '--help'], cwd=d,
                                   env=env, capture_output=True, text=True, timeout=20)
                self.assertEqual(p.returncode, 0, p.stderr)
                self.assertTrue(p.stdout)

    def test_binary_join_and_checksums(self):
        with tempfile.TemporaryDirectory() as d:
            folder = Path(d)
            chunks = [b'\x00THADD\xff', b'\r\nPART1\x1a', b'last\x00part']
            lines = []
            for i, content in enumerate(chunks):
                name = f'THADD-OS-2026.10.14-aurora-amd64.iso.part-{i:02}'
                (folder / name).write_bytes(content)
                lines.append(f'{hashlib.sha256(content).hexdigest()}  {name}\n')
            (folder / 'parts.sha256').write_text(''.join(lines))
            subprocess.run(['sha256sum', '-c', 'parts.sha256'], cwd=d, check=True, capture_output=True)
            subprocess.run(['bash', '-c', 'cat THADD-OS-2026.10.14-aurora-amd64.iso.part-* > THADD-OS-2026.10.14-aurora-amd64.iso'], cwd=d, check=True)
            self.assertEqual((folder / 'THADD-OS-2026.10.14-aurora-amd64.iso').read_bytes(), b''.join(chunks))

    def test_offline_readonly_rejects_shell(self):
        from thadd.server.ai.local import local_reply
        from thadd.server.config import Config
        with tempfile.TemporaryDirectory() as d, patch.dict(os.environ, THADD_CONFIG=d+'/config.json', THADD_DATA=d+'/data'):
            with patch.object(Config, 'get', autospec=True, side_effect=lambda self, section, key, default=None: 'readonly' if (section, key) == ('ai', 'autonomy') else default):
                text, actions = local_reply('run touch ' + d + '/must-not-exist', None)
            self.assertIn('read-only', text)
            self.assertFalse(Path(d, 'must-not-exist').exists())
            self.assertFalse(actions)

    def test_offline_confirm_denial(self):
        from thadd.server.ai.local import local_reply
        with tempfile.TemporaryDirectory() as d, patch.dict(os.environ, THADD_CONFIG=d+'/config.json', THADD_DATA=d+'/data'):
            with patch('thadd.server.ai.agent._request_approval', return_value=False) as approval:
                text, _ = local_reply('run touch ' + d + '/must-not-exist', None)
            approval.assert_called_once()
            self.assertIn('declined', text)
            self.assertFalse(Path(d, 'must-not-exist').exists())

    def test_offline_confirm_approval(self):
        from thadd.server.ai.local import local_reply
        with tempfile.TemporaryDirectory() as d, patch.dict(os.environ, THADD_CONFIG=d+'/config.json', THADD_DATA=d+'/data'):
            with patch('thadd.server.ai.agent._request_approval', return_value=True):
                text, actions = local_reply('run printf harmless > ' + d + '/fixture.txt', None)
            self.assertEqual(Path(d, 'fixture.txt').read_text(), 'harmless')
            self.assertEqual(actions[0]['tool'], 'shell_run')
            self.assertTrue(Path(d, 'data', 'agent-audit.jsonl').exists())


if __name__ == '__main__':
    unittest.main()
