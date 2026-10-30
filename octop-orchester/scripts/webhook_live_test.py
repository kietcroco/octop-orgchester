"""Live check: real agent turn -> real outbox -> real dispatcher -> local receiver.

    docker cp octop-orchester/scripts/webhook_live_test.py octop-orchester:/tmp/
    docker exec -e OCTOP_PW=... octop-orchester python /tmp/webhook_live_test.py

Runs *inside* the container: the endpoint is created through the public API
(so ``validate_url`` is exercised), then its stored URL is repointed at a
loopback receiver in the same container — the only way to observe deliveries
from a local test without exposing them to the internet. Everything after the
URL swap is the production path: WebhookSink -> outbox -> WebhookDispatcher ->
signed POST.

Requires the server to be running and an agent named ``WH-expert`` to exist.
"""
from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
import os
import pathlib
import sqlite3
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import httpx
import websockets

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BASE = "http://127.0.0.1:9088"
DB = pathlib.Path("/data/.octop/octop.db")
AGENT_ID = os.environ.get("OCTOP_TEST_AGENT", "WH-expert")
PASSWORD = os.environ["OCTOP_PW"]

# What one dashboard turn can produce for an agent with a system prompt, no MCP
# servers and no compaction. The rest of the catalogue (connectors.loaded,
# context.compacted) needs an MCP server or a compacted thread; webhook_e2e.py
# covers those with a synthetic feed. ``agent.message.delta`` is not asserted:
# it only appears when two tokens land more than 50 ms apart.
LEDGER_TYPES = {
    "agent.conversation.started",
    "agent.context.memory",
    "agent.skills.loaded",
    "agent.message.received",
    "agent.message.started",
    "agent.message.completed",
    "agent.message.tool_only",
    "agent.tool.started",
    "agent.tool.delta",
    "agent.tool.completed",
}
# Bypasses the outbox, POSTed synchronously by the router with a synthetic event.
TEST_TYPE = "agent.webhook.test"


class Receiver:
    def __init__(self) -> None:
        self.requests: list[dict[str, object]] = []
        self._lock = threading.Lock()
        receiver = self

        class Handler(BaseHTTPRequestHandler):
            def do_POST(self) -> None:  # noqa: N802
                n = int(self.headers.get("Content-Length") or 0)
                raw = self.rfile.read(n).decode("utf-8")
                with receiver._lock:
                    receiver.requests.append(
                        {"headers": dict(self.headers.items()), "body": raw}
                    )
                self.send_response(200)
                self.send_header("Content-Length", "2")
                self.end_headers()
                self.wfile.write(b"ok")

            def log_message(self, *args: object) -> None:
                return

        self._httpd = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.port = int(self._httpd.server_address[1])
        threading.Thread(target=self._httpd.serve_forever, daemon=True).start()

    @property
    def url(self) -> str:
        return f"http://127.0.0.1:{self.port}/hook"

    def snapshot(self) -> list[dict[str, object]]:
        with self._lock:
            return list(self.requests)

    def close(self) -> None:
        self._httpd.shutdown()
        self._httpd.server_close()


async def drive_turn(client: httpx.AsyncClient, token: str, text: str) -> str:
    """Send one real user turn and wait for the assistant to finish."""
    headers = {"Authorization": f"Bearer {token}"}
    created = await client.post(f"/api/agents/{AGENT_ID}/threads", headers=headers)
    created.raise_for_status()
    thread_id = created.json()["thread_id"]
    ws_url = f"ws://127.0.0.1:9088/api/agents/{AGENT_ID}/chat/ws?token={token}"
    async with websockets.connect(ws_url, max_size=2**24) as ws:
        await ws.send(json.dumps({"type": "subscribe", "thread_id": thread_id}))
        await ws.send(json.dumps({"type": "user_turn", "text": text, "thread_id": thread_id}))
        for _ in range(4000):
            frame = json.loads(await asyncio.wait_for(ws.recv(), timeout=180))
            if frame.get("type") == "error":
                raise SystemExit(f"turn failed: {frame}")
            if frame.get("type") == "done":
                break
    return thread_id


