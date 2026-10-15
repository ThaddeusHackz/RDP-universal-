# Documentation/interface review — 2026-10-15

Source base: `4c086f5a243ecf084099636bef2040b4887633f6`, plus the documentation, CLI fallback and offline-agent gate changes in this working tree. This is **not an ISO acceptance report**.

## Release evidence

`gh release view --json tagName,name,assets,url,targetCommitish` returned latest release **v1.6**, “THADD OS 1.6”, target `main`. Actual desktop assets:

- `THADD-OS-2026.10.14-aurora-amd64.iso.part-00`: 1,992,294,400 bytes
- `THADD-OS-2026.10.14-aurora-amd64.iso.part-01`: 1,992,294,400 bytes
- `THADD-OS-2026.10.14-aurora-amd64.iso.part-02`: 1,914,388,480 bytes
- `parts.sha256`, `RELEASE-NOTES.md`

Separate minimal assets: `THADD-OS-1.0-x86_64.iso` (77,848,576 bytes), its `.sha256`, `manifest.json`. No desktop whole-ISO checksum sidecar appeared in the asset list. Release tag is not proof of an exact desktop source SHA. The committed verifier report for 2026.10.15 is a different image/date.

`gh release download` failed at the restricted `release-assets.githubusercontent.com` redirect. Thus release part hashes and image bytes were **not independently verified** here.

## Checks actually run

| Check | Result |
| --- | --- |
| `python3 scripts/tests/test_documented_interfaces.py` | PASS, 5 tests: four checkout wrappers from another cwd, synthetic binary join/hash, offline readonly rejection, Confirm denial, Confirm-approved harmless write with audit |
| `python3 ai/test_ai.py` | PASS, 8 checks |
| `python3 thadd/forensics/tests/test_triage.py` | PASS, 45 checks on synthetic fixtures |
| `python3 iso/tests/test_build_sh.py` | PASS, 89 checks with fake build/ISO fixtures—not a live-build run |
| `python3 iso/tests/test_release_publish.py` | PASS, 5 tests |
| `python3 scripts/ci/tests/test_publish_file.py` | PASS, 4 tests |
| `bash tools/syntax-check.sh` | PASS, 22 JavaScript files |
| Python compilation / `bash -n` on build and recording scripts | PASS |
| `rea --identify`, `rea --report --out` | PASS, harmless text fixture; honestly identified as `unknown` |
| Offline `thadd-ai --autonomy readonly ask "read ..."` | PASS, reads harmless fixture via shared gate |
| Native Windows CMD / PowerShell commands | NOT RUN; reviewed syntax only |
| Full Debian build / released ISO checksums / real VM boot | NOT RUN / BLOCKED |
| 300-second capture, playback, GIF, uploaded video | OUTSTANDING |

The new regression/syntax checks were added to `thadd-tests.yml`; no remote CI result is claimed for these changes. Source confirms desktop password/autologin configuration and `--debian-installer none`, not successful runtime login/installation.

The recording script needs an actual X11 VM host, ffmpeg/ffprobe and human operation/privacy/playback review. See [procedure and outstanding results](../VM-TESTING.md). No “zero errors,” exhaustive software coverage or perfect VM compatibility is claimed.
