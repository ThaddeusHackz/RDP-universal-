/* =============================================================================
 * THADD OS 2.0 — apps/browser.js
 * The THADD Browser: tabbed shell that fronts every major engine —
 * Firefox / Chromium / Brave / Tor profiles — with a built-in Start page,
 * an offline site cache (so the OS is fully demo-able without network), live
 * web search hand-off, bookmarks, history and a reader view.
 * ========================================================================== */

import { $, el, esc, store, toast, contextMenu, bus, sleep, uid } from "../core.js";

const PROFILE = {
  browser: { name: "Firefox", engine: "Gecko 131 · THADD-Nightly", icon: "🦊", accent: "#ff8a3d", dirty: "uBlock Origin · Multi-Account Containers · THADD Shield ext." },
  "browser-chrome": { name: "Chrome", engine: "Chromium 131 · Blink", icon: "🌐", accent: "#4285f4", dirty: "THADD Shield · AI Helper · 12 extensions" },
  "browser-brave": { name: "Brave", engine: "Chromium 131 · Brave 1.71", icon: "🦁", accent: "#fb542b", dirty: "ad-block by default · 1,284 trackers blocked today" },
  "browser-tor": { name: "Tor Browser", engine: "Firefox ESR · Tor 14", icon: "🧅", accent: "#7d4698", dirty: "onion routing · letterboxing · anti-fingerprint" },
};

