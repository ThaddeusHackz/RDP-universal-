/* =============================================================================
 * THADD OS 2.0 — apps/misc.js
 * The everyday apps: Calculator, Notes, Camera, Photos, Music, Videos, Mail,
 * Messages, Clock, Weather, Reminders, Calendar, Maps, Translate, About,
 * Draw, Slides, PDF, Documents, Sheets, Printers, Bluetooth, Screen Recorder,
 * and the Launchpad hook.
 * ========================================================================== */

import { $, el, esc, store, vfs, toast, bus, sleep, copy } from "../core.js";

export function build(args = {}, win, meta) {
  const id = win._app;
  const M = {
    calc: calc, notes: notes, camera: camera, photos: photos, music: music, videos: videos,
    mail: mail, chat: chat, vpn: vpn, calendar: calendar, tasks: tasks, sheet: sheet, office: office,
    pdf: pdf, clock: clock, weather: weather, maps: maps, translate: translate, about: about,
    draw: draw, presenter: presenter, screenrec: screenrec, printers: printers, bluetooth: bluetooth,
  }[id] || generic;
  return M(args, win, meta);
}

/* -------------------------------- generic -------------------------------- */
function generic(args, win, meta) {
  const w = el("div", { class: "pad" });
  w.append(el("div", { class: "st-h", text: meta?.name || win._title }),
    el("div", { class: "st-sub", text: meta?.desc || "" }),
    el("div", { class: "st-card" }, el("div", { style: { fontSize: "34px" }, text: meta?.icon || "📦" }),
      el("div", { style: { marginTop: "8px" }, text: "This app is part of the THADD OS image (GTK/Qt native) and is simulated here in the browser edition." })),
    el("button", { class: "btn", text: "Ask JARVIS about it", onclick: () => window.THADD.launch("jarvis", { prompt: `What does ${meta?.name} do in THADD OS and how do I use it?` }) }));
  return w;
}

/* ------------------------------- calculator ------------------------------ */
function calc() {
  const screen = el("div", { class: "calc-screen", text: "0" });
  const keys = el("div", { class: "calc-keys" });
  let acc = "", cur = "", op = null;
  const set = () => (screen.textContent = cur || acc || "0");
  const press = (k) => {
    if (/[0-9.]/.test(k)) { cur = (cur + k).slice(0, 18); }
    else if (k === "C") { acc = ""; cur = ""; op = null; }
    else if (k === "±") cur = String(-Number(cur || acc));
    else if (k === "%") cur = String(Number(cur || acc) / 100);
    else if ("+-×÷".includes(k)) { if (cur) { acc = op ? String(calc2(Number(acc), Number(cur), op)) : cur; cur = ""; } op = k; }
    else if (k === "=") { if (op) { cur = String(calc2(Number(acc), Number(cur), op)); acc = ""; op = null; } }
    else if (k === "√") cur = String(Math.sqrt(Number(cur || acc)));
    else if (k === "x²") cur = String(Number(cur || acc) ** 2);
    else if (k === "sin") cur = String(Math.sin(Number(cur || acc)).toFixed(6));
    else if (k === "π") cur = String(Math.PI);
    set();
  };
  const calc2 = (a, b, o) => ({ "+": a + b, "-": a - b, "×": a * b, "÷": b === 0 ? NaN : a / b }[o]);
  for (const k of ["C", "±", "%", "÷", "7", "8", "9", "×", "4", "5", "6", "-", "1", "2", "3", "+", "√", "x²", "π", "=", "sin", "0", ".", "⌫"]) {
    const b = el("button", { class: k === "=" ? "eq" : "+-×÷".includes(k) ? "op" : "", text: k });
    b.addEventListener("click", () => { if (k === "⌫") cur = cur.slice(0, -1); else press(k); });
    keys.append(b);
  }
  const wrap = el("div", { class: "calc" }, screen, keys);
  wrap.tabIndex = 0;
  wrap.addEventListener("keydown", (e) => {
    const map = { "*": "×", "/": "÷", "-": "-", "+": "+", "=": "=", Enter: "=", Escape: "C", Backspace: "⌫" };
    if (/[0-9.]/.test(e.key)) press(e.key); else if (map[e.key]) press(map[e.key]);
  });
  setTimeout(() => wrap.focus(), 80);
  return wrap;
}

