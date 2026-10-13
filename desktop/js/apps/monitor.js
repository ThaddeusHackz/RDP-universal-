/* =============================================================================
 * THADD OS 2.0 — apps/monitor.js
 * Activity Monitor — live CPU/RAM/disk/net/GPU telemetry with canvas
 * sparklines, a searchable process table, per-app energy impact and a
 * one-click "ask JARVIS what's wrong" hand-off.
 * ========================================================================== */

import { $, el, esc, toast, store, sleep, fmtBytes, uptime, fmtDur, contextMenu } from "../core.js";
import { windows, closeApp } from "../wm.js";

export function build() {
  const S = { tab: "cpu", q: "", t: 0 };
  const hist = { cpu: Array(60).fill(4), ram: Array(60).fill(18), net: Array(60).fill(2), disk: Array(60).fill(1) };

  const tabs = el("div", { class: "toolbar" });
  const grid = el("div", { class: "mon-grid" });
  const search = el("input", { class: "tb-input", placeholder: "Filter processes…", style: { maxWidth: "260px" } });
  const table = el("div", { style: { padding: "0 13px 16px" } });
  const wrap = el("div", { class: "mon" });

  for (const [id, label] of [["cpu", "CPU"], ["memory", "Memory"], ["energy", "Energy"], ["disk", "Disk"], ["network", "Network"], ["gpu", "GPU"], ["tasks", "Tasks (windows)"]]) {
    const b = el("button", { class: "chip" + (id === S.tab ? " on" : ""), text: label });
    b.dataset.tab = id;
    b.addEventListener("click", () => { S.tab = id; render(); });
    tabs.append(b);
  }
  search.addEventListener("input", () => { S.q = search.value.toLowerCase(); renderTable(); });
  tabs.append(el("span", { style: { flex: "1" } }), search,
    el("button", { class: "chip", text: "✦ Diagnose with JARVIS", onclick: () => window.THADD.launch("jarvis", { prompt: `My system stats right now: CPU ${hist.cpu.at(-1)}%, RAM ${hist.ram.at(-1)}%, ${windows.size} windows open. Anything I should fix or optimise? Run a system_info call first.` }) }));
  wrap.append(tabs, grid, table);

  const PROC = () => [
    { pid: 1, user: "root", cpu: 0.0, mem: 0.1, name: "systemd", cmd: "/sbin/init splash" },
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
    { pid: 1620, user: "thadd", cpu: 5.6, mem: 2.8, name: "thadd-shell", cmd: "thadd-shell --compositor" },
  ];
  const proc = PROC();

  function render() {
    tabs.querySelectorAll(".chip").forEach((c) => c.classList.toggle("on", c.dataset.tab === S.tab));
    grid.innerHTML = "";
    if (S.tab === "tasks") return renderTasks();
    const spark = (data, color) => {
      const c = document.createElement("canvas"); c.className = "spark"; c.width = 260; c.height = 52;
      const x = c.getContext("2d");
      x.strokeStyle = color; x.lineWidth = 2; x.beginPath();
      const max = Math.max(...data, 1);
      data.forEach((v, i) => {
        const px = (i / (data.length - 1)) * c.width, py = c.height - (v / max) * (c.height - 6) - 3;
        i ? x.lineTo(px, py) : x.moveTo(px, py);
      });
      x.stroke();
      const g = x.createLinearGradient(0, 0, 0, c.height);
      g.addColorStop(0, color.replace("rgb", "rgba").replace(")", ",.28)"));
      g.addColorStop(1, "rgba(0,0,0,0)");
      x.lineTo(c.width, c.height); x.lineTo(0, c.height); x.closePath(); x.fillStyle = g; x.fill();
      return c;
    };
    const stats = {
      cpu: [["CPU load", hist.cpu.at(-1) + "%", `${navigator.hardwareConcurrency || 8} cores @ 3.6GHz · schedutil`],
        ["User / System", `${(hist.cpu.at(-1) * .62).toFixed(0)}% / ${(hist.cpu.at(-1) * .38).toFixed(0)}%`, "load avg " + (hist.cpu.at(-1) / 25).toFixed(2)],
        ["Frequency", "3.6 GHz", "turbo on · 41°C"],
        ["Uptime", fmtDur(uptime()), "1 user session"]],
      memory: [["Memory used", hist.ram.at(-1) + "%", `${Math.round(hist.ram.at(-1) / 100 * 16384)} MiB of 16384 MiB`],
        ["Swap", "0%", "2048 MiB allocated"],
        ["Cached", "2.1 GiB", "page cache + buffers"],
        ["Pressure", "Low", "no reclaim stalls"]],
      energy: [["Power draw", "18 W", "schedutil governor"], ["Battery", "98%", "AC connected"], ["Thermals", "41°C", "no throttling"], ["Impact (top app)", "code — medium", "12.4% CPU average"]],
      disk: [["Read", "412 MB/s", "nvme0n1p1"], ["Write", "96 MB/s", "zfs txg 5s"], ["IOPS", "12.4k", "4K random"], ["Used", "177 GB", "of 2.77 TB total"]],
      network: [["Down", "42.1 Mb/s", "eth0 · DoH"], ["Up", "18.4 Mb/s", "eth0"], ["Connections", "128", "22 established to 443"], ["Latency", "12 ms", "London PoP"]],
      gpu: [["Renderer", "VMSVGA + VirGL", "128 MB VRAM"], ["FPS", "60", "compositor vsync"], ["Encode", "idle", "VA-API H.264/AV1"], ["VRAM used", "214 MB", "12%"]],
    }[S.tab] || [];
    for (const [k, v, sub] of stats) {
      grid.append(el("div", { class: "stat" }, el("div", { class: "k", text: k }), el("div", { class: "v", text: v }), el("div", { class: "mute", style: { fontSize: "11.4px", marginTop: "4px" }, text: sub })));
    }
    grid.append(el("div", { class: "stat", style: { gridColumn: "1/-1" } },
      el("div", { class: "k", text: S.tab + " (last 60s)" }),
      spark(hist[S.tab === "memory" ? "ram" : S.tab === "network" ? "net" : S.tab === "disk" ? "disk" : "cpu"], "rgb(34,211,238)")));
    renderTable();
  }

  function renderTable() {
    table.innerHTML = "";
    const t = el("table", { class: "tbl" });
    t.append(el("thead", {}, el("tr", {}, ...["PID", "User", "% CPU", "Memory", "Process", "Command"].map((h) => el("th", { text: h })))));
    const tb = el("tbody");
    const rnd = () => (Math.random() - .5) * 1.2;
    proc.filter((p) => !S.q || (p.name + p.cmd + p.user).toLowerCase().includes(S.q))
      .sort((a, b) => b.cpu - a.cpu)
      .forEach((p) => {
        const cpu = Math.max(0, p.cpu + rnd()), mem = Math.max(0.1, p.mem + rnd() / 2);
        const tr = el("tr", {}, el("td", { text: p.pid }), el("td", { text: p.user }), el("td", { text: cpu.toFixed(1) }),
          el("td", { text: fmtBytes(mem / 100 * 16384 * 1024 * 1024) }), el("td", { text: p.name }), el("td", { class: "mono dim", text: p.cmd }));
        tr.addEventListener("contextmenu", (e) => {
          e.preventDefault();
          contextMenu(e.clientX, e.clientY, [
            { label: "Get info", action: () => toast(p.name, `PID ${p.pid} · ${p.user} · ${p.cmd}`, { icon: "ℹ" }) },
            { label: "Ask JARVIS about this process", action: () => window.THADD.launch("jarvis", { prompt: `What is "${p.name}" (PID ${p.pid}, cmd: ${p.cmd}) doing on my THADD OS machine?` }) },
            "-",
            { label: "End process (SIGTERM)", action: () => toast("Signal sent", `SIGTERM → ${p.name} (${p.pid})`, { icon: "✖" }) },
            { label: "Force quit (SIGKILL)", action: () => toast("Process killed", `${p.name} (${p.pid}) — SIGKILL`, { icon: "☠" }) },
          ]);
        });
        tb.append(tr);
      });
    t.append(tb);
    table.append(t);
    table.append(el("div", { class: "mute", style: { fontSize: "11.6px", marginTop: "8px" },
      text: `${proc.length} processes · ${windows.size} windows · ${store.get("ai.model", "llama-3.3-70b-versatile")} loaded in JARVIS` }));
  }

  function renderTasks() {
    const list = [...windows.values()];
    if (!list.length) { grid.append(el("div", { class: "mission-empty", text: "No windows open." })); return; }
    for (const w of list) {
      grid.append(el("div", { class: "stat" },
        el("div", { class: "k", text: w._app }),
        el("div", { class: "v", style: { fontSize: "17px" }, text: w._title }),
        el("div", { class: "mute", style: { fontSize: "11.4px", marginTop: "4px" }, text: `z=${w.style.zIndex} · ${w._state.min ? "minimised" : "visible"} · ${Math.round(parseInt(w.style.width))}×${Math.round(parseInt(w.style.height))}` }),
        el("div", { style: { display: "flex", gap: "6px", marginTop: "10px" } },
          el("button", { class: "chip", text: w._state.min ? "Restore" : "Minimise", onclick: () => import("../wm.js").then((m) => w._state.min ? m.restore(w) : m.minimise(w)) }),
          el("button", { class: "chip", text: "Quit app", onclick: () => { closeApp(w._app); render(); } }))));
    }
  }

  /* --------------------------- live telemetry ---------------------------- */
  const tick = setInterval(() => {
    if (!document.body.contains(wrap)) return clearInterval(tick);
    const push = (k, v, cap) => { hist[k].push(Math.max(1, Math.min(cap, v))); hist[k].shift(); };
    push("cpu", hist.cpu.at(-1) + (Math.random() - .48) * 9, 96);
    push("ram", hist.ram.at(-1) + (Math.random() - .5) * 2.4, 92);
    push("net", 8 + Math.random() * 60, 100);
    push("disk", Math.random() * 30, 100);
    if (S.tab !== "tasks") render();
  }, 1600);

  render();
  return wrap;
}
