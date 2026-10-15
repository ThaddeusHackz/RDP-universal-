/* =============================================================================
 * THADD OS 2.0 — core.js
 * Shared primitives: DOM helpers, persistent store, event bus, toasts,
 * context menus, flyouts, virtual filesystem seed.  (Zero dependencies.)
 * ========================================================================== */

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") n.className = v;
    else if (k === "html") n.innerHTML = v;
    else if (k === "text") n.textContent = v;
    else if (k === "style" && typeof v === "object") Object.assign(n.style, v);
    else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
    else if (v !== null && v !== false && v !== undefined) n.setAttribute(k, v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    n.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return n;
}

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export const pad = (n, w = 2) => String(n).padStart(w, "0");
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const uid = () => Math.random().toString(36).slice(2, 10);
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const fmtBytes = (b) => {
  if (!b && b !== 0) return "—";
  const u = ["B", "KB", "MB", "GB", "TB"]; let i = 0;
  while (b >= 1024 && i < u.length - 1) { b /= 1024; i++; }
  return `${b < 10 && i > 0 ? b.toFixed(1) : Math.round(b)} ${u[i]}`;
};
export const fmtDur = (s) => {
  s = Math.max(0, Math.floor(s));
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (d) return `${d}d ${h}h ${m}m`;
  if (h) return `${h}h ${m}m ${pad(sec)}s`;
  if (m) return `${m}m ${pad(sec)}s`;
  return `${sec}s`;
};

/* ------------------------------- store ---------------------------------- */
export const store = {
  get(k, d = null) {
    try { const v = localStorage.getItem("thadd." + k); return v === null ? d : JSON.parse(v); }
    catch { return d; }
  },
  set(k, v) { try { localStorage.setItem("thadd." + k, JSON.stringify(v)); } catch {} return v; },
  del(k) { try { localStorage.removeItem("thadd." + k); } catch {} },
};

/* ------------------------------- bus ------------------------------------ */
const listeners = new Map();
export const bus = {
  on(ev, fn) { (listeners.get(ev) || listeners.set(ev, []).get(ev)).push(fn); return () => bus.off(ev, fn); },
  off(ev, fn) { const l = listeners.get(ev); if (l) l.splice(l.indexOf(fn), 1); },
  emit(ev, data) {
    (listeners.get(ev) || []).forEach((f) => { try { f(data); } catch (e) { console.warn("[bus]", ev, e); } });
    (listeners.get("*") || []).forEach((f) => { try { f({ ev, data }); } catch {} });
  },
};

/* ------------------------------- toasts --------------------------------- */
export function toast(title, msg = "", opts = {}) {
  const host = $("#toasts");
  if (!host) return;
  const icon = opts.icon || "✦";
  const t = el("div", { class: "toast" },
    el("div", { class: "ti", text: icon }),
    el("div", { class: "tx2" },
      el("div", { class: "tt2", text: title }),
      msg ? el("div", { class: "tm", text: msg }) : null));
  const kill = () => { t.classList.add("out"); setTimeout(() => t.remove(), 260); };
  t.addEventListener("click", kill);
  host.append(t);
  const ms = opts.ms ?? (msg ? 4600 : 2800);
  setTimeout(kill, ms);
  bus.emit("notification", { title, msg, icon });
  return t;
}