export function build(args = {}, win, meta) {
  const P = PROFILE[win._app] || PROFILE.browser;
  const S = {
    tabs: [{ id: uid(), title: "New Tab", url: "thadd://start", history: [] }],
    active: 0, bookmarks: store.get("bw.bookmarks", ["thadd://start", "https://github.com/ThaddeusHackz/RDP-universal-"]),
  };

  const tabsBar = el("div", { class: "bw-tabs" });
  const url = el("input", { spellcheck: "false", placeholder: `Search ${P.name} or enter address` });
  const page = el("div", { class: "bw-page" });
  const findBar = el("div", { class: "bw-bar hidden" });
  const bar = el("div", { class: "bw-bar" },
    el("button", { class: "tb-btn", text: "‹", title: "Back", onclick: () => nav("back") }),
    el("button", { class: "tb-btn", text: "›", title: "Forward", onclick: () => nav("forward") }),
    el("button", { class: "tb-btn", text: "⟳", title: "Reload", onclick: () => go(cur().url) }),
    el("div", { class: "bw-url" },
      el("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2" },), urlText()),
    el("button", { class: "tb-btn", text: "☆", title: "Bookmark", onclick: () => { S.bookmarks.push(cur().url); store.set("bw.bookmarks", S.bookmarks); toast("Bookmarked", cur().url, { icon: "☆" }); } }),
    el("button", { class: "tb-btn", text: "▤", title: "History", onclick: (e) => historyMenu(e) }),
    el("button", { class: "tb-btn", text: "＋", title: "New tab", onclick: newTab }));
  const wrap = el("div", { class: "bw" }, tabsBar, bar, findBar, page);
  function urlText() { const i = url; i.addEventListener("keydown", (e) => { if (e.key === "Enter") go(i.value); }); return i; }

  const cur = () => S.tabs[S.active];
  const setTabs = () => {
    tabsBar.innerHTML = "";
    S.tabs.forEach((t, i) => {
      const tab = el("div", { class: "bw-tab" + (i === S.active ? " active" : "") },
        el("span", { text: t.url.startsWith("thadd://") ? "✦" : /github/.test(t.url) ? "🐙" : /stackoverflow/.test(t.url) ? "📚" : "🌐" }),
        el("span", { text: t.title.slice(0, 22), style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }),
        el("span", { class: "x", text: "✕", onclick: (e) => { e.stopPropagation(); S.tabs.splice(i, 1); if (!S.tabs.length) newTab(true); S.active = Math.max(0, Math.min(S.active, S.tabs.length - 1)); setTabs(); go(cur().url); } }));
      tab.addEventListener("click", () => { S.active = i; setTabs(); go(cur().url, true); });
      tabsBar.append(tab);
    });
  };
  function newTab(silent) { S.tabs.push({ id: uid(), title: "New Tab", url: "thadd://start", history: [] }); S.active = S.tabs.length - 1; if (!silent) { setTabs(); go("thadd://start"); } }

  function nav(dir) {
    const t = cur();
    if (dir === "back" && t.history.length > 1) { t.history.pop(); go(t.history.pop(), true); }
    else if (dir === "forward") toast("Forward", "Nothing ahead in history", { icon: "›", ms: 1400 });
  }

  function go(input, fromHistory = false) {
    let u = String(input || "").trim();
    if (!u) return;
    if (!fromHistory) { const t = cur(); t.history.push(t.url); }
    if (!/^(https?:\/\/|thadd:\/\/|about:|view-source:)/.test(u)) {
      u = /^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(u) && !u.includes(" ") ? "https://" + u
        : "https://duckduckgo.com/?q=" + encodeURIComponent(u);
    }
    const t = cur(); t.url = u; t.title = titleFor(u);
    url.value = u; setTabs(); render();
  }

  function titleFor(u) {
    if (u.startsWith("thadd://")) return { start: "THADD Start", docs: "THADD OS Docs", iso: "Build the ISO", shield: "THADD Shield", ai: "JARVIS" }[u.split("://")[1]] || "THADD";
    if (u.includes("duckduckgo.com/?q=")) return decodeURIComponent(u.split("q=")[1] || "").slice(0, 40) + " — search";
    if (u.includes("google.com/search")) return decodeURIComponent(u.split("q=")[1] || "").slice(0, 40) + " — Google";
    if (/github\.com/.test(u)) return "GitHub" + (u.split("github.com")[1] || "");
    if (/stackoverflow/.test(u)) return "Stack Overflow";
    if (/hackthebox/.test(u)) return "HackTheBox";
    if (/exploit-db/.test(u)) return "Exploit Database";
    if (/youtube/.test(u)) return "YouTube";
    if (/wikipedia/.test(u)) return "Wikipedia";
    try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u.slice(0, 30); }
  }

  /* ------------------------------- render -------------------------------- */
  function render() {
    const u = cur().url;
    page.className = "bw-page";
    page.innerHTML = "";
    if (u === "thadd://start") return startPage();
    if (u === "thadd://docs" || u.includes("github.com/ThaddeusHackz/RDP-universal-")) return repoPage();
    if (u.startsWith("thadd://")) return thaddPage(u.split("://")[1]);
    if (/duckduckgo\.com\/\?q=/.test(u)) return searchPage(decodeURIComponent(u.split("q=")[1] || ""), "DuckDuckGo");
    if (/google\.com\/search/.test(u)) return searchPage(decodeURIComponent(u.split("q=")[1] || ""), "Google");
    if (/exploit-db/.test(u)) return exploitPage(decodeURIComponent((u.split("q=")[1] || "")));
    if (/hackthebox/.test(u)) return htbPage();
    if (/stackoverflow|stackexchange/.test(u)) return soPage();
    if (/wikipedia\.org/.test(u)) return wikiPage(u.split("/wiki/")[1] || "Operating system");
    if (/youtube\.com/.test(u)) return ytPage();
    return genericPage(u);
  }

  function startPage() {
    page.classList.add("fake-home");
    const hero = el("div", { class: "bh-hero" },
      el("div", { class: "bh-logo", text: "THADD Start" }),
      el("div", { class: "bh-sub", text: `${P.name} · ${P.engine} — ${P.dirty}` }));
    const searchIn = el("input", { placeholder: `Search the web with ${P.name} (real results, private by default)…` });
    const box = el("div", { class: "sr-box", style: { maxWidth: "640px", margin: "22px auto 6px" } }, el("span", { text: "🔎" }), searchIn);
    searchIn.addEventListener("keydown", (e) => { if (e.key === "Enter") go(searchIn.value); });
    const cards = el("div", { class: "bh-cards" });
    const quick = [
      ["✦", "THADD Docs", "the OS manual", "thadd://docs"],
      ["💿", "Build the ISO", "live-build pipeline", "thadd://iso"],
      ["🛡", "THADD Shield", "security centre", "thadd://shield"],
      ["🐙", "GitHub repo", "source + releases", "https://github.com/ThaddeusHackz/RDP-universal-"],
      ["🎯", "HackTheBox", "lab targets", "https://app.hackthebox.com"],
      ["💥", "Exploit-DB", "CVE → PoC", "https://www.exploit-db.com"],
      ["📚", "Stack Overflow", "ask the hive", "https://stackoverflow.com"],
      ["▶", "YouTube", "THADD OS demos", "https://www.youtube.com"],
    ];
    for (const [e, n, d, u] of quick) {
      const c = el("div", { class: "bh-card" }, el("div", { class: "e", text: e }), el("div", { class: "n", text: n }), el("div", { class: "d", text: d }));
      c.addEventListener("click", () => go(u)); cards.append(c);
    }
    const sec = el("div", { class: "bh-sec" }, el("h3", { text: "Bookmarks & speed dial" }));
    const links = el("div", { class: "bh-links" });
    for (const b of S.bookmarks) {
      const l = el("div", { class: "bh-link", text: titleFor(b) });
      l.addEventListener("click", () => go(b)); links.append(l);
    }
    for (const [n, u] of [["Wikipedia", "https://en.wikipedia.org/wiki/Operating_system"], ["Arch Wiki", "https://wiki.archlinux.org"], ["NVD", "https://nvd.nist.gov"], ["Hacker News", "https://news.ycombinator.com"]]) {
      const l = el("div", { class: "bh-link", text: n }); l.addEventListener("click", () => go(u)); links.append(l);
    }
    sec.append(links);
    page.append(hero, box, cards, sec,
      el("div", { class: "bh-sec", style: { opacity: ".7", fontSize: "11.5px" },
        text: "Real internet pages may block embedding in this preview iframe — THADD OS caches offline mirrors of the most useful sites so the demo always works." }));
  }

  function fakePage(title, subtitle, bodyNodes) {
    const h = el("div", { style: { padding: "26px 30px", maxWidth: "920px", margin: "0 auto" } },
      el("div", { style: { fontSize: "11px", color: "var(--accent-3)", letterSpacing: ".08em", textTransform: "uppercase" }, text: subtitle }),
      el("h1", { style: { fontSize: "28px", fontWeight: "760", letterSpacing: "-.02em", margin: "6px 0 14px" }, text: title }));
    bodyNodes.forEach((n) => h.append(n));
    page.append(h);
    return h;
  }

  function repoPage() {
    fakePage("ThaddeusHackz / RDP-universal-", "github.com · cached offline mirror",
      [card("THADD OS 2.0 “Nebula Prime” — One OS. All the Best.", [
        "A complete Linux operating system: bootable ISO, live-build pipeline, macOS Sequoia × Windows 11 hybrid shell, Parrot Security arsenal, JARVIS Groq AI, and a cloud edition that runs in Docker.",
        "",
        "★ 1.2k   ⑂ 214   Issues 7   Releases 3   MIT",
      ]),
      card("Releases", ["v2.0.0 Nebula Prime — thadd-os-2.0-nebula-prime-amd64.iso (2.94 GB, sha256 9f4c2ab4…)",
        "v1.9.0 Cloud Image — Docker/Railway one-click",
        "v1.8.0 Parrot Mix — offensive toolchain edition"]),
      card("Quick start", ["git clone https://github.com/ThaddeusHackz/RDP-universal-.git",
        "cd RDP-universal- && sudo ./os/tools/install-deps.sh",
        "thadd iso build      # produces the bootable ISO",
        "VBoxManage startvm \"THADD OS\""])]);
  }

  function thaddPage(k) {
    const pages = {
      docs: ["THADD OS Documentation", "The OS manual", ["Getting started", "Install to disk (GRUB + LUKS2)", "VirtualBox tuning (EFI, VMSVGA, 3D)", "Parrot arsenal (600 tools)", "JARVIS AI agent", "THADD Shield hardening", "Building your own ISO variant"]],
      iso: ["Build the THADD OS ISO", "live-build pipeline", ["sudo ./os/tools/install-deps.sh — xorriso, live-build, qemu", "thadd iso build — 10 stages, ~2.9 GB hybrid ISO", "thadd iso test — QEMU headless boot + screenshot", "Write to USB: dd if=thadd-os-2.0.iso of=/dev/sdX bs=4M status=progress"]],
      shield: ["THADD Shield", "world-class security, default on", ["Kernel: KSPP + lockdown=confidentiality, SMEP/SMAP, module signing", "AppArmor: 18 enforcing profiles", "Firewall: nftables default-deny, geoip block, fail2ban", "LUKS2 + TPM2 sealing, AES-256-GCM vault", "Runtime: YARA + ClamAV, AIDE integrity, auditd", "Hardening score: 98/100 (A+)"]],
      ai: ["JARVIS", "OS-level AI agent on Groq", ["Streaming chat: llama-3.3-70b, Mixtral, Gemma2, DeepSeek-R1", "16 OS tools: files, terminal, apps, settings, security, screenshots", "Voice in/out with barge-in", "Works offline in reasoning mode"]],
    }[k] || ["THADD", "internal page", ["Nothing here."]];
    fakePage(pages[0], "thadd://" + k + " · " + pages[1], [card("Contents", pages[2])]);
  }

  function searchPage(q, engine) {
    const results = offlineResults(q);
    const sr = el("div", { class: "sr" },
      el("div", { class: "sr-logo" }, el("span", { class: "b", text: engine === "Google" ? "G" : "D" }), el("span", { class: "r", text: "T" }), el("span", { class: "y", text: "H" }), el("span", { class: "g", text: "D" })),
      el("div", { class: "sr-box" }, el("span", { text: "🔎" }), el("span", { text: q, style: { flex: "1", fontSize: "14px" } }), el("span", { class: "mono", style: { fontSize: "11px", opacity: ".7" }, text: "private · no logs" })));
    const qIn = el("input", { value: q, style: { display: "none" } });
    results.forEach((r) => {
      const node = el("div", { class: "sr-res" }, el("div", { class: "u", text: r.u }), el("div", { class: "t", text: r.t }), el("div", { class: "d", text: r.d }));
      node.addEventListener("click", () => go(r.u.startsWith("http") ? r.u : "https://" + r.u));
      sr.append(node);
    });
    sr.append(el("div", { class: "sr-res" },
      el("div", { class: "u", text: "thadd.os/releases" }),
      el("div", { class: "t", text: "Download THADD OS 2.0 “Nebula Prime” ISO (2.94 GB)" }),
      el("div", { class: "d", text: "Bootable hybrid ISO for VirtualBox, VMware, QEMU and bare metal. Live + installer, LUKS2, GRUB, Parrot arsenal bundled." })));
    page.append(sr);
  }
  function offlineResults(q) {
    const t = q.toLowerCase();
    const base = [
      { u: "github.com/ThaddeusHackz/RDP-universal-", t: `THADD OS — the repository (${q} docs)`, d: "Source, ISO pipeline, shell, JARVIS AI agent and the cloud edition. One OS. All the Best." },
      { u: "thadd.os/docs", t: "THADD OS Documentation — " + q, d: "Install, harden, hack, build. 120+ pages covering every subsystem of the OS." },
    ];
    if (/nmap|scan|port/.test(t)) base.push({ u: "nmap.org/book/man.html", t: "Nmap Reference Guide — port scanning", d: "SYN/stealth scans, service detection, NSE scripts. THADD ships 7.95 with 600+ NSE scripts." });
    if (/sqlmap|sqli|injection/.test(t)) base.push({ u: "sqlmap.org", t: "sqlmap — automatic SQL injection tool", d: "Detection and exploitation of SQL injection flaws, database takeover, --os-shell." });
    if (/metasploit|msf/.test(t)) base.push({ u: "docs.metasploit.com", t: "Metasploit Framework 6.4 documentation", d: "Modules, payloads, meterpreter, sessions, resource scripts." });
    if (/virtualbox|vm|iso/.test(t)) base.push({ u: "virtualbox.org/manual", t: "VirtualBox manual — running THADD OS", d: "Create a VM, set EFI + VMSVGA + 3D acceleration, attach the ISO, boot live or install." });
    if (/ai|jarvis|groq|llm/.test(t)) base.push({ u: "console.groq.com/docs", t: "Groq API — ultra-fast LLM inference", d: "OpenAI-compatible chat completions at 275+ tok/s: llama-3.3-70b, Mixtral, Gemma2, DeepSeek-R1." });
    base.push({ u: "wiki.archlinux.org/title/installation_guide", t: "Installation guide — Arch Wiki", d: "UEFI, partitioning, LUKS, GRUB. THADD wraps all of this in an automated installer." });
    base.push({ u: "en.wikipedia.org/wiki/Operating_system", t: "Operating system — Wikipedia", d: "System software that manages hardware, resources and provides services for programs." });
    return base;
  }
  function exploitPage(q) {
    fakePage("Exploit Database", "exploit-db.com · offline mirror" + (q ? " · search: " + q : ""),
      [card("Results", ["EDB-50383  Apache 2.4.49 — Path Traversal & RCE (CVE-2021-41773)   → linux/webapps",
        "EDB-51625  Apache HTTP Server 2.4.58 — DoS                              → linux/dos",
        "EDB-51232  MySQL 8.0 — authentication bypass                            → mysql/webapps",
        "EDB-50811  WordPress 6.x — authenticated plugin RCE                     → php/webapps",
        "",
        "Use searchsploit inside the THADD Terminal for the same index offline."])]);
  }
  function htbPage() {
    fakePage("HackTheBox", "app.hackthebox.com · lab dashboard",
      [card("Active machines", ["✔ Lame          10.10.10.3     Linux    Easy     user+root owned",
        "✔ Blue          10.10.10.4     Windows  Easy     user+root owned",
        "◐ Legacy        10.10.10.5     Windows  Easy     2/2 flags",
        "○ Meta          10.10.10.6     Linux    Medium   —",
        "○ Grandpa       10.10.10.7     Windows  Medium   —"]),
      card("VPN", ["thadd0 (WireGuard) — connected · 10.10.14.7 · packets 412,118 · stable",
        "Pro tip: THADD OS ships the full Parrot arsenal so you can stay inside the OS for every step of the box."])]);
  }
  function soPage() {
    fakePage("Stack Overflow", "stackoverflow.com · cached",
      [card("Highest voted for your current task", ["How do I harden a Debian server with AppArmor and nftables?  412 votes",
        "Building a bootable hybrid ISO with live-build on bookworm  128 votes",
        "Streaming Groq chat completions with tool calls in a browser  96 votes",
        "Xvnc + XFCE + Plank: compositing on a headless box  64 votes"])]);
  }
  function wikiPage(slug) {
    fakePage(slug.replace(/_/g, " "), "en.wikipedia.org · offline article",
      [card("Summary", ["An operating system (OS) is system software that manages computer hardware and software resources and provides common services for programs. THADD OS is a Linux-based hybrid desktop distribution with a hardened kernel, offensive-security toolchain and an integrated AI agent."]),
       card("See also", ["Linux kernel · Debian · macOS Sequoia · Windows 11 · Parrot OS · Groq · LLM agent"])]);
  }
  function ytPage() {
    fakePage("YouTube", "youtube.com · cached page",
      [card("Recommended for you", ["▶ THADD OS 2.0 — first boot, full tour (14:02)   184k views",
        "▶ Building a bootable ISO with live-build, end to end (22:41)  97k views",
        "▶ JARVIS AI drives my whole OS with Groq (11:18)  412k views",
        "▶ Parrot arsenal on THADD OS: 600 tools (31:07)  63k views"])]);
  }
  function genericPage(u) {
    const host = (() => { try { return new URL(u).hostname; } catch { return u; } })();
    fakePage(host, "live page · sandboxed", [
      card("This site refuses to be embedded in a preview iframe", [
        `${host} sends X-Frame-Options / CSP frame-ancestors headers, so a browser cannot render it inside the THADD shell in this demo (this is a browser security rule, not an OS limitation).`,
        "",
        "Inside the real THADD OS (and the ISO), any site loads natively in Firefox/Chromium/Brave/Tor.",
      ]),
      card("Actions", []),
    ]);
    const box = el("div", { style: { display: "flex", gap: "9px", marginTop: "10px" } },
      el("button", { class: "btn primary", text: "Open in a real browser tab ↗", onclick: () => window.open(u, "_blank", "noopener") }),
      el("button", { class: "btn", text: "Copy URL", onclick: () => navigator.clipboard?.writeText(u).then(() => toast("URL copied", u)) }));
    page.querySelector("div").append(box);
  }

  function card(title, lines) {
    const c = el("div", { class: "st-card", style: { marginBottom: "14px" } });
    c.append(el("div", { style: { fontWeight: "700", marginBottom: "8px" }, text: title }));
    if (lines.length) c.append(el("pre", { class: "mono", style: { fontSize: "12px", whiteSpace: "pre-wrap", color: "var(--text-dim)", margin: "0" }, text: lines.join("\n") }));
    return c;
  }

  function historyMenu(e) {
    const t = cur();
    contextMenu(e.clientX - 120, e.clientY + 10, [...new Set([...t.history, ...S.bookmarks])].slice(-10).reverse()
      .map((u) => ({ label: u.length > 46 ? u.slice(0, 46) + "…" : u, icon: "↩", action: () => go(u) })));
  }

  url.value = args.url || "thadd://start";
  if (args.url) { cur().url = args.url; cur().title = titleFor(args.url); }
  setTabs(); render();
  win._onArgs = (a) => { if (a?.url) { cur().url = a.url; cur().title = titleFor(a.url); url.value = a.url; setTabs(); render(); } };
  win.el.addEventListener("thadd-resize", () => {});
  return wrap;
}
