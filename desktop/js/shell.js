/* =============================================================================
 * THADD OS 2.0 — shell.js
 * Menu bar (Apple menu + app menus), system tray, Control Centre,
 * Notification Centre, Dock with magnification + running dots, Launchpad,
 * Spotlight/Windows-Search, desktop icons, snap previews.
 * ========================================================================== */

import { $, $$, el, bus, store, toast, contextMenu, toggleFlyout, clock, clock12, longDate,
         shortDate, uptime, fmtDur, copy, vfs } from "./core.js";
import { APPS, BY_ID, DOCK_DEFAULT } from "./registry.js";
import { launch, runningApps, appOpen } from "./apps/index.js";
import { windows, restore, focus, toggleMission, cycleWindows } from "./wm.js";
import { WALLPAPERS } from "./registry.js";

/* ═══════════════════════════════ MENU BAR ═══════════════════════════════ */
const APPLE_SVG = `<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16.36 12.79c.02 2.6 2.28 3.46 2.31 3.47-.02.06-.36 1.24-1.2 2.45-.72 1.05-1.47 2.1-2.65 2.12-1.16.02-1.53-.69-2.86-.69-1.32 0-1.74.67-2.83.71-1.14.04-2.01-1.13-2.74-2.18-1.5-2.17-2.64-6.13-1.1-8.8.76-1.32 2.12-2.16 3.6-2.18 1.12-.02 2.17.75 2.86.75.68 0 1.97-.93 3.32-.79.56.02 2.15.2 3.17 1.55-.08.05-1.9 1.11-1.88 3.59M14.2 5.6c.6-.73 1.01-1.75.9-2.76-.87.04-1.93.58-2.55 1.31-.56.64-1.05 1.68-.92 2.67.97.08 1.96-.49 2.57-1.22"/></svg>`;

const MENUS = {
  apple: [
    { label: "About This Mac", action: () => launch("about", { tab: "system" }) },
    "-",
    { label: "System Settings…", key: "⌘,", action: () => launch("settings") },
    { label: "App Store…", action: () => launch("store") },
    "-",
    { label: "Recent Items", disabled: true },
    "-",
    { label: "Force Quit…", key: "⌥⌘⎋", action: () => launch("monitor", { tab: "tasks" }) },
    "-",
    { label: "Sleep", action: () => sleepMode() },
    { label: "Restart…", action: () => reboot() },
    { label: "Shut Down…", action: () => shutdown() },
    { label: "Lock Screen", key: "⌃⌘Q", action: () => lockScreen() },
    { label: "Log Out thadd…", key: "⇧⌘Q", action: () => logout() },
  ],
  file: [
    { label: "New Finder Window", key: "⌘N", action: () => launch("finder", { path: "/home/" + store.get("user", "thadd") }) },
    { label: "New Terminal at Home", key: "⌃⌥T", action: () => launch("terminal") },
    { label: "New Code Studio Window", action: () => launch("editor") },
    "-",
    { label: "Close Window", key: "⌘W", action: () => closeFocused() },
    { label: "Print…", key: "⌘P", action: () => toast("Print queue", "No printers configured — run: thadd printer add", { icon: "🖨" }) },
  ],
  edit: [
    { label: "Undo", key: "⌘Z", action: () => document.execCommand?.("undo") },
    { label: "Redo", key: "⇧⌘Z", action: () => document.execCommand?.("redo") },
    "-",
    { label: "Cut", key: "⌘X" }, { label: "Copy", key: "⌘C" }, { label: "Paste", key: "⌘V" },
    { label: "Select All", key: "⌘A" },
    "-",
    { label: "Copy Desktop Screenshot", action: () => { import("./apps/screenshot.js").then((m) => m.grab()); } },
  ],
  view: [
    { label: "Enter Full Screen", key: "^⌘F", action: () => document.documentElement.requestFullscreen?.().catch(() => {}) },
    { label: "Mission Control", key: "⌃↑", action: () => toggleMission() },
    "-",
    { label: "Toggle Light Appearance", action: () => setAppearance(document.documentElement.dataset.appearance === "light" ? "dark" : "light") },
    { label: "Toggle Liquid Glass", action: () => { document.body.classList.toggle("no-glass"); store.set("noGlass", document.body.classList.contains("no-glass")); } },
    { label: "Next Wallpaper", action: () => nextWallpaper() },
    "-",
    { label: "Toggle Dock", key: "⌥⌘D", action: () => $("#dock").classList.toggle("hidden") },
  ],
  go: [
    { label: "Home", key: "⇧⌘H", action: () => launch("finder", { path: "/home/" + store.get("user", "thadd") }) },
    { label: "Documents", action: () => launch("finder", { path: "/home/" + store.get("user", "thadd") + "/Documents" }) },
    { label: "Downloads", action: () => launch("finder", { path: "/home/" + store.get("user", "thadd") + "/Downloads" }) },
    "-",
    { label: "Root", key: "⇧⌘/", action: () => launch("finder", { path: "/" }) },
    { label: "Utilities", action: () => launch("launchpad") },
    "-",
    { label: "Launchpad", action: () => launch("launchpad") },
    { label: "Spotlight", key: "⌘K", action: () => openSpotlight() },
  ],
  window: [
    { label: "Minimise", key: "⌘M", action: () => focusedWin()?.minimise() },
    { label: "Zoom", action: () => focusedWin()?.zoom() },
    { label: "Cycle Windows", key: "⌘`", action: () => cycleWindows() },
    "-",
    { label: "Snap Left", action: () => focusedWinEl() && import("./wm.js").then((m) => m.snapTo(focusedWinEl(), "left")) },
    { label: "Snap Right", action: () => focusedWinEl() && import("./wm.js").then((m) => m.snapTo(focusedWinEl(), "right")) },
    { label: "Tile All", action: () => tileAll() },
    "-",
    { label: "Mission Control", key: "⌃↑", action: () => toggleMission() },
    { label: "Bring All to Front", action: () => [...windows.values()].forEach((w) => { w._state.min = false; w.classList.remove("min"); }) },
  ],
  help: [
    { label: "THADD OS Guide", action: () => launch("guide") },
    { label: "Parrot Arsenal Help", action: () => launch("parrot") },
    { label: "Ask JARVIS", key: "⌘J", action: () => launch("jarvis") },
    "-",
    { label: "Report an Issue", action: () => open_("https://github.com/ThaddeusHackz/RDP-universal-/issues") },
    { label: "Releases / Download ISO", action: () => open_("https://github.com/ThaddeusHackz/RDP-universal-/releases") },
  ],
};

