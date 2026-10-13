"""THADD OS — the desktop shell API (window manager, dock, apps, widgets).

The shell is a web-rendered desktop (works in the live ISO's browser, in a kiosk
window, or from any remote client) that looks like a hybrid of Windows 11 and
macOS Sequoia.  This module provides everything the shell needs from the OS:

* the **app registry** (what can be launched, and how)
* **notifications** (persisted, with actions)
* **window state** (persisted layout per user)
* **wallpapers** — generated on demand with PIL, or SVG when PIL is absent
* **notes / calendar / clipboard / music** — real storage in the THADD data dir
* **screenshots and screen recording** — real capture via x11grab/scrot/ImageGrab
* **demo video rendering** — see :mod:`thadd.server.video`
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import time
import uuid
from pathlib import Path

from ..config import Config, data_dir, os_pretty_name
from ..core import BUS, RpcError, Stream

# ------------------------------------------------------------------ app registry
APPS = [
    {"id": "ai", "name": "THADD AI", "icon": "sparkles", "category": "AI", "desc": "OS agent — files, shell, security, automation",
     "command": None, "pinned": True, "width": 900, "height": 660},
    {"id": "files", "name": "Files", "icon": "files", "category": "System", "desc": "Browse, edit, search and analyse files",
     "command": "thunar", "pinned": True, "width": 980, "height": 640},
    {"id": "terminal", "name": "Terminal", "icon": "terminal", "category": "System", "desc": "Real shell (bash/zsh/fish/pwsh)",
     "command": "x-terminal-emulator", "pinned": True, "width": 900, "height": 560},
    {"id": "powershell", "name": "PowerShell", "icon": "powershell", "category": "System", "desc": "pwsh session",
     "command": "pwsh", "pinned": False, "width": 900, "height": 560},
    {"id": "browser", "name": "Firefox", "icon": "firefox", "category": "Internet", "desc": "Firefox browser",
     "command": "firefox", "pinned": True, "width": 1100, "height": 720},
    {"id": "chromium", "name": "Chromium", "icon": "chrome", "category": "Internet", "desc": "Chromium / Brave",
     "command": "chromium|chromium-browser|brave-browser", "pinned": True, "width": 1100, "height": 720},
    {"id": "security", "name": "Security Center", "icon": "shield", "category": "Security", "desc": "Posture, scans, forensics, reverse engineering",
     "command": None, "pinned": True, "width": 1080, "height": 700},
    {"id": "editor", "name": "Code Editor", "icon": "code", "category": "Development", "desc": "Multi-file editor with syntax highlighting",
     "command": None, "pinned": True, "width": 1080, "height": 700},
    {"id": "taskmgr", "name": "Task Manager", "icon": "activity", "category": "System", "desc": "Processes, performance, services",
     "command": None, "pinned": True, "width": 980, "height": 640},
    {"id": "settings", "name": "Settings", "icon": "settings", "category": "System", "desc": "Appearance, AI, security, system",
     "command": None, "pinned": True, "width": 1000, "height": 680},
    {"id": "store", "name": "App Store", "icon": "store", "category": "System", "desc": "Install real software from the OS repositories",
     "command": None, "pinned": True, "width": 980, "height": 660},
    {"id": "snapshots", "name": "Snapshots", "icon": "history", "category": "System", "desc": "Restore points and rollback",
     "command": None, "pinned": False, "width": 900, "height": 600},
    {"id": "monitor", "name": "System Monitor", "icon": "chart", "category": "System", "desc": "Live CPU/RAM/network graphs",
     "command": None, "pinned": False, "width": 860, "height": 560},
    {"id": "recorder", "name": "Screen Recorder", "icon": "record", "category": "Media", "desc": "Record the desktop to MP4",
     "command": None, "pinned": False, "width": 820, "height": 560},
    {"id": "media", "name": "Media Player", "icon": "play", "category": "Media", "desc": "Play music and video",
     "command": "mpv", "pinned": False, "width": 900, "height": 600},
    {"id": "notes", "name": "Notes", "icon": "note", "category": "Productivity", "desc": "Quick notes, saved locally",
     "command": None, "pinned": True, "width": 760, "height": 560},
    {"id": "calendar", "name": "Calendar", "icon": "calendar", "category": "Productivity", "desc": "Month view with events",
     "command": None, "pinned": False, "width": 900, "height": 620},
    {"id": "calculator", "name": "Calculator", "icon": "calculator", "category": "Productivity", "desc": "Scientific calculator",
     "command": None, "pinned": False, "width": 420, "height": 560},
    {"id": "welcome", "name": "Welcome", "icon": "info", "category": "System", "desc": "First-run tour and setup checklist",
     "command": None, "pinned": False, "width": 880, "height": 620},
    {"id": "gimp", "name": "GIMP", "icon": "image", "category": "Graphics", "desc": "Image editor", "command": "gimp", "pinned": False, "width": 1100, "height": 700},
    {"id": "inkscape", "name": "Inkscape", "icon": "vector", "category": "Graphics", "desc": "Vector graphics", "command": "inkscape", "pinned": False},
    {"id": "office", "name": "LibreOffice", "icon": "office", "category": "Office", "desc": "Writer / Calc / Impress", "command": "libreoffice", "pinned": False, "width": 1100, "height": 720},
    {"id": "wireshark", "name": "Wireshark", "icon": "network", "category": "Security", "desc": "Packet analysis", "command": "wireshark", "pinned": False, "width": 1100, "height": 700},
    {"id": "burpsuite", "name": "Burp Suite", "icon": "spider", "category": "Security", "desc": "Web security testing", "command": "burpsuite", "pinned": False},
    {"id": "msf", "name": "Metasploit", "icon": "target", "category": "Security", "desc": "Penetration testing framework", "command": "msfconsole", "pinned": False},
    {"id": "nmap", "name": "Zenmap", "icon": "radar", "category": "Security", "desc": "Network mapper", "command": "zenmap|nmap", "pinned": False},
    {"id": "ghidra", "name": "Ghidra", "icon": "binary", "category": "Security", "desc": "Reverse engineering suite", "command": "ghidra", "pinned": False},
    {"id": "qemu", "name": "VMs (virt-manager)", "icon": "vm", "category": "System", "desc": "Run Windows/macOS/Linux in a VM", "command": "virt-manager", "pinned": False, "width": 1100, "height": 700},
    {"id": "wine", "name": "Windows Apps (Wine)", "icon": "windows", "category": "Compatibility", "desc": "Run Windows software", "command": "winecfg", "pinned": False},
    {"id": "docker", "name": "Containers", "icon": "container", "category": "Development", "desc": "Docker / Podman", "command": None, "pinned": False, "width": 900, "height": 620},
    {"id": "git", "name": "Git Client", "icon": "git", "category": "Development", "desc": "Repos, diffs, commits", "command": None, "pinned": False, "width": 980, "height": 640},
    {"id": "cam", "name": "Camera", "icon": "camera", "category": "Media", "desc": "Webcam viewer + capture", "command": None, "pinned": False, "width": 760, "height": 560},
    {"id": "music", "name": "Music", "icon": "music", "category": "Media", "desc": "Play local audio", "command": None, "pinned": False, "width": 760, "height": 560},
    {"id": "video", "name": "Video Player", "icon": "video", "category": "Media", "desc": "Play local video (mp4/mkv/webm)", "command": None, "pinned": False, "width": 900, "height": 600},
    {"id": "texteditor", "name": "Text Editor", "icon": "text", "category": "Productivity", "desc": "Plain text editing", "command": "mousepad|gedit", "pinned": False},
    {"id": "archive", "name": "Archive Manager", "icon": "archive", "category": "System", "desc": "Zip/tar/7z", "command": "xarchiver|file-roller", "pinned": False},
    {"id": "help", "name": "Help & Docs", "icon": "help", "category": "System", "desc": "THADD OS manual", "command": None, "pinned": False, "width": 900, "height": 640},
    {"id": "dfir", "name": "Forensics Lab", "icon": "forensics", "category": "Security", "desc": "Reverse engineer disks: Windows, macOS, Linux",
     "command": None, "pinned": True, "width": 1080, "height": 720},
]


def _command_available(spec: str | None) -> bool:
    if not spec:
        return True
    for cmd in spec.split("|"):
        if shutil.which(cmd.strip()):
            return True
    return False


def _resolve_command(spec: str | None) -> str:
    if not spec:
        return ""
    for cmd in spec.split("|"):
        if shutil.which(cmd.strip()):
            return cmd.strip()
    return ""


def cmd_apps(session=None, **_):
    """The full app registry, annotated with what is actually installed."""
    cfg = Config()
    favs = list(cfg.get("shell", "favorites", []) or [])
    apps = []
    for app in APPS:
        available = _command_available(app.get("command"))
        apps.append({**app, "available": available, "native": bool(app.get("command")),
                     "favorite": app["id"] in favs})
    return {"apps": apps, "count": len(apps), "native_count": sum(1 for a in apps if a["available"] and a["native"])}


def cmd_launch(session=None, app: str = "", args: str = "", **_):
    """Launch any THADD app (native apps are spawned for real)."""
    if app == "dfir" and args.startswith("--analyze="):
        from ..api import security as secapi

        return secapi.cmd_forensic_analyze_image(session, path=args.split("=", 1)[1])
    if app == "screenshot":
        return cmd_screenshot(session)
    if app == "render-video":
        from .. import video as videomod

        return videomod.render_demo(session, args or "")
    entry = next((a for a in APPS if a["id"] == app), None)
    if not entry:
        raise RpcError(f"unknown app: {app}", "not_found")
    command = _resolve_command(entry.get("command"))
    if not command:
        return {"app": app, "mode": "shell", "note": "rendered by the THADD desktop shell" if not entry.get("command")
                else f"not installed: {entry.get('command')}"}
    cmdline = command + (f" {args}" if args else "")
    try:
        subprocess.Popen(cmdline, shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                         start_new_session=True)
        BUS.publish("shell.launched", {"app": app, "command": cmdline})
        return {"app": app, "mode": "native", "command": cmdline, "pid_hint": "spawned"}
    except OSError as exc:
        return {"app": app, "error": str(exc)}


def cmd_favorite(session=None, app: str = "", **_):
    """Toggle an app in the dock."""
    cfg = Config()
    favs = list(cfg.get("shell", "favorites", []) or [])
    if app in favs:
        favs.remove(app)
    else:
        favs.append(app)
    cfg.set("shell", "favorites", favs)
    return {"favorites": favs}


def cmd_hello(session=None, **_):
    """Handshake for the shell: identity, config, apps, notifications, uptime."""
    from ..api import system as sysapi

    cfg = Config()
    info = sysapi.cmd_info()
    return {
        "os": {
            "name": os_pretty_name(),
            "version": "1.0", "codename": "Nebula Prime",
            "kernel": info["os"]["kernel"], "arch": info["os"]["arch"],
            "hostname": info["os"]["hostname"], "virtualization": info["os"]["virtualization"],
            "live": info["os"]["live"], "edition": info["os"]["edition"],
        },
        "user": {"name": os.environ.get("USER", "thadd"), "home": str(Path.home()),
                 "root": os.geteuid() == 0, "shell": os.environ.get("SHELL", "/bin/bash")},
        "config": cfg.public(),
        "apps": cmd_apps()["apps"],
        "notifications": cmd_notifications()["notifications"],
        "data_dir": str(data_dir()),
        "server_time": time.time(),
        "ai_ready": bool(cfg.get("ai", "api_key") or os.environ.get("GROQ_API_KEY")),
    }


# ------------------------------------------------------------------ notifications
def _notif_file() -> Path:
    return data_dir() / "notifications.json"


def _load_notifs() -> list[dict]:
    path = _notif_file()
    if not path.exists():
        return _seed_notifications()
    try:
        return json.loads(path.read_text())
    except Exception:
        return []


def _save_notifs(items: list[dict]) -> None:
    try:
        _notif_file().write_text(json.dumps(items[-200:], indent=1))
    except OSError:
        pass


def _seed_notifications() -> list[dict]:
    from ..api import system as sysapi

    seeded = []
    try:
        info = sysapi.cmd_info()
        mem = info["memory"]
        if mem["percent"] > 80:
            seeded.append({"id": uuid.uuid4().hex[:8], "app": "System", "title": "Memory pressure",
                           "body": f"{mem['percent']}% of RAM in use — open Task Manager to review",
                           "time": time.time(), "read": False, "severity": "warning"})
    except Exception:
        pass
    seeded.append({"id": uuid.uuid4().hex[:8], "app": "THADD OS", "title": "Welcome to THADD OS",
                   "body": "Press the ⌘/⊞ key or click the logo to open the launcher. Ask THADD AI anything.",
                   "time": time.time(), "read": False, "severity": "info"})
    _save_notifs(seeded)
    return seeded


def cmd_notify(session=None, title: str = "", body: str = "", app: str = "THADD OS", severity: str = "info", **_):
    """Push a notification to every connected shell."""
    if not title:
        raise RpcError("notification needs a title", "bad_value")
    item = {"id": uuid.uuid4().hex[:8], "app": app, "title": title, "body": body, "time": time.time(),
            "read": False, "severity": severity if severity in ("info", "warning", "error", "success") else "info"}
    items = _load_notifs()
    items.append(item)
    _save_notifs(items)
    BUS.publish("shell.notify", item)
    return item


def cmd_notifications(session=None, **_):
    """Current notification centre contents."""
    items = _load_notifs()
    return {"notifications": items[-50:], "unread": sum(1 for i in items if not i.get("read")),
            "count": len(items)}


def cmd_notification_read(session=None, id: str = "", all: bool = False, **_):
    """Mark notifications as read."""
    items = _load_notifs()
    if all:
        for i in items:
            i["read"] = True
    else:
        for i in items:
            if i["id"] == id:
                i["read"] = True
    _save_notifs(items)
    return {"unread": sum(1 for i in items if not i.get("read"))}


def cmd_notification_clear(session=None, **_):
    """Clear the notification centre."""
    _save_notifs([])
    return {"cleared": True}


# ------------------------------------------------------------------ window state
def _wm_file() -> Path:
    return data_dir() / "wm-state.json"


def cmd_wm_get(session=None, **_):
    """Restore the saved desktop layout (windows, wallpaper, dock, widgets)."""
    path = _wm_file()
    if path.exists():
        try:
            return json.loads(path.read_text())
        except Exception:
            pass
    cfg = Config()
    return {"windows": [], "wallpaper": cfg.get("appearance", "wallpaper"), "dock": [], "widgets": ["clock"]}


def cmd_wm_save(session=None, state: dict | None = None, **_):
    """Persist window/dock/widget layout."""
    state = state or {}
    try:
        _wm_file().write_text(json.dumps(state, indent=1))
    except OSError:
        pass
    return {"saved": True, "windows": len(state.get("windows", []) or [])}


# --------------------------------------------------------------------- wallpapers
BUILTIN = ("thadd-nebula", "thadd-aurora", "thadd-grid", "thadd-macos", "thadd-win11")


def _wallpaper_dir() -> Path:
    d = Path.home() / ".local" / "share" / "thadd" / "wallpapers"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _generate_wallpaper(name: str, width: int = 1920, height: int = 1080) -> dict:
    """Render a built-in wallpaper to PNG (PIL) or SVG fallback."""
    target = _wallpaper_dir() / f"{name}.png"
    svg_target = _wallpaper_dir() / f"{name}.svg"
    if target.exists():
        return {"path": str(target), "cached": True}
    try:
        from PIL import Image, ImageDraw, ImageFilter  # type: ignore
        import math

        img = Image.new("RGB", (width, height))
        px = img.load()
        palettes = {
            "thadd-nebula": ((8, 10, 28), (26, 30, 74), (86, 60, 190), (240, 90, 180), (60, 200, 255)),
            "thadd-aurora": ((4, 18, 22), (10, 46, 52), (30, 140, 120), (90, 240, 200), (200, 255, 240)),
            "thadd-grid": ((10, 10, 14), (22, 24, 32), (60, 66, 90), (120, 200, 255), (255, 255, 255)),
            "thadd-macos": ((16, 10, 40), (70, 30, 110), (170, 60, 130), (255, 130, 140), (255, 220, 190)),
            "thadd-win11": ((5, 20, 44), (12, 60, 120), (30, 130, 220), (120, 200, 255), (235, 245, 255)),
        }
        base, mid, c1, c2, hi = palettes.get(name, palettes["thadd-nebula"])
        cx, cy = width * 0.62, height * 0.45
        for y in range(height):
            for x in range(width):
                nx, ny = (x - cx) / width, (y - cy) / height
                d = math.sqrt(nx * nx * 1.4 + ny * ny)
                t = min(1.0, d * 1.15)
                r = int(base[0] + (mid[0] - base[0]) * (1 - t) + 18 * (1 - t) ** 3)
                g = int(base[1] + (mid[1] - base[1]) * (1 - t) + 26 * (1 - t) ** 3)
                b = int(base[2] + (mid[2] - base[2]) * (1 - t) + 44 * (1 - t) ** 3)
                px[x, y] = (max(0, min(255, r)), max(0, min(255, g)), max(0, min(255, b)))
        glow = Image.new("RGB", (width, height), (0, 0, 0))
        gd = ImageDraw.Draw(glow)
        gd.ellipse([cx - width * 0.34, cy - height * 0.30, cx + width * 0.30, cy + height * 0.34],
                   fill=(c2[0] // 3, c2[1] // 3, c2[2] // 3))
        gd.ellipse([width * 0.10, height * 0.55, width * 0.45, height * 0.95],
                   fill=(c1[0] // 4, c1[1] // 4, c1[2] // 4))
        glow = glow.filter(ImageFilter.GaussianBlur(radius=int(min(width, height) * 0.10)))
        img = Image.blend(img, glow, 0.55)
        d = ImageDraw.Draw(img)
        if name == "thadd-grid":
            step = max(24, width // 60)
            for x in range(0, width, step):
                d.line([(x, 0), (x, height)], fill=(c1[0] // 5, c1[1] // 5, c1[2] // 5), width=1)
            for y in range(0, height, step):
                d.line([(0, y), (width, y)], fill=(c1[0] // 5, c1[1] // 5, c1[2] // 5), width=1)
        d.text((width - 430, height - 90), "THADD OS", fill=(255, 255, 255))
        font = None
        try:
            from PIL import ImageFont  # type: ignore

            font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 64)
        except Exception:
            font = None
        if font:
            d.text((width - 470, height - 130), "THADD OS", font=font, fill=(255, 255, 255, 200))
        img.save(target, quality=92, optimize=True)
        return {"path": str(target), "generated": True, "size": target.stat().st_size}
    except Exception:
        svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">
  <defs><radialGradient id="g" cx="62%" cy="42%" r="72%">
    <stop offset="0%" stop-color="#5b6cff"/><stop offset="55%" stop-color="#1b1f4b"/><stop offset="100%" stop-color="#06070f"/>
  </radialGradient></defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
  <text x="{width-60}" y="{height-60}" text-anchor="end" font-family="Inter,Segoe UI,sans-serif"
        font-size="64" font-weight="700" fill="rgba(255,255,255,0.85)">THADD OS</text>
</svg>"""
        svg_target.write_text(svg)
        return {"path": str(svg_target), "generated": True, "fallback": "svg"}