/* ---------------------------------- notes -------------------------------- */
function notes(args) {
  const KEY = "notes.body";
  const title = el("input", { class: "tb-input", value: store.get("notes.title", "Ideas for THADD OS 3.0"), style: { fontWeight: "650" } });
  const ta = el("textarea", { spellcheck: "false", value: store.get("notes.body", `# THADD OS — scratch\n\n- [x] Ship the Nebula Prime shell\n- [ ] Wire JARVIS tool-calling to the Parrot arsenal\n- [ ] VirtualBox snapshot pack for the README\n- [ ] Publish the ISO in Releases\n\n> “One OS. All the Best.”\n`) });
  const bar = el("div", { class: "toolbar" },
    el("button", { class: "chip", text: "💾 Save", onclick: () => { store.set("notes.body", ta.value); store.set("notes.title", title.value); toast("Note saved", title.value, { icon: "📝" }); } }),
    el("button", { class: "chip", text: "⬇ Export to ~/Documents", onclick: () => { const p = vfs.home() + "/Documents/" + (title.value.replace(/[\/\\]/g, "-") || "note") + ".md"; vfs.write(p, ta.value); toast("Exported", p.replace(vfs.home(), "~"), { icon: "📄" }); } }),
    el("button", { class: "chip", text: "✦ Summarise with JARVIS", onclick: () => window.THADD.launch("jarvis", { prompt: `Summarise this note and turn it into a task list:\n\n${ta.value.slice(0, 2000)}` }) }),
    el("span", { class: "mute mono", style: { marginLeft: "auto" }, text: `${ta.value.split(/\s+/).filter(Boolean).length} words` }));
  ta.addEventListener("input", () => { store.set("notes.body", ta.value); });
  return el("div", { class: "notes" }, bar, title, ta);
}

/* --------------------------------- camera -------------------------------- */
function camera() {
  const video = el("video", { autoplay: "", playsinline: "", muted: "" });
  const empty = el("div", { class: "empty" }, el("div", { class: "e", text: "📹" }), el("div", { text: "Camera idle — press Start to grant access." }));
  const shot = el("button", { class: "cam-shot", title: "Capture" });
  const bar = el("div", { class: "cam-bar" },
    el("button", { class: "btn primary", text: "Start camera", onclick: start }),
    el("button", { class: "btn", text: "Stop", onclick: stop }), shot);
  const wrap = el("div", { class: "cam" }, empty, video, bar);
  shot.addEventListener("click", snap);
  async function start() {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true });
      video.srcObject = s; video.style.display = "block"; empty.style.display = "none";
      toast("Camera live", "Face-blur privacy mode available in THADD Shield", { icon: "📹" });
    } catch (e) { toast("Camera blocked", "Your browser denied camera access for this frame.", { icon: "⚠" }); }
  }
  function stop() { (video.srcObject?.getTracks() || []).forEach((t) => t.stop()); video.srcObject = null; video.style.display = "none"; empty.style.display = "grid"; }
  window._camStop = stop;
  function snap() {
    if (!video.srcObject) return toast("Nothing to capture", "Start the camera first.", { icon: "⚠" });
    const c = document.createElement("canvas"); c.width = video.videoWidth; c.height = video.videoHeight;
    c.getContext("2d").drawImage(video, 0, 0);
    const name = `thadd-photo-${Date.now()}.png`;
    const a = document.createElement("a"); a.href = c.toDataURL("image/png"); a.download = name; a.click();
    vfs.write(vfs.home() + "/Pictures/" + name, `[PNG ${c.width}×${c.height}]`);
    toast("Photo captured", name, { icon: "📸" });
  }
  return wrap;
}

/* --------------------------------- photos -------------------------------- */
function photos(args) {
  const w = el("div", { class: "pad" });
  const pics = (vfs.ls(vfs.home() + "/Pictures") || []);
  w.append(el("div", { class: "st-h", text: "Photos" }),
    el("div", { class: "st-sub", text: `${pics.length} items in ~/Pictures · on-device AI tagging (people, places, text)` }));
  const g = el("div", { class: "gal" });
  const tiles = ["🌌 Aurora shot", "🏙 Accra skyline", "🖥 THADD desktop", "🐧 Tux sticker", "🔐 Lab notes", "📡 Wi-Fi map", "💻 Terminal zoom", "🧠 Model graph"];
  for (const t of tiles) g.append(el("div", { class: "bh-card" }, el("div", { style: { fontSize: "36px" }, text: t.split(" ")[0] }),
    el("div", { class: "n", text: t.split(" ").slice(1).join(" ") }), el("div", { class: "d", text: "4032×3024 · HEIC" })));
  w.append(g);
  w.append(el("div", { class: "st-card" },
    el("div", { style: { fontWeight: "700", marginBottom: "6px" }, text: "AI tagging" }),
    el("div", { class: "mute", text: "JARVIS indexed 8 images: “accra, skyline, terminal, hacker, night”. Say: “JARVIS, find my screenshots from today”." })));
  return w;
}

