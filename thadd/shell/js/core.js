/* ============================================================================
   THADD OS — shell core: transport, state, helpers.
   Talks to the THADD userspace server over WebSocket (JSON-RPC-ish), with an
   automatic REST fallback for proxies that strip upgrades.
   ========================================================================== */
(function () {
  "use strict";

  const THADD = (window.THADD = window.THADD || {});
  THADD.version = "1.0";
  THADD.codename = "Nebula Prime";

  /* ------------------------------------------------------------------ events */
  const listeners = {};
  THADD.on = (evt, fn) => { (listeners[evt] = listeners[evt] || []).push(fn); return () => THADD.off(evt, fn); };
  THADD.off = (evt, fn) => { listeners[evt] = (listeners[evt] || []).filter((f) => f !== fn); };
  THADD.emit = (evt, data) => {
    (listeners[evt] || []).forEach((f) => { try { f(data); } catch (e) { console.error(e); } });
    (listeners["*"] || []).forEach((f) => { try { f(evt, data); } catch (e) {} });
  };

  /* --------------------------------------------------------------- transport */
  let ws = null, wsReady = false, seq = 0, reconnectTimer = null;
  const pending = new Map();
  const streams = new Map();
  const token = new URLSearchParams(location.search).get("token") || "";

  THADD.state = { config: {}, apps: [], windows: [], notifications: [], metrics: null, connected: false };

  function wsUrl() {
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${location.host}/ws${token ? "?token=" + token : ""}`;
  }

  function connect() {
    try { ws = new WebSocket(wsUrl()); } catch (e) { fallback(); return; }
    ws.onopen = () => {
      wsReady = true; THADD.state.connected = true;
      THADD.emit("transport", { connected: true });
      subscribe(["system.metrics", "shell.notify", "ai.audit", "snapshot.created", "settings.changed", "session.open"]);
    };
    ws.onmessage = (ev) => {
      let msg; try { msg = JSON.parse(ev.data); } catch (e) { return; }
      if (msg.event) { THADD.emit(msg.event, msg.data); return; }
      if (msg.stream) {
        const s = streams.get(msg.stream);
        if (s) { s.chunks.push(msg.data); s.onChunk(msg.data); }
        else THADD.emit("stream.chunk", { id: msg.stream, data: msg.data });
        return;
      }
      if (msg.stream_end) {
        const s = streams.get(msg.stream_end);
        if (s) { streams.delete(msg.stream_end); s.onEnd(msg.meta || {}); }
        else THADD.emit("stream.end", { id: msg.stream_end, meta: msg.meta || {} });
        return;
      }
      if (msg.id !== undefined && pending.has(msg.id)) {
        const { resolve, reject } = pending.get(msg.id);
        pending.delete(msg.id);
        msg.ok === false ? reject(msg.error || { message: "error" }) : resolve(msg.result);
      }
    };
    ws.onclose = () => {
      wsReady = false; THADD.state.connected = false;
      THADD.emit("transport", { connected: false });
      clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(connect, 1500);
    };
    ws.onerror = () => { fallback(); };
  }

  function fallback() {
    if (ws) { try { ws.close(); } catch (e) {} }
    THADD.emit("transport", { connected: false, mode: "rest" });
  }

  function subscribe(events) {
    if (wsReady) ws.send(JSON.stringify({ t: "subscribe", events }));
  }
  THADD.subscribe = subscribe;

  function raw(method, params) {
    return new Promise((resolve, reject) => {
      if (wsReady && ws.readyState === 1) {
        const id = ++seq;
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params: params || {} }));
        setTimeout(() => {
          if (pending.has(id)) { pending.delete(id); reject({ message: "timeout" }); }
        }, 240000);
      } else {
        fetch(`/api/${method}${token ? "?token=" + token : ""}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Thadd-Token": token },
          body: JSON.stringify(params || {}),
        }).then((r) => r.json()).then((data) => {
          if (data && data.ok === false) reject(data.error || { message: "error" });
          else resolve(data ? data.result : null);
        }).catch(reject);
      }
    });
  }

  const NO_STREAM = new Set([
    "shell.render_video", "shell.screenshot", "security.analyze_image", "security.scan",
  ]);

  THADD.call = async function (method, params) {
    if (NO_STREAM.has(method)) return raw(method, params);
    return raw(method, params);
  };

  /* --------------------------------------------------------- streaming calls */
  THADD.stream = function (method, params, handlers) {
    handlers = handlers || {};
    const localId = "s" + Math.random().toString(36).slice(2, 9);
    return raw(method, Object.assign({ stream_id: localId }, params || {})).then((res) => {
      streams.set(localId, {
        chunks: [],
        onChunk: (chunk) => {
          chunk.split("\n").filter(Boolean).forEach((line) => {
            let obj = null;
            try { obj = JSON.parse(line); } catch (e) { obj = { type: "raw", text: line }; }
            handlers.onEvent ? handlers.onEvent(obj) : handlers.onLine && handlers.onLine(line, obj);
          });
        },
        onEnd: (meta) => handlers.onEnd && handlers.onEnd(meta, streams.get(localId)?.chunks.join("") || ""),
      });
      return Object.assign({ streamId: localId }, res || {});
    });
  };

  /* ------------------------------------------------------------------ helpers */
  THADD.h = function (tag, attrs, ...children) {
    const el = document.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") el.className = v;
      else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
      else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
      else if (k === "html") el.innerHTML = v;
      else if (v !== null && v !== undefined && v !== false) el.setAttribute(k, v);
    }
    children.flat().forEach((c) => { if (c === null || c === undefined || c === false) return; el.append(c.nodeType ? c : document.createTextNode(String(c))); });
    return el;
  };
  const h = THADD.h;

  THADD.esc = (s) => String(s === null || s === undefined ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  THADD.md = function (text) {
    let out = THADD.esc(text || "");
    out = out.replace(/```([\s\S]*?)```/g, (m, code) => `<pre>${code.trim()}</pre>`);
    out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
    out = out.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
    out = out.replace(/^\s*[-*]\s+(.*)$/gm, "• $1");
    out = out.replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
    return out;
  };

  THADD.bytes = function (n) {
    n = Number(n) || 0;
    const u = ["B", "KB", "MB", "GB", "TB"];
    let i = 0;
    while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
    return `${n < 10 && i > 0 ? n.toFixed(1) : Math.round(n)} ${u[i]}`;
  };
  THADD.ago = function (ts) {
    const s = Math.max(1, Math.floor(Date.now() / 1000 - ts));
    if (s < 60) return `${s}s ago`;
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
  };
  THADD.clock = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  THADD.$ = (sel, root) => (root || document).querySelector(sel);
  THADD.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  THADD.toast = function (title, body, kind) {
    THADD.emit("shell.toast", { title, body, kind: kind || "info" });
  };

  THADD.icon = function (name) {
    const icons = {
      ai: "✦", files: "▤", terminal: "▶", code: "⌘", shield: "⛨", browser: "◕", store: "⤓",
      settings: "⚙", history: "⟲", monitor: "◈", record: "◉", play: "▶", note: "≡", calendar: "▦",
      calculator: "∑", activity: "▦", forensics: "⌗", powershell: ">_", firefox: "🦊", chrome: "◉",
      git: "⑂", container: "⬢", vm: "▣", windows: "⊞", wine: "🍷", music: "♪", video: "▶",
      camera: "📷", image: "▣", vector: "◇", office: "▤", help: "?", info: "ⓘ", network: "≈",
      spider: "❋", target: "◎", radar: "◉", binary: "⌁", text: "≡", archive: "🗜",
    };
    return icons[name] || "◆";
  };

  THADD.startHeartbeat = function () {
    setInterval(() => {
      if (THADD.state.connected && ws && ws.readyState === 1) ws.send(JSON.stringify({ t: "ping" }));
    }, 25000);
  };

  connect();
  THADD.connect = connect;
  window.addEventListener("beforeunload", () => { if (ws) ws.close(); });
})();
