-- Overlay v2: outbound webhooks for every agent trajectory event.

CREATE TABLE IF NOT EXISTS webhook_endpoint (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  endpoint_id    TEXT NOT NULL UNIQUE,
  name           TEXT NOT NULL,
  url            TEXT NOT NULL,
  enabled        INTEGER NOT NULL DEFAULT 1,
  types_json     TEXT NOT NULL DEFAULT '[]',
  agent_ids_json TEXT NOT NULL DEFAULT '[]',
  include_delta  INTEGER NOT NULL DEFAULT 0,
  created_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at     INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS webhook_delivery (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  delivery_id     TEXT NOT NULL UNIQUE,
  endpoint_id     TEXT NOT NULL REFERENCES webhook_endpoint(endpoint_id) ON DELETE CASCADE,
  event_id        TEXT NOT NULL,
  thread_id       TEXT NOT NULL,
  agent_id        TEXT NOT NULL,
  kind            TEXT NOT NULL,
  type            TEXT NOT NULL,
  seq             INTEGER NOT NULL,
  body_json       TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'sending', 'delivered', 'failed')),
  attempts        INTEGER NOT NULL DEFAULT 0,
  next_attempt_at REAL NOT NULL,
  response_code   INTEGER,
  last_error      TEXT,
  created_at      INTEGER NOT NULL,
  delivered_at    INTEGER,
  UNIQUE (endpoint_id, event_id, type)
);

CREATE INDEX IF NOT EXISTS idx_wh_delivery_due
  ON webhook_delivery (status, next_attempt_at);
CREATE INDEX IF NOT EXISTS idx_wh_delivery_endpoint
  ON webhook_delivery (endpoint_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_wh_delivery_event
  ON webhook_delivery (event_id);
