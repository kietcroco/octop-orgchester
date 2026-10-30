"""End-to-end check: every webhook event type, through the real delivery path.

    python octop-orchester/scripts/webhook_e2e.py

Unlike ``webhook_selfcheck.py`` (pure functions + store semantics), this drives
the whole chain with a throwaway SQLite database and a real HTTP receiver:

    harness chunk -> projector -> TrajectoryService (phase) -> WebhookSink
                  -> outbox -> WebhookDispatcher -> POST -> HMAC verified

It needs the overlay package importable, so the image is the easy place to run
it (``docker exec``); locally it grafts ``src/src`` on like the selfcheck does.
"""

from __future__ import annotations

import asyncio
import hashlib
import hmac
import importlib.util
import json
import pathlib
import sys
import tempfile
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

try:  # inside the image octop is installed; locally it is a git submodule
    import octop  # noqa: F401
except ImportError:
    sys.path.insert(0, str(ROOT.parent / "octop" / "src"))

try:
    import octop.overlay  # noqa: F401
except ImportError:
    _OVERLAY = ROOT / "src" / "src" / "octop" / "overlay"
    _spec = importlib.util.spec_from_file_location(
        "octop.overlay", _OVERLAY / "__init__.py", submodule_search_locations=[str(_OVERLAY)]
    )
    _pkg = importlib.util.module_from_spec(_spec)
    sys.modules["octop.overlay"] = _pkg
    _spec.loader.exec_module(_pkg)  # type: ignore[union-attr]

from octop.infra.db.migrate import run_migrations  # noqa: E402
from octop.infra.db.pool import SqlitePool  # noqa: E402
from octop.infra.db.repos.secrets import SecretRepo  # noqa: E402
from octop.infra.db.repos.trajectory_events import TrajectoryEventRepo  # noqa: E402
from octop.infra.history.trajectory.live import TrajectoryLiveBus  # noqa: E402
from octop.infra.history.trajectory.service import TrajectoryService  # noqa: E402
from octop.infra.history.trajectory.store import TrajectoryStore  # noqa: E402
from octop.infra.history.trajectory.types import TrajectoryEvent  # noqa: E402
from octop.overlay.migrate import run_overlay_migrations  # noqa: E402
from octop.overlay.webhook import signing  # noqa: E402
from octop.overlay.webhook.dispatcher import WebhookDispatcher, WebhookSink  # noqa: E402
from octop.overlay.webhook.store import STATUS_DELIVERED, WebhookStore  # noqa: E402

SECRET = "whsec_e2e_do_not_reuse"
AGENT_ID = "g-e2e"
THREAD_ID = "t-e2e"
# Tokens merge at most once per _LIVE_UPDATE_INTERVAL_S (50 ms); a tighter loop
# would collapse the second publish and no ``delta`` event would exist.
DELTA_GAP_S = 0.07


class _Receiver:
    """Collect POSTs on a loopback port; dispatcher never validates the URL."""

    def __init__(self) -> None:
        self.requests: list[dict[str, object]] = []
        self._lock = threading.Lock()
        receiver = self

        class Handler(BaseHTTPRequestHandler):
            def do_POST(self) -> None:  # noqa: N802 (stdlib naming)
                length = int(self.headers.get("Content-Length") or 0)
                raw = self.rfile.read(length).decode("utf-8")
                with receiver._lock:
                    receiver.requests.append(
                        {
                            "path": self.path,
                            "headers": dict(self.headers.items()),
                            "body": raw,
                        }
                    )
                self.send_response(200)
                self.send_header("Content-Length", "2")
                self.end_headers()
                self.wfile.write(b"ok")

            def log_message(self, *args: object) -> None:  # keep the run quiet
                return

        self._httpd = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.port = int(self._httpd.server_address[1])
        self._thread = threading.Thread(target=self._httpd.serve_forever, daemon=True)

    def __enter__(self) -> "_Receiver":
        self._thread.start()
        return self

    def __exit__(self, *exc: object) -> None:
        self._httpd.shutdown()
        self._httpd.server_close()

    @property
    def url(self) -> str:
        return f"http://127.0.0.1:{self.port}/hook"

    def snapshot(self) -> list[dict[str, object]]:
        with self._lock:
            return list(self.requests)