/* --------------------------- context menu -------------------------------- */
export function contextMenu(x, y, rows) {
  const m = $("#ctxMenu");
  m.innerHTML = "";
  for (const r of rows) {
    if (r === "-") { m.append(el("div", { class: "mb-sep" })); continue; }
    const row = el("div", { class: `ctx-row${r.disabled ? " disabled" : ""}` },
      el("span", { class: "ic", text: r.icon || "" }), el("span", { text: r.label }),
      r.key ? el("span", { class: "mb-key", text: r.key }) : null);
    if (!r.disabled) row.addEventListener("click", () => { hide(); r.action?.(); });
    m.append(row);
  }
  const hide = () => m.classList.add("hidden");
  m.classList.remove("hidden");
  const r = m.getBoundingClientRect();
  m.style.left = clamp(x, 4, innerWidth - r.width - 6) + "px";
  m.style.top = clamp(y, 4, innerHeight - r.height - 6) + "px";
  m._hide = hide;
  return hide;
}
document.addEventListener("mousedown", (e) => {
  const m = $("#ctxMenu");
  if (m && !m.classList.contains("hidden") && !m.contains(e.target)) m._hide?.();
}, true);
document.addEventListener("keydown", (e) => { if (e.key === "Escape") $("#ctxMenu")?._hide?.(); });

/* --------------------------- clipboard ----------------------------------- */
export async function copy(text, label = "Copied to clipboard") {
  try { await navigator.clipboard.writeText(text); toast(label, text.slice(0, 64), { icon: "📋" }); }
  catch { toast("Clipboard blocked", "Your browser denied clipboard access.", { icon: "⚠" }); }
}

/* ------------------------------ flyouts ---------------------------------- */
export function toggleFlyout(id, anchorEl, build) {
  const f = document.getElementById(id);
  const open = !f.classList.contains("hidden");
  $$(".flyout").forEach((x) => x.classList.add("hidden"));
  if (open) return false;
  f.innerHTML = "";
  f.append(build());
  f.classList.remove("hidden");
  const a = anchorEl.getBoundingClientRect();
  const fr = f.getBoundingClientRect();
  f.style.left = clamp(a.right - fr.width, 8, innerWidth - fr.width - 8) + "px";
  f.style.top = Math.min(a.bottom + 8, innerHeight - fr.height - 14) + "px";
  return true;
}
document.addEventListener("mousedown", (e) => {
  if (e.target.closest(".flyout") || e.target.closest("#mbTray") || e.target.closest("#mbClock")) return;
  $$(".flyout").forEach((x) => x.classList.add("hidden"));
});

/* ------------------------- virtual filesystem ---------------------------- */
/*  A faithful in-browser model of the THADD OS root filesystem.  Everything
 *  the Terminal / Finder / JARVIS touch lives here, so the demo is coherent. */
const HOME = () => store.get("user", "thadd");

