#!/usr/bin/python3
"""THADD OS live init - PID 1 inside the initramfs.

Brings the machine up (proc, sys, dev, tmpfs), starts the THADD service, then
runs the desktop: the framebuffer GUI when the kernel gave us /dev/fb0, and a
full-screen text desktop on the console otherwise.  A shell is always available
on tty2 and on the serial port.
"""
from __future__ import annotations

import errno
import os
import platform
import signal
import subprocess
import sys
import time
from pathlib import Path

CONSOLE = "/dev/console"
THADD_SRC = "/opt/thadd"
SERVER_PORT = os.environ.get("THADD_PORT", "8080")
SHELL_DIR = "/opt/thadd/thadd/shell"
DESKTOP_CANDIDATES = ("/opt/thadd/thadd/desktop/main.py",
                      "/opt/thadd/desktop/main.py")
LOG = "/var/log/thadd-init.log"

VER = "1.0"

BANNER = r"""
   ████████╗██╗  ██╗ █████╗ ██████╗ ██████╗      ██████╗ ███████╗
   ╚══██╔══╝██║  ██║██╔══██╗██╔══██╗██╔══██╗    ██╔═══██╗██╔════╝
      ██║   ███████║███████║██║  ██║██║  ██║    ██║   ██║███████╗
      ██║   ██╔══██║██╔══██║██║  ██║██║  ██║    ██║   ██║╚════██║
      ██║   ██║  ██║██║  ██║██████╔╝██████╔╝    ╚██████╔╝███████║
      ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝ ╚═════╝      ╚═════╝ ╚══════╝
"""


def log(msg: str) -> None:
    line = f"[{time.strftime('%H:%M:%S')}] {msg}"
    for path in (CONSOLE, "/dev/tty1"):
        try:
            with open(path, "w") as fh:
                fh.write(line + "\n")
            break
        except OSError:
            continue
    try:
        Path(LOG).parent.mkdir(parents=True, exist_ok=True)
        with open(LOG, "a") as fh:
            fh.write(line + "\n")
    except OSError:
        pass


def run(cmd: list[str], **kw) -> subprocess.CompletedProcess:
    try:
        return subprocess.run(cmd, capture_output=True, text=True, timeout=60, **kw)
    except (OSError, subprocess.SubprocessError) as exc:
        return subprocess.CompletedProcess(cmd, 127, "", str(exc))


def mount(source: str, target: str, fstype: str = "", options: str = "") -> None:
    if os.path.ismount(target):
        return
    try:
        os.makedirs(target, exist_ok=True)
    except OSError:
        pass
    args = ["/usr/bin/mount"]
    if fstype:
        args += ["-t", fstype]
    if options:
        args += ["-o", options]
    args += [source, target]
    res = run(args)
    if res.returncode:
        log(f"mount {source} -> {target}: {res.stderr.strip()[:120]}")


def write(path: str, text: str) -> None:
    try:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w") as fh:
            fh.write(text)
    except OSError:
        pass


# --------------------------------------------------------------------------- #
def bring_up() -> None:
    mount("proc", "/proc", "proc")
    mount("sysfs", "/sys", "sysfs")
    mount("devtmpfs", "/dev", "devtmpfs", "mode=0755")
    mount("tmpfs", "/run", "tmpfs", "mode=0755")
    mount("tmpfs", "/tmp", "tmpfs", "mode=1777")
    mount("tmpfs", "/dev/shm", "tmpfs", "mode=1777")
    mount("devpts", "/dev/pts", "devpts", "mode=0620,gid=5")
    mount("tmpfs", "/var/lib/thadd", "tmpfs", "mode=0700")
    # a writable overlay-ish place for the live session
    os.makedirs("/home/thadd", exist_ok=True)

    write("/proc/sys/kernel/hostname", "thadd-os\n")
    for key, val in (("kernel.sysrq", "1"), ("kernel.printk", "4 4 1 7"),
                     ("vm.swappiness", "10")):
        try:
            path = "/proc/sys/" + key.replace(".", "/")
            with open(path, "w") as fh:
                fh.write(val)
        except OSError:
            pass
    # the live medium: mount the ISO so /media/cdrom works
    for dev in ("/dev/sr0", "/dev/sr1", "/dev/vda"):
        if Path(dev).exists():
            mount(dev, "/media/cdrom", "iso9660", "ro")
            break


def hardware() -> dict:
    info = {"cpu": platform.processor() or "x86_64", "cores": os.cpu_count() or 1}
    try:
        with open("/proc/meminfo") as fh:
            for line in fh:
                if line.startswith("MemTotal"):
                    info["mem_mb"] = int(line.split()[1]) // 1024
                    break
    except OSError:
        pass
    try:
        with open("/sys/class/graphics/fb0/virtual_size") as fh:
            info["fb"] = fh.read().strip()
    except OSError:
        pass
    info["gui"] = Path("/dev/fb0").exists()
    return info