def _seed(db: SqlitePool) -> None:
    """Minimum rows the trajectory ledger's foreign keys demand."""
    with db.connect() as conn:
        conn.execute(
            "INSERT INTO users (username, password_hash, role, created_at) "
            "VALUES ('u', 'x', 'admin', 1)"
        )
        conn.execute(
            "INSERT INTO agents (agent_id, user_id, name, created_at, updated_at) "
            "VALUES (?, 1, 'agent', 1, 1)",
            (AGENT_ID,),
        )
        conn.execute(
            "INSERT INTO threads (thread_id, agent_id, user_id, channel_type, "
            "session_key, last_active, created_at) "
            "VALUES (?, ?, 1, 'dashboard', 'k', 1, 1)",
            (THREAD_ID, AGENT_ID),
        )


def _feed(service: TrajectoryService) -> None:
    """Replay one thread's chunks so every event type is produced exactly once."""
    def chunk(payload: dict[str, object]) -> None:
        service.observe_chunk(AGENT_ID, THREAD_ID, payload)

    chunk({"type": "system", "label": "Initial System Prompt", "content": "be nice"})
    chunk({"type": "context", "source": "memory", "label": "MEMORY.md"})
    chunk({"type": "context", "source": "skills", "label": "Available skills",
           "content": "- one"})
    chunk({"type": "context", "source": "mcp", "label": "Connectors", "content": "- srv"})
    chunk({"type": "user", "content": "hello", "source": "dashboard"})

    # assistant: first token -> started, merged token -> delta, tool arrival -> completed
    chunk({"type": "token", "node": "agent", "content": "Hel"})
    time.sleep(DELTA_GAP_S)
    chunk({"type": "token", "node": "agent", "content": "lo"})

    # tool: call -> started, more args -> delta, result -> completed
    chunk({"type": "tool_call_chunk", "id": "c1", "name": "search", "args": '{"q":'})
    time.sleep(DELTA_GAP_S)
    chunk({"type": "tool_call_chunk", "id": "c1", "name": "search", "args": '"x"}'})
    chunk({"type": "tool_result", "id": "c1", "name": "search", "content": "found"})

    # new turn, tool with no assistant text -> synthetic tool_call_only parent
    chunk({"type": "user", "content": "again", "source": "dashboard"})
    chunk({"type": "tool_call_chunk", "id": "c2", "name": "calc", "args": "{}"})

    chunk({"type": "compacted", "summarized_count": 2, "preserved_count": 1,
           "removed_tokens": 40, "summary": "compacted 2 messages"})


async def _wait(store: WebhookStore, endpoint_id: str, want: int, timeout_s: float) -> None:
    deadline = time.monotonic() + timeout_s
    while time.monotonic() < deadline:
        rows = store.list_deliveries(endpoint_id, limit=200)
        if rows and all(r["status"] == STATUS_DELIVERED for r in rows) and len(rows) >= want:
            return
        await asyncio.sleep(0.25)


def _verify(requests: list[dict[str, object]], expected: set[str]) -> list[str]:
    seen: dict[str, int] = {}
    problems: list[str] = []
    for request in requests:
        headers = request["headers"]
        body = str(request["body"])
        assert isinstance(headers, dict)
        type_ = str(headers.get("X-Octop-Event", ""))
        ts = str(headers.get("X-Octop-Timestamp", ""))
        want = "sha256=" + hmac.new(
            SECRET.encode(), f"{ts}.{body}".encode(), hashlib.sha256
        ).hexdigest()
        if headers.get("X-Octop-Signature") != want:
            problems.append(f"{type_}: bad signature")
        envelope = json.loads(body)
        for key in ("id", "type", "phase", "thread_id", "agent_id", "seq", "data"):
            if key not in envelope:
                problems.append(f"{type_}: envelope missing {key}")
        if envelope.get("type") != type_:
            problems.append(f"{type_}: X-Octop-Event disagrees with body.type")
        # The dashboard's Test button builds its envelope from a synthetic event,
        # so it is the one type that does not belong to this thread.
        if type_ != signing.TEST_EVENT_TYPE and envelope.get("thread_id") != THREAD_ID:
            problems.append(f"{type_}: wrong thread_id")
        if not headers.get("X-Octop-Delivery"):
            problems.append(f"{type_}: missing X-Octop-Delivery")
        seen[type_] = seen.get(type_, 0) + 1
    missing = expected - seen.keys()
    if missing:
        problems.append(f"never delivered: {sorted(missing)}")
    return problems


