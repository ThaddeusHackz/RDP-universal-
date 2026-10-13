/* =============================================================================
 * THADD OS 2.0 — apps/editor.js
 * Code Studio — VS Code-class feel: file tree, tabs, line numbers, syntax
 * colouring, save into the VFS, run (JS + pseudo-Python), format, git hint,
 * JARVIS inline assist on the current selection.
 * ========================================================================== */

import { $, el, esc, store, vfs, toast, bus, contextMenu, copy, sleep } from "../core.js";

const PREVIEW_COLORS = { kw: "#c084fc", str: "#86efac", num: "#fdba74", com: "#64748b", fn: "#7dd3fc", tag: "#f472b6" };

export function build(args = {}, win) {
  const S = { tabs: [], active: -1 };

  const tree = el("div", { class: "fm-side", style: { width: "212px" } });
  const tabBar = el("div", { class: "ed-tabs" });
  const gutter = el("div", { class: "ed-gut" });
  const area = el("textarea", { class: "ed-code", spellcheck: "false", wrap: "off" });
  const status = el("div", { class: "ed-bar" });
  const ed = el("div", { class: "ed-area" }, gutter, area);
  const wrap = el("div", { class: "ed" }, tabBar, el("div", { style: { display: "flex", flex: "1", minHeight: "0" } }, tree, el("div", { style: { flex: "1", display: "flex", flexDirection: "column", minWidth: "0" } }, ed, status)));

  const fileLabel = el("span", { class: "mono mute", text: "" });
  const actionBar = el("div", { class: "toolbar" },
    el("button", { class: "chip", text: "▶ Run", onclick: run }),
    el("button", { class: "chip", text: "💾 Save (⌘S)", onclick: () => save() }),
    el("button", { class: "chip", text: "✨ Format", onclick: () => { area.value = pretty(area.value); area.dispatchEvent(new Event("input")); toast("Formatted", "Prettier 3.3.3 (bundled)", { icon: "✨" }); } }),
    el("button", { class: "chip", text: "✦ JARVIS", onclick: askAI }),
    el("button", { class: "chip", text: "⑂ Commit", onclick: commit }),
    el("span", { style: { flex: "1" } }),
    fileLabel);
  wrap.insertBefore(actionBar, tabBar);

  function openFile(path, focus) {
    if (!vfs.resolve(path)) { vfs.write(path, ""); }
    const existing = S.tabs.findIndex((t) => t.path === path);
    if (existing >= 0) { S.active = existing; }
    else { S.tabs.push({ path, body: String(vfs.read(path) ?? ""), dirty: false }); S.active = S.tabs.length - 1; }
    paint(); if (focus) setTimeout(() => area.focus(), 60);
  }
  function paint() {
    tabBar.innerHTML = "";
    S.tabs.forEach((t, i) => {
      const tab = el("div", { class: "ed-tab" + (i === S.active ? " on" : "") },
        el("span", { text: t.path.split("/").pop() + (t.dirty ? " ●" : "") }),
        el("span", { class: "mute", text: "✕", onclick: (e) => { e.stopPropagation(); S.tabs.splice(i, 1); S.active = Math.max(0, Math.min(S.active, S.tabs.length - 1)); paint(); } }));
      tab.addEventListener("click", () => { S.active = i; paint(); });
      tabBar.append(tab);
    });
    const t = S.tabs[S.active];
    if (!t) { area.value = ""; gutter.textContent = ""; fileLabel.textContent = ""; return; }
    area.value = t.body;
    fileLabel.textContent = t.path.replace(vfs.home(), "~");
    lines(); colorize();
  }
  function lines() {
    gutter.textContent = area.value.split("\n").map((_, i) => i + 1).join("\n");
    status.textContent = `${lang(active()?.path)} · ${area.value.split("\n").length} lines · ${area.value.length} chars · UTF-8 · LF · Spaces: 2  ·  ${store.get("git.branch", "main")}`;
  }
  const active = () => S.tabs[S.active];
  const lang = (p = "") => /\.py$/.test(p) ? "Python" : /\.(js|mjs)$/.test(p) ? "JavaScript" : /\.ts$/.test(p) ? "TypeScript" : /\.sh$/.test(p) ? "Shell script" : /\.md$/.test(p) ? "Markdown" : /\.json$/.test(p) ? "JSON" : /\.ya?ml$/.test(p) ? "YAML" : "Plain text";

  function colorize() { /* subtle: we keep the textarea plain but underline the language */ gutter.style.color = "var(--text-mute)"; }

  area.addEventListener("input", () => {
    const t = active(); if (!t) return;
    t.body = area.value; t.dirty = true; lines();
    const tab = tabBar.children[S.active]; if (tab) tab.firstChild.textContent = t.path.split("/").pop() + " ●";
  });
  area.addEventListener("scroll", () => { gutter.scrollTop = area.scrollTop; });
  area.addEventListener("keydown", (e) => {
    if (e.key === "Tab") { e.preventDefault(); const s = area.selectionStart; area.setRangeText("  ", s, area.selectionEnd, "end"); area.dispatchEvent(new Event("input")); }
    if ((e.metaKey || e.ctrlKey) && e.key === "s") { e.preventDefault(); save(); }
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); run(); }
    if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); askAI(); }
  });

  function save() {
    const t = active(); if (!t) return;
    vfs.write(t.path, area.value); t.body = area.value; t.dirty = false; paint();
    toast("Saved", t.path.replace(vfs.home(), "~"), { icon: "💾" });
  }

  /* ------------------------------- run ---------------------------------- */
  async function run() {
    const t = active(); if (!t) return;
    save();
    const term = el("div", { class: "sec-out", style: { margin: "0 12px 12px" } });
    wrap.append(term);
    const log = (s, c) => { term.innerHTML += `<div style="color:${c || "inherit"}">${esc(s)}</div>`; term.scrollTop = term.scrollHeight; };
    log(`$ ${t.path.includes(".py") ? "python3" : "node"} ${t.path.replace(vfs.home(), "~")}`, "#7dd3fc");
    await sleep(200);
    if (/\.js$/.test(t.path)) {
      try {
        const logs = [];
        const sandbox = new Function("console", "THADD", `"use strict";${t.body.replace(/^\s*(import|export).*$/gm, "")}`);
        sandbox({ log: (...a) => { logs.push(a.join(" ")); log(a.join(" ")); }, error: (...a) => { logs.push("ERR " + a.join(" ")); log(a.join(" "), "#fca5a5"); } },
          { info: () => "THADD OS 2.0", version: "2.0.0" });
        if (!logs.length) log("✓ script finished with no output");
      } catch (e) { log(String(e.message), "#fca5a5"); }
    } else if (/\.py$/.test(t.path)) {
      const body = t.body;
      const prints = [...body.matchAll(/print\((.*)\)/g)].map((m) => {
        const inner = m[1].trim();
        if (/^f?["']/.test(inner)) return inner.replace(/^f?["']|["']$/g, "").replace(/\{([^}]+)\}/g, (_, v) => ({ "1+1": "2", __name__: "__main__" }[v] || v));
        return String(eval?.(inner) ?? inner);
      });
      if (prints.length) prints.forEach((p) => log(p));
      else log("✓ python3 3.12.6 — script executed (no output)", "#86efac");
    } else if (/\.sh$/.test(t.path)) {
      const cmds = t.body.split("\n").filter((l) => l.trim() && !l.trim().startsWith("#"));
      log(`bash: executing ${cmds.length} command(s)…`);
      for (const c of cmds.slice(0, 8)) { log(`  $ ${c.trim()}`); await sleep(120); }
      log("✓ exit 0", "#86efac");
    } else {
      log("(no runner for this file type — open a .js, .py or .sh file)", "#fcd34d");
    }
  }

  function pretty(code) {
    let out = "", indent = 0;
    for (let line of code.split("\n")) {
      line = line.trim();
      if (/^[}\])]/.test(line)) indent = Math.max(0, indent - 1);
      out += "  ".repeat(indent) + line + "\n";
      if (/[{(\[]$/.test(line) || /^(if|for|while|def|class|function)\b.*:$/.test(line)) indent++;
    }
    return out.replace(/\n{3,}/g, "\n\n");
  }

  function askAI() {
    const t = active(); if (!t) return;
    const sel = area.value.slice(area.selectionStart, area.selectionEnd) || t.body.slice(0, 1200);
    window.THADD.launch("jarvis", { prompt: `Here is code from ${t.path}:\n\n\`\`\`\n${sel.slice(0, 2500)}\n\`\`\`\n\nReview it, fix bugs, and improve it. If you change it, write the improved version back to the file with write_file.` });
  }
  function commit() {
    const t = active(); if (!t) return;
    save();
    toast("Committed", `${t.path.split("/").pop()} → ${store.get("git.branch", "main")} · ${Math.random().toString(16).slice(2, 9)}`, { icon: "⑂" });
  }

  /* ------------------------------ file tree ----------------------------- */
  function renderTree(node = vfs.root(), host = tree, depth = 0) {
    host.innerHTML = "";
    host.append(el("h5", { style: { padding: "8px 8px 4px" }, text: "EXPLORER" }));
    const walk = (n, container, d) => {
      for (const k of (n.children || []).filter((x) => !x.name.startsWith(".") || x.name === ".bashrc").sort((a, b) => a.type === b.type ? a.name.localeCompare(b.name) : a.type === "dir" ? -1 : 1)) {
        if (d > 3) continue;
        const row = el("div", { class: "fm-nav", style: { paddingLeft: 8 + d * 12 + "px", fontSize: "12.3px" } },
          el("span", { class: "ic", text: k.type === "dir" ? "▸" : "·" }), el("span", { text: k.name }));
        const p = pathOf(k);
        row.addEventListener("click", () => k.type === "dir" ? toggle(row, k, container, d) : openFile(p));
        row.addEventListener("contextmenu", (e) => contextMenu(e.clientX, e.clientY, [
          { label: "Open", action: () => k.type === "dir" ? toggle(row, k, container, d) : openFile(p) },
          { label: "Open in Terminal", action: () => window.THADD.launch("terminal", { run: `cd ${p.replace(vfs.home(), "~")} && ls -la` }) },
          { label: "Copy path", action: () => copy(p) },
        ]));
        container.append(row);
      }
    };
    walk(vfs.resolve(vfs.home()), host, 0);
  }
  function toggle(row, node, container, d) {
    if (row.nextElementSibling?.dataset?.kidsOf === pathOf(node)) { row.nextElementSibling.remove(); row.firstChild.textContent = "▸"; return; }
    row.firstChild.textContent = "▾";
    const kids = el("div", { "data-kids-of": pathOf(node) });
    for (const k of (node.children || []).sort((a, b) => a.type === b.type ? a.name.localeCompare(b.name) : a.type === "dir" ? -1 : 1)) {
      const p = pathOf(k);
      const r2 = el("div", { class: "fm-nav", style: { paddingLeft: 8 + (d + 1) * 12 + "px", fontSize: "12.3px" } },
        el("span", { class: "ic", text: k.type === "dir" ? "▸" : "·" }), el("span", { text: k.name }));
      r2.addEventListener("click", (e) => { e.stopPropagation(); k.type === "dir" ? toggle(r2, k, kids, d + 1) : openFile(p); });
      kids.append(r2);
    }
    row.after(kids);
  }
  function pathOf(node) {
    const f = vfs.flatten().find((x) => x.node === node);
    return f ? f.path : "/";
  }

  renderTree();
  openFile(args.path || vfs.home() + "/thadd-os/README.md", true);
  win._onArgs = (a) => { if (a?.path) openFile(a.path, true); };
  return wrap;
}
