"""Self-check: overlay migration runner is idempotent and the DDL cascades.

    python octop-orchester/scripts/overlay_selfcheck.py
"""
import importlib.util
import pathlib
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

try:  # inside the image octop is installed; locally it is a git submodule
    import octop  # noqa: F401
except ImportError:
    sys.path.insert(0, str(ROOT.parent / "octop" / "src"))

from octop.infra.db.pool import SqlitePool  # noqa: E402

# The image merges src/src/ over /app/src/, so octop.overlay is importable there.
# Locally the submodule owns ``octop``, so graft the overlay package on by hand.
try:
    import octop.overlay  # noqa: F401
except ImportError:
    _OVERLAY = ROOT / "src" / "src" / "octop" / "overlay"
    _spec = importlib.util.spec_from_file_location(
        "octop.overlay", _OVERLAY / "__init__.py",
        submodule_search_locations=[str(_OVERLAY)],
    )
    _pkg = importlib.util.module_from_spec(_spec)
    sys.modules["octop.overlay"] = _pkg
    _spec.loader.exec_module(_pkg)  # type: ignore[union-attr]

from octop.overlay.migrate import run_overlay_migrations  # noqa: E402

PREREQ = """
CREATE TABLE users (id INTEGER PRIMARY KEY);
CREATE TABLE agents (
  id INTEGER PRIMARY KEY, agent_id TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
  default_model TEXT, last_state TEXT, user_id INTEGER, color TEXT, icon_name TEXT);
CREATE TABLE channels (
  id INTEGER PRIMARY KEY, channel_id TEXT NOT NULL UNIQUE, agent_id TEXT NOT NULL,
  user_id INTEGER, kind TEXT, name TEXT, config_json TEXT, enabled INTEGER,
  created_at INTEGER, updated_at INTEGER);
"""


def main() -> int:
    db = SqlitePool(pathlib.Path(tempfile.mkdtemp()) / "t.db")
    with db.connect() as c:
        c.executescript(PREREQ)
    run_overlay_migrations(db)
    run_overlay_migrations(db)  # second call must be a no-op
    with db.connect() as c:
        assert [r[0] for r in c.execute("SELECT version FROM _overlay_schema_version")] == [2]
        tables = sorted(
            r[0] for r in c.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'agency%'"
            )
        )
        assert tables == ["agency", "agency_member"], tables
        hook_tables = sorted(
            r[0] for r in c.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'webhook%'"
            )
        )
        assert hook_tables == ["webhook_delivery", "webhook_endpoint"], hook_tables
        c.execute("INSERT INTO agents (agent_id, name) VALUES ('g1', 'G')")
        c.execute(
            "INSERT INTO agency (agency_id, name, created_at, updated_at) "
            "VALUES ('a1', 'X', 1, 1)"
        )
        c.execute("INSERT INTO agency_member VALUES ('a1', 'g1', 1)")
        c.execute("DELETE FROM agency WHERE agency_id = 'a1'")
        assert c.execute("SELECT COUNT(*) FROM agency_member").fetchone()[0] == 0
        c.execute(
            "INSERT INTO webhook_endpoint (endpoint_id, name, url, created_at, updated_at) "
            "VALUES ('wh_x', 'X', 'https://example.com/hook', 1, 1)"
        )
        c.execute(
            "INSERT INTO webhook_delivery (delivery_id, endpoint_id, event_id, thread_id, "
            "agent_id, kind, type, seq, body_json, next_attempt_at, created_at) "
            "VALUES ('whd_x', 'wh_x', 'e1', 't1', 'g1', 'assistant', 'agent.message.started', "
            "1, '{}', 1, 1)"
        )
        c.execute("DELETE FROM webhook_endpoint WHERE endpoint_id = 'wh_x'")
        assert c.execute("SELECT COUNT(*) FROM webhook_delivery").fetchone()[0] == 0
        c.execute("DELETE FROM users")
    db.close()
    print("OK: idempotent, agency+webhook tables created, deletes cascade")
    return 0


if __name__ == "__main__":
    sys.exit(main())