export function vfsTree() {
  const h = HOME();
  const file = (name, body, extra = {}) => ({ name, type: "file", body, ...extra });
  const dir = (name, children, extra = {}) => ({ name, type: "dir", children, ...extra });
  const proj = dir("thadd-os", [
    file("README.md", `# THADD OS 2.0 “Nebula Prime”\n\nOne OS. All the Best.\nmacOS Sequoia × Windows 11 surface · Parrot toolchain · JARVIS AI.\n\n## Build the ISO\n\n    thadd-iso build --edition desktop --out thadd-os-2.0.iso\n\n## Run in VirtualBox\n\n    VBoxManage startvm "THADD OS"\n`),
    file("Makefile", `# THADD OS image pipeline\nall: iso\niso:\n\t./tools/build-iso.sh --release\nrun:\n\t./tools/run-vbox.sh\ninstall-deps:\n\tsudo ./tools/install-deps.sh\n`),
    dir("tools", [
      file("build-iso.sh", "#!/usr/bin/env bash\n# Builds the bootable THADD OS ISO (live-build)\nset -euo pipefail\nlb clean --purge\nlb config\nlb build\n"),
      file("run-vbox.sh", "#!/usr/bin/env bash\n# Create + boot the THADD OS VM in VirtualBox\nVBoxManage startvm \"THADD OS\" --type gui\n"),
      file("install-deps.sh", "#!/usr/bin/env bash\n# Host deps: live-build, xorriso, squashfs-tools, qemu-system-x86\napt-get install -y live-build xorriso squashfs-tools isolinux syslinux-common\n"),
    ]),
    dir("os", [
      file("config", "THADD OS — image configuration\nEDITION=desktop\nDEBIAN_CODENAME=bookworm\nKERNEL=linux-image-amd64\n"),
      file("packages.chroot", "xfce4 lightdm thadd-desktop firefox-esr thadd-ai\nparrot-tools groq-cli code-oss\n"),
    ]),
  ]);
  return dir("/", [
    dir("bin", [], { system: true }),
    dir("boot", [file("vmlinuz-6.9-thadd", "[binary kernel image]"), file("initrd.img-6.9-thadd", "[initramfs]"), dir("grub", [file("grub.cfg", "menuentry 'THADD OS' { linux /boot/vmlinuz quiet splash }")])], { system: true }),
    dir("dev", [], { system: true }), dir("etc", [file("os-release", `PRETTY_NAME="THADD OS 2.0 (Nebula Prime)"\nNAME="THADD OS"\nVERSION="2.0"\nID=thadd\nID_LIKE="debian ubuntu"\nHOME_URL="https://github.com/ThaddeusHackz/RDP-universal-"\n`), file("hostname", "thadd-os"), file("motd", " ████████╗██╗  ██╗ █████╗ ██████╗ ██████╗     ██████╗ ███████╗\n ╚══██╔══╝██║  ██║██╔══██╗██╔══██╗██╔══██╗   ██╔═══██╗██╔════╝\n    ██║   ███████║███████║██║  ██║██║  ██║   ██║   ██║███████╗\n    ██║   ██╔══██║██╔══██║██║  ██║██║  ██║   ██║   ██║╚════██║\n    ██║   ██║  ██║██║  ██║██████╔╝██████╔╝██╗╚██████╔╝███████║\n    ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝ ╚═════╝ ╚═╝ ╚═════╝ ╚══════╝\n")], { system: true }),
    dir("home", [dir(h, [proj,
      dir("Documents", [
        file("THADD-OS-Guide.md", "# Welcome to THADD OS 2.0\n\nPress ⌘/Ctrl-K to search, ⌘/Ctrl-J for JARVIS.\nDouble-click icons on the desktop. Drag windows to edges to snap.\n"),
        file("notes.md", "- [x] Boot THADD OS\n- [ ] Build the ISO\n- [ ] Run nmap against lab target\n- [ ] Ask JARVIS to refactor my script\n"),
        dir("Projects", [file("hello.py", 'print("hello from THADD OS")\n')]),
      ]),
      dir("Downloads", [file("thadd-os-2.0.iso", "[2.9 GB THADD OS live/installer ISO — see Releases]")]),
      dir("Pictures", [file("thadd-wallpaper.jpg", "[THADD aurora wallpaper 5120×2880]"), dir("Screenshots", [])]),
      dir("Music", []), dir("Videos", []),
      dir("Desktop", [file("THADD-OS-README.txt", "THADD OS 2.0 — Nebula Prime\n")]),
      file(".bashrc", "# THADD OS shell defaults\nexport PATH=\"$PATH:$HOME/.local/bin\"\nalias ll='ls -lah --color=auto'\nalias iso='thadd iso'\n"),
      file("secret.txt", "flag{thadd_os_is_watching_you}\n"),
    ], { home: true })], { system: true }),
    dir("opt", [dir("thadd", [file("manifest.json", '{"os":"THADD OS","version":"2.0","codename":"Nebula Prime"}')])], { system: true }),
    dir("root", [], { system: true }),
    dir("usr", [dir("bin", [], { system: true }), dir("share", [dir("backgrounds", [])], { system: true })], { system: true }),
    dir("var", [dir("log", [file("syslog", "Oct 13 09:41:02 thadd-os kernel: THADD Shield strict mode engaged\nOct 13 09:41:02 thadd-os kernel: JARVIS daemon listening\n")])], { system: true }),
  ]);
}

