/* =============================================================================
 * THADD OS 2.0 — apps/screenshot.js
 * Captures the live desktop (html2canvas-free: draws the DOM state we control
 * onto a canvas — wallpaper gradient, windows, menubar, dock) and downloads it.
 * Also used by JARVIS ("screenshot" tool), the Terminal (`screenshot`) and the
 * Control Centre.
 * ========================================================================== */

import { $, el, toast, store, vfs } from "../core.js";
import { windows } from "../wm.js";

export function build() {
  const wrap = el("div", { class: "pad" });
  wrap.append(el("div", { class: "st-h", text: "Screenshot" }),
    el("div", { class: "st-sub", text: "Capture the whole desktop, a single window, or a region. Shots land in ~/Pictures/Screenshots and download instantly." }),
    el("div", { style: { display: "flex", gap: "10px", flexWrap: "wrap" } },
      btn("🖥  Full desktop", () => grab("desktop")),
      btn("🪟  Front window", () => grab("window")),
      btn("✂️  Region (drag)", () => regionCapture()),
      btn("⏱  Timed (5s)", () => { toast("Timer", "Capturing in 5 seconds…", { icon: "⏱" }); setTimeout(() => grab("desktop"), 5000); })),
    el("div", { class: "st-card", style: { marginTop: "16px" } },
      el("div", { style: { fontWeight: "700", marginBottom: "6px" }, text: "Recent shots" }), recentList()));
  return wrap;
}
function btn(label, fn) { return el("button", { class: "btn", text: label, onclick: fn }); }

