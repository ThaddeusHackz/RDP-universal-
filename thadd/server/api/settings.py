"""THADD OS — Settings API (appearance, AI, security, system, shell, accounts).

All settings are stored in the THADD config document, applied live through the
event bus, and (where the OS allows) pushed down to the real system: hostname,
wallpaper, themes, DNS, timezone and the Groq API key.
"""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import time
from pathlib import Path

from ..config import Config, THADD_BUILD, THADD_CODENAME, THADD_EDITION, THADD_VERSION, data_dir, os_pretty_name
from ..core import BUS, RpcError
from ..ai import groq

WALLPAPER_DIRS = [Path(os.path.expanduser("~/.local/share/thadd/wallpapers")),
                  Path("/usr/share/thadd/wallpapers"), Path("/usr/share/backgrounds")]


def cmd_get(session=None, **_):
    """Read the whole settings document (secrets redacted)."""
    return Config().public()


def cmd_apply(session=None, patch: dict | None = None, **_):
    """Apply a settings patch (deep-merged), then broadcast it to every client."""
    if not isinstance(patch, dict):
        raise RpcError("patch must be an object", "bad_value")
    cfg = Config()
    for section, values in patch.items():
        if isinstance(values, dict):
            cfg.replace_section(section, values)
        else:
            cfg.set(section, "value", values)
    _apply_live(patch)
    BUS.publish("settings.changed", cfg.public())
    return {"ok": True, "applied": patch, "config": cfg.public()}


def _apply_live(patch: dict) -> None:
    """Push settings into the running OS where it is possible + safe."""
    if "system" in patch:
        sysset = patch["system"]
        if sysset.get("hostname"):
            name = re.sub(r"[^a-zA-Z0-9-]", "", sysset["hostname"])[:63]
            if name:
                for cmd in (["hostnamectl", "set-hostname", name], ["hostname", name]):
                    if shutil.which(cmd[0]):
                        subprocess.run(cmd, capture_output=True, timeout=10)
                        break
        if sysset.get("timezone") and shutil.which("timedatectl"):
            subprocess.run(["timedatectl", "set-timezone", sysset["timezone"]], capture_output=True, timeout=10)
    if "appearance" in patch and patch["appearance"].get("wallpaper"):
        wp = _wallpaper_path(patch["appearance"]["wallpaper"])
        if wp and shutil.which("xfconf-query"):
            for prop in ("/backdrop/screen0/monitor0/workspace0/last-image", "/backdrop/screen0/monitor0/last-image"):
                subprocess.run(["xfconf-query", "-c", "xfce4-desktop", "-p", prop, "-s", wp],
                               capture_output=True, timeout=8)
        if wp and os.environ.get("DISPLAY"):
            for cmd in (["feh", "--bg-scale", wp], ["hsetroot", "-fill", wp]):
                if shutil.which(cmd[0]):
                    subprocess.run(cmd, capture_output=True, timeout=10)
                    break
    if "security" in patch:
        sec = patch["security"]
        if sec.get("firewall") and shutil.which("ufw"):
            subprocess.run(["ufw", "--force", "enable"], capture_output=True, timeout=20)


def _wallpaper_path(name: str) -> str:
    if not name:
        return ""
    if name.startswith(("http://", "https://")):
        return name
    candidate = Path(os.path.expanduser(name))
    if candidate.exists():
        return str(candidate)
    for d in WALLPAPER_DIRS:
        for ext in (".jpg", ".jpeg", ".png", ".webp"):
            p = d / f"{name}{ext}"
            if p.exists():
                return str(p)
    return ""


def cmd_wallpapers(session=None, **_):
    """List available wallpapers + the built-in generated ones."""
    items = []
    for d in WALLPAPER_DIRS:
        if d.is_dir():
            for p in sorted(d.iterdir()):
                if p.suffix.lower() in (".jpg", ".jpeg", ".png", ".webp", ".svg"):
                    items.append({"id": p.stem, "name": p.name, "path": str(p), "dir": str(d)})
    builtin = [{"id": "thadd-nebula", "name": "THADD Nebula", "builtin": True},
               {"id": "thadd-aurora", "name": "THADD Aurora", "builtin": True},
               {"id": "thadd-grid", "name": "THADD Grid", "builtin": True},
               {"id": "thadd-macos", "name": "Sequoia Dusk", "builtin": True},
               {"id": "thadd-win11", "name": "Windows Bloom", "builtin": True}]
    return {"wallpapers": builtin + items, "directories": [str(d) for d in WALLPAPER_DIRS]}


def cmd_theme_import(session=None, name: str = "", colors: dict | None = None, **_):
    """Save a custom theme (name + colour roles) into the config."""
    if not name:
        raise RpcError("theme needs a name", "bad_value")
    cfg = Config()
    themes = dict(cfg.get("appearance", "custom_themes", {}) or {})
    themes[name] = colors or {}
    cfg.set("appearance", "custom_themes", themes)
    return {"saved": name, "themes": list(themes)}


