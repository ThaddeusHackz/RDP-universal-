# =============================================================================
#  THADD OS — root Dockerfile
# =============================================================================
#  The cloud edition of THADD OS lives in cloud/ (Dockerfile, entrypoint, skel,
#  web, config). This root file exists so a plain `docker build .` — including
#  the repository's long-standing CI workflow — keeps building the SAME image
#  without anyone having to know the internal layout.
#
#      docker build -t thadd-os .          # identical to: docker build -t thadd-os cloud/
#
#  For the bootable ISO (the real OS), see iso/build.sh.
# =============================================================================
# =============================================================================
#  THADD OS — "One OS. All the Best."
#  A universal Linux desktop that lives in the cloud.
#
#   • Browser access — noVNC portal on the Railway web port ($PORT)
#   • Native RDP      — xrdp on 3389 (Microsoft Remote Desktop compatible)
#   • Lightweight     — Debian 12 + XFCE: idles ~300 MB RAM, runs a browser
#   • Self-healing    — healthchecks, auto-restart, persistent home volume
#
#  Deploy on Railway.com: point a service at this repo (Dockerfile builder)
#  and it just works. See README.md for the 5-minute guide.
# =============================================================================

FROM debian:12-slim

LABEL org.opencontainers.image.title="THADD OS" \
      org.opencontainers.image.description="Universal lightweight Linux desktop — browser + RDP access" \
      org.opencontainers.image.version="1.0.0"

# NOTE: credentials (THADD_PASSWORD / THADD_ROOT_PASSWORD) are intentionally
# NOT baked in as ENV — BuildKit flags SecretsUsedInArgOrEnv and they would
# leak into image metadata. The entrypoint supplies runtime defaults instead.
ENV DEBIAN_FRONTEND=noninteractive \
    LANG=C.UTF-8 \
    LC_ALL=C.UTF-8 \
    THADD_USER=thadd \
    RESOLUTION=1600x900 \
    PORT=8080 \
    SWAP_MB=512

# ---------------------------------------------------------------------------
# Layer 1 — base utilities, security tools and system monitors
# ---------------------------------------------------------------------------
RUN apt-get update && apt-get install -y --no-install-recommends \
      sudo ca-certificates curl wget git unzip xz-utils zip less \
      procps iproute2 openssl gettext-base xauth vim nano \
      htop btop bat neofetch duf \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# ---------------------------------------------------------------------------
# Layer 2 — THADD OS desktop: XFCE (Debian-light) dressed in the best of
#           every desktop Linux (Arc-Dark, Papirus, Plank, Inter, conky)
# ---------------------------------------------------------------------------
RUN apt-get update && apt-get install -y \
      dbus dbus-x11 \
      xfce4 xfce4-goodies xfce4-whiskermenu-plugin xfce4-pulseaudio-plugin \
      plank arc-theme papirus-icon-theme fonts-inter fonts-jetbrains-mono \
      fonts-noto-color-emoji breeze-cursor-theme conky-all \
      pulseaudio xkb-data \
      mousepad ristretto file-roller gvfs \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# ---------------------------------------------------------------------------
# Layer 3 — remote access stack:
#   xrdp (RDP server) · TigerVNC (desktop renderer) · noVNC + websockify
#   (browser desktop) · nginx (portal/edge) · supervisor (orchestrator)
# ---------------------------------------------------------------------------
# tigervnc-tools is CRITICAL: it owns `vncpasswd`, which the entrypoint uses
# to provision the browser-desktop password. On Debian 12 the package is only
# a Recommends of tigervnc-standalone-server, so --no-install-recommends drops
# it — without it the entrypoint crashed with "vncpasswd: command not found".
# pamtester lets the entrypoint / CI prove that xrdp-sesman will accept the
# username+password *before* a client ever connects (catches the classic
# container pam_loginuid "login failed for display 0" bug).
RUN apt-get update && apt-get install -y --no-install-recommends \
      xrdp tigervnc-standalone-server tigervnc-common tigervnc-tools \
      novnc websockify \
      nginx supervisor \
      firefox-esr \
      pamtester \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Starship shell prompt (best-effort; .bashrc falls back to a branded PS1)
RUN curl -fsSL https://starship.rs/install.sh | sh -s -- -y || true

