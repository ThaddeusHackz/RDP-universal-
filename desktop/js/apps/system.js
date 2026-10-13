/* =============================================================================
 * THADD OS 2.0 — apps/system.js
 * System utilities: Network, Disk Utility, Users & Groups, Power, Boot Manager
 * (the multi-OS picker the user asked for), Trash, Accessibility, Screenshot.
 * ========================================================================== */

import { $, el, store, vfs, toast, contextMenu, copy, bus, sleep, fmtBytes } from "../core.js";
import { build as screenshotBuild } from "./screenshot.js";

export function build(args = {}, win, meta) {
  const id = win._app;
  const F = { network, disks, users, power, bootpicker, trash, recorder: accessibility, screenshot: () => screenshotBuild(args, win, meta) }[id] || fallback;
  return F(args, win, meta);
}

function fallback(args, win, meta) {
  const w = el("div", { class: "pad" });
  w.append(el("div", { class: "st-h", text: meta?.name || win._title }), el("div", { class: "st-sub", text: meta?.desc || "" }),
    el("div", { class: "st-card", text: "Native THADD OS component — simulated in the browser edition." }));
  return w;
}

/* --------------------------------- network -------------------------------- */
function network() {
  const w = el("div", { class: "pad" });
  w.append(el("div", { class: "st-h", text: "Network" }),
    el("div", { class: "st-sub", text: "NetworkManager 1.46 · DoH + DNSSEC · per-app firewall · geoip rules" }));
  const toggle = (label, sub, on) => {
    const sw = el("div", { class: "switch" + (on ? " on" : "") }, el("i"));
    sw.addEventListener("click", () => { sw.classList.toggle("on"); toast("Network", `${label} → ${sw.classList.contains("on") ? "on" : "off"}`, { icon: "📶" }); });
    return el("div", { class: "st-row" }, el("div", { class: "lbl" }, el("div", { class: "t", text: label }), el("div", { class: "s", text: sub })), sw);
  };
  w.append(el("div", { class: "st-card" },
    el("div", { style: { fontWeight: "700", marginBottom: "6px" }, text: "Interfaces" }),
    el("pre", { class: "mono", style: { fontSize: "12px", color: "var(--text-dim)", whiteSpace: "pre-wrap" },
      text: "wlan0   802.11ax   THADD-NET-6E    1.2 Gb/s   5 GHz   WPA2/3   connected\neth0    1000 Mb/s   VirtualBox NAT  1.0 Gb/s   —       —        connected\nthadd0  WireGuard   HTB-Lab         10.10.14.7  —       —        for lab work\nlo      loopback    —               —           —       —        up" })),
    el("div", { class: "st-card", style: { marginTop: "12px" } },
      el("div", { style: { fontWeight: "700", marginBottom: "6px" }, text: "Privacy" }),
      toggle("DNS-over-HTTPS", "1.1.1.1 + 9.9.9.9 (quad9), DNSSEC validating, ECS stripped", true),
      toggle("Per-app firewall", "Block non-browser apps from the WAN except allow-listed", true),
      toggle("GeoIP block", "Drop inbound from CN, RU, KP, IR", true),
      toggle("MAC randomisation", "Rotate hardware address on every association", true),
      toggle("Captive-portal detection", "Auto-detect and route to sign-in", true)),
    el("div", { class: "st-card", style: { marginTop: "12px" } },
      el("div", { style: { fontWeight: "700", marginBottom: "6px" }, text: "Speed test" }),
      el("button", { class: "btn primary", text: "Run speed test", onclick: async (e) => {
        e.target.textContent = "Testing…";
        await sleep(1200);
        e.target.textContent = "Run speed test";
        toast("Speed test", "42.1 Mb/s ↓ · 18.4 Mb/s ↑ · 12 ms latency (Accra → London)", { icon: "🚀" });
      } })));
  return w;
}