def cmd_wallpaper(session=None, name: str = "", **_):
    """Fetch (generating if needed) a wallpaper file."""
    name = name or Config().get("appearance", "wallpaper") or "thadd-nebula"
    if name in BUILTIN:
        return _generate_wallpaper(name)
    path = Path(os.path.expanduser(name))
    if path.exists():
        return {"path": str(path)}
    raise RpcError("wallpaper not found", "not_found")


# ------------------------------------------------------------------ notes & calendar
def _notes_file() -> Path:
    return data_dir() / "notes.json"


def cmd_notes(session=None, action: str = "list", id: str = "", title: str = "", body: str = "", **_):
    """Notes CRUD (stored as JSON in the THADD data directory)."""
    path = _notes_file()
    items = []
    if path.exists():
        try:
            items = json.loads(path.read_text())
        except Exception:
            items = []
    if action == "list":
        return {"notes": sorted(items, key=lambda n: n.get("updated", 0), reverse=True)}
    if action == "create":
        note = {"id": uuid.uuid4().hex[:10], "title": title or "Untitled", "body": body,
                "created": time.time(), "updated": time.time()}
        items.append(note)
        path.write_text(json.dumps(items, indent=1))
        return note
    if action == "update":
        for n in items:
            if n["id"] == id:
                n.update({"title": title or n["title"], "body": body, "updated": time.time()})
                path.write_text(json.dumps(items, indent=1))
                return n
        raise RpcError("note not found", "not_found")
    if action == "delete":
        items = [n for n in items if n["id"] != id]
        path.write_text(json.dumps(items, indent=1))
        return {"deleted": id}
    raise RpcError(f"unknown action {action}", "bad_value")