async def main() -> int:
    workdir = pathlib.Path(tempfile.mkdtemp())
    db = SqlitePool(workdir / "e2e.db")
    run_migrations(db)
    run_overlay_migrations(db)
    _seed(db)

    store = WebhookStore(db, SecretRepo(db))
    endpoint = store.create_endpoint(
        name="e2e", url="", types=[], agent_ids=[],
        include_delta=True, enabled=True, created_by=None,
    )
    # The URL is only known once the receiver binds, so set it in one update.
    with _Receiver() as receiver:
        store.update_endpoint(endpoint.endpoint_id, url=receiver.url)
        store.set_secret(endpoint.endpoint_id, SECRET)

        service = TrajectoryService(
            TrajectoryStore(TrajectoryEventRepo(db)), TrajectoryLiveBus()
        )
        sink = WebhookSink(store)
        service.attach_sink(sink)
        sink.invalidate()

        dispatcher = WebhookDispatcher(store)
        await dispatcher.start()
        try:
            _feed(service)
            expected = {
                "agent.conversation.started",
                "agent.context.memory",
                "agent.skills.loaded",
                "agent.connectors.loaded",
                "agent.message.received",
                "agent.message.started",
                "agent.message.delta",
                "agent.message.completed",
                "agent.tool.started",
                "agent.tool.delta",
                "agent.tool.completed",
                "agent.message.tool_only",
                "agent.context.compacted",
            }
            await _wait(store, endpoint.endpoint_id, len(expected), timeout_s=25)
        finally:
            await dispatcher.stop()

        # The dashboard's Test button does not go through the ledger; send the
        # same envelope the router builds so that path is covered too.
        probe = TrajectoryEvent(
            event_id=f"test:{endpoint.endpoint_id}", thread_id="test", agent_id="test",
            seq=0, ts=0.0, kind="unknown", turn_id=None, request_seq=None,
            is_error=False, summary="webhook test", payload={"ping": True},
        )
        body = signing.dump_body(
            signing.build_envelope(
                probe, type_=signing.TEST_EVENT_TYPE,
                phase=signing.PHASE_COMPLETED, final=True,
            )
        )
        ts = int(time.time())
        import httpx

        async with httpx.AsyncClient(trust_env=False) as client:
            resp = await client.post(
                receiver.url,
                content=body,
                headers={
                    "Content-Type": "application/json",
                    "X-Octop-Event": signing.TEST_EVENT_TYPE,
                    "X-Octop-Delivery": f"test_{endpoint.endpoint_id}",
                    "X-Octop-Timestamp": str(ts),
                    "X-Octop-Signature": signing.sign(SECRET, ts, body),
                },
            )
        assert resp.status_code == 200, resp.status_code
        expected.add(signing.TEST_EVENT_TYPE)

        requests = receiver.snapshot()
        problems = _verify(requests, expected)

    rows = store.list_deliveries(endpoint.endpoint_id, limit=200)
    landed = {r["type"] for r in rows}
    # The test event is sent straight to the receiver, never through the outbox.
    queued = expected - {signing.TEST_EVENT_TYPE}
    if landed != queued:
        problems.append(f"outbox/transport disagree: {sorted(queued ^ landed)}")

    for request in requests:
        headers = request["headers"]
        assert isinstance(headers, dict)
        envelope = json.loads(str(request["body"]))
        print(f"  {headers.get('X-Octop-Event'):32s} phase={envelope['phase']:9s} "
              f"seq={envelope['seq']:<3} signed=yes")

    db.close()
    if problems:
        for problem in problems:
            print(f"FAIL {problem}", file=sys.stderr)
        return 1
    print(f"ALL OK — {len(requests)} deliveries, {len(expected)} event types, "
          "every HMAC verified")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
