/* =============================================================================
 * THADD OS 2.0 — apps/settings.js
 * System Settings — Fluent/macOS hybrid preferences: Appearance, Wallpaper,
 * Shell (Sequoia/Fluent/Parrot surfaces), Display, Sound, Shield, Network,
 * JARVIS AI, Users, Storage, Compatibility, Accessibility, Updates, About.
 * ========================================================================== */

import { $, el, store, toast, vfs, sleep, bus } from "../core.js";
import { setAppearance, setWallpaper, nextWallpaper } from "../shell.js";
import { WALLPAPERS } from "../registry.js";

export function build(args = {}, win, meta) {
  const panes = {
    appearance, wallpaper, shell: shellPane, display, sound, shield: shieldPane, network, ai, users, storage, compat, access, updates, about,
  };
  const side = el("div", { class: "st-side" });
  const main = el("div", { class: "st-main" });
  const PANES = [
    ["appearance", "Appearance", "🎨"], ["wallpaper", "Wallpaper", "🖼"], ["shell", "Shell & Surfaces", "🪟"],
    ["display", "Displays", "🖥"], ["sound", "Sound", "🔊"], ["shield", "THADD Shield", "🛡"],
    ["network", "Network", "📶"], ["ai", "JARVIS AI", "✦"], ["users", "Users & Groups", "👥"],
    ["storage", "Storage", "💽"], ["compat", "Compatibility", "🧩"], ["access", "Accessibility", "♿"],
    ["updates", "Software Update", "⬇"], ["about", "About", "ℹ"],
  ];
  const user = el("div", { class: "who" },
    el("div", { class: "av", text: (store.get("user", "thadd")[0] || "T").toUpperCase() }),
    el("div", {}, el("div", { class: "n", text: store.get("user", "thadd") }), el("div", { class: "r", text: "Administrator · 2FA on" })));
  side.append(user);
  let current = args.pane || "appearance";
  const rows = {};
  for (const [id, label, ic] of PANES) {
    const r = el("div", { class: "st-item" + (id === current ? " on" : "") }, el("span", { class: "ic", text: ic }), el("span", { text: label }));
    r.addEventListener("click", () => { current = id; Object.values(rows).forEach((x) => x.classList.remove("on")); r.classList.add("on"); paint(); });
    rows[id] = r; side.append(r);
  }
  function paint() {
    main.innerHTML = "";
    main.append(panes[current] ? panes[current]() : panes.about());
    main.scrollTop = 0;
  }
  paint();
  win._onArgs = (a) => { if (a?.pane) { current = a.pane; Object.entries(rows).forEach(([k, v]) => v.classList.toggle("on", k === current)); paint(); } };
  return el("div", { class: "st" }, side, main);
}

/* -------------------------------- helpers --------------------------------- */
const H = (t, s) => [el("div", { class: "st-h", text: t }), el("div", { class: "st-sub", text: s })];
function row(label, sub, control) {
  return el("div", { class: "st-row" }, el("div", { class: "lbl" }, el("div", { class: "t", text: label }), sub ? el("div", { class: "s", text: sub }) : null), control);
}
function sw(on, fn) {
  const s = el("div", { class: "switch" + (on ? " on" : "") }, el("i"));
  s.addEventListener("click", () => { s.classList.toggle("on"); fn?.(s.classList.contains("on")); });
  return s;
}
function slider(val, fn, min = 0, max = 100) {
  const i = el("input", { type: "range", min: String(min), max: String(max), value: String(val), style: { width: "190px" } });
  i.style.setProperty("--v", val + "%");
  i.addEventListener("input", () => { i.style.setProperty("--v", i.value + "%"); fn?.(+i.value); });
  return i;
}

