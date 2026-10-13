/* =============================================================================
 * THADD OS 2.0 — apps/terminal.js
 * A real command engine: 180+ commands, pipes, redirection, &&/; chains,
 * history, tab-completion, Parrot offensive toolkit, git, apt/systemd,
 * PowerShell/Windows shims and the `thadd` control plane.
 * ========================================================================== */

import { $, el, esc, pad, sleep, store, vfs, bus, toast, contextMenu, copy, uptime, fmtDur, fmtBytes } from "../core.js";

const OS = "THADD OS 2.0 (Nebula Prime)";
const KERNEL = "6.9.7-thadd-hardened";
const HOST = "thadd-os";

export function build(args = {}, win) {
  const S = {
    user: store.get("user", "thadd"),
    host: HOST,
    cwd: "/home/" + store.get("user", "thadd"),
    env: {
      PATH: "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/opt/thadd/bin",
      HOME: "/home/" + store.get("user", "thadd"),
      SHELL: "/bin/zsh", TERM: "xterm-256color", LANG: "en_GH.UTF-8",
      EDITOR: "code", THADD_SHIELD: "strict", GROQ_MODEL: store.get("ai.model", "llama-3.3-70b-versatile"),
    },
    history: store.get("term.history", ["sudo thadd doctor", "neofetch", "ls -la ~/thadd-os"]),
    histIdx: -1, aliases: { ll: "ls -lah", la: "ls -A", iso: "thadd-iso build --release", please: "sudo" },
    vars: {}, running: false, ctrl: false, bg: [], capture: null, busy: false,
  };

  const wrap = el("div", { class: "term-wrap" });
  const tabs = el("div", { class: "term-tabs" },
    el("div", { class: "term-tab active", text: "zsh — thadd@thadd-os: ~" }),
    el("div", { class: "term-tab", text: "+" }));
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
  box(`${OS} · kernel ${KERNEL} · zsh 5.9 · ${new Date().toDateString()}`, "t-dim");
  box(`Type ${c("help")} for the command index, ${c("thadd help")} for OS tools, ${c("parrot")} for the 600-tool arsenal.`, "t-dim");
  print("", "");
  prompt();
  scroll();

  function c(x) { return `\u001b[36m${x}\u001b[0m`; }
  function colorize(s) {
    return s.replace(/\u001b\[36m/g, "\u0001").replace(/\u001b\[0m/g, "\u0002")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\u0001/g, '<span class="t-cyan">')
      .replace(/\u0002/g, "</span>");
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
  function box(text, cls = "") { print(text, cls); }
  function scroll() { out.scrollTop = out.scrollHeight; }
  function prompt() {
    const short = S.cwd.startsWith(S.env.HOME) ? "~" + S.cwd.slice(S.env.HOME.length) : S.cwd;
    psi.innerHTML = `<span class="t-prompt">${S.user}@${S.host}</span>:<span class="t-path">${esc(short)}</span>$&nbsp;`;
  }

  /* ------------------------------ input UX ------------------------------- */
  input.addEventListener("keydown", async (e) => {
    if (e.key === "Enter") {
      const line = input.value.trim();
      input.value = "";
      if (!line) { prompt2(); return; }
      S.history.push(line); store.set("term.history", S.history.slice(-400));
      print(`<span class="t-prompt">${S.user}@${S.host}</span>:<span class="t-path">${esc(S.cwd)}</span>$ ${esc(line)}`);
      if (S.ctrl) { S.ctrl = false; print("^C", "t-warn"); return; }
      try { await exec(line); } catch (err) { print(String(err && err.message || err), "t-err"); }
      print(""); prompt2();
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
      S.ctrl = true; print("^C", "t-warn"); input.value = "";
    } else if (e.key === "l" && e.ctrlKey) { e.preventDefault(); out.innerHTML = ""; }
    else if (e.key === "d" && e.ctrlKey && !input.value) { print("logout", "t-dim"); }
  });
  function prompt2() { prompt(); }

  /* Programmatic entry point — used by JARVIS, Spotlight and the thadd CLI. */
  win.el._runCommand = async (cmd, silent = false) => {
    while (S.busy) await sleep(60);          // serialise: JARVIS may drive the same shell
    S.busy = true;
    const prev = S.capture;
    S.capture = [];
    try { await exec(String(cmd)); } catch (e) { S.capture.push(String(e && e.message || e)); }
    const outText = S.capture.join("\n");
    S.capture = prev || null;
    S.busy = false;
    if (!silent) print("");
    return outText || "(no output)";
  };
  win._runCommand = win.el._runCommand;

  // pre-run a command handed in by other apps (e.g. "Build ISO" from Spotlight)
  if (args.run) setTimeout(() => { print(`<span class="t-prompt">${S.user}@${S.host}</span>:<span class="t-path">${S.cwd}</span>$ ${esc(args.run)}`); exec(args.run).then(() => { print(""); prompt(); }); }, 350);

  /* --------------------------- path utilities ---------------------------- */
  function abs(p) {
    if (!p) return S.cwd;
    p = String(p).replace(/^~(?=\/|$)/, S.env.HOME);
    if (p.startsWith("/")) return p;
    return (S.cwd === "/" ? "" : S.cwd) + "/" + p;
  }
  function node(p) { return vfs.resolve(abs(p)); }
  function short(p) { return p.startsWith(S.env.HOME) ? "~" + p.slice(S.env.HOME.length) : p; }

  /* ------------------------------ executor ------------------------------- */
  async function exec(line) {
    // split on ; and && (no grouping over pipes for simplicity)
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
    if (m) { redirect = { append: m[1] === ">>", path: m[2] }; cmdline = cmdline.slice(0, m.index); }
    const pipe = cmdline.split("|").map((s) => s.trim());
    let stdin = null;
    for (let i = 0; i < pipe.length; i++) {
      const seg = pipe[i];
      const toks = seg.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
      const argv = toks.map((t) => t.replace(/^["']|["']$/g, ""));
      let cmd = argv.shift() || "";
      // alias expansion
      if (S.aliases[cmd]) { const ex = S.aliases[cmd].split(/\s+/); cmd = ex[0]; argv.unshift(...ex.slice(1)); }
      const fn = C[cmd] || C[cmd.replace(/^sudo$/, "")];
      if (!fn) {
        const guess = suggest(cmd);
        print(`zsh: command not found: ${cmd}`, "t-err");
        if (guess) print(`did you mean: ${guess}?`, "t-dim");
        if (i === 0) print(`Try ${"'help'"}, ${"'parrot'"}, ${"'thadd help'"}, or ${"'apt install " + cmd + "'"}.`, "t-dim");
        return false;
      }
      let outBuf = [];
      const emit = (t, cls) => outBuf.push({ t: String(t), cls: cls || "" });
      const res = await fn({ argv, args: argv, raw: seg, stdin, emit, print, S, win });
      if (redirect && (res === undefined || res === true)) {
        const body = outBuf.map((o) => o.t.replace(/\u001b\[\d+m/g, "")).join("\n");
        const cur = vfs.read(abs(redirect.path)) || "";
        vfs.write(abs(redirect.path), redirect.append ? cur + body + "\n" : body + "\n");
        toast("Written", short(abs(redirect.path)), { icon: "💾" });
        return true;
      }
      if (i === pipe.length - 1) { outBuf.forEach((o) => print(o.t, o.cls)); }
      else stdin = outBuf.map((o) => o.t).join("\n");
    }
    return true;
  }
  function suggest(c) {
    const keys = Object.keys(C);
    let best = null, score = 3;
    for (const k of keys) {
      const d = lev(k, c);
      if (d < score) { score = d; best = k; }
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

  /* ---------------------- async "realistic" runners ---------------------- */
  async function type(lines, delay = 34, cls = "") {
    for (const l of lines) { print(l, cls); await sleep(delay); }
  }

  /* ═════════════════════════════ COMMANDS ════════════════════════════ */
  const C = {};
  const def = (names, fn) => names.split(" ").forEach((n) => (C[n] = fn));

  /* ---- shell basics ---- */
  def("help ?", async ({ emit }) => {
    emit(`${OS} — zsh command index`, "t-cyan");
    emit("");
    const groups = [
      ["files", "ls cd pwd cat less head tail touch mkdir rm mv cp tree find grep wc sed awk stat file du df ln chmod chown"],
      ["system", "ps top free htop lscpu lsblk lspci lsusb uptime uname hostname date cal whoami id who env export history clear exit reboot shutdown systemctl service journalctl dmesg kill jobs"],
      ["network", "ip ifconfig ping traceroute dig nslookup whois curl wget ssh scp rsync netstat ss nmap tcpdump arp iwconfig"],
      ["security", "parrot msfconsole sqlmap hydra john hashcat aircrack-ng gobuster ffuf nikto searchsploit responder impacket bloodhound enum4linux smbclient wpscan whatweb openssl gpg ufw iptables fail2ban lynis rkhunter chkrootkit clamav aide"],
      ["dev", "python3 node npm pip gcc g++ make cargo go git docker kubectl jupyter sqlite3 psql code vim nano"],
      ["windows", "dir cls ipconfig tasklist powershell winget where certutil net"],
      ["macos", "brew defaults open say pbcopy pbpaste sw_vers"],
      ["thadd", "thadd thadd-iso thadd-shield thadd-ai groq ai jarvis neofetch fastfetch"],
      ["fun", "cowsay figlet fortune sl cmatrix lolcat yes rev base64 md5sum sha256sum xxd bc seq sort uniq cut tr tee watch time espeak"],
    ];
    for (const [g, list] of groups) {
      emit(g.padEnd(10) + " " + list.replace(/(\S+)/g, "\u001b[36m$1\u001b[0m"), "");
    }
    emit("");
    emit("Pipes, >, >>, && and ; are supported.  Tab completes.  ↑/↓ history.", "t-dim");
    emit("Full docs: type `man <command>` — 600+ tools: type `parrot`.", "t-dim");
  });

  def("ls dir", async ({ args, emit }) => {
    const flags = args.filter((a) => a.startsWith("-")).join("");
    const paths = args.filter((a) => !a.startsWith("-"));
    const target = abs(paths[0] || ".");
    const n = vfs.resolve(target);
    if (!n) { emit(`ls: cannot access '${paths[0]}': No such file or directory`, "t-err"); return; }
    if (n.type === "file") { emit(n.name); return; }
    const all = flags.includes("a");
    const kids = (n.children || []).filter((k) => all || !k.name.startsWith("."));
    if (flags.includes("l")) {
      let total = 0;
      emit(`total ${kids.length * 4}`);
      for (const k of kids) {
        const isDir = k.type === "dir";
        const size = isDir ? 4096 : String(k.body || "").length;
        total += size;
        const perm = isDir ? "drwxr-xr-x" : (k.name.startsWith(".") ? "-rw-------" : "-rw-r--r--");
        emit(`${perm}  ${isDir ? "2" : "1"} ${S.user} ${S.user} ${String(size).padStart(8)} ${dateStr(k.mtime)} ${isDir ? "\u001b[36m" + k.name + "/\u001b[0m" : k.name}`);
      }
      emit(`\u001b[90m${kids.length} entries · ${fmtBytes(total)}\u001b[0m`);
      return;
    }
    if (kids.length === 0) return;
    const cols = Math.max(1, Math.floor(96 / 22));
    emit(kids.map((k) => (k.type === "dir" ? "\u001b[36m" + k.name + "/\u001b[0m" : (isExec(k) ? "\u001b[32m" + k.name + "\u001b[0m" : k.name))).map(padCell).reduce((rows, cell, i) => {
      const r = Math.floor(i / cols); rows[r] = (rows[r] || "") + cell; return rows;
    }, []).join("\n"));
  });
  const isExec = (k) => /\.(sh|py|js)$/.test(k.name) || k.name === "thadd";
  const padCell = (s) => s + " ".repeat(Math.max(2, 22 - s.replace(/\u001b\[[0-9;]*m/g, "").length));
  const dateStr = (t) => { const d = t ? new Date(t) : new Date(); return `${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][d.getMonth()]} ${String(d.getDate()).padStart(2)} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };

  def("cd", async ({ args, emit, S }) => {
    const t = args[0] || "~";
    if (t === "-") { S.cwd = S.prev || S.env.HOME; return; }
    const n = vfs.resolve(abs(t));
    if (!n) { emit(`cd: no such file or directory: ${t}`, "t-err"); return; }
    if (n.type !== "dir") { emit(`cd: not a directory: ${t}`, "t-err"); return; }
    S.prev = S.cwd; S.cwd = abs(t).replace(/\/+$/, "") || "/";
  });
  def("pwd", async ({ emit }) => emit(S.cwd));
  def("cat", async ({ args, emit }) => {
    if (!args.length) { emit("usage: cat <file>…"); return; }
    for (const f of args.filter((a) => !a.startsWith("-"))) {
      const n = vfs.resolve(abs(f));
      if (!n) { emit(`cat: ${f}: No such file or directory`, "t-err"); continue; }
      if (n.type === "dir") { emit(`cat: ${f}: Is a directory`, "t-err"); continue; }
      emit(n.body ?? "");
    }
  });
  def("less more", async ({ args, emit }) => { const n = vfs.resolve(abs(args[0] || "")); if (!n) { emit("No such file", "t-err"); return; } emit(n.body ?? ""); emit("\u001b[90m(END) — press q to quit (buffered pager)\u001b[0m"); });
  def("head", async ({ args, emit }) => tailHead(args, emit, true));
  def("tail", async ({ args, emit }) => tailHead(args, emit, false));
  function tailHead(args, emit, head) {
    const n = parseInt((args.find((a) => /^\-\d+$/.test(a)) || "-10").slice(1), 10);
    const f = args.find((a) => !a.startsWith("-"));
    const node2 = vfs.resolve(abs(f || ""));
    if (!node2) { emit(`head/tail: cannot open '${f}'`, "t-err"); return; }
    const lines = String(node2.body ?? "").split("\n");
    emit((head ? lines.slice(0, n) : lines.slice(-n)).join("\n"));
  }
  def("wc", async ({ args, emit, stdin }) => {
    const t = stdin ?? vfs.read(abs(args.find((a) => !a.startsWith("-")) || "")) ?? "";
    emit(`${String(t).split("\n").length}\t${String(t).split(/\s+/).filter(Boolean).length}\t${String(t).length}`);
  });
  def("touch", async ({ args, emit }) => { for (const f of args) { if (!vfs.resolve(abs(f))) vfs.write(abs(f), ""); } });
  def("mkdir", async ({ args, emit }) => { const p = args.filter((a) => !a.startsWith("-")); if (args.includes("-p")) { let cur = ""; for (const part of p[0].split("/").filter(Boolean)) { cur += "/" + part; vfs.mkdir(abs(cur)); } } else for (const d of p) vfs.mkdir(abs(d)); });
  def("rm", async ({ args, emit }) => {
    const t = args.filter((a) => !a.startsWith("-"));
    if (!t.length) { emit("rm: missing operand", "t-err"); return; }
    for (const f of t) {
      if (abs(f) === "/") { emit("rm: it is dangerous to operate recursively on '/'", "t-err"); continue; }
      const n = vfs.resolve(abs(f));
      if (!n) { emit(`rm: cannot remove '${f}': No such file or directory`, "t-err"); continue; }
      if (n.type === "dir" && !args.includes("-r") && !args.includes("-rf")) { emit(`rm: cannot remove '${f}': Is a directory`, "t-err"); continue; }
      vfs.rm(abs(f));
      if (args.includes("-v") || args.includes("-rf")) emit(`removed '${f}'`);
    }
  });
  def("mv", async ({ args, emit }) => {
    const [a, b] = args.filter((x) => !x.startsWith("-"));
    const n = vfs.resolve(abs(a)); if (!n) { emit(`mv: cannot stat '${a}'`, "t-err"); return; }
    const dest = vfs.resolve(abs(b));
    if (dest && dest.type === "dir") { dest.children.push(n); vfs.rm(abs(a)); return; }
    vfs.write(abs(b), n.body ?? ""); vfs.rm(abs(a));
  });
  def("cp", async ({ args, emit }) => {
    const [a, b] = args.filter((x) => !x.startsWith("-"));
    const n = vfs.resolve(abs(a)); if (!n) { emit(`cp: cannot stat '${a}'`, "t-err"); return; }
    if (n.type === "dir") { vfs.mkdir(abs(b)); return; }
    vfs.write(abs(b), n.body ?? "");
  });
  def("ln", async ({ args, emit }) => emit("symbolic link created (virtual)", "t-dim"));
  def("tree", async ({ args, emit }) => {
    const root2 = vfs.resolve(abs(args.filter((a) => !a.startsWith("-"))[0] || "."));
    if (!root2) { emit("tree: no such directory", "t-err"); return; }
    let dirs = 0, files = 0;
    const walk = (n, pre = "") => {
      const kids = n.children || [];
      kids.forEach((k, i) => {
        const last = i === kids.length - 1;
        emit(pre + (last ? "└── " : "├── ") + (k.type === "dir" ? "\u001b[36m" + k.name + "\u001b[0m" : k.name));
        if (k.type === "dir") { dirs++; walk(k, pre + (last ? "    " : "│   ")); } else files++;
      });
    };
    emit(abs(args[0] || "."));
    walk(root2);
    emit(`\n${dirs} directories, ${files} files`);
  });
  def("find", async ({ args, emit }) => {
    const start = args.find((a) => !a.startsWith("-"));
    const ni = args.indexOf("-name");
    const pat = ni >= 0 ? (args[ni + 1] || "*").replace(/\*/g, "") : "*";
    const results = vfs.flatten("", vfs.resolve(abs(start || ".")) || vfs.root()).filter((f) => f.node.name.includes(pat));
    emit(results.slice(0, 200).map((r) => r.path).join("\n") || "");
    emit(`\u001b[90m${results.length} matches\u001b[0m`);
  });
  def("grep", async ({ args, emit, stdin }) => {
    const pat = args.find((a) => !a.startsWith("-"));
    const files = args.filter((a) => !a.startsWith("-")).slice(1);
    if (stdin != null && !files.length) { emit(stdin.split("\n").filter((l) => new RegExp(pat, "i").test(l)).join("\n")); return; }
    for (const f of files) {
      const body = vfs.read(abs(f));
      if (body == null) { emit(`grep: ${f}: No such file`, "t-err"); continue; }
      body.split("\n").forEach((l, i) => { if (new RegExp(pat, "i").test(l)) emit(`${f}:${i + 1}: ${l.replace(new RegExp(pat, "ig"), (m) => `\u001b[31m${m}\u001b[0m`)}`); });
    }
  });
  def("sed", async ({ args, emit }) => {
    const script = args.find((a) => a.startsWith("s/")) || "";
    const f = args[args.length - 1];
    const m = script.match(/^s\/(.*?)\/(.*?)\/(g?)$/);
    const body = vfs.read(abs(f)) ?? "";
    if (!m) { emit(body); return; }
    const re = new RegExp(m[1], "g" + (m[3] ? "" : ""));
    emit(body.replace(re, m[2]));
  });
  def("awk", async ({ args, emit, stdin }) => emit(stdin ? stdin : "(no input)"));
  def("stat", async ({ args, emit }) => {
    const n = vfs.resolve(abs(args[0] || "")); if (!n) { emit("stat: cannot stat", "t-err"); return; }
    emit(`  File: ${abs(args[0])}\n  Size: ${n.type === "dir" ? 4096 : String(n.body || "").length}\tType: ${n.type === "dir" ? "directory" : "regular file"}\nAccess: (0644/-rw-r--r--)  Uid: (1000/${S.user})   Gid: (1000/${S.user})\nModify: ${new Date().toString()}`);
  });
  def("file", async ({ args, emit }) => { for (const f of args) { const n = vfs.resolve(abs(f)); emit(`${f}: ${n ? (n.type === "dir" ? "directory" : /^#!/.test(n.body || "") ? "Bourne-Again shell script, ASCII text executable" : /^\{"|^\}/.test((n.body || "").trim()) ? "JSON data" : "ASCII text") : "cannot open"}`); } });
  def("du", async ({ args, emit }) => {
    const n = vfs.resolve(abs(args[0] || ".")) || vfs.root();
    emit(`4.0K\t${short(abs(args[0] || "."))}`);
    emit(`\u001b[90m${vfs.flatten("", n).length} items scanned\u001b[0m`);
  });
  def("df", async ({ args, emit }) => {
    emit("Filesystem      Size  Used Avail Use% Mounted on");
    for (const l of [
      "/dev/sda2       512G   38G  448G   8% /", "/dev/sda1       512M  6.1M  506M   2% /boot/efi",
      "thadd-zfs      2.0T  118G  1.9T   6% /home", "tmpfs           16G  1.2G   15G   8% /run",
      "thadd-vault    256G   21G  235G   9% /vault", "securefs        64G  1.1G   63G   2% /opt/thadd",
    ]) emit(l);
  });
  def("chmod chown", async ({ args, emit }) => emit(`mode changed (simulated): ${args.join(" ")}`, "t-dim"));
  def("whereis which", async ({ args, emit }) => args.forEach((a) => emit(`${a}: /usr/bin/${a} /usr/share/man/man1/${a}.1.gz`)));

  /* ---- text / misc ---- */
  def("echo", async ({ args, emit }) => emit(args.join(" ").replace(/\$(\w+)/g, (m, k) => S.env[k] || "")));
  def("printf", async ({ args, emit }) => emit(args.join(" ").replace(/\\n/g, "\n")));
  def("rev", async ({ args, emit, stdin }) => emit((stdin ?? args.join(" ")).split("\n").map((l) => [...l].reverse().join("")).join("\n")));
  def("base64", async ({ args, emit, stdin }) => { const t = stdin ?? args.filter((a) => !a.startsWith("-")).join(" "); emit(args.includes("-d") ? atob(t) : btoa(t)); });
  def("md5sum", async ({ args, emit, stdin }) => emit(`${await hash(stdin ?? vfs.read(abs(args[0] || "")) ?? "")}  ${args[0] || "-"}`));
  def("sha256sum", async ({ args, emit, stdin }) => emit(`${await hash(stdin ?? vfs.read(abs(args[0] || "")) ?? "", "SHA-256")}  ${args[0] || "-"}`));
  async function hash(text, alg = "MD5") {
    try { const buf = await crypto.subtle.digest(alg, new TextEncoder().encode(String(text))); return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join(""); }
    catch { return "0".repeat(alg === "MD5" ? 32 : 64); }
  }
  def("xxd hexdump od", async ({ args, emit }) => {
    const n = vfs.resolve(abs(args.find((a) => !a.startsWith("-")) || ""));
    const bytes = new TextEncoder().encode(n ? String(n.body || "") : "");
    for (let i = 0; i < Math.min(bytes.length, 256); i += 16) {
      const row = [...bytes.slice(i, i + 16)];
      emit(`${i.toString(16).padStart(8, "0")}: ${row.map((b) => b.toString(16).padStart(2, "0")).join(" ").padEnd(47)}  ${row.map((b) => (b > 31 && b < 127 ? String.fromCharCode(b) : ".")).join("")}`);
    }
  });
  def("strings", async ({ args, emit }) => { const body = vfs.read(abs(args[0] || "")) || ""; emit(body.split("\n").filter((l) => l.length > 4).slice(0, 40).join("\n")); });
  def("bc expr", async ({ args, emit, stdin }) => {
    const e = (stdin ?? args.join(" ")).replace(/[^0-9+\-*/%^(). ]/g, "");
    try { emit(String(Function(`"use strict";return (${e.replace(/\^/g, "**")})`)())); } catch { emit("syntax error", "t-err"); }
  });
  def("seq", async ({ args, emit }) => {
    const n = Number(args[0]) || 10, a = args.length > 1 ? Number(args[0]) : 1;
    const stop = args.length > 1 ? Number(args[1]) : n;
    const step = args.length > 2 ? Number(args[2]) : 1;
    const list = []; for (let i = a; i <= stop; i += step) list.push(i);
    emit(list.join("\n"));
  });
  def("sort", async ({ args, emit, stdin }) => emit((stdin ?? "").split("\n").sort().join("\n")));
  def("uniq", async ({ args, emit, stdin }) => emit([...new Set((stdin ?? "").split("\n"))].join("\n")));
  def("cut", async ({ args, emit, stdin }) => emit(stdin ?? ""));
  def("tr", async ({ args, emit, stdin }) => emit(stdin ?? ""));
  def("tee", async ({ args, emit, stdin }) => { const f = args.filter((a) => !a.startsWith("-"))[0]; vfs.write(abs(f), stdin || ""); emit(stdin || ""); });
  def("xargs", async ({ args, emit, stdin }) => emit(`xargs: executed '${args.filter((a) => !a.startsWith("-")).join(" ")}' over ${(stdin || "").split("\n").filter(Boolean).length} items`, "t-dim"));
  def("yes", async ({ args, emit }) => emit(Array(24).fill(args[0] || "y").join("\n") + "\n\u001b[90m… truncated (infinite stream)\u001b[0m"));
  def("watch", async ({ args, emit }) => { emit(`Every 2.0s: ${args.join(" ")}`, "t-dim"); emit(`\n${args.join(" ")} — live view active (simulated single frame)`, "t-dim"); });
  def("time", async ({ args, emit }) => emit(`real\t0m0.${100 + Math.floor(Math.random() * 800)}s\nuser\t0m0.0${Math.floor(Math.random() * 90)}s\nsys\t0m0.0${Math.floor(Math.random() * 40)}s`));
  def("history", async ({ args, emit }) => S.history.slice(-40).forEach((h, i) => emit(`${String(S.history.length - 40 + i + 1).padStart(4)}  ${h}`)));
  def("alias", async ({ args, emit }) => args.length ? emit(`${args.join(" ")}`) : Object.entries(S.aliases).forEach(([k, v]) => emit(`alias ${k}='${v}'`)));
  def("export set", async ({ args, emit }) => { args.forEach((a) => { const [k, v] = a.split("="); if (k) S.env[k] = v ?? ""; }); });
  def("env printenv", async ({ args, emit }) => Object.entries(S.env).forEach(([k, v]) => emit(`${k}=${v}`)));
  def("unset", async ({ args, emit }) => args.forEach((a) => delete S.env[a]));
  def("clear cls", async ({ emit, print }) => { out.innerHTML = ""; });
  def("exit logout", async ({ emit }) => emit("logout\n\u001b[90m(THADD OS keeps the session alive — close the window to quit)\u001b[0m"));
  def("sleep", async ({ args, emit }) => { await sleep(Math.min(4000, (Number(args[0]) || 1) * 1000)); });
  def("true false", async () => {});
  def("sudo please", async ({ args, emit, raw, S, print, win }) => {
    if (!args.length) { emit("usage: sudo <command>"); return; }
    emit(`\u001b[33m[sudo] password for ${S.user}: ●●●●●●●●\u001b[0m`);
    await sleep(220);
    return exec(args.join(" "));
  });
  def("su", async ({ emit }) => emit("root shell spawned (virtual) — # ", "t-dim"));
  def("man", async ({ args, emit }) => {
    const cmd = args[0];
    if (!cmd) { emit("What manual page do you want?"); return; }
    const doc = DOCS[cmd] || C[cmd] && { name: cmd, synopsis: `${cmd} [options] [arguments]`,
      desc: `${cmd} — part of the THADD OS ${catOf(cmd)} toolset.`, opts: [["-h, --help", "show help"], ["-v, --version", "show version"]] };
    if (!doc) { emit(`No manual entry for ${cmd}`, "t-err"); return; }
    emit(`${doc.name.toUpperCase()}(1)                       THADD OS Manual                      ${doc.name.toUpperCase()}(1)\n\nNAME\n       ${doc.name} — ${doc.desc}\n\nSYNOPSIS\n       ${doc.synopsis}\n\nOPTIONS`);
    (doc.opts || []).forEach(([o, d]) => emit(`       ${o.padEnd(24)} ${d}`));
    if (doc.examples) { emit("\nEXAMPLES"); doc.examples.forEach((e) => emit(`       ${e}`)); }
    emit(`\nSEE ALSO\n       ${doc.see || "thadd(1), parrot(1), help(1)"}\n\nTHADD OS 2.0                    ${new Date().toDateString()}`);
  });
  const catOf = (c) => /nmap|msf|sqlmap|hydra|john|hashcat|aircrack|gobuster|ffuf|nikto|searchsploit|responder|impacket|bloodhound|enum4linux|smbclient|wpscan|whatweb/.test(c) ? "security" : "system";
  const DOCS = {
    nmap: { name: "nmap", desc: "network exploration tool and security / port scanner", synopsis: "nmap [Scan Type…] [Options] {target specification}",
      opts: [["-sS", "TCP SYN (stealth) scan"], ["-sV", "probe open ports for service/version info"], ["-O", "enable OS detection"], ["-A", "aggressive: OS + version + scripts + traceroute"], ["-p <range>", "ports to scan, e.g. -p 1-65535"], ["--script <n>", "NSE scripts (vuln, safe, default)"], ["-T4", "aggressive timing template"], ["-oN <file>", "normal output to file"]],
      examples: ["nmap -sV -sC -O 10.10.10.5", "nmap -p- -T4 --min-rate 2000 10.10.11.14", "nmap --script vuln scanme.nmap.org"] },
    msfconsole: { name: "msfconsole", desc: "Metasploit Framework interactive console", synopsis: "msfconsole [-q] [-r resource.rc]",
      opts: [["search <term>", "find modules"], ["use <module>", "select a module"], ["set RHOSTS <ip>", "set target"], ["run / exploit", "execute"], ["sessions -l", "list sessions"], ["db_autopwn", "database-driven exploitation"]],
      examples: ["msfconsole -q", "use exploit/multi/handler; set PAYLOAD linux/x64/meterpreter/reverse_tcp; set LHOST 10.10.14.7; run"] },
    sqlmap: { name: "sqlmap", desc: "automatic SQL injection and database takeover tool", synopsis: "sqlmap -u <url> [options]",
      opts: [["-u <url>", "target URL"], ["--batch", "never ask, use defaults"], ["--dbs", "enumerate databases"], ["--dump", "dump table entries"], ["--os-shell", "interactive OS shell"], ["--risk/--level", "1-5 scan intensity"]],
      examples: ["sqlmap -u 'http://target/item.php?id=1' --batch --dbs", "sqlmap -r request.txt --level=5 --risk=3 --os-shell"] },
    hydra: { name: "hydra", desc: "network login cracker (50+ protocols)", synopsis: "hydra [options] <service>://<target>",
      opts: [["-l/-L", "single user / user list"], ["-p/-P", "single pass / pass list"], ["-t", "tasks (parallel connections)"], ["-f", "exit on first found"], ["-V", "verbose, show attempts"]],
      examples: ["hydra -l admin -P rockyou.txt ssh://10.10.10.5 -t 4", "hydra -L users.txt -P passes.txt 10.0.0.9 http-post-form '/login:u=^USER^&p=^PASS^:Invalid'"] },
  };

  /* ---- system ---- */
  def("whoami", async ({ emit }) => emit(S.user));
  def("id", async ({ emit }) => emit(`uid=1000(${S.user}) gid=1000(${S.user}) groups=1000(${S.user}),27(sudo),44(video),100(users),142(docker),999(parrot)`));
  def("who", async ({ emit }) => emit(`${S.user}   tty1         ${new Date().toDateString()} 09:41 (:0)\n${S.user}   pts/0        09:42 (rdp.thadd.local)`));
  def("uname", async ({ args, emit }) => emit(args.includes("-a") ? `Linux ${S.host} ${KERNEL} #1 SMP PREEMPT_DYNAMIC THADD-OS x86_64 GNU/Linux` : "Linux"));
  def("hostname", async ({ args, emit }) => emit(args.includes("-I") ? "10.0.2.15" : S.host));
  def("date", async ({ args, emit }) => emit(args[0] ? new Date().toUTCString() : `${new Date().toDateString()} ${new Date().toTimeString().slice(0, 8)} GMT`));
  def("cal", async ({ emit }) => {
    const d = new Date(), y = d.getFullYear(), m = d.getMonth();
    const first = new Date(y, m, 1).getDay(), days = new Date(y, m + 1, 0).getDate();
    emit(`     ${["January","February","March","April","May","June","July","August","September","October","November","December"][m]} ${y}`);
    emit("Su Mo Tu We Th Fr Sa");
    let row = "   ".repeat(first);
    for (let i = 1; i <= days; i++) {
      const today = i === d.getDate();
      row += (today ? `\u001b[7m${pad(i)}\u001b[0m` : pad(i)) + " ";
      if ((first + i) % 7 === 0) { emit(row.trimEnd()); row = ""; }
    }
    if (row.trim()) emit(row.trimEnd());
  });
  def("uptime", async ({ emit }) => {
    const t = new Date().toTimeString().slice(0, 8);
    emit(` ${t} up ${fmtDur(uptime())},  1 user,  load average: ${(0.2 + Math.random()).toFixed(2)}, ${(0.15 + Math.random()).toFixed(2)}, ${(0.1 + Math.random()).toFixed(2)}`);
  });
  def("free", async ({ emit }) => {
    const tot = 16384, used = 1240 + Math.floor(Math.random() * 200), buff = 380, cache = 2100;
    emit("               total        used        free      shared  buff/cache   available");
    emit(`Mem:           ${tot}         ${used}        ${tot - used - buff - cache}          80        ${buff + cache}       ${tot - used - buff} `);
    emit(`Swap:          ${store.get("swap", 2048)}           0        ${store.get("swap", 2048)}`);
  });
  def("ps top htop btop", async ({ args, emit }) => {
    emit("  PID  USER      %CPU  %MEM  STAT  COMMAND");
    const rows = [
      [1, "root", 0.0, 0.1, "Ss", "/sbin/init (systemd)"], [412, "root", 0.1, 0.3, "Ssl", "/usr/sbin/thadd-shield --strict"],
      [512, "thadd", 1.4, 1.6, "Ssl", "Xvnc :1 -geometry 1920x1080"], [640, "thadd", 2.1, 2.4, "Sl", "xfce4-session"],
      [812, "thadd", 0.6, 1.9, "Sl", "plank"], [901, "thadd", 3.8, 3.1, "Sl", "firefox-esr"],
      [1042, "thadd", 12.4, 4.2, "Sl", "code --unity-launch"], [1180, "thadd", 0.9, 0.7, "S", "-zsh"],
      [1201, "thadd", 2.2, 1.1, "Sl", "thadd-jarvis --daemon --groq"], [1310, "thadd", 0.3, 0.4, "S", "conky"],
      [1402, "root", 0.2, 0.2, "Ssl", "xrdp"], [1455, "thadd", 0.4, 0.5, "Sl", "websockify :6080"],
    ];
    rows.forEach((r) => emit(r.join("  ").replace(/,/g, "  ")));
    emit(`\u001b[90m${rows.length} of 1,284 processes · CPU 4% · 1,240 MB / 16 GB\u001b[0m`);
  });
  def("kill killall pkill", async ({ args, emit }) => emit(args.length ? `[${args.join(" ")}] terminated` : "usage: kill [-9] PID", "t-dim"));
  def("jobs bg fg", async ({ emit }) => emit("[1]  + running    thadd scan --full", "t-dim"));
  def("lscpu", async ({ emit }) => emit(`Architecture:            x86_64\nCPU op-mode(s):          32-bit, 64-bit\nByte Order:              Little Endian\nCPU(s):                  ${navigator.hardwareConcurrency || 8}\nOn-line CPU(s) list:     0-${(navigator.hardwareConcurrency || 8) - 1}\nVendor ID:               GenuineIntel\nModel name:              THADD Virtual CPU @ 3.60GHz\nThread(s) per core:      2\nCore(s) per socket:      ${Math.ceil((navigator.hardwareConcurrency || 8) / 2)}\nFlags:                   fpu vme de pse tsc msr pae mce cx8 apic sep aes avx2 avx512f sha_ni smep smap umip cet`));
  def("lsblk", async ({ emit }) => emit(`NAME        MAJ:MIN RM   SIZE RO TYPE MOUNTPOINTS\nsda           8:0    0   512G  0 disk\n├─sda1        8:1    0   512M  0 part /boot/efi\n├─sda2        8:2    0   511G  0 part /\n└─sda3        8:3    0     2T  0 part /home (zfs)\nnvme0n1     259:0    0   256G  0 disk\n└─nvme0n1p1 259:1    0   256G  0 part /vault (LUKS2)`));
  def("lspci", async ({ emit }) => emit(`00:00.0 Host bridge: Intel Corporation THADD Virtual Chipset\n00:02.0 VGA compatible controller: VirtualBox Graphics Adapter (VMSVGA)\n00:03.0 Ethernet controller: Intel 82540EM Gigabit Ethernet\n00:1f.3 Audio device: Intel HD Audio\n01:00.0 Network controller: THADD WLAN 6E AX210`));
  def("lsusb", async ({ emit }) => emit(`Bus 001 Device 002: ID 80ee:0021 VirtualBox USB Tablet\nBus 001 Device 001: ID 1d6b:0002 Linux Foundation 2.0 root hub\nBus 002 Device 003: ID 046d:c52b Logitech Unifying Receiver`));
  def("lsof", async ({ emit }) => emit(`COMMAND    PID  USER   FD      TYPE DEVICE SIZE/OFF NODE NAME\nfirefox-e  901 thadd  cwd   DIR  254,2     4096   admin /home/${S.user}\ncode       1042 thadd  txt   REG  254,2 51204096  1201 /usr/share/code/code\nthadd-shi   412 root  4u    IPv4  28412      0t0  TCP *:8443 (LISTEN)\nxrdp       1402 root  5u    IPv4  28413      0t0  TCP *:3389 (LISTEN)`));
  def("systemctl service", async ({ args, emit }) => {
    const [sub, unit] = args.filter((a) => !a.startsWith("-"));
    if (!sub || sub === "status" && !unit) {
      emit(`  UNIT                       LOAD   ACTIVE SUB     DESCRIPTION`);
      [["thadd-shield.service", "active", "running", "THADD Shield hardening daemon"],
       ["thadd-jarvis.service", "active", "running", "JARVIS AI assistant (Groq backend)"],
       ["thadd-vpn.service", "active", "exited", "WireGuard tunnel supervisor"],
       ["xrdp.service", "active", "running", "Remote Desktop Protocol server"],
       ["xrdp-sesman.service", "active", "running", "xrdp session manager"],
       ["lightdm.service", "active", "running", "Light Display Manager"],
       ["nginx.service", "active", "running", "THADD web portal"],
       ["docker.service", "active", "running", "Container engine"],
       ["fail2ban.service", "active", "running", "Intrusion prevention"],
       ["chrony.service", "active", "running", "NTP client/server"]].forEach((r) => emit(`  ${r[0].padEnd(28)} loaded ${r[1].padEnd(6)} ${r[2].padEnd(7)} ${r[3]}`));
      emit(`\n\u001b[90m10 loaded units listed.\u001b[0m`);
      return;
    }
    if (sub === "status") { emit(`● ${unit} - THADD OS service\n     Loaded: loaded (/lib/systemd/system/${unit}; enabled)\n     Active: \u001b[32mactive (running)\u001b[0m since ${new Date().toString().slice(0, 24)}\n   Main PID: 412 (${unit.split(".")[0]})\n      Tasks: 12 (limit: 76821)\n     Memory: 48.2M\n        CPU: 1.204s\n     CGroup: /system.slice/${unit}`); return; }
    if (["start", "stop", "restart", "reload", "enable", "disable", "mask"].includes(sub)) { emit(`\u001b[90m(simulated)\u001b[0m ${unit} → ${sub} ✔`, "t-ok"); return; }
    emit(`Unknown operation '${sub}'.`, "t-err");
  });
  def("journalctl dmesg", async ({ args, emit }) => {
    const n = Number((args.find((a) => /^-n\d*$/.test(a)) || "-n20").replace("-n", "")) || 20;
    const stamp = () => new Date(Date.now() - Math.floor(Math.random() * 3600e3)).toISOString().replace("T", " ").slice(0, 19);
    const lines = [
      "kernel: THADD OS 2.0 (Nebula Prime) booting — secure boot verified",
      "kernel: Command line: BOOT_IMAGE=/boot/vmlinuz-6.9.7-thadd root=UUID=thadd-2.0 quiet splash mitigations=auto",
      "kernel: Spectre/Meltdown mitigations ACTIVE · KPTI on · Retpoline on",
      "thadd-shield[412]: strict profile engaged — 47 hardening rules, 3 syscall filters",
      "kernel: audit: type=1400 apparmor=\"STATUS\" profile=\"thadd-jarvis\"",
      "thadd-jarvis[1201]: Groq backend online — model llama-3.3-70b-versatile",
      "systemd[1]: Started THADD Shield hardening daemon.",
      "NetworkManager[688]: <info> device (eth0): state change: activated (reason 'none')",
      "kernel: eth0: THADD-DNS resolver 1.1.1.1 DoH established",
      "xrdp[1402]: RDP server listening on port 3389",
      "nginx[1510]: /healthz 200 — portal up",
      "kernel: nvme0n1p1: LUKS2 volume unlocked via TPM2",
      "thadd-vault[1533]: sealed 118 secrets · auto-lock in 15m",
      "kernel: audit: 0 denials · 2 policy hits blocked (reverse shell attempt, 10.0.2.44)",
    ];
    for (let i = 0; i < n; i++) emit(`${stamp()} thadd-os ${lines[i % lines.length]}`);
  });
  def("reboot shutdown poweroff halt init", async ({ args, emit }) => emit("System going down NOW! (close the tab to reboot THADD OS)", "t-warn"));
  def("neofetch fastfetch", async ({ emit }) => {
    const L = [
      `${S.user}@${S.host} `, "----------------- ",
      `OS: ${OS} x86_64 `, `Host: THADD Virtual Machine (VirtualBox 7.1) `,
      `Kernel: ${KERNEL} `, `Uptime: ${fmtDur(uptime())} `,
      `Packages: 2147 (dpkg), 88 (flatpak), 41 (snap) `,
      `Shell: zsh 5.9 `, `Resolution: ${innerWidth}x${innerHeight} `,
      `DE: THADD Shell (Sequoia×Fluent) `, `WM: wm.js compositor `,
      `Theme: Nebula-Prime-Dark `, `Icons: THADD-Dark `,
      `Terminal: thadd-term `, `CPU: THADD Virtual CPU (${navigator.hardwareConcurrency || 8}) @ 3.6GHz `,
      `GPU: VMSVGA + VirGL passthrough `, `Memory: 1.2GiB / 16GiB `,
    ];
    const logo = [
      "\u001b[36m        ▄▄▄▄▄▄▄        \u001b[0m", "\u001b[36m     ▄█████████▄     \u001b[0m",
      "\u001b[34m   ▄███▀     ▀███▄   \u001b[0m", "\u001b[34m  ███▀  ▄▄▄▄▄  ▀███  \u001b[0m",
      "\u001b[35m ███   ███████   ███ \u001b[0m", "\u001b[35m ███   ███████   ███ \u001b[0m",
      "\u001b[34m  ███▄  ▀▀▀▀▀  ▄███  \u001b[0m", "\u001b[34m   ▀███▄     ▄███▀   \u001b[0m",
      "\u001b[36m     ▀█████████▀     \u001b[0m", "\u001b[36m        ▀▀▀▀▀▀▀        \u001b[0m",
    ];
    logo.forEach((l, i) => emit(`${l}  ${l.includes("▄") || i < 2 ? L[i] ? "" : "" : ""}${i < L.length ? "\u001b[1m" + (i < 2 ? L[i] : "") + "\u001b[0m" : ""}${i >= 2 && i < L.length ? L[i + 0] || "" : ""}`));
    emit("");
    emit(`\u001b[1m${S.user}@${S.host}\u001b[0m`);
    emit("─────────────────────────────");
    ["OS: " + OS + " x86_64", "Host: THADD Virtual Machine (VirtualBox 7.1)", "Kernel: " + KERNEL,
     "Uptime: " + fmtDur(uptime()), "Packages: 2147 (dpkg), 88 (flatpak), 41 (snap)", "Shell: zsh 5.9",
     "Resolution: " + innerWidth + "x" + innerHeight, "DE: THADD Shell (Sequoia × Fluent)", "WM: wm.js",
     "Theme: Nebula-Prime-Dark", "CPU: THADD Virtual CPU (" + (navigator.hardwareConcurrency || 8) + ") @ 3.6GHz",
     "GPU: VMSVGA + VirGL", "Memory: " + (900 + Math.floor(Math.random() * 400)) + "MiB / 16GiB",
     "\u001b[30m███\u001b[31m███\u001b[32m███\u001b[33m███\u001b[34m███\u001b[35m███\u001b[36m███\u001b[37m███\u001b[0m"]
      .forEach((l) => emit(l));
  });

  /* ---- network ---- */
  const NET = () => `eth0: flags=4163<UP,BROADCAST,RUNNING,MULTICAST>  mtu 1500\n        inet 10.0.2.15  netmask 255.255.255.0  broadcast 10.0.2.255\n        inet6 fe80::a00:27ff:fe4e:8f1d  prefixlen 64  scopeid 0x20<link>\n        ether 08:00:27:4e:8f:1d  txqueuelen 1000  (Ethernet)\n        RX packets 184213  bytes 214.7 MB\n        TX packets  92114  bytes  38.2 MB\n\nlo: flags=73<UP,LOOPBACK,RUNNING>  mtu 65536\n        inet 127.0.0.1  netmask 255.0.0.0\n        inet6 ::1  prefixlen 128  scopeid 0x10<host>\n\nwlan0: flags=4163<UP,BROADCAST,RUNNING,MULTICAST>  mtu 1500\n        inet 192.168.1.44  netmask 255.255.255.0  broadcast 192.168.1.255\n        ether 3c:22:fb:9a:11:04  txqueuelen 1000  (Ethernet)`;
  def("ifconfig ipconfig", async ({ args, emit }) => emit(NET()));
  def("ip", async ({ args, emit }) => {
    const sub = args[0] || "a";
    if (sub.startsWith("a")) { emit(`1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN group default qlen 1000\n    inet 127.0.0.1/8 scope host lo\n2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc fq_codel state UP group default qlen 1000\n    link/ether 08:00:27:4e:8f:1d brd ff:ff:ff:ff:ff:ff\n    inet 10.0.2.15/24 brd 10.0.2.255 scope global dynamic eth0\n3: wlan0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc noqueue state UP\n    inet 192.168.1.44/24 brd 192.168.1.255 scope global dynamic wlan0`); return; }
    if (sub === "route") { emit(`default via 10.0.2.2 dev eth0 proto dhcp src 10.0.2.15 metric 100\n10.0.2.0/24 dev eth0 proto kernel scope link src 10.0.2.15\n192.168.1.0/24 dev wlan0 proto kernel scope link src 192.168.1.44`); return; }
    if (sub === "addr") { emit(NET()); return; }
    emit("Usage: ip [addr|route|link|neigh] …");
  });
  def("ping", async ({ args, emit }) => {
    const host = args.find((a) => !a.startsWith("-")) || "8.8.8.8";
    const c = Number((args.find((a) => a.startsWith("-c")) || "-c4").replace("-c", "")) || 4;
    emit(`PING ${host} (${/=/.test(host) ? host : host.match(/^\d/) ? host : "142.250.185.78"}) 56(84) bytes of data.`);
    let sum = 0;
    for (let i = 1; i <= Math.min(c, 10); i++) {
      const t = (8 + Math.random() * 22).toFixed(1); sum += +t;
      await sleep(120);
      emit(`64 bytes from ${host}: icmp_seq=${i} ttl=115 time=${t} ms`);
    }
    emit(`\n--- ${host} ping statistics ---\n${c} packets transmitted, ${c} received, 0% packet loss, time ${c * 1000}ms\nrtt min/avg/max/mdev = ${(sum / c * .8).toFixed(3)}/${(sum / c).toFixed(3)}/${(sum / c * 1.4).toFixed(3)}/1.42 ms`);
  });
  def("traceroute", async ({ args, emit }) => {
    const host = args.find((a) => !a.startsWith("-")) || "github.com";
    emit(`traceroute to ${host}, 30 hops max, 60 byte packets`);
    const hops = [["10.0.2.2", `${S.user}-gateway`], ["192.168.1.1", "router.local"], ["102.176.4.1", "accra-ix1.gh.net"],
      ["154.160.0.9", "gh-isp-core"], ["195.66.225.12", "lon-ix.net"], ["140.82.121.3", "github.com"]];
    for (const [ip, name] of hops) { await sleep(120); emit(` ${hops.indexOf(hops.find((h) => h[0] === ip)) + 1}  ${name} (${ip})  ${(6 + Math.random() * 60).toFixed(3)} ms  ${(7 + Math.random() * 60).toFixed(3)} ms`); }
  });
  def("dig nslookup host", async ({ args, emit }) => {
    const d = args.find((a) => !a.startsWith("-")) || "thadd.os";
    emit(`;; Got answer:\n;; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 41288\n;; flags: qr rd ra; QUERY: 1, ANSWER: 2, AUTHORITY: 0, ADDITIONAL: 1\n\n;; QUESTION SECTION:\n;${d}.			IN	A\n\n;; ANSWER SECTION:\n${d}.	300	IN	A	140.82.121.4\n${d}.	300	IN	A	140.82.121.3\n\n;; Query time: 18 msec\n;; SERVER: 127.0.0.53#53(1.1.1.1 DoH)\n;; WHEN: ${new Date().toString()}\n;; MSG SIZE  rcvd: 61`);
  });
  def("whois", async ({ args, emit }) => {
    const d = args[0] || "thadd.os";
    emit(`Domain Name: ${d.toUpperCase()}\nRegistry Domain ID: THADD_OS-DOMAIN\nRegistrar WHOIS Server: whois.thadd.os\nCreation Date: 2025-01-01T00:00:00Z\nRegistry Registrant: Thadd OS Project\nName Server: NS1.THADD.OS\nDNSSEC: signedDelegation\n>>> Last update of whois database: ${new Date().toUTCString()} <<<`);
  });
  def("curl wget", async ({ args, emit }) => {
    const url = args.find((a) => !a.startsWith("-")) || "https://thadd.os";
    if (args.includes("-I")) { emit(`HTTP/2 200 \ncontent-type: text/html; charset=utf-8\nserver: thadd-portal\nstrict-transport-security: max-age=63072000\nx-thadd-shield: strict\ncache-control: no-store`); return; }
    await sleep(160);
    emit(`  % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current\n                                 Dload  Upload   Total   Spent    Left  Speed\n100  1934  100  1934    0     0  24175      0 --:--:-- --:--:-- --:--:-- 24512`);
    if (args.includes("-O") || args.includes("-o")) emit(`saved to ${vfs.write(abs(url.split("/").pop() || "index.html"), "<html>THADD OS</html>") ? url.split("/").pop() : "file"}`, "t-dim");
    else emit(`<!DOCTYPE html><html><head><title>THADD OS</title></head><body><h1>One OS. All the Best.</h1></body></html>`, "raw");
  });
  def("ssh scp rsync", async ({ args, emit }) => {
    const dest = args.find((a) => a.includes("@")) || `thadd@10.10.14.7`;
    emit(`The authenticity of host '${dest}' can't be established.\nED25519 key fingerprint is SHA256:THADD+7f3kL9xQw2pR4vN8sT1yU6iO0aZ5cB3dE.\nThis key is not known by any other names.`, "t-warn");
    await sleep(240);
    emit(`Warning: Permanently added '${dest}' (ED25519) to the list of known hosts.\n${dest}'s password: ●●●●●●●●\n\u001b[32mWelcome to THADD OS 2.0 (Nebula Prime) — ${KERNEL}\u001b[0m\nLast login: ${new Date().toDateString()} from 10.0.2.15\n${dest.split("@")[1]}:~$ `, "t-ok");
  });
  def("netstat ss", async ({ args, emit }) => emit(`Netid State  Recv-Q Send-Q Local Address:Port    Peer Address:Port  Process\nudp   UNCONN 0      0            0.0.0.0:68            0.0.0.0:*      dhclient\ntcp   LISTEN 0      128          0.0.0.0:22            0.0.0.0:*      sshd\ntcp   LISTEN 0      244          0.0.0.0:3389          0.0.0.0:*      xrdp\ntcp   LISTEN 0      511          0.0.0.0:8443          0.0.0.0:*      nginx\ntcp   LISTEN 0      4096       127.0.0.53:53            0.0.0.0:*      systemd-resolve\ntcp   ESTAB  0      0        10.0.2.15:52414   140.82.121.4:443   firefox-esr\ntcp   ESTAB  0      0        10.0.2.15:52420   104.18.32.7:443    code`));
  def("tcpdump", async ({ args, emit }) => {
    emit("tcpdump: verbose output suppressed, use -v[v] for full protocol decode\nlistening on eth0, link-type EN10MB (Ethernet), capture size 262144 bytes", "t-dim");
    for (let i = 0; i < 8; i++) {
      await sleep(180);
      emit(`${new Date().toTimeString().slice(0, 8)}.${Math.floor(Math.random() * 900000 + 100000)} IP 10.0.2.15.${52000 + i} > 140.82.121.4.443: Flags [P.], seq ${1000 + i * 64}:${1064 + i * 64}, ack 1, win 501, length 64`);
    }
    emit("\n8 packets captured\n8 packets received by filter\n0 packets dropped by kernel", "t-dim");
  });
  def("arp", async ({ emit }) => emit(`Address                  HWtype  HWaddress           Flags Mask            Iface\n10.0.2.2                 ether   52:54:00:12:35:02   C                     eth0\n192.168.1.1              ether   3c:84:6a:22:9f:10   C                     wlan0\n192.168.1.77             ether   b8:27:eb:44:12:aa   C                     wlan0`));
  def("iwconfig", async ({ emit }) => emit(`wlan0     IEEE 802.11ax  ESSID:"THADD-NET-6E"  Nickname:"<WIFI@REALTEK>"\n          Mode:Managed  Frequency:5.745 GHz  Access Point: 3C:84:6A:22:9F:10\n          Bit Rate=1.2 Gb/s   Tx-Power=22 dBm\n          Retry short limit:7   RTS thr:off   Fragment thr:off\n          Encryption key:off\n          Power Management:on`));

  /* ---- the Parrot arsenal (simulated, realistic) ---- */
  const TARGET = () => (S.env.RHOST || "10.10.10.5");
  def("parrot arsenal", async ({ args, emit }) => {
    emit("\u001b[35m╔══════════════════════════════════════════════════════════════════════════╗\u001b[0m");
    emit("\u001b[35m║\u001b[0m  \u001b[1mPARROT ARSENAL\u001b[0m — 600+ offensive-security tools on THADD OS          \u001b[35m║\u001b[0m");
    emit("\u001b[35m╚══════════════════════════════════════════════════════════════════════════╝\u001b[0m");
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
      "Anonymity": "tor torsocks proxychains4 macchanger",
    };
    for (const [c, list] of Object.entries(cats)) {
      emit(`\n\u001b[36m${c}\u001b[0m`);
      emit("  " + list.split(" ").map((t) => t).join("  "));
    }
    emit("\n\u001b[90mRun any tool directly (e.g. `nmap -sV 10.10.10.5`) or open the GUI: `parrot-gui`.\u001b[0m");
  });
  def("nmap", async ({ args, emit }) => {
    const t = args.filter((a) => !a.startsWith("-"))[0] || TARGET();
    const ports = args.find((a) => a.startsWith("-p"))?.slice(2) || "1-1000";
    emit(`Starting Nmap 7.95 ( https://nmap.org ) at ${new Date().toISOString().slice(0, 19).replace("T", " ")} UTC`);
    await type([`Nmap scan report for ${t}`, "Host is up (0.012s latency).", "Not shown: 987 closed tcp ports (reset)"], 160);
    const rows = [["22/tcp", "open", "ssh", "OpenSSH 9.6p1 Ubuntu 3ubuntu13 (Ubuntu Linux; protocol 2.0)"],
      ["80/tcp", "open", "http", "Apache httpd 2.4.58 ((Ubuntu))"],
      ["443/tcp", "open", "ssl/https", "Apache httpd 2.4.58"],
      ["3306/tcp", "filtered", "mysql", "MySQL 8.0.36"],
      ["8080/tcp", "open", "http-proxy", "Flask 3.0.0 (Python 3.12)"]];
    emit("PORT     STATE    SERVICE    VERSION");
    for (const r of rows) { await sleep(140); emit(`${r[0].padEnd(9)}${r[1] === "open" ? "\u001b[32m" + r[1].padEnd(9) + "\u001b[0m" : "\u001b[31m" + r[1].padEnd(9) + "\u001b[0m"}${r[2].padEnd(11)}${r[3]}`); }
    emit(`Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel\n\nHost script results:\n|_http-title: THADD Lab — index`);
    emit(`\nNmap done: 1 IP address (1 host up) scanned in ${(6 + Math.random() * 20).toFixed(2)} seconds`);
  });
  def("msfconsole msf", async ({ args, emit }) => {
    emit(`       =[ metasploit v6.4.28-dev                          ]\n+ -- --=[ 2464 exploits - 1266 auxiliary - 424 post       ]\n+ -- --=[ 1465 payloads - 47 encoders - 11 nops           ]\n+ -- --=[ 9 evasion                                          ]\n\n\u001b[35mMetasploit Documentation: https://docs.metasploit.com/\u001b[0m\n`);
    await sleep(200);
    emit(`msf6 > use exploit/multi/handler\nmsf6 exploit(multi/handler) > set PAYLOAD linux/x64/meterpreter/reverse_tcp\nPAYLOAD => linux/x64/meterpreter/reverse_tcp\nmsf6 exploit(multi/handler) > set LHOST 10.10.14.7\nLHOST => 10.10.14.7\nmsf6 exploit(multi/handler) > run\n\n[*] Started reverse TCP handler on 10.10.14.7:4444\n[*] Sending stage (3045380 bytes) to ${TARGET()}\n[*] Meterpreter session 1 opened (10.10.14.7:4444 -> ${TARGET()}:52114) at ${new Date().toISOString()}\n`, "t-dim");
    emit(`meterpreter > getuid\nServer username: www-data\nmeterpreter > sysinfo\nComputer    : thadd-lab\nOS          : Ubuntu 24.04 (Linux 6.8.0-45-generic)\nArchitecture: x64\nMeterpreter : x64/linux\nmeterpreter > `);
  });
  def("sqlmap", async ({ args, emit }) => {
    const u = (args.find((a) => a.startsWith("http")) || `http://${TARGET()}/item.php?id=1`);
    emit(`        ___\n       __H__\n ___ ___[)]_____ ___ ___  {1.8.10#stable}\n|_ -| . [)]     | .'| . |\n|___|_  [.]_|_|_|__,|  _|\n      |_|V...       |_|   https://sqlmap.org\n`);
    await type([`[*] starting @ ${new Date().toISOString().slice(11, 19)}`, `[INFO] testing connection to the target URL`, `[INFO] checking if the target is protected by some kind of WAF/IPS`, `[INFO] testing if the target URL content is stable`,
      `[INFO] target URL content is stable`, `[INFO] testing if GET parameter 'id' is dynamic`, `[INFO] GET parameter 'id' appears to be dynamic`,
      `[INFO] heuristic (basic) test shows that GET parameter 'id' might be injectable`, `[INFO] testing for SQL injection on GET parameter 'id'`,
      `sqlmap identified the following injection point(s) with a total of 74 HTTP(s) requests:`, "---", `Parameter: id (GET)`, `    Type: boolean-based blind`, `    Title: AND boolean-based blind - WHERE or HAVING clause`, `    Payload: id=1 AND 8921=8921`, `    Type: time-based blind`, `    Title: MySQL >= 5.0.12 AND time-based blind`, `    Payload: id=1 AND SLEEP(5)`, "---"], 120);
    emit(`[INFO] the back-end DBMS is MySQL\nweb server operating system: Linux Ubuntu 24.04\nweb application technology: Apache 2.4.58, PHP 8.3.6\nback-end DBMS: MySQL >= 8.0\n[*] available databases [4]:\n[*] information_schema\n[*] thadd_lab\n[*] wordpress\n[*] mysql\n[INFO] fetched data logged to: /root/.local/share/sqlmap/output/${TARGET().replace(/\..*/, "")}`, "t-ok");
  });
  def("hydra", async ({ args, emit }) => {
    emit(`Hydra v9.6 (c) 2024 by van Hauser/THC & David Maciejak\nHydra (https://github.com/vanhauser-thc/thc-hydra) starting at ${new Date().toISOString()}`);
    const users = ["admin", "root", "thadd", "operator"]; const passes = ["password", "admin123", "Summer2024!", "letmein"];
    for (let i = 0; i < 12; i++) {
      await sleep(90);
      const u = users[i % users.length], p = passes[(i * 3) % passes.length];
      emit(`[ATTEMPT] target ${TARGET()} - login "${u}" - pass "${p}" - ${i + 1} of 40 [child ${i % 4}]`);
    }
    emit(`[22][ssh] host: ${TARGET()}   login: operator   password: Summer2024!\n1 of 1 target successfully completed, 1 valid password found`, "t-ok");
  });
  def("john hashcat", async ({ args, emit }) => {
    emit(`Using default input encoding: UTF-8\nLoaded 3 password hashes with 3 different salts (sha512crypt, crypt(3) $6$ [SHA512 128/128 AVX 2x])`);
    for (const [u, p] of [["thadd", "nebula2024"], ["root", "thadd-prime"], ["sysadmin", "GH@na2024!"]]) { await sleep(220); emit(`${p}         (${u})`); }
    emit(`\nSession completed. 3/3 cracked, 0:00:04 elapsed`, "t-ok");
  });
  def("gobuster ffuf dirb", async ({ args, emit }) => {
    const t = (args.find((a) => a.startsWith("http")) || `http://${TARGET()}`);
    emit(`===============================================================\nGobuster v3.6\nby OJ Reeves (@TheColonial) & Christian Mehlmauer (@firefart)\n===============================================================\n[+] Url:  ${t}\n[+] Threads: 10\n[+] Wordlist: /usr/share/wordlists/dirb/common.txt\n===============================================================`);
    for (const [code, path, size] of [[200, "/", 1043], [301, "/admin", 311], [200, "/robots.txt", 88], [403, "/.git", 279], [200, "/api/v1", 512], [401, "/wp-admin", 460], [200, "/backup.sql", 20480]]) {
      await sleep(150);
      emit(`${code === 200 ? "\u001b[32m" : code === 301 ? "\u001b[36m" : "\u001b[33m"}${path} (Status: ${code}) [Size: ${size}]\u001b[0m`);
    }
    emit("\n===============================================================\nFinished\n===============================================================");
  });
  def("searchsploit", async ({ args, emit }) => {
    const q = args.join(" ") || "apache 2.4";
    emit(`---------------------------------------------- ---------------------------------\n Exploit Title                                |  Path\n---------------------------------------------- ---------------------------------`);
    for (const [t, p] of [["Apache 2.4.49 - Path Traversal & RCE", "linux/webapps/50383.sh"], ["Apache HTTP Server 2.4.58 - DoS", "linux/dos/51625.py"], ["MySQL 8.0 - Authentication Bypass", "mysql/webapps/51232.py"]])
      emit(`${t.padEnd(46)}| ${p}`);
    emit(`---------------------------------------------- ---------------------------------\nShellcodes: No Results`);
  });
  def("aircrack-ng airodump-ng", async ({ args, emit }) => {
    emit(`\n CH  6 ][ Elapsed: 12 s ][ ${new Date().toISOString().slice(11, 19)} \n\n BSSID              PWR  Beacons    #Data, #/s  CH   MB   ENC CIPHER  AUTH ESSID\n\n 3C:84:6A:22:9F:10  -42       38        4    0   6  360   WPA2 CCMP   PSK  THADD-NET-6E\n 8C:3B:AD:11:22:33  -67       21        0    0   1  195   WPA2 CCMP   PSK  GH-Visitor\n B8:27:EB:44:12:AA  -71       14        2    0  11  130   WPA  CCMP   PSK  <length: 0>`);
  });
  def("responder impacket bloodhound enum4linux smbclient wpscan whatweb nikto", async ({ args, raw, emit }) => {
    emit(`\u001b[35m[THADD Arsenal]\u001b[0m running: ${raw}`, "t-dim");
    await type([`[*] target: ${TARGET()}`, `[*] loading profiles…`, `[*] 12 technique modules armed`], 130);
    emit(`[+] SMB signing: disabled (relay-able)\n[+] users enumerated: 11 (guest share readable)\n[+] NTLMv2 hash captured: admin::THADD-LAB:4f2ac1… (saved to ~/loot/hashes.txt)\n[+] delegation: unconstrained on SRV-01 — path to DA via printspooler\n[+] 3 Kerberoastable SPNs found (mssqlsvc, backup, http-svc)`, "t-ok");
  });
  def("wireshark tshark", async ({ args, emit }) => emit(`Capturing on 'eth0'\n  1 0.000000000 10.0.2.15 → 140.82.121.4 TCP 74 52414 → 443 [SYN] Seq=0 Win=64240 Len=0 MSS=1460 SACK_PERM\n  2 0.008421000 140.82.121.4 → 10.0.2.15 TCP 74 443 → 52414 [SYN, ACK] Seq=0 Ack=1\n  3 0.008512000 10.0.2.15 → 140.82.121.4 TCP 66 52414 → 443 [ACK]\n  4 0.009114000 10.0.2.15 → 140.82.121.4 TLSv1.3 571 Application Data\n\u001b[90m… 418 packets in 12s · decoded 100% · follow-stream ready\u001b[0m`));
  const TRUSTED = ["127.0.0.1", "::1", TARGET(), "10.0.2.15", "10.10.14.7", "scanme.nmap.org", "thadd.os", "localhost"];
  const blocked = (t) => !TRUSTED.includes(t) && !/^10\.|^192\.168\.|^172\.(1[6-9]|2\d|3[01])\./.test(t);

  /* ---- dev toolchain ---- */
  def("python3 python", async ({ args, emit }) => {
    if (args[0] && args[0] !== "-V" && args[0] !== "--version") {
      emit(`Python 3.12.6 (main, Sep  9 2024) [GCC 13.2.0] on linux\nType "help", "copyright", "credits" or "license" for more information.`);
      emit(`>>> ${args.join(" ")}\nTHADD OS — python3 REPL (simulated): expression evaluated ✔`, "t-dim"); return;
    }
    emit("Python 3.12.6");
  });
  def("pip pip3", async ({ args, emit }) => {
    const [sub, pkg] = args;
    if (sub === "install") { emit(`Collecting ${pkg}\n  Downloading ${pkg}-2.31.0-py3-none-any.whl (1.4 MB)\nInstalling collected packages: ${pkg}\nSuccessfully installed ${pkg}-2.31.0`, "t-ok"); return; }
    if (sub === "list") { emit("Package         Version\n--------------- -------\nnumpy           2.1.2\npandas          2.2.3\nrequests        2.32.3\nfastapi         0.115.0\ntorch           2.4.1\ntransformers    4.45.2\ngroq            0.11.0\n"); return; }
    emit("Usage: pip install <pkg> | pip list | pip search <term>");
  });
  def("node nodejs", async ({ args, emit }) => { if (args[0] === "-v" || args[0] === "--version") emit("v22.22.3"); else if (args.length) { try { emit(String(eval(args.join(" ")))); } catch (e) { emit(String(e)); } } else emit("Welcome to Node.js v22.22.3.\nType \".help\" for more information.\n> "); });
  def("npm yarn pnpm", async ({ args, emit }) => {
    const [sub, name] = args;
    if (sub === "i" || sub === "install") { emit(`added ${10 + Math.floor(Math.random() * 200)} packages, and audited ${200 + Math.floor(Math.random() * 800)} packages in ${(1 + Math.random() * 8).toFixed(1)}s\n\nfound 0 vulnerabilities`, "t-ok"); return; }
    if (sub === "run") { emit(`> thadd-os@2.0.0 ${name}\n\n\u001b[32m✔ compiled successfully\u001b[0m  ready in 412 ms`); return; }
    if (sub === "-v") { emit("10.9.8"); return; }
    emit("npm <command>: install | run | test | audit | publish");
  });
  def("cargo go rustc", async ({ args, emit }) => emit(`cargo 1.83.0 (thadd-toolchain)\n   Compiling ${args[1] || "thadd-core"} v0.1.0 (/home/${S.user}/thadd-os)\n    Finished \`release\` profile [optimized] target(s) in 2.41s`, "t-ok"));
  def("gcc g++ make cmake", async ({ args, emit }) => emit(`gcc (Debian 13.2.0-25) 13.2.0\ncc1plus: warning: THADD OS ships -march=native by default\n[100%] Built target thadd\n\u001b[32mCompilation complete\u001b[0m`));
  def("git", async ({ args, emit }) => {
    const [sub, ...rest] = args;
    switch (sub) {
      case "status": emit(`On branch main\nYour branch is up to date with 'origin/main'.\n\nChanges not staged for commit:\n  (use "git add <file>..." to update what will be committed)\n\tmodified:   desktop/js/apps/jarvis.js\n\tmodified:   README.md\n\nUntracked files:\n\tos/packages.list\n\ndiff --git a/desktop/js/apps/jarvis.js\n\u001b[32m+  groq.stream(model, messages)\u001b[0m\n\u001b[32m+  await jarvis.tools.execute(call)\n\u001b[0m\nno changes added to commit`); return;
      case "log": emit(`commit 9f4c2ab (HEAD -> main, origin/main)\nAuthor: Thadd <thadd@thadd.os>\nDate:   ${new Date().toString()}\n\n    feat(os): THADD OS 2.0 Nebula Prime — Groq JARVIS agent\n\ncommit 4c1e88f\n    feat(desktop): Sequoia×Fluent shell, 200-app dock\n\ncommit eac0929\n    ci: fresh THADD OS desktop screenshot [skip ci]`); return;
      case "branch": emit("* main\n  arena/6e1ad65e-rdp-universal\n  feat/parrot-arsenal\n  release/2.0"); return;
      case "add": emit(`staged: ${rest.join(" ") || "."}`, "t-dim"); return;
      case "commit": emit(`[main ${Math.random().toString(16).slice(2, 9)}] ${rest.join(" ").replace(/^-m\s*/, "").replace(/^"|"$/g, "") || "update"}\n 3 files changed, 214 insertions(+), 18 deletions(-)`, "t-ok"); return;
      case "push": emit(`Enumerating objects: 12, done.\nCounting objects: 100% (12/12), done.\nDelta compression using up to 8 threads\nWriting objects: 100% (7/7), 2.41 KiB | 2.41 MiB/s, done.\nTo github.com:ThaddeusHackz/RDP-universal-.git\n   eac0929..9f4c2ab  main -> main`, "t-ok"); return;
      case "clone": emit(`Cloning into '${(rest[0] || "repo").split("/").pop().replace(/\.git$/, "")}'...\nremote: Enumerating objects: 1284, done.\nremote: Total 1284 (delta 412), reused 1102\nReceiving objects: 100% (1284/1284), 4.12 MiB | 8.20 MiB/s, done.\nResolving deltas: 100% (412/412), done.`, "t-ok"); return;
      case "diff": emit(`\u001b[31m-  const model = "mixtral-8x7b-32768"\u001b[0m\n\u001b[32m+  const model = "llama-3.3-70b-versatile"\u001b[0m`); return;
      case "init": emit("Initialized empty Git repository in " + S.cwd + "/.git/", "t-ok"); return;
      case "remote": emit(rest.length ? "origin\thttps://github.com/ThaddeusHackz/RDP-universal-.git (fetch)\norigin\thttps://github.com/ThaddeusHackz/RDP-universal-.git (push)" : "origin"); return;
      default: emit(`usage: git <status|log|branch|add|commit|push|pull|clone|diff|init|remote|stash|rebase|worktree|tag|bisect>`, "t-dim");
    }
  });
  def("docker podman", async ({ args, emit }) => {
    const [sub, ...rest] = args;
    if (sub === "ps") { emit("CONTAINER ID   IMAGE                    COMMAND                  CREATED         STATUS         PORTS                    NAMES\n3f9ac21b8d42   thadd/desktop:2.0        \"/entrypoint.sh\"         2 hours ago     Up 2 hours     0.0.0.0:8080->8080/tcp   thadd-os\n8d1b2f0a91cc   postgres:16              \"docker-entrypoint…\"      6 hours ago     Up 6 hours     5432/tcp                 thadd-db"); return; }
    if (sub === "images") { emit("REPOSITORY          TAG       IMAGE ID       CREATED         SIZE\nthadd/desktop       2.0       91f2ac81bd44   2 hours ago     612MB\nthadd/jarvis        latest    4b81cc0f2d10   3 weeks ago     1.1GB\npostgres            16        a9f2b1c8f3e2   6 weeks ago     432MB"); return; }
    if (sub === "build") { emit("STEP 1/12: FROM debian:bookworm-slim\nSTEP 2/12: ENV DEBIAN_FRONTEND=noninteractive\n…\n[+] Building 42.1s (12/12) FINISHED\n => => naming to docker.io/library/thadd-os:2.0", "t-ok"); return; }
    if (sub === "run") { emit(`${Math.random().toString(16).slice(2, 14)}`, "t-dim"); return; }
    emit("docker <command>: ps | images | build | run | compose | exec | logs");
  });
  def("kubectl", async ({ args, emit }) => emit(`NAME                 READY   STATUS    RESTARTS   AGE\nthadd-portal-7d4     1/1     Running   0          2h\njarvis-agent-2b1      1/1     Running   0          42m\nparrot-worker-9f8     1/1     Running   0          12m`));
  def("code vim vi nano", async ({ args, emit }) => { const f = args[0]; if (f) { emit(`Opening ${abs(f)} in THADD Code Studio (graphical)…`, "t-dim"); bus.emit("open-app", { app: "editor", args: { path: abs(f) } }); } else emit("usage: code <file>", "t-dim"); });
  def("jupyter", async ({ args, emit }) => emit(`[I ${new Date().toTimeString().slice(0, 8)} ServerApp] Serving notebooks from local directory: ${S.cwd}\n[I ${new Date().toTimeString().slice(0, 8)} ServerApp] Jupyter Server 2.16.0 is running at:\n[I ${new Date().toTimeString().slice(0, 8)} ServerApp] http://localhost:8888/tree?token=thadd-nebula-prime`));
  def("sqlite3 psql mysql", async ({ args, emit }) => { if (!args.length) { emit(`SQLite version 3.46.0 2024-05-23\nConnected to a transient in-memory database.\nsqlite> `); return; } emit(`SQLite version 3.46.0\n-- executing: ${args.join(" ")}\n(0 rows)`, "t-dim"); });

  /* ---- cross-platform shims ---- */
  def("dir", async ({ args, emit }) => {
    emit(` Volume in drive C is THADD-OS      Serial Number is 2E1A-9C4D\n Directory of ${S.cwd.replace(/\//g, "\\")}\n`);
    const kids = vfs.ls(abs(args.find((a) => !a.startsWith("/")) || ".")) || [];
    emit(`${dateStr()}     <DIR>          .\n${dateStr()}     <DIR>          ..`);
    kids.forEach((k) => emit(`${dateStr(k.mtime)}     ${k.type === "dir" ? "<DIR>         " : String(String(k.body || "").length).padStart(12) + " "}${k.name}`));
    emit(`              ${kids.length} File(s)   ${fmtBytes(kids.reduce((a, k) => a + String(k.body || "").length, 0))}\n              2 Dir(s)   448,201,932,800 bytes free`);
  });
  def("powershell pwsh", async ({ args, emit }) => {
    if (args.length && !args[0].startsWith("-")) {
      await type([`Windows PowerShell 7.4.6 (THADD Core)`, `Copyright (c) THADD OS Project. All rights reserved.`, ``], 90);
      emit(`PS> ${args.join(" ")}`, "raw"); return;
    }
    emit(`PowerShell 7.4.6 (THADD Core)\nPS ${S.cwd.replace(/\//g, "\\")}> `, "t-dim");
  });
  def("Get-Process Get-Service Get-ChildItem Get-Help Get-Command", async ({ args, raw, emit }) => {
    emit(`PS> ${raw}`, "raw");
    if (/Get-Process/.test(raw)) emit(` NPM(K)    PM(M)      WS(M)     CPU(s)      Id  SI ProcessName\n ------    -----      -----     ------      --  -- -----------\n     34    128.4     142.9       4.21    1042   1 code\n     62    412.1     468.3      12.44     901   1 firefox\n     12     48.2      55.1       1.20     412   0 thadd-shield\n     22     96.7     102.4       2.84    1201   1 thadd-jarvis`);
    else if (/Get-Service/.test(raw)) emit(`Status   Name           DisplayName\n------   ----           -----------\nRunning  thadd-shield   THADD Shield hardening daemon\nRunning  thadd-jarvis   JARVIS AI assistant\nRunning  xrdp           Remote Desktop Protocol server\nStopped  cups           Printing Service`);
    else if (/Get-ChildItem/.test(raw)) { const kids = vfs.ls(abs(args[args.length - 1] || ".")) || []; emit(`    Directory: ${S.cwd}\n\nMode          LastWriteTime         Length Name\n----          -------------         ------ ----`); kids.forEach((k) => emit(`${k.type === "dir" ? "d-----" : "-a----"}   ${new Date().toLocaleString().padEnd(20)} ${k.type === "dir" ? "" : String(String(k.body || "").length).padStart(7)} ${k.name}`)); }
    else emit(`(PowerShell cmdlet executed — THADD Core mapping applied)`, "t-dim");
  });
  def("tasklist", async ({ emit }) => emit(`Image Name                     PID Session Name        Session#    Mem Usage\n========================= ======== ================ =========== ============\nSystem Idle Process              0 Services                   0         12 K\ncode.exe                      1042 Console                    1    142,900 K\nfirefox.exe                    901 Console                    1    468,320 K\nthadd-shield.exe               412 Services                   0     48,220 K\nthadd-jarvis.exe              1201 Console                    1     96,700 K`));
  def("winget scoop choco", async ({ args, emit }) => {
    const [sub, pkg] = args;
    emit(`${sub === "install" ? "Installing" : "Probending"} ${pkg || "package"}…`);
    await type([`  ██████████████████████████████  100%`, `Successfully ${sub === "install" ? "installed" : "queried"} ${pkg || "package"} (via THADD package bridge) ✔`], 160);
  });
  def("where certutil net", async ({ args, emit }) => emit(`INFO: Could not find files for the given pattern(s).`, "t-dim"));
  def("brew", async ({ args, emit }) => {
    const [sub, pkg] = args;
    if (sub === "install") { emit(`==> Downloading https://ghcr.io/v2/homebrew/core/${pkg}/manifests/2.0\n==> Pouring ${pkg}--2.0.arm64_sequoia.bottle.tar.gz\n🍺  /opt/homebrew/Cellar/${pkg}/2.0: 412 files, 84.2MB`, "t-ok"); return; }
    if (sub === "list") { emit("firefox 131.0\niterm2 3.5.6\nthadd-cli 2.0.0\ngroq-cli 0.9.1"); return; }
    if (sub === "doctor") { emit("Your system is ready to brew. ✔ Mac layer is emulated on THADD OS.", "t-ok"); return; }
    emit("Example usage:\n  brew install <formula>");
  });
  def("defaults", async ({ args, emit }) => emit(`defaults: wrote ${args[1] || "com.thadd.os"} → ${args.slice(2).join(" ")} (Mac prefs layer mapped)`, "t-dim"));
  def("open", async ({ args, emit }) => { const a = args.find((x) => !x.startsWith("-")); if (a && !a.startsWith("/")) { emit(`Opening ${a} …`, "t-dim"); bus.emit("open-app", { app: "browser", args: { url: /^https?:/.test(a) ? a : "https://" + a } }); } else if (a) { emit(`Opening ${a}`, "t-dim"); bus.emit("open-app", { app: a.includes(".") ? "editor" : "files", args: { path: abs(a) } }); } else emit("usage: open <file|app|url>"); });
  def("say espeak", async ({ args, emit, S }) => { const t = args.join(" ") || "THADD OS is the greatest operating system in the world."; emit(`🔊 ${t}`, "t-dim"); try { const u = new SpeechSynthesisUtterance(t); speechSynthesis.speak(u); } catch {} });
  def("pbcopy", async ({ args, emit, stdin }) => { await copy(stdin || args.join(" ") || "", "Copied (pbcopy)"); });
  def("pbpaste", async ({ emit, print }) => { try { const t = await navigator.clipboard.readText(); print(t, "t-dim"); } catch { print("(clipboard unavailable)", "t-dim"); } });
  def("sw_vers", async ({ emit }) => emit("ProductName:\tmacOS (THADD compatibility layer)\nProductVersion:\t15.0.1\nBuildVersion:\t24A348\nTHADD_LAYER:\tSequential-Fluent Unified Shell 2.0"));

  /* ---- THADD control plane ---- */
  def("thadd", async ({ args, emit, print, S, win }) => {
    const [sub, ...rest] = args;
    switch (sub) {
      case undefined: case "help": case "--help":
        emit(`THADD OS control plane — ${OS}`);
        emit(`\n  thadd doctor            full system diagnostic (24 checks)`);
        emit(`  thadd scan [--full]     security audit: CIS + vuln sweep`);
        emit(`  thadd iso build         build the bootable ISO (live-build)`);
        emit(`  thadd shield [off|strict|paranoid]   set hardening profile`);
        emit(`  thadd ai <prompt>       one-shot JARVIS query from the shell`);
        emit(`  thadd vpn <up|down>     WireGuard tunnel control`);
        emit(`  thadd theme <name>      set the shell theme`);
        emit(`  thadd packages          list preinstalled meta-packages`);
        emit(`  thadd bench             CPU/GPU/disk benchmark`);
        emit(`  thadd htop              live resource HUD`);
        emit(`  thadd update            rolling-release update`);
        emit(`  thadd feedback          open an issue on GitHub`);
        emit(`  thadd version           print version matrix`);
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
          ["Container runtime", "PASS", "docker 27.2.0, rootless enabled"],
        ];
        for (const [n, s, d] of checks) { await sleep(70); emit(`  \u001b[32m✔\u001b[0m ${n.padEnd(26)} \u001b[32m${s}\u001b[0m  ${d}`); }
        emit(`\n\u001b[32m20 passed, 0 warnings, 0 failures — THADD OS is healthy.\u001b[0m`, "t-ok");
        return;
      }
      case "scan": {
        emit(`\u001b[36mTHADD Shield — full system audit${rest.includes("--full") ? " (--full)" : ""}\u001b[0m`);
        const steps = ["Refreshing CIS Debian benchmark (1,241 controls)", "Enumerating listening sockets", "Comparing packages against 214k CVE feed",
          "Heuristic malware sweep (ClamAV 1.4.1 + YARA 4.5)", "Static analysis of /opt/thadd binaries", "Checking sudoers & SUID tree", "Auditing AppArmor denials",
          "Validating TLS certificates & pinned keys", "Reviewing auth logs for anomalies", "Verifying shell histories for plaintext secrets"];
        for (const s of steps) { await sleep(220); emit(`  ▸ ${s} … done`); }
        emit(`\n  1241 controls: 1238 pass, 2 manual, 1 N/A`);
        emit(`  Listening: 22 (sshd), 3389 (xrdp), 8443 (nginx), 631 (cups) — all expected`);
        emit(`  CVEs affecting installed set: 0 critical, 0 high, 3 medium (patched in 2.0.1)`);
        emit(`  YARA: 0 hits · ClamAV: 0 detections · SUID anomalies: 0`);
        emit(`  Hardening score: \u001b[32m98 / 100\u001b[0m (A+ · best-in-class)`, "t-ok");
        emit(`  Report: /var/log/thadd/audit-${new Date().toISOString().slice(0, 10)}.json`, "t-dim");
        return;
      }
      case "iso": {
        const sub2 = rest[0] || "build";
        if (sub2 === "build") {
          emit("thadd-iso build — live-build pipeline (Debian bookworm base)");
          const stages = ["lb clean --purge", "lb config --distribution bookworm --architectures amd64 --binary-images iso-hybrid",
            "lb bootstrap (debootstrap)", "lb chroot_install-packages (2147 pkgs, 4.1 GB)",
            "Applying THADD overlay (shell, JARVIS, parrot meta, themes)", "lb chroot_hooks (hardening, os-release, motd)",
            "mksquashfs /chroot /binary/live/filesystem.squashfs -comp zstd", "Building hybrid MBR/EFI isohybrid image",
            "Appending md5 + sha256 checksums", "→ thadd-os-2.0-nebula-prime-amd64.iso"];
          for (const s of stages) { emit(`  [${String(stages.indexOf(s) + 1).padStart(2)}/10] ${s}`); await sleep(260); }
          vfs.write(abs("~/thadd-os-2.0-nebula-prime-amd64.iso"), "[ISO 9660 image — 2.94 GB · bootable live/installer]");
          emit(`\n\u001b[32mISO ready: 2.94 GB — boot it in VirtualBox or write it to USB with dd.\u001b[0m`);
          emit(`SHA256: 9f4c2ab4d1e0c7b8f3a91d6e2c48b70a5f1d3e8c9a2b4f6e0d7c1a3b5e9f2c4d`, "t-dim");
          emit(`Next:  thadd iso test    (boots the ISO in QEMU headless and screenshots the desktop)`, "t-dim");
          return;
        }
        if (sub2 === "test") { await type(["QEMU: -m 4096 -smp 4 -cdrom thadd-os-2.0.iso -boot d", "Booting THADD OS live…", "Reached login: thadd / thadd ✔", "Captured screenshot → /home/thadd/Pictures/Screenshots/vm-boot.png"], 300); return; }
        emit("usage: thadd iso [build|test|clean|write <device>]"); return;
      }
      case "shield": {
        const mode = rest[0] || "status";
        if (mode === "status" || mode === "strict" || mode === "paranoid" || mode === "off") {
          store.set("shield.strict", mode !== "off");
          const p = mode === "off" ? ["permissive", 0] : mode === "paranoid" ? ["paranoid", 96] : ["strict", 47];
          emit(`THADD Shield profile: \u001b[1m${mode === "status" ? (store.get("shield.strict", true) ? "strict" : "off") : mode}\u001b[0m`);
          emit(`  syscall filters: ${p[1]} rules · kernel lockdown: ${mode === "off" ? "none" : "confidentiality"}`);
          emit(`  USB guard: ${mode === "off" ? "off" : "on (whitelist 4 devices)"} · kernel module signing: enforced`);
          return;
        }
        emit("usage: thadd shield [status|strict|paranoid|off]"); return;
      }
      case "ai": {
        const prompt = rest.join(" ") || "Summarise my home directory and suggest what to work on.";
        emit(`\u001b[36mJARVIS\u001b[0m → ${prompt}`, "t-dim");
        bus.emit("open-app", { app: "jarvis", args: { prompt } });
        emit("(opened the JARVIS window — ask there for the full answer)", "t-dim");
        return;
      }
      case "vpn": { const up = (rest[0] || "status") === "up"; emit(up ? "wg-quick up thadd0 … handshake OK · 10.10.14.7 · kill-switch armed ✔" : "thadd0: down (0 peers)"); return; }
      case "theme": { emit(`theme → ${rest[0] || "Nebula-Prime-Dark"} applied to shell, terminal, GTK, dock ✔`, "t-ok"); return; }
      case "packages": emit("Meta-packages installed:\n  thadd-desktop 2.0.0   thadd-ai 2.0.0        parrot-tools 7.1\n  thadd-shield 2.0.0    thadd-dev 2.0.0       kali-tools 2024.3\n  groq-cli 0.9.1        code-oss 1.94         firefox-esr 131"); return;
      case "bench": {
        emit("THADD bench v2.0 — quick synthetic");
        await type(["[cpu ] single-core   : 4,821 pts (AES-256 2.9 GB/s)", "[cpu ] multi-core    : 38,144 pts (AVX-512 vectorised)",
          "[mem ] 128 MiB copy  : 24.6 GB/s", "[disk] sequential rd : 3.4 GB/s (nvme) · 512 MB/s (sda)",
          "[gpu ] VMSVGA blit   : 1,284 fps @1080p · VirGL ok", "[net ] loopback      : 12.4 Gb/s", "[net ] internet      : 42.1 Mb/s ↓ / 18.4 Mb/s ↑"], 190);
        emit("Composite: 9,412 — 'Mainframe-class workstation'", "t-ok"); return;
      }
      case "htop": { bus.emit("open-app", { app: "monitor" }); emit("opening Activity Monitor…", "t-dim"); return; }
      case "update": { await type(["Rolling release · Nebula Prime (2.0.0 → 2.0.1)", "Fetching 2147 package indices… 100%", "12 upgrades: kernel 6.9.7, firefox 131.0.3, code 1.94.2, groq-cli 0.9.2",
        "Downloading 412.7 MB … 100% (8.2 MB/s)", "Applying, rebuilding initramfs, signing modules", "✔ Upgraded — reboot recommended"], 220); return; }
      case "feedback": { bus.emit("open-app", { app: "browser", args: { url: "https://github.com/ThaddeusHackz/RDP-universal-/issues/new" } }); emit("Opening GitHub issue form…", "t-dim"); return; }
      case "version": emit(`THADD OS        2.0.0 "Nebula Prime"\nKernel          6.9.7-thadd-hardened (KSPP)\nShell/compositor THADD Shell 2.0 (Sequoia×Fluent)\nAI              JARVIS 2.0 · Groq llama-3.3-70b-versatile\nArsenal         Parrot 6.3 meta + THADD offensive pack\nBase            Debian 12 bookworm + Ubuntu/Debian/macOS/Windows compat layers\nBuild           ${new Date().toISOString()}\nRepo            github.com/ThaddeusHackz/RDP-universal-`); return;
      default: emit(`thadd: unknown subcommand '${sub}'. Try \`thadd help\`.`, "t-err");
    }
  });
  def("thadd-iso", async ({ args, emit, print, S, win }) => C["thadd"]({ args: ["iso", ...args], emit, print, S, win }));
  def("thadd-shield", async ({ args, emit, print, S, win }) => C["thadd"]({ args: ["shield", ...args], emit, print, S, win }));
  def("thadd-ai groq ai jarvis", async ({ args, emit, S, win }) => {
    if (!args.length) { bus.emit("open-app", { app: "jarvis" }); emit("JARVIS window opened.", "t-dim"); return; }
    const key = store.get("ai.groqKey", "");
    const prompt = args.join(" ");
    emit(`\u001b[36m✦ JARVIS\u001b[0m ${prompt}`);
    if (!key) {
      const reply = offlineAnswer(prompt);
      await type(reply.split("\n"), 60);
      emit(`\n\u001b[33m(offline reasoning — add a Groq API key in JARVIS for live models)\u001b[0m`, "t-dim");
      return;
    }
    emit("… contacting Groq (llama-3.3-70b-versatile)", "t-dim");
    try {
      const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
        body: JSON.stringify({ model: store.get("ai.model", "llama-3.3-70b-versatile"),
          messages: [{ role: "system", content: "You are JARVIS, the THADD OS assistant, answering inside a terminal. Be concise, use plain text, no markdown headers." },
                     { role: "user", content: prompt }], temperature: 0.6, max_tokens: 900 }),
      });
      const j = await r.json();
      const text = j.choices?.[0]?.message?.content || j.error?.message || "No response.";
      await type(String(text).split("\n"), 24);
      emit(`\u001b[90m[tokens ${j.usage?.total_tokens ?? "?"} · ${j.model || ""}]\u001b[0m`, "t-dim");
    } catch (e) { emit("Groq request failed: " + e.message + " — falling back to offline reasoning.", "t-err"); await type(offlineAnswer(prompt).split("\n"), 40); }
  });
  function offlineAnswer(p) {
    const q = p.toLowerCase();
    if (/iso|build|virtualbox|vm|boot/.test(q)) return ["To build the THADD OS ISO:", "",
      "  1. On a Debian/Ubuntu host:  sudo ./os/tools/install-deps.sh",
      "  2. Build the image:          thadd iso build   (live-build, 10 stages, ~12 min)",
      "  3. Test headless:            thadd iso test    (QEMU boots + screenshots)",
      "  4. Install VirtualBox and create a VM: 2 GB RAM, 25 GB disk, VMSVGA, 128 MB VRAM",
      "  5. Attach thadd-os-2.0-nebula-prime-amd64.iso, boot, choose 'Live' or 'Install'.",
      "", "VirtualBox notes: enable EFI, 3D acceleration, and 2 CPU cores for the best shell smoothness."].join("\n");
    if (/hack|exploit|scan|nmap|pentest|htb/.test(q)) return [
      "THADD OS ships the full Parrot 6.3 arsenal (600+ tools). Typical lab workflow:", "",
      "  nmap -sV -sC -p- 10.10.10.5 -oN recon.txt      # discover",
      "  gobuster dir -u http://10.10.10.5 -w /usr/share/wordlists/dirb/common.txt",
      "  searchsploit apache 2.4                        # map to exploits",
      "  sqlmap -u 'http://10.10.10.5/item.php?id=1' --batch --dbs",
      "  hydra -L users.txt -P rockyou.txt ssh://10.10.10.5 -t 4",
      "  msfconsole -q -x 'use exploit/multi/handler; run'",
      "", "All of it is wrapped by THADD Shield, which logs and contains offensive tooling so it can never touch non-lab networks unless you unlock lab mode."].join("\n");
    if (/hello|hi|who are you|jarvis/.test(q)) return ["I am JARVIS — the THADD OS assistant. I can read and write files in your home directory,",
      "run shell commands, launch apps, harden the system, and answer questions. Ask me anything."].join("\n");
    return [`You asked: “${p}”`, "",
      "Offline reasoning engines are limited — plug in your Groq API key (JARVIS window → ⚙) and I will answer with",
      "llama-3.3-70b-versatile at ~275 tokens/sec, with full access to your files, terminal and OS controls.",
      "", "Meanwhile, useful starting points:", "  thadd doctor     · full system diagnostic", "  thadd scan --full · security audit",
      "  parrot          · the offensive toolkit index", "  help            · all 180+ commands"].join("\n");
  }

  /* ---- fun ---- */
  def("cowsay", async ({ args, emit }) => {
    const t = (args.join(" ") || "THADD OS is the greatest OS ever assembled").replace(/^"|"$/g, "");
    const line = "─".repeat(t.length + 2);
    emit(` ${line}\n< ${t} >\n ${line}\n        \\   ^__^\n         \\  (oo)\\_______\n            (__)\\       )\\/\\\n                ||----w |\n                ||     ||`);
  });
  def("figlet banner toilet", async ({ args, emit }) => {
    const t = (args.join(" ") || "THADD OS").toUpperCase();
    const font = { A: ["  ▄  ", " ███ ", "█   █"], B: ["██▄ ", "██▀ ", "██▄ "], C: ["▄███", "█   ", "▀███"], D: ["██▄ ", "█  █", "██▀ "],
      E: ["███", "██▀", "███"], F: ["███", "██▀", "█  "], G: ["▄███", "█ ██", "▀██▀"], H: ["█  █", "████", "█  █"], I: ["███", " █ ", "███"],
      J: ["  ██", "  ██", "██▀ "], K: ["█ █ ", "██  ", "█ █ "], L: ["█  ", "█  ", "███"], M: ["█▄ ▄█", "█ █ █", "█   █"], N: ["█▄ █", "█ ▀█", "█  █"],
      O: ["▄██▄", "█  █", "▀██▀"], P: ["██▄", "██▀", "█  "], Q: ["▄██▄", "█ ██", "▀███"], R: ["██▄", "██▀", "█ █"], S: ["▄███", "▀██▄", "███▀"],
      T: ["███", " █ ", " █ "], U: ["█  █", "█  █", "▀██▀"], V: ["█  █", "█  █", " ▀▀ "], W: ["█   █", "█ █ █", "▀▀ ▀▀"], X: ["█ █", " █ ", "█ █"],
      Y: ["█ █", " █ ", " █ "], Z: ["███", " █ ", "███"], " ": ["   ", "   ", "   "] };
    for (let r = 0; r < 3; r++) emit(t.split("").map((ch) => (font[ch] || font[" "])[r]).join(" "));
  });
  def("fortune", async ({ args, emit }) => emit(PICKS[Math.floor(Math.random() * PICKS.length)]));
  const PICKS = ["The best way to predict the future is to invent it. — Alan Kay",
    "Security is not a product, but a process. — Bruce Schneier", "Talk is cheap. Show me the code. — Linus Torvalds",
    "Any sufficiently advanced technology is indistinguishable from magic. — Arthur C. Clarke",
    "One OS. All the Best. — THADD OS", "Simplicity is prerequisite for reliability. — Edsger Dijkstra",
    "The quieter you become, the more you are able to hear. — Kali maxim"];
  def("sl cmatrix matrix", async ({ args, emit, print }) => {
    for (let i = 0; i < 6; i++) { await sleep(300); print("  " + Array.from({ length: 78 }, () => String.fromCharCode(0x30 + Math.floor(Math.random() * 74))).join(""), "t-ok"); }
    emit("\u001b[90m… matrix rain stopped (press q)\u001b[0m", "t-dim");
  });
  def("lolcat", async ({ args, emit, stdin }) => emit(((stdin ?? args.join(" ")) || "thadd os").split("").map((c, i) => `\u001b[3${i % 7 + 1}m${c}\u001b[0m`).join("")));
  def("hollywood", async ({ args, emit }) => { for (let i = 0; i < 8; i++) { await sleep(120); emit("[" + new Date().toTimeString().slice(0, 8) + "] thadd-shield: sweep " + Math.random().toString(16).slice(2, 10) + " clean"); } });
  def("thadd-welcome unameinfo", async ({ emit }) => emit(`Welcome to THADD OS 2.0 (Nebula Prime)!\n * Documentation:  https://github.com/ThaddeusHackz/RDP-universal-/blob/main/README.md\n * Releases / ISOs: https://github.com/ThaddeusHackz/RDP-universal-/releases\n * 41 updates can be applied immediately.\n * THADD Shield is in STRICT mode (47 rules). AI: JARVIS ready.`, "t-ok"));

  /* ---- apt / package managers ---- */
  def("apt apt-get dpkg apk dnf yum pacman", async ({ args, emit }) => {
    const [sub, ...pkgs] = args.filter((a) => !a.startsWith("-"));
    if (sub === "update") { await type(["Hit:1 https://deb.debian.org/debian bookworm InRelease", "Hit:2 https://security.debian.org/debian-security bookworm-security InRelease",
      "Get:3 https://repo.thadd.os/nebula prime InRelease [18.2 kB]", "Get:4 https://download.docker.com/linux/debian bookworm InRelease [42.1 kB]",
      "Fetched 60.3 kB in 1s (58.2 kB/s)", "Reading package lists... Done", "All packages are up to date."], 130); return; }
    if (sub === "install") {
      emit(`Reading package lists... Done\nBuilding dependency tree... Done\nThe following NEW packages will be installed:\n  ${pkgs.join(" ")}`);
      await type([`Need to get ${(pkgs.length * 2.4 + 1).toFixed(1)} MB of archives.`, "Get:1 https://deb.debian.org/debian bookworm/main amd64 " + (pkgs[0] || "pkg") + " [2.4 MB]",
        "Fetched 2.4 MB in 0s (18.4 MB/s)", "Selecting previously unselected package " + (pkgs[0] || "pkg") + ".",
        "Unpacking " + (pkgs[0] || "pkg") + " …", "Setting up " + (pkgs[0] || "pkg") + " …"], 140);
      emit(`\u001b[32mSuccessfully installed: ${pkgs.join(" ") || "nothing"}\u001b[0m`, "t-ok"); return;
    }
    if (sub === "list") { emit("Listing... Done\nthadd-desktop/prime,now 2.0.0 all [installed]\nthadd-ai/prime,now 2.0.0 all [installed]\nparrot-tools/prime,now 7.1 all [installed]\nfirefox-esr/prime,now 131.0 all [installed]\ncode-oss/prime,now 1.94.0 all [installed]"); return; }
    if (sub === "upgrade" || sub === "full-upgrade") { await type(["Calculating upgrade... Done", "41 upgraded, 0 newly installed, 0 to remove", "Need to get 412 MB. ", "Setting up linux-image-6.9.7-thadd …", "✔ Done — reboot recommended."], 200); return; }
    emit("apt <command>: update | install <pkg> | remove <pkg> | list | upgrade | search <term>");
  });
  def("snap flatpak", async ({ args, emit }) => emit(`Name     Version   Rev   Tracking       Publisher   Notes\ncode     1.94      1024  latest/stable  thadd✓      classic\nfirefox  131.0     5123  latest/stable  mozilla✓    -\nthadd    2.0.0     42    latest/stable  thadd✓      -`, "t-dim"));

  /* ---- misc utilities ---- */
  def("thadd-json jq", async ({ args, emit, stdin }) => { try { emit(JSON.stringify(JSON.parse(stdin || args.join(" ")), null, 2)); } catch { emit("jq: parse error", "t-err"); } });
  def("openssl", async ({ args, emit }) => {
    if (args[0] === "rand") { emit([...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, "0")).join("")); return; }
    if (args[0] === "genrsa" || args[0] === "req") { emit("Generating RSA private key, 4096 bit long modulus (2 primes)\n....................++++\ne is 65537 (0x10001)\nwriting new private key to 'thadd.key'\n-----\nCertificate request self-signature ok\nsubject=C = GH, ST = Greater Accra, L = Accra, O = THADD OS, CN = thadd.os"); return; }
    emit("OpenSSL 3.3.2 3 Sep 2024 (Library: OpenSSL 3.3.2)\nusage: openssl <command> …");
  });
  def("gpg", async ({ args, emit }) => emit("gpg: WARNING: unsafe permissions on homedir '/home/thadd/.gnupg'\ngpg: key 0xTHADD2DEADBEEF: public key \"THADD OS Release Signing <release@thadd.os>\" imported\ngpg: marginals needed: 3  completes needed: 1  trust model: pgp\ngpg: depth: 0  valid: 1  signed: 0  trust: 0-, 0q, 0n, 0m, 0f, 1u"));
  def("ufw iptables nft", async ({ args, raw, emit }) => {
    if (/status/.test(raw)) { emit(`Status: active\nLogging: on (low)\nDefault: deny (incoming), allow (outgoing), disabled (routed)\nNew profiles: skip\n\nTo                         Action      From\n--                         ------      ----\n22/tcp                     ALLOW IN    Anywhere          # ssh (key-only)\n3389/tcp                   ALLOW IN    10.0.0.0/8        # xrdp, LAN only\n8443/tcp                   ALLOW IN    Anywhere          # THADD portal (TLS)\n6080/tcp                   ALLOW IN    Anywhere          # noVNC (TLS)\nAnywhere on thadd0         ALLOW FWD   Anywhere          # wireguard lab tunnel\nAnywhere                   DENY IN     0.0.0.0/0         # geoip-block (CN,RU,KP)`); return; }
    emit("Firewall rule applied (nftables backend) ✔", "t-ok");
  });
  def("fail2ban-client lynis rkhunter chkrootkit clamav freshclam", async ({ args, raw, emit }) => {
    if (/lynis/.test(raw)) { await type(["[ Lynis 3.1.2 — THADD OS audit ]", "Hardening index : 98 [#################]", "Tests performed : 263", "Plugins enabled : 8",
      "Firewall : iptables/nftables ✔", "Malware scanner : clamav ✔", "File integrity : aide ✔", "Warnings: 2 (SSH permitrootlogin, core dumps) — auto-fix available"], 160); return; }
    if (/rkhunter|chkrootkit/.test(raw)) { emit("Checking for rootkits…\n  Checking for suspicious (large) shared memory segments   [ OK ]\n  Checking for hidden files and directories                [ OK ]\n  Checking /dev for suspicious file types                  [ OK ]\n  Rootkit checks complete — 0 infected files found"); return; }
    if (/clamav|freshclam/.test(raw)) { emit("ClamAV 1.4.1/27412/Thu Oct 13 — main.cvd is up to date\n----------- SCAN SUMMARY -----------\nKnown viruses: 8,724,183\nEngine version: 1.4.1\nScanned directories: 4,221\nScanned files: 184,412\nInfected files: 0\nData scanned: 12.4 GB\nTime: 42.12 sec"); return; }
    emit("Status\n|- Number of jail: 3\n`- Jail list: sshd, xrdp, thadd-portal (0 currently banned, 14 total bans)");
  });
  def("aide auditd", async ({ args, emit }) => emit("AIDE 0.19 — file integrity database verified\n  Added: 0  Removed: 0  Changed: 0\n  Last run: 4h ago · next: in 20h"));

  /* ---- THADD extras requested by the user ---- */
  def("screenshot", async ({ args, emit }) => { const m = await import("./screenshot.js"); await m.grab(); emit("Screenshot saved to /home/" + S.user + "/Pictures/Screenshots/ ✔", "t-ok"); });
  def("record", async ({ args, emit }) => { emit("Screen recorder armed — Ctrl+Shift+R to stop. Output: ~/Videos/thadd-demo.mp4", "t-dim"); });
  def("flash memtest sysbench stress", async ({ args, emit }) => { await type(["stress-ng: 4 workers, 30s, cpu+malloc", "cpu: 38,144 pts · mem: 24.6 GB/s · thermal: 41°C (no throttle)", "PASS — system stable under load"], 300); });
  def("wpa_supplicant nmcli bluetoothctl", async ({ args, raw, emit }) => { emit(`nmcli: ${/nmcli/.test(raw) ? "wlan0  wifi  connected  THADD-NET-6E  WPA2/3  ▂▄▆█  1.2 Gb/s\neth0   ethernet  connected  --         1000 Mb/s\nthadd0 wireguard  connected  HTB-Lab    --        --" : "device list: wlan0 (BT 5.3), hci0 (Intel AX210)"}`); });
  def("xrandr", async ({ emit }) => emit(`Screen 0: minimum 16 x 16, current ${innerWidth} x ${innerHeight}, maximum 16384 x 16384\nVirtual1 connected primary ${innerWidth}x${innerHeight}+0+0 (normal left inverted right x axis y axis)\n   1920x1080     60.00*+  50.00\n   1600x900      59.95\n   3840x2160     30.00`));
  def("wall setbg", async ({ args, emit }) => { emit("wallpaper changed via thadd-shell", "t-dim"); const m = await import("../shell.js"); m.nextWallpaper(); });
  def("theme", async ({ args, emit }) => emit(args[0] ? `theme ${args[0]} applied (GTK, Qt, shell, terminal, icons) ✔` : "usage: theme <Nebula-Prime-Dark|Sequoia-Light|Fluent-Dark|Parrot-Green|Nord|Dracula>"));
  def("uptime-info", async ({ emit }) => emit(`up ${fmtDur(uptime())}`));
  def("exit-os", async ({ emit }) => emit("logout", "t-dim"));
  def("window list", async ({ args, emit }) => { emit("THADD shell windows managed by wm.js:"); import("../wm.js").then(({ windows: W }) => W.forEach((w, i) => emit(`  ${String(i + 1).padStart(2)}  ${w._title.padEnd(28)} ${w._state.min ? "minimised" : "visible"}  z=${w.style.zIndex}`))); });
  def("thadd-open", async ({ args, emit }) => { bus.emit("open-app", { app: args[0] || "finder", args: { path: args[1] } }); emit(`launched ${args[0] || "finder"}`, "t-dim"); });
  def("nmap-os-detect", async ({ args, emit, print, S, win }) => C["nmap"]({ args: ["-A", ...args], emit, print, S, win }));

  def("date-iso", async ({ emit }) => emit(new Date().toISOString()));
  def("passwd", async ({ emit }) => emit("Changing password for thadd.\nCurrent password: ●●●●\nNew password: ●●●●●●●●\nRetype new password: ●●●●●●●●\npasswd: password updated successfully ✔", "t-ok"));
  def("useradd userdel usermod adduser groupadd", async ({ args, raw, emit }) => emit(`(simulated) ${raw} ✔`, "t-dim"));
  def("mount umount", async ({ args, raw, emit }) => emit(raw.startsWith("mount") && !args.length
    ? `/dev/sda2 on / type ext4 (rw,relatime,errors=remount-ro)\nproc on /proc type proc (rw,nosuid,nodev,noexec)\nsysfs on /sys type sysfs (rw,nosuid,nodev,noexec)\ndevtmpfs on /dev type devtmpfs (rw,nosuid,size=8129M)\n/home on /dev/sda3 type zfs (rw,relatime,xattr,noacl)\n/vault on /dev/nvme0n1p1 type ext4 (rw,relatime) [LUKS2]\n//10.0.2.4/lab on /mnt/lab type cifs (rw,vers=3.1.1,sec=krb5)`
    : `(simulated) ${raw}`, "t-dim"));
  def("crontab systemd-timer at", async ({ args, raw, emit }) => emit(raw.includes("-l")
    ? `# THADD OS scheduled jobs\n0 3 * * *  /usr/local/bin/thadd scan --full --quiet\n*/15 * * * * /usr/local/bin/thadd-shield heartbeat\n0 4 * * 0  /usr/bin/apt-get upgrade -y`
    : "(simulated) cron updated ✔", "t-dim"));
  def("nano", async ({ args, emit, S, win }) => { const f = args[0] || ""; emit(`opening ${f} in the graphical editor…`, "t-dim"); if (f) bus.emit("open-app", { app: "editor", args: { path: abs(f) } }); });
  def("tldr", async ({ args, emit }) => { const cmd = args[0] || "ls"; emit(`\u001b[36m${cmd}\u001b[0m\n\n  ${cmd} — quick reference (tldr pages, offline cache)\n\n  Examples:\n    ${cmd} --help\n    man ${cmd}\n`); });

  return wrap;
}

export const meta = { name: "Terminal" };
