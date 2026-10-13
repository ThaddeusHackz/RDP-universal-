"""THADD OS Forensics — Windows registry hive (``regf``) reader.

Reads hives without touching a Windows machine: enumerates keys, values and the
data needed for the highest-value DFIR questions (USB history, autostarts,
installed software, user accounts, last-login times, network history).

Implements: hive header, hbin blocks, ``nk``/``vk``/``sk`` cells, ``lf``/``lh``/
``li``/``ri`` subkey lists, and value data (including ``DB``/``AB`` big-data
indirect blocks).
"""

from __future__ import annotations

import struct
import time
from typing import Iterator, Optional

REGF = b"regf"

VALUE_TYPES = {
    0: "REG_NONE", 1: "REG_SZ", 2: "REG_EXPAND_SZ", 3: "REG_BINARY", 4: "REG_DWORD",
    5: "REG_DWORD_BIG_ENDIAN", 6: "REG_LINK", 7: "REG_MULTI_SZ", 8: "REG_RESOURCE_LIST",
    9: "REG_FULL_RESOURCE_DESCRIPTOR", 10: "REG_RESOURCE_REQUIREMENTS_LIST", 11: "REG_QWORD",
}

SUBKEY_LISTS = (b"lf", b"lh", b"li", b"ri")


def _filetime(raw: bytes) -> str:
    if len(raw) < 8:
        return ""
    ticks = struct.unpack("<Q", raw[:8])[0]
    if not ticks:
        return ""
    try:
        secs = ticks / 10_000_000 - 11644473600
        if secs <= 0 or secs > 4e9:
            return ""
        return time.strftime("%Y-%m-%d %H:%M:%S", time.gmtime(secs))
    except (ValueError, OSError, OverflowError):
        return ""