/* ------------------------------ appearance -------------------------------- */
function appearance() {
  const w = el("div", {}, ...H("Appearance", "Theme, accent colour, transparency and motion."));
  const card = el("div", { class: "st-card" });
  const mode = el("div", { style: { display: "flex", gap: "8px" } });
  for (const m of ["dark", "light", "auto"]) {
    const b = el("button", { class: "chip" + (document.documentElement.dataset.appearance === m ? " on" : ""), text: m[0].toUpperCase() + m.slice(1) });
    b.addEventListener("click", () => {
      if (m === "auto") { setAppearance(matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark"); store.set("autoTheme", true); }
      else { setAppearance(m); store.set("autoTheme", false); }
      mode.querySelectorAll(".chip").forEach((c) => c.classList.remove("on")); b.classList.add("on");
    });
    mode.append(b);
  }
  card.append(row("Theme", "Sequoia-Fluent hybrid (dark/light/auto)", mode));
  const accents = el("div", { class: "swatches" });
  for (const [name, c] of [["THADD Blue", "#0a84ff"], ["Nebula Violet", "#7c5cff"], ["Aurora Cyan", "#22d3ee"], ["Parrot Green", "#00d68f"], ["Sequoia Pink", "#ff5f8f"], ["Amber", "#f59e0b"]]) {
    const s = el("button", { class: "swatch" + (store.get("accent", "#0a84ff") === c ? " on" : ""), style: { background: c }, title: name });
    s.addEventListener("click", () => { store.set("accent", c); document.documentElement.style.setProperty("--accent", c); document.documentElement.style.setProperty("--accent-2", c); accents.querySelectorAll(".swatch").forEach((x) => x.classList.remove("on")); s.classList.add("on"); });
    accents.append(s);
  }
  card.append(row("Accent colour", "Used by controls, selection and the AI orb", accents));
  card.append(row("Liquid glass", "Backdrop blur, translucency and vibrancy (turn off for max FPS)", sw(!store.get("noGlass", false), (on) => { document.body.classList.toggle("no-glass", !on); store.set("noGlass", !on); })));
  card.append(row("Reduce motion", "Stops aurora drift and window spring animations", sw(store.get("reduceMotion", false), (on) => { store.set("reduceMotion", on); })));
  card.append(row("Rounded window corners", "Sequoia 14px geometry", sw(true)));
  card.append(row("Show window shadows + focus rings", "Depth cues for the active window", sw(true)));
  return w.append(card), w;
}

/* ------------------------------- wallpaper -------------------------------- */
function wallpaper() {
  const w = el("div", {}, ...H("Wallpaper", "Six built-in scenes plus imported images from ~/Pictures."));
  const grid = el("div", { class: "pkg-grid" });
  for (const wp of WALLPAPERS) {
    const tile = el("div", { class: "pkg", style: { cursor: "pointer" } },
      el("div", { style: { height: "92px", borderRadius: "10px", border: "1px solid var(--hairline)", background: wp.css || "radial-gradient(120% 100% at 20% 10%, #1d2a63, transparent 55%), linear-gradient(160deg,#06070f,#0d1230)" } }),
      el("div", { class: "nm", text: wp.name }),
      el("div", { class: "dl", text: store.get("wallpaper", "sequoia") === wp.id ? "current" : "click to apply" }));
    tile.addEventListener("click", () => { setWallpaper(wp.id); toast("Wallpaper", wp.name, { icon: "🖼" }); wallpaperRefresh?.(); });
    grid.append(tile);
  }
  let wallpaperRefresh = null;
  const add = el("button", { class: "btn", text: "🖼 Use an image from ~/Pictures", onclick: () => {
    const pics = (vfs.ls(vfs.home() + "/Pictures") || []).filter((f) => /\.(png|jpe?g)$/i.test(f.name));
    if (!pics.length) return toast("No images", "Drop a PNG/JPG into ~/Pictures first.", { icon: "🖼" });
    document.getElementById("wallpaper").style.background = `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="%230c1220"/></svg>')`;
    toast("Wallpaper", pics[0].name + " applied (image bytes are simulated in the browser)", { icon: "🖼" });
  } });
  w.append(grid, el("div", { style: { display: "flex", gap: "10px" } }, add,
    el("button", { class: "btn", text: "🎲 Shuffle on every boot", onclick: () => { store.set("shuffleWall", !store.get("shuffleWall", false)); toast("Wallpaper", "Shuffle " + (store.get("shuffleWall") ? "on" : "off"), { icon: "🎲" }); } }),
    el("button", { class: "btn", text: "▶ Next", onclick: nextWallpaper })));
  return w;
}

/* ------------------------------ shell surfaces ----------------------------- */
function shellPane() {
  const w = el("div", {}, ...H("Shell & Surfaces", "THADD OS is one core with four interchangeable desktop surfaces. Switch any time — apps, files and settings carry over."));
  for (const [id, name, desc, icon] of [
    ["hybrid", "Hybrid (default)", "macOS Sequoia top bar + dock, Windows 11 Fluent snap layouts and Mica. The best of both.", "💠"],
    ["macos", "macOS Sequoia", "Spotlight, Mission Control, traffic lights, dock magnification, Launchpad, Stage-Manager-like windowing.", "🍎"],
    ["windows", "Windows 11", "Start-style centre, Fluent tiles, snap-layout flyouts, taskbar-centred icons, PowerShell-first tooling.", "🪟"],
    ["parrot", "Parrot Security", "Dark terminal-first surface: arsenal launcher, packet monitor strip, HTB workspace, green-on-black.", "🦜"],
  ]) {
    const card = el("div", { class: "st-card", style: { display: "flex", gap: "14px", alignItems: "center", borderColor: store.get("surface", "hybrid") === id ? "var(--accent)" : "var(--hairline)" } },
      el("div", { style: { fontSize: "30px" }, text: icon }),
      el("div", { style: { flex: "1" } }, el("div", { style: { fontWeight: "700" }, text: name }), el("div", { class: "mute", style: { fontSize: "12.2px" }, text: desc })),
      el("button", { class: "chip" + (store.get("surface", "hybrid") === id ? " on" : ""), text: store.get("surface", "hybrid") === id ? "Active" : "Activate", onclick: (e) => {
        store.set("surface", id);
        document.body.dataset.surface = id;
        if (id === "parrot") { document.documentElement.style.setProperty("--accent", "#00d68f"); }
        else if (id === "macos") { document.documentElement.style.setProperty("--accent", "#0a84ff"); }
        else if (id === "windows") { document.documentElement.style.setProperty("--accent", "#0078d4"); }
        else { document.documentElement.style.setProperty("--accent", store.get("accent", "#0a84ff")); }
        toast("Surface switched", `${name} layout active — applications, files and settings are shared`, { icon });
        shellPane();
      } }));
    w.append(card);
  }
  w.append(el("div", { class: "st-card" },
    el("div", { style: { fontWeight: "700", marginBottom: "6px" }, text: "Window behaviour" }),
    row("Snap layouts (Fluent)", "Drag to an edge or corner for halves and quarters", sw(true)),
    row("Magnetic window edges", "Windows snap flush when dragged near each other", sw(true)),
    row("Dock magnification", "Sequoia-style hover magnification", sw(true)),
    row("Stage Manager", "Hide all but the front window, park the rest at the side", sw(false)),
    row("Hot corners", "Top-left = Mission Control, bottom-right = lock", sw(true))));
  return w;
}

/* --------------------------------- display -------------------------------- */
function display() {
  const w = el("div", {}, ...H("Displays", `${innerWidth}×${innerHeight} @ 60 Hz · HDR-capable · night shift · true tone`));
  const card = el("div", { class: "st-card" });
  card.append(row("Resolution", "VirtualBox VMSVGA adapter", el("span", { class: "mono dim", text: `${innerWidth}×${innerHeight}` })));
  card.append(row("Brightness", "PWM-free DC dimming", slider(store.get("bright", 100), (v) => { store.set("bright", v); document.documentElement.style.filter = `brightness(${0.55 + v / 222})`; })));
  card.append(row("Scale", "UI density", el("div", { style: { display: "flex", gap: "6px" } },
    ...["100%", "125%", "150%", "200%"].map((s) => el("button", { class: "chip" + (s === "100%" ? " on" : ""), text: s, onclick: () => toast("Scale", s + " — applied to GTK/Qt/shell", { icon: "🖥" }) })))));
  card.append(row("Night Shift", "Reduce blue light after sunset (19:00–06:00)", sw(store.get("nightShift", false), (on) => { store.set("nightShift", on); document.documentElement.style.filter = on ? "sepia(.18) brightness(.94)" : ""; if (!on) document.documentElement.style.filter = ""; })));
  card.append(row("True Tone", "Adapt to ambient light (webcam sensor)", sw(true)));
  card.append(row("Arrange displays…", "Multi-monitor: mirror, extend, or use the projector layout", el("button", { class: "btn", text: "Arrange", onclick: () => toast("Displays", "2 displays detected: Virtual1 (primary) + Virtual2 (extended)", { icon: "🖥" }) })));
  return w.append(card), w;
}

/* ---------------------------------- sound --------------------------------- */
function sound() {
  const w = el("div", {}, ...H("Sound", "PipeWire 1.2 · low-latency 64-sample · LDAC/aptX · per-app routing"));
  const card = el("div", { class: "st-card" });
  card.append(row("Output volume", "THADD Buds Pro (LDAC) / Speakers", slider(store.get("vol", 62), (v) => store.set("vol", v))));
  card.append(row("Alert volume", "System notification chime", slider(70)));
  card.append(row("Balance", "Left ↔ Right", slider(50)));
  card.append(row("Output device", "PipeWire session", el("span", { class: "mono dim", text: "THADD Buds Pro · 990 kbps" })));
  card.append(row("Input device", "Microphone (with THADD voice isolation)", el("span", { class: "mono dim", text: "Internal Mic · −18 dB" })));
  card.append(row("Sound effects", "Boot chime, window sounds, JARVIS blips", sw(true)));
  w.append(card, el("div", { class: "st-card" },
    el("div", { style: { fontWeight: "700", marginBottom: "6px" }, text: "Per-app mixers" }),
    ...[["Firefox", 55], ["Code Studio", 35], ["Spotify-style player", 72], ["JARVIS voice", 88]].map(([n, v]) =>
      row(n, "", slider(v, () => {})))));
  return w;
}

/* ---------------------------------- shield -------------------------------- */
function shieldPane() {
  const w = el("div", {}, ...H("THADD Shield", "The security core. World-class hardening, default-on, verify-anything."));
  w.append(el("div", { class: "stats" },
    el("div", { class: "stat" }, el("div", { class: "k", text: "Hardening score" }), el("div", { class: "v", text: "98" }), el("div", { class: "bar2" }, el("i", { style: { width: "98%" } }))),
    el("div", { class: "stat" }, el("div", { class: "k", text: "CIS controls" }), el("div", { class: "v", text: "1238/1241" })),
    el("div", { class: "stat" }, el("div", { class: "k", text: "Threats blocked" }), el("div", { class: "v", text: "14" })),
    el("div", { class: "stat" }, el("div", { class: "k", text: "Vault secrets" }), el("div", { class: "v", text: "118" }))));
  const card = el("div", { class: "st-card", style: { marginTop: "14px" } });
  const profileBox = el("div", { style: { display: "flex", gap: "6px" } });
  for (const m of ["off", "strict", "paranoid"]) {
    const active = store.get("shield.strict", true) && m === "strict";
    const btn = el("button", { class: "chip" + (active ? " on" : ""), text: m });
    btn.addEventListener("click", () => {
      store.set("shield.strict", m !== "off");
      profileBox.querySelectorAll(".chip").forEach((c) => c.classList.remove("on"));
      btn.classList.add("on");
      const st = document.getElementById("shieldState");
      if (st) st.textContent = m === "off" ? "Off" : m[0].toUpperCase() + m.slice(1);
      toast("THADD Shield", m === "off" ? "⚠ Shield disabled — not recommended" : m + " profile engaged", { icon: "🛡" });
    });
    profileBox.append(btn);
  }
  card.append(row("Profile", "off → permissive → strict → paranoid", profileBox));
  card.append(row("Kernel lockdown", "lockdown=confidentiality + module signing", sw(true)));
  card.append(row("AppArmor confinement", "18 profiles enforcing (firefox, code, jarvis, vault…)", sw(true)));
  card.append(row("Firewall (nftables)", "default-deny inbound · 6 allows · geoip block", sw(true)));
  card.append(row("IDS / fail2ban", "sshd, xrdp, portal jails — 14 lifetime bans", sw(true)));
  card.append(row("DNS-over-HTTPS", "1.1.1.1 + 9.9.9.9 with DNSSEC validation", sw(true)));
  card.append(row("Runtime AV (ClamAV + YARA)", "Continuous scans, 8.7M signatures", sw(true)));
  card.append(row("Integrity (AIDE + auditd)", "Hourly file integrity, syscall audit", sw(true)));
  card.append(row("Vault auto-lock", "Lock secrets after 15 minutes idle", sw(true)));
  card.append(row("Lab mode (offensive tools)", "Required to point nmap/msf at non-RFC1918 targets", sw(store.get("lab", false), (on) => store.set("lab", on))));
  w.append(card);
  w.append(el("div", { class: "st-card" }, el("div", { style: { fontWeight: "700", marginBottom: "6px" }, text: "Run a scan" }),
    el("div", { style: { display: "flex", gap: "8px", flexWrap: "wrap" } },
      ...[["quick", "⚡ Quick audit"], ["full", "🔬 Full CIS + CVE audit"], ["ports", "📡 Port exposure"], ["rootkit", "🐛 Rootkit scan"], ["firewall", "🧱 Firewall review"], ["hardening", "🛡 Hardening report"]].map(([m, t]) =>
        el("button", { class: "btn", text: t, onclick: () => window.THADD.launch("terminal", { run: `thadd scan${m === "full" ? " --full" : ""}` }) }))),
    el("div", { class: "mute", style: { marginTop: "10px", fontSize: "12px" }, text: "Or ask JARVIS: “run a full security scan and explain every finding”." })));
  return w;
}

/* --------------------------------- network -------------------------------- */
function network() {
  const w = el("div", {}, ...H("Network", "Wi-Fi 6E, Ethernet, WireGuard, DoH, per-app firewall."));
  w.append(el("div", { class: "st-card" },
    el("pre", { class: "mono", style: { fontSize: "12px", color: "var(--text-dim)", whiteSpace: "pre-wrap" },
      text: "wlan0   THADD-NET-6E   1.2 Gb/s   5 GHz   WPA3   connected\neth0    VirtualBox NAT  1.0 Gb/s   —       —      connected\nthadd0  WireGuard       HTB-Lab    10.10.14.7      for lab work" }),
    el("div", { style: { display: "flex", gap: "8px", marginTop: "10px" } },
      el("button", { class: "btn", text: "Open full Network pane", onclick: () => window.THADD.launch("network") }),
      el("button", { class: "btn", text: "📶 Speed test", onclick: () => toast("Speed test", "42.1 Mb/s ↓ · 18.4 Mb/s ↑ · 12 ms", { icon: "🚀" }) }))));
  return w;
}

/* ----------------------------------- AI ----------------------------------- */
function ai() {
  const w = el("div", {}, ...H("JARVIS AI", "Groq-backed assistant with full OS control. Bring your own key."));
  const key = el("input", { class: "ob-input", type: "password", value: store.get("ai.groqKey", ""), placeholder: "gsk_…" });
  const model = el("select", { style: { padding: "9px", borderRadius: "9px", background: "rgba(255,255,255,.08)", border: "1px solid var(--hairline)" } },
    ...["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768", "gemma2-9b-it", "deepseek-r1-distill-llama-70b", "qwen-2.5-32b"].map((m) => el("option", { selected: store.get("ai.model", "llama-3.3-70b-versatile") === m, text: m })));
  w.append(el("div", { class: "st-card" },
    row("Groq API key", "Stored locally. The ISO ships a proxy so the key never hits the page.", key),
    row("Model", "6 models wired; switch anytime", model),
    row("Voice output", "Spoken replies (Web Speech)", sw(store.get("ai.voice", true), (on) => store.set("ai.voice", on))),
    row("Voice input", "Push-to-talk microphone", sw(true)),
    row("Proactive agent", "JARVIS may suggest actions when it notices something useful", sw(true)),
    row("Tool permissions", "files · terminal · apps · settings · security · screenshot", el("span", { class: "mono dim", text: "all granted" })),
    el("div", { style: { display: "flex", gap: "8px", marginTop: "10px" } },
      el("button", { class: "btn primary", text: "Save", onclick: () => { store.set("ai.groqKey", key.value.trim()); store.set("ai.model", model.value); toast("JARVIS", "Settings saved", { icon: "✦" }); } }),
      el("button", { class: "btn", text: "Open JARVIS", onclick: () => window.THADD.launch("jarvis") }),
      el("button", { class: "btn", text: "Get a key ↗", onclick: () => window.THADD.launch("browser", { url: "https://console.groq.com/keys" }) }))));
  w.append(el("div", { class: "st-card" },
    el("div", { style: { fontWeight: "700", marginBottom: "6px" }, text: "What JARVIS can do on this machine" }),
    el("pre", { class: "mono", style: { fontSize: "11.6px", color: "var(--text-dim)", whiteSpace: "pre-wrap" },
      text: "list_directory  read_file  write_file  append_file  make_directory  delete_path\nsearch_files  run_command(180+ cmds)  open_app  open_url  system_info\nset_setting  security_scan  screenshot  web_search  notify" })));
  return w;
}

/* ---------------------------------- users --------------------------------- */
function users() {
  const w = el("div", {}, ...H("Users & Groups", "Accounts, privileges and authentication."));
  const card = el("div", { class: "st-card" });
  card.append(row("Full name", "Shown on the lock screen", (() => { const i = el("input", { class: "tb-input", value: store.get("fullname", "Thadd"), style: { maxWidth: "220px" } }); i.addEventListener("change", () => store.set("fullname", i.value)); return i; })()));
  card.append(row("Username", "Used for shell, RDP and the web portal", el("span", { class: "mono dim", text: store.get("user", "thadd") })));
  card.append(row("Password", "Set THADD_PASSWORD in the cloud edition too", el("button", { class: "btn", text: "Change…", onclick: () => toast("passwd", "Password updated ✔ (demo)", { icon: "🔑" }) })));
  card.append(row("Two-factor auth", "TOTP for sudo + RDP", sw(true)));
  card.append(row("Automatic login", "Skip the lock screen on this device", sw(false)));
  card.append(row("Guest mode", "Ephemeral home, wiped on logout", sw(false)));
  w.append(card, el("div", { class: "st-card" },
    el("div", { style: { fontWeight: "700", marginBottom: "6px" }, text: "Administrator tokens" }),
    el("pre", { class: "mono", style: { fontSize: "11.8px", color: "var(--text-dim)", whiteSpace: "pre-wrap" },
      text: "sudo NOPASSWD: /usr/local/bin/thadd, /usr/bin/apt\ntimestamp_timeout=15 · requiretty=off · TOTP enforced" })));
  return w;
}

/* --------------------------------- storage -------------------------------- */
function storage() {
  const w = el("div", {}, ...H("Storage", "512 GB NVMe + 2 TB ZFS + 256 GB vault."));
  for (const [n, used, total, note] of [["Root (/)", 38, 511, "ext4 · LUKS2 · TPM2 sealed"], ["Home (/home)", 118, 2000, "ZFS mirror · snapshots hourly"], ["Vault (/vault)", 21, 256, "LUKS2 + AES-256-GCM"], ["Snapshots", 42, 500, "ZFS: 6 hourly, 3 daily, 2 weekly"]]) {
    const pct = Math.round(used / total * 100);
    w.append(el("div", { class: "st-card" },
      el("div", { style: { display: "flex", justifyContent: "space-between" } }, el("b", { text: n }), el("span", { class: "mono mute", text: `${used} / ${total} GB · ${pct}%` })),
      el("div", { class: "bar2" }, el("i", { style: { width: pct + "%" } })),
      el("div", { class: "mute", style: { fontSize: "11.8px", marginTop: "7px" }, text: note })));
  }
  w.append(el("div", { style: { display: "flex", gap: "8px" } },
    el("button", { class: "btn", text: "🧹 Optimise storage", onclick: () => toast("Optimised", "Dropped 4.1 GB of caches and old snapshots", { icon: "🧹" }) }),
    el("button", { class: "btn", text: "📸 Snapshot now", onclick: () => toast("ZFS", "thadd/home@plus-" + Date.now().toString(36) + " created", { icon: "📸" }) }),
    el("button", { class: "btn", text: "⏪ Roll back…", onclick: () => toast("Rollback", "3 snapshots available — pick one to restore", { icon: "⏪" }) })));
  return w;
}

/* ------------------------------ compatibility ------------------------------ */
function compat() {
  const w = el("div", {}, ...H("Compatibility", "Run programs and files from the other five OSes you listed — natively or through THADD layers."));
  for (const [os, detail, tools] of [
    ["🪟 Windows 11/10 apps", "Wine 9.0 + Proton 9 (Steam), .msi/.exe installers, PowerShell 7, winget/scoop shims, NTFS read/write", "Executables, DLLs, registry, DirectX 12 via DXVK/VKD3D"],
    ["🍎 macOS apps & files", "OpenCore-style boot entry, HFS+/APFS read-only mount, brew/defaults/say/pbcopy/open shims, .dmg unpacker", "Chain-boot real macOS on supported hardware"],
    ["🐧 Ubuntu 24.04", "dpkg/apt fully compatible, PPA support, snapd, Ubuntu fonts and Yaru theme pack", "Install .deb straight from the browser"],
    ["🌀 Debian 12", "Native — THADD OS is built on bookworm with the same package universe", "2,147 packages preinstalled"],
    ["🦜 Parrot Security 6.3", "parrot-tools meta + Kali tools, anonymised mode via Tor/VPN, 600+ offensive tools deduped", "HTB/THM lab profiles pre-wired"],
  ]) w.append(el("div", { class: "st-card" }, el("div", { style: { fontWeight: "700" }, text: os }),
    el("div", { class: "mute", style: { fontSize: "12.4px", margin: "6px 0" }, text: detail }),
    el("div", { class: "mono", style: { fontSize: "11.6px", color: "var(--accent-3)" }, text: tools }),
    el("button", { class: "chip", style: { marginTop: "10px" }, text: "Enable layer", onclick: () => toast("Compatibility", os + " layer enabled ✔", { icon: "🧩" }) })));
  w.append(el("div", { class: "st-card" },
    el("div", { style: { fontWeight: "700", marginBottom: "6px" }, text: "Multi-boot" }),
    el("div", { class: "mute", style: { fontSize: "12.4px" }, text: "THADD Bootloader (GRUB 2.12) detects and chain-loads every OS on the machine — Windows 11, macOS (OpenCore), Ubuntu, Debian and Parrot — from a single boot menu. See Boot Manager." }),
    el("button", { class: "btn", style: { marginTop: "10px" }, text: "Open Boot Manager", onclick: () => window.THADD.launch("bootpicker") })));
  return w;
}

/* ------------------------------ accessibility ------------------------------ */
function access() {
  const w = el("div", {}, ...H("Accessibility", "Make the OS fit you."));
  const c = el("div", { class: "st-card" });
  c.append(row("VoiceOver (THADD Voice)", "Screen reader with 42 voices", sw(false)));
  c.append(row("Magnifier", "Zoom up to 20×", sw(false)));
  c.append(row("Colour filters", "Protanopia, deuteranopia, tritanopia, greyscale", sw(false, (on) => { document.documentElement.style.filter = on ? "saturate(.6)" : ""; })));
  c.append(row("Increase contrast", "High-contrast UI", sw(false)));
  c.append(row("Reduce transparency", "Turn off glass for readability/perf", sw(store.get("noGlass", false), (on) => { document.body.classList.toggle("no-glass", on); store.set("noGlass", on); })));
  c.append(row("Sticky keys", "Modifier keys latch", sw(false)));
  c.append(row("Text size", "Interface scale", slider(100, () => {})));
  w.append(c);
  return w;
}

/* --------------------------------- updates -------------------------------- */
function updates() {
  const w = el("div", {}, ...H("Software Update", "Rolling release — THADD OS 2.0.x “Nebula Prime”."));
  const card = el("div", { class: "st-card" });
  card.append(row("Current version", "Build 2.0.0 (2026-10-13)", el("span", { class: "mono dim", text: "up to date" })));
  card.append(row("Channel", "stable / beta / nightly", el("div", { style: { display: "flex", gap: "6px" } },
    ...["stable", "beta", "nightly"].map((c) => el("button", { class: "chip" + (c === "stable" ? " on" : ""), text: c, onclick: () => toast("Channel", c + " channel selected", { icon: "⬇" }) })))));
  card.append(row("Automatic updates", "Apply security patches automatically at 04:00", sw(true)));
  card.append(row("Kernel live patching", "No-reboot security fixes", sw(true)));
  w.append(card, el("div", { class: "st-card" },
    el("div", { style: { fontWeight: "700", marginBottom: "8px" }, text: "Available" }),
    el("div", { class: "mute", style: { fontSize: "12.4px" }, text: "41 package updates · 12 MB kernel delta · 3 security advisories (all covered by live patch)." }),
    el("button", { class: "btn primary", style: { marginTop: "12px" }, text: "⬇ Update now", onclick: async (e) => {
      e.target.textContent = "Updating…"; await sleep(1400);
      e.target.textContent = "✔ Up to date"; toast("Updated", "41 packages upgraded · live kernel patch applied (no reboot needed)", { icon: "⬇" });
    } })));
  return w;
}

/* ---------------------------------- about --------------------------------- */
function about() {
  const w = el("div", {}, ...H("About", "THADD OS 2.0 “Nebula Prime”."));
  w.append(el("div", { class: "st-card" },
    el("pre", { class: "mono", style: { fontSize: "12px", color: "var(--text-dim)", whiteSpace: "pre-wrap" },
      text: `OS          THADD OS 2.0 "Nebula Prime"
Kernel      6.9.7-thadd-hardened (KSPP, lockdown=confidentiality)
Base        Debian 12 bookworm (+ Ubuntu, Parrot, Windows & macOS compat layers)
Desktop     THADD Shell 2.0 — macOS Sequoia × Windows 11 Fluent hybrid
Security    THADD Shield STRICT — hardening 98/100 (A+)
AI          JARVIS 2.0 on Groq — 16 OS tools, voice in/out
Arsenal     Parrot 6.3 meta + THADD offensive pack — 600+ tools
ISO         thadd-os-2.0-nebula-prime-amd64.iso (2.94 GB, hybrid live/installer)
Repo        github.com/ThaddeusHackz/RDP-universal-
Licence     MIT — One OS. All the Best.` })),
    el("div", { style: { display: "flex", gap: "8px", marginTop: "12px", flexWrap: "wrap" } },
      el("button", { class: "btn", text: "📖 Guide", onclick: () => window.THADD.launch("guide") }),
      el("button", { class: "btn", text: "⬇ Check for updates", onclick: () => window.THADD.launch("softwareupdate") }),
      el("button", { class: "btn", text: "🐙 GitHub", onclick: () => window.THADD.launch("browser", { url: "https://github.com/ThaddeusHackz/RDP-universal-" }) }),
      el("button", { class: "btn", text: "💿 Build the ISO", onclick: () => window.THADD.launch("terminal", { run: "thadd iso build" }) })));
  return w;
}
