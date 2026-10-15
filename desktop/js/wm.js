/* =============================================================================
 * THADD OS 2.0 — wm.js
 * The window manager: Sequoia traffic-lights + Fluent Snap Layouts, drag,
 * 8-way resize, minimise/zoom/fullscreen, edge snapping, Mission Control,
 * geometry persistence.  Everything runs on pointer events (mouse + touch).
 * ========================================================================== */

import { $, $$, el, bus, store, clamp, uid, sleep } from "./core.js";

const LAYER = () => $("#windows");
let Z = 100;
export const windows = new Map();          // id -> win object
export let focusedId = null;
let cascade = 0;

const MIN_W = 360, MIN_H = 220;
const SNAP_EDGE = 22;                       // px from edge to arm snapping

function geometryFor(app, w, h) {
  const saved = store.get("geom." + app, null);
  if (saved && saved.w && saved.x != null) return saved;
  const vw = innerWidth, vh = innerHeight;
  const x = clamp(Math.round(vw * 0.5 - w / 2) + (cascade % 6) * 26 - 60, 12, Math.max(12, vw - w - 12));
  const y = clamp(Math.round(vh * 0.42 - h / 2) + (cascade % 6) * 20 - 40, 44, Math.max(44, vh - h - 96));
  return { x, y, w, h };
}

export function createWindow(opts) {
  const {
    app = "app", title = "Window", icon = "🗔", w = 900, h = 600,
    minW = MIN_W, minH = MIN_H, menubarName = title, accent = null,
    onClose = null, onResize = null, noTraffic = false, resizable = true,
  } = opts;

  const id = app + "-" + uid();
  const g = geometryFor(app, Math.min(w, innerWidth - 24), Math.min(h, innerHeight - 120));

  const win = document.createElement("div");
  win.className = "win";
  win.dataset.app = app;
  win.dataset.id = id;
  win.style.cssText = `left:${g.x}px; top:${g.y}px; width:${g.w}px; height:${g.h}px; z-index:${++Z}`;
  if (accent) win.style.setProperty("--accent", accent);

  const lights = el("div", { class: "lights" },
    el("button", { class: "light c", title: "Close", html: `<svg viewBox="0 0 10 10" fill="none" stroke-width="1.6" stroke="currentColor" stroke-linecap="round"><path d="M3 3l4 4M7 3L3 7"/></svg>` }),
    el("button", { class: "light m", title: "Minimise", html: `<svg viewBox="0 0 10 10" fill="none" stroke-width="1.6" stroke="currentColor" stroke-linecap="round"><path d="M2.5 5h5"/></svg>` }),
    el("button", { class: "light z", title: "Zoom (⌥ = fullscreen)", html: `<svg viewBox="0 0 10 10" fill="none" stroke-width="1.5" stroke="currentColor" stroke-linecap="round"><path d="M2.6 6.6V3.2h3.4M7.4 3.4v3.4H4"/></svg>` }));

  const titleEl = el("div", { class: "tt" }, el("span", { class: "ic", text: icon }), el("span", { class: "tlabel", text: title }));
  const actions = el("div", { class: "tb-actions" });
  const bar = el("div", { class: "titlebar" }, lights, titleEl, el("div", { class: "sp" }), actions);
  const body = el("div", { class: "win-body" });
  win.append(bar, body);

  if (resizable) {
    for (const d of ["n", "s", "e", "w", "nw", "ne", "sw", "se"]) win.append(el("div", { class: "resize " + d, "data-dir": d }));
  }

  win._id = id; win._app = app; win._title = title; win._icon = icon;
  win._menubarName = menubarName; win._actions = actions; win._body = body;
  win._state = { min: false, max: false, full: false, prev: null };

  LAYER().append(win);
  windows.set(id, win);

  /* ------------------------------- events ------------------------------ */
  lights.children[0].addEventListener("click", (e) => { e.stopPropagation(); closeWindow(window2obj(win)); });
  lights.children[1].addEventListener("click", (e) => { e.stopPropagation(); minimise(win); });
  lights.children[2].addEventListener("click", (e) => { e.stopPropagation(); e.altKey ? fullscreen(win) : zoom(win); });

  bar.addEventListener("pointerdown", (e) => {
    focus(win);
    if (e.target.closest(".tb-btn") || e.target.closest(".light")) return;
    startDrag(win, e);
  });
  bar.addEventListener("dblclick", (e) => {
    if (e.target.closest(".tb-btn") || e.target.closest(".light")) return;
    zoom(win);
  });
  for (const hd of $$(".resize", win)) hd.addEventListener("pointerdown", (e) => startResize(win, e, hd.dataset.dir));

  win.addEventListener("pointerdown", () => focus(win), true);
  win.addEventListener("contextmenu", (e) => {
    if (e.target.closest("input, textarea, .term-out, .scroll, .guide-main")) return;
    e.preventDefault();
    import("./core.js").then(({ contextMenu }) => contextMenu(e.clientX, e.clientY, [
      { label: "Minimise", key: "⌘M", icon: "—", action: () => minimise(win) },
      { label: win._state.max ? "Restore" : "Zoom", icon: "⤢", action: () => zoom(win) },
      { label: "Enter Full Screen", key: "^⌘F", icon: "⛶", action: () => fullscreen(win) },
      "-",
      { label: "Snap Left", key: "⌃⌥←", action: () => snapTo(win, "left") },
      { label: "Snap Right", key: "⌃⌥→", action: () => snapTo(win, "right") },
      { label: "Snap Top", action: () => snapTo(win, "top") },
      { label: "Snap Bottom", action: () => snapTo(win, "bottom") },
      "-",
      { label: "Move to next display", disabled: true, icon: "🖥" },
      { label: "Close", key: "⌘W", icon: "✕", action: () => closeWindow(window2obj(win)) },
    ]));
  });

  const obj = window2obj(win);
  obj.body = body; obj.titleEl = titleEl; obj.actions = actions; obj.el = win;
  win._obj = obj;
  focus(win);
  cascade++;
  bus.emit("win-open", obj);
  return obj;
}

