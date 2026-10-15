"""THADD OS — real terminals.

Spawns genuine login shells on a PTY (bash, zsh, fish, PowerShell, python, …),
streams their output to the desktop shell over WebSocket and accepts keystrokes
back.  Also exposes a one-shot ``term.exec`` used by the AI agent and by the
"Run this" buttons in the editor.
"""

from __future__ import annotations

import errno
import fcntl
import os
import pty
import shlex
import signal
import struct
import subprocess
import termios
import threading
import time
from pathlib import Path

from ..core import RpcError, Stream

_TERMS: dict[str, dict] = {}
_TERMS_LOCK = threading.RLock()

SHELL_PROFILES = [
    {"id": "bash", "label": "Bash", "cmd": ["/bin/bash", "-l"], "icon": "terminal"},
    {"id": "zsh", "label": "Zsh", "cmd": ["/usr/bin/zsh", "-l"], "icon": "terminal"},
    {"id": "fish", "label": "Fish", "cmd": ["/usr/bin/fish", "-l"], "icon": "terminal"},
    {"id": "pwsh", "label": "PowerShell", "cmd": ["/usr/bin/pwsh", "-NoLogo"], "icon": "powershell"},
    {"id": "python", "label": "Python REPL", "cmd": ["/usr/bin/python3", "-q"], "icon": "python"},
    {"id": "node", "label": "Node REPL", "cmd": ["/usr/bin/node"], "icon": "node"},
    {"id": "sqlite", "label": "SQLite", "cmd": ["/usr/bin/sqlite3"], "icon": "database"},
    {"id": "root", "label": "Root shell", "cmd": ["/bin/bash", "-l"], "as_root": True, "icon": "shield"},
]


def cmd_shells(session=None, **_):
    """Installed shells and REPLs available to the terminal app."""
    profs = []
    for prof in SHELL_PROFILES:
        binary = prof["cmd"][0]
        if Path(binary).exists():
            profs.append({k: v for k, v in prof.items() if k != "cmd"})
    return {"profiles": profs, "cwd": os.getcwd(), "user": os.environ.get("USER", "thadd")}


def cmd_term_open(session, profile: str = "bash", cols: int = 100, rows: int = 30, cwd: str = "", stream_id: str = "",
                  **_):
    """Open a PTY-backed terminal and stream it to the shell."""
    sid = stream_id or f"term-{int(time.time()*1000)}"
    prof = next((p for p in SHELL_PROFILES if p["id"] == profile), SHELL_PROFILES[0])
    argv = prof["cmd"]
    if prof.get("as_root") and os.geteuid() != 0:
        argv = ["sudo", "-n"] + argv if os.path.exists("/usr/bin/sudo") else argv
    env = dict(os.environ)
    env.update({
        "TERM": "xterm-256color",
        "COLORTERM": "truecolor",
        "THADD_SHELL": "1",
        "PS1": "\\[\\e[38;5;39m\\]\\u@thadd\\[\\e[0m\\]:\\[\\e[38;5;213m\\]\\w\\[\\e[0m\\]$ ",
    })
    workdir = os.path.expanduser(cwd) if cwd else os.path.expanduser("~")
    if not os.path.isdir(workdir):
        workdir = "/"

    pid, fd = pty.fork()
    if pid == 0:  # child
        try:
            os.chdir(workdir)
            os.execvpe(argv[0], argv, env)
        except Exception:
            os._exit(127)

    def set_winsize(fd_: int, c: int, r: int) -> None:
        try:
            fcntl.ioctl(fd_, termios.TIOCSWINSZ, struct.pack("HHHH", max(2, r), max(20, c), 0, 0))
        except OSError:
            pass

    set_winsize(fd, cols, rows)
    key = f"{session.id}:{sid}"
    with _TERMS_LOCK:
        _TERMS[key] = {"fd": fd, "pid": pid, "profile": prof["id"], "cwd": workdir, "opened": time.time(), "cols": cols, "rows": rows}

    def producer(stream: Stream) -> None:
        stream.meta = {"pid": pid, "profile": prof["id"]}
        try:
            while True:
                try:
                    data = os.read(fd, 65536)
                except OSError as exc:
                    if exc.errno in (errno.EIO, errno.EBADF):
                        break
                    break
                if not data:
                    break
                stream.push(data.decode("utf-8", "replace"))
        finally:
            try:
                os.close(fd)
            except OSError:
                pass
            with _TERMS_LOCK:
                _TERMS.pop(key, None)

    Stream(session, sid, producer).start()
    return {"stream_id": sid, "pid": pid, "profile": prof["id"], "cwd": workdir, "cols": cols, "rows": rows}


