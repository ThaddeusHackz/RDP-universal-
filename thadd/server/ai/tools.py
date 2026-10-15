"""THADD OS — the AI agent's toolbelt.

Every tool is a *real* capability of the running system: files, processes, the
package manager, the security suite, snapshots, the desktop shell, and GUI
automation (mouse/keyboard).  Tools are described once, in OpenAI/Groq
function-calling format, and executed by :func:`execute`.
"""

from __future__ import annotations

import json
import os
import platform
import re
import shutil
import subprocess
import time
from pathlib import Path

from ..config import Config, data_dir
from ..core import RpcError

# --------------------------------------------------------------------- schemas
TOOL_SCHEMAS: list[dict] = []


def tool(name: str, description: str, params: dict | None = None, required: list[str] | None = None,
         destructive: bool = False):
    props = {}
    for pname, spec in (params or {}).items():
        props[pname] = spec
    schema = {"type": "object", "properties": props, "required": required or []}

    def deco(fn):
        TOOL_SCHEMAS.append({
            "type": "function",
            "function": {"name": name, "description": description, "parameters": schema},
        })
        fn._thadd_tool = name
        fn._destructive = destructive
        return fn

    return deco


S = lambda desc, **kw: {"type": "string", "description": desc, **kw}          # noqa: E731
N = lambda desc, **kw: {"type": "integer", "description": desc, **kw}         # noqa: E731
B = lambda desc, **kw: {"type": "boolean", "description": desc, **kw}         # noqa: E731
A = lambda desc, **kw: {"type": "array", "items": {"type": "string"}, "description": desc, **kw}  # noqa: E731


# ------------------------------------------------------------------ system tools
@tool("system_info", "Full hardware/OS report: CPU, memory, GPU, disks, network, installed tool groups.")
def t_system_info(args, ctx):
    from ..api import system as sysapi

    return sysapi.cmd_info(None)


@tool("system_metrics", "Live CPU load, memory, network, temperature and disk numbers.")
def t_metrics(args, ctx):
    from ..api import system as sysapi

    return sysapi.cmd_metrics(None)


@tool("list_processes", "List running processes, highest load first.", {"sort": S("cpu or mem")})
def t_processes(args, ctx):
    from ..api import system as sysapi

    return sysapi.cmd_processes(None, sort=args.get("sort", "cpu"), limit=40)


@tool("kill_process", "Terminate a process by PID.", {"pid": N("process id"), "signal": S("TERM, KILL, STOP, CONT")},
      required=["pid"], destructive=True)
def t_kill(args, ctx):
    from ..api import system as sysapi

    return sysapi.cmd_kill(None, pid=int(args["pid"]), signal=args.get("signal", "TERM"))


@tool("read_logs", "Read the newest system journal / log lines.", {"lines": N("how many lines (default 80)"), "unit": S("optional systemd unit")})
def t_logs(args, ctx):
    from ..api import system as sysapi

    return sysapi.cmd_logs(None, unit=args.get("unit", ""), lines=int(args.get("lines", 80)))


# ------------------------------------------------------------------- file tools
@tool("list_files", "List a directory.", {"path": S("directory path, ~ allowed"), "show_hidden": B("include dotfiles")},
      required=["path"])
def t_ls(args, ctx):
    from ..api import fs as fsapi

    return fsapi.cmd_fs_list(None, path=args["path"], show_hidden=bool(args.get("show_hidden")))


@tool("read_file", "Read a text file (up to ~200 KB).", {"path": S("file path")}, required=["path"])
def t_read(args, ctx):
    from ..api import fs as fsapi

    res = fsapi.cmd_fs_read(None, path=args["path"], max_bytes=200000)
    if res.get("binary"):
        return {"path": res["path"], "binary": True, "size": res.get("size", 0),
                "note": "binary file — use shell_run with `file`/`xxd` to inspect"}
    return {"path": res["path"], "size": res.get("size", 0), "text": res.get("text", "")[:200000]}


@tool("write_file", "Create or overwrite a file with new content.", {"path": S("file path"), "content": S("full new content")},
      required=["path", "content"], destructive=True)
def t_write(args, ctx):
    from ..api import fs as fsapi

    ctx["snapshot_hint"]([args["path"]])
    return fsapi.cmd_fs_write(None, path=args["path"], text=args["content"])


@tool("edit_file", "Replace the first occurrence of a snippet inside a file (precise, safe edits).",
      {"path": S("file path"), "find": S("exact text to find"), "replace": S("replacement text")},
      required=["path", "find", "replace"], destructive=True)