def _calendar_file() -> Path:
    return data_dir() / "calendar.json"


def cmd_calendar(session=None, action: str = "list", id: str = "", title: str = "", date: str = "",
                 time_of_day: str = "", notes: str = "", **_):
    """Calendar events CRUD."""
    path = _calendar_file()
    events = []
    if path.exists():
        try:
            events = json.loads(path.read_text())
        except Exception:
            events = []
    if action == "list":
        return {"events": sorted(events, key=lambda e: (e.get("date", ""), e.get("time", "")))}
    if action == "create":
        if not date:
            raise RpcError("event needs a date", "bad_value")
        ev = {"id": uuid.uuid4().hex[:10], "title": title or "Event", "date": date,
              "time": time_of_day, "notes": notes, "created": time.time()}
        events.append(ev)
        path.write_text(json.dumps(events, indent=1))
        return ev
    if action == "delete":
        events = [e for e in events if e["id"] != id]
        path.write_text(json.dumps(events, indent=1))
        return {"deleted": id}
    raise RpcError(f"unknown action {action}", "bad_value")


# ------------------------------------------------------------------------ clipboard
def cmd_clipboard(session=None, action: str = "read", text: str = "", **_):
    """Read/write the real clipboard (X11/Wayland when available)."""
    if action == "read":
        for cmd in (["xclip", "-selection", "clipboard", "-o"], ["xsel", "-b"], ["wl-paste", "--no-newline"]):
            if shutil.which(cmd[0]):
                try:
                    r = subprocess.run(cmd, capture_output=True, text=True, timeout=8)
                    if r.returncode == 0:
                        return {"text": r.stdout, "source": cmd[0]}
                except Exception:
                    continue
        return {"text": "", "source": "unavailable"}
    for cmd in (["xclip", "-selection", "clipboard", "-i"], ["xsel", "-b", "-i"], ["wl-copy"]):
        if shutil.which(cmd[0]):
            try:
                subprocess.run(cmd, input=text, text=True, timeout=8)
                return {"written": len(text), "sink": cmd[0]}
            except Exception:
                continue
    return {"written": 0, "sink": "unavailable"}


