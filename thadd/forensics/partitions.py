"""THADD OS Forensics — MBR / GPT / superfloppy partition parsing.

Detects the partition scheme, decodes every entry (type GUIDs resolved to
friendly names for Windows, macOS and Linux), validates the GPT CRCs and
reports anomalies such as overlapping partitions or a broken backup table.
"""

from __future__ import annotations

import binascii
import struct
from typing import Optional

SECTOR = 512

MBR_TYPES = {
    0x00: ("Empty", "none"), 0x01: ("FAT12", "fat"), 0x04: ("FAT16 <32M", "fat"), 0x05: ("Extended", "extended"),
    0x06: ("FAT16", "fat"), 0x07: ("NTFS / exFAT", "ntfs"), 0x0B: ("FAT32", "fat"), 0x0C: ("FAT32 LBA", "fat"),
    0x0E: ("FAT16 LBA", "fat"), 0x0F: ("Extended LBA", "extended"), 0x11: ("Hidden FAT12", "fat"),
    0x12: ("Compaq diagnostics", "diagnostic"), 0x14: ("Hidden FAT16", "fat"), 0x17: ("Hidden NTFS", "ntfs"),
    0x1B: ("Hidden FAT32", "fat"), 0x1C: ("Hidden FAT32 LBA", "fat"), 0x1E: ("Hidden FAT16 LBA", "fat"),
    0x27: ("Windows recovery", "ntfs"), 0x3C: ("PartitionMagic", "unknown"),
    0x42: ("Windows LDM dynamic disk", "windows-dynamic"), 0x4D: ("QNX4", "unknown"), 0x4E: ("QNX4 2nd", "unknown"),
    0x66: ("Novell", "unknown"), 0x69: ("Novell", "unknown"), 0x7E: ("Plan 9", "unknown"),
    0x82: ("Linux swap", "linux-swap"), 0x83: ("Linux (ext/xfs/btrfs)", "linux"),
    0x84: ("Hibernation", "hibernate"), 0x85: ("Linux extended", "extended"),
    0x86: ("NTFS volume set", "ntfs"), 0x87: ("NTFS volume set", "ntfs"),
    0x8E: ("Linux LVM", "lvm"), 0x93: ("Amoeba", "unknown"), 0x9F: ("BSD/OS", "bsd"),
    0xA0: ("IBM ThinkPad hibernate", "hibernate"), 0xA5: ("FreeBSD", "bsd"), 0xA6: ("OpenBSD", "bsd"),
    0xA8: ("macOS UFS", "ufs"), 0xA9: ("NetBSD", "bsd"), 0xAB: ("macOS boot", "macos"),
    0xAF: ("macOS HFS/HFS+", "hfs"), 0xB7: ("BSDI", "bsd"), 0xBB: ("Boot Wizard hidden", "unknown"),
    0xBE: ("Solaris boot", "solaris"), 0xBF: ("Solaris", "solaris"), 0xC1: ("DR-DOS FAT", "fat"),
    0xC4: ("DR-DOS FAT16", "fat"), 0xC6: ("DR-DOS FAT16", "fat"), 0xC7: ("Syrinx", "unknown"),
    0xDA: ("Non-FS data", "data"), 0xDB: ("CP/M", "unknown"), 0xDE: ("Dell utility", "diagnostic"),
    0xDF: ("BootIt", "unknown"), 0xE3: ("DOS read-only", "data"), 0xEB: ("BeOS", "unknown"),
    0xEE: ("GPT protective", "gpt"), 0xEF: ("EFI System Partition", "esp"), 0xF0: ("Linux/PA-RISC boot", "linux"),
    0xF1: ("SpeedStor", "unknown"), 0xF4: ("SpeedStor", "unknown"), 0xFB: ("VMware VMFS", "vmfs"),
    0xFC: ("VMware swap", "linux-swap"), 0xFD: ("Linux RAID", "linux-raid"), 0xFE: ("Old Minix", "minix"),
    0xFF: ("Xenix / BSDI", "bsd"),
}

