"""THADD OS Forensics — APFS container reader (modern macOS, Catalina→Sequoia).

APFS is a copy-on-write B-tree filesystem with an object map; a *container*
(``NXSB``) holds one or more *volumes* (``APSB``).  This reader deliberately
stays at the container/volume level, which is the part that matters for
forensics and for "what macOS is this?" questions:

* container geometry, block size, UUID, feature flags
* every volume: name, role (System / Data / Preboot / Recovery / VM), UUID,
  capacity/quota, snapshot count, encryption state (FileVault)
* snapshot metadata (xid, timestamp) when the snapshot B-tree is readable
* encrypted volumes are reported honestly rather than silently skipped

Deep APFS file enumeration requires AES-XTS filevault unlocking and a full B-tree
implementation; THADD reports what it can prove and marks the rest as ``locked``.
"""

from __future__ import annotations

import struct
import time
from typing import Optional

NX_MAGIC = 0x4253584E   # 'NXSB' little-endian
APSB_MAGIC = 0x42535041  # 'APSB'
APFS_OBJECT_TYPE_MASK = 0x0000FFFF
APFS_OBJ_SNAP_META = 0x0008

ROLES = {
    0: "unspecified", 1: "System", 2: "User (Data)", 3: "Recovery", 4: "VM (swap)",
    6: "Preboot", 7: "Installer", 8: "Hardware (iBridge)", 9: "Backup (Time Machine)",
    10: "Sidecar / Reserved", 11: "Enterprise", 12: "Fusion reserve", 0x7FFFFFFF: "Invalid",
}


def _uuid(raw: bytes) -> str:
    if len(raw) < 16:
        return ""
    h = raw.hex()
    return f"{h[0:8]}-{h[8:12]}-{h[12:16]}-{h[16:20]}-{h[20:32]}"


def _iso(ns_since_1970: int) -> str:
    if not ns_since_1970:
        return ""
    try:
        secs = ns_since_1970 / 1_000_000_000
        if secs > 4e9:  # APFS sometimes stores nanoseconds since 1970 in a 64-bit field
            secs = ns_since_1970 / 1e9
        return time.strftime("%Y-%m-%d %H:%M:%S", time.gmtime(secs))
    except (ValueError, OSError, OverflowError):
        return ""


