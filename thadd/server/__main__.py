"""THADD OS — server bootstrap.

Registers every API module, starts the background daemons (metrics ticker,
automation, watchdog) and serves the desktop shell over HTTP + WebSocket.

Run it directly::

    python3 -m thadd.server --host 0.0.0.0 --port 8080 --shell thadd/shell

Inside the live ISO the same entry point is started by systemd
(``thadd-server.service``); in a container or CI it is started by a script.
"""

from __future__ import annotations

import argparse
import json
import os
import signal
import sys
import threading
import time
from pathlib import Path

if __package__ in (None, ""):  # allow `python3 thadd/server/__main__.py`
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
    from thadd.server import core as coremod
else:
    from . import core as coremod

from . import config as cfgmod
from .ai import agent as aiagent
from .ai import local as ailocal
from .api import fs as fsapi
from .api import security as secapi
from .api import settings as setapi
from .api import shell as shellapi
from .api import snapshots as snapapi
from .api import system as sysapi
from .api import term as termapi
from .core import BUS, REGISTRY, RpcError, make_server, serve_forever

REGISTRY = coremod.REGISTRY
BUS = coremod.BUS


# ------------------------------------------------------------------ registration
def register_all() -> None:
    """Wire every module function into the RPC registry."""

    def add(namespace: str, **funcs) -> None:
        for name, fn in funcs.items():
            REGISTRY.register(f"{namespace}.{name}", fn)

    add("boot",
        hello=shellapi.cmd_hello,
        info=sysapi.cmd_info,
        about=setapi.cmd_about,
        first_run=shellapi.cmd_first_run,
        env=sysapi.cmd_env_info)

    add("system",
        info=sysapi.cmd_info, metrics=sysapi.cmd_metrics, tools=sysapi.cmd_tools,
        disk=sysapi.cmd_disk, processes=sysapi.cmd_processes, kill=sysapi.cmd_kill,
        network=sysapi.cmd_network, net_test=sysapi.cmd_net_test, net_fetch=sysapi.cmd_net_fetch,
        power=sysapi.cmd_power, logs=sysapi.cmd_logs, hostname=sysapi.cmd_hostname,
        packages=sysapi.cmd_packages, install_package=sysapi.cmd_install_package,
        services=sysapi.cmd_services, service_action=sysapi.cmd_service_action)

    add("fs",
        home=fsapi.cmd_fs_home, roots=fsapi.cmd_fs_roots, list=fsapi.cmd_fs_list,
        stat=fsapi.cmd_fs_stat, read=fsapi.cmd_fs_read, write=fsapi.cmd_fs_write,
        mkdir=fsapi.cmd_fs_mkdir, rename=fsapi.cmd_fs_rename, copy=fsapi.cmd_fs_copy,
        trash=fsapi.cmd_fs_trash, trash_list=fsapi.cmd_fs_trash_list, untrash=fsapi.cmd_fs_untrash,
        delete=fsapi.cmd_fs_delete, search=fsapi.cmd_fs_search, usage=fsapi.cmd_fs_usage,
        thumbnail=fsapi.cmd_fs_thumbnail, recent=fsapi.cmd_fs_recent, mounts=fsapi.cmd_fs_mounts)

    add("term",
        shells=termapi.cmd_shells, open=termapi.cmd_term_open, input=termapi.cmd_term_input,
        resize=termapi.cmd_term_resize, close=termapi.cmd_term_close,
        list=termapi.cmd_term_list, exec=termapi.cmd_term_exec)

    add("security",
        posture=secapi.cmd_posture, scan=secapi.cmd_scan, ports=secapi.cmd_ports,
        hash=secapi.cmd_hash, analyze=secapi.cmd_analyze,
        analyze_image=secapi.cmd_forensic_analyze_image, devices=secapi.cmd_devices,
        capabilities=secapi.cmd_capabilities)

    add("snapshots",
        create=snapapi.cmd_create, list=snapapi.cmd_list, show=snapapi.cmd_show,
        diff=snapapi.cmd_diff, restore=snapapi.cmd_restore, delete=snapapi.cmd_delete,
        prune=snapapi.cmd_prune, archive_path=snapapi.cmd_archive_path)

    add("settings",
        get=setapi.cmd_get, apply=setapi.cmd_apply, wallpapers=setapi.cmd_wallpapers,
        theme_import=setapi.cmd_theme_import, ai_key=setapi.cmd_ai_key, ai_test=setapi.cmd_ai_test,
        ai_models=setapi.cmd_ai_models, reset=setapi.cmd_reset, export=setapi.cmd_export,
        import_json=setapi.cmd_import, about=setapi.cmd_about)

    add("shell",
        hello=shellapi.cmd_hello, apps=shellapi.cmd_apps, launch=shellapi.cmd_launch,
        favorite=shellapi.cmd_favorite, notify=shellapi.cmd_notify,
        notifications=shellapi.cmd_notifications, notification_read=shellapi.cmd_notification_read,
        notification_clear=shellapi.cmd_notification_clear, wm_get=shellapi.cmd_wm_get,
        wm_save=shellapi.cmd_wm_save, wallpaper=shellapi.cmd_wallpaper, notes=shellapi.cmd_notes,
        calendar=shellapi.cmd_calendar, clipboard=shellapi.cmd_clipboard,
        screenshot=shellapi.cmd_screenshot, record_start=shellapi.cmd_record_start,
        record_stop=shellapi.cmd_record_stop, recordings=shellapi.cmd_recordings,
        media=shellapi.cmd_media, first_run=shellapi.cmd_first_run,
        render_video=shellapi.cmd_render_video)

    add("ai",
        chat=aiagent.start_chat, approve=ai_cmd_approve, pending=ai_cmd_pending,
        audit=ai_cmd_audit, conversations=ai_cmd_conversations, conversation=ai_cmd_conversation,
        conversation_delete=ai_cmd_conversation_delete, presets=ai_cmd_presets,
        tools=ai_cmd_tools, status=ai_cmd_status, local=ai_cmd_local)


