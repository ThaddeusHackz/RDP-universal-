"""THADD OS — the AI agent loop.

Turns a natural-language request into real actions on the machine:

    user → model → tool calls → execution (with approval when needed) → answer

Design goals
------------
* **Streaming** — every token and every tool step reaches the UI immediately.
* **Auditable** — each executed tool is appended to ``agent-audit.jsonl`` and
  surfaced in the shell's AI activity feed.
* **Reversible** — mutating tools can trigger an automatic snapshot first.
* **Safe** — an autonomy dial (read-only / confirm / autopilot) plus a hard block
  list for system-destroying commands.
"""

from __future__ import annotations

import json
import os
import platform
import threading
import time
import uuid
from pathlib import Path

from ..config import Config, data_dir, os_pretty_name
from ..core import BUS, Stream
from .groq import GROQ_MODELS, GroqClient, GroqError
from . import tools as toolmod

MAX_STEPS = 8
AUDIT_FILE = "agent-audit.jsonl"


# --------------------------------------------------------------------------- prompt
BASE_PROMPT = """You are THADD AI — the built-in operating-system agent of THADD OS \
"THADD_OS" {version} ({codename}). You are not a chatbot bolted onto a browser: you run \
inside the OS with real tools that act on this machine.

Personality: elite, calm, precise. You are a brilliant sysadmin, security engineer, \
reverse-engineer and developer in one. You explain briefly, act decisively, and never \
invent results — you call tools to find things out.

Capabilities you truly have (via tools):
  • files & folders: list, read, write, edit, search, move, copy, trash, disk usage
  • shell: run any command (gcc, git, apt, nmap, metasploit, ffmpeg, python, node, pwsh…)
  • system: metrics, processes, kill, services, logs, hostname, package install
  • security: posture scan, malware/rootkit/audit scans, file hashing, reverse-engineering
    and forensic analysis of any file or disk image
  • desktop: open apps, control windows, notifications, appearance/theme, clipboard,
    screenshots, and full GUI automation (mouse + keyboard)
  • safety: create/restore snapshots, manage services, install software

Operating rules:
  1. Prefer doing over asking — but never take an irreversible action without approval
     when the autonomy mode requires it.
  2. Before large edits to user files, call create_snapshot.
  3. Never claim something is installed or fixed without checking (use list_tools,
     system_info, shell_run with `command -v`).
  4. When you fix something, verify the fix and show the evidence.
  5. Keep answers tight: short paragraphs, code blocks for commands, no filler.
  6. If a tool fails, read the error, adapt, retry with a different approach.
  7. Answer in the user's language; use Markdown.

Environment right now:
{env}
"""


def environment_brief() -> str:
    from ..api import system as sysapi

    try:
        info = sysapi.cmd_info()
    except Exception:
        info = {}
    groups = (info.get("tools") or {})
    tool_line = ", ".join(f"{k}: {len(v)}" for k, v in groups.items() if v)
    return (
        f"  host: {platform.node()} • {os_pretty_name()} • kernel {platform.release()} • {platform.machine()}\n"
        f"  virtualization: {(info.get('os') or {}).get('virtualization', 'unknown')} • "
        f"live-ISO: {(info.get('os') or {}).get('live', False)}\n"
        f"  cpu: {(info.get('cpu') or {}).get('model', '?')} ({(info.get('cpu') or {}).get('cores', '?')} cores)\n"
        f"  memory: {round(((info.get('memory') or {}).get('total', 0)) / 1e9, 1)} GB total, "
        f"{round(((info.get('memory') or {}).get('available', 0)) / 1e9, 1)} GB free\n"
        f"  user: {os.environ.get('USER', 'thadd')} • cwd: {os.getcwd()} • autonomy: {Config().get('ai', 'autonomy')}\n"
        f"  installed tool groups: {tool_line or 'unknown'}\n"
    )


def system_prompt(cfg: Config | None = None) -> str:
    cfg = cfg or Config()
    prompt = BASE_PROMPT.format(version="1.0", codename="Nebula Prime", env=environment_brief())
    extra = (cfg.get("ai", "system_prompt") or "").strip()
    if extra:
        prompt += f"\nAdditional user instructions (highest priority):\n{extra}\n"
    return prompt