let VFS = vfsTree();
export const vfs = {
  reset() { VFS = vfsTree(); return VFS; },
  root() { return VFS; },
  resolve(path) {
    const parts = String(path || "/").replace(/^~(?=\/|$)/, "/home/" + HOME())
      .split("/").filter(Boolean);
    let node = VFS;
    for (const p of parts) {
      if (node.type !== "dir") return null;
      const next = node.children.find((c) => c.name === p);
      if (!next) return null;
      node = next;
    }
    return node;
  },
  parent(path) { const clean = String(path).replace(/\/+$/, ""); const i = clean.lastIndexOf("/"); return this.resolve(i <= 0 ? "/" : clean.slice(0, i)); },
  ls(path) { const n = this.resolve(path); return n && n.type === "dir" ? n.children : null; },
  read(path) { const n = this.resolve(path); return n && n.type === "file" ? n.body : null; },
  write(path, body) {
    const name = String(path).replace(/\/+$/, "").split("/").pop();
    const par = this.parent(path); if (!par || par.type !== "dir") return false;
    const ex = par.children.find((c) => c.name === name);
    if (ex && ex.type === "file") { ex.body = body; ex.mtime = Date.now(); }
    else par.children.push({ name, type: "file", body, mtime: Date.now() });
    bus.emit("fs", { op: "write", path });
    return true;
  },
  mkdir(path) {
    const name = String(path).replace(/\/+$/, "").split("/").pop();
    const par = this.parent(path); if (!par) return false;
    if (!par.children.find((c) => c.name === name)) par.children.push({ name, type: "dir", children: [] });
    bus.emit("fs", { op: "mkdir", path });
    return true;
  },
  rm(path) {
    const par = this.parent(path); if (!par) return false;
    const i = par.children.findIndex((c) => c.name === String(path).replace(/\/+$/, "").split("/").pop());
    if (i < 0) return false;
    par.children.splice(i, 1); bus.emit("fs", { op: "rm", path }); return true;
  },
  path(node) { // pretty ~/… path
    const walk = (n, cur) => {
      if (n === VFS) return cur || "/";
      for (const c of n.children || []) {
        if (c === node) return cur + "/" + c.name;
        if (c.type === "dir") { const r = walk(c, cur + "/" + c.name); if (r) return r; }
      }
      return null;
    };
    return walk(VFS, "");
  },
  home() { return "/home/" + HOME(); },
  flatten(prefix = "", node = VFS, out = []) {
    for (const c of node.children || []) {
      const p = prefix + "/" + c.name;
      out.push({ path: p, node: c });
      if (c.type === "dir") this.flatten(p, c, out);
    }
    return out;
  },
};

/* --------------------------- open-with registry -------------------------- */
export function openPath(path) {
  const node = vfs.resolve(path);
  if (!node) { toast("Not found", path, { icon: "⚠" }); return; }
  if (node.type === "dir") bus.emit("open-app", { app: "files", args: { path } });
  else if (/\.(png|jpe?g|gif|webp|svg)$/i.test(node.name)) bus.emit("open-app", { app: "photos", args: { path } });
  else if (/\.(mp4|webm|mkv|mov|avi)$/i.test(node.name)) bus.emit("open-app", { app: "videos", args: { path } });
  else if (/\.(mp3|flac|wav|ogg|m4a)$/i.test(node.name)) bus.emit("open-app", { app: "music", args: { path } });
  else bus.emit("open-app", { app: "editor", args: { path } });
}

/* ------------------------------ locale/time ------------------------------ */
export const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August",
  "September", "October", "November", "December"];
export const clock = (d = new Date()) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
export const clock12 = (d = new Date()) => {
  const h = d.getHours() % 12 || 12;
  return `${h}:${pad(d.getMinutes())} ${d.getHours() < 12 ? "AM" : "PM"}`;
};
export const longDate = (d = new Date()) => `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
export const shortDate = (d = new Date()) => `${DAYS[d.getDay()].slice(0, 3)} ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`;
export const uptimeStart = Date.now();
export const uptime = () => (Date.now() - uptimeStart) / 1000;
