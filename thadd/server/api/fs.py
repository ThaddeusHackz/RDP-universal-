"""THADD OS — real filesystem API used by Files, Editor, AI agent and backups.

Every path is validated against an optional sandbox root (``THADD_FS_ROOT``) so
the same code can run as a locked-down web preview *or* as a full-privilege live
OS session.  Symlinks are resolved before the check, which closes the classic
``../../../etc/shadow`` escape.
"""

from __future__ import annotations

import base64
import fnmatch
import mimetypes
import os
import shutil
import stat as statmod
import time
from pathlib import Path
from typing import Iterable

from ..config import data_dir
from ..core import RpcError

TEXT_MAX = 4 * 1024 * 1024
LIST_MAX = 5000
SANDBOX = os.environ.get("THADD_FS_ROOT") or ""

IMAGE_EXT = {".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp", ".svg", ".ico", ".tiff", ".avif"}
AUDIO_EXT = {".mp3", ".wav", ".ogg", ".flac", ".m4a", ".opus"}
VIDEO_EXT = {".mp4", ".webm", ".mkv", ".mov", ".avi"}
CODE_EXT = {".py", ".js", ".ts", ".jsx", ".tsx", ".c", ".h", ".cpp", ".hpp", ".rs", ".go", ".java", ".sh", ".bash",
            ".zsh", ".fish", ".ps1", ".rb", ".php", ".lua", ".sql", ".css", ".scss", ".html", ".htm", ".json",
            ".yaml", ".yml", ".toml", ".ini", ".cfg", ".conf", ".xml", ".md", ".txt", ".log", ".csv", ".tsv", ".qml"}
ARCHIVE_EXT = {".zip", ".tar", ".gz", ".bz2", ".xz", ".zst", ".7z", ".rar", ".deb", ".rpm", ".iso", ".img", ".whl"}


def _root_check(p: str) -> Path:
    path = Path(os.path.expandvars(os.path.expanduser(p))).absolute()
    if SANDBOX:
        root = Path(SANDBOX).resolve()
        real = Path(os.path.realpath(path))
        if real != root and root not in real.parents:
            raise RpcError(f"path outside the permitted root ({root})", "denied")
        return path
    return path


def _kind(name: str, path: Path) -> str:
    if path.is_dir():
        return "folder"
    ext = Path(name).suffix.lower()
    if ext in IMAGE_EXT:
        return "image"
    if ext in CODE_EXT:
        return "code"
    if ext in AUDIO_EXT:
        return "audio"
    if ext in VIDEO_EXT:
        return "video"
    if ext in ARCHIVE_EXT:
        return "archive"
    if ext in (".exe", ".dll", ".sys", ".msi"):
        return "windows"
    if ext in (".app", ".dmg"):
        return "macos"
    if ext in (".deb",):
        return "package"
    return "file"


def _entry(p: Path) -> dict:
    try:
        st = p.stat()
        is_link = p.is_symlink()
        return {
            "name": p.name,
            "path": str(p),
            "dir": p.is_dir(),
            "size": 0 if p.is_dir() else st.st_size,
            "mtime": st.st_mtime,
            "mode": oct(statmod.S_IMODE(st.st_mode)),
            "writable": os.access(p, os.W_OK),
            "hidden": p.name.startswith("."),
            "kind": _kind(p.name, p),
            "link": os.readlink(p) if is_link else None,
            "mime": mimetypes.guess_type(p.name)[0] or "",
        }
    except OSError as exc:
        return {"name": p.name, "path": str(p), "dir": False, "size": 0, "mtime": 0, "mode": "", "error": str(exc),
                "kind": "file", "hidden": p.name.startswith("."), "writable": False, "link": None, "mime": ""}


