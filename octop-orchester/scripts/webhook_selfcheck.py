"""Self-check: webhook signing/filtering pure functions + outbox semantics.

    python octop-orchester/scripts/webhook_selfcheck.py

Covers what a running server cannot easily show: event names per phase, the
signature vector, endpoint matching, envelope shape, and outbox idempotency /
claim / retry / stale recovery against a throwaway SQLite file.
"""
import importlib.util
import json
import os
import pathlib
import sys
import tempfile
import time

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

try:  # inside the image octop is installed; locally it is a git submodule
    import octop  # noqa: F401
except ImportError:
    sys.path.insert(0, str(ROOT.parent / "octop" / "src"))

from octop.infra.db.pool import SqlitePool  # noqa: E402
from octop.infra.db.repos.secrets import SecretRepo  # noqa: E402
from octop.infra.history.trajectory.types import TrajectoryEvent  # noqa: E402

# The image merges src/src/ over /app/src/, so octop.overlay is importable there.
# Locally the submodule owns ``octop``, so graft the overlay package on by hand.
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

from octop.overlay.migrate import run_overlay_migrations  # noqa: E402
from octop.overlay.webhook import signing  # noqa: E402
from octop.overlay.webhook.dispatcher import backoff_delay  # noqa: E402
from octop.overlay.webhook.store import (  # noqa: E402
    STALE_SENDING_S,
    STATUS_FAILED,
    STATUS_PENDING,
    STATUS_SENDING,
    WebhookStore,
)

PREREQ = """
CREATE TABLE users (id INTEGER PRIMARY KEY);
CREATE TABLE secrets (
  k TEXT PRIMARY KEY, v BLOB NOT NULL, created_at INTEGER NOT NULL, rotated_at INTEGER);
"""


def ev(kind, *, phase_payload=None, event_id="e1", agent_id="g1", seq=1):
    return TrajectoryEvent(
        event_id=event_id,
        thread_id="t1",
        agent_id=agent_id,
        seq=seq,
        ts=1700000000.0,
        kind=kind,
        turn_id="t1:turn:1",
        request_seq=1,
        is_error=False,
        summary="s",
        payload=phase_payload or {},
    )


def check_event_types():
    S, D, C = signing.PHASE_STARTED, signing.PHASE_DELTA, signing.PHASE_COMPLETED
    cases = [
        (ev("assistant", phase_payload={"content": "hi"}), S, "agent.message.started"),
        (ev("assistant"), D, "agent.message.delta"),
        (ev("assistant"), C, "agent.message.completed"),
        (ev("assistant", phase_payload={"tool_call_only": True}), S, "agent.message.tool_only"),
        (ev("tool", phase_payload={"call_id": "c1", "name": "x"}), S, "agent.tool.started"),
        (ev("tool"), D, "agent.tool.delta"),
        (ev("tool"), C, "agent.tool.completed"),
        (ev("user"), C, "agent.message.received"),
        (ev("system"), C, "agent.conversation.started"),
        (ev("context", phase_payload={"source": "skills"}), C, "agent.skills.loaded"),
        (ev("context", phase_payload={"source": "memory"}), C, "agent.context.memory"),
        (ev("context", phase_payload={"source": "mcp"}), C, "agent.connectors.loaded"),
        (ev("context", phase_payload={"source": "weird"}), C, "agent.context.loaded"),
        (ev("compacted"), C, "agent.context.compacted"),
        (ev("unknown"), C, "agent.unknown.unknown"),
    ]
    for event, phase, want in cases:
        got = signing.event_type(event, phase)
        assert got == want, f"{event.kind}/{phase}: {got} != {want}"
    print(f"OK event_type: {len(cases)} cases")


def check_sign():
    # Independent recomputation, not a fixture copied out of the source.
    import hashlib
    import hmac

    secret, ts, body = "whsec_test", 1700000000, '{"a":1}'
    want = "sha256=" + hmac.new(
        secret.encode(), f"{ts}.{body}".encode(), hashlib.sha256
    ).hexdigest()
    assert signing.sign(secret, ts, body) == want
    assert signing.sign(secret, str(ts), body) == want, "str and int timestamp must agree"
    assert signing.sign(secret, ts + 1, body) != want, "timestamp must be signed"
    print("OK sign: matches independent HMAC, timestamp-bound")


def check_envelope():
    event = ev("assistant", phase_payload={"content": "x"})
    env = signing.build_envelope(
        event, type_="agent.message.started", phase=signing.PHASE_STARTED
    )
    assert env["id"] == event.event_id, "envelope id must be the trajectory event_id"
    for key in ("type", "phase", "occurred_at", "thread_id", "agent_id", "seq",
                "turn_id", "request_seq", "is_error", "final", "summary", "data"):
        assert key in env, f"missing {key}"
    body = signing.dump_body(env)
    assert json.loads(body) == env
    assert " " not in body.split('"data"')[0], "body must be canonical (no spaces)"
    print("OK envelope: id == event_id, canonical JSON, all fields present")