def cmd_ai_key(session=None, api_key: str = "", **_):
    """Store the Groq API key securely (0600) and validate it."""
    cfg = Config()
    key = (api_key or "").strip()
    if key:
        if not re.match(r"^gsk_[A-Za-z0-9_\-]{20,}$", key):
            # still allow non-standard keys (proxies/self-hosted gateways)
            if len(key) < 20:
                raise RpcError("that does not look like an API key", "bad_value")
        cfg.set("ai", "api_key", key)
        os.environ["GROQ_API_KEY"] = key
        client = groq.GroqClient(key)
        probe = client.ping()
        return {"saved": True, "valid": probe.get("ok", False), "probe": probe,
                "key_hint": cfg.public()["ai"]["key_hint"]}
    cfg.set("ai", "api_key", "")
    return {"saved": True, "cleared": True}


def cmd_ai_test(session=None, prompt: str = "Reply with the single word: ready", model: str = "", **_):
    """Round-trip test against the Groq API (used by Settings → AI → Test)."""
    cfg = Config()
    key = cfg.get("ai", "api_key") or os.environ.get("GROQ_API_KEY", "")
    if not key:
        return {"ok": False, "error": "no API key configured", "offline_available": True}
    client = groq.GroqClient(key)
    started = time.time()
    try:
        msg = client.chat([{"role": "user", "content": prompt}], model=model or cfg.get("ai", "model"),
                          max_tokens=64, temperature=0.0)
        return {"ok": True, "latency_ms": int((time.time() - started) * 1000),
                "reply": (msg.get("content") or "").strip()[:400], "model": msg.get("_model"),
                "usage": msg.get("_usage", {})}
    except groq.GroqError as exc:
        return {"ok": False, "error": str(exc), "status": exc.status}


def cmd_ai_models(session=None, **_):
    """Available models for the configured provider."""
    cfg = Config()
    key = cfg.get("ai", "api_key") or os.environ.get("GROQ_API_KEY", "")
    if not key:
        return {"models": groq.GROQ_MODELS, "source": "built-in list (no API key)",
                "current": cfg.get("ai", "model")}
    models = groq.GroqClient(key).models()
    return {"models": models, "source": "live from Groq /v1/models", "current": cfg.get("ai", "model")}


def cmd_reset(session=None, section: str = "", **_):
    """Reset one section (or everything) to factory defaults."""
    cfg = Config()
    if section:
        from ..config import DEFAULTS

        if section not in DEFAULTS:
            raise RpcError(f"unknown section {section}", "bad_value")
        cfg.data[section] = json.loads(json.dumps(DEFAULTS[section]))
        cfg.save()
        return {"reset": section}
    from ..config import DEFAULTS

    cfg.data = json.loads(json.dumps(DEFAULTS))
    cfg.save()
    return {"reset": "all"}


def cmd_export(session=None, include_secrets: bool = False, **_):
    """Export settings as JSON (for backup / sharing a theme)."""
    cfg = Config()
    data = json.loads(json.dumps(cfg.data))
    if not include_secrets:
        data.get("ai", {}).pop("api_key", None)
    return {"json": json.dumps(data, indent=2), "exported": time.strftime("%Y-%m-%dT%H:%M:%S")}


def cmd_import(session=None, json_text: str = "", **_):
    """Import a settings document (validated, deep-merged)."""
    try:
        patch = json.loads(json_text)
    except json.JSONDecodeError as exc:
        raise RpcError(f"invalid JSON: {exc}", "bad_value")
    if not isinstance(patch, dict):
        raise RpcError("expected an object", "bad_value")
    return cmd_apply(session, patch=patch)


def cmd_about(session=None, **_):
    """THADD OS identity + build info for the About panel."""
    from ..api import system as sysapi

    info = sysapi.cmd_info()
    return {
        "product": os_pretty_name(),
        "version": THADD_VERSION,
        "codename": THADD_CODENAME,
        "build": THADD_BUILD,
        "edition": THADD_EDITION,
        "kernel": info["os"]["kernel"],
        "arch": info["os"]["arch"],
        "virtualization": info["os"]["virtualization"],
        "cpu": info["cpu"]["model"],
        "cores": info["cpu"]["cores"],
        "memory_gb": round(info["memory"]["total"] / 1e9, 1),
        "features": {
            "shell": "Nebula Prime (Windows 11 + macOS Sequoia hybrid)",
            "ai": "THADD AI agent (Groq) with real OS tools + offline fallback",
            "security": "Security Center: posture, scans, forensics, reverse engineering",
            "forensics": "Native NTFS / ext4 / HFS+ / APFS / FAT / registry readers",
            "snapshots": "Restore points with automatic pre-AI-edit capture",
            "terminals": "Full PTY: bash, zsh, fish, PowerShell, python, node, sqlite",
            "browsers": "Firefox, Chromium, Brave, Epiphany + text browsers",
            "dev": "gcc/g++, python, node, go, rust, java, git, docker, wine, qemu",
        },
        "credits": [
            "Shell, AI agent, GUI, forensics engine: THADD OS project",
            "AI inference: Groq (OpenAI-compatible chat completions API)",
            "Inspiration for an OS-embedded agent: JARVIS-style assistants (OpenJarvis et al.)",
            "Live-boot technique: squashfs + initramfs, in the tradition of Debian live-build",
        ],
        "license": "MIT (see LICENSE)",
    }