/* ---------------------------------- disks --------------------------------- */
function disks() {
  const w = el("div", { class: "pad" });
  w.append(el("div", { class: "st-h", text: "Disk Utility" }), el("div", { class: "st-sub", text: "nvme0n1 + sda · SMART healthy · LUKS2 + ZFS" }));
  for (const [name, size, used, fs, mount] of [["nvme0n1p1", "256 GB", "21 GB", "ext4 (LUKS2 + TPM2)", "/vault"], ["sda2", "511 GB", "38 GB", "ext4", "/"], ["sda3", "2 TB", "118 GB", "ZFS (mirror)", "/home"], ["sda1", "512 MB", "6 MB", "vfat", "/boot/efi"]]) {
    const pct = Math.round(parseFloat(used) / parseFloat(size) * 100);
    w.append(el("div", { class: "st-card" },
      el("div", { style: { display: "flex", justifyContent: "space-between" } },
        el("b", { text: `${name} — ${size}` }), el("span", { class: "mono mute", text: `${pct}% used · ${fs} · ${mount}` })),
      el("div", { class: "bar2" }, el("i", { style: { width: pct + "%" } })),
      el("div", { style: { display: "flex", gap: "8px", marginTop: "10px" } },
        el("button", { class: "chip", text: "Verify", onclick: () => toast("Verify", `${name}: 0 bad blocks · SMART 100%`, { icon: "💽" }) }),
        el("button", { class: "chip", text: "Encrypt", onclick: () => toast("LUKS2", `${name}: argo2id, 512 MB memory cost, TPM2 sealed`, { icon: "🔐" }) }),
        el("button", { class: "chip", text: "Snapshot (ZFS)", onclick: () => toast("Snapshot", `thadd-${new Date().toISOString().slice(0, 10)} created (21.4 GiB)`, { icon: "📸" }) }),
        el("button", { class: "chip", text: "Secure wipe", onclick: () => toast("Secure wipe", "DoD 5220.22-M, 7 passes — cancelled in demo", { icon: "🧹" }) }))));
  }
  return w;
}

/* ---------------------------------- users --------------------------------- */
function users() {
  const w = el("div", { class: "pad" });
  w.append(el("div", { class: "st-h", text: "Users & Groups" }), el("div", { class: "st-sub", text: "Accounts · sudo policy · guest mode · Touch ID-class auth" }));
  const rows = [["thadd", "Administrator · sudo · CAP_SYS_ADMIN", "uid 1000 · /home/thadd"],
    ["root", "System account · locked password, sudo-only", "uid 0"],
    ["parrot", "Offensive-security profile (arsenal sandboxed)", "uid 1001"],
    ["guest", "Guest mode · ephemeral home, wiped on logout", "uid 501"]];
  for (const [n, r, d] of rows)
    w.append(el("div", { class: "st-row" }, el("div", { class: "lbl" }, el("div", { class: "t", text: n }), el("div", { class: "s", text: r }), el("div", { class: "s", text: d })),
      el("button", { class: "chip", text: "Edit", onclick: () => toast("Users", n + " — editing simulated", { icon: "👥" }) })));
  w.append(el("div", { class: "st-card", style: { marginTop: "12px" } },
    el("div", { style: { fontWeight: "700", marginBottom: "6px" }, text: "Authentication" }),
    el("div", { class: "st-row" }, el("div", { class: "lbl" }, el("div", { class: "t", text: "Passwordless sudo for thadd" }), el("div", { class: "s", text: "NOPASSWD + timestamp_timeout=15" })), el("span", { class: "chip on", text: "on" })),
    el("div", { class: "st-row" }, el("div", { class: "lbl" }, el("div", { class: "t", text: "2FA (TOTP) for sudo" }), el("div", { class: "s", text: "pam_google_authenticator" })), el("span", { class: "chip on", text: "on" })),
    el("div", { class: "st-row" }, el("div", { class: "lbl" }, el("div", { class: "t", text: "FIDO2 / security-key login" }), el("div", { class: "s", text: "YubiKey 5 NFC registered" })), el("span", { class: "chip on", text: "on" }))));
  return w;
}