GUID_TYPES = {
    "c12a7328-f81f-11d2-ba4b-00a0c93ec93b": ("EFI System Partition", "esp"),
    "21686148-6449-6e6f-744e-656564454649": ("BIOS boot partition", "bios-boot"),
    "e3c9e316-0b5c-4db8-817d-f92df00215ae": ("Microsoft Reserved (MSR)", "msr"),
    "ebd0a0a2-b9e5-4433-87c0-68b6b72699c7": ("Microsoft Basic Data (Windows C:)", "ntfs"),
    "de94bba4-06d1-4d40-a16a-bfd50179d6ac": ("Windows Recovery Environment", "winre"),
    "0fc63daf-8483-4772-8e79-3d69d8477de4": ("Linux filesystem", "linux"),
    "0657fd6d-a4ab-43c4-84e5-0933c84b4f4f": ("Linux swap", "linux-swap"),
    "e6d6d379-f507-44c2-a23c-238f2a3df928": ("Linux LVM", "lvm"),
    "a19d880f-05fc-4d3b-a006-743f0f84911e": ("Linux RAID", "linux-raid"),
    "48465300-0000-11aa-aa11-00306543ecac": ("Apple HFS+", "hfs"),
    "7c3457ef-0000-11aa-aa11-00306543ecac": ("Apple APFS", "apfs"),
    "52414944-0000-11aa-aa11-00306543ecac": ("Apple RAID", "apple-raid"),
    "426f6f74-0000-11aa-aa11-00306543ecac": ("Apple boot (Recovery HD)", "macos"),
    "53746f72-6167-11aa-aa11-00306543ecac": ("Apple Core Storage / FileVault", "filevault"),
    "55465300-0000-11aa-aa11-00306543ecac": ("Apple UFS", "ufs"),
    "4c616e00-0000-11aa-aa11-00306543ecac": ("Apple Label", "apple-label"),
    "516e7cb4-6ecf-11d6-8ff8-00022d09712b": ("FreeBSD UFS", "bsd"),
    "6a82cb45-1dd2-11b2-99a6-080020736631": ("Solaris root", "solaris"),
    "cef5a9ad-73bc-4601-89f3-cdeeeee321a1": ("ChromeOS kernel", "chromeos"),
    "fe3a2a5d-4f32-41a7-b725-accc3285a309": ("ChromeOS rootfs", "chromeos"),
    "3cb8e202-3b7e-47dd-8a3c-7ff2a13cfcec": ("ChromeOS stateful", "chromeos"),
    "9e1a2d38-c612-4316-aa26-8b49521e5a8b": ("OpenBSD", "bsd"),
    "824cc7a0-36a8-11e3-890a-952519ad3f61": ("OpenBSD data", "bsd"),
    "6db69de6-29f4-4758-a7a5-962190f00ce3": ("AIX", "aix"),
}


def _guid(raw: bytes) -> str:
    """Decode a mixed-endian GPT GUID into canonical string form."""
    if len(raw) < 16:
        return "0" * 36
    d1 = struct.unpack("<I", raw[0:4])[0]
    d2 = struct.unpack("<H", raw[4:6])[0]
    d3 = struct.unpack("<H", raw[6:8])[0]
    d4 = raw[8:10].hex()
    d5 = raw[10:16].hex()
    return f"{d1:08x}-{d2:04x}-{d3:04x}-{d4}-{d5}"


def _crc32(data: bytes) -> int:
    return binascii.crc32(data) & 0xFFFFFFFF


