/* =============================================================================
 * THADD OS 2.0 — apps/dev.js
 * Developer tools: PowerShell 7 console, Git console, Containers (Docker),
 * Debugger, API Tester, Jupyter, DB Browser, Automation (cron/systemd), and
 * the Console (journald logs).  Each shares the same console shell.
 * ========================================================================== */

import { $, el, esc, store, vfs, toast, sleep, contextMenu, copy } from "../core.js";

export function build(args = {}, win, meta) {
  const id = win._app;
  const F = { powershell: powershell, git: gitConsole, docker: containers, dbg: debuggerApp, apiweb: apitester,
    jupyter: jupyter, sqlite: dbbrowser, automation: automation, logs: consoleApp }[id];
  return F ? F(args, win, meta) : el("div", { class: "pad", text: "Unknown dev app" });
}

/* ---------------------------- shared console shell ------------------------ */
function consoleShell({ title, prompt, banner, handler, extraBar }) {
  const out = el("div", { class: "shell-out" });
  const input = el("input", { class: "ed-code", style: { borderTop: "1px solid var(--hairline)", padding: "10px 14px", fontSize: "12.8px", background: "rgba(0,0,0,.28)" }, spellcheck: "false", placeholder: prompt });
  const wrap = el("div", { class: "shell-wrap" }, out, input);
  const print = (t, cls) => { const d = el("div", { class: cls || "" }); d.innerHTML = esc(t).replace(/&amp;(#\w+;|[a-z]+;)/g, "&$1"); out.append(d); out.scrollTop = out.scrollHeight; };
  if (banner) print(banner);
  const hist = [];
  input.addEventListener("keydown", async (e) => {
    if (e.key === "ArrowUp") { input.value = hist[hist.length - 1] || ""; }
    else if (e.key === "Enter" && input.value.trim()) {
      const cmd = input.value.trim(); hist.push(cmd); input.value = "";
      print(`${prompt} ${cmd}`, "ps-cmd");
      await handler(cmd, print);
      print("");
    }
  });
  if (extraBar) wrap.prepend(extraBar);
  setTimeout(() => input.focus(), 80);
  return wrap;
}

/* ------------------------------- PowerShell ------------------------------- */
function powershell() {
  const ps = {
    cwd: "C:\\Users\\thadd",
    vars: { "$env:COMPUTERNAME": "THADD-OS", "$PSVersionTable.PSVersion": "7.4.6" },
    aliases: { ls: "Get-ChildItem", dir: "Get-ChildItem", cat: "Get-Content", ps: "Get-Process" },
  };
  return consoleShell({
    prompt: `PS ${ps.cwd}>`,
    banner: "PowerShell 7.4.6 (THADD Core)\nCopyright (c) THADD OS Project. MIT Licence.\n\nType Get-Help for help · THADD cmdlets: Get-ThaddInfo, Invoke-ThaddScan, Start-THDIsoBuild\n",
    handler: async (cmd, print) => {
      const [c0, ...rest] = cmd.split(/\s+/);
      const c = ps.aliases[c0] || c0;
      const p = (t, k) => print(t, k);
      if (/^Get-ChildItem|dir|ls/.test(c)) {
        p("    Directory: " + ps.cwd + "\n\nMode          LastWriteTime         Length Name\n----          -------------         ------ ----");
        const kids = ["Documents", "Downloads", "Pictures", "thadd-os", "notes.ps1"];
        kids.forEach((k) => p(`${k.includes(".") ? "-a----" : "d-----"}   ${new Date().toLocaleString().padEnd(20)} ${k.includes(".") ? "    412" : "        "} ${k}`));
        return;
      }
      if (/Get-Process/.test(c)) { p(" NPM(K)    PM(M)      WS(M)     CPU(s)      Id  SI ProcessName\n ------    -----      -----     ------      --  -- -----------");
        for (const [n, id2, m] of [["code", 1042, 142.9], ["firefox", 901, 468.3], ["thadd-shield", 412, 55.1], ["thadd-jarvis", 1201, 102.4], ["xrdp", 1402, 28.2]])
          p(`${String(12 + Math.floor(Math.random() * 40)).padStart(6)} ${String((m / 4).toFixed(1)).padStart(8)} ${String(m.toFixed(1)).padStart(10)} ${String((Math.random() * 8).toFixed(2)).padStart(10)} ${String(id2).padStart(7)}   1 ${n}`); return; }
      if (/Get-Service/.test(c)) { p("Status   Name           DisplayName\n------   ----           -----------");
        for (const r of [["Running", "thadd-shield", "THADD Shield hardening daemon"], ["Running", "thadd-jarvis", "JARVIS AI assistant"], ["Running", "xrdp", "Remote Desktop Protocol server"], ["Stopped", "cups", "Printing Service"]]) p(`${r[0].padEnd(9)}${r[1].padEnd(15)}${r[2]}`); return; }
      if (/Get-Volume/.test(c)) { p("DriveLetter FriendlyName FileSystemType SizeRemaining Size\n------------ ------------ -------------- ------------- ----\nC            THADD-OS     NTFS                 448 GB  511 GB\nD            DATA         NTFS                 1.9 TB  2.0 TB"); return; }
      if (/Get-ThaddInfo/.test(c)) { p("OS         : THADD OS 2.0 (Nebula Prime)\nKernel     : 6.9.7-thadd-hardened\nShield     : STRICT (98/100)\nAI         : JARVIS on Groq\nArsenal    : 600+ tools\nRepo       : github.com/ThaddeusHackz/RDP-universal-"); return; }
      if (/Invoke-ThaddScan/.test(c)) { await sleep(600); p("Running CIS + CVE + YARA audit…\n  1241 controls: 1238 pass · 0 critical CVE · hardening 98/100 (A+)", ""); return; }
      if (/Start-THDIsoBuild/.test(c)) { await sleep(800); p("live-build: 10 stages\n  [10/10] → thadd-os-2.0-nebula-prime-amd64.iso (2.94 GB)\nSHA256 9f4c2ab4d1e0c7b8f3a91d6e2c48b70a5f1d3e8c9a2b4f6e0d7c1a3b5e9f2c4d"); return; }
      if (/^cd /.test(c)) { ps.cwd = rest[0] === ".." ? "C:\\Users" : rest.join(" "); return; }
      if (/Get-Content|cat/.test(c)) { p("Param([string]$Path)\nWrite-Host \"THADD OS PowerShell profile loaded\"\nfunction prompt { \"PS $(Get-Location)> \" }"); return; }
      if (/winget/.test(c)) { p("Found THADD OS 2.0 [ThaddOS.ThaddOS]\nSuccessfully installed"); return; }
      if (/Set-ExecutionPolicy/.test(c)) { p("Execution policy set to RemoteSigned for LocalMachine."); return; }
      if (/Write-Host|echo/.test(c)) { p(rest.join(" ").replace(/^["']|["']$/g, "")); return; }
      if (/Get-Help|help/.test(c)) { p("THADD Core cmdlets:\n  Get-ThaddInfo      OS + security summary\n  Invoke-ThaddScan   run a full audit\n  Start-THDIsoBuild  build the bootable ISO\n  Get-Service        list services\n  Get-Volume         disk info\n  Get-Process        processes\n\nAliases: ls/dir → Get-ChildItem · cat → Get-Content"); return; }
      if (/\$/.test(c)) { p("(expression evaluated — variables: COMPUTERNAME=THADD-OS, PSVersion=7.4.6)"); return; }
      p(`'${c0}' is not recognized as a cmdlet, function, script file or operable program.`, "t-err");
      p("Try Get-Help or Get-ThaddInfo.");
    },
  });
}

/* ---------------------------------- Git ----------------------------------- */
function gitConsole() {
  const repo = { branch: "main", staged: [], modified: ["desktop/js/apps/jarvis.js", "README.md", "os/packages.list"] };
  return consoleShell({
    prompt: "⑂ thadd-os (main)",
    banner: "Git 2.46.0 — THADD OS repository\nDirectory: /home/thadd/thadd-os\nRemote: github.com/ThaddeusHackz/RDP-universal-.git\n",
    extraBar: el("div", { class: "toolbar" },
      el("span", { class: "chip on", text: "main" }), el("span", { class: "chip", text: "origin/main" }),
      el("span", { class: "mute", text: "3 modified · 1 untracked" }),
      el("span", { style: { flex: "1" } }),
      el("button", { class: "chip", text: "stage all", onclick: () => { repo.staged = [...repo.modified]; repo.modified = []; toast("git add", "3 files staged", { icon: "⑂" }); } }),
      el("button", { class: "chip", text: "commit", onclick: () => toast("git commit", "[main 9f4c2ab] feat(os): THADD OS 2.0 Nebula Prime", { icon: "⑂" }) }),
      el("button", { class: "chip", text: "push", onclick: () => toast("git push", "eac0929..9f4c2ab main -> main (7 objects, 2.41 KiB)", { icon: "⬆" }) })),
    handler: async (cmd, print) => {
      const [c, ...args2] = cmd.split(/\s+/);
      if (c !== "git") { print(`thadd-os$ ${cmd}: not a git command. Try 'git status'.`, "t-err"); return; }
      const [sub, ...rest] = args2;
      switch (sub) {
        case "status": print(`On branch main\nYour branch is up to date with 'origin/main'.\n\nChanges to be committed:\n${repo.staged.map((f) => "        modified:   " + f).join("\n") || "  (nothing staged)"}\n\nChanges not staged for commit:\n${repo.modified.map((f) => "        modified:   " + f).join("\n") || "  (clean)"}`); return;
        case "add": repo.staged.push(...(rest.includes(".") ? repo.modified.splice(0) : rest)); print(`${repo.staged.length} path(s) staged`); return;
        case "commit": repo.staged = []; print(`[main ${Math.random().toString(16).slice(2, 9)}] ${rest.filter((x) => !x.startsWith("-")).join(" ") || "update"}\n 3 files changed, 214 insertions(+), 18 deletions(-)`); return;
        case "log": print("commit 9f4c2ab (HEAD -> main, origin/main)\nAuthor: Thadd <thadd@thadd.os>\nDate:   " + new Date().toString() + "\n\n    feat(os): THADD OS 2.0 Nebula Prime\n\ncommit 4c1e88f\n    feat(desktop): Sequoia×Fluent shell\n\ncommit eac0929\n    ci: fresh desktop screenshot"); return;
        case "diff": print("diff --git a/desktop/js/apps/jarvis.js b/desktop/js/apps/jarvis.js\n@@ -12,7 +12,7 @@\n-  const model = \"mixtral-8x7b-32768\"\n+  const model = \"llama-3.3-70b-versatile\"\n+  tools: TOOLS, tool_choice: \"auto\""); return;
        case "branch": print("* main\n  arena/6e1ad65e-rdp-universal\n  feat/parrot-arsenal\n  release/2.0"); return;
        case "checkout": case "switch": print(`Switched to branch '${rest[1] || rest[0]}'`); return;
        case "merge": print(`Updating eac0929..9f4c2ab\nFast-forward\n desktop/js/apps/jarvis.js | 214 +++++++++++++++++++++\n 3 files changed, 412 insertions(+)`); return;
        case "remote": print("origin\thttps://github.com/ThaddeusHackz/RDP-universal-.git (fetch)\norigin\thttps://github.com/ThaddeusHackz/RDP-universal-.git (push)"); return;
        case "push": print("Enumerating objects: 12, done.\nWriting objects: 100% (7/7), 2.41 KiB | 2.41 MiB/s, done.\nTo github.com:ThaddeusHackz/RDP-universal-.git\n   eac0929..9f4c2ab  main -> main"); return;
        case "stash": print("Saved working directory and index state WIP on main: 9f4c2ab feat(os): THADD OS 2.0"); return;
        case "rebase": print("Successfully rebased and updated refs/heads/main."); return;
        case "worktree": print("Preparing worktree (new branch 'iso-build')\nHEAD is now at 9f4c2ab feat(os): THADD OS 2.0"); return;
        case "tag": print("v2.0.0\nv1.9.0\nv1.8.0"); return;
        case "clone": print("Cloning into 'RDP-universal-'...\nReceiving objects: 100% (1284/1284), 4.12 MiB | 8.20 MiB/s, done."); return;
        default: print(`git: '${sub}' is not a git command. See 'git --help'.`, "t-err");
      }
    },
  });
}

/* ------------------------------- Containers -------------------------------- */
function containers() {
  const w = el("div", { class: "pad" });
  w.append(el("div", { class: "st-h", text: "Containers" }), el("div", { class: "st-sub", text: "Docker 27.2 / Podman 5.1 · rootless · compose v2 · buildx" }));
  const tbl = el("table", { class: "tbl" });
  tbl.append(el("thead", {}, el("tr", {}, ...["Container", "Image", "Status", "Ports", "CPU", "RAM"].map((h) => el("th", { text: h })))));
  const tb = el("tbody");
  for (const [n, i, s, p, c, m] of [["thadd-os", "thadd/desktop:2.0", "Up 2 hours", "8080→8080", "3.2%", "412 MB"],
    ["thadd-db", "postgres:16", "Up 6 hours", "5432", "0.8%", "128 MB"], ["jarvis-agent", "thadd/jarvis:latest", "Up 42 min", "—", "1.1%", "96 MB"],
    ["parrot-worker", "parrotsec/worker:6.3", "Exited (0) 12m", "—", "0%", "—"]])
    tb.append(el("tr", {}, el("td", { text: n }), el("td", { class: "mono", text: i }), el("td", { text: s }), el("td", { text: p }), el("td", { text: c }), el("td", { text: m })));
  tbl.append(tb);
  w.append(el("div", { class: "toolbar" }, el("button", { class: "chip", text: "▶ compose up -d", onclick: () => toast("compose", "Started 4 services in 3.1s", { icon: "🐳" }) }),
    el("button", { class: "chip", text: "⏹ stop all", onclick: () => toast("docker", "4 containers stopped", { icon: "⏹" }) }),
    el("button", { class: "chip", text: "🔨 build desktop:2.0", onclick: () => window.THADD.launch("terminal", { run: "docker build -t thadd-os:2.0 ." }) }),
    el("button", { class: "chip", text: "▤ logs vs-code", onclick: () => window.THADD.launch("terminal", { run: "journalctl -u docker -n 20" }) })), tbl);
  return w;
}

/* -------------------------------- Debugger --------------------------------- */
function debuggerApp() {
  return consoleShell({
    prompt: "(gdb)",
    banner: "GNU gdb 15.2 — THADD debug front-end\nReading symbols from ./thadd-shell…\n",
    handler: async (cmd, print) => {
      const c = cmd.trim();
      if (/^(run|r)$/.test(c)) { await sleep(300); print("Starting program: /home/thadd/thadd-os/thadd-shell\n[New Thread 0x7ffff7c00640 (LWP 41284)]\nTHADD shell initialised — 214 apps registered\n[Thread 0x7ffff7c00640 exited]\n[Inferior 1 (process 41280) exited normally]"); return; }
      if (/^b(reak)?\s/.test(c)) { print(`Breakpoint ${1 + Math.floor(Math.random() * 3)} at 0x${Math.random().toString(16).slice(2, 10)}: file kernel.c, line ${40 + Math.floor(Math.random() * 200)}.`); return; }
      if (/^info registers/.test(c)) { print("rax            0x1                 1\nrbx            0x7fffffffe2a0      140737488347552\nrcx            0x0                 0\nrdx            0x7fffffffe3c8      140737488347848\nrip            0x5555555561a4      0x5555555561a4 <main+36>\ncs             0x33                51\nflags          0x246               [ PF ZF IF ]"); return; }
      if (/^x\//.test(c)) { print("0x7fffffffe2a0: 0x00005555555561a4   0x0000000000000000\n0x7fffffffe2b0: 0x00007fffffffeb28   0x0000000000000001"); return; }
      if (/^bt|backtrace/.test(c)) { print("#0  main () at kernel.c:128\n#1  0x00007ffff7dcd24a in __libc_start_call_main () at libc-start.c:392\n#2  0x00007ffff7dcd305 in __libc_start_main_impl () at libc-start.c:360"); return; }
      if (/^continue|c$/.test(c)) { print("Continuing.\nTHADD shell: 60fps compositor active\n[Inferior 1 exited normally]"); return; }
      if (/^quit|q$/.test(c)) { print("A debugging session is active. Type `quit` again to exit."); return; }
      print(`Undefined command: "${c}". Try "help".`);
    },
  });
}

/* ------------------------------- API Tester -------------------------------- */
function apitester() {
  const w = el("div", { class: "pad" });
  const url = el("input", { class: "tb-input", value: "https://api.groq.com/openai/v1/models" });
  const method = el("select", { style: { padding: "8px", borderRadius: "8px", background: "rgba(255,255,255,.08)", border: "1px solid var(--hairline)" } },
    ...["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => el("option", { text: m })));
  const body = el("textarea", { class: "ed-code", style: { height: "130px", marginTop: "10px" }, text: '{\n  "model": "llama-3.3-70b-versatile",\n  "messages": [{"role":"user","content":"ping"}]\n}' });
  const out = el("pre", { class: "sec-out", text: "(response appears here)" });
  const send = el("button", { class: "btn primary", text: "Send →", onclick: async () => {
    out.textContent = "Sending…";
    const key = store.get("ai.groqKey", "");
    if (!key) { out.textContent = `HTTP/1.1 401 Unauthorized\n\n{\n  "error": {\n    "message": "No Groq API key set. Open JARVIS → ⚙ and paste your key to make live calls.",\n    "type": "invalid_request_error"\n  }\n}\n\nTip: THADD OS's API Tester signs requests with your vault key automatically when set.`; return; }
    try {
      const t0 = performance.now();
      const r = await fetch(url.value, { method: method.value, headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" }, body: method.value === "GET" ? undefined : body.value });
      const txt = await r.text();
      out.textContent = `HTTP/1.1 ${r.status} ${r.statusText}  ·  ${(performance.now() - t0).toFixed(0)} ms\n\n${txt.slice(0, 4000)}`;
    } catch (e) { out.textContent = "Request failed: " + e.message; }
  } });
  w.append(el("div", { class: "st-h", text: "API Tester" }), el("div", { class: "st-sub", text: "REST + GraphQL · env vars · collections · live Groq calls supported" }),
    el("div", { style: { display: "flex", gap: "8px" } }, method, url, send), body, out);
  return w;
}

/* --------------------------------- Jupyter --------------------------------- */
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
    cell.append(ta, el("div", { style: { display: "flex", gap: "8px", marginTop: "8px" } }, run, el("button", { class: "chip", text: "✦ Explain with JARVIS", onclick: () => window.THADD.launch("jarvis", { prompt: `Explain this Python code and suggest improvements:\n\n${ta.value}` }) })),
      el("pre", { class: "cellout", style: { marginTop: "8px", color: "#86efac", whiteSpace: "pre-wrap" } }));
    host.append(cell);
  };
  addCell("import numpy as np\nx = np.arange(5)\nprint(x.mean())");
  w.append(host, el("button", { class: "chip", style: { marginTop: "10px" }, text: "＋ Add cell", onclick: () => addCell() }));
  return w;
}

/* ------------------------------- DB Browser -------------------------------- */
function dbbrowser() {
  const w = el("div", { class: "pad" });
  w.append(el("div", { class: "st-h", text: "DB Browser" }), el("div", { class: "st-sub", text: "SQLite 3.46 · PostgreSQL 16 · MySQL 8 · query console + schema explorer" }));
  const q = el("textarea", { class: "ed-code", style: { height: "90px" }, text: "SELECT name, uptime_seconds, hardening FROM services\nWHERE hardening > 90\nORDER BY hardening DESC;" });
  const out = el("pre", { class: "sec-out", text: "name          uptime_seconds  hardening\nthadd-shield  41208           98\nthadd-jarvis  4102            96\nxrdp          41208           94" });
  w.append(q, el("div", { style: { display: "flex", gap: "8px", margin: "10px 0" } },
    el("button", { class: "btn primary", text: "▶ Run query", onclick: () => toast("Query", "3 rows in 1.2 ms (SQLite engine)", { icon: "🗄" }) }),
    el("button", { class: "btn", text: "Export CSV", onclick: () => { vfs.write(vfs.home() + "/Documents/query-export.csv", "name,uptime,hardening\nthadd-shield,41208,98\n"); toast("Exported", "~/Documents/query-export.csv", { icon: "⬇" }); } }),
    el("button", { class: "btn", text: "✦ JARVIS: optimise query", onclick: () => window.THADD.launch("jarvis", { prompt: "Optimise this SQL query and explain the plan:\n\n" + q.value }) })), out);
  return w;
}

/* ------------------------------- Automation -------------------------------- */
function automation() {
  const w = el("div", { class: "pad" });
  w.append(el("div", { class: "st-h", text: "Automation" }), el("div", { class: "st-sub", text: "cron · systemd timers · THADD flows (visual, event-driven)" }));
  const tbl = el("table", { class: "tbl" });
  tbl.append(el("thead", {}, el("tr", {}, ...["Schedule", "Job", "Last run", "Status"].map((h) => el("th")))),
    el("tbody", {}, ...[["0 3 * * *", "thadd scan --full --quiet", "03:00 today", "✔ ok (412 ms)"],
      ["*/15 * * * *", "thadd-shield heartbeat", "09:30 today", "✔ ok"],
      ["0 4 * * 0", "apt-get upgrade -y", "Sun 04:00", "✔ 12 upgrades"],
      ["@reboot", "thadd-jarvis --daemon --groq", "boot+2s", "✔ ok"],
      ["daily 23:00", "zfs snapshot thadd/home@daily", "23:00 yesterday", "✔ 21.4 GiB"]].map((r) => el("tr", {}, ...r.map((c) => el("td", { text: c }))))));
  w.append(tbl, el("div", { class: "toolbar", style: { marginTop: "12px" } },
    el("button", { class: "chip", text: "＋ New flow", onclick: () => toast("THADD Flow", "Trigger: file saved in ~/Downloads → Action: ask JARVIS to sort it", { icon: "⚡" }) }),
    el("button", { class: "chip", text: "✎ Edit crontab", onclick: () => window.THADD.launch("terminal", { run: "crontab -l" }) }),
    el("button", { class: "chip", text: "▤ systemd timers", onclick: () => window.THADD.launch("terminal", { run: "systemctl list-timers" }) })));
  return w;
}

/* --------------------------------- Console --------------------------------- */
function consoleApp() {
  const lines = [];
  const stamp = (i) => new Date(Date.now() - (400 - i) * 12000).toISOString().replace("T", " ").slice(0, 19);
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
    ["docker", "container thadd-os started (healthy)"],
  ];
  const out = el("div", { class: "shell-out" });
  const paint = (filter = "") => {
    out.innerHTML = "";
    base.concat(base).forEach(([svc, msg], i) => {
      if (filter && !(svc + msg).toLowerCase().includes(filter.toLowerCase())) return;
      const d = el("div");
      d.innerHTML = `<span class="dim">${stamp(i)}</span> <span class="t-cyan">${esc(svc)}</span>: ${esc(msg)}`;
      out.append(d);
    });
    out.scrollTop = out.scrollHeight;
  };
  const f = el("input", { class: "tb-input", placeholder: "Filter (service or text)…", style: { maxWidth: "320px" } });
  f.addEventListener("input", () => paint(f.value));
  paint();
  return el("div", { class: "shell-wrap" }, el("div", { class: "toolbar" }, el("span", { class: "chip on", text: "journalctl -f" }),
    el("button", { class: "chip", text: "Kernel ring", onclick: () => window.THADD.launch("terminal", { run: "dmesg" }) }), el("span", { style: { flex: "1" } }), f), out);
}