/* --------------------------------- music --------------------------------- */
function music() {
  const now = el("div", { class: "now", text: "THADD Anthem — Nebula Prime" });
  const art = el("div", { class: "art" });
  const time = el("div", { class: "mute mono", text: "0:00 / 3:42" });
  let t = 0, playing = false, timer = null;
  const bar = el("input", { type: "range", min: "0", max: "222", value: "0", style: { width: "300px" } });
  const btns = el("div", { style: { display: "flex", gap: "12px", marginTop: "14px", justifyContent: "center" } },
    el("button", { class: "btn", text: "⏮", onclick: () => { t = 0; paint(); } }),
    el("button", { class: "btn primary", text: "▶ Play", onclick: (e) => toggle(e.target) }),
    el("button", { class: "btn", text: "⏭", onclick: () => { t = 0; paint(); } }));
  const stage = el("div", { class: "stage" }, el("div", { style: { textAlign: "center" } }, art, now, time, bar, btns));
  function paint() { bar.value = t; time.textContent = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")} / 3:42`; }
  function toggle(b) {
    playing = !playing; b.textContent = playing ? "⏸ Pause" : "▶ Play";
    if (playing) { timer = setInterval(() => { t = (t + 1) % 222; paint(); }, 1000); toast("Now playing", "THADD Anthem — visualiser active", { icon: "🎵", ms: 1600 }); }
    else clearInterval(timer);
  }
  const list = el("div", { class: "pad" });
  list.append(el("h3", { style: { fontSize: "14px", marginBottom: "8px" }, text: "Library (FLAC · 1,284 tracks indexed)" }));
  for (const [n, a, d] of [["THADD Anthem", "Nebula Prime", "3:42"], ["Parrot Glitch", "0xThadd", "4:11"], ["Sequoia Drift", "Fluent", "2:58"], ["Kernel Panic Blues", "tty0", "5:06"], ["Groq Speed", "llama3", "3:19"]])
    list.append(el("div", { class: "vrow" }, el("span", { text: "🎵" }), el("div", { class: "t", text: n }), el("div", { class: "u", text: a }), el("div", { class: "p", text: d })));
  return el("div", { class: "media" }, stage, list);
}

/* --------------------------------- videos -------------------------------- */
function videos() {
  const w = el("div", { class: "pad" });
  w.append(el("div", { class: "st-h", text: "Videos" }), el("div", { class: "st-sub", text: "MPV 0.39 · hardware decode · 4K60 · subtitles · chapter skip" }));
  const g = el("div", { class: "pkg-grid" });
  for (const [n, d, dur] of [["THADD OS tour", "Screen recording of the Nebula Prime shell", "14:02"], ["ISO build timelapse", "live-build, 10 stages, sped up", "3:41"], ["JARVIS demo", "Groq agent driving the OS", "11:18"], ["Parrot arsenal", "600 tools walkthrough", "31:07"]])
    g.append(el("div", { class: "pkg" }, el("div", { class: "top" }, el("div", { class: "ico", text: "🎬" }), el("div", {}, el("div", { class: "nm", text: n }), el("div", { class: "dl", text: dur }))),
      el("div", { class: "ds", text: d }),
      el("div", { class: "btns" }, el("button", { class: "btn primary", text: "▶ Play", onclick: () => toast("Playing", n + " — MPV hardware decode", { icon: "▶" }) }), el("button", { class: "btn", text: "Open folder", onclick: () => window.THADD.launch("finder", { path: vfs.home() + "/Videos" }) }))));
  w.append(g);
  return w;
}

/* ---------------------------------- mail --------------------------------- */
function mail() {
  const side = el("div", { class: "mail-side" });
  for (const f of ["📥 Inbox (3)", "⭐ Flagged", "📤 Sent", "🗑 Trash", "🔐 Encrypted"]) side.append(el("div", { class: "fm-nav", text: f }));
  const main = el("div", { class: "mail-main" });
  const msgs = [
    ["GitHub", "Your ISO workflow succeeded", "build-thadd-os #42 completed in 11m 38s — artifact thadd-os-2.0.iso (2.94 GB) uploaded."],
    ["HackTheBox", "New machine: Meta (Linux, Medium)", "Season 7 begins. Note: THADD OS ships the full arsenal — good luck out there."],
    ["Groq", "You’re on the free tier with 14,400 req/day", "llama-3.3-70b-versatile is ready. Copy your key into JARVIS settings."],
    ["Thadd", "Re: VirtualBox performance", "Enable EFI + VMSVGA + 3D accel, 2 CPUs, 4 GB RAM. The shell runs at 60fps then."],
  ];
  for (const [f, s, b] of msgs) main.append(el("div", { class: "mail-item" },
    el("div", { class: "f", text: f }), el("div", { style: { fontWeight: "600", fontSize: "12.6px" }, text: s }), el("div", { class: "s", text: b })));
  return el("div", { class: "mail" }, side, main);
}

/* ---------------------------------- chat --------------------------------- */
function chat() {
  const w = el("div", { class: "pad" });
  w.append(el("div", { class: "st-h", text: "Messages" }), el("div", { class: "st-sub", text: "Matrix + Signal bridge · end-to-end encrypted" }));
  const thread = el("div", { class: "st-card", style: { maxHeight: "320px", overflow: "auto" } });
  for (const [who, txt] of [["thadd", "Is the ISO building?"], ["ops-bot", "Stage 7/10: mksquashfs with zstd — 412 MB/s."], ["thadd", "Ship it 🚀"], ["parrot-bot", "Arsenal synced: 600 tools, 12k NSE scripts."]])
    thread.append(el("div", { style: { margin: "6px 0" } }, el("b", { text: who + ": " }), el("span", { text: txt })));
  const inp = el("input", { class: "tb-input", placeholder: "Message #thadd-os…" });
  inp.addEventListener("keydown", (e) => { if (e.key === "Enter" && inp.value) { thread.append(el("div", { style: { margin: "6px 0" } }, el("b", { text: "thadd: " }), el("span", { text: inp.value }))); inp.value = ""; thread.scrollTop = thread.scrollHeight; } });
  w.append(thread, el("div", { style: { marginTop: "10px" } }, inp));
  return w;
}

/* ---------------------------------- vpn ---------------------------------- */
function vpn() {
  const w = el("div", { class: "pad" });
  w.append(el("div", { class: "st-h", text: "THADD VPN" }), el("div", { class: "st-sub", text: "WireGuard 1.0.2024 · kill-switch · split tunnelling" }));
  const card = el("div", { class: "st-card" });
  const state = el("div", { style: { display: "flex", alignItems: "center", gap: "10px" } },
    el("span", { id: "vpnDot", style: { width: "10px", height: "10px", borderRadius: "50%", background: "#f87171", display: "inline-block" } }),
    el("b", { text: "HTB-Lab · 10.10.14.7" }), el("span", { class: "mute", text: "down" }));
  const b = el("button", { class: "btn primary", text: "Connect", onclick: () => {
    const on = b.textContent === "Connect";
    b.textContent = on ? "Disconnect" : "Connect";
    $("#vpnDot").style.background = on ? "#34d399" : "#f87171";
    state.lastChild.textContent = on ? "up · handshake 41 ms · 12.4 MB rx" : "down";
    toast("VPN", on ? "Tunnel up — HTB lab reachable at 10.10.10.0/24" : "Tunnel down", { icon: "🌍" });
  } });
  card.append(state, el("div", { style: { marginTop: "12px" } }, b));
  w.append(card, el("div", { class: "st-card" }, el("div", { style: { fontWeight: "700" }, text: "Profiles" }),
    el("pre", { class: "mono", style: { fontSize: "12px", whiteSpace: "pre-wrap", color: "var(--text-dim)" }, text: "thadd0    WireGuard  10.10.14.7   HTB-Lab        auto\nthadd1    WireGuard  10.10.14.8   THM-Lab        manual\ncommercial WireGuard  10.66.0.2    THADD-Secure   kill-switch on" })));
  return w;
}

/* -------------------------------- calendar ------------------------------- */
function calendar() {
  const w = el("div", { class: "pad" });
  const d = new Date();
  w.append(el("div", { class: "st-h", text: `${["January","February","March","April","May","June","July","August","September","October","November","December"][d.getMonth()]} ${d.getFullYear()}` }));
  const grid = el("div", { style: { display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: "6px", margin: "14px 0" } });
  for (const dn of ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]) grid.append(el("div", { class: "mute", style: { fontSize: "11px", textAlign: "center" }, text: dn }));
  const first = (new Date(d.getFullYear(), d.getMonth(), 1).getDay() + 6) % 7;
  const days = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  for (let i = 0; i < first; i++) grid.append(el("div"));
  for (let i = 1; i <= days; i++) {
    const isToday = i === d.getDate();
    grid.append(el("div", { style: { textAlign: "center", padding: "9px", borderRadius: "9px", fontSize: "12.5px",
      background: isToday ? "var(--accent)" : "rgba(255,255,255,.05)", fontWeight: isToday ? "700" : "400" }, text: i }));
  }
  w.append(grid, el("div", { class: "st-card" }, el("div", { style: { fontWeight: "700", marginBottom: "6px" }, text: "Today" }),
    el("div", { text: "• 09:00 — Standup (Matrix)" }), el("div", { text: "• 11:30 — ISO build review" }),
    el("div", { text: "• 15:00 — HTB: Meta (Linux/Medium)" }), el("div", { text: "• 20:00 — THADD OS 3.0 design session" })));
  return w;
}