# -------------------------------------------------------------------------- approval
class Approval:
    def __init__(self, tool: str, args: dict, reason: str = ""):
        self.id = uuid.uuid4().hex[:12]
        self.tool = tool
        self.args = args
        self.reason = reason
        self.event = threading.Event()
        self.allowed = False
        self.created = time.time()

    def to_json(self) -> dict:
        return {"id": self.id, "tool": self.tool, "args": _trim(self.args, 1200), "reason": self.reason}


_PENDING: dict[str, Approval] = {}
_PENDING_LOCK = threading.Lock()


def resolve_approval(approval_id: str, allow: bool) -> bool:
    with _PENDING_LOCK:
        ap = _PENDING.pop(approval_id, None)
    if not ap:
        return False
    ap.allowed = bool(allow)
    ap.event.set()
    return True


def pending_approvals() -> list[dict]:
    with _PENDING_LOCK:
        return [a.to_json() for a in _PENDING.values()]


def _request_approval(session, stream: Stream | None, tool: str, args: dict, reason: str) -> bool:
    ap = Approval(tool, args, reason)
    with _PENDING_LOCK:
        _PENDING[ap.id] = ap
    payload = {"type": "approval_request", **ap.to_json()}
    if stream:
        stream.push(json.dumps(payload) + "\n")
    session.emit("ai.approval", ap.to_json())
    if not ap.event.wait(timeout=120):
        with _PENDING_LOCK:
            _PENDING.pop(ap.id, None)
        return False
    audit("approval", f"{tool} {'allowed' if ap.allowed else 'denied'}", 0 if ap.allowed else 1)
    return ap.allowed


# --------------------------------------------------------------------------- audit
def audit(action: str, detail: str, code: int | None = None) -> None:
    entry = {"ts": time.time(), "iso": time.strftime("%Y-%m-%dT%H:%M:%S"), "action": action,
             "detail": str(detail)[:2000], "code": code}
    try:
        path = data_dir() / AUDIT_FILE
        with path.open("a") as fh:
            fh.write(json.dumps(entry) + "\n")
    except OSError:
        pass
    BUS.publish("ai.audit", entry)


def audit_tail(limit: int = 100) -> list[dict]:
    path = data_dir() / AUDIT_FILE
    if not path.exists():
        return []
    try:
        lines = path.read_text(errors="replace").splitlines()[-limit:]
    except OSError:
        return []
    out = []
    for line in lines:
        try:
            out.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return out


