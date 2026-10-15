#!/usr/bin/env python3
"""Stage the THADD OS live root filesystem.

Takes the useful parts of the build host (shell, coreutils, Python, PIL, fonts),
resolves their shared-library dependencies with `ldd`, and lays everything out
in a merged-/usr tree that the initramfs builder then packs.

Nothing here needs root: it only reads from the host and writes into build/.
"""
from __future__ import annotations

import os
import shutil
import stat
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

# The build host is not always this Debian 12 box: derive the interpreter's
# version instead of hardcoding 3.11, so CI (Ubuntu 24.04, python 3.12) works too.
PY_VER = f"{sys.version_info.major}.{sys.version_info.minor}"
PY_BIN = f"python{PY_VER}"
PY_STDLIB = Path(f"/usr/lib/{PY_BIN}")
PY_SITE_DIRS = tuple(str(p) for p in (
    Path(f"/usr/local/lib/{PY_BIN}/dist-packages"),
    Path(f"/usr/local/lib/{PY_BIN}/site-packages"),
    Path(f"/usr/lib/{PY_BIN}/dist-packages"),
    Path(f"/usr/lib/python3/dist-packages"),
    Path(f"~/.local/lib/{PY_BIN}/site-packages").expanduser(),
))

# --------------------------------------------------------------------------- #
# what goes in

BINARIES = """
bash dash sh ls cat cp mv rm rmdir mkdir ln chmod chown chgrp touch stat file
df du head tail sort uniq wc cut tr tee paste join split date sleep hostname
id whoami groups uname arch env printenv which whereis pwd readlink realpath
basename dirname true false yes seq expr test timeout chroot printf echo
find findmnt xargs grep egrep fgrep sed awk gawk mawk
less more tar gzip gunzip zcat xz unxz bzip2 bunzip2 zip unzip
ps top free uptime vmstat iostat pidstat kill pkill pgrep killall watch nohup
mount umount findmnt lsblk blkid lscpu lsmem lsusb lspci dmesg hexdump od
ip ss ping ping4 traceroute nc netstat arp route
sha256sum sha512sum md5sum b2sum cksum dd truncate mktemp install diff cmp patch
strings objdump readelf nm size addr2line xxd base64 base32 openssl
curl wget python3 git nano vi vim ed joe
clear reset tput stty setterm kbdcontrol
sudo su login passwd useradd groupadd hostnamectl timedatectl localectl mountpoint
sync agetty setsid logger wall on_ac_power fbset
""".split()

# Python modules that are worth their bytes, minus test suites and IDEs.
PY_DROP_DIRS = {"test", "tests", "idlelib", "tkinter", "lib2to3", "ensurepip",
                "distutils", "pydoc_data", "site-packages", "unittest", "__pycache__"}
PY_DROP_FILES = {"__pycache__"}

# Distribution packages whose files we copy wholesale (site-packages style).
DIST_PACKAGES = ["PIL"]          # image library used by the desktop + renderer


# --------------------------------------------------------------------------- #
def sh(cmd: list[str]) -> str:
    try:
        return subprocess.run(cmd, capture_output=True, text=True, check=False).stdout
    except FileNotFoundError:
        return ""


def ldd_deps(path: Path) -> list[Path]:
    """Return the shared libraries an ELF file needs (absolute paths on the host)."""
    out = sh(["ldd", str(path)])
    deps: list[Path] = []
    for line in out.splitlines():
        line = line.strip()
        if "=>" in line:
            parts = line.split("=>")
            target = parts[1].strip().split(" ")[0]
            if target.startswith("/"):
                deps.append(Path(target))
        elif line.startswith("/") and "(" in line:
            deps.append(Path(line.split(" ")[0]))
    return deps