/* --------------------------------- tasks --------------------------------- */
function tasks() {
  const w = el("div", { class: "pad" });
  w.append(el("div", { class: "st-h", text: "Reminders" }), el("div", { class: "st-sub", text: "Habits · pomodoro · focus modes" }));
  const list = store.get("tasks.list", [
    { t: "Build THADD OS ISO", d: true }, { t: "Publish release + screenshots", d: false },
    { t: "Solve HTB Meta", d: false }, { t: "Wire JARVIS to the Parrot arsenal", d: true },
    { t: "Benchmark the shell at 4K", d: false }]);
  const host = el("div", { class: "st-card" });
  const paint = () => {
    host.innerHTML = "";
    list.forEach((x, i) => {
      const row = el("div", { class: "st-row" }, el("input", { type: "checkbox", checked: x.d, style: { width: "16px", height: "16px" } }),
        el("div", { class: "lbl" }, el("div", { class: "t", style: { textDecoration: x.d ? "line-through" : "none", opacity: x.d ? ".6" : "1" }, text: x.t })));
      row.querySelector("input").addEventListener("change", (e) => { x.d = e.target.checked; store.set("tasks.list", list); paint(); });
      host.append(row);
    });
    const add = el("div", { class: "st-row" }, el("input", { class: "tb-input", placeholder: "Add a task and press ⏎" }));
    add.querySelector("input").addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.value) { list.push({ t: e.target.value, d: false }); store.set("tasks.list", list); paint(); } });
    host.append(add);
  };
  paint();
  w.append(host, el("div", { class: "st-card" }, el("div", { style: { fontWeight: "700" }, text: "Focus timer" }),
    el("div", { class: "mute", text: "25:00 pomodoro ready — start it from the menu bar or say “JARVIS, start a focus session”." })));
  return w;
}