def _term_for(session, stream_id: str) -> dict:
    key = f"{session.id}:{stream_id}"
    with _TERMS_LOCK:
        info = _TERMS.get(key)
    if not info:
        raise RpcError("terminal is not open", "not_found")
    return info


def cmd_term_input(session, stream_id: str = "", data: str = "", **_):
    """Send keystrokes/commands to a terminal."""
    info = _term_for(session, stream_id)
    try:
        os.write(info["fd"], data.encode("utf-8", "replace"))
    except OSError as exc:
        raise RpcError(f"write failed: {exc}", "io")
    return {"written": len(data)}


def cmd_term_resize(session, stream_id: str = "", cols: int = 100, rows: int = 30, **_):
    """Resize a terminal PTY."""
    info = _term_for(session, stream_id)
    try:
        fcntl.ioctl(info["fd"], termios.TIOCSWINSZ, struct.pack("HHHH", max(2, int(rows)), max(20, int(cols)), 0, 0))
    except OSError as exc:
        raise RpcError(f"resize failed: {exc}", "io")
    info["cols"], info["rows"] = cols, rows
    return {"cols": cols, "rows": rows}


def cmd_term_close(session, stream_id: str = "", **_):
    """Close a terminal and reap its process group."""
    key = f"{session.id}:{stream_id}"
    with _TERMS_LOCK:
        info = _TERMS.pop(key, None)
    if not info:
        return {"closed": False}
    try:
        os.killpg(os.getpgid(info["pid"]), signal.SIGHUP)
    except OSError:
        pass
    try:
        os.close(info["fd"])
    except OSError:
        pass
    for stream in list(getattr(session, "_streams", {}).values()):
        if stream.id == stream_id:
            stream.stop()
    return {"closed": True, "pid": info["pid"]}


def cmd_term_list(session=None, **_):
    """Open terminal sessions for this client."""
    with _TERMS_LOCK:
        ours = {k: {"pid": v["pid"], "profile": v["profile"], "cwd": v["cwd"]} for k, v in _TERMS.items() if k.startswith(f"{session.id}:")}
    return {"terminals": ours}


def cmd_term_exec(session=None, cmd: str = "", timeout: float = 60.0, cwd: str = "", shell: bool = True, **_):
    """Run a command once and capture stdout/stderr/exit-code."""
    if not cmd or len(cmd) > 20000:
        raise RpcError("invalid command", "bad_value")
    workdir = os.path.expanduser(cwd) if cwd else os.path.expanduser("~")
    try:
        proc = subprocess.run(
            cmd if shell else shlex.split(cmd),
            shell=shell,
            capture_output=True,
            text=True,
            timeout=max(1.0, min(float(timeout), 1800.0)),
            cwd=workdir if os.path.isdir(workdir) else None,
            env={**os.environ, "THADD_SHELL": "1", "TERM": "xterm-256color"},
        )
        return {"code": proc.returncode, "stdout": proc.stdout[-400000:], "stderr": proc.stderr[-100000:],
                "cmd": cmd, "ok": proc.returncode == 0}
    except subprocess.TimeoutExpired as exc:
        return {"code": 124, "stdout": (exc.stdout or b"").decode(errors="replace") if isinstance(exc.stdout, bytes) else (exc.stdout or ""),
                "stderr": "command timed out", "cmd": cmd, "ok": False}
    except FileNotFoundError as exc:
        return {"code": 127, "stdout": "", "stderr": str(exc), "cmd": cmd, "ok": False}
