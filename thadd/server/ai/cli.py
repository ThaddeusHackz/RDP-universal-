#!/usr/bin/env python3
"""THADD OS — the AI assistant on the command line.

The desktop shell talks to the agent over WebSockets; this is the same agent with
the same tools, driven from a terminal (and from ``/usr/local/bin/thadd-ai`` in
the live ISO, where the only dependency is python3 itself).

    thadd-ai                          # interactive session
    thadd-ai "find every PDF in ~/Downloads and tell me which are duplicates"
    thadd-ai ask "why is /var full?"  # one-shot
    thadd-ai doctor                   # environment / key / tool report
    thadd-ai models                   # models this build knows about
    thadd-ai selftest                 # offline proof that the agent works

What it can actually do is decided by ``ai/tools.py``: read, write, edit and
search files, run shell commands, analyse disks and files for forensics, manage
packages and services, take screenshots, drive the desktop shell.  Anything that
changes the system asks for confirmation first unless the autonomy dial says
otherwise (``--autonomy autopilot``), and every call is written to the agent
audit log (``~/thadd/agent-audit.jsonl``).
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import textwrap

from ..config import Config, THADD_CODENAME, THADD_VERSION, data_dir, os_pretty_name

DIM = "\033[2m"
BOLD = "\033[1m"
CYAN = "\033[36m"
GREEN = "\033[32m"
RED = "\033[31m"
YELLOW = "\033[33m"
RESET = "\033[0m"

BANNER = r"""
  ████████╗██╗  ██╗ █████╗ ██████╗ ██████╗      █████╗ ██╗
  ╚══██╔══╝██║  ██║██╔══██╗██╔══██╗██╔══██╗    ██╔══██╗██║
     ██║   ███████║███████║██║  ██║██║  ██║    ███████║██║
     ██║   ██╔══██║██╔══██║██║  ██║██║  ██║    ██╔══██║██║
     ██║   ██║  ██║██║  ██║██████╔╝██████╔╝    ██║  ██║██║
     ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝ ╚═════╝     ╚═╝  ╚═╝╚═╝
