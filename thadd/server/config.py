"""THADD OS — runtime configuration & paths.

One JSON document drives the whole userspace: appearance, AI provider, agent
autonomy, security policy, snapshot retention.  It is written to
``~/.config/thadd/config.json`` (or ``/etc/thadd/config.json`` when running as a
system service) and can be overridden by environment variables, which is what
the build/CI harness uses.
"""

from __future__ import annotations

import json
import os
import threading
from pathlib import Path
from typing import Any

OS_RELEASE = "/etc/os-release"
BUILD_INFO = "/etc/thadd/build-info"

# Source defaults.  A *running* THADD OS is asked what it is, though: the image
# writes its own identity to /etc/thadd/build-info (version, codename, base,
# profile, commit), and the Debian-live desktop image identifies as
# "2026.10 aurora" while these constants said "1.0 Nebula Prime" - so the
# assistant, the shell's About panel and the settings API all reported a
# *different* OS than the one they were running in.
THADD_VERSION = "1.0"
THADD_CODENAME = "Nebula Prime"
THADD_BUILD = "2026.10"
THADD_EDITION = "Universal Live (amd64)"


def _identity_from_os() -> tuple[str | None, str | None, str | None]:
    """(version, codename, profile) as the running system describes itself."""
    version = codename = profile = None
    try:
        with open(BUILD_INFO, encoding="utf-8", errors="replace") as fh:
            for line in fh:
                key, _, value = line.partition("=")
                value = value.strip()
                if not value:
                    continue
                if key == "THADD_OS_VERSION":
                    version = value
                elif key == "THADD_OS_CODENAME":
                    codename = value
                elif key == "THADD_OS_PROFILE":
                    profile = value
    except OSError:
        pass
    if version is None:
        # no build-info: accept THADD OS's own os-release, never Debian's
        try:
            with open(OS_RELEASE, encoding="utf-8", errors="replace") as fh:
                fields = {}
                for line in fh:
                    key, _, value = line.partition("=")
                    fields[key.strip()] = value.strip().strip('"')
            if fields.get("ID") == "thadd":
                version = (fields.get("VERSION") or "").split(" ")[0] or None
                if "(" in (fields.get("VERSION") or ""):
                    codename = fields["VERSION"].split("(")[-1].rstrip(")")
        except OSError:
            pass
    return version, codename, profile


_os_version, _os_codename, _os_profile = _identity_from_os()
if _os_version:
    THADD_VERSION = _os_version
if _os_codename:
    THADD_CODENAME = _os_codename
if _os_profile:
    THADD_EDITION = f"Universal Live ({_os_profile})"

DEFAULTS: dict[str, Any] = {
    "appearance": {
        "theme": "dark",            # dark | light | auto
        "accent": "#3b82f6",
        "shell_style": "hybrid",    # hybrid | windows11 | sequoia | linux
        "wallpaper": "thadd-nebula",
        "transparency": True,
        "animations": True,
        "dock_position": "bottom",
        "dock_size": 56,
        "font_scale": 1.0,
        "corners": "rounded",
        "reduce_motion": False,
        "haptics": False,
    },
    "ai": {
        "provider": "groq",
        "api_key": "",
        "model": "llama-3.3-70b-versatile",
        "fallback_model": "llama-3.1-8b-instant",
        "autonomy": "confirm",      # readonly | confirm | autopilot
        "stream": True,
        "temperature": 0.4,
        "max_tokens": 2048,
        "system_prompt": "",
        "voice": False,
        "offline_fallback": True,
    },
    "security": {
        "firewall": True,
        "hardening": True,
        "audit_log": True,
        "usb_guard": False,
        "auto_scan_on_boot": False,
        "panic_hotkey": "ctrl+alt+shift+w",
        "wipe_on_shutdown": False,
    },
    "snapshots": {
        "retention": 24,
        "auto_before_ai_write": True,
        "include": ["~/Documents", "~/Desktop", "~/Projects", "~/.config"],
    },
    "system": {
        "hostname": "thadd",
        "auto_login": True,
        "boot_to_shell": "desktop",
        "timezone": "auto",
        "locale": "en_US.UTF-8",
        "numlock": True,
        "ssh_server": False,
    },
    "shell": {
        "show_desktop_icons": True,
        "dock_autohide": False,
        "menubar_app_name": "THADD OS",
        "startup_sound": True,
        "demo_mode": False,
        "telemetry": False,
    },
}


