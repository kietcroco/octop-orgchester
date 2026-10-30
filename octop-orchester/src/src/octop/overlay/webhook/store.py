"""Endpoint registry + outbox persistence for webhooks.

All writes are additive to the overlay's own two tables; nothing here touches an
upstream table except the ``secrets`` key/value store (reused for the signing
secret, exactly like ``LangfuseSettingsStore`` does).
"""

from __future__ import annotations

import json
import re
import time
from dataclasses import dataclass
from typing import Any

from octop.infra.crypto.fernet import PURPOSE_SETTINGS, open_text, seal_text
from octop.infra.db.pool import DatabasePool
from octop.infra.db.repos._base import now_ts
from octop.infra.db.repos.secrets import SecretRepo
from octop.infra.history.trajectory.types import TrajectoryEvent
from octop.infra.utils.ulid import new_short_id, new_ulid

STATUS_PENDING = "pending"
STATUS_SENDING = "sending"
STATUS_DELIVERED = "delivered"
STATUS_FAILED = "failed"

#: A ``sending`` row older than this is assumed orphaned by a crash.
STALE_SENDING_S = 300

_SECRET_PREFIX = "webhook_secret:"
_HEADERS_PREFIX = "webhook_headers:"

#: Header names the dispatcher owns; a custom header may not shadow them.
RESERVED_HEADERS = frozenset(
    {
        "content-type",
        "content-length",
        "host",
        "x-octop-event",
        "x-octop-delivery",
        "x-octop-timestamp",
        "x-octop-signature",
    }
)
_HEADER_NAME_RE = re.compile(r"^[A-Za-z0-9!#$%&'*+.^_`|~-]{1,64}$")


def clean_headers(raw: Any) -> dict[str, str]:
    """Validate a ``{name: value}`` custom-header map.

    Values are secrets (bearer tokens), so they are stored sealed like the
    signing secret. Names are restricted to RFC 7230 token characters and may
    not shadow headers the dispatcher sets.
    """
    if raw is None:
        return {}
    if not isinstance(raw, dict):
        raise ValueError("headers must be an object of name -> value")
    out: dict[str, str] = {}
    for name, value in raw.items():
        key = str(name or "").strip()
        if not _HEADER_NAME_RE.match(key):
            raise ValueError(f"invalid header name: {key!r}")
        if key.lower() in RESERVED_HEADERS:
            raise ValueError(f"header {key} is set by Octop and cannot be overridden")
        text = "" if value is None else str(value)
        if "\r" in text or "\n" in text:
            raise ValueError(f"header {key} value must not contain newlines")
        if len(text) > 1024:
            raise ValueError(f"header {key} value is too long (max 1024)")
        out[key] = text
    if len(out) > 16:
        raise ValueError("at most 16 custom headers")
    return out


def _new_endpoint_id() -> str:
    return f"wh_{new_short_id(10)}"


def _new_delivery_id() -> str:
    return f"whd_{new_ulid()[:16]}"


def _load_list(raw: Any) -> list[str]:
    if not raw:
        return []
    try:
        value = json.loads(raw)
    except (TypeError, json.JSONDecodeError):
        return []
    if not isinstance(value, list):
        return []
    return [str(item) for item in value if str(item or "").strip()]


@dataclass(frozen=True)
class EndpointRow:
    endpoint_id: str
    name: str
    url: str
    enabled: bool
    types: list[str]
    agent_ids: list[str]
    include_delta: bool
    created_by: int | None
    created_at: int
    updated_at: int


@dataclass(frozen=True)
class DeliveryRow:
    delivery_id: str
    endpoint_id: str
    url: str
    event_id: str
    type: str
    body_json: str
    attempts: int


