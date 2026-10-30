"""Orchester overlay: signed outbound webhooks for agent trajectory events.

Two moving parts, both owned here rather than patched into upstream:

* ``WebhookSink`` — attached to ``TrajectoryService`` by a one-line patch; it
  turns every published trajectory event into zero or more outbox rows.
* ``WebhookDispatcher`` — drains that outbox with retry/backoff. Started from
  ``server.py`` so it runs even when nobody has the dashboard open.
"""

from octop.overlay.webhook.dispatcher import (
    WebhookDispatcher,
    WebhookSink,
    allowed_hosts,
    validate_url,
)
from octop.overlay.webhook.store import WebhookStore
from octop.overlay.webhook.signing import (
    TEST_EVENT_TYPE,
    build_envelope,
    event_type,
    matches,
    sign,
)

__all__ = [
    "TEST_EVENT_TYPE",
    "WebhookDispatcher",
    "WebhookSink",
    "WebhookStore",
    "allowed_hosts",
    "build_envelope",
    "event_type",
    "matches",
    "sign",
    "validate_url",
]
