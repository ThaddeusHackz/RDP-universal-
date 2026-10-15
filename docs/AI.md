# THADD AI — the assistant that lives in the operating system

`docs/AI.md` · ships inside the image as `/usr/share/doc/thadd/AI.md`.

Most "AI in the OS" is a browser pointed at somebody's chat page. THADD AI is an agent
with real tools that act on *this machine*: it reads and writes files, runs commands,
installs packages, manages services, analyses disks, takes screenshots and drives the
desktop shell. It is the same agent the desktop's assistant window talks to and the same
one you get from a terminal:

```bash
thadd-ai                              # interactive session
thadd-ai "free up 5 GB in /var"       # one-shot task
thadd-ai ask "why is /var full?"      # one-shot question
thadd-ai models                       # the models this build knows
thadd-ai doctor                        # key, model, autonomy, tool inventory
thadd-ai selftest                      # offline proof that the agent works (13 checks)
thadd-ai --autonomy readonly "read /etc/fstab and explain it"
```

## Where the reasoning comes from

| Provider | How to enable | Notes |
| --- | --- | --- |
| **Groq** (default) | `export GROQ_API_KEY=gsk_…`, or *Settings → AI* in the desktop shell | `thadd/server/ai/groq.py` speaks plain OpenAI-compatible HTTP with `urllib` only — nothing to install in the live image |
| Any OpenAI-compatible endpoint | `thadd-ai --base-url https://… --model …` | Ollama, llama.cpp server, vLLM, OpenRouter, a gateway |
| **Offline** | nothing — it is the default with no key | `thadd/server/ai/local.py` answers with real information gathered through the same tools: disk usage, processes, file listings, security posture. No network, no key, no pretending |

Any browser works for the key; the assistant itself never needs one — it is the OS.

## What it can actually do

35 tools, grouped (`thadd-ai tools` lists them):

* **files** — `list_files`, `read_file`, `write_file`, `edit_file` (exact-snippet
  replace), `search_files` (names and contents), `move_path`, `copy_path`, `trash_path`
  (recoverable), `disk_usage`
* **system** — `system_info`, `system_metrics`, `list_processes`, `kill_process`,
  `read_logs`, `manage_service`, `install_package`
* **code** — `shell_run` (with a hard block list for system-destroying commands),
  `run_python`
* **security** — `security_posture`, `security_scan` (quick/full/rootkit/audit/virus/
  network/web), `hash_file`, `forensics_analyze` (file type, entropy, sections, strings,
  embedded files, indicators — the same engine as `thadd-scan --device`)
* **desktop** — `open_app`, `notify`, `set_appearance`, `control_window`, `clipboard`,
  `screenshot`, `gui_action` (mouse/keyboard automation), `open_url`
* **safety net** — `create_snapshot`, `list_snapshots`, `restore_snapshot`
* **research** — `web_fetch`, `list_tools`

## Reading a single artefact

Alongside the disk-wide forensic engine, the image ships `rea`
(`reverse-engineering/`): identify a binary, container or Electron app, extract
it, list the interesting strings, and write a markdown report. It is the tool to
reach for before asking the assistant about an unknown file —

```bash
rea --report ~/Downloads/installer.exe     # then: "read that report and tell me what you see"
thadd rea ~/Downloads/installer.exe        # same thing through the control centre
```

## The safety model, in plain words

1. **An autonomy dial.** `readonly` (it may look, never touch), `confirm` (the default —
   anything destructive waits for your yes), `autopilot` (it proceeds; the hard block
   list still applies).
2. **Approval, not surprise.** In `confirm`, a mutating tool raises an approval request
   that appears in the shell and, on the command line, as a `y/N/a` prompt.
   `a` switches the rest of the session to autopilot.
3. **Automatic restore points.** Before the first write of a run, a snapshot is taken
   (configurable: `snapshots.auto_before_ai_write`) so "undo" is a real command.
4. **A hard block list.** Irreversible, system-destroying commands are refused even in
   autopilot — no dial setting turns them into a yes.
5. **An audit trail.** Every call lands in `~/thadd/agent-audit.jsonl` (or
   `/var/lib/thadd/` for the system service) with the tool, its arguments and the exit
   status, so you can always read back what was done and why.

## Where it lives

| Path | What |
| --- | --- |
| `thadd/server/ai/agent.py` | the loop: prompt → model → tool calls → execution → answer, streamed |
| `thadd/server/ai/groq.py` | the Groq/OpenAI-compatible client (stdlib only, hand-rolled SSE) |
| `thadd/server/ai/tools.py` | the 35 tools and their JSON schemas |
| `thadd/server/ai/local.py` | the offline assistant |
| `thadd/server/ai/cli.py` | the terminal front-end (`thadd-ai`) |
| `thadd/server/api/` | the bridge the desktop shell uses: `fs`, `term`, `system`, `security`, `snapshots`, `shell`, `settings` |
| `desktop/`, `thadd/shell/` | the two shells that drive it (the ISO's bundled desktop, and the server-served one) |

Nothing above needs a package: the whole assistant is pure Python standard library, which
is why it works from a live ISO with no network and no pip.

## Configuration

`~/.config/thadd/config.json` (or `/etc/thadd/config.json` as root), overridable by
environment:

```json
{
  "ai": {
    "provider": "groq",
    "api_key": "",
    "model": "llama-3.3-70b-versatile",
    "fallback_model": "llama-3.1-8b-instant",
    "autonomy": "confirm",
    "stream": true,
    "temperature": 0.4,
    "max_tokens": 2048,
    "system_prompt": "",
    "offline_fallback": true
  },
  "snapshots": { "auto_before_ai_write": true, "retention": 24 },
  "security": { "panic_hotkey": "ctrl+alt+shift+w" }
}
```

Environment overrides: `GROQ_API_KEY`, `THADD_AI_MODEL`, `THADD_AI_AUTONOMY`,
`THADD_CONFIG`, `THADD_DATA`. In a session: `/model`, `/autonomy`, `/tools`, `/clear`,
`/doctor`, `/exit`.

## Honest limits

* With a key, quality is the model's; with no key, the offline assistant is deliberately
  rule-based — it will not reason its way through a novel problem, it will gather facts
  and act on explicit instructions.
* `gui_action` automates the X server, not Windows or macOS: it is XTest/xdotool-class
  automation, so it needs a running session.
* The agent runs with your privileges. In `autopilot`, that is your account's full blast
  radius — the block list and the audit log are guardrails, not a sandbox.
* Snapshots protect the paths configured in `snapshots.include`; they are not a
  filesystem-level backup of the whole machine.