# ------------------------------------------------------------------- AI plumbing
def ai_cmd_approve(session=None, id: str = "", allow: bool = True, **_):
    """Approve or deny a tool call the agent requested."""
    ok = aiagent.resolve_approval(id, allow)
    return {"resolved": ok, "allowed": allow}


def ai_cmd_pending(session=None, **_):
    """Tool calls waiting for the user's approval."""
    return {"pending": aiagent.pending_approvals()}


def ai_cmd_audit(session=None, limit: int = 100, **_):
    """The AI action audit trail (hash-chained JSONL)."""
    return {"entries": aiagent.audit_tail(int(limit))}


def ai_cmd_conversations(session=None, **_):
    """Saved AI conversations."""
    return {"conversations": aiagent.list_conversations()}


def ai_cmd_conversation(session=None, id: str = "", **_):
    """Load one conversation."""
    return aiagent.load_conversation(id)


def ai_cmd_conversation_delete(session=None, id: str = "", **_):
    """Delete a saved conversation."""
    return aiagent.delete_conversation(id)


def ai_cmd_presets(session=None, **_):
    """Ready-made agent tasks (fix system, harden, forensics, …)."""
    return {"presets": [{"id": k, "prompt": v} for k, v in aiagent.PRESETS.items()]}


def ai_cmd_tools(session=None, **_):
    """The toolbelt the agent can call."""
    from .ai import tools as toolmod

    return {"tools": toolmod.TOOL_SCHEMAS,
            "destructive": sorted(toolmod.destructive_tools()),
            "count": len(toolmod.TOOL_SCHEMAS)}


def ai_cmd_status(session=None, **_):
    """Is the AI online, which model, what autonomy, how many tools."""
    from .ai import tools as toolmod

    cfg = cfgmod.Config()
    key = cfg.get("ai", "api_key") or os.environ.get("GROQ_API_KEY", "")
    return {"configured": bool(key), "model": cfg.get("ai", "model"),
            "autonomy": cfg.get("ai", "autonomy"), "stream": cfg.get("ai", "stream"),
            "offline_available": True, "tools": len(toolmod.TOOL_SCHEMAS),
            "provider": cfg.get("ai", "provider"),
            "pending_approvals": len(aiagent.pending_approvals())}


def ai_cmd_local(session=None, prompt: str = "", **_):
    """Deterministic offline assistant (no key required)."""
    text, actions = ailocal.local_reply(prompt, session)
    return {"text": text, "actions": actions}


# ------------------------------------------------------------------------ daemons
_STOP = threading.Event()


def daemon_metrics(interval: float = 2.0) -> None:
    while not _STOP.is_set():
        try:
            BUS.publish("system.metrics", sysapi.cmd_metrics())
        except Exception:
            pass
        _STOP.wait(interval)


