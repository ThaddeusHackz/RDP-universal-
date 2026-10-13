/* ============================================================================
   THADD OS — the apps. Every one of them talks to the real OS through THADD.call.
   ========================================================================== */
(function () {
  "use strict";
  const h = THADD.h, esc = THADD.esc;
  const APPS = (THADD.apps = {});

  function btn(label, fn, cls) {
    const b = h("button", { class: "btn " + (cls || "") }, label);
    b.onclick = fn;
    return b;
  }
  function pad(...nodes) { return h("div", { class: "app-pad" }, ...nodes); }
  function card(title, value, sub) {
    return h("div", { class: "card" }, h("h5", {}, title), h("div", { class: "big" }, value), sub ? h("div", { class: "sub" }, sub) : null);
  }
  function loading(text) { return h("div", { class: "app-pad" }, h("div", { class: "sub" }, text || "Loading…")); }

  /* ================================================================== AI chat */
  function openAI(args) {
    const log = h("div", { class: "chat-log" });
    const input = h("textarea", { placeholder: "Ask THADD to do something on this machine…  (⌘⏎ to send)" });
    const modeSel = h("select", { class: "btn", style: { padding: "8px" } },
      ...[["agent", "Agent (do it)"], ["chat", "Chat only"], ["plan", "Plan first"]].map(([v, l]) => h("option", { value: v }, l)));
    const modelSel = h("select", { class: "btn", style: { padding: "8px" } });
    const send = btn("Send", () => submit(), "primary");
    const body = h("div", { class: "chat" }, log,
      h("div", { class: "chat-input" }, modeSel, modelSel, input, send));
    const win = THADD.wm.open({ app: "ai", title: "THADD AI — OS agent", icon: "✦", width: 980, height: 680, body,
      footer: "Every action is audited to ~/.thadd/agent-audit.jsonl · approvals required unless Autopilot" });

    function bubble(cls, text) {
      const el = h("div", { class: "msg " + cls });
      if (cls === "ai") el.innerHTML = THADD.md(text); else el.textContent = text;
      log.append(el);
      log.scrollTop = log.scrollHeight;
      return el;
    }
    bubble("ai", "**THADD AI online.** I can read and write files, run commands, manage packages and services, scan and harden this machine, take screenshots and drive the GUI, and analyse disks.\n\nTry: *“what is using my disk?”*, *“harden this system”*, *“analyse /dev/sdb and tell me which OS it was”*.");

    THADD.call("ai.models", {}).then((r) => {
      modelSel.innerHTML = "";
      (r.models || []).slice(0, 12).forEach((m) => modelSel.append(h("option", { value: m.id, selected: m.id === r.current }, m.label || m.id)));
    }).catch(() => {
      ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "openai/gpt-oss-120b"].forEach((m) => modelSel.append(h("option", { value: m }, m)));
    });

    THADD.call("ai.presets", {}).then((r) => {
      const bar = h("div", { style: { display: "flex", gap: "7px", flexWrap: "wrap", padding: "10px 14px 0" } });
      (r.presets || []).forEach((p) => {
        const chip = h("span", { class: "pill", style: { cursor: "pointer" } }, p.id.replace("_", " "));
        chip.title = p.prompt;
        chip.onclick = () => { input.value = p.prompt; submit(); };
        bar.append(chip);
      });
      body.prepend(bar);
    });

    const pendingApprovals = new Map();
    let currentStream = null;

    async function submit() {
      const prompt = input.value.trim();
      if (!prompt) return;
      input.value = "";
      bubble("user", prompt);
      const ai = bubble("ai", "…");
      let text = "";
      const tools = h("div", {}, "");
      log.append(tools);
      try {
        const res = await THADD.stream("ai.chat", { prompt, model: modelSel.value, mode: modeSel.value, history: [] }, {
          onEvent: (ev) => {
            if (ev.type === "token") {
              text += ev.text;
              ai.innerHTML = THADD.md(text);
              log.scrollTop = log.scrollHeight;
            } else if (ev.type === "tool_call") {
              const row = h("div", { class: "tool-call" }, `▶ ${ev.tool}(${JSON.stringify(ev.args || {}).slice(0, 120)})`);
              tools.append(row);
              log.scrollTop = log.scrollHeight;
            } else if (ev.type === "tool_result") {
              const ok = ev.ok !== false;
              tools.append(h("div", { class: "tool-call", style: { color: ok ? "#9ae6b4" : "#ffb4b4" } },
                `  ${ok ? "✔" : "✘"} ${ev.tool} → ${typeof ev.preview === "object" ? JSON.stringify(ev.preview).slice(0, 160) : String(ev.preview || "").slice(0, 160)}`));
              log.scrollTop = log.scrollHeight;
            } else if (ev.type === "approval_request") {
              askApproval(ev, tools);
            } else if (ev.type === "snapshot") {
              tools.append(h("div", { class: "tool-call", style: { color: "#9ad0ff" } }, `⟲ snapshot ${ev.snapshot} created before edits`));
            } else if (ev.type === "error") {
              ai.innerHTML = THADD.md(text + `\n\n**Error:** ${esc(ev.message)}`);
            } else if (ev.type === "done") {
              if (!text) ai.innerHTML = THADD.md("_Done._");
              THADD.wm.renderNotifications && THADD.call("shell.notify", { title: "THADD AI finished", body: prompt.slice(0, 90), app: "AI" });
            }
          },
          onEnd: () => { if (!text) ai.textContent = "(no output)"; },
        });
        currentStream = res.streamId;
      } catch (err) {
        ai.innerHTML = THADD.md(`**Could not reach the AI service:** ${esc(err.message || err)}\n\nThe offline assistant is still available — try the buttons below or check Settings → AI for your Groq key.`);
        const localBtn = btn("Use offline assistant", async () => {
          const r = await THADD.call("ai.local", { prompt });
          bubble("ai", r.text);
        });
        ai.append(h("div", { style: { marginTop: "10px" } }, localBtn));
      }
    }

    function askApproval(ev, container) {
      const box = h("div", { class: "msg sys", style: { alignSelf: "stretch", maxWidth: "100%" } },
        h("div", {}, `⚠ THADD AI wants to run **${esc(ev.tool)}**`),
        h("pre", {}, JSON.stringify(ev.args, null, 1).slice(0, 600)),
        h("div", { style: { display: "flex", gap: "8px", marginTop: "8px" } },
          btn("Allow", async () => { await THADD.call("ai.approve", { id: ev.id, allow: true }); box.remove(); }, "primary"),
          btn("Deny", async () => { await THADD.call("ai.approve", { id: ev.id, allow: false }); box.remove(); }, "danger")));
      container.append(box);
      log.scrollTop = log.scrollHeight;
    }

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey || !e.shiftKey)) { e.preventDefault(); submit(); }
    });
    if (args && args.prompt) { input.value = args.prompt; submit(); }
    THADD.openAI = () => THADD.wm.open({ app: "ai", title: "THADD AI", body: h("div", { class: "app-pad" }, "AI window already open") });
    return win;
  }

  /* ================================================================ terminal */
  function openTerminal(args) {
    const out = h("div", { class: "term" });
    const cmdInput = h("input", { placeholder: "type a command and press ↵", autocomplete: "off" });
    const profileSel = h("select", { class: "btn", style: { padding: "5px" } });
    let streamId = null, buffer = "";

    const body = h("div", { style: { display: "flex", flexDirection: "column", height: "100%" } },
      out, h("div", { class: "terminal-input" }, profileSel, cmdInput));
    const win = THADD.wm.open({
      app: "terminal", title: "Terminal — thadd@thadd-os", icon: "▶", width: 940, height: 600, body,
      footer: "Real PTY (bash / zsh / fish / pwsh / python / node / sqlite) — output streams live",
    });

    function paint() {
      out.textContent = buffer
        .replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, "")
        .replace(/\x1b\][^\x07]*\x07/g, "")
        .replace(/\r(?!\n)/g, "\n");
      out.scrollTop = out.scrollHeight;
    }
    function note(text, cls) {
      out.append(h("span", { class: cls || "cmd" }, text));
      out.scrollTop = out.scrollHeight;
    }

    THADD.call("term.shells", {}).then((r) => {
      profileSel.innerHTML = "";
      (r.profiles || []).forEach((p) => profileSel.append(h("option", { value: p.id }, p.label)));
      start(profileSel.value || "bash");
    }).catch(() => start("bash"));

    // raw PTY output arrives as {id, data} on the stream.chunk event
    const offChunk = THADD.on("stream.chunk", (d) => { if (d.id === streamId) { buffer += d.data; paint(); } });
    const offEnd = THADD.on("stream.end", (d) => { if (d.id === streamId) note("\n[session ended]\n", "err"); });

    async function start(profile) {
      out.innerHTML = "";
      buffer = "";
      try {
        const res = await THADD.call("term.open", { profile, cols: 110, rows: 30 });
        streamId = res.stream_id || res.streamId;
        note(`[thadd] ${profile} session opened (pid ${res.pid}) — ${res.cwd}\n`);
        if (args && args.cmd) setTimeout(() => run(args.cmd), 500);
      } catch (err) {
        note(`[thadd] cannot open a PTY: ${err.message || err}\n`, "err");
      }
    }

    async function run(line) {
      if (!streamId) return;
      note(`thadd@thadd-os:~$ ${line}\n`, "cmd");
      try {
        const r = await THADD.call("term.input", { stream_id: streamId, data: line + "\n" });
        return r;
      } catch (err) {
        // fall back to one-shot execution if the PTY is gone
        const r = await THADD.call("term.exec", { cmd: line });
        note((r.stdout || "") + (r.stderr || ""), r.ok ? "out" : "err");
      }
    }

    cmdInput.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      const line = cmdInput.value;
      cmdInput.value = "";
      run(line);
    });
    profileSel.onchange = () => start(profileSel.value);
    window.addEventListener("resize", () => { if (streamId) THADD.call("term.resize", { stream_id: streamId, cols: 110, rows: 30 }).catch(() => {}); });
    const onClose = () => {
      offChunk(); offEnd();
      if (streamId) THADD.call("term.close", { stream_id: streamId }).catch(() => {});
    };
    return Object.assign(win, { onClose });
  }

  APPS.open = function (id, args) {
    args = args || {};
    const fn = REGISTRY[id];
    if (fn) return fn(args);
    return THADD.wm.open({ app: id, title: id, body: pad(h("div", {}, `No such app: ${id}`)) });
  };

  const REGISTRY = {
    ai: openAI,
    terminal: openTerminal,
  };

  /* files is defined properly here (see above stub removal) */
  REGISTRY.files = function (args) {
    const side = h("div", { class: "sidebar" });
    const main = h("main", {}, loading());
    const pathLabel = h("div", { class: "sub", style: { padding: "10px 14px" } }, args.path || "~");
    const searchInput = h("input", { placeholder: "Search files (name or content)…", style: { padding: "7px 11px", borderRadius: "10px", border: "1px solid var(--stroke)", background: "var(--panel-2)", outline: "none", width: "240px" } });
    const body = h("div", { class: "split" }, side, h("div", { style: { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" } },
      h("div", { style: { display: "flex", gap: "10px", alignItems: "center", padding: "10px 14px", borderBottom: "1px solid var(--stroke)" } },
        btn("↑ Up", () => list(current.parent || "~")), btn("⟲", () => list(currentPath)), btn("New folder", async () => {
          const name = prompt("Folder name");
          if (name) { await THADD.call("fs.mkdir", { path: currentPath.replace(/\/$/, "") + "/" + name }); list(currentPath); }
        }), btn("New file", async () => {
          const name = prompt("File name", "untitled.txt");
          if (name) { await THADD.call("fs.write", { path: currentPath.replace(/\/$/, "") + "/" + name, text: "" }); list(currentPath); }
        }), searchInput, pathLabel), main));
    const win = THADD.wm.open({ app: "files", title: "Files", icon: "▤", width: 1020, height: 680, body, footer: "Right-click any file for actions · double-click to open" });
    let currentPath = args.path || "~", current = {};

    THADD.call("fs.home", {}).then((r) => {
      side.innerHTML = "";
      Object.entries(r.places || {}).forEach(([name, path]) => {
        const item = h("div", { class: "item" }, h("span", {}, "▸"), h("span", {}, name));
        item.onclick = () => list(path);
        side.append(item);
      });
      const snap = h("div", { class: "item" }, h("span", {}, "⟲"), h("span", {}, "Snapshots"));
      snap.onclick = () => THADD.apps.open("snapshots");
      side.append(snap);
      const roots = h("div", { class: "item" }, h("span", {}, "◉"), h("span", {}, "Disks & mounts"));
      roots.onclick = async () => {
        const m = await THADD.call("fs.mounts", {});
        main.innerHTML = "";
        m.mounts.forEach((mm) => main.append(h("div", { class: "row", onclick: () => list(mm.mount) },
          h("div", { class: "g" }, "▣"), h("div", { class: "t" }, h("b", {}, mm.mount), h("small", {}, `${mm.device} · ${mm.fstype}`)))));
      };
      side.append(roots);
      list(currentPath);
    });

    async function list(path) {
      main.innerHTML = "";
      main.append(loading());
      try {
        const r = await THADD.call("fs.list", { path, show_hidden: false });
        current = r; currentPath = r.path;
        pathLabel.textContent = `${r.path} — ${r.count} items · ${THADD.bytes(r.total_size)} · ${THADD.bytes(r.free)} free`;
        main.innerHTML = "";
        if (r.banner) main.append(h("div", { class: "pill", style: { margin: "10px 14px" } }, r.banner));
        const listBox = h("div", { style: { padding: "4px 8px 16px" } });
        r.entries.forEach((e) => {
          const row = h("div", { class: "row", title: e.path },
            h("div", { class: "g" }, e.dir ? "▤" : e.image ? "▣" : e.code ? "⌘" : e.archive ? "🗜" : "▫"),
            h("div", { class: "t" }, h("b", {}, e.name), h("small", {}, `${e.dir ? "folder" : THADD.bytes(e.size)} · ${new Date(e.mtime * 1000).toLocaleString()} · ${e.mode}`)),
            h("div", {}, e.dir ? "" : h("span", { class: "pill" }, e.mime ? e.mime.split("/")[0] : e.kind)));
          row.ondblclick = () => e.dir ? list(e.path) : openPath(e.path);
          row.oncontextmenu = (ev) => {
            ev.preventDefault(); ev.stopPropagation();
            const menu = h("div", { class: "panel open", style: { left: ev.clientX + "px", top: ev.clientY + "px", right: "auto", width: "220px", padding: "6px" } });
            [["Open", () => openPath(e.path)],
             ["Open in editor", () => THADD.apps.open("editor", { path: e.path })],
             ["Hash (sha256)", async () => { const r2 = await THADD.call("security.hash", { path: e.path }); THADD.toast("SHA-256", r2.sha256, "success"); }],
             ["Analyse (reverse engineering)", async () => { const r2 = await THADD.call("security.analyze", { path: e.path }); THADD.apps.open("forensics", { file: e.path, result: r2 }); }],
             ["Ask AI about this file", () => THADD.apps.open("ai", { prompt: `Explain ${e.path} — what is it and is anything suspicious?` })],
             ["Move to trash", async () => { await THADD.call("fs.trash", { path: e.path }); list(currentPath); THADD.toast("Moved to trash", e.path, "info"); }]].forEach(([label, fn]) => {
              const it = h("div", { class: "row" }, h("div", { class: "t" }, h("b", {}, label)));
              it.onclick = () => { menu.remove(); fn(); };
              menu.append(it);
            });
            document.body.append(menu);
            setTimeout(() => document.addEventListener("click", () => menu.remove(), { once: true }), 10);
          };
          listBox.append(row);
        });
        main.append(listBox);
      } catch (err) {
        main.innerHTML = "";
        main.append(pad(h("div", { class: "pill bad" }, "Cannot open folder"), h("p", {}, String(err.message || err))));
      }
    }
    function openPath(path) {
      if (/\.(txt|md|json|py|js|css|html|sh|yml|yaml|toml|conf|log|c|cpp|h|rs|go|ini|cfg|xml|csv)$/i.test(path)) {
        THADD.apps.open("editor", { path });
      } else if (/\.(png|jpg|jpeg|gif|webp|bmp|svg)$/i.test(path)) {
        THADD.wm.open({ app: "viewer", title: path.split("/").pop(), width: 860, height: 640,
          body: h("div", { class: "app-pad" }, h("img", { src: `/api/fs.read?path=${encodeURIComponent(path)}&binary=1`, style: { maxWidth: "100%" } })) });
      } else {
        THADD.apps.open("editor", { path });
      }
    }
    return win;
  };

  /* ================================================================ AI-driven */
  const CODE_COLORS = [
    [/\b(def|class|import|from|return|if|else|elif|for|while|try|except|with|as|lambda|async|await|yield)\b/g, "#c792ea"],
    [/\b(True|False|None|self|this|const|let|var|function|new|typeof|null|undefined)\b/g, "#82aaff"],
    [/(#[^\n]*|\/\/[^\n]*)/g, "#5c6773"],
    [/"([^"\n]*)"/g, "#c3e88d"],
  ];
  function highlight(code, ext) {
    let out = esc(code);
    CODE_COLORS.forEach(([re, color]) => { out = out.replace(re, (m) => `<span style="color:${color}">${m}</span>`); });
    return out;
  }

  REGISTRY.editor = function (args) {
    const tabs = h("div", { style: { display: "flex", gap: "6px", padding: "8px 12px", borderBottom: "1px solid var(--stroke)", alignItems: "center" } });
    const area = h("textarea", { spellcheck: "false", style: {
      width: "100%", height: "100%", border: "none", outline: "none", resize: "none", padding: "14px",
      background: "transparent", fontFamily: "var(--mono)", fontSize: "13px", color: "var(--text)", lineHeight: "1.6" } });
    const preview = h("pre", { style: { display: "none", padding: "14px", margin: 0, fontFamily: "var(--mono)", fontSize: "13px", overflow: "auto", height: "100%" } });
    const status = h("div", {}, "");
    let path = args.path || "~/Desktop/untitled.txt";
    let dirty = false;
    const body = h("div", { style: { display: "flex", flexDirection: "column", height: "100%" } },
      tabs, h("div", { style: { flex: 1, position: "relative", overflow: "hidden" } }, area, preview));
    const win = THADD.wm.open({ app: "editor", title: "Editor — " + path.split("/").pop(), icon: "⌘", width: 1040, height: 700, body, footer: status });

    const fileTab = h("span", { class: "pill" }, path.split("/").pop());
    tabs.append(fileTab);
    const aiBtn = btn("✦ Ask AI to review", () => THADD.apps.open("ai", { prompt: `Review ${path} for bugs and security issues, then propose a patch.` }), "primary");
    const fmtBtn = btn("Highlight", () => {
      preview.innerHTML = highlight(area.value, path.split(".").pop());
      preview.style.display = preview.style.display === "none" ? "block" : "none";
      area.style.display = area.style.display === "none" ? "block" : "none";
    });
    const saveBtn = btn("Save ⌘S", () => save(), "primary");
    tabs.append(aiBtn, fmtBtn, saveBtn);

    async function load() {
      try {
        const r = await THADD.call("fs.read", { path });
        area.value = r.text !== undefined ? r.text : "(binary file — use Forensics → Analyse)";
        status.textContent = `${r.path} · ${THADD.bytes(r.size)} · saved ${new Date().toLocaleTimeString()}`;
      } catch (err) {
        area.value = "";
        status.textContent = String(err.message || err);
      }
    }
    async function save() {
      try {
        const r = await THADD.call("fs.write", { path, text: area.value });
        dirty = false;
        THADD.toast("Saved", r.path, "success");
        status.textContent = `${r.path} · ${THADD.bytes(r.bytes)} · backup: ${r.backup || "none"}`;
      } catch (err) { THADD.toast("Save failed", String(err.message || err), "error"); }
    }
    area.addEventListener("input", () => { dirty = true; fileTab.textContent = path.split("/").pop() + " •"; });
    area.addEventListener("keydown", (e) => { if ((e.metaKey || e.ctrlKey) && e.key === "s") { e.preventDefault(); save(); } });
    load();
    return win;
  };

  /* =============================================================== security */
  REGISTRY.security = function (args) {
    const main = h("main", {}, loading("Checking system posture…"));
    const side = h("div", { class: "sidebar" });
    const body = h("div", { class: "split" }, side, main);
    const win = THADD.wm.open({ app: "security", title: "THADD Security Center", icon: "⛨", width: 1120, height: 720, body,
      footer: "Posture engine · native scans · ClamAV/rkhunter/lynis when installed · every report is SHA-256 hashed" });
    let section = args.section || "overview";

    const items = [["overview", "◈ Overview"], ["posture", "✓ Posture"], ["scans", "◎ Scans"], ["ports", "▤ Ports"],
      ["hardening", "⛨ Hardening"], ["analyze", "⌗ Analyse a file"], ["capabilities", "★ Capabilities"]];
    items.forEach(([id, label]) => {
      const it = h("div", { class: "item" + (id === section ? " active" : "") }, label);
      it.onclick = () => { section = id; THADD.$$(".item", side).forEach((n) => n.classList.remove("active")); it.classList.add("active"); render(); };
      side.append(it);
    });

    async function render() {
      main.innerHTML = ""; main.append(loading());
      if (section === "overview" || section === "posture" || section === "hardening") {
        const p = await THADD.call("security.posture", {});
        main.innerHTML = "";
        const grid = h("div", { class: "grid-3", style: { padding: "14px" } },
          card("Posture score", `${p.score}/100`, `grade ${p.grade}`),
          card("Findings", `${p.total - p.passed} open`, `${p.open_by_severity.high || 0} high · ${p.open_by_severity.medium || 0} medium`),
          card("Tools detected", Object.values(p.tools_detected).filter(Boolean).length + " present", "clamav · rkhunter · lynis · nmap · yara"));
        main.append(grid);
        const list = h("div", { style: { padding: "0 14px 20px" } });
        p.findings.forEach((f) => {
          const row = h("div", { class: "row" },
            h("div", { class: "g", style: { background: f.ok ? "rgba(34,197,94,.25)" : f.severity === "high" ? "rgba(239,68,68,.25)" : "rgba(245,158,11,.25)" } }, f.ok ? "✔" : f.severity === "high" ? "!" : "⚠"),
            h("div", { class: "t" }, h("b", {}, f.title), h("small", {}, f.detail)),
            f.fix ? h("div", {}, h("span", { class: "pill", style: { cursor: "pointer" }, onclick: () => { navigator.clipboard.writeText(f.fix); THADD.toast("Copied fix", f.fix, "info"); } }, "copy fix")) : null);
          list.append(row);
        });
        main.append(list);
        if (section === "hardening") {
          const hb = btn("Generate hardening script → ~/Scripts/thadd-harden.sh", async () => {
            const r = await THADD.stream("security.scan", { kind: "hardening" }, {
              onEvent: (ev) => { if (ev.type === "log") THADD.toast("Hardening", ev.line, "info"); },
            });
            THADD.toast("Hardening script ready", "Review it, then run: sudo bash ~/Scripts/thadd-harden.sh", "success");
          }, "primary");
          main.prepend(h("div", { style: { padding: "14px" } }, hb));
        }
      } else if (section === "scans") {
        main.innerHTML = "";
        const kinds = ["quick", "rootkit", "audit", "virus", "network", "full"];
        const bar = h("div", { style: { display: "flex", gap: "8px", padding: "14px", flexWrap: "wrap" } });
        const output = h("div", { class: "term", style: { height: "calc(100% - 90px)", margin: "0 14px 14px", borderRadius: "12px" } });
        kinds.forEach((k) => {
          bar.append(btn(k.toUpperCase(), async () => {
            output.textContent = "";
            main.insertBefore(output, bar.nextSibling);
            const target = k === "web" ? prompt("Target host for web scan", "127.0.0.1") : "";
            try {
              await THADD.stream("security.scan", { kind: k, target }, {
                onEvent: (ev) => {
                  const line = ev.type === "log" ? ev.line :
                    ev.type === "finding" ? `[${ev.severity}] ${ev.title} — ${ev.detail}` :
                    ev.type === "error" ? `! ${ev.message}` :
                    ev.type === "scan_start" ? `▶ ${ev.kind} scan started ${ev.time}` :
                    ev.type === "scan_end" ? `✔ finished ${ev.time}` : JSON.stringify(ev).slice(0, 200);
                  output.append(h("div", { style: { color: ev.type === "error" ? "#ff9b9b" : ev.type === "finding" ? "#ffd68a" : "#cdd6f4" } }, line));
                  output.scrollTop = output.scrollHeight;
                },
              });
            } catch (err) { output.append(h("div", { class: "err" }, String(err.message || err))); }
          }));
        });
        main.append(bar);
      } else if (section === "ports") {
        const r = await THADD.call("security.ports", {});
        main.innerHTML = "";
        main.append(pad(h("div", { class: "pill" + (r.exposed.length ? " bad" : " ok") }, `${r.count} listening sockets · ${r.exposed.length} exposed`)));
        r.ports.forEach((p) => main.append(h("div", { class: "row" },
          h("div", { class: "g" }, p.proto === "tcp" ? "⇄" : "◌"),
          h("div", { class: "t" }, h("b", {}, `${p.addr}:${p.port}`), h("small", {}, `${p.proto} · state ${p.state} · ${p.process || "unknown process"}`)),
          p.exposed ? h("span", { class: "pill bad" }, "exposed") : h("span", { class: "pill ok" }, "local"))));
      } else if (section === "analyze") {
        main.innerHTML = "";
        const inp = h("input", { placeholder: "/path/to/file or disk image", value: args.file || "", style: { padding: "9px 12px", borderRadius: "10px", border: "1px solid var(--stroke)", background: "var(--panel-2)", width: "460px" } });
        const out = h("div", { class: "term", style: { height: "calc(100% - 120px)", margin: "0 14px 14px", borderRadius: "12px" } });
        main.append(h("div", { style: { display: "flex", gap: "10px", padding: "14px" } }, inp,
          btn("Analyse file", async () => {
            out.textContent = "analysing…\n";
            try {
              const r = await THADD.call("security.analyze", { path: inp.value });
              out.textContent = JSON.stringify(r, null, 1);
              THADD.apps.open("forensics", { file: inp.value, result: r });
            } catch (err) { out.textContent = String(err.message || err); }
          }, "primary"),
          btn("Full disk triage (DFIR)", async () => {
            out.textContent = "";
            await THADD.stream("security.analyze_image", { path: inp.value }, {
              onEvent: (ev) => {
                out.append(h("div", {}, ev.line || ev.message || `${ev.type}: ${JSON.stringify(ev).slice(0, 220)}`));
                out.scrollTop = out.scrollHeight;
              },
            });
          })), out);
        if (args.result) out.textContent = JSON.stringify(args.result, null, 1);
      } else {
        const c = await THADD.call("security.capabilities", {});
        main.innerHTML = "";
        main.append(pad(h("div", { class: "pill" }, c.evidence || "read-only readers")));
        (c.matrix || []).forEach((m) => {
          main.append(h("div", { class: "card", style: { margin: "10px 14px" } },
            h("h5", {}, m.os), h("div", { class: "sub" }, m.filesystem),
            h("div", { style: { marginTop: "8px", display: "flex", flexWrap: "wrap", gap: "6px" } },
              ...(m.can_read || []).map((x) => h("span", { class: "pill ok" }, x)),
              ...(m.locked || []).map((x) => h("span", { class: "pill warn" }, x)))));
        });
      }
    }
    render();
    return win;
  };

  /* =========================================================== forensics lab */
  REGISTRY.forensics = function (args) {
    const main = h("main", {}, loading("Looking for disks and images…"));
    const side = h("div", { class: "sidebar" });
    const body = h("div", { class: "split" }, side, main);
    const win = THADD.wm.open({ app: "forensics", title: "THADD Forensics Lab", icon: "⌗", width: 1160, height: 740, body,
      footer: "Native NTFS · FAT · ext4 · HFS+ · APFS · registry readers — read-only, evidence-hashed" });
    let section = "targets";
    [["targets", "◉ Targets"], ["capabilities", "★ Capability matrix"], ["report", "≡ Last report"]].forEach(([id, label]) => {
      const it = h("div", { class: "item" + (id === section ? " active" : "") }, label);
      it.onclick = () => { section = id; render(); };
      side.append(it);
    });

    async function render() {
      main.innerHTML = "";
      if (section === "targets") {
        const dev = await THADD.call("security.devices", {});
        const inp = h("input", { placeholder: "or type a path: /home/thadd/Downloads/win11.img", value: args.file || "",
          style: { padding: "9px 12px", borderRadius: "10px", border: "1px solid var(--stroke)", background: "var(--panel-2)", width: "420px" } });
        const out = h("div", { class: "term", style: { height: "390px", margin: "0 14px 14px", borderRadius: "12px" } });
        main.innerHTML = "";
        main.append(pad(h("div", { class: "pill" }, "Devices are opened O_RDONLY — nothing is written to evidence")));
        const list = h("div", { style: { padding: "0 14px 8px" } });
        dev.devices.filter((d) => !d.loop).forEach((d) => {
          list.append(h("div", { class: "row" },
            h("div", { class: "g" }, d.removable ? "⤓" : "▣"),
            h("div", { class: "t" }, h("b", {}, d.device), h("small", {}, `${THADD.bytes(d.size)} · ${d.model || "disk"} ${d.mounts.length ? "· mounted at " + d.mounts.join(", ") : ""}`)),
            btn("Analyse", () => analyze(d.device)), btn("Ask AI", () => THADD.apps.open("ai", { prompt: `Analyse the disk ${d.device} and tell me which operating systems were installed and anything suspicious.` }))));
        });
        main.append(list, h("div", { style: { display: "flex", gap: "10px", padding: "0 14px 12px" } }, inp, btn("Analyse path", () => analyze(inp.value), "primary")), out);

        async function analyze(path) {
          if (!path) return THADD.toast("No target", "Choose a device or type a path", "warning");
          out.textContent = "";
          try {
            await THADD.stream("security.analyze_image", { path }, {
              onEvent: (ev) => {
                const line = ev.type === "log" ? "· " + ev.line
                  : ev.type === "os" ? `\n◆ OS: ${ev.release} (${Math.round((ev.confidence || 0) * 100)}% confidence)`
                  : ev.type === "filesystem" ? `  partition ${ev.partition}: ${ev.fs} ${ev.readable ? "(readable)" : ""}`
                  : ev.type === "indicator" ? `  [${ev.severity}] ${ev.title} — ${ev.detail}`
                  : ev.type === "report" ? `\n✔ report: ${ev.markdown}\n  sha256: ${ev.markdown_sha256}`
                  : ev.type === "summary" ? `\nsummary: ${JSON.stringify(ev)}`
                  : ev.type === "dfir_start" ? `▶ analysing ${ev.path}`
                  : ev.type === "error" ? "! " + ev.message : "";
                if (line) { out.append(h("div", {}, line)); out.scrollTop = out.scrollHeight; }
              },
            });
          } catch (err) { out.append(h("div", { class: "err" }, String(err.message || err))); }
        }
      } else if (section === "capabilities") {
        const c = await THADD.call("security.capabilities", {});
        const f = await THADD.call("security.analyze" in THADD.call ? "security.capabilities" : "security.capabilities", {});
        main.innerHTML = "";
        main.append(pad(h("div", { class: "pill" }, "read-only · no libtsk · dependency-free readers")));
        (c.matrix || []).forEach((m) => main.append(h("div", { class: "card", style: { margin: "10px 14px" } },
          h("h5", {}, m.os), h("div", { class: "sub" }, m.filesystem),
          h("div", { style: { marginTop: "8px" } }, ...(m.can_read || []).map((x) => h("div", { class: "sub" }, "✔ " + x))),
          h("div", { style: { marginTop: "6px" } }, ...(m.locked || []).map((x) => h("div", { class: "sub", style: { color: "var(--warn)" } }, "⚠ " + x))))));
        main.append(pad(h("div", { class: "sub" }, "Not parsed: " + (c.not_parsed || []).join(", "))));
      } else {
        const r = await THADD.call("snapshots.list", {}).catch(() => ({ snapshots: [] }));
        main.innerHTML = "";
        main.append(pad(h("div", {}, "Run a triage from the Targets tab — reports are written to ~/.thadd/forensics/<name>/")));
        main.append(pad(h("div", { class: "sub" }, "Reports contain: partition table, filesystems, OS verdicts, artefacts (registry hives, USB history, autoruns, installed software, users, SSH keys, cron), timeline, indicators and an acquisition plan.")));
      }
    }
    render();
    return win;
  };

  /* ============================================================== task mgr */
  REGISTRY.taskmgr = function () {
    const main = h("main", {}, loading());
    const body = h("div", { class: "split" }, h("div", { class: "sidebar" },
      h("div", { class: "item active" }, "▦ Processes"), h("div", { class: "item", onclick: () => THADD.apps.open("monitor") }, "◈ Performance")), main);
    const win = THADD.wm.open({ app: "taskmgr", title: "Task Manager", icon: "▦", width: 1000, height: 660, body, footer: "Click a process to end it · data straight from /proc" });
    async function refresh() {
      const r = await THADD.call("system.processes", { sort: "cpu", limit: 120 });
      const m = THADD.state.metrics || { cpu: {}, memory: {} };
      main.innerHTML = "";
      main.append(pad(h("div", { class: "grid-3" },
        card("CPU", (m.cpu?.percent ?? 0).toFixed(0) + "%", `${(m.cpu?.cores || []).length} cores`),
        card("Memory", THADD.bytes(m.memory?.used || 0), `${(m.memory?.percent ?? 0).toFixed(0)}% of ${THADD.bytes(m.memory?.total || 0)}`),
        card("Processes", String(r.total), "click to manage"))));
      const table = h("div", { style: { padding: "0 14px 16px" } });
      table.append(h("div", { class: "row" }, h("div", { class: "t" }, h("b", {}, "NAME")), h("div", {}, "PID"), h("div", {}, "CPU"), h("div", {}, "MEM"), h("div", {}, "USER")));
      r.processes.forEach((p) => {
        const row = h("div", { class: "row", style: { cursor: "pointer", fontSize: "12.5px" } },
          h("div", { class: "t" }, h("b", {}, p.name), h("small", {}, p.cmdline.slice(0, 70))),
          h("div", {}, String(p.pid)), h("div", {}, p.cpu_time.toFixed(1) + "s"),
          h("div", {}, THADD.bytes(p.mem)), h("div", {}, p.user));
        row.onclick = async () => {
          if (!confirm(`End ${p.name} (pid ${p.pid})?`)) return;
          try { await THADD.call("system.kill", { pid: p.pid, signal: "TERM" }); THADD.toast("Signal sent", `${p.name} (${p.pid})`, "info"); }
          catch (err) { THADD.toast("Cannot kill", String(err.message || err), "error"); }
          refresh();
        };
        table.append(row);
      });
      main.append(table);
    }
    refresh();
    const timer = setInterval(refresh, 4000);
    return Object.assign(win, { onClose: () => clearInterval(timer) });
  };

  /* ============================================================== monitor */
  REGISTRY.monitor = function () {
    const canvas = h("canvas", { width: 900, height: 260, style: { width: "100%", height: "260px" } });
    const info = h("div", { class: "grid-3", style: { padding: "14px" } });
    const body = h("div", {}, info, pad(canvas));
    const win = THADD.wm.open({ app: "monitor", title: "System Monitor", icon: "◈", width: 1020, height: 620, body, footer: "Live from /proc — 2 second resolution" });
    const cpuHist = [], memHist = [];
    function draw() {
      const ctx = canvas.getContext("2d");
      const w = canvas.width, hgt = canvas.height;
      ctx.clearRect(0, 0, w, hgt);
      ctx.strokeStyle = "rgba(255,255,255,.08)";
      for (let i = 0; i <= 4; i++) { ctx.beginPath(); ctx.moveTo(0, (hgt / 4) * i); ctx.lineTo(w, (hgt / 4) * i); ctx.stroke(); }
      const drawSeries = (data, color, max) => {
        if (data.length < 2) return;
        ctx.beginPath();
        data.forEach((v, i) => {
          const x = (w / 120) * i, y = hgt - (v / max) * hgt;
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        });
        ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
        ctx.lineTo((w / 120) * (data.length - 1), hgt); ctx.lineTo(0, hgt); ctx.closePath();
        ctx.fillStyle = color.replace("rgb", "rgba").replace(")", ",.16)");
        ctx.fill();
      };
      drawSeries(cpuHist, "rgb(59,130,246)", 100);
      drawSeries(memHist, "rgb(139,92,246)", 100);
    }
    THADD.on("metrics.updated", (m) => {
      cpuHist.push(m.cpu.percent); memHist.push(m.memory.percent);
      if (cpuHist.length > 120) { cpuHist.shift(); memHist.shift(); }
      info.innerHTML = "";
      info.append(card("CPU", m.cpu.percent.toFixed(0) + "%", `load ${m.cpu.load.map((x) => x.toFixed(2)).join(" ")}${m.cpu.temp ? " · " + m.cpu.temp + " °C" : ""}`),
        card("Memory", m.memory.percent.toFixed(0) + "%", `${THADD.bytes(m.memory.used)} / ${THADD.bytes(m.memory.total)}`),
        card("Disk", (m.disk[0] ? m.disk[0].percent : 0) + "%", m.disk[0] ? m.disk[0].mount : "-"));
      draw();
    });
    draw();
    return win;
  };

  /* ============================================================== settings */
  REGISTRY.settings = function () {
    const main = h("main", {}, loading());
    const side = h("div", { class: "sidebar" });
    const body = h("div", { class: "split" }, side, main);
    const win = THADD.wm.open({ app: "settings", title: "Settings", icon: "⚙", width: 1020, height: 700, body });
    let page = "appearance";
    [["appearance", "◧ Appearance"], ["ai", "✦ AI & Agent"], ["security", "⛨ Security"], ["system", "▣ System"],
     ["wallpaper", "▨ Wallpapers"], ["about", "ⓘ About"]].forEach(([id, label]) => {
      const it = h("div", { class: "item" + (id === page ? " active" : "") }, label);
      it.onclick = () => { page = id; THADD.$$(".item", side).forEach((n) => n.classList.remove("active")); it.classList.add("active"); render(); };
      side.append(it);
    });
    async function apply(patch) {
      const r = await THADD.call("settings.apply", { patch });
      THADD.wm.applyConfig(r.config);
      return r;
    }
    async function render() {
      main.innerHTML = "";
      const cfg = await THADD.call("settings.get", {});
      if (page === "appearance") {
        const themes = [["dark", "THADD Dark"], ["light", "Light"], ["auto", "Auto"]];
        const styles = [["hybrid", "Hybrid (Windows 11 + macOS Sequoia)"], ["windows11", "Windows 11"], ["sequoia", "macOS Sequoia"], ["linux", "Classic Linux"]];
        const accents = ["#3b82f6", "#8b5cf6", "#ec4899", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4"];
        const themeRow = h("div", { style: { display: "flex", gap: "10px", flexWrap: "wrap" } });
        themes.forEach(([v, l]) => {
          const b = btn(l, async () => { await apply({ appearance: { theme: v } }); render(); });
          if (cfg.appearance.theme === v) b.classList.add("primary");
          themeRow.append(b);
        });
        const styleRow = h("div", { style: { display: "flex", gap: "10px", flexWrap: "wrap" } });
        styles.forEach(([v, l]) => {
          const b = btn(l, async () => { await apply({ appearance: { shell_style: v } }); render(); });
          if (cfg.appearance.shell_style === v) b.classList.add("primary");
          styleRow.append(b);
        });
        const accentRow = h("div", { style: { display: "flex", gap: "10px" } });
        accents.forEach((c) => {
          const dot = h("div", { style: { width: "34px", height: "34px", borderRadius: "50%", background: c, cursor: "pointer", border: c === cfg.appearance.accent ? "3px solid #fff" : "none" } });
          dot.onclick = async () => { await apply({ appearance: { accent: c } }); render(); };
          accentRow.append(dot);
        });
        main.append(pad(
          h("h4", {}, "Theme"), themeRow,
          h("h4", { style: { marginTop: "18px" } }, "Shell style"), styleRow,
          h("h4", { style: { marginTop: "18px" } }, "Accent colour"), accentRow,
          h("h4", { style: { marginTop: "18px" } }, "Dock"),
          h("div", {}, ...[["bottom", "Bottom (Windows 11)"], ["left", "Left (Linux)"], ["top", "Top (macOS-ish)"]].map(([v, l]) =>
            btn(l, async () => { await apply({ appearance: { dock_position: v } }); render(); }, cfg.appearance.dock_position === v ? "primary" : ""))),
          h("div", { style: { marginTop: "18px" } },
            h("label", {}, "Font scale "),
            (() => { const r = h("input", { type: "range", min: 0.85, max: 1.35, step: 0.05, value: cfg.appearance.font_scale || 1 }); r.onchange = () => apply({ appearance: { font_scale: parseFloat(r.value) } }); return r; })())));
      } else if (page === "ai") {
        const keyInput = h("input", { type: "password", placeholder: "gsk_… (stored 0600 locally)", style: { padding: "10px 12px", borderRadius: "10px", border: "1px solid var(--stroke)", background: "var(--panel-2)", width: "420px" } });
        const out = h("div", { class: "sub", style: { marginTop: "10px" } }, cfg.ai.has_key ? `Key saved (${cfg.ai.key_hint})` : "No key yet — offline assistant is active");
        const models = await THADD.call("ai.models", {}).catch(() => ({ models: [] }));
        const modelSel = h("select", { class: "btn", style: { padding: "8px" } }, ...(models.models || []).map((m) => h("option", { value: m.id, selected: m.id === cfg.ai.model }, m.label || m.id)));
        modelSel.onchange = () => apply({ ai: { model: modelSel.value } });
        const autoSel = h("select", { class: "btn", style: { padding: "8px" } }, ...[["readonly", "Read-only (no changes)"], ["confirm", "Confirm (recommended)"], ["autopilot", "Autopilot (full automation)"]].map(([v, l]) => h("option", { value: v, selected: cfg.ai.autonomy === v }, l)));
        autoSel.onchange = () => apply({ ai: { autonomy: autoSel.value } });
        main.append(pad(
          h("h4", {}, "Groq API key"),
          h("div", { style: { display: "flex", gap: "10px", alignItems: "center" } }, keyInput,
            btn("Save & test", async () => {
              const r = await THADD.call("settings.ai_key", { api_key: keyInput.value });
              out.textContent = r.valid ? `Key valid ✔ (${r.probe.latency_ms} ms, ${r.probe.models} models)` : `Saved, but the test failed: ${r.probe?.error || "unknown"}`;
              THADD.toast("API key", r.valid ? "Groq connection established" : "Saved with warnings", r.valid ? "success" : "warning");
            }, "primary"),
            btn("Clear", async () => { await THADD.call("settings.ai_key", { api_key: "" }); out.textContent = "Key cleared — offline mode"; })),
          out,
          h("h4", { style: { marginTop: "20px" } }, "Model"),
          h("div", { style: { display: "flex", gap: "10px" } }, modelSel, btn("Test round-trip", async () => {
            const r = await THADD.call("settings.ai_test", {});
            THADD.toast(r.ok ? "AI replied" : "AI error", r.ok ? `“${r.reply}” (${r.latency_ms} ms)` : r.error, r.ok ? "success" : "error");
          })),
          h("h4", { style: { marginTop: "20px" } }, "Agent autonomy"), autoSel,
          h("h4", { style: { marginTop: "20px" } }, "Audit trail"),
          h("div", { class: "sub" }, "Every tool call is appended to ~/.thadd/agent-audit.jsonl"),
          btn("View recent actions", async () => {
            const a = await THADD.call("ai.audit", { limit: 30 });
            THADD.wm.open({ app: "audit", title: "AI audit trail", width: 760, height: 520,
              body: pad(...a.entries.reverse().map((e) => h("div", { class: "row" }, h("div", { class: "t" }, h("b", {}, e.action), h("small", {}, `${e.iso} · ${e.detail}`))))) });
          }),
          h("h4", { style: { marginTop: "20px" } }, "Tools available to the agent"),
          h("div", { class: "sub", id: "ai-tools" }, "")));
        THADD.call("ai.tools", {}).then((t) => {
          const el = THADD.$("#ai-tools");
          if (el) el.textContent = `${t.count} tools: ` + t.tools.map((x) => x.function.name).join(", ");
        });
      } else if (page === "security") {
        main.append(pad(
          h("h4", {}, "Security features"),
          ...[["firewall", "Enable firewall on boot"], ["hardening", "Apply kernel hardening at startup"],
              ["audit_log", "Keep an AI action audit log"], ["auto_scan_on_boot", "Run a quick scan at login"],
              ["wipe_on_shutdown", "Wipe session data on shutdown"]].map(([k, l]) => {
            const row = h("div", { class: "row" }, h("div", { class: "t" }, h("b", {}, l)),
              h("span", { class: "pill " + (cfg.security[k] ? "ok" : "") }, cfg.security[k] ? "on" : "off"));
            row.onclick = async () => { await apply({ security: { [k]: !cfg.security[k] } }); render(); };
            return row;
          }),
          btn("Open Security Center", () => THADD.apps.open("security"), "primary")));
      } else if (page === "wallpaper") {
        const w = await THADD.call("settings.wallpapers", {});
        const grid = h("div", { class: "grid-3" });
        (w.wallpapers || []).forEach((item) => {
          const cell = h("div", { class: "card", style: { cursor: "pointer" } }, h("h5", {}, item.name), h("div", { class: "sub" }, item.builtin ? "generated by THADD" : item.path));
          cell.onclick = async () => {
            await apply({ appearance: { wallpaper: item.id } });
            const r = await THADD.call("shell.wallpaper", { name: item.id });
            THADD.emit("wallpaper.set", item.id);
            THADD.toast("Wallpaper set", item.name + " → " + r.path, "success");
          };
          grid.append(cell);
        });
        main.append(pad(h("h4", {}, "Wallpapers"), grid));
      } else if (page === "system") {
        const info = await THADD.call("system.info", {});
        main.append(pad(
          h("h4", {}, "Identity"),
          h("div", { class: "grid-2" },
            card("Hostname", info.os.hostname, info.os.virtualization),
            card("Kernel", info.os.kernel, info.os.arch),
            card("OS", info.os.pretty, `${info.os.edition} · build ${info.os.build}`),
            card("Live session", info.os.live ? "yes (RAM only)" : "installed", info.os.product)),
          h("h4", { style: { marginTop: "18px" } }, "Power"),
          h("div", { style: { display: "flex", gap: "10px", flexWrap: "wrap" } },
            btn("Lock", () => THADD.wm.lock()), btn("Log out", () => THADD.call("system.power", { action: "logout" })),
            btn("Reboot", () => confirm("Reboot now?") && THADD.call("system.power", { action: "reboot" }), "danger"),
            btn("Shut down", () => confirm("Shut down now?") && THADD.call("system.power", { action: "shutdown" }), "danger"))));
      } else {
        const about = await THADD.call("settings.about", {});
        main.append(pad(
          h("h4", {}, `${about.product} — ${about.version} “${about.codename}”`),
          h("div", { class: "sub" }, `${about.kernel} · ${about.arch} · ${about.cpu} · ${about.cores} cores · ${about.memory_gb} GB RAM`),
          h("h4", { style: { marginTop: "16px" } }, "What's inside"),
          ...Object.entries(about.features).map(([k, v]) => h("div", { class: "row" }, h("div", { class: "t" }, h("b", {}, k), h("small", {}, v)))),
          h("h4", { style: { marginTop: "16px" } }, "Credits"),
          ...about.credits.map((c) => h("div", { class: "sub" }, "· " + c)),
          h("div", { class: "sub", style: { marginTop: "12px" } }, about.license)));
      }
    }
    render();
    return win;
  };

  /* ================================================================ store */
  REGISTRY.store = function () {
    const main = h("main", {});
    const inp = h("input", { placeholder: "Search the repositories (e.g. nmap, gimp, gcc, docker)…", style: { flex: 1, padding: "10px 12px", borderRadius: "10px", border: "1px solid var(--stroke)", background: "var(--panel-2)" } });
    const out = h("div", { class: "term", style: { height: "260px", margin: "10px 14px", borderRadius: "12px" } });
    const listBox = h("div", { style: { padding: "0 14px 16px" } });
    const body = h("div", {}, h("div", { style: { display: "flex", gap: "10px", padding: "14px" } }, inp,
      btn("Search", () => search(inp.value), "primary"),
      btn("What's installed?", async () => { const r = await THADD.call("system.packages", {}); listBox.innerHTML = ""; listBox.append(h("div", { class: "pill" }, `${r.count} packages installed`)); (r.packages || []).slice(0, 300).forEach((p) => listBox.append(h("div", { class: "row" }, h("div", { class: "t" }, h("b", {}, p.name), h("small", {}, p.version))))); })), out, listBox);
    const win = THADD.wm.open({ app: "store", title: "THADD App Store — real packages", icon: "⤓", width: 1000, height: 680, body, footer: "Installs run through the distribution package manager (apt/dpkg)" });
    async function search(q) {
      if (!q) return;
      listBox.innerHTML = "";
      const r = await THADD.call("system.packages", { query: q });
      (r.results || []).forEach((p) => {
        listBox.append(h("div", { class: "row" },
          h("div", { class: "g" }, "⤓"),
          h("div", { class: "t" }, h("b", {}, p.name), h("small", {}, p.description || "")),
          btn("Install", async () => {
            out.textContent = `$ apt-get install -y ${p.name}\n`;
            const res = await THADD.call("system.install_package", { package: p.name });
            out.append(h("div", { style: { whiteSpace: "pre-wrap" } }, (res.stdout || res.stderr || "").slice(-4000)));
          }, "primary")));
      });
      if (!(r.results || []).length) listBox.append(h("div", { class: "pill warn" }, "no matches — try another name"));
    }
    return win;
  };

  /* ============================================================= snapshots */
  REGISTRY.snapshots = function () {
    const main = h("main", {}, loading());
    const body = h("div", { class: "split" }, h("div", { class: "sidebar" },
      h("div", { class: "item active" }, "⟲ Restore points")), main);
    const win = THADD.wm.open({ app: "snapshots", title: "Snapshots — restore points", icon: "⟲", width: 980, height: 640, body,
      footer: "tar.gz + per-file SHA-256 manifest · retention configurable in Settings → System" });
    async function refresh() {
      const r = await THADD.call("snapshots.list", {});
      main.innerHTML = "";
      main.append(pad(h("div", { style: { display: "flex", gap: "10px", flexWrap: "wrap" } },
        btn("Create snapshot now", async () => {
          const s = await THADD.call("snapshots.create", { label: "manual (Snapshots app)" });
          THADD.toast("Snapshot created", `${s.file_count} files · ${THADD.bytes(s.bytes)}`, "success");
          refresh();
        }, "primary"),
        btn("Diff newest", async () => {
          if (!r.snapshots.length) return;
          const d = await THADD.call("snapshots.diff", { snapshot: r.snapshots[0].id });
          THADD.wm.open({ app: "diff", title: "Snapshot diff", width: 760, height: 520,
            body: pad(h("div", { class: "pill" }, `changed ${d.counts.changed} · missing ${d.counts.missing} · new ${d.counts.new}`),
              ...d.changed.slice(0, 60).map((c) => h("div", { class: "row" }, h("div", { class: "t" }, h("b", {}, c.path), h("small", {}, `${THADD.bytes(c.old_size)} → ${THADD.bytes(c.new_size)}`))))) });
        }),
        btn("Prune old", async () => { const p = await THADD.call("snapshots.prune", {}); THADD.toast("Pruned", `${p.removed.length} removed, ${p.retention} kept`, "info"); refresh(); }))));
      const list = h("div", { style: { padding: "0 14px 16px" } });
      (r.snapshots || []).forEach((s) => {
        list.append(h("div", { class: "row" },
          h("div", { class: "g" }, "⟲"),
          h("div", { class: "t" }, h("b", {}, s.label), h("small", {}, `${s.created_iso} · ${s.file_count} files · ${THADD.bytes(s.bytes)} · archive ${THADD.bytes(s.archive_size)}`)),
          btn("Restore", async () => {
            if (!confirm(`Restore “${s.label}”? A safety snapshot is taken first.`)) return;
            const res = await THADD.call("snapshots.restore", { snapshot: s.id });
            THADD.toast("Restored", `${res.restored} files (safety: ${res.safety_snapshot || "n/a"})`, "success");
          }),
          btn("Show", async () => {
            const full = await THADD.call("snapshots.show", { snapshot: s.id });
            THADD.wm.open({ app: "show", title: s.label, width: 800, height: 560,
              body: pad(h("div", { class: "sub" }, `${full.file_count} files · sources: ${(full.sources || []).join(", ")}`),
                ...(full.files || []).slice(0, 400).map((f) => h("div", { class: "row", style: { fontSize: "12px" } }, h("div", { class: "t" }, h("b", {}, f.path), h("small", {}, `${THADD.bytes(f.size)} · ${f.sha256.slice(0, 16)}…`))))) });
          }),
          btn("Delete", async () => { await THADD.call("snapshots.delete", { snapshot: s.id }); refresh(); }, "danger")));
      });
      main.append(list);
      if (!(r.snapshots || []).length) main.append(pad(h("div", { class: "pill warn" }, "no restore points yet — create one now")));
    }
    refresh();
    return win;
  };

  /* =========================================================== notes/calendar */
  REGISTRY.notes = function () {
    const list = h("main", {});
    const body = h("div", { class: "split" }, h("div", { class: "sidebar" }, h("div", { class: "item active" }, "≡ Notes")), list);
    const win = THADD.wm.open({ app: "notes", title: "Notes", icon: "≡", width: 860, height: 600, body, footer: "Saved to the THADD data directory" });
    async function refresh() {
      const r = await THADD.call("shell.notes", { action: "list" });
      list.innerHTML = "";
      list.append(pad(btn("New note", async () => {
        const n = await THADD.call("shell.notes", { action: "create", title: "New note", body: "" });
        edit(n);
      }, "primary")));
      (r.notes || []).forEach((n) => {
        const row = h("div", { class: "row" }, h("div", { class: "g" }, "≡"),
          h("div", { class: "t" }, h("b", {}, n.title), h("small", {}, (n.body || "").slice(0, 80))),
          btn("Edit", () => edit(n)), btn("Delete", async () => { await THADD.call("shell.notes", { action: "delete", id: n.id }); refresh(); }, "danger"));
        list.append(row);
      });
    }
    function edit(n) {
      const title = h("input", { value: n.title, style: { width: "100%", padding: "10px", borderRadius: "10px", border: "1px solid var(--stroke)", background: "var(--panel-2)" } });
      const bodyArea = h("textarea", { style: { width: "100%", height: "320px", marginTop: "10px", padding: "12px", borderRadius: "12px", border: "1px solid var(--stroke)", background: "var(--panel-2)", fontFamily: "var(--mono)" } });
      bodyArea.value = n.body || "";
      THADD.wm.open({ app: "note", title: "Edit note", width: 700, height: 560,
        body: pad(title, bodyArea, btn("Save", async () => {
          await THADD.call("shell.notes", { action: "update", id: n.id, title: title.value, body: bodyArea.value });
          THADD.toast("Saved", title.value, "success"); refresh();
        }, "primary")) });
    }
    refresh();
    return win;
  };

  REGISTRY.calendar = function () {
    const grid = h("main", {});
    const body = h("div", { class: "split" }, h("div", { class: "sidebar" }, h("div", { class: "item active" }, "▦ Month")), grid);
    const win = THADD.wm.open({ app: "calendar", title: "Calendar", icon: "▦", width: 940, height: 660, body });
    async function refresh() {
      const r = await THADD.call("shell.calendar", { action: "list" });
      grid.innerHTML = "";
      const now = new Date(), year = now.getFullYear(), month = now.getMonth();
      const first = new Date(year, month, 1).getDay();
      const days = new Date(year, month + 1, 0).getDate();
      const cells = h("div", { style: { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "7px", padding: "14px" } });
      ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].forEach((d) => cells.append(h("div", { class: "sub" }, d)));
      for (let i = 0; i < first; i++) cells.append(h("div", {}));
      for (let d = 1; d <= days; d++) {
        const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        const events = (r.events || []).filter((e) => e.date === iso);
        const cell = h("div", { class: "card", style: { minHeight: "72px", cursor: "pointer" } },
          h("div", { class: "sub" }, String(d)),
          ...events.slice(0, 3).map((e) => h("div", { style: { fontSize: "11px", color: "var(--accent)" } }, e.time ? `${e.time} ${e.title}` : e.title)));
        cell.onclick = async () => {
          const title = prompt(`Event on ${iso}`, "AI lab");
          if (!title) return;
          const time = prompt("Time (HH:MM, optional)", "") || "";
          await THADD.call("shell.calendar", { action: "create", title, date: iso, time_of_day: time });
          refresh();
        };
        cells.append(cell);
      }
      grid.append(pad(h("h4", {}, `${now.toLocaleString([], { month: "long" })} ${year}`)), cells);
    }
    refresh();
    return win;
  };

  /* ============================================================= calculator */
  REGISTRY.calculator = function () {
    const display = h("input", { readonly: true, value: "0", style: { width: "100%", fontSize: "30px", textAlign: "right", padding: "14px", background: "var(--panel-2)", border: "1px solid var(--stroke)", borderRadius: "12px" } });
    const keys = "C ( ) ÷ 7 8 9 × 4 5 6 − 1 2 3 + 0 . ⌫ =".split(" ");
    const pad2 = h("div", { style: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px", marginTop: "12px" } });
    let expr = "";
    keys.forEach((k) => {
      const b = btn(k, () => {
        if (k === "C") expr = "";
        else if (k === "⌫") expr = expr.slice(0, -1);
        else if (k === "=") {
          try {
            const safe = expr.replace(/÷/g, "/").replace(/×/g, "*").replace(/−/g, "-").replace(/\^/g, "**");
            if (!/^[-+*/(). 0-9eE%]*$/.test(safe)) throw new Error("bad expression");
            display.value = String(Function(`"use strict";return (${safe})`)());
            expr = display.value;
            return;
          } catch (e) { display.value = "error"; return; }
        } else expr += k;
        display.value = expr || "0";
      });
      b.style.padding = "16px";
      pad2.append(b);
    });
    return THADD.wm.open({ app: "calculator", title: "Calculator", icon: "∑", width: 430, height: 560, body: pad(display, pad2) });
  };

  /* ================================================================ media */
  REGISTRY.media = function () {
    const main = h("main", {}, loading("Scanning your media…"));
    const body = h("div", { class: "split" }, h("div", { class: "sidebar" }, h("div", { class: "item active" }, "▶ Media")), main);
    const win = THADD.wm.open({ app: "media", title: "Media", icon: "▶", width: 940, height: 620, body });
    (async () => {
      const r = await THADD.call("shell.media", {});
      main.innerHTML = "";
      main.append(pad(h("h4", {}, `Audio (${r.audio.length})`)));
      r.audio.slice(0, 60).forEach((a) => main.append(h("div", { class: "row", onclick: () => THADD.wm.open({ app: "player", title: a.name, width: 640, height: 420, body: pad(h("audio", { controls: true, autoplay: true, src: `/api/fs.read?path=${encodeURIComponent(a.path)}&binary=1` })) }) },
        h("div", { class: "g" }, "♪"), h("div", { class: "t" }, h("b", {}, a.name), h("small", {}, THADD.bytes(a.size))))));
      main.append(pad(h("h4", {}, `Video (${r.video.length})`)));
      r.video.slice(0, 60).forEach((a) => main.append(h("div", { class: "row", onclick: () => THADD.wm.open({ app: "player", title: a.name, width: 900, height: 600, body: pad(h("video", { controls: true, autoplay: true, style: { width: "100%" }, src: `/api/fs.read?path=${encodeURIComponent(a.path)}&binary=1` })) }) },
        h("div", { class: "g" }, "▶"), h("div", { class: "t" }, h("b", {}, a.name), h("small", {}, THADD.bytes(a.size))))));
      if (!r.count) main.append(pad(h("div", { class: "pill warn" }, "No media found in Music/Videos/Downloads")));
    })();
    return win;
  };

  /* ============================================================= recorder */
  REGISTRY.recorder = function () {
    const out = h("div", { class: "term", style: { height: "200px", margin: "14px", borderRadius: "12px" } });
    const body = pad(
      h("h4", {}, "Record the desktop"),
      h("div", { class: "sub" }, "Server-side capture uses ffmpeg + X11 (works in the live ISO). In a browser-only session, THADD records the shell with the MediaRecorder API."),
      h("div", { style: { display: "flex", gap: "10px", marginTop: "12px", flexWrap: "wrap" } },
        btn("Start server-side recording", async () => {
          const r = await THADD.call("shell.record_start", { fps: 24 });
          out.textContent += JSON.stringify(r, null, 1) + "\n";
          THADD.toast("Recording", r.mode === "ffmpeg" ? r.target : r.note, "info");
        }, "primary"),
        btn("Stop", async () => {
          const r = await THADD.call("shell.record_stop", { pid: 0 });
          out.textContent += JSON.stringify(r, null, 1) + "\n";
        }),
        btn("Record in browser (MediaRecorder)", async () => {
          try {
            const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 24 } });
            const rec = new MediaRecorder(stream, { mimeType: "video/webm" });
            const chunks = [];
            rec.ondataavailable = (e) => chunks.push(e.data);
            rec.onstop = () => {
              const blob = new Blob(chunks, { type: "video/webm" });
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = "thadd-desktop.webm";
              a.click();
              THADD.toast("Recording saved", "thadd-desktop.webm", "success");
            };
            rec.start();
            THADD.toast("Recording the desktop", "Click the browser's stop-sharing button to finish", "info");
          } catch (err) { THADD.toast("Not permitted", String(err.message || err), "error"); }
        }),
        btn("Render demo video (MP4)", async () => {
          out.textContent = "rendering the THADD demo video (this takes a moment)…\n";
          const r = await THADD.call("shell.render_video", {});
          out.append(h("pre", { style: { whiteSpace: "pre-wrap" } }, JSON.stringify(r, null, 1)));
          THADD.toast("Demo video ready", (r.video && r.video.path) || "see output", "success");
        }, "primary")), out);
    return THADD.wm.open({ app: "recorder", title: "Screen Recorder", icon: "◉", width: 900, height: 620, body,
      footer: "Recordings land in ~/Pictures/Recordings" });
  };

  /* ============================================================== welcome */
  REGISTRY.welcome = function () {
    const body = pad(
      h("h1", { style: { marginBottom: "4px" } }, "Welcome to THADD OS"),
      h("div", { class: "sub" }, "One OS. All the Best. — a bootable, hackable, AI-native desktop."),
      h("div", { class: "grid-2", style: { marginTop: "16px" } },
        card("1 · Ask the AI", "⌘K", "press ⌘K (Ctrl+K) and ask THADD to do real work"),
        card("2 · Terminal", "⌘T", "real bash/zsh/powershell sessions"),
        card("3 · Security", "⛨", "posture score, scans, hardening, forensics"),
        card("4 · Snapshots", "⟲", "roll back anything the AI changed")),
      h("div", { style: { display: "flex", gap: "10px", marginTop: "16px", flexWrap: "wrap" } },
        btn("Open THADD AI", () => THADD.apps.open("ai"), "primary"),
        btn("Run a security scan", () => THADD.apps.open("security", { section: "scans" })),
        btn("Browse files", () => THADD.apps.open("files")),
        btn("Read the manual", () => THADD.apps.open("help")),
        btn("Add Groq API key", () => THADD.apps.open("settings"))),
      h("div", { class: "sub", style: { marginTop: "16px" } }, "Shortcuts: ⌘K AI · ⌘Space launcher · ⌘T terminal · ⌘E files · ⌘L lock · ⌘W close window"));
    return THADD.wm.open({ app: "welcome", title: "Welcome to THADD OS", icon: "ⓘ", width: 940, height: 640, body });
  };

  /* ================================================================== help */
  REGISTRY.help = function () {
    const body = pad(
      h("h1", {}, "THADD OS manual"),
      h("h4", {}, "The agent"),
      h("p", {}, "THADD AI runs inside the OS. It can read/write files, run commands, install packages, manage services, scan and harden the machine, take screenshots and automate the mouse/keyboard. Ask in plain language: “harden this laptop”, “find what is eating my disk”, “analyse /dev/sdb”."),
      h("h4", {}, "Safety model"),
      h("p", {}, "Read-only tools run freely. Anything that changes your system asks for approval unless you switch autonomy to Autopilot. Before the first AI file write, a snapshot is taken automatically, and everything is logged to ~/.thadd/agent-audit.jsonl."),
      h("h4", {}, "Security & forensics"),
      h("p", {}, "The Security Center scores your posture out of 100, runs native anomaly scans, and can drive ClamAV/rkhunter/lynis when installed. The Forensics Lab reads Windows NTFS ($MFT, registry, ADS, timestomping), macOS APFS and HFS+, Linux ext4, FAT/exFAT and UEFI ESPs — read-only, hashed, with a full report."),
      h("h4", {}, "Keyboard"),
      h("div", { class: "sub" }, "⌘K ask AI · ⌘Space launcher · ⌘T terminal · ⌘E files · ⌘W close · ⌘M minimise · ⌘L lock · ⌘⇧Q log out · drag a window to an edge to snap"),
      h("h4", {}, "Terminal examples"),
      h("pre", {}, "thadd status            # system + service state\nthadd security posture  # score + fixes\nthadd dfir /dev/sdb      # OS reverse engineering\nthadd ai \"clean up my downloads\"\nthadd snapshot create\nthadd iso build --release"),
      h("h4", {}, "Power menu"),
      h("p", {}, "The ⏻ chip in the menu bar opens the control centre: metrics, theme, firewall check, snapshot, task manager, screen recording."));
    return THADD.wm.open({ app: "help", title: "THADD OS manual", icon: "?", width: 940, height: 680, body });
  };

  /* ------------------------------------------------- native launches + stubs */
  ["browser", "chromium", "powershell", "gimp", "inkscape", "office", "wireshark", "burpsuite",
   "msf", "nmap", "ghidra", "qemu", "wine", "texteditor", "archive", "cam", "music", "video",
   "git", "docker", "snapshots", "monitor"].forEach((id) => {
    if (REGISTRY[id]) return;
    REGISTRY[id] = async function () {
      try {
        const r = await THADD.call("shell.launch", { app: id });
        if (r.mode === "native") { THADD.toast("Launched", r.command, "success"); return { id, el: h("div") }; }
        THADD.wm.open({ app: id, title: id, width: 700, height: 460,
          body: pad(h("h4", {}, id), h("div", { class: "sub" }, r.note || "This app is not installed in this environment."),
            btn("Install it", () => THADD.apps.open("store"))) });
      } catch (err) {
        THADD.wm.open({ app: id, title: id, width: 660, height: 420, body: pad(h("div", { class: "pill bad" }, String(err.message || err))) });
      }
      return { id };
    };
  });

  THADD.apps.open = function (id, args) { return APPS.open(id, args); };
  THADD.apps.registry = REGISTRY;
})();