let currentAppName = "Finder";
let openMenu = null;

export function buildMenuBar() {
  $("#mbApple").innerHTML = APPLE_SVG;
  $$("#menubar [data-menu]").forEach((mi) => {
    mi.addEventListener("click", (e) => { e.stopPropagation(); showMenu(mi.dataset.menu, mi); });
    mi.addEventListener("mouseenter", () => { if (openMenu) showMenu(mi.dataset.menu, mi); });
  });
  document.addEventListener("click", () => hideMenu());
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") hideMenu(); });
  buildTray();
  tickClock(); setInterval(tickClock, 1000 * 10);
  bus.on("win-focus", (w) => setAppName(w._menubarName || w.title || "Finder"));
  bus.on("desktop-focus", () => setAppName("Finder"));
}

function showMenu(name, anchor) {
  hideMenu();
  const m = el("div", { class: "mb-menu", style: { left: anchor.getBoundingClientRect().left + "px" } });
  for (const r of MENUS[name] || []) {
    if (r === "-") { m.append(el("div", { class: "mb-sep" })); continue; }
    const row = el("div", { class: `mb-row${r.disabled ? " disabled" : ""}` },
      el("span", { class: "ic", text: r.icon || "" }), el("span", { text: r.label }),
      r.key ? el("span", { class: "mb-key", text: r.key }) : null);
    row.addEventListener("click", () => { hideMenu(); r.action?.(); });
    m.append(row);
  }
  $("#menus").append(m);
  anchor.classList.add("open");
  openMenu = { name, node: m, anchor };
  const r = m.getBoundingClientRect();
  if (r.right > innerWidth - 6) m.style.left = (innerWidth - r.width - 6) + "px";
}
function hideMenu() {
  if (!openMenu) return;
  openMenu.node.remove(); openMenu.anchor.classList.remove("open"); openMenu = null;
}
function setAppName(n) { currentAppName = n; $("#mbAppName").textContent = n; }
export const activeAppName = () => currentAppName;
const focusedWin = () => [...windows.values()].find((w) => w.classList.contains("focused") && !w._state.min);
const focusedWinEl = () => focusedWin();

function tickClock() {
  const d = new Date();
  $("#mbClock").textContent = `${shortDate(d)} ${clock(d)}`;
  const lt = $("#lockTime"); if (lt) lt.textContent = clock(d);
  const ld = $("#lockDate"); if (ld) ld.textContent = longDate(d);
}