/* -------------------------------- sheet/office ---------------------------- */
function sheet() {
  const w = el("div", { class: "pad" });
  const tbl = el("table", { class: "tbl" });
  tbl.append(el("thead", {}, el("tr", {}, ...[ "", "A", "B", "C", "D", "E" ].map((h) => el("th", { text: h })))));
  const rows = [["1", "Metric", "Value", "Target", "Δ", "Owner"], ["2", "Cold boot (s)", "4.2", "6.0", "-1.8", "kernel"], ["3", "Idle RAM (MB)", "312", "350", "-38", "shell"],
    ["4", "Hardening score", "98", "95", "+3", "shield"], ["5", "Nmap hosts/min", "1,284", "900", "+384", "arsenal"], ["6", "ISO size (GB)", "2.94", "3.5", "-0.56", "build"]];
  const tb = el("tbody");
  rows.forEach((r) => tb.append(el("tr", {}, ...r.map((c, i) => el("td", { text: c, style: i === 0 ? { opacity: ".5" } : {} })))));
  tbl.append(tb);
  w.append(el("div", { class: "st-h", text: "Spreadsheets" }), el("div", { class: "st-sub", text: "THADD Sheets — 1,048,576 rows · formulas · pivot tables" }), tbl);
  return w;
}
function office() {
  const w = el("div", { class: "pad" });
  w.append(el("div", { class: "st-h", text: "Documents — Writer" }), el("div", { class: "st-sub", text: "DOCX/ODT · tracked changes · 1,200 page support" }));
  const page = el("div", { class: "st-card", style: { background: "#fff", color: "#111", fontFamily: "Georgia, serif", lineHeight: "1.7", padding: "34px 38px" } });
  page.append(el("h2", { style: { fontFamily: "inherit", marginBottom: "12px" }, text: "THADD OS 2.0 — Release Notes" }),
    el("p", { text: "Nebula Prime unifies a macOS Sequoia surface, Windows 11 Fluent ergonomics and a hardened Debian core with the full Parrot offensive toolkit." }),
    el("p", { text: "Key deliverables: bootable ISO (live + installer), JARVIS Groq agent with 16 OS tools, THADD Shield hardening at 98/100, and a cloud edition in Docker." }),
    el("p", { style: { opacity: ".6", fontSize: "12px" }, text: "— Thadd, Accra, Ghana" }));
  w.append(page);
  return w;
}
function pdf() {
  const w = el("div", { class: "pad" });
  w.append(el("div", { class: "st-h", text: "PDF Studio" }), el("div", { class: "st-sub", text: "OCR · annotate · redact · sign · 4,000 pages/s render" }));
  const p = el("div", { class: "st-card", style: { background: "#fff", color: "#111", padding: "26px" } });
  p.append(el("div", { style: { fontSize: "11px", letterSpacing: ".12em", color: "#666" }, text: "THADD OS WHITEPAPER" }),
    el("h3", { style: { fontFamily: "Georgia, serif", margin: "8px 0" }, text: "Security architecture of a hybrid desktop" }),
    el("p", { style: { fontSize: "13px", lineHeight: "1.7", color: "#222" }, text: "Kernel: KSPP, lockdown=confidentiality, module signing, KPTI, SMEP/SMAP, Yama. Userspace: AppArmor confinement, systemd sandboxing, seccomp for all THADD services. Data: LUKS2 + TPM2 sealing with argon2id, AES-256-GCM vault. Network: nftables default-deny, DoH/DNSSEC, WireGuard, fail2ban. Detection: YARA + ClamAV, AIDE integrity, auditd, rkhunter." }),
    el("div", { style: { display: "flex", gap: "8px", marginTop: "14px" } },
      el("button", { class: "btn", text: "✍ Sign", onclick: () => toast("Signed", "PAdES signature applied (SHA-256)", { icon: "✍" }) }),
      el("button", { class: "btn", text: "🔍 OCR 4 pages", onclick: () => toast("OCR complete", "2,148 words indexed — searchable", { icon: "🔍" }) }),
      el("button", { class: "btn", text: "⬛ Redact", onclick: () => toast("Redacted", "3 regions permanently removed", { icon: "⬛" }) })));
  w.append(p);
  return w;
}

