# THADD OS — Architecture

## 1. Big picture

```
                        ┌──────────────────────────────────────────┐
                        │              Railway / Cloud             │
                        │                                          │
  Browser ──HTTPS──────▶│  nginx (PORT)  ──▶  portal + noVNC       │
        │               │      │  WebSocket /websockify            │
        │               │      ▼                                   │
        │               │  websockify (127.0.0.1:6080)             │
        │               │      ▼                                   │
        │               │  Xvnc :1 ──▶ XFCE desktop (THADD user)   │
        │               │                                          │
  RDP client ──TCP─────▶│  xrdp (0.0.0.0:3389) ──▶ sesman          │
  (mstsc, FreeRDP…)     │      └──▶ per-login Xvnc ──▶ XFCE        │
                        │                                          │
                        │  supervisord: every service auto-restarts │
                        │  /home/thadd ← Railway volume (persists)  │
                        └──────────────────────────────────────────┘
```

## 2. Ports

| Port | Bind | Purpose |
|---|---|---|
| `$PORT` (Railway-provided) | 0.0.0.0 | nginx edge: portal, noVNC client, `/healthz`, `/api/creds`, WebSocket bridge |
| `3389` | 0.0.0.0 | xrdp — RDP for Microsoft Remote Desktop, Remmina, FreeRDP… |
| `6080` | 127.0.0.1 | websockify (WebSocket → RFB bridge) |
| `5901` | 127.0.0.1 | Xvnc `:1` — the persistent browser desktop |

The TCP proxy on Railway maps a public `host:port` to container port `3389`
(`RAILWAY_TCP_PROXY_DOMAIN` / `RAILWAY_TCP_PROXY_PORT`).

## 3. Process supervision (supervisord)

| Program | Role | Restart behaviour |
|---|---|---|
| `dbus` | system message bus | always |
| `nginx` | portal + edge | always |
| `websockify` | browser desktop bridge | always |
| `xrdp-sesman` | RDP session manager | always |
| `xrdp` | RDP protocol server | always |
| `thadd-desktop` | Xvnc `:1` + XFCE (persistent browser desktop) | always, as the THADD user |

Healthcheck (`/opt/thadd/healthcheck.sh`, also used as Docker `HEALTHCHECK`
and Railway's `healthcheckPath: /healthz`) verifies portal + RDP + desktop
renderer + xrdp every 30 s.

## 4. Session model

- **Browser users** share one **persistent desktop** (`Xvnc :1`, `-AlwaysShared`).
  Close the tab, reopen it — your session is still there, exactly as you left
  it. `noVNC`'s `reconnect=1` handles network hiccups automatically.
- **RDP users** log in through sesman (system auth) and get a session of their
  own; disconnecting keeps the session alive (`KillDisconnected=false`,
  `DisconnectedTimeLimit=0`) so reconnecting returns to the same desktop.
- Both paths launch the identical branded session via `/opt/thadd/session.sh`
  → `startxfce4`; the look is pixel-identical.

## 5. Identity, credentials, persistence

- The system reports itself as **THADD OS 1.0 (Nebula)** via `/etc/os-release`,
  `/etc/lsb-release`, `/etc/thadd-release`, MOTD and custom artwork
  (neofetch, `thadd` CLI, portal).
- Credentials are injected at boot: `THADD_USER` / `THADD_PASSWORD` /
  `THADD_ROOT_PASSWORD`. The VNC password file for the browser desktop is
  regenerated from `THADD_PASSWORD` on every boot, so both access paths
  always agree.
- `/home/thadd` is volume-backed. The `skel/` tree (desktop theme, dock,
  conky, shell) lives in the image at `/etc/skel`; the entrypoint seeds it
  into any fresh volume and never overwrites an existing home.
- The portal's `/api/creds` endpoint is regenerated at every boot so the web
  page always shows the *current* credentials.

## 6. Security model

| Layer | Control |
|---|---|
| RDP | xrdp TLS, `crypt_level=high`, NLA negotiation (`security_layer=negotiate`), system-account auth |
| Browser path | HTTPS at Railway's edge → nginx → websockify; VNC socket is localhost-only; RFB session is password-authenticated |
| Surface | The only internet-facing listeners are nginx and xrdp; everything else binds 127.0.0.1 |
| Secrets | No credentials baked into the image; all set via Railway variables at boot |
| Password policy | Defaults exist for instant demo; README directs changing them (the portal shows the live values) |

Recommendations: use a strong `THADD_PASSWORD`, consider Railway's private
networking if you don't need public RDP, and treat the TCP-proxy endpoint as
public infrastructure (bots do scan 3389).

## 7. Performance ("lightweight like Debian")

- Debian-slim base, XFCE (not GNOME/KDE), no snap/flatpak daemons.
- Measured budget: idle ≈ 300 MB; Firefox ESR ≈ +350–500 MB; btop/conky ≈ +30 MB.
- Optional self-managed swap (`SWAP_MB`, default 512, best-effort — silently
  skipped where the container runtime forbids `swapon`).
- `RESOLUTION` controls the persistent desktop size — 1600×900 is the sweet
  spot; drop to 1280×720 on a 512 MB plan.
- Xvnc at 24-bit depth with default compression; noVNC enables `resize=scale`
  so any browser window fits.

## 8. Failure & recovery ("works forever")

1. **Process level:** supervisord restarts any dead component instantly.
2. **Container level:** Docker `HEALTHCHECK` + Railway `/healthz` detect
   unhealthy states; `restartPolicyType: ON_FAILURE` redeploys the container
   (up to 10 retries).
3. **Data level:** the volume keeps `/home/thadd` across every restart,
   redeploy and even image upgrade; the entrypoint re-seeds only if missing.
4. **Session level:** noVNC reconnects automatically; RDP sessions survive
   disconnects.
5. **Human level:** `thadd doctor` diagnoses everything from inside.

## 9. CI verification design

`.github/workflows/thadd-os-ci.yml` builds the *same* Dockerfile Railway
builds, boots the OS, and exercises it end-to-end:

`docker build` → `docker run` → health wait → portal/HTTP checks →
WebSocket→RFB bridge check (the literal browser data path) → raw RDP
negotiation → **full FreeRDP login** → in-container desktop audit
(XFCE/Plank/xrdp) → screenshot committed to the repo as proof.

This means the artifact you deploy has already logged in and rendered its
desktop in public CI before it ever reaches Railway.