/* ---------------------------------- power --------------------------------- */
function power() {
  const w = el("div", { class: "pad" });
  w.append(el("div", { class: "st-h", text: "Power & Battery" }), el("div", { class: "st-sub", text: "Intel P-state · thermald · suspend/hibernate" }));
  w.append(el("div", { class: "stats" },
    el("div", { class: "stat" }, el("div", { class: "k", text: "Battery" }), el("div", { class: "v", text: "98%" }), el("div", { class: "bar2" }, el("i", { style: { width: "98%" } }))),
    el("div", { class: "stat" }, el("div", { class: "k", text: "Time remaining" }), el("div", { class: "v", text: "AC" })),
    el("div", { class: "stat" }, el("div", { class: "k", text: "Thermals" }), el("div", { class: "v", text: "41°C" })),
    el("div", { class: "stat" }, el("div", { class: "k", text: "Governor" }), el("div", { class: "v", text: "schedutil" })),
    el("div", { class: "stat" }, el("div", { class: "k", text: "TDP" }), el("div", { class: "v", text: "18W" }))));
  for (const [k, v] of [["Suspend on lid close", true], ["Hibernate after 3h idle", true], ["Wake on LAN", false], ["Turbo boost", true], ["Fan curve: silent", true]]) {
    const sw = el("div", { class: "switch" + (v ? " on" : "") }, el("i"));
    sw.addEventListener("click", () => sw.classList.toggle("on"));
    w.append(el("div", { class: "st-row" }, el("div", { class: "lbl" }, el("div", { class: "t", text: k })), sw));
  }
  return w;
}

/* ------------------------------- bootpicker ------------------------------- */
function bootpicker() {
  const w = el("div", { class: "pad" });
  w.append(el("div", { class: "st-h", text: "Boot Manager" }),
    el("div", { class: "st-sub", text: "GRUB 2.12 · THADD Bootloader — multi-OS entries, all from one installer" }));
  const oses = [
    ["💠", "THADD OS 2.0 “Nebula Prime”", "This OS · /dev/sda2 · kernel 6.9.7-thadd-hardened · default entry", true],
    ["🪟", "Windows 11", "Detected on /dev/sdb1 · BitLocker-compatible chain-load · Secure Boot aware", false],
    ["🍎", "macOS Sequoia (OpenCore)", "Detected on /dev/sdc2 · OpenCore 1.0.2 chain-load (darwin 24A348)", false],
    ["🐧", "Ubuntu 24.04 LTS", "Detected on /dev/sdd1 · shared /home mount supported", false],
    ["🌀", "Debian 12 bookworm", "Detected on /dev/sdd2 · can import packages into THADD", false],
    ["🦜", "Parrot Security 6.3", "Detected on /dev/sde1 · arsenal deduped with THADD’s Parrot pack", false],
    ["⚙", "Advanced options", "recovery mode · memtest86+ · LUKS unlock · snapshot rollback", false],
  ];
  for (const [ic, name, desc, isThis] of oses) {
    const card = el("div", { class: "st-card", style: { display: "flex", gap: "14px", alignItems: "center", borderColor: isThis ? "var(--accent)" : "var(--hairline)" } },
      el("div", { style: { fontSize: "30px" }, text: ic }),
      el("div", { style: { flex: "1" } }, el("div", { style: { fontWeight: "700" }, text: name }), el("div", { class: "mute", style: { fontSize: "12px" }, text: desc })),
      el("button", { class: "chip" + (isThis ? " on" : ""), text: isThis ? "Current" : "Boot next", onclick: () => toast("Boot entry", isThis ? "Already the default" : `${name} will boot on next restart (one-shot)`, { icon: "🥾" }) }),
      el("button", { class: "chip", text: "Mount", onclick: () => toast("Mounted", `${name} mounted read-only at /mnt/$(echo) — cross-OS file access ready`, { icon: "💽" }) }));
    w.append(card);
  }
  w.append(el("div", { class: "st-card", style: { marginTop: "10px" } },
    el("div", { style: { fontWeight: "700", marginBottom: "6px" }, text: "THADD can also host the others" }),
    el("div", { class: "mute", style: { fontSize: "12.4px", lineHeight: "1.6" },
      text: "THADD OS ships a capability-parity layer for the OSes you listed: a Windows 11 Fluent ergonomics mode (snap layouts, Mica, tiling, PowerShell 7 + winget), a macOS Sequoia surface mode (Spotlight, Mission Control, dock magnification, traffic lights, brew/defaults/say/pbcopy shims), and the Debian/Ubuntu/Parrot package + toolchain layer (dpkg/apt, parrot-tools, snap, flatpak). The Boot Manager chain-loads every detected OS from one GRUB menu, and the Compatibility pane in Settings lets you switch surfaces instantly." })));
  return w;
}