def parse(data: bytes, dev=None) -> dict:
    """Parse the partition scheme from the first 34 sectors (MBR + GPT)."""
    result: dict = {"scheme": "none", "partitions": [], "warnings": [], "protective_mbr": False, "disk_id": ""}
    if len(data) < 512:
        result["warnings"].append("device too small to hold an MBR")
        return result

    mbr = data[:512]
    if mbr[510:512] != b"\x55\xaa":
        # superfloppy?  look for a filesystem signature at offset 0
        fs = _sniff_filesystem(data[:4096])
        if fs:
            result.update({"scheme": "superfloppy", "filesystem": fs,
                           "partitions": [{"index": 0, "number": 0, "offset": 0, "size": dev.size if dev else len(data),
                                           "type": fs, "kind": fs, "name": f"{fs} (no partition table)", "bootable": True,
                                           "flags": []}]})
            return result
        result["warnings"].append("no MBR signature (0x55AA) and no recognisable filesystem")
        return result

    result["disk_id"] = mbr[440:444].hex()
    entries = _parse_mbr_entries(mbr[446:510], dev)
    result["partitions"] = entries

    # ------------------------------------------------------------------ GPT check
    gpt_valid = False
    if len(data) >= 2 * SECTOR:
        header = data[SECTOR : SECTOR + 512]
        if header[0:8] == b"EFI PART":
            gpt_valid = True
            result.update(_parse_gpt(header, dev, result))
    if not gpt_valid and entries and entries[0]["type_id"] == 0xEE:
        result["warnings"].append("protective MBR present but the GPT header is missing/corrupt — "
                                  "look for the backup GPT in the last sector")
        if dev and dev.size > 2 * SECTOR:
            backup = dev.pread(dev.size - SECTOR, 512)
            if backup[0:8] == b"EFI PART":
                result["warnings"].append("backup GPT found in the last sector — primary table can be rebuilt from it")
    if not result["scheme"] or result["scheme"] == "none":
        result["scheme"] = "MBR" if entries else "none"

    result["warnings"].extend(_sanity_check(result["partitions"], dev))
    return result


def _parse_mbr_entries(raw: bytes, dev) -> list[dict]:
    out = []
    for i in range(4):
        e = raw[i * 16 : (i + 1) * 16]
        if len(e) < 16:
            continue
        status, ptype = e[0], e[4]
        lba = struct.unpack("<I", e[8:12])[0]
        count = struct.unpack("<I", e[12:16])[0]
        if ptype == 0 or count == 0:
            continue
        name, kind = MBR_TYPES.get(ptype, (f"Unknown 0x{ptype:02x}", "unknown"))
        out.append({
            "index": i, "number": i + 1, "slot": "primary", "bootable": status == 0x80,
            "type_id": ptype, "type": name, "kind": kind,
            "offset": lba * SECTOR, "size": count * SECTOR, "lba": lba, "sectors": count,
            "flags": ["boot"] if status == 0x80 else [],
        })
        if ptype in (0x05, 0x0F, 0x85):
            out[-1]["flags"].append("extended-container")
    return out


def _parse_gpt(header: bytes, dev, result: dict) -> dict:
    parts = []
    header_crc = struct.unpack("<I", header[16:20])[0]
    calc = _crc32(header[:16] + b"\0\0\0\0" + header[20:92])
    entries_lba = struct.unpack("<Q", header[72:80])[0]
    num = struct.unpack("<I", header[80:84])[0]
    entry_size = struct.unpack("<I", header[84:88])[0]
    entries_crc = struct.unpack("<I", header[88:92])[0]
    disk_guid = _guid(header[56:72])
    warnings = []
    if header_crc != calc:
        warnings.append(f"GPT header CRC mismatch (stored 0x{header_crc:08x}, computed 0x{calc:08x}) — "
                        "the table may have been tampered with")
    raw = dev.pread(entries_lba * SECTOR, num * entry_size) if dev else b""
    if raw and _crc32(raw) != entries_crc:
        warnings.append("GPT partition-array CRC mismatch")
    for i in range(min(num, 128)):
        e = raw[i * entry_size : (i + 1) * entry_size]
        if len(e) < 128:
            continue
        type_guid = _guid(e[0:16])
        if not type_guid or type_guid == "00000000-0000-0000-0000-000000000000" or e[0:16] == b"\x00" * 16:
            continue
        uniq = _guid(e[16:32])
        first = struct.unpack("<Q", e[32:40])[0]
        last = struct.unpack("<Q", e[40:48])[0]
        attrs = struct.unpack("<Q", e[48:56])[0]
        try:
            name = e[56:128].decode("utf-16-le").split("\x00")[0]
        except UnicodeDecodeError:
            name = ""
        friendly, kind = GUID_TYPES.get(type_guid, ("Unknown GUID type", "unknown"))
        flags = []
        if attrs & 0x1:
            flags.append("required")
        if attrs & 0x2:
            flags.append("no-block-io")
        if attrs & 0x4:
            flags.append("legacy-bios-bootable")
        if attrs & (1 << 60):
            flags.append("read-only")
        if attrs & (1 << 62):
            flags.append("hidden")
        if attrs & (1 << 63):
            flags.append("do-not-automount")
        parts.append({
            "index": i, "number": i + 1, "slot": "gpt", "bootable": kind in ("esp", "bios-boot"),
            "type_guid": type_guid, "uid": uniq, "type": friendly, "kind": kind,
            "name": name or friendly, "offset": first * SECTOR, "size": (last - first + 1) * SECTOR,
            "lba": first, "sectors": last - first + 1, "attributes": attrs, "flags": flags,
            "primary": "ESP" if kind == "esp" else ("Recovery" if kind in ("winre", "macos") else ""),
        })
    return {"scheme": "GPT", "partitions": parts, "disk_guid": disk_guid, "protective_mbr": True,
            "warnings": result["warnings"] + warnings, "header_crc_ok": header_crc == calc}


