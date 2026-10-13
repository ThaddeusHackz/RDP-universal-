"""THADD OS — Snapshots (restore points).

A snapshot is a real ``tar.gz`` of the configured user paths plus a manifest with
hashes and metadata.  Restoring replaces files with the snapshot version, and
every snapshot is verifiable (per-file sha256) so the shell can show a diff.

Snapshots are what make THADD's AI agent safe: the agent can snapshot before a
risky edit, and the user can roll the machine back in one click.
"""

from __future__ import annotations

import hashlib
import json
import os
import shutil
import tarfile
import time
import uuid
from pathlib import Path

from ..config import Config, data_dir
from ..core import BUS, RpcError, Stream

SNAP_DIRNAME = "snapshots"
MAX_MANIFEST_FILES = 20000


def snapshots_dir() -> Path:
    d = data_dir() / SNAP_DIRNAME
    d.mkdir(parents=True, exist_ok=True)
    return d


def _default_paths() -> list[str]:
    cfg = Config()
    configured = cfg.get("snapshots", "include") or []
    out = []
    for p in configured:
        expanded = os.path.expanduser(p)
        if os.path.exists(expanded):
            out.append(expanded)
    home = Path.home()
    for extra in ("Projects", "Scripts"):
        cand = home / extra
        if cand.is_dir() and str(cand) not in out:
            out.append(str(cand))
    return out or [str(home)]


def _hash_file(path: Path) -> str:
    h = hashlib.sha256()
    try:
        with path.open("rb") as fh:
            for chunk in iter(lambda: fh.read(1 << 20), b""):
                h.update(chunk)
    except OSError:
        return ""
    return h.hexdigest()


def cmd_create(session=None, label: str = "", paths: list[str] | None = None, note: str = "", **_):
    """Create a restore point of the user's files."""
    snap_id = time.strftime("%Y%m%d-%H%M%S") + "-" + uuid.uuid4().hex[:4]
    target_dir = snapshots_dir() / snap_id
    target_dir.mkdir(parents=True, exist_ok=True)
    archive = target_dir / "files.tar.gz"
    sources = [os.path.expanduser(p) for p in (paths or _default_paths())]
    sources = [p for p in sources if os.path.exists(p)]
    if not sources:
        raise RpcError("nothing to snapshot — none of the configured paths exist", "bad_value")

    manifest = {"id": snap_id, "label": label or "manual snapshot", "note": note,
                "created": time.time(), "created_iso": time.strftime("%Y-%m-%dT%H:%M:%S"),
                "sources": sources, "host": os.uname().nodename, "user": os.environ.get("USER", "thadd"),
                "files": [], "file_count": 0, "bytes": 0, "archive": str(archive), "thadd_version": "1.0"}
    started = time.time()
    skipped = 0
    home = str(Path.home())
    with tarfile.open(archive, "w:gz", compresslevel=6) as tar:
        for src in sources:
            for dirpath, dirnames, filenames in os.walk(src):
                dirnames[:] = [d for d in dirnames if d not in
                               (".git", "node_modules", "__pycache__", ".cache", ".venv", "venv", "target", "dist", "build")]
                for name in filenames:
                    fp = Path(dirpath) / name
                    try:
                        size = fp.stat().st_size
                    except OSError:
                        continue
                    if size > 512 * 1024 * 1024 or len(manifest["files"]) >= MAX_MANIFEST_FILES:
                        skipped += 1
                        continue
                    rel = str(fp).replace(home, "~")
                    digest = _hash_file(fp)
                    manifest["files"].append({"path": rel, "size": size, "sha256": digest,
                                              "mtime": int(fp.stat().st_mtime)})
                    manifest["file_count"] += 1
                    manifest["bytes"] += size
                    try:
                        tar.add(str(fp), arcname=str(fp).lstrip("/"))
                    except (OSError, tarfile.TarError):
                        skipped += 1
    manifest["skipped"] = skipped
    manifest["elapsed"] = round(time.time() - started, 2)
    manifest["archive_size"] = archive.stat().st_size if archive.exists() else 0
    (target_dir / "manifest.json").write_text(json.dumps(manifest, indent=2))
    BUS.publish("snapshot.created", {"id": snap_id, "label": manifest["label"], "files": manifest["file_count"]})
    return {k: v for k, v in manifest.items() if k != "files"}


def cmd_list(session=None, **_):
    """List restore points, newest first."""
    out = []
    for entry in sorted(snapshots_dir().iterdir(), reverse=True):
        manifest = entry / "manifest.json"
        if not manifest.exists():
            continue
        try:
            data = json.loads(manifest.read_text())
        except Exception:
            continue
        out.append({k: v for k, v in data.items() if k != "files"})
    return {"snapshots": out, "count": len(out), "directory": str(snapshots_dir())}


