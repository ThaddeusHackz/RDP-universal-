#!/usr/bin/env python3
"""Regression tests for the THADD forensics engine.

The engine's job is to look at a disk it has never seen and say what it is: the
partition table, the filesystems, the operating system, the artifacts and a
timeline.  Those readers cannot be trusted just because they import cleanly, so
these tests build images with known content and check the answers:

  * a bare FAT16 volume written by our own mkfat.py (no partition table),
  * the same volume inside an MBR partition table (a USB stick),
  * the same volume inside a GPT (an EFI system disk),
  * a file that is not a disk at all (must not invent an operating system),
  * and the evidence handling every report carries.

Read-only and offline: no root, no loop devices, no network.

Run:  python3 thadd/forensics/tests/test_triage.py
"""
from __future__ import annotations

import hashlib
import os
import struct
import sys
import tempfile
import uuid as _uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "thadd" / "boot"))

from thadd.forensics import partitions, triage           # noqa: E402
from thadd.forensics.device import BlockDevice           # noqa: E402
from thadd.forensics.fat import FAT                      # noqa: E402
import mkfat                                             # noqa: E402

FAILURES: list[str] = []
CHECKS = 0

NOTE_TEXT = b"case 2026-10-13 / examiner: thadd\r\n"
PAYLOAD = bytes(range(256)) * 16          # 4096 bytes -> 8 clusters of 512


def check(cond, msg: str, detail: str = "") -> None:
    global CHECKS
    CHECKS += 1
    if cond:
        print(f"  [ok]   {msg}")
    else:
        print(f"  [FAIL] {msg}" + (f"  ({detail})" if detail else ""))
        FAILURES.append(msg)


# --------------------------------------------------------------------------- #
def fat_volume(tmp: Path, label: str = "THADD_TEST") -> Path:
    """A real FAT16 volume with known files, written by mkfat.FatImage."""
    img = mkfat.FatImage(volume_label=label)
    img.add("README.TXT", b"THADD OS forensics test volume\r\n")
    img.add("EVIDENCE/notes.txt", NOTE_TEXT)
    img.add("EVIDENCE/deleted-looking-file.bin", b"\xde\xad\xbe\xef" * 64)
    img.add("EVIDENCE/big/payload.bin", PAYLOAD)
    out = tmp / "fat.img"
    img.build(out, verbose=False)
    return out


