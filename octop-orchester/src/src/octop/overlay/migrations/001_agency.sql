-- Overlay v1: agencies, a grouping layer over upstream agents.

CREATE TABLE IF NOT EXISTS agency (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  agency_id   TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL UNIQUE,
  description TEXT,
  color       TEXT NOT NULL DEFAULT 'blue',
  icon_name   TEXT,
  created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS agency_member (
  agency_id  TEXT NOT NULL REFERENCES agency(agency_id) ON DELETE CASCADE,
  agent_id   TEXT NOT NULL REFERENCES agents(agent_id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (agency_id, agent_id)
);

CREATE INDEX IF NOT EXISTS idx_agency_member_agent ON agency_member(agent_id);
