/* =============================================================================
 * THADD OS 2.0 — apps/jarvis.js
 * JARVIS — the OS-level AI agent.  Groq (OpenAI-compatible) streaming chat with
 * real TOOL CALLING over the whole OS: read/write/delete files, run terminal
 * commands, launch apps, change settings, search the web, take screenshots,
 * harden the system.  Voice input (Web Speech) + spoken replies + barge-in.
 *
 * The same builder powers  JARVIS,  AI Copilot  and  AI Lab.
 * ========================================================================== */

import { $, el, store, toast, vfs, bus, sleep, copy, fmtBytes, contextMenu } from "../core.js";
import { windows } from "../wm.js";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODELS = [
  { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B Versatile", tag: "best all-round · tools" },
  { id: "llama-3.1-8b-instant", name: "Llama 3.1 8B Instant", tag: "fastest · 900 tok/s" },
  { id: "mixtral-8x7b-32768", name: "Mixtral 8x7B", tag: "long context 32k" },
  { id: "gemma2-9b-it", name: "Gemma2 9B", tag: "Google · light" },
  { id: "deepseek-r1-distill-llama-70b", name: "DeepSeek R1 Distill 70B", tag: "reasoning" },
  { id: "qwen-2.5-32b", name: "Qwen 2.5 32B", tag: "multilingual" },
];

/* ═══════════════════════════ THE OS TOOL LAYER ═══════════════════════════ */
const TOOLS = [
  { type: "function", function: { name: "list_directory", description: "List files and folders at a path in the THADD OS filesystem.",
      parameters: { type: "object", properties: { path: { type: "string", description: "absolute or ~ path, e.g. ~/Documents" } }, required: ["path"] } } },
  { type: "function", function: { name: "read_file", description: "Read the full text contents of a file.",
      parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"] } } },
  { type: "function", function: { name: "write_file", description: "Create or overwrite a file with new text. Creates parent folders if needed.",
      parameters: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"] } } },
  { type: "function", function: { name: "append_file", description: "Append text to the end of a file (creates it if missing).",
      parameters: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"] } } },
  { type: "function", function: { name: "make_directory", description: "Create a folder (and parents).",
      parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"] } } },
  { type: "function", function: { name: "delete_path", description: "Delete a file or folder.",
      parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"] } } },
  { type: "function", function: { name: "search_files", description: "Search the filesystem by filename fragment, or full-text search inside files.",
      parameters: { type: "object", properties: { query: { type: "string" }, in_content: { type: "boolean" } }, required: ["query"] } } },
  { type: "function", function: { name: "run_command", description: "Run a shell command in the THADD OS terminal (zsh, 180+ commands: ls, nmap, thadd doctor, git, apt, parrot tools…). Returns the output.",
      parameters: { type: "object", properties: { command: { type: "string" } }, required: ["command"] } } },
  { type: "function", function: { name: "open_app", description: "Launch an application window by id, e.g. terminal, finder, browser, editor, monitor, parrot, shield, store, settings, guide, calc, notes, music, photos, mail, vault, hackbox.",
      parameters: { type: "object", properties: { app: { type: "string" }, url: { type: "string" }, path: { type: "string" } }, required: ["app"] } } },
  { type: "function", function: { name: "open_url", description: "Open a URL in the THADD browser.",
      parameters: { type: "object", properties: { url: { type: "string" } }, required: ["url"] } } },
  { type: "function", function: { name: "system_info", description: "Get live OS telemetry: CPU, RAM, disk, network, uptime, open windows, running apps.",
      parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "set_setting", description: "Change an OS setting: appearance (dark|light), wallpaper (id), shield (strict|paranoid|off), volume (0-100), brightness (0-100), voice (on|off), model (groq model id).",
      parameters: { type: "object", properties: { key: { type: "string" }, value: { type: "string" } }, required: ["key", "value"] } } },
  { type: "function", function: { name: "security_scan", description: "Run THADD Shield security tooling: 'quick' | 'full' | 'ports' | 'rootkit' | 'firewall' | 'hardening'.",
      parameters: { type: "object", properties: { mode: { type: "string" } }, required: ["mode"] } } },
  { type: "function", function: { name: "screenshot", description: "Capture the current desktop and save it as a PNG (visual proof for the user).",
      parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "web_search", description: "Look something up on the web (opens a real search in the THADD browser and returns a summary stub).",
      parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } } },
  { type: "function", function: { name: "notify", description: "Send the user a desktop notification.",
      parameters: { type: "object", properties: { title: { type: "string" }, message: { type: "string" } }, required: ["title"] } } },
];

async function callTool(name, a = {}) {
  const H = () => vfs.home();
  switch (name) {
    case "list_directory": {
      const n = vfs.resolve(a.path || "~");
      if (!n) return `Error: no such directory: ${a.path}`;
      if (n.type === "file") return `(file) ${n.name} — ${String(n.body || "").length} bytes`;
      return (n.children || []).map((k) => `${k.type === "dir" ? "DIR " : "FILE"}  ${k.name}${k.type === "dir" ? "/" : `  (${String(k.body || "").length}b)`}`).join("\n") || "(empty)";
    }
    case "read_file": { const n = vfs.resolve(a.path); if (!n) return `Error: ${a.path} not found`; if (n.type === "dir") return "Error: that path is a directory"; return String(n.body ?? "").slice(0, 12000); }
    case "write_file": {
      const dir = vfs.parent(a.path);
      if (!dir) { vfs.mkdir(vfs.parent(a.path.replace(/\/[^/]+$/, "")) || "/"); }
      const ok = vfs.write(a.path, a.content ?? "");
      bus.emit("fs", { op: "write", path: a.path });
      return ok ? `Wrote ${a.path} (${String(a.content || "").length} bytes)` : `Failed to write ${a.path}`;
    }
    case "append_file": { const prev = vfs.read(a.path) || ""; vfs.write(a.path, prev + (a.content ?? "")); return `Appended ${String(a.content || "").length} bytes to ${a.path}`; }
    case "make_directory": vfs.mkdir(a.path); return `Created ${a.path}`;
    case "delete_path": return vfs.rm(a.path) ? `Deleted ${a.path} (moved to Trash)` : `Not found: ${a.path}`;
    case "search_files": {
      const q = String(a.query || "").toLowerCase();
      if (a.in_content) {
        const hits = vfs.flatten().filter((f) => f.node.type === "file" && String(f.node.body || "").toLowerCase().includes(q));
        return hits.slice(0, 20).map((h) => `${h.path}: ${String(h.node.body).split("\n").find((l) => l.toLowerCase().includes(q))?.trim().slice(0, 120)}`).join("\n") || "No matches.";
      }
      const hits = vfs.flatten().filter((f) => f.node.name.toLowerCase().includes(q));
      return hits.slice(0, 40).map((h) => h.path).join("\n") || "No matches.";
    }
    case "run_command": {
      const { Terminal } = window.THADD ?? {};
      const term = windows.get([...windows.keys()].find((k) => k.startsWith("terminal-")));
      if (term && term._runCommand) return await term._runCommand(a.command);
      return await window.THADD.runInTerminal(a.command, true);
    }
    case "open_app": {
      if (a.url) window.THADD.launch("browser", { url: a.url });
      else window.THADD.launch(a.app || "finder", a.path ? { path: a.path } : {});
      return `Launched ${a.app || "browser"}${a.url ? " → " + a.url : ""}`;
    }
    case "open_url": window.THADD.launch("browser", { url: a.url }); return `Opened ${a.url}`;
    case "system_info": {
      const w = [...windows.values()];
      return [
        `OS: THADD OS 2.0 "Nebula Prime" · kernel 6.9.7-thadd-hardened · uptime ${Math.floor(performance.now() / 1000)}s`,
        `CPU: ${navigator.hardwareConcurrency || 8} cores @ 3.6GHz · load ${(2 + Math.random() * 6).toFixed(1)}%`,
        `RAM: ${(1100 + Math.random() * 300).toFixed(0)} MiB / 16384 MiB · swap 0 used`,
        `Disk: 512G root (8% used) · 2T /home ZFS (6%) · /vault LUKS2 (9%)`,
        `Network: eth0 10.0.2.15 · DoH 1.1.1.1 · WireGuard idle · 42 Mb/s`,
        `Windows open: ${w.length} (${w.map((x) => x._app).join(", ") || "none"})`,
        `Shield: ${store.get("shield.strict", true) ? "STRICT" : "permissive"} · AI model: ${store.get("ai.model", MODELS[0].id)}`,
        `Files in home: ${(vfs.ls(vfs.home()) || []).length}`,
      ].join("\n");
    }
    case "set_setting": {
      const { key, value } = a;
      if (key === "appearance") { document.documentElement.dataset.appearance = value; store.set("appearance", value); }
      else if (key === "wallpaper") { const { setWallpaper } = await import("../shell.js"); setWallpaper(value); }
      else if (key === "shield") { store.set("shield.strict", value !== "off"); }
      else if (key === "volume") store.set("vol", +value);
      else if (key === "brightness") { store.set("bright", +value); document.documentElement.style.filter = `brightness(${0.55 + (+value) / 222})`; }
      else if (key === "voice") store.set("ai.voice", value !== "off");
      else if (key === "model") store.set("ai.model", value);
      else return `Unknown setting: ${key}`;
      return `${key} → ${value} ✔`;
    }
    case "security_scan": {
      const out = {
        quick: "1241 CIS controls: 1238 pass · 0 CVEs critical · hardening 98/100 (A+)",
        full: "CIS + CVE + YARA: 0 critical, 0 high, 3 medium (patched in 2.0.1) · SUID anomalies 0 · hardening 98/100",
        ports: "Listening: 22 sshd(key-only), 3389 xrdp(LAN), 8443 nginx(TLS), 631 cups — all expected; nothing unexpected",
        rootkit: "rkhunter 1.4.6: 0 infected · hidden files 0 · suspicious /dev 0",
        firewall: "nftables: default-deny inbound · 6 allows · geoip block CN/RU/KP active · 14 lifetime bans (fail2ban)",
        hardening: "AppArmor 18 profiles enforcing · kernel lockdown=confidentiality · module signing · core dumps disabled · yama ptrace_scope=2",
      }[a.mode] || "OK";
      return out;
    }
    case "screenshot": { const m = await import("./screenshot.js"); const name = await m.grab(); return `Screenshot saved: ${name}`; }
    case "web_search": { const url = "https://duckduckgo.com/?q=" + encodeURIComponent(a.query); window.THADD.launch("browser", { url }); return `Opened search results for "${a.query}" in the THADD browser.`; }
    case "notify": { toast(a.title, a.message || "", { icon: "✦" }); return "Notification delivered."; }
    default: return `Unknown tool ${name}`;
  }
}

const SYSTEM_PROMPT = `You are JARVIS, the built-in AI of THADD OS 2.0 "Nebula Prime" — a hybrid desktop (macOS Sequoia shell + Windows 11 Fluent ergonomics) with a hardened Linux/Debian core, the full Parrot Security offensive toolkit, and total file/terminal access.

Rules:
- You act, you don't just talk: when a request touches files, apps, security or settings, CALL THE TOOLS and then report precisely what you did.
- Paths: default to the user's home (~ = /home/thadd). Home contains Documents, Downloads, Pictures, Videos, Music, Desktop, thadd-os (project), secret.txt.
- After tool calls, answer in short, confident sentences. Use plain text (no # markdown headers); short lists with "•" are fine; fenced code only for commands/code.
- Never invent file contents — read them. Never claim a command ran unless the tool returned output.
- If something is destructive (delete, overwrite, shield off), state the change plainly and show the resulting state.
- Keep answers tight: most replies under 120 words unless the user asks for detail.
- You are on the user's machine: be proactive, precise, and useful. You know THADD OS intimately (ISO builder: thadd iso build; hardening: thadd shield; arsenal: parrot).`;

/* ═══════════════════════════════ THE UI ═════════════════════════════════ */
export function build(args = {}, win, meta) {
  const kind = win._app;
  const S = {
    history: store.get("ai.history", []).slice(-24),
    streaming: false, abort: null, listening: false, speaking: store.get("ai.voice", true),
    toolsUsed: [],
  };

  const head = el("div", { class: "ai-head" },
    el("div", { class: "ai-orb", id: "aiOrb" }),
    el("div", { style: { flex: "1", minWidth: "0" } },
      el("div", { class: "ai-title", text: kind === "ai-lab" ? "AI Lab" : kind === "copilot" ? "AI Copilot" : "JARVIS" }),
      el("div", { class: "ai-sub", id: "aiSub", text: "" })),
    el("button", { class: "tb-btn", id: "aiKeyBtn", title: "Groq API key", html: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 00-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 00-2-1.2L14 3h-4l-.4 2.6a7 7 0 00-2 1.2l-2.4-1-2 3.4 2 1.6a7 7 0 000 2.4l-2 1.6 2 3.4 2.4-1a7 7 0 002 1.2L10 21h4l.4-2.6a7 7 0 002-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z"/></svg>` }),
    el("button", { class: "tb-btn", id: "aiClear", title: "New chat", html: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>` }));

  const body = el("div", { class: "ai-body", id: "aiBody" });
  const suggest = el("div", { class: "ai-suggest" });
  const ta = el("textarea", { id: "aiInput", rows: "1", placeholder: kind === "ai-lab" ? "Experiment with a prompt…" : "Tell JARVIS what to do — “organise my Downloads, then run a security scan”…" });
  const send = el("button", { class: "ai-send", id: "aiSend", title: "Send (⏎) — Shift+⏎ newline", html: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12l16-8-6 8 6 8z"/></svg>` });
  const mic = el("button", { class: "ai-send", id: "aiMic", style: { background: "rgba(255,255,255,.12)", color: "var(--text)" }, title: "Voice input", html: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/></svg>` });
  const input = el("div", { class: "ai-in" }, ta, mic, send);
  const bar = el("div", { class: "ai-bar" },
    el("span", { class: "ai-dot", id: "aiDot" }),
    el("span", { id: "aiLive", text: "Checking Groq key…" }),
    el("span", { style: { marginLeft: "auto" } },),
    el("select", { id: "aiModel", style: { background: "rgba(255,255,255,.08)", border: "1px solid var(--hairline)", borderRadius: "8px", padding: "3px 7px", fontSize: "11.5px" } },
      ...MODELS.map((m) => el("option", { value: m.id, selected: store.get("ai.model", MODELS[0].id) === m.id, text: `${m.name} — ${m.tag}` }))));

  const wrap = el("div", { class: "ai" }, head, body, suggest, input, bar);
  /* resolve nodes inside THIS window first: build() runs before the window is attached */
  const $ = (sel) => wrap.querySelector(sel) || document.querySelector(sel);
  setTimeout(() => refreshKeyState(), 60);

  /* ------------------------------- state -------------------------------- */
  function refreshKeyState() {
    const k = store.get("ai.groqKey", "");
    $("#aiDot").className = "ai-dot" + (k ? " live" : "");
    $("#aiLive").textContent = k ? `Groq online · key …${k.slice(-4)} · streaming + tools armed`
      : "Offline reasoning mode — add your Groq key (⚙ above) for live models";
    $("#aiSub").textContent = k ? `${MODELS.find((m) => m.id === store.get("ai.model", MODELS[0].id))?.name || "Groq"} · ${TOOLS.length} OS tools · voice ${store.get("ai.voice", true) ? "on" : "off"}`
      : "Offline reasoning · tools still live";
  }
  $("#aiKeyBtn").addEventListener("click", () => keyDialog());
  $("#aiClear").addEventListener("click", () => { S.history = []; store.set("ai.history", []); body.innerHTML = ""; greet(); });
  $("#aiModel").addEventListener("change", (e) => { store.set("ai.model", e.target.value); refreshKeyState(); toast("JARVIS model", e.target.value, { icon: "✦" }); });

  function keyDialog() {
    const cur = store.get("ai.groqKey", "");
    const inp = el("input", { class: "ob-input", type: "password", value: cur, placeholder: "gsk_…" });
    const d = el("div", { class: "st-card", style: { margin: "12px 0", width: "100%" } },
      el("div", { style: { fontWeight: "700", marginBottom: "6px" }, text: "Groq API key" }),
      el("div", { class: "mute", style: { fontSize: "12px", marginBottom: "8px" }, text: "Stored only in this browser (localStorage). Never sent anywhere except api.groq.com." }),
      inp,
      el("div", { style: { display: "flex", gap: "8px", marginTop: "10px" } },
        el("button", { class: "btn primary", text: "Save & test", onclick: async () => {
          const k = inp.value.trim(); store.set("ai.groqKey", k); refreshKeyState();
          if (!k) return toast("Key cleared", "JARVIS is back to offline reasoning.", { icon: "✦" });
          push("system", "Testing Groq connection…");
          try {
            const r = await fetch(GROQ_URL, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + k },
              body: JSON.stringify({ model: store.get("ai.model", MODELS[0].id), messages: [{ role: "user", content: "Reply with exactly: ONLINE" }], max_tokens: 8 }) });
            const j = await r.json();
            if (j.error) throw new Error(j.error.message);
            toast("Groq connected", String(j.choices?.[0]?.message?.content || "OK").trim(), { icon: "✅" });
            push("assistant", "Groq is online — I can stream llm answers and drive your OS with tools. What should we build?");
          } catch (e) { toast("Groq test failed", e.message, { icon: "⚠" }); push("system", "Groq test failed: " + e.message); }
        } }),
        el("button", { class: "btn", text: "Get a key ↗", onclick: () => window.THADD.launch("browser", { url: "https://console.groq.com/keys" }) }),
        el("button", { class: "btn", text: "Close", onclick: () => d.remove() })));
    body.append(d);
    body.scrollTop = body.scrollHeight;
    inp.focus();
  }

  /* -------------------------------- chat -------------------------------- */
  function push(role, text, opts = {}) {
    const isMe = role === "user";
    const bub = el("div", { class: "bub" });
    bub.innerHTML = renderRich(text);
    const row = el("div", { class: "msg" + (isMe ? " me" : ""), id: opts.id || null },
      el("div", { class: "av", text: isMe ? "T" : role === "system" ? "⚙" : "✦" }), bub);
    body.append(row);
    body.scrollTop = body.scrollHeight;
    return { row, bub };
  }
  function renderRich(t) {
    let s = String(t)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/```(\w*)\n([\s\S]*?)```/g, (m, l, code) => `<pre>${code.replace(/&amp;/g, "&")}</pre>`)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
    return s;
  }
  const toolLine = (name, args2, res) => {
    const r = el("div", { class: "t-line" });
    r.innerHTML = `<span class="tool">⚙ ${name}(${String(JSON.stringify(args2)).slice(0, 90)})</span>`;
    body.append(r);
    const out = el("div", { class: "t-line t-dim", style: { fontSize: "11px", paddingLeft: "8px" } });
    out.textContent = String(res).split("\n").slice(0, 4).join("\n").slice(0, 300);
    body.append(out);
    body.scrollTop = body.scrollHeight;
    S.toolsUsed.push(name);
  };

  function greet() {
    const u = store.get("user", "thadd");
    push("assistant", `JARVIS online. Good to see you, ${u}.

I can read and write files, run anything in the terminal, launch apps, harden the system and search the web — all from here. Try:

• “Summarise what's in my home folder and tidy up Downloads”
• “Run a full security scan and give me the score”
• “Create ~/thadd-os/hello.py that prints the THADD logo, then run it”
• “Set the wallpaper to Parrot Trace and switch on strict shield”
• “Build the THADD OS ISO”`);
  }
  if (S.history.length) S.history.forEach((m) => { if (m.role !== "system") push(m.role, m.role === "assistant" ? (m.content || "(tool call)") : m.content); });
  else greet();

  for (const s of ["Write a Python script that scans my LAN", "Run thadd doctor and explain the results",
    "Organise my Downloads folder", "Create a note with ideas for THADD OS 3.0",
    "Full security scan", "What's running on my system right now?"]) {
    const c = el("button", { class: "chip", text: s });
    c.addEventListener("click", () => { ta.value = s; sendMsg(); });
    suggest.append(c);
  }

  async function sendMsg() {
    const text = ta.value.trim();
    if (!text || S.streaming) return;
    ta.value = ""; ta.style.height = "auto";
    push("user", text);
    S.history.push({ role: "user", content: text });
    await runAgent();
  }
  send.addEventListener("click", sendMsg);
  ta.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMsg(); } });
  ta.addEventListener("input", () => { ta.style.height = "auto"; ta.style.height = Math.min(148, ta.scrollHeight) + "px"; });

  /* ------------------------------- voice -------------------------------- */
  mic.addEventListener("click", () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return toast("Voice input unavailable", "This browser has no Web Speech API (Chrome/Edge do).", { icon: "🎙" });
    const rec = new SR();
    rec.lang = "en-US"; rec.interimResults = true; rec.continuous = false;
    rec.onstart = () => { S.listening = true; mic.classList.add("rec"); toast("Listening…", "Speak now — JARVIS is transcribing.", { icon: "🎙", ms: 1800 }); };
    rec.onresult = (e) => { ta.value = [...e.results].map((r) => r[0].transcript).join(" "); };
    rec.onend = () => { S.listening = false; mic.classList.remove("rec"); if (ta.value.trim()) sendMsg(); };
    rec.onerror = (e) => { toast("Voice error", e.error, { icon: "⚠" }); mic.classList.remove("rec"); };
    try { rec.start(); } catch (e) { toast("Mic blocked", String(e.message || e), { icon: "⚠" }); }
  });
  function speak(text) {
    if (!S.speaking || !window.speechSynthesis) return;
    try {
      const u = new SpeechSynthesisUtterance(String(text).replace(/```[\s\S]*?```/g, " code block ").slice(0, 500));
      u.rate = 1.04; u.pitch = 0.95;
      const v = speechSynthesis.getVoices().find((x) => /Daniel|Google UK English Male|Microsoft David|Alex/.test(x.name)) || speechSynthesis.getVoices()[0];
      if (v) u.voice = v;
      $("#aiOrb")?.classList.add("speaking");
      u.onend = () => $("#aiOrb")?.classList.remove("speaking");
      speechSynthesis.speak(u);
    } catch {}
  }

  /* --------------------------- the agent loop ---------------------------- */
  async function runAgent() {
    S.streaming = true; S.toolsUsed = [];
    const key = store.get("ai.groqKey", "");
    if (!key) { const t = offlinePlan(S.history.at(-1)?.content || ""); push("assistant", t); S.history.push({ role: "assistant", content: t }); S.streaming = false; speak(t); return; }

    const { row, bub } = push("assistant", "");
    const spin = el("span", { class: "term-spin", style: { marginRight: "8px" } });
    bub.prepend(spin);
    let acc = "";
    try {
      for (let hop = 0; hop < 6; hop++) {
        const payload = {
          model: store.get("ai.model", MODELS[0].id),
          messages: [{ role: "system", content: SYSTEM_PROMPT }, ...S.history.map((m) => m.role === "tool" ? m : m),
            ...(hop === 0 ? [] : [{ role: "user", content: "Continue. Use tools if needed, then answer the user." }])],
          tools: TOOLS, tool_choice: "auto", temperature: 0.45, max_tokens: 1400, stream: true,
        };
        const res = await fetch(GROQ_URL, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + key }, body: JSON.stringify(payload) });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error?.message || `HTTP ${res.status}`);
        }
        const { text, toolCalls } = await streamGroq(res, (chunk) => { bub.innerHTML = renderRich(acc + chunk); body.scrollTop = body.scrollHeight; });
        acc += text;
        if (toolCalls.length) {
          spin.remove();
          bub.innerHTML = renderRich(acc || "Working…");
          S.history.push({ role: "assistant", content: acc || null, tool_calls: toolCalls });
          for (const tc of toolCalls) {
            let parsed = {};
            try { parsed = JSON.parse(tc.function.arguments || "{}"); } catch {}
            const result = await callTool(tc.function.name, parsed);
            toolLine(tc.function.name, parsed, result);
            S.history.push({ role: "tool", tool_call_id: tc.id, name: tc.function.name, content: String(result).slice(0, 6000) });
          }
          bub.innerHTML = "";
          bub.append(spin);
          acc = "";
          continue;
        }
        bub.innerHTML = renderRich(acc);
        break;
      }
      S.history.push({ role: "assistant", content: acc });
      store.set("ai.history", S.history.slice(-30));
      speak(acc);
      if (S.toolsUsed.length) toast("JARVIS", `Executed ${S.toolsUsed.length} OS action(s): ${[...new Set(S.toolsUsed)].join(", ")}`, { icon: "✦" });
    } catch (e) {
      bub.innerHTML = renderRich(acc + `\n\n⚠ ${e.message}\n\nFalling back to offline reasoning:\n\n${offlinePlan(S.history.at(-1)?.content || "")}`);
    } finally { S.streaming = false; }
  }

  async function streamGroq(res, onDelta) {
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "", text = "", calls = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop();
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (data === "[DONE]") continue;
        try {
          const j = JSON.parse(data);
          const d = j.choices?.[0]?.delta;
          if (!d) continue;
          if (d.content) { text += d.content; onDelta(text); }
          for (const tc of d.tool_calls || []) {
            const i = tc.index ?? 0;
            calls[i] = calls[i] || { id: tc.id || "call_" + i, type: "function", function: { name: "", arguments: "" } };
            if (tc.id) calls[i].id = tc.id;
            if (tc.function?.name) calls[i].function.name += tc.function.name;
            if (tc.function?.arguments) calls[i].function.arguments += tc.function.arguments;
          }
        } catch {}
      }
    }
    return { text, toolCalls: calls.filter(Boolean) };
  }

  function offlinePlan(q) {
    const s = q.toLowerCase();
    if (/scan|secure|shield|harden|audit/.test(s)) return "Running a THADD Shield audit…\n\n" +
      "• CIS Debian benchmark: 1238/1241 controls pass\n• CVEs: 0 critical, 0 high (3 medium, patched)\n• Listening ports: 22 (sshd), 3389 (xrdp), 8443 (portal) — all expected\n• Rootkit scan: clean · SUID anomalies: 0\n• Firewall: default-deny, geoip blocked CN/RU/KP, 14 lifetime bans\n\nHardening score 98/100 (A+). I can dig into any single finding — say the word.";
    if (/file|folder|organis|tidy|download|document|create|write/.test(s)) return "Here's what I can do right now with your files (I have full read/write access):\n\n" +
      "• ~/Documents — notes, the THADD OS guide\n• ~/Downloads — contains thadd-os-2.0.iso (2.9 GB)\n• ~/thadd-os — the ISO pipeline (tools/build-iso.sh, os/config, Makefile)\n\nAdd your Groq API key (⚙ in the JARVIS header) and I'll actually execute multi-step file work with live model reasoning instead of this canned plan.";
    if (/iso|virtualbox|vm|boot|install/.test(s)) return "To boot THADD OS in VirtualBox:\n\n1. Build: `thadd iso build` (10 stages, ~12 min) or download from Releases.\n2. New VM → Linux/Debian 64-bit → 2048 MB RAM, 2 CPUs, 25 GB VDI.\n3. Settings → System → enable EFI; Display → VMSVGA, 128 MB VRAM, 3D on.\n4. Attach thadd-os-2.0.iso, boot, pick “THADD OS Live” or “Install”.\n5. Login thadd/thadd, then run `thadd doctor` inside the OS.\n\nWould you like me to open the ISO guide window?";
    if (/hello|hi|hey|jarvis/.test(s)) return "JARVIS online. I have full OS access: files, terminal (180+ commands), apps, Shield security, and the Parrot arsenal. Ask me to *do* something rather than describe it — e.g. “create a recon script and run nmap”.";
    return "I'm in offline reasoning mode (no Groq key set). Add your key via the ⚙ button and I'll answer that with llama-3.3-70b-versatile while using real OS tools.\n\nIn the meantime I can still: run any terminal command, list/read/write files, launch apps, change settings and run security scans — the tool layer works without the model.";
  }

  if (args.prompt) { ta.value = args.prompt; setTimeout(sendMsg, 240); }
  win._onArgs = (a2) => { if (a2 && a2.prompt) { ta.value = a2.prompt; sendMsg(); } };
  win._runCommand = null; // JARVIS itself is not a terminal

  return wrap;
}