def cmd_fs_home(session=None, **_):
    """Home directory + the standard THADD places."""
    home = Path(os.path.expanduser("~"))
    places = {
        "Home": str(home),
        "Desktop": str(home / "Desktop"),
        "Documents": str(home / "Documents"),
        "Downloads": str(home / "Downloads"),
        "Pictures": str(home / "Pictures"),
        "Music": str(home / "Music"),
        "Videos": str(home / "Videos"),
        "Projects": str(home / "Projects"),
        "Scripts": str(home / "Scripts"),
    }
    return {"home": str(home), "places": places, "root": SANDBOX or "/", "data": str(data_dir())}


def cmd_fs_roots(session=None, **_):
    """Filesystem roots / mount points for the sidebar."""
    roots = [{"label": "Root", "path": "/", "kind": "disk"}]
    try:
        st = os.statvfs("/")
        roots[0]["percent"] = round(100 * (st.f_blocks - st.f_bavail) / st.f_blocks, 1) if st.f_blocks else 0
    except OSError:
        pass
    for mnt in ("/media", "/mnt", "/run/media"):
        if os.path.isdir(mnt):
            for child in sorted(Path(mnt).iterdir())[:12]:
                roots.append({"label": child.name, "path": str(child), "kind": "removable"})
    if os.path.isdir("/run/live/medium"):
        roots.append({"label": "THADD OS live medium", "path": "/run/live/medium", "kind": "optical"})
    return {"roots": roots, "sandbox": SANDBOX}


def cmd_fs_list(session=None, path: str = "~", show_hidden: bool = False, sort: str = "name", **_):
    """List a directory."""
    target = _root_check(path)
    if not target.exists():
        raise RpcError(f"no such directory: {target}", "not_found")
    if not target.is_dir():
        raise RpcError(f"not a directory: {target}", "not_dir")
    entries: list[dict] = []
    try:
        for child in target.iterdir():
            if child.name.startswith(".") and not show_hidden:
                continue
            entries.append(_entry(child))
    except PermissionError:
        raise RpcError(f"permission denied: {target}", "denied")
    key = {"name": lambda e: (not e["dir"], e["name"].lower()),
           "size": lambda e: (not e["dir"], -e["size"]),
           "date": lambda e: (not e["dir"], -e["mtime"]),
           "kind": lambda e: (not e["dir"], e["kind"], e["name"].lower())}.get(sort, None)
    if key:
        entries.sort(key=key)
    total = sum(e["size"] for e in entries)
    st = os.statvfs(target)
    return {
        "path": str(target),
        "parent": str(target.parent) if str(target) != "/" else None,
        "entries": entries[:LIST_MAX],
        "count": len(entries),
        "total_size": total,
        "truncated": len(entries) > LIST_MAX,
        "free": st.f_bavail * st.f_frsize,
        "banner": _banner(str(target)),
    }


BANNER_MAP = {"/": "System root — the entire THADD OS filesystem lives here.",
              "/home": "User home directories.",
              "/etc": "System configuration.",
              "/var/log": "System logs — handy when something misbehaves.",
              "/usr/bin": "Executables installed on this system.",
              "/run/live/medium": "The THADD OS ISO you booted from.",
              "/proc": "Live kernel interfaces (read-only)."}


def _banner(path: str) -> str:
    return BANNER_MAP.get(path.rstrip("/") or "/", "")


def cmd_fs_stat(session=None, path: str = "", **_):
    """Detailed metadata for one path, including sha256 for regular files."""
    p = _root_check(path)
    if not p.exists():
        raise RpcError("not found", "not_found")
    entry = _entry(p)
    if p.is_file() and p.stat().st_size < 512 * 1024 * 1024:
        import hashlib

        h = hashlib.sha256()
        with p.open("rb") as fh:
            for chunk in iter(lambda: fh.read(1 << 20), b""):
                h.update(chunk)
        entry["sha256"] = h.hexdigest()
        entry["text_preview"] = _text_preview(p)
    if p.is_dir():
        try:
            entry["children"] = len(list(p.iterdir()))
        except OSError:
            entry["children"] = -1
    return entry