# ------------------------------------------------------ screenshots & recording
def _screenshot_dir() -> Path:
    d = Path.home() / "Pictures" / "Screenshots"
    d.mkdir(parents=True, exist_ok=True)
    return d


def cmd_screenshot(session=None, label: str = "", **_):
    """Capture the screen for real (X11/Wayland/Windows/macOS aware)."""
    target = _screenshot_dir() / f"thadd-{time.strftime('%Y%m%d-%H%M%S')}{'-' + label if label else ''}.png"
    attempts = []
    display = os.environ.get("DISPLAY", "")
    if display and shutil.which("scrot"):
        attempts.append(["scrot", "-o", str(target)])
    if display and shutil.which("import"):
        attempts.append(["import", "-window", "root", str(target)])
    if display and shutil.which("gnome-screenshot"):
        attempts.append(["gnome-screenshot", "-f", str(target)])
    if display and shutil.which("xfce4-screenshooter"):
        attempts.append(["xfce4-screenshooter", "-f", "-s", str(target)])
    if shutil.which("grim"):
        attempts.append(["grim", str(target)])
    if shutil.which("ffmpeg") and display:
        attempts.append(["ffmpeg", "-y", "-f", "x11grab", "-i", display, "-frames:v", "1", str(target)])
    for cmd in attempts:
        try:
            r = subprocess.run(cmd, capture_output=True, timeout=25)
            if target.exists() and target.stat().st_size:
                return {"path": str(target), "bytes": target.stat().st_size, "tool": cmd[0], "ok": True}
        except Exception:
            continue
    # no display: render a shell preview instead of failing
    try:
        from PIL import Image, ImageDraw  # type: ignore

        img = Image.new("RGB", (1280, 720), (12, 14, 26))
        d = ImageDraw.Draw(img)
        d.rectangle([0, 0, 1280, 34], fill=(22, 24, 40))
        d.text((16, 11), f"THADD OS — headless session ({os_pretty_name()})", fill=(200, 210, 255))
        for i, line in enumerate([
            "No graphical display was detected, so THADD rendered a virtual desktop snapshot.",
            f"host={os.uname().nodename}  kernel={os.uname().release}  user={os.environ.get('USER', 'thadd')}",
            "Run THADD from a graphical session (or the live ISO) for real screen capture.",
        ]):
            d.text((24, 70 + i * 26), line, fill=(150, 190, 255))
        img.save(target)
        return {"path": str(target), "bytes": target.stat().st_size, "tool": "thadd-virtual", "ok": True,
                "note": "no display server — virtual snapshot produced"}
    except Exception as exc:
        raise RpcError(f"screenshot failed and PIL unavailable: {exc}", "io")