def check_matches():
    base = dict(agent_ids=[], type_="agent.tool.completed", agent_id="g1",
                include_delta=False, phase=signing.PHASE_COMPLETED)
    assert signing.matches(patterns=[], **base), "empty patterns = everything"
    assert signing.matches(patterns=["*"], **base)
    assert signing.matches(patterns=["agent.tool.*"], **base), "trailing * is a prefix"
    assert not signing.matches(patterns=["agent.message.*"], **base)
    assert not signing.matches(patterns=["tool.completed"], **base), "exact, not suffix"
    assert not signing.matches(**{**base, "patterns": [], "agent_ids": ["g2"]})
    assert signing.matches(**{**base, "patterns": [], "agent_ids": ["g1"]})
    delta = {**base, "phase": signing.PHASE_DELTA, "type_": "agent.message.delta",
             "patterns": []}
    assert not signing.matches(**delta), "delta is opt-in"
    assert signing.matches(**{**delta, "include_delta": True})
    print("OK matches: wildcards, agent filter, delta gate")


def check_backoff():
    assert [backoff_delay(n) for n in (1, 2, 3, 4, 9)] == [10, 40, 160, 640, 3600]
    print("OK backoff: 10/40/160/640 capped at 3600")


def check_validate_url():
    from octop.overlay.webhook.dispatcher import validate_url

    # The image may carry OCTOP_WEBHOOK_ALLOW_HOSTS; drop it so the strict case
    # below is tested against the real default.
    saved = os.environ.pop("OCTOP_WEBHOOK_ALLOW_HOSTS", None)
    # Regression: _BlockedTarget used to subclass ValueError *inside* a
    # suppress(ValueError), so the SSRF guard raised and was swallowed.
    for blocked in ("http://127.0.0.1:9555/hook", "http://localhost/h",
                    "http://10.0.0.5/h", "http://192.168.1.10/h", "http://[::1]/h"):
        try:
            validate_url(blocked)
        except ValueError:
            continue
        raise AssertionError(f"{blocked} must be rejected")
    for bad in ("ftp://example.com/h", "example.com/h", "http:///h"):
        try:
            validate_url(bad)
        except ValueError:
            continue
        raise AssertionError(f"{bad} must be rejected as non-http(s)/hostless")
    # Explicit deployment-level opt-in still wins over the public-address rule;
    # without it the guard is unchanged.
    os.environ["OCTOP_WEBHOOK_ALLOW_HOSTS"] = "host.docker.internal, 192.168.1.10"
    try:
        for allowed in ("http://host.docker.internal:9100/hook", "http://192.168.1.10/h"):
            validate_url(allowed)
        try:
            validate_url("http://127.0.0.1:9100/hook")
        except ValueError:
            pass
        else:
            raise AssertionError("an unlisted loopback host must still be rejected")
    finally:
        del os.environ["OCTOP_WEBHOOK_ALLOW_HOSTS"]
        if saved is not None:
            os.environ["OCTOP_WEBHOOK_ALLOW_HOSTS"] = saved
    print("OK validate_url: loopback/private/link-local/non-http rejected; allowlist honoured")


def check_clean_headers():
    from octop.overlay.webhook.store import clean_headers

    ok = clean_headers({"Authorization": "Bearer abc", "X-Api-Key": "k"})
    assert ok == {"Authorization": "Bearer abc", "X-Api-Key": "k"}, ok
    assert clean_headers(None) == {}
    assert clean_headers({}) == {}
    for bad in (
        {"X-Octop-Signature": "x"},      # dispatcher-owned
        {"content-type": "text/plain"},
        {"Bad Name": "x"},               # space is not a token char
        {"X-Ok": "a\r\nInjected: 1"},    # header injection
        {"X-Ok": "v" * 1025},            # too long
        {f"X-H{i}": "v" for i in range(17)},  # too many
        ["not", "a", "map"],
    ):
        try:
            clean_headers(bad)
        except ValueError:
            continue
        raise AssertionError(f"{bad!r} must be rejected")
    print("OK clean_headers: reserved names, injection, size and count rejected")


