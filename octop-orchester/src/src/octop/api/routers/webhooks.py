"""Webhook endpoint management + delivery log.

Overlay module — an endpoint is infrastructure config, so every route shares the
existing ``observability`` permission instead of a new permission key.
"""

from __future__ import annotations

import secrets
import time
from typing import Any

import httpx
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from octop.api.deps import get_server, require_permission
from octop.infra.errors import ErrorCode, OctopError
from octop.infra.history.trajectory.types import TrajectoryEvent
from octop.overlay.webhook import signing
from octop.overlay.webhook.dispatcher import validate_url
from octop.overlay.webhook.store import WebhookStore, clean_headers

router = APIRouter()


class EndpointBody(BaseModel):
    name: str = Field(max_length=64)
    url: str = Field(max_length=2048)
    enabled: bool = True
    types: list[str] = Field(default_factory=list, max_length=64)
    agent_ids: list[str] = Field(default_factory=list, max_length=256)
    include_delta: bool = False
    #: Extra headers sent with every delivery — bearer tokens, API keys, ...
    #: Values are write-only: ``_view`` returns names only.
    headers: dict[str, str] = Field(default_factory=dict)


class EndpointPatchBody(BaseModel):
    name: str | None = Field(default=None, max_length=64)
    url: str | None = Field(default=None, max_length=2048)
    enabled: bool | None = None
    types: list[str] | None = Field(default=None, max_length=64)
    agent_ids: list[str] | None = Field(default=None, max_length=256)
    include_delta: bool | None = None
    #: Omitted = keep what is stored. ``{}`` clears; a partial map replaces.
    headers: dict[str, str] | None = None


def _store(server: Any) -> WebhookStore:
    store = getattr(server, "webhook_store", None)
    if store is None:
        raise OctopError(ErrorCode.INTERNAL_ERROR, "webhook store is not initialized")
    return store


def _sink(server: Any):
    return getattr(server, "webhook_sink", None)


def _clean_types(values: list[str] | None) -> list[str]:
    out: list[str] = []
    for raw in values or []:
        item = str(raw or "").strip()
        if not item:
            continue
        if not item.startswith(signing.ROOT):
            raise OctopError(
                ErrorCode.SLASH_BAD_ARGS, f"unknown event type: {item}", status=400
            )
        out.append(item)
    return list(dict.fromkeys(out))


def _clean_agents(values: list[str] | None) -> list[str]:
    return list(dict.fromkeys(str(v).strip() for v in (values or []) if str(v).strip()))


def _clean_headers(values: dict[str, str] | None) -> dict[str, str]:
    try:
        return clean_headers(values)
    except ValueError as exc:
        raise OctopError(ErrorCode.SLASH_BAD_ARGS, str(exc), status=400) from exc


def _view(row: Any, stats: dict[str, Any], *, store: WebhookStore) -> dict[str, Any]:
    entry = stats.get(row.endpoint_id, {})
    return {
        "endpoint_id": row.endpoint_id,
        "name": row.name,
        "url": row.url,
        "enabled": row.enabled,
        "types": row.types,
        "agent_ids": row.agent_ids,
        "include_delta": row.include_delta,
        "secret_set": store.has_secret(row.endpoint_id),
        # Names only: the values are bearer tokens and never leave the server.
        "header_names": store.header_names(row.endpoint_id),
        "created_at": row.created_at,
        "last_delivery_at": entry.get("last_delivery_at"),
        "last_status": entry.get("last_status"),
        "pending_count": entry.get("pending_count", 0),
        "failed_count": entry.get("failed_count", 0),
    }


@router.get("", summary="List webhook endpoints")
async def list_endpoints(
    _: Any = Depends(require_permission("observability")),
    server: Any = Depends(get_server),
) -> list[dict[str, Any]]:
    store = _store(server)
    stats = store.endpoint_stats()
    return [_view(row, stats, store=store) for row in store.list_endpoints()]


@router.post("", status_code=201, summary="Create a webhook endpoint")
async def create_endpoint(
    body: EndpointBody,
    user: Any = Depends(require_permission("observability")),
    server: Any = Depends(get_server),
) -> dict[str, Any]:
    name = body.name.strip()
    if not name:
        raise OctopError(ErrorCode.SLASH_BAD_ARGS, "name is required", status=400)
    try:
        url = validate_url(body.url)
    except ValueError as exc:
        raise OctopError(ErrorCode.SLASH_BAD_ARGS, str(exc), status=400) from exc

    store = _store(server)
    headers = {k: v for k, v in _clean_headers(body.headers).items() if v}
    row = store.create_endpoint(
        name=name,
        url=url,
        types=_clean_types(body.types),
        agent_ids=_clean_agents(body.agent_ids),
        include_delta=body.include_delta,
        enabled=body.enabled,
        created_by=getattr(user, "id", None),
    )
    secret = f"whsec_{secrets.token_urlsafe(32)}"
    store.set_secret(row.endpoint_id, secret)
    if headers:
        store.set_headers(row.endpoint_id, headers)
    _refresh_sink(server)
    return {**_view(row, {}, store=store), "secret": secret}


