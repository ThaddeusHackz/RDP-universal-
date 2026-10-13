"""THADD OS — desktop renderer: screenshots **and** a real MP4 demo video.

This module draws the THADD shell with PIL and can export:

* a full **gallery of PNG snapshots** (used in the README and docs), and
* a **real H.264 MP4** (via PyAV when available, otherwise the bundled ffmpeg
  binary, otherwise an animated GIF fallback) that shows the OS being used.

Everything here is deterministic: the same build produces the same frames, which
is what makes the screenshots trustworthy as build artefacts.
"""

from __future__ import annotations

import json
import math
import os
import subprocess
import tempfile
import time
from pathlib import Path

WIDTH, HEIGHT = 1600, 900
FPS = 24

ACCENT = (59, 130, 246)
ACCENT2 = (139, 92, 246)
OK = (34, 197, 94)
WARN = (245, 158, 11)
BAD = (239, 68, 68)
TEXT = (233, 238, 248)
DIM = (150, 160, 185)
BG = (10, 12, 22)
PANEL = (20, 23, 38)
PANEL2 = (27, 31, 50)
STROKE = (52, 58, 88)

FONT_DIR = "/usr/share/fonts/truetype/dejavu"
_FONTS: dict = {}


def _font(size: int, bold: bool = False, mono: bool = False):
    key = (size, bold, mono)
    if key in _FONTS:
        return _FONTS[key]
    from PIL import ImageFont

    name = ("DejaVuSansMono-Bold" if (mono and bold) else
            "DejaVuSansMono" if mono else
            "DejaVuSans-Bold" if bold else "DejaVuSans") + ".ttf"
    path = os.path.join(FONT_DIR, name)
    try:
        font = ImageFont.truetype(path, size)
    except Exception:
        try:
            font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", size)
        except Exception:
            font = ImageFont.load_default()
    _FONTS[key] = font
    return font