def _deep_merge(base: dict, override: dict) -> dict:
    out = dict(base)
    for k, v in (override or {}).items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = _deep_merge(out[k], v)
        else:
            out[k] = v
    return out


class Config:
    def __init__(self, path: str | None = None):
        self._lock = threading.RLock()
        self.path = Path(path or os.environ.get("THADD_CONFIG") or default_config_path())
        self.data = json.loads(json.dumps(DEFAULTS))
        self.load()

    # ------------------------------------------------------------------- loading
    def load(self) -> None:
        with self._lock:
            if self.path.exists():
                try:
                    disk = json.loads(self.path.read_text())
                    self.data = _deep_merge(self.data, disk)
                except Exception:
                    pass
            self._apply_env()

    def _apply_env(self) -> None:
        env = os.environ
        if env.get("GROQ_API_KEY"):
            self.data["ai"]["api_key"] = env["GROQ_API_KEY"]
        if env.get("THADD_AI_MODEL"):
            self.data["ai"]["model"] = env["THADD_AI_MODEL"]
        if env.get("THADD_AI_AUTONOMY"):
            self.data["ai"]["autonomy"] = env["THADD_AI_AUTONOMY"]
        if env.get("THADD_THEME"):
            self.data["appearance"]["theme"] = env["THADD_THEME"]
        if env.get("THADD_SHELL_STYLE"):
            self.data["appearance"]["shell_style"] = env["THADD_SHELL_STYLE"]
        if env.get("THADD_DEMO"):
            self.data["shell"]["demo_mode"] = env["THADD_DEMO"] not in ("0", "no", "false")
        if env.get("THADD_HOSTNAME"):
            self.data["system"]["hostname"] = env["THADD_HOSTNAME"]

    def save(self) -> None:
        with self._lock:
            try:
                self.path.parent.mkdir(parents=True, exist_ok=True)
                tmp = self.path.with_suffix(".tmp")
                tmp.write_text(json.dumps(self.data, indent=2))
                tmp.replace(self.path)
                try:
                    os.chmod(self.path, 0o600)
                except OSError:
                    pass
            except OSError:
                pass

    # ------------------------------------------------------------------ accessors
    def get(self, section: str, key: str | None = None, default=None):
        with self._lock:
            sect = self.data.get(section, {})
            if key is None:
                return sect
            return sect.get(key, default)

    def set(self, section: str, key: str, value) -> None:
        with self._lock:
            self.data.setdefault(section, {})[key] = value
        self.save()

    def replace_section(self, section: str, values: dict) -> None:
        with self._lock:
            self.data[section] = _deep_merge(self.data.get(section, {}), values)
        self.save()

    def public(self) -> dict:
        """Config without secrets, safe to hand to the shell."""
        with self._lock:
            out = json.loads(json.dumps(self.data))
        ai = out.get("ai", {})
        key = ai.pop("api_key", "") or ""
        ai["has_key"] = bool(key)
        ai["key_hint"] = (key[:6] + "…" + key[-4:]) if len(key) > 12 else ("set" if key else "")
        out["version"] = THADD_VERSION
        out["codename"] = THADD_CODENAME
        out["build"] = THADD_BUILD
        out["edition"] = THADD_EDITION
        return out


def default_config_path() -> str:
    if os.geteuid() == 0 and os.path.isdir("/etc/thadd"):
        return "/etc/thadd/config.json"
    home = os.environ.get("HOME") or "/root"
    return os.path.join(home, ".config", "thadd", "config.json")


def data_dir() -> Path:
    if os.environ.get("THADD_DATA"):
        p = Path(os.environ["THADD_DATA"])
    elif os.geteuid() == 0 and os.path.isdir("/var/lib/thadd"):
        p = Path("/var/lib/thadd")
    else:
        p = Path(os.environ.get("HOME") or "/tmp") / ".thadd"
    p.mkdir(parents=True, exist_ok=True)
    return p


def os_pretty_name() -> str:
    try:
        for line in Path(OS_RELEASE).read_text().splitlines():
            if line.startswith("PRETTY_NAME="):
                return line.split("=", 1)[1].strip().strip('"')
    except OSError:
        pass
    return "THADD OS"