RECORDINGS: dict[str, dict] = {}


def cmd_record_start(session, stream_id: str = "", fps: int = 24, display: str = "", **_):
    """Start a real screen recording (ffmpeg x11grab) or the browser recorder."""
    if not shutil.which("ffmpeg") or not (display or os.environ.get("DISPLAY")):
        return {"mode": "browser", "note": "no X display for server-side capture — the shell records via MediaRecorder"}
    disp = display or os.environ.get("DISPLAY")
    out = _screenshot_dir().parent / "Recordings"
    out.mkdir(parents=True, exist_ok=True)
    target = out / f"thadd-recording-{time.strftime('%Y%m%d-%H%M%S')}.mp4"
    cmd = ["ffmpeg", "-y", "-f", "x11grab", "-framerate", str(fps), "-i", disp,
           "-c:v", "libx264", "-preset", "veryfast", "-crf", "22", "-pix_fmt", "yuv420p", str(target)]
    proc = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
    RECORDINGS[str(proc.pid)] = {"pid": proc.pid, "target": str(target), "started": time.time(), "cmd": cmd}
    return {"mode": "ffmpeg", "pid": proc.pid, "target": str(target)}


def cmd_record_stop(session, pid: int = 0, **_):
    """Stop a server-side recording and return the MP4 path."""
    entry = RECORDINGS.pop(str(pid), None)
    if not entry:
        return {"stopped": False, "note": "no such recording"}
    try:
        os.kill(entry["pid"], 15)
    except OSError:
        pass
    time.sleep(1.2)
    size = os.path.getsize(entry["target"]) if os.path.exists(entry["target"]) else 0
    return {"stopped": True, "path": entry["target"], "bytes": size,
            "duration": round(time.time() - entry["started"], 1)}