def _text_preview(p: Path, limit: int = 4096) -> str:
    ext = p.suffix.lower()
    if ext in IMAGE_EXT.union(AUDIO_EXT).union(VIDEO_EXT).union(ARCHIVE_EXT):
        return ""
    try:
        raw = p.open("rb").read(limit)
    except OSError:
        return ""
    if b"\x00" in raw[:1024]:
        return ""
    return raw.decode("utf-8", "replace")


def cmd_fs_read(session=None, path: str = "", binary: bool = False, max_bytes: int = TEXT_MAX, **_):
    """Read a file as text (default) or base64."""
    p = _root_check(path)
    if not p.is_file():
        raise RpcError("not a file", "not_found")
    size = p.stat().st_size
    if size > 256 * 1024 * 1024:
        raise RpcError("file too large to open in the shell", "too_large")
    raw = p.open("rb").read(min(size, int(max_bytes)))
    if binary:
        return {"path": str(p), "size": size, "base64": base64.b64encode(raw).decode(), "mime": mimetypes.guess_type(p.name)[0] or ""}
    if b"\x00" in raw[:2048]:
        return {"path": str(p), "size": size, "binary": True, "base64": base64.b64encode(raw).decode(),
                "mime": mimetypes.guess_type(p.name)[0] or ""}
    return {"path": str(p), "size": size, "text": raw.decode("utf-8", "replace"), "mime": mimetypes.guess_type(p.name)[0] or ""}


def cmd_fs_write(session=None, path: str = "", text: str = "", base64_data: str = "", append: bool = False,
                 create_dirs: bool = True, backup: bool = True, **_):
    """Write a file (atomic, optional .thadd-bak backup).  Used by the editor + AI."""
    p = _root_check(path)
    if p.exists() and p.is_dir():
        raise RpcError("target is a directory", "bad_value")
    if create_dirs:
        p.parent.mkdir(parents=True, exist_ok=True)
    payload = base64.b64decode(base64_data) if base64_data else text.encode("utf-8")
    existed = p.exists()
    if backup and existed and p.stat().st_size < 64 * 1024 * 1024:
        try:
            shutil.copy2(p, str(p) + ".thadd-bak")
        except OSError:
            pass
    tmp = p.with_name(p.name + ".thadd-tmp")
    with tmp.open("wb") as fh:
        fh.write(payload)
    os.replace(tmp, p)
    return {"path": str(p), "bytes": len(payload), "created": not existed, "backup": f"{p}.thadd-bak" if existed and backup else ""}


def cmd_fs_mkdir(session=None, path: str = "", **_):
    """Create a directory (recursively)."""
    p = _root_check(path)
    if p.exists():
        raise RpcError("already exists", "exists")
    p.mkdir(parents=True)
    return _entry(p)


def cmd_fs_rename(session=None, path: str = "", new_name: str = "", **_):
    """Rename an entry in place."""
    p = _root_check(path)
    if not p.exists():
        raise RpcError("not found", "not_found")
    if "/" in new_name or new_name in ("", ".", ".."):
        raise RpcError("invalid name", "bad_value")
    target = p.with_name(new_name)
    if target.exists():
        raise RpcError("target exists", "exists")
    p.rename(target)
    return _entry(target)


def cmd_fs_copy(session=None, path: str = "", dest: str = "", move: bool = False, **_):
    """Copy or move a file/directory."""
    src = _root_check(path)
    dst = _root_check(dest)
    if not src.exists():
        raise RpcError("source not found", "not_found")
    if dst.is_dir():
        dst = dst / src.name
    if src.is_dir() and (str(dst).startswith(str(src) + os.sep)):
        raise RpcError("cannot copy a directory into itself", "bad_value")
    if dst.exists() and dst.is_file():
        dst = dst.with_name(dst.stem + "-copy" + dst.suffix)
    dst.parent.mkdir(parents=True, exist_ok=True)
    if move:
        shutil.move(str(src), str(dst))
    elif src.is_dir():
        shutil.copytree(src, dst, symlinks=True, dirs_exist_ok=True)
    else:
        shutil.copy2(src, dst)
    return {"path": str(dst), "moved": move}