/* ═════════════════════════════ SYSTEM TRAY ═════════════════════════════ */
function buildTray() {
  const tray = $("#mbTray");
  tray.innerHTML = "";
  const icons = {
    wifi: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12.5a10 10 0 0114 0M8 15.5a6 6 0 018 0M12 19h.01"/></svg>`,
    shield: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l7 3v6c0 5-3 8-7 9-4-1-7-4-7-9V6z"/><path d="M9 12l2 2 4-4"/></svg>`,
    ai: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l2.2 5.6L20 11l-5.8 2.4L12 19l-2.2-5.6L4 11l5.8-2.4z"/></svg>`,
    vol: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5L6 9H3v6h3l5 4z"/><path d="M16 9a4 4 0 010 6"/></svg>`,
    bat: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="8" width="17" height="8" rx="2"/><path d="M22 11v2"/></svg>`,
  };
  const mk = (k, title, on) => {
    const b = el("button", { class: "ticon" + (on ? " on" : ""), title, html: icons[k] });
    b.addEventListener("click", (e) => { e.stopPropagation(); openControlCenter(b); });
    return b;
  };
  tray.append(mk("shield", "THADD Shield: STRICT", true), mk("ai", "JARVIS: listening", true), mk("wifi", "Network: THADD-DNS", false), mk("vol", "Sound output", false));
  const bat = el("button", { class: "mb-battery", title: "Battery: 98% · AC power" }, el("span", { html: icons.bat }), el("span", { text: "98%" }));
  bat.addEventListener("click", (e) => { e.stopPropagation(); openControlCenter(bat); });
  tray.append(bat);

  $("#mbShield").addEventListener("click", (e) => { e.stopPropagation(); launch("shield"); });
  $("#mbAI").addEventListener("click", (e) => { e.stopPropagation(); launch("jarvis"); });
  $("#mbClock").addEventListener("click", (e) => { e.stopPropagation(); openNotificationCenter(); });
}

/* ═══════════════════════ CONTROL CENTRE (Fluent tiles) ═══════════════════ */
export function openControlCenter(anchor = $("#mbTray")) {
  toggleFlyout("controlCenter", anchor, () => {
    const wrap = el("div", { style: { width: "342px" } });
    wrap.append(el("div", { class: "fly-sec", text: "Control Centre" }));
    const grid = el("div", { class: "fly-grid" });
    const tiles = [
      { k: "wifi", on: true, icon: "📶", t: "THADD-DNS", s: "Encrypted · 5 GHz" },
      { k: "bt", on: false, icon: "🔵", t: "Bluetooth", s: "Off" },
      { k: "shield", on: store.get("shield.strict", true), icon: "🛡", t: "THADD Shield", s: "Strict mode" },
      { k: "airdrop", on: true, icon: "📡", t: "Nearby Share", s: "Contacts only" },
      { k: "focus", on: false, icon: "🌙", t: "Focus", s: "Off" },
      { k: "vpn", on: false, icon: "🌍", t: "VPN", s: "Disconnected" },
      { k: "dnd", on: false, icon: "🔕", t: "Do Not Disturb", s: "Off" },
      { k: "stage", on: false, icon: "🎭", t: "Stage Manager", s: "Off" },
    ];
    for (const t of tiles) {
      const tile = el("button", { class: "fly-tile" + (t.on ? " on" : "") },
        el("span", { class: "tb", text: t.icon }),
        el("span", {}, el("div", { class: "tx", text: t.t }), el("div", { class: "ts", text: t.s })));
      tile.addEventListener("click", () => {
        t.on = !t.on; tile.classList.toggle("on", t.on);
        t.s = t.on ? (t.k === "shield" ? "Strict mode" : "On") : (t.k === "bt" ? "Off" : "Off");
        $(".ts", tile).textContent = t.s;
        if (t.k === "shield") store.set("shield.strict", t.on);
      });
      grid.append(tile);
    }
    wrap.append(grid);

    wrap.append(el("div", { class: "fly-sec", text: "Display & Sound" }));
    for (const [label, icon, val, act] of [
      ["Brightness", "☀", store.get("bright", 100), (v) => { store.set("bright", v); document.documentElement.style.filter = `brightness(${0.55 + v / 222})`; }],
      ["Volume", "🔊", store.get("vol", 62), (v) => store.set("vol", v)],
      ["Appearance", "🌗", null, null],
    ]) {
      if (label === "Appearance") {
        const row = el("div", { class: "fly-slider" });
        row.append(el("span", { text: "🌗" }));
        const seg = el("div", { style: { display: "flex", gap: "8px", flex: "1" } });
        for (const [id, nm] of [["dark", "Dark"], ["light", "Light"]]) {
          const b = el("button", { class: "chip" + (document.documentElement.dataset.appearance === id ? " on" : ""), text: nm });
          b.addEventListener("click", () => { setAppearance(id); $$(".chip", seg).forEach((c) => c.classList.remove("on")); b.classList.add("on"); });
          seg.append(b);
        }
        row.append(seg);
        wrap.append(row);
        continue;
      }
      const r = el("div", { class: "fly-slider" });
      const inp = el("input", { type: "range", min: "5", max: "100", value: String(val) });
      inp.style.setProperty("--v", val + "%");
      inp.addEventListener("input", () => { inp.style.setProperty("--v", inp.value + "%"); act(+inp.value); });
      r.append(el("span", { text: icon }), inp);
      wrap.append(r);
    }

    wrap.append(el("div", { class: "fly-sec", text: "Quick Actions" }));
    const qa = el("div", { class: "fly-grid" });
    for (const [icon, t, fn] of [
      ["📸", "Screenshot", () => import("./apps/screenshot.js").then((m) => m.grab())],
      ["🧹", "Clean RAM", () => { toast("Memory cleaned", "Dropped 812 MB of page cache (simulated)", { icon: "🧹" }); }],
      ["🔒", "Lock Now", () => lockScreen()],
      ["🖥", "Mission Control", () => toggleMission()],
    ]) {
      const b = el("button", { class: "fly-tile" }, el("span", { class: "tb", text: icon }), el("span", {}, el("div", { class: "tx", text: t })));
      b.addEventListener("click", fn); qa.append(b);
    }
    wrap.append(qa);
    return wrap;
  });
}

/* ═══════════════════ NOTIFICATION CENTRE + WIDGETS (Win11 + macOS) ════════ */
export function openNotificationCenter() {
  toggleFlyout("notifCenter", $("#mbClock"), () => {
    const w = el("div", { style: { width: "352px", maxHeight: "74vh", overflow: "auto" } });
    w.append(el("div", { class: "fly-sec", text: "Widgets" }));
    const today = el("div", { class: "st-card" });
    today.append(el("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "baseline" } },
      el("div", {}, el("div", { style: { fontSize: "20px", fontWeight: "700" }, text: clock(new Date()) }),
        el("div", { class: "mute", style: { fontSize: "12px" }, text: longDate() })),
      el("div", { class: "mono", style: { fontSize: "11.5px" }, text: `up ${fmtDur(uptime())}` })));
    today.append(el("div", { class: "fly-sec", style: { paddingTop: "12px" }, text: "Accra, GH · 31°C Mostly Clear" }));
    today.append(el("div", { class: "stats", style: { gridTemplateColumns: "repeat(3,1fr)", gap: "8px" } },
      el("div", {}, el("div", { class: "k", text: "CPU" }), el("div", { class: "v", style: { fontSize: "17px" }, text: "4%" })),
      el("div", {}, el("div", { class: "k", text: "RAM" }), el("div", { class: "v", style: { fontSize: "17px" }, text: "312MB" })),
      el("div", {}, el("div", { class: "k", text: "Net" }), el("div", { class: "v", style: { fontSize: "17px" }, text: "12Mb" }))));
    w.append(today);

    w.append(el("div", { class: "fly-sec", text: "Notifications" }));
    const notes = store.get("notifs", []);
    if (!notes.length) w.append(el("div", { style: { padding: "12px" } }, el("div", { class: "mute", text: "No new notifications." })));
    for (const n of notes.slice(-8).reverse()) {
      const c = el("div", { class: "st-card", style: { padding: "10px 12px" } },
        el("div", { style: { display: "flex", gap: "9px" } },
          el("span", { text: n.icon || "✦" }),
          el("div", {}, el("div", { style: { fontSize: "12.6px", fontWeight: "650" }, text: n.title }),
            el("div", { class: "mute", style: { fontSize: "11.6px" }, text: n.msg || "" }))));
      w.append(c);
    }
    const clear = el("button", { class: "btn", style: { width: "100%", marginTop: "10px" }, text: "Clear all notifications" });
    clear.addEventListener("click", () => { store.set("notifs", []); toast("Notifications cleared"); openNotificationCenter(); $("#notifCenter")?.classList.add("hidden"); });
    w.append(clear);
    return w;
  });
}

/* ═════════════════════════════════ DOCK ════════════════════════════════ */
export function buildDock() {
  render();
  bus.on("win-open", render);
  bus.on("win-close", render);
  bus.on("win-min", render);
  bus.on("win-focus", render);
  bus.on("finders-custom", render);
  setInterval(render, 1200);
}
function render() {
  const dock = $("#dock");
  const items = store.get("dock", DOCK_DEFAULT);
  const running = runningApps();
  dock.innerHTML = "";
  for (const id of items) {
    if (id === "__sep") { dock.append(el("div", { class: "dock-sep" })); continue; }
    const app = BY_ID[id] || { id, name: id, icon: "▢", cls: "" };
    const d = el("div", { class: "dock-item" + (running.includes(id) ? " running" : ""), "data-app": id },
      el("span", { class: "glyph" }, el("span", { class: "appicon " + (app.cls || ""), text: app.icon })),
      el("span", { class: "dot" }),
      el("span", { class: "dock-tip", text: app.name }));
    d.addEventListener("click", () => {
      const wins = [...windows.values()].filter((w) => w._app === id);
      if (!wins.length) { launch(id); d.classList.add("bounce"); setTimeout(() => d.classList.remove("bounce"), 1300); return; }
      const front = wins.sort((a, b) => b.style.zIndex - a.style.zIndex)[0];
      if (front._state.min) restore(front);
      else if (front.classList.contains("focused")) { const nxt = wins.sort((a, b) => a.style.zIndex - b.style.zIndex)[1]; minimiseOrCycle(wins, front, nxt); }
      else focus(front);
    });
    d.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      contextMenu(e.clientX, e.clientY - 60, [
        { label: `New ${app.name} Window`, icon: "＋", action: () => launch(id) },
        { label: "Show All Windows", icon: "🗂", action: () => { [...windows.values()].filter((w) => w._app === id).forEach((w) => { w._state.min = false; w.classList.remove("min"); focus(w); }); } },
        "-",
        { label: "Options: Keep in Dock", disabled: true },
        { label: "Quit " + app.name, icon: "⏻", action: () => import("./wm.js").then((m) => m.closeApp(id)) },
      ]);
    });
    dock.append(d);
  }
}
function minimiseOrCycle(wins, front, nxt) { nxt ? focus(nxt) : import("./wm.js").then((m) => m.minimise(front)); }

/* ══════════════════════════════════ LAUNCHPAD ══════════════════════════ */
export function openLaunchpad() {
  const m = el("div", { id: "mission", class: "open" });
  const grid = el("div", { id: "missionGrid", style: { gridTemplateColumns: "repeat(auto-fill, minmax(148px,1fr))", paddingTop: "70px" } });
  const q = el("input", { class: "tb-input", placeholder: "Search apps…", style: { maxWidth: "440px", margin: "0 auto 8px", display: "block", gridColumn: "1/-1", padding: "12px 16px", fontSize: "15px" } });
  grid.append(q);
  const cards = [];
  for (const a of APPS) {
    const c = el("div", { class: "mission-card", style: { padding: "16px 10px", textAlign: "center", cursor: "pointer" } },
      el("div", { style: { fontSize: "40px", lineHeight: "1.1" }, text: a.icon }),
      el("div", { style: { fontSize: "12.4px", fontWeight: "600", marginTop: "8px" }, text: a.name }),
      el("div", { class: "mute", style: { fontSize: "10.6px", marginTop: "3px" }, text: a.cat }));
    c.addEventListener("click", () => { m.remove(); launch(a.id); });
    cards.push({ a, c }); grid.append(c);
  }
  q.addEventListener("input", () => {
    const v = q.value.toLowerCase();
    cards.forEach(({ a, c }) => { c.style.display = (a.name + a.desc + a.cat).toLowerCase().includes(v) ? "" : "none"; });
  });
  m.append(grid);
  m.addEventListener("click", (e) => { if (e.target === m) m.remove(); });
  document.addEventListener("keydown", function esc(ev) { if (ev.key === "Escape") { m.remove(); document.removeEventListener("keydown", esc); } });
  document.body.append(m);
  setTimeout(() => q.focus(), 40);
}

/* ═══════════════════════════════ SPOTLIGHT ═════════════════════════════ */
let spotSel = 0, spotRows = [];
export function openSpotlight(prefill = "") {
  const s = $("#spotlight");
  s.classList.add("open");
  const inp = $("#spotInput");
  if (prefill) inp.value = prefill;
  renderSpot(inp.value);
  inp.oninput = () => renderSpot(inp.value);
  inp.onkeydown = (e) => {
    if (e.key === "ArrowDown") { spotSel = Math.min(spotSel + 1, spotRows.length - 1); paintSpot(); e.preventDefault(); }
    else if (e.key === "ArrowUp") { spotSel = Math.max(spotSel - 1, 0); paintSpot(); e.preventDefault(); }
    else if (e.key === "Enter") { e.preventDefault(); const r = spotRows[spotSel]; if (r) { closeSpotlight(); if (e.metaKey || (e.shiftKey && e.ctrlKey)) launch("jarvis", { prompt: r.full || inp.value }); else r.action(); } }
    else if (e.key === "Escape") closeSpotlight();
  };
  setTimeout(() => inp.focus(), 30);
}
export function closeSpotlight() { $("#spotlight").classList.remove("open"); }
$("#spotlight")?.addEventListener("click", (e) => { if (e.target.dataset.closeSpot !== undefined) closeSpotlight(); });

function renderSpot(qraw) {
  const q = qraw.trim();
  const host = $("#spotResults");
  host.innerHTML = "";
  spotRows = []; spotSel = 0;
  const add = (section, items) => {
    if (!items.length) return;
    host.append(el("div", { class: "spot-sec", text: section }));
    for (const it of items) { spotRows.push(it); host.append(it.row); }
  };
  const ql = q.toLowerCase();

  if (q) {
    add("AI", [{
      full: q,
      row: el("div", { class: "spot-row" }, el("span", { class: "g", text: "✦" }),
        el("span", { class: "t", text: `Ask JARVIS: “${q.slice(0, 56)}”` }), el("span", { class: "s", text: "⌘⏎" }),
        ),
      action: () => launch("jarvis", { prompt: q }),
    }]);
  }

  const apps = APPS.filter((a) => !ql || (a.name + a.desc + a.cat + a.id).toLowerCase().includes(ql));
  add("Applications", apps.slice(0, q ? 6 : 8).map((a) => ({
    row: el("div", { class: "spot-row" }, el("span", { class: "g", text: a.icon }),
      el("span", {}, el("div", { class: "t", text: a.name }), el("div", { class: "s", style: { marginLeft: 0 }, text: a.desc })),
      el("span", { class: "s", text: a.cat })),
    action: () => launch(a.id),
  })));

  // filesystem search
  if (ql.length > 0) {
    const hits = flattenSearch(ql).slice(0, 8);
    add("Files", hits.map((h) => ({
      row: el("div", { class: "spot-row" }, el("span", { class: "g", text: h.node.type === "dir" ? "📁" : "📄" }),
        el("span", {}, el("div", { class: "t", text: h.node.name }), el("div", { class: "s", style: { marginLeft: 0 }, text: h.path })),
        el("span", { class: "s", text: fsSize(h.node) })),
      action: () => import("./core.js").then((m) => m.openPath(h.path)),
    })));
  }

  // commands
  if (ql.length > 2) {
    const cmds = COMMANDS.filter((c) => c.name.includes(ql) || c.desc.toLowerCase().includes(ql)).slice(0, 5);
    add("Commands", cmds.map((c) => ({
      row: el("div", { class: "spot-row" }, el("span", { class: "g", text: c.icon || "⌘" }),
        el("span", {}, el("div", { class: "t", text: c.name }), el("div", { class: "s", style: { marginLeft: 0 }, text: c.desc }))),
      action: c.run,
    })));
  }

  // web search fallbacks
  if (ql) {
    add("Web", [
      { row: spotRow("🔎", `Search the web for “${q}”`, "DuckDuckGo — opens in Firefox"), action: () => launch("browser", { url: "https://duckduckgo.com/?q=" + encodeURIComponent(q) }) },
      { row: spotRow("🐙", `Search GitHub for “${q}”`, "github.com/search"), action: () => launch("browser", { url: "https://github.com/search?q=" + encodeURIComponent(q) }) },
    ]);
  }
  paintSpot();
}
const spotRow = (g, t, s) => el("div", { class: "spot-row" }, el("span", { class: "g", text: g }),
  el("span", {}, el("div", { class: "t", text: t }), el("div", { class: "s", style: { marginLeft: 0 }, text: s })));
function paintSpot() { $$("#spotResults .spot-row").forEach((r, i) => r.classList.toggle("sel", i === spotSel)); }
function flattenSearch(q) {
  return vfs.flatten().filter((f) => f.node.name.toLowerCase().includes(q)).slice(0, 60);
}
const fsSize = (n) => n.type === "dir" ? `${(n.children || []).length} items` : `${Math.max(1, Math.round(String(n.body || "").length / 1024))} KB`;

/* ══════════════════════════════ COMMANDS ═══════════════════════════════ */
export const COMMANDS = [
  { name: "Lock Screen", desc: "Require password immediately", icon: "🔒", run: lockScreen },
  { name: "Toggle Dark/Light", desc: "Switch appearance", icon: "🌗", run: () => setAppearance(document.documentElement.dataset.appearance === "light" ? "dark" : "light") },
  { name: "Toggle Liquid Glass", desc: "Disable transparency for performance", icon: "🧊", run: () => document.body.classList.toggle("no-glass") },
  { name: "Next Wallpaper", desc: "Cycle the THADD wallpaper pack", icon: "🖼", run: nextWallpaper },
  { name: "Mission Control", desc: "See every open window", icon: "🖥", run: () => toggleMission() },
  { name: "Empty Trash", desc: "Securely erase deleted items", icon: "🗑", run: () => toast("Trash emptied", "2 items shredded with 7-pass DoD 5220.22-M", { icon: "🗑" }) },
  { name: "Build THADD OS ISO", desc: "Run the live-build pipeline", icon: "💿", run: () => launch("terminal", { run: "sudo thadd-iso build --release" }) },
  { name: "Enable Strict Shield", desc: "Maximum hardening profile", icon: "🛡", run: () => { store.set("shield.strict", true); toast("THADD Shield", "Strict mode engaged — 47 hardening rules active", { icon: "🛡" }); } },
  { name: "Run Full System Audit", desc: "CIS benchmark + vulnerability sweep", icon: "🔬", run: () => launch("terminal", { run: "thadd scan --full" }) },
  { name: "Open HackTheBox", desc: "Launch the HTB workspace", icon: "🎯", run: () => launch("hackbox") },
  { name: "Reboot", desc: "Restart THADD OS", icon: "⏻", run: reboot },
  { name: "Sleep", desc: "Suspend to RAM", icon: "😴", run: sleepMode },
  { name: "Screenshot", desc: "Capture the desktop", icon: "📸", run: () => import("./apps/screenshot.js").then((m) => m.grab()) },
];

/* ══════════════════════════ DESKTOP ICONS ══════════════════════════════ */
export function buildDesktopIcons() {
  let host = $("#deskIcons");
  if (!host) { host = el("div", { id: "deskIcons" }); document.body.append(host); }
  host.innerHTML = "";
  Object.assign(host.style, { position: "fixed", top: "40px", right: "14px", zIndex: "10",
    display: "flex", flexDirection: "column", gap: "6px", width: "104px" });
  const icon = (emoji, label, fn) => {
    const d = el("div", { style: { padding: "9px 5px", borderRadius: "10px", textAlign: "center", cursor: "default" } },
      el("div", { style: { fontSize: "34px", lineHeight: "1.1", filter: "drop-shadow(0 3px 8px rgba(0,0,0,.5))" }, text: emoji }),
      el("div", { style: { fontSize: "11.4px", marginTop: "4px", textShadow: "0 1px 3px rgba(0,0,0,.7)" }, text: label }));
    d.addEventListener("dblclick", fn);
    d.addEventListener("click", () => { $$("#deskIcons > div").forEach((x) => (x.style.background = "")); d.style.background = "rgba(10,132,255,.35)"; });
    d.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      contextMenu(e.clientX, e.clientY, [
        { label: "Open", icon: "↗", action: fn },
        { label: "Get Info", icon: "ℹ", action: () => launch("about") },
      ]);
    });
    host.append(d);
  };
  icon("🗂", "thadd-os", () => launch("finder", { path: "/home/" + store.get("user", "thadd") + "/thadd-os" }));
  icon("💿", "thadd-os-2.0.iso", () => launch("guide", { page: "iso" }));
  icon("📖", "THADD Guide", () => launch("guide"));
  icon("✦", "JARVIS", () => launch("jarvis"));
  icon("🦜", "Parrot", () => launch("parrot"));
  host.addEventListener("contextmenu", (e) => {
    if (e.target.closest("#deskIcons > div")) return;
    e.preventDefault();
    contextMenu(e.clientX, e.clientY, [
      { label: "New Folder", icon: "📁", action: () => toast("New Folder", "Created on the desktop (virtual).", { icon: "📁" }) },
      { label: "Change Wallpaper", icon: "🖼", action: nextWallpaper },
      "-",
      { label: "Show Mission Control", action: () => toggleMission() },
      { label: "Open Launchpad", action: () => openLaunchpad() },
      { label: "Ask JARVIS to tidy up", icon: "✦", action: () => launch("jarvis", { prompt: "Tidy up my desktop and summarise what is in my home folder." }) },
    ]);
  });
}

/* ═══════════════════════════════ ACTIONS ═══════════════════════════════ */
export function setAppearance(mode) {
  document.documentElement.dataset.appearance = mode;
  store.set("appearance", mode);
}
export function setWallpaper(id) {
  const w = WALLPAPERS.find((x) => x.id === id) || WALLPAPERS[0];
  document.documentElement.dataset.wallpaper = w.id;
  const wp = $("#wallpaper");
  wp.style.background = w.css || "";
  store.set("wallpaper", id);
}
export function nextWallpaper() {
  const cur = store.get("wallpaper", "sequoia");
  const i = WALLPAPERS.findIndex((w) => w.id === cur);
  setWallpaper(WALLPAPERS[(i + 1) % WALLPAPERS.length].id);
}
export function lockScreen() {
  const l = $("#lock");
  l.classList.remove("gone");
  $("#lockPass").value = "";
  setTimeout(() => $("#lockPass").focus(), 120);
}
export function logout() { location.reload(); }
export function sleepMode() {
  const veil = el("div", { id: "sleeper", style: { position: "fixed", inset: "0", zIndex: "9800", background: "#04050a", display: "grid", placeItems: "center", color: "#4b5563", fontFamily: "var(--font)" } },
    el("div", { style: { textAlign: "center" } },
      el("div", { style: { fontSize: "38px", marginBottom: "12px" }, text: "🌙" }),
      el("div", { text: "THADD OS is suspended. Click anywhere to wake." })));
  document.body.append(veil);
  const wake = () => { veil.remove(); toast("Welcome back", "Resumed from suspend in 0.9s", { icon: "☀" }); };
  veil.addEventListener("click", wake);
  setTimeout(() => document.addEventListener("keydown", wake, { once: true }), 100);
}
export function reboot() {
  bootScreen("Restarting THADD OS…", () => location.reload());
}
export function shutdown() {
  bootScreen("Shutting down…", () => {
    document.body.innerHTML = `<div style="position:fixed;inset:0;background:#04050a;display:grid;place-items:center;color:#4b5563;font:14px system-ui">
      <div style="text-align:center"><div style="font-size:40px;margin-bottom:14px">⏻</div>
      <div>THADD OS has shut down.</div><div style="margin-top:10px;font-size:12px;opacity:.7">It is now safe to close this tab — or refresh to boot again.</div></div></div>`;
  });
}
export function bootScreen(msg, done) {
  const b = $("#boot");
  b.classList.remove("done");
  b.innerHTML = `<div class="boot-logo">TH</div><div class="boot-name">THADD OS</div><div class="boot-sub">${msg}</div><div class="boot-bar"><i style="width:0%"></i></div>`;
  const bar = $(".boot-bar i", b);
  let p = 0;
  const t = setInterval(() => { p = Math.min(100, p + 7 + Math.random() * 12); bar.style.width = p + "%"; if (p >= 100) { clearInterval(t); setTimeout(done, 500); } }, 130);
}
export function tileAll() {
  const list = [...windows.values()].filter((w) => !w._state.min);
  const n = list.length, cols = Math.ceil(Math.sqrt(n)), rows = Math.ceil(n / cols);
  list.forEach((w, i) => {
    const c = i % cols, r = Math.floor(i / cols);
    Object.assign(w.style, {
      left: (c * innerWidth / cols) + "px", top: (30 + r * (innerHeight - 30) / rows) + "px",
      width: (innerWidth / cols) + "px", height: ((innerHeight - 30) / rows) + "px",
    });
    focus(w);
  });
}
function closeFocused() { const w = focusedWin(); if (w) import("./wm.js").then((m) => m.closeWindow(w)); }
function open_(url) { launch("browser", { url }); }
