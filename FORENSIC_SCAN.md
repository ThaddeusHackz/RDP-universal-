# THADD OS — forensic scan

THADD OS treats a disk the way an examiner does: **read it, never trust it, and
write down how you know what you know.** Two things live in this repository:

* **the engine** — `thadd/forensics/`, dependency-free readers plus a triage
  pass that reverse-engineers an operating system out of a disk image; and
* **this document** — the method, the commands, and where the technique comes
  from.

> **Method reference.** The agent-driven reverse-engineering approach used here —
> look at the artefact, form a hypothesis, verify it against the binary, and only
> then claim it — follows **[morluto/rea](https://github.com/morluto/rea)**
> ("Reverse Engineered Anything"), an MCP-based toolkit for reverse engineering
> binaries, applications and runtime behaviour down to the byte level.
> REA is the reference implementation for *how* to analyse; THADD OS implements
> the same discipline for *storage* — partition tables, filesystem structures,
> registry hives and deleted records — with readers written from scratch against
> the published on-disk formats, so the media never has to be mounted.

---

## 1. What the engine reads

| Reader | File | What it understands |
| --- | --- | --- |
| Partition schemes | `partitions.py` | MBR, extended/EBR chains, GPT (primary + backup), protective MBR, CRC validation, type GUIDs, super-floppy volumes |
| FAT | `fat.py` | FAT12/16/32 + exFAT, VFAT long names, cluster chains, deleted entries (`0xE5`), volume labels, EFI System Partition layout |
| NTFS | `ntfs.py` | boot sector, `$MFT` parsing, runlists, resident + non-resident attributes, alternate data streams, deleted MFT records, FILETIME |
| ext4 | `ext4.py` | superblock, group descriptors, inodes, extents, directory entries, deletions, journal recovery hints |
| HFS+ | `hfs.py` | volume header, catalog B-tree, extents overflow, Unicode names |
| APFS | `apfs.py` | container superblock, checkpoint descriptors, volume superblocks, snapshots |
| Windows registry | `registry.py` | hive files (`SAM`, `SYSTEM`, `SOFTWARE`, `SECURITY`, `NTUSER.DAT`), cells, keys/values, mojibake-safe string decoding |
| Device layer | `device.py` | read-only block devices and files, sliced access (partition windows), streaming hashes, zero/entropy tests |
| Triage | `triage.py` | the report: evidence, partitions, filesystems, OS verdict with confidence, artifacts, timeline, indicators, acquisition plan |

## 2. Run a scan

**On the live system** (or any machine with Python 3 and this repository):

```bash
thadd dfir /dev/sdX                # reverse-engineer a whole disk
thadd dfir /evidence/disk.E01      # or an image file
python3 -m thadd.forensics.cli /dev/sdX --out ./case-2026-10-13
```

**Through the THADD service** (the desktop's *Forensics Lab* app and the AI
operator use the same call):

```bash
curl -s -X POST http://127.0.0.1:8080/api/security.analyze_image \
     -H 'Content-Type: application/json' \
     -d '{"path": "/dev/sdX", "deep": true}' | python3 -m json.tool | head -40
```

**From Python:**

```python
from thadd.forensics import triage
report = triage.analyze("/dev/sdX", deep=True, progress=print)
print(triage.report_markdown(report))          # human-readable
print(triage.save_report(report, "./case"))   # JSON + markdown onto disk
```

## 3. What a report contains

```
evidence        sha256, size, device-or-file, chain of custody, report hash
partition_table scheme, disk id/guid, protective MBR, warnings (CRC, backup GPT)
partitions      number, offset in bytes, size, type, bootable, type guid, uid
filesystems     per partition: FAT / exFAT / NTFS / ext4 / HFS+ / APFS or "unknown"
os_detected     family, distro, release, confidence, and the evidence behind it
artifacts       windows / macos / linux / firmware structures that carry history
timeline        timestamps found, oldest to newest
indicators      things an examiner should look at twice
acquisition_plan what to image, verify and carve - always produced
stats           partitions, filesystems, artifacts, entropy, elapsed time
```

Everything is **read-only**: `device.py` opens with `O_RDONLY` and never seeks
with write intent. A scan never mounts a filesystem, so it works on evidence that
the host itself cannot mount — an APFS container on Linux, an NTFS volume with a
broken `$MFT`, a disk with a deliberately damaged partition table.

## 4. Regression tests

The readers are verified against images with known content, not against
themselves:

```bash
python3 thadd/forensics/tests/test_triage.py
```

The suite builds a FAT16 volume with `mkfat.FatImage`, wraps it in an MBR and in
a GPT, then checks that the engine reports the right scheme, the right partition
offset, the right filesystem *and* — for the file-level readers — that the bytes
of a multi-cluster file, a nested directory and a real deleted entry come back
exactly as written. It also feeds the engine 3 KB of random data and requires it
to say "Unknown" instead of inventing an operating system.

> Those tests earned their keep immediately: they caught a FAT12/16 reader bug
> where the data area was computed without the fixed root directory, so every
> cluster read came out of the wrong part of the volume. Fixed in `fat.py`, with
> the cluster-chain test above as the guard.

## 5. Honesty rules the engine follows

1. **No invention.** If the structure is not recognised, it says `unknown` and
   recommends carving — it does not guess a filesystem from a stray signature.
2. **Confidence, not certainty.** Every OS verdict carries a score and lists the
   evidence that produced it (`_fingerprint`).
3. **Evidence first.** The hash of the target is taken before anything else is
   read deeply and stored in the report; the report itself is hashed too, so a
   later edit is detectable.
4. **Warnings are content.** CRC mismatches, phantom GPT entries, a missing
   backup table and unreadable regions are reported, never swallowed.