@router.patch("/{endpoint_id}", summary="Update a webhook endpoint")
async def update_endpoint(
    endpoint_id: str,
    body: EndpointPatchBody,
    _: Any = Depends(require_permission("observability")),
    server: Any = Depends(get_server),
) -> dict[str, Any]:
    store = _store(server)
    if store.get_endpoint(endpoint_id) is None:
        raise OctopError(ErrorCode.NOT_FOUND, "webhook endpoint not found")
    url: str | None = None
    if body.url is not None:
        try:
            url = validate_url(body.url)
        except ValueError as exc:
            raise OctopError(ErrorCode.SLASH_BAD_ARGS, str(exc), status=400) from exc
    name = body.name.strip() if body.name is not None else None
    if name is not None and not name:
        raise OctopError(ErrorCode.SLASH_BAD_ARGS, "name is required", status=400)

    if body.headers is not None:
        # The body is the full desired set of names, so removing a name deletes
        # it. A blank value means "keep the stored token" — the UI never reads
        # a token back, so it has no way to resend one unchanged.
        incoming = _clean_headers(body.headers)
        current = store.get_headers(endpoint_id)
        merged = {k: (v or current.get(k, "")) for k, v in incoming.items()}
        store.set_headers(endpoint_id, {k: v for k, v in merged.items() if v})

    row = store.update_endpoint(
        endpoint_id,
        name=name,
        url=url,
        enabled=body.enabled,
        types=_clean_types(body.types) if body.types is not None else None,
        agent_ids=_clean_agents(body.agent_ids) if body.agent_ids is not None else None,
        include_delta=body.include_delta,
    )
    _refresh_sink(server)
    assert row is not None
    return _view(row, store.endpoint_stats(), store=store)


@router.delete("/{endpoint_id}", status_code=204, summary="Delete a webhook endpoint")
async def delete_endpoint(
    endpoint_id: str,
    _: Any = Depends(require_permission("observability")),
    server: Any = Depends(get_server),
) -> None:
    if not _store(server).delete_endpoint(endpoint_id):
        raise OctopError(ErrorCode.NOT_FOUND, "webhook endpoint not found")
    _refresh_sink(server)


@router.post("/{endpoint_id}/rotate-secret", summary="Rotate the signing secret")
async def rotate_secret(
    endpoint_id: str,
    _: Any = Depends(require_permission("observability")),
    server: Any = Depends(get_server),
) -> dict[str, str]:
    store = _store(server)
    if store.get_endpoint(endpoint_id) is None:
        raise OctopError(ErrorCode.NOT_FOUND, "webhook endpoint not found")
    secret = f"whsec_{secrets.token_urlsafe(32)}"
    store.set_secret(endpoint_id, secret)
    return {"endpoint_id": endpoint_id, "secret": secret}


@router.post("/{endpoint_id}/test", summary="Send a synchronous test event")
async def test_endpoint(
    endpoint_id: str,
    _: Any = Depends(require_permission("observability")),
    server: Any = Depends(get_server),
) -> dict[str, Any]:
    store = _store(server)
    row = store.get_endpoint(endpoint_id)
    if row is None:
        raise OctopError(ErrorCode.NOT_FOUND, "webhook endpoint not found")
    secret = store.get_secret(endpoint_id)
    if not secret:
        raise OctopError(ErrorCode.INTERNAL_ERROR, "signing secret missing")

    event = TrajectoryEvent(
        event_id=f"test:{endpoint_id}",
        thread_id="test",
        agent_id="test",
        seq=0,
        ts=0.0,
        kind="unknown",
        turn_id=None,
        request_seq=None,
        is_error=False,
        summary="webhook test",
        payload={"ping": True},
    )
    body = signing.dump_body(
        signing.build_envelope(
            event, type_=signing.TEST_EVENT_TYPE, phase=signing.PHASE_COMPLETED, final=True
        )
    )
    ts = int(time.time())
    headers = {
        "Content-Type": "application/json",
        "X-Octop-Event": signing.TEST_EVENT_TYPE,
        "X-Octop-Delivery": f"test_{endpoint_id}",
        "X-Octop-Timestamp": str(ts),
        "X-Octop-Signature": signing.sign(secret, ts, body),
    }
    # Same custom headers as a real delivery, so "Send test" proves the token
    # the receiver actually needs is present.
    headers.update(store.get_headers(endpoint_id))
    try:
        async with httpx.AsyncClient(
            timeout=10.0, follow_redirects=False, trust_env=False
        ) as client:
            resp = await client.post(row.url, content=body, headers=headers)
    except Exception as exc:
        return {"ok": False, "status": None, "error": f"{type(exc).__name__}: {exc}"}
    ok = 200 <= resp.status_code < 300
    return {
        "ok": ok,
        "status": resp.status_code,
        "error": None if ok else f"HTTP {resp.status_code}",
    }


@router.get("/{endpoint_id}/deliveries", summary="Read the delivery log")
async def list_deliveries(
    endpoint_id: str,
    status: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    before_id: int | None = Query(default=None),
    _: Any = Depends(require_permission("observability")),
    server: Any = Depends(get_server),
) -> list[dict[str, Any]]:
    store = _store(server)
    if store.get_endpoint(endpoint_id) is None:
        raise OctopError(ErrorCode.NOT_FOUND, "webhook endpoint not found")
    return store.list_deliveries(
        endpoint_id, status=status, limit=limit, before_id=before_id
    )


@router.post(
    "/deliveries/{delivery_id}/retry", summary="Requeue a failed delivery"
)
async def retry_delivery(
    delivery_id: str,
    _: Any = Depends(require_permission("observability")),
    server: Any = Depends(get_server),
) -> dict[str, Any]:
    if not _store(server).requeue(delivery_id):
        raise OctopError(ErrorCode.NOT_FOUND, "delivery is not in a failed state")
    return {"delivery_id": delivery_id, "status": "pending"}


def _refresh_sink(server: Any) -> None:
    sink = _sink(server)
    if sink is not None:
        sink.invalidate()