def verify(requests: list[dict[str, object]], secret: str) -> tuple[dict[str, int], list[str]]:
    seen: dict[str, int] = {}
    problems: list[str] = []
    for request in requests:
        headers = request["headers"]
        body = str(request["body"])
        assert isinstance(headers, dict)
        type_ = str(headers.get("X-Octop-Event", ""))
        ts = str(headers.get("X-Octop-Timestamp", ""))
        want = "sha256=" + hmac.new(
            secret.encode(), f"{ts}.{body}".encode(), hashlib.sha256
        ).hexdigest()
        if headers.get("X-Octop-Signature") != want:
            problems.append(f"{type_}: bad signature")
        envelope = json.loads(body)
        for key in ("id", "type", "phase", "thread_id", "agent_id", "seq", "data"):
            if key not in envelope:
                problems.append(f"{type_}: envelope missing {key}")
        if envelope.get("type") != type_:
            problems.append(f"{type_}: X-Octop-Event != body.type")
        # The test event is built from a synthetic agent, so it is the one type
        # that does not belong to this agent.
        if type_ != TEST_TYPE and envelope.get("agent_id") != AGENT_ID:
            problems.append(f"{type_}: agent_id {envelope.get('agent_id')!r} != {AGENT_ID!r}")
        seen[type_] = seen.get(type_, 0) + 1
    return seen, problems


async def main() -> int:
    receiver = Receiver()
    async with httpx.AsyncClient(base_url=BASE, timeout=60) as client:
        login = await client.post(
            "/api/auth/login", json={"username": "admin", "password": PASSWORD}
        )
        login.raise_for_status()
        token = login.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # The ``system`` ledger row (-> agent.conversation.started) is only
        # written for an agent that actually has a system prompt.
        await client.patch(
            f"/api/agents/{AGENT_ID}",
            headers=headers,
            json={"system_prompt": "You are a terse test assistant. Answer in one sentence."},
        )

        created = await client.post(
            "/api/webhooks",
            headers=headers,
            json={
                "name": "live-e2e",
                "url": "https://example.com/hook",  # passes validate_url
                "types": [],
                "agent_ids": [],
                "include_delta": True,
                "enabled": True,
            },
        )
        created.raise_for_status()
        endpoint = created.json()
        endpoint_id, secret = endpoint["endpoint_id"], endpoint["secret"]
        print(f"endpoint {endpoint_id} created through the API")

        # Repoint at the in-container receiver. The dispatcher reads url from the
        # table on every claim, so this takes effect without a restart.
        conn = sqlite3.connect(DB)
        conn.execute(
            "UPDATE webhook_endpoint SET url = ? WHERE endpoint_id = ?",
            (receiver.url, endpoint_id),
        )
        conn.commit()
        conn.close()

        try:
            probe = await client.post(f"/api/webhooks/{endpoint_id}/test", headers=headers)
            probe.raise_for_status()
            print(f"sync test event: {probe.json()}")

            thread_id = await drive_turn(
                client, token,
                "Use your shell tool to run `echo webhook-live-test`, then reply with "
                "exactly the output in one short sentence.",
            )
            print(f"turn done on thread {thread_id}")

            deadline = time.monotonic() + 45
            rows: list[dict[str, object]] = []
            while time.monotonic() < deadline:
                listed = await client.get(
                    f"/api/webhooks/{endpoint_id}/deliveries", headers=headers, params={"limit": 200}
                )
                listed.raise_for_status()
                rows = listed.json()
                pending = [r for r in rows if r["status"] in ("pending", "sending")]
                if rows and not pending:
                    break
                await asyncio.sleep(1.0)

            seen, problems = verify(receiver.snapshot(), secret)

            statuses = {str(r["status"]) for r in rows}
            if statuses - {"delivered"}:
                problems.append(f"non-delivered rows: {sorted(statuses)}")
            outbox_types = {str(r["type"]) for r in rows}
            expected_outbox = set(seen) - {TEST_TYPE}
            if outbox_types != expected_outbox:
                problems.append(
                    f"outbox vs receiver disagree: {sorted(outbox_types ^ expected_outbox)}"
                )
        finally:
            await client.delete(f"/api/webhooks/{endpoint_id}", headers=headers)
            received = receiver.snapshot()
            receiver.close()

    print("\n  type                              count  phase(s)")
    for type_ in sorted(seen):
        phases = sorted({
            json.loads(str(r["body"]))["phase"]
            for r in received
            if str(r["headers"].get("X-Octop-Event")) == type_
        })
        print(f"  {type_:32s} {seen[type_]:5d}  {','.join(phases)}")

    missing = (LEDGER_TYPES | {TEST_TYPE}) - seen.keys()
    if missing:
        problems.append(f"never delivered: {sorted(missing)}")
    if problems:
        for problem in problems:
            print(f"FAIL {problem}", file=sys.stderr)
        return 1
    print(
        f"\nALL OK — {sum(seen.values())} deliveries, {len(seen)} event types, "
        "every HMAC verified, outbox and receiver agree"
    )
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
