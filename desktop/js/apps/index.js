/* =============================================================================
 * THADD OS 2.0 — apps/index.js
 * The launcher: maps registry ids to builders, tracks running apps, provides
 * `launch()` used by Spotlight, Dock, Launchpad, JARVIS and the menus.
 * ========================================================================== */

import { $, el, bus, store, toast } from "../core.js";
import { BY_ID } from "../registry.js";
import { createWindow, windows, closeApp, focus, restore } from "../wm.js";

import * as terminal from "./terminal.js";
import * as files from "./files.js";
import * as browser from "./browser.js";
import * as jarvis from "./jarvis.js";
import * as editor from "./editor.js";
import * as settings from "./settings.js";
import * as monitor from "./monitor.js";
import * as parrot from "./parrot.js";
import * as shield from "./shield.js";
import * as store_ from "./store.js";
import * as guide from "./guide.js";
import * as misc from "./misc.js";
import * as dev from "./dev.js";
import * as system from "./system.js";
import { native } from "../native.js";

/* id -> [builder, width, height] */
const B = {};
const reg = (ids, mod, w, h) => ids.forEach((id) => (B[id] = { b: mod.build, w, h }));

reg(["terminal"], terminal, 940, 600);
reg(["finder"], files, 1000, 640);
reg(["browser", "browser-chrome", "browser-brave", "browser-tor"], browser, 1120, 720);
reg(["jarvis", "copilot", "ai-lab"], jarvis, 860, 680);
reg(["editor"], editor, 1060, 680);
reg(["settings", "softwareupdate"], settings, 980, 660);
reg(["monitor"], monitor, 1000, 640);
reg(["parrot", "hackbox", "forensics", "packetlab"], parrot, 1080, 700);
reg(["shield", "vault"], shield, 1040, 680);
reg(["store"], store_, 1020, 680);
reg(["guide"], guide, 1000, 700);
reg(["launchpad"], { build: null }, 0, 0);
reg(["calc", "notes", "camera", "photos", "music", "videos", "mail", "chat", "vpn",
     "calendar", "tasks", "sheet", "office", "pdf", "clock", "weather", "maps",
     "translate", "about", "draw", "presenter", "screenrec", "printers", "bluetooth"], misc, 880, 620);
reg(["powershell", "git", "docker", "dbg", "apiweb", "jupyter", "sqlite", "automation", "logs"], dev, 1000, 620);
reg(["network", "disks", "users", "power", "bootpicker", "trash", "recorder", "screenshot"], system, 900, 620);

export function runningApps() {
  return [...new Set([...windows.values()].map((w) => w._app))];
}
export function appOpen(id) { return windows.has(id) || [...windows.values()].some((w) => w._app === id); }

export function launch(id, args = {}) {
  if (id === "launchpad") { import("../shell.js").then((m) => m.openLaunchpad()); return null; }
  /* Native launchers (live ISO / dev preview): a real fork+exec, no window. */
  if (typeof id === "string" && id.startsWith("host:")) {
    import("../native.js").then((m) => m.open(id.slice(5))).catch((e) => console.warn(e));
    return null;
  }
  const spec = B[id];
  const meta = BY_ID[id] || { id, name: id, icon: "▢", desc: "Application", cls: "" };
  if (spec && !spec.b) { import("../shell.js").then((m) => m.openLaunchpad()); return null; }

  // Focus an existing window unless the caller asked for a new one
  const existing = [...windows.values()].filter((w) => w._app === id);
  if (existing.length && !args.forceNew) {
    const front = existing.sort((a, b) => b.style.zIndex - a.style.zIndex)[0];
    if (front._state.min) restore(front); else focus(front);
    if (args && front._obj?._onArgs) { try { front._obj._onArgs(args); } catch (e) { console.warn(e); } }
    return front._obj || front;
  }

  if (!spec) {
    const w = createWindow({ app: id, title: meta.name, icon: meta.icon, w: 820, h: 560, menubarName: meta.name });
    w.body.append(el("div", { class: "pad" },
      el("div", { class: "st-h", text: meta.name }),
      el("div", { class: "st-sub", text: meta.desc || "" }),
      el("div", { class: "st-card" },
        el("div", { style: { fontSize: "38px" }, text: meta.icon || "📦" }),
        el("div", { style: { marginTop: "8px" }, text: "This component ships in the THADD OS desktop image (see the ISO builder) and is simulated here in the web preview." }))));
    return w;
  }

  const w = createWindow({
    app: id, title: meta.name, icon: meta.icon,
    w: Math.min(spec.w, Math.max(560, innerWidth - 60)),
    h: Math.min(spec.h, Math.max(360, innerHeight - 120)),
    menubarName: meta.name,
  });
  let node;
  try { node = spec.b(args, w, meta); }
  catch (e) { console.error("[launch]", id, e); node = el("div", { class: "pad" }, el("div", { class: "st-h", text: "App failed to start" }), el("pre", { class: "mono", text: String(e && e.stack || e) })); }
  if (node) w.body.append(node);
  bus.emit("app-launched", { id });
  return w;
}

/* Run a shell command through a terminal window (headless if none is open). */
export async function runInTerminal(cmd, silent = false) {
  let t = [...windows.values()].find((w) => w._app === "terminal");
  if (!t) { launch("terminal"); await new Promise((r) => setTimeout(r, 260)); t = [...windows.values()].find((w) => w._app === "terminal"); }
  if (t && t._runCommand) return await t._runCommand(cmd, silent);
  return "Error: terminal unavailable";
}

/* The global bridge: apps can launch other apps without circular imports. */
window.THADD = Object.assign(window.THADD || {}, {
  launch, closeApp, runningApps, appOpen, runInTerminal, native,
  version: "2.0.0",
  codename: "Nebula Prime",
  notify: toast,
});

bus.on("open-app", ({ app, args }) => launch(app, args));