def daemon_health(interval: float = 30.0) -> None:
    """Watch disk/memory/logged-in state and raise notifications when needed."""
    warned: dict[str, float] = {}
    while not _STOP.is_set():
        try:
            met = sysapi.cmd_metrics()
            if met["memory"]["percent"] > 92 and time.time() - warned.get("mem", 0) > 600:
                warned["mem"] = time.time()
                shellapi.cmd_notify(None, title="Memory almost full",
                                    body=f"{met['memory']['percent']}% of RAM in use — ask THADD AI to find the hog",
                                    severity="warning", app="System")
            for d in met["disk"]:
                if d["percent"] > 92 and time.time() - warned.get("disk" + d["mount"], 0) > 1800:
                    warned["disk" + d["mount"]] = time.time()
                    shellapi.cmd_notify(None, title="Disk almost full",
                                        body=f"{d['mount']} is {d['percent']}% full",
                                        severity="error", app="System")
        except Exception:
            pass
        _STOP.wait(interval)


def daemon_automation(interval: float = 300.0) -> None:
    """Snapshot retention + trashed-file hygiene."""
    while not _STOP.is_set():
        try:
            snapapi.cmd_prune()
        except Exception:
            pass
        _STOP.wait(interval)


def daemon_watchdog(interval: float = 120.0) -> None:
    """Keep an eye on the shell: if nobody is connected, nothing to do — but if
    the AI audit log grows past a threshold, rotate it."""
    while not _STOP.is_set():
        try:
            audit = cfgmod.data_dir() / aiagent.AUDIT_FILE
            if audit.exists() and audit.stat().st_size > 8 * 1024 * 1024:
                rotated = audit.with_suffix(f".{int(time.time())}.jsonl")
                audit.rename(rotated)
        except Exception:
            pass
        _STOP.wait(interval)


def start_daemons() -> list[threading.Thread]:
    threads = []
    for fn, args in ((daemon_metrics, (2.0,)), (daemon_health, (30.0,)),
                     (daemon_automation, (300.0,)), (daemon_watchdog, (120.0,))):
        t = threading.Thread(target=fn, args=args, daemon=True, name=fn.__name__)
        t.start()
        threads.append(t)
    return threads


# --------------------------------------------------------------------------- main
def default_shell_dir() -> str:
    here = Path(__file__).resolve()
    candidate = here.parents[1] / "shell"
    return str(candidate if candidate.exists() else here.parent / "shell")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="thadd-server", description="THADD OS userspace server")
    parser.add_argument("--host", default=os.environ.get("THADD_HOST", "0.0.0.0"))
    parser.add_argument("--port", type=int, default=int(os.environ.get("THADD_PORT", "8080")))
    parser.add_argument("--shell", default=os.environ.get("THADD_SHELL_DIR", default_shell_dir()))
    parser.add_argument("--token", default=os.environ.get("THADD_TOKEN", ""))
    parser.add_argument("--quiet", action="store_true", default=os.environ.get("THADD_QUIET") == "1")
    parser.add_argument("--no-daemons", action="store_true")
    parser.add_argument("--print-routes", action="store_true")
    args = parser.parse_args(argv)

    register_all()
    if args.print_routes:
        for name in REGISTRY.names():
            print(f"{name:32} {REGISTRY.describe().get(name, '')}")
        return 0

    if not args.no_daemons:
        start_daemons()

    shell_dir = Path(args.shell)
    if not (shell_dir / "index.html").exists():
        print(f"[thadd] warning: shell not found at {shell_dir} (API still available)", file=sys.stderr)

    httpd = make_server(args.host, args.port, str(shell_dir), token=args.token, quiet=args.quiet)
    banner = (
        f"\n  THADD OS {cfgmod.THADD_VERSION} ({cfgmod.THADD_CODENAME}) — userspace online\n"
        f"  shell   : http://{args.host}:{args.port}/\n"
        f"  websocket: ws://{args.host}:{args.port}/ws\n"
        f"  health  : http://{args.host}:{args.port}/healthz\n"
        f"  methods : {len(REGISTRY.names())} registered\n"
        f"  data    : {cfgmod.data_dir()}\n"
    )
    print(banner, flush=True)

    def _stop(*_a):
        _STOP.set()
        threading.Thread(target=httpd.shutdown, daemon=True).start()

    for sig in (signal.SIGTERM, signal.SIGINT):
        try:
            signal.signal(sig, _stop)
        except (ValueError, OSError):
            pass
    try:
        serve_forever(httpd)
    finally:
        _STOP.set()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
