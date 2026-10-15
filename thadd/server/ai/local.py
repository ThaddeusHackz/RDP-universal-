"""THADD OS — offline assistant ("THADD Local").

When no Groq API key is configured (or there is no network) the assistant still
works: this module understands the most useful OS requests and executes them
through the same tool layer the cloud agent uses.  It is deliberately tiny and
deterministic — it never pretends to be a language model.
"""

from __future__ import annotations

import re
import shutil
from pathlib import Path

HELP = """THADD Local (offline assistant)
I have no Groq API key yet, so I am running in offline mode. I can still do real work:

  • list files in <folder>            • read <file>            • what is using my disk
  • running processes / cpu / memory  • open <app>             • create a snapshot
  • security check                    • scan for rootkits      • hash <file>
  • analyse <file>  (reverse engineering / forensics)
  • run <command>                     • which tools are installed

Add your Groq API key in **Settings → AI** (or export GROQ_API_KEY) and I unlock the
full agent: multi-step reasoning, code writing, autonomous PC automation and more.
"""


def local_reply(prompt: str, session) -> tuple[str, list[dict]]:
    """Use the same approval/audit/tool boundary as the cloud agent."""
    try:
        return _local_reply(prompt, session)
    except LocalToolError as exc:
        return f"Action not completed: {exc}", []


class LocalToolError(RuntimeError):
    pass


def _local_reply(prompt: str, session) -> tuple[str, list[dict]]:
    """Return ``(markdown_text, executed_actions)``."""
    text = (prompt or "").strip()
    low = text.lower()
    actions: list[dict] = []

    from .agent import AgentRun

    executor = AgentRun(session, [])

    def run(tool: str, fn=None, **args):
        # fn is retained for the read helpers below, but execution must go
        # through the shared gate, never directly to an API or subprocess.
        result = executor._execute_tool(tool, args)
        if result.get("error") or result.get("denied") or result.get("blocked"):
            raise LocalToolError(result.get("error") or result.get("reason") or result.get("note") or "denied")
        actions.append({"tool": tool, "args": args, "result": result})
        return result

    if not text or low in ("help", "?", "hi", "hello", "hey"):
        return HELP, actions

    # ---------------------------------------------------------------- file reads
    m = re.search(r"(?:list|show|ls|what'?s in)\s+(?:files?\s+)?(?:in\s+)?([~./\w@-]+)?", low)
    if low.startswith(("ls", "list")) or "list files" in low or "what's in" in low:
        path = (m.group(1) if m and m.group(1) else "~") if m else "~"
        from ..api import fs as fsapi

        res = run("list_files", fsapi.cmd_fs_list, path=path)
        lines = [f"**{res['path']}** — {res['count']} entries, {_human(res['total_size'])} total\n"]
        for e in res["entries"][:40]:
            icon = "📁" if e["dir"] else "📄"
            lines.append(f"{icon} `{e['name']}`  {'' if e['dir'] else _human(e['size'])}")
        return "\n".join(lines), actions

    m = re.search(r"(?:read|cat|show me|open)\s+([~./\w@.-]+\.\w{1,8})", text, re.I)
    if m and any(low.startswith(v) for v in ("read", "cat", "show")):
        from ..api import fs as fsapi

        res = run("read_file", fsapi.cmd_fs_read, path=m.group(1))
        if res.get("binary"):
            return f"`{res['path']}` is binary ({_human(res.get('size', 0))}). Try `analyse {m.group(1)}` for a full reverse-engineering report.", actions
        body = res.get("text", "")[:4000]
        return f"**{res['path']}** ({_human(res.get('size', 0))})\n\n```\n{body}\n```", actions

    # ------------------------------------------------------------------ system
    if any(k in low for k in ("cpu", "memory", "ram", "load", "usage", "disk space", "how fast")):
        from ..api import system as sysapi

        met = run("system_metrics", sysapi.cmd_metrics)
        disk = "\n".join(f"  {d['mount']}: {_human(d['used'])} / {_human(d['total'])} ({d['percent']}%)" for d in met["disk"][:5])
        return (
            f"**Live system load**\n\n"
            f"  CPU: {met['cpu']['percent']}% over {len(met['cpu']['cores'])} cores  (load {', '.join(str(x) for x in met['cpu']['load'])})\n"
            f"  RAM: {_human(met['memory']['used'])} / {_human(met['memory']['total'])} ({met['memory']['percent']}%)\n"
            f"  Processes: {met['processes']}   Temp: {met['cpu']['temp'] or 'n/a'}\n\n**Filesystems**\n{disk}"
        ), actions

    if "process" in low:
        from ..api import system as sysapi

        res = run("list_processes", sysapi.cmd_processes, limit=15)
        rows = "\n".join(f"  {p['pid']:>6}  {p['name'][:24]:<24} {p['cpu_time']:>8.2f}s  {_human(p['mem'])}  {p['user']}" for p in res["processes"][:15])
        return f"**Top processes** (by CPU time)\n\n```\n{'PID':>6}  {'NAME':<24} {'CPU':>8}  {'MEM':<9}  USER\n{rows}\n```", actions

    if "tool" in low and any(k in low for k in ("install", "which", "available", "have")):
        from ..api import system as sysapi

        res = run("list_tools", sysapi.cmd_tools)
        parts = [f"**{g}** ({len(v)}): {', '.join(v[:14])}" for g, v in res["groups"].items() if v]
        return "Tools present on this machine:\n\n" + "\n\n".join(parts), actions

    # ----------------------------------------------------------------- security
    if any(k in low for k in ("security", "harden", "firewall", "audit")):
        from ..api import security as secapi

        res = run("security_posture", secapi.cmd_posture)
        findings = "\n".join(f"  {'✔' if f['ok'] else '✘'} {f['title']} — {f['detail']}" for f in res.get("findings", []))
        return f"**Security posture: {res.get('score', 0)}/100 ({res.get('grade', '?')})**\n\n{findings}", actions

    if "rootkit" in low or "malware" in low or "virus" in low:
        from ..api import security as secapi

        res = run("security_scan", secapi.cmd_scan, kind="rootkit" if "rootkit" in low else "quick")
        return f"Started **{res.get('kind')}** scan — {res.get('note', '')}\n\n```\n{res.get('output', '')[:3000]}\n```", actions

    m = re.search(r"hash\s+([~./\w@.-]+)", text, re.I)
    if m:
        from ..api import security as secapi

        res = run("hash_file", secapi.cmd_hash, path=m.group(1))
        return f"**{res['path']}**\n\n  sha256: `{res.get('sha256')}`\n  md5:    `{res.get('md5')}`\n  size:   {_human(res.get('size', 0))}", actions

    m = re.search(r"(?:analyse|analyze|reverse|forensic)\s+([~./\w@.-]+)", text, re.I)
    if m:
        from ..api import security as secapi

        res = run("forensics_analyze", secapi.cmd_analyze, path=m.group(1))
        return _format_analysis(res), actions

    # ------------------------------------------------------------------ actions
    m = re.search(r"open\s+(\w+)", low)
    if m:
        app = m.group(1)
        run("open_app", app=app)
        return f"Requested **{app}**; a running graphical shell is required.", actions

    if "snapshot" in low and ("create" in low or "make" in low or "take" in low):
        from ..api import snapshots as snapapi

        res = run("create_snapshot", snapapi.cmd_create, label="offline request")
        return f"Snapshot `{res.get('id')}` created ({res.get('files', 0)} files, {_human(res.get('bytes', 0))}).", actions

    if low.startswith("run ") or low.startswith("exec ") or low.startswith("$ "):
        cmd = text.split(" ", 1)[1] if " " in text else ""
        out = run("shell_run", command=cmd, timeout=120)
        return f"`$ {cmd}`\n\n```\n{(out.get('stdout') or out.get('stderr') or '')[:4000]}\n```", actions

    # ------------------------------------------------------------------ fallback
    return (
        f"I am in **offline mode** right now, so I cannot reason through “{text[:120]}”.\n\n"
        "I *can* run real actions for you — try:\n"
        "  `list files in ~/Projects` · `what is using my disk` · `security check` · "
        "`analyse /bin/ls` · `run uname -a` · `hash ~/Downloads/file.iso`\n\n"
        "Or add a Groq API key in **Settings → AI → Groq API key** to unlock the full agent "
        f"(cloud reasoning, multi-step tool use, PC automation).\n\n{HELP}"
    ), actions


