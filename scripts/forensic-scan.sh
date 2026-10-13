#!/usr/bin/env bash
# =============================================================================
#  THADD OS — Deep Forensic Scanner v1.0
#  Comprehensive static forensics, secrets discovery, entropy analysis and
#  behavioral profiling of a target codebase.
#  Usage: ./forensic-scan.sh <target-dir> <output-dir>
# =============================================================================
set -u
TARGET="${1:?usage: forensic-scan.sh <target-dir> <output-dir>}"
OUT="${2:-/tmp/forensic-output}"
mkdir -p "$OUT"
LOG="$OUT/forensic-report.md"
JSON="$OUT/forensic-data.json"
CSV="$OUT/inventory.csv"
TS="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"

say()  { printf '%s\n' "$*"; }
h2()   { printf '\n## %s\n\n' "$*"; }
h3()   { printf '\n### %s\n\n' "$*"; }
kv()   { printf '| **%s** | `%s` |\n' "$1" "$2"; }

# --- helpers ---------------------------------------------------------------
file_entropy() { # approximate Shannon entropy of a file
  od -An -tx1 -v "$1" 2>/dev/null | tr -d ' \n' | fold -w2 |
    sort | uniq -c | awk '{p=$1; n+=p; s+=p*log(p)} END { if (n>0) printf "%.2f", (log(n)-s/n)/log(2) }'
}

# --- 1. target metadata ----------------------------------------------------
h2 "1. Target Acquisition" > "$LOG"
kv "Scan timestamp (UTC)" "$TS" >> "$LOG"
kv "Target path" "$(realpath "$TARGET")" >> "$LOG"
kv "Target type" "$(file -b "$TARGET" 2>/dev/null)" >> "$LOG"
SIZE="$(du -sh "$TARGET" 2>/dev/null | cut -f1)"
FILES="$(find "$TARGET" -type f ! -path '*/.git/*' 2>/dev/null | wc -l)"
DIRS="$(find "$TARGET" -type d ! -path '*/.git/*' 2>/dev/null | wc -l)"
SYML="$(find "$TARGET" -type l ! -path '*/.git/*' 2>/dev/null | wc -l)"
kv "Total size" "$SIZE" >> "$LOG"
kv "Regular files" "$FILES" >> "$LOG"
kv "Directories" "$DIRS" >> "$LOG"
kv "Symlinks" "$SYML" >> "$LOG"
kv "Git repository" "$(git -C "$TARGET" rev-parse --is-inside-work-tree 2>/dev/null || echo 'no')" >> "$LOG"

# --- 2. full inventory with hashes ----------------------------------------
h2 "2. File Inventory (SHA-256)" >> "$LOG"
printf '"path","size_bytes","sha256","mime","entropy_bits","mtime"\n' > "$CSV"
echo '' >> "$LOG"
find "$TARGET" -type f ! -path '*/.git/*' -print0 2>/dev/null |
while IFS= read -r -d '' f; do
  rel="${f#$TARGET/}"
  sz="$(stat -c %s "$f" 2>/dev/null)"
  sha="$(sha256sum "$f" 2>/dev/null | cut -d' ' -f1)"
  mime="$(file -b --mime-type "$f" 2>/dev/null || true)"
  [ -z "$mime" ] && mime="ext:${f##*.}"
  ent="$(file_entropy "$f")"
  mt="$(stat -c %y "$f" 2>/dev/null | cut -d. -f1)"
  printf '"%s","%s","%s","%s","%s","%s"\n' "$rel" "$sz" "$sha" "$mime" "$ent" "$mt" >> "$CSV"
done
TOTAL_FILES="$(tail -n +2 "$CSV" | wc -l)"
TOTAL_BYTES="$(tail -n +2 "$CSV" | awk -F'","' '{s+=$2} END {print s}')"
printf '%s\n' "| Files hashed | $TOTAL_FILES |" >> "$LOG"
printf '%s\n' "| Bytes analyzed | $TOTAL_BYTES |" >> "$LOG"
printf '\n```csv\n' >> "$LOG"
head -30 "$CSV" >> "$LOG"
[ "$TOTAL_FILES" -gt 30 ] && printf '... (truncated, %s files total)\n' "$TOTAL_FILES" >> "$LOG"
printf '```\n' >> "$LOG"