function window2obj(win) {
  if (win._obj) return win._obj;
  const o = { id: win._id, app: win._app, _app: win._app, el: win, body: win._body,
    title: win._title, _title: win._title, icon: win._icon, _state: win._state,
    menubarName: win._menubarName,
    setTitle(t) { win._title = t; o.title = t; $(".tlabel", win)?.replaceChildren(document.createTextNode(t)); },
    close: () => closeWindow(o), focus: () => focus(win), minimise: () => minimise(win), zoom: () => zoom(win) };
  win._obj = o; return o;
}

export function focus(win) {
  if (!win || win._closing) return;
  $$(".win").forEach((w) => w.classList.remove("focused"));
  win.classList.add("focused");
  win.style.zIndex = ++Z;
  focusedId = win._id;
  bus.emit("win-focus", win._obj || window2obj(win));
}

export function minimise(win) {
  win.classList.add("min");
  win._state.min = true;
  bus.emit("win-min", window2obj(win));
  const nxt = [...windows.values()].filter((w) => !w._state.min && w !== win).sort((a, b) => b.style.zIndex - a.style.zIndex)[0];
  if (nxt) focus(nxt); else bus.emit("desktop-focus");
}

export function restore(win) {
  win.classList.remove("min");
  win._state.min = false;
  focus(win);
  win.animate([{ transform: "scale(.94)", opacity: .4 }, { transform: "scale(1)", opacity: 1 }], { duration: 200, easing: "cubic-bezier(.2,.9,.25,1.05)" });
}

export function zoom(win) {
  const s = win._state;
  if (s.max) {
    Object.assign(win.style, s.prev);
    s.max = false; win.classList.remove("max");
  } else {
    s.prev = { left: win.style.left, top: win.style.top, width: win.style.width, height: win.style.height };
    Object.assign(win.style, { left: "0px", top: "30px", width: innerWidth + "px", height: (innerHeight - 30) + "px" });
    s.max = true; win.classList.add("max");
  }
  win.dispatchEvent(new CustomEvent("thadd-resize"));
}

