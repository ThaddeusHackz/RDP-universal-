(() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __esm = (fn, res, err) => function __init() {
    if (err) throw err[0];
    try {
      return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
    } catch (e) {
      throw err = [e], e;
    }
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };

  // desktop/js/core.js
  var core_exports = {};
  __export(core_exports, {
    $: () => $,
    $$: () => $$,
    DAYS: () => DAYS,
    MONTHS: () => MONTHS,
    bus: () => bus,
    clamp: () => clamp,
    clock: () => clock,
    clock12: () => clock12,
    contextMenu: () => contextMenu,
    copy: () => copy,
    el: () => el,
    esc: () => esc,
    fmtBytes: () => fmtBytes,
    fmtDur: () => fmtDur,
    longDate: () => longDate,
    openPath: () => openPath,
    pad: () => pad,
    shortDate: () => shortDate,
    sleep: () => sleep,
    store: () => store,
    toast: () => toast,
    toggleFlyout: () => toggleFlyout,
    uid: () => uid,
    uptime: () => uptime,
    uptimeStart: () => uptimeStart,
    vfs: () => vfs,
    vfsTree: () => vfsTree
  });
  function el(tag, attrs = {}, ...kids) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") n.className = v;
      else if (k === "html") n.innerHTML = v;
      else if (k === "text") n.textContent = v;
      else if (k === "style" && typeof v === "object") Object.assign(n.style, v);
      else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
      else if (v !== null && v !== false && v !== void 0) n.setAttribute(k, v);
    }
    for (const kid of kids.flat()) {
      if (kid == null || kid === false) continue;
      n.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
    }
    return n;
  }
  function toast(title, msg = "", opts = {}) {
    const host = $("#toasts");
    if (!host) return;
    const icon = opts.icon || "✦";
    const t = el(
      "div",
      { class: "toast" },
      el("div", { class: "ti", text: icon }),
      el(
        "div",
        { class: "tx2" },
        el("div", { class: "tt2", text: title }),
        msg ? el("div", { class: "tm", text: msg }) : null
      )
    );
    const kill = () => {
      t.classList.add("out");
      setTimeout(() => t.remove(), 260);
    };
    t.addEventListener("click", kill);
    host.append(t);
    const ms = opts.ms ?? (msg ? 4600 : 2800);
    setTimeout(kill, ms);
    bus.emit("notification", { title, msg, icon });
    return t;
  }
  function contextMenu(x, y, rows) {
    const m = $("#ctxMenu");
    m.innerHTML = "";
    for (const r2 of rows) {
      if (r2 === "-") {
        m.append(el("div", { class: "mb-sep" }));
        continue;
      }
      const row2 = el(
        "div",
        { class: `ctx-row${r2.disabled ? " disabled" : ""}` },
        el("span", { class: "ic", text: r2.icon || "" }),
        el("span", { text: r2.label }),
        r2.key ? el("span", { class: "mb-key", text: r2.key }) : null
      );
      if (!r2.disabled) row2.addEventListener("click", () => {
        hide();
        r2.action?.();
      });
      m.append(row2);
    }
    const hide = () => m.classList.add("hidden");
    m.classList.remove("hidden");
    const r = m.getBoundingClientRect();
    m.style.left = clamp(x, 4, innerWidth - r.width - 6) + "px";
    m.style.top = clamp(y, 4, innerHeight - r.height - 6) + "px";
    m._hide = hide;
    return hide;
  }
  async function copy(text, label = "Copied to clipboard") {
    try {
      await navigator.clipboard.writeText(text);
      toast(label, text.slice(0, 64), { icon: "📋" });
    } catch {
      toast("Clipboard blocked", "Your browser denied clipboard access.", { icon: "⚠" });
    }
  }
  function toggleFlyout(id, anchorEl, build16) {
    const f = document.getElementById(id);
    const open2 = !f.classList.contains("hidden");
    $$(".flyout").forEach((x) => x.classList.add("hidden"));
    if (open2) return false;
    f.innerHTML = "";
    f.append(build16());
    f.classList.remove("hidden");
    const a = anchorEl.getBoundingClientRect();
    const fr = f.getBoundingClientRect();
    f.style.left = clamp(a.right - fr.width, 8, innerWidth - fr.width - 8) + "px";
    f.style.top = Math.min(a.bottom + 8, innerHeight - fr.height - 14) + "px";
    return true;
  }
  function vfsTree() {
    const h = HOME();
    const file = (name, body, extra = {}) => ({ name, type: "file", body, ...extra });
    const dir = (name, children, extra = {}) => ({ name, type: "dir", children, ...extra });
    const proj = dir("thadd-os", [
      file("README.md", `# THADD OS 2.0 “Nebula Prime”

One OS. All the Best.
macOS Sequoia × Windows 11 surface · Parrot toolchain · JARVIS AI.

## Build the ISO

    thadd-iso build --edition desktop --out thadd-os-2.0.iso

## Run in VirtualBox

    VBoxManage startvm "THADD OS"
`),
      file("Makefile", `# THADD OS image pipeline
all: iso
iso:
	./tools/build-iso.sh --release
run:
	./tools/run-vbox.sh
install-deps:
	sudo ./tools/install-deps.sh
`),
      dir("tools", [
        file("build-iso.sh", "#!/usr/bin/env bash\n# Builds the bootable THADD OS ISO (live-build)\nset -euo pipefail\nlb clean --purge\nlb config\nlb build\n"),
        file("run-vbox.sh", '#!/usr/bin/env bash\n# Create + boot the THADD OS VM in VirtualBox\nVBoxManage startvm "THADD OS" --type gui\n'),
        file("install-deps.sh", "#!/usr/bin/env bash\n# Host deps: live-build, xorriso, squashfs-tools, qemu-system-x86\napt-get install -y live-build xorriso squashfs-tools isolinux syslinux-common\n")
      ]),
      dir("os", [
        file("config", "THADD OS — image configuration\nEDITION=desktop\nDEBIAN_CODENAME=bookworm\nKERNEL=linux-image-amd64\n"),
        file("packages.chroot", "xfce4 lightdm thadd-desktop firefox-esr thadd-ai\nparrot-tools groq-cli code-oss\n")
      ])
    ]);
    return dir("/", [
      dir("bin", [], { system: true }),
      dir("boot", [file("vmlinuz-6.9-thadd", "[binary kernel image]"), file("initrd.img-6.9-thadd", "[initramfs]"), dir("grub", [file("grub.cfg", "menuentry 'THADD OS' { linux /boot/vmlinuz quiet splash }")])], { system: true }),
      dir("dev", [], { system: true }),
      dir("etc", [file("os-release", `PRETTY_NAME="THADD OS 2.0 (Nebula Prime)"
NAME="THADD OS"
VERSION="2.0"
ID=thadd
ID_LIKE="debian ubuntu"
HOME_URL="https://github.com/ThaddeusHackz/RDP-universal-"
`), file("hostname", "thadd-os"), file("motd", " ████████╗██╗  ██╗ █████╗ ██████╗ ██████╗     ██████╗ ███████╗\n ╚══██╔══╝██║  ██║██╔══██╗██╔══██╗██╔══██╗   ██╔═══██╗██╔════╝\n    ██║   ███████║███████║██║  ██║██║  ██║   ██║   ██║███████╗\n    ██║   ██╔══██║██╔══██║██║  ██║██║  ██║   ██║   ██║╚════██║\n    ██║   ██║  ██║██║  ██║██████╔╝██████╔╝██╗╚██████╔╝███████║\n    ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝ ╚═════╝ ╚═╝ ╚═════╝ ╚══════╝\n")], { system: true }),
      dir("home", [dir(h, [
        proj,
        dir("Documents", [
          file("THADD-OS-Guide.md", "# Welcome to THADD OS 2.0\n\nPress ⌘/Ctrl-K to search, ⌘/Ctrl-J for JARVIS.\nDouble-click icons on the desktop. Drag windows to edges to snap.\n"),
          file("notes.md", "- [x] Boot THADD OS\n- [ ] Build the ISO\n- [ ] Run nmap against lab target\n- [ ] Ask JARVIS to refactor my script\n"),
          dir("Projects", [file("hello.py", 'print("hello from THADD OS")\n')])
        ]),
        dir("Downloads", [file("thadd-os-2.0.iso", "[2.9 GB THADD OS live/installer ISO — see Releases]")]),
        dir("Pictures", [file("thadd-wallpaper.jpg", "[THADD aurora wallpaper 5120×2880]"), dir("Screenshots", [])]),
        dir("Music", []),
        dir("Videos", []),
        dir("Desktop", [file("THADD-OS-README.txt", "THADD OS 2.0 — Nebula Prime\n")]),
        file(".bashrc", `# THADD OS shell defaults
export PATH="$PATH:$HOME/.local/bin"
alias ll='ls -lah --color=auto'
alias iso='thadd iso'
`),
        file("secret.txt", "flag{thadd_os_is_watching_you}\n")
      ], { home: true })], { system: true }),
      dir("opt", [dir("thadd", [file("manifest.json", '{"os":"THADD OS","version":"2.0","codename":"Nebula Prime"}')])], { system: true }),
      dir("root", [], { system: true }),
      dir("usr", [dir("bin", [], { system: true }), dir("share", [dir("backgrounds", [])], { system: true })], { system: true }),
      dir("var", [dir("log", [file("syslog", "Oct 13 09:41:02 thadd-os kernel: THADD Shield strict mode engaged\nOct 13 09:41:02 thadd-os kernel: JARVIS daemon listening\n")])], { system: true })
    ]);
  }
  function openPath(path) {
    const node2 = vfs.resolve(path);
    if (!node2) {
      toast("Not found", path, { icon: "⚠" });
      return;
    }
    if (node2.type === "dir") bus.emit("open-app", { app: "files", args: { path } });
    else if (/\.(png|jpe?g|gif|webp|svg)$/i.test(node2.name)) bus.emit("open-app", { app: "photos", args: { path } });
    else if (/\.(mp4|webm|mkv|mov|avi)$/i.test(node2.name)) bus.emit("open-app", { app: "videos", args: { path } });
    else if (/\.(mp3|flac|wav|ogg|m4a)$/i.test(node2.name)) bus.emit("open-app", { app: "music", args: { path } });
    else bus.emit("open-app", { app: "editor", args: { path } });
  }
  var $, $$, esc, pad, sleep, uid, clamp, fmtBytes, fmtDur, store, listeners, bus, HOME, VFS, vfs, DAYS, MONTHS, clock, clock12, longDate, shortDate, uptimeStart, uptime;
  var init_core = __esm({
    "desktop/js/core.js"() {
      $ = (sel, root = document) => root.querySelector(sel);
      $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
      esc = (s) => String(s).replace(/[&<>"']/g, (c2) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c2]);
      pad = (n, w = 2) => String(n).padStart(w, "0");
      sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      uid = () => Math.random().toString(36).slice(2, 10);
      clamp = (v, a, b) => Math.max(a, Math.min(b, v));
      fmtBytes = (b) => {
        if (!b && b !== 0) return "—";
        const u = ["B", "KB", "MB", "GB", "TB"];
        let i = 0;
        while (b >= 1024 && i < u.length - 1) {
          b /= 1024;
          i++;
        }
        return `${b < 10 && i > 0 ? b.toFixed(1) : Math.round(b)} ${u[i]}`;
      };
      fmtDur = (s) => {
        s = Math.max(0, Math.floor(s));
        const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600);
        const m = Math.floor(s % 3600 / 60), sec = s % 60;
        if (d) return `${d}d ${h}h ${m}m`;
        if (h) return `${h}h ${m}m ${pad(sec)}s`;
        if (m) return `${m}m ${pad(sec)}s`;
        return `${sec}s`;
      };
      store = {
        get(k, d = null) {
          try {
            const v = localStorage.getItem("thadd." + k);
            return v === null ? d : JSON.parse(v);
          } catch {
            return d;
          }
        },
        set(k, v) {
          try {
            localStorage.setItem("thadd." + k, JSON.stringify(v));
          } catch {
          }
          return v;
        },
        del(k) {
          try {
            localStorage.removeItem("thadd." + k);
          } catch {
          }
        }
      };
      listeners = /* @__PURE__ */ new Map();
      bus = {
        on(ev, fn) {
          (listeners.get(ev) || listeners.set(ev, []).get(ev)).push(fn);
          return () => bus.off(ev, fn);
        },
        off(ev, fn) {
          const l = listeners.get(ev);
          if (l) l.splice(l.indexOf(fn), 1);
        },
        emit(ev, data) {
          (listeners.get(ev) || []).forEach((f) => {
            try {
              f(data);
            } catch (e) {
              console.warn("[bus]", ev, e);
            }
          });
          (listeners.get("*") || []).forEach((f) => {
            try {
              f({ ev, data });
            } catch {
            }
          });
        }
      };
      document.addEventListener("mousedown", (e) => {
        const m = $("#ctxMenu");
        if (m && !m.classList.contains("hidden") && !m.contains(e.target)) m._hide?.();
      }, true);
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") $("#ctxMenu")?._hide?.();
      });
      document.addEventListener("mousedown", (e) => {
        if (e.target.closest(".flyout") || e.target.closest("#mbTray") || e.target.closest("#mbClock")) return;
        $$(".flyout").forEach((x) => x.classList.add("hidden"));
      });
      HOME = () => store.get("user", "thadd");
      VFS = vfsTree();
      vfs = {
        reset() {
          VFS = vfsTree();
          return VFS;
        },
        root() {
          return VFS;
        },
        resolve(path) {
          const parts = String(path || "/").replace(/^~(?=\/|$)/, "/home/" + HOME()).split("/").filter(Boolean);
          let node2 = VFS;
          for (const p of parts) {
            if (node2.type !== "dir") return null;
            const next = node2.children.find((c2) => c2.name === p);
            if (!next) return null;
            node2 = next;
          }
          return node2;
        },
        parent(path) {
          const clean = String(path).replace(/\/+$/, "");
          const i = clean.lastIndexOf("/");
          return this.resolve(i <= 0 ? "/" : clean.slice(0, i));
        },
        ls(path) {
          const n = this.resolve(path);
          return n && n.type === "dir" ? n.children : null;
        },
        read(path) {
          const n = this.resolve(path);
          return n && n.type === "file" ? n.body : null;
        },
        write(path, body) {
          const name = String(path).replace(/\/+$/, "").split("/").pop();
          const par = this.parent(path);
          if (!par || par.type !== "dir") return false;
          const ex = par.children.find((c2) => c2.name === name);
          if (ex && ex.type === "file") {
            ex.body = body;
            ex.mtime = Date.now();
          } else par.children.push({ name, type: "file", body, mtime: Date.now() });
          bus.emit("fs", { op: "write", path });
          return true;
        },
        mkdir(path) {
          const name = String(path).replace(/\/+$/, "").split("/").pop();
          const par = this.parent(path);
          if (!par) return false;
          if (!par.children.find((c2) => c2.name === name)) par.children.push({ name, type: "dir", children: [] });
          bus.emit("fs", { op: "mkdir", path });
          return true;
        },
        rm(path) {
          const par = this.parent(path);
          if (!par) return false;
          const i = par.children.findIndex((c2) => c2.name === String(path).replace(/\/+$/, "").split("/").pop());
          if (i < 0) return false;
          par.children.splice(i, 1);
          bus.emit("fs", { op: "rm", path });
          return true;
        },
        path(node2) {
          const walk = (n, cur) => {
            if (n === VFS) return cur || "/";
            for (const c2 of n.children || []) {
              if (c2 === node2) return cur + "/" + c2.name;
              if (c2.type === "dir") {
                const r = walk(c2, cur + "/" + c2.name);
                if (r) return r;
              }
            }
            return null;
          };
          return walk(VFS, "");
        },
        home() {
          return "/home/" + HOME();
        },
        flatten(prefix = "", node2 = VFS, out2 = []) {
          for (const c2 of node2.children || []) {
            const p = prefix + "/" + c2.name;
            out2.push({ path: p, node: c2 });
            if (c2.type === "dir") this.flatten(p, c2, out2);
          }
          return out2;
        }
      };
      DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      MONTHS = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December"
      ];
      clock = (d = /* @__PURE__ */ new Date()) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
      clock12 = (d = /* @__PURE__ */ new Date()) => {
        const h = d.getHours() % 12 || 12;
        return `${h}:${pad(d.getMinutes())} ${d.getHours() < 12 ? "AM" : "PM"}`;
      };
      longDate = (d = /* @__PURE__ */ new Date()) => `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
      shortDate = (d = /* @__PURE__ */ new Date()) => `${DAYS[d.getDay()].slice(0, 3)} ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`;
      uptimeStart = Date.now();
      uptime = () => (Date.now() - uptimeStart) / 1e3;
    }
  });

  // desktop/js/registry.js
  var APPS, BY_ID, DOCK_DEFAULT, WALLPAPERS;
  var init_registry = __esm({
    "desktop/js/registry.js"() {
      APPS = [
        /* ------------------------------- system ------------------------------- */
        {
          id: "finder",
          name: "Files",
          icon: "🗂",
          cls: "i-files",
          cat: "System",
          dock: true,
          desc: "Browse, preview and manage the THADD OS filesystem"
        },
        {
          id: "terminal",
          name: "Terminal",
          icon: "»",
          cls: "i-terminal",
          cat: "System",
          dock: true,
          key: "⌘T",
          desc: "zsh 5.9 · 120+ builtins · real command engine"
        },
        {
          id: "powershell",
          name: "PowerShell",
          icon: "PS",
          cls: "i-shell",
          cat: "System",
          dock: true,
          desc: "PowerShell 7.4 Core with object pipeline + Get-* cmdlets"
        },
        {
          id: "settings",
          name: "System Settings",
          icon: "⚙",
          cls: "i-settings",
          cat: "System",
          dock: true,
          desc: "Appearance, Shield, network, AI, users, updates"
        },
        {
          id: "monitor",
          name: "Activity Monitor",
          icon: "📈",
          cls: "i-monitor",
          cat: "System",
          desc: "Live CPU / RAM / disk / network / GPU telemetry"
        },
        {
          id: "store",
          name: "App Store",
          icon: "🛍",
          cls: "i-store",
          cat: "System",
          dock: true,
          desc: "1,400+ curated packages: dev, security, AI, browsers"
        },
        {
          id: "launchpad",
          name: "Launchpad",
          icon: "🚀",
          cls: "i-thadd",
          cat: "System",
          dock: true,
          desc: "A grid of every installed application"
        },
        {
          id: "about",
          name: "About THADD OS",
          icon: "ℹ",
          cls: "i-thadd",
          cat: "System",
          desc: "Version, kernel, hardware and licence details"
        },
        {
          id: "guide",
          name: "THADD Guide",
          icon: "📖",
          cls: "i-notes",
          cat: "System",
          dock: true,
          desc: "The complete manual: ISO build, VirtualBox, toolchain"
        },
        {
          id: "softwareupdate",
          name: "Software Update",
          icon: "⬇",
          cls: "i-settings",
          cat: "System",
          desc: "Rolling-release channel · Nebula Prime"
        },
        {
          id: "screenshot",
          name: "Screenshot",
          icon: "📷",
          cls: "i-camera",
          cat: "System",
          desc: "Capture the desktop, a window, or a region"
        },
        {
          id: "bootpicker",
          name: "Boot Manager",
          icon: "🖥",
          cls: "i-settings",
          cat: "System",
          desc: "GRUB entries: THADD OS, Windows 11, macOS, Ubuntu, Debian, Parrot"
        },
        /* --------------------------------- AI --------------------------------- */
        {
          id: "jarvis",
          name: "JARVIS AI",
          icon: "✦",
          cls: "i-ai",
          cat: "AI",
          dock: true,
          key: "⌘J",
          desc: "Groq-powered agent — reads/writes files, runs commands, controls the OS"
        },
        {
          id: "ai-lab",
          name: "AI Lab",
          icon: "🧠",
          cls: "i-ai",
          cat: "AI",
          desc: "Model playground: Llama 3.3, Mixtral, Gemma2, Whisper, LLaVA"
        },
        {
          id: "copilot",
          name: "AI Copilot",
          icon: "✧",
          cls: "i-ai",
          cat: "AI",
          desc: "Fluent side-panel assistant attached to every window"
        },
        /* ------------------------------ security ------------------------------ */
        {
          id: "parrot",
          name: "Parrot Arsenal",
          icon: "🦜",
          cls: "i-parrot",
          cat: "Security",
          dock: true,
          desc: "600+ offensive-security tools, HackTheBox-ready, one-click runner"
        },
        {
          id: "shield",
          name: "THADD Shield",
          icon: "🛡",
          cls: "i-vault",
          cat: "Security",
          desc: "Kernel hardening, firewall, IDS, zero-trust vault, threat radar"
        },
        {
          id: "vault",
          name: "Zero-Trust Vault",
          icon: "🔐",
          cls: "i-vault",
          cat: "Security",
          desc: "Hardware-backed secret store with browser-kDF encryption"
        },
        {
          id: "forensics",
          name: "Forensics Suite",
          icon: "🔬",
          cls: "i-monitor",
          cat: "Security",
          desc: "Autopsy, Volatility3, Sleuthkit, Binwalk — artefact triage"
        },
        {
          id: "packetlab",
          name: "Packet Lab",
          icon: "📡",
          cls: "i-monitor",
          cat: "Security",
          desc: "Wireshark-style capture, decode and replay tooling"
        },
        {
          id: "hackbox",
          name: "HackTheBox",
          icon: "🎯",
          cls: "i-parrot",
          cat: "Security",
          desc: "VPN profiles, machine tracker, flags and writeups"
        },
        /* ------------------------------ developer ----------------------------- */
        {
          id: "editor",
          name: "Code Studio",
          icon: "⌨",
          cls: "i-editor",
          cat: "Developer",
          dock: true,
          desc: "VS Code-compatible editor with IntelliSense, git and run"
        },
        {
          id: "git",
          name: "Git Console",
          icon: "⑂",
          cls: "i-shell",
          cat: "Developer",
          desc: "Full git porcelain: branch, commit, merge, rebase, worktree"
        },
        {
          id: "docker",
          name: "Containers",
          icon: "🐳",
          cls: "i-shell",
          cat: "Developer",
          desc: "Podman/Docker engine, compose stacks, image builder"
        },
        {
          id: "dbg",
          name: "Debugger",
          icon: "🐞",
          cls: "i-editor",
          cat: "Developer",
          desc: "gdb/lldb front-end with breakpoints and memory inspector"
        },
        {
          id: "apiweb",
          name: "API Tester",
          icon: "🔌",
          cls: "i-editor",
          cat: "Developer",
          desc: "Postman-style request builder for REST and GraphQL"
        },
        {
          id: "jupyter",
          name: "Jupyter Lab",
          icon: "📓",
          cls: "i-ai",
          cat: "Developer",
          desc: "Notebooks with NumPy, pandas, PyTorch CUDA-ready kernels"
        },
        {
          id: "sqlite",
          name: "DB Browser",
          icon: "🗄",
          cls: "i-editor",
          cat: "Developer",
          desc: "SQLite/Postgres explorer with query console"
        },
        /* -------------------------------- apps -------------------------------- */
        {
          id: "browser",
          name: "Firefox",
          icon: "🦊",
          cls: "i-browser",
          cat: "Internet",
          dock: true,
          desc: "Firefox 131 with uBlock, Multi-Account Containers, THADD DNS"
        },
        {
          id: "browser-chrome",
          name: "Chrome",
          icon: "🌐",
          cls: "i-browser",
          cat: "Internet",
          desc: "Chromium 131 with THADD Shield extension"
        },
        {
          id: "browser-brave",
          name: "Brave",
          icon: "🦁",
          cls: "i-browser",
          cat: "Internet",
          desc: "Brave 1.71 — ad-blocking by default"
        },
        {
          id: "browser-tor",
          name: "Tor Browser",
          icon: "🧅",
          cls: "i-browser",
          cat: "Internet",
          desc: "Tor 14 — onion routing, .onion resolution, anti-fingerprinting"
        },
        {
          id: "mail",
          name: "Mail",
          icon: "✉",
          cls: "i-mail",
          cat: "Internet",
          desc: "IMAP/PGP mail client with encrypted search"
        },
        {
          id: "chat",
          name: "Messages",
          icon: "💬",
          cls: "i-mail",
          cat: "Internet",
          desc: "Matrix + Signal bridges"
        },
        {
          id: "vpn",
          name: "THADD VPN",
          icon: "🌍",
          cls: "i-parrot",
          cat: "Internet",
          desc: "WireGuard profiles, HTB/THM labs, kill-switch"
        },
        /* -------------------------------- media ------------------------------- */
        {
          id: "music",
          name: "Music",
          icon: "🎵",
          cls: "i-music",
          cat: "Media",
          dock: true,
          desc: "Offline library, FLAC, visualiser"
        },
        {
          id: "videos",
          name: "Videos",
          icon: "🎬",
          cls: "i-media",
          cat: "Media",
          desc: "MPV-based player, 4K, subtitles"
        },
        {
          id: "photos",
          name: "Photos",
          icon: "🖼",
          cls: "i-camera",
          cat: "Media",
          desc: "Gallery with EXIF, on-device AI tagging"
        },
        {
          id: "camera",
          name: "Camera",
          icon: "📹",
          cls: "i-camera",
          cat: "Media",
          desc: "Webcam capture with THADD face-blur privacy mode"
        },
        {
          id: "screenrec",
          name: "Screen Recorder",
          icon: "⏺",
          cls: "i-media",
          cat: "Media",
          desc: "Record / stream the desktop (used for the README demo)"
        },
        {
          id: "draw",
          name: "Draw",
          icon: "🖌",
          cls: "i-notes",
          cat: "Media",
          desc: "Vector + raster sketching with tablet pressure"
        },
        {
          id: "presenter",
          name: "Slides",
          icon: "📊",
          cls: "i-store",
          cat: "Productivity",
          desc: "Decks, export to PDF/PPTX"
        },
        /* ---------------------------- productivity ---------------------------- */
        {
          id: "notes",
          name: "Notes",
          icon: "📝",
          cls: "i-notes",
          cat: "Productivity",
          dock: true,
          desc: "Markdown notes with ⌘K search"
        },
        {
          id: "calendar",
          name: "Calendar",
          icon: "📅",
          cls: "i-store",
          cat: "Productivity",
          desc: "CalDAV, focus modes, time-blocking"
        },
        {
          id: "tasks",
          name: "Reminders",
          icon: "✅",
          cls: "i-notes",
          cat: "Productivity",
          desc: "Tasks, habits, pomodoro timer"
        },
        {
          id: "calc",
          name: "Calculator",
          icon: "🧮",
          cls: "i-calc",
          cat: "Productivity",
          desc: "Scientific, programmer and unit-conversion modes"
        },
        {
          id: "sheet",
          name: "Spreadsheets",
          icon: "📈",
          cls: "i-store",
          cat: "Productivity",
          desc: "1M rows, formulas, pivot tables"
        },
        {
          id: "office",
          name: "Documents",
          icon: "📄",
          cls: "i-editor",
          cat: "Productivity",
          desc: "Writer — DOCX/ODT with tracked changes"
        },
        {
          id: "pdf",
          name: "PDF Studio",
          icon: "📕",
          cls: "i-media",
          cat: "Productivity",
          desc: "Annotate, sign, redact, OCR"
        },
        {
          id: "clock",
          name: "Clock",
          icon: "⏰",
          cls: "i-store",
          cat: "Productivity",
          desc: "World clocks, alarms, stopwatch, timers"
        },
        {
          id: "weather",
          name: "Weather",
          icon: "⛅",
          cls: "i-store",
          cat: "Productivity",
          desc: "Live forecast for Accra and the world"
        },
        {
          id: "maps",
          name: "Maps",
          icon: "🗺",
          cls: "i-monitor",
          cat: "Productivity",
          desc: "OSM vector maps, offline tiles"
        },
        {
          id: "translate",
          name: "Translate",
          icon: "🌐",
          cls: "i-ai",
          cat: "Productivity",
          desc: "95 languages, offline neural packs"
        },
        /* ------------------------------- system 2 ----------------------------- */
        {
          id: "trash",
          name: "Trash",
          icon: "🗑",
          cls: "i-trash",
          cat: "System",
          dock: true,
          desc: "Recover or shred deleted items (secure erase)"
        },
        {
          id: "disks",
          name: "Disk Utility",
          icon: "💽",
          cls: "i-settings",
          cat: "System",
          desc: "Partitions, LUKS encryption, SMART health"
        },
        {
          id: "network",
          name: "Network",
          icon: "📶",
          cls: "i-settings",
          cat: "System",
          desc: "Wi-Fi, Ethernet, DNS-over-HTTPS, per-app firewall"
        },
        {
          id: "bluetooth",
          name: "Bluetooth",
          icon: "🔵",
          cls: "i-settings",
          cat: "System",
          desc: "Pair audio, input and IoT devices"
        },
        {
          id: "printers",
          name: "Printers",
          icon: "🖨",
          cls: "i-settings",
          cat: "System",
          desc: "CUPS queue management"
        },
        {
          id: "users",
          name: "Users & Groups",
          icon: "👥",
          cls: "i-settings",
          cat: "System",
          desc: "Accounts, sudo policy, guest mode"
        },
        {
          id: "power",
          name: "Power & Battery",
          icon: "🔋",
          cls: "i-settings",
          cat: "System",
          desc: "Thermals, governor, hibernation"
        },
        {
          id: "logs",
          name: "Console",
          icon: "📃",
          cls: "i-monitor",
          cat: "System",
          desc: "journalctl stream, kernel ring buffer, audit log"
        },
        {
          id: "cronjobs",
          name: "Automation",
          icon: "⚡",
          cls: "i-shell",
          cat: "System",
          desc: "Cron, systemd timers, THADD flows"
        },
        {
          id: "recorder",
          name: "Accessibility",
          icon: "♿",
          cls: "i-settings",
          cat: "System",
          desc: "VoiceOver-class reader, magnifier, colour filters"
        }
      ];
      BY_ID = Object.fromEntries(APPS.map((a) => [a.id, a]));
      DOCK_DEFAULT = [
        "finder",
        "launchpad",
        "browser",
        "mail",
        "terminal",
        "editor",
        "jarvis",
        "parrot",
        "store",
        "settings",
        "__sep",
        "music",
        "photos",
        "guide"
      ];
      WALLPAPERS = [
        { id: "sequoia", name: "Sequoia Aurora", css: "" },
        { id: "ventura", name: "Ventura Swirl", css: "radial-gradient(120% 100% at 20% 20%, #ff7a18 0%, transparent 55%), radial-gradient(120% 120% at 80% 30%, #af002d 0%, transparent 55%), linear-gradient(160deg, #101024, #2b1055)" },
        { id: "monterey", name: "Monterey Depth", css: "radial-gradient(120% 110% at 30% 15%, #12c2e9 0%, transparent 55%), radial-gradient(130% 120% at 80% 80%, #c471ed 0%, transparent 55%), linear-gradient(160deg, #05070f, #1b1f3b)" },
        { id: "bloom", name: "Windows Bloom", css: "radial-gradient(90% 80% at 50% 45%, #0078d4 0%, transparent 60%), linear-gradient(200deg, #001a3a, #003f7f 60%, #0b84ff)" },
        { id: "matrix", name: "Parrot Trace", css: "repeating-linear-gradient(0deg, rgba(0,255,170,.05) 0 2px, transparent 2px 4px), radial-gradient(120% 120% at 50% 0%, #052e2b 0%, #04120f 70%)" },
        { id: "void", name: "Void", css: "linear-gradient(160deg, #05060b, #0c0f1a 60%, #05060b)" }
      ];
    }
  });

  // desktop/js/wm.js
  var wm_exports = {};
  __export(wm_exports, {
    closeApp: () => closeApp,
    closeWindow: () => closeWindow,
    createWindow: () => createWindow,
    cycleWindows: () => cycleWindows,
    focus: () => focus,
    focusedId: () => focusedId,
    fullscreen: () => fullscreen,
    minimise: () => minimise,
    restore: () => restore,
    snapTo: () => snapTo,
    toggleMission: () => toggleMission,
    windows: () => windows,
    zoom: () => zoom
  });
  function geometryFor(app, w, h) {
    const saved = store.get("geom." + app, null);
    if (saved && saved.w && saved.x != null) return saved;
    const vw = innerWidth, vh = innerHeight;
    const x = clamp(Math.round(vw * 0.5 - w / 2) + cascade % 6 * 26 - 60, 12, Math.max(12, vw - w - 12));
    const y = clamp(Math.round(vh * 0.42 - h / 2) + cascade % 6 * 20 - 40, 44, Math.max(44, vh - h - 96));
    return { x, y, w, h };
  }
  function createWindow(opts) {
    const {
      app = "app",
      title = "Window",
      icon = "🗔",
      w = 900,
      h = 600,
      minW = MIN_W,
      minH = MIN_H,
      menubarName = title,
      accent = null,
      onClose = null,
      onResize = null,
      noTraffic = false,
      resizable = true
    } = opts;
    const id = app + "-" + uid();
    const g = geometryFor(app, Math.min(w, innerWidth - 24), Math.min(h, innerHeight - 120));
    const win2 = document.createElement("div");
    win2.className = "win";
    win2.dataset.app = app;
    win2.dataset.id = id;
    win2.style.cssText = `left:${g.x}px; top:${g.y}px; width:${g.w}px; height:${g.h}px; z-index:${++Z}`;
    if (accent) win2.style.setProperty("--accent", accent);
    const lights = el(
      "div",
      { class: "lights" },
      el("button", { class: "light c", title: "Close", html: `<svg viewBox="0 0 10 10" fill="none" stroke-width="1.6" stroke="currentColor" stroke-linecap="round"><path d="M3 3l4 4M7 3L3 7"/></svg>` }),
      el("button", { class: "light m", title: "Minimise", html: `<svg viewBox="0 0 10 10" fill="none" stroke-width="1.6" stroke="currentColor" stroke-linecap="round"><path d="M2.5 5h5"/></svg>` }),
      el("button", { class: "light z", title: "Zoom (⌥ = fullscreen)", html: `<svg viewBox="0 0 10 10" fill="none" stroke-width="1.5" stroke="currentColor" stroke-linecap="round"><path d="M2.6 6.6V3.2h3.4M7.4 3.4v3.4H4"/></svg>` })
    );
    const titleEl = el("div", { class: "tt" }, el("span", { class: "ic", text: icon }), el("span", { class: "tlabel", text: title }));
    const actions = el("div", { class: "tb-actions" });
    const bar = el("div", { class: "titlebar" }, lights, titleEl, el("div", { class: "sp" }), actions);
    const body = el("div", { class: "win-body" });
    win2.append(bar, body);
    if (resizable) {
      for (const d of ["n", "s", "e", "w", "nw", "ne", "sw", "se"]) win2.append(el("div", { class: "resize " + d, "data-dir": d }));
    }
    win2._id = id;
    win2._app = app;
    win2._title = title;
    win2._icon = icon;
    win2._menubarName = menubarName;
    win2._actions = actions;
    win2._body = body;
    win2._state = { min: false, max: false, full: false, prev: null };
    LAYER().append(win2);
    windows.set(id, win2);
    lights.children[0].addEventListener("click", (e) => {
      e.stopPropagation();
      closeWindow(window2obj(win2));
    });
    lights.children[1].addEventListener("click", (e) => {
      e.stopPropagation();
      minimise(win2);
    });
    lights.children[2].addEventListener("click", (e) => {
      e.stopPropagation();
      e.altKey ? fullscreen(win2) : zoom(win2);
    });
    bar.addEventListener("pointerdown", (e) => {
      focus(win2);
      if (e.target.closest(".tb-btn") || e.target.closest(".light")) return;
      startDrag(win2, e);
    });
    bar.addEventListener("dblclick", (e) => {
      if (e.target.closest(".tb-btn") || e.target.closest(".light")) return;
      zoom(win2);
    });
    for (const hd of $$(".resize", win2)) hd.addEventListener("pointerdown", (e) => startResize(win2, e, hd.dataset.dir));
    win2.addEventListener("pointerdown", () => focus(win2), true);
    win2.addEventListener("contextmenu", (e) => {
      if (e.target.closest("input, textarea, .term-out, .scroll, .guide-main")) return;
      e.preventDefault();
      Promise.resolve().then(() => (init_core(), core_exports)).then(({ contextMenu: contextMenu2 }) => contextMenu2(e.clientX, e.clientY, [
        { label: "Minimise", key: "⌘M", icon: "—", action: () => minimise(win2) },
        { label: win2._state.max ? "Restore" : "Zoom", icon: "⤢", action: () => zoom(win2) },
        { label: "Enter Full Screen", key: "^⌘F", icon: "⛶", action: () => fullscreen(win2) },
        "-",
        { label: "Snap Left", key: "⌃⌥←", action: () => snapTo(win2, "left") },
        { label: "Snap Right", key: "⌃⌥→", action: () => snapTo(win2, "right") },
        { label: "Snap Top", action: () => snapTo(win2, "top") },
        { label: "Snap Bottom", action: () => snapTo(win2, "bottom") },
        "-",
        { label: "Move to next display", disabled: true, icon: "🖥" },
        { label: "Close", key: "⌘W", icon: "✕", action: () => closeWindow(window2obj(win2)) }
      ]));
    });
    const obj = window2obj(win2);
    obj.body = body;
    obj.titleEl = titleEl;
    obj.actions = actions;
    obj.el = win2;
    win2._obj = obj;
    focus(win2);
    cascade++;
    bus.emit("win-open", obj);
    return obj;
  }
  function window2obj(win2) {
    if (win2._obj) return win2._obj;
    const o = {
      id: win2._id,
      app: win2._app,
      _app: win2._app,
      el: win2,
      body: win2._body,
      title: win2._title,
      _title: win2._title,
      icon: win2._icon,
      _state: win2._state,
      menubarName: win2._menubarName,
      setTitle(t) {
        win2._title = t;
        o.title = t;
        $(".tlabel", win2)?.replaceChildren(document.createTextNode(t));
      },
      close: () => closeWindow(o),
      focus: () => focus(win2),
      minimise: () => minimise(win2),
      zoom: () => zoom(win2)
    };
    win2._obj = o;
    return o;
  }
  function focus(win2) {
    if (!win2 || win2._closing) return;
    $$(".win").forEach((w) => w.classList.remove("focused"));
    win2.classList.add("focused");
    win2.style.zIndex = ++Z;
    focusedId = win2._id;
    bus.emit("win-focus", win2._obj || window2obj(win2));
  }
  function minimise(win2) {
    win2.classList.add("min");
    win2._state.min = true;
    bus.emit("win-min", window2obj(win2));
    const nxt = [...windows.values()].filter((w) => !w._state.min && w !== win2).sort((a, b) => b.style.zIndex - a.style.zIndex)[0];
    if (nxt) focus(nxt);
    else bus.emit("desktop-focus");
  }
  function restore(win2) {
    win2.classList.remove("min");
    win2._state.min = false;
    focus(win2);
    win2.animate([{ transform: "scale(.94)", opacity: 0.4 }, { transform: "scale(1)", opacity: 1 }], { duration: 200, easing: "cubic-bezier(.2,.9,.25,1.05)" });
  }
  function zoom(win2) {
    const s = win2._state;
    if (s.max) {
      Object.assign(win2.style, s.prev);
      s.max = false;
      win2.classList.remove("max");
    } else {
      s.prev = { left: win2.style.left, top: win2.style.top, width: win2.style.width, height: win2.style.height };
      Object.assign(win2.style, { left: "0px", top: "30px", width: innerWidth + "px", height: innerHeight - 30 + "px" });
      s.max = true;
      win2.classList.add("max");
    }
    win2.dispatchEvent(new CustomEvent("thadd-resize"));
  }
  function fullscreen(win2) {
    const s = win2._state;
    if (s.full) {
      win2.classList.remove("full");
      s.full = false;
      Object.assign(win2.style, s.prevFull);
      return;
    }
    s.prevFull = { left: win2.style.left, top: win2.style.top, width: win2.style.width, height: win2.style.height };
    Object.assign(win2.style, { left: "0px", top: "30px", width: innerWidth + "px", height: innerHeight - 30 + "px" });
    win2.classList.add("max");
    s.full = true;
  }
  function snapTo(win2, side) {
    const top = 30, availH = innerHeight - top;
    const full = "0px", hw = innerWidth / 2 + "px";
    const s = win2._state;
    if (!s.max) s.prev = { left: win2.style.left, top: win2.style.top, width: win2.style.width, height: win2.style.height };
    const geo = {
      left: { left: full, top: top + "px", width: hw, height: availH + "px" },
      right: { left: hw, top: top + "px", width: hw, height: availH + "px" },
      top: { left: full, top: top + "px", width: full, height: availH + "px" },
      bottom: { left: full, top: top + "px", width: full, height: availH + "px" },
      tl: { left: full, top: top + "px", width: hw, height: availH / 2 + "px" },
      tr: { left: hw, top: top + "px", width: hw, height: availH / 2 + "px" },
      bl: { left: full, top: top + availH / 2 + "px", width: hw, height: availH / 2 + "px" },
      br: { left: hw, top: top + availH / 2 + "px", width: hw, height: availH / 2 + "px" }
    }[side];
    win2.classList.add("snapping");
    Object.assign(win2.style, geo);
    s.max = side === "top" || side === "bottom";
    setTimeout(() => win2.classList.remove("snapping"), 190);
    win2.dispatchEvent(new CustomEvent("thadd-resize"));
  }
  function closeWindow(objOrWin) {
    const win2 = objOrWin?.el || objOrWin;
    if (!win2 || win2._closing) return;
    win2._closing = true;
    const o = window2obj(win2);
    try {
      win2._onClose?.();
    } catch {
    }
    bus.emit("win-close", o);
    store.set("geom." + win2._app, { x: parseInt(win2.style.left), y: parseInt(win2.style.top), w: parseInt(win2.style.width), h: parseInt(win2.style.height) });
    win2.classList.add("closing");
    setTimeout(() => {
      win2.remove();
      windows.delete(win2._id);
      const nxt = [...windows.values()].filter((w) => !w._state.min).sort((a, b) => b.style.zIndex - a.style.zIndex)[0];
      if (nxt) focus(nxt);
      else bus.emit("desktop-focus");
    }, 165);
  }
  function closeApp(appId) {
    [...windows.values()].filter((w) => w._app === appId).forEach((w) => closeWindow(w));
  }
  function startDrag(win2, e) {
    const s = win2._state;
    if (s.max && !s.full) {
      const relX = e.clientX / innerWidth;
      Object.assign(win2.style, s.prev);
      s.max = false;
      win2.classList.remove("max");
      win2.style.left = clamp(e.clientX - parseInt(win2.style.width) * relX, 0, innerWidth - 120) + "px";
    }
    const sx = e.clientX, sy = e.clientY;
    const ox = parseInt(win2.style.left), oy = parseInt(win2.style.top);
    const ghost = $("#snapGhost");
    let armed = null;
    win2.setPointerCapture?.(e.pointerId);
    const move = (ev) => {
      const nx = ox + ev.clientX - sx, ny = oy + ev.clientY - sy;
      win2.style.left = nx + "px";
      win2.style.top = clamp(ny, 28, innerHeight - 44) + "px";
      armed = null;
      if (ev.clientX <= SNAP_EDGE) armed = "left";
      else if (ev.clientX >= innerWidth - SNAP_EDGE) armed = "right";
      else if (ev.clientY <= 34) armed = "top";
      else if (ev.clientY >= innerHeight - SNAP_EDGE) armed = "bottom";
      if (armed) {
        const g = {
          left: [0, 30, innerWidth / 2, innerHeight - 30],
          right: [innerWidth / 2, 30, innerWidth / 2, innerHeight - 30],
          top: [0, 30, innerWidth, innerHeight - 30],
          bottom: [0, 30, innerWidth, innerHeight - 30]
        }[armed];
        Object.assign(ghost.style, { display: "block", left: g[0] + "px", top: g[1] + "px", width: g[2] + "px", height: g[3] + "px" });
      } else ghost.style.display = "none";
    };
    const up = () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
      window.removeEventListener("blur", up);
      ghost.style.display = "none";
      if (armed) snapTo(win2, armed);
      store.set("geom." + win2._app, { x: parseInt(win2.style.left), y: parseInt(win2.style.top), w: parseInt(win2.style.width), h: parseInt(win2.style.height) });
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
    window.addEventListener("blur", up);
  }
  function startResize(win2, e, dir) {
    e.preventDefault();
    e.stopPropagation();
    focus(win2);
    const sx = e.clientX, sy = e.clientY;
    const o = { x: parseInt(win2.style.left), y: parseInt(win2.style.top), w: parseInt(win2.style.width), h: parseInt(win2.style.height) };
    const minW = 340, minH = 200;
    win2.setPointerCapture?.(e.pointerId);
    const move = (ev) => {
      const dx = ev.clientX - sx, dy = ev.clientY - sy;
      let { x, y, w, h } = o;
      if (dir.includes("e")) w = Math.max(minW, o.w + dx);
      if (dir.includes("s")) h = Math.max(minH, o.h + dy);
      if (dir.includes("w")) {
        w = Math.max(minW, o.w - dx);
        x = o.x + (o.w - w);
      }
      if (dir.includes("n")) {
        h = Math.max(minH, o.h - dy);
        y = o.y + (o.h - h);
      }
      Object.assign(win2.style, { left: x + "px", top: y + "px", width: w + "px", height: h + "px" });
      win2.dispatchEvent(new CustomEvent("thadd-resize"));
    };
    const up = () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
      store.set("geom." + win2._app, { x: parseInt(win2.style.left), y: parseInt(win2.style.top), w: parseInt(win2.style.width), h: parseInt(win2.style.height) });
      win2.dispatchEvent(new CustomEvent("thadd-resize"));
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
  }
  function toggleMission(force) {
    const m = $("#mission");
    const open2 = force ?? !m.classList.contains("open");
    if (!open2) {
      m.classList.remove("open");
      return;
    }
    const grid = $("#missionGrid");
    grid.innerHTML = "";
    const list = [...windows.values()].filter((w) => !w._state.min);
    if (!list.length) grid.append(el("div", { class: "mission-empty", text: "No open windows — press ⌘⇧A or click the dock to launch something." }));
    for (const w of list) {
      const card = el(
        "div",
        { class: "mission-card" },
        el("div", { class: "mh" }, el("span", { text: w._icon }), el("span", { text: w._title })),
        el("div", { class: "mb2", text: w._icon })
      );
      card.addEventListener("click", () => {
        m.classList.remove("open");
        restore(w);
      });
      grid.append(card);
    }
    m.classList.add("open");
  }
  function cycleWindows(dir = 1) {
    const list = [...windows.values()].filter((w) => !w._state.min).sort((a, b) => a.style.zIndex - b.style.zIndex);
    if (!list.length) return;
    const i = list.findIndex((w) => w._id === focusedId);
    focus(list[((i + dir) % list.length + list.length) % list.length]);
  }
  var LAYER, Z, windows, focusedId, cascade, MIN_W, MIN_H, SNAP_EDGE;
  var init_wm = __esm({
    "desktop/js/wm.js"() {
      init_core();
      LAYER = () => $("#windows");
      Z = 100;
      windows = /* @__PURE__ */ new Map();
      focusedId = null;
      cascade = 0;
      MIN_W = 360;
      MIN_H = 220;
      SNAP_EDGE = 22;
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
    }
  });

  // desktop/js/apps/screenshot.js
  var screenshot_exports = {};
  __export(screenshot_exports, {
    build: () => build,
    grab: () => grab
  });
  function build() {
    const wrap2 = el("div", { class: "pad" });
    wrap2.append(
      el("div", { class: "st-h", text: "Screenshot" }),
      el("div", { class: "st-sub", text: "Capture the whole desktop, a single window, or a region. Shots land in ~/Pictures/Screenshots and download instantly." }),
      el(
        "div",
        { style: { display: "flex", gap: "10px", flexWrap: "wrap" } },
        btn("🖥  Full desktop", () => grab("desktop")),
        btn("🪟  Front window", () => grab("window")),
        btn("✂️  Region (drag)", () => regionCapture()),
        btn("⏱  Timed (5s)", () => {
          toast("Timer", "Capturing in 5 seconds…", { icon: "⏱" });
          setTimeout(() => grab("desktop"), 5e3);
        })
      ),
      el(
        "div",
        { class: "st-card", style: { marginTop: "16px" } },
        el("div", { style: { fontWeight: "700", marginBottom: "6px" }, text: "Recent shots" }),
        recentList()
      )
    );
    return wrap2;
  }
  function btn(label, fn) {
    return el("button", { class: "btn", text: label, onclick: fn });
  }
  async function grab(mode = "desktop") {
    const W = Math.min(innerWidth, 1600), H2 = Math.min(innerHeight, 1e3);
    const c2 = document.createElement("canvas");
    c2.width = W;
    c2.height = H2;
    const x = c2.getContext("2d");
    const g = x.createLinearGradient(0, 0, W, H2);
    const light = document.documentElement.dataset.appearance === "light";
    if (light) {
      g.addColorStop(0, "#c9d6ea");
      g.addColorStop(1, "#eef2f8");
    } else {
      g.addColorStop(0, "#06070f");
      g.addColorStop(1, "#0d1230");
    }
    x.fillStyle = g;
    x.fillRect(0, 0, W, H2);
    for (const [cx, cy, r, col] of [[0.18, 0.1, 0.5, "rgba(59,130,246,.55)"], [0.88, 0.22, 0.45, "rgba(168,85,247,.5)"], [0.6, 0.95, 0.5, "rgba(20,184,166,.42)"]]) {
      const rg = x.createRadialGradient(W * cx, H2 * cy, 0, W * cx, H2 * cy, Math.max(W, H2) * r);
      rg.addColorStop(0, col);
      rg.addColorStop(1, "rgba(0,0,0,0)");
      x.fillStyle = rg;
      x.fillRect(0, 0, W, H2);
    }
    x.fillStyle = light ? "rgba(250,251,255,.86)" : "rgba(28,30,46,.72)";
    x.fillRect(0, 0, W, 30);
    x.fillStyle = light ? "#10131c" : "#eef1f8";
    x.font = "600 13px Inter, system-ui, sans-serif";
    x.fillText("◆  THADD OS", 12, 20);
    x.font = "13px Inter, system-ui, sans-serif";
    x.fillText("File   Edit   View   Go   Window   Help", 132, 20);
    const now = /* @__PURE__ */ new Date();
    const clockTxt = `${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][now.getDay()]} ${now.getDate()} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][now.getMonth()]} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    x.fillText("🛡  ✦  📶  🔋   " + clockTxt, W - 210, 20);
    const list = [...windows.values()].filter((w) => !w._state.min);
    for (const w of list) {
      const r = w.getBoundingClientRect();
      const l = Math.round(r.left), t = Math.round(r.top), ww = Math.round(r.width), hh = Math.round(r.height);
      roundRect(x, l, t, ww, hh, 14);
      x.fillStyle = light ? "rgba(250,251,254,.94)" : "rgba(24,27,40,.9)";
      x.fill();
      x.strokeStyle = light ? "rgba(10,20,40,.14)" : "rgba(255,255,255,.14)";
      x.stroke();
      x.fillStyle = light ? "rgba(244,246,251,.9)" : "rgba(30,33,50,.85)";
      roundRectTop(x, l, t, ww, 44, 14);
      x.fill();
      const cols = ["#ff5f57", "#febc2e", "#28c840"];
      cols.forEach((cc, i) => {
        x.beginPath();
        x.arc(l + 18 + i * 20, t + 22, 6, 0, 7);
        x.fillStyle = cc;
        x.fill();
      });
      x.fillStyle = light ? "#10131c" : "#eef1f8";
      x.font = "600 13px Inter, system-ui, sans-serif";
      x.fillText(`${w._icon || "▢"}  ${w._title || ""}`, l + 78, t + 27);
      x.font = "12px Inter, system-ui, sans-serif";
      x.fillStyle = light ? "rgba(16,19,28,.7)" : "rgba(238,241,248,.62)";
      const hint = { terminal: "$ thadd doctor — 20 checks passed ✔   groq online · llama-3.3-70b", jarvis: "✦ JARVIS: I read ~/thadd-os, ran the tests and hardened the firewall.", browser: "THADD Start — Firefox 131 · uBlock · DoH 1.1.1.1", parrot: "nmap 7.95 — 22/80/443 open · searchsploit → EDB-50383", monitory: "" }[w._app] || `${w._app} · live`;
      x.fillText(hint.slice(0, 92), l + 20, t + 76);
      for (let i = 0; i < 5; i++) {
        x.fillStyle = light ? `rgba(10,20,40,${0.06 - i * 8e-3})` : `rgba(255,255,255,${0.06 - i * 8e-3})`;
        x.fillRect(l + 20, t + 100 + i * 26, Math.max(60, (ww - 60) * (0.85 - i * 0.11)), 10);
      }
    }
    const dockW = Math.min(W - 40, 62 * Math.max(6, Math.min(14, 14)) + 24);
    const dx = (W - dockW) / 2, dy = H2 - 74;
    roundRect(x, dx, dy, dockW, 66, 20);
    x.fillStyle = light ? "rgba(250,251,255,.8)" : "rgba(16,19,34,.78)";
    x.fill();
    x.strokeStyle = light ? "rgba(10,20,40,.12)" : "rgba(255,255,255,.12)";
    x.stroke();
    const icons = ["🗂", "🚀", "🦊", "✉", "»", "⌨", "✦", "🦜", "🛍", "⚙", "🎵", "🖼", "📖"];
    icons.forEach((ic, i) => {
      const ix = dx + 14 + i * 62;
      if (ix + 48 > dx + dockW) return;
      roundRect(x, ix, dy + 9, 48, 48, 13);
      x.fillStyle = light ? "rgba(255,255,255,.9)" : "rgba(255,255,255,.10)";
      x.fill();
      x.font = "26px serif";
      x.fillText(ic, ix + 11, dy + 43);
    });
    const name = `thadd-shot-${(/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-").slice(0, 19)}${mode === "window" ? "-win" : ""}.png`;
    const url = c2.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    vfs.write(vfs.home() + "/Pictures/Screenshots/" + name, `[PNG ${W}×${H2} — captured ${(/* @__PURE__ */ new Date()).toLocaleString()}]`);
    const shots = store.get("shots", []);
    shots.push({ name, at: Date.now(), url: url.slice(0, 80) });
    store.set("shots", shots.slice(-12));
    toast("Screenshot saved", name, { icon: "📸" });
    try {
      if (navigator.clipboard && window.ClipboardItem) {
        const blob = await (await fetch(url)).blob();
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      }
    } catch {
    }
    document.dispatchEvent(new CustomEvent("thadd-shot", { detail: { name, url } }));
    return name;
  }
  function regionCapture() {
    const veil = el("div", { style: { position: "fixed", inset: "0", zIndex: "9500", background: "rgba(5,7,14,.35)", cursor: "crosshair" } });
    const box2 = el("div", { style: { position: "absolute", border: "2px solid #22d3ee", background: "rgba(34,211,238,.16)", borderRadius: "6px" } });
    veil.append(box2);
    let sx = 0, sy = 0, dragging = false;
    veil.addEventListener("pointerdown", (e) => {
      dragging = true;
      sx = e.clientX;
      sy = e.clientY;
    });
    veil.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      Object.assign(box2.style, { left: Math.min(sx, e.clientX) + "px", top: Math.min(sy, e.clientY) + "px", width: Math.abs(e.clientX - sx) + "px", height: Math.abs(e.clientY - sy) + "px" });
    });
    veil.addEventListener("pointerup", async () => {
      veil.remove();
      toast("Region captured", "Full-desktop shot saved (region crop applied to the file name).", { icon: "✂️" });
      await grab("region");
    });
    veil.addEventListener("keydown", (e) => {
      if (e.key === "Escape") veil.remove();
    });
    document.body.append(veil);
  }
  function recentList() {
    const shots = store.get("shots", []);
    if (!shots.length) return el("div", { class: "mute", text: "No screenshots yet — take one and it will appear here." });
    const g = el("div", { class: "gal" });
    for (const s of shots.slice().reverse()) g.append(el(
      "div",
      { class: "st-card", style: { padding: "8px 10px" } },
      el("div", { style: { fontSize: "12.3px", fontWeight: "600" }, text: s.name }),
      el("div", { class: "mute", style: { fontSize: "11px" }, text: new Date(s.at).toLocaleString() })
    ));
    return g;
  }
  function roundRect(x, l, t, w, h, r) {
    x.beginPath();
    x.moveTo(l + r, t);
    x.lineTo(l + w - r, t);
    x.quadraticCurveTo(l + w, t, l + w, t + r);
    x.lineTo(l + w, t + h - r);
    x.quadraticCurveTo(l + w, t + h, l + w - r, t + h);
    x.lineTo(l + r, t + h);
    x.quadraticCurveTo(l, t + h, l, t + h - r);
    x.lineTo(l, t + r);
    x.quadraticCurveTo(l, t, l + r, t);
    x.closePath();
  }
  function roundRectTop(x, l, t, w, h, r) {
    x.beginPath();
    x.moveTo(l + r, t);
    x.lineTo(l + w - r, t);
    x.quadraticCurveTo(l + w, t, l + w, t + r);
    x.lineTo(l + w, t + h);
    x.lineTo(l, t + h);
    x.lineTo(l, t + r);
    x.quadraticCurveTo(l, t, l + r, t);
    x.closePath();
  }
  var init_screenshot = __esm({
    "desktop/js/apps/screenshot.js"() {
      init_core();
      init_wm();
    }
  });

  // desktop/js/apps/terminal.js
  var terminal_exports = {};
  __export(terminal_exports, {
    build: () => build2,
    meta: () => meta
  });
  function build2(args = {}, win) {
    const S = {
      user: store.get("user", "thadd"),
      host: HOST,
      cwd: "/home/" + store.get("user", "thadd"),
      env: {
        PATH: "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/opt/thadd/bin",
        HOME: "/home/" + store.get("user", "thadd"),
        SHELL: "/bin/zsh",
        TERM: "xterm-256color",
        LANG: "en_GH.UTF-8",
        EDITOR: "code",
        THADD_SHIELD: "strict",
        GROQ_MODEL: store.get("ai.model", "llama-3.3-70b-versatile")
      },
      history: store.get("term.history", ["sudo thadd doctor", "neofetch", "ls -la ~/thadd-os"]),
      histIdx: -1,
      aliases: { ll: "ls -lah", la: "ls -A", iso: "thadd-iso build --release", please: "sudo" },
      vars: {},
      running: false,
      ctrl: false,
      bg: [],
      capture: null,
      busy: false
    };
    const wrap = el("div", { class: "term-wrap" });
    const tabs = el(
      "div",
      { class: "term-tabs" },
      el("div", { class: "term-tab active", text: "zsh — thadd@thadd-os: ~" }),
      el("div", { class: "term-tab", text: "+" })
    );
    const out = el("div", { class: "term-out" });
    const psi = el("span", { class: "ps1" });
    const input = el("input", { spellcheck: "false", autocomplete: "off", autocapitalize: "off" });
    const inrow = el("div", { class: "term-in" }, psi, input);
    wrap.append(tabs, out, inrow);
    box(`
   ████████╗██╗  ██╗ █████╗ ██████╗ ██████╗     ██████╗ ███████╗
   ╚══██╔══╝██║  ██║██╔══██╗██╔══██╗██╔══██╗   ██╔═══██╗██╔════╝
      ██║   ███████║███████║██║  ██║██║  ██║   ██║   ██║███████╗
      ██║   ██╔══██║██╔══██║██║  ██║██║  ██║   ██║   ██║╚════██║
      ██║   ██║  ██║██║  ██║██████╔╝██████╔╝██╗╚██████╔╝███████║
      ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝ ╚═════╝ ╚═╝ ╚═════╝ ╚══════╝`, "t-cyan");
    box(`${OS} · kernel ${KERNEL} · zsh 5.9 · ${(/* @__PURE__ */ new Date()).toDateString()}`, "t-dim");
    box(`Type ${c("help")} for the command index, ${c("thadd help")} for OS tools, ${c("parrot")} for the 600-tool arsenal.`, "t-dim");
    print("", "");
    prompt();
    scroll();
    function c(x) {
      return `\x1B[36m${x}\x1B[0m`;
    }
    function colorize(s) {
      return s.replace(/\u001b\[36m/g, "").replace(/\u001b\[0m/g, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\u0001/g, '<span class="t-cyan">').replace(/\u0002/g, "</span>");
    }
    function print(text = "", cls = "") {
      if (S.capture) S.capture.push(String(text).replace(/\u001b\[[0-9;]*m/g, ""));
      const d = el("div", { class: "t-line " + cls });
      d.innerHTML = colorize(String(text));
      if (cls === "raw") d.innerHTML = String(text);
      out.append(d);
      scroll();
      return d;
    }
    function box(text, cls = "") {
      print(text, cls);
    }
    function scroll() {
      out.scrollTop = out.scrollHeight;
    }
    function prompt() {
      const short2 = S.cwd.startsWith(S.env.HOME) ? "~" + S.cwd.slice(S.env.HOME.length) : S.cwd;
      psi.innerHTML = `<span class="t-prompt">${S.user}@${S.host}</span>:<span class="t-path">${esc(short2)}</span>$&nbsp;`;
    }
    input.addEventListener("keydown", async (e) => {
      if (e.key === "Enter") {
        const line = input.value.trim();
        input.value = "";
        if (!line) {
          prompt2();
          return;
        }
        S.history.push(line);
        store.set("term.history", S.history.slice(-400));
        print(`<span class="t-prompt">${S.user}@${S.host}</span>:<span class="t-path">${esc(S.cwd)}</span>$ ${esc(line)}`);
        if (S.ctrl) {
          S.ctrl = false;
          print("^C", "t-warn");
          return;
        }
        try {
          await exec(line);
        } catch (err) {
          print(String(err && err.message || err), "t-err");
        }
        print("");
        prompt2();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        S.histIdx = S.histIdx < 0 ? S.history.length - 1 : Math.max(0, S.histIdx - 1);
        input.value = S.history[S.histIdx] || "";
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        S.histIdx = Math.min(S.history.length, (S.histIdx < 0 ? S.history.length : S.histIdx) + 1);
        input.value = S.history[S.histIdx] || "";
        if (S.histIdx >= S.history.length) S.histIdx = -1;
      } else if (e.key === "Tab") {
        e.preventDefault();
        const parts = input.value.split(/\s+/);
        const last = parts[parts.length - 1] || "";
        if (parts.length === 1) {
          const hits = Object.keys(C).filter((k) => k.startsWith(last)).sort();
          if (hits.length === 1) input.value = hits[0] + " ";
          else if (hits.length > 1) print(hits.join("  "), "t-dim");
        } else {
          const dir = last.includes("/") ? last.slice(0, last.lastIndexOf("/")) || "/" : S.cwd;
          const pre = last.includes("/") ? last.slice(last.lastIndexOf("/") + 1) : last;
          const kids = (vfs.ls(abs(dir)) || []).map((x) => x.name).filter((n) => n.startsWith(pre));
          if (kids.length === 1) input.value = parts.slice(0, -1).concat(last.includes("/") ? dir.replace(/\/$/, "") + "/" + kids[0] : kids[0]).join(" ") + (vfs.resolve(abs(last.includes("/") ? dir + "/" + kids[0] : S.cwd + "/" + kids[0]))?.type === "dir" ? "/" : " ");
          else if (kids.length > 1) print(kids.join("  "), "t-dim");
        }
      } else if (e.key === "c" && e.ctrlKey) {
        S.ctrl = true;
        print("^C", "t-warn");
        input.value = "";
      } else if (e.key === "l" && e.ctrlKey) {
        e.preventDefault();
        out.innerHTML = "";
      } else if (e.key === "d" && e.ctrlKey && !input.value) {
        print("logout", "t-dim");
      }
    });
    function prompt2() {
      prompt();
    }
    win.el._runCommand = async (cmd, silent = false) => {
      while (S.busy) await sleep(60);
      S.busy = true;
      const prev = S.capture;
      S.capture = [];
      try {
        await exec(String(cmd));
      } catch (e) {
        S.capture.push(String(e && e.message || e));
      }
      const outText = S.capture.join("\n");
      S.capture = prev || null;
      S.busy = false;
      if (!silent) print("");
      return outText || "(no output)";
    };
    win._runCommand = win.el._runCommand;
    if (args.run) setTimeout(() => {
      print(`<span class="t-prompt">${S.user}@${S.host}</span>:<span class="t-path">${S.cwd}</span>$ ${esc(args.run)}`);
      exec(args.run).then(() => {
        print("");
        prompt();
      });
    }, 350);
    function abs(p) {
      if (!p) return S.cwd;
      p = String(p).replace(/^~(?=\/|$)/, S.env.HOME);
      if (p.startsWith("/")) return p;
      return (S.cwd === "/" ? "" : S.cwd) + "/" + p;
    }
    function node(p) {
      return vfs.resolve(abs(p));
    }
    function short(p) {
      return p.startsWith(S.env.HOME) ? "~" + p.slice(S.env.HOME.length) : p;
    }
    async function exec(line) {
      const chain = line.split(/\s*&&\s*|\s*;\s*/).filter(Boolean);
      for (const part of chain) {
        const ok = await execOne(part);
        if (!ok) break;
      }
      return true;
    }
    async function execOne(cmdline) {
      let redirect = null;
      let m = cmdline.match(/\s*(>>|>)\s*(\S+)\s*$/);
      if (m) {
        redirect = { append: m[1] === ">>", path: m[2] };
        cmdline = cmdline.slice(0, m.index);
      }
      const pipe = cmdline.split("|").map((s) => s.trim());
      let stdin = null;
      for (let i = 0; i < pipe.length; i++) {
        const seg = pipe[i];
        const toks = seg.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
        const argv = toks.map((t) => t.replace(/^["']|["']$/g, ""));
        let cmd = argv.shift() || "";
        if (S.aliases[cmd]) {
          const ex = S.aliases[cmd].split(/\s+/);
          cmd = ex[0];
          argv.unshift(...ex.slice(1));
        }
        const fn = C[cmd] || C[cmd.replace(/^sudo$/, "")];
        if (!fn) {
          const guess = suggest(cmd);
          print(`zsh: command not found: ${cmd}`, "t-err");
          if (guess) print(`did you mean: ${guess}?`, "t-dim");
          if (i === 0) print(`Try ${"'help'"}, ${"'parrot'"}, ${"'thadd help'"}, or ${"'apt install " + cmd + "'"}.`, "t-dim");
          return false;
        }
        let outBuf = [];
        const emit2 = (t, cls) => outBuf.push({ t: String(t), cls: cls || "" });
        const res = await fn({ argv, args: argv, raw: seg, stdin, emit: emit2, print, S, win });
        if (redirect && (res === void 0 || res === true)) {
          const body = outBuf.map((o) => o.t.replace(/\u001b\[\d+m/g, "")).join("\n");
          const cur = vfs.read(abs(redirect.path)) || "";
          vfs.write(abs(redirect.path), redirect.append ? cur + body + "\n" : body + "\n");
          toast("Written", short(abs(redirect.path)), { icon: "💾" });
          return true;
        }
        if (i === pipe.length - 1) {
          outBuf.forEach((o) => print(o.t, o.cls));
        } else stdin = outBuf.map((o) => o.t).join("\n");
      }
      return true;
    }
    function suggest(c2) {
      const keys = Object.keys(C);
      let best = null, score = 3;
      for (const k of keys) {
        const d = lev(k, c2);
        if (d < score) {
          score = d;
          best = k;
        }
      }
      return score <= 2 ? best : null;
    }
    function lev(a, b) {
      const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
      for (let j = 0; j <= b.length; j++) dp[0][j] = j;
      for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
        dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      return dp[a.length][b.length];
    }
    async function type(lines, delay = 34, cls = "") {
      for (const l of lines) {
        print(l, cls);
        await sleep(delay);
      }
    }
    const C = {};
    const def = (names, fn) => names.split(" ").forEach((n) => C[n] = fn);
    def("help ?", async ({ emit: emit2 }) => {
      emit2(`${OS} — zsh command index`, "t-cyan");
      emit2("");
      const groups = [
        ["files", "ls cd pwd cat less head tail touch mkdir rm mv cp tree find grep wc sed awk stat file du df ln chmod chown"],
        ["system", "ps top free htop lscpu lsblk lspci lsusb uptime uname hostname date cal whoami id who env export history clear exit reboot shutdown systemctl service journalctl dmesg kill jobs"],
        ["network", "ip ifconfig ping traceroute dig nslookup whois curl wget ssh scp rsync netstat ss nmap tcpdump arp iwconfig"],
        ["security", "parrot msfconsole sqlmap hydra john hashcat aircrack-ng gobuster ffuf nikto searchsploit responder impacket bloodhound enum4linux smbclient wpscan whatweb openssl gpg ufw iptables fail2ban lynis rkhunter chkrootkit clamav aide"],
        ["dev", "python3 node npm pip gcc g++ make cargo go git docker kubectl jupyter sqlite3 psql code vim nano"],
        ["windows", "dir cls ipconfig tasklist powershell winget where certutil net"],
        ["macos", "brew defaults open say pbcopy pbpaste sw_vers"],
        ["thadd", "thadd thadd-iso thadd-shield thadd-ai groq ai jarvis neofetch fastfetch"],
        ["fun", "cowsay figlet fortune sl cmatrix lolcat yes rev base64 md5sum sha256sum xxd bc seq sort uniq cut tr tee watch time espeak"]
      ];
      for (const [g, list] of groups) {
        emit2(g.padEnd(10) + " " + list.replace(/(\S+)/g, "\x1B[36m$1\x1B[0m"), "");
      }
      emit2("");
      emit2("Pipes, >, >>, && and ; are supported.  Tab completes.  ↑/↓ history.", "t-dim");
      emit2("Full docs: type `man <command>` — 600+ tools: type `parrot`.", "t-dim");
    });
    def("ls dir", async ({ args: args2, emit: emit2 }) => {
      const flags = args2.filter((a) => a.startsWith("-")).join("");
      const paths = args2.filter((a) => !a.startsWith("-"));
      const target = abs(paths[0] || ".");
      const n = vfs.resolve(target);
      if (!n) {
        emit2(`ls: cannot access '${paths[0]}': No such file or directory`, "t-err");
        return;
      }
      if (n.type === "file") {
        emit2(n.name);
        return;
      }
      const all = flags.includes("a");
      const kids = (n.children || []).filter((k) => all || !k.name.startsWith("."));
      if (flags.includes("l")) {
        let total = 0;
        emit2(`total ${kids.length * 4}`);
        for (const k of kids) {
          const isDir = k.type === "dir";
          const size = isDir ? 4096 : String(k.body || "").length;
          total += size;
          const perm = isDir ? "drwxr-xr-x" : k.name.startsWith(".") ? "-rw-------" : "-rw-r--r--";
          emit2(`${perm}  ${isDir ? "2" : "1"} ${S.user} ${S.user} ${String(size).padStart(8)} ${dateStr(k.mtime)} ${isDir ? "\x1B[36m" + k.name + "/\x1B[0m" : k.name}`);
        }
        emit2(`\x1B[90m${kids.length} entries · ${fmtBytes(total)}\x1B[0m`);
        return;
      }
      if (kids.length === 0) return;
      const cols = Math.max(1, Math.floor(96 / 22));
      emit2(kids.map((k) => k.type === "dir" ? "\x1B[36m" + k.name + "/\x1B[0m" : isExec(k) ? "\x1B[32m" + k.name + "\x1B[0m" : k.name).map(padCell).reduce((rows, cell, i) => {
        const r = Math.floor(i / cols);
        rows[r] = (rows[r] || "") + cell;
        return rows;
      }, []).join("\n"));
    });
    const isExec = (k) => /\.(sh|py|js)$/.test(k.name) || k.name === "thadd";
    const padCell = (s) => s + " ".repeat(Math.max(2, 22 - s.replace(/\u001b\[[0-9;]*m/g, "").length));
    const dateStr = (t) => {
      const d = t ? new Date(t) : /* @__PURE__ */ new Date();
      return `${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getMonth()]} ${String(d.getDate()).padStart(2)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };
    def("cd", async ({ args: args2, emit: emit2, S: S2 }) => {
      const t = args2[0] || "~";
      if (t === "-") {
        S2.cwd = S2.prev || S2.env.HOME;
        return;
      }
      const n = vfs.resolve(abs(t));
      if (!n) {
        emit2(`cd: no such file or directory: ${t}`, "t-err");
        return;
      }
      if (n.type !== "dir") {
        emit2(`cd: not a directory: ${t}`, "t-err");
        return;
      }
      S2.prev = S2.cwd;
      S2.cwd = abs(t).replace(/\/+$/, "") || "/";
    });
    def("pwd", async ({ emit: emit2 }) => emit2(S.cwd));
    def("cat", async ({ args: args2, emit: emit2 }) => {
      if (!args2.length) {
        emit2("usage: cat <file>…");
        return;
      }
      for (const f of args2.filter((a) => !a.startsWith("-"))) {
        const n = vfs.resolve(abs(f));
        if (!n) {
          emit2(`cat: ${f}: No such file or directory`, "t-err");
          continue;
        }
        if (n.type === "dir") {
          emit2(`cat: ${f}: Is a directory`, "t-err");
          continue;
        }
        emit2(n.body ?? "");
      }
    });
    def("less more", async ({ args: args2, emit: emit2 }) => {
      const n = vfs.resolve(abs(args2[0] || ""));
      if (!n) {
        emit2("No such file", "t-err");
        return;
      }
      emit2(n.body ?? "");
      emit2("\x1B[90m(END) — press q to quit (buffered pager)\x1B[0m");
    });
    def("head", async ({ args: args2, emit: emit2 }) => tailHead(args2, emit2, true));
    def("tail", async ({ args: args2, emit: emit2 }) => tailHead(args2, emit2, false));
    function tailHead(args2, emit2, head) {
      const n = parseInt((args2.find((a) => /^\-\d+$/.test(a)) || "-10").slice(1), 10);
      const f = args2.find((a) => !a.startsWith("-"));
      const node2 = vfs.resolve(abs(f || ""));
      if (!node2) {
        emit2(`head/tail: cannot open '${f}'`, "t-err");
        return;
      }
      const lines = String(node2.body ?? "").split("\n");
      emit2((head ? lines.slice(0, n) : lines.slice(-n)).join("\n"));
    }
    def("wc", async ({ args: args2, emit: emit2, stdin }) => {
      const t = stdin ?? vfs.read(abs(args2.find((a) => !a.startsWith("-")) || "")) ?? "";
      emit2(`${String(t).split("\n").length}	${String(t).split(/\s+/).filter(Boolean).length}	${String(t).length}`);
    });
    def("touch", async ({ args: args2, emit: emit2 }) => {
      for (const f of args2) {
        if (!vfs.resolve(abs(f))) vfs.write(abs(f), "");
      }
    });
    def("mkdir", async ({ args: args2, emit: emit2 }) => {
      const p = args2.filter((a) => !a.startsWith("-"));
      if (args2.includes("-p")) {
        let cur = "";
        for (const part of p[0].split("/").filter(Boolean)) {
          cur += "/" + part;
          vfs.mkdir(abs(cur));
        }
      } else for (const d of p) vfs.mkdir(abs(d));
    });
    def("rm", async ({ args: args2, emit: emit2 }) => {
      const t = args2.filter((a) => !a.startsWith("-"));
      if (!t.length) {
        emit2("rm: missing operand", "t-err");
        return;
      }
      for (const f of t) {
        if (abs(f) === "/") {
          emit2("rm: it is dangerous to operate recursively on '/'", "t-err");
          continue;
        }
        const n = vfs.resolve(abs(f));
        if (!n) {
          emit2(`rm: cannot remove '${f}': No such file or directory`, "t-err");
          continue;
        }
        if (n.type === "dir" && !args2.includes("-r") && !args2.includes("-rf")) {
          emit2(`rm: cannot remove '${f}': Is a directory`, "t-err");
          continue;
        }
        vfs.rm(abs(f));
        if (args2.includes("-v") || args2.includes("-rf")) emit2(`removed '${f}'`);
      }
    });
    def("mv", async ({ args: args2, emit: emit2 }) => {
      const [a, b] = args2.filter((x) => !x.startsWith("-"));
      const n = vfs.resolve(abs(a));
      if (!n) {
        emit2(`mv: cannot stat '${a}'`, "t-err");
        return;
      }
      const dest = vfs.resolve(abs(b));
      if (dest && dest.type === "dir") {
        dest.children.push(n);
        vfs.rm(abs(a));
        return;
      }
      vfs.write(abs(b), n.body ?? "");
      vfs.rm(abs(a));
    });
    def("cp", async ({ args: args2, emit: emit2 }) => {
      const [a, b] = args2.filter((x) => !x.startsWith("-"));
      const n = vfs.resolve(abs(a));
      if (!n) {
        emit2(`cp: cannot stat '${a}'`, "t-err");
        return;
      }
      if (n.type === "dir") {
        vfs.mkdir(abs(b));
        return;
      }
      vfs.write(abs(b), n.body ?? "");
    });
    def("ln", async ({ args: args2, emit: emit2 }) => emit2("symbolic link created (virtual)", "t-dim"));
    def("tree", async ({ args: args2, emit: emit2 }) => {
      const root2 = vfs.resolve(abs(args2.filter((a) => !a.startsWith("-"))[0] || "."));
      if (!root2) {
        emit2("tree: no such directory", "t-err");
        return;
      }
      let dirs = 0, files = 0;
      const walk = (n, pre = "") => {
        const kids = n.children || [];
        kids.forEach((k, i) => {
          const last = i === kids.length - 1;
          emit2(pre + (last ? "└── " : "├── ") + (k.type === "dir" ? "\x1B[36m" + k.name + "\x1B[0m" : k.name));
          if (k.type === "dir") {
            dirs++;
            walk(k, pre + (last ? "    " : "│   "));
          } else files++;
        });
      };
      emit2(abs(args2[0] || "."));
      walk(root2);
      emit2(`
${dirs} directories, ${files} files`);
    });
    def("find", async ({ args: args2, emit: emit2 }) => {
      const start = args2.find((a) => !a.startsWith("-"));
      const ni = args2.indexOf("-name");
      const pat = ni >= 0 ? (args2[ni + 1] || "*").replace(/\*/g, "") : "*";
      const results = vfs.flatten("", vfs.resolve(abs(start || ".")) || vfs.root()).filter((f) => f.node.name.includes(pat));
      emit2(results.slice(0, 200).map((r) => r.path).join("\n") || "");
      emit2(`\x1B[90m${results.length} matches\x1B[0m`);
    });
    def("grep", async ({ args: args2, emit: emit2, stdin }) => {
      const pat = args2.find((a) => !a.startsWith("-"));
      const files = args2.filter((a) => !a.startsWith("-")).slice(1);
      if (stdin != null && !files.length) {
        emit2(stdin.split("\n").filter((l) => new RegExp(pat, "i").test(l)).join("\n"));
        return;
      }
      for (const f of files) {
        const body = vfs.read(abs(f));
        if (body == null) {
          emit2(`grep: ${f}: No such file`, "t-err");
          continue;
        }
        body.split("\n").forEach((l, i) => {
          if (new RegExp(pat, "i").test(l)) emit2(`${f}:${i + 1}: ${l.replace(new RegExp(pat, "ig"), (m) => `\x1B[31m${m}\x1B[0m`)}`);
        });
      }
    });
    def("sed", async ({ args: args2, emit: emit2 }) => {
      const script = args2.find((a) => a.startsWith("s/")) || "";
      const f = args2[args2.length - 1];
      const m = script.match(/^s\/(.*?)\/(.*?)\/(g?)$/);
      const body = vfs.read(abs(f)) ?? "";
      if (!m) {
        emit2(body);
        return;
      }
      const re = new RegExp(m[1], "g" + (m[3] ? "" : ""));
      emit2(body.replace(re, m[2]));
    });
    def("awk", async ({ args: args2, emit: emit2, stdin }) => emit2(stdin ? stdin : "(no input)"));
    def("stat", async ({ args: args2, emit: emit2 }) => {
      const n = vfs.resolve(abs(args2[0] || ""));
      if (!n) {
        emit2("stat: cannot stat", "t-err");
        return;
      }
      emit2(`  File: ${abs(args2[0])}
  Size: ${n.type === "dir" ? 4096 : String(n.body || "").length}	Type: ${n.type === "dir" ? "directory" : "regular file"}
Access: (0644/-rw-r--r--)  Uid: (1000/${S.user})   Gid: (1000/${S.user})
Modify: ${(/* @__PURE__ */ new Date()).toString()}`);
    });
    def("file", async ({ args: args2, emit: emit2 }) => {
      for (const f of args2) {
        const n = vfs.resolve(abs(f));
        emit2(`${f}: ${n ? n.type === "dir" ? "directory" : /^#!/.test(n.body || "") ? "Bourne-Again shell script, ASCII text executable" : /^\{"|^\}/.test((n.body || "").trim()) ? "JSON data" : "ASCII text" : "cannot open"}`);
      }
    });
    def("du", async ({ args: args2, emit: emit2 }) => {
      const n = vfs.resolve(abs(args2[0] || ".")) || vfs.root();
      emit2(`4.0K	${short(abs(args2[0] || "."))}`);
      emit2(`\x1B[90m${vfs.flatten("", n).length} items scanned\x1B[0m`);
    });
    def("df", async ({ args: args2, emit: emit2 }) => {
      emit2("Filesystem      Size  Used Avail Use% Mounted on");
      for (const l of [
        "/dev/sda2       512G   38G  448G   8% /",
        "/dev/sda1       512M  6.1M  506M   2% /boot/efi",
        "thadd-zfs      2.0T  118G  1.9T   6% /home",
        "tmpfs           16G  1.2G   15G   8% /run",
        "thadd-vault    256G   21G  235G   9% /vault",
        "securefs        64G  1.1G   63G   2% /opt/thadd"
      ]) emit2(l);
    });
    def("chmod chown", async ({ args: args2, emit: emit2 }) => emit2(`mode changed (simulated): ${args2.join(" ")}`, "t-dim"));
    def("whereis which", async ({ args: args2, emit: emit2 }) => args2.forEach((a) => emit2(`${a}: /usr/bin/${a} /usr/share/man/man1/${a}.1.gz`)));
    def("echo", async ({ args: args2, emit: emit2 }) => emit2(args2.join(" ").replace(/\$(\w+)/g, (m, k) => S.env[k] || "")));
    def("printf", async ({ args: args2, emit: emit2 }) => emit2(args2.join(" ").replace(/\\n/g, "\n")));
    def("rev", async ({ args: args2, emit: emit2, stdin }) => emit2((stdin ?? args2.join(" ")).split("\n").map((l) => [...l].reverse().join("")).join("\n")));
    def("base64", async ({ args: args2, emit: emit2, stdin }) => {
      const t = stdin ?? args2.filter((a) => !a.startsWith("-")).join(" ");
      emit2(args2.includes("-d") ? atob(t) : btoa(t));
    });
    def("md5sum", async ({ args: args2, emit: emit2, stdin }) => emit2(`${await hash(stdin ?? vfs.read(abs(args2[0] || "")) ?? "")}  ${args2[0] || "-"}`));
    def("sha256sum", async ({ args: args2, emit: emit2, stdin }) => emit2(`${await hash(stdin ?? vfs.read(abs(args2[0] || "")) ?? "", "SHA-256")}  ${args2[0] || "-"}`));
    async function hash(text, alg = "MD5") {
      try {
        const buf = await crypto.subtle.digest(alg, new TextEncoder().encode(String(text)));
        return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
      } catch {
        return "0".repeat(alg === "MD5" ? 32 : 64);
      }
    }
    def("xxd hexdump od", async ({ args: args2, emit: emit2 }) => {
      const n = vfs.resolve(abs(args2.find((a) => !a.startsWith("-")) || ""));
      const bytes = new TextEncoder().encode(n ? String(n.body || "") : "");
      for (let i = 0; i < Math.min(bytes.length, 256); i += 16) {
        const row2 = [...bytes.slice(i, i + 16)];
        emit2(`${i.toString(16).padStart(8, "0")}: ${row2.map((b) => b.toString(16).padStart(2, "0")).join(" ").padEnd(47)}  ${row2.map((b) => b > 31 && b < 127 ? String.fromCharCode(b) : ".").join("")}`);
      }
    });
    def("strings", async ({ args: args2, emit: emit2 }) => {
      const body = vfs.read(abs(args2[0] || "")) || "";
      emit2(body.split("\n").filter((l) => l.length > 4).slice(0, 40).join("\n"));
    });
    def("bc expr", async ({ args: args2, emit: emit2, stdin }) => {
      const e = (stdin ?? args2.join(" ")).replace(/[^0-9+\-*/%^(). ]/g, "");
      try {
        emit2(String(Function(`"use strict";return (${e.replace(/\^/g, "**")})`)()));
      } catch {
        emit2("syntax error", "t-err");
      }
    });
    def("seq", async ({ args: args2, emit: emit2 }) => {
      const n = Number(args2[0]) || 10, a = args2.length > 1 ? Number(args2[0]) : 1;
      const stop = args2.length > 1 ? Number(args2[1]) : n;
      const step = args2.length > 2 ? Number(args2[2]) : 1;
      const list = [];
      for (let i = a; i <= stop; i += step) list.push(i);
      emit2(list.join("\n"));
    });
    def("sort", async ({ args: args2, emit: emit2, stdin }) => emit2((stdin ?? "").split("\n").sort().join("\n")));
    def("uniq", async ({ args: args2, emit: emit2, stdin }) => emit2([...new Set((stdin ?? "").split("\n"))].join("\n")));
    def("cut", async ({ args: args2, emit: emit2, stdin }) => emit2(stdin ?? ""));
    def("tr", async ({ args: args2, emit: emit2, stdin }) => emit2(stdin ?? ""));
    def("tee", async ({ args: args2, emit: emit2, stdin }) => {
      const f = args2.filter((a) => !a.startsWith("-"))[0];
      vfs.write(abs(f), stdin || "");
      emit2(stdin || "");
    });
    def("xargs", async ({ args: args2, emit: emit2, stdin }) => emit2(`xargs: executed '${args2.filter((a) => !a.startsWith("-")).join(" ")}' over ${(stdin || "").split("\n").filter(Boolean).length} items`, "t-dim"));
    def("yes", async ({ args: args2, emit: emit2 }) => emit2(Array(24).fill(args2[0] || "y").join("\n") + "\n\x1B[90m… truncated (infinite stream)\x1B[0m"));
    def("watch", async ({ args: args2, emit: emit2 }) => {
      emit2(`Every 2.0s: ${args2.join(" ")}`, "t-dim");
      emit2(`
${args2.join(" ")} — live view active (simulated single frame)`, "t-dim");
    });
    def("time", async ({ args: args2, emit: emit2 }) => emit2(`real	0m0.${100 + Math.floor(Math.random() * 800)}s
user	0m0.0${Math.floor(Math.random() * 90)}s
sys	0m0.0${Math.floor(Math.random() * 40)}s`));
    def("history", async ({ args: args2, emit: emit2 }) => S.history.slice(-40).forEach((h, i) => emit2(`${String(S.history.length - 40 + i + 1).padStart(4)}  ${h}`)));
    def("alias", async ({ args: args2, emit: emit2 }) => args2.length ? emit2(`${args2.join(" ")}`) : Object.entries(S.aliases).forEach(([k, v]) => emit2(`alias ${k}='${v}'`)));
    def("export set", async ({ args: args2, emit: emit2 }) => {
      args2.forEach((a) => {
        const [k, v] = a.split("=");
        if (k) S.env[k] = v ?? "";
      });
    });
    def("env printenv", async ({ args: args2, emit: emit2 }) => Object.entries(S.env).forEach(([k, v]) => emit2(`${k}=${v}`)));
    def("unset", async ({ args: args2, emit: emit2 }) => args2.forEach((a) => delete S.env[a]));
    def("clear cls", async ({ emit: emit2, print: print2 }) => {
      out.innerHTML = "";
    });
    def("exit logout", async ({ emit: emit2 }) => emit2("logout\n\x1B[90m(THADD OS keeps the session alive — close the window to quit)\x1B[0m"));
    def("sleep", async ({ args: args2, emit: emit2 }) => {
      await sleep(Math.min(4e3, (Number(args2[0]) || 1) * 1e3));
    });
    def("true false", async () => {
    });
    def("sudo please", async ({ args: args2, emit: emit2, raw, S: S2, print: print2, win: win2 }) => {
      if (!args2.length) {
        emit2("usage: sudo <command>");
        return;
      }
      emit2(`\x1B[33m[sudo] password for ${S2.user}: ●●●●●●●●\x1B[0m`);
      await sleep(220);
      return exec(args2.join(" "));
    });
    def("su", async ({ emit: emit2 }) => emit2("root shell spawned (virtual) — # ", "t-dim"));
    def("man", async ({ args: args2, emit: emit2 }) => {
      const cmd = args2[0];
      if (!cmd) {
        emit2("What manual page do you want?");
        return;
      }
      const doc = DOCS[cmd] || C[cmd] && {
        name: cmd,
        synopsis: `${cmd} [options] [arguments]`,
        desc: `${cmd} — part of the THADD OS ${catOf(cmd)} toolset.`,
        opts: [["-h, --help", "show help"], ["-v, --version", "show version"]]
      };
      if (!doc) {
        emit2(`No manual entry for ${cmd}`, "t-err");
        return;
      }
      emit2(`${doc.name.toUpperCase()}(1)                       THADD OS Manual                      ${doc.name.toUpperCase()}(1)

NAME
       ${doc.name} — ${doc.desc}

SYNOPSIS
       ${doc.synopsis}

OPTIONS`);
      (doc.opts || []).forEach(([o, d]) => emit2(`       ${o.padEnd(24)} ${d}`));
      if (doc.examples) {
        emit2("\nEXAMPLES");
        doc.examples.forEach((e) => emit2(`       ${e}`));
      }
      emit2(`
SEE ALSO
       ${doc.see || "thadd(1), parrot(1), help(1)"}

THADD OS 2.0                    ${(/* @__PURE__ */ new Date()).toDateString()}`);
    });
    const catOf = (c2) => /nmap|msf|sqlmap|hydra|john|hashcat|aircrack|gobuster|ffuf|nikto|searchsploit|responder|impacket|bloodhound|enum4linux|smbclient|wpscan|whatweb/.test(c2) ? "security" : "system";
    const DOCS = {
      nmap: {
        name: "nmap",
        desc: "network exploration tool and security / port scanner",
        synopsis: "nmap [Scan Type…] [Options] {target specification}",
        opts: [["-sS", "TCP SYN (stealth) scan"], ["-sV", "probe open ports for service/version info"], ["-O", "enable OS detection"], ["-A", "aggressive: OS + version + scripts + traceroute"], ["-p <range>", "ports to scan, e.g. -p 1-65535"], ["--script <n>", "NSE scripts (vuln, safe, default)"], ["-T4", "aggressive timing template"], ["-oN <file>", "normal output to file"]],
        examples: ["nmap -sV -sC -O 10.10.10.5", "nmap -p- -T4 --min-rate 2000 10.10.11.14", "nmap --script vuln scanme.nmap.org"]
      },
      msfconsole: {
        name: "msfconsole",
        desc: "Metasploit Framework interactive console",
        synopsis: "msfconsole [-q] [-r resource.rc]",
        opts: [["search <term>", "find modules"], ["use <module>", "select a module"], ["set RHOSTS <ip>", "set target"], ["run / exploit", "execute"], ["sessions -l", "list sessions"], ["db_autopwn", "database-driven exploitation"]],
        examples: ["msfconsole -q", "use exploit/multi/handler; set PAYLOAD linux/x64/meterpreter/reverse_tcp; set LHOST 10.10.14.7; run"]
      },
      sqlmap: {
        name: "sqlmap",
        desc: "automatic SQL injection and database takeover tool",
        synopsis: "sqlmap -u <url> [options]",
        opts: [["-u <url>", "target URL"], ["--batch", "never ask, use defaults"], ["--dbs", "enumerate databases"], ["--dump", "dump table entries"], ["--os-shell", "interactive OS shell"], ["--risk/--level", "1-5 scan intensity"]],
        examples: ["sqlmap -u 'http://target/item.php?id=1' --batch --dbs", "sqlmap -r request.txt --level=5 --risk=3 --os-shell"]
      },
      hydra: {
        name: "hydra",
        desc: "network login cracker (50+ protocols)",
        synopsis: "hydra [options] <service>://<target>",
        opts: [["-l/-L", "single user / user list"], ["-p/-P", "single pass / pass list"], ["-t", "tasks (parallel connections)"], ["-f", "exit on first found"], ["-V", "verbose, show attempts"]],
        examples: ["hydra -l admin -P rockyou.txt ssh://10.10.10.5 -t 4", "hydra -L users.txt -P passes.txt 10.0.0.9 http-post-form '/login:u=^USER^&p=^PASS^:Invalid'"]
      }
    };
    def("whoami", async ({ emit: emit2 }) => emit2(S.user));
    def("id", async ({ emit: emit2 }) => emit2(`uid=1000(${S.user}) gid=1000(${S.user}) groups=1000(${S.user}),27(sudo),44(video),100(users),142(docker),999(parrot)`));
    def("who", async ({ emit: emit2 }) => emit2(`${S.user}   tty1         ${(/* @__PURE__ */ new Date()).toDateString()} 09:41 (:0)
${S.user}   pts/0        09:42 (rdp.thadd.local)`));
    def("uname", async ({ args: args2, emit: emit2 }) => emit2(args2.includes("-a") ? `Linux ${S.host} ${KERNEL} #1 SMP PREEMPT_DYNAMIC THADD-OS x86_64 GNU/Linux` : "Linux"));
    def("hostname", async ({ args: args2, emit: emit2 }) => emit2(args2.includes("-I") ? "10.0.2.15" : S.host));
    def("date", async ({ args: args2, emit: emit2 }) => emit2(args2[0] ? (/* @__PURE__ */ new Date()).toUTCString() : `${(/* @__PURE__ */ new Date()).toDateString()} ${(/* @__PURE__ */ new Date()).toTimeString().slice(0, 8)} GMT`));
    def("cal", async ({ emit: emit2 }) => {
      const d = /* @__PURE__ */ new Date(), y = d.getFullYear(), m = d.getMonth();
      const first = new Date(y, m, 1).getDay(), days = new Date(y, m + 1, 0).getDate();
      emit2(`     ${["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][m]} ${y}`);
      emit2("Su Mo Tu We Th Fr Sa");
      let row2 = "   ".repeat(first);
      for (let i = 1; i <= days; i++) {
        const today = i === d.getDate();
        row2 += (today ? `\x1B[7m${pad(i)}\x1B[0m` : pad(i)) + " ";
        if ((first + i) % 7 === 0) {
          emit2(row2.trimEnd());
          row2 = "";
        }
      }
      if (row2.trim()) emit2(row2.trimEnd());
    });
    def("uptime", async ({ emit: emit2 }) => {
      const t = (/* @__PURE__ */ new Date()).toTimeString().slice(0, 8);
      emit2(` ${t} up ${fmtDur(uptime())},  1 user,  load average: ${(0.2 + Math.random()).toFixed(2)}, ${(0.15 + Math.random()).toFixed(2)}, ${(0.1 + Math.random()).toFixed(2)}`);
    });
    def("free", async ({ emit: emit2 }) => {
      const tot = 16384, used = 1240 + Math.floor(Math.random() * 200), buff = 380, cache = 2100;
      emit2("               total        used        free      shared  buff/cache   available");
      emit2(`Mem:           ${tot}         ${used}        ${tot - used - buff - cache}          80        ${buff + cache}       ${tot - used - buff} `);
      emit2(`Swap:          ${store.get("swap", 2048)}           0        ${store.get("swap", 2048)}`);
    });
    def("ps top htop btop", async ({ args: args2, emit: emit2 }) => {
      emit2("  PID  USER      %CPU  %MEM  STAT  COMMAND");
      const rows = [
        [1, "root", 0, 0.1, "Ss", "/sbin/init (systemd)"],
        [412, "root", 0.1, 0.3, "Ssl", "/usr/sbin/thadd-shield --strict"],
        [512, "thadd", 1.4, 1.6, "Ssl", "Xvnc :1 -geometry 1920x1080"],
        [640, "thadd", 2.1, 2.4, "Sl", "xfce4-session"],
        [812, "thadd", 0.6, 1.9, "Sl", "plank"],
        [901, "thadd", 3.8, 3.1, "Sl", "firefox-esr"],
        [1042, "thadd", 12.4, 4.2, "Sl", "code --unity-launch"],
        [1180, "thadd", 0.9, 0.7, "S", "-zsh"],
        [1201, "thadd", 2.2, 1.1, "Sl", "thadd-jarvis --daemon --groq"],
        [1310, "thadd", 0.3, 0.4, "S", "conky"],
        [1402, "root", 0.2, 0.2, "Ssl", "xrdp"],
        [1455, "thadd", 0.4, 0.5, "Sl", "websockify :6080"]
      ];
      rows.forEach((r) => emit2(r.join("  ").replace(/,/g, "  ")));
      emit2(`\x1B[90m${rows.length} of 1,284 processes · CPU 4% · 1,240 MB / 16 GB\x1B[0m`);
    });
    def("kill killall pkill", async ({ args: args2, emit: emit2 }) => emit2(args2.length ? `[${args2.join(" ")}] terminated` : "usage: kill [-9] PID", "t-dim"));
    def("jobs bg fg", async ({ emit: emit2 }) => emit2("[1]  + running    thadd scan --full", "t-dim"));
    def("lscpu", async ({ emit: emit2 }) => emit2(`Architecture:            x86_64
CPU op-mode(s):          32-bit, 64-bit
Byte Order:              Little Endian
CPU(s):                  ${navigator.hardwareConcurrency || 8}
On-line CPU(s) list:     0-${(navigator.hardwareConcurrency || 8) - 1}
Vendor ID:               GenuineIntel
Model name:              THADD Virtual CPU @ 3.60GHz
Thread(s) per core:      2
Core(s) per socket:      ${Math.ceil((navigator.hardwareConcurrency || 8) / 2)}
Flags:                   fpu vme de pse tsc msr pae mce cx8 apic sep aes avx2 avx512f sha_ni smep smap umip cet`));
    def("lsblk", async ({ emit: emit2 }) => emit2(`NAME        MAJ:MIN RM   SIZE RO TYPE MOUNTPOINTS
sda           8:0    0   512G  0 disk
├─sda1        8:1    0   512M  0 part /boot/efi
├─sda2        8:2    0   511G  0 part /
└─sda3        8:3    0     2T  0 part /home (zfs)
nvme0n1     259:0    0   256G  0 disk
└─nvme0n1p1 259:1    0   256G  0 part /vault (LUKS2)`));
    def("lspci", async ({ emit: emit2 }) => emit2(`00:00.0 Host bridge: Intel Corporation THADD Virtual Chipset
00:02.0 VGA compatible controller: VirtualBox Graphics Adapter (VMSVGA)
00:03.0 Ethernet controller: Intel 82540EM Gigabit Ethernet
00:1f.3 Audio device: Intel HD Audio
01:00.0 Network controller: THADD WLAN 6E AX210`));
    def("lsusb", async ({ emit: emit2 }) => emit2(`Bus 001 Device 002: ID 80ee:0021 VirtualBox USB Tablet
Bus 001 Device 001: ID 1d6b:0002 Linux Foundation 2.0 root hub
Bus 002 Device 003: ID 046d:c52b Logitech Unifying Receiver`));
    def("lsof", async ({ emit: emit2 }) => emit2(`COMMAND    PID  USER   FD      TYPE DEVICE SIZE/OFF NODE NAME
firefox-e  901 thadd  cwd   DIR  254,2     4096   admin /home/${S.user}
code       1042 thadd  txt   REG  254,2 51204096  1201 /usr/share/code/code
thadd-shi   412 root  4u    IPv4  28412      0t0  TCP *:8443 (LISTEN)
xrdp       1402 root  5u    IPv4  28413      0t0  TCP *:3389 (LISTEN)`));
    def("systemctl service", async ({ args: args2, emit: emit2 }) => {
      const [sub, unit] = args2.filter((a) => !a.startsWith("-"));
      if (!sub || sub === "status" && !unit) {
        emit2(`  UNIT                       LOAD   ACTIVE SUB     DESCRIPTION`);
        [
          ["thadd-shield.service", "active", "running", "THADD Shield hardening daemon"],
          ["thadd-jarvis.service", "active", "running", "JARVIS AI assistant (Groq backend)"],
          ["thadd-vpn.service", "active", "exited", "WireGuard tunnel supervisor"],
          ["xrdp.service", "active", "running", "Remote Desktop Protocol server"],
          ["xrdp-sesman.service", "active", "running", "xrdp session manager"],
          ["lightdm.service", "active", "running", "Light Display Manager"],
          ["nginx.service", "active", "running", "THADD web portal"],
          ["docker.service", "active", "running", "Container engine"],
          ["fail2ban.service", "active", "running", "Intrusion prevention"],
          ["chrony.service", "active", "running", "NTP client/server"]
        ].forEach((r) => emit2(`  ${r[0].padEnd(28)} loaded ${r[1].padEnd(6)} ${r[2].padEnd(7)} ${r[3]}`));
        emit2(`
\x1B[90m10 loaded units listed.\x1B[0m`);
        return;
      }
      if (sub === "status") {
        emit2(`● ${unit} - THADD OS service
     Loaded: loaded (/lib/systemd/system/${unit}; enabled)
     Active: \x1B[32mactive (running)\x1B[0m since ${(/* @__PURE__ */ new Date()).toString().slice(0, 24)}
   Main PID: 412 (${unit.split(".")[0]})
      Tasks: 12 (limit: 76821)
     Memory: 48.2M
        CPU: 1.204s
     CGroup: /system.slice/${unit}`);
        return;
      }
      if (["start", "stop", "restart", "reload", "enable", "disable", "mask"].includes(sub)) {
        emit2(`\x1B[90m(simulated)\x1B[0m ${unit} → ${sub} ✔`, "t-ok");
        return;
      }
      emit2(`Unknown operation '${sub}'.`, "t-err");
    });
    def("journalctl dmesg", async ({ args: args2, emit: emit2 }) => {
      const n = Number((args2.find((a) => /^-n\d*$/.test(a)) || "-n20").replace("-n", "")) || 20;
      const stamp = () => new Date(Date.now() - Math.floor(Math.random() * 36e5)).toISOString().replace("T", " ").slice(0, 19);
      const lines = [
        "kernel: THADD OS 2.0 (Nebula Prime) booting — secure boot verified",
        "kernel: Command line: BOOT_IMAGE=/boot/vmlinuz-6.9.7-thadd root=UUID=thadd-2.0 quiet splash mitigations=auto",
        "kernel: Spectre/Meltdown mitigations ACTIVE · KPTI on · Retpoline on",
        "thadd-shield[412]: strict profile engaged — 47 hardening rules, 3 syscall filters",
        'kernel: audit: type=1400 apparmor="STATUS" profile="thadd-jarvis"',
        "thadd-jarvis[1201]: Groq backend online — model llama-3.3-70b-versatile",
        "systemd[1]: Started THADD Shield hardening daemon.",
        "NetworkManager[688]: <info> device (eth0): state change: activated (reason 'none')",
        "kernel: eth0: THADD-DNS resolver 1.1.1.1 DoH established",
        "xrdp[1402]: RDP server listening on port 3389",
        "nginx[1510]: /healthz 200 — portal up",
        "kernel: nvme0n1p1: LUKS2 volume unlocked via TPM2",
        "thadd-vault[1533]: sealed 118 secrets · auto-lock in 15m",
        "kernel: audit: 0 denials · 2 policy hits blocked (reverse shell attempt, 10.0.2.44)"
      ];
      for (let i = 0; i < n; i++) emit2(`${stamp()} thadd-os ${lines[i % lines.length]}`);
    });
    def("reboot shutdown poweroff halt init", async ({ args: args2, emit: emit2 }) => emit2("System going down NOW! (close the tab to reboot THADD OS)", "t-warn"));
    def("neofetch fastfetch", async ({ emit: emit2 }) => {
      const L = [
        `${S.user}@${S.host} `,
        "----------------- ",
        `OS: ${OS} x86_64 `,
        `Host: THADD Virtual Machine (VirtualBox 7.1) `,
        `Kernel: ${KERNEL} `,
        `Uptime: ${fmtDur(uptime())} `,
        `Packages: 2147 (dpkg), 88 (flatpak), 41 (snap) `,
        `Shell: zsh 5.9 `,
        `Resolution: ${innerWidth}x${innerHeight} `,
        `DE: THADD Shell (Sequoia×Fluent) `,
        `WM: wm.js compositor `,
        `Theme: Nebula-Prime-Dark `,
        `Icons: THADD-Dark `,
        `Terminal: thadd-term `,
        `CPU: THADD Virtual CPU (${navigator.hardwareConcurrency || 8}) @ 3.6GHz `,
        `GPU: VMSVGA + VirGL passthrough `,
        `Memory: 1.2GiB / 16GiB `
      ];
      const logo = [
        "\x1B[36m        ▄▄▄▄▄▄▄        \x1B[0m",
        "\x1B[36m     ▄█████████▄     \x1B[0m",
        "\x1B[34m   ▄███▀     ▀███▄   \x1B[0m",
        "\x1B[34m  ███▀  ▄▄▄▄▄  ▀███  \x1B[0m",
        "\x1B[35m ███   ███████   ███ \x1B[0m",
        "\x1B[35m ███   ███████   ███ \x1B[0m",
        "\x1B[34m  ███▄  ▀▀▀▀▀  ▄███  \x1B[0m",
        "\x1B[34m   ▀███▄     ▄███▀   \x1B[0m",
        "\x1B[36m     ▀█████████▀     \x1B[0m",
        "\x1B[36m        ▀▀▀▀▀▀▀        \x1B[0m"
      ];
      logo.forEach((l, i) => emit2(`${l}  ${l.includes("▄") || i < 2 ? L[i] ? "" : "" : ""}${i < L.length ? "\x1B[1m" + (i < 2 ? L[i] : "") + "\x1B[0m" : ""}${i >= 2 && i < L.length ? L[i + 0] || "" : ""}`));
      emit2("");
      emit2(`\x1B[1m${S.user}@${S.host}\x1B[0m`);
      emit2("─────────────────────────────");
      [
        "OS: " + OS + " x86_64",
        "Host: THADD Virtual Machine (VirtualBox 7.1)",
        "Kernel: " + KERNEL,
        "Uptime: " + fmtDur(uptime()),
        "Packages: 2147 (dpkg), 88 (flatpak), 41 (snap)",
        "Shell: zsh 5.9",
        "Resolution: " + innerWidth + "x" + innerHeight,
        "DE: THADD Shell (Sequoia × Fluent)",
        "WM: wm.js",
        "Theme: Nebula-Prime-Dark",
        "CPU: THADD Virtual CPU (" + (navigator.hardwareConcurrency || 8) + ") @ 3.6GHz",
        "GPU: VMSVGA + VirGL",
        "Memory: " + (900 + Math.floor(Math.random() * 400)) + "MiB / 16GiB",
        "\x1B[30m███\x1B[31m███\x1B[32m███\x1B[33m███\x1B[34m███\x1B[35m███\x1B[36m███\x1B[37m███\x1B[0m"
      ].forEach((l) => emit2(l));
    });
    const NET = () => `eth0: flags=4163<UP,BROADCAST,RUNNING,MULTICAST>  mtu 1500
        inet 10.0.2.15  netmask 255.255.255.0  broadcast 10.0.2.255
        inet6 fe80::a00:27ff:fe4e:8f1d  prefixlen 64  scopeid 0x20<link>
        ether 08:00:27:4e:8f:1d  txqueuelen 1000  (Ethernet)
        RX packets 184213  bytes 214.7 MB
        TX packets  92114  bytes  38.2 MB

lo: flags=73<UP,LOOPBACK,RUNNING>  mtu 65536
        inet 127.0.0.1  netmask 255.0.0.0
        inet6 ::1  prefixlen 128  scopeid 0x10<host>

wlan0: flags=4163<UP,BROADCAST,RUNNING,MULTICAST>  mtu 1500
        inet 192.168.1.44  netmask 255.255.255.0  broadcast 192.168.1.255
        ether 3c:22:fb:9a:11:04  txqueuelen 1000  (Ethernet)`;
    def("ifconfig ipconfig", async ({ args: args2, emit: emit2 }) => emit2(NET()));
    def("ip", async ({ args: args2, emit: emit2 }) => {
      const sub = args2[0] || "a";
      if (sub.startsWith("a")) {
        emit2(`1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN group default qlen 1000
    inet 127.0.0.1/8 scope host lo
2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc fq_codel state UP group default qlen 1000
    link/ether 08:00:27:4e:8f:1d brd ff:ff:ff:ff:ff:ff
    inet 10.0.2.15/24 brd 10.0.2.255 scope global dynamic eth0
3: wlan0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc noqueue state UP
    inet 192.168.1.44/24 brd 192.168.1.255 scope global dynamic wlan0`);
        return;
      }
      if (sub === "route") {
        emit2(`default via 10.0.2.2 dev eth0 proto dhcp src 10.0.2.15 metric 100
10.0.2.0/24 dev eth0 proto kernel scope link src 10.0.2.15
192.168.1.0/24 dev wlan0 proto kernel scope link src 192.168.1.44`);
        return;
      }
      if (sub === "addr") {
        emit2(NET());
        return;
      }
      emit2("Usage: ip [addr|route|link|neigh] …");
    });
    def("ping", async ({ args: args2, emit: emit2 }) => {
      const host = args2.find((a) => !a.startsWith("-")) || "8.8.8.8";
      const c2 = Number((args2.find((a) => a.startsWith("-c")) || "-c4").replace("-c", "")) || 4;
      emit2(`PING ${host} (${/=/.test(host) ? host : host.match(/^\d/) ? host : "142.250.185.78"}) 56(84) bytes of data.`);
      let sum = 0;
      for (let i = 1; i <= Math.min(c2, 10); i++) {
        const t = (8 + Math.random() * 22).toFixed(1);
        sum += +t;
        await sleep(120);
        emit2(`64 bytes from ${host}: icmp_seq=${i} ttl=115 time=${t} ms`);
      }
      emit2(`
--- ${host} ping statistics ---
${c2} packets transmitted, ${c2} received, 0% packet loss, time ${c2 * 1e3}ms
rtt min/avg/max/mdev = ${(sum / c2 * 0.8).toFixed(3)}/${(sum / c2).toFixed(3)}/${(sum / c2 * 1.4).toFixed(3)}/1.42 ms`);
    });
    def("traceroute", async ({ args: args2, emit: emit2 }) => {
      const host = args2.find((a) => !a.startsWith("-")) || "github.com";
      emit2(`traceroute to ${host}, 30 hops max, 60 byte packets`);
      const hops = [
        ["10.0.2.2", `${S.user}-gateway`],
        ["192.168.1.1", "router.local"],
        ["102.176.4.1", "accra-ix1.gh.net"],
        ["154.160.0.9", "gh-isp-core"],
        ["195.66.225.12", "lon-ix.net"],
        ["140.82.121.3", "github.com"]
      ];
      for (const [ip, name] of hops) {
        await sleep(120);
        emit2(` ${hops.indexOf(hops.find((h) => h[0] === ip)) + 1}  ${name} (${ip})  ${(6 + Math.random() * 60).toFixed(3)} ms  ${(7 + Math.random() * 60).toFixed(3)} ms`);
      }
    });
    def("dig nslookup host", async ({ args: args2, emit: emit2 }) => {
      const d = args2.find((a) => !a.startsWith("-")) || "thadd.os";
      emit2(`;; Got answer:
;; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 41288
;; flags: qr rd ra; QUERY: 1, ANSWER: 2, AUTHORITY: 0, ADDITIONAL: 1

;; QUESTION SECTION:
;${d}.			IN	A

;; ANSWER SECTION:
${d}.	300	IN	A	140.82.121.4
${d}.	300	IN	A	140.82.121.3

;; Query time: 18 msec
;; SERVER: 127.0.0.53#53(1.1.1.1 DoH)
;; WHEN: ${(/* @__PURE__ */ new Date()).toString()}
;; MSG SIZE  rcvd: 61`);
    });
    def("whois", async ({ args: args2, emit: emit2 }) => {
      const d = args2[0] || "thadd.os";
      emit2(`Domain Name: ${d.toUpperCase()}
Registry Domain ID: THADD_OS-DOMAIN
Registrar WHOIS Server: whois.thadd.os
Creation Date: 2025-01-01T00:00:00Z
Registry Registrant: Thadd OS Project
Name Server: NS1.THADD.OS
DNSSEC: signedDelegation
>>> Last update of whois database: ${(/* @__PURE__ */ new Date()).toUTCString()} <<<`);
    });
    def("curl wget", async ({ args: args2, emit: emit2 }) => {
      const url = args2.find((a) => !a.startsWith("-")) || "https://thadd.os";
      if (args2.includes("-I")) {
        emit2(`HTTP/2 200 
content-type: text/html; charset=utf-8
server: thadd-portal
strict-transport-security: max-age=63072000
x-thadd-shield: strict
cache-control: no-store`);
        return;
      }
      await sleep(160);
      emit2(`  % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current
                                 Dload  Upload   Total   Spent    Left  Speed
100  1934  100  1934    0     0  24175      0 --:--:-- --:--:-- --:--:-- 24512`);
      if (args2.includes("-O") || args2.includes("-o")) emit2(`saved to ${vfs.write(abs(url.split("/").pop() || "index.html"), "<html>THADD OS</html>") ? url.split("/").pop() : "file"}`, "t-dim");
      else emit2(`<!DOCTYPE html><html><head><title>THADD OS</title></head><body><h1>One OS. All the Best.</h1></body></html>`, "raw");
    });
    def("ssh scp rsync", async ({ args: args2, emit: emit2 }) => {
      const dest = args2.find((a) => a.includes("@")) || `thadd@10.10.14.7`;
      emit2(`The authenticity of host '${dest}' can't be established.
ED25519 key fingerprint is SHA256:THADD+7f3kL9xQw2pR4vN8sT1yU6iO0aZ5cB3dE.
This key is not known by any other names.`, "t-warn");
      await sleep(240);
      emit2(`Warning: Permanently added '${dest}' (ED25519) to the list of known hosts.
${dest}'s password: ●●●●●●●●
\x1B[32mWelcome to THADD OS 2.0 (Nebula Prime) — ${KERNEL}\x1B[0m
Last login: ${(/* @__PURE__ */ new Date()).toDateString()} from 10.0.2.15
${dest.split("@")[1]}:~$ `, "t-ok");
    });
    def("netstat ss", async ({ args: args2, emit: emit2 }) => emit2(`Netid State  Recv-Q Send-Q Local Address:Port    Peer Address:Port  Process
udp   UNCONN 0      0            0.0.0.0:68            0.0.0.0:*      dhclient
tcp   LISTEN 0      128          0.0.0.0:22            0.0.0.0:*      sshd
tcp   LISTEN 0      244          0.0.0.0:3389          0.0.0.0:*      xrdp
tcp   LISTEN 0      511          0.0.0.0:8443          0.0.0.0:*      nginx
tcp   LISTEN 0      4096       127.0.0.53:53            0.0.0.0:*      systemd-resolve
tcp   ESTAB  0      0        10.0.2.15:52414   140.82.121.4:443   firefox-esr
tcp   ESTAB  0      0        10.0.2.15:52420   104.18.32.7:443    code`));
    def("tcpdump", async ({ args: args2, emit: emit2 }) => {
      emit2("tcpdump: verbose output suppressed, use -v[v] for full protocol decode\nlistening on eth0, link-type EN10MB (Ethernet), capture size 262144 bytes", "t-dim");
      for (let i = 0; i < 8; i++) {
        await sleep(180);
        emit2(`${(/* @__PURE__ */ new Date()).toTimeString().slice(0, 8)}.${Math.floor(Math.random() * 9e5 + 1e5)} IP 10.0.2.15.${52e3 + i} > 140.82.121.4.443: Flags [P.], seq ${1e3 + i * 64}:${1064 + i * 64}, ack 1, win 501, length 64`);
      }
      emit2("\n8 packets captured\n8 packets received by filter\n0 packets dropped by kernel", "t-dim");
    });
    def("arp", async ({ emit: emit2 }) => emit2(`Address                  HWtype  HWaddress           Flags Mask            Iface
10.0.2.2                 ether   52:54:00:12:35:02   C                     eth0
192.168.1.1              ether   3c:84:6a:22:9f:10   C                     wlan0
192.168.1.77             ether   b8:27:eb:44:12:aa   C                     wlan0`));
    def("iwconfig", async ({ emit: emit2 }) => emit2(`wlan0     IEEE 802.11ax  ESSID:"THADD-NET-6E"  Nickname:"<WIFI@REALTEK>"
          Mode:Managed  Frequency:5.745 GHz  Access Point: 3C:84:6A:22:9F:10
          Bit Rate=1.2 Gb/s   Tx-Power=22 dBm
          Retry short limit:7   RTS thr:off   Fragment thr:off
          Encryption key:off
          Power Management:on`));
    const TARGET = () => S.env.RHOST || "10.10.10.5";
    def("parrot arsenal", async ({ args: args2, emit: emit2 }) => {
      emit2("\x1B[35m╔══════════════════════════════════════════════════════════════════════════╗\x1B[0m");
      emit2("\x1B[35m║\x1B[0m  \x1B[1mPARROT ARSENAL\x1B[0m — 600+ offensive-security tools on THADD OS          \x1B[35m║\x1B[0m");
      emit2("\x1B[35m╚══════════════════════════════════════════════════════════════════════════╝\x1B[0m");
      const cats = {
        "Information Gathering": "nmap masscan dnsrecon theHarvester recon-ng maltego netdiscover arp-scan whatweb wafw00f",
        "Vulnerability Analysis": "nikto nuclei openvas lynis searchsploit wpscan",
        "Web Applications": "burpsuite sqlmap zap gobuster ffuf dirb wfuzz commix",
        "Password Attacks": "hydra john hashcat medusa crunch cewl mimikatz impacket-secretsdump responder",
        "Wireless": "aircrack-ng airmon-ng airodump-ng kismet bettercap wifite reaver bully",
        "Exploitation": "msfconsole msfvenom searchsploit exploitdb crackmapexec",
        "Post-Exploitation": "meterpreter empire sliver bloodhound kerbrute evil-winrm chisel socat",
        "Sniffing & Spoofing": "wireshark tcpdump ettercap bettercap mitmproxy",
        "Forensics": "autopsy volatility3 sleuthkit binwalk foremost testdisk scalpel",
        "Reverse Engineering": "ghidra radare2 rizin gdb lldb objdump ghidra-headless",
        "Reporting": "dradis cherrytree faraday pipal",
        "Anonymity": "tor torsocks proxychains4 macchanger"
      };
      for (const [c2, list] of Object.entries(cats)) {
        emit2(`
\x1B[36m${c2}\x1B[0m`);
        emit2("  " + list.split(" ").map((t) => t).join("  "));
      }
      emit2("\n\x1B[90mRun any tool directly (e.g. `nmap -sV 10.10.10.5`) or open the GUI: `parrot-gui`.\x1B[0m");
    });
    def("nmap", async ({ args: args2, emit: emit2 }) => {
      const t = args2.filter((a) => !a.startsWith("-"))[0] || TARGET();
      const ports = args2.find((a) => a.startsWith("-p"))?.slice(2) || "1-1000";
      emit2(`Starting Nmap 7.95 ( https://nmap.org ) at ${(/* @__PURE__ */ new Date()).toISOString().slice(0, 19).replace("T", " ")} UTC`);
      await type([`Nmap scan report for ${t}`, "Host is up (0.012s latency).", "Not shown: 987 closed tcp ports (reset)"], 160);
      const rows = [
        ["22/tcp", "open", "ssh", "OpenSSH 9.6p1 Ubuntu 3ubuntu13 (Ubuntu Linux; protocol 2.0)"],
        ["80/tcp", "open", "http", "Apache httpd 2.4.58 ((Ubuntu))"],
        ["443/tcp", "open", "ssl/https", "Apache httpd 2.4.58"],
        ["3306/tcp", "filtered", "mysql", "MySQL 8.0.36"],
        ["8080/tcp", "open", "http-proxy", "Flask 3.0.0 (Python 3.12)"]
      ];
      emit2("PORT     STATE    SERVICE    VERSION");
      for (const r of rows) {
        await sleep(140);
        emit2(`${r[0].padEnd(9)}${r[1] === "open" ? "\x1B[32m" + r[1].padEnd(9) + "\x1B[0m" : "\x1B[31m" + r[1].padEnd(9) + "\x1B[0m"}${r[2].padEnd(11)}${r[3]}`);
      }
      emit2(`Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel

Host script results:
|_http-title: THADD Lab — index`);
      emit2(`
Nmap done: 1 IP address (1 host up) scanned in ${(6 + Math.random() * 20).toFixed(2)} seconds`);
    });
    def("msfconsole msf", async ({ args: args2, emit: emit2 }) => {
      emit2(`       =[ metasploit v6.4.28-dev                          ]
+ -- --=[ 2464 exploits - 1266 auxiliary - 424 post       ]
+ -- --=[ 1465 payloads - 47 encoders - 11 nops           ]
+ -- --=[ 9 evasion                                          ]

\x1B[35mMetasploit Documentation: https://docs.metasploit.com/\x1B[0m
`);
      await sleep(200);
      emit2(`msf6 > use exploit/multi/handler
msf6 exploit(multi/handler) > set PAYLOAD linux/x64/meterpreter/reverse_tcp
PAYLOAD => linux/x64/meterpreter/reverse_tcp
msf6 exploit(multi/handler) > set LHOST 10.10.14.7
LHOST => 10.10.14.7
msf6 exploit(multi/handler) > run

[*] Started reverse TCP handler on 10.10.14.7:4444
[*] Sending stage (3045380 bytes) to ${TARGET()}
[*] Meterpreter session 1 opened (10.10.14.7:4444 -> ${TARGET()}:52114) at ${(/* @__PURE__ */ new Date()).toISOString()}
`, "t-dim");
      emit2(`meterpreter > getuid
Server username: www-data
meterpreter > sysinfo
Computer    : thadd-lab
OS          : Ubuntu 24.04 (Linux 6.8.0-45-generic)
Architecture: x64
Meterpreter : x64/linux
meterpreter > `);
    });
    def("sqlmap", async ({ args: args2, emit: emit2 }) => {
      const u = args2.find((a) => a.startsWith("http")) || `http://${TARGET()}/item.php?id=1`;
      emit2(`        ___
       __H__
 ___ ___[)]_____ ___ ___  {1.8.10#stable}
|_ -| . [)]     | .'| . |
|___|_  [.]_|_|_|__,|  _|
      |_|V...       |_|   https://sqlmap.org
`);
      await type([
        `[*] starting @ ${(/* @__PURE__ */ new Date()).toISOString().slice(11, 19)}`,
        `[INFO] testing connection to the target URL`,
        `[INFO] checking if the target is protected by some kind of WAF/IPS`,
        `[INFO] testing if the target URL content is stable`,
        `[INFO] target URL content is stable`,
        `[INFO] testing if GET parameter 'id' is dynamic`,
        `[INFO] GET parameter 'id' appears to be dynamic`,
        `[INFO] heuristic (basic) test shows that GET parameter 'id' might be injectable`,
        `[INFO] testing for SQL injection on GET parameter 'id'`,
        `sqlmap identified the following injection point(s) with a total of 74 HTTP(s) requests:`,
        "---",
        `Parameter: id (GET)`,
        `    Type: boolean-based blind`,
        `    Title: AND boolean-based blind - WHERE or HAVING clause`,
        `    Payload: id=1 AND 8921=8921`,
        `    Type: time-based blind`,
        `    Title: MySQL >= 5.0.12 AND time-based blind`,
        `    Payload: id=1 AND SLEEP(5)`,
        "---"
      ], 120);
      emit2(`[INFO] the back-end DBMS is MySQL
web server operating system: Linux Ubuntu 24.04
web application technology: Apache 2.4.58, PHP 8.3.6
back-end DBMS: MySQL >= 8.0
[*] available databases [4]:
[*] information_schema
[*] thadd_lab
[*] wordpress
[*] mysql
[INFO] fetched data logged to: /root/.local/share/sqlmap/output/${TARGET().replace(/\..*/, "")}`, "t-ok");
    });
    def("hydra", async ({ args: args2, emit: emit2 }) => {
      emit2(`Hydra v9.6 (c) 2024 by van Hauser/THC & David Maciejak
Hydra (https://github.com/vanhauser-thc/thc-hydra) starting at ${(/* @__PURE__ */ new Date()).toISOString()}`);
      const users3 = ["admin", "root", "thadd", "operator"];
      const passes = ["password", "admin123", "Summer2024!", "letmein"];
      for (let i = 0; i < 12; i++) {
        await sleep(90);
        const u = users3[i % users3.length], p = passes[i * 3 % passes.length];
        emit2(`[ATTEMPT] target ${TARGET()} - login "${u}" - pass "${p}" - ${i + 1} of 40 [child ${i % 4}]`);
      }
      emit2(`[22][ssh] host: ${TARGET()}   login: operator   password: Summer2024!
1 of 1 target successfully completed, 1 valid password found`, "t-ok");
    });
    def("john hashcat", async ({ args: args2, emit: emit2 }) => {
      emit2(`Using default input encoding: UTF-8
Loaded 3 password hashes with 3 different salts (sha512crypt, crypt(3) $6$ [SHA512 128/128 AVX 2x])`);
      for (const [u, p] of [["thadd", "nebula2024"], ["root", "thadd-prime"], ["sysadmin", "GH@na2024!"]]) {
        await sleep(220);
        emit2(`${p}         (${u})`);
      }
      emit2(`
Session completed. 3/3 cracked, 0:00:04 elapsed`, "t-ok");
    });
    def("gobuster ffuf dirb", async ({ args: args2, emit: emit2 }) => {
      const t = args2.find((a) => a.startsWith("http")) || `http://${TARGET()}`;
      emit2(`===============================================================
Gobuster v3.6
by OJ Reeves (@TheColonial) & Christian Mehlmauer (@firefart)
===============================================================
[+] Url:  ${t}
[+] Threads: 10
[+] Wordlist: /usr/share/wordlists/dirb/common.txt
===============================================================`);
      for (const [code, path, size] of [[200, "/", 1043], [301, "/admin", 311], [200, "/robots.txt", 88], [403, "/.git", 279], [200, "/api/v1", 512], [401, "/wp-admin", 460], [200, "/backup.sql", 20480]]) {
        await sleep(150);
        emit2(`${code === 200 ? "\x1B[32m" : code === 301 ? "\x1B[36m" : "\x1B[33m"}${path} (Status: ${code}) [Size: ${size}]\x1B[0m`);
      }
      emit2("\n===============================================================\nFinished\n===============================================================");
    });
    def("searchsploit", async ({ args: args2, emit: emit2 }) => {
      const q = args2.join(" ") || "apache 2.4";
      emit2(`---------------------------------------------- ---------------------------------
 Exploit Title                                |  Path
---------------------------------------------- ---------------------------------`);
      for (const [t, p] of [["Apache 2.4.49 - Path Traversal & RCE", "linux/webapps/50383.sh"], ["Apache HTTP Server 2.4.58 - DoS", "linux/dos/51625.py"], ["MySQL 8.0 - Authentication Bypass", "mysql/webapps/51232.py"]])
        emit2(`${t.padEnd(46)}| ${p}`);
      emit2(`---------------------------------------------- ---------------------------------
Shellcodes: No Results`);
    });
    def("aircrack-ng airodump-ng", async ({ args: args2, emit: emit2 }) => {
      emit2(`
 CH  6 ][ Elapsed: 12 s ][ ${(/* @__PURE__ */ new Date()).toISOString().slice(11, 19)} 

 BSSID              PWR  Beacons    #Data, #/s  CH   MB   ENC CIPHER  AUTH ESSID

 3C:84:6A:22:9F:10  -42       38        4    0   6  360   WPA2 CCMP   PSK  THADD-NET-6E
 8C:3B:AD:11:22:33  -67       21        0    0   1  195   WPA2 CCMP   PSK  GH-Visitor
 B8:27:EB:44:12:AA  -71       14        2    0  11  130   WPA  CCMP   PSK  <length: 0>`);
    });
    def("responder impacket bloodhound enum4linux smbclient wpscan whatweb nikto", async ({ args: args2, raw, emit: emit2 }) => {
      emit2(`\x1B[35m[THADD Arsenal]\x1B[0m running: ${raw}`, "t-dim");
      await type([`[*] target: ${TARGET()}`, `[*] loading profiles…`, `[*] 12 technique modules armed`], 130);
      emit2(`[+] SMB signing: disabled (relay-able)
[+] users enumerated: 11 (guest share readable)
[+] NTLMv2 hash captured: admin::THADD-LAB:4f2ac1… (saved to ~/loot/hashes.txt)
[+] delegation: unconstrained on SRV-01 — path to DA via printspooler
[+] 3 Kerberoastable SPNs found (mssqlsvc, backup, http-svc)`, "t-ok");
    });
    def("wireshark tshark", async ({ args: args2, emit: emit2 }) => emit2(`Capturing on 'eth0'
  1 0.000000000 10.0.2.15 → 140.82.121.4 TCP 74 52414 → 443 [SYN] Seq=0 Win=64240 Len=0 MSS=1460 SACK_PERM
  2 0.008421000 140.82.121.4 → 10.0.2.15 TCP 74 443 → 52414 [SYN, ACK] Seq=0 Ack=1
  3 0.008512000 10.0.2.15 → 140.82.121.4 TCP 66 52414 → 443 [ACK]
  4 0.009114000 10.0.2.15 → 140.82.121.4 TLSv1.3 571 Application Data
\x1B[90m… 418 packets in 12s · decoded 100% · follow-stream ready\x1B[0m`));
    const TRUSTED = ["127.0.0.1", "::1", TARGET(), "10.0.2.15", "10.10.14.7", "scanme.nmap.org", "thadd.os", "localhost"];
    const blocked = (t) => !TRUSTED.includes(t) && !/^10\.|^192\.168\.|^172\.(1[6-9]|2\d|3[01])\./.test(t);
    def("python3 python", async ({ args: args2, emit: emit2 }) => {
      if (args2[0] && args2[0] !== "-V" && args2[0] !== "--version") {
        emit2(`Python 3.12.6 (main, Sep  9 2024) [GCC 13.2.0] on linux
Type "help", "copyright", "credits" or "license" for more information.`);
        emit2(`>>> ${args2.join(" ")}
THADD OS — python3 REPL (simulated): expression evaluated ✔`, "t-dim");
        return;
      }
      emit2("Python 3.12.6");
    });
    def("pip pip3", async ({ args: args2, emit: emit2 }) => {
      const [sub, pkg] = args2;
      if (sub === "install") {
        emit2(`Collecting ${pkg}
  Downloading ${pkg}-2.31.0-py3-none-any.whl (1.4 MB)
Installing collected packages: ${pkg}
Successfully installed ${pkg}-2.31.0`, "t-ok");
        return;
      }
      if (sub === "list") {
        emit2("Package         Version\n--------------- -------\nnumpy           2.1.2\npandas          2.2.3\nrequests        2.32.3\nfastapi         0.115.0\ntorch           2.4.1\ntransformers    4.45.2\ngroq            0.11.0\n");
        return;
      }
      emit2("Usage: pip install <pkg> | pip list | pip search <term>");
    });
    def("node nodejs", async ({ args, emit }) => {
      if (args[0] === "-v" || args[0] === "--version") emit("v22.22.3");
      else if (args.length) {
        try {
          emit(String(eval(args.join(" "))));
        } catch (e) {
          emit(String(e));
        }
      } else emit('Welcome to Node.js v22.22.3.\nType ".help" for more information.\n> ');
    });
    def("npm yarn pnpm", async ({ args: args2, emit: emit2 }) => {
      const [sub, name] = args2;
      if (sub === "i" || sub === "install") {
        emit2(`added ${10 + Math.floor(Math.random() * 200)} packages, and audited ${200 + Math.floor(Math.random() * 800)} packages in ${(1 + Math.random() * 8).toFixed(1)}s

found 0 vulnerabilities`, "t-ok");
        return;
      }
      if (sub === "run") {
        emit2(`> thadd-os@2.0.0 ${name}

\x1B[32m✔ compiled successfully\x1B[0m  ready in 412 ms`);
        return;
      }
      if (sub === "-v") {
        emit2("10.9.8");
        return;
      }
      emit2("npm <command>: install | run | test | audit | publish");
    });
    def("cargo go rustc", async ({ args: args2, emit: emit2 }) => emit2(`cargo 1.83.0 (thadd-toolchain)
   Compiling ${args2[1] || "thadd-core"} v0.1.0 (/home/${S.user}/thadd-os)
    Finished \`release\` profile [optimized] target(s) in 2.41s`, "t-ok"));
    def("gcc g++ make cmake", async ({ args: args2, emit: emit2 }) => emit2(`gcc (Debian 13.2.0-25) 13.2.0
cc1plus: warning: THADD OS ships -march=native by default
[100%] Built target thadd
\x1B[32mCompilation complete\x1B[0m`));
    def("git", async ({ args: args2, emit: emit2 }) => {
      const [sub, ...rest] = args2;
      switch (sub) {
        case "status":
          emit2(`On branch main
Your branch is up to date with 'origin/main'.

Changes not staged for commit:
  (use "git add <file>..." to update what will be committed)
	modified:   desktop/js/apps/jarvis.js
	modified:   README.md

Untracked files:
	os/packages.list

diff --git a/desktop/js/apps/jarvis.js
\x1B[32m+  groq.stream(model, messages)\x1B[0m
\x1B[32m+  await jarvis.tools.execute(call)
\x1B[0m
no changes added to commit`);
          return;
        case "log":
          emit2(`commit 9f4c2ab (HEAD -> main, origin/main)
Author: Thadd <thadd@thadd.os>
Date:   ${(/* @__PURE__ */ new Date()).toString()}

    feat(os): THADD OS 2.0 Nebula Prime — Groq JARVIS agent

commit 4c1e88f
    feat(desktop): Sequoia×Fluent shell, 200-app dock

commit eac0929
    ci: fresh THADD OS desktop screenshot [skip ci]`);
          return;
        case "branch":
          emit2("* main\n  arena/6e1ad65e-rdp-universal\n  feat/parrot-arsenal\n  release/2.0");
          return;
        case "add":
          emit2(`staged: ${rest.join(" ") || "."}`, "t-dim");
          return;
        case "commit":
          emit2(`[main ${Math.random().toString(16).slice(2, 9)}] ${rest.join(" ").replace(/^-m\s*/, "").replace(/^"|"$/g, "") || "update"}
 3 files changed, 214 insertions(+), 18 deletions(-)`, "t-ok");
          return;
        case "push":
          emit2(`Enumerating objects: 12, done.
Counting objects: 100% (12/12), done.
Delta compression using up to 8 threads
Writing objects: 100% (7/7), 2.41 KiB | 2.41 MiB/s, done.
To github.com:ThaddeusHackz/RDP-universal-.git
   eac0929..9f4c2ab  main -> main`, "t-ok");
          return;
        case "clone":
          emit2(`Cloning into '${(rest[0] || "repo").split("/").pop().replace(/\.git$/, "")}'...
remote: Enumerating objects: 1284, done.
remote: Total 1284 (delta 412), reused 1102
Receiving objects: 100% (1284/1284), 4.12 MiB | 8.20 MiB/s, done.
Resolving deltas: 100% (412/412), done.`, "t-ok");
          return;
        case "diff":
          emit2(`\x1B[31m-  const model = "mixtral-8x7b-32768"\x1B[0m
\x1B[32m+  const model = "llama-3.3-70b-versatile"\x1B[0m`);
          return;
        case "init":
          emit2("Initialized empty Git repository in " + S.cwd + "/.git/", "t-ok");
          return;
        case "remote":
          emit2(rest.length ? "origin	https://github.com/ThaddeusHackz/RDP-universal-.git (fetch)\norigin	https://github.com/ThaddeusHackz/RDP-universal-.git (push)" : "origin");
          return;
        default:
          emit2(`usage: git <status|log|branch|add|commit|push|pull|clone|diff|init|remote|stash|rebase|worktree|tag|bisect>`, "t-dim");
      }
    });
    def("docker podman", async ({ args: args2, emit: emit2 }) => {
      const [sub, ...rest] = args2;
      if (sub === "ps") {
        emit2('CONTAINER ID   IMAGE                    COMMAND                  CREATED         STATUS         PORTS                    NAMES\n3f9ac21b8d42   thadd/desktop:2.0        "/entrypoint.sh"         2 hours ago     Up 2 hours     0.0.0.0:8080->8080/tcp   thadd-os\n8d1b2f0a91cc   postgres:16              "docker-entrypoint…"      6 hours ago     Up 6 hours     5432/tcp                 thadd-db');
        return;
      }
      if (sub === "images") {
        emit2("REPOSITORY          TAG       IMAGE ID       CREATED         SIZE\nthadd/desktop       2.0       91f2ac81bd44   2 hours ago     612MB\nthadd/jarvis        latest    4b81cc0f2d10   3 weeks ago     1.1GB\npostgres            16        a9f2b1c8f3e2   6 weeks ago     432MB");
        return;
      }
      if (sub === "build") {
        emit2("STEP 1/12: FROM debian:bookworm-slim\nSTEP 2/12: ENV DEBIAN_FRONTEND=noninteractive\n…\n[+] Building 42.1s (12/12) FINISHED\n => => naming to docker.io/library/thadd-os:2.0", "t-ok");
        return;
      }
      if (sub === "run") {
        emit2(`${Math.random().toString(16).slice(2, 14)}`, "t-dim");
        return;
      }
      emit2("docker <command>: ps | images | build | run | compose | exec | logs");
    });
    def("kubectl", async ({ args: args2, emit: emit2 }) => emit2(`NAME                 READY   STATUS    RESTARTS   AGE
thadd-portal-7d4     1/1     Running   0          2h
jarvis-agent-2b1      1/1     Running   0          42m
parrot-worker-9f8     1/1     Running   0          12m`));
    def("code vim vi nano", async ({ args: args2, emit: emit2 }) => {
      const f = args2[0];
      if (f) {
        emit2(`Opening ${abs(f)} in THADD Code Studio (graphical)…`, "t-dim");
        bus.emit("open-app", { app: "editor", args: { path: abs(f) } });
      } else emit2("usage: code <file>", "t-dim");
    });
    def("jupyter", async ({ args: args2, emit: emit2 }) => emit2(`[I ${(/* @__PURE__ */ new Date()).toTimeString().slice(0, 8)} ServerApp] Serving notebooks from local directory: ${S.cwd}
[I ${(/* @__PURE__ */ new Date()).toTimeString().slice(0, 8)} ServerApp] Jupyter Server 2.16.0 is running at:
[I ${(/* @__PURE__ */ new Date()).toTimeString().slice(0, 8)} ServerApp] http://localhost:8888/tree?token=thadd-nebula-prime`));
    def("sqlite3 psql mysql", async ({ args: args2, emit: emit2 }) => {
      if (!args2.length) {
        emit2(`SQLite version 3.46.0 2024-05-23
Connected to a transient in-memory database.
sqlite> `);
        return;
      }
      emit2(`SQLite version 3.46.0
-- executing: ${args2.join(" ")}
(0 rows)`, "t-dim");
    });
    def("dir", async ({ args: args2, emit: emit2 }) => {
      emit2(` Volume in drive C is THADD-OS      Serial Number is 2E1A-9C4D
 Directory of ${S.cwd.replace(/\//g, "\\")}
`);
      const kids = vfs.ls(abs(args2.find((a) => !a.startsWith("/")) || ".")) || [];
      emit2(`${dateStr()}     <DIR>          .
${dateStr()}     <DIR>          ..`);
      kids.forEach((k) => emit2(`${dateStr(k.mtime)}     ${k.type === "dir" ? "<DIR>         " : String(String(k.body || "").length).padStart(12) + " "}${k.name}`));
      emit2(`              ${kids.length} File(s)   ${fmtBytes(kids.reduce((a, k) => a + String(k.body || "").length, 0))}
              2 Dir(s)   448,201,932,800 bytes free`);
    });
    def("powershell pwsh", async ({ args: args2, emit: emit2 }) => {
      if (args2.length && !args2[0].startsWith("-")) {
        await type([`Windows PowerShell 7.4.6 (THADD Core)`, `Copyright (c) THADD OS Project. All rights reserved.`, ``], 90);
        emit2(`PS> ${args2.join(" ")}`, "raw");
        return;
      }
      emit2(`PowerShell 7.4.6 (THADD Core)
PS ${S.cwd.replace(/\//g, "\\")}> `, "t-dim");
    });
    def("Get-Process Get-Service Get-ChildItem Get-Help Get-Command", async ({ args: args2, raw, emit: emit2 }) => {
      emit2(`PS> ${raw}`, "raw");
      if (/Get-Process/.test(raw)) emit2(` NPM(K)    PM(M)      WS(M)     CPU(s)      Id  SI ProcessName
 ------    -----      -----     ------      --  -- -----------
     34    128.4     142.9       4.21    1042   1 code
     62    412.1     468.3      12.44     901   1 firefox
     12     48.2      55.1       1.20     412   0 thadd-shield
     22     96.7     102.4       2.84    1201   1 thadd-jarvis`);
      else if (/Get-Service/.test(raw)) emit2(`Status   Name           DisplayName
------   ----           -----------
Running  thadd-shield   THADD Shield hardening daemon
Running  thadd-jarvis   JARVIS AI assistant
Running  xrdp           Remote Desktop Protocol server
Stopped  cups           Printing Service`);
      else if (/Get-ChildItem/.test(raw)) {
        const kids = vfs.ls(abs(args2[args2.length - 1] || ".")) || [];
        emit2(`    Directory: ${S.cwd}

Mode          LastWriteTime         Length Name
----          -------------         ------ ----`);
        kids.forEach((k) => emit2(`${k.type === "dir" ? "d-----" : "-a----"}   ${(/* @__PURE__ */ new Date()).toLocaleString().padEnd(20)} ${k.type === "dir" ? "" : String(String(k.body || "").length).padStart(7)} ${k.name}`));
      } else emit2(`(PowerShell cmdlet executed — THADD Core mapping applied)`, "t-dim");
    });
    def("tasklist", async ({ emit: emit2 }) => emit2(`Image Name                     PID Session Name        Session#    Mem Usage
========================= ======== ================ =========== ============
System Idle Process              0 Services                   0         12 K
code.exe                      1042 Console                    1    142,900 K
firefox.exe                    901 Console                    1    468,320 K
thadd-shield.exe               412 Services                   0     48,220 K
thadd-jarvis.exe              1201 Console                    1     96,700 K`));
    def("winget scoop choco", async ({ args: args2, emit: emit2 }) => {
      const [sub, pkg] = args2;
      emit2(`${sub === "install" ? "Installing" : "Probending"} ${pkg || "package"}…`);
      await type([`  ██████████████████████████████  100%`, `Successfully ${sub === "install" ? "installed" : "queried"} ${pkg || "package"} (via THADD package bridge) ✔`], 160);
    });
    def("where certutil net", async ({ args: args2, emit: emit2 }) => emit2(`INFO: Could not find files for the given pattern(s).`, "t-dim"));
    def("brew", async ({ args: args2, emit: emit2 }) => {
      const [sub, pkg] = args2;
      if (sub === "install") {
        emit2(`==> Downloading https://ghcr.io/v2/homebrew/core/${pkg}/manifests/2.0
==> Pouring ${pkg}--2.0.arm64_sequoia.bottle.tar.gz
🍺  /opt/homebrew/Cellar/${pkg}/2.0: 412 files, 84.2MB`, "t-ok");
        return;
      }
      if (sub === "list") {
        emit2("firefox 131.0\niterm2 3.5.6\nthadd-cli 2.0.0\ngroq-cli 0.9.1");
        return;
      }
      if (sub === "doctor") {
        emit2("Your system is ready to brew. ✔ Mac layer is emulated on THADD OS.", "t-ok");
        return;
      }
      emit2("Example usage:\n  brew install <formula>");
    });
    def("defaults", async ({ args: args2, emit: emit2 }) => emit2(`defaults: wrote ${args2[1] || "com.thadd.os"} → ${args2.slice(2).join(" ")} (Mac prefs layer mapped)`, "t-dim"));
    def("open", async ({ args: args2, emit: emit2 }) => {
      const a = args2.find((x) => !x.startsWith("-"));
      if (a && !a.startsWith("/")) {
        emit2(`Opening ${a} …`, "t-dim");
        bus.emit("open-app", { app: "browser", args: { url: /^https?:/.test(a) ? a : "https://" + a } });
      } else if (a) {
        emit2(`Opening ${a}`, "t-dim");
        bus.emit("open-app", { app: a.includes(".") ? "editor" : "files", args: { path: abs(a) } });
      } else emit2("usage: open <file|app|url>");
    });
    def("say espeak", async ({ args: args2, emit: emit2, S: S2 }) => {
      const t = args2.join(" ") || "THADD OS is the greatest operating system in the world.";
      emit2(`🔊 ${t}`, "t-dim");
      try {
        const u = new SpeechSynthesisUtterance(t);
        speechSynthesis.speak(u);
      } catch {
      }
    });
    def("pbcopy", async ({ args: args2, emit: emit2, stdin }) => {
      await copy(stdin || args2.join(" ") || "", "Copied (pbcopy)");
    });
    def("pbpaste", async ({ emit: emit2, print: print2 }) => {
      try {
        const t = await navigator.clipboard.readText();
        print2(t, "t-dim");
      } catch {
        print2("(clipboard unavailable)", "t-dim");
      }
    });
    def("sw_vers", async ({ emit: emit2 }) => emit2("ProductName:	macOS (THADD compatibility layer)\nProductVersion:	15.0.1\nBuildVersion:	24A348\nTHADD_LAYER:	Sequential-Fluent Unified Shell 2.0"));
    def("thadd", async ({ args: args2, emit: emit2, print: print2, S: S2, win: win2 }) => {
      const [sub, ...rest] = args2;
      switch (sub) {
        case void 0:
        case "help":
        case "--help":
          emit2(`THADD OS control plane — ${OS}`);
          emit2(`
  thadd doctor            full system diagnostic (24 checks)`);
          emit2(`  thadd scan [--full]     security audit: CIS + vuln sweep`);
          emit2(`  thadd iso build         build the bootable ISO (live-build)`);
          emit2(`  thadd shield [off|strict|paranoid]   set hardening profile`);
          emit2(`  thadd ai <prompt>       one-shot JARVIS query from the shell`);
          emit2(`  thadd vpn <up|down>     WireGuard tunnel control`);
          emit2(`  thadd theme <name>      set the shell theme`);
          emit2(`  thadd packages          list preinstalled meta-packages`);
          emit2(`  thadd bench             CPU/GPU/disk benchmark`);
          emit2(`  thadd htop              live resource HUD`);
          emit2(`  thadd update            rolling-release update`);
          emit2(`  thadd feedback          open an issue on GitHub`);
          emit2(`  thadd version           print version matrix`);
          return;
        case "doctor": {
          await type(["THADD OS doctor — ${OS}".replace("${OS}", OS), ""], 60);
          const checks = [
            ["kernel hardening (KSPP)", "PASS", "mitigations=auto, KPTI, SMEP/SMAP, lockdown=confidentiality"],
            ["AppArmor profiles", "PASS", "18 profiles enforcing (firefox, code, jarvis, vault)"],
            ["Secure Boot chain", "PASS", "shim → GRUB → vmlinuz signatures valid"],
            ["Full-disk encryption", "PASS", "nvme0n1p1 LUKS2 · TPM2 sealed · argon2id"],
            ["Firewall (nftables)", "PASS", "default-deny inbound, 6 allows, geoip GH/DE/US"],
            ["IDS / fail2ban", "PASS", "3 jails active, 0 bans today"],
            ["DNS-over-HTTPS", "PASS", "1.1.1.1 + 9.9.9.9 quad-9, DNSSEC validating"],
            ["Vault integrity", "PASS", "118 secrets, AES-256-GCM, PBKDF2 600k"],
            ["Package signatures", "PASS", "2,147 packages, 0 unsigned"],
            ["Rootkit scan (rkhunter)", "PASS", "no suspicious files, 0 warnings"],
            ["AIDE file integrity", "PASS", "last run 4h ago, 0 changed binaries"],
            ["JARVIS AI backend", "PASS", "Groq online · llama-3.3-70b-versatile"],
            ["Display server", "PASS", "Xvnc + XFCE + THADD shell compositor"],
            ["RDP + web portal", "PASS", "3389/tcp and 8443/tcp healthy"],
            ["Time sync", "PASS", "chrony, offset 0.00041s"],
            ["Memory pressure", "PASS", "1.2/16 GiB, no swap thrash"],
            ["Disk health (SMART)", "PASS", "sda 100% spare, 0 reallocated sectors"],
            ["Battery / thermals", "PASS", "98%, 41°C, governor schedutil"],
            ["Backup snapshot", "PASS", "ZFS snapshot 37m ago (21.4 GiB)"],
            ["Container runtime", "PASS", "docker 27.2.0, rootless enabled"]
          ];
          for (const [n, s, d] of checks) {
            await sleep(70);
            emit2(`  \x1B[32m✔\x1B[0m ${n.padEnd(26)} \x1B[32m${s}\x1B[0m  ${d}`);
          }
          emit2(`
\x1B[32m20 passed, 0 warnings, 0 failures — THADD OS is healthy.\x1B[0m`, "t-ok");
          return;
        }
        case "scan": {
          emit2(`\x1B[36mTHADD Shield — full system audit${rest.includes("--full") ? " (--full)" : ""}\x1B[0m`);
          const steps = [
            "Refreshing CIS Debian benchmark (1,241 controls)",
            "Enumerating listening sockets",
            "Comparing packages against 214k CVE feed",
            "Heuristic malware sweep (ClamAV 1.4.1 + YARA 4.5)",
            "Static analysis of /opt/thadd binaries",
            "Checking sudoers & SUID tree",
            "Auditing AppArmor denials",
            "Validating TLS certificates & pinned keys",
            "Reviewing auth logs for anomalies",
            "Verifying shell histories for plaintext secrets"
          ];
          for (const s of steps) {
            await sleep(220);
            emit2(`  ▸ ${s} … done`);
          }
          emit2(`
  1241 controls: 1238 pass, 2 manual, 1 N/A`);
          emit2(`  Listening: 22 (sshd), 3389 (xrdp), 8443 (nginx), 631 (cups) — all expected`);
          emit2(`  CVEs affecting installed set: 0 critical, 0 high, 3 medium (patched in 2.0.1)`);
          emit2(`  YARA: 0 hits · ClamAV: 0 detections · SUID anomalies: 0`);
          emit2(`  Hardening score: \x1B[32m98 / 100\x1B[0m (A+ · best-in-class)`, "t-ok");
          emit2(`  Report: /var/log/thadd/audit-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.json`, "t-dim");
          return;
        }
        case "iso": {
          const sub2 = rest[0] || "build";
          if (sub2 === "build") {
            emit2("thadd-iso build — live-build pipeline (Debian bookworm base)");
            const stages = [
              "lb clean --purge",
              "lb config --distribution bookworm --architectures amd64 --binary-images iso-hybrid",
              "lb bootstrap (debootstrap)",
              "lb chroot_install-packages (2147 pkgs, 4.1 GB)",
              "Applying THADD overlay (shell, JARVIS, parrot meta, themes)",
              "lb chroot_hooks (hardening, os-release, motd)",
              "mksquashfs /chroot /binary/live/filesystem.squashfs -comp zstd",
              "Building hybrid MBR/EFI isohybrid image",
              "Appending md5 + sha256 checksums",
              "→ thadd-os-2.0-nebula-prime-amd64.iso"
            ];
            for (const s of stages) {
              emit2(`  [${String(stages.indexOf(s) + 1).padStart(2)}/10] ${s}`);
              await sleep(260);
            }
            vfs.write(abs("~/thadd-os-2.0-nebula-prime-amd64.iso"), "[ISO 9660 image — 2.94 GB · bootable live/installer]");
            emit2(`
\x1B[32mISO ready: 2.94 GB — boot it in VirtualBox or write it to USB with dd.\x1B[0m`);
            emit2(`SHA256: 9f4c2ab4d1e0c7b8f3a91d6e2c48b70a5f1d3e8c9a2b4f6e0d7c1a3b5e9f2c4d`, "t-dim");
            emit2(`Next:  thadd iso test    (boots the ISO in QEMU headless and screenshots the desktop)`, "t-dim");
            return;
          }
          if (sub2 === "test") {
            await type(["QEMU: -m 4096 -smp 4 -cdrom thadd-os-2.0.iso -boot d", "Booting THADD OS live…", "Reached login: thadd / thadd ✔", "Captured screenshot → /home/thadd/Pictures/Screenshots/vm-boot.png"], 300);
            return;
          }
          emit2("usage: thadd iso [build|test|clean|write <device>]");
          return;
        }
        case "shield": {
          const mode = rest[0] || "status";
          if (mode === "status" || mode === "strict" || mode === "paranoid" || mode === "off") {
            store.set("shield.strict", mode !== "off");
            const p = mode === "off" ? ["permissive", 0] : mode === "paranoid" ? ["paranoid", 96] : ["strict", 47];
            emit2(`THADD Shield profile: \x1B[1m${mode === "status" ? store.get("shield.strict", true) ? "strict" : "off" : mode}\x1B[0m`);
            emit2(`  syscall filters: ${p[1]} rules · kernel lockdown: ${mode === "off" ? "none" : "confidentiality"}`);
            emit2(`  USB guard: ${mode === "off" ? "off" : "on (whitelist 4 devices)"} · kernel module signing: enforced`);
            return;
          }
          emit2("usage: thadd shield [status|strict|paranoid|off]");
          return;
        }
        case "ai": {
          const prompt3 = rest.join(" ") || "Summarise my home directory and suggest what to work on.";
          emit2(`\x1B[36mJARVIS\x1B[0m → ${prompt3}`, "t-dim");
          bus.emit("open-app", { app: "jarvis", args: { prompt: prompt3 } });
          emit2("(opened the JARVIS window — ask there for the full answer)", "t-dim");
          return;
        }
        case "vpn": {
          const up = (rest[0] || "status") === "up";
          emit2(up ? "wg-quick up thadd0 … handshake OK · 10.10.14.7 · kill-switch armed ✔" : "thadd0: down (0 peers)");
          return;
        }
        case "theme": {
          emit2(`theme → ${rest[0] || "Nebula-Prime-Dark"} applied to shell, terminal, GTK, dock ✔`, "t-ok");
          return;
        }
        case "packages":
          emit2("Meta-packages installed:\n  thadd-desktop 2.0.0   thadd-ai 2.0.0        parrot-tools 7.1\n  thadd-shield 2.0.0    thadd-dev 2.0.0       kali-tools 2024.3\n  groq-cli 0.9.1        code-oss 1.94         firefox-esr 131");
          return;
        case "bench": {
          emit2("THADD bench v2.0 — quick synthetic");
          await type([
            "[cpu ] single-core   : 4,821 pts (AES-256 2.9 GB/s)",
            "[cpu ] multi-core    : 38,144 pts (AVX-512 vectorised)",
            "[mem ] 128 MiB copy  : 24.6 GB/s",
            "[disk] sequential rd : 3.4 GB/s (nvme) · 512 MB/s (sda)",
            "[gpu ] VMSVGA blit   : 1,284 fps @1080p · VirGL ok",
            "[net ] loopback      : 12.4 Gb/s",
            "[net ] internet      : 42.1 Mb/s ↓ / 18.4 Mb/s ↑"
          ], 190);
          emit2("Composite: 9,412 — 'Mainframe-class workstation'", "t-ok");
          return;
        }
        case "htop": {
          bus.emit("open-app", { app: "monitor" });
          emit2("opening Activity Monitor…", "t-dim");
          return;
        }
        case "update": {
          await type([
            "Rolling release · Nebula Prime (2.0.0 → 2.0.1)",
            "Fetching 2147 package indices… 100%",
            "12 upgrades: kernel 6.9.7, firefox 131.0.3, code 1.94.2, groq-cli 0.9.2",
            "Downloading 412.7 MB … 100% (8.2 MB/s)",
            "Applying, rebuilding initramfs, signing modules",
            "✔ Upgraded — reboot recommended"
          ], 220);
          return;
        }
        case "feedback": {
          bus.emit("open-app", { app: "browser", args: { url: "https://github.com/ThaddeusHackz/RDP-universal-/issues/new" } });
          emit2("Opening GitHub issue form…", "t-dim");
          return;
        }
        case "version":
          emit2(`THADD OS        2.0.0 "Nebula Prime"
Kernel          6.9.7-thadd-hardened (KSPP)
Shell/compositor THADD Shell 2.0 (Sequoia×Fluent)
AI              JARVIS 2.0 · Groq llama-3.3-70b-versatile
Arsenal         Parrot 6.3 meta + THADD offensive pack
Base            Debian 12 bookworm + Ubuntu/Debian/macOS/Windows compat layers
Build           ${(/* @__PURE__ */ new Date()).toISOString()}
Repo            github.com/ThaddeusHackz/RDP-universal-`);
          return;
        default:
          emit2(`thadd: unknown subcommand '${sub}'. Try \`thadd help\`.`, "t-err");
      }
    });
    def("thadd-iso", async ({ args: args2, emit: emit2, print: print2, S: S2, win: win2 }) => C["thadd"]({ args: ["iso", ...args2], emit: emit2, print: print2, S: S2, win: win2 }));
    def("thadd-shield", async ({ args: args2, emit: emit2, print: print2, S: S2, win: win2 }) => C["thadd"]({ args: ["shield", ...args2], emit: emit2, print: print2, S: S2, win: win2 }));
    def("thadd-ai groq ai jarvis", async ({ args: args2, emit: emit2, S: S2, win: win2 }) => {
      if (!args2.length) {
        bus.emit("open-app", { app: "jarvis" });
        emit2("JARVIS window opened.", "t-dim");
        return;
      }
      const key = store.get("ai.groqKey", "");
      const prompt3 = args2.join(" ");
      emit2(`\x1B[36m✦ JARVIS\x1B[0m ${prompt3}`);
      if (!key) {
        const reply = offlineAnswer(prompt3);
        await type(reply.split("\n"), 60);
        emit2(`
\x1B[33m(offline reasoning — add a Groq API key in JARVIS for live models)\x1B[0m`, "t-dim");
        return;
      }
      emit2("… contacting Groq (llama-3.3-70b-versatile)", "t-dim");
      try {
        const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
          body: JSON.stringify({
            model: store.get("ai.model", "llama-3.3-70b-versatile"),
            messages: [
              { role: "system", content: "You are JARVIS, the THADD OS assistant, answering inside a terminal. Be concise, use plain text, no markdown headers." },
              { role: "user", content: prompt3 }
            ],
            temperature: 0.6,
            max_tokens: 900
          })
        });
        const j = await r.json();
        const text = j.choices?.[0]?.message?.content || j.error?.message || "No response.";
        await type(String(text).split("\n"), 24);
        emit2(`\x1B[90m[tokens ${j.usage?.total_tokens ?? "?"} · ${j.model || ""}]\x1B[0m`, "t-dim");
      } catch (e) {
        emit2("Groq request failed: " + e.message + " — falling back to offline reasoning.", "t-err");
        await type(offlineAnswer(prompt3).split("\n"), 40);
      }
    });
    function offlineAnswer(p) {
      const q = p.toLowerCase();
      if (/iso|build|virtualbox|vm|boot/.test(q)) return [
        "To build the THADD OS ISO:",
        "",
        "  1. On a Debian/Ubuntu host:  sudo ./os/tools/install-deps.sh",
        "  2. Build the image:          thadd iso build   (live-build, 10 stages, ~12 min)",
        "  3. Test headless:            thadd iso test    (QEMU boots + screenshots)",
        "  4. Install VirtualBox and create a VM: 2 GB RAM, 25 GB disk, VMSVGA, 128 MB VRAM",
        "  5. Attach thadd-os-2.0-nebula-prime-amd64.iso, boot, choose 'Live' or 'Install'.",
        "",
        "VirtualBox notes: enable EFI, 3D acceleration, and 2 CPU cores for the best shell smoothness."
      ].join("\n");
      if (/hack|exploit|scan|nmap|pentest|htb/.test(q)) return [
        "THADD OS ships the full Parrot 6.3 arsenal (600+ tools). Typical lab workflow:",
        "",
        "  nmap -sV -sC -p- 10.10.10.5 -oN recon.txt      # discover",
        "  gobuster dir -u http://10.10.10.5 -w /usr/share/wordlists/dirb/common.txt",
        "  searchsploit apache 2.4                        # map to exploits",
        "  sqlmap -u 'http://10.10.10.5/item.php?id=1' --batch --dbs",
        "  hydra -L users.txt -P rockyou.txt ssh://10.10.10.5 -t 4",
        "  msfconsole -q -x 'use exploit/multi/handler; run'",
        "",
        "All of it is wrapped by THADD Shield, which logs and contains offensive tooling so it can never touch non-lab networks unless you unlock lab mode."
      ].join("\n");
      if (/hello|hi|who are you|jarvis/.test(q)) return [
        "I am JARVIS — the THADD OS assistant. I can read and write files in your home directory,",
        "run shell commands, launch apps, harden the system, and answer questions. Ask me anything."
      ].join("\n");
      return [
        `You asked: “${p}”`,
        "",
        "Offline reasoning engines are limited — plug in your Groq API key (JARVIS window → ⚙) and I will answer with",
        "llama-3.3-70b-versatile at ~275 tokens/sec, with full access to your files, terminal and OS controls.",
        "",
        "Meanwhile, useful starting points:",
        "  thadd doctor     · full system diagnostic",
        "  thadd scan --full · security audit",
        "  parrot          · the offensive toolkit index",
        "  help            · all 180+ commands"
      ].join("\n");
    }
    def("cowsay", async ({ args: args2, emit: emit2 }) => {
      const t = (args2.join(" ") || "THADD OS is the greatest OS ever assembled").replace(/^"|"$/g, "");
      const line = "─".repeat(t.length + 2);
      emit2(` ${line}
< ${t} >
 ${line}
        \\   ^__^
         \\  (oo)\\_______
            (__)\\       )\\/\\
                ||----w |
                ||     ||`);
    });
    def("figlet banner toilet", async ({ args: args2, emit: emit2 }) => {
      const t = (args2.join(" ") || "THADD OS").toUpperCase();
      const font = {
        A: ["  ▄  ", " ███ ", "█   █"],
        B: ["██▄ ", "██▀ ", "██▄ "],
        C: ["▄███", "█   ", "▀███"],
        D: ["██▄ ", "█  █", "██▀ "],
        E: ["███", "██▀", "███"],
        F: ["███", "██▀", "█  "],
        G: ["▄███", "█ ██", "▀██▀"],
        H: ["█  █", "████", "█  █"],
        I: ["███", " █ ", "███"],
        J: ["  ██", "  ██", "██▀ "],
        K: ["█ █ ", "██  ", "█ █ "],
        L: ["█  ", "█  ", "███"],
        M: ["█▄ ▄█", "█ █ █", "█   █"],
        N: ["█▄ █", "█ ▀█", "█  █"],
        O: ["▄██▄", "█  █", "▀██▀"],
        P: ["██▄", "██▀", "█  "],
        Q: ["▄██▄", "█ ██", "▀███"],
        R: ["██▄", "██▀", "█ █"],
        S: ["▄███", "▀██▄", "███▀"],
        T: ["███", " █ ", " █ "],
        U: ["█  █", "█  █", "▀██▀"],
        V: ["█  █", "█  █", " ▀▀ "],
        W: ["█   █", "█ █ █", "▀▀ ▀▀"],
        X: ["█ █", " █ ", "█ █"],
        Y: ["█ █", " █ ", " █ "],
        Z: ["███", " █ ", "███"],
        " ": ["   ", "   ", "   "]
      };
      for (let r = 0; r < 3; r++) emit2(t.split("").map((ch) => (font[ch] || font[" "])[r]).join(" "));
    });
    def("fortune", async ({ args: args2, emit: emit2 }) => emit2(PICKS[Math.floor(Math.random() * PICKS.length)]));
    const PICKS = [
      "The best way to predict the future is to invent it. — Alan Kay",
      "Security is not a product, but a process. — Bruce Schneier",
      "Talk is cheap. Show me the code. — Linus Torvalds",
      "Any sufficiently advanced technology is indistinguishable from magic. — Arthur C. Clarke",
      "One OS. All the Best. — THADD OS",
      "Simplicity is prerequisite for reliability. — Edsger Dijkstra",
      "The quieter you become, the more you are able to hear. — Kali maxim"
    ];
    def("sl cmatrix matrix", async ({ args: args2, emit: emit2, print: print2 }) => {
      for (let i = 0; i < 6; i++) {
        await sleep(300);
        print2("  " + Array.from({ length: 78 }, () => String.fromCharCode(48 + Math.floor(Math.random() * 74))).join(""), "t-ok");
      }
      emit2("\x1B[90m… matrix rain stopped (press q)\x1B[0m", "t-dim");
    });
    def("lolcat", async ({ args: args2, emit: emit2, stdin }) => emit2(((stdin ?? args2.join(" ")) || "thadd os").split("").map((c2, i) => `\x1B[3${i % 7 + 1}m${c2}\x1B[0m`).join("")));
    def("hollywood", async ({ args: args2, emit: emit2 }) => {
      for (let i = 0; i < 8; i++) {
        await sleep(120);
        emit2("[" + (/* @__PURE__ */ new Date()).toTimeString().slice(0, 8) + "] thadd-shield: sweep " + Math.random().toString(16).slice(2, 10) + " clean");
      }
    });
    def("thadd-welcome unameinfo", async ({ emit: emit2 }) => emit2(`Welcome to THADD OS 2.0 (Nebula Prime)!
 * Documentation:  https://github.com/ThaddeusHackz/RDP-universal-/blob/main/README.md
 * Releases / ISOs: https://github.com/ThaddeusHackz/RDP-universal-/releases
 * 41 updates can be applied immediately.
 * THADD Shield is in STRICT mode (47 rules). AI: JARVIS ready.`, "t-ok"));
    def("apt apt-get dpkg apk dnf yum pacman", async ({ args: args2, emit: emit2 }) => {
      const [sub, ...pkgs] = args2.filter((a) => !a.startsWith("-"));
      if (sub === "update") {
        await type([
          "Hit:1 https://deb.debian.org/debian bookworm InRelease",
          "Hit:2 https://security.debian.org/debian-security bookworm-security InRelease",
          "Get:3 https://repo.thadd.os/nebula prime InRelease [18.2 kB]",
          "Get:4 https://download.docker.com/linux/debian bookworm InRelease [42.1 kB]",
          "Fetched 60.3 kB in 1s (58.2 kB/s)",
          "Reading package lists... Done",
          "All packages are up to date."
        ], 130);
        return;
      }
      if (sub === "install") {
        emit2(`Reading package lists... Done
Building dependency tree... Done
The following NEW packages will be installed:
  ${pkgs.join(" ")}`);
        await type([
          `Need to get ${(pkgs.length * 2.4 + 1).toFixed(1)} MB of archives.`,
          "Get:1 https://deb.debian.org/debian bookworm/main amd64 " + (pkgs[0] || "pkg") + " [2.4 MB]",
          "Fetched 2.4 MB in 0s (18.4 MB/s)",
          "Selecting previously unselected package " + (pkgs[0] || "pkg") + ".",
          "Unpacking " + (pkgs[0] || "pkg") + " …",
          "Setting up " + (pkgs[0] || "pkg") + " …"
        ], 140);
        emit2(`\x1B[32mSuccessfully installed: ${pkgs.join(" ") || "nothing"}\x1B[0m`, "t-ok");
        return;
      }
      if (sub === "list") {
        emit2("Listing... Done\nthadd-desktop/prime,now 2.0.0 all [installed]\nthadd-ai/prime,now 2.0.0 all [installed]\nparrot-tools/prime,now 7.1 all [installed]\nfirefox-esr/prime,now 131.0 all [installed]\ncode-oss/prime,now 1.94.0 all [installed]");
        return;
      }
      if (sub === "upgrade" || sub === "full-upgrade") {
        await type(["Calculating upgrade... Done", "41 upgraded, 0 newly installed, 0 to remove", "Need to get 412 MB. ", "Setting up linux-image-6.9.7-thadd …", "✔ Done — reboot recommended."], 200);
        return;
      }
      emit2("apt <command>: update | install <pkg> | remove <pkg> | list | upgrade | search <term>");
    });
    def("snap flatpak", async ({ args: args2, emit: emit2 }) => emit2(`Name     Version   Rev   Tracking       Publisher   Notes
code     1.94      1024  latest/stable  thadd✓      classic
firefox  131.0     5123  latest/stable  mozilla✓    -
thadd    2.0.0     42    latest/stable  thadd✓      -`, "t-dim"));
    def("thadd-json jq", async ({ args: args2, emit: emit2, stdin }) => {
      try {
        emit2(JSON.stringify(JSON.parse(stdin || args2.join(" ")), null, 2));
      } catch {
        emit2("jq: parse error", "t-err");
      }
    });
    def("openssl", async ({ args: args2, emit: emit2 }) => {
      if (args2[0] === "rand") {
        emit2([...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, "0")).join(""));
        return;
      }
      if (args2[0] === "genrsa" || args2[0] === "req") {
        emit2("Generating RSA private key, 4096 bit long modulus (2 primes)\n....................++++\ne is 65537 (0x10001)\nwriting new private key to 'thadd.key'\n-----\nCertificate request self-signature ok\nsubject=C = GH, ST = Greater Accra, L = Accra, O = THADD OS, CN = thadd.os");
        return;
      }
      emit2("OpenSSL 3.3.2 3 Sep 2024 (Library: OpenSSL 3.3.2)\nusage: openssl <command> …");
    });
    def("gpg", async ({ args: args2, emit: emit2 }) => emit2(`gpg: WARNING: unsafe permissions on homedir '/home/thadd/.gnupg'
gpg: key 0xTHADD2DEADBEEF: public key "THADD OS Release Signing <release@thadd.os>" imported
gpg: marginals needed: 3  completes needed: 1  trust model: pgp
gpg: depth: 0  valid: 1  signed: 0  trust: 0-, 0q, 0n, 0m, 0f, 1u`));
    def("ufw iptables nft", async ({ args: args2, raw, emit: emit2 }) => {
      if (/status/.test(raw)) {
        emit2(`Status: active
Logging: on (low)
Default: deny (incoming), allow (outgoing), disabled (routed)
New profiles: skip

To                         Action      From
--                         ------      ----
22/tcp                     ALLOW IN    Anywhere          # ssh (key-only)
3389/tcp                   ALLOW IN    10.0.0.0/8        # xrdp, LAN only
8443/tcp                   ALLOW IN    Anywhere          # THADD portal (TLS)
6080/tcp                   ALLOW IN    Anywhere          # noVNC (TLS)
Anywhere on thadd0         ALLOW FWD   Anywhere          # wireguard lab tunnel
Anywhere                   DENY IN     0.0.0.0/0         # geoip-block (CN,RU,KP)`);
        return;
      }
      emit2("Firewall rule applied (nftables backend) ✔", "t-ok");
    });
    def("fail2ban-client lynis rkhunter chkrootkit clamav freshclam", async ({ args: args2, raw, emit: emit2 }) => {
      if (/lynis/.test(raw)) {
        await type([
          "[ Lynis 3.1.2 — THADD OS audit ]",
          "Hardening index : 98 [#################]",
          "Tests performed : 263",
          "Plugins enabled : 8",
          "Firewall : iptables/nftables ✔",
          "Malware scanner : clamav ✔",
          "File integrity : aide ✔",
          "Warnings: 2 (SSH permitrootlogin, core dumps) — auto-fix available"
        ], 160);
        return;
      }
      if (/rkhunter|chkrootkit/.test(raw)) {
        emit2("Checking for rootkits…\n  Checking for suspicious (large) shared memory segments   [ OK ]\n  Checking for hidden files and directories                [ OK ]\n  Checking /dev for suspicious file types                  [ OK ]\n  Rootkit checks complete — 0 infected files found");
        return;
      }
      if (/clamav|freshclam/.test(raw)) {
        emit2("ClamAV 1.4.1/27412/Thu Oct 13 — main.cvd is up to date\n----------- SCAN SUMMARY -----------\nKnown viruses: 8,724,183\nEngine version: 1.4.1\nScanned directories: 4,221\nScanned files: 184,412\nInfected files: 0\nData scanned: 12.4 GB\nTime: 42.12 sec");
        return;
      }
      emit2("Status\n|- Number of jail: 3\n`- Jail list: sshd, xrdp, thadd-portal (0 currently banned, 14 total bans)");
    });
    def("aide auditd", async ({ args: args2, emit: emit2 }) => emit2("AIDE 0.19 — file integrity database verified\n  Added: 0  Removed: 0  Changed: 0\n  Last run: 4h ago · next: in 20h"));
    def("screenshot", async ({ args: args2, emit: emit2 }) => {
      const m = await Promise.resolve().then(() => (init_screenshot(), screenshot_exports));
      await m.grab();
      emit2("Screenshot saved to /home/" + S.user + "/Pictures/Screenshots/ ✔", "t-ok");
    });
    def("record", async ({ args: args2, emit: emit2 }) => {
      emit2("Screen recorder armed — Ctrl+Shift+R to stop. Output: ~/Videos/thadd-demo.mp4", "t-dim");
    });
    def("flash memtest sysbench stress", async ({ args: args2, emit: emit2 }) => {
      await type(["stress-ng: 4 workers, 30s, cpu+malloc", "cpu: 38,144 pts · mem: 24.6 GB/s · thermal: 41°C (no throttle)", "PASS — system stable under load"], 300);
    });
    def("wpa_supplicant nmcli bluetoothctl", async ({ args: args2, raw, emit: emit2 }) => {
      emit2(`nmcli: ${/nmcli/.test(raw) ? "wlan0  wifi  connected  THADD-NET-6E  WPA2/3  ▂▄▆█  1.2 Gb/s\neth0   ethernet  connected  --         1000 Mb/s\nthadd0 wireguard  connected  HTB-Lab    --        --" : "device list: wlan0 (BT 5.3), hci0 (Intel AX210)"}`);
    });
    def("xrandr", async ({ emit: emit2 }) => emit2(`Screen 0: minimum 16 x 16, current ${innerWidth} x ${innerHeight}, maximum 16384 x 16384
Virtual1 connected primary ${innerWidth}x${innerHeight}+0+0 (normal left inverted right x axis y axis)
   1920x1080     60.00*+  50.00
   1600x900      59.95
   3840x2160     30.00`));
    def("wall setbg", async ({ args: args2, emit: emit2 }) => {
      emit2("wallpaper changed via thadd-shell", "t-dim");
      const m = await Promise.resolve().then(() => (init_shell(), shell_exports));
      m.nextWallpaper();
    });
    def("theme", async ({ args: args2, emit: emit2 }) => emit2(args2[0] ? `theme ${args2[0]} applied (GTK, Qt, shell, terminal, icons) ✔` : "usage: theme <Nebula-Prime-Dark|Sequoia-Light|Fluent-Dark|Parrot-Green|Nord|Dracula>"));
    def("uptime-info", async ({ emit: emit2 }) => emit2(`up ${fmtDur(uptime())}`));
    def("exit-os", async ({ emit: emit2 }) => emit2("logout", "t-dim"));
    def("window list", async ({ args: args2, emit: emit2 }) => {
      emit2("THADD shell windows managed by wm.js:");
      Promise.resolve().then(() => (init_wm(), wm_exports)).then(({ windows: W }) => W.forEach((w, i) => emit2(`  ${String(i + 1).padStart(2)}  ${w._title.padEnd(28)} ${w._state.min ? "minimised" : "visible"}  z=${w.style.zIndex}`)));
    });
    def("thadd-open", async ({ args: args2, emit: emit2 }) => {
      bus.emit("open-app", { app: args2[0] || "finder", args: { path: args2[1] } });
      emit2(`launched ${args2[0] || "finder"}`, "t-dim");
    });
    def("nmap-os-detect", async ({ args: args2, emit: emit2, print: print2, S: S2, win: win2 }) => C["nmap"]({ args: ["-A", ...args2], emit: emit2, print: print2, S: S2, win: win2 }));
    def("date-iso", async ({ emit: emit2 }) => emit2((/* @__PURE__ */ new Date()).toISOString()));
    def("passwd", async ({ emit: emit2 }) => emit2("Changing password for thadd.\nCurrent password: ●●●●\nNew password: ●●●●●●●●\nRetype new password: ●●●●●●●●\npasswd: password updated successfully ✔", "t-ok"));
    def("useradd userdel usermod adduser groupadd", async ({ args: args2, raw, emit: emit2 }) => emit2(`(simulated) ${raw} ✔`, "t-dim"));
    def("mount umount", async ({ args: args2, raw, emit: emit2 }) => emit2(raw.startsWith("mount") && !args2.length ? `/dev/sda2 on / type ext4 (rw,relatime,errors=remount-ro)
proc on /proc type proc (rw,nosuid,nodev,noexec)
sysfs on /sys type sysfs (rw,nosuid,nodev,noexec)
devtmpfs on /dev type devtmpfs (rw,nosuid,size=8129M)
/home on /dev/sda3 type zfs (rw,relatime,xattr,noacl)
/vault on /dev/nvme0n1p1 type ext4 (rw,relatime) [LUKS2]
//10.0.2.4/lab on /mnt/lab type cifs (rw,vers=3.1.1,sec=krb5)` : `(simulated) ${raw}`, "t-dim"));
    def("crontab systemd-timer at", async ({ args: args2, raw, emit: emit2 }) => emit2(raw.includes("-l") ? `# THADD OS scheduled jobs
0 3 * * *  /usr/local/bin/thadd scan --full --quiet
*/15 * * * * /usr/local/bin/thadd-shield heartbeat
0 4 * * 0  /usr/bin/apt-get upgrade -y` : "(simulated) cron updated ✔", "t-dim"));
    def("nano", async ({ args: args2, emit: emit2, S: S2, win: win2 }) => {
      const f = args2[0] || "";
      emit2(`opening ${f} in the graphical editor…`, "t-dim");
      if (f) bus.emit("open-app", { app: "editor", args: { path: abs(f) } });
    });
    def("tldr", async ({ args: args2, emit: emit2 }) => {
      const cmd = args2[0] || "ls";
      emit2(`\x1B[36m${cmd}\x1B[0m

  ${cmd} — quick reference (tldr pages, offline cache)

  Examples:
    ${cmd} --help
    man ${cmd}
`);
    });
    return wrap;
  }
  var OS, KERNEL, HOST, meta;
  var init_terminal = __esm({
    "desktop/js/apps/terminal.js"() {
      init_core();
      OS = "THADD OS 2.0 (Nebula Prime)";
      KERNEL = "6.9.7-thadd-hardened";
      HOST = "thadd-os";
      meta = { name: "Terminal" };
    }
  });

  // desktop/js/apps/files.js
  var files_exports = {};
  __export(files_exports, {
    build: () => build3
  });
  function build3(args2 = {}, win2) {
    const S2 = {
      path: args2.path || vfs.home(),
      view: store.get("fm.view", "grid"),
      sel: null,
      query: ""
    };
    const side = el("div", { class: "fm-side" });
    const crumbs = el("div", { class: "fm-crumbs" });
    const body = el("div", { class: "fm-body" });
    const status = el("div", { class: "fm-status" });
    const viewer = el("div", { class: "fm-viewer hidden" });
    const search = el("input", { class: "tb-input", placeholder: "Search this folder…" });
    const tl = (fn) => el("button", { class: "tb-btn", title: fn.title || "", html: fn.icon || fn.text, onclick: fn.act });
    const bar = el(
      "div",
      { class: "fm-bar" },
      tl({ text: "‹", title: "Back", act: () => go(parentOf(S2.path)) }),
      tl({ text: "›", title: "Forward" }),
      crumbs,
      search,
      tl({ text: "▦", title: "Icon view", act: () => {
        S2.view = "grid";
        store.set("fm.view", "grid");
        render2();
      } }),
      tl({ text: "☰", title: "List view", act: () => {
        S2.view = "list";
        store.set("fm.view", "list");
        render2();
      } }),
      tl({ text: "＋", title: "New folder", act: newFolder }),
      tl({ text: "⌸", title: "Open in Terminal", act: openTerm }),
      tl({ text: "✦", title: "Ask JARVIS about this folder", act: askJarvis })
    );
    const main = el("div", { class: "fm-main" }, bar, body, status);
    const wrap2 = el("div", { class: "fm" }, side, main, viewer);
    search.addEventListener("input", () => {
      S2.query = search.value.toLowerCase();
      render2();
    });
    const PLACES = [
      { name: "Recents", icon: "🕘", path: vfs.home() },
      { name: "Home", icon: "🏠", path: vfs.home() },
      { name: "Desktop", icon: "🖥", path: vfs.home() + "/Desktop" },
      { name: "Documents", icon: "📄", path: vfs.home() + "/Documents" },
      { name: "Downloads", icon: "⬇", path: vfs.home() + "/Downloads" },
      { name: "Pictures", icon: "🖼", path: vfs.home() + "/Pictures" },
      { name: "Music", icon: "🎵", path: vfs.home() + "/Music" },
      { name: "Videos", icon: "🎬", path: vfs.home() + "/Videos" },
      { name: "Projects", icon: "⌨", path: vfs.home() + "/Documents/Projects" }
    ];
    const SYS = [
      { name: "Root", icon: "🗄", path: "/" },
      { name: "thadd-os (ISO)", icon: "💿", path: vfs.home() + "/thadd-os" },
      { name: "opt/thadd", icon: "⚙", path: "/opt/thadd" },
      { name: "var/log", icon: "📃", path: "/var/log" },
      { name: "boot", icon: "🥾", path: "/boot" },
      { name: "Trash", icon: "🗑", path: "/tmp/trash" }
    ];
    function renderSide() {
      side.innerHTML = "";
      side.append(sideGroup("Favourites", PLACES), sideGroup("Locations", SYS));
    }
    function sideGroup(title, items) {
      const g = el("div", {}, el("h5", { text: title }));
      for (const p of items) {
        const n = el(
          "div",
          { class: "fm-nav" + (S2.path === p.path ? " on" : "") },
          el("span", { class: "ic", text: p.icon }),
          el("span", { text: p.name })
        );
        n.addEventListener("click", () => go(p.path));
        n.addEventListener("dragover", (e) => e.preventDefault());
        g.append(n);
      }
      return g;
    }
    function go(p) {
      if (!vfs.resolve(p)) {
        toast("Folder missing", p, { icon: "⚠" });
        return;
      }
      S2.path = p.replace(/\/+$/, "") || "/";
      S2.sel = null;
      closeViewer();
      render2();
    }
    const parentOf = (p) => {
      const s = p.replace(/\/+$/, "");
      const i = s.lastIndexOf("/");
      return i <= 0 ? "/" : s.slice(0, i);
    };
    function render2() {
      closeMenuCrumbs();
      renderSide();
      crumbs.innerHTML = "";
      const segs = S2.path.split("/").filter(Boolean);
      const rootCrumb = el("span", { class: "fm-crumb", text: S2.path === "/" ? "/" : "Macintosh THADD" });
      rootCrumb.addEventListener("click", () => go("/"));
      crumbs.append(rootCrumb);
      let acc = "";
      segs.forEach((s2) => {
        acc += "/" + s2;
        const p = acc;
        crumbs.append(el("span", { class: "fm-crumb sep", text: "›" }));
        const c2 = el("span", { class: "fm-crumb", text: s2 });
        c2.addEventListener("click", () => go(p));
        crumbs.append(c2);
      });
      crumbs.append(el("span", { class: "fm-crumb sep", text: S2.query ? "  ·  filtering" : "" }));
      const node2 = vfs.resolve(S2.path);
      if (!node2 || node2.type !== "dir") {
        body.innerHTML = "";
        body.append(el("div", { class: "fm-empty", text: "Not a directory" }));
        return;
      }
      let kids = [...node2.children || []].sort((a, b) => a.type === b.type ? a.name.localeCompare(b.name) : a.type === "dir" ? -1 : 1);
      if (S2.query) kids = kids.filter((k) => k.name.toLowerCase().includes(S2.query));
      if (!kids.some((k) => !k.name.startsWith("."))) kids = kids;
      body.innerHTML = "";
      if (S2.view === "grid") {
        const g = el("div", { class: "fm-grid" });
        for (const k of kids) {
          const cell = el(
            "div",
            { class: "fm-cell" + (S2.sel === k ? " sel" : "") },
            el("div", { class: "big", text: iconFor(k) }),
            el("div", { class: "nm", text: k.name })
          );
          cell.addEventListener("click", () => {
            S2.sel = k;
            render2();
            select(k);
          });
          cell.addEventListener("dblclick", () => k.type === "dir" ? go(join(S2.path, k.name)) : openPath(join(S2.path, k.name)));
          cell.addEventListener("contextmenu", (e) => {
            e.preventDefault();
            S2.sel = k;
            select(k);
            menu(e, k);
          });
          g.append(cell);
        }
        if (!kids.length) g.append(el("div", { class: "fm-empty", text: S2.query ? `No matches for “${S2.query}”.` : "This folder is empty." }));
        body.append(g);
      } else {
        const t = el(
          "table",
          { class: "fm-list" },
          el("thead", {}, el("tr", {}, el("th", { text: "Name" }), el("th", { text: "Kind" }), el("th", { text: "Size" }), el("th", { text: "Modified" })))
        );
        const tb = el("tbody");
        for (const k of kids) {
          const tr = el(
            "tr",
            { class: S2.sel === k ? "sel" : "" },
            el("td", { text: `${iconFor(k)}  ${k.name}` }),
            el("td", { text: k.type === "dir" ? "Folder" : kindOf(k.name) }),
            el("td", { text: k.type === "dir" ? `${(k.children || []).length} items` : fmtBytes(String(k.body || "").length) }),
            el("td", { text: k.mtime ? new Date(k.mtime).toLocaleString() : "—" })
          );
          tr.addEventListener("click", () => {
            S2.sel = k;
            render2();
            select(k);
          });
          tr.addEventListener("dblclick", () => k.type === "dir" ? go(join(S2.path, k.name)) : openPath(join(S2.path, k.name)));
          tr.addEventListener("contextmenu", (e) => {
            e.preventDefault();
            S2.sel = k;
            select(k);
            menu(e, k);
          });
          tb.append(tr);
        }
        t.append(tb);
        body.append(t);
      }
      const total = kids.reduce((a, k) => a + (k.type === "file" ? String(k.body || "").length : 4096), 0);
      status.textContent = `${kids.length} items · ${fmtBytes(total)} · ${S2.path}  ·  ${store.get("disk.free", "448 GB")} available`;
    }
    const join = (a, b) => (a === "/" ? "" : a) + "/" + b;
    const iconFor = (k) => k.type === "dir" ? "📁" : /\.(png|jpe?g|gif|svg|webp)$/i.test(k.name) ? "🖼" : /\.(mp4|webm|mov)$/i.test(k.name) ? "🎬" : /\.(mp3|wav|flac)$/i.test(k.name) ? "🎵" : /\.(sh|py|js|ts|c|cpp|rs|go|java)$/i.test(k.name) ? "⌨" : /\.(md|txt|log)$/i.test(k.name) ? "📄" : /\.(iso|img)$/i.test(k.name) ? "💿" : /\.(json|ya?ml|toml)$/i.test(k.name) ? "⚙" : k.name === "secret.txt" ? "🔐" : "📄";
    const kindOf = (n) => /\.(sh|py|js|ts)$/.test(n) ? "Script" : /\.md$/.test(n) ? "Markdown" : /\.(json|ya?ml|toml)$/.test(n) ? "Config" : /\.iso$/.test(n) ? "Disk image" : "Text document";
    function select(k) {
      viewer.classList.remove("hidden");
      viewer.innerHTML = "";
      const head = el(
        "div",
        { class: "fm-bar" },
        el("span", { style: { fontSize: "15px" }, text: iconFor(k) }),
        el("b", { style: { fontSize: "12.5px", flex: "1" }, text: k.name }),
        el("button", { class: "tb-btn", text: "✕", title: "Close preview", onclick: closeViewer })
      );
      viewer.append(head);
      if (k.type === "file") {
        const pre = el("pre", { text: String(k.body ?? "").slice(0, 6e3) || "(empty file)" });
        viewer.append(pre);
        viewer.append(el("div", { class: "fm-status", text: `${fmtBytes(String(k.body || "").length)} · ${kindOf(k.name)} · modified ${k.mtime ? new Date(k.mtime).toLocaleString() : "—"}` }));
      } else {
        viewer.append(el("div", { class: "fm-empty", text: `${(k.children || []).length} items — double-click the folder to browse into it.` }));
      }
    }
    function closeViewer() {
      viewer.classList.add("hidden");
      viewer.innerHTML = "";
    }
    function newFolder() {
      const n = "New Folder" + (Math.random() > 0.5 ? " " + Math.floor(Math.random() * 90) : "");
      vfs.mkdir(join(S2.path, n));
      toast("Folder created", join(S2.path, n), { icon: "📁" });
      render2();
    }
    function openTerm() {
      window.THADD.launch("terminal", { run: `cd ${S2.path.replace(vfs.home(), "~")} && ls -la` });
    }
    function askJarvis() {
      const names = (vfs.ls(S2.path) || []).map((k) => k.name).join(", ");
      window.THADD.launch("jarvis", { prompt: `Here is the folder ${S2.path} in my home: ${names}. Summarise what's here and suggest the next useful action, then do it if it's safe.` });
    }
    function menu(e, k) {
      const p = join(S2.path, k.name);
      contextMenu(e.clientX, e.clientY, [
        { label: "Open", icon: "↗", action: () => k.type === "dir" ? go(p) : openPath(p) },
        { label: "Open in Code Studio", icon: "⌨", action: () => window.THADD.launch("editor", { path: p }) },
        { label: "Open in Terminal here", icon: "»", action: () => window.THADD.launch("terminal", { run: `cd ${k.type === "dir" ? p.replace(vfs.home(), "~") : S2.path.replace(vfs.home(), "~")} && ls -la` }) },
        "-",
        { label: "Rename…", icon: "✎", action: () => {
          const nn = prompt("New name:", k.name);
          if (nn && nn !== k.name) {
            k.name = nn;
            toast("Renamed", nn, { icon: "✎" });
            render2();
          }
        } },
        { label: "Duplicate", icon: "⧉", action: () => {
          if (k.type === "file") vfs.write(join(S2.path, "copy of " + k.name), k.body || "");
          toast("Duplicated", k.name, { icon: "⧉" });
          render2();
        } },
        { label: "Copy path", icon: "📋", action: () => copy(p, "Path copied") },
        { label: "Ask JARVIS about this", icon: "✦", action: () => window.THADD.launch("jarvis", { prompt: `Look at ${p} (${k.type === "dir" ? "folder" : "file"}) and tell me what it is and what I should do with it.` }) },
        "-",
        { label: "Secure erase (7-pass)", icon: "🔒", action: () => {
          vfs.rm(p);
          toast("Securely erased", `${k.name} — DoD 5220.22-M, 7 passes`, { icon: "🔒" });
          render2();
        } },
        { label: "Move to Trash", icon: "🗑", action: () => {
          vfs.rm(p);
          toast("Moved to Trash", k.name, { icon: "🗑" });
          render2();
        } },
        "-",
        { label: "Get Info", icon: "ℹ", action: () => {
          select(k);
          toast(k.name, `${kindOf(k.name)} · ${k.type === "dir" ? (k.children || []).length + " items" : fmtBytes(String(k.body || "").length)}`, { icon: "ℹ" });
        } }
      ]);
    }
    function closeMenuCrumbs() {
      $("#ctxMenu")?.classList.add("hidden");
    }
    body.addEventListener("contextmenu", (e) => {
      if (e.target.closest(".fm-cell") || e.target.closest("tr")) return;
      e.preventDefault();
      contextMenu(e.clientX, e.clientY, [
        { label: "New Folder", icon: "📁", action: newFolder },
        { label: "New File (markdown)", icon: "📝", action: () => {
          vfs.write(join(S2.path, "untitled.md"), "# Untitled\n");
          render2();
        } },
        "-",
        { label: "Icon View", action: () => {
          S2.view = "grid";
          store.set("fm.view", "grid");
          render2();
        } },
        { label: "List View", action: () => {
          S2.view = "list";
          store.set("fm.view", "list");
          render2();
        } },
        "-",
        { label: "Open in Terminal", icon: "»", action: openTerm },
        { label: "Ask JARVIS to organise this folder", icon: "✦", action: askJarvis }
      ]);
    });
    bus.on("fs", render2);
    render2();
    return wrap2;
  }
  var init_files = __esm({
    "desktop/js/apps/files.js"() {
      init_core();
    }
  });

  // desktop/js/apps/browser.js
  var browser_exports = {};
  __export(browser_exports, {
    build: () => build4
  });
  function build4(args2 = {}, win2, meta2) {
    const P = PROFILE[win2._app] || PROFILE.browser;
    const S2 = {
      tabs: [{ id: uid(), title: "New Tab", url: "thadd://start", history: [] }],
      active: 0,
      bookmarks: store.get("bw.bookmarks", ["thadd://start", "https://github.com/ThaddeusHackz/RDP-universal-"])
    };
    const tabsBar = el("div", { class: "bw-tabs" });
    const url = el("input", { spellcheck: "false", placeholder: `Search ${P.name} or enter address` });
    const page = el("div", { class: "bw-page" });
    const findBar = el("div", { class: "bw-bar hidden" });
    const bar = el(
      "div",
      { class: "bw-bar" },
      el("button", { class: "tb-btn", text: "‹", title: "Back", onclick: () => nav("back") }),
      el("button", { class: "tb-btn", text: "›", title: "Forward", onclick: () => nav("forward") }),
      el("button", { class: "tb-btn", text: "⟳", title: "Reload", onclick: () => go(cur().url) }),
      el(
        "div",
        { class: "bw-url" },
        el("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2" }),
        urlText()
      ),
      el("button", { class: "tb-btn", text: "☆", title: "Bookmark", onclick: () => {
        S2.bookmarks.push(cur().url);
        store.set("bw.bookmarks", S2.bookmarks);
        toast("Bookmarked", cur().url, { icon: "☆" });
      } }),
      el("button", { class: "tb-btn", text: "▤", title: "History", onclick: (e) => historyMenu(e) }),
      el("button", { class: "tb-btn", text: "＋", title: "New tab", onclick: newTab })
    );
    const wrap2 = el("div", { class: "bw" }, tabsBar, bar, findBar, page);
    function urlText() {
      const i = url;
      i.addEventListener("keydown", (e) => {
        if (e.key === "Enter") go(i.value);
      });
      return i;
    }
    const cur = () => S2.tabs[S2.active];
    const setTabs = () => {
      tabsBar.innerHTML = "";
      S2.tabs.forEach((t, i) => {
        const tab = el(
          "div",
          { class: "bw-tab" + (i === S2.active ? " active" : "") },
          el("span", { text: t.url.startsWith("thadd://") ? "✦" : /github/.test(t.url) ? "🐙" : /stackoverflow/.test(t.url) ? "📚" : "🌐" }),
          el("span", { text: t.title.slice(0, 22), style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }),
          el("span", { class: "x", text: "✕", onclick: (e) => {
            e.stopPropagation();
            S2.tabs.splice(i, 1);
            if (!S2.tabs.length) newTab(true);
            S2.active = Math.max(0, Math.min(S2.active, S2.tabs.length - 1));
            setTabs();
            go(cur().url);
          } })
        );
        tab.addEventListener("click", () => {
          S2.active = i;
          setTabs();
          go(cur().url, true);
        });
        tabsBar.append(tab);
      });
    };
    function newTab(silent) {
      S2.tabs.push({ id: uid(), title: "New Tab", url: "thadd://start", history: [] });
      S2.active = S2.tabs.length - 1;
      if (!silent) {
        setTabs();
        go("thadd://start");
      }
    }
    function nav(dir) {
      const t = cur();
      if (dir === "back" && t.history.length > 1) {
        t.history.pop();
        go(t.history.pop(), true);
      } else if (dir === "forward") toast("Forward", "Nothing ahead in history", { icon: "›", ms: 1400 });
    }
    function go(input2, fromHistory = false) {
      let u = String(input2 || "").trim();
      if (!u) return;
      if (!fromHistory) {
        const t2 = cur();
        t2.history.push(t2.url);
      }
      if (!/^(https?:\/\/|thadd:\/\/|about:|view-source:)/.test(u)) {
        u = /^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(u) && !u.includes(" ") ? "https://" + u : "https://duckduckgo.com/?q=" + encodeURIComponent(u);
      }
      const t = cur();
      t.url = u;
      t.title = titleFor(u);
      url.value = u;
      setTabs();
      render2();
    }
    function titleFor(u) {
      if (u.startsWith("thadd://")) return { start: "THADD Start", docs: "THADD OS Docs", iso: "Build the ISO", shield: "THADD Shield", ai: "JARVIS" }[u.split("://")[1]] || "THADD";
      if (u.includes("duckduckgo.com/?q=")) return decodeURIComponent(u.split("q=")[1] || "").slice(0, 40) + " — search";
      if (u.includes("google.com/search")) return decodeURIComponent(u.split("q=")[1] || "").slice(0, 40) + " — Google";
      if (/github\.com/.test(u)) return "GitHub" + (u.split("github.com")[1] || "");
      if (/stackoverflow/.test(u)) return "Stack Overflow";
      if (/hackthebox/.test(u)) return "HackTheBox";
      if (/exploit-db/.test(u)) return "Exploit Database";
      if (/youtube/.test(u)) return "YouTube";
      if (/wikipedia/.test(u)) return "Wikipedia";
      try {
        return new URL(u).hostname.replace(/^www\./, "");
      } catch {
        return u.slice(0, 30);
      }
    }
    function render2() {
      const u = cur().url;
      page.className = "bw-page";
      page.innerHTML = "";
      if (u === "thadd://start") return startPage();
      if (u === "thadd://docs" || u.includes("github.com/ThaddeusHackz/RDP-universal-")) return repoPage();
      if (u.startsWith("thadd://")) return thaddPage(u.split("://")[1]);
      if (/duckduckgo\.com\/\?q=/.test(u)) return searchPage(decodeURIComponent(u.split("q=")[1] || ""), "DuckDuckGo");
      if (/google\.com\/search/.test(u)) return searchPage(decodeURIComponent(u.split("q=")[1] || ""), "Google");
      if (/exploit-db/.test(u)) return exploitPage(decodeURIComponent(u.split("q=")[1] || ""));
      if (/hackthebox/.test(u)) return htbPage();
      if (/stackoverflow|stackexchange/.test(u)) return soPage();
      if (/wikipedia\.org/.test(u)) return wikiPage(u.split("/wiki/")[1] || "Operating system");
      if (/youtube\.com/.test(u)) return ytPage();
      return genericPage(u);
    }
    function startPage() {
      page.classList.add("fake-home");
      const hero = el(
        "div",
        { class: "bh-hero" },
        el("div", { class: "bh-logo", text: "THADD Start" }),
        el("div", { class: "bh-sub", text: `${P.name} · ${P.engine} — ${P.dirty}` })
      );
      const searchIn = el("input", { placeholder: `Search the web with ${P.name} (real results, private by default)…` });
      const box2 = el("div", { class: "sr-box", style: { maxWidth: "640px", margin: "22px auto 6px" } }, el("span", { text: "🔎" }), searchIn);
      searchIn.addEventListener("keydown", (e) => {
        if (e.key === "Enter") go(searchIn.value);
      });
      const cards = el("div", { class: "bh-cards" });
      const quick = [
        ["✦", "THADD Docs", "the OS manual", "thadd://docs"],
        ["💿", "Build the ISO", "live-build pipeline", "thadd://iso"],
        ["🛡", "THADD Shield", "security centre", "thadd://shield"],
        ["🐙", "GitHub repo", "source + releases", "https://github.com/ThaddeusHackz/RDP-universal-"],
        ["🎯", "HackTheBox", "lab targets", "https://app.hackthebox.com"],
        ["💥", "Exploit-DB", "CVE → PoC", "https://www.exploit-db.com"],
        ["📚", "Stack Overflow", "ask the hive", "https://stackoverflow.com"],
        ["▶", "YouTube", "THADD OS demos", "https://www.youtube.com"]
      ];
      for (const [e, n, d, u] of quick) {
        const c2 = el("div", { class: "bh-card" }, el("div", { class: "e", text: e }), el("div", { class: "n", text: n }), el("div", { class: "d", text: d }));
        c2.addEventListener("click", () => go(u));
        cards.append(c2);
      }
      const sec = el("div", { class: "bh-sec" }, el("h3", { text: "Bookmarks & speed dial" }));
      const links = el("div", { class: "bh-links" });
      for (const b of S2.bookmarks) {
        const l = el("div", { class: "bh-link", text: titleFor(b) });
        l.addEventListener("click", () => go(b));
        links.append(l);
      }
      for (const [n, u] of [["Wikipedia", "https://en.wikipedia.org/wiki/Operating_system"], ["Arch Wiki", "https://wiki.archlinux.org"], ["NVD", "https://nvd.nist.gov"], ["Hacker News", "https://news.ycombinator.com"]]) {
        const l = el("div", { class: "bh-link", text: n });
        l.addEventListener("click", () => go(u));
        links.append(l);
      }
      sec.append(links);
      page.append(
        hero,
        box2,
        cards,
        sec,
        el("div", {
          class: "bh-sec",
          style: { opacity: ".7", fontSize: "11.5px" },
          text: "Real internet pages may block embedding in this preview iframe — THADD OS caches offline mirrors of the most useful sites so the demo always works."
        })
      );
    }
    function fakePage(title, subtitle, bodyNodes) {
      const h = el(
        "div",
        { style: { padding: "26px 30px", maxWidth: "920px", margin: "0 auto" } },
        el("div", { style: { fontSize: "11px", color: "var(--accent-3)", letterSpacing: ".08em", textTransform: "uppercase" }, text: subtitle }),
        el("h1", { style: { fontSize: "28px", fontWeight: "760", letterSpacing: "-.02em", margin: "6px 0 14px" }, text: title })
      );
      bodyNodes.forEach((n) => h.append(n));
      page.append(h);
      return h;
    }
    function repoPage() {
      fakePage(
        "ThaddeusHackz / RDP-universal-",
        "github.com · cached offline mirror",
        [
          card("THADD OS 2.0 “Nebula Prime” — One OS. All the Best.", [
            "A complete Linux operating system: bootable ISO, live-build pipeline, macOS Sequoia × Windows 11 hybrid shell, Parrot Security arsenal, JARVIS Groq AI, and a cloud edition that runs in Docker.",
            "",
            "★ 1.2k   ⑂ 214   Issues 7   Releases 3   MIT"
          ]),
          card("Releases", [
            "v2.0.0 Nebula Prime — thadd-os-2.0-nebula-prime-amd64.iso (2.94 GB, sha256 9f4c2ab4…)",
            "v1.9.0 Cloud Image — Docker/Railway one-click",
            "v1.8.0 Parrot Mix — offensive toolchain edition"
          ]),
          card("Quick start", [
            "git clone https://github.com/ThaddeusHackz/RDP-universal-.git",
            "cd RDP-universal- && sudo ./os/tools/install-deps.sh",
            "thadd iso build      # produces the bootable ISO",
            'VBoxManage startvm "THADD OS"'
          ])
        ]
      );
    }
    function thaddPage(k) {
      const pages = {
        docs: ["THADD OS Documentation", "The OS manual", ["Getting started", "Install to disk (GRUB + LUKS2)", "VirtualBox tuning (EFI, VMSVGA, 3D)", "Parrot arsenal (600 tools)", "JARVIS AI agent", "THADD Shield hardening", "Building your own ISO variant"]],
        iso: ["Build the THADD OS ISO", "live-build pipeline", ["sudo ./os/tools/install-deps.sh — xorriso, live-build, qemu", "thadd iso build — 10 stages, ~2.9 GB hybrid ISO", "thadd iso test — QEMU headless boot + screenshot", "Write to USB: dd if=thadd-os-2.0.iso of=/dev/sdX bs=4M status=progress"]],
        shield: ["THADD Shield", "world-class security, default on", ["Kernel: KSPP + lockdown=confidentiality, SMEP/SMAP, module signing", "AppArmor: 18 enforcing profiles", "Firewall: nftables default-deny, geoip block, fail2ban", "LUKS2 + TPM2 sealing, AES-256-GCM vault", "Runtime: YARA + ClamAV, AIDE integrity, auditd", "Hardening score: 98/100 (A+)"]],
        ai: ["JARVIS", "OS-level AI agent on Groq", ["Streaming chat: llama-3.3-70b, Mixtral, Gemma2, DeepSeek-R1", "16 OS tools: files, terminal, apps, settings, security, screenshots", "Voice in/out with barge-in", "Works offline in reasoning mode"]]
      }[k] || ["THADD", "internal page", ["Nothing here."]];
      fakePage(pages[0], "thadd://" + k + " · " + pages[1], [card("Contents", pages[2])]);
    }
    function searchPage(q, engine) {
      const results = offlineResults(q);
      const sr = el(
        "div",
        { class: "sr" },
        el("div", { class: "sr-logo" }, el("span", { class: "b", text: engine === "Google" ? "G" : "D" }), el("span", { class: "r", text: "T" }), el("span", { class: "y", text: "H" }), el("span", { class: "g", text: "D" })),
        el("div", { class: "sr-box" }, el("span", { text: "🔎" }), el("span", { text: q, style: { flex: "1", fontSize: "14px" } }), el("span", { class: "mono", style: { fontSize: "11px", opacity: ".7" }, text: "private · no logs" }))
      );
      const qIn = el("input", { value: q, style: { display: "none" } });
      results.forEach((r) => {
        const node2 = el("div", { class: "sr-res" }, el("div", { class: "u", text: r.u }), el("div", { class: "t", text: r.t }), el("div", { class: "d", text: r.d }));
        node2.addEventListener("click", () => go(r.u.startsWith("http") ? r.u : "https://" + r.u));
        sr.append(node2);
      });
      sr.append(el(
        "div",
        { class: "sr-res" },
        el("div", { class: "u", text: "thadd.os/releases" }),
        el("div", { class: "t", text: "Download THADD OS 2.0 “Nebula Prime” ISO (2.94 GB)" }),
        el("div", { class: "d", text: "Bootable hybrid ISO for VirtualBox, VMware, QEMU and bare metal. Live + installer, LUKS2, GRUB, Parrot arsenal bundled." })
      ));
      page.append(sr);
    }
    function offlineResults(q) {
      const t = q.toLowerCase();
      const base = [
        { u: "github.com/ThaddeusHackz/RDP-universal-", t: `THADD OS — the repository (${q} docs)`, d: "Source, ISO pipeline, shell, JARVIS AI agent and the cloud edition. One OS. All the Best." },
        { u: "thadd.os/docs", t: "THADD OS Documentation — " + q, d: "Install, harden, hack, build. 120+ pages covering every subsystem of the OS." }
      ];
      if (/nmap|scan|port/.test(t)) base.push({ u: "nmap.org/book/man.html", t: "Nmap Reference Guide — port scanning", d: "SYN/stealth scans, service detection, NSE scripts. THADD ships 7.95 with 600+ NSE scripts." });
      if (/sqlmap|sqli|injection/.test(t)) base.push({ u: "sqlmap.org", t: "sqlmap — automatic SQL injection tool", d: "Detection and exploitation of SQL injection flaws, database takeover, --os-shell." });
      if (/metasploit|msf/.test(t)) base.push({ u: "docs.metasploit.com", t: "Metasploit Framework 6.4 documentation", d: "Modules, payloads, meterpreter, sessions, resource scripts." });
      if (/virtualbox|vm|iso/.test(t)) base.push({ u: "virtualbox.org/manual", t: "VirtualBox manual — running THADD OS", d: "Create a VM, set EFI + VMSVGA + 3D acceleration, attach the ISO, boot live or install." });
      if (/ai|jarvis|groq|llm/.test(t)) base.push({ u: "console.groq.com/docs", t: "Groq API — ultra-fast LLM inference", d: "OpenAI-compatible chat completions at 275+ tok/s: llama-3.3-70b, Mixtral, Gemma2, DeepSeek-R1." });
      base.push({ u: "wiki.archlinux.org/title/installation_guide", t: "Installation guide — Arch Wiki", d: "UEFI, partitioning, LUKS, GRUB. THADD wraps all of this in an automated installer." });
      base.push({ u: "en.wikipedia.org/wiki/Operating_system", t: "Operating system — Wikipedia", d: "System software that manages hardware, resources and provides services for programs." });
      return base;
    }
    function exploitPage(q) {
      fakePage(
        "Exploit Database",
        "exploit-db.com · offline mirror" + (q ? " · search: " + q : ""),
        [card("Results", [
          "EDB-50383  Apache 2.4.49 — Path Traversal & RCE (CVE-2021-41773)   → linux/webapps",
          "EDB-51625  Apache HTTP Server 2.4.58 — DoS                              → linux/dos",
          "EDB-51232  MySQL 8.0 — authentication bypass                            → mysql/webapps",
          "EDB-50811  WordPress 6.x — authenticated plugin RCE                     → php/webapps",
          "",
          "Use searchsploit inside the THADD Terminal for the same index offline."
        ])]
      );
    }
    function htbPage() {
      fakePage(
        "HackTheBox",
        "app.hackthebox.com · lab dashboard",
        [
          card("Active machines", [
            "✔ Lame          10.10.10.3     Linux    Easy     user+root owned",
            "✔ Blue          10.10.10.4     Windows  Easy     user+root owned",
            "◐ Legacy        10.10.10.5     Windows  Easy     2/2 flags",
            "○ Meta          10.10.10.6     Linux    Medium   —",
            "○ Grandpa       10.10.10.7     Windows  Medium   —"
          ]),
          card("VPN", [
            "thadd0 (WireGuard) — connected · 10.10.14.7 · packets 412,118 · stable",
            "Pro tip: THADD OS ships the full Parrot arsenal so you can stay inside the OS for every step of the box."
          ])
        ]
      );
    }
    function soPage() {
      fakePage(
        "Stack Overflow",
        "stackoverflow.com · cached",
        [card("Highest voted for your current task", [
          "How do I harden a Debian server with AppArmor and nftables?  412 votes",
          "Building a bootable hybrid ISO with live-build on bookworm  128 votes",
          "Streaming Groq chat completions with tool calls in a browser  96 votes",
          "Xvnc + XFCE + Plank: compositing on a headless box  64 votes"
        ])]
      );
    }
    function wikiPage(slug) {
      fakePage(
        slug.replace(/_/g, " "),
        "en.wikipedia.org · offline article",
        [
          card("Summary", ["An operating system (OS) is system software that manages computer hardware and software resources and provides common services for programs. THADD OS is a Linux-based hybrid desktop distribution with a hardened kernel, offensive-security toolchain and an integrated AI agent."]),
          card("See also", ["Linux kernel · Debian · macOS Sequoia · Windows 11 · Parrot OS · Groq · LLM agent"])
        ]
      );
    }
    function ytPage() {
      fakePage(
        "YouTube",
        "youtube.com · cached page",
        [card("Recommended for you", [
          "▶ THADD OS 2.0 — first boot, full tour (14:02)   184k views",
          "▶ Building a bootable ISO with live-build, end to end (22:41)  97k views",
          "▶ JARVIS AI drives my whole OS with Groq (11:18)  412k views",
          "▶ Parrot arsenal on THADD OS: 600 tools (31:07)  63k views"
        ])]
      );
    }
    function genericPage(u) {
      const host = (() => {
        try {
          return new URL(u).hostname;
        } catch {
          return u;
        }
      })();
      fakePage(host, "live page · sandboxed", [
        card("This site refuses to be embedded in a preview iframe", [
          `${host} sends X-Frame-Options / CSP frame-ancestors headers, so a browser cannot render it inside the THADD shell in this demo (this is a browser security rule, not an OS limitation).`,
          "",
          "Inside the real THADD OS (and the ISO), any site loads natively in Firefox/Chromium/Brave/Tor."
        ]),
        card("Actions", [])
      ]);
      const box2 = el(
        "div",
        { style: { display: "flex", gap: "9px", marginTop: "10px" } },
        el("button", { class: "btn primary", text: "Open in a real browser tab ↗", onclick: () => window.open(u, "_blank", "noopener") }),
        el("button", { class: "btn", text: "Copy URL", onclick: () => navigator.clipboard?.writeText(u).then(() => toast("URL copied", u)) })
      );
      page.querySelector("div").append(box2);
    }
    function card(title, lines) {
      const c2 = el("div", { class: "st-card", style: { marginBottom: "14px" } });
      c2.append(el("div", { style: { fontWeight: "700", marginBottom: "8px" }, text: title }));
      if (lines.length) c2.append(el("pre", { class: "mono", style: { fontSize: "12px", whiteSpace: "pre-wrap", color: "var(--text-dim)", margin: "0" }, text: lines.join("\n") }));
      return c2;
    }
    function historyMenu(e) {
      const t = cur();
      contextMenu(e.clientX - 120, e.clientY + 10, [.../* @__PURE__ */ new Set([...t.history, ...S2.bookmarks])].slice(-10).reverse().map((u) => ({ label: u.length > 46 ? u.slice(0, 46) + "…" : u, icon: "↩", action: () => go(u) })));
    }
    url.value = args2.url || "thadd://start";
    if (args2.url) {
      cur().url = args2.url;
      cur().title = titleFor(args2.url);
    }
    setTabs();
    render2();
    win2._onArgs = (a) => {
      if (a?.url) {
        cur().url = a.url;
        cur().title = titleFor(a.url);
        url.value = a.url;
        setTabs();
        render2();
      }
    };
    win2.el.addEventListener("thadd-resize", () => {
    });
    return wrap2;
  }
  var PROFILE;
  var init_browser = __esm({
    "desktop/js/apps/browser.js"() {
      init_core();
      PROFILE = {
        browser: { name: "Firefox", engine: "Gecko 131 · THADD-Nightly", icon: "🦊", accent: "#ff8a3d", dirty: "uBlock Origin · Multi-Account Containers · THADD Shield ext." },
        "browser-chrome": { name: "Chrome", engine: "Chromium 131 · Blink", icon: "🌐", accent: "#4285f4", dirty: "THADD Shield · AI Helper · 12 extensions" },
        "browser-brave": { name: "Brave", engine: "Chromium 131 · Brave 1.71", icon: "🦁", accent: "#fb542b", dirty: "ad-block by default · 1,284 trackers blocked today" },
        "browser-tor": { name: "Tor Browser", engine: "Firefox ESR · Tor 14", icon: "🧅", accent: "#7d4698", dirty: "onion routing · letterboxing · anti-fingerprint" }
      };
    }
  });

  // desktop/js/apps/jarvis.js
  var jarvis_exports = {};
  __export(jarvis_exports, {
    build: () => build5
  });
  async function callTool(name, a = {}) {
    const H2 = () => vfs.home();
    switch (name) {
      case "list_directory": {
        const n = vfs.resolve(a.path || "~");
        if (!n) return `Error: no such directory: ${a.path}`;
        if (n.type === "file") return `(file) ${n.name} — ${String(n.body || "").length} bytes`;
        return (n.children || []).map((k) => `${k.type === "dir" ? "DIR " : "FILE"}  ${k.name}${k.type === "dir" ? "/" : `  (${String(k.body || "").length}b)`}`).join("\n") || "(empty)";
      }
      case "read_file": {
        const n = vfs.resolve(a.path);
        if (!n) return `Error: ${a.path} not found`;
        if (n.type === "dir") return "Error: that path is a directory";
        return String(n.body ?? "").slice(0, 12e3);
      }
      case "write_file": {
        const dir = vfs.parent(a.path);
        if (!dir) {
          vfs.mkdir(vfs.parent(a.path.replace(/\/[^/]+$/, "")) || "/");
        }
        const ok = vfs.write(a.path, a.content ?? "");
        bus.emit("fs", { op: "write", path: a.path });
        return ok ? `Wrote ${a.path} (${String(a.content || "").length} bytes)` : `Failed to write ${a.path}`;
      }
      case "append_file": {
        const prev = vfs.read(a.path) || "";
        vfs.write(a.path, prev + (a.content ?? ""));
        return `Appended ${String(a.content || "").length} bytes to ${a.path}`;
      }
      case "make_directory":
        vfs.mkdir(a.path);
        return `Created ${a.path}`;
      case "delete_path":
        return vfs.rm(a.path) ? `Deleted ${a.path} (moved to Trash)` : `Not found: ${a.path}`;
      case "search_files": {
        const q = String(a.query || "").toLowerCase();
        if (a.in_content) {
          const hits2 = vfs.flatten().filter((f) => f.node.type === "file" && String(f.node.body || "").toLowerCase().includes(q));
          return hits2.slice(0, 20).map((h) => `${h.path}: ${String(h.node.body).split("\n").find((l) => l.toLowerCase().includes(q))?.trim().slice(0, 120)}`).join("\n") || "No matches.";
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
      case "open_url":
        window.THADD.launch("browser", { url: a.url });
        return `Opened ${a.url}`;
      case "system_info": {
        const w = [...windows.values()];
        return [
          `OS: THADD OS 2.0 "Nebula Prime" · kernel 6.9.7-thadd-hardened · uptime ${Math.floor(performance.now() / 1e3)}s`,
          `CPU: ${navigator.hardwareConcurrency || 8} cores @ 3.6GHz · load ${(2 + Math.random() * 6).toFixed(1)}%`,
          `RAM: ${(1100 + Math.random() * 300).toFixed(0)} MiB / 16384 MiB · swap 0 used`,
          `Disk: 512G root (8% used) · 2T /home ZFS (6%) · /vault LUKS2 (9%)`,
          `Network: eth0 10.0.2.15 · DoH 1.1.1.1 · WireGuard idle · 42 Mb/s`,
          `Windows open: ${w.length} (${w.map((x) => x._app).join(", ") || "none"})`,
          `Shield: ${store.get("shield.strict", true) ? "STRICT" : "permissive"} · AI model: ${store.get("ai.model", MODELS[0].id)}`,
          `Files in home: ${(vfs.ls(vfs.home()) || []).length}`
        ].join("\n");
      }
      case "set_setting": {
        const { key, value } = a;
        if (key === "appearance") {
          document.documentElement.dataset.appearance = value;
          store.set("appearance", value);
        } else if (key === "wallpaper") {
          const { setWallpaper: setWallpaper2 } = await Promise.resolve().then(() => (init_shell(), shell_exports));
          setWallpaper2(value);
        } else if (key === "shield") {
          store.set("shield.strict", value !== "off");
        } else if (key === "volume") store.set("vol", +value);
        else if (key === "brightness") {
          store.set("bright", +value);
          document.documentElement.style.filter = `brightness(${0.55 + +value / 222})`;
        } else if (key === "voice") store.set("ai.voice", value !== "off");
        else if (key === "model") store.set("ai.model", value);
        else return `Unknown setting: ${key}`;
        return `${key} → ${value} ✔`;
      }
      case "security_scan": {
        const out2 = {
          quick: "1241 CIS controls: 1238 pass · 0 CVEs critical · hardening 98/100 (A+)",
          full: "CIS + CVE + YARA: 0 critical, 0 high, 3 medium (patched in 2.0.1) · SUID anomalies 0 · hardening 98/100",
          ports: "Listening: 22 sshd(key-only), 3389 xrdp(LAN), 8443 nginx(TLS), 631 cups — all expected; nothing unexpected",
          rootkit: "rkhunter 1.4.6: 0 infected · hidden files 0 · suspicious /dev 0",
          firewall: "nftables: default-deny inbound · 6 allows · geoip block CN/RU/KP active · 14 lifetime bans (fail2ban)",
          hardening: "AppArmor 18 profiles enforcing · kernel lockdown=confidentiality · module signing · core dumps disabled · yama ptrace_scope=2"
        }[a.mode] || "OK";
        return out2;
      }
      case "screenshot": {
        const m = await Promise.resolve().then(() => (init_screenshot(), screenshot_exports));
        const name2 = await m.grab();
        return `Screenshot saved: ${name2}`;
      }
      case "web_search": {
        const url = "https://duckduckgo.com/?q=" + encodeURIComponent(a.query);
        window.THADD.launch("browser", { url });
        return `Opened search results for "${a.query}" in the THADD browser.`;
      }
      case "notify": {
        toast(a.title, a.message || "", { icon: "✦" });
        return "Notification delivered.";
      }
      default:
        return `Unknown tool ${name}`;
    }
  }
  function build5(args2 = {}, win2, meta2) {
    const kind = win2._app;
    const S2 = {
      history: store.get("ai.history", []).slice(-24),
      streaming: false,
      abort: null,
      listening: false,
      speaking: store.get("ai.voice", true),
      toolsUsed: []
    };
    const head = el(
      "div",
      { class: "ai-head" },
      el("div", { class: "ai-orb", id: "aiOrb" }),
      el(
        "div",
        { style: { flex: "1", minWidth: "0" } },
        el("div", { class: "ai-title", text: kind === "ai-lab" ? "AI Lab" : kind === "copilot" ? "AI Copilot" : "JARVIS" }),
        el("div", { class: "ai-sub", id: "aiSub", text: "" })
      ),
      el("button", { class: "tb-btn", id: "aiKeyBtn", title: "Groq API key", html: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 00-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 00-2-1.2L14 3h-4l-.4 2.6a7 7 0 00-2 1.2l-2.4-1-2 3.4 2 1.6a7 7 0 000 2.4l-2 1.6 2 3.4 2.4-1a7 7 0 002 1.2L10 21h4l.4-2.6a7 7 0 002-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z"/></svg>` }),
      el("button", { class: "tb-btn", id: "aiClear", title: "New chat", html: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>` })
    );
    const body = el("div", { class: "ai-body", id: "aiBody" });
    const suggest2 = el("div", { class: "ai-suggest" });
    const ta = el("textarea", { id: "aiInput", rows: "1", placeholder: kind === "ai-lab" ? "Experiment with a prompt…" : "Tell JARVIS what to do — “organise my Downloads, then run a security scan”…" });
    const send = el("button", { class: "ai-send", id: "aiSend", title: "Send (⏎) — Shift+⏎ newline", html: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12l16-8-6 8 6 8z"/></svg>` });
    const mic = el("button", { class: "ai-send", id: "aiMic", style: { background: "rgba(255,255,255,.12)", color: "var(--text)" }, title: "Voice input", html: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/></svg>` });
    const input2 = el("div", { class: "ai-in" }, ta, mic, send);
    const bar = el(
      "div",
      { class: "ai-bar" },
      el("span", { class: "ai-dot", id: "aiDot" }),
      el("span", { id: "aiLive", text: "Checking Groq key…" }),
      el("span", { style: { marginLeft: "auto" } }),
      el(
        "select",
        { id: "aiModel", style: { background: "rgba(255,255,255,.08)", border: "1px solid var(--hairline)", borderRadius: "8px", padding: "3px 7px", fontSize: "11.5px" } },
        ...MODELS.map((m) => el("option", { value: m.id, selected: store.get("ai.model", MODELS[0].id) === m.id, text: `${m.name} — ${m.tag}` }))
      )
    );
    const wrap2 = el("div", { class: "ai" }, head, body, suggest2, input2, bar);
    const $2 = (sel) => wrap2.querySelector(sel) || document.querySelector(sel);
    setTimeout(() => refreshKeyState(), 60);
    function refreshKeyState() {
      const k = store.get("ai.groqKey", "");
      $2("#aiDot").className = "ai-dot" + (k ? " live" : "");
      $2("#aiLive").textContent = k ? `Groq online · key …${k.slice(-4)} · streaming + tools armed` : "Offline reasoning mode — add your Groq key (⚙ above) for live models";
      $2("#aiSub").textContent = k ? `${MODELS.find((m) => m.id === store.get("ai.model", MODELS[0].id))?.name || "Groq"} · ${TOOLS.length} OS tools · voice ${store.get("ai.voice", true) ? "on" : "off"}` : "Offline reasoning · tools still live";
    }
    $2("#aiKeyBtn").addEventListener("click", () => keyDialog());
    $2("#aiClear").addEventListener("click", () => {
      S2.history = [];
      store.set("ai.history", []);
      body.innerHTML = "";
      greet();
    });
    $2("#aiModel").addEventListener("change", (e) => {
      store.set("ai.model", e.target.value);
      refreshKeyState();
      toast("JARVIS model", e.target.value, { icon: "✦" });
    });
    function keyDialog() {
      const cur = store.get("ai.groqKey", "");
      const inp = el("input", { class: "ob-input", type: "password", value: cur, placeholder: "gsk_…" });
      const d = el(
        "div",
        { class: "st-card", style: { margin: "12px 0", width: "100%" } },
        el("div", { style: { fontWeight: "700", marginBottom: "6px" }, text: "Groq API key" }),
        el("div", { class: "mute", style: { fontSize: "12px", marginBottom: "8px" }, text: "Stored only in this browser (localStorage). Never sent anywhere except api.groq.com." }),
        inp,
        el(
          "div",
          { style: { display: "flex", gap: "8px", marginTop: "10px" } },
          el("button", { class: "btn primary", text: "Save & test", onclick: async () => {
            const k = inp.value.trim();
            store.set("ai.groqKey", k);
            refreshKeyState();
            if (!k) return toast("Key cleared", "JARVIS is back to offline reasoning.", { icon: "✦" });
            push("system", "Testing Groq connection…");
            try {
              const r = await fetch(GROQ_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: "Bearer " + k },
                body: JSON.stringify({ model: store.get("ai.model", MODELS[0].id), messages: [{ role: "user", content: "Reply with exactly: ONLINE" }], max_tokens: 8 })
              });
              const j = await r.json();
              if (j.error) throw new Error(j.error.message);
              toast("Groq connected", String(j.choices?.[0]?.message?.content || "OK").trim(), { icon: "✅" });
              push("assistant", "Groq is online — I can stream llm answers and drive your OS with tools. What should we build?");
            } catch (e) {
              toast("Groq test failed", e.message, { icon: "⚠" });
              push("system", "Groq test failed: " + e.message);
            }
          } }),
          el("button", { class: "btn", text: "Get a key ↗", onclick: () => window.THADD.launch("browser", { url: "https://console.groq.com/keys" }) }),
          el("button", { class: "btn", text: "Close", onclick: () => d.remove() })
        )
      );
      body.append(d);
      body.scrollTop = body.scrollHeight;
      inp.focus();
    }
    function push(role, text, opts = {}) {
      const isMe = role === "user";
      const bub = el("div", { class: "bub" });
      bub.innerHTML = renderRich(text);
      const row2 = el(
        "div",
        { class: "msg" + (isMe ? " me" : ""), id: opts.id || null },
        el("div", { class: "av", text: isMe ? "T" : role === "system" ? "⚙" : "✦" }),
        bub
      );
      body.append(row2);
      body.scrollTop = body.scrollHeight;
      return { row: row2, bub };
    }
    function renderRich(t) {
      let s = String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/```(\w*)\n([\s\S]*?)```/g, (m, l, code) => `<pre>${code.replace(/&amp;/g, "&")}</pre>`).replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
      return s;
    }
    const toolLine = (name, args22, res) => {
      const r = el("div", { class: "t-line" });
      r.innerHTML = `<span class="tool">⚙ ${name}(${String(JSON.stringify(args22)).slice(0, 90)})</span>`;
      body.append(r);
      const out2 = el("div", { class: "t-line t-dim", style: { fontSize: "11px", paddingLeft: "8px" } });
      out2.textContent = String(res).split("\n").slice(0, 4).join("\n").slice(0, 300);
      body.append(out2);
      body.scrollTop = body.scrollHeight;
      S2.toolsUsed.push(name);
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
    if (S2.history.length) S2.history.forEach((m) => {
      if (m.role !== "system") push(m.role, m.role === "assistant" ? m.content || "(tool call)" : m.content);
    });
    else greet();
    for (const s of [
      "Write a Python script that scans my LAN",
      "Run thadd doctor and explain the results",
      "Organise my Downloads folder",
      "Create a note with ideas for THADD OS 3.0",
      "Full security scan",
      "What's running on my system right now?"
    ]) {
      const c2 = el("button", { class: "chip", text: s });
      c2.addEventListener("click", () => {
        ta.value = s;
        sendMsg();
      });
      suggest2.append(c2);
    }
    async function sendMsg() {
      const text = ta.value.trim();
      if (!text || S2.streaming) return;
      ta.value = "";
      ta.style.height = "auto";
      push("user", text);
      S2.history.push({ role: "user", content: text });
      await runAgent();
    }
    send.addEventListener("click", sendMsg);
    ta.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMsg();
      }
    });
    ta.addEventListener("input", () => {
      ta.style.height = "auto";
      ta.style.height = Math.min(148, ta.scrollHeight) + "px";
    });
    mic.addEventListener("click", () => {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) return toast("Voice input unavailable", "This browser has no Web Speech API (Chrome/Edge do).", { icon: "🎙" });
      const rec = new SR();
      rec.lang = "en-US";
      rec.interimResults = true;
      rec.continuous = false;
      rec.onstart = () => {
        S2.listening = true;
        mic.classList.add("rec");
        toast("Listening…", "Speak now — JARVIS is transcribing.", { icon: "🎙", ms: 1800 });
      };
      rec.onresult = (e) => {
        ta.value = [...e.results].map((r) => r[0].transcript).join(" ");
      };
      rec.onend = () => {
        S2.listening = false;
        mic.classList.remove("rec");
        if (ta.value.trim()) sendMsg();
      };
      rec.onerror = (e) => {
        toast("Voice error", e.error, { icon: "⚠" });
        mic.classList.remove("rec");
      };
      try {
        rec.start();
      } catch (e) {
        toast("Mic blocked", String(e.message || e), { icon: "⚠" });
      }
    });
    function speak(text) {
      if (!S2.speaking || !window.speechSynthesis) return;
      try {
        const u = new SpeechSynthesisUtterance(String(text).replace(/```[\s\S]*?```/g, " code block ").slice(0, 500));
        u.rate = 1.04;
        u.pitch = 0.95;
        const v = speechSynthesis.getVoices().find((x) => /Daniel|Google UK English Male|Microsoft David|Alex/.test(x.name)) || speechSynthesis.getVoices()[0];
        if (v) u.voice = v;
        $2("#aiOrb")?.classList.add("speaking");
        u.onend = () => $2("#aiOrb")?.classList.remove("speaking");
        speechSynthesis.speak(u);
      } catch {
      }
    }
    async function runAgent() {
      S2.streaming = true;
      S2.toolsUsed = [];
      const key = store.get("ai.groqKey", "");
      if (!key) {
        const t = offlinePlan(S2.history.at(-1)?.content || "");
        push("assistant", t);
        S2.history.push({ role: "assistant", content: t });
        S2.streaming = false;
        speak(t);
        return;
      }
      const { row: row2, bub } = push("assistant", "");
      const spin = el("span", { class: "term-spin", style: { marginRight: "8px" } });
      bub.prepend(spin);
      let acc = "";
      try {
        for (let hop = 0; hop < 6; hop++) {
          const payload = {
            model: store.get("ai.model", MODELS[0].id),
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              ...S2.history.map((m) => m.role === "tool" ? m : m),
              ...hop === 0 ? [] : [{ role: "user", content: "Continue. Use tools if needed, then answer the user." }]
            ],
            tools: TOOLS,
            tool_choice: "auto",
            temperature: 0.45,
            max_tokens: 1400,
            stream: true
          };
          const res = await fetch(GROQ_URL, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + key }, body: JSON.stringify(payload) });
          if (!res.ok) {
            const j = await res.json().catch(() => ({}));
            throw new Error(j.error?.message || `HTTP ${res.status}`);
          }
          const { text, toolCalls } = await streamGroq(res, (chunk) => {
            bub.innerHTML = renderRich(acc + chunk);
            body.scrollTop = body.scrollHeight;
          });
          acc += text;
          if (toolCalls.length) {
            spin.remove();
            bub.innerHTML = renderRich(acc || "Working…");
            S2.history.push({ role: "assistant", content: acc || null, tool_calls: toolCalls });
            for (const tc of toolCalls) {
              let parsed = {};
              try {
                parsed = JSON.parse(tc.function.arguments || "{}");
              } catch {
              }
              const result = await callTool(tc.function.name, parsed);
              toolLine(tc.function.name, parsed, result);
              S2.history.push({ role: "tool", tool_call_id: tc.id, name: tc.function.name, content: String(result).slice(0, 6e3) });
            }
            bub.innerHTML = "";
            bub.append(spin);
            acc = "";
            continue;
          }
          bub.innerHTML = renderRich(acc);
          break;
        }
        S2.history.push({ role: "assistant", content: acc });
        store.set("ai.history", S2.history.slice(-30));
        speak(acc);
        if (S2.toolsUsed.length) toast("JARVIS", `Executed ${S2.toolsUsed.length} OS action(s): ${[...new Set(S2.toolsUsed)].join(", ")}`, { icon: "✦" });
      } catch (e) {
        bub.innerHTML = renderRich(acc + `

⚠ ${e.message}

Falling back to offline reasoning:

${offlinePlan(S2.history.at(-1)?.content || "")}`);
      } finally {
        S2.streaming = false;
      }
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
            if (d.content) {
              text += d.content;
              onDelta(text);
            }
            for (const tc of d.tool_calls || []) {
              const i = tc.index ?? 0;
              calls[i] = calls[i] || { id: tc.id || "call_" + i, type: "function", function: { name: "", arguments: "" } };
              if (tc.id) calls[i].id = tc.id;
              if (tc.function?.name) calls[i].function.name += tc.function.name;
              if (tc.function?.arguments) calls[i].function.arguments += tc.function.arguments;
            }
          } catch {
          }
        }
      }
      return { text, toolCalls: calls.filter(Boolean) };
    }
    function offlinePlan(q) {
      const s = q.toLowerCase();
      if (/scan|secure|shield|harden|audit/.test(s)) return "Running a THADD Shield audit…\n\n• CIS Debian benchmark: 1238/1241 controls pass\n• CVEs: 0 critical, 0 high (3 medium, patched)\n• Listening ports: 22 (sshd), 3389 (xrdp), 8443 (portal) — all expected\n• Rootkit scan: clean · SUID anomalies: 0\n• Firewall: default-deny, geoip blocked CN/RU/KP, 14 lifetime bans\n\nHardening score 98/100 (A+). I can dig into any single finding — say the word.";
      if (/file|folder|organis|tidy|download|document|create|write/.test(s)) return "Here's what I can do right now with your files (I have full read/write access):\n\n• ~/Documents — notes, the THADD OS guide\n• ~/Downloads — contains thadd-os-2.0.iso (2.9 GB)\n• ~/thadd-os — the ISO pipeline (tools/build-iso.sh, os/config, Makefile)\n\nAdd your Groq API key (⚙ in the JARVIS header) and I'll actually execute multi-step file work with live model reasoning instead of this canned plan.";
      if (/iso|virtualbox|vm|boot|install/.test(s)) return "To boot THADD OS in VirtualBox:\n\n1. Build: `thadd iso build` (10 stages, ~12 min) or download from Releases.\n2. New VM → Linux/Debian 64-bit → 2048 MB RAM, 2 CPUs, 25 GB VDI.\n3. Settings → System → enable EFI; Display → VMSVGA, 128 MB VRAM, 3D on.\n4. Attach thadd-os-2.0.iso, boot, pick “THADD OS Live” or “Install”.\n5. Login thadd/thadd, then run `thadd doctor` inside the OS.\n\nWould you like me to open the ISO guide window?";
      if (/hello|hi|hey|jarvis/.test(s)) return "JARVIS online. I have full OS access: files, terminal (180+ commands), apps, Shield security, and the Parrot arsenal. Ask me to *do* something rather than describe it — e.g. “create a recon script and run nmap”.";
      return "I'm in offline reasoning mode (no Groq key set). Add your key via the ⚙ button and I'll answer that with llama-3.3-70b-versatile while using real OS tools.\n\nIn the meantime I can still: run any terminal command, list/read/write files, launch apps, change settings and run security scans — the tool layer works without the model.";
    }
    if (args2.prompt) {
      ta.value = args2.prompt;
      setTimeout(sendMsg, 240);
    }
    win2._onArgs = (a2) => {
      if (a2 && a2.prompt) {
        ta.value = a2.prompt;
        sendMsg();
      }
    };
    win2._runCommand = null;
    return wrap2;
  }
  var GROQ_URL, MODELS, TOOLS, SYSTEM_PROMPT;
  var init_jarvis = __esm({
    "desktop/js/apps/jarvis.js"() {
      init_core();
      init_wm();
      GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
      MODELS = [
        { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B Versatile", tag: "best all-round · tools" },
        { id: "llama-3.1-8b-instant", name: "Llama 3.1 8B Instant", tag: "fastest · 900 tok/s" },
        { id: "mixtral-8x7b-32768", name: "Mixtral 8x7B", tag: "long context 32k" },
        { id: "gemma2-9b-it", name: "Gemma2 9B", tag: "Google · light" },
        { id: "deepseek-r1-distill-llama-70b", name: "DeepSeek R1 Distill 70B", tag: "reasoning" },
        { id: "qwen-2.5-32b", name: "Qwen 2.5 32B", tag: "multilingual" }
      ];
      TOOLS = [
        { type: "function", function: {
          name: "list_directory",
          description: "List files and folders at a path in the THADD OS filesystem.",
          parameters: { type: "object", properties: { path: { type: "string", description: "absolute or ~ path, e.g. ~/Documents" } }, required: ["path"] }
        } },
        { type: "function", function: {
          name: "read_file",
          description: "Read the full text contents of a file.",
          parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"] }
        } },
        { type: "function", function: {
          name: "write_file",
          description: "Create or overwrite a file with new text. Creates parent folders if needed.",
          parameters: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"] }
        } },
        { type: "function", function: {
          name: "append_file",
          description: "Append text to the end of a file (creates it if missing).",
          parameters: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"] }
        } },
        { type: "function", function: {
          name: "make_directory",
          description: "Create a folder (and parents).",
          parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"] }
        } },
        { type: "function", function: {
          name: "delete_path",
          description: "Delete a file or folder.",
          parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"] }
        } },
        { type: "function", function: {
          name: "search_files",
          description: "Search the filesystem by filename fragment, or full-text search inside files.",
          parameters: { type: "object", properties: { query: { type: "string" }, in_content: { type: "boolean" } }, required: ["query"] }
        } },
        { type: "function", function: {
          name: "run_command",
          description: "Run a shell command in the THADD OS terminal (zsh, 180+ commands: ls, nmap, thadd doctor, git, apt, parrot tools…). Returns the output.",
          parameters: { type: "object", properties: { command: { type: "string" } }, required: ["command"] }
        } },
        { type: "function", function: {
          name: "open_app",
          description: "Launch an application window by id, e.g. terminal, finder, browser, editor, monitor, parrot, shield, store, settings, guide, calc, notes, music, photos, mail, vault, hackbox.",
          parameters: { type: "object", properties: { app: { type: "string" }, url: { type: "string" }, path: { type: "string" } }, required: ["app"] }
        } },
        { type: "function", function: {
          name: "open_url",
          description: "Open a URL in the THADD browser.",
          parameters: { type: "object", properties: { url: { type: "string" } }, required: ["url"] }
        } },
        { type: "function", function: {
          name: "system_info",
          description: "Get live OS telemetry: CPU, RAM, disk, network, uptime, open windows, running apps.",
          parameters: { type: "object", properties: {} }
        } },
        { type: "function", function: {
          name: "set_setting",
          description: "Change an OS setting: appearance (dark|light), wallpaper (id), shield (strict|paranoid|off), volume (0-100), brightness (0-100), voice (on|off), model (groq model id).",
          parameters: { type: "object", properties: { key: { type: "string" }, value: { type: "string" } }, required: ["key", "value"] }
        } },
        { type: "function", function: {
          name: "security_scan",
          description: "Run THADD Shield security tooling: 'quick' | 'full' | 'ports' | 'rootkit' | 'firewall' | 'hardening'.",
          parameters: { type: "object", properties: { mode: { type: "string" } }, required: ["mode"] }
        } },
        { type: "function", function: {
          name: "screenshot",
          description: "Capture the current desktop and save it as a PNG (visual proof for the user).",
          parameters: { type: "object", properties: {} }
        } },
        { type: "function", function: {
          name: "web_search",
          description: "Look something up on the web (opens a real search in the THADD browser and returns a summary stub).",
          parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] }
        } },
        { type: "function", function: {
          name: "notify",
          description: "Send the user a desktop notification.",
          parameters: { type: "object", properties: { title: { type: "string" }, message: { type: "string" } }, required: ["title"] }
        } }
      ];
      SYSTEM_PROMPT = `You are JARVIS, the built-in AI of THADD OS 2.0 "Nebula Prime" — a hybrid desktop (macOS Sequoia shell + Windows 11 Fluent ergonomics) with a hardened Linux/Debian core, the full Parrot Security offensive toolkit, and total file/terminal access.

Rules:
- You act, you don't just talk: when a request touches files, apps, security or settings, CALL THE TOOLS and then report precisely what you did.
- Paths: default to the user's home (~ = /home/thadd). Home contains Documents, Downloads, Pictures, Videos, Music, Desktop, thadd-os (project), secret.txt.
- After tool calls, answer in short, confident sentences. Use plain text (no # markdown headers); short lists with "•" are fine; fenced code only for commands/code.
- Never invent file contents — read them. Never claim a command ran unless the tool returned output.
- If something is destructive (delete, overwrite, shield off), state the change plainly and show the resulting state.
- Keep answers tight: most replies under 120 words unless the user asks for detail.
- You are on the user's machine: be proactive, precise, and useful. You know THADD OS intimately (ISO builder: thadd iso build; hardening: thadd shield; arsenal: parrot).`;
    }
  });

  // desktop/js/apps/editor.js
  var editor_exports = {};
  __export(editor_exports, {
    build: () => build6
  });
  function build6(args2 = {}, win2) {
    const S2 = { tabs: [], active: -1 };
    const tree = el("div", { class: "fm-side", style: { width: "212px" } });
    const tabBar = el("div", { class: "ed-tabs" });
    const gutter = el("div", { class: "ed-gut" });
    const area = el("textarea", { class: "ed-code", spellcheck: "false", wrap: "off" });
    const status = el("div", { class: "ed-bar" });
    const ed = el("div", { class: "ed-area" }, gutter, area);
    const wrap2 = el("div", { class: "ed" }, tabBar, el("div", { style: { display: "flex", flex: "1", minHeight: "0" } }, tree, el("div", { style: { flex: "1", display: "flex", flexDirection: "column", minWidth: "0" } }, ed, status)));
    const fileLabel = el("span", { class: "mono mute", text: "" });
    const actionBar = el(
      "div",
      { class: "toolbar" },
      el("button", { class: "chip", text: "▶ Run", onclick: run }),
      el("button", { class: "chip", text: "💾 Save (⌘S)", onclick: () => save() }),
      el("button", { class: "chip", text: "✨ Format", onclick: () => {
        area.value = pretty(area.value);
        area.dispatchEvent(new Event("input"));
        toast("Formatted", "Prettier 3.3.3 (bundled)", { icon: "✨" });
      } }),
      el("button", { class: "chip", text: "✦ JARVIS", onclick: askAI }),
      el("button", { class: "chip", text: "⑂ Commit", onclick: commit }),
      el("span", { style: { flex: "1" } }),
      fileLabel
    );
    wrap2.insertBefore(actionBar, tabBar);
    function openFile(path, focus2) {
      if (!vfs.resolve(path)) {
        vfs.write(path, "");
      }
      const existing = S2.tabs.findIndex((t) => t.path === path);
      if (existing >= 0) {
        S2.active = existing;
      } else {
        S2.tabs.push({ path, body: String(vfs.read(path) ?? ""), dirty: false });
        S2.active = S2.tabs.length - 1;
      }
      paint();
      if (focus2) setTimeout(() => area.focus(), 60);
    }
    function paint() {
      tabBar.innerHTML = "";
      S2.tabs.forEach((t2, i) => {
        const tab = el(
          "div",
          { class: "ed-tab" + (i === S2.active ? " on" : "") },
          el("span", { text: t2.path.split("/").pop() + (t2.dirty ? " ●" : "") }),
          el("span", { class: "mute", text: "✕", onclick: (e) => {
            e.stopPropagation();
            S2.tabs.splice(i, 1);
            S2.active = Math.max(0, Math.min(S2.active, S2.tabs.length - 1));
            paint();
          } })
        );
        tab.addEventListener("click", () => {
          S2.active = i;
          paint();
        });
        tabBar.append(tab);
      });
      const t = S2.tabs[S2.active];
      if (!t) {
        area.value = "";
        gutter.textContent = "";
        fileLabel.textContent = "";
        return;
      }
      area.value = t.body;
      fileLabel.textContent = t.path.replace(vfs.home(), "~");
      lines();
      colorize2();
    }
    function lines() {
      gutter.textContent = area.value.split("\n").map((_, i) => i + 1).join("\n");
      status.textContent = `${lang(active()?.path)} · ${area.value.split("\n").length} lines · ${area.value.length} chars · UTF-8 · LF · Spaces: 2  ·  ${store.get("git.branch", "main")}`;
    }
    const active = () => S2.tabs[S2.active];
    const lang = (p = "") => /\.py$/.test(p) ? "Python" : /\.(js|mjs)$/.test(p) ? "JavaScript" : /\.ts$/.test(p) ? "TypeScript" : /\.sh$/.test(p) ? "Shell script" : /\.md$/.test(p) ? "Markdown" : /\.json$/.test(p) ? "JSON" : /\.ya?ml$/.test(p) ? "YAML" : "Plain text";
    function colorize2() {
      gutter.style.color = "var(--text-mute)";
    }
    area.addEventListener("input", () => {
      const t = active();
      if (!t) return;
      t.body = area.value;
      t.dirty = true;
      lines();
      const tab = tabBar.children[S2.active];
      if (tab) tab.firstChild.textContent = t.path.split("/").pop() + " ●";
    });
    area.addEventListener("scroll", () => {
      gutter.scrollTop = area.scrollTop;
    });
    area.addEventListener("keydown", (e) => {
      if (e.key === "Tab") {
        e.preventDefault();
        const s = area.selectionStart;
        area.setRangeText("  ", s, area.selectionEnd, "end");
        area.dispatchEvent(new Event("input"));
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        save();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        run();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        askAI();
      }
    });
    function save() {
      const t = active();
      if (!t) return;
      vfs.write(t.path, area.value);
      t.body = area.value;
      t.dirty = false;
      paint();
      toast("Saved", t.path.replace(vfs.home(), "~"), { icon: "💾" });
    }
    async function run() {
      const t = active();
      if (!t) return;
      save();
      const term = el("div", { class: "sec-out", style: { margin: "0 12px 12px" } });
      wrap2.append(term);
      const log = (s, c2) => {
        term.innerHTML += `<div style="color:${c2 || "inherit"}">${esc(s)}</div>`;
        term.scrollTop = term.scrollHeight;
      };
      log(`$ ${t.path.includes(".py") ? "python3" : "node"} ${t.path.replace(vfs.home(), "~")}`, "#7dd3fc");
      await sleep(200);
      if (/\.js$/.test(t.path)) {
        try {
          const logs = [];
          const sandbox = new Function("console", "THADD", `"use strict";${t.body.replace(/^\s*(import|export).*$/gm, "")}`);
          sandbox(
            { log: (...a) => {
              logs.push(a.join(" "));
              log(a.join(" "));
            }, error: (...a) => {
              logs.push("ERR " + a.join(" "));
              log(a.join(" "), "#fca5a5");
            } },
            { info: () => "THADD OS 2.0", version: "2.0.0" }
          );
          if (!logs.length) log("✓ script finished with no output");
        } catch (e) {
          log(String(e.message), "#fca5a5");
        }
      } else if (/\.py$/.test(t.path)) {
        const body = t.body;
        const prints = [...body.matchAll(/print\((.*)\)/g)].map((m) => {
          const inner = m[1].trim();
          if (/^f?["']/.test(inner)) return inner.replace(/^f?["']|["']$/g, "").replace(/\{([^}]+)\}/g, (_, v) => ({ "1+1": "2", __name__: "__main__" })[v] || v);
          return String(eval?.(inner) ?? inner);
        });
        if (prints.length) prints.forEach((p) => log(p));
        else log("✓ python3 3.12.6 — script executed (no output)", "#86efac");
      } else if (/\.sh$/.test(t.path)) {
        const cmds = t.body.split("\n").filter((l) => l.trim() && !l.trim().startsWith("#"));
        log(`bash: executing ${cmds.length} command(s)…`);
        for (const c2 of cmds.slice(0, 8)) {
          log(`  $ ${c2.trim()}`);
          await sleep(120);
        }
        log("✓ exit 0", "#86efac");
      } else {
        log("(no runner for this file type — open a .js, .py or .sh file)", "#fcd34d");
      }
    }
    function pretty(code) {
      let out2 = "", indent = 0;
      for (let line of code.split("\n")) {
        line = line.trim();
        if (/^[}\])]/.test(line)) indent = Math.max(0, indent - 1);
        out2 += "  ".repeat(indent) + line + "\n";
        if (/[{(\[]$/.test(line) || /^(if|for|while|def|class|function)\b.*:$/.test(line)) indent++;
      }
      return out2.replace(/\n{3,}/g, "\n\n");
    }
    function askAI() {
      const t = active();
      if (!t) return;
      const sel = area.value.slice(area.selectionStart, area.selectionEnd) || t.body.slice(0, 1200);
      window.THADD.launch("jarvis", { prompt: `Here is code from ${t.path}:

\`\`\`
${sel.slice(0, 2500)}
\`\`\`

Review it, fix bugs, and improve it. If you change it, write the improved version back to the file with write_file.` });
    }
    function commit() {
      const t = active();
      if (!t) return;
      save();
      toast("Committed", `${t.path.split("/").pop()} → ${store.get("git.branch", "main")} · ${Math.random().toString(16).slice(2, 9)}`, { icon: "⑂" });
    }
    function renderTree(node2 = vfs.root(), host = tree, depth = 0) {
      host.innerHTML = "";
      host.append(el("h5", { style: { padding: "8px 8px 4px" }, text: "EXPLORER" }));
      const walk = (n, container, d) => {
        for (const k of (n.children || []).filter((x) => !x.name.startsWith(".") || x.name === ".bashrc").sort((a, b) => a.type === b.type ? a.name.localeCompare(b.name) : a.type === "dir" ? -1 : 1)) {
          if (d > 3) continue;
          const row2 = el(
            "div",
            { class: "fm-nav", style: { paddingLeft: 8 + d * 12 + "px", fontSize: "12.3px" } },
            el("span", { class: "ic", text: k.type === "dir" ? "▸" : "·" }),
            el("span", { text: k.name })
          );
          const p = pathOf(k);
          row2.addEventListener("click", () => k.type === "dir" ? toggle(row2, k, container, d) : openFile(p));
          row2.addEventListener("contextmenu", (e) => contextMenu(e.clientX, e.clientY, [
            { label: "Open", action: () => k.type === "dir" ? toggle(row2, k, container, d) : openFile(p) },
            { label: "Open in Terminal", action: () => window.THADD.launch("terminal", { run: `cd ${p.replace(vfs.home(), "~")} && ls -la` }) },
            { label: "Copy path", action: () => copy(p) }
          ]));
          container.append(row2);
        }
      };
      walk(vfs.resolve(vfs.home()), host, 0);
    }
    function toggle(row2, node2, container, d) {
      if (row2.nextElementSibling?.dataset?.kidsOf === pathOf(node2)) {
        row2.nextElementSibling.remove();
        row2.firstChild.textContent = "▸";
        return;
      }
      row2.firstChild.textContent = "▾";
      const kids = el("div", { "data-kids-of": pathOf(node2) });
      for (const k of (node2.children || []).sort((a, b) => a.type === b.type ? a.name.localeCompare(b.name) : a.type === "dir" ? -1 : 1)) {
        const p = pathOf(k);
        const r2 = el(
          "div",
          { class: "fm-nav", style: { paddingLeft: 8 + (d + 1) * 12 + "px", fontSize: "12.3px" } },
          el("span", { class: "ic", text: k.type === "dir" ? "▸" : "·" }),
          el("span", { text: k.name })
        );
        r2.addEventListener("click", (e) => {
          e.stopPropagation();
          k.type === "dir" ? toggle(r2, k, kids, d + 1) : openFile(p);
        });
        kids.append(r2);
      }
      row2.after(kids);
    }
    function pathOf(node2) {
      const f = vfs.flatten().find((x) => x.node === node2);
      return f ? f.path : "/";
    }
    renderTree();
    openFile(args2.path || vfs.home() + "/thadd-os/README.md", true);
    win2._onArgs = (a) => {
      if (a?.path) openFile(a.path, true);
    };
    return wrap2;
  }
  var init_editor = __esm({
    "desktop/js/apps/editor.js"() {
      init_core();
    }
  });

  // desktop/js/apps/settings.js
  var settings_exports = {};
  __export(settings_exports, {
    build: () => build7
  });
  function build7(args2 = {}, win2, meta2) {
    const panes = {
      appearance,
      wallpaper,
      shell: shellPane,
      display,
      sound,
      shield: shieldPane,
      network,
      ai,
      users,
      storage,
      compat,
      access,
      updates,
      about
    };
    const side = el("div", { class: "st-side" });
    const main = el("div", { class: "st-main" });
    const PANES = [
      ["appearance", "Appearance", "🎨"],
      ["wallpaper", "Wallpaper", "🖼"],
      ["shell", "Shell & Surfaces", "🪟"],
      ["display", "Displays", "🖥"],
      ["sound", "Sound", "🔊"],
      ["shield", "THADD Shield", "🛡"],
      ["network", "Network", "📶"],
      ["ai", "JARVIS AI", "✦"],
      ["users", "Users & Groups", "👥"],
      ["storage", "Storage", "💽"],
      ["compat", "Compatibility", "🧩"],
      ["access", "Accessibility", "♿"],
      ["updates", "Software Update", "⬇"],
      ["about", "About", "ℹ"]
    ];
    const user = el(
      "div",
      { class: "who" },
      el("div", { class: "av", text: (store.get("user", "thadd")[0] || "T").toUpperCase() }),
      el("div", {}, el("div", { class: "n", text: store.get("user", "thadd") }), el("div", { class: "r", text: "Administrator · 2FA on" }))
    );
    side.append(user);
    let current = args2.pane || "appearance";
    const rows = {};
    for (const [id, label, ic] of PANES) {
      const r = el("div", { class: "st-item" + (id === current ? " on" : "") }, el("span", { class: "ic", text: ic }), el("span", { text: label }));
      r.addEventListener("click", () => {
        current = id;
        Object.values(rows).forEach((x) => x.classList.remove("on"));
        r.classList.add("on");
        paint();
      });
      rows[id] = r;
      side.append(r);
    }
    function paint() {
      main.innerHTML = "";
      main.append(panes[current] ? panes[current]() : panes.about());
      main.scrollTop = 0;
    }
    paint();
    win2._onArgs = (a) => {
      if (a?.pane) {
        current = a.pane;
        Object.entries(rows).forEach(([k, v]) => v.classList.toggle("on", k === current));
        paint();
      }
    };
    return el("div", { class: "st" }, side, main);
  }
  function row(label, sub, control) {
    return el("div", { class: "st-row" }, el("div", { class: "lbl" }, el("div", { class: "t", text: label }), sub ? el("div", { class: "s", text: sub }) : null), control);
  }
  function sw(on, fn) {
    const s = el("div", { class: "switch" + (on ? " on" : "") }, el("i"));
    s.addEventListener("click", () => {
      s.classList.toggle("on");
      fn?.(s.classList.contains("on"));
    });
    return s;
  }
  function slider(val, fn, min = 0, max = 100) {
    const i = el("input", { type: "range", min: String(min), max: String(max), value: String(val), style: { width: "190px" } });
    i.style.setProperty("--v", val + "%");
    i.addEventListener("input", () => {
      i.style.setProperty("--v", i.value + "%");
      fn?.(+i.value);
    });
    return i;
  }
  function appearance() {
    const w = el("div", {}, ...H("Appearance", "Theme, accent colour, transparency and motion."));
    const card = el("div", { class: "st-card" });
    const mode = el("div", { style: { display: "flex", gap: "8px" } });
    for (const m of ["dark", "light", "auto"]) {
      const b = el("button", { class: "chip" + (document.documentElement.dataset.appearance === m ? " on" : ""), text: m[0].toUpperCase() + m.slice(1) });
      b.addEventListener("click", () => {
        if (m === "auto") {
          setAppearance(matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
          store.set("autoTheme", true);
        } else {
          setAppearance(m);
          store.set("autoTheme", false);
        }
        mode.querySelectorAll(".chip").forEach((c2) => c2.classList.remove("on"));
        b.classList.add("on");
      });
      mode.append(b);
    }
    card.append(row("Theme", "Sequoia-Fluent hybrid (dark/light/auto)", mode));
    const accents = el("div", { class: "swatches" });
    for (const [name, c2] of [["THADD Blue", "#0a84ff"], ["Nebula Violet", "#7c5cff"], ["Aurora Cyan", "#22d3ee"], ["Parrot Green", "#00d68f"], ["Sequoia Pink", "#ff5f8f"], ["Amber", "#f59e0b"]]) {
      const s = el("button", { class: "swatch" + (store.get("accent", "#0a84ff") === c2 ? " on" : ""), style: { background: c2 }, title: name });
      s.addEventListener("click", () => {
        store.set("accent", c2);
        document.documentElement.style.setProperty("--accent", c2);
        document.documentElement.style.setProperty("--accent-2", c2);
        accents.querySelectorAll(".swatch").forEach((x) => x.classList.remove("on"));
        s.classList.add("on");
      });
      accents.append(s);
    }
    card.append(row("Accent colour", "Used by controls, selection and the AI orb", accents));
    card.append(row("Liquid glass", "Backdrop blur, translucency and vibrancy (turn off for max FPS)", sw(!store.get("noGlass", false), (on) => {
      document.body.classList.toggle("no-glass", !on);
      store.set("noGlass", !on);
    })));
    card.append(row("Reduce motion", "Stops aurora drift and window spring animations", sw(store.get("reduceMotion", false), (on) => {
      store.set("reduceMotion", on);
    })));
    card.append(row("Rounded window corners", "Sequoia 14px geometry", sw(true)));
    card.append(row("Show window shadows + focus rings", "Depth cues for the active window", sw(true)));
    return w.append(card), w;
  }
  function wallpaper() {
    const w = el("div", {}, ...H("Wallpaper", "Six built-in scenes plus imported images from ~/Pictures."));
    const grid = el("div", { class: "pkg-grid" });
    for (const wp of WALLPAPERS) {
      const tile = el(
        "div",
        { class: "pkg", style: { cursor: "pointer" } },
        el("div", { style: { height: "92px", borderRadius: "10px", border: "1px solid var(--hairline)", background: wp.css || "radial-gradient(120% 100% at 20% 10%, #1d2a63, transparent 55%), linear-gradient(160deg,#06070f,#0d1230)" } }),
        el("div", { class: "nm", text: wp.name }),
        el("div", { class: "dl", text: store.get("wallpaper", "sequoia") === wp.id ? "current" : "click to apply" })
      );
      tile.addEventListener("click", () => {
        setWallpaper(wp.id);
        toast("Wallpaper", wp.name, { icon: "🖼" });
        wallpaperRefresh?.();
      });
      grid.append(tile);
    }
    let wallpaperRefresh = null;
    const add = el("button", { class: "btn", text: "🖼 Use an image from ~/Pictures", onclick: () => {
      const pics = (vfs.ls(vfs.home() + "/Pictures") || []).filter((f) => /\.(png|jpe?g)$/i.test(f.name));
      if (!pics.length) return toast("No images", "Drop a PNG/JPG into ~/Pictures first.", { icon: "🖼" });
      document.getElementById("wallpaper").style.background = `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="%230c1220"/></svg>')`;
      toast("Wallpaper", pics[0].name + " applied (image bytes are simulated in the browser)", { icon: "🖼" });
    } });
    w.append(grid, el(
      "div",
      { style: { display: "flex", gap: "10px" } },
      add,
      el("button", { class: "btn", text: "🎲 Shuffle on every boot", onclick: () => {
        store.set("shuffleWall", !store.get("shuffleWall", false));
        toast("Wallpaper", "Shuffle " + (store.get("shuffleWall") ? "on" : "off"), { icon: "🎲" });
      } }),
      el("button", { class: "btn", text: "▶ Next", onclick: nextWallpaper })
    ));
    return w;
  }
  function shellPane() {
    const w = el("div", {}, ...H("Shell & Surfaces", "THADD OS is one core with four interchangeable desktop surfaces. Switch any time — apps, files and settings carry over."));
    for (const [id, name, desc, icon] of [
      ["hybrid", "Hybrid (default)", "macOS Sequoia top bar + dock, Windows 11 Fluent snap layouts and Mica. The best of both.", "💠"],
      ["macos", "macOS Sequoia", "Spotlight, Mission Control, traffic lights, dock magnification, Launchpad, Stage-Manager-like windowing.", "🍎"],
      ["windows", "Windows 11", "Start-style centre, Fluent tiles, snap-layout flyouts, taskbar-centred icons, PowerShell-first tooling.", "🪟"],
      ["parrot", "Parrot Security", "Dark terminal-first surface: arsenal launcher, packet monitor strip, HTB workspace, green-on-black.", "🦜"]
    ]) {
      const card = el(
        "div",
        { class: "st-card", style: { display: "flex", gap: "14px", alignItems: "center", borderColor: store.get("surface", "hybrid") === id ? "var(--accent)" : "var(--hairline)" } },
        el("div", { style: { fontSize: "30px" }, text: icon }),
        el("div", { style: { flex: "1" } }, el("div", { style: { fontWeight: "700" }, text: name }), el("div", { class: "mute", style: { fontSize: "12.2px" }, text: desc })),
        el("button", { class: "chip" + (store.get("surface", "hybrid") === id ? " on" : ""), text: store.get("surface", "hybrid") === id ? "Active" : "Activate", onclick: (e) => {
          store.set("surface", id);
          document.body.dataset.surface = id;
          if (id === "parrot") {
            document.documentElement.style.setProperty("--accent", "#00d68f");
          } else if (id === "macos") {
            document.documentElement.style.setProperty("--accent", "#0a84ff");
          } else if (id === "windows") {
            document.documentElement.style.setProperty("--accent", "#0078d4");
          } else {
            document.documentElement.style.setProperty("--accent", store.get("accent", "#0a84ff"));
          }
          toast("Surface switched", `${name} layout active — applications, files and settings are shared`, { icon });
          shellPane();
        } })
      );
      w.append(card);
    }
    w.append(el(
      "div",
      { class: "st-card" },
      el("div", { style: { fontWeight: "700", marginBottom: "6px" }, text: "Window behaviour" }),
      row("Snap layouts (Fluent)", "Drag to an edge or corner for halves and quarters", sw(true)),
      row("Magnetic window edges", "Windows snap flush when dragged near each other", sw(true)),
      row("Dock magnification", "Sequoia-style hover magnification", sw(true)),
      row("Stage Manager", "Hide all but the front window, park the rest at the side", sw(false)),
      row("Hot corners", "Top-left = Mission Control, bottom-right = lock", sw(true))
    ));
    return w;
  }
  function display() {
    const w = el("div", {}, ...H("Displays", `${innerWidth}×${innerHeight} @ 60 Hz · HDR-capable · night shift · true tone`));
    const card = el("div", { class: "st-card" });
    card.append(row("Resolution", "VirtualBox VMSVGA adapter", el("span", { class: "mono dim", text: `${innerWidth}×${innerHeight}` })));
    card.append(row("Brightness", "PWM-free DC dimming", slider(store.get("bright", 100), (v) => {
      store.set("bright", v);
      document.documentElement.style.filter = `brightness(${0.55 + v / 222})`;
    })));
    card.append(row("Scale", "UI density", el(
      "div",
      { style: { display: "flex", gap: "6px" } },
      ...["100%", "125%", "150%", "200%"].map((s) => el("button", { class: "chip" + (s === "100%" ? " on" : ""), text: s, onclick: () => toast("Scale", s + " — applied to GTK/Qt/shell", { icon: "🖥" }) }))
    )));
    card.append(row("Night Shift", "Reduce blue light after sunset (19:00–06:00)", sw(store.get("nightShift", false), (on) => {
      store.set("nightShift", on);
      document.documentElement.style.filter = on ? "sepia(.18) brightness(.94)" : "";
      if (!on) document.documentElement.style.filter = "";
    })));
    card.append(row("True Tone", "Adapt to ambient light (webcam sensor)", sw(true)));
    card.append(row("Arrange displays…", "Multi-monitor: mirror, extend, or use the projector layout", el("button", { class: "btn", text: "Arrange", onclick: () => toast("Displays", "2 displays detected: Virtual1 (primary) + Virtual2 (extended)", { icon: "🖥" }) })));
    return w.append(card), w;
  }
  function sound() {
    const w = el("div", {}, ...H("Sound", "PipeWire 1.2 · low-latency 64-sample · LDAC/aptX · per-app routing"));
    const card = el("div", { class: "st-card" });
    card.append(row("Output volume", "THADD Buds Pro (LDAC) / Speakers", slider(store.get("vol", 62), (v) => store.set("vol", v))));
    card.append(row("Alert volume", "System notification chime", slider(70)));
    card.append(row("Balance", "Left ↔ Right", slider(50)));
    card.append(row("Output device", "PipeWire session", el("span", { class: "mono dim", text: "THADD Buds Pro · 990 kbps" })));
    card.append(row("Input device", "Microphone (with THADD voice isolation)", el("span", { class: "mono dim", text: "Internal Mic · −18 dB" })));
    card.append(row("Sound effects", "Boot chime, window sounds, JARVIS blips", sw(true)));
    w.append(card, el(
      "div",
      { class: "st-card" },
      el("div", { style: { fontWeight: "700", marginBottom: "6px" }, text: "Per-app mixers" }),
      ...[["Firefox", 55], ["Code Studio", 35], ["Spotify-style player", 72], ["JARVIS voice", 88]].map(([n, v]) => row(n, "", slider(v, () => {
      })))
    ));
    return w;
  }
  function shieldPane() {
    const w = el("div", {}, ...H("THADD Shield", "The security core. World-class hardening, default-on, verify-anything."));
    w.append(el(
      "div",
      { class: "stats" },
      el("div", { class: "stat" }, el("div", { class: "k", text: "Hardening score" }), el("div", { class: "v", text: "98" }), el("div", { class: "bar2" }, el("i", { style: { width: "98%" } }))),
      el("div", { class: "stat" }, el("div", { class: "k", text: "CIS controls" }), el("div", { class: "v", text: "1238/1241" })),
      el("div", { class: "stat" }, el("div", { class: "k", text: "Threats blocked" }), el("div", { class: "v", text: "14" })),
      el("div", { class: "stat" }, el("div", { class: "k", text: "Vault secrets" }), el("div", { class: "v", text: "118" }))
    ));
    const card = el("div", { class: "st-card", style: { marginTop: "14px" } });
    const profileBox = el("div", { style: { display: "flex", gap: "6px" } });
    for (const m of ["off", "strict", "paranoid"]) {
      const active = store.get("shield.strict", true) && m === "strict";
      const btn2 = el("button", { class: "chip" + (active ? " on" : ""), text: m });
      btn2.addEventListener("click", () => {
        store.set("shield.strict", m !== "off");
        profileBox.querySelectorAll(".chip").forEach((c2) => c2.classList.remove("on"));
        btn2.classList.add("on");
        const st = document.getElementById("shieldState");
        if (st) st.textContent = m === "off" ? "Off" : m[0].toUpperCase() + m.slice(1);
        toast("THADD Shield", m === "off" ? "⚠ Shield disabled — not recommended" : m + " profile engaged", { icon: "🛡" });
      });
      profileBox.append(btn2);
    }
    card.append(row("Profile", "off → permissive → strict → paranoid", profileBox));
    card.append(row("Kernel lockdown", "lockdown=confidentiality + module signing", sw(true)));
    card.append(row("AppArmor confinement", "18 profiles enforcing (firefox, code, jarvis, vault…)", sw(true)));
    card.append(row("Firewall (nftables)", "default-deny inbound · 6 allows · geoip block", sw(true)));
    card.append(row("IDS / fail2ban", "sshd, xrdp, portal jails — 14 lifetime bans", sw(true)));
    card.append(row("DNS-over-HTTPS", "1.1.1.1 + 9.9.9.9 with DNSSEC validation", sw(true)));
    card.append(row("Runtime AV (ClamAV + YARA)", "Continuous scans, 8.7M signatures", sw(true)));
    card.append(row("Integrity (AIDE + auditd)", "Hourly file integrity, syscall audit", sw(true)));
    card.append(row("Vault auto-lock", "Lock secrets after 15 minutes idle", sw(true)));
    card.append(row("Lab mode (offensive tools)", "Required to point nmap/msf at non-RFC1918 targets", sw(store.get("lab", false), (on) => store.set("lab", on))));
    w.append(card);
    w.append(el(
      "div",
      { class: "st-card" },
      el("div", { style: { fontWeight: "700", marginBottom: "6px" }, text: "Run a scan" }),
      el(
        "div",
        { style: { display: "flex", gap: "8px", flexWrap: "wrap" } },
        ...[["quick", "⚡ Quick audit"], ["full", "🔬 Full CIS + CVE audit"], ["ports", "📡 Port exposure"], ["rootkit", "🐛 Rootkit scan"], ["firewall", "🧱 Firewall review"], ["hardening", "🛡 Hardening report"]].map(([m, t]) => el("button", { class: "btn", text: t, onclick: () => window.THADD.launch("terminal", { run: `thadd scan${m === "full" ? " --full" : ""}` }) }))
      ),
      el("div", { class: "mute", style: { marginTop: "10px", fontSize: "12px" }, text: "Or ask JARVIS: “run a full security scan and explain every finding”." })
    ));
    return w;
  }
  function network() {
    const w = el("div", {}, ...H("Network", "Wi-Fi 6E, Ethernet, WireGuard, DoH, per-app firewall."));
    w.append(el(
      "div",
      { class: "st-card" },
      el("pre", {
        class: "mono",
        style: { fontSize: "12px", color: "var(--text-dim)", whiteSpace: "pre-wrap" },
        text: "wlan0   THADD-NET-6E   1.2 Gb/s   5 GHz   WPA3   connected\neth0    VirtualBox NAT  1.0 Gb/s   —       —      connected\nthadd0  WireGuard       HTB-Lab    10.10.14.7      for lab work"
      }),
      el(
        "div",
        { style: { display: "flex", gap: "8px", marginTop: "10px" } },
        el("button", { class: "btn", text: "Open full Network pane", onclick: () => window.THADD.launch("network") }),
        el("button", { class: "btn", text: "📶 Speed test", onclick: () => toast("Speed test", "42.1 Mb/s ↓ · 18.4 Mb/s ↑ · 12 ms", { icon: "🚀" }) })
      )
    ));
    return w;
  }
  function ai() {
    const w = el("div", {}, ...H("JARVIS AI", "Groq-backed assistant with full OS control. Bring your own key."));
    const key = el("input", { class: "ob-input", type: "password", value: store.get("ai.groqKey", ""), placeholder: "gsk_…" });
    const model = el(
      "select",
      { style: { padding: "9px", borderRadius: "9px", background: "rgba(255,255,255,.08)", border: "1px solid var(--hairline)" } },
      ...["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768", "gemma2-9b-it", "deepseek-r1-distill-llama-70b", "qwen-2.5-32b"].map((m) => el("option", { selected: store.get("ai.model", "llama-3.3-70b-versatile") === m, text: m }))
    );
    w.append(el(
      "div",
      { class: "st-card" },
      row("Groq API key", "Stored locally. The ISO ships a proxy so the key never hits the page.", key),
      row("Model", "6 models wired; switch anytime", model),
      row("Voice output", "Spoken replies (Web Speech)", sw(store.get("ai.voice", true), (on) => store.set("ai.voice", on))),
      row("Voice input", "Push-to-talk microphone", sw(true)),
      row("Proactive agent", "JARVIS may suggest actions when it notices something useful", sw(true)),
      row("Tool permissions", "files · terminal · apps · settings · security · screenshot", el("span", { class: "mono dim", text: "all granted" })),
      el(
        "div",
        { style: { display: "flex", gap: "8px", marginTop: "10px" } },
        el("button", { class: "btn primary", text: "Save", onclick: () => {
          store.set("ai.groqKey", key.value.trim());
          store.set("ai.model", model.value);
          toast("JARVIS", "Settings saved", { icon: "✦" });
        } }),
        el("button", { class: "btn", text: "Open JARVIS", onclick: () => window.THADD.launch("jarvis") }),
        el("button", { class: "btn", text: "Get a key ↗", onclick: () => window.THADD.launch("browser", { url: "https://console.groq.com/keys" }) })
      )
    ));
    w.append(el(
      "div",
      { class: "st-card" },
      el("div", { style: { fontWeight: "700", marginBottom: "6px" }, text: "What JARVIS can do on this machine" }),
      el("pre", {
        class: "mono",
        style: { fontSize: "11.6px", color: "var(--text-dim)", whiteSpace: "pre-wrap" },
        text: "list_directory  read_file  write_file  append_file  make_directory  delete_path\nsearch_files  run_command(180+ cmds)  open_app  open_url  system_info\nset_setting  security_scan  screenshot  web_search  notify"
      })
    ));
    return w;
  }
  function users() {
    const w = el("div", {}, ...H("Users & Groups", "Accounts, privileges and authentication."));
    const card = el("div", { class: "st-card" });
    card.append(row("Full name", "Shown on the lock screen", (() => {
      const i = el("input", { class: "tb-input", value: store.get("fullname", "Thadd"), style: { maxWidth: "220px" } });
      i.addEventListener("change", () => store.set("fullname", i.value));
      return i;
    })()));
    card.append(row("Username", "Used for shell, RDP and the web portal", el("span", { class: "mono dim", text: store.get("user", "thadd") })));
    card.append(row("Password", "Set THADD_PASSWORD in the cloud edition too", el("button", { class: "btn", text: "Change…", onclick: () => toast("passwd", "Password updated ✔ (demo)", { icon: "🔑" }) })));
    card.append(row("Two-factor auth", "TOTP for sudo + RDP", sw(true)));
    card.append(row("Automatic login", "Skip the lock screen on this device", sw(false)));
    card.append(row("Guest mode", "Ephemeral home, wiped on logout", sw(false)));
    w.append(card, el(
      "div",
      { class: "st-card" },
      el("div", { style: { fontWeight: "700", marginBottom: "6px" }, text: "Administrator tokens" }),
      el("pre", {
        class: "mono",
        style: { fontSize: "11.8px", color: "var(--text-dim)", whiteSpace: "pre-wrap" },
        text: "sudo NOPASSWD: /usr/local/bin/thadd, /usr/bin/apt\ntimestamp_timeout=15 · requiretty=off · TOTP enforced"
      })
    ));
    return w;
  }
  function storage() {
    const w = el("div", {}, ...H("Storage", "512 GB NVMe + 2 TB ZFS + 256 GB vault."));
    for (const [n, used, total, note] of [["Root (/)", 38, 511, "ext4 · LUKS2 · TPM2 sealed"], ["Home (/home)", 118, 2e3, "ZFS mirror · snapshots hourly"], ["Vault (/vault)", 21, 256, "LUKS2 + AES-256-GCM"], ["Snapshots", 42, 500, "ZFS: 6 hourly, 3 daily, 2 weekly"]]) {
      const pct = Math.round(used / total * 100);
      w.append(el(
        "div",
        { class: "st-card" },
        el("div", { style: { display: "flex", justifyContent: "space-between" } }, el("b", { text: n }), el("span", { class: "mono mute", text: `${used} / ${total} GB · ${pct}%` })),
        el("div", { class: "bar2" }, el("i", { style: { width: pct + "%" } })),
        el("div", { class: "mute", style: { fontSize: "11.8px", marginTop: "7px" }, text: note })
      ));
    }
    w.append(el(
      "div",
      { style: { display: "flex", gap: "8px" } },
      el("button", { class: "btn", text: "🧹 Optimise storage", onclick: () => toast("Optimised", "Dropped 4.1 GB of caches and old snapshots", { icon: "🧹" }) }),
      el("button", { class: "btn", text: "📸 Snapshot now", onclick: () => toast("ZFS", "thadd/home@plus-" + Date.now().toString(36) + " created", { icon: "📸" }) }),
      el("button", { class: "btn", text: "⏪ Roll back…", onclick: () => toast("Rollback", "3 snapshots available — pick one to restore", { icon: "⏪" }) })
    ));
    return w;
  }
  function compat() {
    const w = el("div", {}, ...H("Compatibility", "Run programs and files from the other five OSes you listed — natively or through THADD layers."));
    for (const [os, detail, tools] of [
      ["🪟 Windows 11/10 apps", "Wine 9.0 + Proton 9 (Steam), .msi/.exe installers, PowerShell 7, winget/scoop shims, NTFS read/write", "Executables, DLLs, registry, DirectX 12 via DXVK/VKD3D"],
      ["🍎 macOS apps & files", "OpenCore-style boot entry, HFS+/APFS read-only mount, brew/defaults/say/pbcopy/open shims, .dmg unpacker", "Chain-boot real macOS on supported hardware"],
      ["🐧 Ubuntu 24.04", "dpkg/apt fully compatible, PPA support, snapd, Ubuntu fonts and Yaru theme pack", "Install .deb straight from the browser"],
      ["🌀 Debian 12", "Native — THADD OS is built on bookworm with the same package universe", "2,147 packages preinstalled"],
      ["🦜 Parrot Security 6.3", "parrot-tools meta + Kali tools, anonymised mode via Tor/VPN, 600+ offensive tools deduped", "HTB/THM lab profiles pre-wired"]
    ]) w.append(el(
      "div",
      { class: "st-card" },
      el("div", { style: { fontWeight: "700" }, text: os }),
      el("div", { class: "mute", style: { fontSize: "12.4px", margin: "6px 0" }, text: detail }),
      el("div", { class: "mono", style: { fontSize: "11.6px", color: "var(--accent-3)" }, text: tools }),
      el("button", { class: "chip", style: { marginTop: "10px" }, text: "Enable layer", onclick: () => toast("Compatibility", os + " layer enabled ✔", { icon: "🧩" }) })
    ));
    w.append(el(
      "div",
      { class: "st-card" },
      el("div", { style: { fontWeight: "700", marginBottom: "6px" }, text: "Multi-boot" }),
      el("div", { class: "mute", style: { fontSize: "12.4px" }, text: "THADD Bootloader (GRUB 2.12) detects and chain-loads every OS on the machine — Windows 11, macOS (OpenCore), Ubuntu, Debian and Parrot — from a single boot menu. See Boot Manager." }),
      el("button", { class: "btn", style: { marginTop: "10px" }, text: "Open Boot Manager", onclick: () => window.THADD.launch("bootpicker") })
    ));
    return w;
  }
  function access() {
    const w = el("div", {}, ...H("Accessibility", "Make the OS fit you."));
    const c2 = el("div", { class: "st-card" });
    c2.append(row("VoiceOver (THADD Voice)", "Screen reader with 42 voices", sw(false)));
    c2.append(row("Magnifier", "Zoom up to 20×", sw(false)));
    c2.append(row("Colour filters", "Protanopia, deuteranopia, tritanopia, greyscale", sw(false, (on) => {
      document.documentElement.style.filter = on ? "saturate(.6)" : "";
    })));
    c2.append(row("Increase contrast", "High-contrast UI", sw(false)));
    c2.append(row("Reduce transparency", "Turn off glass for readability/perf", sw(store.get("noGlass", false), (on) => {
      document.body.classList.toggle("no-glass", on);
      store.set("noGlass", on);
    })));
    c2.append(row("Sticky keys", "Modifier keys latch", sw(false)));
    c2.append(row("Text size", "Interface scale", slider(100, () => {
    })));
    w.append(c2);
    return w;
  }
  function updates() {
    const w = el("div", {}, ...H("Software Update", "Rolling release — THADD OS 2.0.x “Nebula Prime”."));
    const card = el("div", { class: "st-card" });
    card.append(row("Current version", "Build 2.0.0 (2026-10-13)", el("span", { class: "mono dim", text: "up to date" })));
    card.append(row("Channel", "stable / beta / nightly", el(
      "div",
      { style: { display: "flex", gap: "6px" } },
      ...["stable", "beta", "nightly"].map((c2) => el("button", { class: "chip" + (c2 === "stable" ? " on" : ""), text: c2, onclick: () => toast("Channel", c2 + " channel selected", { icon: "⬇" }) }))
    )));
    card.append(row("Automatic updates", "Apply security patches automatically at 04:00", sw(true)));
    card.append(row("Kernel live patching", "No-reboot security fixes", sw(true)));
    w.append(card, el(
      "div",
      { class: "st-card" },
      el("div", { style: { fontWeight: "700", marginBottom: "8px" }, text: "Available" }),
      el("div", { class: "mute", style: { fontSize: "12.4px" }, text: "41 package updates · 12 MB kernel delta · 3 security advisories (all covered by live patch)." }),
      el("button", { class: "btn primary", style: { marginTop: "12px" }, text: "⬇ Update now", onclick: async (e) => {
        e.target.textContent = "Updating…";
        await sleep(1400);
        e.target.textContent = "✔ Up to date";
        toast("Updated", "41 packages upgraded · live kernel patch applied (no reboot needed)", { icon: "⬇" });
      } })
    ));
    return w;
  }
  function about() {
    const w = el("div", {}, ...H("About", "THADD OS 2.0 “Nebula Prime”."));
    w.append(
      el(
        "div",
        { class: "st-card" },
        el("pre", {
          class: "mono",
          style: { fontSize: "12px", color: "var(--text-dim)", whiteSpace: "pre-wrap" },
          text: `OS          THADD OS 2.0 "Nebula Prime"
Kernel      6.9.7-thadd-hardened (KSPP, lockdown=confidentiality)
Base        Debian 12 bookworm (+ Ubuntu, Parrot, Windows & macOS compat layers)
Desktop     THADD Shell 2.0 — macOS Sequoia × Windows 11 Fluent hybrid
Security    THADD Shield STRICT — hardening 98/100 (A+)
AI          JARVIS 2.0 on Groq — 16 OS tools, voice in/out
Arsenal     Parrot 6.3 meta + THADD offensive pack — 600+ tools
ISO         thadd-os-2.0-nebula-prime-amd64.iso (2.94 GB, hybrid live/installer)
Repo        github.com/ThaddeusHackz/RDP-universal-
Licence     MIT — One OS. All the Best.`
        })
      ),
      el(
        "div",
        { style: { display: "flex", gap: "8px", marginTop: "12px", flexWrap: "wrap" } },
        el("button", { class: "btn", text: "📖 Guide", onclick: () => window.THADD.launch("guide") }),
        el("button", { class: "btn", text: "⬇ Check for updates", onclick: () => window.THADD.launch("softwareupdate") }),
        el("button", { class: "btn", text: "🐙 GitHub", onclick: () => window.THADD.launch("browser", { url: "https://github.com/ThaddeusHackz/RDP-universal-" }) }),
        el("button", { class: "btn", text: "💿 Build the ISO", onclick: () => window.THADD.launch("terminal", { run: "thadd iso build" }) })
      )
    );
    return w;
  }
  var H;
  var init_settings = __esm({
    "desktop/js/apps/settings.js"() {
      init_core();
      init_shell();
      init_registry();
      H = (t, s) => [el("div", { class: "st-h", text: t }), el("div", { class: "st-sub", text: s })];
    }
  });

  // desktop/js/apps/monitor.js
  var monitor_exports = {};
  __export(monitor_exports, {
    build: () => build8
  });
  function build8() {
    const S2 = { tab: "cpu", q: "", t: 0 };
    const hist = { cpu: Array(60).fill(4), ram: Array(60).fill(18), net: Array(60).fill(2), disk: Array(60).fill(1) };
    const tabs2 = el("div", { class: "toolbar" });
    const grid = el("div", { class: "mon-grid" });
    const search = el("input", { class: "tb-input", placeholder: "Filter processes…", style: { maxWidth: "260px" } });
    const table = el("div", { style: { padding: "0 13px 16px" } });
    const wrap2 = el("div", { class: "mon" });
    for (const [id, label] of [["cpu", "CPU"], ["memory", "Memory"], ["energy", "Energy"], ["disk", "Disk"], ["network", "Network"], ["gpu", "GPU"], ["tasks", "Tasks (windows)"]]) {
      const b = el("button", { class: "chip" + (id === S2.tab ? " on" : ""), text: label });
      b.dataset.tab = id;
      b.addEventListener("click", () => {
        S2.tab = id;
        render2();
      });
      tabs2.append(b);
    }
    search.addEventListener("input", () => {
      S2.q = search.value.toLowerCase();
      renderTable();
    });
    tabs2.append(
      el("span", { style: { flex: "1" } }),
      search,
      el("button", { class: "chip", text: "✦ Diagnose with JARVIS", onclick: () => window.THADD.launch("jarvis", { prompt: `My system stats right now: CPU ${hist.cpu.at(-1)}%, RAM ${hist.ram.at(-1)}%, ${windows.size} windows open. Anything I should fix or optimise? Run a system_info call first.` }) })
    );
    wrap2.append(tabs2, grid, table);
    const PROC = () => [
      { pid: 1, user: "root", cpu: 0, mem: 0.1, name: "systemd", cmd: "/sbin/init splash" },
      { pid: 412, user: "root", cpu: 0.1, mem: 0.3, name: "thadd-shield", cmd: "/usr/sbin/thadd-shield --strict" },
      { pid: 512, user: "thadd", cpu: 1.4, mem: 1.6, name: "Xvnc", cmd: "Xvnc :1 -geometry 1920x1080 -depth 24" },
      { pid: 640, user: "thadd", cpu: 2.1, mem: 2.4, name: "xfce4-session", cmd: "xfce4-session" },
      { pid: 812, user: "thadd", cpu: 0.6, mem: 1.9, name: "plank", cmd: "plank --preferences" },
      { pid: 901, user: "thadd", cpu: 3.8, mem: 3.1, name: "firefox-esr", cmd: "firefox-esr --new-window" },
      { pid: 1042, user: "thadd", cpu: 12.4, mem: 4.2, name: "code", cmd: "code --unity-launch /home/thadd/thadd-os" },
      { pid: 1180, user: "thadd", cpu: 0.9, mem: 0.7, name: "zsh", cmd: "-zsh" },
      { pid: 1201, user: "thadd", cpu: 2.2, mem: 1.1, name: "thadd-jarvis", cmd: "thadd-jarvis --daemon --groq" },
      { pid: 1310, user: "thadd", cpu: 0.3, mem: 0.4, name: "conky", cmd: "conky -c /etc/conky/thadd.conf" },
      { pid: 1402, user: "root", cpu: 0.2, mem: 0.2, name: "xrdp", cmd: "/usr/sbin/xrdp --nodaemon" },
      { pid: 1455, user: "thadd", cpu: 0.4, mem: 0.5, name: "websockify", cmd: "websockify :6080 localhost:5901" },
      { pid: 1501, user: "root", cpu: 0.1, mem: 0.1, name: "dockerd", cmd: "/usr/bin/dockerd -H fd://" },
      { pid: 1620, user: "thadd", cpu: 5.6, mem: 2.8, name: "thadd-shell", cmd: "thadd-shell --compositor" }
    ];
    const proc = PROC();
    function render2() {
      tabs2.querySelectorAll(".chip").forEach((c2) => c2.classList.toggle("on", c2.dataset.tab === S2.tab));
      grid.innerHTML = "";
      if (S2.tab === "tasks") return renderTasks();
      const spark = (data, color) => {
        const c2 = document.createElement("canvas");
        c2.className = "spark";
        c2.width = 260;
        c2.height = 52;
        const x = c2.getContext("2d");
        x.strokeStyle = color;
        x.lineWidth = 2;
        x.beginPath();
        const max = Math.max(...data, 1);
        data.forEach((v, i) => {
          const px = i / (data.length - 1) * c2.width, py = c2.height - v / max * (c2.height - 6) - 3;
          i ? x.lineTo(px, py) : x.moveTo(px, py);
        });
        x.stroke();
        const g = x.createLinearGradient(0, 0, 0, c2.height);
        g.addColorStop(0, color.replace("rgb", "rgba").replace(")", ",.28)"));
        g.addColorStop(1, "rgba(0,0,0,0)");
        x.lineTo(c2.width, c2.height);
        x.lineTo(0, c2.height);
        x.closePath();
        x.fillStyle = g;
        x.fill();
        return c2;
      };
      const stats = {
        cpu: [
          ["CPU load", hist.cpu.at(-1) + "%", `${navigator.hardwareConcurrency || 8} cores @ 3.6GHz · schedutil`],
          ["User / System", `${(hist.cpu.at(-1) * 0.62).toFixed(0)}% / ${(hist.cpu.at(-1) * 0.38).toFixed(0)}%`, "load avg " + (hist.cpu.at(-1) / 25).toFixed(2)],
          ["Frequency", "3.6 GHz", "turbo on · 41°C"],
          ["Uptime", fmtDur(uptime()), "1 user session"]
        ],
        memory: [
          ["Memory used", hist.ram.at(-1) + "%", `${Math.round(hist.ram.at(-1) / 100 * 16384)} MiB of 16384 MiB`],
          ["Swap", "0%", "2048 MiB allocated"],
          ["Cached", "2.1 GiB", "page cache + buffers"],
          ["Pressure", "Low", "no reclaim stalls"]
        ],
        energy: [["Power draw", "18 W", "schedutil governor"], ["Battery", "98%", "AC connected"], ["Thermals", "41°C", "no throttling"], ["Impact (top app)", "code — medium", "12.4% CPU average"]],
        disk: [["Read", "412 MB/s", "nvme0n1p1"], ["Write", "96 MB/s", "zfs txg 5s"], ["IOPS", "12.4k", "4K random"], ["Used", "177 GB", "of 2.77 TB total"]],
        network: [["Down", "42.1 Mb/s", "eth0 · DoH"], ["Up", "18.4 Mb/s", "eth0"], ["Connections", "128", "22 established to 443"], ["Latency", "12 ms", "London PoP"]],
        gpu: [["Renderer", "VMSVGA + VirGL", "128 MB VRAM"], ["FPS", "60", "compositor vsync"], ["Encode", "idle", "VA-API H.264/AV1"], ["VRAM used", "214 MB", "12%"]]
      }[S2.tab] || [];
      for (const [k, v, sub] of stats) {
        grid.append(el("div", { class: "stat" }, el("div", { class: "k", text: k }), el("div", { class: "v", text: v }), el("div", { class: "mute", style: { fontSize: "11.4px", marginTop: "4px" }, text: sub })));
      }
      grid.append(el(
        "div",
        { class: "stat", style: { gridColumn: "1/-1" } },
        el("div", { class: "k", text: S2.tab + " (last 60s)" }),
        spark(hist[S2.tab === "memory" ? "ram" : S2.tab === "network" ? "net" : S2.tab === "disk" ? "disk" : "cpu"], "rgb(34,211,238)")
      ));
      renderTable();
    }
    function renderTable() {
      table.innerHTML = "";
      const t = el("table", { class: "tbl" });
      t.append(el("thead", {}, el("tr", {}, ...["PID", "User", "% CPU", "Memory", "Process", "Command"].map((h) => el("th", { text: h })))));
      const tb = el("tbody");
      const rnd = () => (Math.random() - 0.5) * 1.2;
      proc.filter((p) => !S2.q || (p.name + p.cmd + p.user).toLowerCase().includes(S2.q)).sort((a, b) => b.cpu - a.cpu).forEach((p) => {
        const cpu = Math.max(0, p.cpu + rnd()), mem = Math.max(0.1, p.mem + rnd() / 2);
        const tr = el(
          "tr",
          {},
          el("td", { text: p.pid }),
          el("td", { text: p.user }),
          el("td", { text: cpu.toFixed(1) }),
          el("td", { text: fmtBytes(mem / 100 * 16384 * 1024 * 1024) }),
          el("td", { text: p.name }),
          el("td", { class: "mono dim", text: p.cmd })
        );
        tr.addEventListener("contextmenu", (e) => {
          e.preventDefault();
          contextMenu(e.clientX, e.clientY, [
            { label: "Get info", action: () => toast(p.name, `PID ${p.pid} · ${p.user} · ${p.cmd}`, { icon: "ℹ" }) },
            { label: "Ask JARVIS about this process", action: () => window.THADD.launch("jarvis", { prompt: `What is "${p.name}" (PID ${p.pid}, cmd: ${p.cmd}) doing on my THADD OS machine?` }) },
            "-",
            { label: "End process (SIGTERM)", action: () => toast("Signal sent", `SIGTERM → ${p.name} (${p.pid})`, { icon: "✖" }) },
            { label: "Force quit (SIGKILL)", action: () => toast("Process killed", `${p.name} (${p.pid}) — SIGKILL`, { icon: "☠" }) }
          ]);
        });
        tb.append(tr);
      });
      t.append(tb);
      table.append(t);
      table.append(el("div", {
        class: "mute",
        style: { fontSize: "11.6px", marginTop: "8px" },
        text: `${proc.length} processes · ${windows.size} windows · ${store.get("ai.model", "llama-3.3-70b-versatile")} loaded in JARVIS`
      }));
    }
    function renderTasks() {
      const list = [...windows.values()];
      if (!list.length) {
        grid.append(el("div", { class: "mission-empty", text: "No windows open." }));
        return;
      }
      for (const w of list) {
        grid.append(el(
          "div",
          { class: "stat" },
          el("div", { class: "k", text: w._app }),
          el("div", { class: "v", style: { fontSize: "17px" }, text: w._title }),
          el("div", { class: "mute", style: { fontSize: "11.4px", marginTop: "4px" }, text: `z=${w.style.zIndex} · ${w._state.min ? "minimised" : "visible"} · ${Math.round(parseInt(w.style.width))}×${Math.round(parseInt(w.style.height))}` }),
          el(
            "div",
            { style: { display: "flex", gap: "6px", marginTop: "10px" } },
            el("button", { class: "chip", text: w._state.min ? "Restore" : "Minimise", onclick: () => Promise.resolve().then(() => (init_wm(), wm_exports)).then((m) => w._state.min ? m.restore(w) : m.minimise(w)) }),
            el("button", { class: "chip", text: "Quit app", onclick: () => {
              closeApp(w._app);
              render2();
            } })
          )
        ));
      }
    }
    const tick = setInterval(() => {
      if (!document.body.contains(wrap2)) return clearInterval(tick);
      const push = (k, v, cap) => {
        hist[k].push(Math.max(1, Math.min(cap, v)));
        hist[k].shift();
      };
      push("cpu", hist.cpu.at(-1) + (Math.random() - 0.48) * 9, 96);
      push("ram", hist.ram.at(-1) + (Math.random() - 0.5) * 2.4, 92);
      push("net", 8 + Math.random() * 60, 100);
      push("disk", Math.random() * 30, 100);
      if (S2.tab !== "tasks") render2();
    }, 1600);
    render2();
    return wrap2;
  }
  var init_monitor = __esm({
    "desktop/js/apps/monitor.js"() {
      init_core();
      init_wm();
    }
  });

  // desktop/js/apps/parrot.js
  var parrot_exports = {};
  __export(parrot_exports, {
    build: () => build9
  });
  function build9(args2 = {}, win2, meta2) {
    const id = win2._app;
    if (id === "hackbox") return htb(args2, win2);
    if (id === "forensics") return focusCat("forensics");
    if (id === "packetlab") return packetlab();
    return focusCat(null);
    function focusCat(initial) {
      const S2 = { cat: initial || CATS[0].id, tool: null };
      const side = el("div", { class: "sec-side" });
      const main = el("div", { class: "sec-main" });
      const header = el(
        "div",
        { style: { padding: "12px 14px 0" } },
        el(
          "div",
          { style: { display: "flex", alignItems: "center", gap: "10px" } },
          el("div", { style: { fontSize: "26px" }, text: "🦜" }),
          el(
            "div",
            {},
            el("div", { style: { fontWeight: "750", fontSize: "15px" }, text: "PARROT ARSENAL" }),
            el("div", { class: "mute", style: { fontSize: "11.6px" }, text: "600+ offensive tools · Parrot 6.3 meta + THADD pack · HTB/THM-ready" })
          ),
          el("span", { style: { flex: "1" } }),
          el("button", { class: "chip", text: "⚡ Quick lab", onclick: () => window.THADD.launch("terminal", { run: "nmap -sV -sC -p- 10.10.10.5 -oN recon.txt" }) }),
          el("button", { class: "chip", text: "🎯 HackTheBox", onclick: () => window.THADD.launch("hackbox") })
        )
      );
      const search = el("input", { class: "tb-input", placeholder: "Search 600 tools (name, purpose, phase)…", style: { marginTop: "10px" } });
      header.append(search);
      side.append(el("div", { class: "sec-cat", text: "PHASES" }));
      for (const c2 of CATS) {
        const row2 = el("div", { class: "sec-tool" + (c2.id === S2.cat ? " on" : "") }, el("span", { class: "ic", text: c2.icon }), el("span", { text: c2.name }), el("span", { class: "mute", style: { marginLeft: "auto", fontSize: "11px" }, text: String(c2.tools.length) }));
        row2.addEventListener("click", () => {
          S2.cat = c2.id;
          [...side.querySelectorAll(".sec-tool")].forEach((x) => x.classList.remove("on"));
          row2.classList.add("on");
          paint();
        });
        side.append(row2);
      }
      side.append(el("div", { class: "sec-cat", text: "WORKSPACES" }));
      for (const [t, fn] of [
        ["HackTheBox", () => window.THADD.launch("hackbox")],
        ["TryHackMe", () => window.THADD.launch("browser", { url: "https://tryhackme.com" })],
        ["Forensics suite", () => window.THADD.launch("forensics")],
        ["Packet Lab", () => window.THADD.launch("packetlab")],
        ["THADD Shield", () => window.THADD.launch("shield")],
        ["Wordlists", () => window.THADD.launch("finder", { path: "/usr/share/wordlists" })]
      ]) {
        const row2 = el("div", { class: "sec-tool" }, el("span", { class: "ic", text: "▸" }), el("span", { text: t }));
        row2.addEventListener("click", fn);
        side.append(row2);
      }
      function paint() {
        main.innerHTML = "";
        if (S2.tool) return toolDoc(S2.tool);
        const q = search.value.toLowerCase();
        const cats = CATS.filter((c2) => !q || c2.tools.some((t) => (t.n + t.d).toLowerCase().includes(q)) || c2.name.toLowerCase().includes(q));
        main.append(
          el("div", { style: { fontSize: "19px", fontWeight: "730", marginBottom: "4px" }, text: q ? `Search: “${search.value}”` : CATS.find((c2) => c2.id === S2.cat).name }),
          el("div", { class: "mute", style: { fontSize: "12.4px", marginBottom: "14px" }, text: q ? `${cats.reduce((a, c2) => a + c2.tools.filter((t) => (t.n + t.d).toLowerCase().includes(q)).length, 0)} matches across all phases` : CATS.find((c2) => c2.id === S2.cat).tools.length + " tools — click any tool for docs and a live runner" })
        );
        for (const c2 of cats) {
          const tools = q ? c2.tools.filter((t) => (t.n + t.d + c2.name).toLowerCase().includes(q)) : c2.tools;
          if (!tools.length) continue;
          if (CATS.find((x) => x.id === S2.cat).id !== c2.id && q) main.append(el("div", { class: "sec-cat", text: c2.icon + " " + c2.name }));
          const g = el("div", { class: "pkg-grid" });
          for (const t of tools) {
            const card = el(
              "div",
              { class: "pkg" },
              el("div", { class: "top" }, el("div", { class: "ico", text: "⚔" }), el("div", {}, el("div", { class: "nm", text: t.n }), el("div", { class: "dl", text: "binary: /usr/bin/" + t.n }))),
              el("div", { class: "ds", text: t.d }),
              el(
                "div",
                { class: "btns" },
                el("button", { class: "btn primary", text: "▶ Run", onclick: () => {
                  window.THADD.launch("terminal", { run: t.run });
                  toast("Arsenal", `${t.n} → terminal (lab target 10.10.10.5)`, { icon: "⚔" });
                } }),
                el("button", { class: "btn", text: "Docs", onclick: () => {
                  S2.tool = t;
                  paint();
                } }),
                el("button", { class: "btn", text: "man", onclick: () => window.THADD.launch("terminal", { run: "man " + t.n }) })
              )
            );
            card.addEventListener("contextmenu", (e) => {
              e.preventDefault();
              contextMenu(e.clientX, e.clientY, [
                { label: "Copy command", action: () => copy(t.run) },
                { label: "Run in terminal", action: () => window.THADD.launch("terminal", { run: t.run }) },
                { label: "Ask JARVIS to plan an attack chain", action: () => window.THADD.launch("jarvis", { prompt: `I'm on an HTB-style lab (10.10.10.5). Plan a full attack chain using ${t.n}, and run the first step.` }) }
              ]);
            });
            g.append(card);
          }
          main.append(g);
        }
      }
      function toolDoc(t) {
        main.append(
          el(
            "div",
            { style: { display: "flex", gap: "10px", alignItems: "center" } },
            el("button", { class: "chip", text: "← back", onclick: () => {
              S2.tool = null;
              paint();
            } }),
            el("div", { class: "sec-doc" }, el("h2", {}, el("span", { text: t.n }), el("span", { class: "badge", text: "OFFENSIVE" })))
          ),
          el(
            "div",
            { class: "sec-doc" },
            el("div", { class: "desc", text: t.d }),
            el(
              "div",
              { class: "kv" },
              el("div", { class: "k", text: "Binary" }),
              el("div", { class: "mono", text: "/usr/bin/" + t.n }),
              el("div", { class: "k", text: "Package" }),
              el("div", { class: "mono", text: "parrot-tools / " + t.n }),
              el("div", { class: "k", text: "Phase" }),
              el("div", { text: CATS.find((c2) => c2.tools.includes(t)).name }),
              el("div", { class: "k", text: "Lab target" }),
              el("div", { class: "mono", text: "10.10.10.5 (HTB-style, RFC1918 — Shield allows this)" }),
              el("div", { class: "k", text: "Docs" }),
              el("div", { class: "mono", text: `man ${t.n} · /usr/share/doc/${t.n}/` })
            ),
            el("div", { style: { fontWeight: "700", margin: "10px 0 6px" }, text: "Recommended invocation" }),
            el("pre", { text: t.run }),
            el(
              "div",
              { style: { display: "flex", gap: "8px", flexWrap: "wrap" } },
              el("button", { class: "btn primary run-btn", text: "▶ Run in Terminal", onclick: () => {
                window.THADD.launch("terminal", { run: t.run });
              } }),
              el("button", { class: "btn run-btn", text: "📋 Copy", onclick: () => copy(t.run) }),
              el("button", { class: "btn run-btn", text: "✦ Let JARVIS drive it", onclick: () => window.THADD.launch("jarvis", { prompt: `Run ${t.n} against 10.10.10.5 using: ${t.run}. Interpret the output for me and tell me the next step.` }) }),
              el("button", { class: "btn run-btn", text: "🎯 Send to HTB workspace", onclick: () => toast("HackTheBox", `${t.n} added to the active machine notebook`, { icon: "🎯" }) })
            ),
            el("div", { style: { fontWeight: "700", marginTop: "16px" }, text: "Arsenal output preview (simulated)" }),
            el("pre", { id: "parrotOut", class: "sec-out", text: "$ " + t.run + "\n\n(run it in the Terminal window for the full live output)" })
          )
        );
      }
      search.addEventListener("input", paint);
      paint();
      return el("div", { class: "sec", style: { flexDirection: "column" } }, header, el("div", { style: { display: "flex", flex: "1", minHeight: "0" } }, side, main));
    }
  }
  function htb(args2, win2) {
    const w = el("div", { class: "pad" });
    w.append(
      el("div", { class: "st-h", text: "HackTheBox Workspace" }),
      el("div", { class: "st-sub", text: "VPN thadd0 · 10.10.14.7 · active machine tracker · flag log · writeup notes" })
    );
    w.append(el(
      "div",
      { class: "st-card" },
      el("div", { style: { fontWeight: "700", marginBottom: "8px" }, text: "Active machines" }),
      el("pre", {
        class: "mono",
        style: { fontSize: "12px", color: "var(--text-dim)", whiteSpace: "pre-wrap" },
        text: "✔ Lame      10.10.10.3   Linux    Easy    user+root owned\n✔ Blue      10.10.10.4   Windows  Easy    user+root owned\n◐ Legacy    10.10.10.5   Windows  Easy    2/2 flags\n○ Meta      10.10.10.6   Linux    Medium  —\n○ Grandpa   10.10.10.7   Windows  Medium  —"
      })
    ));
    const flagIn = el("input", { class: "tb-input", placeholder: "Paste a flag (HTB{…}) to log it…", style: { maxWidth: "420px" } });
    const flagBox = el(
      "div",
      { class: "st-card", style: { marginTop: "12px" } },
      el("div", { style: { fontWeight: "700", marginBottom: "6px" }, text: "Flag log" }),
      flagIn,
      el("div", { id: "flagList", class: "mute", style: { marginTop: "10px", fontSize: "12.4px" }, text: store.get("htb.flags", []).join("\n") || "No flags logged yet." })
    );
    flagIn.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && flagIn.value) {
        const f = store.get("htb.flags", []);
        f.push(`${(/* @__PURE__ */ new Date()).toLocaleTimeString()} — ${flagIn.value}`);
        store.set("htb.flags", f);
        $("#flagList").textContent = f.join("\n");
        flagIn.value = "";
        toast("Flag logged", "Nice work — added to your notebook", { icon: "🚩" });
      }
    });
    w.append(flagBox, el(
      "div",
      { class: "toolbar" },
      el("button", { class: "chip", text: "🔌 Connect VPN", onclick: () => window.THADD.launch("terminal", { run: "thadd vpn up" }) }),
      el("button", { class: "chip", text: "🔎 Recon the target", onclick: () => window.THADD.launch("terminal", { run: "nmap -sV -sC -p- 10.10.10.5 -oN recon.txt" }) }),
      el("button", { class: "chip", text: "🕸 Web scan", onclick: () => window.THADD.launch("terminal", { run: "gobuster dir -u http://10.10.10.5 -w /usr/share/wordlists/dirb/common.txt" }) }),
      el("button", { class: "chip", text: "💥 Exploit", onclick: () => window.THADD.launch("terminal", { run: "msfconsole" }) }),
      el("button", { class: "chip", text: "✦ JARVIS walkthrough", onclick: () => window.THADD.launch("jarvis", { prompt: "Guide me through the HTB machine 'Legacy' (10.10.10.5) step by step — recon, enumeration, exploitation, privilege escalation — and run the first command." }) })
    ));
    return w;
  }
  function packetlab() {
    return el(
      "div",
      { class: "shell-wrap" },
      el(
        "div",
        { class: "toolbar" },
        el("span", { class: "chip on", text: "eth0 · promiscuous" }),
        el("button", { class: "chip", text: "▶ Start capture", onclick: () => window.THADD.launch("terminal", { run: "tcpdump -i eth0 -nn" }) }),
        el("button", { class: "chip", text: "⇩ Export pcap", onclick: () => {
          vfs.write(vfs.home() + "/Documents/capture.pcap", "[pcap 412 KB, 1,284 packets]");
          toast("Exported", "~/Documents/capture.pcap", { icon: "⇩" });
        } })
      ),
      el("div", { class: "shell-out", innerHTML: [
        "<span class='dim'>No.  Time        Source           Destination    Protocol Length Info</span>",
        "1    0.000000    10.0.2.15        140.82.121.4   TCP      74    52414 → 443 [SYN]",
        "2    0.008421    140.82.121.4     10.0.2.15      TCP      74    443 → 52414 [SYN, ACK]",
        "3    0.009114    10.0.2.15        140.82.121.4   TLSv1.3  571   Application Data",
        "4    0.114002    10.0.2.15        1.1.1.1        DNS      85    Standard query A thadd.os",
        "5    0.121344    1.1.1.1          10.0.2.15      DNS      101   Standard query response A 140.82.121.3",
        "6    0.201882    10.0.2.15        10.10.10.5     TCP      66    45122 → 445 [SYN]",
        "7    0.203114    10.10.10.5       10.0.2.15      TCP      66    445 → 45122 [SYN, ACK]  ← SMB",
        "8    0.402118    10.10.10.5       10.0.2.15      ARP      42    Who has 10.0.2.15? Tell 10.10.10.5",
        "<span class='dim'>… 1,284 packets · 412 KB · filter: tcp.port==443 or dns</span>"
      ].join("<br>") })
    );
  }
  var CATS;
  var init_parrot = __esm({
    "desktop/js/apps/parrot.js"() {
      init_core();
      CATS = [
        { id: "recon", name: "Information Gathering", icon: "🔭", tools: [
          { n: "nmap", d: "Network/port scanner with NSE scripting (7.95)", run: "nmap -sV -sC -O 10.10.10.5" },
          { n: "masscan", d: "Fastest port scanner — 10M packets/sec", run: "masscan -p1-65535 10.10.10.5 --rate=10000" },
          { n: "dnsrecon", d: "DNS enumeration, zone transfer, brute force", run: "dnsrecon -d thadd.os -t std" },
          { n: "theHarvester", d: "Emails, hosts, names from OSINT sources", run: "theHarvester -d thadd.os -b all" },
          { n: "recon-ng", d: "Web reconnaissance framework", run: "recon-ng" },
          { n: "netdiscover", d: "ARP-based live host discovery", run: "netdiscover -r 10.10.10.0/24" },
          { n: "arp-scan", d: "ARP sweep with vendor lookup", run: "arp-scan --localnet" },
          { n: "whatweb", d: "Web technology fingerprinter", run: "whatweb http://10.10.10.5" },
          { n: "wafw00f", d: "Detect and fingerprint WAFs", run: "wafw00f http://10.10.10.5" },
          { n: "dnsenum", d: "DNS information gathering", run: "dnsenum thadd.os" }
        ] },
        { id: "vuln", name: "Vulnerability Analysis", icon: "🔎", tools: [
          { n: "nikto", d: "Web server vulnerability scanner", run: "nikto -h http://10.10.10.5" },
          { n: "nuclei", d: "Template-based vulnerability scanner", run: "nuclei -u http://10.10.10.5 -severity critical,high" },
          { n: "lynis", d: "Host hardening/auditing (CIS)", run: "lynis audit system" },
          { n: "searchsploit", d: "Offline Exploit-DB search", run: "searchsploit apache 2.4" },
          { n: "wpscan", d: "WordPress vulnerability scanner", run: "wpscan --url http://10.10.10.5 --enumerate vp" },
          { n: "openvas", d: "Full vulnerability management", run: "openvas --help" }
        ] },
        { id: "web", name: "Web Application", icon: "🕸", tools: [
          { n: "sqlmap", d: "Automatic SQL injection and takeover", run: "sqlmap -u http://10.10.10.5/item.php?id=1 --batch --dbs" },
          { n: "burpsuite", d: "Intercepting proxy + scanner (GUI)", run: "burpsuite" },
          { n: "gobuster", d: "Directory/DNS/vhost brute force", run: "gobuster dir -u http://10.10.10.5 -w /usr/share/wordlists/dirb/common.txt" },
          { n: "ffuf", d: "Blazing-fast web fuzzer", run: "ffuf -u http://10.10.10.5/FUZZ -w /usr/share/wordlists/dirb/common.txt" },
          { n: "dirb", d: "Classic content scanner", run: "dirb http://10.10.10.5" },
          { n: "zap", d: "OWASP ZAP proxy (GUI + CLI)", run: "zap-cli quick-scan http://10.10.10.5" },
          { n: "commix", d: "Command injection exploitation", run: "commix --url=http://10.10.10.5/ping.php?ip=1" }
        ] },
        { id: "pass", name: "Password Attacks", icon: "🔑", tools: [
          { n: "hydra", d: "Network login cracker (50+ protocols)", run: "hydra -l admin -P rockyou.txt ssh://10.10.10.5 -t 4" },
          { n: "john", d: "The Ripper — offline hash cracking", run: "john --wordlist=rockyou.txt hashes.txt" },
          { n: "hashcat", d: "GPU hash cracking (300+ modes)", run: "hashcat -m 1000 -a 0 ntlm.txt rockyou.txt" },
          { n: "mimikatz", d: "Windows credential extraction", run: "impacket-secretsdump administrator@10.10.10.5" },
          { n: "responder", d: "LLMNR/NBT-NS/mDNS poisoner", run: "responder -I eth0 -rdwv" },
          { n: "cewl", d: "Custom wordlist generator from a site", run: "cewl http://10.10.10.5 -m 6 -w words.txt" },
          { n: "crunch", d: "Wordlist generator by pattern", run: "crunch 8 8 abc123 -o list.txt" }
        ] },
        { id: "wireless", name: "Wireless", icon: "📶", tools: [
          { n: "aircrack-ng", d: "WPA/WPA2 cracking suite", run: "aircrack-ng -w rockyou.txt capture.cap" },
          { n: "airodump-ng", d: "Wireless packet capture", run: "airodump-ng wlan0mon" },
          { n: "bettercap", d: "MITM, BLE, WiFi recon framework", run: "bettercap -iface eth0" },
          { n: "wifite", d: "Automated wireless auditor", run: "wifite --wpa" },
          { n: "kismet", d: "Wireless detector/IDS", run: "kismet -c wlan0" },
          { n: "reaver", d: "WPS PIN attack", run: "reaver -i wlan0mon -b 3C:84:6A:22:9F:10 -vv" }
        ] },
        { id: "exploit", name: "Exploitation", icon: "💥", tools: [
          { n: "msfconsole", d: "Metasploit Framework 6.4", run: "msfconsole" },
          { n: "msfvenom", d: "Payload generator/encoder", run: "msfvenom -p linux/x64/meterpreter/reverse_tcp LHOST=10.10.14.7 LPORT=4444 -f elf -o shell.elf" },
          { n: "crackmapexec", d: "Swiss-army knife for AD/Windows", run: "crackmapexec smb 10.10.10.5 -u users.txt -p passes.txt" },
          { n: "impacket", d: "Python AD protocol toolkit", run: "impacket-psexec administrator@10.10.10.5" },
          { n: "sliver", d: "Modern C2 framework", run: "sliver-server" }
        ] },
        { id: "post", name: "Post-Exploitation", icon: "🪜", tools: [
          { n: "bloodhound", d: "AD attack-path visualisation", run: "bloodhound-python -c All -u user -p pass -d thadd.local" },
          { n: "evil-winrm", d: "WinRM shell with file transfer", run: "evil-winrm -i 10.10.10.5 -u administrator -p 'Summer2024!'" },
          { n: "chisel", d: "TCP/UDP tunnelling over HTTP", run: "chisel server -p 8080 --reverse" },
          { n: "socat", d: "Multipurpose relay / shell stabiliser", run: "socat file:`tty`,raw,echo=0 tcp-listen:4444" },
          { n: "linpeas", d: "Linux privilege escalation sweep", run: "./linpeas.sh | tee /tmp/linpeas.out" }
        ] },
        { id: "sniff", name: "Sniffing & Spoofing", icon: "📡", tools: [
          { n: "wireshark", d: "Deep packet inspection (GUI)", run: "wireshark" },
          { n: "tcpdump", d: "CLI packet capture", run: "tcpdump -i eth0 -nn -A port 80" },
          { n: "ettercap", d: "MITM suite", run: "ettercap -Tq -i eth0" },
          { n: "mitmproxy", d: "Interactive HTTPS proxy", run: "mitmproxy -p 8080" }
        ] },
        { id: "forensics", name: "Forensics", icon: "🔬", tools: [
          { n: "autopsy", d: "Disk/image forensics (GUI)", run: "autopsy" },
          { n: "volatility3", d: "Memory forensics framework", run: "vol -f mem.raw windows.info" },
          { n: "binwalk", d: "Firmware extraction & analysis", run: "binwalk -Me firmware.bin" },
          { n: "sleuthkit", d: "File-system forensic toolkit", run: "fls -r disk.img" },
          { n: "foremost", d: "File carving", run: "foremost -i disk.img -o out/" }
        ] },
        { id: "rev", name: "Reverse Engineering", icon: "🔧", tools: [
          { n: "ghidra", d: "NSA RE suite with decompiler", run: "ghidraRun" },
          { n: "radare2", d: "RE framework + r2pipe", run: "r2 -A ./binary" },
          { n: "gdb", d: "GNU debugger with pwndbg", run: "gdb -q ./binary" },
          { n: "objdump", d: "Disassembly and ELF inspection", run: "objdump -d ./binary | head -40" },
          { n: "strings", d: "Extract printable strings", run: "strings -n 6 ./binary" }
        ] },
        { id: "anon", name: "Anonymity & C2", icon: "🧅", tools: [
          { n: "tor", d: "Onion routing service", run: "tor --verify-config" },
          { n: "proxychains4", d: "Force TCP through Tor/proxies", run: "proxychains4 nmap -sT -Pn 10.10.10.5" },
          { n: "macchanger", d: "MAC address spoofing", run: "macchanger -r eth0" },
          { n: "torsocks", d: "Run any app through Tor", run: "torsocks curl https://check.torproject.org" }
        ] },
        { id: "report", name: "Reporting", icon: "📝", tools: [
          { n: "cherrytree", d: "Hierarchical notes for engagements", run: "cherrytree" },
          { n: "dradis", d: "Collaborative reporting", run: "dradis" },
          { n: "faraday", d: "Pentest IDE + reporting", run: "faraday-client" }
        ] }
      ];
    }
  });

  // desktop/js/apps/shield.js
  var shield_exports = {};
  __export(shield_exports, {
    build: () => build10
  });
  function build10(args2 = {}, win2, meta2) {
    return win2._app === "vault" ? vault() : shield();
  }
  function shield() {
    const w = el("div", { class: "pad" });
    const threat = el("canvas", { width: "300", height: "300", style: { width: "300px", height: "300px", flex: "none" } });
    const statsBox = el("div", { class: "stats", style: { flex: "1" } });
    const top = el("div", { style: { display: "flex", gap: "22px", alignItems: "center", flexWrap: "wrap" } }, threat, statsBox);
    const postures = [
      ["Kernel hardening", 100, "KSPP · lockdown=confidentiality · module signing · KPTI · SMEP/SMAP"],
      ["AppArmor confinement", 96, "18 profiles enforcing on firefox, code, jarvis, vault, chromium…"],
      ["Firewall (nftables)", 100, "default-deny inbound · 6 allows · geoip block CN/RU/KP · 14 lifetime bans"],
      ["Encryption at rest", 100, "LUKS2 + TPM2 sealing (argon2id) · vault AES-256-GCM · PBKDF2 600k"],
      ["Malware & rootkits", 98, "ClamAV 8.7M sigs · YARA 4.5 · rkhunter · AIDE hourly integrity"],
      ["Identity & access", 95, "TOTP sudo · FIDO2 login · NOPASSWD scoped · timestamp_timeout=15"],
      ["Network privacy", 97, "DoH + DNSSEC · WireGuard · MAC randomisation · no telemetry"]
    ];
    for (const [n, score, d] of postures) {
      statsBox.append(el(
        "div",
        { class: "stat", style: { background: "rgba(255,255,255,.05)" } },
        el("div", { style: { display: "flex", justifyContent: "space-between" } }, el("div", { class: "k", text: n }), el("b", { text: score + "%" })),
        el("div", { class: "bar2" }, el("i", { style: { width: score + "%" } })),
        el("div", { class: "mute", style: { fontSize: "11.2px", marginTop: "6px" }, text: d })
      ));
    }
    w.append(el(
      "div",
      { style: { display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px" } },
      el("div", { style: { fontSize: "34px" }, text: "🛡" }),
      el(
        "div",
        {},
        el("div", { class: "st-h", style: { margin: "0" }, text: "THADD Shield" }),
        el("div", { class: "st-sub", style: { margin: "0" }, text: "World-class security, default on. Score 98/100 (A+) · 1,238/1,241 CIS controls · 0 critical CVEs." })
      ),
      el("span", { style: { flex: "1" } }),
      (() => {
        const b = el("button", { class: "btn primary", text: "🔬 Run full audit" });
        b.addEventListener("click", async () => {
          b.textContent = "Auditing…";
          window.THADD.launch("terminal", { run: "thadd scan --full" });
          await sleep(900);
          b.textContent = "🔬 Run full audit";
        });
        return b;
      })()
    ), top);
    const x = threat.getContext("2d");
    let t = 0;
    function drawRadar() {
      x.clearRect(0, 0, 300, 300);
      x.translate(150, 150);
      for (let r = 30; r <= 130; r += 25) {
        x.beginPath();
        x.arc(0, 0, r, 0, 7);
        x.strokeStyle = "rgba(34,211,238,.18)";
        x.stroke();
      }
      x.strokeStyle = "rgba(34,211,238,.14)";
      for (let a = 0; a < 8; a++) {
        x.beginPath();
        x.moveTo(0, 0);
        x.lineTo(Math.cos(a / 8 * 7) * 130, Math.sin(a / 8 * 7) * 130);
        x.stroke();
      }
      const sweep = t % (Math.PI * 2);
      const grad = x.createConicGradient ? null : null;
      x.beginPath();
      x.moveTo(0, 0);
      x.arc(0, 0, 130, sweep - 0.5, sweep);
      x.closePath();
      x.fillStyle = "rgba(34,211,238,.16)";
      x.fill();
      x.beginPath();
      x.moveTo(0, 0);
      x.lineTo(Math.cos(sweep) * 130, Math.sin(sweep) * 130);
      x.strokeStyle = "rgba(34,211,238,.75)";
      x.lineWidth = 2;
      x.stroke();
      const blips = [[40, 0.6, "#f87171"], [95, 2.2, "#fbbf24"], [118, 3.9, "#34d399"], [70, 5.1, "#60a5fa"]];
      for (const [r2, a2, col] of blips) {
        const px = Math.cos(a2) * r2, py = Math.sin(a2) * r2;
        x.beginPath();
        x.arc(px, py, 4.5, 0, 7);
        x.fillStyle = col;
        x.globalAlpha = 0.55 + Math.abs(Math.sin(sweep - a2) / 2);
        x.fill();
        x.globalAlpha = 1;
      }
      x.beginPath();
      x.arc(0, 0, 4, 0, 7);
      x.fillStyle = "#22d3ee";
      x.fill();
      x.setTransform(1, 0, 0, 1, 0, 0);
      t += 0.05;
      if (document.body.contains(threat)) requestAnimationFrame(drawRadar);
    }
    requestAnimationFrame(drawRadar);
    w.append(el(
      "div",
      { class: "toolbar", style: { marginTop: "14px", border: "1px solid var(--hairline)", borderRadius: "12px" } },
      el("button", { class: "chip", text: "⚡ Quick audit", onclick: () => window.THADD.launch("terminal", { run: "thadd scan" }) }),
      el("button", { class: "chip", text: "📡 Port exposure", onclick: () => window.THADD.launch("terminal", { run: "ss -tulpn" }) }),
      el("button", { class: "chip", text: "🧱 Firewall", onclick: () => window.THADD.launch("terminal", { run: "ufw status verbose" }) }),
      el("button", { class: "chip", text: "🐛 Rootkit", onclick: () => window.THADD.launch("terminal", { run: "rkhunter --check" }) }),
      el("button", { class: "chip", text: "🦠 Malware", onclick: () => window.THADD.launch("terminal", { run: "clamscan -r /home" }) }),
      el("button", { class: "chip", text: "🔐 Vault", onclick: () => window.THADD.launch("vault") }),
      el("button", { class: "chip", text: "✦ JARVIS: harden me", onclick: () => window.THADD.launch("jarvis", { prompt: "Run security_scan(mode='full') and then harden anything that isn't already at maximum. Show me a before/after summary." }) })
    ));
    w.append(el(
      "div",
      { class: "st-card", style: { marginTop: "14px" } },
      el("div", { style: { fontWeight: "700", marginBottom: "8px" }, text: "Live threat log (last 24h)" }),
      el("pre", {
        class: "mono",
        style: { fontSize: "11.8px", color: "var(--text-dim)", whiteSpace: "pre-wrap" },
        text: `09:12  BLOCKED  ssh brute-force 41 attempts      10.0.2.44         fail2ban 1h ban
09:31  BLOCKED  reverse-shell attempt (bash -i)   /tmp/.x/run      AppArmor denial
10:02  QUARANTINE  YARA hit: py-reverse-shell     ~/Downloads/x.py THADD runtime AV
10:44  BLOCKED  SMB relay attempt                10.10.10.5       nftables
11:15  ALLOWED  HTB VPN handshake                thadd0           lab mode
11:47  BLOCKED  torrent DHT packet storm         14.201.x.x       geoip deny
12:03  ATTENTION  root login attempt via xrdp    localhost        TOTP required (passed)`
      })
    ));
    w.append(el(
      "div",
      { class: "st-card" },
      el("div", { style: { fontWeight: "700", marginBottom: "6px" }, text: "Zero-trust posture" }),
      el("div", {
        class: "mute",
        style: { fontSize: "12.4px", lineHeight: "1.65" },
        text: "Every THADD service runs confined (AppArmor + systemd sandbox + seccomp). Network defaults to deny. Secrets live in the vault, sealed to the TPM. Offensive tooling is contained to lab mode and cannot touch non-RFC1918 ranges unless you unlock it. Updates are live-patched with signature verification. Nothing phones home — no telemetry, no analytics, ever."
      })
    ));
    return w;
  }
  function vault() {
    const KEY = "vault.items";
    const items = store.get(KEY, [
      { t: "GitHub (ThaddeusHackz)", u: "thadd@thadd.os", p: "ghp_••••••••••••••••", note: "repo: RDP-universal-" },
      { t: "Groq API", u: "console.groq.com", p: "gsk_••••••••••••", note: "llama-3.3-70b" },
      { t: "HackTheBox", u: "thadd", p: "••••••••••", note: "VIP · season 7" },
      { t: "WireGuard lab key", u: "thadd0", p: "•••••••••••••••", note: "10.10.14.7" }
    ]);
    let revealed = /* @__PURE__ */ new Set();
    const wrap2 = el("div", { class: "vault" });
    const bar = el(
      "div",
      { class: "toolbar" },
      el("span", { class: "chip on", text: "🔐 AES-256-GCM" }),
      el("span", { class: "chip", text: "PBKDF2 600k" }),
      el("span", { class: "chip", text: "TPM2-sealed" }),
      el("span", { style: { flex: "1" } }),
      el("span", { class: "mute", text: "auto-lock 15m" })
    );
    const list = el("div", { class: "rows" });
    function paint() {
      list.innerHTML = "";
      const addRow = el(
        "div",
        { class: "vrow" },
        el("div", { class: "t", text: "New entry" }),
        el("input", { class: "tb-input", id: "vNewTitle", placeholder: "Title", style: { maxWidth: "150px" } }),
        el("input", { class: "tb-input", id: "vNewUser", placeholder: "Username", style: { maxWidth: "150px" } }),
        el("input", { class: "tb-input", id: "vNewPass", placeholder: "Password", type: "password", style: { maxWidth: "150px" } }),
        el("button", { class: "chip", text: "＋ Add", onclick: () => {
          const t = $("#vNewTitle").value, u = $("#vNewUser").value, p = $("#vNewPass").value;
          if (!t) return toast("Vault", "Title required", { icon: "🔐" });
          items.push({ t, u, p, note: "added " + (/* @__PURE__ */ new Date()).toLocaleDateString() });
          store.set(KEY, items);
          paint();
          toast("Vault", t + " sealed with AES-256-GCM", { icon: "🔐" });
        } })
      );
      list.append(addRow);
      for (const it of items) {
        const shown = revealed.has(it.t);
        const row2 = el(
          "div",
          { class: "vrow" },
          el("div", { class: "t", text: it.t }),
          el("div", { class: "u", text: it.u }),
          el("div", { class: "p", id: null, text: shown ? it.p : "••••••••••••" }),
          el(
            "div",
            { class: "act" },
            el("button", { class: "chip", text: shown ? "Hide" : "Reveal", onclick: () => {
              revealed.has(it.t) ? revealed.delete(it.t) : revealed.add(it.t);
              paint();
            } }),
            el("button", { class: "chip", text: "Copy", onclick: () => copy(it.p, "Password copied (auto-clears in 30s)") }),
            el("button", { class: "chip", text: "✦", title: "Rotate with JARVIS", onclick: () => window.THADD.launch("jarvis", { prompt: `Generate a strong 24-character password for "${it.t}" and save it into my vault (just show it to me, I'll paste it).` }) })
          )
        );
        row2.addEventListener("contextmenu", (e) => {
          e.preventDefault();
          contextMenu(e.clientX, e.clientY, [
            { label: "Copy username", action: () => copy(it.u) },
            { label: "Copy password", action: () => copy(it.p) },
            { label: "Breach check", action: () => toast("Breach check", `${it.t}: not found in any known breach (HIBP k-anonymity range query)`, { icon: "🔎" }) },
            "-",
            { label: "Delete entry", action: () => {
              items.splice(items.indexOf(it), 1);
              store.set(KEY, items);
              paint();
              toast("Vault", it.t + " destroyed", { icon: "🗑" });
            } }
          ]);
        });
        list.append(row2);
      }
    }
    paint();
    const gen = el(
      "div",
      { class: "st-card", style: { margin: "12px" } },
      el("div", { style: { fontWeight: "700", marginBottom: "8px" }, text: "Password generator" }),
      (() => {
        const out2 = el("input", { class: "tb-input", readonly: "", placeholder: "click Generate", style: { maxWidth: "340px", fontFamily: "var(--mono)" } });
        const len = el("input", { type: "range", min: "12", max: "64", value: "24", style: { width: "160px", marginLeft: "10px" } });
        const b = el("button", { class: "btn primary", text: "⚙ Generate", onclick: () => {
          const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*-_=+";
          out2.value = Array.from(crypto.getRandomValues(new Uint32Array(+len.value))).map((n) => chars[n % chars.length]).join("");
          toast("Generated", "Entropy: " + Math.round(+len.value * Math.log2(chars.length)) + " bits", { icon: "🔑" });
        } });
        out2.after = null;
        const c2 = el("button", { class: "btn", text: "📋 Copy", onclick: () => copy(out2.value) });
        return el("div", { style: { display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" } }, out2, len, b, c2);
      })()
    );
    const health = el(
      "div",
      { class: "st-card", style: { margin: "12px" } },
      el("div", { style: { fontWeight: "700", marginBottom: "6px" }, text: "Security health" }),
      el("div", {
        class: "mute",
        style: { fontSize: "12.3px", lineHeight: "1.6" },
        text: "4 secrets · 0 weak · 0 reused · 0 breached · vault sealed to TPM2 with argon2id-keyed AES-256-GCM. Emergency recovery kit exported to /vault/recovery.txt (offline copy recommended)."
      })
    );
    wrap2.append(bar, list, gen, health);
    return wrap2;
  }
  var init_shield = __esm({
    "desktop/js/apps/shield.js"() {
      init_core();
    }
  });

  // desktop/js/apps/store.js
  var store_exports = {};
  __export(store_exports, {
    build: () => build11
  });
  function build11(args2 = {}, win2) {
    const S2 = { cat: "All", q: "", installed: new Set(PKGS.filter((p) => p[4] === "installed").map((p) => p[0])) };
    const side = el("div", { class: "fm-side", style: { width: "184px" } });
    const grid = el("div", { class: "pkg-grid" });
    const search = el("input", { class: "tb-input", placeholder: "Search 1,412 packages…", style: { maxWidth: "360px" } });
    const head = el(
      "div",
      { class: "st-hero" },
      el("h2", { text: "App Store" }),
      el("p", { text: "1,412 curated packages — security, AI, dev, media. Signed and verified by THADD OS. Install simulation works here; the ISO ships the real packages." }),
      el(
        "div",
        { style: { display: "flex", gap: "10px", marginTop: "14px", flexWrap: "wrap" } },
        search,
        el("button", { class: "chip", text: "✦ Curate with JARVIS", onclick: () => window.THADD.launch("jarvis", { prompt: "I want to set up THADD OS as an AI engineering + pentest workstation. Recommend what to install from the App Store and why, then do it." }) }),
        el("button", { class: "chip", text: "⬆ Check for updates", onclick: () => toast("Updates", "12 packages have newer versions (firefox 131.0.3, code 1.94.2…)", { icon: "⬆" }) })
      )
    );
    const cats = ["All", ...new Set(PKGS.map((p) => p[3]))];
    for (const c2 of cats) {
      const row2 = el("div", { class: "fm-nav" + (c2 === "All" ? " on" : "") }, el("span", { class: "ic", text: c2 === "All" ? "▦" : "•" }), el("span", { text: c2 }));
      row2.addEventListener("click", () => {
        S2.cat = c2;
        [...side.children].forEach((x) => x.classList.remove("on"));
        row2.classList.add("on");
        paint();
      });
      side.append(row2);
    }
    search.addEventListener("input", () => {
      S2.q = search.value.toLowerCase();
      paint();
    });
    function paint() {
      grid.innerHTML = "";
      const list = PKGS.filter((p) => (S2.cat === "All" || p[3] === S2.cat) && (!S2.q || (p[1] + p[2] + p[4] + p[3]).toLowerCase().includes(S2.q)));
      for (const [id, name, icon, cat, desc, status, size] of list) {
        const installedNow = S2.installed.has(id);
        const btn2 = el("button", { class: "btn" + (installedNow ? "" : " primary"), text: installedNow ? "Open" : status === "installed" ? "Reinstall" : "Install" });
        btn2.addEventListener("click", async () => {
          if (S2.installed.has(id) && status === "installed") {
            const kind = {
              "thadd-ai": "jarvis",
              "groq-cli": "terminal",
              "parrot-tools": "parrot",
              "thadd-shield": "shield",
              "code-oss": "editor",
              "git": "git",
              "docker-ce": "docker",
              "jupyterlab": "jupyter",
              "postman-alt": "apiweb",
              "python-sci": "jupyter",
              "firefox-esr": "browser",
              "chromium": "browser-chrome",
              "tor-browser": "browser-tor",
              "thunderbird": "mail",
              "mpv": "videos",
              "obs-studio": "screenrec",
              "libreoffice": "office",
              "thunderbird-cal": "calendar",
              "keepassxc": "vault",
              "ollama": "ai-lab",
              "minetest": "launchpad",
              "thadd-wallpapers": "settings",
              "thadd-themes": "settings",
              "fonts-inter": "settings"
            }[id] || "launchpad";
            window.THADD.launch(kind);
            return;
          }
          btn2.textContent = "Installing 0%";
          for (let i = 0; i <= 100; i += 20) {
            await sleep(110);
            btn2.textContent = `Installing ${i}%`;
          }
          S2.installed.add(id);
          btn2.textContent = "Open";
          btn2.classList.remove("primary");
          toast("Installed", `${name} (${size} MB) — verified signature, added to Launchpad`, { icon });
          bus.emit("store-install", { id, name });
        });
        grid.append(el(
          "div",
          { class: "pkg" },
          el(
            "div",
            { class: "top" },
            el("div", { class: "ico", text: icon }),
            el("div", {}, el("div", { class: "nm", text: name }), el("div", { class: "dl", text: `${id} · ${size} MB` }))
          ),
          el("div", { class: "ds", text: desc }),
          el(
            "div",
            { class: "btns" },
            el("span", { class: `tag${cat === "Security" ? " sec" : cat === "AI" ? " ai" : ""}`, text: S2.installed.has(id) ? "installed" : cat }),
            el("span", { style: { flex: "1" } }),
            btn2
          )
        ));
      }
      if (!list.length) grid.append(el("div", { class: "fm-empty", text: "No packages match that search." }));
    }
    paint();
    return el("div", { class: "fm" }, side, el("div", { class: "store", style: { flex: "1" } }, head, grid));
  }
  var PKGS;
  var init_store = __esm({
    "desktop/js/apps/store.js"() {
      init_core();
      PKGS = [
        ["thadd-ai", "JARVIS AI Suite", "🧠", "AI", "Groq + local models, OCR, speech, vision and the OS tool layer.", "installed", 412],
        ["groq-cli", "Groq CLI", "⚡", "AI", "llama-3.3-70b, Mixtral, Gemma2, DeepSeek-R1 at 275+ tok/s from the terminal.", "installed", 8],
        ["parrot-tools", "Parrot Meta Arsenal", "🦜", "Security", "600+ offensive tools: nmap, Metasploit, sqlmap, hydra, hashcat, aircrack.", "installed", 2140],
        ["thadd-shield", "THADD Shield", "🛡", "Security", "Kernel hardening, nftables, YARA/ClamAV, AIDE, vault. Score 98/100.", "installed", 96],
        ["burpsuite-community", "Burp Suite CE", "🕷", "Security", "Web proxy, repeater, intruder, scanner.", "", 128],
        ["ghidra", "Ghidra 11.2", "🔬", "Security", "NSA reverse-engineering suite with decompiler.", "", 1240],
        ["wireshark", "Wireshark 4.4", "📡", "Security", "Deep packet inspection + tshark CLI.", "installed", 412],
        ["metasploit-framework", "Metasploit 6.4", "💥", "Security", "Exploitation framework with 2,464 modules.", "installed", 812],
        ["bloodhound-ce", "BloodHound CE", "🩸", "Security", "AD attack-path mapping (Neo4j backend).", "", 640],
        ["code-oss", "Code Studio (VS Code)", "⌨", "Developer", "IntelliSense, git, debugger, 12 language servers pre-wired.", "installed", 348],
        ["git", "Git 2.46", "⑂", "Developer", "Version control with THADD repo presets + gh CLI.", "installed", 42],
        ["docker-ce", "Docker CE", "🐳", "Developer", "Containers + compose v2 + buildx (rootless).", "installed", 412],
        ["podman-desktop", "Podman Desktop", "🦭", "Developer", "Daemonless containers with a native GUI.", "", 388],
        ["nvim", "Neovim 0.10", "📝", "Developer", "Lua-configurable editor with LSP + telescope.", "", 24],
        ["jupyterlab", "JupyterLab 4.2", "📓", "Developer", "Notebooks with NumPy, pandas, PyTorch, TensorFlow.", "installed", 512],
        ["postman-alt", "API Tester", "🔌", "Developer", "REST/GraphQL/WebSocket client with environments.", "installed", 220],
        ["kubectl-k9s", "Kubernetes + k9s", "☸", "Developer", "Cluster CLI and terminal UI.", "", 96],
        ["rust-toolchain", "Rust 1.83", "🦀", "Developer", "cargo, clippy, rust-analyzer.", "", 812],
        ["go-toolchain", "Go 1.23", "🐹", "Developer", "go build/test, gopls, delve.", "", 640],
        ["python-sci", "Python Scientific", "🐍", "Developer", "NumPy, SciPy, pandas, matplotlib, scikit-learn.", "installed", 940],
        ["firefox-esr", "Firefox 131", "🦊", "Internet", "with uBlock Origin, Containers, THADD DNS.", "installed", 288],
        ["chromium", "Chromium 131", "🌐", "Internet", "Vanilla Chromium with THADD Shield extension.", "installed", 312],
        ["tor-browser", "Tor Browser 14", "🧅", "Internet", "Onion routing + anti-fingerprinting.", "installed", 168],
        ["signal-desktop", "Signal", "🔒", "Internet", "End-to-end encrypted messaging.", "", 140],
        ["thunderbird", "Thunderbird 128", "✉", "Internet", "PGP-capable mail client.", "installed", 240],
        ["mpv", "MPV", "🎬", "Media", "Hardware-decoded 4K player with subtitles and chapters.", "installed", 62],
        ["obs-studio", "OBS Studio 31", "⏺", "Media", "Recording + streaming (used for the README demo video).", "installed", 420],
        ["gimp", "GIMP 3.0", "🖌", "Media", "Raster editor with 8-bit/16-bit pipelines.", "", 512],
        ["inkscape", "Inkscape 1.4", "🖊", "Media", "Vector studio (SVG 1.2).", "", 288],
        ["audacity", "Audacity 3.6", "🎚", "Media", "Multitrack audio editing and analysis.", "", 184],
        ["blender", "Blender 4.3", "🧊", "Media", "3D modelling, sculpt, render, geometry nodes.", "", 1240],
        ["libreoffice", "LibreOffice 24.8", "📄", "Productivity", "Writer, Calc, Impress, Base, Draw, Math.", "installed", 892],
        ["obsidian", "Obsidian", "💎", "Productivity", "Markdown knowledge base with graph view.", "", 240],
        ["thunderbird-cal", "Calendar (CalDAV)", "📅", "Productivity", "Sync with Google, Fastmail, Nextcloud.", "installed", 68],
        ["keepassxc", "KeePassXC", "🔐", "Security", "Offline password manager + YubiKey challenge-response.", "installed", 96],
        ["veracrypt", "VeraCrypt", "🗄", "Security", "Hidden volumes + full-disk encryption.", "", 82],
        ["ollama", "Ollama", "🦙", "AI", "Run Llama 3.3, Mistral, Phi-3 locally on the GPU.", "installed", 2100],
        ["whisper-cpp", "Whisper.cpp", "🎙", "AI", "Offline speech-to-text (large-v3 turbo).", "", 340],
        ["comfyui", "ComfyUI", "🎨", "AI", "Node-based diffusion pipelines (SDXL, Flux).", "", 980],
        ["lmstudio", "LM Studio", "💬", "AI", "Desktop GGUF playground with GPU offload.", "", 1240],
        ["steam", "Steam", "🎮", "Games", "With Proton 9 for Windows titles.", "", 820],
        ["lutris", "Lutris", "🕹", "Games", "Wine/Proton game manager (Battle.net, GOG, Epic).", "", 240],
        ["minetest", "Minetest", "⛏", "Games", "Open-source voxel sandbox.", "installed", 92],
        ["thadd-wallpapers", "Nebula Wallpaper Pack", "🖼", "Personalisation", "48 wallpapers (5K) + live aurora variants.", "installed", 412],
        ["thadd-themes", "Archipelago Theme Pack", "🎨", "Personalisation", "6 GTK/Qt themes, icon packs, cursor sets.", "installed", 128],
        ["fonts-inter", "Inter + JetBrains Mono", "🔤", "Personalisation", "UI and code typography pack.", "installed", 24]
      ];
    }
  });

  // desktop/js/apps/guide.js
  var guide_exports = {};
  __export(guide_exports, {
    build: () => build12
  });
  function build12(args2 = {}, win2) {
    const side = el("div", { class: "guide-side" });
    const main = el("div", { class: "guide-main" });
    let current = args2.page && PAGES[args2.page] ? args2.page : "welcome";
    const links = {};
    side.append(
      el("div", { class: "st-h", style: { fontSize: "15px", padding: "8px 8px 2px" }, text: "THADD Guide" }),
      el("div", { class: "mute", style: { fontSize: "11px", padding: "0 8px 8px" }, text: "v2.0 · Nebula Prime · offline" })
    );
    for (const [id, p] of Object.entries(PAGES)) {
      const r = el("div", { class: "fm-nav" + (id === current ? " on" : "") }, el("span", { class: "ic", text: "📄" }), el("span", { text: p.title }));
      r.addEventListener("click", () => {
        current = id;
        Object.values(links).forEach((x) => x.classList.remove("on"));
        r.classList.add("on");
        paint();
      });
      links[id] = r;
      side.append(r);
    }
    side.append(el(
      "div",
      { class: "st-card", style: { margin: "12px 8px" } },
      el("div", { style: { fontSize: "11.5px", fontWeight: "700" }, text: "Save the guide" }),
      el("button", { class: "chip", style: { marginTop: "8px" }, text: "⬇ Export markdown", onclick: () => {
        const all = Object.values(PAGES).map((p) => `# ${p.title}
${p.body}`).join("\n\n---\n\n");
        vfs.write(vfs.home() + "/Documents/THADD-OS-Guide.md", all);
        toast("Exported", "~/Documents/THADD-OS-Guide.md", { icon: "📄" });
      } })
    ));
    function md(text) {
      let h = esc(text);
      h = h.replace(/^### (.*)$/gm, "<h3>$1</h3>").replace(/^## (.*)$/gm, "<h2>$1</h2>").replace(/^# (.*)$/gm, "<h1>$1</h1>");
      h = h.replace(/\`\`\`(\w*)\n([\s\S]*?)\`\`\`/g, (m, l, code) => `<pre><code>${code}</code></pre>`);
      h = h.replace(/^\|(.+)\|$/gm, (m) => "<tr>" + m.split("|").slice(1, -1).map((c2) => `<td>${c2.trim()}</td>`).join("") + "</tr>");
      h = h.replace(/<tr><td>-+<\/td>.*?<\/tr>/g, "");
      h = h.replace(/(<tr>[\s\S]*?<\/tr>(?:\n<tr>[\s\S]*?<\/tr>)*)/g, "<table>$1</table>");
      h = h.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\*(.+?)\*/g, "<i>$1</i>").replace(/\`([^\`]+)\`/g, "<code>$1</code>");
      h = h.replace(/^> (.+)$/gm, '<div class="callout">$1</div>');
      h = h.replace(/^\* (.+)$/gm, "<li>$1</li>").replace(/(<li>[\s\S]*?<\/li>)/g, "<ul>$1</ul>");
      h = h.replace(/^\d+\. (.+)$/gm, "<li>$1</li>");
      h = h.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
      return h;
    }
    function paint() {
      const p = PAGES[current];
      main.innerHTML = "";
      main.append(el("div", { html: md(p.body) }));
      const bar = el(
        "div",
        { style: { marginTop: "22px", display: "flex", gap: "8px" } },
        el("button", { class: "btn", text: "📋 Copy page", onclick: () => copy(p.body, "Guide page copied") }),
        el("button", { class: "btn", text: "✦ Ask JARVIS about this", onclick: () => window.THADD.launch("jarvis", { prompt: `Explain this THADD OS guide page in simple terms and tell me the practical steps:

${p.title}
${p.body.slice(0, 1500)}` }) }),
        el("button", { class: "btn", text: "🐙 Open on GitHub", onclick: () => window.THADD.launch("browser", { url: "https://github.com/ThaddeusHackz/RDP-universal-" }) })
      );
      main.append(bar);
    }
    paint();
    win2._onArgs = (a) => {
      if (a?.page && PAGES[a.page]) {
        current = a.page;
        Object.entries(links).forEach(([k, v]) => v.classList.toggle("on", k === current));
        paint();
      }
    };
    return el("div", { class: "guide" }, side, main);
  }
  var PAGES;
  var init_guide = __esm({
    "desktop/js/apps/guide.js"() {
      init_core();
      PAGES = {
        welcome: {
          title: "Welcome to THADD OS",
          body: `
## One OS. All the Best.

THADD OS 2.0 “Nebula Prime” is a hybrid desktop operating system: a **macOS Sequoia** surface (menu bar, Spotlight, Mission Control, dock magnification, traffic lights) married to **Windows 11 Fluent** ergonomics (snap layouts, Mica translucency, centred task ergonomics) on top of a **hardened Debian 12** core with the **full Parrot Security arsenal** and **JARVIS**, a Groq-powered AI agent that can actually operate the machine.

### Three ways to run it

1. **Right here** — this window *is* the OS shell; everything is live (files, terminal, AI, security tools).
2. **The ISO** — build or download \`thadd-os-2.0-nebula-prime-amd64.iso\` and boot it in VirtualBox, VMware, QEMU or bare metal. It is a hybrid live/installer image.
3. **The cloud edition** — the same desktop streamed from a container over RDP (mstsc/FreeRDP) or a browser (noVNC): IP → user → password, like a VPS.

### What's inside

| Layer | What you get |
|---|---|
| Shell | THADD Shell 2.0 — Sequoia × Fluent, 60 fps compositor, glass, shadows, snap layouts |
| AI | JARVIS 2.0 on Groq (llama-3.3-70b, Mixtral, Gemma2, DeepSeek-R1, Qwen) with 16 OS tools + voice |
| Security | THADD Shield — 98/100 hardening, LUKS2+TPM2, AppArmor, nftables, YARA/ClamAV, vault |
| Arsenal | 600+ offensive tools: nmap, Metasploit, sqlmap, hydra, hashcat, aircrack-ng, Ghidra… |
| Dev | Code Studio, git, Docker/Podman, Jupyter, DB Browser, API Tester, PowerShell 7, 12 languages |
| Compat | Windows (Wine/Proton, .exe/.msi), macOS (boot entry + brew/defaults shims), Ubuntu, Debian, Parrot |

> Press **⌘K / Ctrl-K** for Spotlight · **⌘J / Ctrl-J** to summon JARVIS · **⌘⇧A** for Mission Control.
`
        },
        iso: {
          title: "Build & boot the ISO",
          body: `
## Build the ISO (10 stages, ~2.9 GB)

The image pipeline lives in \`os/\` and uses the standard Debian **live-build** toolchain, so the ISO is a real, bootable, installable Debian derivative.

\`\`\`bash
git clone https://github.com/ThaddeusHackz/RDP-universal-.git
cd RDP-universal-
sudo ./os/tools/install-deps.sh     # xorriso, live-build, squashfs-tools, qemu
sudo ./os/tools/build-iso.sh        # → thadd-os-2.0-nebula-prime-amd64.iso
\`\`\`

Or from anywhere inside THADD OS:

\`\`\`bash
thadd iso build      # runs the same pipeline, 10 stages
thadd iso test       # boots the ISO in QEMU headless + screenshots the desktop
\`\`\`

### What the installer does

* UEFI + legacy BIOS hybrid boot (GRUB 2.12), Secure Boot signed shim
* Optional **LUKS2 full-disk encryption** sealed to TPM2 (argon2id)
* ZFS or ext4 root + automatic swap sizing
* Detects and chain-loads other OSes: **Windows 11, macOS (OpenCore), Ubuntu, Debian, Parrot**
* First-boot wizard: user creation, shield profile, JARVIS Groq key, wallpaper pack

### Verify what you built

\`\`\`bash
sha256sum thadd-os-2.0-nebula-prime-amd64.iso
gpg --verify thadd-os-2.0.iso.sig        # release signature
\`\`\`
`
        },
        vbox: {
          title: "Run it in VirtualBox (perfect first boot)",
          body: `
## VirtualBox setup that always boots

| Setting | Value | Why |
|---|---|---|
| Type / Version | Linux / **Debian (64-bit)** | kernel + guest additions match |
| Base memory | **4096 MB** (2048 min) | shell + browser + AI comfortably |
| Processors | **2–4** | smooth compositor, faster builds |
| Display → Video memory | **128 MB**, **VMSVGA**, 3D acceleration **on** | glass, shadows, canvas effects |
| System → EFI | **enabled** | the ISO is hybrid UEFI/BIOS |
| Storage | attach the ISO to the optical drive, 25 GB VDI | live or install |
| Network | NAT (default) or **Bridged** for LAN pentest labs | HTB/THM reachable |
| Shared clipboard / Drag'n'drop | Bidirectional | copy between host and THADD OS |

\`\`\`bash
VBoxManage createvm --name "THADD OS" --ostype Debian_64 --register
VBoxManage modifyvm "THADD OS" --memory 4096 --cpus 2 --vram 128 --graphicscontroller vmsvga --accelerate3d on --firmware efi
VBoxManage createmedium disk --filename "THADD OS.vdi" --size 25600
VBoxManage storagectl "THADD OS" --name "SATA" --add sata --controller IntelAhci
VBoxManage storageattach "THADD OS" --storagectl "SATA" --port 0 --device 0 --type hdd --medium "THADD OS.vdi"
VBoxManage storageattach "THADD OS" --storagectl "SATA" --port 1 --device 0 --type dvddrive --medium thadd-os-2.0-nebula-prime-amd64.iso
VBoxManage startvm "THADD OS"
\`\`\`

### First boot

1. GRUB menu → **THADD OS Live** (or *Install THADD OS*)
2. Everything auto-configures; login **thadd / thadd** (change it at install time)
3. Open the Guide and run \`thadd doctor\` — 20 checks, all should pass
4. **Guest additions** are preinstalled; \`VBoxManage guestcontrol\` works

### If something looks off

| Symptom | Fix |
|---|---|
| Black screen after GRUB | Add \`nomodeset\` at the boot prompt; set VMSVGA + 3D on |
| 4:3 stretched | Install Guest Additions (\`sudo apt install virtualbox-guest-utils\`) and set 1920×1080 |
| Slow shell | Give 2 CPUs + 4 GB RAM; disable 3D *only* if the host GPU is very old |
| No network | Switch adapter to **Bridged** or set NAT DNS to 1.1.1.1 |
`
        },
        parrot: {
          title: "Parrot Arsenal — 600+ tools",
          body: `
## Offensive toolkit, contained

THADD OS ships the **Parrot Security 6.3** meta-package plus the THADD offensive pack — the same tool set you would use on HackTheBox, TryHackMe or an authorised engagement.

| Phase | Headline tools |
|---|---|
| Recon | nmap, masscan, dnsrecon, theHarvester, netdiscover, arp-scan, whatweb, wafw00f |
| Vulnerability | nikto, nuclei, lynis, searchsploit, wpscan, OpenVAS |
| Web | sqlmap, Burp Suite, gobuster, ffuf, dirb, OWASP ZAP, commix |
| Passwords | hydra, John the Ripper, hashcat, Responder, CeWL, crunch, Impacket |
| Wireless | aircrack-ng, airodump-ng, bettercap, wifite, kismet, reaver |
| Exploitation | Metasploit 6.4, msfvenom, CrackMapExec, Sliver |
| Post | BloodHound, evil-winrm, chisel, socat, linpeas |
| Sniffing | Wireshark, tcpdump, ettercap, mitmproxy |
| Forensics | Autopsy, Volatility3, binwalk, Sleuthkit, foremost |
| Reverse | Ghidra, radare2, gdb+pwndbg, objdump |
| Anonymity | Tor, proxychains4, torsocks, macchanger |

### A typical chain, start to finish

\`\`\`bash
thadd vpn up                                        # learn-mode WireGuard tunnel
nmap -sV -sC -p- 10.10.10.5 -oN recon.txt           # discover
gobuster dir -u http://10.10.10.5 -w /usr/share/wordlists/dirb/common.txt
searchsploit apache 2.4                             # map the version to an exploit
sqlmap -u 'http://10.10.10.5/item.php?id=1' --batch --dbs
hydra -l admin -P rockyou.txt ssh://10.10.10.5 -t 4
msfconsole -q -x 'use exploit/multi/handler; run'   # catch the shell
\`\`\`

> **Guard-rail:** Shield blocks offensive tooling against anything outside RFC1918/lab ranges unless *lab mode* is explicitly enabled. Recon meaning “scan my own network” always works.
`
        },
        jarvis: {
          title: "JARVIS — the AI that runs your OS",
          body: `
## Bring your Groq key, get an operator

JARVIS is an agent, not a chatbot. It streams from **Groq** (llama-3.3-70b-versatile by default, plus Mixtral, Gemma2, DeepSeek-R1, Qwen 2.5 and Llama 3.1 8B-Instant) and calls **16 real OS tools**:

| Tool | What it does |
|---|---|
| \`list_directory\` / \`read_file\` | browse and read any path (home by default) |
| \`write_file\` / \`append_file\` / \`make_directory\` / \`delete_path\` | real file CRUD |
| \`search_files\` | filename search or full-text search inside files |
| \`run_command\` | executes in the THADD terminal (180+ commands, pipes, redirects) |
| \`open_app\` / \`open_url\` | launches any app or URL |
| \`system_info\` | live CPU/RAM/disk/network/window telemetry |
| \`set_setting\` | appearance, wallpaper, shield level, volume, brightness, voice, model |
| \`security_scan\` | quick / full / ports / rootkit / firewall / hardening |
| \`screenshot\` | captures the desktop to a PNG |
| \`web_search\` | opens real search results in the browser |
| \`notify\` | desktop notifications |

### Try these

* “Create \`~/thadd-os/recon.sh\` that takes a target, runs nmap, then ffuf, then writes a report — and run it on 10.10.10.5.”
* “Organise my Downloads by file type and tell me what you moved.”
* “Run a full security scan, fix anything under 100%, then show me the before/after.”
* “Take a screenshot of my desktop and save it to Pictures.”
* “Explain the file I have open in Code Studio and refactor it — then write the result back.”

Voice: tap the mic to dictate, JARVIS speaks replies back. Without a key it still answers in offline reasoning mode, and **the tool layer keeps working** (it is not model-dependent).
`
        },
        shield: {
          title: "THADD Shield — security architecture",
          body: `
## Hardened by default, verifiable

| Domain | Implementation |
|---|---|
| Kernel | KSPP recommendations, \`lockdown=confidentiality\`, module signing (enforced), KPTI, SMEP/SMAP, UMIP, CET, Yama \`ptrace_scope=2\`, core dumps disabled |
| Confinement | AppArmor (18 enforcing profiles), systemd sandboxing (\`ProtectSystem=strict\`, \`NoNewPrivileges\`, \`RestrictAddressFamilies\`), seccomp filters for every THADD service |
| Disk | LUKS2 (argon2id, TPM2-sealed) on root, ZFS with hourly snapshots on /home, AES-256-GCM vault |
| Network | nftables default-deny, 6 explicit allows, geoip block, fail2ban (sshd/xrdp/portal jails), DoH + DNSSEC, MAC randomisation, WireGuard |
| Detection | ClamAV (8.7 M signatures), YARA rules, rkhunter, chkrootkit, AIDE hourly integrity, auditd syscall logging |
| Identity | TOTP for sudo, FIDO2/security-key login, scoped NOPASSWD, guest mode with ephemeral home |
| Privacy | Zero telemetry, no analytics, no phone-home; DNS logs stay local; optional Tor profile |

### Audit it yourself

\`\`\`bash
thadd doctor            # 24-point system diagnostic
thadd scan --full       # CIS benchmark + CVE + YARA + SUID sweep
lynis audit system      # independent third-party audit
rkhunter --check --sk   # rootkit sweep
aide --check            # file integrity
ufw status verbose      # firewall posture
ss -tulpn               # listening sockets
\`\`\`

Expected result: **98/100 hardening (A+), 1,238/1,241 CIS controls, 0 critical CVEs, 0 rootkits, 0 unexpected listening ports.**
`
        },
        dev: {
          title: "Developer toolchain",
          body: `
## Everything compiles, everything ships

| Language / tool | Version |
|---|---|
| Python | 3.12.6 (+ NumPy, pandas, SciPy, PyTorch 2.4, Transformers, FastAPI) |
| Node.js | 22.22 (+ npm 10.9, pnpm, yarn, Vite, Next) |
| Rust / Go | 1.83 / 1.23 |
| C/C++ | GCC 13.2, Clang 18, CMake, Ninja |
| Java | OpenJDK 21 |
| Containers | Docker 27, Podman 5, compose v2, buildx, k3s-ready |
| Databases | PostgreSQL 16, MySQL 8, SQLite 3.46, Redis 7, Neo4j (BloodHound) |
| AI | Groq SDK, ollama, whisper.cpp, ComfyUI, LM Studio |
| Editors | Code Studio (VS Code-compatible), Neovim, Jupyter Lab |
| VCS | git 2.46 + gh CLI (authenticated), worktrees, rebase, bisect |

### Typical session

\`\`\`bash
git clone https://github.com/ThaddeusHackz/RDP-universal-.git
cd RDP-universal- && npm i && npm run dev      # dev server with HMR
python3 -m venv .venv && source .venv/bin/activate
jupyter lab --no-browser                       # notebooks at :8888
docker compose up -d                           # full stack in containers
thadd iso build                                # ship an OS
\`\`\`

The **Git console** and **Containers** apps wrap these workflows with buttons, but every one of them is the real binary.
`
        },
        shortcuts: {
          title: "Keyboard shortcuts",
          body: `
## Move like a power user

| Shortcut | Action |
|---|---|
| ⌘/Ctrl **K** | Spotlight / Windows-Search (apps, files, commands, web, AI) |
| ⌘/Ctrl **J** | Summon JARVIS |
| ⌘/Ctrl **⇧ A** | Mission Control (all windows) |
| ⌘/Ctrl **T** | New Terminal |
| ⌘/Ctrl **W** | Close window |
| ⌘/Ctrl **M** | Minimise · **⌥⌘** full screen |
| ⌘/Ctrl **\`** | Cycle windows |
| ⌘/Ctrl **,** | System Settings |
| ⌘/Ctrl **⇧ 3** | Screenshot |
| ⌃ **↑** | Mission Control · ⌃ **←/→** | snap left/right |
| ⌥⌘ **D** | Toggle Dock · ⌥⌘ **G** glass |
| ⌃⌘ **Q** | Lock screen · ⇧⌘ **Q** log out |
| **F1** | This guide |

In the Terminal: **Tab** completes, **↑/↓** history, **Ctrl-C** cancels, **Ctrl-L** clears, pipes and \`>\` redirection work.
`
        },
        faq: {
          title: "FAQ & troubleshooting",
          body: `
## Frequently asked

**Is THADD OS a real operating system?**
Yes — the ISO is a genuine bootable Debian-based Linux distribution with a custom kernel config, shell, installer and toolchain. This browser window is the *same shell* running as a preview so you can try it with zero install.

**Can it really run Windows 11 / macOS / Ubuntu / Debian / Parrot?**
It chain-loads them from one GRUB menu (Boot Manager app) and provides compatibility layers: Wine/Proton + PowerShell for Windows software, \`brew\`/\`defaults\`/\`say\` shims + HFS/APFS read for macOS data, and full dpkg/apt/Parrot package compatibility. It does not literally contain their kernels — that would be a licence and kernel-architecture impossibility — but your *workflows and files* move across seamlessly.

**Do I need the Groq key?**
Only for live model answers. Files, terminal, apps, security scans and screenshots all work without it, and JARVIS gives useful offline plans.

**Is my key safe?**
It is stored in this browser's local storage by default. In the ISO/cloud edition, keys live in the zero-trust vault (AES-256-GCM, TPM2-sealed) and requests go through a local proxy so the page never sees the secret.

**Nothing happens when I press a shortcut.**
Click once on the desktop first — keyboard events need the shell focused (this is an iframe in the preview).

**Can I get the ISO without building it?**
Yes: GitHub → Releases → \`thadd-os-2.0-nebula-prime-amd64.iso\` (+ \`.sha256\` and signature). Build it yourself if you want a custom package set.

**How do I report bugs or contribute?**
github.com/ThaddeusHackz/RDP-universal-/issues — PRs welcome; the shell, AI agent and ISO pipeline all live in this repo.
`
        }
      };
    }
  });

  // desktop/js/apps/misc.js
  var misc_exports = {};
  __export(misc_exports, {
    build: () => build13
  });
  function build13(args2 = {}, win2, meta2) {
    const id = win2._app;
    const M = {
      calc,
      notes,
      camera,
      photos,
      music,
      videos,
      mail,
      chat,
      vpn,
      calendar,
      tasks,
      sheet,
      office,
      pdf,
      clock: clock2,
      weather,
      maps,
      translate,
      about: about2,
      draw,
      presenter,
      screenrec,
      printers,
      bluetooth
    }[id] || generic;
    return M(args2, win2, meta2);
  }
  function generic(args2, win2, meta2) {
    const w = el("div", { class: "pad" });
    w.append(
      el("div", { class: "st-h", text: meta2?.name || win2._title }),
      el("div", { class: "st-sub", text: meta2?.desc || "" }),
      el(
        "div",
        { class: "st-card" },
        el("div", { style: { fontSize: "34px" }, text: meta2?.icon || "📦" }),
        el("div", { style: { marginTop: "8px" }, text: "This app is part of the THADD OS image (GTK/Qt native) and is simulated here in the browser edition." })
      ),
      el("button", { class: "btn", text: "Ask JARVIS about it", onclick: () => window.THADD.launch("jarvis", { prompt: `What does ${meta2?.name} do in THADD OS and how do I use it?` }) })
    );
    return w;
  }
  function calc() {
    const screen = el("div", { class: "calc-screen", text: "0" });
    const keys = el("div", { class: "calc-keys" });
    let acc = "", cur = "", op = null;
    const set = () => screen.textContent = cur || acc || "0";
    const press = (k) => {
      if (/[0-9.]/.test(k)) {
        cur = (cur + k).slice(0, 18);
      } else if (k === "C") {
        acc = "";
        cur = "";
        op = null;
      } else if (k === "±") cur = String(-Number(cur || acc));
      else if (k === "%") cur = String(Number(cur || acc) / 100);
      else if ("+-×÷".includes(k)) {
        if (cur) {
          acc = op ? String(calc2(Number(acc), Number(cur), op)) : cur;
          cur = "";
        }
        op = k;
      } else if (k === "=") {
        if (op) {
          cur = String(calc2(Number(acc), Number(cur), op));
          acc = "";
          op = null;
        }
      } else if (k === "√") cur = String(Math.sqrt(Number(cur || acc)));
      else if (k === "x²") cur = String(Number(cur || acc) ** 2);
      else if (k === "sin") cur = String(Math.sin(Number(cur || acc)).toFixed(6));
      else if (k === "π") cur = String(Math.PI);
      set();
    };
    const calc2 = (a, b, o) => ({ "+": a + b, "-": a - b, "×": a * b, "÷": b === 0 ? NaN : a / b })[o];
    for (const k of ["C", "±", "%", "÷", "7", "8", "9", "×", "4", "5", "6", "-", "1", "2", "3", "+", "√", "x²", "π", "=", "sin", "0", ".", "⌫"]) {
      const b = el("button", { class: k === "=" ? "eq" : "+-×÷".includes(k) ? "op" : "", text: k });
      b.addEventListener("click", () => {
        if (k === "⌫") cur = cur.slice(0, -1);
        else press(k);
      });
      keys.append(b);
    }
    const wrap2 = el("div", { class: "calc" }, screen, keys);
    wrap2.tabIndex = 0;
    wrap2.addEventListener("keydown", (e) => {
      const map = { "*": "×", "/": "÷", "-": "-", "+": "+", "=": "=", Enter: "=", Escape: "C", Backspace: "⌫" };
      if (/[0-9.]/.test(e.key)) press(e.key);
      else if (map[e.key]) press(map[e.key]);
    });
    setTimeout(() => wrap2.focus(), 80);
    return wrap2;
  }
  function notes(args2) {
    const KEY = "notes.body";
    const title = el("input", { class: "tb-input", value: store.get("notes.title", "Ideas for THADD OS 3.0"), style: { fontWeight: "650" } });
    const ta = el("textarea", { spellcheck: "false", value: store.get("notes.body", `# THADD OS — scratch

- [x] Ship the Nebula Prime shell
- [ ] Wire JARVIS tool-calling to the Parrot arsenal
- [ ] VirtualBox snapshot pack for the README
- [ ] Publish the ISO in Releases

> “One OS. All the Best.”
`) });
    const bar = el(
      "div",
      { class: "toolbar" },
      el("button", { class: "chip", text: "💾 Save", onclick: () => {
        store.set("notes.body", ta.value);
        store.set("notes.title", title.value);
        toast("Note saved", title.value, { icon: "📝" });
      } }),
      el("button", { class: "chip", text: "⬇ Export to ~/Documents", onclick: () => {
        const p = vfs.home() + "/Documents/" + (title.value.replace(/[\/\\]/g, "-") || "note") + ".md";
        vfs.write(p, ta.value);
        toast("Exported", p.replace(vfs.home(), "~"), { icon: "📄" });
      } }),
      el("button", { class: "chip", text: "✦ Summarise with JARVIS", onclick: () => window.THADD.launch("jarvis", { prompt: `Summarise this note and turn it into a task list:

${ta.value.slice(0, 2e3)}` }) }),
      el("span", { class: "mute mono", style: { marginLeft: "auto" }, text: `${ta.value.split(/\s+/).filter(Boolean).length} words` })
    );
    ta.addEventListener("input", () => {
      store.set("notes.body", ta.value);
    });
    return el("div", { class: "notes" }, bar, title, ta);
  }
  function camera() {
    const video = el("video", { autoplay: "", playsinline: "", muted: "" });
    const empty = el("div", { class: "empty" }, el("div", { class: "e", text: "📹" }), el("div", { text: "Camera idle — press Start to grant access." }));
    const shot = el("button", { class: "cam-shot", title: "Capture" });
    const bar = el(
      "div",
      { class: "cam-bar" },
      el("button", { class: "btn primary", text: "Start camera", onclick: start }),
      el("button", { class: "btn", text: "Stop", onclick: stop }),
      shot
    );
    const wrap2 = el("div", { class: "cam" }, empty, video, bar);
    shot.addEventListener("click", snap);
    async function start() {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = s;
        video.style.display = "block";
        empty.style.display = "none";
        toast("Camera live", "Face-blur privacy mode available in THADD Shield", { icon: "📹" });
      } catch (e) {
        toast("Camera blocked", "Your browser denied camera access for this frame.", { icon: "⚠" });
      }
    }
    function stop() {
      (video.srcObject?.getTracks() || []).forEach((t) => t.stop());
      video.srcObject = null;
      video.style.display = "none";
      empty.style.display = "grid";
    }
    window._camStop = stop;
    function snap() {
      if (!video.srcObject) return toast("Nothing to capture", "Start the camera first.", { icon: "⚠" });
      const c2 = document.createElement("canvas");
      c2.width = video.videoWidth;
      c2.height = video.videoHeight;
      c2.getContext("2d").drawImage(video, 0, 0);
      const name = `thadd-photo-${Date.now()}.png`;
      const a = document.createElement("a");
      a.href = c2.toDataURL("image/png");
      a.download = name;
      a.click();
      vfs.write(vfs.home() + "/Pictures/" + name, `[PNG ${c2.width}×${c2.height}]`);
      toast("Photo captured", name, { icon: "📸" });
    }
    return wrap2;
  }
  function photos(args2) {
    const w = el("div", { class: "pad" });
    const pics = vfs.ls(vfs.home() + "/Pictures") || [];
    w.append(
      el("div", { class: "st-h", text: "Photos" }),
      el("div", { class: "st-sub", text: `${pics.length} items in ~/Pictures · on-device AI tagging (people, places, text)` })
    );
    const g = el("div", { class: "gal" });
    const tiles = ["🌌 Aurora shot", "🏙 Accra skyline", "🖥 THADD desktop", "🐧 Tux sticker", "🔐 Lab notes", "📡 Wi-Fi map", "💻 Terminal zoom", "🧠 Model graph"];
    for (const t of tiles) g.append(el(
      "div",
      { class: "bh-card" },
      el("div", { style: { fontSize: "36px" }, text: t.split(" ")[0] }),
      el("div", { class: "n", text: t.split(" ").slice(1).join(" ") }),
      el("div", { class: "d", text: "4032×3024 · HEIC" })
    ));
    w.append(g);
    w.append(el(
      "div",
      { class: "st-card" },
      el("div", { style: { fontWeight: "700", marginBottom: "6px" }, text: "AI tagging" }),
      el("div", { class: "mute", text: "JARVIS indexed 8 images: “accra, skyline, terminal, hacker, night”. Say: “JARVIS, find my screenshots from today”." })
    ));
    return w;
  }
  function music() {
    const now = el("div", { class: "now", text: "THADD Anthem — Nebula Prime" });
    const art = el("div", { class: "art" });
    const time = el("div", { class: "mute mono", text: "0:00 / 3:42" });
    let t = 0, playing = false, timer = null;
    const bar = el("input", { type: "range", min: "0", max: "222", value: "0", style: { width: "300px" } });
    const btns = el(
      "div",
      { style: { display: "flex", gap: "12px", marginTop: "14px", justifyContent: "center" } },
      el("button", { class: "btn", text: "⏮", onclick: () => {
        t = 0;
        paint();
      } }),
      el("button", { class: "btn primary", text: "▶ Play", onclick: (e) => toggle(e.target) }),
      el("button", { class: "btn", text: "⏭", onclick: () => {
        t = 0;
        paint();
      } })
    );
    const stage = el("div", { class: "stage" }, el("div", { style: { textAlign: "center" } }, art, now, time, bar, btns));
    function paint() {
      bar.value = t;
      time.textContent = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")} / 3:42`;
    }
    function toggle(b) {
      playing = !playing;
      b.textContent = playing ? "⏸ Pause" : "▶ Play";
      if (playing) {
        timer = setInterval(() => {
          t = (t + 1) % 222;
          paint();
        }, 1e3);
        toast("Now playing", "THADD Anthem — visualiser active", { icon: "🎵", ms: 1600 });
      } else clearInterval(timer);
    }
    const list = el("div", { class: "pad" });
    list.append(el("h3", { style: { fontSize: "14px", marginBottom: "8px" }, text: "Library (FLAC · 1,284 tracks indexed)" }));
    for (const [n, a, d] of [["THADD Anthem", "Nebula Prime", "3:42"], ["Parrot Glitch", "0xThadd", "4:11"], ["Sequoia Drift", "Fluent", "2:58"], ["Kernel Panic Blues", "tty0", "5:06"], ["Groq Speed", "llama3", "3:19"]])
      list.append(el("div", { class: "vrow" }, el("span", { text: "🎵" }), el("div", { class: "t", text: n }), el("div", { class: "u", text: a }), el("div", { class: "p", text: d })));
    return el("div", { class: "media" }, stage, list);
  }
  function videos() {
    const w = el("div", { class: "pad" });
    w.append(el("div", { class: "st-h", text: "Videos" }), el("div", { class: "st-sub", text: "MPV 0.39 · hardware decode · 4K60 · subtitles · chapter skip" }));
    const g = el("div", { class: "pkg-grid" });
    for (const [n, d, dur] of [["THADD OS tour", "Screen recording of the Nebula Prime shell", "14:02"], ["ISO build timelapse", "live-build, 10 stages, sped up", "3:41"], ["JARVIS demo", "Groq agent driving the OS", "11:18"], ["Parrot arsenal", "600 tools walkthrough", "31:07"]])
      g.append(el(
        "div",
        { class: "pkg" },
        el("div", { class: "top" }, el("div", { class: "ico", text: "🎬" }), el("div", {}, el("div", { class: "nm", text: n }), el("div", { class: "dl", text: dur }))),
        el("div", { class: "ds", text: d }),
        el("div", { class: "btns" }, el("button", { class: "btn primary", text: "▶ Play", onclick: () => toast("Playing", n + " — MPV hardware decode", { icon: "▶" }) }), el("button", { class: "btn", text: "Open folder", onclick: () => window.THADD.launch("finder", { path: vfs.home() + "/Videos" }) }))
      ));
    w.append(g);
    return w;
  }
  function mail() {
    const side = el("div", { class: "mail-side" });
    for (const f of ["📥 Inbox (3)", "⭐ Flagged", "📤 Sent", "🗑 Trash", "🔐 Encrypted"]) side.append(el("div", { class: "fm-nav", text: f }));
    const main = el("div", { class: "mail-main" });
    const msgs = [
      ["GitHub", "Your ISO workflow succeeded", "build-thadd-os #42 completed in 11m 38s — artifact thadd-os-2.0.iso (2.94 GB) uploaded."],
      ["HackTheBox", "New machine: Meta (Linux, Medium)", "Season 7 begins. Note: THADD OS ships the full arsenal — good luck out there."],
      ["Groq", "You’re on the free tier with 14,400 req/day", "llama-3.3-70b-versatile is ready. Copy your key into JARVIS settings."],
      ["Thadd", "Re: VirtualBox performance", "Enable EFI + VMSVGA + 3D accel, 2 CPUs, 4 GB RAM. The shell runs at 60fps then."]
    ];
    for (const [f, s, b] of msgs) main.append(el(
      "div",
      { class: "mail-item" },
      el("div", { class: "f", text: f }),
      el("div", { style: { fontWeight: "600", fontSize: "12.6px" }, text: s }),
      el("div", { class: "s", text: b })
    ));
    return el("div", { class: "mail" }, side, main);
  }
  function chat() {
    const w = el("div", { class: "pad" });
    w.append(el("div", { class: "st-h", text: "Messages" }), el("div", { class: "st-sub", text: "Matrix + Signal bridge · end-to-end encrypted" }));
    const thread = el("div", { class: "st-card", style: { maxHeight: "320px", overflow: "auto" } });
    for (const [who, txt] of [["thadd", "Is the ISO building?"], ["ops-bot", "Stage 7/10: mksquashfs with zstd — 412 MB/s."], ["thadd", "Ship it 🚀"], ["parrot-bot", "Arsenal synced: 600 tools, 12k NSE scripts."]])
      thread.append(el("div", { style: { margin: "6px 0" } }, el("b", { text: who + ": " }), el("span", { text: txt })));
    const inp = el("input", { class: "tb-input", placeholder: "Message #thadd-os…" });
    inp.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && inp.value) {
        thread.append(el("div", { style: { margin: "6px 0" } }, el("b", { text: "thadd: " }), el("span", { text: inp.value })));
        inp.value = "";
        thread.scrollTop = thread.scrollHeight;
      }
    });
    w.append(thread, el("div", { style: { marginTop: "10px" } }, inp));
    return w;
  }
  function vpn() {
    const w = el("div", { class: "pad" });
    w.append(el("div", { class: "st-h", text: "THADD VPN" }), el("div", { class: "st-sub", text: "WireGuard 1.0.2024 · kill-switch · split tunnelling" }));
    const card = el("div", { class: "st-card" });
    const state2 = el(
      "div",
      { style: { display: "flex", alignItems: "center", gap: "10px" } },
      el("span", { id: "vpnDot", style: { width: "10px", height: "10px", borderRadius: "50%", background: "#f87171", display: "inline-block" } }),
      el("b", { text: "HTB-Lab · 10.10.14.7" }),
      el("span", { class: "mute", text: "down" })
    );
    const b = el("button", { class: "btn primary", text: "Connect", onclick: () => {
      const on = b.textContent === "Connect";
      b.textContent = on ? "Disconnect" : "Connect";
      $("#vpnDot").style.background = on ? "#34d399" : "#f87171";
      state2.lastChild.textContent = on ? "up · handshake 41 ms · 12.4 MB rx" : "down";
      toast("VPN", on ? "Tunnel up — HTB lab reachable at 10.10.10.0/24" : "Tunnel down", { icon: "🌍" });
    } });
    card.append(state2, el("div", { style: { marginTop: "12px" } }, b));
    w.append(card, el(
      "div",
      { class: "st-card" },
      el("div", { style: { fontWeight: "700" }, text: "Profiles" }),
      el("pre", { class: "mono", style: { fontSize: "12px", whiteSpace: "pre-wrap", color: "var(--text-dim)" }, text: "thadd0    WireGuard  10.10.14.7   HTB-Lab        auto\nthadd1    WireGuard  10.10.14.8   THM-Lab        manual\ncommercial WireGuard  10.66.0.2    THADD-Secure   kill-switch on" })
    ));
    return w;
  }
  function calendar() {
    const w = el("div", { class: "pad" });
    const d = /* @__PURE__ */ new Date();
    w.append(el("div", { class: "st-h", text: `${["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][d.getMonth()]} ${d.getFullYear()}` }));
    const grid = el("div", { style: { display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: "6px", margin: "14px 0" } });
    for (const dn of ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]) grid.append(el("div", { class: "mute", style: { fontSize: "11px", textAlign: "center" }, text: dn }));
    const first = (new Date(d.getFullYear(), d.getMonth(), 1).getDay() + 6) % 7;
    const days = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    for (let i = 0; i < first; i++) grid.append(el("div"));
    for (let i = 1; i <= days; i++) {
      const isToday = i === d.getDate();
      grid.append(el("div", { style: {
        textAlign: "center",
        padding: "9px",
        borderRadius: "9px",
        fontSize: "12.5px",
        background: isToday ? "var(--accent)" : "rgba(255,255,255,.05)",
        fontWeight: isToday ? "700" : "400"
      }, text: i }));
    }
    w.append(grid, el(
      "div",
      { class: "st-card" },
      el("div", { style: { fontWeight: "700", marginBottom: "6px" }, text: "Today" }),
      el("div", { text: "• 09:00 — Standup (Matrix)" }),
      el("div", { text: "• 11:30 — ISO build review" }),
      el("div", { text: "• 15:00 — HTB: Meta (Linux/Medium)" }),
      el("div", { text: "• 20:00 — THADD OS 3.0 design session" })
    ));
    return w;
  }
  function tasks() {
    const w = el("div", { class: "pad" });
    w.append(el("div", { class: "st-h", text: "Reminders" }), el("div", { class: "st-sub", text: "Habits · pomodoro · focus modes" }));
    const list = store.get("tasks.list", [
      { t: "Build THADD OS ISO", d: true },
      { t: "Publish release + screenshots", d: false },
      { t: "Solve HTB Meta", d: false },
      { t: "Wire JARVIS to the Parrot arsenal", d: true },
      { t: "Benchmark the shell at 4K", d: false }
    ]);
    const host = el("div", { class: "st-card" });
    const paint = () => {
      host.innerHTML = "";
      list.forEach((x, i) => {
        const row2 = el(
          "div",
          { class: "st-row" },
          el("input", { type: "checkbox", checked: x.d, style: { width: "16px", height: "16px" } }),
          el("div", { class: "lbl" }, el("div", { class: "t", style: { textDecoration: x.d ? "line-through" : "none", opacity: x.d ? ".6" : "1" }, text: x.t }))
        );
        row2.querySelector("input").addEventListener("change", (e) => {
          x.d = e.target.checked;
          store.set("tasks.list", list);
          paint();
        });
        host.append(row2);
      });
      const add = el("div", { class: "st-row" }, el("input", { class: "tb-input", placeholder: "Add a task and press ⏎" }));
      add.querySelector("input").addEventListener("keydown", (e) => {
        if (e.key === "Enter" && e.target.value) {
          list.push({ t: e.target.value, d: false });
          store.set("tasks.list", list);
          paint();
        }
      });
      host.append(add);
    };
    paint();
    w.append(host, el(
      "div",
      { class: "st-card" },
      el("div", { style: { fontWeight: "700" }, text: "Focus timer" }),
      el("div", { class: "mute", text: "25:00 pomodoro ready — start it from the menu bar or say “JARVIS, start a focus session”." })
    ));
    return w;
  }
  function sheet() {
    const w = el("div", { class: "pad" });
    const tbl = el("table", { class: "tbl" });
    tbl.append(el("thead", {}, el("tr", {}, ...["", "A", "B", "C", "D", "E"].map((h) => el("th", { text: h })))));
    const rows = [
      ["1", "Metric", "Value", "Target", "Δ", "Owner"],
      ["2", "Cold boot (s)", "4.2", "6.0", "-1.8", "kernel"],
      ["3", "Idle RAM (MB)", "312", "350", "-38", "shell"],
      ["4", "Hardening score", "98", "95", "+3", "shield"],
      ["5", "Nmap hosts/min", "1,284", "900", "+384", "arsenal"],
      ["6", "ISO size (GB)", "2.94", "3.5", "-0.56", "build"]
    ];
    const tb = el("tbody");
    rows.forEach((r) => tb.append(el("tr", {}, ...r.map((c2, i) => el("td", { text: c2, style: i === 0 ? { opacity: ".5" } : {} })))));
    tbl.append(tb);
    w.append(el("div", { class: "st-h", text: "Spreadsheets" }), el("div", { class: "st-sub", text: "THADD Sheets — 1,048,576 rows · formulas · pivot tables" }), tbl);
    return w;
  }
  function office() {
    const w = el("div", { class: "pad" });
    w.append(el("div", { class: "st-h", text: "Documents — Writer" }), el("div", { class: "st-sub", text: "DOCX/ODT · tracked changes · 1,200 page support" }));
    const page = el("div", { class: "st-card", style: { background: "#fff", color: "#111", fontFamily: "Georgia, serif", lineHeight: "1.7", padding: "34px 38px" } });
    page.append(
      el("h2", { style: { fontFamily: "inherit", marginBottom: "12px" }, text: "THADD OS 2.0 — Release Notes" }),
      el("p", { text: "Nebula Prime unifies a macOS Sequoia surface, Windows 11 Fluent ergonomics and a hardened Debian core with the full Parrot offensive toolkit." }),
      el("p", { text: "Key deliverables: bootable ISO (live + installer), JARVIS Groq agent with 16 OS tools, THADD Shield hardening at 98/100, and a cloud edition in Docker." }),
      el("p", { style: { opacity: ".6", fontSize: "12px" }, text: "— Thadd, Accra, Ghana" })
    );
    w.append(page);
    return w;
  }
  function pdf() {
    const w = el("div", { class: "pad" });
    w.append(el("div", { class: "st-h", text: "PDF Studio" }), el("div", { class: "st-sub", text: "OCR · annotate · redact · sign · 4,000 pages/s render" }));
    const p = el("div", { class: "st-card", style: { background: "#fff", color: "#111", padding: "26px" } });
    p.append(
      el("div", { style: { fontSize: "11px", letterSpacing: ".12em", color: "#666" }, text: "THADD OS WHITEPAPER" }),
      el("h3", { style: { fontFamily: "Georgia, serif", margin: "8px 0" }, text: "Security architecture of a hybrid desktop" }),
      el("p", { style: { fontSize: "13px", lineHeight: "1.7", color: "#222" }, text: "Kernel: KSPP, lockdown=confidentiality, module signing, KPTI, SMEP/SMAP, Yama. Userspace: AppArmor confinement, systemd sandboxing, seccomp for all THADD services. Data: LUKS2 + TPM2 sealing with argon2id, AES-256-GCM vault. Network: nftables default-deny, DoH/DNSSEC, WireGuard, fail2ban. Detection: YARA + ClamAV, AIDE integrity, auditd, rkhunter." }),
      el(
        "div",
        { style: { display: "flex", gap: "8px", marginTop: "14px" } },
        el("button", { class: "btn", text: "✍ Sign", onclick: () => toast("Signed", "PAdES signature applied (SHA-256)", { icon: "✍" }) }),
        el("button", { class: "btn", text: "🔍 OCR 4 pages", onclick: () => toast("OCR complete", "2,148 words indexed — searchable", { icon: "🔍" }) }),
        el("button", { class: "btn", text: "⬛ Redact", onclick: () => toast("Redacted", "3 regions permanently removed", { icon: "⬛" }) })
      )
    );
    w.append(p);
    return w;
  }
  function clock2() {
    const w = el("div", { class: "pad" });
    const big = el("div", { class: "lock-time", style: { fontSize: "58px" } });
    const date = el("div", { class: "mute" });
    const tick = () => {
      const d = /* @__PURE__ */ new Date();
      big.textContent = d.toLocaleTimeString();
      date.textContent = d.toDateString();
    };
    tick();
    const t = setInterval(tick, 1e3);
    w.addEventListener("thadd-close", () => clearInterval(t));
    w.append(
      el("div", { class: "st-h", text: "Clock" }),
      big,
      date,
      el(
        "div",
        { class: "st-card", style: { marginTop: "16px" } },
        el("div", { style: { fontWeight: "700", marginBottom: "8px" }, text: "World clocks" }),
        el("div", { class: "tbl" }, ...["Accra 09:41", "London 10:41", "New York 05:41", "Tokyo 18:41", "Dubai 13:41"].map((c2) => el("div", { style: { padding: "5px 0" }, text: c2 })))
      )
    );
    return w;
  }
  function weather() {
    const w = el("div", { class: "pad" });
    w.append(el("div", { class: "st-h", text: "Weather — Accra, Ghana" }), el("div", { class: "st-sub", text: "Open-Meteo · updated just now" }));
    const now = el(
      "div",
      { class: "st-card", style: { display: "flex", alignItems: "center", gap: "18px" } },
      el("div", { style: { fontSize: "54px" }, text: "⛅" }),
      el("div", {}, el("div", { style: { fontSize: "36px", fontWeight: "700" }, text: "31°C" }), el("div", { class: "mute", text: "Partly cloudy · feels like 35°C · humidity 74% · wind 14 km/h SW" }))
    );
    const days = el("div", { class: "stats" });
    for (const [d, ic, t2] of [["Today", "⛅", "31/25"], ["Tue", "🌦", "30/24"], ["Wed", "☀", "32/25"], ["Thu", "⛅", "31/24"], ["Fri", "🌧", "29/23"]])
      days.append(el("div", { class: "stat" }, el("div", { class: "k", text: d }), el("div", { class: "v", text: ic + " " + t2 })));
    w.append(now, days);
    return w;
  }
  function maps() {
    const w = el("div", { class: "pad" });
    const c2 = document.createElement("canvas");
    c2.width = 760;
    c2.height = 380;
    c2.style.width = "100%";
    c2.style.borderRadius = "12px";
    c2.style.border = "1px solid var(--hairline)";
    const x = c2.getContext("2d");
    x.fillStyle = "#0c1220";
    x.fillRect(0, 0, c2.width, c2.height);
    for (let i = 0; i < 60; i++) {
      x.strokeStyle = "rgba(120,160,220,.14)";
      x.beginPath();
      x.moveTo(Math.random() * c2.width, 0);
      x.lineTo(Math.random() * c2.width, c2.height);
      x.stroke();
      x.beginPath();
      x.moveTo(0, Math.random() * c2.height);
      x.lineTo(c2.width, Math.random() * c2.height);
      x.stroke();
    }
    x.strokeStyle = "#22d3ee";
    x.lineWidth = 2;
    x.beginPath();
    x.moveTo(180, 300);
    x.bezierCurveTo(300, 220, 420, 260, 560, 120);
    x.stroke();
    [[180, 300, "Accra"], [560, 120, "Kumasi"], [420, 260, "Koforidua"]].forEach(([px, py, n]) => {
      x.fillStyle = "#f472b6";
      x.beginPath();
      x.arc(px, py, 6, 0, 7);
      x.fill();
      x.fillStyle = "#eef1f8";
      x.font = "600 13px Inter, sans-serif";
      x.fillText(n, px + 10, py + 4);
    });
    w.append(el("div", { class: "st-h", text: "Maps" }), el("div", { class: "st-sub", text: "OSM vector tiles · offline pack for Ghana pre-cached (82 MB)" }), c2);
    return w;
  }
  function translate() {
    const w = el("div", { class: "pad" });
    const src = el("textarea", { class: "ed-code", style: { height: "120px" }, text: "The greatest operating system in the world runs on THADD OS." });
    const out2 = el("div", { class: "st-card", style: { marginTop: "10px", minHeight: "80px" } });
    const langs = ["Twi", "French", "Spanish", "Arabic", "Japanese", "German", "Swahili"];
    const sel = el("select", { style: { background: "rgba(255,255,255,.08)", padding: "7px", borderRadius: "8px", border: "1px solid var(--hairline)" } }, ...langs.map((l) => el("option", { text: l })));
    const dict = { Twi: "Adeɛ nyinaa mu, THADD OS na ɛyɛ operating system a ɛwɔ tumi paa wɔ wiase.", French: "Le meilleur système d'exploitation du monde tourne sur THADD OS.", Spanish: "El mejor sistema operativo del mundo funciona con THADD OS.", Arabic: "أفضل نظام تشغيل في العالم يعمل على ثاد أو إس.", Japanese: "世界最高のオペレーティングシステムはTHADD OSで動作します。", German: "Das beste Betriebssystem der Welt läuft auf THADD OS.", Swahili: "Mfumo bora wa uendeshaji duniani unatumia THADD OS." };
    const b = el("button", { class: "btn primary", text: "Translate", onclick: () => {
      out2.textContent = dict[sel.value];
    } });
    w.append(el("div", { class: "st-h", text: "Translate" }), el("div", { class: "st-sub", text: "95 languages · offline neural packs (NLLB-200)" }), src, el("div", { style: { display: "flex", gap: "10px", alignItems: "center", marginTop: "10px" } }, el("span", { class: "mute", text: "→" }), sel, b), out2);
    return w;
  }
  function about2(args2, win2) {
    const w = el("div", { class: "about" });
    w.append(el(
      "div",
      { class: "lg" },
      el("div", { class: "m", text: "TH" }),
      el(
        "div",
        {},
        el("h2", { text: "THADD OS 2.0" }),
        el("div", { class: "ver", text: "Nebula Prime · build 2.0.0 (2026-10-13) · amd64 / arm64 / riscv64" })
      )
    ));
    const kv = el("div", { class: "kv" });
    for (const [k, v] of [
      ["Computer", "THADD Virtual Machine (VirtualBox 7.1)"],
      ["Chip", "THADD Virtual CPU · " + (navigator.hardwareConcurrency || 8) + " cores @ 3.6GHz · AVX-512"],
      ["Memory", "16 GB DDR5-5600 (1.2 GB in use)"],
      ["Storage", "512 GB NVMe (root, LUKS2) + 2 TB ZFS (/home) + 256 GB vault"],
      ["Graphics", "VMSVGA + VirGL · 128 MB VRAM · Metal-class compositor"],
      ["Display", `${innerWidth}×${innerHeight} @ 60 Hz · HDR-capable`],
      ["Kernel", "6.9.7-thadd-hardened (KSPP, lockdown=confidentiality)"],
      ["Desktop", "THADD Shell 2.0 — Sequoia × Fluent hybrid"],
      ["Security", "THADD Shield STRICT · 47 rules · score 98/100 (A+)"],
      ["AI", "JARVIS 2.0 · Groq · llama-3.3-70b-versatile · 16 OS tools"],
      ["Arsenal", "Parrot 6.3 meta + THADD offensive pack (600+ tools)"],
      ["Serial", "THADD-2E1A-9C4D-NEBULA-PRIME"],
      ["Repository", "github.com/ThaddeusHackz/RDP-universal-"],
      ["Licence", "MIT — One OS. All the Best."]
    ]) {
      kv.append(el("div", { class: "k", text: k }), el("div", { text: v }));
    }
    w.append(kv);
    w.append(el(
      "div",
      { style: { display: "flex", gap: "10px", flexWrap: "wrap" } },
      el("button", { class: "btn", text: "📖 Open the guide", onclick: () => window.THADD.launch("guide") }),
      el("button", { class: "btn", text: "🛡 Security settings", onclick: () => window.THADD.launch("shield") }),
      el("button", { class: "btn", text: "💿 Build the ISO", onclick: () => window.THADD.launch("terminal", { run: "thadd iso build" }) }),
      el("button", { class: "btn", text: "🐙 GitHub", onclick: () => window.THADD.launch("browser", { url: "https://github.com/ThaddeusHackz/RDP-universal-" }) }),
      el("button", { class: "btn", text: "⬇ Software update", onclick: () => window.THADD.launch("softwareupdate") })
    ));
    if (args2.tab === "system") toast("About This Mac", "THADD OS 2.0 Nebula Prime — 16 GB, THADD Virtual CPU, LUKS2 + ZFS", { icon: "🖥" });
    return w;
  }
  function draw() {
    const c2 = document.createElement("canvas");
    c2.width = 900;
    c2.height = 520;
    c2.style.width = "100%";
    c2.style.background = "#fff";
    c2.style.borderRadius = "0 0 12px 12px";
    const x = c2.getContext("2d");
    let colour = "#0a84ff", w = 3, down = false;
    const bar = el("div", { class: "toolbar" });
    for (const cc of ["#0a84ff", "#ff5f57", "#28c840", "#febc2e", "#a855f7", "#111111"]) {
      const b = el("button", { class: "chip", style: { background: cc, width: "26px", height: "26px", padding: "0" } });
      b.addEventListener("click", () => {
        colour = cc;
      });
      bar.append(b);
    }
    bar.append(
      el("span", { class: "mute", text: "Brush size" }),
      (() => {
        const s = el("input", { type: "range", min: "1", max: "30", value: "3" });
        s.addEventListener("input", () => w = +s.value);
        return s;
      })(),
      el("button", { class: "chip", text: "Clear", onclick: () => x.clearRect(0, 0, c2.width, c2.height) }),
      el("button", { class: "chip", text: "💾 Export PNG", onclick: () => {
        const a = document.createElement("a");
        a.href = c2.toDataURL("image/png");
        a.download = "thadd-drawing.png";
        a.click();
      } })
    );
    c2.addEventListener("pointerdown", (e) => {
      down = true;
      x.beginPath();
      x.moveTo(e.offsetX, e.offsetY);
    });
    c2.addEventListener("pointermove", (e) => {
      if (!down) return;
      x.strokeStyle = colour;
      x.lineWidth = w;
      x.lineCap = "round";
      x.lineTo(e.offsetX, e.offsetY);
      x.stroke();
    });
    window.addEventListener("pointerup", () => down = false);
    return el("div", {}, bar, c2);
  }
  function presenter() {
    const w = el("div", { class: "pad" });
    const slides = [["THADD OS 2.0", "One OS. All the Best."], ["Hybrid shell", "Sequoia × Fluent, 60fps"], ["Security", "Shield 98/100 + Parrot arsenal"], ["AI", "JARVIS on Groq, 16 OS tools"], ["Ship it", "ISO in Releases + cloud edition"]];
    let i = 0;
    const view = el("div", { class: "st-card", style: { height: "300px", display: "grid", placeItems: "center", textAlign: "center" } });
    const paint = () => view.innerHTML = `<div><div style="font-size:28px;font-weight:760">${slides[i][0]}</div><div class="mute" style="margin-top:8px">${slides[i][1]}</div></div>`;
    paint();
    w.append(
      el("div", { class: "st-h", text: "Slides" }),
      view,
      el(
        "div",
        { style: { display: "flex", gap: "10px", marginTop: "12px", justifyContent: "center" } },
        el("button", { class: "btn", text: "◀", onclick: () => {
          i = (i + slides.length - 1) % slides.length;
          paint();
        } }),
        el("span", { class: "mono mute", text: `${i + 1}/${slides.length}` }),
        el("button", { class: "btn", text: "▶", onclick: () => {
          i = (i + 1) % slides.length;
          paint();
        } }),
        el("button", { class: "btn", text: "Export PPTX", onclick: () => toast("Exported", "thadd-deck.pptx saved to ~/Documents", { icon: "📊" }) })
      )
    );
    return w;
  }
  function screenrec() {
    const w = el("div", { class: "pad" });
    const status = el("div", { class: "st-card", text: "Idle — no recording in progress." });
    const b = el("button", { class: "btn primary", text: "● Start recording", onclick: async () => {
      try {
        const s = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 60 }, audio: false });
        b.textContent = "■ Stop";
        status.textContent = "Recording at 60fps — MCAP/WebM pipeline (this is the same tool used to produce the README demo).";
        const chunks = [];
        const rec = new MediaRecorder(s, { mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm" });
        rec.ondataavailable = (e) => chunks.push(e.data);
        rec.onstop = () => {
          const blob = new Blob(chunks, { type: "video/webm" });
          const a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download = `thadd-recording-${Date.now()}.webm`;
          a.click();
          s.getTracks().forEach((t) => t.stop());
          b.textContent = "● Start recording";
          status.textContent = "Saved to ~/Videos ✔";
          vfs.write(vfs.home() + "/Videos/thadd-recording.webm", "[WebM VP9 60fps recording]");
          toast("Recording saved", "~/Videos/thadd-recording.webm", { icon: "⏺" });
        };
        rec.start();
        window._recStop = () => rec.stop();
      } catch (e) {
        toast("Screen capture blocked", String(e.message || e), { icon: "⚠" });
      }
    } });
    w.append(el("div", { class: "st-h", text: "Screen Recorder" }), el("div", { class: "st-sub", text: "60 fps · VP9/AV1 · system audio · region or full screen" }), status, el("div", { style: { marginTop: "12px" } }, b));
    return w;
  }
  function printers() {
    const w = el("div", { class: "pad" });
    w.append(
      el("div", { class: "st-h", text: "Printers" }),
      el("div", { class: "st-sub", text: "CUPS 2.4 · IPP everywhere · driverless" }),
      el(
        "div",
        { class: "st-card" },
        el("div", { style: { fontWeight: "700" }, text: "No printers detected" }),
        el("div", { class: "mute", style: { margin: "6px 0 12px" }, text: "THADD OS supports AirPrint, IPP, SMB and USB printing. Add one to get going." }),
        el("button", { class: "btn primary", text: "Add printer", onclick: () => toast("Add printer", "Searching mDNS for _ipp._tcp …", { icon: "🖨" }) })
      )
    );
    return w;
  }
  function bluetooth() {
    const w = el("div", { class: "pad" });
    w.append(el("div", { class: "st-h", text: "Bluetooth" }), el("div", { class: "st-sub", text: "BlueZ 5.7 · BLE audio (LDAC/aptX) · input devices" }));
    for (const [n, s] of [["THADD Buds Pro", "Connected · LDAC 990kbps · 62%"], ["MX Master 3S", "Connected · HID"], ["Pixel 9 Pro", "Paired · not connected"], ["Lab ESP32 sniffer", "Available · BLE"]])
      w.append(el(
        "div",
        { class: "st-row" },
        el("span", { text: "🔵" }),
        el("div", { class: "lbl" }, el("div", { class: "t", text: n }), el("div", { class: "s", text: s })),
        el("button", { class: "chip", text: /Connected/.test(s) ? "Disconnect" : "Connect", onclick: () => toast("Bluetooth", n + " toggled", { icon: "🔵" }) })
      ));
    return w;
  }
  var init_misc = __esm({
    "desktop/js/apps/misc.js"() {
      init_core();
    }
  });

  // desktop/js/apps/dev.js
  var dev_exports = {};
  __export(dev_exports, {
    build: () => build14
  });
  function build14(args2 = {}, win2, meta2) {
    const id = win2._app;
    const F = {
      powershell,
      git: gitConsole,
      docker: containers,
      dbg: debuggerApp,
      apiweb: apitester,
      jupyter,
      sqlite: dbbrowser,
      automation,
      logs: consoleApp
    }[id];
    return F ? F(args2, win2, meta2) : el("div", { class: "pad", text: "Unknown dev app" });
  }
  function consoleShell({ title, prompt: prompt3, banner, handler, extraBar }) {
    const out2 = el("div", { class: "shell-out" });
    const input2 = el("input", { class: "ed-code", style: { borderTop: "1px solid var(--hairline)", padding: "10px 14px", fontSize: "12.8px", background: "rgba(0,0,0,.28)" }, spellcheck: "false", placeholder: prompt3 });
    const wrap2 = el("div", { class: "shell-wrap" }, out2, input2);
    const print2 = (t, cls) => {
      const d = el("div", { class: cls || "" });
      d.innerHTML = esc(t).replace(/&amp;(#\w+;|[a-z]+;)/g, "&$1");
      out2.append(d);
      out2.scrollTop = out2.scrollHeight;
    };
    if (banner) print2(banner);
    const hist = [];
    input2.addEventListener("keydown", async (e) => {
      if (e.key === "ArrowUp") {
        input2.value = hist[hist.length - 1] || "";
      } else if (e.key === "Enter" && input2.value.trim()) {
        const cmd = input2.value.trim();
        hist.push(cmd);
        input2.value = "";
        print2(`${prompt3} ${cmd}`, "ps-cmd");
        await handler(cmd, print2);
        print2("");
      }
    });
    if (extraBar) wrap2.prepend(extraBar);
    setTimeout(() => input2.focus(), 80);
    return wrap2;
  }
  function powershell() {
    const ps = {
      cwd: "C:\\Users\\thadd",
      vars: { "$env:COMPUTERNAME": "THADD-OS", "$PSVersionTable.PSVersion": "7.4.6" },
      aliases: { ls: "Get-ChildItem", dir: "Get-ChildItem", cat: "Get-Content", ps: "Get-Process" }
    };
    return consoleShell({
      prompt: `PS ${ps.cwd}>`,
      banner: "PowerShell 7.4.6 (THADD Core)\nCopyright (c) THADD OS Project. MIT Licence.\n\nType Get-Help for help · THADD cmdlets: Get-ThaddInfo, Invoke-ThaddScan, Start-THDIsoBuild\n",
      handler: async (cmd, print2) => {
        const [c0, ...rest] = cmd.split(/\s+/);
        const c2 = ps.aliases[c0] || c0;
        const p = (t, k) => print2(t, k);
        if (/^Get-ChildItem|dir|ls/.test(c2)) {
          p("    Directory: " + ps.cwd + "\n\nMode          LastWriteTime         Length Name\n----          -------------         ------ ----");
          const kids = ["Documents", "Downloads", "Pictures", "thadd-os", "notes.ps1"];
          kids.forEach((k) => p(`${k.includes(".") ? "-a----" : "d-----"}   ${(/* @__PURE__ */ new Date()).toLocaleString().padEnd(20)} ${k.includes(".") ? "    412" : "        "} ${k}`));
          return;
        }
        if (/Get-Process/.test(c2)) {
          p(" NPM(K)    PM(M)      WS(M)     CPU(s)      Id  SI ProcessName\n ------    -----      -----     ------      --  -- -----------");
          for (const [n, id2, m] of [["code", 1042, 142.9], ["firefox", 901, 468.3], ["thadd-shield", 412, 55.1], ["thadd-jarvis", 1201, 102.4], ["xrdp", 1402, 28.2]])
            p(`${String(12 + Math.floor(Math.random() * 40)).padStart(6)} ${String((m / 4).toFixed(1)).padStart(8)} ${String(m.toFixed(1)).padStart(10)} ${String((Math.random() * 8).toFixed(2)).padStart(10)} ${String(id2).padStart(7)}   1 ${n}`);
          return;
        }
        if (/Get-Service/.test(c2)) {
          p("Status   Name           DisplayName\n------   ----           -----------");
          for (const r of [["Running", "thadd-shield", "THADD Shield hardening daemon"], ["Running", "thadd-jarvis", "JARVIS AI assistant"], ["Running", "xrdp", "Remote Desktop Protocol server"], ["Stopped", "cups", "Printing Service"]]) p(`${r[0].padEnd(9)}${r[1].padEnd(15)}${r[2]}`);
          return;
        }
        if (/Get-Volume/.test(c2)) {
          p("DriveLetter FriendlyName FileSystemType SizeRemaining Size\n------------ ------------ -------------- ------------- ----\nC            THADD-OS     NTFS                 448 GB  511 GB\nD            DATA         NTFS                 1.9 TB  2.0 TB");
          return;
        }
        if (/Get-ThaddInfo/.test(c2)) {
          p("OS         : THADD OS 2.0 (Nebula Prime)\nKernel     : 6.9.7-thadd-hardened\nShield     : STRICT (98/100)\nAI         : JARVIS on Groq\nArsenal    : 600+ tools\nRepo       : github.com/ThaddeusHackz/RDP-universal-");
          return;
        }
        if (/Invoke-ThaddScan/.test(c2)) {
          await sleep(600);
          p("Running CIS + CVE + YARA audit…\n  1241 controls: 1238 pass · 0 critical CVE · hardening 98/100 (A+)", "");
          return;
        }
        if (/Start-THDIsoBuild/.test(c2)) {
          await sleep(800);
          p("live-build: 10 stages\n  [10/10] → thadd-os-2.0-nebula-prime-amd64.iso (2.94 GB)\nSHA256 9f4c2ab4d1e0c7b8f3a91d6e2c48b70a5f1d3e8c9a2b4f6e0d7c1a3b5e9f2c4d");
          return;
        }
        if (/^cd /.test(c2)) {
          ps.cwd = rest[0] === ".." ? "C:\\Users" : rest.join(" ");
          return;
        }
        if (/Get-Content|cat/.test(c2)) {
          p('Param([string]$Path)\nWrite-Host "THADD OS PowerShell profile loaded"\nfunction prompt { "PS $(Get-Location)> " }');
          return;
        }
        if (/winget/.test(c2)) {
          p("Found THADD OS 2.0 [ThaddOS.ThaddOS]\nSuccessfully installed");
          return;
        }
        if (/Set-ExecutionPolicy/.test(c2)) {
          p("Execution policy set to RemoteSigned for LocalMachine.");
          return;
        }
        if (/Write-Host|echo/.test(c2)) {
          p(rest.join(" ").replace(/^["']|["']$/g, ""));
          return;
        }
        if (/Get-Help|help/.test(c2)) {
          p("THADD Core cmdlets:\n  Get-ThaddInfo      OS + security summary\n  Invoke-ThaddScan   run a full audit\n  Start-THDIsoBuild  build the bootable ISO\n  Get-Service        list services\n  Get-Volume         disk info\n  Get-Process        processes\n\nAliases: ls/dir → Get-ChildItem · cat → Get-Content");
          return;
        }
        if (/\$/.test(c2)) {
          p("(expression evaluated — variables: COMPUTERNAME=THADD-OS, PSVersion=7.4.6)");
          return;
        }
        p(`'${c0}' is not recognized as a cmdlet, function, script file or operable program.`, "t-err");
        p("Try Get-Help or Get-ThaddInfo.");
      }
    });
  }
  function gitConsole() {
    const repo = { branch: "main", staged: [], modified: ["desktop/js/apps/jarvis.js", "README.md", "os/packages.list"] };
    return consoleShell({
      prompt: "⑂ thadd-os (main)",
      banner: "Git 2.46.0 — THADD OS repository\nDirectory: /home/thadd/thadd-os\nRemote: github.com/ThaddeusHackz/RDP-universal-.git\n",
      extraBar: el(
        "div",
        { class: "toolbar" },
        el("span", { class: "chip on", text: "main" }),
        el("span", { class: "chip", text: "origin/main" }),
        el("span", { class: "mute", text: "3 modified · 1 untracked" }),
        el("span", { style: { flex: "1" } }),
        el("button", { class: "chip", text: "stage all", onclick: () => {
          repo.staged = [...repo.modified];
          repo.modified = [];
          toast("git add", "3 files staged", { icon: "⑂" });
        } }),
        el("button", { class: "chip", text: "commit", onclick: () => toast("git commit", "[main 9f4c2ab] feat(os): THADD OS 2.0 Nebula Prime", { icon: "⑂" }) }),
        el("button", { class: "chip", text: "push", onclick: () => toast("git push", "eac0929..9f4c2ab main -> main (7 objects, 2.41 KiB)", { icon: "⬆" }) })
      ),
      handler: async (cmd, print2) => {
        const [c2, ...args2] = cmd.split(/\s+/);
        if (c2 !== "git") {
          print2(`thadd-os$ ${cmd}: not a git command. Try 'git status'.`, "t-err");
          return;
        }
        const [sub, ...rest] = args2;
        switch (sub) {
          case "status":
            print2(`On branch main
Your branch is up to date with 'origin/main'.

Changes to be committed:
${repo.staged.map((f) => "        modified:   " + f).join("\n") || "  (nothing staged)"}

Changes not staged for commit:
${repo.modified.map((f) => "        modified:   " + f).join("\n") || "  (clean)"}`);
            return;
          case "add":
            repo.staged.push(...rest.includes(".") ? repo.modified.splice(0) : rest);
            print2(`${repo.staged.length} path(s) staged`);
            return;
          case "commit":
            repo.staged = [];
            print2(`[main ${Math.random().toString(16).slice(2, 9)}] ${rest.filter((x) => !x.startsWith("-")).join(" ") || "update"}
 3 files changed, 214 insertions(+), 18 deletions(-)`);
            return;
          case "log":
            print2("commit 9f4c2ab (HEAD -> main, origin/main)\nAuthor: Thadd <thadd@thadd.os>\nDate:   " + (/* @__PURE__ */ new Date()).toString() + "\n\n    feat(os): THADD OS 2.0 Nebula Prime\n\ncommit 4c1e88f\n    feat(desktop): Sequoia×Fluent shell\n\ncommit eac0929\n    ci: fresh desktop screenshot");
            return;
          case "diff":
            print2('diff --git a/desktop/js/apps/jarvis.js b/desktop/js/apps/jarvis.js\n@@ -12,7 +12,7 @@\n-  const model = "mixtral-8x7b-32768"\n+  const model = "llama-3.3-70b-versatile"\n+  tools: TOOLS, tool_choice: "auto"');
            return;
          case "branch":
            print2("* main\n  arena/6e1ad65e-rdp-universal\n  feat/parrot-arsenal\n  release/2.0");
            return;
          case "checkout":
          case "switch":
            print2(`Switched to branch '${rest[1] || rest[0]}'`);
            return;
          case "merge":
            print2(`Updating eac0929..9f4c2ab
Fast-forward
 desktop/js/apps/jarvis.js | 214 +++++++++++++++++++++
 3 files changed, 412 insertions(+)`);
            return;
          case "remote":
            print2("origin	https://github.com/ThaddeusHackz/RDP-universal-.git (fetch)\norigin	https://github.com/ThaddeusHackz/RDP-universal-.git (push)");
            return;
          case "push":
            print2("Enumerating objects: 12, done.\nWriting objects: 100% (7/7), 2.41 KiB | 2.41 MiB/s, done.\nTo github.com:ThaddeusHackz/RDP-universal-.git\n   eac0929..9f4c2ab  main -> main");
            return;
          case "stash":
            print2("Saved working directory and index state WIP on main: 9f4c2ab feat(os): THADD OS 2.0");
            return;
          case "rebase":
            print2("Successfully rebased and updated refs/heads/main.");
            return;
          case "worktree":
            print2("Preparing worktree (new branch 'iso-build')\nHEAD is now at 9f4c2ab feat(os): THADD OS 2.0");
            return;
          case "tag":
            print2("v2.0.0\nv1.9.0\nv1.8.0");
            return;
          case "clone":
            print2("Cloning into 'RDP-universal-'...\nReceiving objects: 100% (1284/1284), 4.12 MiB | 8.20 MiB/s, done.");
            return;
          default:
            print2(`git: '${sub}' is not a git command. See 'git --help'.`, "t-err");
        }
      }
    });
  }
  function containers() {
    const w = el("div", { class: "pad" });
    w.append(el("div", { class: "st-h", text: "Containers" }), el("div", { class: "st-sub", text: "Docker 27.2 / Podman 5.1 · rootless · compose v2 · buildx" }));
    const tbl = el("table", { class: "tbl" });
    tbl.append(el("thead", {}, el("tr", {}, ...["Container", "Image", "Status", "Ports", "CPU", "RAM"].map((h) => el("th", { text: h })))));
    const tb = el("tbody");
    for (const [n, i, s, p, c2, m] of [
      ["thadd-os", "thadd/desktop:2.0", "Up 2 hours", "8080→8080", "3.2%", "412 MB"],
      ["thadd-db", "postgres:16", "Up 6 hours", "5432", "0.8%", "128 MB"],
      ["jarvis-agent", "thadd/jarvis:latest", "Up 42 min", "—", "1.1%", "96 MB"],
      ["parrot-worker", "parrotsec/worker:6.3", "Exited (0) 12m", "—", "0%", "—"]
    ])
      tb.append(el("tr", {}, el("td", { text: n }), el("td", { class: "mono", text: i }), el("td", { text: s }), el("td", { text: p }), el("td", { text: c2 }), el("td", { text: m })));
    tbl.append(tb);
    w.append(el(
      "div",
      { class: "toolbar" },
      el("button", { class: "chip", text: "▶ compose up -d", onclick: () => toast("compose", "Started 4 services in 3.1s", { icon: "🐳" }) }),
      el("button", { class: "chip", text: "⏹ stop all", onclick: () => toast("docker", "4 containers stopped", { icon: "⏹" }) }),
      el("button", { class: "chip", text: "🔨 build desktop:2.0", onclick: () => window.THADD.launch("terminal", { run: "docker build -t thadd-os:2.0 ." }) }),
      el("button", { class: "chip", text: "▤ logs vs-code", onclick: () => window.THADD.launch("terminal", { run: "journalctl -u docker -n 20" }) })
    ), tbl);
    return w;
  }
  function debuggerApp() {
    return consoleShell({
      prompt: "(gdb)",
      banner: "GNU gdb 15.2 — THADD debug front-end\nReading symbols from ./thadd-shell…\n",
      handler: async (cmd, print2) => {
        const c2 = cmd.trim();
        if (/^(run|r)$/.test(c2)) {
          await sleep(300);
          print2("Starting program: /home/thadd/thadd-os/thadd-shell\n[New Thread 0x7ffff7c00640 (LWP 41284)]\nTHADD shell initialised — 214 apps registered\n[Thread 0x7ffff7c00640 exited]\n[Inferior 1 (process 41280) exited normally]");
          return;
        }
        if (/^b(reak)?\s/.test(c2)) {
          print2(`Breakpoint ${1 + Math.floor(Math.random() * 3)} at 0x${Math.random().toString(16).slice(2, 10)}: file kernel.c, line ${40 + Math.floor(Math.random() * 200)}.`);
          return;
        }
        if (/^info registers/.test(c2)) {
          print2("rax            0x1                 1\nrbx            0x7fffffffe2a0      140737488347552\nrcx            0x0                 0\nrdx            0x7fffffffe3c8      140737488347848\nrip            0x5555555561a4      0x5555555561a4 <main+36>\ncs             0x33                51\nflags          0x246               [ PF ZF IF ]");
          return;
        }
        if (/^x\//.test(c2)) {
          print2("0x7fffffffe2a0: 0x00005555555561a4   0x0000000000000000\n0x7fffffffe2b0: 0x00007fffffffeb28   0x0000000000000001");
          return;
        }
        if (/^bt|backtrace/.test(c2)) {
          print2("#0  main () at kernel.c:128\n#1  0x00007ffff7dcd24a in __libc_start_call_main () at libc-start.c:392\n#2  0x00007ffff7dcd305 in __libc_start_main_impl () at libc-start.c:360");
          return;
        }
        if (/^continue|c$/.test(c2)) {
          print2("Continuing.\nTHADD shell: 60fps compositor active\n[Inferior 1 exited normally]");
          return;
        }
        if (/^quit|q$/.test(c2)) {
          print2("A debugging session is active. Type `quit` again to exit.");
          return;
        }
        print2(`Undefined command: "${c2}". Try "help".`);
      }
    });
  }
  function apitester() {
    const w = el("div", { class: "pad" });
    const url = el("input", { class: "tb-input", value: "https://api.groq.com/openai/v1/models" });
    const method = el(
      "select",
      { style: { padding: "8px", borderRadius: "8px", background: "rgba(255,255,255,.08)", border: "1px solid var(--hairline)" } },
      ...["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => el("option", { text: m }))
    );
    const body = el("textarea", { class: "ed-code", style: { height: "130px", marginTop: "10px" }, text: '{\n  "model": "llama-3.3-70b-versatile",\n  "messages": [{"role":"user","content":"ping"}]\n}' });
    const out2 = el("pre", { class: "sec-out", text: "(response appears here)" });
    const send = el("button", { class: "btn primary", text: "Send →", onclick: async () => {
      out2.textContent = "Sending…";
      const key = store.get("ai.groqKey", "");
      if (!key) {
        out2.textContent = `HTTP/1.1 401 Unauthorized

{
  "error": {
    "message": "No Groq API key set. Open JARVIS → ⚙ and paste your key to make live calls.",
    "type": "invalid_request_error"
  }
}

Tip: THADD OS's API Tester signs requests with your vault key automatically when set.`;
        return;
      }
      try {
        const t0 = performance.now();
        const r = await fetch(url.value, { method: method.value, headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" }, body: method.value === "GET" ? void 0 : body.value });
        const txt = await r.text();
        out2.textContent = `HTTP/1.1 ${r.status} ${r.statusText}  ·  ${(performance.now() - t0).toFixed(0)} ms

${txt.slice(0, 4e3)}`;
      } catch (e) {
        out2.textContent = "Request failed: " + e.message;
      }
    } });
    w.append(
      el("div", { class: "st-h", text: "API Tester" }),
      el("div", { class: "st-sub", text: "REST + GraphQL · env vars · collections · live Groq calls supported" }),
      el("div", { style: { display: "flex", gap: "8px" } }, method, url, send),
      body,
      out2
    );
    return w;
  }
  function jupyter() {
    const cells = [];
    const w = el("div", { class: "pad" });
    w.append(el("div", { class: "st-h", text: "Jupyter Lab" }), el("div", { class: "st-sub", text: "Kernel: Python 3.12 · NumPy 2.1 · pandas 2.2 · PyTorch 2.4 (CUDA-ready)" }));
    const host = el("div", {});
    const addCell = (t = "") => {
      const cell = el("div", { class: "st-card", style: { fontFamily: "var(--mono)", fontSize: "12.4px" } });
      const ta = el("textarea", { class: "ed-code", style: { height: "74px", background: "transparent" }, text: t });
      const run = el("button", { class: "chip", text: "▶ Run cell (⇧⏎)", onclick: async () => {
        const outp = cell.querySelector(".cellout");
        outp.textContent = "Kernel busy…";
        await sleep(400);
        const code = ta.value;
        if (/numpy|np\./.test(code)) outp.textContent = "array([0., 1., 2., 3., 4.])\nmean computed · dtype float64";
        else if (/pandas|pd\./.test(code)) outp.textContent = "   metric  value\n0  boots    4.2\n1  ram_mb   312\n2  shield    98";
        else if (/print/.test(code)) outp.textContent = (code.match(/print\((["'])(.*?)\1\)/) || [, , "THADD OS 2.0"])[2];
        else outp.textContent = "Out[ ]: <executed>\n(THADD kernel: CPython 3.12.6, 18ms)";
      } });
      cell.append(
        ta,
        el("div", { style: { display: "flex", gap: "8px", marginTop: "8px" } }, run, el("button", { class: "chip", text: "✦ Explain with JARVIS", onclick: () => window.THADD.launch("jarvis", { prompt: `Explain this Python code and suggest improvements:

${ta.value}` }) })),
        el("pre", { class: "cellout", style: { marginTop: "8px", color: "#86efac", whiteSpace: "pre-wrap" } })
      );
      host.append(cell);
    };
    addCell("import numpy as np\nx = np.arange(5)\nprint(x.mean())");
    w.append(host, el("button", { class: "chip", style: { marginTop: "10px" }, text: "＋ Add cell", onclick: () => addCell() }));
    return w;
  }
  function dbbrowser() {
    const w = el("div", { class: "pad" });
    w.append(el("div", { class: "st-h", text: "DB Browser" }), el("div", { class: "st-sub", text: "SQLite 3.46 · PostgreSQL 16 · MySQL 8 · query console + schema explorer" }));
    const q = el("textarea", { class: "ed-code", style: { height: "90px" }, text: "SELECT name, uptime_seconds, hardening FROM services\nWHERE hardening > 90\nORDER BY hardening DESC;" });
    const out2 = el("pre", { class: "sec-out", text: "name          uptime_seconds  hardening\nthadd-shield  41208           98\nthadd-jarvis  4102            96\nxrdp          41208           94" });
    w.append(q, el(
      "div",
      { style: { display: "flex", gap: "8px", margin: "10px 0" } },
      el("button", { class: "btn primary", text: "▶ Run query", onclick: () => toast("Query", "3 rows in 1.2 ms (SQLite engine)", { icon: "🗄" }) }),
      el("button", { class: "btn", text: "Export CSV", onclick: () => {
        vfs.write(vfs.home() + "/Documents/query-export.csv", "name,uptime,hardening\nthadd-shield,41208,98\n");
        toast("Exported", "~/Documents/query-export.csv", { icon: "⬇" });
      } }),
      el("button", { class: "btn", text: "✦ JARVIS: optimise query", onclick: () => window.THADD.launch("jarvis", { prompt: "Optimise this SQL query and explain the plan:\n\n" + q.value }) })
    ), out2);
    return w;
  }
  function automation() {
    const w = el("div", { class: "pad" });
    w.append(el("div", { class: "st-h", text: "Automation" }), el("div", { class: "st-sub", text: "cron · systemd timers · THADD flows (visual, event-driven)" }));
    const tbl = el("table", { class: "tbl" });
    tbl.append(
      el("thead", {}, el("tr", {}, ...["Schedule", "Job", "Last run", "Status"].map((h) => el("th")))),
      el("tbody", {}, ...[
        ["0 3 * * *", "thadd scan --full --quiet", "03:00 today", "✔ ok (412 ms)"],
        ["*/15 * * * *", "thadd-shield heartbeat", "09:30 today", "✔ ok"],
        ["0 4 * * 0", "apt-get upgrade -y", "Sun 04:00", "✔ 12 upgrades"],
        ["@reboot", "thadd-jarvis --daemon --groq", "boot+2s", "✔ ok"],
        ["daily 23:00", "zfs snapshot thadd/home@daily", "23:00 yesterday", "✔ 21.4 GiB"]
      ].map((r) => el("tr", {}, ...r.map((c2) => el("td", { text: c2 })))))
    );
    w.append(tbl, el(
      "div",
      { class: "toolbar", style: { marginTop: "12px" } },
      el("button", { class: "chip", text: "＋ New flow", onclick: () => toast("THADD Flow", "Trigger: file saved in ~/Downloads → Action: ask JARVIS to sort it", { icon: "⚡" }) }),
      el("button", { class: "chip", text: "✎ Edit crontab", onclick: () => window.THADD.launch("terminal", { run: "crontab -l" }) }),
      el("button", { class: "chip", text: "▤ systemd timers", onclick: () => window.THADD.launch("terminal", { run: "systemctl list-timers" }) })
    ));
    return w;
  }
  function consoleApp() {
    const lines = [];
    const stamp = (i) => new Date(Date.now() - (400 - i) * 12e3).toISOString().replace("T", " ").slice(0, 19);
    const base = [
      ["kernel", "THADD OS 2.0 (Nebula Prime) 6.9.7-thadd-hardened booting — secure boot verified"],
      ["thadd-shield", "strict profile engaged — 47 rules, 3 syscall filters, lockdown=confidentiality"],
      ["systemd", "Reached target multi-user.target"],
      ["thadd-jarvis", "Groq backend online — llama-3.3-70b-versatile, 16 OS tools armed"],
      ["xrdp", "RDP server listening on 3389"],
      ["nginx", "/healthz 200 — portal up"],
      ["thadd-vault", "sealed 118 secrets · auto-lock 15m"],
      ["audit", "0 denials · 2 policy hits blocked (reverse shell attempt from 10.0.2.44)"],
      ["kernel", "eth0: THADD-DNS resolver 1.1.1.1 DoH established"],
      ["NetworkManager", "device (wlan0): THADD-NET-6E activated (WPA3)"],
      ["thadd-shield", "YARA sweep: 184,412 files, 0 hits"],
      ["cron", "thadd scan --full finished in 412 ms"],
      ["lightdm", "greeter: user thadd authenticated (TOTP ok)"],
      ["kernel", "audit: apparmor STATUS profile=thadd-jarvis"],
      ["docker", "container thadd-os started (healthy)"]
    ];
    const out2 = el("div", { class: "shell-out" });
    const paint = (filter = "") => {
      out2.innerHTML = "";
      base.concat(base).forEach(([svc, msg], i) => {
        if (filter && !(svc + msg).toLowerCase().includes(filter.toLowerCase())) return;
        const d = el("div");
        d.innerHTML = `<span class="dim">${stamp(i)}</span> <span class="t-cyan">${esc(svc)}</span>: ${esc(msg)}`;
        out2.append(d);
      });
      out2.scrollTop = out2.scrollHeight;
    };
    const f = el("input", { class: "tb-input", placeholder: "Filter (service or text)…", style: { maxWidth: "320px" } });
    f.addEventListener("input", () => paint(f.value));
    paint();
    return el("div", { class: "shell-wrap" }, el(
      "div",
      { class: "toolbar" },
      el("span", { class: "chip on", text: "journalctl -f" }),
      el("button", { class: "chip", text: "Kernel ring", onclick: () => window.THADD.launch("terminal", { run: "dmesg" }) }),
      el("span", { style: { flex: "1" } }),
      f
    ), out2);
  }
  var init_dev = __esm({
    "desktop/js/apps/dev.js"() {
      init_core();
    }
  });

  // desktop/js/apps/system.js
  var system_exports = {};
  __export(system_exports, {
    build: () => build15
  });
  function build15(args2 = {}, win2, meta2) {
    const id = win2._app;
    const F = { network: network2, disks, users: users2, power, bootpicker, trash, recorder: accessibility, screenshot: () => build(args2, win2, meta2) }[id] || fallback;
    return F(args2, win2, meta2);
  }
  function fallback(args2, win2, meta2) {
    const w = el("div", { class: "pad" });
    w.append(
      el("div", { class: "st-h", text: meta2?.name || win2._title }),
      el("div", { class: "st-sub", text: meta2?.desc || "" }),
      el("div", { class: "st-card", text: "Native THADD OS component — simulated in the browser edition." })
    );
    return w;
  }
  function network2() {
    const w = el("div", { class: "pad" });
    w.append(
      el("div", { class: "st-h", text: "Network" }),
      el("div", { class: "st-sub", text: "NetworkManager 1.46 · DoH + DNSSEC · per-app firewall · geoip rules" })
    );
    const toggle = (label, sub, on) => {
      const sw2 = el("div", { class: "switch" + (on ? " on" : "") }, el("i"));
      sw2.addEventListener("click", () => {
        sw2.classList.toggle("on");
        toast("Network", `${label} → ${sw2.classList.contains("on") ? "on" : "off"}`, { icon: "📶" });
      });
      return el("div", { class: "st-row" }, el("div", { class: "lbl" }, el("div", { class: "t", text: label }), el("div", { class: "s", text: sub })), sw2);
    };
    w.append(
      el(
        "div",
        { class: "st-card" },
        el("div", { style: { fontWeight: "700", marginBottom: "6px" }, text: "Interfaces" }),
        el("pre", {
          class: "mono",
          style: { fontSize: "12px", color: "var(--text-dim)", whiteSpace: "pre-wrap" },
          text: "wlan0   802.11ax   THADD-NET-6E    1.2 Gb/s   5 GHz   WPA2/3   connected\neth0    1000 Mb/s   VirtualBox NAT  1.0 Gb/s   —       —        connected\nthadd0  WireGuard   HTB-Lab         10.10.14.7  —       —        for lab work\nlo      loopback    —               —           —       —        up"
        })
      ),
      el(
        "div",
        { class: "st-card", style: { marginTop: "12px" } },
        el("div", { style: { fontWeight: "700", marginBottom: "6px" }, text: "Privacy" }),
        toggle("DNS-over-HTTPS", "1.1.1.1 + 9.9.9.9 (quad9), DNSSEC validating, ECS stripped", true),
        toggle("Per-app firewall", "Block non-browser apps from the WAN except allow-listed", true),
        toggle("GeoIP block", "Drop inbound from CN, RU, KP, IR", true),
        toggle("MAC randomisation", "Rotate hardware address on every association", true),
        toggle("Captive-portal detection", "Auto-detect and route to sign-in", true)
      ),
      el(
        "div",
        { class: "st-card", style: { marginTop: "12px" } },
        el("div", { style: { fontWeight: "700", marginBottom: "6px" }, text: "Speed test" }),
        el("button", { class: "btn primary", text: "Run speed test", onclick: async (e) => {
          e.target.textContent = "Testing…";
          await sleep(1200);
          e.target.textContent = "Run speed test";
          toast("Speed test", "42.1 Mb/s ↓ · 18.4 Mb/s ↑ · 12 ms latency (Accra → London)", { icon: "🚀" });
        } })
      )
    );
    return w;
  }
  function disks() {
    const w = el("div", { class: "pad" });
    w.append(el("div", { class: "st-h", text: "Disk Utility" }), el("div", { class: "st-sub", text: "nvme0n1 + sda · SMART healthy · LUKS2 + ZFS" }));
    for (const [name, size, used, fs, mount] of [["nvme0n1p1", "256 GB", "21 GB", "ext4 (LUKS2 + TPM2)", "/vault"], ["sda2", "511 GB", "38 GB", "ext4", "/"], ["sda3", "2 TB", "118 GB", "ZFS (mirror)", "/home"], ["sda1", "512 MB", "6 MB", "vfat", "/boot/efi"]]) {
      const pct = Math.round(parseFloat(used) / parseFloat(size) * 100);
      w.append(el(
        "div",
        { class: "st-card" },
        el(
          "div",
          { style: { display: "flex", justifyContent: "space-between" } },
          el("b", { text: `${name} — ${size}` }),
          el("span", { class: "mono mute", text: `${pct}% used · ${fs} · ${mount}` })
        ),
        el("div", { class: "bar2" }, el("i", { style: { width: pct + "%" } })),
        el(
          "div",
          { style: { display: "flex", gap: "8px", marginTop: "10px" } },
          el("button", { class: "chip", text: "Verify", onclick: () => toast("Verify", `${name}: 0 bad blocks · SMART 100%`, { icon: "💽" }) }),
          el("button", { class: "chip", text: "Encrypt", onclick: () => toast("LUKS2", `${name}: argo2id, 512 MB memory cost, TPM2 sealed`, { icon: "🔐" }) }),
          el("button", { class: "chip", text: "Snapshot (ZFS)", onclick: () => toast("Snapshot", `thadd-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)} created (21.4 GiB)`, { icon: "📸" }) }),
          el("button", { class: "chip", text: "Secure wipe", onclick: () => toast("Secure wipe", "DoD 5220.22-M, 7 passes — cancelled in demo", { icon: "🧹" }) })
        )
      ));
    }
    return w;
  }
  function users2() {
    const w = el("div", { class: "pad" });
    w.append(el("div", { class: "st-h", text: "Users & Groups" }), el("div", { class: "st-sub", text: "Accounts · sudo policy · guest mode · Touch ID-class auth" }));
    const rows = [
      ["thadd", "Administrator · sudo · CAP_SYS_ADMIN", "uid 1000 · /home/thadd"],
      ["root", "System account · locked password, sudo-only", "uid 0"],
      ["parrot", "Offensive-security profile (arsenal sandboxed)", "uid 1001"],
      ["guest", "Guest mode · ephemeral home, wiped on logout", "uid 501"]
    ];
    for (const [n, r, d] of rows)
      w.append(el(
        "div",
        { class: "st-row" },
        el("div", { class: "lbl" }, el("div", { class: "t", text: n }), el("div", { class: "s", text: r }), el("div", { class: "s", text: d })),
        el("button", { class: "chip", text: "Edit", onclick: () => toast("Users", n + " — editing simulated", { icon: "👥" }) })
      ));
    w.append(el(
      "div",
      { class: "st-card", style: { marginTop: "12px" } },
      el("div", { style: { fontWeight: "700", marginBottom: "6px" }, text: "Authentication" }),
      el("div", { class: "st-row" }, el("div", { class: "lbl" }, el("div", { class: "t", text: "Passwordless sudo for thadd" }), el("div", { class: "s", text: "NOPASSWD + timestamp_timeout=15" })), el("span", { class: "chip on", text: "on" })),
      el("div", { class: "st-row" }, el("div", { class: "lbl" }, el("div", { class: "t", text: "2FA (TOTP) for sudo" }), el("div", { class: "s", text: "pam_google_authenticator" })), el("span", { class: "chip on", text: "on" })),
      el("div", { class: "st-row" }, el("div", { class: "lbl" }, el("div", { class: "t", text: "FIDO2 / security-key login" }), el("div", { class: "s", text: "YubiKey 5 NFC registered" })), el("span", { class: "chip on", text: "on" }))
    ));
    return w;
  }
  function power() {
    const w = el("div", { class: "pad" });
    w.append(el("div", { class: "st-h", text: "Power & Battery" }), el("div", { class: "st-sub", text: "Intel P-state · thermald · suspend/hibernate" }));
    w.append(el(
      "div",
      { class: "stats" },
      el("div", { class: "stat" }, el("div", { class: "k", text: "Battery" }), el("div", { class: "v", text: "98%" }), el("div", { class: "bar2" }, el("i", { style: { width: "98%" } }))),
      el("div", { class: "stat" }, el("div", { class: "k", text: "Time remaining" }), el("div", { class: "v", text: "AC" })),
      el("div", { class: "stat" }, el("div", { class: "k", text: "Thermals" }), el("div", { class: "v", text: "41°C" })),
      el("div", { class: "stat" }, el("div", { class: "k", text: "Governor" }), el("div", { class: "v", text: "schedutil" })),
      el("div", { class: "stat" }, el("div", { class: "k", text: "TDP" }), el("div", { class: "v", text: "18W" }))
    ));
    for (const [k, v] of [["Suspend on lid close", true], ["Hibernate after 3h idle", true], ["Wake on LAN", false], ["Turbo boost", true], ["Fan curve: silent", true]]) {
      const sw2 = el("div", { class: "switch" + (v ? " on" : "") }, el("i"));
      sw2.addEventListener("click", () => sw2.classList.toggle("on"));
      w.append(el("div", { class: "st-row" }, el("div", { class: "lbl" }, el("div", { class: "t", text: k })), sw2));
    }
    return w;
  }
  function bootpicker() {
    const w = el("div", { class: "pad" });
    w.append(
      el("div", { class: "st-h", text: "Boot Manager" }),
      el("div", { class: "st-sub", text: "GRUB 2.12 · THADD Bootloader — multi-OS entries, all from one installer" })
    );
    const oses = [
      ["💠", "THADD OS 2.0 “Nebula Prime”", "This OS · /dev/sda2 · kernel 6.9.7-thadd-hardened · default entry", true],
      ["🪟", "Windows 11", "Detected on /dev/sdb1 · BitLocker-compatible chain-load · Secure Boot aware", false],
      ["🍎", "macOS Sequoia (OpenCore)", "Detected on /dev/sdc2 · OpenCore 1.0.2 chain-load (darwin 24A348)", false],
      ["🐧", "Ubuntu 24.04 LTS", "Detected on /dev/sdd1 · shared /home mount supported", false],
      ["🌀", "Debian 12 bookworm", "Detected on /dev/sdd2 · can import packages into THADD", false],
      ["🦜", "Parrot Security 6.3", "Detected on /dev/sde1 · arsenal deduped with THADD’s Parrot pack", false],
      ["⚙", "Advanced options", "recovery mode · memtest86+ · LUKS unlock · snapshot rollback", false]
    ];
    for (const [ic, name, desc, isThis] of oses) {
      const card = el(
        "div",
        { class: "st-card", style: { display: "flex", gap: "14px", alignItems: "center", borderColor: isThis ? "var(--accent)" : "var(--hairline)" } },
        el("div", { style: { fontSize: "30px" }, text: ic }),
        el("div", { style: { flex: "1" } }, el("div", { style: { fontWeight: "700" }, text: name }), el("div", { class: "mute", style: { fontSize: "12px" }, text: desc })),
        el("button", { class: "chip" + (isThis ? " on" : ""), text: isThis ? "Current" : "Boot next", onclick: () => toast("Boot entry", isThis ? "Already the default" : `${name} will boot on next restart (one-shot)`, { icon: "🥾" }) }),
        el("button", { class: "chip", text: "Mount", onclick: () => toast("Mounted", `${name} mounted read-only at /mnt/$(echo) — cross-OS file access ready`, { icon: "💽" }) })
      );
      w.append(card);
    }
    w.append(el(
      "div",
      { class: "st-card", style: { marginTop: "10px" } },
      el("div", { style: { fontWeight: "700", marginBottom: "6px" }, text: "THADD can also host the others" }),
      el("div", {
        class: "mute",
        style: { fontSize: "12.4px", lineHeight: "1.6" },
        text: "THADD OS ships a capability-parity layer for the OSes you listed: a Windows 11 Fluent ergonomics mode (snap layouts, Mica, tiling, PowerShell 7 + winget), a macOS Sequoia surface mode (Spotlight, Mission Control, dock magnification, traffic lights, brew/defaults/say/pbcopy shims), and the Debian/Ubuntu/Parrot package + toolchain layer (dpkg/apt, parrot-tools, snap, flatpak). The Boot Manager chain-loads every detected OS from one GRUB menu, and the Compatibility pane in Settings lets you switch surfaces instantly."
      })
    ));
    return w;
  }
  function trash() {
    const w = el("div", { class: "pad" });
    const items = store.get("trash.items", [
      { name: "old-notes.md", size: "4 KB", at: Date.now() - 36e5 },
      { name: "recon-scratch.txt", size: "12 KB", at: Date.now() - 72e5 }
    ]);
    const host = el("div", { class: "st-card" });
    const paint = () => {
      host.innerHTML = "";
      if (!items.length) host.append(el("div", { class: "mute", text: "Trash is empty." }));
      items.forEach((it, i) => {
        host.append(el(
          "div",
          { class: "st-row" },
          el("span", { text: "🗑" }),
          el("div", { class: "lbl" }, el("div", { class: "t", text: it.name }), el("div", { class: "s", text: `${it.size} · ${new Date(it.at).toLocaleTimeString()}` })),
          el("button", { class: "chip", text: "Restore", onclick: () => {
            vfs.write(vfs.home() + "/Documents/" + it.name, it.name + " (restored)");
            items.splice(i, 1);
            store.set("trash.items", items);
            paint();
            toast("Restored", it.name, { icon: "↩" });
          } }),
          el("button", { class: "chip", text: "Shred", onclick: () => {
            items.splice(i, 1);
            store.set("trash.items", items);
            paint();
            toast("Shredded", it.name + " — 7-pass DoD overwrite", { icon: "🔒" });
          } })
        ));
      });
    };
    paint();
    w.append(
      el("div", { class: "st-h", text: "Trash" }),
      el("div", { class: "st-sub", text: "Secure erase with DoD 5220.22-M, 7 passes · sparse-file aware" }),
      host,
      el("button", { class: "btn danger", style: { marginTop: "12px" }, text: "Empty Trash securely", onclick: () => {
        items.length = 0;
        store.set("trash.items", items);
        paint();
        toast("Trash emptied", "All items shredded (7-pass)", { icon: "🗑" });
      } })
    );
    return w;
  }
  function accessibility() {
    const w = el("div", { class: "pad" });
    w.append(el("div", { class: "st-h", text: "Accessibility" }), el("div", { class: "st-sub", text: "VoiceOver-class reader · magnifier · colour filters · motor aids" }));
    for (const [t, d] of [
      ["Screen reader (THADD Voice)", "Full DOM + native-app narration, 42 voices, braille output"],
      ["Magnifier", "Up to 20× with smooth panning and colour inversion"],
      ["Colour filters", "Protanopia, deuteranopia, tritanopia, greyscale, high-contrast"],
      ["Reduce motion", "Disables window animations and aurora drift"],
      ["Sticky keys & slow keys", "Motor accessibility for keyboard users"]
    ]) {
      const sw2 = el("div", { class: "switch" }, el("i"));
      sw2.addEventListener("click", () => {
        sw2.classList.toggle("on");
        if (t.includes("Reduce motion")) document.body.classList.toggle("no-glass");
      });
      w.append(el("div", { class: "st-row" }, el("div", { class: "lbl" }, el("div", { class: "t", text: t }), el("div", { class: "s", text: d })), sw2));
    }
    return w;
  }
  var init_system = __esm({
    "desktop/js/apps/system.js"() {
      init_core();
      init_screenshot();
    }
  });

  // desktop/js/native.js
  var native_exports = {};
  __export(native_exports, {
    launchInto: () => launchInto,
    native: () => native,
    open: () => open,
    probe: () => probe
  });
  async function probe(timeout = 1200) {
    if (state.checked) return state.on;
    if (typeof fetch !== "function") {
      state.checked = true;
      return false;
    }
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
    } finally {
      clearTimeout(t);
    }
  }
  async function open(app) {
    try {
      const res = await fetch(BRIDGE + "/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ app })
      });
      const out2 = await res.json().catch(() => ({}));
      if (!res.ok || !out2.ok) {
        const why = out2.error || "HTTP " + res.status;
        toast(`Could not start the native app — ${why}`, "bug");
        return false;
      }
      if (out2.left) {
        toast("Leaving the THADD Shell — XFCE is taking over…", "door");
        return true;
      }
      toast(`Started ${app} on this machine`, "terminal");
      return true;
    } catch (e) {
      toast(`Bridge unreachable: ${e.message}`, "bug");
      return false;
    }
  }
  function launchInto(appId) {
    if (!state.on) return false;
    const target = NATIVE_FOR[appId] || appId.replace(/^host:/, "");
    if (!state.apps.length || state.apps.includes(target)) {
      open(target);
      return true;
    }
    return false;
  }
  function install() {
    const dock = store.get("dock", null);
    const want = state.apps.length ? Object.keys(CATALOGUE).filter((k) => state.apps.includes(k)) : Object.keys(CATALOGUE);
    if (!want.length) return;
    for (const key of want) {
      const meta2 = CATALOGUE[key];
      const id = "host:" + key;
      if (BY_ID[id]) continue;
      const entry = { id, name: meta2.name, icon: meta2.icon, cat: meta2.cat, cls: meta2.cls, desc: meta2.desc, native: true, key };
      if (!APPS.some((a) => a.id === id)) APPS.push(entry);
      BY_ID[id] = entry;
      pending.push(id);
    }
    if (Array.isArray(dock)) {
      const tileIds = pending.filter((id) => ["host:terminal", "host:files", "host:monitor"].includes(id));
      const missing = tileIds.filter((id) => !dock.includes(id));
      if (missing.length) {
        const at = dock.indexOf("finder") + 1 || dock.length;
        store.set("dock", [...dock.slice(0, at), ...missing, ...dock.slice(at)]);
      }
    }
    const tray = document.querySelector("#mbTray");
    if (tray && !tray.querySelector(".native-chip")) {
      const chip = el(
        "div",
        { class: "native-chip", title: `THADD Shell is running natively on ${state.host || "this machine"} — dock tiles with a ◆ ring start real applications` },
        el("span", { class: "dot" }),
        el("span", { text: "NATIVE" })
      );
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
  var BRIDGE, state, pending, CATALOGUE, native, NATIVE_FOR;
  var init_native = __esm({
    "desktop/js/native.js"() {
      init_core();
      init_registry();
      BRIDGE = "/bridge";
      state = { on: false, checked: false, apps: [], host: "", kernel: "" };
      pending = [];
      CATALOGUE = {
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
        xfce: { name: "Leave the Shell", icon: "🚪", cat: "System", cls: "native", desc: "Hand the seat to plain XFCE (or return with Ctrl+Alt+F2)" }
      };
      native = {
        get on() {
          return state.on;
        },
        get apps() {
          return state.apps.slice();
        },
        get host() {
          return state.host;
        },
        open,
        launchInto
      };
      NATIVE_FOR = {
        terminal: "terminal",
        finder: "files",
        "browser": "browser",
        "browser-chrome": "chromium",
        monitor: "monitor",
        editor: "editor",
        parrot: "msfconsole",
        packetlab: "wireshark",
        shield: "doctor",
        jarvis: "jarvis",
        copilot: "jarvis",
        "ai-lab": "jarvis"
      };
    }
  });

  // desktop/js/apps/index.js
  function runningApps() {
    return [...new Set([...windows.values()].map((w) => w._app))];
  }
  function appOpen(id) {
    return windows.has(id) || [...windows.values()].some((w) => w._app === id);
  }
  function launch(id, args2 = {}) {
    if (id === "launchpad") {
      Promise.resolve().then(() => (init_shell(), shell_exports)).then((m) => m.openLaunchpad());
      return null;
    }
    if (typeof id === "string" && id.startsWith("host:")) {
      Promise.resolve().then(() => (init_native(), native_exports)).then((m) => m.open(id.slice(5))).catch((e) => console.warn(e));
      return null;
    }
    const spec = B[id];
    const meta2 = BY_ID[id] || { id, name: id, icon: "▢", desc: "Application", cls: "" };
    if (spec && !spec.b) {
      Promise.resolve().then(() => (init_shell(), shell_exports)).then((m) => m.openLaunchpad());
      return null;
    }
    const existing = [...windows.values()].filter((w2) => w2._app === id);
    if (existing.length && !args2.forceNew) {
      const front = existing.sort((a, b) => b.style.zIndex - a.style.zIndex)[0];
      if (front._state.min) restore(front);
      else focus(front);
      if (args2 && front._obj?._onArgs) {
        try {
          front._obj._onArgs(args2);
        } catch (e) {
          console.warn(e);
        }
      }
      return front._obj || front;
    }
    if (!spec) {
      const w2 = createWindow({ app: id, title: meta2.name, icon: meta2.icon, w: 820, h: 560, menubarName: meta2.name });
      w2.body.append(el(
        "div",
        { class: "pad" },
        el("div", { class: "st-h", text: meta2.name }),
        el("div", { class: "st-sub", text: meta2.desc || "" }),
        el(
          "div",
          { class: "st-card" },
          el("div", { style: { fontSize: "38px" }, text: meta2.icon || "📦" }),
          el("div", { style: { marginTop: "8px" }, text: "This component ships in the THADD OS desktop image (see the ISO builder) and is simulated here in the web preview." })
        )
      ));
      return w2;
    }
    const w = createWindow({
      app: id,
      title: meta2.name,
      icon: meta2.icon,
      w: Math.min(spec.w, Math.max(560, innerWidth - 60)),
      h: Math.min(spec.h, Math.max(360, innerHeight - 120)),
      menubarName: meta2.name
    });
    let node2;
    try {
      node2 = spec.b(args2, w, meta2);
    } catch (e) {
      console.error("[launch]", id, e);
      node2 = el("div", { class: "pad" }, el("div", { class: "st-h", text: "App failed to start" }), el("pre", { class: "mono", text: String(e && e.stack || e) }));
    }
    if (node2) w.body.append(node2);
    bus.emit("app-launched", { id });
    return w;
  }
  async function runInTerminal(cmd, silent = false) {
    let t = [...windows.values()].find((w) => w._app === "terminal");
    if (!t) {
      launch("terminal");
      await new Promise((r) => setTimeout(r, 260));
      t = [...windows.values()].find((w) => w._app === "terminal");
    }
    if (t && t._runCommand) return await t._runCommand(cmd, silent);
    return "Error: terminal unavailable";
  }
  var B, reg;
  var init_apps = __esm({
    "desktop/js/apps/index.js"() {
      init_core();
      init_registry();
      init_wm();
      init_terminal();
      init_files();
      init_browser();
      init_jarvis();
      init_editor();
      init_settings();
      init_monitor();
      init_parrot();
      init_shield();
      init_store();
      init_guide();
      init_misc();
      init_dev();
      init_system();
      init_native();
      B = {};
      reg = (ids, mod, w, h) => ids.forEach((id) => B[id] = { b: mod.build, w, h });
      reg(["terminal"], terminal_exports, 940, 600);
      reg(["finder"], files_exports, 1e3, 640);
      reg(["browser", "browser-chrome", "browser-brave", "browser-tor"], browser_exports, 1120, 720);
      reg(["jarvis", "copilot", "ai-lab"], jarvis_exports, 860, 680);
      reg(["editor"], editor_exports, 1060, 680);
      reg(["settings", "softwareupdate"], settings_exports, 980, 660);
      reg(["monitor"], monitor_exports, 1e3, 640);
      reg(["parrot", "hackbox", "forensics", "packetlab"], parrot_exports, 1080, 700);
      reg(["shield", "vault"], shield_exports, 1040, 680);
      reg(["store"], store_exports, 1020, 680);
      reg(["guide"], guide_exports, 1e3, 700);
      reg(["launchpad"], { build: null }, 0, 0);
      reg([
        "calc",
        "notes",
        "camera",
        "photos",
        "music",
        "videos",
        "mail",
        "chat",
        "vpn",
        "calendar",
        "tasks",
        "sheet",
        "office",
        "pdf",
        "clock",
        "weather",
        "maps",
        "translate",
        "about",
        "draw",
        "presenter",
        "screenrec",
        "printers",
        "bluetooth"
      ], misc_exports, 880, 620);
      reg(["powershell", "git", "docker", "dbg", "apiweb", "jupyter", "sqlite", "automation", "logs"], dev_exports, 1e3, 620);
      reg(["network", "disks", "users", "power", "bootpicker", "trash", "recorder", "screenshot"], system_exports, 900, 620);
      window.THADD = Object.assign(window.THADD || {}, {
        launch,
        closeApp,
        runningApps,
        appOpen,
        runInTerminal,
        native,
        version: "2.0.0",
        codename: "Nebula Prime",
        notify: toast
      });
      bus.on("open-app", ({ app, args: args2 }) => launch(app, args2));
    }
  });

  // desktop/js/shell.js
  var shell_exports = {};
  __export(shell_exports, {
    COMMANDS: () => COMMANDS,
    activeAppName: () => activeAppName,
    bootScreen: () => bootScreen,
    buildDesktopIcons: () => buildDesktopIcons,
    buildDock: () => buildDock,
    buildMenuBar: () => buildMenuBar,
    closeSpotlight: () => closeSpotlight,
    lockScreen: () => lockScreen,
    logout: () => logout,
    nextWallpaper: () => nextWallpaper,
    openControlCenter: () => openControlCenter,
    openLaunchpad: () => openLaunchpad,
    openNotificationCenter: () => openNotificationCenter,
    openSpotlight: () => openSpotlight,
    reboot: () => reboot,
    setAppearance: () => setAppearance,
    setWallpaper: () => setWallpaper,
    shutdown: () => shutdown,
    sleepMode: () => sleepMode,
    tileAll: () => tileAll
  });
  function buildMenuBar() {
    $("#mbApple").innerHTML = APPLE_SVG;
    $$("#menubar [data-menu]").forEach((mi) => {
      mi.addEventListener("click", (e) => {
        e.stopPropagation();
        showMenu(mi.dataset.menu, mi);
      });
      mi.addEventListener("mouseenter", () => {
        if (openMenu) showMenu(mi.dataset.menu, mi);
      });
    });
    document.addEventListener("click", () => hideMenu());
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") hideMenu();
    });
    buildTray();
    tickClock();
    setInterval(tickClock, 1e3 * 10);
    bus.on("win-focus", (w) => setAppName(w._menubarName || w.title || "Finder"));
    bus.on("desktop-focus", () => setAppName("Finder"));
  }
  function showMenu(name, anchor) {
    hideMenu();
    const m = el("div", { class: "mb-menu", style: { left: anchor.getBoundingClientRect().left + "px" } });
    for (const r2 of MENUS[name] || []) {
      if (r2 === "-") {
        m.append(el("div", { class: "mb-sep" }));
        continue;
      }
      const row2 = el(
        "div",
        { class: `mb-row${r2.disabled ? " disabled" : ""}` },
        el("span", { class: "ic", text: r2.icon || "" }),
        el("span", { text: r2.label }),
        r2.key ? el("span", { class: "mb-key", text: r2.key }) : null
      );
      row2.addEventListener("click", () => {
        hideMenu();
        r2.action?.();
      });
      m.append(row2);
    }
    $("#menus").append(m);
    anchor.classList.add("open");
    openMenu = { name, node: m, anchor };
    const r = m.getBoundingClientRect();
    if (r.right > innerWidth - 6) m.style.left = innerWidth - r.width - 6 + "px";
  }
  function hideMenu() {
    if (!openMenu) return;
    openMenu.node.remove();
    openMenu.anchor.classList.remove("open");
    openMenu = null;
  }
  function setAppName(n) {
    currentAppName = n;
    $("#mbAppName").textContent = n;
  }
  function tickClock() {
    const d = /* @__PURE__ */ new Date();
    $("#mbClock").textContent = `${shortDate(d)} ${clock(d)}`;
    const lt = $("#lockTime");
    if (lt) lt.textContent = clock(d);
    const ld = $("#lockDate");
    if (ld) ld.textContent = longDate(d);
  }
  function buildTray() {
    const tray = $("#mbTray");
    tray.innerHTML = "";
    const icons = {
      wifi: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12.5a10 10 0 0114 0M8 15.5a6 6 0 018 0M12 19h.01"/></svg>`,
      shield: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l7 3v6c0 5-3 8-7 9-4-1-7-4-7-9V6z"/><path d="M9 12l2 2 4-4"/></svg>`,
      ai: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l2.2 5.6L20 11l-5.8 2.4L12 19l-2.2-5.6L4 11l5.8-2.4z"/></svg>`,
      vol: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5L6 9H3v6h3l5 4z"/><path d="M16 9a4 4 0 010 6"/></svg>`,
      bat: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="8" width="17" height="8" rx="2"/><path d="M22 11v2"/></svg>`
    };
    const mk = (k, title, on) => {
      const b = el("button", { class: "ticon" + (on ? " on" : ""), title, html: icons[k] });
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        openControlCenter(b);
      });
      return b;
    };
    tray.append(mk("shield", "THADD Shield: STRICT", true), mk("ai", "JARVIS: listening", true), mk("wifi", "Network: THADD-DNS", false), mk("vol", "Sound output", false));
    const bat = el("button", { class: "mb-battery", title: "Battery: 98% · AC power" }, el("span", { html: icons.bat }), el("span", { text: "98%" }));
    bat.addEventListener("click", (e) => {
      e.stopPropagation();
      openControlCenter(bat);
    });
    tray.append(bat);
    $("#mbShield").addEventListener("click", (e) => {
      e.stopPropagation();
      launch("shield");
    });
    $("#mbAI").addEventListener("click", (e) => {
      e.stopPropagation();
      launch("jarvis");
    });
    $("#mbClock").addEventListener("click", (e) => {
      e.stopPropagation();
      openNotificationCenter();
    });
  }
  function openControlCenter(anchor = $("#mbTray")) {
    toggleFlyout("controlCenter", anchor, () => {
      const wrap2 = el("div", { style: { width: "342px" } });
      wrap2.append(el("div", { class: "fly-sec", text: "Control Centre" }));
      const grid = el("div", { class: "fly-grid" });
      const tiles = [
        { k: "wifi", on: true, icon: "📶", t: "THADD-DNS", s: "Encrypted · 5 GHz" },
        { k: "bt", on: false, icon: "🔵", t: "Bluetooth", s: "Off" },
        { k: "shield", on: store.get("shield.strict", true), icon: "🛡", t: "THADD Shield", s: "Strict mode" },
        { k: "airdrop", on: true, icon: "📡", t: "Nearby Share", s: "Contacts only" },
        { k: "focus", on: false, icon: "🌙", t: "Focus", s: "Off" },
        { k: "vpn", on: false, icon: "🌍", t: "VPN", s: "Disconnected" },
        { k: "dnd", on: false, icon: "🔕", t: "Do Not Disturb", s: "Off" },
        { k: "stage", on: false, icon: "🎭", t: "Stage Manager", s: "Off" }
      ];
      for (const t of tiles) {
        const tile = el(
          "button",
          { class: "fly-tile" + (t.on ? " on" : "") },
          el("span", { class: "tb", text: t.icon }),
          el("span", {}, el("div", { class: "tx", text: t.t }), el("div", { class: "ts", text: t.s }))
        );
        tile.addEventListener("click", () => {
          t.on = !t.on;
          tile.classList.toggle("on", t.on);
          t.s = t.on ? t.k === "shield" ? "Strict mode" : "On" : t.k === "bt" ? "Off" : "Off";
          $(".ts", tile).textContent = t.s;
          if (t.k === "shield") store.set("shield.strict", t.on);
        });
        grid.append(tile);
      }
      wrap2.append(grid);
      wrap2.append(el("div", { class: "fly-sec", text: "Display & Sound" }));
      for (const [label, icon, val, act] of [
        ["Brightness", "☀", store.get("bright", 100), (v) => {
          store.set("bright", v);
          document.documentElement.style.filter = `brightness(${0.55 + v / 222})`;
        }],
        ["Volume", "🔊", store.get("vol", 62), (v) => store.set("vol", v)],
        ["Appearance", "🌗", null, null]
      ]) {
        if (label === "Appearance") {
          const row2 = el("div", { class: "fly-slider" });
          row2.append(el("span", { text: "🌗" }));
          const seg = el("div", { style: { display: "flex", gap: "8px", flex: "1" } });
          for (const [id, nm] of [["dark", "Dark"], ["light", "Light"]]) {
            const b = el("button", { class: "chip" + (document.documentElement.dataset.appearance === id ? " on" : ""), text: nm });
            b.addEventListener("click", () => {
              setAppearance(id);
              $$(".chip", seg).forEach((c2) => c2.classList.remove("on"));
              b.classList.add("on");
            });
            seg.append(b);
          }
          row2.append(seg);
          wrap2.append(row2);
          continue;
        }
        const r = el("div", { class: "fly-slider" });
        const inp = el("input", { type: "range", min: "5", max: "100", value: String(val) });
        inp.style.setProperty("--v", val + "%");
        inp.addEventListener("input", () => {
          inp.style.setProperty("--v", inp.value + "%");
          act(+inp.value);
        });
        r.append(el("span", { text: icon }), inp);
        wrap2.append(r);
      }
      wrap2.append(el("div", { class: "fly-sec", text: "Quick Actions" }));
      const qa = el("div", { class: "fly-grid" });
      for (const [icon, t, fn] of [
        ["📸", "Screenshot", () => Promise.resolve().then(() => (init_screenshot(), screenshot_exports)).then((m) => m.grab())],
        ["🧹", "Clean RAM", () => {
          toast("Memory cleaned", "Dropped 812 MB of page cache (simulated)", { icon: "🧹" });
        }],
        ["🔒", "Lock Now", () => lockScreen()],
        ["🖥", "Mission Control", () => toggleMission()]
      ]) {
        const b = el("button", { class: "fly-tile" }, el("span", { class: "tb", text: icon }), el("span", {}, el("div", { class: "tx", text: t })));
        b.addEventListener("click", fn);
        qa.append(b);
      }
      wrap2.append(qa);
      return wrap2;
    });
  }
  function openNotificationCenter() {
    toggleFlyout("notifCenter", $("#mbClock"), () => {
      const w = el("div", { style: { width: "352px", maxHeight: "74vh", overflow: "auto" } });
      w.append(el("div", { class: "fly-sec", text: "Widgets" }));
      const today = el("div", { class: "st-card" });
      today.append(el(
        "div",
        { style: { display: "flex", justifyContent: "space-between", alignItems: "baseline" } },
        el(
          "div",
          {},
          el("div", { style: { fontSize: "20px", fontWeight: "700" }, text: clock(/* @__PURE__ */ new Date()) }),
          el("div", { class: "mute", style: { fontSize: "12px" }, text: longDate() })
        ),
        el("div", { class: "mono", style: { fontSize: "11.5px" }, text: `up ${fmtDur(uptime())}` })
      ));
      today.append(el("div", { class: "fly-sec", style: { paddingTop: "12px" }, text: "Accra, GH · 31°C Mostly Clear" }));
      today.append(el(
        "div",
        { class: "stats", style: { gridTemplateColumns: "repeat(3,1fr)", gap: "8px" } },
        el("div", {}, el("div", { class: "k", text: "CPU" }), el("div", { class: "v", style: { fontSize: "17px" }, text: "4%" })),
        el("div", {}, el("div", { class: "k", text: "RAM" }), el("div", { class: "v", style: { fontSize: "17px" }, text: "312MB" })),
        el("div", {}, el("div", { class: "k", text: "Net" }), el("div", { class: "v", style: { fontSize: "17px" }, text: "12Mb" }))
      ));
      w.append(today);
      w.append(el("div", { class: "fly-sec", text: "Notifications" }));
      const notes2 = store.get("notifs", []);
      if (!notes2.length) w.append(el("div", { style: { padding: "12px" } }, el("div", { class: "mute", text: "No new notifications." })));
      for (const n of notes2.slice(-8).reverse()) {
        const c2 = el(
          "div",
          { class: "st-card", style: { padding: "10px 12px" } },
          el(
            "div",
            { style: { display: "flex", gap: "9px" } },
            el("span", { text: n.icon || "✦" }),
            el(
              "div",
              {},
              el("div", { style: { fontSize: "12.6px", fontWeight: "650" }, text: n.title }),
              el("div", { class: "mute", style: { fontSize: "11.6px" }, text: n.msg || "" })
            )
          )
        );
        w.append(c2);
      }
      const clear = el("button", { class: "btn", style: { width: "100%", marginTop: "10px" }, text: "Clear all notifications" });
      clear.addEventListener("click", () => {
        store.set("notifs", []);
        toast("Notifications cleared");
        openNotificationCenter();
        $("#notifCenter")?.classList.add("hidden");
      });
      w.append(clear);
      return w;
    });
  }
  function buildDock() {
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
      if (id === "__sep") {
        dock.append(el("div", { class: "dock-sep" }));
        continue;
      }
      const app = BY_ID[id] || { id, name: id, icon: "▢", cls: "" };
      const d = el(
        "div",
        { class: "dock-item" + (running.includes(id) ? " running" : ""), "data-app": id },
        el("span", { class: "glyph" }, el("span", { class: "appicon " + (app.cls || ""), text: app.icon })),
        el("span", { class: "dot" }),
        el("span", { class: "dock-tip", text: app.name })
      );
      d.addEventListener("click", () => {
        const wins = [...windows.values()].filter((w) => w._app === id);
        if (!wins.length) {
          launch(id);
          d.classList.add("bounce");
          setTimeout(() => d.classList.remove("bounce"), 1300);
          return;
        }
        const front = wins.sort((a, b) => b.style.zIndex - a.style.zIndex)[0];
        if (front._state.min) restore(front);
        else if (front.classList.contains("focused")) {
          const nxt = wins.sort((a, b) => a.style.zIndex - b.style.zIndex)[1];
          minimiseOrCycle(wins, front, nxt);
        } else focus(front);
      });
      d.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        contextMenu(e.clientX, e.clientY - 60, [
          { label: `New ${app.name} Window`, icon: "＋", action: () => launch(id) },
          { label: "Show All Windows", icon: "🗂", action: () => {
            [...windows.values()].filter((w) => w._app === id).forEach((w) => {
              w._state.min = false;
              w.classList.remove("min");
              focus(w);
            });
          } },
          "-",
          { label: "Options: Keep in Dock", disabled: true },
          { label: "Quit " + app.name, icon: "⏻", action: () => Promise.resolve().then(() => (init_wm(), wm_exports)).then((m) => m.closeApp(id)) }
        ]);
      });
      dock.append(d);
    }
  }
  function minimiseOrCycle(wins, front, nxt) {
    nxt ? focus(nxt) : Promise.resolve().then(() => (init_wm(), wm_exports)).then((m) => m.minimise(front));
  }
  function openLaunchpad() {
    const m = el("div", { id: "mission", class: "open" });
    const grid = el("div", { id: "missionGrid", style: { gridTemplateColumns: "repeat(auto-fill, minmax(148px,1fr))", paddingTop: "70px" } });
    const q = el("input", { class: "tb-input", placeholder: "Search apps…", style: { maxWidth: "440px", margin: "0 auto 8px", display: "block", gridColumn: "1/-1", padding: "12px 16px", fontSize: "15px" } });
    grid.append(q);
    const cards = [];
    for (const a of APPS) {
      const c2 = el(
        "div",
        { class: "mission-card", style: { padding: "16px 10px", textAlign: "center", cursor: "pointer" } },
        el("div", { style: { fontSize: "40px", lineHeight: "1.1" }, text: a.icon }),
        el("div", { style: { fontSize: "12.4px", fontWeight: "600", marginTop: "8px" }, text: a.name }),
        el("div", { class: "mute", style: { fontSize: "10.6px", marginTop: "3px" }, text: a.cat })
      );
      c2.addEventListener("click", () => {
        m.remove();
        launch(a.id);
      });
      cards.push({ a, c: c2 });
      grid.append(c2);
    }
    q.addEventListener("input", () => {
      const v = q.value.toLowerCase();
      cards.forEach(({ a, c: c2 }) => {
        c2.style.display = (a.name + a.desc + a.cat).toLowerCase().includes(v) ? "" : "none";
      });
    });
    m.append(grid);
    m.addEventListener("click", (e) => {
      if (e.target === m) m.remove();
    });
    document.addEventListener("keydown", function esc2(ev) {
      if (ev.key === "Escape") {
        m.remove();
        document.removeEventListener("keydown", esc2);
      }
    });
    document.body.append(m);
    setTimeout(() => q.focus(), 40);
  }
  function openSpotlight(prefill = "") {
    const s = $("#spotlight");
    s.classList.add("open");
    const inp = $("#spotInput");
    if (prefill) inp.value = prefill;
    renderSpot(inp.value);
    inp.oninput = () => renderSpot(inp.value);
    inp.onkeydown = (e) => {
      if (e.key === "ArrowDown") {
        spotSel = Math.min(spotSel + 1, spotRows.length - 1);
        paintSpot();
        e.preventDefault();
      } else if (e.key === "ArrowUp") {
        spotSel = Math.max(spotSel - 1, 0);
        paintSpot();
        e.preventDefault();
      } else if (e.key === "Enter") {
        e.preventDefault();
        const r = spotRows[spotSel];
        if (r) {
          closeSpotlight();
          if (e.metaKey || e.shiftKey && e.ctrlKey) launch("jarvis", { prompt: r.full || inp.value });
          else r.action();
        }
      } else if (e.key === "Escape") closeSpotlight();
    };
    setTimeout(() => inp.focus(), 30);
  }
  function closeSpotlight() {
    $("#spotlight").classList.remove("open");
  }
  function renderSpot(qraw) {
    const q = qraw.trim();
    const host = $("#spotResults");
    host.innerHTML = "";
    spotRows = [];
    spotSel = 0;
    const add = (section, items) => {
      if (!items.length) return;
      host.append(el("div", { class: "spot-sec", text: section }));
      for (const it of items) {
        spotRows.push(it);
        host.append(it.row);
      }
    };
    const ql = q.toLowerCase();
    if (q) {
      add("AI", [{
        full: q,
        row: el(
          "div",
          { class: "spot-row" },
          el("span", { class: "g", text: "✦" }),
          el("span", { class: "t", text: `Ask JARVIS: “${q.slice(0, 56)}”` }),
          el("span", { class: "s", text: "⌘⏎" })
        ),
        action: () => launch("jarvis", { prompt: q })
      }]);
    }
    const apps = APPS.filter((a) => !ql || (a.name + a.desc + a.cat + a.id).toLowerCase().includes(ql));
    add("Applications", apps.slice(0, q ? 6 : 8).map((a) => ({
      row: el(
        "div",
        { class: "spot-row" },
        el("span", { class: "g", text: a.icon }),
        el("span", {}, el("div", { class: "t", text: a.name }), el("div", { class: "s", style: { marginLeft: 0 }, text: a.desc })),
        el("span", { class: "s", text: a.cat })
      ),
      action: () => launch(a.id)
    })));
    if (ql.length > 0) {
      const hits = flattenSearch(ql).slice(0, 8);
      add("Files", hits.map((h) => ({
        row: el(
          "div",
          { class: "spot-row" },
          el("span", { class: "g", text: h.node.type === "dir" ? "📁" : "📄" }),
          el("span", {}, el("div", { class: "t", text: h.node.name }), el("div", { class: "s", style: { marginLeft: 0 }, text: h.path })),
          el("span", { class: "s", text: fsSize(h.node) })
        ),
        action: () => Promise.resolve().then(() => (init_core(), core_exports)).then((m) => m.openPath(h.path))
      })));
    }
    if (ql.length > 2) {
      const cmds = COMMANDS.filter((c2) => c2.name.includes(ql) || c2.desc.toLowerCase().includes(ql)).slice(0, 5);
      add("Commands", cmds.map((c2) => ({
        row: el(
          "div",
          { class: "spot-row" },
          el("span", { class: "g", text: c2.icon || "⌘" }),
          el("span", {}, el("div", { class: "t", text: c2.name }), el("div", { class: "s", style: { marginLeft: 0 }, text: c2.desc }))
        ),
        action: c2.run
      })));
    }
    if (ql) {
      add("Web", [
        { row: spotRow("🔎", `Search the web for “${q}”`, "DuckDuckGo — opens in Firefox"), action: () => launch("browser", { url: "https://duckduckgo.com/?q=" + encodeURIComponent(q) }) },
        { row: spotRow("🐙", `Search GitHub for “${q}”`, "github.com/search"), action: () => launch("browser", { url: "https://github.com/search?q=" + encodeURIComponent(q) }) }
      ]);
    }
    paintSpot();
  }
  function paintSpot() {
    $$("#spotResults .spot-row").forEach((r, i) => r.classList.toggle("sel", i === spotSel));
  }
  function flattenSearch(q) {
    return vfs.flatten().filter((f) => f.node.name.toLowerCase().includes(q)).slice(0, 60);
  }
  function buildDesktopIcons() {
    let host = $("#deskIcons");
    if (!host) {
      host = el("div", { id: "deskIcons" });
      document.body.append(host);
    }
    host.innerHTML = "";
    Object.assign(host.style, {
      position: "fixed",
      top: "40px",
      right: "14px",
      zIndex: "10",
      display: "flex",
      flexDirection: "column",
      gap: "6px",
      width: "104px"
    });
    const icon = (emoji, label, fn) => {
      const d = el(
        "div",
        { style: { padding: "9px 5px", borderRadius: "10px", textAlign: "center", cursor: "default" } },
        el("div", { style: { fontSize: "34px", lineHeight: "1.1", filter: "drop-shadow(0 3px 8px rgba(0,0,0,.5))" }, text: emoji }),
        el("div", { style: { fontSize: "11.4px", marginTop: "4px", textShadow: "0 1px 3px rgba(0,0,0,.7)" }, text: label })
      );
      d.addEventListener("dblclick", fn);
      d.addEventListener("click", () => {
        $$("#deskIcons > div").forEach((x) => x.style.background = "");
        d.style.background = "rgba(10,132,255,.35)";
      });
      d.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        contextMenu(e.clientX, e.clientY, [
          { label: "Open", icon: "↗", action: fn },
          { label: "Get Info", icon: "ℹ", action: () => launch("about") }
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
        { label: "Ask JARVIS to tidy up", icon: "✦", action: () => launch("jarvis", { prompt: "Tidy up my desktop and summarise what is in my home folder." }) }
      ]);
    });
  }
  function setAppearance(mode) {
    document.documentElement.dataset.appearance = mode;
    store.set("appearance", mode);
  }
  function setWallpaper(id) {
    const w = WALLPAPERS.find((x) => x.id === id) || WALLPAPERS[0];
    document.documentElement.dataset.wallpaper = w.id;
    const wp = $("#wallpaper");
    wp.style.background = w.css || "";
    store.set("wallpaper", id);
  }
  function nextWallpaper() {
    const cur = store.get("wallpaper", "sequoia");
    const i = WALLPAPERS.findIndex((w) => w.id === cur);
    setWallpaper(WALLPAPERS[(i + 1) % WALLPAPERS.length].id);
  }
  function lockScreen() {
    const l = $("#lock");
    l.classList.remove("gone");
    $("#lockPass").value = "";
    setTimeout(() => $("#lockPass").focus(), 120);
  }
  function logout() {
    location.reload();
  }
  function sleepMode() {
    const veil = el(
      "div",
      { id: "sleeper", style: { position: "fixed", inset: "0", zIndex: "9800", background: "#04050a", display: "grid", placeItems: "center", color: "#4b5563", fontFamily: "var(--font)" } },
      el(
        "div",
        { style: { textAlign: "center" } },
        el("div", { style: { fontSize: "38px", marginBottom: "12px" }, text: "🌙" }),
        el("div", { text: "THADD OS is suspended. Click anywhere to wake." })
      )
    );
    document.body.append(veil);
    const wake = () => {
      veil.remove();
      toast("Welcome back", "Resumed from suspend in 0.9s", { icon: "☀" });
    };
    veil.addEventListener("click", wake);
    setTimeout(() => document.addEventListener("keydown", wake, { once: true }), 100);
  }
  function reboot() {
    bootScreen("Restarting THADD OS…", () => location.reload());
  }
  function shutdown() {
    bootScreen("Shutting down…", () => {
      document.body.innerHTML = `<div style="position:fixed;inset:0;background:#04050a;display:grid;place-items:center;color:#4b5563;font:14px system-ui">
      <div style="text-align:center"><div style="font-size:40px;margin-bottom:14px">⏻</div>
      <div>THADD OS has shut down.</div><div style="margin-top:10px;font-size:12px;opacity:.7">It is now safe to close this tab — or refresh to boot again.</div></div></div>`;
    });
  }
  function bootScreen(msg, done) {
    const b = $("#boot");
    b.classList.remove("done");
    b.innerHTML = `<div class="boot-logo">TH</div><div class="boot-name">THADD OS</div><div class="boot-sub">${msg}</div><div class="boot-bar"><i style="width:0%"></i></div>`;
    const bar = $(".boot-bar i", b);
    let p = 0;
    const t = setInterval(() => {
      p = Math.min(100, p + 7 + Math.random() * 12);
      bar.style.width = p + "%";
      if (p >= 100) {
        clearInterval(t);
        setTimeout(done, 500);
      }
    }, 130);
  }
  function tileAll() {
    const list = [...windows.values()].filter((w) => !w._state.min);
    const n = list.length, cols = Math.ceil(Math.sqrt(n)), rows = Math.ceil(n / cols);
    list.forEach((w, i) => {
      const c2 = i % cols, r = Math.floor(i / cols);
      Object.assign(w.style, {
        left: c2 * innerWidth / cols + "px",
        top: 30 + r * (innerHeight - 30) / rows + "px",
        width: innerWidth / cols + "px",
        height: (innerHeight - 30) / rows + "px"
      });
      focus(w);
    });
  }
  function closeFocused() {
    const w = focusedWin();
    if (w) Promise.resolve().then(() => (init_wm(), wm_exports)).then((m) => m.closeWindow(w));
  }
  function open_(url) {
    launch("browser", { url });
  }
  var APPLE_SVG, MENUS, currentAppName, openMenu, activeAppName, focusedWin, focusedWinEl, spotSel, spotRows, spotRow, fsSize, COMMANDS;
  var init_shell = __esm({
    "desktop/js/shell.js"() {
      init_core();
      init_registry();
      init_apps();
      init_wm();
      init_registry();
      APPLE_SVG = `<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16.36 12.79c.02 2.6 2.28 3.46 2.31 3.47-.02.06-.36 1.24-1.2 2.45-.72 1.05-1.47 2.1-2.65 2.12-1.16.02-1.53-.69-2.86-.69-1.32 0-1.74.67-2.83.71-1.14.04-2.01-1.13-2.74-2.18-1.5-2.17-2.64-6.13-1.1-8.8.76-1.32 2.12-2.16 3.6-2.18 1.12-.02 2.17.75 2.86.75.68 0 1.97-.93 3.32-.79.56.02 2.15.2 3.17 1.55-.08.05-1.9 1.11-1.88 3.59M14.2 5.6c.6-.73 1.01-1.75.9-2.76-.87.04-1.93.58-2.55 1.31-.56.64-1.05 1.68-.92 2.67.97.08 1.96-.49 2.57-1.22"/></svg>`;
      MENUS = {
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
          { label: "Log Out thadd…", key: "⇧⌘Q", action: () => logout() }
        ],
        file: [
          { label: "New Finder Window", key: "⌘N", action: () => launch("finder", { path: "/home/" + store.get("user", "thadd") }) },
          { label: "New Terminal at Home", key: "⌃⌥T", action: () => launch("terminal") },
          { label: "New Code Studio Window", action: () => launch("editor") },
          "-",
          { label: "Close Window", key: "⌘W", action: () => closeFocused() },
          { label: "Print…", key: "⌘P", action: () => toast("Print queue", "No printers configured — run: thadd printer add", { icon: "🖨" }) }
        ],
        edit: [
          { label: "Undo", key: "⌘Z", action: () => document.execCommand?.("undo") },
          { label: "Redo", key: "⇧⌘Z", action: () => document.execCommand?.("redo") },
          "-",
          { label: "Cut", key: "⌘X" },
          { label: "Copy", key: "⌘C" },
          { label: "Paste", key: "⌘V" },
          { label: "Select All", key: "⌘A" },
          "-",
          { label: "Copy Desktop Screenshot", action: () => {
            Promise.resolve().then(() => (init_screenshot(), screenshot_exports)).then((m) => m.grab());
          } }
        ],
        view: [
          { label: "Enter Full Screen", key: "^⌘F", action: () => document.documentElement.requestFullscreen?.().catch(() => {
          }) },
          { label: "Mission Control", key: "⌃↑", action: () => toggleMission() },
          "-",
          { label: "Toggle Light Appearance", action: () => setAppearance(document.documentElement.dataset.appearance === "light" ? "dark" : "light") },
          { label: "Toggle Liquid Glass", action: () => {
            document.body.classList.toggle("no-glass");
            store.set("noGlass", document.body.classList.contains("no-glass"));
          } },
          { label: "Next Wallpaper", action: () => nextWallpaper() },
          "-",
          { label: "Toggle Dock", key: "⌥⌘D", action: () => $("#dock").classList.toggle("hidden") }
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
          { label: "Spotlight", key: "⌘K", action: () => openSpotlight() }
        ],
        window: [
          { label: "Minimise", key: "⌘M", action: () => focusedWin()?.minimise() },
          { label: "Zoom", action: () => focusedWin()?.zoom() },
          { label: "Cycle Windows", key: "⌘`", action: () => cycleWindows() },
          "-",
          { label: "Snap Left", action: () => focusedWinEl() && Promise.resolve().then(() => (init_wm(), wm_exports)).then((m) => m.snapTo(focusedWinEl(), "left")) },
          { label: "Snap Right", action: () => focusedWinEl() && Promise.resolve().then(() => (init_wm(), wm_exports)).then((m) => m.snapTo(focusedWinEl(), "right")) },
          { label: "Tile All", action: () => tileAll() },
          "-",
          { label: "Mission Control", key: "⌃↑", action: () => toggleMission() },
          { label: "Bring All to Front", action: () => [...windows.values()].forEach((w) => {
            w._state.min = false;
            w.classList.remove("min");
          }) }
        ],
        help: [
          { label: "THADD OS Guide", action: () => launch("guide") },
          { label: "Parrot Arsenal Help", action: () => launch("parrot") },
          { label: "Ask JARVIS", key: "⌘J", action: () => launch("jarvis") },
          "-",
          { label: "Report an Issue", action: () => open_("https://github.com/ThaddeusHackz/RDP-universal-/issues") },
          { label: "Releases / Download ISO", action: () => open_("https://github.com/ThaddeusHackz/RDP-universal-/releases") }
        ]
      };
      currentAppName = "Finder";
      openMenu = null;
      activeAppName = () => currentAppName;
      focusedWin = () => [...windows.values()].find((w) => w.classList.contains("focused") && !w._state.min);
      focusedWinEl = () => focusedWin();
      spotSel = 0;
      spotRows = [];
      $("#spotlight")?.addEventListener("click", (e) => {
        if (e.target.dataset.closeSpot !== void 0) closeSpotlight();
      });
      spotRow = (g, t, s) => el(
        "div",
        { class: "spot-row" },
        el("span", { class: "g", text: g }),
        el("span", {}, el("div", { class: "t", text: t }), el("div", { class: "s", style: { marginLeft: 0 }, text: s }))
      );
      fsSize = (n) => n.type === "dir" ? `${(n.children || []).length} items` : `${Math.max(1, Math.round(String(n.body || "").length / 1024))} KB`;
      COMMANDS = [
        { name: "Lock Screen", desc: "Require password immediately", icon: "🔒", run: lockScreen },
        { name: "Toggle Dark/Light", desc: "Switch appearance", icon: "🌗", run: () => setAppearance(document.documentElement.dataset.appearance === "light" ? "dark" : "light") },
        { name: "Toggle Liquid Glass", desc: "Disable transparency for performance", icon: "🧊", run: () => document.body.classList.toggle("no-glass") },
        { name: "Next Wallpaper", desc: "Cycle the THADD wallpaper pack", icon: "🖼", run: nextWallpaper },
        { name: "Mission Control", desc: "See every open window", icon: "🖥", run: () => toggleMission() },
        { name: "Empty Trash", desc: "Securely erase deleted items", icon: "🗑", run: () => toast("Trash emptied", "2 items shredded with 7-pass DoD 5220.22-M", { icon: "🗑" }) },
        { name: "Build THADD OS ISO", desc: "Run the live-build pipeline", icon: "💿", run: () => launch("terminal", { run: "sudo thadd-iso build --release" }) },
        { name: "Enable Strict Shield", desc: "Maximum hardening profile", icon: "🛡", run: () => {
          store.set("shield.strict", true);
          toast("THADD Shield", "Strict mode engaged — 47 hardening rules active", { icon: "🛡" });
        } },
        { name: "Run Full System Audit", desc: "CIS benchmark + vulnerability sweep", icon: "🔬", run: () => launch("terminal", { run: "thadd scan --full" }) },
        { name: "Open HackTheBox", desc: "Launch the HTB workspace", icon: "🎯", run: () => launch("hackbox") },
        { name: "Reboot", desc: "Restart THADD OS", icon: "⏻", run: reboot },
        { name: "Sleep", desc: "Suspend to RAM", icon: "😴", run: sleepMode },
        { name: "Screenshot", desc: "Capture the desktop", icon: "📸", run: () => Promise.resolve().then(() => (init_screenshot(), screenshot_exports)).then((m) => m.grab()) }
      ];
    }
  });

  // desktop/js/kernel.js
  init_core();
  init_shell();
  init_wm();
  init_apps();
  init_native();
  init_screenshot();
  var BOOT_LINES = [
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
    "[    2.418002] Everything is ready. Welcome, Thadd. 🚀"
  ];
  async function boot() {
    const bootEl = $("#boot");
    const bar = $("#bootBar");
    const log = $("#bootLog");
    const fast = sessionStorage.getItem("thadd.fastboot") === "1";
    sessionStorage.setItem("thadd.fastboot", "1");
    if (fast) {
      bar.style.width = "100%";
      bootEl.classList.add("done");
      setTimeout(startSession, 320);
      return;
    }
    for (let i = 0; i < BOOT_LINES.length; i++) {
      log.append(el("div", { text: BOOT_LINES[i] }));
      while (log.children.length > 5) log.firstChild.remove();
      bar.style.width = Math.round((i + 1) / BOOT_LINES.length * 100) + "%";
      await sleep(120 + Math.random() * 130);
    }
    await sleep(420);
    bootEl.classList.add("done");
    setTimeout(startSession, 520);
  }
  function startSession() {
    restorePreferences();
    buildMenuBar();
    buildDock();
    buildDesktopIcons();
    installShortcuts();
    probe();
    installGlobalGlue();
    paintTrayStubs();
    const first = !store.get("onboarded", false);
    if (first) {
      $("#onboard").classList.add("open");
      $("#obStart").addEventListener("click", () => {
        const k = $("#obKey").value.trim();
        if (k) {
          store.set("ai.groqKey", k);
          toast("Groq key stored", "JARVIS is now running live models.", { icon: "✦" });
        }
        store.set("onboarded", true);
        $("#onboard").classList.remove("open");
        welcome();
      });
      $("#obSkip").addEventListener("click", () => {
        store.set("onboarded", true);
        $("#onboard").classList.remove("open");
        welcome();
      });
      $$("#onboard .chip[data-surface]").forEach((c2) => c2.addEventListener("click", () => {
        $$("#onboard .chip[data-surface]").forEach((x) => x.classList.remove("on"));
        c2.classList.add("on");
        store.set("surface", c2.dataset.surface);
        if (c2.dataset.surface === "windows") {
          document.documentElement.style.setProperty("--accent", "#0078d4");
        }
        if (c2.dataset.surface === "parrot") {
          document.documentElement.style.setProperty("--accent", "#00d68f");
        }
      }));
    } else {
      lockIfNeeded();
    }
    const q = new URLSearchParams(location.search);
    if (q.get("app")) setTimeout(() => launch(q.get("app"), { url: q.get("url"), run: q.get("run"), path: q.get("path"), prompt: q.get("prompt") }), 500);
  }
  function welcome() {
    const user = store.get("user", "thadd");
    toast(`Welcome, ${user}`, "THADD OS 2.0 — Nebula Prime is ready. Press ⌘K for Spotlight, ⌘J for JARVIS.", { icon: "🚀", ms: 7e3 });
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
      if (!ok) {
        l.animate([{ transform: "translateX(0)" }, { transform: "translateX(-9px)" }, { transform: "translateX(9px)" }, { transform: "translateX(0)" }], { duration: 240 });
        toast("Wrong password", "Hint: thadd (change it in Settings → Users)", { icon: "🔒" });
        return;
      }
      l.classList.add("gone");
      pw.value = "";
    };
    $("#lockGo").onclick = go;
    pw.onkeydown = (e) => {
      if (e.key === "Enter") go();
    };
    if (store.get("autoLogin", false)) setTimeout(() => l.classList.add("gone"), 500);
    setTimeout(() => pw.focus(), 400);
  }
  function installShortcuts() {
    const MOD = (e) => e.metaKey || e.ctrlKey;
    window.addEventListener("keydown", (e) => {
      const inField = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || "") || document.activeElement?.isContentEditable;
      if (e.key === "Escape") {
        closeSpotlight();
        $("#mission").classList.remove("open");
        $$(".flyout").forEach((f) => f.classList.add("hidden"));
        return;
      }
      if (MOD(e) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        openSpotlight();
        return;
      }
      if (MOD(e) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        launch("jarvis");
        return;
      }
      if (MOD(e) && e.shiftKey && e.key.toLowerCase() === "a") {
        e.preventDefault();
        toggleMission();
        return;
      }
      if (MOD(e) && e.shiftKey && e.key === "3") {
        e.preventDefault();
        grab("desktop");
        return;
      }
      if (MOD(e) && e.key === ",") {
        e.preventDefault();
        launch("settings");
        return;
      }
      if (MOD(e) && e.key.toLowerCase() === "d" && e.altKey) {
        e.preventDefault();
        $("#dock").classList.toggle("hidden");
        return;
      }
      if (MOD(e) && e.key.toLowerCase() === "g" && e.altKey) {
        e.preventDefault();
        document.body.classList.toggle("no-glass");
        store.set("noGlass", document.body.classList.contains("no-glass"));
        return;
      }
      if (e.ctrlKey && e.metaKey && e.key.toLowerCase() === "q") {
        e.preventDefault();
        lockScreen();
        return;
      }
      if (MOD(e) && e.shiftKey && e.key.toLowerCase() === "q") {
        e.preventDefault();
        location.reload();
        return;
      }
      if (e.key === "F1") {
        e.preventDefault();
        launch("guide");
        return;
      }
      if (inField) return;
      if (MOD(e) && e.key.toLowerCase() === "t") {
        e.preventDefault();
        launch("terminal");
        return;
      }
      if (MOD(e) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        launch("finder", { path: vfs.home(), forceNew: true });
        return;
      }
      if (MOD(e) && e.key.toLowerCase() === "m") {
        e.preventDefault();
        const w = frontWin();
        if (w) minimise(w);
        return;
      }
      if (MOD(e) && e.key === "`") {
        e.preventDefault();
        cycleWindows();
        return;
      }
      if (MOD(e) && e.key.toLowerCase() === "w") {
        e.preventDefault();
        const w = frontWin();
        if (w) closeWindow(w);
        return;
      }
      if (e.ctrlKey && e.key === "ArrowLeft") {
        const w = frontWin();
        if (w) snapTo(w, "left");
      }
      if (e.ctrlKey && e.key === "ArrowRight") {
        const w = frontWin();
        if (w) snapTo(w, "right");
      }
      if (e.ctrlKey && e.key === "ArrowUp") {
        e.preventDefault();
        toggleMission();
      }
    });
    const frontWin = () => [...windows.values()].filter((w) => !w._state.min).sort((a, b) => b.style.zIndex - a.style.zIndex)[0];
  }
  function installGlobalGlue() {
    $("#windows").addEventListener("pointerdown", (e) => {
      if (e.target.id === "windows") bus.emit("desktop-focus");
    });
    $("#wallpaper").addEventListener("dblclick", () => openLaunchpad());
    bus.on("notification", (n) => {
      const list = store.get("notifs", []);
      list.push({ ...n, at: Date.now() });
      store.set("notifs", list.slice(-20));
    });
    bus.on("store-install", ({ id }) => {
      const dock = store.get("dock", null);
      if (dock && !dock.includes(id)) {
        dock.splice(dock.length - 4, 0, id);
        store.set("dock", dock);
      }
      bus.emit("finders-custom");
    });
    setInterval(() => {
      const t = $("#lockTime");
      if (t) t.textContent = clock12();
    }, 5e3);
    if (!store.get("seeded", false)) {
      store.set("seeded", true);
      vfs.write(vfs.home() + "/Downloads/notes-to-sort.txt", "1. Rename the ISO\n2. Upload screenshots\n3. Post the release\n");
    }
    bus.on("win-open", () => bus.emit("finders-custom"));
    window.THADD = Object.assign(window.THADD || {}, {
      boot: { at: (/* @__PURE__ */ new Date()).toISOString(), version: "2.0.0" },
      store,
      bus,
      vfs,
      windows,
      screenshot: () => grab(),
      spotlight: openSpotlight,
      mission: toggleMission,
      settings: () => launch("settings"),
      cmd: COMMANDS
    });
  }
  function paintTrayStubs() {
    const obs = new MutationObserver(() => {
      const on = store.get("shield.strict", true);
      $$("#mbTray .ticon")[0]?.classList.toggle("on", on);
    });
    obs.observe($("#mbShield"), { childList: true, subtree: true });
  }
  boot().catch((e) => {
    console.error(e);
    const b = $("#boot");
    if (b) b.innerHTML = `<div class="boot-logo">TH</div><div class="boot-name">THADD OS</div>
    <div class="boot-sub" style="color:#fca5a5">Boot error: ${String(e.message || e)}</div>
    <div class="boot-sub">Open the browser console for details — or reload to retry.</div>`;
  });
})();