def t_edit(args, ctx):
    from ..api import fs as fsapi

    res = fsapi.cmd_fs_read(None, path=args["path"], max_bytes=8 * 1024 * 1024)
    if res.get("binary"):
        raise RpcError("refusing to edit a binary file", "bad_value")
    text = res.get("text", "")
    needle = args["find"]
    if needle not in text:
        raise RpcError("snippet not found — read the file again", "not_found")
    ctx["snapshot_hint"]([args["path"]])
    new = text.replace(needle, args["replace"], 1)
    out = fsapi.cmd_fs_write(None, path=args["path"], text=new)
    return {**out, "replaced": 1}


@tool("search_files", "Search for files by name (optionally inside contents).",
      {"query": S("text to look for"), "root": S("directory to search (default ~)"), "content": B("search inside file contents")},
      required=["query"])
def t_search(args, ctx):
    from ..api import fs as fsapi

    return fsapi.cmd_fs_search(None, root=args.get("root") or "~", query=args["query"],
                              content=bool(args.get("content")), limit=60)


@tool("move_path", "Move or rename a file/directory.", {"path": S("source"), "dest": S("destination")},
      required=["path", "dest"], destructive=True)
def t_move(args, ctx):
    from ..api import fs as fsapi

    ctx["snapshot_hint"]([args["path"]])
    return fsapi.cmd_fs_copy(None, path=args["path"], dest=args["dest"], move=True)


@tool("copy_path", "Copy a file/directory.", {"path": S("source"), "dest": S("destination")}, required=["path", "dest"], destructive=True)
def t_copy(args, ctx):
    from ..api import fs as fsapi

    return fsapi.cmd_fs_copy(None, path=args["path"], dest=args["dest"])


@tool("trash_path", "Move a file/directory to the recoverable THADD trash.", {"path": S("path to trash")},
      required=["path"], destructive=True)
def t_trash(args, ctx):
    from ..api import fs as fsapi

    return fsapi.cmd_fs_trash(None, path=args["path"])


@tool("disk_usage", "Show what is consuming disk space inside a folder.", {"path": S("folder (default ~)")})
def t_usage(args, ctx):
    from ..api import fs as fsapi

    return fsapi.cmd_fs_usage(None, path=args.get("path") or "~")


# ------------------------------------------------------------------ shell tools
@tool("shell_run", "Run a shell command and capture output. Use for git, apt, compilers, security tools, service control.",
      {"command": S("command line"), "cwd": S("working directory"), "timeout": N("seconds, default 60")},
      required=["command"], destructive=True)
def t_shell(args, ctx):
    from ..api import term as termapi

    cmd = args["command"].strip()
    blocked = _hard_block(cmd)
    if blocked:
        return {"blocked": True, "reason": blocked, "code": 126, "stdout": "", "stderr": blocked}
    res = termapi.cmd_term_exec(None, cmd=cmd, timeout=float(args.get("timeout", 60)), cwd=args.get("cwd", ""))
    ctx["audit"]("shell_run", cmd, res.get("code"))
    return res


def _hard_block(cmd: str) -> str:
    """Irreversible, system-destroying commands are refused even in autopilot."""
    patterns = [
        (r"rm\s+(-[a-zA-Z]*\s+)*/(\s|$)", "refusing to recursively delete /"),
        (r"mkfs(\.\w+)?\s+/dev/(sd|nvme|vd|hd)a?\b", "refusing to format a system disk"),
        (r"dd\s+.*of=/dev/(sd|nvme|vd|hd)a\b", "refusing to overwrite a raw system disk"),
        (r":\(\)\s*\{\s*:\|\s*:&\s*\}\s*;\s*:", "fork bomb blocked"),
        (r"chmod\s+-R\s+000\s+/(\s|$)", "refusing to brick permissions on /"),
        (r">\s*/dev/sda", "refusing to write raw to a disk"),
        (r"mv\s+/\s+", "refusing to move /"),
    ]
    for pat, why in patterns:
        if re.search(pat, cmd):
            return why
    return ""


@tool("run_python", "Execute Python code in a subprocess and return stdout.", {"code": S("python source")}, required=["code"], destructive=True)
def t_python(args, ctx):
    code = args["code"]
    if len(code) > 60000:
        raise RpcError("script too long", "bad_value")
    tmp = data_dir() / "ai-scratch.py"
    tmp.write_text(code)
    proc = subprocess.run(["/usr/bin/env", "python3", str(tmp)], capture_output=True, text=True, timeout=120)
    ctx["audit"]("run_python", code[:200], proc.returncode)
    return {"code": proc.returncode, "stdout": proc.stdout[-40000:], "stderr": proc.stderr[-8000:]}


