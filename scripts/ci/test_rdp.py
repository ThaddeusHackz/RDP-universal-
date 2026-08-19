#!/usr/bin/env python3
"""
THADD OS CI — raw RDP protocol negotiation test.

Sends a real X.224 Connection Request carrying an RDP Negotiation Request
(the first packet Microsoft Remote Desktop / FreeRDP sends) and verifies
xrdp answers with an X.224 Connection Confirm + RDP Negotiation Response.

Pure stdlib. Every failure is emitted as a GitHub Actions annotation with
the exact wire bytes, so the root cause is readable from the run summary
even when raw action logs are unavailable.
"""
import os
import shutil
import socket
import struct
import subprocess
import sys

HOST = "127.0.0.1"
PORT = int(os.environ.get("RDP_PORT", "3389"))

NEG_FAILURE_CODES = {
    1: "SSL_REQUIRED_BY_SERVER",
    2: "SSL_NOT_ALLOWED_BY_SERVER",
    3: "SSL_CERT_NOT_ON_SERVER",
    4: "INCONSISTENT_FLAGS",
    5: "HYBRID_REQUIRED_BY_SERVER",
    6: "SSL_WITH_USER_AUTH_FAILED",
}


def annotate(title, body):
    body = body.replace("%", "%25").replace("\r", " ").replace("\n", "|")
    print(f"::error title={title}::{body[:3000]}", flush=True)


def dump_container_diagnostics():
    """Surface in-container xrdp forensics as workflow annotations on failure."""
    if not shutil.which("docker"):
        return
    probes = {
        "xrdp.log tail": "docker exec thadd sh -c 'tail -n 40 /var/log/xrdp.log 2>&1'",
        "xrdp-sesman.log tail": "docker exec thadd sh -c 'tail -n 40 /var/log/xrdp-sesman.log 2>&1'",
        "cert material": "docker exec thadd sh -c 'ls -la /etc/xrdp/ 2>&1; grep -E \"^(certificate|key_file|security_layer|crypt_level)=\" /etc/xrdp/xrdp.ini 2>&1; openssl x509 -in /etc/xrdp/cert.pem -noout -subject -dates 2>&1'",
        "xrdp listeners": "docker exec thadd sh -c 'ss -tlnp 2>/dev/null | grep -E \"3389|3350\" || true'",
    }
    for title, cmd in probes.items():
        try:
            out = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=45)
            body = (out.stdout + out.stderr).strip()
        except Exception as e:
            body = f"probe failed: {e}"
        if body:
            annotate(f"THADD-CI rdp diag: {title}", body)


def fail(title, detail):
    print(f"FAIL — {detail}", flush=True)
    annotate(title, detail)
    dump_container_diagnostics()
    sys.exit(1)


def x224_crq_with_negotiation():
    # TPKT header
    tpkt_len = 4 + 7 + 8  # TPKT + X.224 CRQ fixed + RDP NEG request
    tpkt = b"\x03\x00" + struct.pack(">H", tpkt_len)
    # X.224 Connection Request: LI, code(0xE0), dst-ref(2), src-ref(2), class(1)
    x224 = b"\x06\xe0\x00\x00\x00\x00\x00"
    # RDP Negotiation Request: type=1, flags=0, len=8, requested=SSL|HYBRID
    neg = b"\x01\x00\x08\x00\x03\x00\x00\x00"
    return tpkt + x224 + neg


def parse_reply(data: bytes) -> str:
    """Classify xrdp's first reply into a human-readable verdict."""
    hexs = data.hex(" ") if data else "(no data)"
    if not data:
        return "empty reply — xrdp closed the connection without answering"
    if not (len(data) >= 4 and data[:2] == b"\x03\x00"):
        return f"not a TPKT reply: {hexs}"
    if len(data) < 6 or data[5] != 0xD0:
        return f"TPKT but not an X.224 Connection Confirm: {hexs}"
    # find the RDP negotiation structure after the X.224 CC header
    if len(data) >= 13:
        ntype = data[11]
        if ntype == 0x02 and len(data) >= 19:
            selected = struct.unpack("<I", data[15:19])[0]
            proto = {1: "SSL/TLS", 2: "HYBRID (CredSSP/NLA)", 4: "RDSTLS"}.get(
                selected, f"unknown({selected})"
            )
            return f"OK — RDP NEG RESPONSE, server selected {proto}"
        if ntype == 0x03 and len(data) >= 19:
            code = struct.unpack("<I", data[15:19])[0]
            return (
                "xrdp answered RDP NEG FAILURE: "
                f"{NEG_FAILURE_CODES.get(code, f'code {code}')} — raw: {hexs}"
            )
    return f"X.224 CC but unrecognized negotiation payload: {hexs}"


def main():
    try:
        s = socket.create_connection((HOST, PORT), timeout=10)
    except OSError as e:
        fail("THADD-CI rdp", f"cannot connect to {HOST}:{PORT}: {e}")
    s.settimeout(15)
    try:
        s.sendall(x224_crq_with_negotiation())
        data = s.recv(4096)
    except OSError as e:
        fail("THADD-CI rdp", f"socket error during negotiation: {e}")
    finally:
        s.close()

    verdict = parse_reply(data)
    print("RDP negotiation:", "PASS" if verdict.startswith("OK") else "FAIL", flush=True)
    print("  server reply head:", repr(data[:32]), flush=True)
    print("  verdict:", verdict, flush=True)
    if not verdict.startswith("OK"):
        annotate("THADD-CI rdp negotiation", verdict)
        dump_container_diagnostics()
        sys.exit(1)
    print("✅ xrdp speaks RDP and negotiated a secure connection", flush=True)


if __name__ == "__main__":
    main()
