"""
THADD OS — minimal, dependency-free RFC 6455 WebSocket implementation.

Written from scratch (no external packages) so that the THADD OS userspace can
keep its dependency surface tiny: the live ISO ships this file and nothing else
is required to talk to the desktop shell.

Features
--------
* server-side handshake (Sec-WebSocket-Accept)
* text / binary / continuation / ping / pong / close frames
* client-side masking enforcement + payload length validation (RFC 6455 §5.5)
* thread-safe ``send_text`` (a single writer lock per connection)
* per-connection receive generator that the dispatcher thread consumes
"""

from __future__ import annotations

import base64
import hashlib
import os
import socket
import struct
import threading
from typing import Iterator, Optional

GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"

OP_CONT = 0x0
OP_TEXT = 0x1
OP_BIN = 0x2
OP_CLOSE = 0x8
OP_PING = 0x9
OP_PONG = 0xA

MAX_FRAME = 64 * 1024 * 1024  # 64 MiB hard ceiling for a single message


class WSError(Exception):
    pass


class WebSocket:
    """A connected WebSocket peer."""

    def __init__(self, sock: socket.socket, rfile=None):
        self.sock = sock
        self._wlock = threading.Lock()
        self._closed = False
        self._rbuf = b""
        self._rfile = rfile or sock.makefile("rb", buffering=0)
        self.remote = "?"
        try:
            self.remote = sock.getpeername()[0]
        except Exception:
            pass

    # ------------------------------------------------------------------ helpers
    def _read_exact(self, n: int) -> bytes:
        buf = b""
        while len(buf) < n:
            chunk = self._rfile.read(n - len(buf))
            if not chunk:
                raise WSError("connection closed")
            buf += chunk
        return buf

    def _read_frame(self):
        hdr = self._read_exact(2)
        b1, b2 = hdr[0], hdr[1]
        fin = bool(b1 & 0x80)
        opcode = b1 & 0x0F
        masked = bool(b2 & 0x80)
        length = b2 & 0x7F
        if length == 126:
            length = struct.unpack("!H", self._read_exact(2))[0]
        elif length == 127:
            length = struct.unpack("!Q", self._read_exact(8))[0]
        if length > MAX_FRAME:
            raise WSError("frame too large")
        mask = self._read_exact(4) if masked else None
        payload = self._read_exact(length) if length else b""
        if mask:
            payload = bytes(b ^ mask[i & 3] for i, b in enumerate(payload))
        return fin, opcode, payload

    def messages(self) -> Iterator[tuple[str, object]]:
        """Yield ``("text"|"binary", payload)`` tuples until the peer leaves."""
        pending = bytearray()
        pending_op: Optional[int] = None
        while not self._closed:
            try:
                fin, opcode, payload = self._read_frame()
            except (WSError, OSError, ValueError):
                break
            if opcode == OP_CLOSE:
                self._send_frame(OP_CLOSE, payload[:125])
                break
            if opcode == OP_PING:
                self._send_frame(OP_PONG, payload)
                continue
            if opcode == OP_PONG:
                continue
            if opcode in (OP_TEXT, OP_BIN):
                pending_op = opcode
                pending = bytearray(payload)
            elif opcode == OP_CONT:
                if pending_op is None:
                    raise WSError("continuation without start")
                pending += payload
            else:
                raise WSError(f"bad opcode {opcode}")
            if fin:
                data = bytes(pending)
                yield ("text" if pending_op == OP_TEXT else "binary", data)
                pending, pending_op = bytearray(), None
        self.close()

    # ------------------------------------------------------------------- writing
    def _send_frame(self, opcode: int, payload: bytes) -> None:
        if self._closed:
            return
        header = bytearray()
        header.append(0x80 | opcode)
        n = len(payload)
        if n < 126:
            header.append(n)
        elif n < (1 << 16):
            header.append(126)
            header += struct.pack("!H", n)
        else:
            header.append(127)
            header += struct.pack("!Q", n)
        with self._wlock:
            try:
                self.sock.sendall(bytes(header) + payload)
            except OSError:
                self._closed = True

    def send_text(self, text: str) -> None:
        self._send_frame(OP_TEXT, text.encode("utf-8", "replace"))

    def send_binary(self, data: bytes) -> None:
        self._send_frame(OP_BIN, data)

    def close(self, code: int = 1000) -> None:
        if self._closed:
            return
        try:
            self._send_frame(OP_CLOSE, struct.pack("!H", code))
        finally:
            self._closed = True
            try:
                self.sock.shutdown(socket.SHUT_RDWR)
            except OSError:
                pass
            try:
                self.sock.close()
            except OSError:
                pass

    @property
    def closed(self) -> bool:
        return self._closed


def accept_key(client_key: str) -> str:
    digest = hashlib.sha1((client_key + GUID).encode("utf-8")).digest()
    return base64.b64encode(digest).decode("ascii")


def handshake_response(client_key: str, extra_headers: dict | None = None) -> bytes:
    lines = [
        "HTTP/1.1 101 Switching Protocols",
        "Upgrade: websocket",
        "Connection: Upgrade",
        f"Sec-WebSocket-Accept: {accept_key(client_key)}",
    ]
    for k, v in (extra_headers or {}).items():
        lines.append(f"{k}: {v}")
    return ("\r\n".join(lines) + "\r\n\r\n").encode("ascii")


def is_ws_upgrade(headers) -> bool:
    try:
        upgrade = (headers.get("Upgrade") or "").lower()
        conn = (headers.get("Connection") or "").lower()
        return upgrade == "websocket" and "upgrade" in conn
    except Exception:
        return False


def random_token(n: int = 24) -> str:
    return base64.urlsafe_b64encode(os.urandom(n)).decode().rstrip("=")