def _format_analysis(res: dict) -> str:
    if res.get("error"):
        return f"Analysis failed: {res['error']}"
    lines = [f"**Reverse-engineering report — `{res.get('path')}`**", ""]
    lines.append(f"  type:        {res.get('filetype', '?')}")
    lines.append(f"  size:        {_human(res.get('size', 0))}")
    lines.append(f"  entropy:     {res.get('entropy', '?')} / 8.0  ({res.get('entropy_verdict', '')})")
    lines.append(f"  sha256:      `{res.get('sha256', '')[:32]}…`")
    if res.get("hashes"):
        for algo, value in list(res["hashes"].items())[:3]:
            lines.append(f"  {algo:<12} {value[:40]}…")
    if res.get("sections"):
        lines.append("\n  sections/segments:")
        for sec in res["sections"][:12]:
            lines.append(f"    {sec}")
    if res.get("indicators"):
        lines.append("\n  indicators:")
        for ind in res["indicators"][:12]:
            lines.append(f"    • {ind}")
    if res.get("embedded"):
        lines.append("\n  embedded signatures: " + ", ".join(res["embedded"][:10]))
    if res.get("strings"):
        lines.append("\n  interesting strings:")
        for s in res["strings"][:12]:
            lines.append(f"    `{s}`")
    if res.get("notes"):
        lines.append("\n  notes: " + "; ".join(res["notes"]))
    return "\n".join(lines)


def _human(n) -> str:
    try:
        n = float(n)
    except (TypeError, ValueError):
        return str(n)
    for unit in ("B", "KB", "MB", "GB", "TB"):
        if abs(n) < 1024 or unit == "TB":
            return f"{n:.0f} {unit}" if unit == "B" else f"{n:.1f} {unit}"
        n /= 1024
    return f"{n:.1f} TB"


def have(cmd: str) -> bool:
    return shutil.which(cmd) is not None


def fonts_available() -> bool:
    return Path("/usr/share/fonts").is_dir()
