# Enabling the THADD OS CI verification

The complete end-to-end test suite for THADD OS lives at
**`ci/thadd-os-ci.yml.example`**. It builds the exact Docker image Railway
deploys, boots the whole OS, exercises the browser path (HTTP + WebSocket →
live desktop), performs a raw RDP protocol negotiation, **logs in over a real
RDP connection with FreeRDP**, audits the running desktop, and commits a
screenshot of the live system back to this repo as proof.

GitHub requires a repository with *workflows* write permission to host
workflow files under `.github/workflows/`. To enable it:

**Option A — GitHub web UI (easiest, ~20 seconds)**

1. Open [`ci/thadd-os-ci.yml.example`](thadd-os-ci.yml.example) and copy its contents.
2. Go to your repo → **Actions** → **New workflow** → **set up a workflow yourself**.
3. Paste the contents, name the file `thadd-os-ci.yml`, and commit.

**Option B — git**

```bash
git clone git@github.com:ThaddeusHackz/RDP-universal-.git
cd RDP-universal-
mkdir -p .github/workflows
cp ci/thadd-os-ci.yml.example .github/workflows/thadd-os-ci.yml
git add .github/workflows/thadd-os-ci.yml
git commit -m "enable THADD OS CI verification"
git push
```

**Option C — git (no clone)**

```bash
# from inside the repo
mkdir -p .github/workflows
cp ci/thadd-os-ci.yml.example .github/workflows/thadd-os-ci.yml
git add .github/workflows/thadd-os-ci.yml
git commit -m "enable THADD OS CI verification"
git push
```

Once pushed, the workflow runs automatically on every push and on
`workflow_dispatch`. The first run takes ~10–15 minutes (it builds the whole
OS from scratch and logs in over RDP). When it finishes, the screenshot at
`ci/thadd-os-screenshot.jpg` is replaced with a fresh capture of the running
desktop and the workflow badge in the README turns green.
