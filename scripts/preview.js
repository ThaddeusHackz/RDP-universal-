#!/usr/bin/env node
/*
 * THADD OS — local portal preview server (zero dependencies).
 * Serves web/ plus mock /healthz and /api/creds endpoints so the portal can
 * be previewed before deploying. Usage:  node scripts/preview.js [port]
 */
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "web");
const PORT = Number(process.argv[2] || process.env.PORT || 8080);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

const creds = {
  os: "THADD OS",
  version: "1.0.0 (Nebula) — local preview",
  build: "local-preview",
  username: "thadd",
  password: "thadd",
  rdp_port: 3389,
  resolution: "1600x900",
  hint: "Local preview mode. Deploy to Railway for the full experience.",
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");

  if (url.pathname === "/healthz") {
    res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    return res.end(JSON.stringify({ status: "ok", service: "thadd-os", version: "1.0.0", mode: "preview" }));
  }
  if (url.pathname === "/api/creds") {
    res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    return res.end(JSON.stringify(creds, null, 2));
  }
  if (url.pathname === "/api/login-probe") {
    res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    return res.end(JSON.stringify({
      ready: true,
      user: creds.username,
      build: "local-preview",
      checked_at: new Date().toISOString(),
      reasons: [],
      mode: "preview",
    }, null, 2));
  }
  if (url.pathname === "/api/login-status") {
    res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    return res.end(JSON.stringify({
      user: creds.username,
      password_set: true,
      vnc_passwd: true,
      pam_hardened: true,
      pam_loginuid_required: false,
      xrdp_autorun_xvnc: true,
      xrdp_security_layer_tls: true,
      pamtester: "preview",
      ready: true,
      mode: "preview",
    }, null, 2));
  }

  let file = url.pathname === "/" ? "index.html" : url.pathname.replace(/^\/+/, "");
  file = path.normalize(file);
  const full = path.join(ROOT, file);
  if (!full.startsWith(ROOT) || !fs.existsSync(full) || !fs.statSync(full).isFile()) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    return res.end("Not found (preview mode — /vnc works after deploying)");
  }
  const ext = path.extname(full).toLowerCase();
  res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
  fs.createReadStream(full).pipe(res);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`THADD OS portal preview → http://0.0.0.0:${PORT}`);
});
