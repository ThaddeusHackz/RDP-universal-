/* =============================================================================
 * THADD OS 2.0 — native.js
 * The line between the shell and the actual machine.
 *
 * When the shell is served by `thadd-desktop-server` (the live ISO, or a dev
 * preview started with THADD_DEV=1), a tiny localhost bridge answers on
 * /bridge/ping. If it does, the shell stops being a simulation: a dock of real
 * applications appears (xfce4-terminal, Thunar, Firefox, Wireshark, Metasploit,
 * the THADD doctor …) and every launch is an actual fork+exec on the host.
 *
 * In a plain browser the probe fails in ~1 s and nothing changes — the whole
 * web preview stays byte-for-byte the same experience.
 * ========================================================================== */

import { el, bus, store, toast } from "./core.js";
import { APPS, BY_ID } from "./registry.js";

const BRIDGE = "/bridge";
let state = { on: false, checked: false, apps: [], host: "", kernel: "" };
const pending = [];

/* Every native launcher is a normal registry entry, so Spotlight, Launchpad,
   search and the dock all pick it up with no special-casing anywhere else.
   The "host:" prefix is what apps/index.js routes to the bridge. */
const CATALOGUE = {
  terminal: { name: "Native Terminal", icon: "⌨", cat: "System", cls: "native", desc: "Real shell on this machine — xfce4-terminal" },
  files: { name: "Native Files", icon: "🗂", cat: "System", cls: "native", desc: "Real filesystem — Thunar" },
  monitor: { name: "Native Task Manager", icon: "📈", cat: "System", cls: "native", desc: "Real processes — xfce4-taskmanager" },
  browser: { name: "Native Firefox", icon: "🦊", cat: "Internet", cls: "native", desc: "Firefox ESR on the host, not a tab" },
  chromium: { name: "Native Chromium", icon: "🌐", cat: "Internet", cls: "native", desc: "Chromium with the host's real GPU" },
  editor: { name: "Native Editor", icon: "📝", cat: "Developer", cls: "native", desc: "Mousepad — edit real files" },
  wireshark: { name: "Wireshark (live)", icon: "🦈", cat: "Security", cls: "native", desc: "Capture on this machine's interfaces" },
  burp: { name: "Burp Suite (live)", icon: "🕸", cat: "Security", cls: "native", desc: "Intercept real traffic" },
  msfconsole: { name: "Metasploit (live)", icon: "🎯", cat: "Security", cls: "native", desc: "msfconsole in a real terminal" },
  doctor: { name: "THADD Doctor (host)", icon: "🩺", cat: "System", cls: "native", desc: "Run thadd doctor against the real system" },
  jarvis: { name: "JARVIS CLI (host)", icon: "🤖", cat: "AI", cls: "native", desc: "Terminal JARVIS with host file access" },
  iso: { name: "Rebuild this ISO", icon: "💿", cat: "Developer", cls: "native", desc: "Build a THADD OS ISO from /opt/thadd" },
  xfce: { name: "Leave the Shell", icon: "🚪", cat: "System", cls: "native", desc: "Hand the seat to plain XFCE (or return with Ctrl+Alt+F2)" },
};

export const native = {
  get on() { return state.on; },
  get apps() { return state.apps.slice(); },
  get host() { return state.host; },
  open,
  launchInto,
};

/* ------------------------------------------------------------------ probe -- */
export async function probe(timeout = 1200) {
  if (state.checked) return state.on;
  if (typeof fetch !== "function") { state.checked = true; return false; }   // headless test env
  state.checked = true;
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeout);
  try {
    const res = await fetch(BRIDGE + "/ping", { signal: ctl.signal, cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const info = await res.json();
    if (!info || info.native !== true) throw new Error("not a native session");
    state = { on: true, checked: true, apps: info.apps || [], host: info.host || "", kernel: info.kernel || "" };
    install();
    return true;
  } catch {
    state = { on: false, checked: true, apps: [], host: "", kernel: "" };
    return false;
  } finally { clearTimeout(t); }
}

/* --------------------------------------------------------------- launching -- */
export async function open(app) {
  try {
    const res = await fetch(BRIDGE + "/open", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ app }),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok || !out.ok) {
      const why = out.error || ("HTTP " + res.status);
      toast(`Could not start the native app — ${why}`, "bug");
      return false;
    }
    if (out.left) { toast("Leaving the THADD Shell — XFCE is taking over…", "door"); return true; }
    toast(`Started ${app} on this machine`, "terminal");
    return true;
  } catch (e) {
    toast(`Bridge unreachable: ${e.message}`, "bug");
    return false;
  }
}

/* Map a shell app id onto the closest native equivalent, so "Open in native"
   can be offered from any app window without a second table to maintain. */
const NATIVE_FOR = {
  terminal: "terminal", finder: "files", "browser": "browser",
  "browser-chrome": "chromium", monitor: "monitor", editor: "editor",
  parrot: "msfconsole", packetlab: "wireshark", shield: "doctor",
  jarvis: "jarvis", copilot: "jarvis", "ai-lab": "jarvis",
};

export function launchInto(appId) {
  if (!state.on) return false;
  const target = NATIVE_FOR[appId] || appId.replace(/^host:/, "");
  if (!state.apps.length || state.apps.includes(target)) { open(target); return true; }
  return false;
}

/* ---------------------------------------------------------------- install -- */
function install() {
  const dock = store.get("dock", null);
  const want = state.apps.length
    ? Object.keys(CATALOGUE).filter((k) => state.apps.includes(k))
    : Object.keys(CATALOGUE);
  if (!want.length) return;

  // 1. register the launchers as first-class apps
  for (const key of want) {
    const meta = CATALOGUE[key];
    const id = "host:" + key;
    if (BY_ID[id]) continue;
    const entry = { id, name: meta.name, icon: meta.icon, cat: meta.cat, cls: meta.cls, desc: meta.desc, native: true, key };
    if (!APPS.some((a) => a.id === id)) APPS.push(entry);
    BY_ID[id] = entry;
    pending.push(id);
  }

  // 2. put the most useful ones in the dock, just after Terminal
  if (Array.isArray(dock)) {
    const tileIds = pending.filter((id) => ["host:terminal", "host:files", "host:monitor"].includes(id));
    const missing = tileIds.filter((id) => !dock.includes(id));
    if (missing.length) {
      const at = dock.indexOf("finder") + 1 || dock.length;
      store.set("dock", [...dock.slice(0, at), ...missing, ...dock.slice(at)]);
    }
  }

  // 3. a badge in the menubar tray + a toast that explains what just happened
  const tray = document.querySelector("#mbTray");
  if (tray && !tray.querySelector(".native-chip")) {
    const chip = el("div", { class: "native-chip", title: `THADD Shell is running natively on ${state.host || "this machine"} — dock tiles with a ◆ ring start real applications` },
      el("span", { class: "dot" }), el("span", { text: "NATIVE" }));
    chip.addEventListener("click", () => open("xfce"));
    chip.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      toast(`${state.host || "host"} · ${state.kernel || ""} · ${state.apps.length} native apps bridged`, "cpu");
    });
    tray.prepend(chip);
  }

  bus.emit("native-ready", { apps: state.apps, host: state.host });
  toast(`Native session detected on ${state.host || "this machine"} — ${pending.length} real applications unlocked`, "plug");
}