"""


def _colour(enabled: bool, code: str) -> str:
    return code if enabled else ""


class TerminalSink:
    """Receives the agent's event stream and renders it for a terminal.

    ``AgentRun`` only needs ``push()`` (a JSON line per event) plus a ``_stop``
    flag it polls between tokens - the same contract the WebSocket stream gives
    the desktop shell.
    """

    def __init__(self, stream_tokens: bool = True, quiet: bool = False, colour: bool = True):
        self.stream_tokens = stream_tokens
        self.quiet = quiet
        self.colour = colour
        self.meta: dict = {}
        self.text: list[str] = []
        self._open_line = False
        self._stop = _NeverSet()

    # ------------------------------------------------------------------ helpers
    def _line(self, out: str) -> None:
        if self._open_line:
            sys.stdout.write("\n")
            self._open_line = False
        if not self.quiet:
            sys.stdout.write(out + "\n")
        sys.stdout.flush()

    def push(self, chunk: str) -> None:
        try:
            event = json.loads(chunk)
        except (TypeError, ValueError):
            sys.stdout.write(str(chunk))
            sys.stdout.flush()
            return
        handler = getattr(self, "_on_" + str(event.get("type", "")).replace(".", "_"), None)
        if handler:
            handler(event)

    # ------------------------------------------------------------------- events
    def _on_token(self, event: dict) -> None:
        piece = str(event.get("text", ""))
        self.text.append(piece)
        if self.stream_tokens and not self.quiet:
            sys.stdout.write(piece)
            sys.stdout.flush()
            self._open_line = True

    def _on_step(self, event: dict) -> None:
        self._line(f"{_colour(self.colour, DIM)}· step {event.get('step')} "
                   f"({event.get('model', '')}){_colour(self.colour, RESET)}")

    def _on_tool_call(self, event: dict) -> None:
        args = json.dumps(event.get("args", {}), default=str)
        if len(args) > 160:
            args = args[:160] + "…"
        self._line(f"{_colour(self.colour, CYAN)}  → {event.get('tool')}  "
                   f"{_colour(self.colour, DIM)}{args}{_colour(self.colour, RESET)}")

    def _on_tool_result(self, event: dict) -> None:
        mark = "✓" if event.get("ok") else "✗"
        tint = GREEN if event.get("ok") else RED
        preview = json.dumps(event.get("preview", event.get("result", {})), default=str)
        if len(preview) > 200:
            preview = preview[:200] + "…"
        self._line(f"{_colour(self.colour, tint)}  {mark} {event.get('tool')}"
                   f"{_colour(self.colour, DIM)}  {preview}{_colour(self.colour, RESET)}")

    def _on_approval_request(self, event: dict) -> None:
        self._line(f"{_colour(self.colour, YELLOW)}  ! {event.get('tool')} needs your "
                   f"approval{_colour(self.colour, RESET)}")

    def _on_snapshot(self, event: dict) -> None:
        self._line(f"{_colour(self.colour, DIM)}  ⌛ restore point {event.get('snapshot')} "
                   f"({event.get('label', '')}){_colour(self.colour, RESET)}")

    def _on_error(self, event: dict) -> None:
        self._line(f"{_colour(self.colour, RED)}  ✗ {event.get('message')}{_colour(self.colour, RESET)}")

    def _on_done(self, event: dict) -> None:
        self.meta = event
        if self._open_line:
            sys.stdout.write("\n")
            self._open_line = False
        sys.stdout.flush()

    def answer(self) -> str:
        return "".join(self.text).strip()


class _NeverSet:
    def is_set(self) -> bool:  # the agent polls this between tokens
        return False


class Session:
    """Minimal stand-in for the shell's session object."""

    def __init__(self) -> None:
        self.events: list[tuple[str, dict]] = []

    def emit(self, event: str, data: dict) -> None:
        self.events.append((event, data or {}))
        if event == "ai.approval":
            self._approve(data or {})

    def _approve(self, data: dict) -> None:
        from . import agent as agentmod

        print()
        print(f"{YELLOW}THADD AI wants to run:{RESET} {data.get('tool')} "
              f"{json.dumps(data.get('args', {}), default=str)[:400]}")
        if data.get("reason"):
            print(f"{DIM}  {data['reason']}{RESET}")
        prompt = "  allow? [y/N/a=always for this session] "
        answer = ""
        if sys.stdin.isatty():
            try:
                answer = input(prompt).strip().lower()
            except (EOFError, KeyboardInterrupt):
                answer = ""
        allow = answer in ("y", "yes", "a", "always")
        if answer in ("a", "always"):
            os.environ["THADD_AI_AUTONOMY"] = "autopilot"
        print(f"  {GREEN if allow else RED}{'allowed' if allow else 'denied'}{RESET}")
        agentmod.resolve_approval(str(data.get("id", "")), allow)


# --------------------------------------------------------------------- plumbing
def _make_config(args) -> Config:
    if getattr(args, "autonomy", None):
        os.environ["THADD_AI_AUTONOMY"] = args.autonomy
    if getattr(args, "model", None):
        os.environ["THADD_AI_MODEL"] = args.model
    if getattr(args, "key", None):
        os.environ["GROQ_API_KEY"] = args.key
    if getattr(args, "base_url", None):
        os.environ["THADD_AI_BASE_URL"] = args.base_url
    cfg = Config()
    if getattr(args, "key", None):
        cfg.data["ai"]["api_key"] = args.key
    return cfg


def _history_messages(history: list[dict], limit: int) -> list[dict]:
    out = []
    for item in (history or [])[-limit:]:
        role, content = item.get("role"), item.get("content")
        if role in ("user", "assistant") and content:
            out.append({"role": role, "content": str(content)[:16000]})
    return out