# --------------------------------------------------------------------------- #
class Service:
    """A supervised child process that is restarted if it dies."""

    def __init__(self, name: str, argv: list[str], env: dict | None = None,
                 restart: bool = True, logfile: str | None = None):
        self.name, self.argv, self.env, self.restart = name, argv, env or {}, restart
        self.proc: subprocess.Popen | None = None
        self.restarts = 0
        self.logfile = logfile

    def start(self) -> None:
        env = dict(os.environ)
        env.update(self.env)
        out = open(self.logfile, "ab") if self.logfile else subprocess.DEVNULL
        try:
            self.proc = subprocess.Popen(self.argv, env=env, stdout=out, stderr=out,
                                         stdin=subprocess.DEVNULL, start_new_session=True)
            log(f"started {self.name} (pid {self.proc.pid})")
        except OSError as exc:
            log(f"cannot start {self.name}: {exc}")

    def poll(self) -> None:
        if self.proc and self.proc.poll() is not None:
            rc = self.proc.returncode
            self.proc = None
            if self.restart and self.restarts < 5:
                self.restarts += 1
                log(f"{self.name} exited ({rc}) - restarting")
                time.sleep(1)
                self.start()

    def stop(self) -> None:
        self.restart = False
        if self.proc and self.proc.poll() is None:
            self.proc.terminate()


def start_server(env: dict) -> Service:
    return Service("thadd-server",
                   [sys.executable, "-m", "thadd.server", "--host", "127.0.0.1",
                    "--port", SERVER_PORT, "--shell", SHELL_DIR, "--quiet"],
                   env=env, logfile="/var/log/thadd-server.log")


def shell_on(tty: str) -> Service:
    """A root shell on a VT or the serial line."""
    return Service(f"shell-{Path(tty).name}",
                   ["/usr/bin/setsid", "/bin/bash", "-l"],
                   env={"TERM": "linux", "HOME": "/root", "PS1": "thadd-os:~# "},
                   restart=False)


# --------------------------------------------------------------------------- #
def main() -> int:
    os.environ.update({
        "PATH": "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
        "HOME": "/root", "TERM": "linux", "LANG": "C.UTF-8", "LC_ALL": "C.UTF-8",
        "PYTHONPATH": THADD_SRC, "PYTHONDONTWRITEBYTECODE": "1",
        "THADD_DATA": "/var/lib/thadd", "THADD_OS": VER,
    })
    dead = signal.SIG_DFL
    for sig in (signal.SIGINT, signal.SIGTERM, signal.SIGHUP):
        signal.signal(sig, lambda *_: shutdown("signal"))
    signal.signal(signal.SIGCHLD, signal.SIG_DFL)

    print(BANNER, flush=True)
    print(f"  THADD OS {VER} (Nebula Prime) - One OS. All the Best.\n", flush=True)
    bring_up()

    hw = hardware()
    print(f"  cpu      : {hw['cpu']} ({hw['cores']} cores)", flush=True)
    print(f"  memory   : {hw.get('mem_mb', '?')} MB", flush=True)
    print(f"  console  : {'framebuffer ' + hw.get('fb', '') if hw['gui'] else 'text (vga/serial)'}",
          flush=True)
    print("", flush=True)

    services: list[Service] = [start_server(dict(os.environ))]
    for svc in services:
        svc.start()

    # the desktop: GUI on the framebuffer, text desktop otherwise
    desktop = next((p for p in DESKTOP_CANDIDATES if Path(p).exists()), None)
    if desktop:
        desktop_argv = [sys.executable, desktop, "--tty", "/dev/tty1"]
        if hw["gui"]:
            desktop_argv += ["--fb", "/dev/fb0"]
        else:
            desktop_argv += ["--text"]
        services.append(Service("thadd-desktop", desktop_argv,
                                logfile="/var/log/thadd-desktop.log"))
    else:
        log("no desktop binary yet - tty1 stays a console (the GUI is on :%s)" % SERVER_PORT)

    # always keep an escape hatch: a plain shell on tty2 and on the serial port
    for vt in ("/dev/tty2",):
        if Path(vt).exists():
            services.append(Service(f"shell{vt[-1]}", ["/bin/bash", "-l"],
                                    env={"TERM": "linux", "HOME": "/root"}, restart=False,
                                    logfile="/var/log/shell.log"))
    if Path("/dev/ttyS0").exists():
        services.append(Service("serial-shell", ["/sbin/agetty", "--autologin", "root",
                                                 "-a", "root", "115200", "ttyS0", "linux"],
                                restart=False))

    print("  THADD service : http://127.0.0.1:%s  (thadd status)" % SERVER_PORT, flush=True)
    print("  shells        : tty1 (desktop) · tty2 · ttyS0 · press Ctrl+Alt+F2", flush=True)
    print("", flush=True)

    for svc in services:
        svc.start()

    # ---------------------------------------------------------------- main loop
    while True:
        try:
            pid, status = os.waitpid(-1, os.WNOHANG)
            if pid == 0:
                time.sleep(0.5)
        except ChildProcessError:
            time.sleep(0.5)
        except OSError as exc:
            if exc.errno != errno.EINTR:
                time.sleep(0.5)
        for svc in services:
            svc.poll()


def shutdown(reason: str) -> None:
    log(f"shutting down ({reason})")
    run(["/usr/bin/sync"])
    for target in ("/dev/sr0", "/media/cdrom", "/dev/shm", "/dev/pts", "/run", "/tmp"):
        run(["/usr/bin/umount", "-l", target])
    for mode in ("o", "b"):
        try:
            with open("/proc/sysrq-trigger", "w") as fh:
                fh.write(mode)
            break
        except OSError:
            continue
    os._exit(0)


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        shutdown("interrupt")
    except Exception as exc:                      # never let PID 1 die silently
        import traceback
        traceback.print_exc()
        log(f"init crashed: {exc!r} - dropping to a shell")
        os.execv("/bin/bash", ["/bin/bash", "-l"])