/* --------------------------------- clock --------------------------------- */
function clock() {
  const w = el("div", { class: "pad" });
  const big = el("div", { class: "lock-time", style: { fontSize: "58px" } });
  const date = el("div", { class: "mute" });
  const tick = () => { const d = new Date(); big.textContent = d.toLocaleTimeString(); date.textContent = d.toDateString(); };
  tick(); const t = setInterval(tick, 1000);
  w.addEventListener("thadd-close", () => clearInterval(t));
  w.append(el("div", { class: "st-h", text: "Clock" }), big, date,
    el("div", { class: "st-card", style: { marginTop: "16px" } }, el("div", { style: { fontWeight: "700", marginBottom: "8px" }, text: "World clocks" }),
      el("div", { class: "tbl" }, ...["Accra 09:41", "London 10:41", "New York 05:41", "Tokyo 18:41", "Dubai 13:41"].map((c) => el("div", { style: { padding: "5px 0" }, text: c })))));
  return w;
}

/* -------------------------------- weather -------------------------------- */
function weather() {
  const w = el("div", { class: "pad" });
  w.append(el("div", { class: "st-h", text: "Weather — Accra, Ghana" }), el("div", { class: "st-sub", text: "Open-Meteo · updated just now" }));
  const now = el("div", { class: "st-card", style: { display: "flex", alignItems: "center", gap: "18px" } },
    el("div", { style: { fontSize: "54px" }, text: "⛅" }),
    el("div", {}, el("div", { style: { fontSize: "36px", fontWeight: "700" }, text: "31°C" }), el("div", { class: "mute", text: "Partly cloudy · feels like 35°C · humidity 74% · wind 14 km/h SW" })));
  const days = el("div", { class: "stats" });
  for (const [d, ic, t2] of [["Today", "⛅", "31/25"], ["Tue", "🌦", "30/24"], ["Wed", "☀", "32/25"], ["Thu", "⛅", "31/24"], ["Fri", "🌧", "29/23"]])
    days.append(el("div", { class: "stat" }, el("div", { class: "k", text: d }), el("div", { class: "v", text: ic + " " + t2 })));
  w.append(now, days);
  return w;
}

/* --------------------------------- maps ---------------------------------- */
function maps() {
  const w = el("div", { class: "pad" });
  const c = document.createElement("canvas");
  c.width = 760; c.height = 380; c.style.width = "100%"; c.style.borderRadius = "12px"; c.style.border = "1px solid var(--hairline)";
  const x = c.getContext("2d");
  x.fillStyle = "#0c1220"; x.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < 60; i++) { x.strokeStyle = "rgba(120,160,220,.14)"; x.beginPath(); x.moveTo(Math.random() * c.width, 0); x.lineTo(Math.random() * c.width, c.height); x.stroke(); x.beginPath(); x.moveTo(0, Math.random() * c.height); x.lineTo(c.width, Math.random() * c.height); x.stroke(); }
  x.strokeStyle = "#22d3ee"; x.lineWidth = 2; x.beginPath(); x.moveTo(180, 300); x.bezierCurveTo(300, 220, 420, 260, 560, 120); x.stroke();
  [[180, 300, "Accra"], [560, 120, "Kumasi"], [420, 260, "Koforidua"]].forEach(([px, py, n]) => {
    x.fillStyle = "#f472b6"; x.beginPath(); x.arc(px, py, 6, 0, 7); x.fill();
    x.fillStyle = "#eef1f8"; x.font = "600 13px Inter, sans-serif"; x.fillText(n, px + 10, py + 4);
  });
  w.append(el("div", { class: "st-h", text: "Maps" }), el("div", { class: "st-sub", text: "OSM vector tiles · offline pack for Ghana pre-cached (82 MB)" }), c);
  return w;
}

/* ------------------------------- translate ------------------------------- */
function translate() {
  const w = el("div", { class: "pad" });
  const src = el("textarea", { class: "ed-code", style: { height: "120px" }, text: "The greatest operating system in the world runs on THADD OS." });
  const out = el("div", { class: "st-card", style: { marginTop: "10px", minHeight: "80px" } });
  const langs = ["Twi", "French", "Spanish", "Arabic", "Japanese", "German", "Swahili"];
  const sel = el("select", { style: { background: "rgba(255,255,255,.08)", padding: "7px", borderRadius: "8px", border: "1px solid var(--hairline)" } }, ...langs.map((l) => el("option", { text: l })));
  const dict = { Twi: "Adeɛ nyinaa mu, THADD OS na ɛyɛ operating system a ɛwɔ tumi paa wɔ wiase.", French: "Le meilleur système d'exploitation du monde tourne sur THADD OS.", Spanish: "El mejor sistema operativo del mundo funciona con THADD OS.", Arabic: "أفضل نظام تشغيل في العالم يعمل على ثاد أو إس.", Japanese: "世界最高のオペレーティングシステムはTHADD OSで動作します。", German: "Das beste Betriebssystem der Welt läuft auf THADD OS.", Swahili: "Mfumo bora wa uendeshaji duniani unatumia THADD OS." };
  const b = el("button", { class: "btn primary", text: "Translate", onclick: () => { out.textContent = dict[sel.value]; } });
  w.append(el("div", { class: "st-h", text: "Translate" }), el("div", { class: "st-sub", text: "95 languages · offline neural packs (NLLB-200)" }), src, el("div", { style: { display: "flex", gap: "10px", alignItems: "center", marginTop: "10px" } }, el("span", { class: "mute", text: "→" }), sel, b), out);
  return w;
}

