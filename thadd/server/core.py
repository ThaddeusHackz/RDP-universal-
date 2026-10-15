"""
THADD OS — HTTP + WebSocket transport core.

* threading HTTP server (stdlib only — no asyncio, no third-party deps)
* static file serving with gzip + HTTP range support (needed for video/audio)
* WebSocket endpoint at ``/ws`` speaking a tiny JSON-RPC dialect
* REST mirror at ``/api/<method>`` so the desktop still works if a proxy
  strips WebSocket upgrades (this happens on several hosted previews)
* server → client event bus (metrics, notifications, AI streaming, automation)
"""

from __future__ import annotations

import gzip
import io
import json
import mimetypes
import os
import posixpath
import threading
import time
import traceback
import urllib.parse
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Callable

from . import ws as wsmod

mimetypes.add_type("application/javascript", ".js")
mimetypes.add_type("text/css", ".css")
mimetypes.add_type("image/svg+xml", ".svg")
mimetypes.add_type("application/wasm", ".wasm")
mimetypes.add_type("font/woff2", ".woff2")
mimetypes.add_type("video/mp4", ".mp4")


class RpcError(Exception):
    def __init__(self, message: str, code: str = "error"):
        super().__init__(message)
        self.message = message
        self.code = code


class Registry:
    """Method table for the desktop shell ↔ OS bridge."""

    def __init__(self) -> None:
        self._methods: dict[str, Callable] = {}
        self._doc: dict[str, str] = {}

    def register(self, name: str, fn: Callable) -> None:
        self._methods[name] = fn
        self._doc[name] = (fn.__doc__ or "").strip().splitlines()[0] if fn.__doc__ else ""

    def method(self, name: str):
        def deco(fn):
            self.register(name, fn)
            return fn

        return deco

    def names(self) -> list[str]:
        return sorted(self._methods)

    def describe(self) -> dict[str, str]:
        return dict(self._doc)

    def call(self, name: str, session: "Session", params: dict) -> Any:
        fn = self._methods.get(name)
        if fn is None:
            raise RpcError(f"unknown method: {name}", "no_method")
        return fn(session, **(params or {}))


class EventBus:
    """Fan-out of server-pushed events to every connected shell."""

    def __init__(self) -> None:
        self._subs: dict[str, set["Session"]] = {}
        self._lock = threading.RLock()
        self._hooks: list[Callable[[str, dict], None]] = []

    def add_hook(self, fn: Callable[[str, dict], None]) -> None:
        self._hooks.append(fn)

    def publish(self, event: str, data: dict | None = None) -> None:
        payload = data or {}
        for hook in list(self._hooks):
            try:
                hook(event, payload)
            except Exception:
                pass
        with self._lock:
            targets = list(self._subs.get(event, ())) + list(self._subs.get("*", ()))
        for sess in targets:
            sess.emit(event, payload)

    def subscribe(self, session: "Session", event: str) -> None:
        with self._lock:
            self._subs.setdefault(event, set()).add(session)

    def unsubscribe(self, session: "Session", event: str) -> None:
        with self._lock:
            self._subs.get(event, set()).discard(session)


class Session:
    """One connected desktop shell (or scripted demo driver)."""

    def __init__(self, conn: wsmod.WebSocket, bus: EventBus, remote: str = "?"):
        self.conn = conn
        self.bus = bus
        self.remote = remote
        self.id = wsmod.random_token(8)
        self.started = time.time()
        self._streams: dict[str, "Stream"] = {}
        self._send_lock = threading.Lock()
        self.state: dict[str, Any] = {}

    # ------------------------------------------------------------------ messaging
    def send(self, obj: dict) -> None:
        try:
            self.conn.send_text(json.dumps(obj, default=_json_default))
        except Exception:
            pass

    def emit(self, event: str, data: dict) -> None:
        self.send({"event": event, "data": data})

    def reply(self, msg_id, result=None, error=None) -> None:
        msg = {"id": msg_id}
        if error is not None:
            msg["ok"] = False
            msg["error"] = error
        else:
            msg["ok"] = True
            msg["result"] = result
        self.send(msg)

    def stream(self, stream_id: str, chunk: str) -> None:
        self.send({"stream": stream_id, "data": chunk})

    def stream_end(self, stream_id: str, meta: dict | None = None) -> None:
        self.send({"stream_end": stream_id, "meta": meta or {}})

    # ----------------------------------------------------------------- processing
    def handle(self, raw: str) -> None:
        try:
            msg = json.loads(raw)
        except json.JSONDecodeError:
            self.send({"event": "error", "data": {"message": "malformed json"}})
            return
        if isinstance(msg, list):
            for one in msg:
                self._handle_one(one)
            return
        self._handle_one(msg)

    def _handle_one(self, msg: dict) -> None:
        kind = msg.get("t") or "call"
        if kind == "call":
            self._dispatch(msg)
        elif kind == "subscribe":
            for ev in msg.get("events", []) or []:
                self.bus.subscribe(self, ev)
        elif kind == "unsubscribe":
            for ev in msg.get("events", []) or []:
                self.bus.unsubscribe(self, ev)
        elif kind == "stream_start":
            pass  # client-initiated streams are unused; streaming is server-side
        elif kind == "ping":
            self.send({"t": "pong", "ts": time.time()})

    def _dispatch(self, msg: dict) -> None:
        msg_id = msg.get("id")
        name = msg.get("method") or ""
        params = msg.get("params") or {}
        try:
            result = REGISTRY.call(name, self, params)
        except RpcError as exc:
            self.reply(msg_id, error={"code": exc.code, "message": exc.message})
        except TypeError as exc:
            self.reply(msg_id, error={"code": "params", "message": str(exc)})
        except Exception as exc:  # pragma: no cover - defensive
            tb = traceback.format_exc(limit=3)
            self.reply(msg_id, error={"code": "internal", "message": f"{exc}", "trace": tb})
        else:
            if result is _NOSEND:
                return
            self.reply(msg_id, result=result if result is not None else {})

    def close(self) -> None:
        for s in list(self._streams.values()):
            s.stop()
        self.conn.close()


