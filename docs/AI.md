# THADD AI: configuration, permissions and limits

[README](../README.md) · implementation: `thadd/server/ai/` · CLI: `thadd-ai --help`.

## Real interfaces

```bash
thadd-ai                         # interactive
thadd-ai doctor
thadd-ai models                   # configured catalog, not a live availability guarantee
thadd-ai tools
thadd-ai selftest
thadd-ai --autonomy readonly ask "list files in /tmp"
thadd-ai --autonomy confirm ask "run printf 'hello THADD\\n'"
```

Options include `--model`, `--base-url`, `--mode {chat,plan}`, `--no-stream`, `--json`, `--quiet` and `--autonomy {readonly,confirm,autopilot}`. A plan request is not itself a sandbox. Avoid `--key` because command arguments can expose secrets. Interactive commands include `/model`, `/autonomy`, `/tools`, `/clear`, `/doctor`, `/exit`.

## Groq / endpoint configuration

With no configured key, the agent selects the deterministic offline helper. A Groq key enables cloud reasoning; model access, quotas and network availability must be checked for your account. Default source model names are configuration choices, not proof the provider still offers them. Other OpenAI-compatible endpoints can be selected with `--base-url`/`--model`, but their authentication/streaming compatibility must be tested. A no-key local endpoint may still select the offline path; do not advertise automatic local-LLM integration.

Enter the key in Settings → AI privately, or in Bash:

```bash
read -rsp 'Groq API key: ' GROQ_API_KEY; echo
export GROQ_API_KEY
thadd-ai doctor
thadd-ai --autonomy readonly ask "What is using memory?"
unset GROQ_API_KEY
```

Do not record key setup or dump configuration/environment into public reports. Settings may store a key in plaintext JSON. Protect its file permissions; unset does not remove settings-persisted secrets. Cloud requests can transmit prompts and tool results, including file contents, to the configured provider. Never submit private evidence without authorization.

Configuration: `~/.config/thadd/config.json`, or `/etc/thadd/config.json` for root when that directory exists. Overrides: `THADD_CONFIG`, `GROQ_API_KEY`, `THADD_AI_MODEL`, `THADD_AI_AUTONOMY`. Example non-secret fields:

```json
{"ai":{"provider":"groq","model":"llama-3.3-70b-versatile","autonomy":"confirm","stream":true,"offline_fallback":true},"snapshots":{"auto_before_ai_write":true,"retention":24}}
```

The fallback setting must not be interpreted as a guarantee of seamless recovery from every provider/network failure.

## Offline capability

No network/key is needed for rule-based local requests such as `list files in /tmp`, `read /path/file.txt`, `hash /path/file.txt`, `analyse /path/file.txt`, process/resource checks and available-tool queries. It is **not a general-purpose language model**, cannot reason through arbitrary tasks and cannot install absent dependencies offline. `run ...` executes a real shell command subject to permissions and approval; it is not just text generation.

**Safety fix in this checkout:** the prior local helper directly called subprocess/API functions, bypassing the cloud agent's approval/audit boundary for offline commands. Current source routes local tools through `AgentRun._execute_tool`, including shell commands, and audits readonly denials. **This does not retroactively fix v1.6 release assets.** Treat older offline execution as unsafe and do not rely on `readonly` there; use only benign read requests until a fixed image is built and tested.

## Permissions and approval

- `readonly`: rejects tools marked destructive by the registry. This is registry classification, **not kernel-enforced read-only access**; some nominally non-destructive tools can create reports/snapshots or launch apps.
- `confirm` (default): tools marked destructive require approval. Review arguments/path/command; decline unexpected operations. The prompt's `a` enables autopilot for the session—do not select it during a demo.
- `autopilot`: skips those approvals; blocklist remains. **Do not enable it to make a recording easier.**

The agent runs with its process user's access. Shell execution, package installation, services and disk reads may need extra permissions; do not run the whole assistant as root. Blocklists can miss harmful command variants; they are not containment. GUI actions require a running graphical session and supporting binaries. Snapshots are path-based copies of configured inclusions, not whole-machine backups or a guarantee of recovery.

## Audit and data

Current `data_dir()` resolves to `THADD_DATA` if set, otherwise `/var/lib/thadd` for root if present, otherwise **`~/.thadd`**. The audit file is **`agent-audit.jsonl`** within that directory, not `~/thadd`. Saved conversations and snapshots also contain potentially sensitive data.

```bash
# Default non-root path, unless THADD_DATA was overridden:
tail -n 20 "${THADD_DATA:-$HOME/.thadd}/agent-audit.jsonl"
```

Review logs privately; arguments, paths and command text can disclose secrets. The log is local, mutable and not tamper-evident. Writes may fail, and absence of a log is not proof no action happened. Logs/settings/password changes in a live overlay disappear unless saved to tested persistent storage. Current offline actions use the same audit boundary; older release behavior differs as noted above.

## Disposable demonstration

Use a fixed, isolated config with no key, not just `unset GROQ_API_KEY` (a key may remain in settings):

```bash
test_dir=$(mktemp -d /tmp/thadd-ai-test.XXXXXX)
printf '{"ai":{"api_key":"","autonomy":"readonly"}}\n' > "$test_dir/config.json"
export THADD_CONFIG="$test_dir/config.json" THADD_DATA="$test_dir/data"
unset GROQ_API_KEY
printf 'harmless fixture\n' > "$test_dir/fixture.txt"
thadd-ai --autonomy readonly ask "read $test_dir/fixture.txt"
thadd-ai --autonomy readonly ask "hash $test_dir/fixture.txt"
# ONLY on a newly built image containing the offline gate fix:
thadd-ai --autonomy confirm ask "run printf 'approved fixture\\n' > $test_dir/approved.txt"
# Inspect and approve exactly that disposable path; never select autopilot.
cat "$test_dir/approved.txt"
```

Do not claim this tests all agent tools. [VM procedure](VM-TESTING.md) records pass/fail/skipped results and remaining limitations.