# ---------------------------------------------------------------------------
# THADD OS identity — the system reports itself as THADD OS everywhere
# ---------------------------------------------------------------------------
# Build fingerprint: lets the portal / API / `thadd doctor` prove which image
# a running deployment is on, so a stale (pre-fix) build can never masquerade
# as the fixed one ("credentials fail" while the fix never actually shipped).
RUN date -u +%Y-%m-%dT%H:%M:%SZ > /etc/thadd-build
COPY cloud/config/os-release /etc/os-release
COPY cloud/config/lsb-release /etc/lsb-release
COPY cloud/config/thadd-release /etc/thadd-release
COPY cloud/config/thadd-motd /etc/motd

# ---------------------------------------------------------------------------
# Remote-access configuration (sed patches are no-ops on unknown keys, so
# they are safe across xrdp versions)
# ---------------------------------------------------------------------------
RUN sed -i \
      -e 's/^MaxSessions=.*/MaxSessions=4/' \
      -e 's/^KillDisconnected=.*/KillDisconnected=false/' \
      -e 's/^IdleTimeLimit=.*/IdleTimeLimit=0/' \
      -e 's/^DisconnectedTimeLimit=.*/DisconnectedTimeLimit=0/' \
      /etc/xrdp/sesman.ini \
 && sed -i \
      -e 's/^max_bpp=.*/max_bpp=32/' \
      -e 's/^crypt_level=.*/crypt_level=high/' \
      -e 's/^security_layer=.*/security_layer=negotiate/' \
      /etc/xrdp/xrdp.ini \
 && (xrdp-keygen xrdp /etc/xrdp/rsakeys.ini >/dev/null 2>&1 || true) \
 && rm -f /etc/nginx/sites-enabled/default \
 && mkdir -p /opt/thadd/web /usr/share/backgrounds/thadd-os

COPY cloud/config/supervisord.conf        /etc/supervisor/supervisord.conf
COPY cloud/config/thadd.conf               /etc/supervisor/conf.d/thadd.conf
COPY cloud/config/nginx.conf.template      /etc/nginx/sites-available/thadd.conf.template
COPY cloud/config/startwm.sh               /etc/xrdp/startwm.sh
COPY cloud/config/startwm.sh               /opt/thadd/startwm.sh
COPY cloud/config/session.sh               /opt/thadd/session.sh
COPY cloud/config/welcome.sh               /opt/thadd/welcome.sh
COPY cloud/config/run-vnc.sh               /opt/thadd/run-vnc.sh
COPY cloud/config/healthcheck.sh           /opt/thadd/healthcheck.sh
COPY cloud/config/harden-rdp.sh            /opt/thadd/harden-rdp.sh
COPY cloud/config/login-probe.sh           /opt/thadd/login-probe.sh
COPY cloud/config/xrdp.ini                 /opt/thadd/xrdp.ini
COPY cloud/config/sesman.ini               /opt/thadd/sesman.ini
COPY cloud/config/pam-xrdp-sesman          /opt/thadd/pam-xrdp-sesman
COPY cloud/config/xrdp.ini                 /etc/xrdp/xrdp.ini
COPY cloud/config/sesman.ini               /etc/xrdp/sesman.ini
COPY cloud/config/pam-xrdp-sesman          /etc/pam.d/xrdp-sesman
COPY cloud/config/thadd                    /usr/local/bin/thadd
COPY cloud/config/thadd-apps/              /usr/share/applications/

RUN chmod +x /etc/xrdp/startwm.sh /opt/thadd/session.sh /opt/thadd/welcome.sh \
             /opt/thadd/run-vnc.sh /opt/thadd/healthcheck.sh \
             /opt/thadd/harden-rdp.sh /opt/thadd/login-probe.sh \
             /opt/thadd/startwm.sh /usr/local/bin/thadd

COPY cloud/web/                  /opt/thadd/web/
COPY assets/wallpapers/    /usr/share/backgrounds/thadd-os/

# ---------------------------------------------------------------------------
# The default user profile — everything inside skel/ becomes the desktop
# experience (panels, themes, dock, conky, terminal, neofetch, shell).
# It is also re-seeded into Railway volumes at boot (see entrypoint).
# ---------------------------------------------------------------------------
COPY cloud/skel/ /etc/skel/

RUN useradd -m -s /bin/bash -G sudo "${THADD_USER}" 2>/dev/null || true \
 && echo "${THADD_USER} ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/zz-thadd \
 && chmod 440 /etc/sudoers.d/zz-thadd \
 && touch "/home/${THADD_USER}/.thadd-seeded" \
 && chown -R "${THADD_USER}:${THADD_USER}" "/home/${THADD_USER}"

COPY cloud/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 3389 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=5 \
  CMD /opt/thadd/healthcheck.sh

CMD ["/entrypoint.sh"]