class Stager:
    def __init__(self, dest: Path):
        self.dest = dest
        self.copied: dict[str, int] = {}
        self.bytes = 0
        self.missing: list[str] = []
        if dest.exists():
            shutil.rmtree(dest)
        dest.mkdir(parents=True)

    # ---------------------------------------------------------------- helpers
    def target(self, src: Path) -> Path:
        return self.dest / src.relative_to("/")

    def mkdirs(self, rel: str) -> Path:
        p = self.dest / rel
        p.mkdir(parents=True, exist_ok=True)
        return p

    def copy(self, src: Path, *, symlink_ok: bool = True) -> Path | None:
        """Copy one host file (following /usr-merge style layout)."""
        src = Path(os.path.realpath(src)) if not src.is_symlink() else src
        if not src.exists():
            self.missing.append(str(src))
            return None
        if symlink_ok and src.is_symlink():
            link = os.readlink(src)
            dst = self.target(src)
            dst.parent.mkdir(parents=True, exist_ok=True)
            if not dst.exists():
                os.symlink(link, dst)
            return dst
        dst = self.target(Path(os.path.realpath(src)))
        if str(dst) in self.copied:
            return dst
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)
        self.copied[str(dst)] = src.stat().st_size
        self.bytes += src.stat().st_size
        return dst

    def copy_dep(self, name: Path) -> None:
        """Copy a shared library *and* keep its SONAME alias, so the dynamic
        loader finds libz.so.1 next to the real libz.so.1.2.13."""
        real = Path(os.path.realpath(name))
        if self.copy(real) is None:
            return
        if str(name) != str(real):
            dst = self.dest / str(name).lstrip("/")
            if not dst.exists():
                dst.parent.mkdir(parents=True, exist_ok=True)
                try:
                    os.symlink(str(real), dst)
                    self.copied[str(dst)] = 0
                except OSError:
                    pass

    def copy_tree(self, src_dir: Path, drop: set[str] | None = None,
                  match: tuple[str, ...] | None = None,
                  dest_rel: str | None = None) -> None:
        """Copy a directory tree.  `dest_rel` overrides where it lands in the
        rootfs (default: keep the host path, i.e. /home/user/... -> same path)."""
        drop = drop or set()
        base = Path(dest_rel) if dest_rel else src_dir.relative_to("/")
        for dirpath, dirnames, filenames in os.walk(src_dir):
            dirnames[:] = sorted(d for d in dirnames if d not in drop)
            rel = Path(dirpath).relative_to(src_dir)
            (self.dest / base / rel).mkdir(parents=True, exist_ok=True)
            for name in sorted(filenames):
                if name in drop or name.endswith(".pyc"):
                    continue
                if match and not name.endswith(match):
                    continue
                p = Path(dirpath) / name
                if p.is_symlink():
                    link = os.readlink(p)
                    dst = self.dest / base / rel / name
                    if not dst.exists():
                        os.symlink(link, dst)
                    continue
                if p.is_dir():
                    continue
                try:
                    dst = self.dest / base / rel / name
                    dst.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(p, dst)
                    self.copied[str(dst)] = p.stat().st_size
                    self.bytes += p.stat().st_size
                except (OSError, shutil.SameFileError):
                    pass

    # ----------------------------------------------------------------- layout
    def write(self, rel: str, text: str, mode: int = 0o644) -> None:
        p = self.dest / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(text)
        os.chmod(p, mode)

    def symlink(self, link_rel: str, target: str) -> None:
        p = self.dest / link_rel
        p.parent.mkdir(parents=True, exist_ok=True)
        if not p.exists():
            os.symlink(target, p)
        self.copied[str(p)] = 0

    def build(self) -> dict:
        d = self.dest
        for sub in ("usr/bin", "usr/sbin", "usr/lib", "usr/lib64", "usr/share",
                    "usr/local/lib", "proc", "sys", "dev", "tmp", "run", "root",
                    "home/thadd", "etc", "media", "mnt", "opt", "srv", "var/log",
                    "var/tmp", "var/run", "var/lib", "boot"):
            self.mkdirs(sub)

        # merged-/usr layout like every modern distribution
        for link, target in (("bin", "usr/bin"), ("sbin", "usr/sbin"),
                             ("lib", "usr/lib"), ("lib64", "usr/lib64")):
            self.symlink(link, target)

        # 1. binaries (+ their libraries)
        for name in BINARIES:
            path = shutil.which(name)
            if not path:
                continue
            p = Path(path)
            real = Path(os.path.realpath(p))
            self.copy(real)
            for dep in ldd_deps(real):
                self.copy_dep(dep)

        # 2. the loader + glibc support files
        for extra in ("/lib64/ld-linux-x86-64.so.2", "/lib/x86_64-linux-gnu/ld-linux-x86-64.so.2"):
            if Path(extra).exists():
                self.copy(Path(os.path.realpath(extra)))
        # ELF binaries on Debian ask for /lib64/ld-linux-x86-64.so.2 - keep that
        # path working inside the guest (merged-/usr symlink chain).
        self.symlink("usr/lib64/ld-linux-x86-64.so.2", "/lib/x86_64-linux-gnu/ld-linux-x86-64.so.2")
        for support in ("/etc/nsswitch.conf", "/etc/ld.so.cache", "/etc/ld.so.conf",
                        "/etc/protocols", "/etc/services", "/etc/mime.types",
                        "/etc/terminfo", "/usr/lib/terminfo",
                        "/etc/inputrc", "/etc/bash.bashrc", "/etc/profile"):
            p = Path(support)
            if p.is_dir():
                self.copy_tree(p)
            elif p.exists():
                self.copy(Path(os.path.realpath(p)))

        # 2b. /etc/skel: the small dotfiles only.  CI hosts keep entire SDKs in
        #     there (GitHub's /etc/skel holds a 208 MB Rust/LLVM toolchain), and
        #     copying that into a live image is how a 56 MB ISO becomes 413 MB.
        skel = Path("/etc/skel")
        if skel.is_dir():
            self.mkdirs("etc/skel")
            for entry in sorted(skel.iterdir()):
                try:
                    if entry.is_dir() or entry.is_symlink() or entry.stat().st_size > 128 * 1024:
                        continue
                except OSError:
                    continue
                dst = self.dest / "etc" / "skel" / entry.name
                try:
                    shutil.copy2(entry, dst)
                    self.copied[str(dst)] = entry.stat().st_size
                    self.bytes += entry.stat().st_size
                except OSError:
                    pass

        # 3. Python
        for py in (f"/usr/bin/{PY_BIN}", "/usr/bin/python3"):
            if Path(py).exists():
                self.copy(Path(os.path.realpath(p)))
        for lib in Path("/usr/lib/x86_64-linux-gnu").glob("libpython3*.so*"):
            self.copy(Path(os.path.realpath(lib)))
        # /usr/bin/python3 is only a symlink on the host - the guest needs it too
        self.symlink("usr/bin/python3", PY_BIN)
        self.symlink("usr/bin/python", PY_BIN)
        if PY_STDLIB.is_dir():
            self.copy_tree(PY_STDLIB, drop=PY_DROP_DIRS)

        # 4. installed Python packages we actually use (PIL, and its libs) -
        #    only what the desktop/renderer imports, never the whole site tree.
        site_rel = f"usr/local/lib/{PY_BIN}/dist-packages"
        for pkg in DIST_PACKAGES:
            for base in PY_SITE_DIRS:
                src = Path(base) / pkg
                if src.is_dir():
                    self.copy_tree(src, dest_rel=f"{site_rel}/{pkg}")
                    break
            # Pillow's bundled native libs ("pillow.libs" on recent wheels)
            for base in PY_SITE_DIRS:
                for libdir in Path(base).glob(PIL_LIBS_GLOB):
                    self.copy_tree(libdir, dest_rel=f"{site_rel}/{libdir.name}")
        for base in PY_SITE_DIRS:
            for so in Path(base).glob("PIL/*.so"):
                for dep in ldd_deps(so):
                    self.copy_dep(dep)
        # 5. fonts for the desktop compositor
        fonts = Path("/usr/share/fonts/truetype/dejavu")
        if fonts.is_dir():
            self.copy_tree(fonts)
        self.mkdirs("usr/share/fonts/truetype")

        # 6. THADD itself: the package is importable as `thadd` with
        #    PYTHONPATH=/opt/thadd, so `python3 -m thadd.server` works anywhere.
        self.copy_tree(ROOT / "thadd", dest_rel="opt/thadd/thadd",
                       drop={"__pycache__", ".git"})
        self.mkdirs("opt/thadd")
        for extra in ("README.md", "docs", "assets"):
            src = ROOT / extra
            if src.is_dir():
                self.copy_tree(src, dest_rel=f"opt/thadd/{extra}")
            elif src.exists():
                dst = d / "opt" / "thadd" / extra
                dst.parent.mkdir(parents=True, exist_ok=True)
                try:
                    shutil.copy2(src, dst)
                    self.copied[str(dst)] = src.stat().st_size
                    self.bytes += src.stat().st_size
                except OSError:
                    pass
        init_src = ROOT / "thadd" / "boot" / "live" / "init.py"
        if init_src.exists():
            shutil.copy2(init_src, d / "init")
            os.chmod(d / "init", 0o755)
            self.copied[str(d / "init")] = init_src.stat().st_size
            self.bytes += init_src.stat().st_size

        # 7. /etc personality
        self.write("etc/hostname", "thadd-os\n")
        self.write("etc/hosts", "127.0.0.1\tlocalhost thadd-os\n::1\tlocalhost\n")
        self.write("etc/resolv.conf", "nameserver 1.1.1.1\nnameserver 9.9.9.9\n")
        self.write("etc/passwd",
                   "root:x:0:0:root:/root:/bin/bash\n"
                   "thadd:x:1000:1000:THADD OS user:/home/thadd:/bin/bash\n")
        self.write("etc/group", "root:x:0:\nthadd:x:1000:\nwheel:x:10:thadd\nsudo:x:27:thadd\n")
        self.write("etc/shadow", "root:*:19000:0:99999:7:::\nthadd:*:19000:0:99999:7:::\n", 0o600)
        self.write("etc/fstab", "# THADD OS loads itself from the live media\n")
        self.write("etc/machine-id", "0123456789abcdef0123456789abcdef\n")
        self.write("etc/os-release",
                   'NAME="THADD OS"\n'
                   'PRETTY_NAME="THADD OS 1.0 (Nebula Prime)"\n'
                   'ID=thadd-os\nID_LIKE="debian ubuntu arch"\n'
                   'VERSION_ID="1.0"\nVERSION_CODENAME=nebula\n'
                   'HOME_URL="https://github.com/ThaddeusHackz/RDP-universal-"\n'
                   'ANSI_COLOR="38;2;137;180;250"\n')
        self.write("etc/issue", "\n  THADD OS 1.0 (Nebula Prime) - \\l\n\n")
        self.write("etc/profile",
                   "export PS1='\\[\\e[38;5;111m\\]thadd@thadd-os\\[\\e[0m\\]:\\w\\$ '\n"
                   "export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin\n"
                   "export THADD_OS=1 THADD_DATA=/var/lib/thadd PYTHONPATH=/opt/thadd\n"
                   "alias ll='ls -alF'\n"
                   "command -v thadd-status >/dev/null && thadd-status\n")
        self.write("etc/bash.bashrc", "[ -f /etc/profile ] && . /etc/profile\n")
        self.write("etc/motd",
                   "\n  THADD OS 1.0 (Nebula Prime) - One OS. All the Best.\n"
                   "  Type 'thadd' for the toolbox, 'thadd-ai' for the assistant.\n\n")

        # guest-side helper commands
        self.write("usr/bin/thadd", THADD_CLI, 0o755)
        self.write("usr/bin/thadd-status", THADD_STATUS, 0o755)
        self.write("usr/bin/thadd-ai", "#!/bin/bash\nexec python3 -m thadd.server \"$@\"\n", 0o755)
        self.write("usr/bin/thadd-desktop", "#!/bin/bash\nexec python3 /opt/thadd/thadd/desktop/main.py \"$@\"\n", 0o755)
        self.write("usr/sbin/adduser", "#!/bin/sh\necho 'user management is disabled on the live media'\n", 0o755)

        return {"files": len(self.copied), "bytes": self.bytes, "missing": self.missing}