def check_store():
    db = SqlitePool(pathlib.Path(tempfile.mkdtemp()) / "wh.db")
    with db.connect() as conn:
        conn.executescript(PREREQ)
    run_overlay_migrations(db)
    store = WebhookStore(db, SecretRepo(db))

    row = store.create_endpoint(
        name="dev", url="https://example.com/hook", types=["agent.tool.*"],
        agent_ids=[], include_delta=False, enabled=True, created_by=None,
    )
    assert row.endpoint_id.startswith("wh_")
    store.set_secret(row.endpoint_id, "whsec_abc")
    assert store.get_secret(row.endpoint_id) == "whsec_abc", "secret round-trips sealed"
    assert store.has_secret(row.endpoint_id)
    store.set_secret(row.endpoint_id, "whsec_def")
    assert store.get_secret(row.endpoint_id) == "whsec_def", "rotate overwrites"
    assert not store.has_secret("wh_nope")

    assert store.header_names(row.endpoint_id) == []
    store.set_headers(row.endpoint_id, {"Authorization": "Bearer tok"})
    assert store.get_headers(row.endpoint_id) == {"Authorization": "Bearer tok"}
    assert store.header_names(row.endpoint_id) == ["Authorization"]
    # Sealed, not plain text in the secrets row.
    with db.connect() as conn:
        blob = conn.execute(
            "SELECT v FROM secrets WHERE k = ?", (f"webhook_headers:{row.endpoint_id}",)
        ).fetchone()
    assert b"Bearer tok" not in bytes(blob[0]), "header value is encrypted at rest"
    store.set_headers(row.endpoint_id, {})
    assert store.get_headers(row.endpoint_id) == {}, "empty map clears"

    event = ev("tool", phase_payload={"call_id": "c1"})
    assert store.enqueue(endpoint_id=row.endpoint_id, event=event,
                         type_="agent.tool.started", body_json="{}")
    assert not store.enqueue(endpoint_id=row.endpoint_id, event=event,
                             type_="agent.tool.started", body_json="{}"), "idempotent"
    assert store.enqueue(endpoint_id=row.endpoint_id, event=event,
                         type_="agent.tool.completed", body_json="{}"), "phase is part of the key"

    claimed = store.claim_pending()
    assert len(claimed) == 2, claimed
    assert claimed[0].url == "https://example.com/hook", "claim joins the endpoint url"
    assert store.claim_pending() == [], "claimed rows leave pending"
    rows = store.list_deliveries(row.endpoint_id)
    assert {r["status"] for r in rows} == {STATUS_SENDING}

    store.mark_delivered(claimed[0].delivery_id, 200)
    store.mark_retry(claimed[1].delivery_id, attempts=1, delay_s=10, error="HTTP 500")
    stats = store.endpoint_stats()
    assert stats[row.endpoint_id]["pending_count"] == 1, stats
    assert store.claim_pending() == [], "backoff keeps the row out of the next tick"

    store.mark_failed(claimed[1].delivery_id, attempts=5, error="max attempts (HTTP 500)",
                      response_code=500)
    assert store.endpoint_stats()[row.endpoint_id]["failed_count"] == 1
    assert store.requeue(claimed[1].delivery_id)
    assert not store.requeue(claimed[1].delivery_id), "requeue only from failed"
    assert store.claim_pending()[0].attempts == 0, "requeue resets attempts"

    # A crash leaves a row in ``sending`` forever; recover_stale is the way out.
    with db.connect() as conn:
        conn.execute(
            "UPDATE webhook_delivery SET next_attempt_at = ? WHERE status = ?",
            (time.time() - STALE_SENDING_S - 5, STATUS_SENDING),
        )
    assert store.recover_stale() >= 1
    assert store.claim_pending(), "recovered row is deliverable again"

    assert store.get_endpoint(row.endpoint_id).endpoint_id == row.endpoint_id
    store.update_endpoint(row.endpoint_id, enabled=False)
    store.mark_retry(store.list_deliveries(row.endpoint_id)[0]["delivery_id"],
                     attempts=1, delay_s=0, error="x")
    assert store.claim_pending() == [], "disabled endpoint is not delivered to"
    store.update_endpoint(row.endpoint_id, enabled=True)

    assert store.delete_endpoint(row.endpoint_id)
    assert not store.delete_endpoint(row.endpoint_id), "second delete is a no-op"
    assert store.get_secret(row.endpoint_id) is None, "secret is dropped with the endpoint"
    with db.connect() as conn:
        assert conn.execute(
            "SELECT COUNT(*) FROM secrets WHERE k = ?",
            (f"webhook_headers:{row.endpoint_id}",),
        ).fetchone()[0] == 0, "custom headers are dropped with the endpoint"
    assert store.list_deliveries(row.endpoint_id) == [], "deliveries cascade"
    assert len(store.list_endpoints()) == 0

    db.close()
    print("OK store: secret sealing, idempotent enqueue, claim/backoff/retry/"
          "stale-recovery/cascade")


def main() -> int:
    check_event_types()
    check_sign()
    check_envelope()
    check_matches()
    check_backoff()
    check_validate_url()
    check_clean_headers()
    check_store()
    print("ALL OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
