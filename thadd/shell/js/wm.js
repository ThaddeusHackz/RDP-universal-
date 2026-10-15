/* ============================================================================
   THADD OS — window manager + shell chrome.
   Windows with drag/resize/snap, macOS-style traffic lights, a Windows-11 style
   centred dock, a Sequoia menu bar, Spotlight-style launcher, control centre,
   notification centre, toasts, lock screen and keyboard shortcuts.
   ========================================================================== */
(function () {
  "use strict";
  const h = THADD.h;
  const state = THADD.state;
  const WM = (THADD.wm = {});
  let z = 100;

  /* ------------------------------------------------------------------- chrome */
  function buildShell() {
    const desktop = THADD.$("#desktop");

    // menubar
    const brand = h("div", { class: "brand" },
      h("span", { class: "glyph" }),
      h("span", {}, "THADD OS"));
    brand.onclick = () => WM.toggleLauncher();
    const menus = h("div", { class: "menus" },
      ["Shell", "File", "View", "System", "Security", "AI", "Help"].map((m) =>
        h("span", { onclick: () => WM.menuAction(m) }, m)));
    const aiChip = h("div", { class: "chip", title: "Ask THADD AI (⌘K)" },
      h("span", {}, "✦"), h("span", { id: "ai-chip-label" }, "AI"));
    aiChip.onclick = () => THADD.apps.open("ai");
    const netChip = h("div", { class: "chip" }, h("span", { class: "dot", id: "net-dot" }), h("span", { id: "net-label" }, "online"));
    const cpuChip = h("div", { class: "chip", id: "cpu-chip" }, h("span", { id: "cpu-label" }, "cpu –"));
    const bell = h("div", { class: "chip", title: "Notifications" }, h("span", {}, "◔"), h("span", { id: "bell-count" }, ""));
    bell.onclick = () => WM.togglePanel("notifications");
    const power = h("div", { class: "chip", title: "Control centre" }, h("span", {}, "⏻"));
    power.onclick = () => WM.togglePanel("control");
    const clock = h("div", { class: "clock" }, h("b", { id: "clock-time" }, THADD.clock()), h("div", { id: "clock-date", style: { fontSize: "11px", opacity: .8 } }, ""));
    const menubar = h("div", { id: "menubar" }, brand, menus, h("div", { class: "spacer" }),
      aiChip, cpuChip, netChip, bell, power, clock);
    desktop.append(menubar);

    // desktop icons
    const icons = h("div", { id: "icons" });
    [["Project Files", "▤", () => THADD.apps.open("files", { path: "~" })],
     ["Home Folder", "⌂", () => THADD.apps.open("files", { path: "~/Projects" })],
     ["Security Center", "⛨", () => THADD.apps.open("security")],
     ["Forensics Lab", "⌗", () => THADD.apps.open("forensics")],
     ["THADD-OS-README", "≡", () => THADD.apps.open("editor", { path: "~/Desktop/THADD-OS-README.txt" })],
     ["Terminal", "▶", () => THADD.apps.open("terminal")]].forEach(([label, glyph, fn], i) => {
      const icon = h("div", { class: "desk-icon" }, h("div", { class: "glyph" }, glyph), h("div", { class: "label" }, label));
      icon.ondblclick = fn; icon.onclick = (e) => { THADD.$$(".desk-icon").forEach((n) => n.classList.remove("active")); icon.classList.add("active"); };
      icons.append(icon);
    });
    desktop.append(icons);

    // dock
    const dock = h("div", { id: "dock" });
    desktop.append(dock);

    // launcher
    const grid = h("div", { class: "app-grid", id: "app-grid" });
    const search = h("input", { placeholder: "Search apps, files, settings — or ask THADD AI…", autofocus: true, id: "launcher-search" });
    const launcher = h("div", { id: "launcher" },
      h("div", { class: "search" }, h("span", {}, "⌕"), search, h("span", { class: "hint" }, "↵ open · esc close")),
      grid);
    launcher.onclick = (e) => { if (e.target === launcher) WM.closeLauncher(); };
    desktop.append(launcher);
    search.oninput = () => renderLauncher(search.value);
    search.onkeydown = (e) => {
      if (e.key === "Enter") {
        const first = THADD.$(".app-tile", grid);
        if (search.value.trim() && search.value.trim().length > 3 && !first) {
          THADD.apps.open("ai", { prompt: search.value.trim() });
          WM.closeLauncher();
        } else if (first) { first.click(); WM.closeLauncher(); }
      } else if (e.key === "Escape") WM.closeLauncher();
    };

    // panels
    desktop.append(h("div", { class: "panel", id: "panel-control" }));
    desktop.append(h("div", { class: "panel", id: "panel-notifications" }));
    desktop.append(h("div", { id: "toasts" }));

    document.addEventListener("keydown", onKey);
    document.addEventListener("click", (e) => {
      const inside = e.target.closest(".panel") || e.target.closest("#menubar") || e.target.closest("#launcher");
      if (!inside) WM.closePanels();
    });
    document.addEventListener("contextmenu", (e) => { e.preventDefault(); WM.contextMenu(e); });
    document.addEventListener("mousemove", (e) => {
      if (dragCtx) doDrag(e, false);
      if (resizeCtx) doResize(e);
    });
    document.addEventListener("mouseup", (e) => {
      if (dragCtx) doDrag(e, true);
      if (resizeCtx) { resizeCtx = null; }
    });
  }

  /* ------------------------------------------------------------------ metrics */
  THADD.on("system.metrics", (m) => {
    state.metrics = m;
    const cpu = THADD.$("#cpu-label"), net = THADD.$("#net-label"), dot = THADD.$("#net-dot");
    if (cpu) cpu.textContent = `cpu ${m.cpu.percent.toFixed(0)}% · ram ${m.memory.percent.toFixed(0)}%`;
    if (net) {
      const total = Object.values(m.net || {}).reduce((a, b) => a + (b.rx || 0), 0);
      net.textContent = `↓ ${THADD.bytes(total)}`;
    }
    if (dot) dot.className = "dot" + (state.connected ? "" : " bad");
    THADD.emit("metrics.updated", m);
  });

  THADD.on("shell.notify", (n) => { state.notifications.push(n); renderNotifications(); toast(n.title, n.body, n.severity); });
  THADD.on("transport", () => renderStatus());
  THADD.on("settings.changed", (cfg) => { state.config = cfg; applyConfig(cfg); });

  function renderStatus() {
    const dot = THADD.$("#net-dot");
    if (dot) dot.className = "dot" + (state.connected ? "" : " bad");
    const label = THADD.$("#net-label");
    if (label) label.textContent = state.connected ? "live" : "rest";
  }

  /* --------------------------------------------------------------------- dock */
  function renderDock() {
    const dock = THADD.$("#dock");
    if (!dock) return;
    dock.innerHTML = "";
    const pinned = state.apps.filter((a) => a.pinned);
    const running = state.windows.map((w) => w.app);
    pinned.slice(0, 14).forEach((app) => {
      const item = h("div", { class: "dock-item" + (running.includes(app.id) ? " running" : ""), title: app.name },
        THADD.icon(app.icon), h("span", { class: "tip" }, app.name));
      item.onclick = () => THADD.apps.open(app.id);
      item.oncontextmenu = (e) => { e.preventDefault(); THADD.apps.open(app.id); };
      dock.append(item);
    });
    const launcherBtn = h("div", { class: "dock-item", title: "All apps" }, "⋯", h("span", { class: "tip" }, "All apps"));
    launcherBtn.onclick = () => WM.toggleLauncher();
    dock.append(launcherBtn);
  }

  function renderLauncher(query) {
    const grid = THADD.$("#app-grid");
    if (!grid) return;
    grid.innerHTML = "";
    const q = (query || "").trim().toLowerCase();
    const apps = state.apps.filter((a) => !q || a.name.toLowerCase().includes(q) || (a.desc || "").toLowerCase().includes(q)
      || (a.category || "").toLowerCase().includes(q));
    apps.forEach((app) => {
      const tile = h("div", { class: "app-tile" + (app.available ? "" : " missing"), title: app.desc || "" },
        h("div", { class: "glyph" }, THADD.icon(app.icon)),
        h("div", { class: "name" }, app.name));
      tile.onclick = () => { THADD.apps.open(app.id); WM.closeLauncher(); };
      grid.append(tile);
    });
    if (q) {
      const ask = h("div", { class: "app-tile" },
        h("div", { class: "glyph" }, "✦"), h("div", { class: "name" }, `Ask THADD AI: “${q}”`));
      ask.onclick = () => { THADD.apps.open("ai", { prompt: query }); WM.closeLauncher(); };
      grid.prepend(ask);
      const term = h("div", { class: "app-tile" }, h("div", { class: "glyph" }, "▶"), h("div", { class: "name" }, `Run in terminal`));
      term.onclick = () => { THADD.apps.open("terminal", { cmd: query }); WM.closeLauncher(); };
      grid.append(term);
    }
  }
  WM.renderLauncher = renderLauncher;

  /* ------------------------------------------------------------------ windows */
  WM.open = function (opts) {
    const { app = "app", title = "Window", width = 900, height = 620, body, footer, icon = "◆", onClose } = opts;
    const x = Math.max(40, Math.round((window.innerWidth - width) / 2 + (state.windows.length % 5) * 26 - 52));
    const y = Math.max(44, Math.round((window.innerHeight - height) / 2 - 30 + (state.windows.length % 5) * 22));
    const win = h("div", { class: "window", style: { left: x + "px", top: y + "px", width: width + "px", height: height + "px" } });
    const titleEl = h("div", { class: "title" }, title);
    const traffic = h("div", { class: "traffic" },
      h("i", { title: "close" }), h("i", { title: "minimise" }), h("i", { title: "maximise" }));
    const tools = h("div", { class: "tools" });
    const titlebar = h("div", { class: "titlebar" }, traffic, titleEl, tools);
    const winBody = h("div", { class: "window-body" });
    if (body && body.nodeType) winBody.append(body); else if (body) winBody.innerHTML = body;
    win.append(titlebar, winBody);
    if (footer) win.append(h("div", { class: "statusbar" }, footer.nodeType ? footer : h("span", {}, footer)));

    traffic.children[0].onclick = () => WM.close(rec.id);
    traffic.children[1].onclick = () => WM.minimize(rec.id);
    traffic.children[2].onclick = () => WM.maximize(rec.id);
    titlebar.ondblclick = () => WM.maximize(rec.id);
    titlebar.onmousedown = (e) => {
      if (e.target.closest(".traffic") || e.target.closest(".tools")) return;
      dragCtx = { rec, dx: e.clientX - rec.x, dy: e.clientY - rec.y };
    };
    win.onmousedown = () => WM.focus(rec.id);
    ["n", "s", "e", "w", "ne", "nw", "se", "sw"].forEach((dir) => {
      const grip = h("div", { class: "grip", style: {
        position: "absolute", zIndex: 3,
        left: dir.includes("w") ? 0 : dir.includes("e") ? "auto" : 0, right: dir.includes("e") ? 0 : "auto",
        top: dir.includes("n") ? 0 : dir.includes("s") ? "auto" : 0, bottom: dir.includes("s") ? 0 : "auto",
        width: dir.length === 2 ? "14px" : (dir === "n" || dir === "s" ? "100%" : "8px"),
        height: dir.length === 2 ? "14px" : (dir === "n" || dir === "s" ? "8px" : "100%"),
        cursor: dir.length === 2 ? dir + "-resize" : dir + "-resize",
      } });
      grip.onmousedown = (e) => { e.preventDefault(); resizeCtx = { rec, dir, startX: e.clientX, startY: e.clientY, w: rec.width, h: rec.height, x: rec.x, y: rec.y }; };
      win.append(grip);
    });

    const rec = { id: "w" + (++z), app, title, width, height, x, y, el: win, titleEl, tools, icon, onClose, maximized: false, minimized: false };
    state.windows.push(rec);
    THADD.$("#desktop").append(win);
    WM.focus(rec.id);
    renderDock();
    THADD.emit("window.opened", rec);
    return rec;
  };

  WM.focus = function (id) {
    state.windows.forEach((w) => {
      const focused = w.id === id;
      w.el.dataset.focused = focused ? "true" : "false";
      w.el.style.zIndex = focused ? ++z + 60 : w.el.style.zIndex;
    });
    state.active = id;
  };
  WM.close = function (id) {
    const rec = state.windows.find((w) => w.id === id);
    if (!rec) return;
    if (rec.onClose) { try { rec.onClose(); } catch (e) {} }
    rec.el.remove();
    state.windows = state.windows.filter((w) => w.id !== id);
    renderDock();
    if (state.windows.length) WM.focus(state.windows[state.windows.length - 1].id);
  };
  WM.minimize = function (id) {
    const rec = state.windows.find((w) => w.id === id);
    if (!rec) return;
    rec.minimized = !rec.minimized;
    rec.el.classList.toggle("minimized", rec.minimized);
  };
  WM.maximize = function (id) {
    const rec = state.windows.find((w) => w.id === id);
    if (!rec) return;
    if (rec.maximized) {
      Object.assign(rec.el.style, { left: rec.x + "px", top: rec.y + "px", width: rec.width + "px", height: rec.height + "px" });
      rec.el.classList.remove("maximized");
    } else {
      rec.saved = { x: rec.x, y: rec.y, w: rec.width, h: rec.height };
      Object.assign(rec.el.style, { left: "0px", top: "30px", width: "100vw", height: "calc(100vh - 30px)" });
      rec.el.classList.add("maximized");
    }
    rec.maximized = !rec.maximized;
  };
  WM.snap = function (id, side) {
    const rec = state.windows.find((w) => w.id === id);
    if (!rec) return;
    const half = Math.round(window.innerWidth / 2);
    const styles = {
      left: { left: "0px", top: "30px", width: half + "px", height: "calc(100vh - 30px)" },
      right: { left: half + "px", top: "30px", width: half + "px", height: "calc(100vh - 30px)" },
      full: { left: "0px", top: "30px", width: "100vw", height: "calc(100vh - 30px)" },
    }[side];
    rec.saved = { x: rec.x, y: rec.y, w: rec.width, h: rec.height };
    Object.assign(rec.el.style, styles);
  };

  let dragCtx = null, resizeCtx = null;
  function doDrag(e, end) {
    if (!dragCtx) return;
    const rec = dragCtx.rec;
    if (end) {
      const snap = e.clientX < 24 ? "left" : e.clientX > window.innerWidth - 24 ? "right" : e.clientY < 36 ? "full" : null;
      if (snap) WM.snap(rec.id, snap);
      rec.x = parseInt(rec.el.style.left, 10); rec.y = parseInt(rec.el.style.top, 10);
      dragCtx = null;
      return;
    }
    const nx = Math.max(-40, Math.min(window.innerWidth - 90, e.clientX - dragCtx.dx));
    const ny = Math.max(30, Math.min(window.innerHeight - 44, e.clientY - dragCtx.dy));
    rec.el.style.left = nx + "px";
    rec.el.style.top = ny + "px";
  }
  function doResize(e) {
    const { rec, dir, startX, startY, w, h: hh, x, y } = resizeCtx;
    const dx = e.clientX - startX, dy = e.clientY - startY;
    let nw = w, nh = hh, nx = x, ny = y;
    if (dir.includes("e")) nw = Math.max(420, w + dx);
    if (dir.includes("s")) nh = Math.max(240, hh + dy);
    if (dir.includes("w")) { nw = Math.max(420, w - dx); nx = x + (w - nw); }
    if (dir.includes("n")) { nh = Math.max(240, hh - dy); ny = y + (hh - nh); }
    Object.assign(rec.el.style, { width: nw + "px", height: nh + "px", left: nx + "px", top: ny + "px" });
    rec.width = nw; rec.height = nh; rec.x = nx; rec.y = ny;
  }

  /* ------------------------------------------------------------------- panels */
  WM.togglePanel = function (which) {
    const el = THADD.$(`#panel-${which}`);
    if (!el) return;
    const open = el.classList.contains("open");
    WM.closePanels();
    if (!open) {
      el.classList.add("open");
      which === "control" ? renderControl() : renderNotifications();
    }
  };
  WM.closePanels = () => THADD.$$(".panel").forEach((p) => p.classList.remove("open"));

  function renderControl() {
    const panel = THADD.$("#panel-control");
    const cfg = state.config || {};
    const m = state.metrics || { cpu: { percent: 0, temp: null }, memory: { percent: 0 } };
    const toggles = [
      ["Wi-Fi", "≈", true, "network"], ["Bluetooth", "✧", false, ""], ["Firewall", "⛨", true, "security"],
      ["Dark mode", "◐", (cfg.appearance || {}).theme !== "light", "theme"], ["Focus", "◎", false, ""],
      ["Screen record", "◉", false, "record"],
    ];
    panel.innerHTML = "";
    panel.append(h("h4", {}, "Control centre"));
    const grid = h("div", { class: "ctrl-grid" });
    toggles.forEach(([label, glyph, on, action]) => {
      const c = h("div", { class: "ctrl" + (on ? " on" : "") }, h("div", { class: "glyph" }, glyph), h("div", {}, label));
      c.onclick = async () => {
        if (action === "theme") {
          const next = (cfg.appearance || {}).theme === "light" ? "dark" : "light";
          await THADD.call("settings.apply", { patch: { appearance: { theme: next } } });
        } else if (action === "record") {
          THADD.apps.open("recorder");
        } else if (action === "network") {
          const net = await THADD.call("system.network", {});
          THADD.toast("Network", `${(net.interfaces || []).length} interfaces · ${net.default_route || "no default route"}`, "info");
        } else if (action === "security") {
          const p = await THADD.call("security.posture", {});
          THADD.toast(`Posture ${p.score}/100 (${p.grade})`, `${p.total - p.passed} open findings`, p.score > 90 ? "success" : "warning");
        }
      };
      grid.append(c);
    });
    panel.append(grid);
    panel.append(h("h4", {}, "Performance"));
    panel.append(h("div", { class: "card" },
      h("h5", {}, "CPU " + (m.cpu.percent || 0).toFixed(0) + "%" + (m.cpu.temp ? ` · ${m.cpu.temp}°C` : "")),
      h("div", { class: "bar" }, h("i", { style: { width: (m.cpu.percent || 0) + "%" } })),
      h("h5", { style: { marginTop: "10px" } }, "Memory " + (m.memory.percent || 0).toFixed(0) + "% · " + THADD.bytes(m.memory.used) + " / " + THADD.bytes(m.memory.total)),
      h("div", { class: "bar" }, h("i", { style: { width: (m.memory.percent || 0) + "%" } })),
      h("div", { class: "sub" }, `${m.processes || 0} processes · uptime ${Math.floor((m.uptime || 0) / 3600)}h ${Math.floor(((m.uptime || 0) % 3600) / 60)}m`)));
    const actions = h("div", { class: "ctrl-grid", style: { marginTop: "12px" } });
    [["Task manager", "▦", () => THADD.apps.open("taskmgr")],
     ["Security scan", "⛨", () => THADD.apps.open("security")],
     ["Ask THADD AI", "✦", () => THADD.apps.open("ai")],
     ["Snapshot now", "⟲", async () => {
        const s = await THADD.call("snapshots.create", { label: "manual (control centre)" });
        THADD.toast("Snapshot created", `${s.file_count} files · ${THADD.bytes(s.bytes)}`, "success");
      }]].forEach(([label, glyph, fn]) => {
      const c = h("div", { class: "ctrl" }, h("div", { class: "glyph" }, glyph), h("div", {}, label));
      c.onclick = fn; actions.append(c);
    });
    panel.append(actions);
  }

  function renderNotifications() {
    const panel = THADD.$("#panel-notifications");
    if (!panel) return;
    panel.innerHTML = "";
    panel.append(h("h4", {}, "Notifications"));
    if (!state.notifications.length) panel.append(h("div", { class: "sub", style: { color: "var(--dim)", fontSize: "12.5px" } }, "Nothing new. THADD will tell you when something needs attention."));
    state.notifications.slice(-12).reverse().forEach((n) => {
      panel.append(h("div", { class: "notice" + (n.read ? "" : " unread") },
        h("div", { class: "glyph" }, n.severity === "error" ? "!" : n.severity === "warning" ? "⚠" : "◆"),
        h("div", { class: "body" }, h("b", {}, n.title), h("span", {}, n.body || "")),
        h("div", { class: "time" }, THADD.ago(n.time))));
    });
    const clear = h("button", { class: "btn ghost" }, "Clear all");
    clear.onclick = async () => { await THADD.call("shell.notification_clear", {}); state.notifications = []; renderNotifications(); };
    panel.append(clear);
  }
  WM.renderNotifications = renderNotifications;

  function toast(title, body, kind) {
    const box = THADD.$("#toasts");
    if (!box) return;
    const t = h("div", { class: "toast" }, h("b", {}, title), body ? h("p", {}, body) : null);
    box.append(t);
    setTimeout(() => { t.style.opacity = "0"; t.style.transition = "opacity .4s"; setTimeout(() => t.remove(), 420); }, 5200);
  }
  THADD.on("shell.toast", (d) => toast(d.title, d.body, d.kind));

  /* ------------------------------------------------------------------ launcher */
  WM.toggleLauncher = function () {
    const l = THADD.$("#launcher");
    const open = l.classList.toggle("open");
    if (open) { renderLauncher(""); const s = THADD.$("#launcher-search"); if (s) { s.value = ""; s.focus(); } }
  };
  WM.closeLauncher = () => THADD.$("#launcher").classList.remove("open");
  WM.openLauncher = () => { const l = THADD.$("#launcher"); if (!l.classList.contains("open")) WM.toggleLauncher(); };

  WM.menuAction = function (name) {
    const map = {
      Shell: () => THADD.apps.open("settings"),
      File: () => THADD.apps.open("files"),
      View: () => THADD.apps.open("monitor"),
      System: () => THADD.apps.open("taskmgr"),
      Security: () => THADD.apps.open("security"),
      AI: () => THADD.apps.open("ai"),
      Help: () => THADD.apps.open("help"),
    };
    (map[name] || (() => {}))();
  };

  /* --------------------------------------------------------------- context menu */
  WM.contextMenu = function (e) {
    const old = THADD.$("#ctx"); if (old) old.remove();
    const items = [
      ["New terminal here", () => THADD.apps.open("terminal")],
      ["New file…", async () => {
        const name = prompt("File name", "~/Desktop/untitled.txt");
        if (name) { await THADD.call("fs.write", { path: name, text: "" }); THADD.toast("Created", name, "success"); }
      }],
      ["Open Files", () => THADD.apps.open("files")],
      ["Ask THADD AI about the desktop", () => THADD.apps.open("ai", { prompt: "What can I do from the desktop right now?" })],
      ["Take screenshot", async () => { const r = await THADD.call("shell.screenshot", {}); THADD.toast("Screenshot saved", r.path, "success"); }],
      ["System monitor", () => THADD.apps.open("monitor")],
    ];
    const menu = h("div", { id: "ctx", class: "panel open", style: { left: e.clientX + "px", top: e.clientY + "px", right: "auto", width: "250px", padding: "8px" } });
    items.forEach(([label, fn]) => {
      const item = h("div", { class: "row" }, h("div", { class: "t" }, h("b", {}, label)));
      item.onclick = () => { menu.remove(); fn(); };
      menu.append(item);
    });
    document.body.append(menu);
    setTimeout(() => document.addEventListener("click", () => menu.remove(), { once: true }), 10);
  };

  /* ------------------------------------------------------------ lock & power */
  WM.lock = function () {
    const lock = THADD.$("#lock");
    lock.classList.add("open");
    const t = THADD.$("#lock-time"); if (t) t.textContent = THADD.clock();
    const input = THADD.$("#lock-pass"); if (input) { input.value = ""; input.focus(); }
  };
  WM.unlock = () => THADD.$("#lock").classList.remove("open");

  /* -------------------------------------------------------------- shortcuts */
  function onKey(e) {
    const meta = e.metaKey || e.ctrlKey;
    if (meta && e.key.toLowerCase() === "k") { e.preventDefault(); THADD.openAI ? THADD.openAI() : THADD.apps.open("ai"); }
    else if (meta && e.key === " ") { e.preventDefault(); WM.toggleLauncher(); }
    else if (meta && e.key.toLowerCase() === "t") { e.preventDefault(); THADD.apps.open("terminal"); }
    else if (meta && e.key.toLowerCase() === "e") { e.preventDefault(); THADD.apps.open("files"); }
    else if (meta && e.key.toLowerCase() === "l") { e.preventDefault(); WM.lock(); }
    else if (meta && e.key.toLowerCase() === "w") { e.preventDefault(); if (state.active) WM.close(state.active); }
    else if (meta && e.key.toLowerCase() === "m") { e.preventDefault(); if (state.active) WM.minimize(state.active); }
    else if (meta && e.shiftKey && e.key.toLowerCase() === "q") { e.preventDefault(); THADD.call("system.power", { action: "logout" }); }
    else if (e.key === "Escape") { WM.closeLauncher(); WM.closePanels(); }
  }

  /* ------------------------------------------------------------------ startup */
  THADD.wm.build = async function () {
    state.apps = (await THADD.call("shell.apps", {})).apps;
    const boot = await THADD.call("boot.hello", {});
    state.config = boot.config;
    state.notifications = boot.notifications || [];
    buildShell();
    applyConfig(boot.config);
    renderDock();
    renderStatus();
    renderNotifications();
    if (boot.os && boot.os.hostname) document.title = `THADD OS — ${boot.os.hostname}`;
    const dateEl = THADD.$("#clock-date");
    if (dateEl) dateEl.textContent = new Date().toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });
    setInterval(() => {
      const t = THADD.$("#clock-time"); if (t) t.textContent = THADD.clock();
    }, 15000);
    const bell = THADD.$("#bell-count");
    const unread = state.notifications.filter((n) => !n.read).length;
    if (bell) bell.textContent = unread ? String(unread) : "";
    const aiLabel = THADD.$("#ai-chip-label");
    if (aiLabel) aiLabel.textContent = boot.ai_ready ? "AI ready" : "AI offline";
    THADD.emit("shell.ready", boot);
  };

  function applyConfig(cfg) {
    if (!cfg) return;
    const theme = (cfg.appearance || {}).theme || "dark";
    document.documentElement.dataset.theme = theme === "light" ? "light" : "dark";
    const accent = (cfg.appearance || {}).accent;
    if (accent) {
      document.documentElement.style.setProperty("--accent", accent);
    }
    const dockPos = (cfg.appearance || {}).dock_position || "bottom";
    const dock = THADD.$("#dock");
    if (dock) { dock.className = dockPos === "left" ? "left" : dockPos === "top" ? "top" : ""; }
    if ((cfg.appearance || {}).wallpaper) THADD.emit("wallpaper.set", cfg.appearance.wallpaper);
    const scale = (cfg.appearance || {}).font_scale || 1;
    document.body.style.fontSize = (13.5 * scale) + "px";
  }
  WM.applyConfig = applyConfig;
})();
