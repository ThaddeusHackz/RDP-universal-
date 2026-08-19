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
RUN apt-get update && apt-get install -y --no-install-recommends \
      xrdp tigervnc-standalone-server tigervnc-common tigervnc-tools \
      novnc websockify \
      nginx supervisor \
      firefox-esr \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Starship shell prompt (best-effort; .bashrc falls back to a branded PS1)
RUN curl -fsSL https://starship.rs/install.sh | sh -s -- -y || true

# ---------------------------------------------------------------------------
# THADD OS identity — the system reports itself as THADD OS everywhere
# ---------------------------------------------------------------------------
COPY config/os-release /etc/os-release
COPY config/lsb-release /etc/lsb-release
COPY config/thadd-release /etc/thadd-release
COPY config/thadd-motd /etc/motd

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

COPY config/supervisord.conf        /etc/supervisor/supervisord.conf
COPY config/thadd.conf               /etc/supervisor/conf.d/thadd.conf
COPY config/nginx.conf.template      /etc/nginx/sites-available/thadd.conf.template
COPY config/startwm.sh               /etc/xrdp/startwm.sh
COPY config/session.sh               /opt/thadd/session.sh
COPY config/welcome.sh               /opt/thadd/welcome.sh
COPY config/run-vnc.sh               /opt/thadd/run-vnc.sh
COPY config/healthcheck.sh           /opt/thadd/healthcheck.sh
COPY config/thadd                    /usr/local/bin/thadd
COPY config/thadd-apps/              /usr/share/applications/

RUN chmod +x /etc/xrdp/startwm.sh /opt/thadd/session.sh /opt/thadd/welcome.sh \
             /opt/thadd/run-vnc.sh /opt/thadd/healthcheck.sh /usr/local/bin/thadd

COPY web/                  /opt/thadd/web/
COPY assets/wallpapers/    /usr/share/backgrounds/thadd-os/

# ---------------------------------------------------------------------------
# The default user profile — everything inside skel/ becomes the desktop
# experience (panels, themes, dock, conky, terminal, neofetch, shell).
# It is also re-seeded into Railway volumes at boot (see entrypoint).
# ---------------------------------------------------------------------------
COPY skel/ /etc/skel/

RUN useradd -m -s /bin/bash -G sudo "${THADD_USER}" 2>/dev/null || true \
 && echo "${THADD_USER} ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/zz-thadd \
 && chmod 440 /etc/sudoers.d/zz-thadd \
 && touch "/home/${THADD_USER}/.thadd-seeded" \
 && chown -R "${THADD_USER}:${THADD_USER}" "/home/${THADD_USER}"

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 3389 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=5 \
  CMD /opt/thadd/healthcheck.sh

CMD ["/entrypoint.sh"]
