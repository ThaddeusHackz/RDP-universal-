/* =============================================================================
 * THADD OS 2.0 “Nebula Prime” — kernel.js
 * The session entry point: boot sequence → lock screen → onboarding →
 * live desktop.  Wires the shell, restores preferences, installs global
 * shortcuts and keeps the whole system coherent.
 * ========================================================================== */

import { $, $$, el, bus, store, toast, sleep, uptime, clock12, longDate, vfs } from "./core.js";
import { buildMenuBar, buildDock, buildDesktopIcons, openSpotlight, closeSpotlight, openLaunchpad,
         openControlCenter, openNotificationCenter, setAppearance, setWallpaper, lockScreen, tileAll,
         COMMANDS } from "./shell.js";
import { createWindow, windows, closeWindow, focus, minimise, restore, zoom, fullscreen, closeApp,
         toggleMission, cycleWindows, snapTo } from "./wm.js";
import { launch, runInTerminal } from "./apps/index.js";
import { grab } from "./apps/screenshot.js";

/* ═══════════════════════════ 1 · BOOT SEQUENCE ════════════════════════════ */
const BOOT_LINES = [
  "[    0.000000] THADD OS 2.0 “Nebula Prime” booting…",
  "[    0.041221] Linux version 6.9.7-thadd-hardened (build@thadd) #2 SMP PREEMPT_DYNAMIC",
  "[    0.118004] Command line: BOOT_IMAGE=/boot/vmlinuz-6.9.7-thadd root=UUID=thadd-2.0 quiet splash",
  "[    0.204418] Secure Boot: shim → GRUB → vmlinuz signatures verified ✓",
  "[    0.312905] Spectre/Meltdown mitigations: KPTI on · retpoline on · MDS cleared",
  "[    0.480112] SMEP/SMAP/CET enabled · lockdown=confidentiality",
  "[    0.702338] nvme0n1p1: LUKS2 volume unlocked via TPM2 (argon2id)",
  "[    0.911004] ZFS: importing pool 'thadd' — 2 TB mirror, 6 snapshots",
  "[    1.204881] systemd[1]: Reached target multi-user.target",
  "[    1.338012] thadd-shield[412]: strict profile engaged — 47 rules, 3 syscall filters",
  "[    1.512774] thadd-jarvis[1201]: Groq backend online — llama-3.3-70b-versatile",
  "[    1.704112] AppArmor: 18 profiles enforcing (firefox, code, jarvis, vault…)",
  "[    1.884201] nftables: default-deny inbound · geoip block active",
  "[    2.012884] PipeWire 1.2 ready — 64-sample latency · LDAC available",
  "[    2.240118] THADD Shell 2.0: compositor up · 60 Hz · Sequoia×Fluent surfaces",
  "[    2.418002] Everything is ready. Welcome, Thadd. 🚀",
];

async function boot() {
  const bootEl = $("#boot");
  const bar = $("#bootBar");
  const log = $("#bootLog");
  const fast = sessionStorage.getItem("thadd.fastboot") === "1";
  sessionStorage.setItem("thadd.fastboot", "1");

  if (fast) {          // subsequent views in the same session: shorter boot
    bar.style.width = "100%";
    bootEl.classList.add("done");
    setTimeout(startSession, 320);
    return;
  }
  for (let i = 0; i < BOOT_LINES.length; i++) {
    log.append(el("div", { text: BOOT_LINES[i] }));
    while (log.children.length > 5) log.firstChild.remove();
    bar.style.width = Math.round(((i + 1) / BOOT_LINES.length) * 100) + "%";
    await sleep(120 + Math.random() * 130);
  }
  await sleep(420);
  bootEl.classList.add("done");
  setTimeout(startSession, 520);
}