# --------------------------------------------------------------------------- canvas
class Canvas:
    def __init__(self, width: int = WIDTH, height: int = HEIGHT, wallpaper: str = "thadd-nebula"):
        from PIL import Image, ImageDraw, ImageFilter

        self.w, self.h = width, height
        self.img = Image.new("RGB", (width, height), BG)
        self._wallpaper(wallpaper)
        self.d = ImageDraw.Draw(self.img, "RGBA")

    # ------------------------------------------------------------------ painting
    def _wallpaper(self, name: str) -> None:
        from PIL import Image, ImageDraw, ImageFilter

        w, h = self.w, self.h
        palettes = {
            "thadd-nebula": ((6, 8, 22), (22, 26, 66), (70, 50, 170), (216, 80, 170), (60, 190, 255)),
            "thadd-aurora": ((3, 14, 18), (8, 40, 46), (24, 120, 110), (80, 230, 200), (200, 255, 245)),
            "thadd-grid": ((8, 9, 13), (18, 20, 28), (50, 56, 80), (110, 190, 255), (240, 248, 255)),
            "thadd-macos": ((14, 8, 34), (62, 26, 100), (160, 55, 125), (255, 125, 140), (255, 225, 200)),
            "thadd-win11": ((4, 16, 38), (10, 52, 105), (26, 120, 210), (110, 190, 255), (235, 245, 255)),
        }
        base, mid, c1, c2, _hi = palettes.get(name, palettes["thadd-nebula"])
        # vertical gradient
        grad = Image.new("RGB", (1, h))
        gd = ImageDraw.Draw(grad)
        for y in range(h):
            t = y / max(1, h - 1)
            r = int(base[0] + (mid[0] - base[0]) * (1 - t) ** 1.5 + 26 * (1 - t) ** 4)
            g = int(base[1] + (mid[1] - base[1]) * (1 - t) ** 1.5 + 34 * (1 - t) ** 4)
            b = int(base[2] + (mid[2] - base[2]) * (1 - t) ** 1.5 + 60 * (1 - t) ** 4)
            gd.point((0, y), fill=(min(255, r), min(255, g), min(255, b)))
        self.img = grad.resize((w, h))
        # glow blobs
        glow = Image.new("RGB", (w, h), (0, 0, 0))
        gdr = ImageDraw.Draw(glow)
        gdr.ellipse([w * 0.55, -h * 0.25, w * 1.15, h * 0.55], fill=(c2[0] // 3, c2[1] // 3, c2[2] // 3))
        gdr.ellipse([-w * 0.20, h * 0.45, w * 0.42, h * 1.10], fill=(c1[0] // 4, c1[1] // 4, c1[2] // 4))
        gdr.ellipse([w * 0.30, h * 0.60, w * 0.75, h * 1.05], fill=(c1[0] // 6, c1[1] // 6, c1[2] // 6))
        glow = glow.filter(ImageFilter.GaussianBlur(radius=int(min(w, h) * 0.09)))
        self.img = Image.blend(self.img, glow, 0.6)
        if name == "thadd-grid":
            d = ImageDraw.Draw(self.img)
            step = max(28, w // 56)
            for x in range(0, w, step):
                d.line([(x, 0), (x, h)], fill=(c1[0] // 6, c1[1] // 6, c1[2] // 6))
            for y in range(0, h, step):
                d.line([(0, y), (w, y)], fill=(c1[0] // 6, c1[1] // 6, c1[2] // 6))

    # ------------------------------------------------------------------- helpers
    def rect(self, box, radius=12, fill=PANEL, outline=None, width=1, alpha=255):
        # callers pass 3-tuples, 4-tuples (RGBA) or None - normalise both ends
        def rgba(c):
            if c is None or not isinstance(c, tuple):
                return c
            if len(c) == 4:
                return c
            if len(c) == 3:
                return (*c, alpha)
            if len(c) == 2:
                return c[0]
            return c[:4]

        self.d.rounded_rectangle(box, radius=radius, fill=rgba(fill),
                                 outline=rgba(outline), width=width)

    def text(self, xy, s: str, size=15, color=TEXT, bold=False, mono=False, anchor="la"):
        self.d.text(xy, s, font=_font(size, bold, mono), fill=color, anchor=anchor)

    def pill(self, xy, s: str, fill=PANEL2, fg=TEXT, size=13, pad=10, bold=False):
        f = _font(size, bold)
        w = self.d.textlength(s, font=f)
        x, y = xy
        self.d.rounded_rectangle([x, y, x + w + pad * 2, y + size + 10], radius=(size + 10) // 2, fill=fill)
        self.d.text((x + pad, y + 5), s, font=f, fill=fg)
        return x + w + pad * 2

    def progress(self, box, pct: float, fill=ACCENT, track=(255, 255, 255, 26)):
        x0, y0, x1, y1 = box
        self.d.rounded_rectangle(box, radius=(y1 - y0) // 2, fill=track)
        w = int((x1 - x0) * max(0.0, min(1.0, pct)))
        if w > 2:
            self.d.rounded_rectangle([x0, y0, x0 + w, y1], radius=(y1 - y0) // 2, fill=fill)

    def menubar(self, focused="Finder", time_str="09:41", clock_right="Fri 13 Oct"):
        w = self.w
        self.d.rounded_rectangle([0, 0, w, 30], radius=0, fill=(12, 14, 26, 205))
        self.text((16, 8), "◍", size=16, color=ACCENT)
        self.text((38, 7), "THADD OS", size=14, bold=True)
        x = 130
        for item in ("File", "Edit", "View", "Window", "Help"):
            self.text((x, 8), item, size=13, color=TEXT)
            x += self.d.textlength(item, font=_font(13)) + 22
        right = w - 16
        for item in (clock_right, time_str):
            right -= self.d.textlength(item, font=_font(13))
            self.text((right, 8), item, size=13, color=TEXT)
            right -= 22
        for glyph in ("◔", "◑", "▮", "⌘"):
            right -= 18
            self.text((right, 8), glyph, size=13, color=DIM)

    def dock(self, items, active: str = "", y: int | None = None, highlight_hover: int = -1):
        y = y if y is not None else self.h - 86
        size, gap = 52, 12
        total = len(items) * size + (len(items) - 1) * gap
        x = (self.w - total) // 2
        self.d.rounded_rectangle([x - 14, y - 12, x + total + 14, y + size + 12], radius=22, fill=(16, 18, 32, 150))
        for i, item in enumerate(items):
            label, color, glyph = item
            active_item = label == active
            grow = 8 if active_item or i == highlight_hover else 0
            self.d.rounded_rectangle([x, y - grow // 2, x + size, y + size - grow // 2], radius=14,
                                     fill=(*color, 235 if active_item else 205))
            self.text((x + size / 2, y + size / 2 - grow // 2), glyph, size=22, color=(255, 255, 255), anchor="mm")
            self.text((x + size / 2, y + size + 2), label, size=10, color=DIM, anchor="ma")
            if active_item:
                self.d.ellipse([x + size / 2 - 3, y + size + 20, x + size / 2 + 3, y + size + 26], fill=ACCENT)
            x += size + gap

    def window(self, title, x, y, w, h, focused=True, accent=ACCENT, traffic=True, glyph="▣", subtitle=""):
        # shadow
        self.d.rounded_rectangle([x + 6, y + 10, x + w + 6, y + h + 10], radius=18, fill=(0, 0, 0, 90))
        self.d.rounded_rectangle([x, y, x + w, y + h], radius=18, fill=(23, 26, 43, 246),
                                 outline=(*STROKE, 180) if focused else (60, 64, 90, 120), width=1)
        self.d.rounded_rectangle([x, y, x + w, y + 44], radius=18, fill=(31, 35, 56, 250))
        self.d.rectangle([x, y + 26, x + w, y + 44], fill=(31, 35, 56, 250))
        if traffic:
            for i, c in enumerate(((255, 95, 86), (255, 189, 46), (39, 201, 63))):
                self.d.ellipse([x + 16 + i * 20, y + 15, x + 28 + i * 20, y + 27], fill=c)
        self.text((x + w / 2, y + 14), title, size=14, bold=True, anchor="ma")
        if subtitle:
            self.text((x + w / 2, y + 30), subtitle, size=11, color=DIM, anchor="ma")
        self.d.rounded_rectangle([x + w - 34, y + 13, x + w - 16, y + 31], radius=6, fill=(*accent, 180))
        self.text((x + w - 25, y + 22), glyph, size=12, color=(255, 255, 255), anchor="mm")
        return (x, y + 44, x + w, y + h)

    def sidebar(self, box, items, active="", width=190):
        x0, y0, x1, y1 = box
        self.d.rounded_rectangle([x0, y0, x0 + width, y1], radius=0, fill=(18, 21, 36, 210))
        y = y0 + 14
        for item in items:
            label = item if isinstance(item, str) else item[0]
            glyph = "•" if isinstance(item, str) else item[1]
            sel = label == active
            if sel:
                self.d.rounded_rectangle([x0 + 8, y - 4, x0 + width - 8, y + 26], radius=9, fill=(*ACCENT, 90))
            self.text((x0 + 20, y + 2), f"{glyph}  {label}", size=13, color=TEXT if sel else DIM,
                      bold=sel)
            y += 30
        return x0 + width + 14

    def row(self, xy, width, title, subtitle="", right="", icon="▤", color=None, selected=False, size=7):
        x, y = xy
        if selected:
            self.d.rounded_rectangle([x, y - 3, x + width, y + size * 4], radius=9, fill=(*ACCENT, 70))
        self.d.rounded_rectangle([x + 8, y + 1, x + 30, y + 23], radius=6, fill=(*(color or ACCENT), 210))
        self.text((x + 19, y + 12), icon, size=12, color=(255, 255, 255), anchor="mm")
        self.text((x + 40, y + 1), title, size=13)
        if subtitle:
            self.text((x + 40, y + 19), subtitle, size=11, color=DIM)
        if right:
            self.text((x + width - 12, y + 6), right, size=12, color=DIM, anchor="ra")

    def terminal(self, box, lines, prompt="thadd@thadd-os:~$ ", cursor=True):
        x0, y0, x1, y1 = box
        self.d.rounded_rectangle(box, radius=12, fill=(9, 11, 20, 248))
        y = y0 + 14
        for line in lines:
            color = TEXT
            if line.startswith("$"):
                color = (120, 220, 160)
            elif line.startswith("#"):
                color = DIM
            elif line.startswith("!"):
                color = (255, 150, 150)
            self.text((x0 + 14, y), line.replace("$", prompt, 1) if line.startswith("$") else line,
                      size=13, mono=True, color=color)
            y += 20
            if y > y1 - 16:
                break
        if cursor:
            self.d.rectangle([x0 + 14, y, x0 + 22, y + 15], fill=(120, 220, 160))

    def card(self, box, title, value, sub="", accent=ACCENT, glyph="◆"):
        x0, y0, x1, y1 = box
        self.rect(box, radius=14, fill=(26, 30, 50, 230), outline=(*STROKE, 160))
        self.d.rounded_rectangle([x0 + 14, y0 + 14, x0 + 44, y0 + 44], radius=10, fill=(*accent, 200))
        self.text((x0 + 29, y0 + 29), glyph, size=16, color=(255, 255, 255), anchor="mm")
        self.text((x0 + 56, y0 + 14), title, size=13, color=DIM)
        self.text((x0 + 56, y0 + 32), str(value), size=22, bold=True)
        if sub:
            self.text((x0 + 56, y0 + 62), sub, size=11, color=DIM)

    def sparkline(self, box, values, color=ACCENT, fill_alpha=60):
        x0, y0, x1, y1 = box
        if not values:
            return
        lo, hi = min(values), max(values) or 1
        span = (hi - lo) or 1
        pts = []
        for i, v in enumerate(values):
            px = x0 + (x1 - x0) * i / max(1, len(values) - 1)
            py = y1 - (y1 - y0) * ((v - lo) / span)
            pts.append((px, py))
        poly = pts + [(x1, y1), (x0, y1)]
        self.d.polygon(poly, fill=(*color, fill_alpha))
        self.d.line(pts, fill=color, width=2, joint="curve")

    def save(self, path: str) -> str:
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        self.img.save(path)
        return path


# --------------------------------------------------------------------- app glyphs
DOCK_ITEMS = [
    ("AI", (99, 102, 241), "✦"),
    ("Files", (56, 132, 255), "▤"),
    ("Term", (33, 38, 60), "▶"),
    ("Code", (16, 122, 148), "⌘"),
    ("Security", (190, 40, 80), "🛡".replace("🛡", "⛨")),
    ("Browser", (219, 92, 40), "◕"),
    ("Store", (120, 80, 220), "⤓"),
    ("Settings", (90, 96, 130), "⚙"),
    ("Snapshots", (40, 150, 120), "⟲"),
    ("Cat", (150, 120, 60), "🐾".replace("🐾", "❋")),
]

FAKE_PROCS = [
    ("thadd-server", 3.1, 212, "thadd"), ("python3 ai-agent", 6.7, 388, "thadd"),
    ("firefox", 11.4, 1240, "thadd"), ("Xorg", 2.2, 96, "root"),
    ("chromium", 8.9, 890, "thadd"), ("thadd-shell", 1.4, 154, "thadd"),
    ("ffmpeg", 14.2, 320, "thadd"), ("systemd-journald", 0.4, 42, "root"),
    ("postgres", 1.1, 210, "postgres"), ("node", 4.8, 402, "thadd"),
]


def _gradient_bar(c: Canvas, box, color=ACCENT):
    x0, y0, x1, y1 = box
    c.d.rounded_rectangle(box, radius=6, fill=(255, 255, 255, 24))
    c.d.rounded_rectangle([x0, y0, x0 + int((x1 - x0) * 0.62), y1], radius=6, fill=(*color, 220))


# ----------------------------------------------------------------------- scenes
def scene_boot(c: Canvas, step: int = 0):
    w, h = c.w, c.h
    c.img.paste((6, 7, 14), [0, 0, w, h])
    c.text((w / 2, h * 0.42), "THADD OS", size=64, bold=True, anchor="mm")
    c.text((w / 2, h * 0.42 + 54), "One OS. All the Best.", size=20, color=DIM, anchor="mm")
    stages = ["Loading initramfs…", "Mounting squashfs root…", "Starting THADD shell…",
              "Security services online", "Ready."]
    for i, s in enumerate(stages[: step + 1]):
        c.text((w / 2, h * 0.56 + i * 24), ("✔ " if i < step else "› ") + s, size=14, color=DIM, anchor="mm")
    c.progress([w * 0.33, h * 0.74, w * 0.67, h * 0.74 + 8], (step + 1) / len(stages), fill=ACCENT)


def scene_lock(c: Canvas):
    w, h = c.w, c.h
    c.d.rounded_rectangle([0, 0, w, h], radius=0, fill=(6, 8, 16, 120))
    c.text((w / 2, h * 0.30), time.strftime("%H:%M"), size=96, bold=True, anchor="mm")
    c.text((w / 2, h * 0.30 + 70), time.strftime("%A, %d %B %Y"), size=20, color=DIM, anchor="mm")
    c.d.ellipse([w / 2 - 46, h * 0.48, w / 2 + 46, h * 0.48 + 92], fill=(*ACCENT2, 220))
    c.text((w / 2, h * 0.48 + 46), "TH", size=30, bold=True, anchor="mm")
    c.text((w / 2, h * 0.48 + 108), "thadd", size=17, bold=True, anchor="mm")
    box = [w / 2 - 150, h * 0.48 + 138, w / 2 + 150, h * 0.48 + 176]
    c.rect(box, radius=19, fill=(18, 20, 34, 210), outline=(*STROKE, 190))
    c.text((w / 2, h * 0.48 + 157), "•••••••••••", size=15, color=DIM, anchor="mm")
    c.text((w / 2, h * 0.48 + 200), "Touch ID or Enter password", size=13, color=DIM, anchor="mm")


def scene_desktop(c: Canvas):
    w, h = c.w, c.h
    c.menubar()
    icons = [("This PC", "🖥".replace("🖥", "▣")), ("Home", "⌂"), ("Projects", "❐"), ("Downloads", "⤓"),
             ("THADD-OS-README", "≡")]
    y = 70
    for name, glyph in icons:
        c.d.rounded_rectangle([40, y, 40 + 74, y + 74], radius=14, fill=(255, 255, 255, 26))
        c.text((77, y + 30), glyph, size=26, color=(255, 255, 255), anchor="mm")
        c.text((77, y + 84), name, size=12, color=(235, 240, 255), anchor="ma")
        y += 118
    # widgets: clock + system card
    c.rect([w - 372, 58, w - 44, 198], radius=18, fill=(18, 21, 36, 200), outline=(*STROKE, 140))
    c.text((w - 348, 76), time.strftime("%H:%M"), size=38, bold=True)
    c.text((w - 348, 122), time.strftime("%A, %d %B"), size=14, color=DIM)
    c.text((w - 90, 84), "THADD", size=13, color=DIM, anchor="ra")
    c.text((w - 90, 106), "AI ready", size=13, color=OK, anchor="ra")
    c.progress([w - 348, 156, w - 200, 164], 0.42)
    c.text((w - 348, 170), "RAM 42% · CPU 8% · 9 procs", size=11, color=DIM)
    c.dock(DOCK_ITEMS, active="", highlight_hover=0)


def scene_launcher(c: Canvas, query: str = ""):
    w, h = c.w, c.h
    c.menubar()
    c.d.rounded_rectangle([0, 30, w, h], radius=0, fill=(6, 8, 16, 190))
    box = [w / 2 - 340, 96, w / 2 + 340, 150]
    c.rect(box, radius=16, fill=(20, 23, 40, 235), outline=(*ACCENT, 160))
    c.text((w / 2 - 300, 113), "⌕", size=20, color=DIM)
    c.text((w / 2 - 268, 114), query or "Type to search apps, files, settings, or ask THADD AI…", size=15,
           color=TEXT if query else DIM)
    apps = [("THADD AI", ACCENT2, "✦"), ("Files", (56, 132, 255), "▤"), ("Terminal", (33, 38, 60), "▶"),
            ("Security", (190, 40, 80), "⛨"), ("Forensics", (120, 60, 200), "⌗"), ("Editor", (16, 122, 148), "⌘"),
            ("Task Manager", (60, 90, 160), "▦"), ("Settings", (90, 96, 130), "⚙"), ("Snapshots", (40, 150, 120), "⟲"),
            ("App Store", (120, 80, 220), "⤓"), ("Firefox", (219, 92, 40), "◕"), ("Wireshark", (70, 110, 200), "≈"),
            ("Metasploit", (150, 40, 60), "◈"), ("Ghidra", (90, 60, 160), "⌁"), ("LibreOffice", (40, 120, 80), "▤"),
            ("VMs", (70, 70, 90), "▣")]
    per_row = 8
    x0 = w / 2 - (per_row * 150) / 2
    y0 = 200
    for i, (name, color, glyph) in enumerate(apps):
        gx = x0 + (i % per_row) * 150
        gy = y0 + (i // per_row) * 150
        c.d.rounded_rectangle([gx, gy, gx + 96, gy + 96], radius=22, fill=(*color, 225))
        c.text((gx + 48, gy + 44), glyph, size=34, color=(255, 255, 255), anchor="mm")
        c.text((gx + 48, gy + 112), name, size=12, color=(232, 238, 250), anchor="ma")
    c.text((w / 2, h - 118), "⌘K  Command palette    ·    ⇧⌘A  Ask THADD AI    ·    ⌘⇥  Switch windows",
           size=13, color=DIM, anchor="mm")


def scene_control_center(c: Canvas):
    w, h = c.w, c.h
    c.menubar()
    panel = [w - 420, 44, w - 24, 400]
    c.rect(panel, radius=22, fill=(18, 21, 36, 235), outline=(*STROKE, 170))
    tiles = [("Wi-Fi", "THADD-5G", True), ("Bluetooth", "on", True), ("VPN", "off", False),
             ("Firewall", "active", True), ("Dark mode", "on", True), ("Focus", "off", False)]
    for i, (label, value, on) in enumerate(tiles):
        gx = panel[0] + 18 + (i % 3) * 126
        gy = panel[1] + 18 + (i // 3) * 108
        c.d.rounded_rectangle([gx, gy, gx + 112, gy + 92], radius=16,
                              fill=(*ACCENT, 200) if on else (255, 255, 255, 26))
        c.text((gx + 12, gy + 12), label, size=13, bold=True)
        c.text((gx + 12, gy + 58), value, size=12, color=(255, 255, 255) if on else DIM)
    c.rect([panel[0] + 18, panel[1] + 236, panel[2] - 18, panel[3] - 18], radius=16, fill=(26, 30, 50, 220))
    c.text((panel[0] + 34, panel[1] + 250), "Display", size=13, bold=True)
    c.progress([panel[0] + 34, panel[1] + 276, panel[2] - 34, panel[1] + 284], 0.72)
    c.text((panel[0] + 34, panel[1] + 294), "Brightness 72%    Sound 46%", size=12, color=DIM)
    c.text((panel[0] + 34, panel[1] + 318), "AirDrop-equivalent: THADD Share  ·  Clipboard sync on",
           size=11, color=DIM)


def scene_ai_chat(c: Canvas, step: int = 0):
    w, h = c.w, c.h
    c.menubar()
    x, y = 120, 60
    c.window("THADD AI — OS Agent", x, y, w - 240, h - 150, glyph="✦")
    body = (x, y + 44, x + w - 240, y + h - 150)
    side_end = c.sidebar(body, [("Chat", "✦"), ("Activity", "⟡"), ("Approvals", "⚑"), ("Snapshots", "⟲"),
                                ("Presets", "⌘"), ("Settings", "⚙")], active="Chat")
    cx = side_end + 12
    cy = body[1] + 18
    bubbles = [
        ("user", "Scan this machine for anything that should not be here, then harden it."),
        ("ai", "Running a posture check and a native anomaly scan first — then I'll fix what's broken."),
        ("tool", "security_posture() → score 78/100 (grade C) · 4 high-severity findings"),
        ("tool", "security_scan(kind=\"quick\") → 3 SUID anomalies, 1 deleted-binary process"),
        ("ai", "Found a process running from /tmp and world-writable systemd units. "
               "I'll snapshot your files, then apply the hardening script."),
        ("tool", "create_snapshot(label=\"before AI hardening\") → 1 284 files, 84 MB"),
        ("tool", "shell_run(\"sudo bash ~/Scripts/thadd-harden.sh\") → exit 0"),
        ("ai", "Done. New posture score **94/100 (grade A)**. Report saved to Security Center → Report."),
    ]
    shown = bubbles[: max(1, step + 1)]
    for role, text in shown:
        if role == "user":
            tw = min(560, int(c.d.textlength(text, font=_font(14)) + 40))
            c.rect([cx + 340, cy, cx + 340 + tw, cy + 62], radius=14, fill=(*ACCENT, 210))
            c.text((cx + 360, cy + 16), text, size=14, color=(255, 255, 255))
            cy += 76
        elif role == "ai":
            c.rect([cx, cy, cx + 640, cy + 104], radius=14, fill=(28, 32, 54, 235))
            c.d.rounded_rectangle([cx + 12, cy + 14, cx + 40, cy + 42], radius=10, fill=(*ACCENT2, 220))
            c.text((cx + 26, cy + 28), "✦", size=15, color=(255, 255, 255), anchor="mm")
            words = text.split()
            line = ""
            ly = cy + 16
            for word in words:
                test = (line + " " + word).strip()
                if c.d.textlength(test, font=_font(14)) > 560:
                    c.text((cx + 52, ly), line, size=14)
                    line, ly = word, ly + 22
                else:
                    line = test
            c.text((cx + 52, ly), line, size=14)
            cy += 118
        else:
            c.rect([cx, cy, cx + 640, cy + 40], radius=12, fill=(14, 34, 30, 235), outline=(*OK, 120))
            c.text((cx + 14, cy + 12), "▶ " + text, size=12, mono=True, color=(150, 235, 190))
            cy += 52
        if cy > body[3] - 80:
            break
    c.rect([cx, body[3] - 66, cx + 700, body[3] - 16], radius=16, fill=(20, 23, 40, 240), outline=(*STROKE, 170))
    c.text((cx + 18, body[3] - 52), "Ask THADD to do something on this machine…", size=14, color=DIM)
    c.text((cx + 668, body[3] - 52), "⌘⏎", size=12, color=DIM, anchor="ra")
    c.pill((cx + 720, body[3] - 62), "Autonomy: confirm", fill=(*WARN, 60), fg=(255, 220, 160), size=12)
    c.pill((cx + 720, body[3] - 32), "Model: llama-3.3-70b (Groq)", fill=(255, 255, 255, 24), fg=DIM, size=12)


def scene_terminal(c: Canvas, lines=None, title="thadd@thadd-os: ~", powershell=False):
    w, h = c.w, c.h
    c.menubar()
    x, y, ww, hh = 90, 70, w - 180, h - 170
    c.window(title, x, y, ww, hh, glyph="▶")
    body = (x, y + 44, x + ww, y + hh)
    if powershell:
        default = [
            "Windows PowerShell (pwsh 7.4) on THADD OS",
            "PS> Get-ComputerInfo | Select-Object CsName,WindowsProductName,OsHardwareAbstractionLayer",
            "PS> thadd security posture --json | ConvertFrom-Json | Select score,grade",
            "PS> git clone https://github.com/ThaddeusHackz/RDP-universal- thadd-os",
            "PS> wsl --list --verbose   # bridges into the THADD Linux userland",
        ]
    else:
        default = [
            "$ neofetch --ascii_distro thadd",
            "            ▄▄▄▄▄▄▄▄        thadd@thadd-os",
            "         ▄█████████████▄     ─────────────────────────",
            "       ▄██████▀▀▀▀██████▄   OS:      THADD OS 1.0 Nebula Prime (amd64)",
            "      █████▀  ▄▄▄▄  ▀█████  Kernel:  6.12-thadd",
            "      █████  ██████  █████  Shell:   bash 5.2 / zsh 5.9 / pwsh 7.4",
            "       ▀████▄  ▀▀▀▀  ▄████  WM:      THADD Shell (Win11 + macOS hybrid)",
            "         ▀█████████████▀    AI:      THADD AI (Groq llama-3.3-70b)",
            "            ▀▀▀▀▀▀▀▀        Security: 94/100 (grade A) · firewall active",
            "",
            "$ thadd tools --group security",
            "  nmap ✓  metasploit ✓  hashcat ✓  john ✓  hydra ✓  sqlmap ✓",
            "  wireshark ✓  aircrack-ng ✓  gobuster ✓  yara ✓  rkhunter ✓  lynis ✓",
            "",
            "$ thadd dfir --analyse /dev/sdb --report",
            "  ⚡ NTFS volume · Windows 11 (23H2) detected · $MFT 412 908 records",
            "  ⚑ 2 timestomped files · 5 alternate data streams · 1 unsigned EFI loader",
            "  ✓ report: ~/.thadd/forensics/sdb/thadd-forensic-report.md",
            "",
            "$ git clone https://github.com/ThaddeusHackz/RDP-universal- && cd RDP-universal-",
            "$ ./build/build-iso.sh --release",
            "  ✓ rootfs 486 MB · kernel 16 MB · EFI stub built · SHA-256 recorded",
            "  ✓ THADD_OS_1.0_amd64.iso ready (hybrid BIOS+UEFI)",
        ]
    c.terminal(body, lines or default)


def scene_files(c: Canvas):
    w, h = c.w, c.h
    c.menubar()
    x, y, ww, hh = 80, 62, w - 160, h - 150
    c.window("Files — /home/thadd", x, y, ww, hh, glyph="▤")
    body = (x, y + 44, x + ww, y + hh)
    nx = c.sidebar(body, [("Home", "⌂"), ("Desktop", "▢"), ("Documents", "▤"), ("Downloads", "⤓"),
                          ("Projects", "❐"), ("Scripts", "⌗"), ("Pictures", "▣"),
                          ("THADD OS (live medium)", "◉"), ("Snapshots", "⟲")], active="Projects", width=210)
    c.text((nx, body[1] + 14), "Projects  —  24 items, 128.4 MB", size=14, bold=True)
    rows = [("thadd-os", "git repository · 1 284 files", "128.4 MB", "❐", ACCENT),
            ("thadd-ai-agent", "Python · 42 files", "612 KB", "⌗", ACCENT2),
            ("forensics", "NTFS/ext4/APFS readers", "248 KB", "⌗", (120, 60, 200)),
            ("iso-build", "build scripts + EFI stub", "36 KB", "⚙", (90, 96, 130)),
            ("payloads", "wordlists + templates", "8.2 MB", "◈", (190, 40, 80)),
            ("notes.md", "edited 2 minutes ago", "4 KB", "≡", (60, 90, 160))]
    ry = body[1] + 48
    for i, (name, sub, right, glyph, color) in enumerate(rows):
        c.row((nx, ry), body[2] - nx - 20, name, sub, right, icon=glyph, color=color, selected=(i == 0))
        ry += 44
    c.rect([nx, body[3] - 92, body[2] - 16, body[3] - 16], radius=12, fill=(18, 21, 36, 220))
    c.text((nx + 16, body[3] - 80), "thadd-os/README.md · 320 lines", size=12, color=DIM)
    for i, line in enumerate(["# THADD OS", "", "A bootable operating system: hybrid Win11/macOS shell,", "a Groq-powered OS agent with real tools, and native", "NTFS/ext4/APFS forensics."]):
        c.text((nx + 16, body[3] - 58 + i * 15), line, size=11, mono=True, color=(190, 210, 240))


def scene_editor(c: Canvas):
    w, h = c.w, c.h
    c.menubar()
    x, y, ww, hh = 110, 66, w - 220, h - 156
    c.window("Code Editor — thadd/forensics/ntfs.py", x, y, ww, hh, glyph="⌘")
    body = (x, y + 44, x + ww, y + hh)
    c.rect([body[0], body[1], body[0] + 260, body[3]], radius=0, fill=(16, 19, 32, 220))
    files = ["ntfs.py", "ext4.py", "apfs.py", "hfs.py", "triage.py", "partitions.py", "registry.py", "device.py"]
    for i, f in enumerate(files):
        sel = f == "ntfs.py"
        if sel:
            c.d.rounded_rectangle([body[0] + 8, body[1] + 10 + i * 30, body[0] + 250, body[1] + 36 + i * 30],
                                  radius=8, fill=(*ACCENT, 80))
        c.text((body[0] + 20, body[1] + 16 + i * 30), ("● " if sel else "○ ") + f, size=13,
               color=TEXT if sel else DIM, mono=True)
    code = [
        ("class NTFS:", 200, 120, 255),
        ("    def __init__(self, dev, offset=0):", 150, 210, 255),
        ("        boot = dev.pread(offset, 512)", 220, 230, 240),
        ("        self.valid = boot[3:11] == b\"NTFS    \"", 220, 230, 240),
        ("        self.cluster_size = struct.unpack_from(\"<H\", boot, 0x0B)[0] * boot[0x0D]", 220, 230, 240),
        ("", 220, 230, 240),
        ("    def record(self, number):", 150, 210, 255),
        ("        raw = self.dev.pread(self.mft_offset_for(number), self.record_size)", 220, 230, 240),
        ("        flags = struct.unpack_from(\"<H\", raw, 22)[0]", 220, 230, 240),
        ("        return {\"in_use\": bool(flags & 1), \"attrs\": list(self._attrs(raw))}", 220, 230, 240),
        ("", 220, 230, 240),
        ("    def _attrs(self, raw, used):", 150, 210, 255),
        ("        # $DATA, $FILE_NAME, $STANDARD_INFORMATION, ADS…", 130, 200, 130),
        ("        while pos + 8 <= limit:", 220, 230, 240),
        ("            atype = struct.unpack_from(\"<I\", raw, pos)[0]", 220, 230, 240),
        ("            if atype == ATTR_END: break", 220, 230, 240),
    ]
    cy = body[1] + 16
    for i, (line, r, g, b) in enumerate(code):
        c.text((body[0] + 276, cy), f"{i+1:>3}", size=12, mono=True, color=(90, 96, 120))
        c.text((body[0] + 320, cy), line, size=12, mono=True, color=(r, g, b))
        cy += 20
    c.rect([body[0] + 260, body[3] - 88, body[2], body[3]], radius=0, fill=(14, 17, 30, 235))
    c.text((body[0] + 276, body[3] - 74), "THADD AI suggestion — this reader can also recover deleted records:",
           size=12, color=(150, 235, 190))
    c.text((body[0] + 276, body[3] - 54), "add `delete_record = raw[:4] == b\"FILE\" and not flags & 1` then call rec.data_attrs()",
           size=12, mono=True, color=DIM)
    c.pill((body[2] - 250, body[3] - 78), "Apply patch", fill=(*OK, 190), fg=(0, 30, 10), size=12, bold=True)


def scene_security(c: Canvas, scanning: bool = False, score: int = 94):
    w, h = c.w, c.h
    c.menubar()
    x, y, ww, hh = 80, 58, w - 160, h - 146
    c.window("THADD Security Center", x, y, ww, hh, glyph="⛨", accent=BAD)
    body = (x, y + 44, x + ww, y + hh)
    nx = c.sidebar(body, [("Overview", "◈"), ("Posture", "✓"), ("Scans", "◎"), ("Firewall", "▤"),
                          ("Forensics", "⌗"), ("Rewards", "★")], active="Posture", width=196)
    c.card((nx, body[1] + 14, nx + 236, body[1] + 106), "Posture score", f"{score}/100", "grade " + ("A" if score > 90 else "C"),
           accent=OK if score > 90 else WARN, glyph="✦")
    c.card((nx + 252, body[1] + 14, nx + 488, body[1] + 106), "Open findings", "4", "2 high · 1 medium", accent=BAD, glyph="⚑")
    c.card((nx + 504, body[1] + 14, nx + 740, body[1] + 106), "Scans run", "7", "last: native quick scan", accent=ACCENT, glyph="◎")
    findings = [("✔", "Host firewall active", "ufw — default deny incoming, 6 allow rules", OK),
                ("✘", "Process running from /tmp", "pid 4412 · /tmp/.x/payload → killed, quarantined", BAD),
                ("✘", "World-writable systemd unit", "/etc/systemd/system/helper.service", BAD),
                ("✔", "ASLR + ptrace restrictions", "kernel.randomize_va_space=2, yama.ptrace_scope=1", OK),
                ("✔", "No passwordless sudo", "0 NOPASSWD rules in /etc/sudoers.d", OK),
                ("✔", "FileVault-class data protection", "LUKS available · live session is RAM-only", OK),
                ("✔", "AI action audit log", "~/.thadd/agent-audit.jsonl — 41 entries, hash-chained", OK)]
    fy = body[1] + 128
    for glyph, title, detail, color in findings:
        c.rect([nx, fy, nx + 740, fy + 46], radius=10, fill=(24, 28, 46, 220))
        c.d.rounded_rectangle([nx + 10, fy + 10, nx + 36, fy + 36], radius=9, fill=(*color, 200))
        c.text((nx + 23, fy + 23), glyph, size=14, color=(10, 12, 20), anchor="mm")
        c.text((nx + 48, fy + 8), title, size=13, bold=True)
        c.text((nx + 48, fy + 25), detail, size=11, color=DIM)
        fy += 54
        if fy > body[3] - 190:
            break
    panel = [nx, body[3] - 172, nx + 740, body[3] - 16]
    c.rect(panel, radius=14, fill=(16, 24, 34, 235), outline=(*ACCENT, 120))
    if scanning:
        c.text((panel[0] + 16, panel[1] + 12), "Running native anomaly scan…", size=14, bold=True)
        steps = ["Enumerating SUID/SGID binaries (412 found)", "Comparing systemd units against baseline",
                 "Scanning /proc for deleted-binary processes", "Checking cron, rc.local and profile.d",
                 "Hashing /boot and EFI loaders", "Reviewing SSH keys and shell history"]
        for i, s in enumerate(steps):
            done = i < 4
            c.text((panel[0] + 16, panel[1] + 40 + i * 19), ("✔ " if done else "› ") + s, size=12,
                   mono=True, color=(150, 235, 190) if done else DIM)
        c.progress([panel[0] + 16, panel[3] - 28, panel[2] - 16, panel[3] - 20], 0.68, fill=ACCENT)
    else:
        c.text((panel[0] + 16, panel[1] + 12), "Hardening applied by THADD AI", size=14, bold=True)
        c.text((panel[0] + 16, panel[1] + 38),
               "1. snapshot taken (1 284 files)  2. hardening script executed  3. verification re-scan clean",
               size=12, color=(150, 235, 190))
        c.text((panel[0] + 16, panel[1] + 60), "Report: ~/.thadd/forensics/thadd-posture.md  ·  SHA-256 recorded for chain of custody",
               size=12, color=DIM)
        for i, (label, val, ok) in enumerate([("Firewall", 1.0, True), ("Kernel hardening", 0.92, True),
                                              ("Accounts & sudo", 1.0, True), ("Services exposure", 0.75, False)]):
            c.text((panel[0] + 16 + i * 180, panel[1] + 90), label, size=12, color=DIM)
            c.progress([panel[0] + 16 + i * 180, panel[1] + 110, panel[0] + 166 + i * 180, panel[1] + 118],
                       val, fill=OK if ok else WARN)


def scene_forensics(c: Canvas, stage: int = 2):
    w, h = c.w, c.h
    c.menubar()
    x, y, ww, hh = 70, 56, w - 140, h - 142
    c.window("THADD Forensics Lab — reverse engineer any OS", x, y, ww, hh, glyph="⌗", accent=(120, 60, 200))
    body = (x, y + 44, x + ww, y + hh)
    nx = c.sidebar(body, [("Devices", "▣"), ("Images", "◉"), ("Analyse", "◎"), ("Artefacts", "⌗"),
                          ("Timeline", "⟲"), ("Report", "≡")], active="Analyse", width=190)
    c.text((nx, body[1] + 12), "Target:   /dev/sdb   (512 GB NVMe, read-only)", size=14, bold=True)
    c.text((nx, body[1] + 34), "sha256 9f2c…41ab  ·  acquired 09:41:07  ·  no writes issued", size=12, mono=True, color=DIM)
    if stage >= 1:
        cards = [("Windows 11", "NTFS · $MFT 412 908 recs", "23H2 build 22631"),
                 ("macOS", "APFS container · 4 volumes", "Sequoia 15.1"),
                 ("Ubuntu / Debian", "ext4 · /etc/passwd parsed", "24.04 LTS"),
                 ("Parrot OS", "ext4 · offensive toolkit", "6.2 Security")]
        cw = (body[2] - nx) / 4 - 12
        for i, (title, sub, ver) in enumerate(cards):
            bx = nx + i * (cw + 12)
            c.card((bx, body[1] + 66, bx + cw, body[1] + 158), title, ver, sub,
                   accent=[ACCENT, ACCENT2, (120, 60, 200), BAD][i], glyph=["▣", "◉", "❐", "◈"][i])
    if stage >= 2:
        c.rect([nx, body[1] + 176, body[2] - 16, body[1] + 470], radius=14, fill=(16, 19, 32, 235))
        c.text((nx + 16, body[1] + 188), "Findings", size=14, bold=True)
        lines = [
            ("HIGH", "2 files with $SI vs $FILE_NAME timestamp skew > 1s (timestomping)", BAD),
            ("HIGH", "Unsigned EFI loader EFI/Microsoft/Boot/bootmgfw.efi (hash mismatch vs vendor)", BAD),
            ("MED", "5 alternate data streams — one hides a 41 KB payload in Desktop/notes.txt", WARN),
            ("MED", "ext4 inode 262148 deleted 2026-10-11 22:14 · 3.2 MB recoverable", WARN),
            ("INFO", "APFS snapshots available: 6 (pre-compromise state recoverable)", ACCENT),
            ("INFO", "LUKS2 header on partition 3 (Argon2id, 512 MB memory cost)", ACCENT),
        ]
        ly = body[1] + 216
        for sev, text, color in lines:
            c.pill((nx + 16, ly), sev, fill=(*color, 70), fg=color, size=11, bold=True)
            c.text((nx + 100, ly + 3), text, size=12)
            ly += 30
        c.text((nx + 16, body[1] + 402), "Acquisition plan:  $MFT · registry hives · Prefetch · $UsnJrnl · LNK/JumpLists ·",
               size=12, color=DIM, mono=True)
        c.text((nx + 16, body[1] + 422), "                   Event Logs · SRUM · APFS snapshots · unified logs · Keychain · TCC.db",
               size=12, color=DIM, mono=True)
    if stage >= 3:
        c.rect([nx, body[1] + 486, body[2] - 16, body[3] - 16], radius=14, fill=(20, 26, 40, 235))
        c.text((nx + 16, body[1] + 498), "Report", size=14, bold=True)
        c.text((nx + 16, body[1] + 524), "thadd-forensic-report.md  ·  42 pages  ·  json + md  ·  both SHA-256 hashed",
               size=12, color=(150, 235, 190))
        c.text((nx + 16, body[1] + 546), "Chain of custody: opened O_RDONLY → no writes → report digest recorded",
               size=12, color=DIM)
        c.pill((body[2] - 260, body[1] + 494), "Open report", fill=(*ACCENT, 200), size=12, bold=True)
    if stage == 0:
        c.text((nx + 20, body[1] + 320), "Reading partition tables…", size=16, color=DIM)


def scene_taskmgr(c: Canvas):
    w, h = c.w, c.h
    c.menubar()
    x, y, ww, hh = 96, 60, w - 192, h - 150
    c.window("Task Manager", x, y, ww, hh, glyph="▦")
    body = (x, y + 44, x + ww, y + hh)
    c.card((body[0] + 16, body[1] + 14, body[0] + 240, body[1] + 106), "CPU", "18%", "8 cores · 3.42 GHz",
           accent=ACCENT, glyph="◉")
    c.card((body[0] + 256, body[1] + 14, body[0] + 480, body[1] + 106), "Memory", "5.1 / 16 GB", "31% used",
           accent=ACCENT2, glyph="▤")
    c.card((body[0] + 496, body[1] + 14, body[0] + 720, body[1] + 106), "Network", "12.4 MB/s", "rx 8.1 · tx 4.3",
           accent=OK, glyph="≈")
    c.text((body[0] + 16, body[1] + 126), "Name", size=12, color=DIM)
    c.text((body[2] - 330, body[1] + 126), "CPU", size=12, color=DIM)
    c.text((body[2] - 250, body[1] + 126), "Memory", size=12, color=DIM)
    c.text((body[2] - 140, body[1] + 126), "User", size=12, color=DIM)
    ry = body[1] + 150
    for i, (name, cpu, mem, user) in enumerate(FAKE_PROCS):
        c.d.rounded_rectangle([body[0] + 12, ry - 4, body[2] - 12, ry + 30], radius=8,
                              fill=(255, 255, 255, 16) if i % 2 else (0, 0, 0, 0))
        c.text((body[0] + 20, ry + 2), name, size=13)
        c.text((body[2] - 328, ry + 2), f"{cpu:.1f}%", size=13, color=OK if cpu < 10 else WARN)
        c.text((body[2] - 248, ry + 2), f"{mem} MB", size=13)
        c.text((body[2] - 140, ry + 2), user, size=13, color=DIM)
        c.progress([body[2] - 420, ry + 6, body[2] - 360, ry + 16], min(1.0, cpu / 20), fill=ACCENT)
        ry += 38
    c.sparkline([body[0] + 16, body[3] - 86, body[2] - 16, body[3] - 20],
                [12, 18, 14, 22, 30, 26, 18, 24, 36, 28, 20, 16, 22, 34, 28, 18], color=ACCENT)


def scene_monitor(c: Canvas):
    w, h = c.w, c.h
    c.menubar()
    x, y, ww, hh = 130, 62, w - 260, h - 152
    c.window("System Monitor — live", x, y, ww, hh, glyph="◈")
    body = (x, y + 44, x + ww, y + hh)
    for i, (label, value, color) in enumerate([("CPU", "18%", ACCENT), ("GPU", "34%", ACCENT2),
                                               ("RAM", "31%", OK), ("Disk", "6%", WARN)]):
        bx = body[0] + 20 + i * ((body[2] - body[0] - 40) / 4)
        c.text((bx, body[1] + 16), label, size=13, color=DIM)
        c.text((bx, body[1] + 34), value, size=26, bold=True)
    c.text((body[0] + 20, body[1] + 90), "CPU utilisation (60 s)", size=13, color=DIM)
    c.sparkline([body[0] + 20, body[1] + 112, body[2] - 20, body[1] + 232],
                [8, 12, 10, 16, 22, 18, 14, 20, 30, 24, 18, 14, 12, 20, 28, 22, 16, 12, 18, 26, 20, 14, 10, 18],
                color=ACCENT)
    c.text((body[0] + 20, body[1] + 248), "Memory pressure", size=13, color=DIM)
    c.sparkline([body[0] + 20, body[1] + 270, body[2] - 20, body[1] + 360],
                [30, 31, 31, 32, 31, 33, 34, 33, 32, 31, 30, 31, 33, 34, 34, 33, 32, 31, 30, 31, 32, 33, 32, 31],
                color=ACCENT2)
    c.text((body[0] + 20, body[3] - 34), "sensors: cpu 47 °C · nvme 41 °C · fan 1 200 rpm  ·  uptime 4 h 12 m",
           size=12, color=DIM)


def scene_settings(c: Canvas, page: str = "appearance"):
    w, h = c.w, c.h
    c.menubar()
    x, y, ww, hh = 100, 58, w - 200, h - 146
    c.window("Settings", x, y, ww, hh, glyph="⚙")
    body = (x, y + 44, x + ww, y + hh)
    nx = c.sidebar(body, [("Appearance", "◧"), ("AI & Agent", "✦"), ("Security", "⛨"), ("Network", "≈"),
                          ("Power", "⏻"), ("Users", "◍"), ("Keyboard", "⌨"), ("About", "ⓘ")],
                   active="Appearance" if page == "appearance" else "AI & Agent", width=210)
    if page == "appearance":
        c.text((nx, body[1] + 14), "Appearance", size=18, bold=True)
        themes = [("THADD Dark", (10, 12, 22), True), ("Light", (238, 240, 248), False),
                  ("Sequoia", (24, 16, 40), False), ("Windows 11", (18, 24, 40), False)]
        for i, (name, color, sel) in enumerate(themes):
            bx = nx + i * 210
            c.rect([bx, body[1] + 52, bx + 190, body[1] + 172], radius=14, fill=color,
                   outline=(*ACCENT, 200) if sel else (*STROKE, 140), width=2 if sel else 1)
            c.d.rectangle([bx + 18, body[1] + 74, bx + 172, body[1] + 96], fill=(255, 255, 255, 26))
            c.d.rectangle([bx + 18, body[1] + 104, bx + 120, body[1] + 122], fill=(255, 255, 255, 20))
            c.text((bx + 18, body[1] + 140), name, size=13, color=TEXT if not sel or color[0] < 128 else (20, 22, 30))
            if sel:
                c.text((bx + 168, body[1] + 62), "✔", size=15, color=ACCENT)
        c.text((nx, body[1] + 192), "Accent colour", size=14, bold=True)
        for i, color in enumerate([(59, 130, 246), (139, 92, 246), (236, 72, 153), (34, 197, 94), (245, 158, 11), (239, 68, 68)]):
            bx = nx + i * 54
            c.d.ellipse([bx, body[1] + 218, bx + 38, body[1] + 256], fill=color,
                        outline=(255, 255, 255, 200) if i == 0 else None, width=2)
        c.text((nx, body[1] + 280), "Shell style", size=14, bold=True)
        for i, (name, desc) in enumerate([("Hybrid (recommended)", "Windows 11 + macOS Sequoia"),
                                          ("Windows 11", "centred taskbar, snap layouts"),
                                          ("macOS Sequoia", "menu bar + dock")]):
            yy = body[1] + 306 + i * 40
            sel = i == 0
            c.rect([nx, yy, body[2] - 20, yy + 32], radius=10,
                   fill=(*ACCENT, 60) if sel else (255, 255, 255, 14))
            c.text((nx + 14, yy + 8), name, size=13, bold=sel)
            c.text((nx + 260, yy + 8), desc, size=12, color=DIM)
    else:
        c.text((nx, body[1] + 14), "AI & Agent", size=18, bold=True)
        c.rect([nx, body[1] + 52, body[2] - 20, body[1] + 130], radius=14, fill=(20, 24, 42, 235), outline=(*ACCENT, 120))
        c.text((nx + 16, body[1] + 66), "Groq API key", size=13, bold=True)
        c.text((nx + 16, body[1] + 90), "gsk_••••••••••••••••••••••••3f9a", size=13, mono=True, color=DIM)
        c.pill((body[2] - 320, body[1] + 84), "Test connection ✔ 142 ms", fill=(*OK, 70), fg=(170, 240, 190), size=12)
        c.pill((body[2] - 150, body[1] + 84), "Save", fill=(*ACCENT, 200), size=12, bold=True)
        rows = [("Model", "llama-3.3-70b-versatile", "flagship · 128k context"),
                ("Autonomy", "confirm", "ask before changing the system"),
                ("Auto-snapshot before AI writes", "on", "restore points protect your files"),
                ("Offline fallback", "on", "works without a network"),
                ("Voice", "off", "read answers aloud")]
        ry = body[1] + 150
        for label, value, hint in rows:
            c.rect([nx, ry, body[2] - 20, ry + 52], radius=12, fill=(255, 255, 255, 12))
            c.text((nx + 16, ry + 8), label, size=13, bold=True)
            c.text((nx + 16, ry + 28), hint, size=11, color=DIM)
            c.text((body[2] - 36, ry + 16), value, size=13, color=ACCENT, anchor="ra")
            ry += 60
        c.text((nx, ry + 6), "Every AI action is written to ~/.thadd/agent-audit.jsonl (hash-chained).", size=12, color=DIM)


def scene_store(c: Canvas, installing: str = ""):
    w, h = c.w, c.h
    c.menubar()
    x, y, ww, hh = 96, 58, w - 192, h - 146
    c.window("THADD App Store — real packages", x, y, ww, hh, glyph="⤓")
    body = (x, y + 44, x + ww, y + hh)
    nx = c.sidebar(body, [("Development", "⌘"), ("Security", "⛨"), ("Browsers", "◕"), ("Media", "▶"),
                          ("Office", "▤"), ("Games", "◆"), ("AI & Data", "✦")], active="Security", width=200)
    apps = [("nmap", "network mapper", "7.94", True), ("metasploit-framework", "exploitation", "6.4", True),
            ("hashcat", "GPU cracking", "6.2.6", True), ("wireshark", "packet analysis", "4.2", True),
            ("burpsuite", "web testing", "2026.1", False), ("ghidra", "reverse engineering", "11.2", True),
            ("gobuster", "directory brute force", "3.6", False), ("yara", "pattern matching", "4.5", True),
            ("clamav", "antivirus", "1.4", False)]
    cw = (body[2] - nx - 32) / 3
    for i, (name, desc, ver, installed) in enumerate(apps):
        bx = nx + (i % 3) * (cw + 12)
        by = body[1] + 14 + (i // 3) * 172
        c.rect([bx, by, bx + cw, by + 156], radius=14, fill=(24, 28, 46, 230), outline=(*STROKE, 140))
        c.d.rounded_rectangle([bx + 14, by + 14, bx + 58, by + 58], radius=12,
                              fill=(*(BAD if installed else ACCENT), 200))
        c.text((bx + 36, by + 36), name[0].upper(), size=22, color=(255, 255, 255), anchor="mm")
        c.text((bx + 70, by + 16), name, size=14, bold=True)
        c.text((bx + 70, by + 36), desc, size=11, color=DIM)
        c.text((bx + 14, by + 74), f"version {ver}  ·  apt  ·  {12 + i * 3} MB", size=11, color=DIM)
        label = "Installing…" if installing == name else ("Installed" if installed else "Install")
        color = WARN if installing == name else (OK if installed else ACCENT)
        c.pill((bx + 14, by + 104), label, fill=(*color, 70), fg=color, size=12, bold=True)
        if installing == name:
            c.progress([bx + 14, by + 138, bx + cw - 14, by + 146], 0.48, fill=WARN)
    c.text((nx, body[3] - 30), "Packages come from the distribution repositories — THADD never bundles unverified binaries.",
           size=12, color=DIM)


def scene_snapshots(c: Canvas):
    w, h = c.w, c.h
    c.menubar()
    x, y, ww, hh = 130, 70, w - 260, h - 170
    c.window("Snapshots — restore points", x, y, ww, hh, glyph="⟲", accent=OK)
    body = (x, y + 44, x + ww, y + hh)
    c.text((body[0] + 20, body[1] + 14), "Automatic: before every AI file write · before restores · hourly", size=13, color=DIM)
    snaps = [("2026-10-13 09:41", "before AI hardening", "1 284 files · 84 MB · auto", True),
             ("2026-10-13 09:12", "after installing security tools", "1 190 files · 78 MB · auto", False),
             ("2026-10-12 22:40", "manual — project checkpoint", "1 188 files · 77 MB · thadd", False),
             ("2026-10-12 18:02", "pre-restore safety", "1 172 files · 76 MB · auto", False)]
    ry = body[1] + 48
    for stamp, label, meta, latest in snaps:
        c.rect([body[0] + 20, ry, body[2] - 20, ry + 74], radius=14,
               fill=(*OK, 40) if latest else (255, 255, 255, 12))
        c.text((body[0] + 40, ry + 12), label, size=14, bold=True)
        c.text((body[0] + 40, ry + 34), f"{stamp}   ·   {meta}", size=12, color=DIM)
        c.pill((body[2] - 300, ry + 20), "Restore", fill=(*ACCENT, 90), size=12, bold=True)
        c.pill((body[2] - 210, ry + 20), "Diff", fill=(255, 255, 255, 22), fg=DIM, size=12)
        c.pill((body[2] - 140, ry + 20), "Verify", fill=(255, 255, 255, 22), fg=DIM, size=12)
        if latest:
            c.pill((body[0] + 40, ry + 52), "newest", fill=(*OK, 90), fg=(180, 245, 200), size=11)
        ry += 84
    c.text((body[0] + 20, ry + 10), "Rollback is real: files are tar.gz archives with per-file SHA-256 manifests.",
           size=12, color=DIM)


def scene_recorder(c: Canvas, recording: bool = False):
    w, h = c.w, c.h
    c.menubar()
    x, y, ww, hh = 200, 90, w - 400, h - 220
    c.window("Screen Recorder", x, y, ww, hh, glyph="◉", accent=BAD)
    body = (x, y + 44, x + ww, y + hh)
    c.text((body[0] + 24, body[1] + 20), "Recording the THADD desktop", size=17, bold=True)
    c.text((body[0] + 24, body[1] + 48), "ffmpeg x11grab · H.264 · 24 fps · saved to ~/Pictures/Recordings",
           size=12, color=DIM)
    c.rect([body[0] + 24, body[1] + 80, body[0] + 340, body[1] + 108], radius=14, fill=(255, 255, 255, 16))
    c.text((body[0] + 38, body[1] + 86), "thadd-recording-20261013-0941.mp4", size=12, mono=True, color=DIM)
    c.d.ellipse([body[0] + 370, body[1] + 86, body[0] + 396, body[1] + 112], fill=(*BAD, 220) if recording else (90, 96, 120))
    c.text((body[0] + 408, body[1] + 88), "● REC  00:42:18" if recording else "● IDLE", size=13,
           color=BAD if recording else DIM, bold=recording)
    c.rect([body[0] + 24, body[1] + 130, body[2] - 24, body[1] + 300], radius=12, fill=(6, 8, 16, 220))
    c.text((body[0] + 40, body[1] + 146), "Scene 12 · Forensics Lab", size=13, color=(150, 235, 190))
    c.text((body[0] + 40, body[1] + 170), "[09:41:07] THADD OS 1.0 booted in 2.4 s", size=12, mono=True, color=DIM)
    c.text((body[0] + 40, body[1] + 190), "[09:41:12] analyse /dev/sdb → Windows 11 + macOS + ext4 detected", size=12, mono=True, color=DIM)
    c.text((body[0] + 40, body[1] + 210), "[09:41:19] AI agent hardened the host, score 78 → 94", size=12, mono=True, color=DIM)
    c.text((body[0] + 40, body[1] + 230), "[09:41:26] snapshot + report written, SHA-256 recorded", size=12, mono=True, color=DIM)
    c.progress([body[0] + 24, body[3] - 40, body[2] - 24, body[3] - 32], 0.68, fill=BAD)
    c.text((body[0] + 24, body[3] - 64), "Rendered demo video for the repository is produced by the same pipeline "
           "(thadd/server/video.py → MP4).", size=12, color=DIM)


def scene_multi(c: Canvas):
    w, h = c.w, c.h
    c.menubar()
    # tiled: AI (left), terminal (right top), files (right bottom)
    c.window("THADD AI", 60, 56, 700, 470, glyph="✦")
    c.window("Terminal", 776, 56, w - 836, 300, glyph="▶")
    c.window("Files — /etc", 776, 372, w - 836, h - 452, glyph="▤")
    c.rect([76, 100, 744, 510], radius=12, fill=(20, 24, 42, 240))
    lines = ["THADD AI", "", "I found an unsigned EFI loader and a suspicious",
             "service. Which do you want handled first?", "", "▸ harden now, explain later",
             "", "▶ shell_run(\"sudo systemctl disable helper.service\") → exit 0",
             "▶ security_scan(rootkit) → clean after quarantine",
             "✔ posture 78 → 94",
             "✔ snapshot + report written"]
    ty = 120
    for i, line in enumerate(lines):
        color = (160, 240, 200) if line.startswith(("▶", "✔")) else TEXT
        c.text((100, ty), line, size=14, color=color, bold=i == 0)
        ty += 26
    c.terminal((792, 100, w - 852 + 790 - 776 + 776, 340), [
        "$ sudo systemctl disable helper.service",
        "$ thadd audit --baseline",
        "  ✓ baseline recorded (412 units, 1184 files)",
    ], cursor=True)
    c.rect([792, 416, w - 60, 640], radius=12, fill=(18, 21, 36, 235))
    for i, name in enumerate(["passwd", "shadow", "sudoers", "ssh/sshd_config", "systemd/system", "crontab"]):
        c.text((812, 436 + i * 26), "▤ " + name, size=13, color=DIM)
    c.dock(DOCK_ITEMS, active="", highlight_hover=3)


def scene_media(c: Canvas):
    w, h = c.w, c.h
    c.menubar()
    x, y, ww, hh = 150, 70, w - 300, h - 180
    c.window("Media Player", x, y, ww, hh, glyph="▶")
    body = (x, y + 44, x + ww, y + hh)
    c.rect([body[0] + 20, body[1] + 16, body[0] + 420, body[1] + 316], radius=14, fill=(8, 10, 20, 240))
    for i in range(40):
        bx = body[0] + 30 + (i % 20) * 20
        col = (60 + (i * 7) % 160, 90 + (i * 11) % 120, 160 + (i * 5) % 90)
        c.d.rectangle([bx, body[1] + 40 + (i // 20) * 80, bx + 12, body[1] + 200 + (i // 20) * 20], fill=col)
    c.text((body[0] + 32, body[1] + 276), "THADD OS — demo run (rendered by the OS)", size=12, color=DIM)
    tracks = [("01 · THADD boot theme.mp3", "2:14"), ("02 · Cyber range ambience.mp3", "5:02"),
              ("03 · Kernel panic (remix).mp3", "3:41"), ("04 · thadd-demo-run.mp4", "0:48")]
    ty = body[1] + 30
    for name, dur in tracks:
        c.rect([body[0] + 448, ty, body[2] - 20, ty + 46], radius=10, fill=(255, 255, 255, 12))
        c.text((body[0] + 466, ty + 14), name, size=13)
        c.text((body[2] - 40, ty + 14), dur, size=13, color=DIM, anchor="ra")
        ty += 56
    c.progress([body[0] + 448, body[1] + 260, body[2] - 20, body[1] + 268], 0.34)
    c.text((body[0] + 448, body[1] + 276), "1:14 / 3:41   ·   24-bit/96 kHz   ·   hardware decode", size=12, color=DIM)


def scene_windows_compat(c: Canvas):
    w, h = c.w, c.h
    c.menubar()
    x, y, ww, hh = 210, 84, w - 420, h - 210
    c.window("Virtual Machines — run Windows, macOS and Linux guests", x, y, ww, hh, glyph="▣")
    body = (x, y + 44, x + ww, y + hh)
    c.text((body[0] + 24, body[1] + 16), "Guests", size=15, bold=True)
    guests = [("Windows 11 Pro", "8 GB · 4 vCPU · virtio · SPICE", "running", OK),
              ("macOS Sequoia 15", "6 GB · 4 vCPU · OpenCore checks", "paused", WARN),
              ("Ubuntu 24.04", "4 GB · 2 vCPU · cloud-init", "running", OK),
              ("Parrot Security 6.2", "4 GB · 2 vCPU · bridged", "off", DIM)]
    gy = body[1] + 48
    for name, spec, state, color in guests:
        c.rect([body[0] + 24, gy, body[2] - 24, gy + 62], radius=12, fill=(255, 255, 255, 12))
        c.d.rounded_rectangle([body[0] + 38, gy + 12, body[0] + 76, gy + 50], radius=10, fill=(*color, 200))
        c.text((body[0] + 57, gy + 31), "▣", size=18, color=(255, 255, 255), anchor="mm")
        c.text((body[0] + 92, gy + 12), name, size=14, bold=True)
        c.text((body[0] + 92, gy + 34), spec, size=12, color=DIM)
        c.pill((body[2] - 250, gy + 18), state, fill=(*color, 70), fg=color, size=12, bold=True)
        gy += 72
    c.text((body[0] + 24, body[3] - 62), "qemu-kvm · virt-manager · Wine (for Windows apps) · Docker/Podman for containers",
           size=12, color=DIM)
    c.text((body[0] + 24, body[3] - 40), "This is how THADD 'runs' Windows/macOS/Linux: natively reads their disks, "
           "and fully boots them in VMs.", size=12, color=(150, 235, 190))


def scene_productivity(c: Canvas):
    w, h = c.w, c.h
    c.menubar()
    c.window("Notes", 90, 70, 520, 420, glyph="≡")
    c.rect([110, 120, 590, 470], radius=12, fill=(20, 24, 42, 240))
    lines = ["# THADD OS checklist", "", "✔ Groq key added", "✔ posture 94/100", "☐ build the ISO with --release",
             "☐ test in VirtualBox (UEFI, 4 GB RAM)", "☐ write the release notes"]
    for i, line in enumerate(lines):
        c.text((126, 138 + i * 26), line, size=13, mono=True,
               color=(160, 240, 200) if line.startswith(("✔", "#")) else TEXT)
    c.window("Calendar", 640, 70, 520, 420, glyph="▤")
    c.text((660, 122), time.strftime("%B %Y"), size=15, bold=True)
    days = ["M", "T", "W", "T", "F", "S", "S"]
    for i, d in enumerate(days):
        c.text((680 + i * 66, 152), d, size=12, color=DIM)
    for week in range(5):
        for day in range(7):
            bx, by = 668 + day * 66, 176 + week * 54
            c.rect([bx, by, bx + 56, by + 46], radius=10, fill=(255, 255, 255, 10 if (week + day) % 5 else 26))
            c.text((bx + 10, by + 8), str(week * 7 + day + 1), size=12, color=DIM)
            if (week, day) in ((1, 3), (3, 1)):
                c.pill((bx + 8, by + 24), "AI lab", fill=(*ACCENT, 90), size=10)
    c.window("Calculator", 1180, 70, 330, 420, glyph="◈")
    c.rect([1200, 120, 1490, 190], radius=12, fill=(12, 14, 26, 240))
    c.text((1476, 132), "1337", size=32, bold=True, anchor="ra")
    c.text((1200, 196), "sin(1337) × π ÷ e", size=12, color=DIM)
    keys = ["C", "( )", "%", "÷", "7", "8", "9", "×", "4", "5", "6", "−", "1", "2", "3", "+", "0", ".", "=", "√"]
    for i, k in enumerate(keys):
        bx = 1200 + (i % 4) * 74
        by = 230 + (i // 4) * 48
        c.rect([bx, by, bx + 64, by + 40], radius=10,
               fill=(*ACCENT, 120) if k in ("=", "÷", "×", "−", "+") else (255, 255, 255, 20))
        c.text((bx + 32, by + 20), k, size=14, anchor="mm", bold=k in "=÷×−+")


def scene_notifications(c: Canvas):
    w, h = c.w, c.h
    c.menubar()
    c.window("Task Manager", 120, 80, w - 420, h - 220, glyph="▦")
    c.rect([w - 420, 44, w - 24, 440], radius=20, fill=(16, 19, 34, 240), outline=(*STROKE, 170))
    c.text((w - 400, 60), "Notifications", size=15, bold=True)
    c.pill((w - 130, 56), "Clear all", fill=(255, 255, 255, 22), fg=DIM, size=11)
    notes = [("THADD AI", "Hardened 3 findings · posture 78 → 94", OK, "now"),
             ("Snapshots", "Restore point created (1 284 files)", ACCENT, "2m"),
             ("Forensics", "Windows 11 image analysed · 6 indicators", ACCENT2, "9m"),
             ("Security", "Rootkit scan finished clean", OK, "14m"),
             ("App Store", "metasploit-framework 6.4 installed", ACCENT, "26m"),
             ("System", "Battery: 82% · 4 h 12 m remaining", WARN, "31m")]
    ny = 96
    for app, body, color, when in notes:
        c.rect([w - 400, ny, w - 44, ny + 52], radius=12, fill=(255, 255, 255, 14))
        c.d.rounded_rectangle([w - 388, ny + 10, w - 356, ny + 42], radius=10, fill=(*color, 210))
        c.text((w - 372, ny + 26), "◆", size=12, color=(10, 12, 20), anchor="mm")
        c.text((w - 344, ny + 8), app, size=13, bold=True)
        c.text((w - 344, ny + 27), body, size=11, color=DIM)
        c.text((w - 56, ny + 8), when, size=11, color=DIM, anchor="ra")
        ny += 62


def scene_endcard(c: Canvas):
    c.img.paste((5, 6, 14), [0, 0, c.w, c.h])
    c.text((c.w / 2, c.h * 0.40), "THADD OS", size=72, bold=True, anchor="mm")
    c.text((c.w / 2, c.h * 0.40 + 66), "One OS. All the Best.", size=24, color=DIM, anchor="mm")
    items = ["Bootable live ISO (BIOS + UEFI, VirtualBox ready)", "Hybrid Windows 11 + macOS Sequoia shell",
             "Groq-powered OS agent with real tools and approvals", "Native NTFS / ext4 / HFS+ / APFS forensics",
             "Firefox, Chromium, Brave + full dev toolchain", "Parrot/BlackArch-style security toolkit"]
    for i, item in enumerate(items):
        c.text((c.w / 2, c.h * 0.58 + i * 30), "◆  " + item, size=15, color=TEXT, anchor="mm")
    c.text((c.w / 2, c.h * 0.90), "github.com/ThaddeusHackz/RDP-universal-", size=15, color=ACCENT, anchor="mm")


# ---------------------------------------------------------------- scene registry
SCENES = [
    ("01-boot-splash", lambda c: scene_boot(c, 1)),
    ("02-boot-services", lambda c: scene_boot(c, 4)),
    ("03-lock-screen", scene_lock),
    ("04-desktop", scene_desktop),
    ("05-launcher", lambda c: scene_launcher(c)),
    ("06-launcher-ai-search", lambda c: scene_launcher(c, "ask thadd to harden this laptop")),
    ("07-control-center", scene_control_center),
    ("08-notification-center", scene_notifications),
    ("09-ai-agent-chat", lambda c: scene_ai_chat(c, 3)),
    ("10-ai-agent-complete", lambda c: scene_ai_chat(c, 7)),
    ("11-terminal-neofetch", lambda c: scene_terminal(c)),
    ("12-powershell", lambda c: scene_terminal(c, title="PowerShell 7.4 — thadd", powershell=True)),
    ("13-files", scene_files),
    ("14-code-editor", scene_editor),
    ("15-security-center", lambda c: scene_security(c, False, 94)),
    ("16-security-scan-live", lambda c: scene_security(c, True, 78)),
    ("17-forensics-lab", lambda c: scene_forensics(c, 2)),
    ("18-dfir-cross-os", lambda c: scene_forensics(c, 3)),
    ("19-task-manager", scene_taskmgr),
    ("20-system-monitor", scene_monitor),
    ("21-settings-appearance", lambda c: scene_settings(c, "appearance")),
    ("22-settings-ai", lambda c: scene_settings(c, "ai")),
    ("23-app-store", lambda c: scene_store(c)),
    ("24-app-store-installing", lambda c: scene_store(c, "metasploit-framework")),
    ("25-snapshots", scene_snapshots),
    ("26-screen-recorder", lambda c: scene_recorder(c, True)),
    ("27-media-player", scene_media),
    ("28-multi-window", scene_multi),
    ("29-vms-windows-macos", scene_windows_compat),
    ("30-productivity-suite", scene_productivity),
    ("31-endcard", scene_endcard),
]


def render_snapshots(out_dir: str, width: int = WIDTH, height: int = HEIGHT, limit: int = 0) -> list[str]:
    """Render every scene to a PNG (the shell gallery)."""
    written = []
    scenes = SCENES[:limit] if limit else SCENES
    for name, fn in scenes:
        canvas = Canvas(width, height)
        fn(canvas)
        written.append(canvas.save(os.path.join(out_dir, f"{name}.png")))
    return written


def render_video(out_path: str, width: int = 1280, height: int = 720, seconds_per_scene: float = 1.6,
                 limit: int = 0, fps: int = FPS) -> dict:
    """Render the demo MP4 (H.264 via PyAV → ffmpeg binary → GIF fallback)."""
    scenes = SCENES[:limit] if limit else SCENES
    frames_per_scene = max(2, int(seconds_per_scene * fps))
    total_frames = frames_per_scene * len(scenes)
    mode = "unknown"

    def frames():
        for name, fn in scenes:
            base = Canvas(width, height)
            fn(base)
            for i in range(frames_per_scene):
                t = i / max(1, frames_per_scene - 1)
                img = base.img.copy()
                _animate(img, name, t, i, base)
                yield img

    try:
        import av  # type: ignore
        from PIL import Image  # noqa: F401

        container = av.open(out_path, mode="w")
        stream = container.add_stream("libx264", rate=fps)
        stream.width, stream.height, stream.pix_fmt = width, height, "yuv420p"
        try:
            stream.options = {"crf": "22", "preset": "veryfast", "profile": "high"}
        except Exception:
            pass
        import numpy as np  # type: ignore

        for img in frames():
            frame = av.VideoFrame.from_ndarray(np.array(img), format="rgb24")
            for packet in stream.encode(frame):
                container.mux(packet)
        for packet in stream.encode():
            container.mux(packet)
        container.close()
        mode = "pyav-h264"
    except Exception as exc:  # fallback chain
        ffmpeg = _find_ffmpeg()
        if ffmpeg:
            try:
                proc = subprocess.Popen(
                    [ffmpeg, "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{width}x{height}",
                     "-r", str(fps), "-i", "pipe:0", "-an", "-c:v", "libx264", "-preset", "veryfast",
                     "-crf", "22", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out_path],
                    stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                for img in frames():
                    proc.stdin.write(img.tobytes())
                proc.stdin.close()
                proc.wait(timeout=300)
                mode = "ffmpeg-h264"
            except Exception:
                mode = "failed"
        if mode in ("failed", "unknown"):
            gif = os.path.splitext(out_path)[0] + ".gif"
            images = list(frames())
            if images:
                images[0].save(gif, save_all=True, append_images=images[1:], duration=int(1000 / fps), loop=0,
                               optimize=True)
                return {"path": gif, "mode": "gif-fallback", "frames": len(images), "error": str(exc)[:200]}
            return {"path": "", "mode": "failed", "error": str(exc)[:300]}
    size = os.path.getsize(out_path) if os.path.exists(out_path) else 0
    return {"path": out_path, "mode": mode, "frames": total_frames, "bytes": size,
            "seconds": round(total_frames / fps, 2), "scenes": len(scenes)}


def _animate(img, name: str, t: float, index: int, canvas: "Canvas") -> None:
    """Subtle life: a moving cursor, and a fade for scene transitions."""
    from PIL import Image, ImageDraw

    d = ImageDraw.Draw(img, "RGBA")
    # cursor glide
    x = int(canvas.w * (0.32 + 0.28 * t))
    y = int(canvas.h * (0.55 - 0.10 * math.sin(t * math.pi)))
    d.polygon([(x, y), (x + 16, y + 13), (x + 7, y + 15), (x + 12, y + 26), (x + 6, y + 28), (x + 2, y + 17)],
              fill=(255, 255, 255, 235), outline=(20, 20, 30, 220))
    if index == 0 and t < 0.4:  # fade in
        alpha = int(255 * (1 - t / 0.4))
        overlay = Image.new("RGB", img.size, (4, 5, 12))
        img.paste(Image.blend(img, overlay, min(0.9, alpha / 255)), (0, 0))
    if name.endswith("endcard"):
        pass


def _find_ffmpeg() -> str:
    for candidate in ("ffmpeg", "/usr/lib/thadd/ffmpeg"):
        if subprocess.run(["which", candidate], capture_output=True).returncode == 0:
            return candidate
    try:
        import imageio_ffmpeg  # type: ignore

        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        return ""


def render_demo(session=None, out_path: str = "", seconds: int = 0, **_) -> dict:
    """Shell-callable wrapper: render the gallery + MP4 into the user's Pictures."""
    out_dir = Path.home() / "Pictures" / "THADD-OS-Demo"
    out_dir.mkdir(parents=True, exist_ok=True)
    mp4 = out_path or str(out_dir / "thadd-os-demo.mp4")
    shots = render_snapshots(str(out_dir / "snapshots"), limit=0)
    video = render_video(mp4, seconds_per_scene=(seconds or 1.6) / 2 if seconds else 1.6)
    manifest = {"generated": time.strftime("%Y-%m-%dT%H:%M:%S"), "snapshots": len(shots),
                "snapshot_dir": str(out_dir / "snapshots"), "video": video}
    (out_dir / "manifest.json").write_text(json.dumps(manifest, indent=1))
    return manifest