/* --------------------------------- about --------------------------------- */
function about(args, win) {
  const w = el("div", { class: "about" });
  w.append(el("div", { class: "lg" }, el("div", { class: "m", text: "TH" }),
    el("div", {}, el("h2", { text: "THADD OS 2.0" }),
      el("div", { class: "ver", text: "Nebula Prime · build 2.0.0 (2026-10-13) · amd64 / arm64 / riscv64" }))));
  const kv = el("div", { class: "kv" });
  for (const [k, v] of [
    ["Computer", "THADD Virtual Machine (VirtualBox 7.1)"],
    ["Chip", "THADD Virtual CPU · " + (navigator.hardwareConcurrency || 8) + " cores @ 3.6GHz · AVX-512"],
    ["Memory", "16 GB DDR5-5600 (1.2 GB in use)"],
    ["Storage", "512 GB NVMe (root, LUKS2) + 2 TB ZFS (/home) + 256 GB vault"],
    ["Graphics", "VMSVGA + VirGL · 128 MB VRAM · Metal-class compositor"],
    ["Display", `${innerWidth}×${innerHeight} @ 60 Hz · HDR-capable`],
    ["Kernel", "6.9.7-thadd-hardened (KSPP, lockdown=confidentiality)"],
    ["Desktop", "THADD Shell 2.0 — Sequoia × Fluent hybrid"],
    ["Security", "THADD Shield STRICT · 47 rules · score 98/100 (A+)"],
    ["AI", "JARVIS 2.0 · Groq · llama-3.3-70b-versatile · 16 OS tools"],
    ["Arsenal", "Parrot 6.3 meta + THADD offensive pack (600+ tools)"],
    ["Serial", "THADD-2E1A-9C4D-NEBULA-PRIME"],
    ["Repository", "github.com/ThaddeusHackz/RDP-universal-"],
    ["Licence", "MIT — One OS. All the Best."],
  ]) { kv.append(el("div", { class: "k", text: k }), el("div", { text: v })); }
  w.append(kv);
  w.append(el("div", { style: { display: "flex", gap: "10px", flexWrap: "wrap" } },
    el("button", { class: "btn", text: "📖 Open the guide", onclick: () => window.THADD.launch("guide") }),
    el("button", { class: "btn", text: "🛡 Security settings", onclick: () => window.THADD.launch("shield") }),
    el("button", { class: "btn", text: "💿 Build the ISO", onclick: () => window.THADD.launch("terminal", { run: "thadd iso build" }) }),
    el("button", { class: "btn", text: "🐙 GitHub", onclick: () => window.THADD.launch("browser", { url: "https://github.com/ThaddeusHackz/RDP-universal-" }) }),
    el("button", { class: "btn", text: "⬇ Software update", onclick: () => window.THADD.launch("softwareupdate") })));
  if (args.tab === "system") toast("About This Mac", "THADD OS 2.0 Nebula Prime — 16 GB, THADD Virtual CPU, LUKS2 + ZFS", { icon: "🖥" });
  return w;
}