class WebhookStore:
    def __init__(self, db: DatabasePool, secrets: SecretRepo) -> None:
        self._db = db
        self._secrets = secrets

    # ----- endpoints -----

    def list_endpoints(self, *, enabled_only: bool = False) -> list[EndpointRow]:
        sql = "SELECT * FROM webhook_endpoint"
        if enabled_only:
            sql += " WHERE enabled = 1"
        sql += " ORDER BY created_at DESC"
        with self._db.connect() as conn:
            rows = conn.execute(sql).fetchall()
        return [_endpoint_from_row(r) for r in rows]

    def get_endpoint(self, endpoint_id: str) -> EndpointRow | None:
        with self._db.connect() as conn:
            row = conn.execute(
                "SELECT * FROM webhook_endpoint WHERE endpoint_id = ?", (endpoint_id,)
            ).fetchone()
        return _endpoint_from_row(row) if row else None

    def create_endpoint(
        self,
        *,
        name: str,
        url: str,
        types: list[str],
        agent_ids: list[str],
        include_delta: bool,
        enabled: bool,
        created_by: int | None,
    ) -> EndpointRow:
        endpoint_id = _new_endpoint_id()
        ts = now_ts()
        with self._db.transaction() as conn:
            conn.execute(
                "INSERT INTO webhook_endpoint (endpoint_id, name, url, enabled, "
                "types_json, agent_ids_json, include_delta, created_by, created_at, "
                "updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    endpoint_id,
                    name,
                    url,
                    1 if enabled else 0,
                    json.dumps(types),
                    json.dumps(agent_ids),
                    1 if include_delta else 0,
                    created_by,
                    ts,
                    ts,
                ),
            )
        row = self.get_endpoint(endpoint_id)
        assert row is not None
        return row

    def update_endpoint(
        self,
        endpoint_id: str,
        *,
        name: str | None = None,
        url: str | None = None,
        enabled: bool | None = None,
        types: list[str] | None = None,
        agent_ids: list[str] | None = None,
        include_delta: bool | None = None,
    ) -> EndpointRow | None:
        clauses: list[str] = []
        params: list[Any] = []
        if name is not None:
            clauses.append("name = ?")
            params.append(name)
        if url is not None:
            clauses.append("url = ?")
            params.append(url)
        if enabled is not None:
            clauses.append("enabled = ?")
            params.append(1 if enabled else 0)
        if types is not None:
            clauses.append("types_json = ?")
            params.append(json.dumps(types))
        if agent_ids is not None:
            clauses.append("agent_ids_json = ?")
            params.append(json.dumps(agent_ids))
        if include_delta is not None:
            clauses.append("include_delta = ?")
            params.append(1 if include_delta else 0)
        if clauses:
            clauses.append("updated_at = ?")
            params.extend([now_ts(), endpoint_id])
            with self._db.transaction() as conn:
                conn.execute(
                    f"UPDATE webhook_endpoint SET {', '.join(clauses)} "
                    "WHERE endpoint_id = ?",
                    tuple(params),
                )
        return self.get_endpoint(endpoint_id)

    def delete_endpoint(self, endpoint_id: str) -> bool:
        # SecretRepo exposes no delete; the override lock in SecuritySettings is
        # not ours to break, so drop the row through the same pool it uses.
        with self._db.transaction() as conn:
            deleted = conn.execute(
                "DELETE FROM webhook_endpoint WHERE endpoint_id = ?", (endpoint_id,)
            ).rowcount
            if deleted:
                for prefix in (_SECRET_PREFIX, _HEADERS_PREFIX):
                    conn.execute(
                        "DELETE FROM secrets WHERE k = ?", (prefix + endpoint_id,)
                    )
        return bool(deleted)

    # ----- secrets -----

    def set_secret(self, endpoint_id: str, secret: str) -> None:
        self._set_sealed(_SECRET_PREFIX + endpoint_id, secret)

    def get_secret(self, endpoint_id: str) -> str | None:
        return self._get_sealed(_SECRET_PREFIX + endpoint_id)

    def has_secret(self, endpoint_id: str) -> bool:
        return self._secrets.get(_SECRET_PREFIX + endpoint_id) is not None

    # ----- custom headers -----
    #
    # Values are bearer tokens, so they live in the sealed store next to the
    # signing secret rather than in the endpoint row. The API exposes only the
    # names (``header_names``); values never leave the server after the write.

    def set_headers(self, endpoint_id: str, headers: dict[str, str]) -> None:
        self._set_sealed(_HEADERS_PREFIX + endpoint_id, json.dumps(headers))

    def get_headers(self, endpoint_id: str) -> dict[str, str]:
        raw = self._get_sealed(_HEADERS_PREFIX + endpoint_id)
        if not raw:
            return {}
        try:
            value = json.loads(raw)
        except json.JSONDecodeError:
            return {}
        return {str(k): str(v) for k, v in value.items()} if isinstance(value, dict) else {}

    def header_names(self, endpoint_id: str) -> list[str]:
        return list(self.get_headers(endpoint_id))

    def _set_sealed(self, key: str, value: str) -> None:
        sealed = seal_text(self._secrets, PURPOSE_SETTINGS, value)
        if self._secrets.get(key) is None:
            self._secrets.get_or_create(key, lambda: _as_bytes(sealed))
        else:
            self._secrets.rotate(key, _as_bytes(sealed))

    def _get_sealed(self, key: str) -> str | None:
        raw = self._secrets.get(key)
        if raw is None:
            return None
        return open_text(self._secrets, PURPOSE_SETTINGS, raw.decode("ascii"))

    # ----- outbox -----

    def enqueue(
        self,
        *,
        endpoint_id: str,
        event: TrajectoryEvent,
        type_: str,
        body_json: str,
    ) -> bool:
        """Append one delivery. Returns False when the triple already exists."""
        try:
            with self._db.transaction() as conn:
                conn.execute(
                    "INSERT INTO webhook_delivery (delivery_id, endpoint_id, event_id, "
                    "thread_id, agent_id, kind, type, seq, body_json, status, attempts, "
                    "next_attempt_at, created_at) "
                    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)",
                    (
                        _new_delivery_id(),
                        endpoint_id,
                        event.event_id,
                        event.thread_id,
                        event.agent_id,
                        event.kind,
                        type_,
                        event.seq,
                        body_json,
                        STATUS_PENDING,
                        time.time(),
                        now_ts(),
                    ),
                )
                return True
        except Exception as exc:  # UNIQUE violation = already queued
            if "unique" in str(exc).lower() or "duplicate" in str(exc).lower():
                return False
            raise

    def claim_pending(self, limit: int = 50) -> list[DeliveryRow]:
        """Atomically move up to *limit* due rows to ``sending`` and return them."""
        now = time.time()
        claimed: list[DeliveryRow] = []
        with self._db.transaction() as conn:
            rows = conn.execute(
                "SELECT d.delivery_id, d.endpoint_id, e.url, d.event_id, d.type, "
                "       d.body_json, d.attempts "
                "  FROM webhook_delivery d "
                "  JOIN webhook_endpoint e ON e.endpoint_id = d.endpoint_id "
                " WHERE d.status = ? AND d.next_attempt_at <= ? AND e.enabled = 1 "
                " ORDER BY d.id LIMIT ?",
                (STATUS_PENDING, now, limit),
            ).fetchall()
            for row in rows:
                conn.execute(
                    "UPDATE webhook_delivery SET status = ? WHERE delivery_id = ?",
                    (STATUS_SENDING, row["delivery_id"]),
                )
                claimed.append(
                    DeliveryRow(
                        delivery_id=row["delivery_id"],
                        endpoint_id=row["endpoint_id"],
                        url=row["url"],
                        event_id=row["event_id"],
                        type=row["type"],
                        body_json=row["body_json"],
                        attempts=int(row["attempts"]),
                    )
                )
        return claimed

    def mark_delivered(self, delivery_id: str, response_code: int) -> None:
        with self._db.transaction() as conn:
            conn.execute(
                "UPDATE webhook_delivery SET status = ?, response_code = ?, "
                "last_error = NULL, delivered_at = ? WHERE delivery_id = ?",
                (STATUS_DELIVERED, response_code, now_ts(), delivery_id),
            )

    def mark_retry(
        self, delivery_id: str, *, attempts: int, delay_s: float, error: str
    ) -> None:
        with self._db.transaction() as conn:
            conn.execute(
                "UPDATE webhook_delivery SET status = ?, attempts = ?, "
                "next_attempt_at = ?, last_error = ? WHERE delivery_id = ?",
                (STATUS_PENDING, attempts, time.time() + delay_s, error[:500], delivery_id),
            )

    def mark_failed(
        self,
        delivery_id: str,
        *,
        attempts: int,
        error: str,
        response_code: int | None = None,
    ) -> None:
        with self._db.transaction() as conn:
            conn.execute(
                "UPDATE webhook_delivery SET status = ?, attempts = ?, "
                "last_error = ?, response_code = ? WHERE delivery_id = ?",
                (STATUS_FAILED, attempts, error[:500], response_code, delivery_id),
            )

    def requeue(self, delivery_id: str) -> bool:
        with self._db.transaction() as conn:
            changed = conn.execute(
                "UPDATE webhook_delivery SET status = ?, attempts = 0, "
                "next_attempt_at = ?, last_error = NULL "
                "WHERE delivery_id = ? AND status = ?",
                (STATUS_PENDING, time.time(), delivery_id, STATUS_FAILED),
            ).rowcount
        return bool(changed)

    def recover_stale(self) -> int:
        """Return orphaned ``sending`` rows (crash mid-delivery) to ``pending``."""
        cutoff = time.time() - STALE_SENDING_S
        with self._db.transaction() as conn:
            return conn.execute(
                "UPDATE webhook_delivery SET status = ?, next_attempt_at = ? "
                "WHERE status = ? AND next_attempt_at <= ?",
                (STATUS_PENDING, time.time(), STATUS_SENDING, cutoff),
            ).rowcount

    def list_deliveries(
        self,
        endpoint_id: str,
        *,
        status: str | None = None,
        limit: int = 50,
        before_id: int | None = None,
    ) -> list[dict[str, Any]]:
        sql = (
            "SELECT delivery_id, event_id, type, thread_id, agent_id, kind, seq, "
            "       status, attempts, next_attempt_at, response_code, last_error, "
            "       created_at, delivered_at, id "
            "  FROM webhook_delivery WHERE endpoint_id = ?"
        )
        params: list[Any] = [endpoint_id]
        if status:
            sql += " AND status = ?"
            params.append(status)
        if before_id is not None:
            sql += " AND id < ?"
            params.append(before_id)
        sql += " ORDER BY id DESC LIMIT ?"
        params.append(limit)
        with self._db.connect() as conn:
            rows = conn.execute(sql, tuple(params)).fetchall()
        return [dict(r) for r in rows]

    def endpoint_stats(self) -> dict[str, dict[str, Any]]:
        """Per-endpoint rollup for the list view: counts + last delivery."""
        sql = (
            "SELECT endpoint_id, status, COUNT(*) AS n, MAX(created_at) AS last_at "
            "  FROM webhook_delivery GROUP BY endpoint_id, status"
        )
        out: dict[str, dict[str, Any]] = {}
        with self._db.connect() as conn:
            for row in conn.execute(sql).fetchall():
                entry = out.setdefault(
                    row["endpoint_id"],
                    {
                        "pending_count": 0,
                        "failed_count": 0,
                        "last_delivery_at": None,
                        "last_status": None,
                    },
                )
                status = row["status"]
                if status in (STATUS_PENDING, STATUS_SENDING):
                    entry["pending_count"] += int(row["n"])
                elif status == STATUS_FAILED:
                    entry["failed_count"] += int(row["n"])
                if entry["last_delivery_at"] is None or int(row["last_at"]) >= int(
                    entry["last_delivery_at"]
                ):
                    entry["last_delivery_at"] = int(row["last_at"])
        return out


def _as_bytes(sealed: str | None) -> bytes:
    return (sealed or "").encode("ascii")


def _endpoint_from_row(row: Any) -> EndpointRow:
    return EndpointRow(
        endpoint_id=row["endpoint_id"],
        name=row["name"],
        url=row["url"],
        enabled=bool(row["enabled"]),
        types=_load_list(row["types_json"]),
        agent_ids=_load_list(row["agent_ids_json"]),
        include_delta=bool(row["include_delta"]),
        created_by=row["created_by"],
        created_at=int(row["created_at"]),
        updated_at=int(row["updated_at"]),
    )
