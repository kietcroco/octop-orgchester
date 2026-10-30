"""Deliver queued webhook rows, plus the sink the trajectory service calls.

Two responsibilities, kept in one module because they share the same store and
the same failure taxonomy:

* ``WebhookSink`` — synchronous, called from ``TrajectoryService._publish``. It
  must never raise and never block: it filters, freezes the envelope, and writes
  one outbox row.
* ``WebhookDispatcher`` — async loop that claims due rows, POSTs them, and
  applies backoff. Runs as a bare ``asyncio`` task started from ``server.py``.
"""

from __future__ import annotations

import asyncio
import ipaddress
import logging
import os
import socket
import time
from contextlib import suppress
from typing import Any
from urllib.parse import urlparse

import httpx

from octop.infra.history.trajectory.types import TrajectoryEvent
from octop.overlay.webhook import signing
from octop.overlay.webhook.store import DeliveryRow, WebhookStore

logger = logging.getLogger(__name__)

_INTERVAL_S = 2.0
_TIMEOUT_S = 10.0
_CONCURRENCY = 8
_MAX_ATTEMPTS = 5
_HARD_FAIL_CODES = frozenset({400, 401, 403, 404, 405, 410, 413, 414, 415, 422})


def backoff_delay(attempt: int) -> float:
    """``10 * 4**(attempt-1)`` seconds, capped at one hour."""
    return float(min(10 * (4 ** max(0, attempt - 1)), 3600))


class _BlockedTarget(ValueError):
    """Endpoint URL resolves to a loopback/link-local/private address."""


def allowed_hosts() -> frozenset[str]:
    """Hosts exempt from the public-address rule, from ``OCTOP_WEBHOOK_ALLOW_HOSTS``.

    Comma-separated hostnames or IPs. Meant for a receiver on the operator's own
    machine (``host.docker.internal``) — an explicit, deployment-wide opt-in, not
    a per-endpoint flag, so a dashboard user cannot punch a hole in the guard.
    """
    raw = os.environ.get("OCTOP_WEBHOOK_ALLOW_HOSTS", "")
    return frozenset(part.strip().lower() for part in raw.split(",") if part.strip())


def validate_url(url: str) -> str:
    """Reject non-http(s) and any host that resolves to a non-public address.

    Checked at write time (so a bad URL never reaches the table) and again at
    delivery time (DNS can be repointed after the row was created).
    """
    parsed = urlparse(url.strip())
    if parsed.scheme not in ("http", "https"):
        raise ValueError("webhook url must be http or https")
    host = parsed.hostname
    if not host:
        raise ValueError("webhook url has no host")
    allow = allowed_hosts()
    if host.lower() in allow:
        return url.strip()
    try:
        infos = socket.getaddrinfo(host, None)
    except OSError as exc:
        raise ValueError(f"webhook host does not resolve: {exc}") from exc
    for info in infos:
        addr = str(info[4][0])
        if addr.lower() in allow:
            continue
        try:
            ip = ipaddress.ip_address(addr)
        except ValueError:
            continue  # not an IP literal; nothing to classify
        if ip.is_loopback or ip.is_private or ip.is_link_local or ip.is_reserved:
            raise _BlockedTarget(f"webhook url points at a non-public address: {addr}")
    return url.strip()


class WebhookSink:
    """Fan a trajectory event out to every interested endpoint's outbox."""

    def __init__(self, store: WebhookStore) -> None:
        self._store = store
        self._cache: list[Any] | None = None
        self._cache_at: float = 0.0

    def invalidate(self) -> None:
        self._cache = None

    def _endpoints(self) -> list[Any]:
        now = time.monotonic()
        if self._cache is None or now - self._cache_at > 5.0:
            self._cache = self._store.list_endpoints(enabled_only=True)
            self._cache_at = now
        return self._cache

    def __call__(
        self, event: TrajectoryEvent, *, phase: str, final: bool = False
    ) -> None:
        try:
            type_ = signing.event_type(event, phase)
            if type_.startswith(f"{signing.ROOT}.unknown."):
                return
            body = signing.dump_body(
                signing.build_envelope(event, type_=type_, phase=phase, final=final)
            )
            for endpoint in self._endpoints():
                if not signing.matches(
                    patterns=endpoint.types,
                    agent_ids=endpoint.agent_ids,
                    type_=type_,
                    agent_id=event.agent_id,
                    include_delta=endpoint.include_delta,
                    phase=phase,
                ):
                    continue
                self._store.enqueue(
                    endpoint_id=endpoint.endpoint_id,
                    event=event,
                    type_=type_,
                    body_json=body,
                )
        except Exception:
            # Hard constraint: this runs inside the chat publish path.
            logger.exception(
                "webhook sink failed event=%s thread=%s", event.event_id, event.thread_id
            )


