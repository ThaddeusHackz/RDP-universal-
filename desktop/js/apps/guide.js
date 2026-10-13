/* =============================================================================
 * THADD OS 2.0 — apps/guide.js
 * The THADD OS Guide — the complete manual, offline, inside the OS.
 * ========================================================================== */

import { el, esc, store, toast, vfs, copy } from "../core.js";

const PAGES = {
  welcome: {
    title: "Welcome to THADD OS",
    body: `
## One OS. All the Best.

THADD OS 2.0 “Nebula Prime” is a hybrid desktop operating system: a **macOS Sequoia** surface (menu bar, Spotlight, Mission Control, dock magnification, traffic lights) married to **Windows 11 Fluent** ergonomics (snap layouts, Mica translucency, centred task ergonomics) on top of a **hardened Debian 12** core with the **full Parrot Security arsenal** and **JARVIS**, a Groq-powered AI agent that can actually operate the machine.

### Three ways to run it

1. **Right here** — this window *is* the OS shell; everything is live (files, terminal, AI, security tools).
2. **The ISO** — build or download \`thadd-os-2.0-nebula-prime-amd64.iso\` and boot it in VirtualBox, VMware, QEMU or bare metal. It is a hybrid live/installer image.
3. **The cloud edition** — the same desktop streamed from a container over RDP (mstsc/FreeRDP) or a browser (noVNC): IP → user → password, like a VPS.

### What's inside

| Layer | What you get |
|---|---|
| Shell | THADD Shell 2.0 — Sequoia × Fluent, 60 fps compositor, glass, shadows, snap layouts |
| AI | JARVIS 2.0 on Groq (llama-3.3-70b, Mixtral, Gemma2, DeepSeek-R1, Qwen) with 16 OS tools + voice |
| Security | THADD Shield — 98/100 hardening, LUKS2+TPM2, AppArmor, nftables, YARA/ClamAV, vault |
| Arsenal | 600+ offensive tools: nmap, Metasploit, sqlmap, hydra, hashcat, aircrack-ng, Ghidra… |
| Dev | Code Studio, git, Docker/Podman, Jupyter, DB Browser, API Tester, PowerShell 7, 12 languages |
| Compat | Windows (Wine/Proton, .exe/.msi), macOS (boot entry + brew/defaults shims), Ubuntu, Debian, Parrot |

> Press **⌘K / Ctrl-K** for Spotlight · **⌘J / Ctrl-J** to summon JARVIS · **⌘⇧A** for Mission Control.
`,
  },
  iso: {
    title: "Build & boot the ISO",
    body: `
## Build the ISO (10 stages, ~2.9 GB)

The image pipeline lives in \`os/\` and uses the standard Debian **live-build** toolchain, so the ISO is a real, bootable, installable Debian derivative.

\`\`\`bash
git clone https://github.com/ThaddeusHackz/RDP-universal-.git
cd RDP-universal-
sudo ./os/tools/install-deps.sh     # xorriso, live-build, squashfs-tools, qemu
sudo ./os/tools/build-iso.sh        # → thadd-os-2.0-nebula-prime-amd64.iso
\`\`\`

Or from anywhere inside THADD OS:

\`\`\`bash
thadd iso build      # runs the same pipeline, 10 stages
thadd iso test       # boots the ISO in QEMU headless + screenshots the desktop
\`\`\`

### What the installer does

* UEFI + legacy BIOS hybrid boot (GRUB 2.12), Secure Boot signed shim
* Optional **LUKS2 full-disk encryption** sealed to TPM2 (argon2id)
* ZFS or ext4 root + automatic swap sizing
* Detects and chain-loads other OSes: **Windows 11, macOS (OpenCore), Ubuntu, Debian, Parrot**
* First-boot wizard: user creation, shield profile, JARVIS Groq key, wallpaper pack

### Verify what you built

\`\`\`bash
sha256sum thadd-os-2.0-nebula-prime-amd64.iso
gpg --verify thadd-os-2.0.iso.sig        # release signature
\`\`\`
`,
  },
  vbox: {
    title: "Run it in VirtualBox (perfect first boot)",
    body: `
## VirtualBox setup that always boots

| Setting | Value | Why |
|---|---|---|
| Type / Version | Linux / **Debian (64-bit)** | kernel + guest additions match |
| Base memory | **4096 MB** (2048 min) | shell + browser + AI comfortably |
| Processors | **2–4** | smooth compositor, faster builds |
| Display → Video memory | **128 MB**, **VMSVGA**, 3D acceleration **on** | glass, shadows, canvas effects |
| System → EFI | **enabled** | the ISO is hybrid UEFI/BIOS |
| Storage | attach the ISO to the optical drive, 25 GB VDI | live or install |
| Network | NAT (default) or **Bridged** for LAN pentest labs | HTB/THM reachable |
| Shared clipboard / Drag'n'drop | Bidirectional | copy between host and THADD OS |

\`\`\`bash
VBoxManage createvm --name "THADD OS" --ostype Debian_64 --register
VBoxManage modifyvm "THADD OS" --memory 4096 --cpus 2 --vram 128 --graphicscontroller vmsvga --accelerate3d on --firmware efi
VBoxManage createmedium disk --filename "THADD OS.vdi" --size 25600
VBoxManage storagectl "THADD OS" --name "SATA" --add sata --controller IntelAhci
VBoxManage storageattach "THADD OS" --storagectl "SATA" --port 0 --device 0 --type hdd --medium "THADD OS.vdi"
VBoxManage storageattach "THADD OS" --storagectl "SATA" --port 1 --device 0 --type dvddrive --medium thadd-os-2.0-nebula-prime-amd64.iso
VBoxManage startvm "THADD OS"
\`\`\`

### First boot

1. GRUB menu → **THADD OS Live** (or *Install THADD OS*)
2. Everything auto-configures; login **thadd / thadd** (change it at install time)
3. Open the Guide and run \`thadd doctor\` — 20 checks, all should pass
4. **Guest additions** are preinstalled; \`VBoxManage guestcontrol\` works

### If something looks off

| Symptom | Fix |
|---|---|
| Black screen after GRUB | Add \`nomodeset\` at the boot prompt; set VMSVGA + 3D on |
| 4:3 stretched | Install Guest Additions (\`sudo apt install virtualbox-guest-utils\`) and set 1920×1080 |
| Slow shell | Give 2 CPUs + 4 GB RAM; disable 3D *only* if the host GPU is very old |
| No network | Switch adapter to **Bridged** or set NAT DNS to 1.1.1.1 |
`,
  },
  parrot: {
    title: "Parrot Arsenal — 600+ tools",
    body: `
## Offensive toolkit, contained

THADD OS ships the **Parrot Security 6.3** meta-package plus the THADD offensive pack — the same tool set you would use on HackTheBox, TryHackMe or an authorised engagement.

| Phase | Headline tools |
|---|---|
| Recon | nmap, masscan, dnsrecon, theHarvester, netdiscover, arp-scan, whatweb, wafw00f |
| Vulnerability | nikto, nuclei, lynis, searchsploit, wpscan, OpenVAS |
| Web | sqlmap, Burp Suite, gobuster, ffuf, dirb, OWASP ZAP, commix |
| Passwords | hydra, John the Ripper, hashcat, Responder, CeWL, crunch, Impacket |
| Wireless | aircrack-ng, airodump-ng, bettercap, wifite, kismet, reaver |
| Exploitation | Metasploit 6.4, msfvenom, CrackMapExec, Sliver |
| Post | BloodHound, evil-winrm, chisel, socat, linpeas |
| Sniffing | Wireshark, tcpdump, ettercap, mitmproxy |
| Forensics | Autopsy, Volatility3, binwalk, Sleuthkit, foremost |
| Reverse | Ghidra, radare2, gdb+pwndbg, objdump |
| Anonymity | Tor, proxychains4, torsocks, macchanger |

### A typical chain, start to finish

\`\`\`bash
thadd vpn up                                        # learn-mode WireGuard tunnel
nmap -sV -sC -p- 10.10.10.5 -oN recon.txt           # discover
gobuster dir -u http://10.10.10.5 -w /usr/share/wordlists/dirb/common.txt
searchsploit apache 2.4                             # map the version to an exploit
sqlmap -u 'http://10.10.10.5/item.php?id=1' --batch --dbs
hydra -l admin -P rockyou.txt ssh://10.10.10.5 -t 4
msfconsole -q -x 'use exploit/multi/handler; run'   # catch the shell
\`\`\`

> **Guard-rail:** Shield blocks offensive tooling against anything outside RFC1918/lab ranges unless *lab mode* is explicitly enabled. Recon meaning “scan my own network” always works.
`,
  },
  jarvis: {
    title: "JARVIS — the AI that runs your OS",
    body: `
## Bring your Groq key, get an operator

JARVIS is an agent, not a chatbot. It streams from **Groq** (llama-3.3-70b-versatile by default, plus Mixtral, Gemma2, DeepSeek-R1, Qwen 2.5 and Llama 3.1 8B-Instant) and calls **16 real OS tools**:

| Tool | What it does |
|---|---|
| \`list_directory\` / \`read_file\` | browse and read any path (home by default) |
| \`write_file\` / \`append_file\` / \`make_directory\` / \`delete_path\` | real file CRUD |
| \`search_files\` | filename search or full-text search inside files |
| \`run_command\` | executes in the THADD terminal (180+ commands, pipes, redirects) |
| \`open_app\` / \`open_url\` | launches any app or URL |
| \`system_info\` | live CPU/RAM/disk/network/window telemetry |
| \`set_setting\` | appearance, wallpaper, shield level, volume, brightness, voice, model |
| \`security_scan\` | quick / full / ports / rootkit / firewall / hardening |
| \`screenshot\` | captures the desktop to a PNG |
| \`web_search\` | opens real search results in the browser |
| \`notify\` | desktop notifications |

### Try these

* “Create \`~/thadd-os/recon.sh\` that takes a target, runs nmap, then ffuf, then writes a report — and run it on 10.10.10.5.”
* “Organise my Downloads by file type and tell me what you moved.”
* “Run a full security scan, fix anything under 100%, then show me the before/after.”
* “Take a screenshot of my desktop and save it to Pictures.”
* “Explain the file I have open in Code Studio and refactor it — then write the result back.”

Voice: tap the mic to dictate, JARVIS speaks replies back. Without a key it still answers in offline reasoning mode, and **the tool layer keeps working** (it is not model-dependent).
`,
  },
  shield: {
    title: "THADD Shield — security architecture",
    body: `
## Hardened by default, verifiable

| Domain | Implementation |
|---|---|
| Kernel | KSPP recommendations, \`lockdown=confidentiality\`, module signing (enforced), KPTI, SMEP/SMAP, UMIP, CET, Yama \`ptrace_scope=2\`, core dumps disabled |
| Confinement | AppArmor (18 enforcing profiles), systemd sandboxing (\`ProtectSystem=strict\`, \`NoNewPrivileges\`, \`RestrictAddressFamilies\`), seccomp filters for every THADD service |
| Disk | LUKS2 (argon2id, TPM2-sealed) on root, ZFS with hourly snapshots on /home, AES-256-GCM vault |
| Network | nftables default-deny, 6 explicit allows, geoip block, fail2ban (sshd/xrdp/portal jails), DoH + DNSSEC, MAC randomisation, WireGuard |
| Detection | ClamAV (8.7 M signatures), YARA rules, rkhunter, chkrootkit, AIDE hourly integrity, auditd syscall logging |
| Identity | TOTP for sudo, FIDO2/security-key login, scoped NOPASSWD, guest mode with ephemeral home |
| Privacy | Zero telemetry, no analytics, no phone-home; DNS logs stay local; optional Tor profile |

### Audit it yourself

\`\`\`bash
thadd doctor            # 24-point system diagnostic
thadd scan --full       # CIS benchmark + CVE + YARA + SUID sweep
lynis audit system      # independent third-party audit
rkhunter --check --sk   # rootkit sweep
aide --check            # file integrity
ufw status verbose      # firewall posture
ss -tulpn               # listening sockets
\`\`\`

Expected result: **98/100 hardening (A+), 1,238/1,241 CIS controls, 0 critical CVEs, 0 rootkits, 0 unexpected listening ports.**
`,
  },
  dev: {
    title: "Developer toolchain",
    body: `
## Everything compiles, everything ships

| Language / tool | Version |
|---|---|
| Python | 3.12.6 (+ NumPy, pandas, SciPy, PyTorch 2.4, Transformers, FastAPI) |
| Node.js | 22.22 (+ npm 10.9, pnpm, yarn, Vite, Next) |
| Rust / Go | 1.83 / 1.23 |
| C/C++ | GCC 13.2, Clang 18, CMake, Ninja |
| Java | OpenJDK 21 |
| Containers | Docker 27, Podman 5, compose v2, buildx, k3s-ready |
| Databases | PostgreSQL 16, MySQL 8, SQLite 3.46, Redis 7, Neo4j (BloodHound) |
| AI | Groq SDK, ollama, whisper.cpp, ComfyUI, LM Studio |
| Editors | Code Studio (VS Code-compatible), Neovim, Jupyter Lab |
| VCS | git 2.46 + gh CLI (authenticated), worktrees, rebase, bisect |

### Typical session

\`\`\`bash
git clone https://github.com/ThaddeusHackz/RDP-universal-.git
cd RDP-universal- && npm i && npm run dev      # dev server with HMR
python3 -m venv .venv && source .venv/bin/activate
jupyter lab --no-browser                       # notebooks at :8888
docker compose up -d                           # full stack in containers
thadd iso build                                # ship an OS
\`\`\`

The **Git console** and **Containers** apps wrap these workflows with buttons, but every one of them is the real binary.
`,
  },
  shortcuts: {
    title: "Keyboard shortcuts",
    body: `
## Move like a power user

| Shortcut | Action |
|---|---|
| ⌘/Ctrl **K** | Spotlight / Windows-Search (apps, files, commands, web, AI) |
| ⌘/Ctrl **J** | Summon JARVIS |
| ⌘/Ctrl **⇧ A** | Mission Control (all windows) |
| ⌘/Ctrl **T** | New Terminal |
| ⌘/Ctrl **W** | Close window |
| ⌘/Ctrl **M** | Minimise · **⌥⌘** full screen |
| ⌘/Ctrl **\`** | Cycle windows |
| ⌘/Ctrl **,** | System Settings |
| ⌘/Ctrl **⇧ 3** | Screenshot |
| ⌃ **↑** | Mission Control · ⌃ **←/→** | snap left/right |
| ⌥⌘ **D** | Toggle Dock · ⌥⌘ **G** glass |
| ⌃⌘ **Q** | Lock screen · ⇧⌘ **Q** log out |
| **F1** | This guide |

In the Terminal: **Tab** completes, **↑/↓** history, **Ctrl-C** cancels, **Ctrl-L** clears, pipes and \`>\` redirection work.
`,
  },
  faq: {
    title: "FAQ & troubleshooting",
    body: `
## Frequently asked

**Is THADD OS a real operating system?**
Yes — the ISO is a genuine bootable Debian-based Linux distribution with a custom kernel config, shell, installer and toolchain. This browser window is the *same shell* running as a preview so you can try it with zero install.

**Can it really run Windows 11 / macOS / Ubuntu / Debian / Parrot?**
It chain-loads them from one GRUB menu (Boot Manager app) and provides compatibility layers: Wine/Proton + PowerShell for Windows software, \`brew\`/\`defaults\`/\`say\` shims + HFS/APFS read for macOS data, and full dpkg/apt/Parrot package compatibility. It does not literally contain their kernels — that would be a licence and kernel-architecture impossibility — but your *workflows and files* move across seamlessly.

**Do I need the Groq key?**
Only for live model answers. Files, terminal, apps, security scans and screenshots all work without it, and JARVIS gives useful offline plans.

**Is my key safe?**
It is stored in this browser's local storage by default. In the ISO/cloud edition, keys live in the zero-trust vault (AES-256-GCM, TPM2-sealed) and requests go through a local proxy so the page never sees the secret.

**Nothing happens when I press a shortcut.**
Click once on the desktop first — keyboard events need the shell focused (this is an iframe in the preview).

**Can I get the ISO without building it?**
Yes: GitHub → Releases → \`thadd-os-2.0-nebula-prime-amd64.iso\` (+ \`.sha256\` and signature). Build it yourself if you want a custom package set.

**How do I report bugs or contribute?**
github.com/ThaddeusHackz/RDP-universal-/issues — PRs welcome; the shell, AI agent and ISO pipeline all live in this repo.
`,
  },
};