# ----------------------------------------------------------------- desktop tools
@tool("open_app", "Open a GUI app in the THADD desktop shell (files, terminal, settings, ai, security, taskmgr, snapshots, recorder, editor, browser, store, welcome, powershell, wine, notes, calculator, calendar, monitor).",
      {"app": S("app id"), "args": S("optional payload (path, url, text)")}, required=["app"])
def t_open_app(args, ctx):
    ctx["ui"]("shell.launch", {"app": args["app"], "args": args.get("args", "")})
    return {"launched": args["app"]}


@tool("notify", "Show a desktop notification.", {"title": S("title"), "body": S("message")}, required=["title"])
def t_notify(args, ctx):
    ctx["ui"]("shell.notify", {"title": args["title"], "body": args.get("body", ""), "app": "THADD AI"})
    return {"notified": True}


@tool("set_appearance", "Change theme, accent colour, wallpaper or shell style.",
      {"theme": S("dark, light or auto"), "accent": S("hex colour e.g. #3b82f6"), "wallpaper": S("wallpaper id"),
       "shell_style": S("hybrid, windows11, sequoia or linux")})
def t_appearance(args, ctx):
    patch = {k: v for k, v in args.items() if v and k in ("theme", "accent", "wallpaper", "shell_style")}
    if not patch:
        raise RpcError("nothing to change", "bad_value")
    cfg = Config()
    cfg.replace_section("appearance", patch)
    ctx["ui"]("shell.appearance", patch)
    return {"applied": patch}


@tool("control_window", "Control a desktop window: focus, close, minimize, maximize, tile, or list windows.",
      {"action": S("focus, close, minimize, maximize, restore, tile-left, tile-right, list"), "target": S("window title or app id")},
      required=["action"])
def t_window(args, ctx):
    ctx["ui"]("shell.control", {"action": args["action"], "target": args.get("target", "")})
    return {"action": args["action"], "target": args.get("target", ""), "note": "the desktop shell performed this instantly"}


@tool("clipboard", "Read or write the desktop clipboard.", {"action": S("read or write"), "text": S("text to copy")}, required=["action"])
def t_clipboard(args, ctx):
    action = args["action"]
    if action == "read":
        for cmd in (["xclip", "-selection", "clipboard", "-o"], ["xsel", "-b"], ["wl-paste"]):
            if shutil.which(cmd[0]):
                r = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
                return {"text": r.stdout}
        return {"text": "", "note": "no clipboard tool available"}
    for cmd in (["xclip", "-selection", "clipboard", "-i"], ["xsel", "-b", "-i"], ["wl-copy"]):
        if shutil.which(cmd[0]):
            subprocess.run(cmd, input=args.get("text", ""), text=True, timeout=10)
            return {"written": len(args.get("text", ""))}
    return {"error": "no clipboard tool available"}


@tool("screenshot", "Capture the screen and save it to ~/Pictures/Screenshots.", {"label": S("optional label")})
def t_screenshot(args, ctx):
    ctx["ui"]("shell.control", {"action": "screenshot", "label": args.get("label", "ai")})
    out = Path.home() / "Pictures" / "Screenshots"
    return {"saved_to": str(out), "note": "capture requested from the desktop shell"}


@tool("gui_action", "Automate the mouse/keyboard (click, type, key, scroll, move) — full PC automation.",
      {"action": S("click, type, key, scroll, move, drag"), "x": N("x coordinate"), "y": N("y coordinate"),
       "text": S("text to type"), "keys": S("key combo e.g. ctrl+alt+t")}, required=["action"], destructive=True)
def t_gui(args, ctx):
    if not shutil.which("xdotool"):
        return {"ok": False, "error": "xdotool is not installed in this environment (works in the live ISO session)"}
    action = args["action"]
    cmds = {
        "click": ["xdotool", "mousemove", str(args.get("x", 0)), str(args.get("y", 0)), "click", "1"],
        "move": ["xdotool", "mousemove", str(args.get("x", 0)), str(args.get("y", 0))],
        "type": ["xdotool", "type", "--delay", "12", args.get("text", "")],
        "key": ["xdotool", "key", args.get("keys", "")],
        "scroll": ["xdotool", "click", "4" if int(args.get("y", 0)) >= 0 else "5"],
    }
    if action not in cmds:
        raise RpcError(f"unsupported gui action {action}", "bad_value")
    proc = subprocess.run(cmds[action], capture_output=True, text=True, timeout=20)
    return {"ok": proc.returncode == 0, "stderr": proc.stderr.strip()}