/* ---------------------------------- draw --------------------------------- */
function draw() {
  const c = document.createElement("canvas");
  c.width = 900; c.height = 520; c.style.width = "100%"; c.style.background = "#fff"; c.style.borderRadius = "0 0 12px 12px";
  const x = c.getContext("2d");
  let colour = "#0a84ff", w = 3, down = false;
  const bar = el("div", { class: "toolbar" });
  for (const cc of ["#0a84ff", "#ff5f57", "#28c840", "#febc2e", "#a855f7", "#111111"]) {
    const b = el("button", { class: "chip", style: { background: cc, width: "26px", height: "26px", padding: "0" } });
    b.addEventListener("click", () => { colour = cc; }); bar.append(b);
  }
  bar.append(el("span", { class: "mute", text: "Brush size" }),
    (() => { const s = el("input", { type: "range", min: "1", max: "30", value: "3" }); s.addEventListener("input", () => (w = +s.value)); return s; })(),
    el("button", { class: "chip", text: "Clear", onclick: () => x.clearRect(0, 0, c.width, c.height) }),
    el("button", { class: "chip", text: "💾 Export PNG", onclick: () => { const a = document.createElement("a"); a.href = c.toDataURL("image/png"); a.download = "thadd-drawing.png"; a.click(); } }));
  c.addEventListener("pointerdown", (e) => { down = true; x.beginPath(); x.moveTo(e.offsetX, e.offsetY); });
  c.addEventListener("pointermove", (e) => { if (!down) return; x.strokeStyle = colour; x.lineWidth = w; x.lineCap = "round"; x.lineTo(e.offsetX, e.offsetY); x.stroke(); });
  window.addEventListener("pointerup", () => (down = false));
  return el("div", {}, bar, c);
}
function presenter() {
  const w = el("div", { class: "pad" });
  const slides = [["THADD OS 2.0", "One OS. All the Best."], ["Hybrid shell", "Sequoia × Fluent, 60fps"], ["Security", "Shield 98/100 + Parrot arsenal"], ["AI", "JARVIS on Groq, 16 OS tools"], ["Ship it", "ISO in Releases + cloud edition"]];
  let i = 0;
  const view = el("div", { class: "st-card", style: { height: "300px", display: "grid", placeItems: "center", textAlign: "center" } });
  const paint = () => (view.innerHTML = `<div><div style="font-size:28px;font-weight:760">${slides[i][0]}</div><div class="mute" style="margin-top:8px">${slides[i][1]}</div></div>`);
  paint();
  w.append(el("div", { class: "st-h", text: "Slides" }), view,
    el("div", { style: { display: "flex", gap: "10px", marginTop: "12px", justifyContent: "center" } },
      el("button", { class: "btn", text: "◀", onclick: () => { i = (i + slides.length - 1) % slides.length; paint(); } }),
      el("span", { class: "mono mute", text: `${i + 1}/${slides.length}` }),
      el("button", { class: "btn", text: "▶", onclick: () => { i = (i + 1) % slides.length; paint(); } }),
      el("button", { class: "btn", text: "Export PPTX", onclick: () => toast("Exported", "thadd-deck.pptx saved to ~/Documents", { icon: "📊" }) })));
  return w;
}
function screenrec() {
  const w = el("div", { class: "pad" });
  const status = el("div", { class: "st-card", text: "Idle — no recording in progress." });
  const b = el("button", { class: "btn primary", text: "● Start recording", onclick: async () => {
    try {
      const s = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 60 }, audio: false });
      b.textContent = "■ Stop"; status.textContent = "Recording at 60fps — MCAP/WebM pipeline (this is the same tool used to produce the README demo).";
      const chunks = [];
      const rec = new MediaRecorder(s, { mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm" });
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.onstop = () => {
        const blob = new Blob(chunks, { type: "video/webm" });
        const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `thadd-recording-${Date.now()}.webm`; a.click();
        s.getTracks().forEach((t) => t.stop()); b.textContent = "● Start recording"; status.textContent = "Saved to ~/Videos ✔";
        vfs.write(vfs.home() + "/Videos/thadd-recording.webm", "[WebM VP9 60fps recording]");
        toast("Recording saved", "~/Videos/thadd-recording.webm", { icon: "⏺" });
      };
      rec.start(); window._recStop = () => rec.stop();
    } catch (e) { toast("Screen capture blocked", String(e.message || e), { icon: "⚠" }); }
  } });
  w.append(el("div", { class: "st-h", text: "Screen Recorder" }), el("div", { class: "st-sub", text: "60 fps · VP9/AV1 · system audio · region or full screen" }), status, el("div", { style: { marginTop: "12px" }, }, b));
  return w;
}
function printers() {
  const w = el("div", { class: "pad" });
  w.append(el("div", { class: "st-h", text: "Printers" }), el("div", { class: "st-sub", text: "CUPS 2.4 · IPP everywhere · driverless" }),
    el("div", { class: "st-card" }, el("div", { style: { fontWeight: "700" }, text: "No printers detected" }),
      el("div", { class: "mute", style: { margin: "6px 0 12px" }, text: "THADD OS supports AirPrint, IPP, SMB and USB printing. Add one to get going." }),
      el("button", { class: "btn primary", text: "Add printer", onclick: () => toast("Add printer", "Searching mDNS for _ipp._tcp …", { icon: "🖨" }) })));
  return w;
}
function bluetooth() {
  const w = el("div", { class: "pad" });
  w.append(el("div", { class: "st-h", text: "Bluetooth" }), el("div", { class: "st-sub", text: "BlueZ 5.7 · BLE audio (LDAC/aptX) · input devices" }));
  for (const [n, s] of [["THADD Buds Pro", "Connected · LDAC 990kbps · 62%"], ["MX Master 3S", "Connected · HID"], ["Pixel 9 Pro", "Paired · not connected"], ["Lab ESP32 sniffer", "Available · BLE"]])
    w.append(el("div", { class: "st-row" }, el("span", { text: "🔵" }), el("div", { class: "lbl" }, el("div", { class: "t", text: n }), el("div", { class: "s", text: s })),
      el("button", { class: "chip", text: /Connected/.test(s) ? "Disconnect" : "Connect", onclick: () => toast("Bluetooth", n + " toggled", { icon: "🔵" }) })));
  return w;
}