def _load_manifest(snap_id: str) -> dict:
    safe = "".join(ch for ch in snap_id if ch.isalnum() or ch in "-_")
    path = snapshots_dir() / safe / "manifest.json"
    if not path.exists():
        raise RpcError(f"snapshot not found: {snap_id}", "not_found")
    return json.loads(path.read_text())


def cmd_show(session=None, snapshot: str = "", **_):
    """Show a snapshot's manifest (file list, hashes, size)."""
    data = _load_manifest(snapshot)
    data["files"] = data.get("files", [])[:5000]
    return data


def cmd_diff(session=None, snapshot: str = "", **_):
    """Compare a snapshot against the current filesystem state."""
    data = _load_manifest(snapshot)
    home = str(Path.home())
    changed, missing, extra = [], [], []
    for item in data.get("files", []):
        path = Path(os.path.expanduser(item["path"]))
        if not path.exists():
            missing.append(item["path"])
            continue
        if int(path.stat().st_mtime) != item["mtime"] or path.stat().st_size != item["size"]:
            current = _hash_file(path)
            if current != item["sha256"]:
                changed.append({"path": item["path"], "old_mtime": item["mtime"],
                                "new_mtime": int(path.stat().st_mtime), "old_size": item["size"],
                                "new_size": path.stat().st_size})
    for src in data.get("sources", []):
        if not os.path.isdir(src):
            continue
        known = {os.path.expanduser(i["path"]) for i in data.get("files", [])}
        for dirpath, _dirs, files in os.walk(src):
            for f in files:
                fp = os.path.join(dirpath, f)
                if fp not in known:
                    extra.append(fp.replace(home, "~"))
    return {"snapshot": snapshot, "changed": changed[:500], "missing": missing[:500],
            "new_files": extra[:500], "counts": {"changed": len(changed), "missing": len(missing), "new": len(extra)}}


def cmd_restore(session=None, snapshot: str = "", paths_only: list[str] | None = None, dry_run: bool = False, **_):
    """Restore files from a snapshot (optionally a subset)."""
    data = _load_manifest(snapshot)
    archive = Path(data["archive"])
    if not archive.exists():
        raise RpcError("snapshot archive is missing", "not_found")
    restore_root = "/"
    plan: list[str] = []
    want = None
    if paths_only:
        want = {os.path.expanduser(p).lstrip("/") for p in paths_only}
    with tarfile.open(archive, "r:gz") as tar:
        members = tar.getmembers()
        for m in members:
            if not m.isfile() and not m.isdir():
                continue
            if want and not any(m.name.startswith(w) or w.startswith(m.name) for w in want):
                continue
            plan.append(m.name)
        if dry_run:
            return {"snapshot": snapshot, "would_restore": len(plan), "dry_run": True, "sample": plan[:50]}
        safety = None
        if not paths_only:
            try:
                safety = cmd_create(None, label=f"pre-restore safety ({snapshot})")["id"]
            except RpcError:
                safety = None
        restored = 0
        out_dir = data_dir() / "restored" / snapshot
        if paths_only is None and not os.access("/", os.W_OK):
            out_dir.mkdir(parents=True, exist_ok=True)
            tar.extractall(out_dir, filter="data")
            return {"snapshot": snapshot, "restored_to": str(out_dir), "restored": len(plan),
                    "note": "target root is not writable — extracted into the restore folder instead"}
        for m in members:
            if m.name not in plan:
                continue
            try:
                tar.extract(m, restore_root, filter="data")
                restored += 1
            except Exception:
                continue
    BUS.publish("snapshot.restored", {"id": snapshot, "files": restored})
    return {"snapshot": snapshot, "restored": restored, "safety_snapshot": safety, "label": data.get("label")}


def cmd_delete(session=None, snapshot: str = "", **_):
    """Delete a restore point."""
    safe = "".join(ch for ch in snapshot if ch.isalnum() or ch in "-_")
    path = snapshots_dir() / safe
    if not path.exists():
        raise RpcError("snapshot not found", "not_found")
    shutil.rmtree(path)
    return {"deleted": snapshot}


def cmd_prune(session=None, keep: int = 0, **_):
    """Enforce the retention policy (automatic or explicit)."""
    keep = int(keep or Config().get("snapshots", "retention", 24) or 24)
    items = sorted([p for p in snapshots_dir().iterdir() if (p / "manifest.json").exists()], reverse=True)
    removed = []
    for entry in items[keep:]:
        shutil.rmtree(entry, ignore_errors=True)
        removed.append(entry.name)
    return {"kept": [p.name for p in items[:keep]], "removed": removed, "retention": keep}


def cmd_archive_path(session=None, snapshot: str = "", **_):
    """Where the snapshot tarball lives (for the Files app / SFTP)."""
    data = _load_manifest(snapshot)
    return {"path": data["archive"], "size": os.path.getsize(data["archive"]) if os.path.exists(data["archive"]) else 0}
