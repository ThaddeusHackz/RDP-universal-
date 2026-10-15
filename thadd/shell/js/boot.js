/* ============================================================================
   THADD OS — boot sequence, wallpaper, session glue.
   ========================================================================== */
(function () {
  "use strict";
  const h = THADD.h;

  const STAGES = [
    "initialising THADD userspace",
    "connecting to the OS service (ws)",
    "loading apps and settings",
    "starting the shell (Nebula Prime)",
    "security services online",
  ];

  function bootSplash() {
    const stages = h("div", { class: "stages" });
    const bar = h("div", { class: "bar" }, h("i", { style: { width: "0%" } }));
    const el = h("div", { id: "boot" },
      h("div", { style: { textAlign: "center" } },
        h("div", { class: "logo" }, "THADD OS"),
        h("div", { style: { color: "var(--dim)", fontSize: "13px", marginTop: "6px" } }, "One OS. All the Best."),
        bar, stages));
    document.body.append(el);
    let i = 0;
    const timer = setInterval(() => {
      if (i < STAGES.length) {
        stages.append(h("div", {}, "✔ " + STAGES[i]));
        bar.firstChild.style.width = (((i + 1) / STAGES.length) * 100) + "%";
        i++;
      } else {
        clearInterval(timer);
        el.classList.add("done");
        setTimeout(() => el.remove(), 700);
      }
    }, 320);
  }

  function lockScreen() {
    const input = h("input", { type: "password", placeholder: "password (any — this is your session)", id: "lock-pass" });
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") THADD.wm.unlock(); });
    const el = h("div", { id: "lock" },
      h("div", { class: "inner" },
        h("div", { class: "time", id: "lock-time" }, THADD.clock()),
        h("div", { class: "date" }, new Date().toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" })),
        h("div", { class: "avatar" }, "TH"),
        h("div", { style: { marginBottom: "14px", fontWeight: "600" } }, "thadd"),
        input,
        h("div", { style: { marginTop: "16px", color: "var(--dim)", fontSize: "12px" } }, "Press ↵ to unlock · ⌘L locks again")));
    document.body.append(el);
    const unlockBtn = h("button", { class: "btn primary", style: { marginTop: "14px" } }, "Unlock");
    unlockBtn.onclick = () => THADD.wm.unlock();
    el.querySelector(".inner").append(unlockBtn);
  }

  async function setWallpaper(name) {
    const el = THADD.$("#wallpaper");
    if (!el) return;
    try {
      const r = await THADD.call("shell.wallpaper", { name });
      const url = r.path && r.path.startsWith("/") ? `/api/fs.read?path=${encodeURIComponent(r.path)}&binary=1` : r.path;
      const img = new Image();
      img.onload = () => { el.style.backgroundImage = `url("${url}")`; el.style.opacity = "1"; };
      img.onerror = () => { el.style.backgroundImage = "linear-gradient(140deg,#0a0c16,#1d2150 45%,#4c2f8f 75%,#d855b0)"; };
      img.src = url;
    } catch (err) {
      el.style.backgroundImage = "linear-gradient(140deg,#0a0c16,#1d2150 45%,#4c2f8f 75%,#d855b0)";
    }
  }

  async function start() {
    bootSplash();
    const wp = h("div", { id: "wallpaper" });
    const vig = h("div", { id: "vignette" });
    const desktop = THADD.$("#desktop");
    desktop.append(wp, vig);
    THADD.on("wallpaper.set", (name) => setWallpaper(name));
    try {
      await THADD.wm.build();
      await setWallpaper((THADD.state.config.appearance || {}).wallpaper || "thadd-nebula");
    } catch (err) {
      console.error(err);
      THADD.toast("Shell startup", "Could not reach the OS service — retrying. " + (err.message || err), "error");
      setTimeout(start, 2000);
      return;
    }
    lockScreen();
    THADD.startHeartbeat();

    // first-run tour
    try {
      const fr = await THADD.call("shell.first_run", {});
      if (!fr.state.completed) {
        setTimeout(() => THADD.apps.open("welcome"), 1200);
        THADD.call("shell.first_run", { complete: true }).catch(() => {});
      }
    } catch (e) {}

    // keyboard shortcut hint + idle lock
    let idle = 0;
    setInterval(() => {
      idle += 30;
      const cfg = THADD.state.config || {};
      const lockAfter = (cfg.security || {}).lock_after_minutes || 30;
      if (idle / 60 >= lockAfter) { THADD.wm.lock(); idle = 0; }
    }, 30000);
    ["mousemove", "keydown", "mousedown", "wheel"].forEach((evt) =>
      window.addEventListener(evt, () => { idle = 0; }, { passive: true }));

    THADD.emit("boot.complete", THADD.state);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