export function fullscreen(win) {
  const s = win._state;
  if (s.full) { win.classList.remove("full"); s.full = false; Object.assign(win.style, s.prevFull); return; }
  s.prevFull = { left: win.style.left, top: win.style.top, width: win.style.width, height: win.style.height };
  Object.assign(win.style, { left: "0px", top: "30px", width: innerWidth + "px", height: (innerHeight - 30) + "px" });
  win.classList.add("max");
  s.full = true;
}

export function snapTo(win, side) {
  const top = 30, availH = innerHeight - top;
  const full = "0px", hw = innerWidth / 2 + "px";
  const s = win._state;
  if (!s.max) s.prev = { left: win.style.left, top: win.style.top, width: win.style.width, height: win.style.height };
  const geo = {
    left:  { left: full, top: top + "px", width: hw, height: availH + "px" },
    right: { left: hw,   top: top + "px", width: hw, height: availH + "px" },
    top:   { left: full, top: top + "px", width: full, height: availH + "px" },
    bottom:{ left: full, top: top + "px", width: full, height: availH + "px" },
    tl: { left: full, top: top + "px", width: hw, height: availH / 2 + "px" },
    tr: { left: hw, top: top + "px", width: hw, height: availH / 2 + "px" },
    bl: { left: full, top: top + availH / 2 + "px", width: hw, height: availH / 2 + "px" },
    br: { left: hw, top: top + availH / 2 + "px", width: hw, height: availH / 2 + "px" },
  }[side];
  win.classList.add("snapping");
  Object.assign(win.style, geo);
  s.max = side === "top" || side === "bottom";
  setTimeout(() => win.classList.remove("snapping"), 190);
  win.dispatchEvent(new CustomEvent("thadd-resize"));
}

export function closeWindow(objOrWin) {
  const win = objOrWin?.el || objOrWin;
  if (!win || win._closing) return;
  win._closing = true;
  const o = window2obj(win);
  try { win._onClose?.(); } catch {}
  bus.emit("win-close", o);
  store.set("geom." + win._app, { x: parseInt(win.style.left), y: parseInt(win.style.top), w: parseInt(win.style.width), h: parseInt(win.style.height) });
  win.classList.add("closing");
  setTimeout(() => {
    win.remove(); windows.delete(win._id);
    const nxt = [...windows.values()].filter((w) => !w._state.min).sort((a, b) => b.style.zIndex - a.style.zIndex)[0];
    if (nxt) focus(nxt); else bus.emit("desktop-focus");
  }, 165);
}

export function closeApp(appId) {
  [...windows.values()].filter((w) => w._app === appId).forEach((w) => closeWindow(w));
}

/* -------------------------------- drag ---------------------------------- */
function startDrag(win, e) {
  const s = win._state;
  if (s.max && !s.full) {  // un-maximise and re-anchor under the cursor
    const relX = e.clientX / innerWidth;
    Object.assign(win.style, s.prev);
    s.max = false; win.classList.remove("max");
    win.style.left = clamp(e.clientX - parseInt(win.style.width) * relX, 0, innerWidth - 120) + "px";
  }
  const sx = e.clientX, sy = e.clientY;
  const ox = parseInt(win.style.left), oy = parseInt(win.style.top);
  const ghost = $("#snapGhost");
  let armed = null;
  win.setPointerCapture?.(e.pointerId);
  const move = (ev) => {
    const nx = ox + ev.clientX - sx, ny = oy + ev.clientY - sy;
    win.style.left = nx + "px";
    win.style.top = clamp(ny, 28, innerHeight - 44) + "px";
    // Fluent snap layouts — edge zones
    armed = null;
    if (ev.clientX <= SNAP_EDGE) armed = "left";
    else if (ev.clientX >= innerWidth - SNAP_EDGE) armed = "right";
    else if (ev.clientY <= 34) armed = "top";
    else if (ev.clientY >= innerHeight - SNAP_EDGE) armed = "bottom";
    if (armed) {
      const g = { left: [0, 30, innerWidth / 2, innerHeight - 30], right: [innerWidth / 2, 30, innerWidth / 2, innerHeight - 30],
        top: [0, 30, innerWidth, innerHeight - 30], bottom: [0, 30, innerWidth, innerHeight - 30] }[armed];
      Object.assign(ghost.style, { display: "block", left: g[0] + "px", top: g[1] + "px", width: g[2] + "px", height: g[3] + "px" });
    } else ghost.style.display = "none";
  };
  const up = () => {
    document.removeEventListener("pointermove", move);
    document.removeEventListener("pointerup", up);
    window.removeEventListener("blur", up);
    ghost.style.display = "none";
    if (armed) snapTo(win, armed);
    store.set("geom." + win._app, { x: parseInt(win.style.left), y: parseInt(win.style.top), w: parseInt(win.style.width), h: parseInt(win.style.height) });
  };
  document.addEventListener("pointermove", move);
  document.addEventListener("pointerup", up);
  window.addEventListener("blur", up);
}