# --- 3. file-type and extension profile -----------------------------------
h3 "3. Content-Type Profile" >> "$LOG"
tail -n +2 "$CSV" | awk -F'","' '{print $4}' | sed 's/"//g' | sort | uniq -c | sort -rn |
while read -r n t; do printf '| %s | %s |\n' "$t" "$n"; done >> "$LOG"

# --- 4. secrets / credential scan -----------------------------------------
h3 "4. Secrets & Credential Scan" >> "$LOG"
PATTERNS=(
  'AKIA[0-9A-Z]{16}'
  'gh[pousr]_[A-Za-z0-9]{36,255}'
  'github_pat_[A-Za-z0-9_]{20,}'
  'sk-[A-Za-z0-9]{20,}'
  'AIza[0-9A-Za-z_-]{35}'
  'xox[baprs]-[A-Za-z0-9-]{10,}'
  '-----BEGIN (RSA |EC |OPENSSH |PGP )?PRIVATE KEY'
  'password\s*[=:]\s*["'"'"'][^"'"'"']{4,}["'"'"']'
  'passwd\s*[=:]\s*\S{4,}'
  'secret\s*[=:]\s*["'"'"']?[A-Za-z0-9/+=_-]{8,}'
  'token\s*[=:]\s*["'"'"']?[A-Za-z0-9_.-]{12,}'
  'BEGIN OPENSSH PRIVATE KEY'
  'mongodb(\+srv)?://[^\s"'"'"']+'
  'postgres(ql)?://[^\s"'"'"']+'
  'mysql://[^\s"'"'"']+'
  'redis://[^\s"'"'"']+'
  'amqp://[^\s"'"'"']+'
  'HOOK_[A-Z0-9]{20,}'
  'authorization:\s*bearer\s+\S+'
)
FOUND_SECRETS=0
for pat in "${PATTERNS[@]}"; do
  hits="$(grep -RInE --exclude-dir=.git -e "$pat" "$TARGET" 2>/dev/null | head -8)"
  if [ -n "$hits" ]; then
    FOUND_SECRETS=1
    printf '\n**Pattern:** `%s`\n\n```\n%s\n```\n' "$pat" "$hits" >> "$LOG"
  fi
done
[ "$FOUND_SECRETS" -eq 0 ] && printf 'No embedded credentials detected in working tree.\n' >> "$LOG"
# Tailscale keys are often embedded as workflow secrets references — check refs too
printf '\n**Secret references in code (CI variables):**\n\n```\n' >> "$LOG"
grep -RInoE '\$\{\{\s*secrets\.[A-Za-z0-9_-]+\s*\}\}' "$TARGET" 2>/dev/null | sort -u >> "$LOG" || true
printf '```\n' >> "$LOG"

# --- 5. network I/O extraction --------------------------------------------
h3 "5. Network I/O & External Endpoints" >> "$LOG"
printf '\n**URLs / domains:**\n\n```\n' >> "$LOG"
grep -RIohE 'https?://[a-zA-Z0-9./_?=&%#~@+:-]+' "$TARGET" 2>/dev/null | sed 's/[.,;)]*$//' | sort -u >> "$LOG"
printf '```\n\n**IPv4 addresses:**\n\n```\n' >> "$LOG"
grep -RIohE '(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)' "$TARGET" 2>/dev/null | sort -u >> "$LOG"
printf '```\n' >> "$LOG"

# --- 6. high-entropy blob audit -------------------------------------------
h3 "6. High-Entropy Blob Audit (potential embedded keys/ciphertext)" >> "$LOG"
printf '\n| entropy | file |\n|---|---|\n' >> "$LOG"
tail -n +2 "$CSV" | awk -F'","' '{gsub(/"/,""); if ($5+0 >= 7.5) print $5, $1}' | sort -rn | head -20 |
while read -r e f; do printf '| %s | %s |\n' "$e" "$f"; done >> "$LOG"