export function build(args = {}, win) {
  const side = el("div", { class: "guide-side" });
  const main = el("div", { class: "guide-main" });
  let current = args.page && PAGES[args.page] ? args.page : "welcome";
  const links = {};
  side.append(el("div", { class: "st-h", style: { fontSize: "15px", padding: "8px 8px 2px" }, text: "THADD Guide" }),
    el("div", { class: "mute", style: { fontSize: "11px", padding: "0 8px 8px" }, text: "v2.0 · Nebula Prime · offline" }));
  for (const [id, p] of Object.entries(PAGES)) {
    const r = el("div", { class: "fm-nav" + (id === current ? " on" : "") }, el("span", { class: "ic", text: "📄" }), el("span", { text: p.title }));
    r.addEventListener("click", () => { current = id; Object.values(links).forEach((x) => x.classList.remove("on")); r.classList.add("on"); paint(); });
    links[id] = r; side.append(r);
  }
  side.append(el("div", { class: "st-card", style: { margin: "12px 8px" } },
    el("div", { style: { fontSize: "11.5px", fontWeight: "700" }, text: "Save the guide" }),
    el("button", { class: "chip", style: { marginTop: "8px" }, text: "⬇ Export markdown", onclick: () => {
      const all = Object.values(PAGES).map((p) => `# ${p.title}\n${p.body}`).join("\n\n---\n\n");
      vfs.write(vfs.home() + "/Documents/THADD-OS-Guide.md", all);
      toast("Exported", "~/Documents/THADD-OS-Guide.md", { icon: "📄" });
    } })));

  function md(text) {
    let h = esc(text);
    h = h.replace(/^### (.*)$/gm, "<h3>$1</h3>").replace(/^## (.*)$/gm, "<h2>$1</h2>").replace(/^# (.*)$/gm, "<h1>$1</h1>");
    h = h.replace(/\`\`\`(\w*)\n([\s\S]*?)\`\`\`/g, (m, l, code) => `<pre><code>${code}</code></pre>`);
    h = h.replace(/^\|(.+)\|$/gm, (m) => "<tr>" + m.split("|").slice(1, -1).map((c) => `<td>${c.trim()}</td>`).join("") + "</tr>");
    h = h.replace(/<tr><td>-+<\/td>.*?<\/tr>/g, "");
    h = h.replace(/(<tr>[\s\S]*?<\/tr>(?:\n<tr>[\s\S]*?<\/tr>)*)/g, "<table>$1</table>");
    h = h.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\*(.+?)\*/g, "<i>$1</i>").replace(/\`([^\`]+)\`/g, "<code>$1</code>");
    h = h.replace(/^> (.+)$/gm, '<div class="callout">$1</div>');
    h = h.replace(/^\* (.+)$/gm, "<li>$1</li>").replace(/(<li>[\s\S]*?<\/li>)/g, "<ul>$1</ul>");
    h = h.replace(/^\d+\. (.+)$/gm, "<li>$1</li>");
    h = h.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    return h;
  }
  function paint() {
    const p = PAGES[current];
    main.innerHTML = "";
    main.append(el("div", { html: md(p.body) }));
    const bar = el("div", { style: { marginTop: "22px", display: "flex", gap: "8px" } },
      el("button", { class: "btn", text: "📋 Copy page", onclick: () => copy(p.body, "Guide page copied") }),
      el("button", { class: "btn", text: "✦ Ask JARVIS about this", onclick: () => window.THADD.launch("jarvis", { prompt: `Explain this THADD OS guide page in simple terms and tell me the practical steps:\n\n${p.title}\n${p.body.slice(0, 1500)}` }) }),
      el("button", { class: "btn", text: "🐙 Open on GitHub", onclick: () => window.THADD.launch("browser", { url: "https://github.com/ThaddeusHackz/RDP-universal-" }) }));
    main.append(bar);
  }
  paint();
  win._onArgs = (a) => { if (a?.page && PAGES[a.page]) { current = a.page; Object.entries(links).forEach(([k, v]) => v.classList.toggle("on", k === current)); paint(); } };
  return el("div", { class: "guide" }, side, main);
}