def cmd_fs_trash(session=None, path: str = "", **_):
    """Move to the THADD trash (recoverable) instead of deleting outright."""
    p = _root_check(path)
    if not p.exists():
        raise RpcError("not found", "not_found")
    trash = data_dir() / "trash"
    trash.mkdir(parents=True, exist_ok=True)
    stamp = time.strftime("%Y%m%d-%H%M%S")
    target = trash / f"{stamp}-{p.name}"
    shutil.move(str(p), str(target))
    (trash / f"{target.name}.meta").write_text(f"{p}\n{time.time()}\n")
    return {"trashed": str(target), "original": str(p)}


def cmd_fs_trash_list(session=None, **_):
    """List trashed items."""
    trash = data_dir() / "trash"
    items = []
    if trash.exists():
        for child in sorted(trash.iterdir(), reverse=True):
            if child.name.endswith(".meta"):
                continue
            items.append(_entry(child))
    return {"items": items, "path": str(trash)}


def cmd_fs_untrash(session=None, name: str = "", dest: str = "~", **_):
    """Restore an item from the trash."""
    trash = data_dir() / "trash"
    src = trash / Path(name).name
    if not src.exists():
        raise RpcError("not in trash", "not_found")
    target = _root_check(dest) / Path(name).name.split("-", 2)[-1]
    shutil.move(str(src), str(target))
    meta = trash / f"{src.name}.meta"
    if meta.exists():
        meta.unlink()
    return {"restored": str(target)}


def cmd_fs_delete(session=None, path: str = "", recursive: bool = True, **_):
    """Permanently delete (the shell asks for confirmation first)."""
    p = _root_check(path)
    if str(p) in ("/", "/home", "/usr", "/etc", "/var", str(Path.home())):
        raise RpcError("refusing to delete a critical path", "denied")
    if not p.exists():
        raise RpcError("not found", "not_found")
    if p.is_dir():
        if not recursive:
            p.rmdir()
        else:
            shutil.rmtree(p)
    else:
        p.unlink()
    return {"deleted": str(p)}


def cmd_fs_search(session=None, root: str = "~", query: str = "", limit: int = 200, max_depth: int = 6,
                  content: bool = False, **_):
    """Recursive name search (optionally inside file contents)."""
    base = _root_check(root)
    if not base.is_dir():
        raise RpcError("search root must be a directory", "bad_value")
    limit = max(1, min(int(limit), 1000))
    needle = query.lower()
    hits: list[dict] = []
    skip = {".git", "node_modules", "__pycache__", ".cache", ".venv", "venv", "proc", "sys", "dev", "run"}
    for dirpath, dirnames, filenames in os.walk(base):
        depth = str(dirpath).count(os.sep) - str(base).count(os.sep)
        if depth > max_depth:
            dirnames[:] = []
            continue
        dirnames[:] = [d for d in dirnames if d not in skip and not d.startswith(".")]
        for name in dirnames + filenames:
            if needle in name.lower() or fnmatch.fnmatch(name.lower(), f"*{needle}*"):
                hits.append(_entry(Path(dirpath) / name))
                if len(hits) >= limit:
                    return {"hits": hits, "truncated": True, "query": query}
        if content:
            for name in filenames:
                if len(hits) >= limit:
                    break
                fp = Path(dirpath) / name
                if fp.stat().st_size > 2 * 1024 * 1024 or fp.suffix.lower() not in CODE_EXT:
                    continue
                try:
                    txt = fp.read_text(errors="ignore").lower()
                except OSError:
                    continue
                if needle and needle in txt:
                    line_no = next((i + 1 for i, l in enumerate(txt.splitlines()) if needle in l), 0)
                    hits.append({**_entry(fp), "match_line": line_no})
    return {"hits": hits, "truncated": len(hits) >= limit, "query": query}