/* ═══════════════════════════ 2 · SESSION START ════════════════════════════ */
function startSession() {
  restorePreferences();
  buildMenuBar();
  buildDock();
  buildDesktopIcons();
  installShortcuts();
  installGlobalGlue();
  paintTrayStubs();

  const first = !store.get("onboarded", false);
  if (first) {
    $("#onboard").classList.add("open");
    $("#obStart").addEventListener("click", () => {
      const k = $("#obKey").value.trim();
      if (k) { store.set("ai.groqKey", k); toast("Groq key stored", "JARVIS is now running live models.", { icon: "✦" }); }
      store.set("onboarded", true);
      $("#onboard").classList.remove("open");
      welcome();
    });
    $("#obSkip").addEventListener("click", () => { store.set("onboarded", true); $("#onboard").classList.remove("open"); welcome(); });
    $$("#onboard .chip[data-surface]").forEach((c) => c.addEventListener("click", () => {
      $$("#onboard .chip[data-surface]").forEach((x) => x.classList.remove("on"));
      c.classList.add("on");
      store.set("surface", c.dataset.surface);
      if (c.dataset.surface === "windows") { document.documentElement.style.setProperty("--accent", "#0078d4"); }
      if (c.dataset.surface === "parrot") { document.documentElement.style.setProperty("--accent", "#00d68f"); }
    }));
  } else {
    lockIfNeeded();
  }

  // Deep links: ?app=terminal&run=… or ?app=browser&url=…
  const q = new URLSearchParams(location.search);
  if (q.get("app")) setTimeout(() => launch(q.get("app"), { url: q.get("url"), run: q.get("run"), path: q.get("path"), prompt: q.get("prompt") }), 500);
}

function welcome() {
  const user = store.get("user", "thadd");
  toast(`Welcome, ${user}`, "THADD OS 2.0 — Nebula Prime is ready. Press ⌘K for Spotlight, ⌘J for JARVIS.", { icon: "🚀", ms: 7000 });
  setTimeout(() => launch("guide", { page: "welcome" }), 900);
}

function restorePreferences() {
  const mode = store.get("appearance", "dark");
  setAppearance(mode);
  if (store.get("noGlass", false)) document.body.classList.add("no-glass");
  if (store.get("accent")) document.documentElement.style.setProperty("--accent", store.get("accent"));
  setWallpaper(store.get("randomWall") || "sequoia");
  if (store.get("shuffleWall", false)) {
    const ids = ["sequoia", "ventura", "monterey", "bloom", "matrix", "void"];
    setWallpaper(ids[Math.floor(Math.random() * ids.length)]);
  }
  const bright = store.get("bright", 100);
  if (bright !== 100) document.documentElement.style.filter = `brightness(${0.55 + bright / 222})`;
  if (store.get("shield.strict", true)) $("#shieldState").textContent = "Strict";
}

function lockIfNeeded() {
  const l = $("#lock");
  l.classList.remove("gone");
  const pw = $("#lockPass");
  const go = () => {
    const ok = pw.value === store.get("password", "thadd") || store.get("noPassword", true);
    if (!ok) { l.animate([{ transform: "translateX(0)" }, { transform: "translateX(-9px)" }, { transform: "translateX(9px)" }, { transform: "translateX(0)" }], { duration: 240 }); toast("Wrong password", "Hint: thadd (change it in Settings → Users)", { icon: "🔒" }); return; }
    l.classList.add("gone");
    pw.value = "";
  };
  $("#lockGo").onclick = go;
  pw.onkeydown = (e) => { if (e.key === "Enter") go(); };
  if (store.get("autoLogin", false)) setTimeout(() => l.classList.add("gone"), 500);
  setTimeout(() => pw.focus(), 400);
}

