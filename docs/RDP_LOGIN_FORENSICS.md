# THADD OS — RDP credential login forensics

**Scan date:** 2026-08-19
**Question:** *Why can't I log into the OS with the RDP credentials?*
**Disposition:** every failure mode below is now fixed in this tree.

> **Follow-up (2026-08-19, same day):** a final, deeper pass — upstream
> xrdp 0.9.19 source verification, CI archaeology, and a live-deployment
> gap analysis — found four more defects *around* the login chain (dead CI
> gate, unhealed stale volumes, invisible stale builds, silent failures).
> See [`FORENSIC_SCAN_FINAL.md`](FORENSIC_SCAN_FINAL.md).

---

## 0. Executive summary

The portal printed a username and a password. Port 3389 was open. The
healthcheck was green. CI had a green badge. And yet a real login with
those credentials failed — or appeared to succeed while rendering a
**black screen**.

That is not one bug. It is a stack of independently fatal defects that
all present as "wrong password":

| # | Defect | What the user sees | Severity |
|---|---|---|---|
| 1 | Debian `xrdp-sesman` PAM marks `pam_loginuid.so` **required** | `login failed for display 0` with the *correct* password | **Critical** |
| 2 | Default xrdp session is **Xorg**; `xorgxrdp` is not installed | "some problem" / black session after auth | **Critical** |
| 3 | `security_layer=negotiate` advertises NLA/HYBRID that Debian xrdp cannot finish | Microsoft Remote Desktop: authentication error | **High** |
| 4 | CI treated "FreeRDP still running" + a 2 KB black JPEG as proof | False green; the bug shipped | **High** |
| 5 | Portal told users to type a **username** into noVNC (password-only) | Browser desktop rejects the "credentials" | **High** |
| 6 | `su` without a guaranteed `HOME` could write `~/.vnc/passwd` under `/root` | noVNC rejects the correct password | **High** |
| 7 | `/api/creds` was raw-interpolated JSON | Passwords with `"`, `\`, newlines broke the portal | **Medium** |
| 8 | Account left locked (`!` in shadow) if `chpasswd` raced | Every login rejected | **Medium** |
| 9 | `wait-health.sh` only curled a static nginx 200 | Tests raced a half-booted OS | **Medium** |
| 10 | Default password on the portal was `••••••` until JS loaded | Users typed the bullets | **Low** |

Composite pre-fix score: **the credentials were never the problem.**

---

## 1. Method

The investigation walked the exact path a credential takes:

```
portal /api/creds
        │
        ├─ browser ─► /desktop.html ─► websockify ─► Xvnc :1  (-rfbauth ~/.vnc/passwd)
        │
        └─ mstsc / FreeRDP
                │
                ▼
           xrdp :3389   (TLS handshake, security_layer)
                │
                ▼
           xrdp-sesman :3350
                │
                ▼
           PAM service `xrdp-sesman`
                │  auth  → pam_unix (shadow)
                │  acct  → pam_unix
                │  session → pam_loginuid  ← dies in a container
                ▼
           Xvnc :10+  (or Xorg, if that was the selected module)
                ▼
           /etc/xrdp/startwm.sh → /opt/thadd/session.sh → startxfce4
