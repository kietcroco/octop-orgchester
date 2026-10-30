"""Local webhook receiver: prints every delivery and appends it to a JSONL log.

    python octop-orchester/scripts/webhook_receiver.py
    python octop-orchester/scripts/webhook_receiver.py --port 9100 --log webhook.log
    python octop-orchester/scripts/webhook_receiver.py --secret whsec_...   # verify HMAC

Runs on the *host*; the container reaches it at ``http://host.docker.internal:<port>/hook``.
That host must be listed in ``OCTOP_WEBHOOK_ALLOW_HOSTS`` (compose passes it through),
otherwise the SSRF guard in ``validate_url`` rejects the URL when you save the endpoint.

Stdlib only. Ctrl-C to stop; the log file is kept.
"""
from __future__ import annotations

import argparse
import hashlib
import hmac
import json
import pathlib
import sys
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

REQUIRED = ("id", "type", "phase", "thread_id", "agent_id", "seq", "data")


def verify(secret: str, headers: dict[str, str], body: str) -> str:
    """``ok`` / ``bad`` / ``-`` (no secret supplied)."""
    if not secret:
        return "-"
    ts = headers.get("X-Octop-Timestamp", "")
    want = "sha256=" + hmac.new(
        secret.encode(), f"{ts}.{body}".encode(), hashlib.sha256
    ).hexdigest()
    return "ok" if hmac.compare_digest(want, headers.get("X-Octop-Signature", "")) else "bad"


def check_expect(expect: list[str], headers: dict[str, str]) -> str:
    """``ok`` / ``bad: Name,...`` / ``-`` (nothing expected).

    Values are compared here rather than logged, so a bearer token can be proven
    to have arrived without being written to the JSONL file.
    """
    if not expect:
        return "-"
    seen = {k.lower(): v for k, v in headers.items()}
    bad = []
    for item in expect:
        name, _, want = item.partition(":")
        name, want = name.strip(), want.strip()
        if seen.get(name.lower()) != want:
            bad.append(name)
    return "ok" if not bad else "bad: " + ",".join(bad)


def make_handler(log: pathlib.Path, secret: str, expect: list[str]):
    lock = __import__("threading").Lock()

    class Handler(BaseHTTPRequestHandler):
        def do_POST(self) -> None:  # noqa: N802
            n = int(self.headers.get("Content-Length") or 0)
            raw = self.rfile.read(n).decode("utf-8", "replace")
            headers = {k: v for k, v in self.headers.items()}
            sig = verify(secret, headers, raw)
            expect_result = check_expect(expect, headers)
            try:
                envelope = json.loads(raw)
            except ValueError:
                envelope = {}
            missing = [k for k in REQUIRED if k not in envelope]
            record = {
                "received_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
                "path": self.path,
                # Names only: a custom header usually carries a bearer token,
                # and this file is a plain-text log on disk. Values are checked
                # against --expect instead of being written out.
                "headers": sorted(headers),
                "expect": expect_result,
                "event": headers.get("X-Octop-Event", ""),
                "delivery": headers.get("X-Octop-Delivery", ""),
                "signature": sig,
                "envelope": envelope if envelope else raw,
            }
            with lock, log.open("a", encoding="utf-8") as fh:
                fh.write(json.dumps(record, ensure_ascii=False) + "\n")
            body = envelope if isinstance(envelope, dict) else {}
            print(
                f"{record['received_at']}  {record['event']:32s} "
                f"phase={body.get('phase', '?'):9s} seq={body.get('seq', '?'):>3} "
                f"agent={body.get('agent_id', '?'):12s} sig={sig}"
                + (f"  MISSING={','.join(missing)}" if missing else "")
                + (f"  {expect_result}" if expect_result != "-" else ""),
                flush=True,
            )
            self.send_response(200)
            self.send_header("Content-Length", "2")
            self.end_headers()
            self.wfile.write(b"ok")

        def do_GET(self) -> None:  # noqa: N802
            # Handy to confirm the host is reachable from inside the container.
            self.send_response(200)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.end_headers()
            self.wfile.write(b"octop webhook receiver up\n")

        def log_message(self, *args: object) -> None:
            return

    return Handler


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    # Loopback by default: delivery bodies carry agent conversation content, so
    # do not put this on the LAN unless you mean to. Docker Desktop still reaches
    # host.docker.internal -> host 127.0.0.1.
    ap.add_argument("--host", default="127.0.0.1", help="bind address (default: loopback)")
    ap.add_argument("--port", type=int, default=9100)
    ap.add_argument("--log", default="webhook-received.jsonl", help="JSONL output path")
    ap.add_argument("--secret", default="", help="endpoint signing secret, enables HMAC check")
    ap.add_argument(
        "--expect",
        action="append",
        default=[],
        metavar="NAME:VALUE",
        help="custom header to verify on every delivery, e.g. --expect 'Authorization: Bearer x'"
        " (repeatable; the value is never written to the log)",
    )
    args = ap.parse_args()

    log = pathlib.Path(args.log).resolve()
    log.parent.mkdir(parents=True, exist_ok=True)
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    httpd = ThreadingHTTPServer(
        (args.host, args.port), make_handler(log, args.secret, args.expect)
    )
    print(f"listening on http://{args.host}:{args.port}/hook")
    print(f"container URL: http://host.docker.internal:{args.port}/hook")
    print(f"log: {log}")
    if not args.secret:
        print("no --secret given: signatures are recorded but not verified")
    if args.expect:
        print(f"verifying {len(args.expect)} expected header(s)")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nstopped")
    finally:
        httpd.server_close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