class Hive:
    def __init__(self, dev, offset: int = 0):
        self.dev = dev
        self.offset = offset
        self.valid = False
        self.hbins: list[tuple[int, int]] = []  # (relative_offset, size)
        self._load()

    def _load(self) -> None:
        head = self.dev.pread(self.offset, 4096)
        if len(head) < 512 or head[:4] != REGF:
            return
        self.valid = True
        self.sequence1 = struct.unpack_from("<I", head, 4)[0]
        self.sequence2 = struct.unpack_from("<I", head, 8)[0]
        self.major = struct.unpack_from("<I", head, 0x14)[0]
        self.minor = struct.unpack_from("<I", head, 0x18)[0]
        self.type = struct.unpack_from("<I", head, 0x1C)[0]
        self.root_cell = struct.unpack_from("<I", head, 0x24)[0]
        self.hive_bins_size = struct.unpack_from("<I", head, 0x28)[0]
        self.file_name = head[0x30:0x30 + 64].split(b"\x00")[0].decode("utf-16-le", "replace")
        # enumerate hbin blocks
        pos = 0x1000
        guard = 0
        while guard < 200000:
            sig = self.dev.pread(self.offset + pos, 4)
            if sig != b"hbin":
                break
            size = struct.unpack("<I", self.dev.pread(self.offset + pos + 8, 4))[0]
            if size < 0x1000:
                break
            self.hbins.append((pos, size))
            pos += size
            guard += 1

    # ------------------------------------------------------------------ plumbing
    def cell(self, rel_offset: int) -> Optional[bytes]:
        raw = self.dev.pread(self.offset + rel_offset, 4)
        if len(raw) < 4:
            return None
        size = struct.unpack("<i", raw)[0]
        if size >= 0:
            return None  # free cell
        return self.dev.pread(self.offset + rel_offset + 4, -size - 4)

    def cell_type(self, rel_offset: int) -> str:
        return self.dev.pread(self.offset + rel_offset + 4, 2).decode("latin-1", "replace")

    def info(self) -> dict:
        if not self.valid:
            return {"valid": False, "error": "not a registry hive"}
        root = self.key(self.root_cell)
        return {
            "valid": True, "type": "Windows registry hive",
            "name": self.file_name or "unknown",
            "format": f"{self.major}.{self.minor}",
            "hive_type": {0: "primary", 1: "log", 2: "external"}.get(self.type, str(self.type)),
            "hbin_blocks": len(self.hbins),
            "size": self.hive_bins_size,
            "dirty": self.sequence1 != self.sequence2,
            "root_key": (root or {}).get("name", ""),
            "last_written": _filetime(self.dev.pread(self.offset + 0x0C, 8)),
        }

    # ---------------------------------------------------------------------- keys
    def key(self, rel_offset: int) -> Optional[dict]:
        raw = self.cell(rel_offset)
        if not raw or raw[:2] != b"nk" or len(raw) < 76:
            return None
        flags = struct.unpack_from("<H", raw, 2)[0]
        timestamp = _filetime(raw[4:12])
        parent = struct.unpack_from("<I", raw, 0x10)[0]
        subkey_count = struct.unpack_from("<I", raw, 0x14)[0]
        subkey_list = struct.unpack_from("<I", raw, 0x1C)[0]
        value_count = struct.unpack_from("<I", raw, 0x24)[0]
        value_list = struct.unpack_from("<I", raw, 0x28)[0]
        name_len = struct.unpack_from("<H", raw, 0x48)[0]
        class_len = struct.unpack_from("<H", raw, 0x4A)[0]
        name_bytes = raw[0x4C : 0x4C + name_len]
        name = name_bytes.decode("utf-16-le", "replace") if flags & 0x20 else name_bytes.decode("latin-1", "replace")
        class_off = struct.unpack_from("<I", raw, 0x30)[0]
        return {
            "offset": rel_offset, "name": name, "flags": flags,
            "root": bool(flags & 0x04), "volatile": bool(flags & 0x01),
            "timestamp": timestamp, "parent": parent,
            "subkey_count": subkey_count, "subkey_list": subkey_list,
            "value_count": value_count, "value_list": value_list,
            "class_name": (self.cell(class_off) or b"").split(b"\x00")[0].decode("latin-1", "replace") if class_off and class_len else "",
            "name_len": name_len,
        }

    def subkeys(self, rel_offset: int, max_keys: int = 20000) -> list[int]:
        k = self.key(rel_offset)
        if not k or not k["subkey_count"] or not k["subkey_list"]:
            return []
        raw = self.cell(k["subkey_list"])
        if not raw or len(raw) < 4:
            return []
        offsets: list[int] = []
        sig = raw[:2]
        if sig in SUBKEY_LISTS:
            count = struct.unpack_from("<H", raw, 2)[0]
            if sig == b"ri":
                # indirect: list of lf/lh blocks
                for i in range(min(count, 4096)):
                    ptr = struct.unpack_from("<I", raw, 4 + i * 4)[0]
                    sub = self.cell(ptr)
                    if sub and sub[:2] in SUBKEY_LISTS:
                        n = struct.unpack_from("<H", sub, 2)[0]
                        for j in range(min(n, 8192)):
                            offsets.append(struct.unpack_from("<I", sub, 4 + j * 8)[0])
            else:
                for i in range(min(count, max_keys)):
                    offsets.append(struct.unpack_from("<I", raw, 4 + i * 8)[0])
        else:
            # old-style: raw list of offsets
            count = len(raw) // 4
            for i in range(min(count, max_keys)):
                offsets.append(struct.unpack_from("<I", raw, i * 4)[0])
        return offsets

    def key_path(self, rel_offset: int, max_hops: int = 64) -> str:
        parts = []
        cur = rel_offset
        for _ in range(max_hops):
            k = self.key(cur)
            if not k:
                break
            parts.append(k["name"])
            if k["root"] or k["parent"] in (0xFFFFFFFF, cur):
                break
            cur = k["parent"]
        return "\\".join(reversed(parts))

    def find_key(self, path: str) -> Optional[dict]:
        """Resolve a path like ``ControlSet001\\Services\\USBSTOR`` (case-insensitive)."""
        parts = [p for p in path.replace("/", "\\").split("\\") if p]
        current = self.root_cell
        rootk = self.key(current)
        if rootk and parts and rootk["name"].lower() == parts[0].lower():
            parts = parts[1:]
        for part in parts:
            found = None
            for off in self.subkeys(current):
                k = self.key(off)
                if k and k["name"].lower() == part.lower():
                    found = off
                    break
            if found is None:
                return None
            current = found
        return self.key(current)

    # -------------------------------------------------------------------- values
    def values(self, rel_offset: int, max_values: int = 20000) -> list[dict]:
        k = self.key(rel_offset)
        if not k or not k["value_count"] or not k["value_list"]:
            return []
        raw = self.cell(k["value_list"])
        if not raw:
            return []
        out = []
        for i in range(min(k["value_count"], max_values)):
            off = struct.unpack_from("<I", raw, i * 4)[0]
            v = self.value(off)
            if v:
                out.append(v)
        return out

    def value(self, rel_offset: int) -> Optional[dict]:
        raw = self.cell(rel_offset)
        if not raw or raw[:2] != b"vk" or len(raw) < 20:
            return None
        name_len = struct.unpack_from("<H", raw, 2)[0]
        data_size = struct.unpack_from("<I", raw, 4)[0]
        data_off = struct.unpack_from("<I", raw, 8)[0]
        vtype = struct.unpack_from("<I", raw, 12)[0]
        flags = struct.unpack_from("<H", raw, 16)[0]
        name = raw[0x14 : 0x14 + name_len].decode("latin-1", "replace") if name_len else "(default)"
        data = self._value_data(data_size, data_off, flags, raw)
        return {"offset": rel_offset, "name": name, "type_id": vtype,
                "type": VALUE_TYPES.get(vtype, f"0x{vtype:x}"),
                "size": data_size, "data": data, "flags": flags,
                "parsed": self._parse(vtype, data)}

    def _value_data(self, size: int, data_off: int, flags: int, cell_raw: bytes) -> bytes:
        if size == 0:
            return b""
        if size & 0x80000000:  # inline, 1-4 bytes stored in the offset field
            stored = size & 0x7FFFFFFF
            return struct.pack("<I", data_off)[:stored]
        if flags & 0x1 and size > 16344:  # 'DB' big data
            db = self.cell(data_off & 0x7FFFFFFF)
            if db and db[:2] == b"db":
                segments = struct.unpack_from("<H", db, 2)[0]
                out = bytearray()
                for i in range(min(segments, 8192)):
                    ptr = struct.unpack_from("<I", db, 4 + i * 4)[0]
                    seg = self.cell(ptr)
                    if seg:
                        out.extend(seg)
                return bytes(out[:size])
        return (self.cell(data_off & 0x7FFFFFFF) or b"")[:size]

    def _parse(self, vtype: int, data: bytes):
        try:
            if vtype in (1, 2, 6):
                if len(data) % 2:
                    data = data[:-1]
                return data.decode("utf-16-le", "replace").rstrip("\x00")
            if vtype == 7:
                if len(data) % 2:
                    data = data[:-1]
                return [s for s in data.decode("utf-16-le", "replace").split("\x00") if s and s.strip()]
            if vtype == 4:
                return struct.unpack("<I", data[:4])[0] if len(data) >= 4 else None
            if vtype == 5:
                return struct.unpack(">I", data[:4])[0] if len(data) >= 4 else None
            if vtype == 11:
                return struct.unpack("<Q", data[:8])[0] if len(data) >= 8 else None
        except (struct.error, UnicodeDecodeError):
            return None
        return None

    def walk(self, rel_offset: Optional[int] = None, depth: int = 0, max_depth: int = 6, _limit: int = 20000) -> list[dict]:
        """Recursive key dump (depth-limited)."""
        out: list[dict] = []
        root = rel_offset if rel_offset is not None else self.root_cell
        stack = [(root, 0)]
        while stack and len(out) < _limit:
            off, d = stack.pop()
            k = self.key(off)
            if not k:
                continue
            out.append({**k, "path": self.key_path(off), "depth": d})
            if d < max_depth:
                for sub in self.subkeys(off):
                    stack.append((sub, d + 1))
        return out

    def export_key(self, path: str) -> dict:
        k = self.find_key(path)
        if not k:
            return {"found": False, "path": path}
        values = self.values(k["offset"])
        children = []
        for off in self.subkeys(k["offset"]):
            sub = self.key(off)
            if sub:
                children.append({"name": sub["name"], "subkeys": sub["subkey_count"], "values": sub["value_count"],
                                 "timestamp": sub["timestamp"]})
        return {"found": True, "path": self.key_path(k["offset"]), "values": values, "children": children,
                "timestamp": k["timestamp"]}

    # ---------------------------------------------------------- DFIR high-value
    def usb_history(self) -> list[dict]:
        """USB storage devices ever plugged in (USBSTOR + DeviceClasses)."""
        out: list[dict] = []
        for path in (r"ControlSet001\Enum\USBSTOR", r"ControlSet002\Enum\USBSTOR", r"CurrentControlSet\Enum\USBSTOR"):
            k = self.find_key(path)
            if not k:
                continue
            for off in self.subkeys(k["offset"]):
                dev = self.key(off)
                if not dev:
                    continue
                instance = []
                for ioff in self.subkeys(dev["offset"]):
                    inst = self.key(ioff)
                    if not inst:
                        continue
                    props = {v["name"]: v["parsed"] if v["parsed"] is not None else v["data"][:64].hex()
                             for v in self.values(inst["offset"])}
                    instance.append({"instance": inst["name"], "last_write": inst["timestamp"], "properties": props})
                out.append({"device": dev["name"], "instances": instance})
        return out

    def autoruns(self) -> list[dict]:
        """Persistence entries an attacker would use (Run keys, Services, Winlogon)."""
        targets = [
            r"Software\Microsoft\Windows\CurrentVersion\Run",
            r"Software\Microsoft\Windows\CurrentVersion\RunOnce",
            r"Software\Microsoft\Windows\CurrentVersion\Explorer\Shell Folders",
            r"Software\Microsoft\Windows NT\CurrentVersion\Windows",
            r"Software\Microsoft\Windows NT\CurrentVersion\Winlogon",
            r"Software\Microsoft\Windows\CurrentVersion\Policies\Explorer\Run",
            r"Software\Wow6432Node\Microsoft\Windows\CurrentVersion\Run",
        ]
        out = []
        for t in targets:
            k = self.find_key(t)
            if not k:
                continue
            for v in self.values(k["offset"]):
                out.append({"key": t, "name": v["name"], "value": v["parsed"] if v["parsed"] is not None else v["data"][:200].hex(),
                            "type": v["type"], "risk": "review"})
        return out

    def installed_software(self) -> list[dict]:
        out = []
        for root in (r"Software\Microsoft\Windows\CurrentVersion\Uninstall",
                     r"Software\Wow6432Node\Microsoft\Windows\CurrentVersion\Uninstall"):
            k = self.find_key(root)
            if not k:
                continue
            for off in self.subkeys(k["offset"]):
                sub = self.key(off)
                if not sub:
                    continue
                vals = {v["name"]: (v["parsed"] if v["parsed"] is not None else v["data"][:200].hex()) for v in self.values(sub["offset"])}
                if vals.get("DisplayName"):
                    out.append({"name": vals.get("DisplayName"), "version": vals.get("DisplayVersion", ""),
                                "publisher": vals.get("Publisher", ""), "installed": vals.get("InstallDate", ""),
                                "path": vals.get("InstallLocation", "")})
        return out

    def local_users(self) -> list[dict]:
        """SAM key names == local accounts (RID mapping)."""
        users = []
        for rid_path in (r"SAM\Domains\Account\Users\Names",):
            k = self.find_key(rid_path)
            if not k:
                continue
            for off in self.subkeys(k["offset"]):
                sub = self.key(off)
                if sub:
                    users.append({"username": sub["name"], "last_modified": sub["timestamp"]})
        return users


def open_hive(dev, offset: int = 0) -> Hive:
    return Hive(dev, offset)
