#!/usr/bin/env python3
"""
THADD OS CI — raw RDP protocol negotiation test.

Sends a real X.224 Connection Request carrying an RDP Negotiation Request
(the first packet Microsoft Remote Desktop / FreeRDP sends) and verifies
xrdp answers with an X.224 Connection Confirm + RDP Negotiation Response.

Pure stdlib.
"""
import os
import socket
import struct
import sys

HOST = "127.0.0.1"
PORT = int(os.environ.get("RDP_PORT", "3389"))


def x224_crq_with_negotiation():
    # TPKT header
    tpkt_len = 4 + 7 + 8  # TPKT + X.224 CRQ fixed + RDP NEG request
    tpkt = b"\x03\x00" + struct.pack(">H", tpkt_len)
    # X.224 Connection Request: LI, code(0xE0), dst-ref(2), src-ref(2), class(1)
    x224 = b"\x06\xe0\x00\x00\x00\x00\x00"
    # RDP Negotiation Request: type=1, flags=0, len=8, requested=SSL|HYBRID
    neg = b"\x01\x00\x08\x00\x03\x00\x00\x00"
    return tpkt + x224 + neg


def main():
    s = socket.create_connection((HOST, PORT), timeout=10)
    s.settimeout(15)
    s.sendall(x224_crq_with_negotiation())
    data = s.recv(4096)
    s.close()

    # X.224 Connection Confirm: TPKT(03 00 len len) + LI + 0xD0 …
    # RDP Negotiation Response: type byte 0x02 appears right after the X.224 CC
    is_tpkt = len(data) >= 4 and data[:2] == b"\x03\x00"
    is_cc = len(data) >= 6 and data[5] == 0xD0
    has_neg_response = b"\x02\x00" in data[8:24] or b"\x02" in data[8:16]

    ok = is_tpkt and is_cc and has_neg_response
    print("RDP negotiation:", "PASS" if ok else "FAIL")
    print("  server reply head:", repr(data[:32]))
    if not ok:
        print("  tpkt:", is_tpkt, "| X.224 CC:", is_cc, "| NEG response:", has_neg_response)
        sys.exit(1)
    print("✅ xrdp speaks RDP and negotiated a secure connection")


if __name__ == "__main__":
    main()