/* ------------------------------- resize --------------------------------- */
function startResize(win, e, dir) {
  e.preventDefault(); e.stopPropagation();
  focus(win);
  const sx = e.clientX, sy = e.clientY;
  const o = { x: parseInt(win.style.left), y: parseInt(win.style.top), w: parseInt(win.style.width), h: parseInt(win.style.height) };
  const minW = 340, minH = 200;
  win.setPointerCapture?.(e.pointerId);
  const move = (ev) => {
    const dx = ev.clientX - sx, dy = ev.clientY - sy;
    let { x, y, w, h } = o;
    if (dir.includes("e")) w = Math.max(minW, o.w + dx);
    if (dir.includes("s")) h = Math.max(minH, o.h + dy);
    if (dir.includes("w")) { w = Math.max(minW, o.w - dx); x = o.x + (o.w - w); }
    if (dir.includes("n")) { h = Math.max(minH, o.h - dy); y = o.y + (o.h - h); }
    Object.assign(win.style, { left: x + "px", top: y + "px", width: w + "px", height: h + "px" });
    win.dispatchEvent(new CustomEvent("thadd-resize"));
  };
  const up = () => {
    document.removeEventListener("pointermove", move);
    document.removeEventListener("pointerup", up);
    store.set("geom." + win._app, { x: parseInt(win.style.left), y: parseInt(win.style.top), w: parseInt(win.style.width), h: parseInt(win.style.height) });
    win.dispatchEvent(new CustomEvent("thadd-resize"));
  };
  document.addEventListener("pointermove", move);
  document.addEventListener("pointerup", up);
}

/* --------------------------- mission control ---------------------------- */
export function toggleMission(force) {
  const m = $("#mission");
  const open = force ?? !m.classList.contains("open");
  if (!open) { m.classList.remove("open"); return; }
  const grid = $("#missionGrid"); grid.innerHTML = "";
  const list = [...windows.values()].filter((w) => !w._state.min);
  if (!list.length) grid.append(el("div", { class: "mission-empty", text: "No open windows — press ⌘⇧A or click the dock to launch something." }));
  for (const w of list) {
    const card = el("div", { class: "mission-card" },
      el("div", { class: "mh" }, el("span", { text: w._icon }), el("span", { text: w._title })),
      el("div", { class: "mb2", text: w._icon }));
    card.addEventListener("click", () => { m.classList.remove("open"); restore(w); });
    grid.append(card);
  }
  m.classList.add("open");
}

/* ---------------------------- global keys ------------------------------- */
export function cycleWindows(dir = 1) {
  const list = [...windows.values()].filter((w) => !w._state.min).sort((a, b) => a.style.zIndex - b.style.zIndex);
  if (!list.length) return;
  const i = list.findIndex((w) => w._id === focusedId);
  focus(list[((i + dir) % list.length + list.length) % list.length]);
}

window.addEventListener("resize", () => {
  for (const w of windows.values()) {
    if (w._state.max || w._state.full) {
      Object.assign(w.style, { left: "0px", top: "30px", width: innerWidth + "px", height: innerHeight - 30 + "px" });
    } else {
      w.style.left = Math.min(parseInt(w.style.left), Math.max(0, innerWidth - 160)) + "px";
      w.style.top = Math.min(parseInt(w.style.top), Math.max(30, innerHeight - 80)) + "px";
    }
    w.dispatchEvent(new CustomEvent("thadd-resize"));
  }
});