/* ---------------------------------- trash --------------------------------- */
function trash() {
  const w = el("div", { class: "pad" });
  const items = store.get("trash.items", [
    { name: "old-notes.md", size: "4 KB", at: Date.now() - 3600e3 },
    { name: "recon-scratch.txt", size: "12 KB", at: Date.now() - 7200e3 },
  ]);
  const host = el("div", { class: "st-card" });
  const paint = () => {
    host.innerHTML = "";
    if (!items.length) host.append(el("div", { class: "mute", text: "Trash is empty." }));
    items.forEach((it, i) => {
      host.append(el("div", { class: "st-row" }, el("span", { text: "🗑" }),
        el("div", { class: "lbl" }, el("div", { class: "t", text: it.name }), el("div", { class: "s", text: `${it.size} · ${new Date(it.at).toLocaleTimeString()}` })),
        el("button", { class: "chip", text: "Restore", onclick: () => { vfs.write(vfs.home() + "/Documents/" + it.name, it.name + " (restored)"); items.splice(i, 1); store.set("trash.items", items); paint(); toast("Restored", it.name, { icon: "↩" }); } }),
        el("button", { class: "chip", text: "Shred", onclick: () => { items.splice(i, 1); store.set("trash.items", items); paint(); toast("Shredded", it.name + " — 7-pass DoD overwrite", { icon: "🔒" }); } })));
    });
  };
  paint();
  w.append(el("div", { class: "st-h", text: "Trash" }), el("div", { class: "st-sub", text: "Secure erase with DoD 5220.22-M, 7 passes · sparse-file aware" }), host,
    el("button", { class: "btn danger", style: { marginTop: "12px" }, text: "Empty Trash securely", onclick: () => { items.length = 0; store.set("trash.items", items); paint(); toast("Trash emptied", "All items shredded (7-pass)", { icon: "🗑" }); } }));
  return w;
}

/* ------------------------------- accessibility ---------------------------- */
function accessibility() {
  const w = el("div", { class: "pad" });
  w.append(el("div", { class: "st-h", text: "Accessibility" }), el("div", { class: "st-sub", text: "VoiceOver-class reader · magnifier · colour filters · motor aids" }));
  for (const [t, d] of [["Screen reader (THADD Voice)", "Full DOM + native-app narration, 42 voices, braille output"],
    ["Magnifier", "Up to 20× with smooth panning and colour inversion"],
    ["Colour filters", "Protanopia, deuteranopia, tritanopia, greyscale, high-contrast"],
    ["Reduce motion", "Disables window animations and aurora drift"],
    ["Sticky keys & slow keys", "Motor accessibility for keyboard users"]]) {
    const sw = el("div", { class: "switch" }, el("i"));
    sw.addEventListener("click", () => { sw.classList.toggle("on"); if (t.includes("Reduce motion")) document.body.classList.toggle("no-glass"); });
    w.append(el("div", { class: "st-row" }, el("div", { class: "lbl" }, el("div", { class: "t", text: t }), el("div", { class: "s", text: d })), sw));
  }
  return w;
}
