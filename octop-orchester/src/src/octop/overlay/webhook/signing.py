"""Pure functions: event naming, HMAC signing, envelope building, endpoint filtering.

No DB, no I/O — everything here is a total function over dataclasses/dicts so
``scripts/webhook_selfcheck.py`` can exercise it on plain Python.
"""

from __future__ import annotations

import hashlib
import hmac
import json
from typing import Any

from octop.infra.history.trajectory.types import TrajectoryEvent

#: Prefix every event type carries; also the wildcard root (``agent.*``).
ROOT = "agent"

#: ``context`` events are named by ``payload.source``, not by label.
_CONTEXT_NAMES: dict[str, str] = {
    "memory": "context.memory",
    "skills": "skills.loaded",
    "mcp": "connectors.loaded",
}

#: Phase values a sink may see. ``completed`` is the only one that always ships.
PHASE_STARTED = "started"
PHASE_DELTA = "delta"
PHASE_COMPLETED = "completed"

TEST_EVENT_TYPE = f"{ROOT}.webhook.test"


def event_type(event: TrajectoryEvent, phase: str) -> str:
    """Map one trajectory event + publish phase to a webhook event name.

    ``agent.<group>.<action>``. Assistant and tool events split on phase because
    the same ``event_id`` publishes repeatedly while its content is assembled;
    one-shot kinds (user/system/context/compacted) ignore the phase.
    """
    kind = event.kind
    payload = event.payload or {}

    if kind == "assistant":
        if payload.get("tool_call_only"):
            return f"{ROOT}.message.tool_only"
        if phase == PHASE_COMPLETED:
            return f"{ROOT}.message.completed"
        if phase == PHASE_DELTA:
            return f"{ROOT}.message.delta"
        return f"{ROOT}.message.started"

    if kind == "tool":
        if phase == PHASE_COMPLETED:
            return f"{ROOT}.tool.completed"
        if phase == PHASE_DELTA:
            return f"{ROOT}.tool.delta"
        return f"{ROOT}.tool.started"

    if kind == "user":
        return f"{ROOT}.message.received"

    if kind == "system":
        return f"{ROOT}.conversation.started"

    if kind == "context":
        source = str(payload.get("source") or "")
        return f"{ROOT}.{_CONTEXT_NAMES.get(source, 'context.loaded')}"

    if kind == "compacted":
        return f"{ROOT}.context.compacted"

    # The projector never emits anything else; keep a stable name rather than
    # inventing a per-kind one, so a future kind shows up as this until mapped.
    return f"{ROOT}.unknown.{kind}"


def sign(secret: str, timestamp: int | str, body: str) -> str:
    """``sha256=<hex>`` over ``timestamp + "." + raw_body`` (replay-resistant)."""
    message = f"{timestamp}.{body}".encode("utf-8")
    digest = hmac.new(secret.encode("utf-8"), message, hashlib.sha256).hexdigest()
    return f"sha256={digest}"


def build_envelope(
    event: TrajectoryEvent,
    *,
    type_: str,
    phase: str,
    final: bool = False,
) -> dict[str, Any]:
    """Freeze one delivery body. ``id`` is the trajectory ``event_id``."""
    return {
        "id": event.event_id,
        "type": type_,
        "phase": phase,
        "occurred_at": event.ts,
        "thread_id": event.thread_id,
        "agent_id": event.agent_id,
        "seq": event.seq,
        "turn_id": event.turn_id,
        "request_seq": event.request_seq,
        "is_error": event.is_error,
        "final": final,
        "summary": event.summary,
        "data": event.payload,
    }


def dump_body(envelope: dict[str, Any]) -> str:
    """Canonical JSON used both as the wire body and the signing input."""
    return json.dumps(envelope, ensure_ascii=False, separators=(",", ":"), default=str)


def _type_matches(patterns: list[str], type_: str) -> bool:
    if not patterns:
        return True
    for raw in patterns:
        pattern = str(raw or "").strip()
        if not pattern:
            continue
        if pattern == "*":
            return True
        if pattern.endswith("*"):
            if type_.startswith(pattern[:-1]):
                return True
        elif pattern == type_:
            return True
    return False


def matches(
    *,
    patterns: list[str],
    agent_ids: list[str],
    type_: str,
    agent_id: str,
    include_delta: bool,
    phase: str,
) -> bool:
    """Whether an endpoint wants this event. ``[]`` means "everything"."""
    if agent_ids and agent_id not in agent_ids:
        return False
    if phase == PHASE_DELTA and not include_delta:
        return False
    return _type_matches(patterns, type_)