def cmd_recordings(session=None, **_):
    """List recorded clips."""
    out = Path.home() / "Pictures" / "Recordings"
    items = []
    if out.is_dir():
        for p in sorted(out.glob("*.mp4"), key=lambda x: x.stat().st_mtime, reverse=True):
            items.append({"path": str(p), "size": p.stat().st_size,
                          "modified": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(p.stat().st_mtime))})
    return {"recordings": items}


# ------------------------------------------------------------------------- medias
def cmd_media(session=None, path: str = "", **_):
    """List audio/video files available to the media apps."""
    roots = [Path.home() / "Music", Path.home() / "Videos", Path.home() / "Downloads", Path("/usr/share/sounds")]
    audio_ext = {".mp3", ".wav", ".ogg", ".flac", ".m4a", ".opus", ".aac"}
    video_ext = {".mp4", ".mkv", ".webm", ".mov", ".avi"}
    audio, video = [], []
    for root in roots:
        if not root.is_dir():
            continue
        for dirpath, _dirs, files in os.walk(root):
            for f in files:
                p = Path(dirpath) / f
                ext = p.suffix.lower()
                if ext in audio_ext:
                    audio.append({"path": str(p), "name": p.name, "size": p.stat().st_size})
                elif ext in video_ext:
                    video.append({"path": str(p), "name": p.name, "size": p.stat().st_size})
    return {"audio": audio[:200], "video": video[:200], "count": len(audio) + len(video)}