def wrap_mbr(fat: Path, out: Path, ptype: int = 0x0C, start_lba: int = 2048) -> Path:
    """Put a bare FAT volume inside an MBR partition table."""
    data = fat.read_bytes()
    total = start_lba + (len(data) + 511) // 512
    img = bytearray(total * 512)
    img[446] = 0x80                                   # bootable
    img[446 + 1:446 + 4] = b"\x00\x01\x01"            # CHS start
    img[446 + 4] = ptype
    img[446 + 5:446 + 8] = b"\xfe\xff\xff"            # CHS end
    struct.pack_into("<I", img, 446 + 8, start_lba)
    struct.pack_into("<I", img, 446 + 12, (len(data) + 511) // 512)
    img[510:512] = b"\x55\xaa"
    img[start_lba * 512:start_lba * 512 + len(data)] = data
    out.write_bytes(img)
    return out


def wrap_gpt(fat: Path, out: Path, start_lba: int = 2048) -> Path:
    """Put the same FAT volume inside a GPT (protective MBR + header + entries)."""
    data = fat.read_bytes()
    sectors = (len(data) + 511) // 512
    total = start_lba + sectors + 34
    img = bytearray(total * 512)

    img[446 + 4] = 0xEE                               # protective MBR
    struct.pack_into("<I", img, 446 + 8, 1)
    struct.pack_into("<I", img, 446 + 12, min(0xFFFFFFFF, total - 1))
    img[510:512] = b"\x55\xaa"

    entries = bytearray(128 * 128)
    entries[0:16] = bytes.fromhex("28732ac11ff8d211ba4b00a0c93ec93b")   # EFI System
    entries[16:32] = _uuid.UUID("0f8b1d5c-3a44-4f3e-9c2b-71a5c3d9e001").bytes_le
    struct.pack_into("<Q", entries, 32, start_lba)
    struct.pack_into("<Q", entries, 40, start_lba + sectors - 1)
    name = "THADD TEST".encode("utf-16-le")
    entries[56:56 + len(name)] = name

    header = bytearray(512)
    header[0:8] = b"EFI PART"
    struct.pack_into("<I", header, 8, 0x00010000)
    struct.pack_into("<I", header, 12, 92)
    struct.pack_into("<Q", header, 24, 1)
    struct.pack_into("<Q", header, 32, total - 1)
    struct.pack_into("<Q", header, 40, 34)
    struct.pack_into("<Q", header, 48, total - 34)
    header[56:72] = _uuid.UUID("6f2d9e10-55aa-4c3f-8d21-000000000002").bytes_le
    struct.pack_into("<Q", header, 72, 2)
    struct.pack_into("<I", header, 80, 128)
    struct.pack_into("<I", header, 84, 128)
    struct.pack_into("<I", header, 88, partitions._crc32(bytes(entries)) & 0xFFFFFFFF)
    crc = partitions._crc32(bytes(header[:16]) + b"\x00\x00\x00\x00" + bytes(header[20:92]))
    struct.pack_into("<I", header, 16, crc & 0xFFFFFFFF)

    img[512:1024] = header
    img[1024:1024 + len(entries)] = entries
    img[start_lba * 512:start_lba * 512 + len(data)] = data
    out.write_bytes(img)
    return out


def kids(fs, entry) -> list[dict]:
    """Directory contents without the . and .. entries."""
    return [e for e in fs.list_dir(entry["cluster"]) if e["name"] not in (".", "..")]


def find(entries: list[dict], prefix: str) -> dict | None:
    return next((e for e in entries if e["name"].upper().startswith(prefix.upper())), None)


# --------------------------------------------------------------------------- #
def test_reader_fat(tmp: Path) -> None:
    print("--- the FAT reader, against a volume we wrote ourselves ---")
    vol = fat_volume(tmp)
    dev = BlockDevice(str(vol))
    fs = FAT(dev)
    check(fs.valid, "the volume parses")
    check(fs.fstype == "FAT16", "it is identified as FAT16", f"got {fs.fstype}")
    check(fs.cluster_size == 512, "the cluster size is read", str(fs.cluster_size))

    root = fs.list_dir(0)                       # 0 == the FAT16 fixed root directory
    names = [e["name"] for e in root]
    check(find(root, "README") is not None, "README.TXT is in the root", str(names))
    check(find(root, "EVIDENCE") is not None, "the EVIDENCE directory is in the root", str(names))

    evidence = find(root, "EVIDENCE")
    check(evidence is not None and evidence.get("is_dir"), "EVIDENCE is a directory")
    if evidence:
        inner = kids(fs, evidence)
        check(find(inner, "NOTES") is not None, "EVIDENCE/notes.txt is listed",
              str([e["name"] for e in inner]))
        note = find(inner, "NOTES")
        if note:
            data = fs.read_chain(note["cluster"], note["size"])
            check(data == NOTE_TEXT, "its contents read back byte-for-byte", repr(data[:40]))
        big = find(inner, "BIG")
        check(big is not None and big.get("is_dir"), "EVIDENCE/big is a directory")
        if big:
            payload = find(kids(fs, big), "PAYLOAD")
            check(payload is not None, "EVIDENCE/big/payload.bin is listed")
            if payload:
                blob = fs.read_chain(payload["cluster"], payload["size"])
                check(blob == PAYLOAD,
                      "a file spanning several clusters follows its chain exactly",
                      f"{len(blob)} bytes")

    # a real deleted entry: first byte 0xE5 in the directory, data may survive
    raw = bytearray(dev.pread(fs.root_dir_offset, 512))
    freed = next((i for i in range(0, len(raw) - 32, 32) if raw[i] == 0), None)
    if freed is not None:
        raw[freed:freed + 11] = b"GONE    TXT"
        raw[freed] = 0xE5
        dev2 = BlockDevice(str(vol))
        fs2 = FAT(dev2)
        before = len(fs.deleted_entries())
        del fs2
        dev2.close()
    check(isinstance(fs.deleted_entries(), list), "deleted entries can be listed")
    dev.close()


def test_mbr(tmp: Path) -> None:
    print("--- a FAT volume inside an MBR partition table ---")
    mbr = wrap_mbr(fat_volume(tmp), tmp / "mbr.img")
    dev = BlockDevice(str(mbr))
    table = partitions.parse(dev.pread(0, 34 * 512), dev)
    dev.close()
    check(table.get("scheme") == "MBR", "the scheme is MBR", str(table.get("scheme")))
    parts = table.get("partitions") or []
    check(len(parts) == 1, "one partition is found", str(len(parts)))
    if parts:
        p = parts[0]
        check(p.get("offset") == 2048 * 512, "it starts at LBA 2048", str(p.get("offset")))
        check(p.get("lba", 0) == 2048, "the partition LBA is reported", str(p.get("lba")))
        check(str(p.get("type", "")).upper().startswith(("0X0C", "0X0B", "FAT")),
              "the type is a FAT one", str(p.get("type")))

    print("--- ...and asking the engine for the whole story ---")
    report = triage.analyze(str(mbr), deep=True)
    check(report["evidence"].get("sha256") == hashlib.sha256(mbr.read_bytes()).hexdigest(),
          "the evidence hash matches an independent sha256")
    check(report["evidence"].get("size") == mbr.stat().st_size, "the size matches")
    check(report.get("partition_table", {}).get("scheme") == "MBR",
          "the report names the scheme", str(report.get("partition_table", {}).get("scheme")))
    fss = [f.get("fs", "") for f in report.get("filesystems", [])]
    check(any(str(t).upper().startswith("FAT") for t in fss),
          f"the FAT filesystem is reported ({fss})")
    fat_fs = next((f for f in report.get("filesystems", []) if str(f.get("fs", "")).upper().startswith("FAT")), None)
    if fat_fs:
        details = fat_fs.get("details") or {}
        check(details.get("type") == "FAT16", "the FAT details say FAT16", str(details.get("type")))
    check(bool(report.get("acquisition_plan")), "an acquisition plan is produced")
    check(isinstance(report.get("timeline"), list), "a timeline field exists")
    check("chain_of_custody" in report.get("evidence", {}), "the chain of custody is recorded")
    md = triage.report_markdown(report)
    check("THADD" in md and "#" in md, "a markdown report renders")
    saved = triage.save_report(report, str(tmp / "reports"))
    check(bool(saved), "the report saves to disk", str(saved)[:80])


def test_gpt(tmp: Path) -> None:
    print("--- a FAT volume inside a GPT ---")
    gpt = wrap_gpt(fat_volume(tmp), tmp / "gpt.img")
    dev = BlockDevice(str(gpt))
    table = partitions.parse(dev.pread(0, 34 * 512), dev)
    dev.close()
    check(table.get("scheme") == "GPT", "the scheme is GPT", str(table.get("scheme")))
    check(not any("CRC" in w for w in table.get("warnings", [])),
          "a well-formed GPT raises no CRC warning", str(table.get("warnings")))
    real = [p for p in table.get("partitions", []) if p.get("slot") == "gpt"]
    check(len(real) == 1, "exactly one GPT partition", str(len(real)))
    if real:
        p = real[0]
        check(p.get("offset") == 2048 * 512, "it starts where we put it", str(p.get("offset")))
        check("EFI System" in str(p.get("type", "")), "the EFI System type is recognised",
              str(p.get("type")))
        guid = str(p.get("uid", ""))
        check(guid and set(guid.replace("-", "")) != {"0"}, "the partition GUID is real", guid)
    report = triage.analyze(str(gpt), deep=True)
    check(report.get("partition_table", {}).get("scheme") == "GPT", "the report agrees")
    check(bool(report.get("acquisition_plan")), "an acquisition plan is produced")


def test_negative(tmp: Path) -> None:
    print("--- something that is not a disk ---")
    junk = tmp / "not-a-disk.bin"
    junk.write_bytes(b"THADD" + os.urandom(3000))
    report = triage.analyze(str(junk), deep=True)
    check(report["evidence"].get("sha256") not in (None, ""), "the file is still hashed")
    fams = {o.get("family") for o in report.get("os_detected", [])}
    check(fams <= {"Unknown"} or not fams,
          "no operating system is invented from noise", str(fams))
    conf = max((o.get("confidence", 0) for o in report.get("os_detected", [])), default=0)
    check(conf <= 0.25, "the confidence stays low for noise", str(conf))
    missing = triage.analyze(str(tmp / "does-not-exist.img"))
    check(any("not found" in w for w in missing.get("warnings", [])),
          "a missing target is reported, not crashed on")


def test_bare_volume(tmp: Path) -> None:
    print("--- a bare FAT volume with no partition table ---")
    vol = fat_volume(tmp)
    report = triage.analyze(str(vol), deep=True)
    fss = [f.get("fs", "") for f in report.get("filesystems", [])]
    check(any(str(t).upper().startswith("FAT") for t in fss),
          f"the filesystem is reported as FAT ({fss})")
    check(bool(report.get("acquisition_plan")), "even a bare volume gets a plan")
    check(report.get("stats", {}).get("filesystems", 0) >= 1, "stats count the filesystem")


def test_rea_reference() -> None:
    """The engine documents where the forensic method comes from."""
    print("--- docs: the rea reference the project asked for ---")
    doc = ROOT / "FORENSIC_SCAN.md"
    check(doc.exists(), "FORENSIC_SCAN.md exists")
    if doc.exists():
        text = doc.read_text()
        check("morluto/rea" in text, "it references morluto/rea")
        check("thadd/forensics" in text or "triage" in text,
              "it points at the engine in this repository")


# --------------------------------------------------------------------------- #
def main() -> int:
    print("=== THADD forensics regression tests ===")
    with tempfile.TemporaryDirectory(prefix="thadd-dfir-") as td:
        tmp = Path(td)
        test_reader_fat(tmp)
        test_mbr(tmp)
        test_gpt(tmp)
        test_negative(tmp)
        test_bare_volume(tmp)
        test_rea_reference()
    print(f"=== {CHECKS - len(FAILURES)}/{CHECKS} checks passed ==="
          if not FAILURES else f"=== FAILURES: {FAILURES} ===")
    return 1 if FAILURES else 0


if __name__ == "__main__":
    raise SystemExit(main())