def run_prompt(prompt: str, cfg: Config, history: list[dict] | None = None,
               sink: TerminalSink | None = None, mode: str = "chat") -> dict:
    """Run one agent turn, streaming it to the terminal.  Returns the run result."""
    from . import agent as agentmod
    from .local import local_reply

    sink = sink or TerminalSink()
    session = Session()

    messages = [{"role": "system", "content": agentmod.system_prompt(cfg)}]
    if mode == "plan":
        messages.append({"role": "system",
                         "content": "Produce a numbered plan first and wait for the user's go-ahead "
                                    "before changing anything on this machine."})
    messages += _history_messages(history or [], 24)
    messages.append({"role": "user", "content": prompt})

    key = (cfg.get("ai", "api_key") or "").strip()
    if not key:
        # No key (or an offline machine): the local assistant still answers with
        # real information pulled through the same tools.
        sink._line(f"{DIM}no Groq API key — answering with the offline assistant "
                   f"(set GROQ_API_KEY or run: thadd-ai key <your-key>){RESET}")
        text, actions = local_reply(prompt, session)
        if not sink.quiet:
            sys.stdout.write(text + "\n")
        for act in actions:
            sink._on_tool_call({"tool": act["tool"], "args": act.get("args", {})})
            sink._on_tool_result({"tool": act["tool"], "ok": True, "preview": act.get("result", {})})
        sink.text = [text]
        return {"ok": True, "mode": "local", "text": text, "messages": messages,
                "actions": actions}

    run = agentmod.AgentRun(session, messages, model=args_model(cfg), cfg=cfg, stream=sink)
    result = run.run()
    result.setdefault("mode", "agent")
    result["text"] = sink.answer()
    return result


def args_model(cfg: Config) -> str:
    return str(os.environ.get("THADD_AI_MODEL") or cfg.get("ai", "model") or "llama-3.3-70b-versatile")