class WebhookDispatcher:
    def __init__(self, store: WebhookStore) -> None:
        self._store = store
        self._task: asyncio.Task[None] | None = None
        self._stop = asyncio.Event()
        self._client: httpx.AsyncClient | None = None

    async def start(self) -> None:
        if self._task is not None and not self._task.done():
            return
        self._stop.clear()
        with suppress(Exception):
            self._store.recover_stale()
        self._client = httpx.AsyncClient(
            timeout=_TIMEOUT_S, follow_redirects=False, trust_env=False
        )
        self._task = asyncio.create_task(self._run(), name="webhook-dispatcher")

    async def stop(self) -> None:
        self._stop.set()
        task = self._task
        self._task = None
        if task is not None:
            task.cancel()
            with suppress(asyncio.CancelledError, Exception):
                await task
        if self._client is not None:
            with suppress(Exception):
                await self._client.aclose()
            self._client = None

    async def _run(self) -> None:
        while not self._stop.is_set():
            try:
                await self._tick()
            except Exception:
                logger.exception("webhook dispatcher tick failed")
            with suppress(asyncio.TimeoutError):
                await asyncio.wait_for(self._stop.wait(), timeout=_INTERVAL_S)

    async def _tick(self) -> None:
        rows = self._store.claim_pending()
        if not rows:
            return
        gate = asyncio.Semaphore(_CONCURRENCY)

        async def one(row: DeliveryRow) -> None:
            async with gate:
                await self._deliver(row)

        await asyncio.gather(*(one(row) for row in rows), return_exceptions=True)

    async def _deliver(self, row: DeliveryRow) -> None:
        client = self._client
        if client is None:
            return
        attempt = row.attempts + 1
        secret = self._store.get_secret(row.endpoint_id)
        if not secret:
            self._store.mark_failed(
                row.delivery_id, attempts=attempt, error="signing secret missing"
            )
            return
        ts = int(time.time())
        headers = {
            "Content-Type": "application/json",
            "X-Octop-Event": row.type,
            "X-Octop-Delivery": row.delivery_id,
            "X-Octop-Timestamp": str(ts),
            "X-Octop-Signature": signing.sign(secret, ts, row.body_json),
        }
        # Operator-supplied tokens (Authorization, X-Api-Key, ...). Applied last
        # so a reserved name could not slip through — clean_headers rejects
        # those at write time — and never logged.
        headers.update(self._store.get_headers(row.endpoint_id))
        try:
            resp = await client.post(row.url, content=row.body_json, headers=headers)
        except Exception as exc:
            self._retry_or_fail(row, attempt, f"{type(exc).__name__}: {exc}")
            return
        if 200 <= resp.status_code < 300:
            self._store.mark_delivered(row.delivery_id, resp.status_code)
        elif resp.status_code == 429 or resp.status_code >= 500:
            self._retry_or_fail(row, attempt, f"HTTP {resp.status_code}", resp.status_code)
        elif resp.status_code in _HARD_FAIL_CODES:
            self._store.mark_failed(
                row.delivery_id,
                attempts=attempt,
                error=f"HTTP {resp.status_code}",
                response_code=resp.status_code,
            )
        else:
            # Unlisted 3xx/4xx: treat like a soft failure so an operator can retry.
            self._retry_or_fail(row, attempt, f"HTTP {resp.status_code}", resp.status_code)

    def _retry_or_fail(
        self, row: DeliveryRow, attempt: int, error: str, code: int | None = None
    ) -> None:
        if attempt >= _MAX_ATTEMPTS:
            self._store.mark_failed(
                row.delivery_id, attempts=attempt, error=f"max attempts ({error})",
                response_code=code,
            )
            return
        self._store.mark_retry(
            row.delivery_id, attempts=attempt, delay_s=backoff_delay(attempt), error=error
        )