class Stream:
    """A background producer that pushes chunks to one session (AI tokens,
    terminal output, scan progress…)."""

    def __init__(self, session: Session, stream_id: str, producer: Callable[["Stream"], None]):
        self.session = session
        self.id = stream_id
        self._stop = threading.Event()
        self._thread = threading.Thread(target=self._run, args=(producer,), daemon=True)
        self.meta: dict = {}

    def start(self) -> None:
        self._thread.start()

    def _run(self, producer) -> None:
        try:
            producer(self)
        except Exception as exc:  # pragma: no cover
            self.session.stream(self.id, f"\n[thadd] stream error: {exc}\n")
        finally:
            self.session.stream_end(self.id, self.meta)
            self.session._streams.pop(self.id, None)
            self._stop.set()

    def push(self, chunk: str) -> None:
        if not self._stop.is_set():
            self.session.stream(self.id, chunk)

    def stop(self) -> None:
        self._stop.set()


class _NoSend:
    __slots__ = ()


_NOSEND = _NoSend()

REGISTRY = Registry()
BUS = EventBus()


def _json_default(o):
    if isinstance(o, (set, tuple)):
        return list(o)
    if isinstance(o, Path):
        return str(o)
    if isinstance(o, bytes):
        return o.decode("utf-8", "replace")
    return str(o)


def json_dumps(obj) -> str:
    return json.dumps(obj, default=_json_default)