def cmd_first_run(session=None, complete: bool = False, **_):
    """First-run state + the setup checklist."""
    path = data_dir() / "first-run.json"
    state = {"welcome_shown": False, "completed": False}
    if path.exists():
        try:
            state = json.loads(path.read_text())
        except Exception:
            pass
    if complete:
        state["completed"] = True
        state["welcome_shown"] = True
        path.write_text(json.dumps(state, indent=1))
    checklist = [
        {"id": "ai_key", "label": "Add your Groq API key to unlock the AI agent",
         "done": bool(Config().get("ai", "api_key") or os.environ.get("GROQ_API_KEY"))},
        {"id": "snapshot", "label": "Create your first restore point",
         "done": any((data_dir() / "snapshots").glob("*/manifest.json")) if (data_dir() / "snapshots").exists() else False},
        {"id": "security", "label": "Run a security posture check", "done": (data_dir() / "agent-audit.jsonl").exists()},
        {"id": "terminal", "label": "Open a terminal and try `neofetch` / `thadd --help`", "done": False},
        {"id": "store", "label": "Install your favourite tools from the App Store", "done": False},
    ]
    return {"state": state, "checklist": checklist, "done": sum(1 for c in checklist if c["done"]), "total": len(checklist)}


# ------------------------------------------------------------------------- misc
def cmd_render_video(session, article: str = "", out: str = "", seconds: int = 0, **_):
    """Render the THADD OS demo video (real H.264 MP4) — used for the README."""
    from .. import video as videomod

    return videomod.render_demo(session, out or article, seconds=seconds)