def cmd_fs_usage(session=None, path: str = "~", depth: int = 1, **_):
    """Disk usage of a tree (top consumers), like `du` but structured."""
    base = _root_check(path)
    if not base.is_dir():
        raise RpcError("not a directory", "bad_value")
    sizes: dict[str, int] = {}
    try:
        for child in base.iterdir():
            if child.is_dir():
                total = 0
                for dirpath, _dirs, files in os.walk(child):
                    for f in files:
                        try:
                            total += (Path(dirpath) / f).lstat().st_size
                        except OSError:
                            pass
                sizes[child.name] = total
            else:
                try:
                    sizes[child.name] = child.stat().st_size
                except OSError:
                    pass
    except PermissionError:
        raise RpcError("permission denied", "denied")
    ordered = sorted(sizes.items(), key=lambda kv: kv[1], reverse=True)[:80]
    return {"path": str(base), "usage": [{"name": k, "size": v} for k, v in ordered],
            "total": sum(sizes.values())}


def cmd_fs_thumbnail(session=None, path: str = "", size: int = 256, **_):
    """Generate a thumbnail for an image (PIL when present, else raw passthrough)."""
    p = _root_check(path)
    if not p.is_file():
        raise RpcError("not found", "not_found")
    try:
        from PIL import Image  # type: ignore
    except ImportError:
        return {"path": str(p), "base64": base64.b64encode(p.read_bytes()).decode(), "scaled": False,
                "mime": mimetypes.guess_type(p.name)[0] or ""}
    try:
        img = Image.open(p)
        img.thumbnail((int(size), int(size)))
        if img.mode not in ("RGB", "RGBA"):
            img = img.convert("RGBA")
        import io

        buf = io.BytesIO()
        img.save(buf, format="PNG", optimize=True)
        return {"path": str(p), "base64": base64.b64encode(buf.getvalue()).decode(), "scaled": True, "mime": "image/png"}
    except Exception as exc:
        raise RpcError(f"thumbnail failed: {exc}", "unsupported")


def cmd_fs_recent(session=None, limit: int = 40, **_):
    """Recently modified files across the usual user folders."""
    home = Path.home()
    cutoff = time.time() - 14 * 86400
    found: list[dict] = []
    for folder in ("Desktop", "Documents", "Downloads", "Pictures", "Projects", "Scripts", ".config/thadd"):
        base = home / folder
        if not base.is_dir():
            continue
        for dirpath, dirnames, filenames in os.walk(base):
            dirnames[:] = [d for d in dirnames if d not in (".git", "node_modules", "__pycache__")]
            for name in filenames:
                fp = Path(dirpath) / name
                try:
                    mtime = fp.stat().st_mtime
                except OSError:
                    continue
                if mtime >= cutoff:
                    found.append(_entry(fp))
    found.sort(key=lambda e: e["mtime"], reverse=True)
    return {"files": found[: int(limit)]}


def cmd_fs_mounts(session=None, **_):
    """Block devices and mounts (drives the 'Disks' pane)."""
    mounts = []
    for line in Path("/proc/mounts").read_text().splitlines():
        parts = line.split()
        if len(parts) >= 3 and parts[2] not in ("proc", "sysfs", "tmpfs", "devpts", "cgroup", "cgroup2", "securityfs", "debugfs", "tracefs", "pstore", "bpf", "mqueue", "hugetlbfs", "configfs", "fusectl", "autofs", "binfmt_misc", "efivarfs", "ramfs", "devtmpfs"):
            mounts.append({"device": parts[0], "mount": parts[1].replace("\\040", " "), "fstype": parts[2], "options": parts[3]})
    return {"mounts": mounts}
