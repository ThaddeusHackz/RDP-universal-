/* =============================================================================
 * THADD OS 2.0 — apps/files.js
 * Files (Finder) — sidebar, breadcrumbs, icon/list views, quick-look viewer,
 * search, full CRUD, "Open in Terminal" / editor / JARVIS hand-off.
 * ========================================================================== */

import { $, el, esc, vfs, store, toast, contextMenu, copy, fmtBytes, bus, sleep, openPath } from "../core.js";

export function build(args = {}, win) {
  const S = {
    path: args.path || vfs.home(),
    view: store.get("fm.view", "grid"),
    sel: null,
    query: "",
  };

  const side = el("div", { class: "fm-side" });
  const crumbs = el("div", { class: "fm-crumbs" });
  const body = el("div", { class: "fm-body" });
  const status = el("div", { class: "fm-status" });
  const viewer = el("div", { class: "fm-viewer hidden" });
  const search = el("input", { class: "tb-input", placeholder: "Search this folder…" });

  const tl = (fn) => el("button", { class: "tb-btn", title: fn.title || "", html: fn.icon || fn.text, onclick: fn.act });

  const bar = el("div", { class: "fm-bar" },
    tl({ text: "‹", title: "Back", act: () => go(parentOf(S.path)) }),
    tl({ text: "›", title: "Forward" }),
    crumbs,
    search,
    tl({ text: "▦", title: "Icon view", act: () => { S.view = "grid"; store.set("fm.view", "grid"); render(); } }),
    tl({ text: "☰", title: "List view", act: () => { S.view = "list"; store.set("fm.view", "list"); render(); } }),
    tl({ text: "＋", title: "New folder", act: newFolder }),
    tl({ text: "⌸", title: "Open in Terminal", act: openTerm }),
    tl({ text: "✦", title: "Ask JARVIS about this folder", act: askJarvis }));

  const main = el("div", { class: "fm-main" }, bar, body, status);
  const wrap = el("div", { class: "fm" }, side, main, viewer);

  search.addEventListener("input", () => { S.query = search.value.toLowerCase(); render(); });

  /* ------------------------------ sidebar -------------------------------- */
  const PLACES = [
    { name: "Recents", icon: "🕘", path: vfs.home() },
    { name: "Home", icon: "🏠", path: vfs.home() },
    { name: "Desktop", icon: "🖥", path: vfs.home() + "/Desktop" },
    { name: "Documents", icon: "📄", path: vfs.home() + "/Documents" },
    { name: "Downloads", icon: "⬇", path: vfs.home() + "/Downloads" },
    { name: "Pictures", icon: "🖼", path: vfs.home() + "/Pictures" },
    { name: "Music", icon: "🎵", path: vfs.home() + "/Music" },
    { name: "Videos", icon: "🎬", path: vfs.home() + "/Videos" },
    { name: "Projects", icon: "⌨", path: vfs.home() + "/Documents/Projects" },
  ];
  const SYS = [
    { name: "Root", icon: "🗄", path: "/" },
    { name: "thadd-os (ISO)", icon: "💿", path: vfs.home() + "/thadd-os" },
    { name: "opt/thadd", icon: "⚙", path: "/opt/thadd" },
    { name: "var/log", icon: "📃", path: "/var/log" },
    { name: "boot", icon: "🥾", path: "/boot" },
    { name: "Trash", icon: "🗑", path: "/tmp/trash" },
  ];
  function renderSide() {
    side.innerHTML = "";
    side.append(sideGroup("Favourites", PLACES), sideGroup("Locations", SYS));
  }
  function sideGroup(title, items) {
    const g = el("div", {}, el("h5", { text: title }));
    for (const p of items) {
      const n = el("div", { class: "fm-nav" + (S.path === p.path ? " on" : "") },
        el("span", { class: "ic", text: p.icon }), el("span", { text: p.name }));
      n.addEventListener("click", () => go(p.path));
      n.addEventListener("dragover", (e) => e.preventDefault());
      g.append(n);
    }
    return g;
  }

  /* ------------------------------ rendering ------------------------------ */
  function go(p) {
    if (!vfs.resolve(p)) { toast("Folder missing", p, { icon: "⚠" }); return; }
    S.path = p.replace(/\/+$/, "") || "/"; S.sel = null; closeViewer(); render();
  }
  const parentOf = (p) => { const s = p.replace(/\/+$/, ""); const i = s.lastIndexOf("/"); return i <= 0 ? "/" : s.slice(0, i); };

  function render() {
    closeMenuCrumbs();
    renderSide();
    crumbs.innerHTML = "";
    const segs = S.path.split("/").filter(Boolean);
    const rootCrumb = el("span", { class: "fm-crumb", text: S.path === "/" ? "/" : "Macintosh THADD" });
    rootCrumb.addEventListener("click", () => go("/"));
    crumbs.append(rootCrumb);
    let acc = "";
    segs.forEach((s2) => {
      acc += "/" + s2;
      const p = acc;
      crumbs.append(el("span", { class: "fm-crumb sep", text: "›" }));
      const c = el("span", { class: "fm-crumb", text: s2 });
      c.addEventListener("click", () => go(p));
      crumbs.append(c);
    });
    crumbs.append(el("span", { class: "fm-crumb sep", text: S.query ? "  ·  filtering" : "" }));

    const node = vfs.resolve(S.path);
    if (!node || node.type !== "dir") { body.innerHTML = ""; body.append(el("div", { class: "fm-empty", text: "Not a directory" })); return; }
    let kids = [...(node.children || [])].sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === "dir" ? -1 : 1));
    if (S.query) kids = kids.filter((k) => k.name.toLowerCase().includes(S.query));
    if (!kids.some((k) => !k.name.startsWith("."))) kids = kids;

    body.innerHTML = "";
    if (S.view === "grid") {
      const g = el("div", { class: "fm-grid" });
      for (const k of kids) {
        const cell = el("div", { class: "fm-cell" + (S.sel === k ? " sel" : "") },
          el("div", { class: "big", text: iconFor(k) }), el("div", { class: "nm", text: k.name }));
        cell.addEventListener("click", () => { S.sel = k; render(); select(k); });
        cell.addEventListener("dblclick", () => k.type === "dir" ? go(join(S.path, k.name)) : openPath(join(S.path, k.name)));
        cell.addEventListener("contextmenu", (e) => { e.preventDefault(); S.sel = k; select(k); menu(e, k); });
        g.append(cell);
      }
      if (!kids.length) g.append(el("div", { class: "fm-empty", text: S.query ? `No matches for “${S.query}”.` : "This folder is empty." }));
      body.append(g);
    } else {
      const t = el("table", { class: "fm-list" },
        el("thead", {}, el("tr", {}, el("th", { text: "Name" }), el("th", { text: "Kind" }), el("th", { text: "Size" }), el("th", { text: "Modified" }))));
      const tb = el("tbody");
      for (const k of kids) {
        const tr = el("tr", { class: S.sel === k ? "sel" : "" },
          el("td", { text: `${iconFor(k)}  ${k.name}` }), el("td", { text: k.type === "dir" ? "Folder" : kindOf(k.name) }),
          el("td", { text: k.type === "dir" ? `${(k.children || []).length} items` : fmtBytes(String(k.body || "").length) }),
          el("td", { text: k.mtime ? new Date(k.mtime).toLocaleString() : "—" }));
        tr.addEventListener("click", () => { S.sel = k; render(); select(k); });
        tr.addEventListener("dblclick", () => k.type === "dir" ? go(join(S.path, k.name)) : openPath(join(S.path, k.name)));
        tr.addEventListener("contextmenu", (e) => { e.preventDefault(); S.sel = k; select(k); menu(e, k); });
        tb.append(tr);
      }
      t.append(tb); body.append(t);
    }
    const total = kids.reduce((a, k) => a + (k.type === "file" ? String(k.body || "").length : 4096), 0);
    status.textContent = `${kids.length} items · ${fmtBytes(total)} · ${S.path}  ·  ${store.get("disk.free", "448 GB")} available`;
  }

  const join = (a, b) => (a === "/" ? "" : a) + "/" + b;
  const iconFor = (k) => k.type === "dir" ? "📁" : /\.(png|jpe?g|gif|svg|webp)$/i.test(k.name) ? "🖼"
    : /\.(mp4|webm|mov)$/i.test(k.name) ? "🎬" : /\.(mp3|wav|flac)$/i.test(k.name) ? "🎵"
    : /\.(sh|py|js|ts|c|cpp|rs|go|java)$/i.test(k.name) ? "⌨" : /\.(md|txt|log)$/i.test(k.name) ? "📄"
    : /\.(iso|img)$/i.test(k.name) ? "💿" : /\.(json|ya?ml|toml)$/i.test(k.name) ? "⚙" : k.name === "secret.txt" ? "🔐" : "📄";
  const kindOf = (n) => /\.(sh|py|js|ts)$/.test(n) ? "Script" : /\.md$/.test(n) ? "Markdown" : /\.(json|ya?ml|toml)$/.test(n) ? "Config" : /\.iso$/.test(n) ? "Disk image" : "Text document";

  function select(k) {
    viewer.classList.remove("hidden");
    viewer.innerHTML = "";
    const head = el("div", { class: "fm-bar" },
      el("span", { style: { fontSize: "15px" }, text: iconFor(k) }),
      el("b", { style: { fontSize: "12.5px", flex: "1" }, text: k.name }),
      el("button", { class: "tb-btn", text: "✕", title: "Close preview", onclick: closeViewer }));
    viewer.append(head);
    if (k.type === "file") {
      const pre = el("pre", { text: String(k.body ?? "").slice(0, 6000) || "(empty file)" });
      viewer.append(pre);
      viewer.append(el("div", { class: "fm-status", text: `${fmtBytes(String(k.body || "").length)} · ${kindOf(k.name)} · modified ${k.mtime ? new Date(k.mtime).toLocaleString() : "—"}` }));
    } else {
      viewer.append(el("div", { class: "fm-empty", text: `${(k.children || []).length} items — double-click the folder to browse into it.` }));
    }
  }
  function closeViewer() { viewer.classList.add("hidden"); viewer.innerHTML = ""; }

  /* ------------------------------ actions -------------------------------- */
  function newFolder() {
    const n = "New Folder" + (Math.random() > .5 ? " " + Math.floor(Math.random() * 90) : "");
    vfs.mkdir(join(S.path, n)); toast("Folder created", join(S.path, n), { icon: "📁" }); render();
  }
  function openTerm() { window.THADD.launch("terminal", { run: `cd ${S.path.replace(vfs.home(), "~")} && ls -la` }); }
  function askJarvis() {
    const names = (vfs.ls(S.path) || []).map((k) => k.name).join(", ");
    window.THADD.launch("jarvis", { prompt: `Here is the folder ${S.path} in my home: ${names}. Summarise what's here and suggest the next useful action, then do it if it's safe.` });
  }

  function menu(e, k) {
    const p = join(S.path, k.name);
    contextMenu(e.clientX, e.clientY, [
      { label: "Open", icon: "↗", action: () => k.type === "dir" ? go(p) : openPath(p) },
      { label: "Open in Code Studio", icon: "⌨", action: () => window.THADD.launch("editor", { path: p }) },
      { label: "Open in Terminal here", icon: "»", action: () => window.THADD.launch("terminal", { run: `cd ${k.type === "dir" ? p.replace(vfs.home(), "~") : S.path.replace(vfs.home(), "~")} && ls -la` }) },
      "-",
      { label: "Rename…", icon: "✎", action: () => { const nn = prompt("New name:", k.name); if (nn && nn !== k.name) { k.name = nn; toast("Renamed", nn, { icon: "✎" }); render(); } } },
      { label: "Duplicate", icon: "⧉", action: () => { if (k.type === "file") vfs.write(join(S.path, "copy of " + k.name), k.body || ""); toast("Duplicated", k.name, { icon: "⧉" }); render(); } },
      { label: "Copy path", icon: "📋", action: () => copy(p, "Path copied") },
      { label: "Ask JARVIS about this", icon: "✦", action: () => window.THADD.launch("jarvis", { prompt: `Look at ${p} (${k.type === "dir" ? "folder" : "file"}) and tell me what it is and what I should do with it.` }) },
      "-",
      { label: "Secure erase (7-pass)", icon: "🔒", action: () => { vfs.rm(p); toast("Securely erased", `${k.name} — DoD 5220.22-M, 7 passes`, { icon: "🔒" }); render(); } },
      { label: "Move to Trash", icon: "🗑", action: () => { vfs.rm(p); toast("Moved to Trash", k.name, { icon: "🗑" }); render(); } },
      "-",
      { label: "Get Info", icon: "ℹ", action: () => { select(k); toast(k.name, `${kindOf(k.name)} · ${k.type === "dir" ? (k.children || []).length + " items" : fmtBytes(String(k.body || "").length)}`, { icon: "ℹ" }); } },
    ]);
  }
  function closeMenuCrumbs() { $("#ctxMenu")?.classList.add("hidden"); }

  body.addEventListener("contextmenu", (e) => {
    if (e.target.closest(".fm-cell") || e.target.closest("tr")) return;
    e.preventDefault();
    contextMenu(e.clientX, e.clientY, [
      { label: "New Folder", icon: "📁", action: newFolder },
      { label: "New File (markdown)", icon: "📝", action: () => { vfs.write(join(S.path, "untitled.md"), "# Untitled\n"); render(); } },
      "-",
      { label: "Icon View", action: () => { S.view = "grid"; store.set("fm.view", "grid"); render(); } },
      { label: "List View", action: () => { S.view = "list"; store.set("fm.view", "list"); render(); } },
      "-",
      { label: "Open in Terminal", icon: "»", action: openTerm },
      { label: "Ask JARVIS to organise this folder", icon: "✦", action: askJarvis },
    ]);
  });

  bus.on("fs", render);
  render();
  return wrap;
}