```

Every hop was checked against the Debian 12 packaged defaults, the
image we actually ship, the CI that claimed to log in, and the 2 721-byte
black JPEG at `ci/thadd-os-screenshot.jpg`.

---

## 2. Finding 1 — PAM `pam_loginuid` (the smoking gun)

Debian's `/etc/pam.d/xrdp-sesman` contains:

```
session    include      common-session
session    required     pam_loginuid.so
```

Inside Docker and Railway, `/proc/self/loginuid` is already set (or is
immutable). `pam_loginuid` returns `PAM_SESSION_ERR`. Because the module
is **required**, the whole session setup fails.

xrdp-sesman then reports:

```
login failed for display 0
```

The password check (`pam_unix` in the `auth` stack) has **already
succeeded**. The user is told their credentials are wrong. They are not.

**Fix:** ship `config/pam-xrdp-sesman` with `session optional pam_loginuid.so`
and no `pam_systemd`. Re-install it on every boot from `/opt/thadd/` so
an apt conffile cannot silently restore the packaged file. `harden-rdp.sh`
also `sed`s any leftover `session required pam_loginuid` just in case.

`pamtester` is now in the image. Boot + CI run:

```
pamtester xrdp-sesman "$THADD_USER" authenticate authtok="$THADD_PASSWORD"
pamtester xrdp-sesman "$THADD_USER" authenticate acct_mgmt open_session close_session authtok="..."
```

Correct password must pass; a wrong password must fail; opening a session
must pass. That is the first time this repo has ever *proven* the
credentials work.

---

## 3. Finding 2 — Xorg is the default session, and it is not installed

Debian's `xrdp.ini` lists `[Xorg]` first (`lib=libxup.so`). The image
never installs `xorgxrdp` (Xorg in a non-privileged container is a
losing fight; TigerVNC is the right backend). FreeRDP / mstsc therefore
selected a backend whose binary does not exist.

**Fix:** ship `config/xrdp.ini` with **only** `[Xvnc]`, `autorun=Xvnc`,
`port=-1` (sesman PAM + freshly spawned Xvnc) and `delay_ms=2000` so
libvnc.so does not connect before Xvnc binds.

---

## 4. Finding 3 — `security_layer=negotiate` vs Windows NLA

`negotiate` lets the client ask for `SSL | HYBRID`. Windows 10/11
Remote Desktop will pick HYBRID (CredSSP / NLA). Debian's xrdp is not
built with NeutrinoRDP and cannot complete that handshake. Result: an
authentication error *before* PAM ever sees the password.

**Fix:** `security_layer=tls`. The CI raw-RDP probe still requests
`SSL|HYBRID`; the server now selects SSL and the probe stays green.
FreeRDP is invoked with `/sec:tls`. Users must accept the self-signed
certificate generated at boot — that warning is expected.

---

## 5. Finding 4 — CI never actually logged in

Three independent false greens:

1. `scripts/ci/wait-health.sh` only curled nginx's static `/healthz`.
   nginx is up seconds before Xvnc, sesman, or the password file exist.
2. `scripts/ci/rdp-login.sh` started FreeRDP, slept 25 s, and passed if
   the process was still alive. A cert dialog, a login-failed banner,
   or a black window all keep the process alive.
3. The "desktop session audit" grepped for `xfce4-session` / `Xvnc` /
   `plank` — those processes belong to the **browser** desktop
   (`thadd-desktop` on `:1`), not to the RDP session (sesman starts
   `:10+`).
4. The committed "proof" screenshot (`ci/thadd-os-screenshot.jpg`) is a
   **2 721-byte black JPEG**.

**Fix:**

- `wait-health.sh` now also requires port 3389, `xrdp`, `xrdp-sesman`,
  Xvnc, a real shadow hash, and `~/.vnc/passwd`.
- `scripts/ci/test_login.py` is a new gate: shadow, PAM, xrdp.ini,
  VNC passwd, tsusers, pamtester accept/reject, `/api/creds`,
  `/api/login-status`.
- `rdp-login.sh` now requires a sesman `login successful` / `created
  session` line, `/sec:tls`, no FreeRDP `ERRCONNECT`, and a screenshot
  of at least 8 KB (the black frame is 2.7 KB).

---

## 6. Finding 5 — browser path asked for a username that does not exist

noVNC's RFB `VncAuth` has a **password**, not a username. The portal
said *"Enter the username & password shown below when prompted."*
Users typed `thadd` into the password box when they had changed
`THADD_PASSWORD`, or typed the username into a field that only
accepts the VNC password.

The default HTML password was also the placeholder `••••••` — if
`/api/creds` failed to load, that is what got copied.

**Fix:** `/desktop.html` fetches `/api/creds` and drives the noVNC
RFB API with the password. One click, no prompt. The portal hint now
says so. The HTML fallback password is `thadd`, matching the real
default.

---

## 7. Finding 6 — VNC password file written to the wrong home

`vncpasswd -f` was launched under `su -s /bin/bash "$THADD_USER" -c
'... > "$HOME/.vnc/passwd"'`. Non-login `su` on some util-linux
builds keeps the caller's `HOME` (`/root`). Xvnc then started with
`-rfbauth /home/thadd/.vnc/passwd`, which did not exist, and
noVNC rejected every password.

**Fix:** `vncpasswd -f` is a stdin→stdout filter. The entrypoint now
writes `$HOME_DIR/.vnc/passwd` as root and `chown`s it. No `su`, no
`HOME` leak.

---

## 8. Remaining hardening (defense in depth)

| Control | Where |
|---|---|
| `chpasswd` via `printf` (passwords with `:`, `\`, `-n` survive) | `entrypoint.sh` |
| `passwd -u` + `chage -E -1` so a locked/expired account cannot reject a good password | `harden-rdp.sh` |
| `groupadd tsusers` + `usermod -aG tsusers` even though `AlwaysGroupCheck=false` | `harden-rdp.sh` |
| JSON-escaped `/api/creds` and `/api/login-status` | `entrypoint.sh`, `harden-rdp.sh` |
| `/tmp/.X11-unix` mode 1777, leftover xrdp pidfiles removed, `/etc/nologin` deleted | `harden-rdp.sh` |
| dbus `machine-id` generated if missing (black XFCE without it) | `harden-rdp.sh` |
| Healthcheck fails if the shadow hash is `!`/`*` or the VNC passwd is missing | `config/healthcheck.sh` |
| `thadd doctor` checks PAM, autorun, TLS, tsusers, pamtester | `config/thadd` |

---

## 9. How to verify after deploy

```bash
# inside the running OS
thadd doctor
cat /opt/thadd/login-status.json
pamtester xrdp-sesman "$USER" authenticate          # type the password

# from the portal
curl -fsS https://<host>/api/login-status
curl -fsS https://<host>/api/creds

# from any RDP client
#   host     = Railway TCP-proxy domain (or localhost)
#   port     = Railway TCP-proxy port   (or 3389)
#   username = value of THADD_USER      (default thadd)
#   password = value of THADD_PASSWORD  (default thadd)
#   accept the self-signed certificate
```

`/api/login-status` must report `"ready": true` and
`"pam_loginuid_required": false` before any client is expected to work.

---

## 10. Investigator verdict

The credentials were correct. The operating system was not prepared to
accept them. The login path is now hardened at PAM, xrdp, sesman, VNC,
the portal, the healthcheck and CI, and the next green badge has to
mean a real sesman `login successful` — not a black frame.