# --------------------------------------------------------------------------- HTTP
class THADDHandler(BaseHTTPRequestHandler):
    server_version = "THADD-OS/1.0"
    protocol_version = "HTTP/1.1"
    shell_dir: Path = Path(".")
    token: str = ""
    quiet: bool = False

    # ------------------------------------------------------------------ utilities
    def log_message(self, fmt, *args):  # noqa: D102 - quieter logs
        if not self.quiet:
            return

    def _send_json(self, obj, status: int = 200, extra: dict | None = None) -> None:
        body = json_dumps(obj).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(body)

    def _check_token(self) -> bool:
        if not self.token:
            return True
        q = urllib.parse.urlparse(self.path).query
        supplied = urllib.parse.parse_qs(q).get("token", [""])[0]
        if not supplied:
            supplied = self.headers.get("X-Thadd-Token", "")
        return supplied == self.token

    # ------------------------------------------------------------------------ GET
    def do_GET(self) -> None:  # noqa: N802
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        if path == "/healthz":
            self._send_json({"ok": True, "service": "thadd-server", "version": "1.0"})
            return
        if path == "/ws":
            if not self._check_token():
                self._send_json({"error": "bad token"}, 403)
                return
            self._serve_ws()
            return
        if path.startswith("/api/"):
            self._serve_rest(path[5:], parsed.query)
            return
        self._serve_static(path.lstrip("/"))

    def do_HEAD(self) -> None:  # noqa: N802
        self.do_GET()

    def do_POST(self) -> None:  # noqa: N802
        parsed = urllib.parse.urlparse(self.path)
        if not self._check_token():
            self._send_json({"error": "bad token"}, 403)
            return
        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(length) if length else b"{}"
        if parsed.path.startswith("/api/"):
            try:
                params = json.loads(raw or b"{}")
            except json.JSONDecodeError:
                self._send_json({"error": "malformed json"}, 400)
                return
            self._rpc_rest(parsed.path[5:], params)
            return
        self._send_json({"error": "not found"}, 404)

    # ------------------------------------------------------------------ REST mode
    def _serve_rest(self, method: str, query: str) -> None:
        params: dict[str, Any] = {}
        for k, v in urllib.parse.parse_qs(query).items():
            params[k] = v[0] if len(v) == 1 else v
        self._rpc_rest(method, params)

    def _rpc_rest(self, method: str, params: dict) -> None:
        key = threading.get_ident()
        sess = _SHIM_SESSIONS.get(key)
        if sess is None:
            sess = Session(_RESTShell(self), BUS, self.client_address[0])
            _SHIM_SESSIONS[key] = sess
            self._shim_key = key
        try:
            result = REGISTRY.call(method, sess, params or {})
        except RpcError as exc:
            self._send_json({"ok": False, "error": {"code": exc.code, "message": exc.message}}, 200)
        except Exception as exc:
            self._send_json({"ok": False, "error": {"code": "internal", "message": str(exc)}}, 200)
        else:
            self._send_json({"ok": True, "result": result if result is not None else {}})

    # ----------------------------------------------------------------- WebSocket
    def _serve_ws(self) -> None:
        key = self.headers.get("Sec-WebSocket-Key")
        if not key or not wsmod.is_ws_upgrade(self.headers):
            self._send_json({"error": "expected websocket upgrade"}, 400)
            return
        self.wfile.write(wsmod.handshake_response(key))
        self.wfile.flush()
        conn = wsmod.WebSocket(self.connection, self.rfile)
        session = Session(conn, BUS, self.client_address[0])
        REGISTRY.call("boot.hello", session, {}) if "boot.hello" in REGISTRY.names() else None
        BUS.publish("session.open", {"id": session.id})
        try:
            for kind, payload in conn.messages():
                if kind == "text":
                    session.handle(payload.decode("utf-8", "replace"))
        finally:
            session.close()
            BUS.publish("session.close", {"id": session.id})
        self.close_connection = True

    # --------------------------------------------------------------------- static
    def _serve_static(self, rel: str) -> None:
        if rel in ("", "/"):
            rel = "index.html"
        safe = posixpath.normpath("/" + rel).lstrip("/")
        if safe.startswith("..") or "\x00" in safe:
            self._send_json({"error": "bad path"}, 400)
            return
        target = (self.shell_dir / safe)
        try:
            if target.is_dir():
                target = target / "index.html"
            stat = target.stat()
        except (OSError, ValueError):
            self._send_json({"error": "not found", "path": safe}, 404)
            return
        if not target.is_file() or str(target).find(str(self.shell_dir)) != 0:
            self._send_json({"error": "not found"}, 404)
            return
        ctype = mimetypes.guess_type(str(target))[0] or "application/octet-stream"
        body = target.read_bytes()
        accepts_gzip = "gzip" in (self.headers.get("Accept-Encoding") or "")
        compressible = ctype.startswith(("text/", "application/json", "application/javascript", "image/svg"))
        # -------------------------------------------------------- HTTP range support
        rng = self.headers.get("Range") or ""
        if rng.startswith("bytes=") and stat.st_size:
            try:
                spec = rng[6:].split(",")[0]
                start_s, _, end_s = spec.partition("-")
                start = int(start_s) if start_s else 0
                end = int(end_s) if end_s else stat.st_size - 1
                end = min(end, stat.st_size - 1)
                if start > end:
                    raise ValueError
                chunk = body[start : end + 1]
                self.send_response(206)
                self.send_header("Content-Type", ctype)
                self.send_header("Content-Range", f"bytes {start}-{end}/{stat.st_size}")
                self.send_header("Accept-Ranges", "bytes")
                self.send_header("Content-Length", str(len(chunk)))
                self.send_header("Cache-Control", "public, max-age=3600")
                self.end_headers()
                if self.command != "HEAD":
                    self.wfile.write(chunk)
                return
            except ValueError:
                pass
        if accepts_gzip and compressible and len(body) > 1024:
            body = gzip.compress(body, 6)
            encoding = "gzip"
        else:
            encoding = None
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Accept-Ranges", "bytes")
        if ctype.startswith(("text/html", "application/javascript", "text/css")):
            self.send_header("Cache-Control", "no-cache")
        else:
            self.send_header("Cache-Control", "public, max-age=86400")
        if encoding:
            self.send_header("Content-Encoding", encoding)
            self.send_header("Vary", "Accept-Encoding")
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)


_SHIM_SESSIONS: dict[int, Session] = {}


class _RESTShell:
    """Stand-in for a WebSocket when a client only speaks REST."""

    def __init__(self, handler: THADDHandler):
        self.handler = handler

    def send_text(self, text: str) -> None:
        pass  # REST clients poll instead of receiving pushes

    def close(self) -> None:
        pass

    @property
    def closed(self) -> bool:
        return True


def make_server(host: str, port: int, shell_dir: str, token: str = "", quiet: bool = True):
    handler = type("BoundTHADDHandler", (THADDHandler,), {})
    handler.shell_dir = Path(shell_dir).resolve()
    handler.token = token
    handler.quiet = quiet
    httpd = ThreadingHTTPServer((host, port), handler)
    httpd.daemon_threads = True
    return httpd


def serve_forever(httpd: ThreadingHTTPServer) -> None:
    try:
        httpd.serve_forever(poll_interval=0.2)
    except KeyboardInterrupt:
        pass