# --- 7. git history forensics ---------------------------------------------
if git -C "$TARGET" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  h3 "7. Git History Forensics" >> "$LOG"
  printf '\n**Commits:**\n\n```\n' >> "$LOG"
  git -C "$TARGET" log --pretty=format:'%h | %an <%ae> | %ad | %s' --date=iso >> "$LOG" 2>/dev/null
  printf '\n```\n\n**Author frequency:**\n\n```\n' >> "$LOG"
  git -C "$TARGET" shortlog -sne --all >> "$LOG" 2>/dev/null
  printf '```\n\n**Diff stat (all history):**\n\n```\n' >> "$LOG"
  git -C "$TARGET" log --stat --oneline >> "$LOG" 2>/dev/null
  printf '```\n\n**Git-object-level secret scan (all history):**\n\n```\n' >> "$LOG"
  git -C "$TARGET" log -p --all 2>/dev/null | grep -nE 'AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{36}|BEGIN (RSA |OPENSSH |EC )?PRIVATE KEY|password' | head -10 >> "$LOG" || true
  printf '```\n' >> "$LOG"
fi

# --- 8. behavioral / capability analysis ----------------------------------
h3 "8. Behavioral & Capability Analysis" >> "$LOG"
CAPS=(
  'registry|HKLM|Set-ItemProperty;;Windows registry modification'
  'firewall|netsh;;Firewall rule manipulation'
  'Restart-Service|TermService;;Service control / persistence'
  'tailscale|wireguard|vpn;;Overlay VPN / tunnel'
  '3389|RDP;;Remote Desktop Protocol (port 3389)'
  'Start-Sleep|while \(;;Long-running / keep-alive loop'
  'New-LocalUser|Add-LocalGroupMember;;Local user & group creation (privilege escalation)'
  'chmod\s+[0-7]*777|chown;;Permission widening'
  'curl|wget|Invoke-WebRequest;;Remote payload fetch'
  'eval|exec|base64;;Code execution / encoding'
)
printf '\n| Capability | Evidence in target |\n|---|---|\n' >> "$LOG"
for entry in "${CAPS[@]}"; do
  pat="${entry%%;;*}"; desc="${entry#*;;}"
  n="$(grep -RIlE --exclude-dir=.git -e "$pat" "$TARGET" 2>/dev/null | wc -l)"
  [ "$n" -gt 0 ] && printf '| %s | %s file(s) matched |\n' "$desc" "$n" >> "$LOG" || printf '| %s | none |\n' "$desc" >> "$LOG"
done

# --- 8b. RDP / credential login-path audit --------------------------------
h3 "8b. RDP Login-Path Audit (why credentials succeed or fail)" >> "$LOG"
printf '\nThese checks are the difference between "port 3389 is open" and "the username+password actually log you in".\n\n' >> "$LOG"
printf '| Check | Result |\n|---|---|\n' >> "$LOG"
rdp_audit() {
  local name="$1" cond="$2"
  if eval "$cond" >/dev/null 2>&1; then
    printf '| %s | PASS |\n' "$name" >> "$LOG"
  else
    printf '| %s | **FAIL** |\n' "$name" >> "$LOG"
  fi
}
rdp_audit "container-safe PAM file shipped (config/pam-xrdp-sesman)" \
  "test -f \"$TARGET/config/pam-xrdp-sesman\""
rdp_audit "PAM does not require pam_loginuid" \
  "! grep -E '^[[:space:]]*session[[:space:]]+required[[:space:]]+pam_loginuid' \"$TARGET/config/pam-xrdp-sesman\""
rdp_audit "xrdp.ini shipped with autorun=Xvnc" \
  "grep -E '^[[:space:]]*autorun=Xvnc' \"$TARGET/config/xrdp.ini\""
rdp_audit "xrdp.ini security_layer=tls (no NLA/HYBRID trap)" \
  "grep -E '^[[:space:]]*security_layer=tls' \"$TARGET/config/xrdp.ini\""