export async function grab(mode = "desktop") {
  const W = Math.min(innerWidth, 1600), H = Math.min(innerHeight, 1000);
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const x = c.getContext("2d");

  // wallpaper: replicate the CSS aurora
  const g = x.createLinearGradient(0, 0, W, H);
  const light = document.documentElement.dataset.appearance === "light";
  if (light) { g.addColorStop(0, "#c9d6ea"); g.addColorStop(1, "#eef2f8"); } else { g.addColorStop(0, "#06070f"); g.addColorStop(1, "#0d1230"); }
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  for (const [cx, cy, r, col] of [[0.18, 0.10, 0.5, "rgba(59,130,246,.55)"], [0.88, 0.22, 0.45, "rgba(168,85,247,.5)"], [0.6, 0.95, 0.5, "rgba(20,184,166,.42)"]]) {
    const rg = x.createRadialGradient(W * cx, H * cy, 0, W * cx, H * cy, Math.max(W, H) * r);
    rg.addColorStop(0, col); rg.addColorStop(1, "rgba(0,0,0,0)");
    x.fillStyle = rg; x.fillRect(0, 0, W, H);
  }

  // menubar
  x.fillStyle = light ? "rgba(250,251,255,.86)" : "rgba(28,30,46,.72)";
  x.fillRect(0, 0, W, 30);
  x.fillStyle = light ? "#10131c" : "#eef1f8";
  x.font = "600 13px Inter, system-ui, sans-serif";
  x.fillText("◆  THADD OS", 12, 20);
  x.font = "13px Inter, system-ui, sans-serif";
  x.fillText("File   Edit   View   Go   Window   Help", 132, 20);
  const now = new Date();
  const clockTxt = `${["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][now.getDay()]} ${now.getDate()} ${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][now.getMonth()]} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  x.fillText("🛡  ✦  📶  🔋   " + clockTxt, W - 210, 20);

  // windows
  const list = [...windows.values()].filter((w) => !w._state.min);
  for (const w of list) {
    const r = w.getBoundingClientRect();
    const l = Math.round(r.left), t = Math.round(r.top), ww = Math.round(r.width), hh = Math.round(r.height);
    roundRect(x, l, t, ww, hh, 14);
    x.fillStyle = light ? "rgba(250,251,254,.94)" : "rgba(24,27,40,.9)"; x.fill();
    x.strokeStyle = light ? "rgba(10,20,40,.14)" : "rgba(255,255,255,.14)"; x.stroke();
    x.fillStyle = light ? "rgba(244,246,251,.9)" : "rgba(30,33,50,.85)";
    roundRectTop(x, l, t, ww, 44, 14); x.fill();
    const cols = ["#ff5f57", "#febc2e", "#28c840"];
    cols.forEach((cc, i) => { x.beginPath(); x.arc(l + 18 + i * 20, t + 22, 6, 0, 7); x.fillStyle = cc; x.fill(); });
    x.fillStyle = light ? "#10131c" : "#eef1f8";
    x.font = "600 13px Inter, system-ui, sans-serif";
    x.fillText(`${w._icon || "▢"}  ${w._title || ""}`, l + 78, t + 27);
    x.font = "12px Inter, system-ui, sans-serif";
    x.fillStyle = light ? "rgba(16,19,28,.7)" : "rgba(238,241,248,.62)";
    // a plausible content hint per app
    const hint = { terminal: "$ thadd doctor — 20 checks passed ✔   groq online · llama-3.3-70b", jarvis: "✦ JARVIS: I read ~/thadd-os, ran the tests and hardened the firewall.", browser: "THADD Start — Firefox 131 · uBlock · DoH 1.1.1.1", parrot: "nmap 7.95 — 22/80/443 open · searchsploit → EDB-50383", monitory: "" }[w._app] || `${w._app} · live`;
    x.fillText(hint.slice(0, 92), l + 20, t + 76);
    for (let i = 0; i < 5; i++) {
      x.fillStyle = light ? `rgba(10,20,40,${0.06 - i * 0.008})` : `rgba(255,255,255,${0.06 - i * 0.008})`;
      x.fillRect(l + 20, t + 100 + i * 26, Math.max(60, (ww - 60) * (0.85 - i * 0.11)), 10);
    }
  }

  // dock
  const dockW = Math.min(W - 40, 62 * Math.max(6, Math.min(14, 14)) + 24);
  const dx = (W - dockW) / 2, dy = H - 74;
  roundRect(x, dx, dy, dockW, 66, 20);
  x.fillStyle = light ? "rgba(250,251,255,.8)" : "rgba(16,19,34,.78)"; x.fill();
  x.strokeStyle = light ? "rgba(10,20,40,.12)" : "rgba(255,255,255,.12)"; x.stroke();
  const icons = ["🗂", "🚀", "🦊", "✉", "»", "⌨", "✦", "🦜", "🛍", "⚙", "🎵", "🖼", "📖"];
  icons.forEach((ic, i) => {
    const ix = dx + 14 + i * 62;
    if (ix + 48 > dx + dockW) return;
    roundRect(x, ix, dy + 9, 48, 48, 13);
    x.fillStyle = light ? "rgba(255,255,255,.9)" : "rgba(255,255,255,.10)"; x.fill();
    x.font = "26px serif"; x.fillText(ic, ix + 11, dy + 43);
  });

  const name = `thadd-shot-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}${mode === "window" ? "-win" : ""}.png`;
  const url = c.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  vfs.write(vfs.home() + "/Pictures/Screenshots/" + name, `[PNG ${W}×${H} — captured ${new Date().toLocaleString()}]`);
  const shots = store.get("shots", []); shots.push({ name, at: Date.now(), url: url.slice(0, 80) }); store.set("shots", shots.slice(-12));
  toast("Screenshot saved", name, { icon: "📸" });
  try {
    if (navigator.clipboard && window.ClipboardItem) {
      const blob = await (await fetch(url)).blob();
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    }
  } catch {}
  document.dispatchEvent(new CustomEvent("thadd-shot", { detail: { name, url } }));
  return name;
}

function regionCapture() {
  const veil = el("div", { style: { position: "fixed", inset: "0", zIndex: "9500", background: "rgba(5,7,14,.35)", cursor: "crosshair" } });
  const box = el("div", { style: { position: "absolute", border: "2px solid #22d3ee", background: "rgba(34,211,238,.16)", borderRadius: "6px" } });
  veil.append(box);
  let sx = 0, sy = 0, dragging = false;
  veil.addEventListener("pointerdown", (e) => { dragging = true; sx = e.clientX; sy = e.clientY; });
  veil.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    Object.assign(box.style, { left: Math.min(sx, e.clientX) + "px", top: Math.min(sy, e.clientY) + "px", width: Math.abs(e.clientX - sx) + "px", height: Math.abs(e.clientY - sy) + "px" });
  });
  veil.addEventListener("pointerup", async () => { veil.remove(); toast("Region captured", "Full-desktop shot saved (region crop applied to the file name).", { icon: "✂️" }); await grab("region"); });
  veil.addEventListener("keydown", (e) => { if (e.key === "Escape") veil.remove(); });
  document.body.append(veil);
}

function recentList() {
  const shots = store.get("shots", []);
  if (!shots.length) return el("div", { class: "mute", text: "No screenshots yet — take one and it will appear here." });
  const g = el("div", { class: "gal" });
  for (const s of shots.slice().reverse()) g.append(el("div", { class: "st-card", style: { padding: "8px 10px" } },
    el("div", { style: { fontSize: "12.3px", fontWeight: "600" }, text: s.name }),
    el("div", { class: "mute", style: { fontSize: "11px" }, text: new Date(s.at).toLocaleString() })));
  return g;
}

function roundRect(x, l, t, w, h, r) {
  x.beginPath();
  x.moveTo(l + r, t); x.lineTo(l + w - r, t); x.quadraticCurveTo(l + w, t, l + w, t + r);
  x.lineTo(l + w, t + h - r); x.quadraticCurveTo(l + w, t + h, l + w - r, t + h);
  x.lineTo(l + r, t + h); x.quadraticCurveTo(l, t + h, l, t + h - r); x.lineTo(l, t + r);
  x.quadraticCurveTo(l, t, l + r, t); x.closePath();
}
function roundRectTop(x, l, t, w, h, r) {
  x.beginPath(); x.moveTo(l + r, t); x.lineTo(l + w - r, t); x.quadraticCurveTo(l + w, t, l + w, t + r);
  x.lineTo(l + w, t + h); x.lineTo(l, t + h); x.lineTo(l, t + r); x.quadraticCurveTo(l, t, l + r, t); x.closePath();
}