PIL_LIBS_GLOB = "PIL.libs"

THADD_CLI = r"""#!/usr/bin/env python3
""" + '"""' + r"""THADD OS toolbox - one command for everything on this machine.""" + '"""' + r"""
import json, os, subprocess, sys, urllib.request

PORT = os.environ.get("THADD_PORT", "8080")

def rpc(method, params=None):
    body = json.dumps(params or {}).encode()
    req = urllib.request.Request(f"http://127.0.0.1:{PORT}/api/{method}", body,
                                 {"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as fh:
        data = json.load(fh)
    if not data.get("ok"):
        raise SystemExit(f"error: {data.get('error', {}).get('message', 'unknown')}")
    return data["result"]

def main(argv):
    if len(argv) < 2:
        print("THADD OS toolbox")
        print("  thadd status            system + service state")
        print("  thadd security posture  security score and fixes")
        print("  thadd scan quick        run a security scan")
        print("  thadd dfir /dev/sdX     forensic analysis of a disk or image")
        print("  thadd ai \"...\"          ask the OS assistant")
        print("  thadd snapshot create   make a restore point")
        print("  thadd iso build         build a new THADD OS ISO from source")
        print("  thadd help")
        return 0
    cmd = argv[1]
    if cmd == "status":
        for line in json.dumps(rpc("system.info"), indent=2).splitlines():
            print(line)
    elif cmd == "security":
        print(json.dumps(rpc("security.posture"), indent=2))
    elif cmd == "scan":
        kind = argv[2] if len(argv) > 2 else "quick"
        print(json.dumps(rpc("security.scan", {"kind": kind}), indent=2))
    elif cmd == "dfir":
        path = argv[2] if len(argv) > 2 else ""
        print(json.dumps(rpc("security.analyze_image", {"path": path}), indent=2))
    elif cmd == "ai":
        prompt = " ".join(argv[2:])
        print(json.dumps(rpc("ai.local", {"prompt": prompt}), indent=2))
    elif cmd == "snapshot":
        print(json.dumps(rpc("snapshots.create", {"label": "cli"}), indent=2))
    elif cmd in ("iso", "build"):
        return subprocess.call(["python3", "-m", "thadd.boot.assemble_iso", *argv[2:]])
    else:
        print(__doc__)
    return 0

if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
"""

THADD_STATUS = """#!/bin/sh
echo "THADD OS 1.0 (Nebula Prime)"
uname -srm
echo
echo "services:"
pgrep -a python3 | sed 's/^/  /'
echo
if command -v thadd >/dev/null; then
  thadd status 2>/dev/null | head -20
fi
"""


def main(argv: list[str]) -> int:
    dest = Path(argv[1]) if len(argv) > 1 else ROOT / "build" / "live" / "rootfs"
    st = Stager(dest)
    info = st.build()
    print(f"  rootfs     {info['files']:>6} files  {info['bytes'] / 1e6:8.1f} MB  -> {dest}")
    if info["missing"]:
        print(f"             ({len(info['missing'])} optional paths were not present on this host)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
