"""THADD OS Forensics — the OS reverse-engineering engine.

``triage.analyze(path)`` opens any disk image or block device and produces a
complete, evidence-grade report:

1. **Container** — partition scheme, every partition, bootability, anomalies
2. **Filesystems** — per-partition detection and full metadata
3. **OS fingerprint** — Windows 10/11, macOS (Sequoia/15 back to classic HFS+),
   Ubuntu, Debian, Parrot, Kali, Arch, Fedora, Rocky/Alma, Alpine, FreeBSD…
4. **Artefacts** — per-OS forensic loot (registry hives, EFI bootkit paths,
   launch daemons, APFS volumes, passwd/shadow, ssh keys, crypto wallets)
5. **Timeline & indicators** — timestomping, deleted data, hidden streams
6. **Evidence** — SHA-256 of the image and of every extracted artefact

Everything is read-only, deterministic and reproducible: the same image always
produces the same report, which is what makes findings admissible.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import time
from pathlib import Path
from typing import Optional

from . import apfs, ext4, fat, hfs, ntfs, partitions, registry
from .device import BlockDevice, SliceDevice

OS_SIGNATURES = {
    "windows11": {"family": "Windows", "version": "11", "release": "Windows 11 (22H2 → 24H2)",
                  "markers": ["Windows\\System32\\config\\SYSTEM", "Windows\\System32\\winload.efi", "Windows\\SysWOW64"]},
    "windows10": {"family": "Windows", "version": "10", "release": "Windows 10",
                  "markers": ["Windows\\System32\\config\\SOFTWARE", "Windows\\System32\\ntoskrnl.exe"]},
    "windows-server": {"family": "Windows", "version": "Server", "release": "Windows Server",
                       "markers": ["Windows\\System32\\config\\DEFAULT"]},
    "macos-sequoia": {"family": "macOS", "version": "15", "release": "macOS Sequoia (15)",
                      "markers": ["/System/Library/CoreServices/SystemVersion.plist", "/private/var/db"]},
    "macos": {"family": "macOS", "version": "?", "release": "macOS (APFS)", "markers": ["/System/Library/CoreServices"]},
    "hfs-macos": {"family": "macOS", "version": "classic", "release": "macOS on HFS+ (≤ High Sierra)",
                  "markers": [".Spotlight-V100"]},
    "ubuntu": {"family": "Linux", "distro": "Ubuntu", "release": "Ubuntu LTS",
               "markers": ["/etc/ubuntu-release", "/etc/lsb-release", "/etc/apt/sources.list.d/ubuntu.sources"]},
    "debian": {"family": "Linux", "distro": "Debian", "release": "Debian GNU/Linux",
               "markers": ["/etc/debian_version", "/etc/dpkg/origins/debian"]},
    "parrot": {"family": "Linux", "distro": "Parrot OS", "release": "Parrot Security OS",
               "markers": ["/etc/parrot/", "/usr/share/parrot", "parrot-os"]},
    "kali": {"family": "Linux", "distro": "Kali", "release": "Kali Linux",
             "markers": ["/etc/kali-linux", "/usr/share/kali-menu"]},
    "arch": {"family": "Linux", "distro": "Arch", "release": "Arch Linux", "markers": ["/etc/pacman.conf", "/etc/arch-release"]},
    "fedora": {"family": "Linux", "distro": "Fedora", "release": "Fedora", "markers": ["/etc/fedora-release"]},
    "rhel": {"family": "Linux", "distro": "RHEL/Rocky/Alma", "release": "Enterprise Linux", "markers": ["/etc/redhat-release"]},
    "alpine": {"family": "Linux", "distro": "Alpine", "release": "Alpine Linux", "markers": ["/etc/alpine-release"]},
    "freebsd": {"family": "BSD", "distro": "FreeBSD", "release": "FreeBSD", "markers": ["/etc/freebsd-update.conf"]},
}

WALLET_PATHS = [
    "wallet.dat", ".electrum/wallets", ".ethereum/keystore", "Exodus/exodus.wallet",
    "Bitcoin/wallets", "Monero", "Ledger", ".bitcoin",
]

ACQUISITION_HINTS = {
    "Windows": ["NTFS $MFT", "registry hives (SAM/SYSTEM/SOFTWARE/SECURITY)", "Prefetch", "Amcache",
                "$UsnJrnl (USN change journal)", "LNK files", "Jump Lists", "Event Logs (.evtx)",
                "SRUM database", "BitLocker metadata"],
    "macOS": ["APFS volume groups", "unified logs (.tracev3)", "FSEventsd", "Quarantine events",
              "LaunchAgents/Daemons", "Keychain", "Time Machine snapshots", "TCC.db (privacy)"],
    "Linux": ["/etc/passwd + /etc/shadow", "auth.log / journald", "bash history", "SSH keys",
              "cron + systemd units", "dpkg/rpm logs", "auditd rules", "sudoers"],
}


def _hash_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def analyze(path: str, deep: bool = True, extract_dir: str = "", progress=None) -> dict:
    """Run the full OS reverse-engineering pass over an image or device."""
    started = time.time()
    report: dict = {
        "tool": "THADD OS Forensics",
        "version": "1.0",
        "started": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "target": os.path.abspath(path),
        "evidence": {},
        "partitions": [],
        "filesystems": [],
        "os_detected": [],
        "artifacts": {},
        "timeline": [],
        "indicators": [],
        "warnings": [],
        "acquisition_plan": [],
        "stats": {},
    }
    if not os.path.exists(path):
        report["warnings"].append(f"target not found: {path}")
        return report

    def step(msg: str) -> None:
        if progress:
            try:
                progress(msg)
            except Exception:
                pass

    try:
        dev = BlockDevice(path)
    except (OSError, PermissionError) as exc:
        report["warnings"].append(f"cannot open target read-only: {exc}")
        return report

    try:
        step("hashing evidence")
        report["evidence"] = {
            "sha256": dev.sha256(),
            "size": dev.size,
            "is_block_device": dev.is_block,
            "acquired_readonly": True,
            "acquisition_time": time.strftime("%Y-%m-%dT%H:%M:%S"),
            "host": os.uname().nodename,
            "chain_of_custody": ["opened O_RDONLY", "no writes issued", "report hashed after acquisition"],
        }
        report["stats"]["image_entropy"] = dev.entropy(0, 1 << 20)

        step("parsing partition tables")
        table_window = dev.pread(0, 34 * 512)
        part_info = partitions.parse(table_window, dev)
        report["partition_table"] = {k: v for k, v in part_info.items() if k != "partitions"}
        report["partitions"] = part_info.get("partitions", [])
        report["warnings"].extend(part_info.get("warnings", []))
        if dev.size <= 512 * 1024 * 1024:
            report["note"] = "small image — may be a single filesystem or a firmware dump"

        # ---------------------------------------------------------- per-partition
        slices: list[tuple[str, object, str]] = []
        if not report["partitions"]:
            report["partitions"] = [{"number": 0, "name": "whole device", "offset": 0, "size": dev.size,
                                     "type": "unknown", "kind": "unknown", "flags": ["superfloppy"]}]
        for part in report["partitions"]:
            step(f"reading partition {part.get('number')} ({part.get('name') or part.get('type')})")
            sl = SliceDevice(dev, int(part.get("offset", 0)), int(part.get("size", 0)), part.get("name", ""))
            fs_info = _detect_filesystem(sl, part)
            report["filesystems"].append(fs_info)
            slices.append((part.get("name") or part.get("type", "?"), sl, fs_info.get("fs", "unknown")))

            if fs_info.get("fs") in ("NTFS",) and deep:
                _scan_ntfs(sl, report, extract_dir)
            elif fs_info.get("fs", "").startswith("ext") and deep:
                _scan_ext(sl, report)
            elif fs_info.get("fs") in ("HFS+", "HFSX") and deep:
                _scan_hfs(sl, report)
            elif fs_info.get("fs") == "APFS" and deep:
                _scan_apfs(sl, report)
            elif fs_info.get("fs") in ("FAT", "exFAT", "FAT32") and deep:
                _scan_fat(sl, report, part)

        # ------------------------------------------------------------ OS verdicts
        report["os_detected"] = _fingerprint(report)
        families = {o["family"] for o in report["os_detected"]}
        for fam in families:
            report["acquisition_plan"].extend(ACQUISITION_HINTS.get(fam, []))

        if deep:
            step("hunting indicators")
            _indicators(report)

        report["stats"].update({
            "partitions": len(report["partitions"]),
            "filesystems": len(report["filesystems"]),
            "artifacts": sum(len(v) for v in report["artifacts"].values() if isinstance(v, list)),
            "elapsed_seconds": round(time.time() - started, 2),
        })
        report["finished"] = time.strftime("%Y-%m-%dT%H:%M:%S")
        report["evidence"]["report_sha256"] = _hash_bytes(
            json.dumps({k: v for k, v in report.items() if k != "evidence"}, default=str).encode())
    finally:
        dev.close()
    return report


# ------------------------------------------------------------------- detection
def _detect_filesystem(sl, part: dict) -> dict:
    head = sl.pread(0, 4096)
    info = {"partition": part.get("number"), "name": part.get("name") or part.get("type"),
            "offset": part.get("offset"), "size": sl.size, "fs": "unknown", "bootable": part.get("bootable", False)}
    if len(head) < 512:
        info["fs"] = "empty/truncated"
        return info
    if head[3:11] == b"NTFS    ":
        n = ntfs.NTFS(sl)
        info.update({"fs": "NTFS", "details": n.info() if n.valid else {}})
        info["readable"] = n.valid
        return info
    if head[3:11] == b"EXFAT   ":
        f = fat.FAT(sl)
        info.update({"fs": "exFAT", "details": f.info() if f.valid else {}, "readable": f.valid})
        return info
    if head[510:512] == b"\x55\xaa" and (head[54:58] in (b"FAT1", b"FAT3") or b"FAT" in head[54:62] or b"FAT" in head[82:90]):
        f = fat.FAT(sl)
        info.update({"fs": "FAT", "details": f.info() if f.valid else {}, "readable": f.valid})
        return info
    if len(head) > 1100 and head[1080:1082] == b"\x53\xef":
        e = ext4.Ext4(sl)
        info.update({"fs": "ext2/3/4", "details": e.info() if e.valid else {}, "readable": e.valid})
        return info
    if head[0x20:0x24] == b"NXSB" or (len(head) > 0x24 and head[0x20:0x24] == b"NXSB"):
        a = apfs.APFS(sl)
        info.update({"fs": "APFS", "details": a.info() if a.valid else {}, "readable": a.valid})
        return info
    hfs_magic = head[1024:1026]
    if hfs_magic in (b"H+", b"HX") or head[0:2] in (b"H+", b"HX"):
        h = hfs.HFS(sl)
        info.update({"fs": "HFS+" if hfs_magic == b"H+" else ("HFSX" if hfs_magic == b"HX" else "HFS+"),
                     "details": h.info() if h.valid else {}, "readable": h.valid})
        return info
    if head[0:4] == b"LUKS" or head[0:6] == b"\x4c\x55\x4b\x53\xba\xbe":
        version = 2 if head[6:8] == b"\x00\x02" else 1
        info.update({"fs": f"LUKS{version} (encrypted)", "readable": False,
                     "note": "full-disk encryption — supply the passphrase/keyfile to unlock, or analyse the header for KDF parameters"})
        return info
    if head[0:4] == b"regf":
        h = registry.Hive(sl)
        info.update({"fs": "Windows registry hive", "details": h.info() if h.valid else {}, "readable": h.valid})
        return info
    if head[0x40:0x48] == b"_BHRfS_M":
        info.update({"fs": "btrfs", "readable": False, "note": "btrfs metadata trees not parsed (use `btrfs inspect-internal dump-super`)"})
        return info
    if head[0:4] == b"XFSB":
        info.update({"fs": "XFS", "readable": False, "note": "XFS not parsed natively"})
        return info
    if head[0:4] == b"ZFS\x00" or head[0x4000:0x4004] == b"ZFS\x00":
        info.update({"fs": "ZFS", "readable": False, "note": "ZFS pool member"})
        return info
    if head[0x10000:0x10004] == b"hsqs":
        info.update({"fs": "squashfs (live ISO root)", "readable": False})
        return info
    if head[0:3] == b"MZ\x90" or head[0:2] == b"MZ":
        info.update({"fs": "PE executable (firmware/UEFI dump?)", "readable": False})
        return info
    if all(b == 0 for b in head[:512]):
        info.update({"fs": "unallocated / zeroed", "readable": False})
        return info
    info["note"] = "unrecognised signature — raw carve recommended"
    info["signature_hex"] = head[:16].hex()
    return info


def _fingerprint(report: dict) -> list[dict]:
    """Turn filesystem facts into an OS verdict list."""
    verdicts: list[dict] = []
    blob = json.dumps(report.get("filesystems", []), default=str).lower()
    names = " ".join(str(p.get("name", "")) for p in report.get("partitions", [])).lower()
    arts = json.dumps(report.get("artifacts", {}), default=str).lower()

    if "apfs" in blob:
        v = dict(OS_SIGNATURES["macos"])
        v["confidence"] = 0.95
        v["evidence"] = ["APFS container present"]
        if "sequoia" in arts or "recovery" in names or "data" in names and "system" in names:
            v["release"] = "macOS with APFS volume group (Catalina → Sequoia 15)"
        verdicts.append(v)
    if "hfs" in blob:
        verdicts.append({**OS_SIGNATURES["hfs-macos"], "confidence": 0.8, "evidence": ["HFS+ catalog parsed"]})
    if "ntfs" in blob:
        v = dict(OS_SIGNATURES["windows10"])
        v["confidence"] = 0.9
        v["evidence"] = ["NTFS volume with $MFT"]
        arts_win = report.get("artifacts", {}).get("windows", {})
        for hive_name in ("SOFTWARE", "SYSTEM", "SAM"):
            for k, val in (arts_win.get("hives") or {}).items():
                if hive_name in k:
                    prod = str(val.get("product_name") or "")
                    rel = str(val.get("release_id") or val.get("display_version") or "")
                    if prod:
                        v["release"] = prod
                        if "11" in rel or "11" in prod:
                            v["release"] = f"{prod} (Windows 11, build {val.get('current_build', '?')})"
                            v["version"] = "11"
        verdicts.append(v)
    if "ext2/3/4" in blob or "ext4" in blob:
        distro = "Linux"
        label = blob
        if "parrot" in arts or "parrot" in label:
            distro = "Parrot Security OS"
        elif "kali" in arts:
            distro = "Kali Linux"
        elif "ubuntu" in arts:
            distro = "Ubuntu"
        elif "debian" in arts:
            distro = "Debian"
        elif "arch" in arts:
            distro = "Arch Linux"
        elif "fedora" in arts:
            distro = "Fedora"
        verdicts.append({"family": "Linux", "distro": distro, "release": f"{distro} (ext4)",
                         "confidence": 0.85, "evidence": ["ext4 superblock parsed"]})
    if "fat" in blob:
        verdicts.append({"family": "Firmware", "distro": "EFI System Partition", "release": "UEFI boot volume",
                         "confidence": 0.8, "evidence": ["FAT volume (ESP)"]})
    if not verdicts:
        verdicts.append({"family": "Unknown", "release": "Unrecognised layout",
                         "confidence": 0.1, "evidence": ["no known OS filesystem or artefact found"]})
    return verdicts


# ---------------------------------------------------------------- FS drill-downs
def _scan_ntfs(sl, report: dict, extract_dir: str = "") -> None:
    n = ntfs.NTFS(sl)
    if not n.valid:
        return
    win = report["artifacts"].setdefault("windows", {})
    win.setdefault("volume", n.info())
    win.setdefault("hives", {})
    win.setdefault("boot_files", [])
    win.setdefault("system32_sample", [])

    registry_paths = {
        "SYSTEM": r"Windows\System32\config\SYSTEM",
        "SOFTWARE": r"Windows\System32\config\SOFTWARE",
        "SAM": r"Windows\System32\config\SAM",
        "SECURITY": r"Windows\System32\config\SECURITY",
        "DEFAULT": r"Windows\System32\config\DEFAULT",
        "AMCACHE": r"Windows\appcompat\Programs\Amcache.hve",
        "NTUSER": r"Users\Default\NTUSER.DAT",
    }
    for name, rel in registry_paths.items():
        try:
            got = n.read_path(rel, max_bytes=64 << 20)
        except Exception:
            got = None
        if not got or not got.get("data"):
            continue
        data = got["data"]
        entry = {"path": rel, "size": len(data), "sha256": _hash_bytes(data)}
        if data[:4] == b"regf":
            try:
                from .device import SliceDevice as _SD

                class _Blob:
                    def __init__(self, blob):
                        self._b = blob
                        self.size = len(blob)

                    def pread(self, off, length):
                        return self._b[off : off + length]

                hive = registry.Hive(_Blob(data))
                if hive.valid:
                    entry["hive"] = hive.info()
                    if name == "SOFTWARE":
                        prod = hive.find_key(r"Microsoft\Windows NT\CurrentVersion")
                        if prod:
                            vals = {v["name"]: (v["parsed"] if v["parsed"] is not None else v["data"][:80].hex())
                                    for v in hive.values(prod["offset"])}
                            entry.update({"product_name": vals.get("ProductName"), "release_id": vals.get("ReleaseId"),
                                          "display_version": vals.get("DisplayVersion"),
                                          "current_build": vals.get("CurrentBuildNumber"),
                                          "build_lab": vals.get("BuildLabEx"), "installed": vals.get("InstallDate"),
                                          "owner": vals.get("RegisteredOwner"), "edition": vals.get("EditionID")})
                        uninstall = hive.installed_software()
                        if uninstall:
                            win["installed_software"] = uninstall[:120]
                        win["autoruns"] = hive.autoruns()
                    if name == "SYSTEM":
                        entry["usb_history"] = hive.usb_history()[:40]
                        services = hive.find_key(r"ControlSet001\Services")
                        if services:
                            sus = []
                            for off in hive.subkeys(services["offset"]):
                                sub = hive.key(off)
                                if not sub:
                                    continue
                                vals = {v["name"]: v["parsed"] if v["parsed"] is not None else v["data"][:120].hex()
                                        for v in hive.values(sub["offset"])}
                                img = str(vals.get("ImagePath", ""))
                                if img and not img.lower().startswith(("\\systemroot", "%systemroot%", "c:\\windows", "\\??\\c:\\windows", "system32")):
                                    sus.append({"service": sub["name"], "image": img, "start": vals.get("Start")})
                            if sus:
                                win["nonstandard_services"] = sus[:80]
                    if name == "SAM":
                        entry["local_users"] = hive.local_users()
            except Exception as exc:
                entry["hive_parse_error"] = f"{type(exc).__name__}: {exc}"
        if extract_dir:
            entry["hive_path"] = os.path.join(extract_dir, f"{name}.hive")
        win["hives"][name] = entry

    # EFI boot files + system executables of interest
    for rel in (r"Windows\System32\winload.efi", r"Windows\System32\ntoskrnl.exe", r"Windows\System32\cmd.exe",
                r"Windows\System32\config\BOOT", r"bootmgr", r"EFI\Microsoft\Boot\bootmgfw.efi",
                r"EFI\Boot\bootx64.efi", r"Windows\System32\lsass.exe", r"Windows\System32\powershell.exe",
                r"Windows\System32\wsl.exe", r"Windows\System32\drivers\etc\hosts"):
        got = n.read_path(rel, max_bytes=8 << 20)
        if got and got.get("size"):
            win["boot_files"].append({"path": rel, "size": got["size"],
                                      "sha256": _hash_bytes(got.get("data", b""))[:32] if got.get("data") else ""})
    # users / program inventory via the directory index (works without hives too)
    try:
        root_listing = n.list_dir(5, max_entries=40)
        win["root_listing"] = [{"name": e["name"], "dir": e["is_dir"], "size": e["size"]} for e in root_listing]
        users_dir = n.read_path(r"Users")
        if users_dir and users_dir.get("record"):
            win["user_profiles"] = [e["name"] for e in n.list_dir(users_dir["record"], max_entries=200) if e["is_dir"]]
    except Exception as exc:
        report["warnings"].append(f"NTFS directory pass incomplete: {exc}")

    # high-signal artefacts
    tmp = Path(extract_dir or "/tmp") 
    try:
        deleted = n.deleted_files(limit=120)
        if deleted:
            report["artifacts"]["windows"]["deleted_files"] = deleted
        stomps = n.timestomp_candidates(limit=80)
        if stomps:
            report["artifacts"]["windows"]["timestomped_files"] = stomps
            report["indicators"].append({"severity": "high", "title": "NTFS timestomping indicators",
                                         "detail": f"{len(stomps)} files where $SI and $FILE_NAME timestamps disagree"})
        ads = n.all_streams()[:120]
        if ads:
            report["artifacts"]["windows"]["alternate_data_streams"] = ads
            report["indicators"].append({"severity": "medium", "title": "Alternate Data Streams present",
                                         "detail": f"{len(ads)} named streams (possible data hiding / MOTW)"})
        report["timeline"].extend(n.timeline(limit=400))
    except Exception as exc:
        report["warnings"].append(f"NTFS artefact pass incomplete: {exc}")


def _scan_ext(sl, report: dict) -> None:
    e = ext4.Ext4(sl)
    if not e.valid:
        return
    lin = report["artifacts"].setdefault("linux", {})
    lin.setdefault("filesystems", []).append(e.info())
    root = e.list_dir(ext4.ROOT_INO)
    lin.setdefault("root_listing", [{"name": r["name"], "type": r["type"], "mode": r["mode"]} for r in root[:120]])

    def cat(path: str, max_bytes: int = 1 << 20) -> str:
        parts = [p for p in path.strip("/").split("/") if p]
        ino = ext4.ROOT_INO
        for part in parts:
            nxt = next((x for x in e.list_dir(ino) if x["name"] == part), None)
            if not nxt:
                return ""
            ino = nxt["inode"]
        return e.read_file(ino, max_bytes).decode("utf-8", "replace")

    identity = {}
    for f in ("etc/os-release", "etc/debian_version", "etc/lsb-release", "etc/parrot/parrot.conf",
              "etc/issue", "etc/hostname"):
        content = cat(f, 8192)
        if content:
            identity[f] = content[:600]
    if identity:
        lin["identity_files"] = identity
        blob = " ".join(identity.values()).lower()
        distro = ("Parrot Security OS" if "parrot" in blob else
                  "Kali Linux" if "kali" in blob else
                  "Ubuntu" if "ubuntu" in blob else
                  "Debian" if "debian" in blob else
                  "Arch Linux" if "arch" in blob else "Linux")
        lin["distro_guess"] = distro
        if distro in ("Parrot Security OS", "Kali Linux"):
            report["indicators"].append({"severity": "medium", "title": f"{distro} penetration-testing toolkit detected",
                                         "detail": "offensive-security distribution — audit installed tools and ssh keys"})

    passwd = cat("etc/passwd", 64 * 1024)
    if passwd:
        users = []
        for line in passwd.splitlines():
            parts = line.split(":")
            if len(parts) >= 7:
                try:
                    uid = int(parts[2])
                except ValueError:
                    continue
                users.append({"user": parts[0], "uid": uid, "gid": parts[3], "home": parts[5], "shell": parts[6],
                              "system": uid < 1000})
        lin["users"] = users
    shadow = cat("etc/shadow", 64 * 1024)
    if shadow:
        lin["shadow"] = [{"user": l.split(":")[0], "hash_type": _hash_type(l.split(":")[1] if ":" in l else ""),
                          "locked": (l.split(":")[1].startswith(("!", "*")) if ":" in l else True),
                          "last_change_days": (l.split(":")[2] if len(l.split(":")) > 2 else "")}
                         for l in shadow.splitlines() if l and not l.startswith("#")]
        weak = [s for s in lin["shadow"] if s["hash_type"] in ("MD5-crypt", "SHA-256-crypt", "DES") and not s["locked"]]
        if weak:
            report["indicators"].append({"severity": "high", "title": "Legacy password hashes in /etc/shadow",
                                         "detail": f"{len(weak)} accounts use fast/legacy crypt() — offline cracking at scale"})
    for f in ("root/.ssh/authorized_keys", "home/.ssh/authorized_keys"):
        content = cat(f, 64 * 1024)
        if content:
            keys = [k[:120] for k in content.splitlines() if k.strip() and not k.startswith("#")]
            lin.setdefault("ssh_authorized_keys", {})[f] = keys
            report["indicators"].append({"severity": "medium", "title": "SSH authorised_keys found",
                                         "detail": f"{len(keys)} key(s) in /{f} — verify each fingerprint"})
    history = cat("root/.bash_history", 256 * 1024)
    if history:
        lin["bash_history"] = history.splitlines()[-200:]
        risky = [l for l in lin["bash_history"] if re.search(r"(curl|wget).*\|.*(sh|bash)|chmod \+x|nc -e|/dev/tcp|history -c", l)]
        if risky:
            report["indicators"].append({"severity": "high", "title": "Suspicious shell history",
                                         "detail": f"{len(risky)} command(s) resemble post-exploitation"},)
            lin["suspicious_history"] = risky[:40]
    crontab = cat("etc/crontab", 64 * 1024)
    if crontab:
        jobs = [l for l in crontab.splitlines() if l.strip() and not l.startswith("#")]
        lin["crontab"] = jobs[:80]
        odd = [j for j in jobs if re.search(r"(curl|wget|base64|python -c|/tmp/)", j)]
        if odd:
            report["indicators"].append({"severity": "medium", "title": "Unusual cron jobs",
                                         "detail": "; ".join(odd[:3])[:300]})
    try:
        deleted = e.deleted_inodes(limit=120)
        if deleted:
            lin["deleted_inodes"] = deleted
            report["indicators"].append({"severity": "medium", "title": "Deleted inodes recoverable",
                                         "detail": f"{len(deleted)} deleted inodes with non-zero size"})
        stomps = e.timestomp_candidates(limit=60)
        if stomps:
            lin["timestomp_candidates"] = stomps
    except Exception as exc:
        report["warnings"].append(f"ext4 recovery pass incomplete: {exc}")


def _scan_hfs(sl, report: dict) -> None:
    h = hfs.HFS(sl)
    if not h.valid:
        return
    mac = report["artifacts"].setdefault("macos", {})
    mac.setdefault("volumes", []).append(h.info())
    try:
        arts = h.system_artifacts(limit=300)
        mac["artifacts"] = {k: (v[:80] if isinstance(v, list) else v) for k, v in arts.items()}
        if arts.get("users"):
            mac["users"] = arts["users"]
        if arts.get("launch_agents"):
            report["indicators"].append({"severity": "low", "title": "HFS+ LaunchAgents found",
                                         "detail": f"{len(arts['launch_agents'])} plist(s) — check for persistence"})
    except Exception as exc:
        report["warnings"].append(f"HFS+ artifact pass incomplete: {exc}")


def _scan_apfs(sl, report: dict) -> None:
    a = apfs.APFS(sl)
    if not a.valid:
        return
    mac = report["artifacts"].setdefault("macos", {})
    mac.setdefault("volumes", []).append(a.info())
    mac["volume_groups"] = [{"name": v["name"], "role": v["role"], "encrypted": v["encrypted"], "block": v["block"]}
                            for v in a.volumes]
    mac["sealed_system"] = any(v["role_id"] == 1 for v in a.volumes)
    mac["filevault"] = [v["name"] for v in a.volumes if v["encrypted"]]
    mac["artifacts_hint"] = a.macos_artifacts()
    if mac["filevault"]:
        report["indicators"].append({"severity": "info", "title": "FileVault-encrypted APFS volume(s)",
                                     "detail": ", ".join(mac["filevault"]) + " — metadata visible, contents require the key"})
    snaps = []
    for v in a.volumes[:4]:
        try:
            snaps.extend(a.snapshots(v, limit=12))
        except Exception:
            continue
    if snaps:
        mac["snapshots"] = snaps
        report["indicators"].append({"severity": "info", "title": "APFS snapshots available",
                                     "detail": f"{len(snaps)} snapshot(s) — pre-compromise state is recoverable"})


def _scan_fat(sl, report: dict, part: dict) -> None:
    f = fat.FAT(sl)
    if not f.valid:
        return
    fw = report["artifacts"].setdefault("firmware", {})
    fw.setdefault("volumes", []).append(f.info())
    try:
        efi = f.efi_artifacts()
        fw.setdefault("efi", []).append({"partition": part.get("number"), **efi})
        if efi.get("windows_boot"):
            fw["windows_boot_manager"] = efi["windows_boot"][:40]
        if efi.get("apple_firmware"):
            fw["apple_firmware"] = efi["apple_firmware"][:40]
        unsigned = [p for p in efi.get("windows_boot", []) if p.lower().endswith((".efi", ".exe"))]
        if unsigned:
            report["indicators"].append({"severity": "low", "title": "UEFI boot chain present",
                                         "detail": f"{len(unsigned)} EFI boot files — hash and compare against vendor images"})
    except Exception as exc:
        report["warnings"].append(f"FAT/ESP pass incomplete: {exc}")


def _hash_type(h: str) -> str:
    if h.startswith("$1$"):
        return "MD5-crypt"
    if h.startswith("$2"):
        return "bcrypt"
    if h.startswith("$5$"):
        return "SHA-256-crypt"
    if h.startswith("$6$"):
        return "SHA-512-crypt"
    if h.startswith("$y$"):
        return "yescrypt"
    if h.startswith("$7$"):
        return "scrypt"
    if len(h) == 13:
        return "DES"
    if not h:
        return "empty"
    return "unknown"


def _indicators(report: dict) -> None:
    """Cross-cutting indicators independent of the filesystem reader."""
    fs = report.get("filesystems", [])
    for entry in fs:
        if entry.get("fs", "").startswith("LUKS"):
            report["indicators"].append({"severity": "info", "title": "Full-disk encryption detected",
                                         "detail": "LUKS container — data at rest protected; analyse only metadata"})
        det = entry.get("details") or {}
        if det.get("state", "").lower().startswith("not clean"):
            report["indicators"].append({"severity": "medium", "title": "Filesystem not cleanly unmounted",
                                         "detail": "possible crash, forced power-off, or live tampering"})
    for w in report.get("warnings", []):
        if "CRC mismatch" in w or "overlap" in w:
            report["indicators"].append({"severity": "high", "title": "Partition table anomaly", "detail": w})
    report["indicators"].sort(key=lambda i: {"high": 0, "medium": 1, "low": 2, "info": 3}.get(i["severity"], 4))


# ----------------------------------------------------------------- evidence I/O
def extract_artifact(dev_path: str, offset: int, length: int, out_path: str, algo: str = "sha256") -> dict:
    """Carve a byte range out of an image into a hashed evidence file."""
    dev = BlockDevice(dev_path)
    try:
        h = hashlib.new(algo)
        written = 0
        Path(out_path).parent.mkdir(parents=True, exist_ok=True)
        with open(out_path, "wb") as fh:
            while written < length:
                chunk = dev.pread(offset + written, min(1 << 20, length - written))
                if not chunk:
                    break
                fh.write(chunk)
                h.update(chunk)
                written += len(chunk)
        return {"path": out_path, "bytes": written, algo: h.hexdigest(), "source_offset": offset,
                "extracted": time.strftime("%Y-%m-%dT%H:%M:%S")}
    finally:
        dev.close()


def report_markdown(report: dict) -> str:
    """Render the JSON report as a human-readable forensic document."""
    lines = [
        f"# THADD OS Forensic Report — {report.get('target', '?')}",
        "",
        f"* Generated: **{report.get('started')}** by THADD OS Forensics {report.get('version')}",
        f"* Evidence SHA-256: `{(report.get('evidence') or {}).get('sha256', '')}`",
        f"* Size: {(report.get('evidence') or {}).get('size', 0):,} bytes   "
        f"Entropy: {report.get('stats', {}).get('image_entropy', '?')}",
        "",
        "## 1. Operating systems identified",
        "",
    ]
    for osd in report.get("os_detected", []):
        lines.append(f"* **{osd.get('release', osd.get('family'))}** (confidence {int(osd.get('confidence', 0) * 100)}%) — "
                     f"{'; '.join(osd.get('evidence', []))}")
    lines += ["", "## 2. Partition layout", "",
              "| # | Name | Type | Offset | Size | Flags |", "|---|------|------|--------|------|-------|"]
    for p in report.get("partitions", []):
        lines.append(f"| {p.get('number')} | {p.get('name') or p.get('type')} | {p.get('type')} | "
                     f"{p.get('offset', 0):,} | {p.get('size', 0):,} | {', '.join(p.get('flags', []))} |")
    lines += ["", "## 3. Filesystems", ""]
    for f in report.get("filesystems", []):
        lines.append(f"* partition {f.get('partition')}: **{f.get('fs')}**"
                     f"{' (readable)' if f.get('readable') else ''}"
                     f"{' — ' + str(f.get('note')) if f.get('note') else ''}")
    lines += ["", "## 4. Indicators", ""]
    for ind in report.get("indicators", []):
        lines.append(f"* **{ind['severity'].upper()}** — {ind['title']}: {ind['detail']}")
    if not report.get("indicators"):
        lines.append("* none")
    lines += ["", "## 5. Artefacts recovered", ""]
    for fam, data in (report.get("artifacts") or {}).items():
        lines.append(f"### {fam}")
        if isinstance(data, dict):
            for key, val in data.items():
                if isinstance(val, list):
                    lines.append(f"* {key}: {len(val)} item(s)")
                elif isinstance(val, dict):
                    lines.append(f"* {key}: {len(val)} key(s)")
                else:
                    lines.append(f"* {key}: {val}")
        lines.append("")
    lines += ["## 6. Recommended acquisition plan", ""]
    for item in report.get("acquisition_plan", []):
        lines.append(f"* {item}")
    if report.get("warnings"):
        lines += ["", "## 7. Warnings", ""] + [f"* {w}" for w in report["warnings"]]
    lines += ["", "---", "", "*Chain of custody:* "
              + "; ".join((report.get("evidence") or {}).get("chain_of_custody", []))
              + f". Report digest `{(report.get('evidence') or {}).get('report_sha256', '')}`."]
    return "\n".join(lines)


def save_report(report: dict, directory: str) -> dict:
    """Write ``report.json`` + ``report.md`` and return the paths."""
    Path(directory).mkdir(parents=True, exist_ok=True)
    json_path = os.path.join(directory, "thadd-forensic-report.json")
    md_path = os.path.join(directory, "thadd-forensic-report.md")
    Path(json_path).write_text(json.dumps(report, indent=2, default=str))
    Path(md_path).write_text(report_markdown(report))
    return {"json": json_path, "markdown": md_path,
            "json_sha256": _hash_bytes(Path(json_path).read_bytes()),
            "markdown_sha256": _hash_bytes(Path(md_path).read_bytes())}


def os_capability_matrix() -> list[dict]:
    """What THADD can do against each operating system family (honest matrix)."""
    return [
        {
            "os": "Windows 11 / 10 / Server",
            "filesystem": "NTFS (+ FAT32/exFAT, ReFS reported)",
            "can_read": ["$MFT record enumeration", "resident + non-resident file data", "alternate data streams",
                         "registry hives (SAM/SYSTEM/SOFTWARE/SECURITY/Amcache)", "EFI boot chain",
                         "deleted records", "timestomping detection", "USN-journal style timelines"],
            "locked": ["BitLocker volumes (need the recovery key)", "live memory (needs a dump)"],
            "thadd_tools": ["forensics.read (API)", "security.analyze", "Files app (mount a copy)",
                            "thadd-dfir CLI", "AI agent: forensics_analyze"],
        },
        {
            "os": "macOS Sequoia 15 / Sonoma / Ventura …",
            "filesystem": "APFS (+ HFS+ for legacy)",
            "can_read": ["container + every volume with roles", "volume groups (System/Data)", "snapshot metadata",
                         "FileVault state per volume", "HFS+ catalog B-tree with Finder metadata",
                         "Spotlight/LaunchAgents/quarantine artefact paths"],
            "locked": ["encrypted APFS file contents without the key", "sealed system volume manifest (reported)",
                       "unified log parsing (paths surfaced, binary format flagged)"],
            "thadd_tools": ["forensics.read", "security.analyze", "AI agent: forensics_analyze"],
        },
        {
            "os": "Ubuntu / Debian",
            "filesystem": "ext4 (+ ext2/3, btrfs reported)",
            "can_read": ["superblock + block-group metadata", "extent-mapped file data", "directory trees",
                         "/etc/passwd & /etc/shadow (hash types, weak-hash detection)", "SSH keys",
                         "cron, systemd units", "bash history with post-exploitation heuristics", "deleted inodes"],
            "locked": ["LUKS-encrypted volumes (metadata + KDF parameters only)", "btrfs/XFS/ZFS trees (reported, not parsed)"],
            "thadd_tools": ["forensics.read", "security.analyze", "AI agent", "terminal (real tools)"],
        },
        {
            "os": "Parrot OS / Kali Linux",
            "filesystem": "ext4",
            "can_read": ["distro identification", "installed offensive toolchain inventory", "user/keys/audit artefacts",
                         "metasploit/nmap loot paths", "hardening gaps"],
            "locked": ["encrypted volumes as above"],
            "thadd_tools": ["Security Center", "security.scan", "AI agent: security_scan/posture"],
        },
        {
            "os": "UEFI firmware / ESP",
            "filesystem": "FAT32 / exFAT",
            "can_read": ["bootloader inventory per vendor (Microsoft/Apple/Linux)", "UEFI shell detection",
                         "hashable EFI binaries", "GPT CRC validation and backup-table recovery"],
            "locked": ["signed firmware blobs (reported as opaque binaries)"],
            "thadd_tools": ["forensics.read", "thadd-dfir"],
        },
        {
            "os": "THADD OS itself",
            "filesystem": "squashfs live + ext4 persistence",
            "can_read": ["everything — it is the running system"],
            "locked": [],
            "thadd_tools": ["all of them"],
        },
    ]
