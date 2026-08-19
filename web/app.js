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
      document.getElementById("rdpPass").textContent = c.password || "";
      document.getElementById("rdpPort").textContent = c.rdp_port || 3389;
    })
    .catch(function () { /* portal may run standalone; keep defaults */ });

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