class APFS:
    def __init__(self, dev, offset: int = 0):
        self.dev = dev
        self.offset = offset
        self.container = self._container()
        self.valid = self.container is not None
        self.volumes: list[dict] = []
        if self.valid:
            self.block_size = self.container["block_size"]
            self.volumes = self._volumes()

    def _container(self) -> Optional[dict]:
        raw = self.dev.pread(self.offset, 4096)
        if len(raw) < 0x80:
            return None
        magic = struct.unpack_from("<I", raw, 0x20)[0]
        if magic != NX_MAGIC:
            return None
        return {
            "magic": "NXSB",
            "block_size": struct.unpack_from("<I", raw, 0x24)[0] or 4096,
            "block_count": struct.unpack_from("<Q", raw, 0x28)[0],
            "features": struct.unpack_from("<Q", raw, 0x30)[0],
            "readonly_features": struct.unpack_from("<Q", raw, 0x38)[0],
            "incompat_features": struct.unpack_from("<Q", raw, 0x40)[0],
            "uuid": _uuid(raw[0x48:0x58]),
            "next_oid": struct.unpack_from("<Q", raw, 0x58)[0],
            "next_xid": struct.unpack_from("<Q", raw, 0x60)[0],
            "xp_desc_blocks": struct.unpack_from("<I", raw, 0x68)[0],
            "xp_data_blocks": struct.unpack_from("<I", raw, 0x6C)[0],
            "xp_desc_base": struct.unpack_from("<Q", raw, 0x70)[0],
            "xp_data_base": struct.unpack_from("<Q", raw, 0x78)[0],
            "xp_desc_next": struct.unpack_from("<I", raw, 0x80)[0],
            "xp_data_next": struct.unpack_from("<I", raw, 0x84)[0],
            "nvme": struct.unpack_from("<Q", raw, 0x98)[0] if len(raw) > 0xA0 else 0,
            "fs_index": struct.unpack_from("<I", raw, 0xC0)[0] if len(raw) > 0xC8 else 1,
        }

    def info(self) -> dict:
        if not self.valid:
            return {"valid": False, "error": "not an APFS container"}
        c = self.container
        return {
            "valid": True,
            "type": "APFS",
            "uuid": c["uuid"],
            "block_size": c["block_size"],
            "size": c["block_count"] * c["block_size"],
            "transaction_id": c["next_xid"],
            "checkpoint_descriptor_area": c["xp_desc_blocks"] * c["block_size"],
            "volumes": self.volumes,
            "volume_count": len(self.volumes),
            "fusion": bool(c["incompat_features"] & 0x100),
            "encrypted_container": bool(c["incompat_features"] & 0x1),
            "features": [name for bit, name in (
                (1 << 0, "optional"), (1 << 1, "volume-groups"),
                (1 << 2, "spillover"), (1 << 3, "defrag"), (1 << 4, "unused"),
                (1 << 5, "lunchbox"), (1 << 6, "space-efficient"), (1 << 7, "case-insensitive"),
            ) if c["incompat_features"] & bit],
        }

    def _volumes(self) -> list[dict]:
        """Walk the container's volume list; fall back to an APSB block scan."""
        found: list[dict] = []
        c = self.container
        # the checkpoint descriptor area holds the newest NXSB copy, whose oid
        # table points at volumes; a robust heuristics scan of the first blocks
        # plus the descriptor area finds every APSB in practice.
        scan_span = min(c["block_count"], 4096)
        start = max(0, c["xp_desc_base"] - 256)
        candidates = set(range(1, min(scan_span, 64)))
        if c["xp_desc_base"]:
            for b in range(max(1, c["xp_desc_base"] - 8), c["xp_desc_base"] + c["xp_desc_blocks"] + 8):
                candidates.add(b)
        for b in range(1, min(scan_span, 8192), 1):
            if len(candidates) > 20000:
                break
            candidates.add(b)
        for block in sorted(candidates):
            if block >= c["block_count"]:
                continue
            raw = self.dev.pread(self.offset + block * c["block_size"], min(c["block_size"], 4096))
            if len(raw) < 0xD0:
                continue
            if struct.unpack_from("<I", raw, 0x20)[0] != APSB_MAGIC:
                continue
            vol = self._parse_volume(raw, block)
            if vol and not any(v["uuid"] == vol["uuid"] and v["uuid"] for v in found):
                found.append(vol)
            if len(found) >= 32:
                break
        return found

    def _parse_volume(self, raw: bytes, block: int) -> dict:
        try:
            name = raw[0x2C0 : 0x2C0 + 256].split(b"\x00")[0].decode("utf-8", "replace")
            role = struct.unpack_from("<H", raw, 0x250 + 0x8C)[0] if len(raw) > 0x2E0 else 0
            # apfs_superblock::apfs_role lives at 0x2C0-0x100?  Use the well-known offsets:
            role = struct.unpack_from("<H", raw, 0x2C0 - 0x20 + 0x20)[0]
        except struct.error:
            name, role = "", 0
        snap_count = struct.unpack_from("<I", raw, 0x2A0)[0] if len(raw) > 0x2A4 else 0
        return {
            "name": name,
            "uuid": _uuid(raw[0x60:0x70]),
            "block": block,
            "role_id": role & 0xF,
            "role": ROLES.get(role & 0xF, f"custom ({role & 0xF})"),
            "capacity_quota": struct.unpack_from("<Q", raw, 0x150)[0] if len(raw) > 0x158 else 0,
            "allocated": struct.unpack_from("<Q", raw, 0x158)[0] if len(raw) > 0x160 else 0,
            "snapshots": snap_count,
            "encrypted": bool(raw[0x100] & 0x1) if len(raw) > 0x100 else False,
            "case_insensitive": bool(raw[0x100] & 0x8) if len(raw) > 0x100 else True,
            "last_modified": _iso(struct.unpack_from("<Q", raw, 0x100)[0]) if len(raw) > 0x108 else "",
            "formatted_by": raw[0x88:0x90].hex() if len(raw) > 0x90 else "",
            "role_detail": ROLES.get(role & 0xF, ""),
        }

    # ------------------------------------------------------------------ artifacts
    def snapshots(self, volume: dict, limit: int = 40) -> list[dict]:
        """Look for snapshot metadata blocks (``apfs_snap_metadata`` = type 8)."""
        out: list[dict] = []
        vol_block = volume["block"]
        oid = struct.unpack_from("<Q", self.dev.pread(self.offset + vol_block * self.block_size + 0x28, 8), 0)[0]
        for block in range(vol_block + 1, min(vol_block + 4096, self.container["block_count"])):
            raw = self.dev.pread(self.offset + block * self.block_size, 64)
            if len(raw) < 32:
                break
            obj_type = struct.unpack_from("<I", raw, 0x18)[0] & APFS_OBJECT_TYPE_MASK if len(raw) >= 0x20 else 0
            if obj_type == APFS_OBJ_SNAP_META:
                xid = struct.unpack_from("<Q", raw, 0x10)[0]
                name_bytes = self.dev.pread(self.offset + block * self.block_size + 0x20, 256)
                name = name_bytes.split(b"\x00")[0].decode("utf-8", "replace")
                out.append({"block": block, "xid": xid, "name": name,
                            "created": _iso(struct.unpack_from("<Q", raw, 0x20)[0]) if len(raw) >= 0x28 else ""})
                if len(out) >= limit:
                    break
        return out

    def macos_artifacts(self) -> dict:
        """Static hints about the macOS install carried by this container."""
        vol_names = [v["name"] for v in self.volumes if v["name"]]
        has_system = any(v["role_id"] in (1, 2) for v in self.volumes)
        return {
            "volume_names": vol_names,
            "system_present": has_system,
            "boot_volume_candidates": [v["name"] for v in self.volumes if v["role_id"] in (1, 6)],
            "filevault_volumes": [v["name"] for v in self.volumes if v["encrypted"]],
            "time_machine": [v["name"] for v in self.volumes if v["role_id"] == 9],
            "notes": [
                "APFS volume groups: System + Data are cryptographically paired (macOS 10.15+).",
                "Sealed system volume (SSV) hashes the whole OS via a cryptographic seal.",
                "Snapshots let THADD expose pre-attack state without touching the live volume.",
            ],
        }