# ------------------------------------------------------------------- subcommands
def cmd_chat(args, cfg: Config) -> int:
    from . import agent as agentmod
    from .groq import GROQ_MODELS

    interactive = sys.stdin.isatty() and not args.prompt
    colour = interactive
    if interactive and not args.quiet:
        print(_colour(colour, CYAN) + BANNER + _colour(colour, RESET))
        print(f"  THADD AI {THADD_VERSION} “{THADD_CODENAME}” · {os_pretty_name()}")
        print(f"  model {_colour(colour, BOLD)}{args_model(cfg)}{_colour(colour, RESET)}"
              f" · autonomy {cfg.get('ai', 'autonomy')} · {len(GROQ_MODELS)} known models")
        key_state = "key loaded" if (cfg.get("ai", "api_key") or "").strip() else "no key → offline mode"
        print(f"  {DIM}{key_state} · type /help for commands, /exit to leave{RESET}\n")

    history: list[dict] = []
    if args.prompt:  # one-shot
        sink = TerminalSink(stream_tokens=not args.no_stream, quiet=args.quiet, colour=colour)
        result = run_prompt(args.prompt, cfg, history, sink, mode=args.mode)
        if args.json:
            print(json.dumps({"ok": result.get("ok"), "mode": result.get("mode"),
                              "text": result.get("text"), "steps": result.get("steps"),
                              "usage": result.get("usage"), "error": result.get("error")}, indent=2))
        elif not sink.answer() and not args.quiet:
            print(f"{DIM}(no answer — model returned nothing){RESET}")
        return 0 if result.get("ok") else 1

    while True:
        try:
            line = input(f"{_colour(colour, GREEN)}thadd-ai ›{_colour(colour, RESET)} ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            return 0
        if not line:
            continue
        if line.startswith("/"):
            verb, _, rest = line[1:].partition(" ")
            rest = rest.strip()
            if verb in ("exit", "quit", "q"):
                return 0
            if verb in ("help", "?"):
                print(textwrap.dedent("""
                  /help              this list
                  /model [name]      show or switch the model
                  /autonomy [mode]   readonly | confirm | autopilot
                  /tools             what the agent can actually do
                  /clear             forget this conversation
                  /doctor            environment + key report
                  /exit              leave
                """).strip())
                continue
            if verb == "model":
                if rest:
                    cfg.set("ai", "model", rest)
                    print(f"  model → {rest}")
                else:
                    print(f"  model: {args_model(cfg)}")
                continue
            if verb == "autonomy":
                if rest in ("readonly", "confirm", "autopilot"):
                    cfg.set("ai", "autonomy", rest)
                    os.environ["THADD_AI_AUTONOMY"] = rest
                    print(f"  autonomy → {rest}")
                else:
                    print(f"  autonomy: {cfg.get('ai', 'autonomy')} (readonly|confirm|autopilot)")
                continue
            if verb == "tools":
                from . import tools as toolmod

                for name in sorted(toolmod.TOOL_FUNCS):
                    star = "*" if name in toolmod.destructive_tools() else " "
                    print(f"  {star} {name}")
                print(f"  {DIM}* asks for approval in confirm mode{RESET}")
                continue
            if verb == "clear":
                history.clear()
                print("  conversation cleared")
                continue
            if verb == "doctor":
                cmd_doctor(args, cfg)
                continue
            print(f"  unknown command: /{verb} (try /help)")
            continue

        sink = TerminalSink(stream_tokens=not args.no_stream, quiet=args.quiet, colour=colour)
        result = run_prompt(line, cfg, history, sink, mode=args.mode)
        if sink.answer():
            history.append({"role": "user", "content": line})
            history.append({"role": "assistant", "content": sink.answer()})
            history = history[-24:]
        elif not args.quiet:
            print(f"{DIM}(no answer){RESET}")


def cmd_models(args, cfg: Config) -> int:
    from .groq import GROQ_MODELS

    current = args_model(cfg)
    for model in GROQ_MODELS:
        mark = "*" if model["id"] == current else " "
        print(f" {mark} {model['id']:<44} {model['label']}  ({model['tier']}, {model['ctx']} ctx)")
    print(f"\n  switch with: thadd-ai --model <id> \"...\"   or   /model <id> in a session")
    return 0


def cmd_doctor(args, cfg: Config) -> int:
    from . import tools as toolmod

    print(f"  THADD AI · {THADD_VERSION} “{THADD_CODENAME}”")
    print(f"  system        : {os_pretty_name()} · kernel {os.uname().release} · python {sys.version.split()[0]}")
    print(f"  config        : {cfg.path}")
    print(f"  data dir      : {data_dir()}")
    key = (cfg.get("ai", "api_key") or "").strip()
    print(f"  groq api key  : {'set (' + key[:6] + '…' + key[-4:] + ')' if len(key) > 12 else ('set' if key else 'not set')}")
    if not key:
        print("                  export GROQ_API_KEY=…  (offline local assistant is used without it)")
    print(f"  model         : {args_model(cfg)}")
    print(f"  autonomy      : {cfg.get('ai', 'autonomy')}  (readonly | confirm | autopilot)")
    print(f"  tools         : {len(toolmod.TOOL_FUNCS)} available, "
          f"{len(toolmod.destructive_tools())} ask for approval")
    audit = data_dir() / "agent-audit.jsonl"
    print(f"  audit log     : {audit}{'' if audit.exists() else ' (not written yet)'}")
    for probe, label in (("git", "git"), ("nmap", "nmap"), ("rea", "rea"),
                         ("node", "node"), ("python3", "python3"), ("ffmpeg", "ffmpeg")):
        path = _which(probe)
        print(f"  {label:<13} : {path or 'not installed'}")
    return 0


def _which(name: str) -> str:
    from shutil import which

    return which(name) or ""


def cmd_selftest(args, cfg: Config) -> int:
    """Offline, network-free proof that the assistant and its tools work."""
    import tempfile
    from pathlib import Path

    from . import tools as toolmod
    from .local import local_reply

    checks: list[tuple[str, bool, str]] = []

    def check(name: str, ok: bool, detail: str = "") -> None:
        checks.append((name, bool(ok), detail))

    check("config loads", isinstance(cfg.data, dict), str(cfg.path))
    check("tool registry populated", len(toolmod.TOOL_FUNCS) >= 20, f"{len(toolmod.TOOL_FUNCS)} tools")
    check("approval gate knows destructive tools", len(toolmod.destructive_tools()) >= 3,
          f"{len(toolmod.destructive_tools())} gated")
    check("tool schemas valid", all(isinstance(s, dict) and s.get("function", {}).get("name")
                                    for s in toolmod.TOOL_SCHEMAS),
          f"{len(toolmod.TOOL_SCHEMAS)} schemas")

    tmp = Path(tempfile.mkdtemp(prefix="thadd-ai-selftest-"))
    session = Session()
    ctx = {"ui": lambda *a: None, "audit": lambda *a: None, "session": session,
           "snapshot_hint": lambda *a: None, "approved": True}

    target = tmp / "note.txt"
    wrote = toolmod.execute("write_file", {"path": str(target), "content": "alpha\n"}, ctx)
    check("write_file", target.exists() and "alpha" in target.read_text(), str(wrote)[:120])
    read = toolmod.execute("read_file", {"path": str(target)}, ctx)
    check("read_file", "alpha" in json.dumps(read), str(read)[:120])
    edited = toolmod.execute("edit_file", {"path": str(target), "find": "alpha", "replace": "beta"}, ctx)
    check("edit_file", "beta" in target.read_text(), str(edited)[:120])
    listed = toolmod.execute("list_files", {"path": str(tmp)}, ctx)
    check("list_files", "note.txt" in json.dumps(listed), str(listed)[:120])
    found = toolmod.execute("search_files", {"query": "note.txt", "root": str(tmp)}, ctx)
    check("search_files", "note.txt" in json.dumps(found), str(found)[:120])
    hashed = toolmod.execute("hash_file", {"path": str(target)}, ctx)
    check("hash_file", len(json.dumps(hashed)) > 20, str(hashed)[:120])
    shell = toolmod.execute("shell_run", {"command": "echo thadd-ai-selftest"}, ctx)
    check("shell_run", "thadd-ai-selftest" in json.dumps(shell), str(shell)[:120])

    text, _actions = local_reply("what operating system is this", session)
    check("offline assistant answers", bool(text and len(text) > 20), text.splitlines()[0][:80] if text else "")
    from . import agent as agentmod

    check("system prompt builds", "THADD AI" in agentmod.system_prompt(cfg))

    failed = [name for name, ok, _ in checks if not ok]
    for name, ok, detail in checks:
        mark = f"{GREEN}✔{RESET}" if ok else f"{RED}✘{RESET}"
        print(f"  {mark} {name:<38} {DIM}{detail}{RESET}")
    print(f"  → {len(checks) - len(failed)}/{len(checks)} checks passed"
          f"{'' if not failed else ' — FAILED: ' + ', '.join(failed)}")
    return 1 if failed else 0


# ------------------------------------------------------------------------- main
def build_parser() -> argparse.ArgumentParser:
    ap = argparse.ArgumentParser(
        prog="thadd-ai",
        description="THADD OS AI assistant — reads, edits and runs things on this machine.",
        epilog='examples:  thadd-ai "free up 5 GB in /var"   thadd-ai selftest',
    )
    # no `choices=` here on purpose: a bare prompt ("thadd-ai free up /var")
    # has to work as well as an explicit subcommand, so the first positional is
    # classified after parsing instead of being rejected by argparse.
    ap.add_argument("command", nargs="?", default="chat")
    ap.add_argument("prompt", nargs="*", help="what you want done (or the question to ask)")
    ap.add_argument("--model", "-m", help="model id (default: the one in config.json)")
    ap.add_argument("--autonomy", choices=["readonly", "confirm", "autopilot"],
                    help="how much the agent may do without asking")
    ap.add_argument("--key", help="Groq API key for this run (or set GROQ_API_KEY)")
    ap.add_argument("--base-url", dest="base_url", help="OpenAI-compatible endpoint override")
    ap.add_argument("--mode", choices=["chat", "plan"], default="chat")
    ap.add_argument("--no-stream", action="store_true", help="print the answer once, not token by token")
    ap.add_argument("--json", action="store_true", help="machine-readable result (one-shot only)")
    ap.add_argument("--quiet", "-q", action="store_true")
    ap.add_argument("--version", action="version", version=f"THADD AI {THADD_VERSION} ({THADD_CODENAME})")
    return ap


COMMANDS = ("chat", "ask", "models", "doctor", "selftest", "tools")


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    if args.command not in COMMANDS:
        # `thadd-ai what is using my disk` == `thadd-ai chat "what is using my disk"`
        args.prompt = [args.command] + list(args.prompt or [])
        args.command = "chat"
    args.prompt = " ".join(args.prompt) if args.prompt else ""

    if args.command == "ask" and not args.prompt:
        build_parser().error("ask needs a question")

    cfg = _make_config(args)

    if not sys.stdout.isatty():
        args.no_stream = True

    if args.command in ("chat", "ask"):
        return cmd_chat(args, cfg)
    if args.command == "models":
        return cmd_models(args, cfg)
    if args.command == "doctor":
        return cmd_doctor(args, cfg)
    if args.command == "selftest":
        return cmd_selftest(args, cfg)
    if args.command == "tools":
        from . import tools as toolmod

        for name in sorted(toolmod.TOOL_FUNCS):
            print(name)
        return 0
    build_parser().print_help()
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