# ----------------------------------------------------------------------- the agent
class AgentRun:
    def __init__(self, session, messages: list[dict], model: str = "", cfg: Config | None = None,
                 stream: Stream | None = None, ui_hook=None):
        self.session = session
        self.cfg = cfg or Config()
        self.client = GroqClient(self.cfg.get("ai", "api_key") or "")
        self.model = model or self.cfg.get("ai", "model") or "llama-3.3-70b-versatile"
        self.stream = stream
        self.ui_hook = ui_hook or (lambda event, data: session.emit(event, data))
        self.messages = messages
        self.steps = 0
        self.usage_total: dict = {}
        self.ctx = {
            "ui": self.ui_hook,
            "audit": audit,
            "session": session,
            "snapshot_hint": self._snapshot_hint,
            "approved": False,
        }
        self._snap_done = False

    # ------------------------------------------------------------------ helpers
    def _emit(self, obj: dict) -> None:
        if self.stream:
            self.stream.push(json.dumps(obj, default=str) + "\n")

    def _snapshot_hint(self, paths: list[str]) -> None:
        """Auto-snapshot before the first mutating write (configurable)."""
        if self._snap_done or not self.cfg.get("snapshots", "auto_before_ai_write", True):
            return
        if (self.cfg.get("ai", "autonomy") or "confirm") == "readonly":
            return
        try:
            from ..api import snapshots as snapapi

            info = snapapi.cmd_create(None, label="before AI edit: " + ", ".join(Path(p).name for p in paths[:3]),
                                      paths=paths)
            self._snap_done = True
            self._emit({"type": "snapshot", "snapshot": info.get("id", ""), "label": info.get("label", "")})
        except Exception:
            pass

    def _autonomy(self) -> str:
        return str(self.cfg.get("ai", "autonomy") or "confirm")

    def _execute_tool(self, name: str, args: dict) -> dict:
        destructive = name in toolmod.destructive_tools()
        autonomy = self._autonomy()
        self._emit({"type": "tool_call", "tool": name, "args": _trim(args, 2000)})
        if autonomy == "readonly" and destructive:
            audit("denied", f"{name} {_short(args)} (readonly)")
            result = {"error": "agent is in read-only mode; ask the user to switch to Confirm or Autopilot"}
            self._emit({"type": "tool_result", "tool": name, "ok": False, "result": result})
            return result
        if destructive and autonomy != "autopilot":
            allowed = _request_approval(self.session, self.stream, name, args, "This tool changes your system")
            if not allowed:
                result = {"denied": True, "note": "user declined; suggest an alternative or ask what to do"}
                self._emit({"type": "tool_result", "tool": name, "ok": False, "result": result})
                audit("denied", f"{name} {_short(args)}")
                return result
        started = time.time()
        result = toolmod.execute(name, args, self.ctx)
        ok = not result.get("error") and not result.get("blocked")
        audit(name, _short(args), 0 if ok else 1)
        self._emit({
            "type": "tool_result", "tool": name, "ok": ok,
            "preview": _trim(result, 600), "elapsed": round(time.time() - started, 2),
        })
        return result

    # --------------------------------------------------------------------- run
    def run(self) -> dict:
        cfg = self.cfg
        max_steps = max(1, min(int(cfg.get("ai", "max_steps", MAX_STEPS)), 20))
        temperature = float(cfg.get("ai", "temperature", 0.4))
        max_tokens = int(cfg.get("ai", "max_tokens", 2048))
        try:
            for step in range(max_steps):
                self.steps = step + 1
                self._emit({"type": "step", "step": self.steps, "model": self.model})
                msg = self.client.chat(
                    messages=self.messages,
                    tools=toolmod.TOOL_SCHEMAS,
                    model=self.model,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    stream=bool(cfg.get("ai", "stream", True)),
                    on_token=lambda piece: self._emit({"type": "token", "text": piece}),
                    stop=lambda: self.stream._stop.is_set() if self.stream else False,
                )
                usage = msg.pop("_usage", {}) or {}
                used_model = msg.pop("_model", self.model)
                for k, v in usage.items():
                    if isinstance(v, int):
                        self.usage_total[k] = self.usage_total.get(k, 0) + v
                self.messages.append(msg)
                calls = msg.get("tool_calls") or []
                if not calls:
                    break
                for call in calls:
                    fn = (call.get("function") or {})
                    name = fn.get("name") or ""
                    raw_args = fn.get("arguments") or "{}"
                    try:
                        args = json.loads(raw_args) if raw_args.strip() else {}
                    except json.JSONDecodeError:
                        args = {}
                        result = {"error": f"invalid JSON arguments: {raw_args[:200]}"}
                        self._emit({"type": "tool_result", "tool": name, "ok": False, "result": result})
                    else:
                        result = self._execute_tool(name, args)
                    self.messages.append({
                        "role": "tool",
                        "tool_call_id": call.get("id") or name,
                        "name": name,
                        "content": json.dumps(result, default=str)[:24000],
                    })
            self._emit({"type": "done", "model": self.model, "usage": self.usage_total, "steps": self.steps})
            return {"model": self.model, "steps": self.steps, "usage": self.usage_total,
                    "messages": self.messages, "ok": True}
        except GroqError as exc:
            self._emit({"type": "error", "message": str(exc), "status": exc.status})
            return {"ok": False, "error": str(exc), "status": exc.status, "model": self.model}
        except Exception as exc:  # pragma: no cover
            self._emit({"type": "error", "message": f"{type(exc).__name__}: {exc}"})
            return {"ok": False, "error": str(exc), "model": self.model}


def _trim(obj, limit: int):
    try:
        txt = json.dumps(obj, default=str)
    except Exception:
        txt = str(obj)
    if len(txt) <= limit:
        return obj
    return txt[:limit] + "…"


def _short(args: dict) -> str:
    parts = []
    for k, v in list(args.items())[:4]:
        parts.append(f"{k}={str(v)[:60]}")
    return ", ".join(parts)


