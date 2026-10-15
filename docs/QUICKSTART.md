# Desktop ISO: beginner download and VirtualBox guide

[README](../README.md) · Release inventory checked **2026-10-15**, tag **v1.6**.

## 1. Download the desktop image

Open [v1.6 Assets](https://github.com/ThaddeusHackz/THADD-OS---THE-REVERSE-ENGINEERED-OS-/releases/tag/v1.6) and download **every numbered part**:

1. `THADD-OS-2026.10.14-aurora-amd64.iso.part-00`
2. `THADD-OS-2026.10.14-aurora-amd64.iso.part-01`
3. `THADD-OS-2026.10.14-aurora-amd64.iso.part-02`
4. `parts.sha256`
5. `RELEASE-NOTES.md`; download the desktop whole-image `.iso.sha256` **if available**.

These parts are pieces of **one large Debian-live desktop ISO**, not three bootable images. Keep them in a new folder containing only this image's files. **Never mix release tags, dates or versions. Do not extract the pieces with archive software. Do not rename any piece to `.iso`.** Join them in numerical order before attaching to a VM.

Allow at least **12 GB free** for both the pieces (5,898,977,280 bytes total) and reconstructed ISO (the same size), with extra room for a VM and recording. Use NTFS/exFAT/ext4 or another filesystem supporting files over 4 GB, not FAT32. Browser downloads must be complete: no `.crdownload`, `.partial`, or automatically renamed `(1)` copies.

The separate **`THADD-OS-1.0-x86_64.iso`** (77,848,576 bytes, approximately 78 MB) is an experimental minimal Linux image with a different boot path. It is already a single ISO; **do not join it to desktop parts**. Its `.iso.sha256`/`manifest.json` do not verify the desktop.

## 2. Verify pieces, join, then verify the whole ISO

### Linux (Bash)

In a terminal, change to the folder containing these exact downloads:

```bash
sha256sum -c parts.sha256
# Stop if any part is missing or any checksum fails.
cat THADD-OS-2026.10.14-aurora-amd64.iso.part-* > THADD-OS-2026.10.14-aurora-amd64.iso
stat -c %s THADD-OS-2026.10.14-aurora-amd64.iso
# Expected size: 5898977280
```

Zero-padded `00`, `01`, `02` sort in numerical order. Ensure the wildcard matches exactly those three pieces, not stale downloads. A failed checksum means re-download the failing piece from **the same release**; do not boot the result.

### Windows: verify pieces with native PowerShell

Open PowerShell in the download folder. This parses standard `sha256sum` output and checks each listed filename with Windows `Get-FileHash`; it is **not** a Linux command:

```powershell
$ErrorActionPreference = 'Stop'
$expectedNames = @(
 'THADD-OS-2026.10.14-aurora-amd64.iso.part-00',
 'THADD-OS-2026.10.14-aurora-amd64.iso.part-01',
 'THADD-OS-2026.10.14-aurora-amd64.iso.part-02'
)
$seen = @()
Get-Content -LiteralPath '.\parts.sha256' | ForEach-Object {
 if ($_ -notmatch '^([0-9a-fA-F]{64}) [ *](.+)$') { throw "Invalid checksum line: $_" }
 $expected = $Matches[1]; $name = $Matches[2]
 if ($name -notin $expectedNames) { throw "Unexpected filename: $name" }
 if ($name -in $seen) { throw "Duplicate filename: $name" }
 $seen += $name
 $actual = (Get-FileHash -Algorithm SHA256 -LiteralPath $name).Hash
 if ($actual -ne $expected) { throw "Checksum FAILED: $name" }
 Write-Host "OK: $name"
}
if ($seen.Count -ne 3) { throw 'Expected all three parts in parts.sha256' }
```

### Windows Command Prompt: join the three parts

Open **Command Prompt** (`cmd.exe`), not PowerShell, and `cd /d` to the folder. `copy` is different in PowerShell; the following command belongs in CMD:

```bat
copy /b "THADD-OS-2026.10.14-aurora-amd64.iso.part-00"+"THADD-OS-2026.10.14-aurora-amd64.iso.part-01"+"THADD-OS-2026.10.14-aurora-amd64.iso.part-02" "THADD-OS-2026.10.14-aurora-amd64.iso"
```

CMD reports one file copied. Check its size in Explorer → Properties: **5,898,977,280 bytes** (not “size on disk”). This command uses binary concatenation, not extraction. Do not attach a part to VirtualBox.

### Whole-image checksum: a separate step

Part checksums verify the downloads; a whole-image checksum also checks the reconstructed result. **As reviewed, v1.6 does not list `THADD-OS-2026.10.14-aurora-amd64.iso.sha256`.** Do not substitute the minimal image's checksum or a 2026.10.15 build report. Without a trusted whole-image checksum, report this verification step as **unavailable**. You can compute your own hash for test provenance, but that alone is not publisher verification.

If the maintainer supplies the matching desktop sidecar, keep the reconstructed ISO's name exactly as above (the name inside the sidecar). On Linux, in that folder:

```bash
sha256sum -c THADD-OS-2026.10.14-aurora-amd64.iso.sha256
```

On Windows PowerShell, print the downloaded sidecar and compute the ISO hash:

```powershell
Get-Content -LiteralPath '.\THADD-OS-2026.10.14-aurora-amd64.iso.sha256'
Get-FileHash -Algorithm SHA256 -LiteralPath '.\THADD-OS-2026.10.14-aurora-amd64.iso'
```

Compare **all 64 hexadecimal characters**, ignoring letter case; the file name in the sidecar must identify this ISO. Alternatively native CMD supports:

```bat
certutil -hashfile "THADD-OS-2026.10.14-aurora-amd64.iso" SHA256
```

This prints a hash; it does **not** automatically compare it. A different filename such as `thadd-os.iso` requires explicitly comparing that file's hash to the trusted sidecar, or renaming the reconstructed image back to the sidecar's expected name—not renaming a part.

**Testing disclosure:** Linux binary joining/checksum semantics are exercised by `scripts/tests/test_documented_interfaces.py` with synthetic pieces. CMD/PowerShell examples have been reviewed for their native interfaces, but **not executed on Windows in this Linux environment**, and actual release bytes were inaccessible. Windows/released-image testing is outstanding; do not call these end-to-end release-tested examples yet.

## 3. Create a VirtualBox VM

Use a host with x86_64 virtualization support and enough spare resources. VirtualBox on ARM hosts does not make this amd64 image native ARM software.

1. Select **New**, name it THADD OS, choose **Linux → Debian (64-bit)**. **Skip unattended installation** (this is a live image, not an automated installer).
2. Allocate **4096 MB RAM minimum**, preferably **8192 MB** if the host can spare it; **2 CPUs**. Do not exhaust the host's resources.
3. Create a **40 GB dynamically allocated VDI**. This is an isolated guest disk that grows as used. It does not install THADD or make the session persistent by itself.
4. Settings → System → Motherboard: **Enable EFI**. Secure Boot is not supported by this build configuration; leave it disabled.
5. Settings → Display: **VMSVGA**, **128 MB video memory**, **3D acceleration disabled** initially. After a successful baseline test, 3D may improve compositing if compatible host drivers and guest additions are present; turn it back off if glitches occur. No perfect VirtualBox compatibility is claimed.
6. Settings → Network: Adapter 1 enabled, **NAT**, cable connected. Do not configure bridged access or port forwarding just for this test.
7. Settings → Storage: optical drive → choose **`THADD-OS-2026.10.14-aurora-amd64.iso`**, the reconstructed file, **not `.part-00`**.
8. Start; select the normal **Live** entry (typically **Live system (amd64)**, source/generated menu identifier **`live-amd64`**, kernel parameters include **`boot=live`**). There is no confirmed graphical installer entry. The committed report confirms that identifier on a later build; exact v1.6 display text awaits a real boot.
9. Wait for LightDM autologin. If a login is requested, source-configured desktop credentials are **`thadd` / `thadd`**. Change the password privately with `passwd`.

**Do not repartition your host disk merely to try this VM.** Do not grant the guest raw host disks. Start with shared clipboard/drag-and-drop/shared folders disabled if handling untrusted files.

## 4. Check the running system

```bash
thadd version
cat /etc/thadd/build-info
thadd doctor
thadd-desktop-selftest
thadd-ai doctor
thadd-ai selftest
thadd-scan --quick --summary
thadd-toolbox --status
```

`thadd doctor` is advisory (it can exit zero with problems). Read the output. The package installer report is `/usr/share/thadd/apt-safe-report.txt`. [README software status](../README.md#applications-and-availability) explains why an optional package isn't necessarily installed.

## 5. Live data and installation

A live session normally loses its overlay at reboot. Save work intentionally to a disposable guest disk/shared folder/USB volume; do not assume a VM disk captures the live root.

Source passes `persistence persistence-label=THADD-PERSISTENCE` to Debian live-boot. A separately prepared persistence filesystem with the matching label and a `persistence.conf` (commonly `/ union`) is required. This is **source-configured capability, not runtime-verified persistence**. Consult [Debian live persistence documentation](https://live-team.pages.debian.net/live-manual/html/live-manual/customizing-run-time-behaviours.en.html#persistence), use only disposable guest media and test a marker across reboot before trusting it. No destructive partitioning recipe is provided here.

**Installation is unconfirmed:** the build sets `--debian-installer none`. No `debian-installer-launcher` workflow or working THADD graphical installer has been established. Older documentation promising one was inaccurate. Neither creating a VDI nor selecting Live installs the system. Keep evaluation in the VM; do not improvise a host-disk installation.

See [troubleshooting](../README.md#troubleshooting-and-diagnostics) and [VM acceptance/recording](VM-TESTING.md).