def _sanity_check(parts: list[dict], dev) -> list[str]:
    warns = []
    ordered = sorted(parts, key=lambda p: p["offset"])
    for a, b in zip(ordered, ordered[1:]):
        if a["offset"] + a["size"] > b["offset"] and a["slot"] == b["slot"]:
            warns.append(f"overlapping partitions: {a.get('name', a['number'])} and {b.get('name', b['number'])}")
    if dev and dev.size:
        for p in parts:
            if p["offset"] + p["size"] > dev.size + SECTOR:
                warns.append(f"partition {p['number']} extends past the end of the device (carved/truncated image?)")
    bootable = [p for p in parts if p.get("bootable")]
    if not bootable:
        warns.append("no bootable partition marked — system may rely on UEFI fallback boot")
    return warns


def _sniff_filesystem(head: bytes) -> Optional[str]:
    if head[3:11] in (b"NTFS    ",):
        return "NTFS"
    if head[0:2] == b"\xeb" or head[0:1] == b"\xe9":
        if b"FAT" in head[54:64] or b"FAT" in head[82:92]:
            return "FAT"
    if b"EXFAT   " in head[3:16]:
        return "exFAT"
    if head[54:58] == b"FAT1" or head[82:86] == b"FAT3":
        return "FAT32"
    if head[0x438:0x43A] == b"\x53\xef":
        return "ext2/3/4"
    if head[1024:1026] in (b"H+", b"HX") or head[0:2] in (b"H+", b"HX"):
        return "HFS+"
    if head[32:36] == b"NXSB":
        return "APFS"
    if head[0:4] == b"XFSB":
        return "XFS"
    if head[0x4000 + 0x40 : 0x4000 + 0x48] == b"_BHRfS_M":
        return "btrfs"
    if head[1024:1032] in (b"\x00\x00\x00\x00\x00\x00\x00\x00",) and head[0x10000:0x10008] == b"\x00" * 8:
        return None
    if head[0x10000 : 0x10000 + 4] == b"hsqs":
        return "squashfs"
    if head[0:4] == b"LUKS" or head[0:6] == b"\x4c\x55\x4b\x53\xba\xbe":
        return "LUKS (encrypted)"
    if head[0:4] == b"regf":
        return "Windows registry hive"
    return None


def scan_extended(data_window, base_lba: int = 0) -> list[dict]:
    """Walk an MBR extended-partition chain (EBR links) one level deep."""
    out = []
    for i in range(len(data_window) // 16):
        e = data_window[i * 16 : (i + 1) * 16]
        if len(e) < 16 or e[4] == 0:
            continue
        lba = struct.unpack("<I", e[8:12])[0]
        count = struct.unpack("<I", e[12:16])[0]
        name, kind = MBR_TYPES.get(e[4], ("Unknown", "unknown"))
        out.append({"index": i, "slot": "logical", "number": i + 1, "type_id": e[4], "type": name, "kind": kind,
                    "offset": (base_lba + lba) * SECTOR, "size": count * SECTOR, "lba": base_lba + lba,
                    "sectors": count, "bootable": False, "flags": ["logical"]})
    return out