# ------------------------------------------------------------------- chat entry
def start_chat(session, prompt: str, history: list[dict] | None = None, model: str = "", stream_id: str = "",
               mode: str = "chat") -> dict:
    """Kick off an agent run and stream the result to the shell."""
    cfg = Config()
    sid = stream_id or f"ai-{uuid.uuid4().hex[:8]}"
    messages: list[dict] = [{"role": "system", "content": system_prompt(cfg)}]
    if mode == "plan":
        messages.append({"role": "system", "content": "Produce a numbered plan first; ask before executing anything that changes the system."})
    for item in (history or [])[-24:]:
        role = item.get("role")
        content = item.get("content")
        if role in ("user", "assistant") and content:
            messages.append({"role": role, "content": str(content)[:16000]})
    messages.append({"role": "user", "content": prompt})

    # offline fallback: no key or network → local rule-based assistant
    if not (cfg.get("ai", "api_key") or "").strip():
        from .local import local_reply

        def producer(stream: Stream) -> None:
            stream.meta = {"mode": "local"}
            text, actions = local_reply(prompt, session)
            for chunk in _chunks(text, 24):
                stream.push(json.dumps({"type": "token", "text": chunk}) + "\n")
                time.sleep(0.02)
            for act in actions:
                stream.push(json.dumps({"type": "tool_call", "tool": act["tool"], "args": act.get("args", {})}) + "\n")
                stream.push(json.dumps({"type": "tool_result", "tool": act["tool"], "ok": True,
                                        "preview": _trim(act.get("result", {}), 400)}) + "\n")
            stream.push(json.dumps({"type": "done", "model": "thadd-local", "usage": {}, "mode": "local"}) + "\n")

        Stream(session, sid, producer).start()
        return {"stream_id": sid, "mode": "local", "model": "thadd-local"}

    def producer(stream: Stream) -> None:
        run = AgentRun(session, messages, model=model, cfg=cfg, stream=stream)
        result = run.run()
        stream.meta = {"model": result.get("model"), "steps": result.get("steps"), "ok": result.get("ok")}
        if result.get("ok"):
            save_conversation(prompt, result.get("messages", []))

    Stream(session, sid, producer).start()
    return {"stream_id": sid, "mode": "agent", "model": model or cfg.get("ai", "model")}


def _chunks(text: str, size: int):
    for i in range(0, len(text), size):
        yield text[i : i + size]


# ------------------------------------------------------------------- conversations
def conversations_dir() -> Path:
    d = data_dir() / "conversations"
    d.mkdir(parents=True, exist_ok=True)
    return d


def save_conversation(title: str, messages: list[dict]) -> dict:
    cid = uuid.uuid4().hex[:10]
    record = {"id": cid, "title": title[:80], "created": time.time(),
              "messages": [m for m in messages if m.get("role") in ("user", "assistant") and m.get("content")][-40:]}
    try:
        (conversations_dir() / f"{cid}.json").write_text(json.dumps(record))
    except OSError:
        pass
    BUS.publish("ai.conversation", {"id": cid, "title": record["title"]})
    return {"id": cid, "title": record["title"]}


def list_conversations(limit: int = 40) -> list[dict]:
    items = []
    for path in sorted(conversations_dir().glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True)[:limit]:
        try:
            data = json.loads(path.read_text())
            items.append({"id": data.get("id"), "title": data.get("title"), "created": data.get("created"),
                          "turns": len(data.get("messages", []))})
        except Exception:
            continue
    return items


def load_conversation(cid: str) -> dict:
    safe = "".join(ch for ch in cid if ch.isalnum() or ch in "-_")
    path = conversations_dir() / f"{safe}.json"
    if not path.exists():
        return {"messages": []}
    return json.loads(path.read_text())


def delete_conversation(cid: str) -> dict:
    safe = "".join(ch for ch in cid if ch.isalnum() or ch in "-_")
    path = conversations_dir() / f"{safe}.json"
    if path.exists():
        path.unlink()
    return {"deleted": cid}


# ------------------------------------------------------------------- preset tasks
PRESETS = {
    "fix_system": "Diagnose this THADD OS machine and fix what you can: check failed services, disk space, "
                  "memory pressure, network, package problems and permissions. Use tools, then report what you found and fixed.",
    "review_code": "Review the code in this project for bugs, security holes and performance problems. "
                   "Read the actual files first, then give a prioritised list with concrete patches.",
    "optimize": "Make this machine faster: analyse running processes, startup services and resource usage, "
                "then apply safe optimisations and show the before/after numbers.",
    "harden": "Run a security hardening pass: check the firewall, sysctls, open ports, users, sudo rules and "
              "services, then apply safe hardening and produce a short report.",
    "forensics": "Forensic triage of this machine: timeline of recent file changes, suspicious processes, "
                 "listening sockets, autostart entries and integrity of key binaries. Produce an evidence report.",
    "explain_repo": "Explain this repository: purpose, architecture, main components and how to build it. "
                    "Read the tree and key files first.",
    "learn": "Teach me something useful about this system right now, with real commands I can run.",
}