@tool("open_url", "Open a URL in the system browser.", {"url": S("http(s) URL")}, required=["url"])
def t_open_url(args, ctx):
    url = args["url"]
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    ctx["ui"]("shell.open_url", {"url": url})
    return {"opened": url}


# -------------------------------------------------------------- security tools
@tool("security_posture", "Run the THADD security posture check (firewall, hardening, updates, encryption, services).")
def t_posture(args, ctx):
    from ..api import security as secapi

    return secapi.cmd_posture(None)


@tool("security_scan", "Launch a security scan: quick, full, rootkit, audit, virus, network, or web(target).",
      {"kind": S("quick, full, rootkit, audit, virus, network, web"), "target": S("target host for web scans")})
def t_scan(args, ctx):
    from ..api import security as secapi

    return secapi.cmd_scan(None, kind=args.get("kind", "quick"), target=args.get("target", ""))


@tool("hash_file", "Compute SHA-256/MD5 of a file (evidence integrity).", {"path": S("file path")}, required=["path"])
def t_hash(args, ctx):
    from ..api import security as secapi

    return secapi.cmd_hash(None, path=args["path"])


@tool("forensics_analyze", "Reverse-engineer / analyse a file or disk image: type, entropy, sections, strings, embedded files, indicators.",
      {"path": S("file or image path")}, required=["path"])
def t_forensics(args, ctx):
    from ..api import security as secapi

    return secapi.cmd_analyze(None, path=args["path"])


# ------------------------------------------------------------- system管理 tools
@tool("install_package", "Install software with the OS package manager.", {"package": S("package name")},
      required=["package"], destructive=True)
def t_install(args, ctx):
    from ..api import system as sysapi

    return sysapi.cmd_install_package(None, package=args["package"])


@tool("manage_service", "Start/stop/restart/enable a systemd service.", {"unit": S("unit name"), "action": S("start, stop, restart, enable, disable, status")},
      required=["unit", "action"], destructive=True)
def t_service(args, ctx):
    from ..api import system as sysapi

    return sysapi.cmd_service_action(None, unit=args["unit"], action=args["action"])


@tool("create_snapshot", "Create a restore point of the user's files before risky changes.", {"label": S("what is this snapshot for")})
def t_snapshot(args, ctx):
    from ..api import snapshots as snapapi

    return snapapi.cmd_create(None, label=args.get("label", "ai checkpoint"))


@tool("list_snapshots", "List restore points.")
def t_snap_list(args, ctx):
    from ..api import snapshots as snapapi

    return snapapi.cmd_list(None)


@tool("restore_snapshot", "Restore a snapshot (replaces files with the snapshot version).", {"snapshot": S("snapshot id")},
      required=["snapshot"], destructive=True)
def t_snap_restore(args, ctx):
    from ..api import snapshots as snapapi

    return snapapi.cmd_restore(None, snapshot=args["snapshot"])


@tool("web_fetch", "Fetch a URL and return readable text (docs, error messages, CVE details).",
      {"url": S("http(s) URL")}, required=["url"])
def t_web(args, ctx):
    from ..api import system as sysapi

    return sysapi.cmd_net_fetch(None, url=args["url"], max_bytes=120000)


@tool("list_tools", "Show which programming, security, forensics and browser tools are installed.")
def t_tools(args, ctx):
    from ..api import system as sysapi

    return sysapi.cmd_tools(None)


TOOL_FUNCS: dict[str, callable] = {}
for _name, _fn in list(globals().items()):
    if getattr(_fn, "_thadd_tool", None):
        TOOL_FUNCS[_fn._thadd_tool] = _fn


def destructive_tools() -> set[str]:
    return {fn._thadd_tool for fn in TOOL_FUNCS.values() if getattr(fn, "_destructive", False)}


def execute(name: str, args: dict, ctx: dict) -> dict:
    """Execute a tool call, returning a JSON-serialisable result."""
    fn = TOOL_FUNCS.get(name)
    if fn is None:
        return {"error": f"unknown tool {name}"}
    started = time.time()
    try:
        result = fn(args or {}, ctx)
    except RpcError as exc:
        result = {"error": exc.message, "code": exc.code}
    except Exception as exc:  # pragma: no cover - defensive
        result = {"error": f"{type(exc).__name__}: {exc}"}
    if not isinstance(result, dict):
        result = {"result": result}
    result.setdefault("_elapsed", round(time.time() - started, 3))
    result.setdefault("_tool", name)
    return result