/* ═══════════════════════════ 3 · SHORTCUTS ════════════════════════════════ */
function installShortcuts() {
  const MOD = (e) => e.metaKey || e.ctrlKey;
  window.addEventListener("keydown", (e) => {
    const inField = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || "") || document.activeElement?.isContentEditable;

    if (e.key === "Escape") { closeSpotlight(); $("#mission").classList.remove("open"); $$(".flyout").forEach((f) => f.classList.add("hidden")); return; }
    if (MOD(e) && e.key.toLowerCase() === "k") { e.preventDefault(); openSpotlight(); return; }
    if (MOD(e) && e.key.toLowerCase() === "j") { e.preventDefault(); launch("jarvis"); return; }
    if (MOD(e) && e.shiftKey && e.key.toLowerCase() === "a") { e.preventDefault(); toggleMission(); return; }
    if (MOD(e) && e.shiftKey && e.key === "3") { e.preventDefault(); grab("desktop"); return; }
    if (MOD(e) && e.key === ",") { e.preventDefault(); launch("settings"); return; }
    if (MOD(e) && e.key.toLowerCase() === "d" && e.altKey) { e.preventDefault(); $("#dock").classList.toggle("hidden"); return; }
    if (MOD(e) && e.key.toLowerCase() === "g" && e.altKey) { e.preventDefault(); document.body.classList.toggle("no-glass"); store.set("noGlass", document.body.classList.contains("no-glass")); return; }
    if (e.ctrlKey && e.metaKey && e.key.toLowerCase() === "q") { e.preventDefault(); lockScreen(); return; }
    if (MOD(e) && e.shiftKey && e.key.toLowerCase() === "q") { e.preventDefault(); location.reload(); return; }
    if (e.key === "F1") { e.preventDefault(); launch("guide"); return; }
    if (inField) return;
    if (MOD(e) && e.key.toLowerCase() === "t") { e.preventDefault(); launch("terminal"); return; }
    if (MOD(e) && e.key.toLowerCase() === "n") { e.preventDefault(); launch("finder", { path: vfs.home(), forceNew: true }); return; }
    if (MOD(e) && e.key.toLowerCase() === "m") { e.preventDefault(); const w = frontWin(); if (w) minimise(w); return; }
    if (MOD(e) && e.key === "`") { e.preventDefault(); cycleWindows(); return; }
    if (MOD(e) && e.key.toLowerCase() === "w") { e.preventDefault(); const w = frontWin(); if (w) closeWindow(w); return; }
    if (e.ctrlKey && e.key === "ArrowLeft") { const w = frontWin(); if (w) snapTo(w, "left"); }
    if (e.ctrlKey && e.key === "ArrowRight") { const w = frontWin(); if (w) snapTo(w, "right"); }
    if (e.ctrlKey && e.key === "ArrowUp") { e.preventDefault(); toggleMission(); }
  });
  const frontWin = () => [...windows.values()].filter((w) => !w._state.min).sort((a, b) => b.style.zIndex - a.style.zIndex)[0];
}

/* ═══════════════════════════ 4 · GLOBAL GLUE ══════════════════════════════ */
function installGlobalGlue() {
  // desktop click → unfocus apps, close menus
  $("#windows").addEventListener("pointerdown", (e) => { if (e.target.id === "windows") bus.emit("desktop-focus"); });
  $("#wallpaper").addEventListener("dblclick", () => openLaunchpad());

  // notifications memory (for the notification centre)
  bus.on("notification", (n) => { const list = store.get("notifs", []); list.push({ ...n, at: Date.now() }); store.set("notifs", list.slice(-20)); });

  // app store installs show up in the dock
  bus.on("store-install", ({ id }) => {
    const dock = store.get("dock", null);
    if (dock && !dock.includes(id)) { dock.splice(dock.length - 4, 0, id); store.set("dock", dock); }
    bus.emit("finders-custom");
  });

  // clock in the lock screen + menubar already ticks; keep uptime fresh
  setInterval(() => { const t = $("#lockTime"); if (t) t.textContent = clock12(); }, 5000);

  // first-run niceties: seed a couple of things so JARVIS has work to do
  if (!store.get("seeded", false)) {
    store.set("seeded", true);
    vfs.write(vfs.home() + "/Downloads/notes-to-sort.txt", "1. Rename the ISO\n2. Upload screenshots\n3. Post the release\n");
  }

  // window title → menubar app name (already in wm.js) and dock dots refresh
  bus.on("win-open", () => bus.emit("finders-custom"));

  // expose a tiny dev API for power users / the README demo
  window.THADD = Object.assign(window.THADD || {}, {
    boot: { at: new Date().toISOString(), version: "2.0.0" },
    store, bus, vfs, windows,
    screenshot: () => grab(),
    spotlight: openSpotlight, mission: toggleMission, settings: () => launch("settings"),
    cmd: COMMANDS,
  });
}

function paintTrayStubs() {
  // keep the tray icons visually consistent with the current shield level
  const obs = new MutationObserver(() => {
    const on = store.get("shield.strict", true);
    $$("#mbTray .ticon")[0]?.classList.toggle("on", on);
  });
  obs.observe($("#mbShield"), { childList: true, subtree: true });
}

/* ═══════════════════════════ 5 · GO ═══════════════════════════════════════ */
boot().catch((e) => {
  console.error(e);
  const b = $("#boot");
  if (b) b.innerHTML = `<div class="boot-logo">TH</div><div class="boot-name">THADD OS</div>
    <div class="boot-sub" style="color:#fca5a5">Boot error: ${String(e.message || e)}</div>
    <div class="boot-sub">Open the browser console for details — or reload to retry.</div>`;
});
