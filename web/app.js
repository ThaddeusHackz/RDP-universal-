/* THADD OS portal — live status + credentials */
(function () {
  "use strict";

  var dot = document.getElementById("statusDot");
  var text = document.getElementById("statusText");

  function setStatus(state, label) {
    dot.className = "dot " + state;
    text.textContent = label;
  }

  function refreshStatus() {
    fetch("/healthz", { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
      .then(function () { setStatus("ok", "All systems operational"); })
      .catch(function () { setStatus("bad", "Starting up…"); });
  }

  /* live credentials (regenerated at every boot) */
  fetch("/api/creds", { cache: "no-store" })
    .then(function (r) { return r.json(); })
    .then(function (c) {
      document.getElementById("rdpUser").textContent = c.username || "thadd";
      document.getElementById("rdpPass").textContent = c.password || "thadd";
      document.getElementById("rdpPort").textContent = c.rdp_port || 3389;
      var tag = document.getElementById("buildTag");
      if (tag && c.build) { tag.textContent = c.build; }
    })
    .catch(function () { /* portal may run standalone; keep defaults */ });

  fetch("/api/login-status", { cache: "no-store" })
    .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
    .then(function (s) {
      if (s && s.ready === false) {
        setStatus("bad", "Login path not ready — check thadd doctor");
      }
    })
    .catch(function () { /* endpoint is optional on the local preview server */ });

  /* live self-test: does THIS instance accept the credentials right now? */
  function refreshProbe() {
    fetch("/api/login-probe", { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
      .then(function (p) {
        var banner = document.getElementById("loginBanner");
        var msg = document.getElementById("loginBannerMsg");
        if (!banner) { return; }
        if (p && p.ready === false) {
          if (msg) { msg.textContent = (p.reasons || []).join(" "); }
          banner.hidden = false;
          setStatus("bad", "Login probe failing — see banner");
        } else if (p && p.ready === true) {
          banner.hidden = true;
        }
      })
      .catch(function () { /* older builds lack the probe; login-status covers them */ });
  }
  refreshProbe();
  setInterval(refreshProbe, 30000);

  document.getElementById("copyBtn").addEventListener("click", function () {
    var user = document.getElementById("rdpUser").textContent;
    var pass = document.getElementById("rdpPass").textContent;
    var port = document.getElementById("rdpPort").textContent;
    var data = "Host: (Railway TCP-proxy domain)\nPort: " + port + "\nUsername: " + user + "\nPassword: " + pass;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(data).then(function () {
        document.getElementById("copyBtn").textContent = "Copied ✓";
        setTimeout(function () { document.getElementById("copyBtn").textContent = "Copy credentials"; }, 1600);
      });
    }
  });

  refreshStatus();
  setInterval(refreshStatus, 10000);
})();
