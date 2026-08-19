# 🔍 THADD OS — Pre-Build Forensic Scan Report

**Scan date:** 2026-08-19 · **Scanner:** `scripts/forensic-scan.sh` (shipped with this repo)
**Target:** `ThaddeusHackz/RDP-universal-` — the legacy repository contents
**Disposition:** target purged per repository-owner directive; THADD OS built in its place.

> **Follow-up (2026-08-19):** a second, RDP-login-specific forensic pass found why
> the published credentials still failed to log anyone in. See
> [`docs/RDP_LOGIN_FORENSICS.md`](docs/RDP_LOGIN_FORENSICS.md) (findings + fixes)
> and [`docs/FORENSIC_SCAN_CURRENT.md`](docs/FORENSIC_SCAN_CURRENT.md) (raw rescan,
> including the RDP login-path audit — every check PASS).

---

## 0. Executive Summary

The legacy repository contained a single GitHub Actions workflow
(`.github/workflows/main.yml`) that provisioned a throwaway **Windows** RDP
box on a GitHub-hosted runner, wired it into a **Tailscale** overlay network,
created an administrator account with a generated password, opened Windows
Firewall on **port 3389**, and idled for up to 60 hours.

**Forensic findings at a glance**

| Finding | Severity | Detail |
|---|---|---|
| CI secret reference | Low | `${{ secrets.TAILSCALE_AUTH_KEY }}` — not embedded, referenced safely |
| Privileged account creation | Medium | local admin `RDP` created on the runner |
| Firewall + service tampering | Medium | registry edits + `netsh` rules + `TermService` restart |
| Remote installer fetch | Medium | MSI pulled from `pkgs.tailscale.com` |
| Long-running resource squat | Low | `while ($true) { Start-Sleep 300 }` keep-alive loop |
| No embedded credentials in tree | — | clean |

**Composite risk score: 35/100 — MODERATE.**

No secrets were leaked; the patterns flagged are typical of disposable
remote-access automation, but they belong to a transient CI runner rather
than a real operating system. THADD OS replaces this with a proper,
container-native Linux desktop: deterministic, health-checked, persistent
and CI-verified.

## 1. Methodology

The scan performed, over the entire working tree **and full git history**:

- **Cryptographic inventory** — SHA-256 of every file with size, MIME type and mtime
- **Entropy audit** — byte-level Shannon entropy to surface keys, ciphertext and packed blobs
- **Secret pattern database** — 17 regex families (AWS, GitHub PATs, Slack, OpenAI, DB DSNs, private keys, passwords…)
- **Git forensics** — author identity, commit timeline, full-history secret re-scan
- **Network I/O extraction** — every URL and IPv4 literal
- **Behavioral profiling** — registry/firewall/service/VPN/RDP/execution capabilities
- **Risk scoring** — composite model (secrets +30, >5 external URLs +15, high-entropy blobs +15, remote-exec +20)

The scanner itself is reproducible: `scripts/forensic-scan.sh <target> <output>`.

## 2. Target Acquisition (raw data)

| **Scan timestamp (UTC)** | `2026-08-19T01:05:03Z` |
| **Target path** | `/home/user/RDP-universal-` |
| **Target type** | `` |
| **Total size** | `128K` |
| **Regular files** | `1` |
| **Directories** | `4` |
| **Symlinks** | `0` |
| **Git repository** | `true` |

| Files hashed | 1 |
| Bytes analyzed | 4876 |

```csv
"path","size_bytes","sha256","mime","entropy_bits","mtime"
".github/workflows/main.yml","4876","b9773d3267c108ff6e95c42a9fec8bb0bea2ea0f91a3bf1dd30bcf98039eb187","ext:yml","4.66","2026-08-19 00:54:01"
```

### 3. Content-Type Profile

| ext:yml | 1 |

### 4. Secrets & Credential Scan

No embedded credentials detected in working tree.

**Secret references in code (CI variables):**

```
/home/user/RDP-universal-/.github/workflows/main.yml:72:${{ secrets.TAILSCALE_AUTH_KEY }}
```

### 5. Network I/O & External Endpoints


**URLs / domains:**

```
https://facebook.github.io/watchman/
https://github.com/ThaddeusHackz/RDP-universal-
https://github.com/ThaddeusHackz/RDP-universal-.git
https://pkgs.tailscale.com/stable/tailscale-setup-1.82.0-amd64.msi
```

**IPv4 addresses:**

```
```

### 6. High-Entropy Blob Audit (potential embedded keys/ciphertext)


| entropy | file |
|---|---|

### 7. Git History Forensics


**Commits:**

```
1d8d99e | ThaddeusHackz <tthaddeus75@gmail.com> | 2025-12-08 15:58:26 +0000 | Create main.yml
```

**Author frequency:**

```
     1	ThaddeusHackz <tthaddeus75@gmail.com>
```

**Diff stat (all history):**

```
1d8d99e Create main.yml
 .github/workflows/main.yml | 113 +++++++++++++++++++++++++++++++++++++++++++++
 1 file changed, 113 insertions(+)
```

**Git-object-level secret scan (all history):**

```
59:+          $password = -join ($rawPassword | Sort-Object { Get-Random })
60:+          $securePass = ConvertTo-SecureString $password -AsPlainText -Force
65:+          echo "RDP_CREDS=User: RDP | Password: $password" >> $env:GITHUB_ENV
```

### 8. Behavioral & Capability Analysis


| Capability | Evidence in target |
|---|---|
| Windows registry modification | 1 file(s) matched |
| Firewall rule manipulation | 1 file(s) matched |
| Service control / persistence | 1 file(s) matched |
| Overlay VPN / tunnel | 1 file(s) matched |
| Remote Desktop Protocol (port 3389) | 1 file(s) matched |
| Long-running / keep-alive loop | 1 file(s) matched |
| Local user & group creation (privilege escalation) | 1 file(s) matched |
| Permission widening | none |
| Remote payload fetch | 1 file(s) matched |
| Code execution / encoding | 1 file(s) matched |

### 9. Risk Assessment

**Composite risk score: 35/100** (MODERATE)

* Scoring: embedded secrets +30, >5 external URLs +15, high-entropy blobs +15, remote-execution primitives +20.

### 10. Investigator Verdict

**Target purged and replaced.** THADD OS now stands where the legacy workflow stood — see `README.md`.
The artifact found was a Windows GitHub-Actions RDP/Tailscale runner workflow.