rdp_audit "xrdp.ini has no live [Xorg] session (xorgxrdp is not installed)" \
  "! grep -E '^\\[Xorg\\]' \"$TARGET/config/xrdp.ini\""
rdp_audit "sesman AlwaysGroupCheck=false" \
  "grep -E '^[[:space:]]*AlwaysGroupCheck=false' \"$TARGET/config/sesman.ini\""
rdp_audit "entrypoint sets the password via chpasswd" \
  "grep -q chpasswd \"$TARGET/entrypoint.sh\""
rdp_audit "entrypoint JSON-escapes /api/creds" \
  "grep -q json_escape \"$TARGET/entrypoint.sh\""
rdp_audit "harden-rdp.sh runs on every boot" \
  "grep -q harden-rdp.sh \"$TARGET/entrypoint.sh\""
rdp_audit "VNC password is written to the user's real home (no su HOME leak)" \
  "grep -q 'HOME_DIR/.vnc/passwd' \"$TARGET/entrypoint.sh\""
rdp_audit "Dockerfile installs pamtester" \
  "grep -q pamtester \"$TARGET/Dockerfile\""
rdp_audit "Dockerfile installs tigervnc-tools (vncpasswd)" \
  "grep -q tigervnc-tools \"$TARGET/Dockerfile\""
rdp_audit "CI proves PAM accepts the password (test_login.py)" \
  "test -f \"$TARGET/scripts/ci/test_login.py\""
rdp_audit "CI FreeRDP step requires sesman 'login successful'" \
  "grep -q 'login successful' \"$TARGET/scripts/ci/rdp-login.sh\""
rdp_audit "CI rejects a near-empty (black) screenshot" \
  "grep -q '8000' \"$TARGET/scripts/ci/rdp-login.sh\""
rdp_audit "browser desktop auto-login page exists" \
  "test -f \"$TARGET/web/desktop.html\""
rdp_audit "portal does not tell users to type a username into noVNC" \
  "! grep -q 'Enter the username' \"$TARGET/web/index.html\""
printf '\n' >> "$LOG"

# --- 9. risk score --------------------------------------------------------
h3 "9. Risk Assessment" >> "$LOG"
RISK=0
[ "$FOUND_SECRETS" -eq 1 ] && RISK=$((RISK+30))
NW="$(grep -RIohE 'https?://' "$TARGET" 2>/dev/null | wc -l)"
[ "$NW" -gt 5 ] && RISK=$((RISK+15))
HE="$(tail -n +2 "$CSV" | awk -F'","' '{gsub(/"/,""); if ($5+0>=7.5) c++} END{print c+0}')"
[ "$HE" -gt 0 ] && RISK=$((RISK+15))
EXE="$(grep -RIlE --exclude-dir=.git -e 'Invoke-WebRequest|curl.*\|.*(sh|bash)|base64 -d' "$TARGET" 2>/dev/null | wc -l)"
[ "$EXE" -gt 0 ] && RISK=$((RISK+20))
printf '**Composite risk score: %s/100** (%s)\n\n' "$RISK" \
  "$([ "$RISK" -ge 60 ] && echo 'HIGH' || { [ "$RISK" -ge 25 ] && echo 'MODERATE' || echo 'LOW'; })" >> "$LOG"
printf '* Scoring: embedded secrets +30, >5 external URLs +15, high-entropy blobs +15, remote-execution primitives +20.\n' >> "$LOG"

# --- 10. verdict ----------------------------------------------------------
h3 "10. Investigator Verdict" >> "$LOG"
printf 'Static forensic analysis completed at %s.\n' "$TS" >> "$LOG"
printf 'Review sections 4 (secrets) and 6 (high-entropy blobs) for flagged material.\n' >> "$LOG"
printf 'Confirm no credentials are committed before extending or redeploying the target.\n' >> "$LOG"

say "[+] Forensic scan complete"
say "[+] Report:  $LOG"
say "[+] Data:    $CSV"
