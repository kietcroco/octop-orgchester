"""Apply the overlay's numbered SQL migrations.

Mirrors upstream ``octop.infra.db.migrate`` conventions (dialect detection,
statement splitting, logging) but owns its ledger: versions live in
``_overlay_schema_version`` and files live in ``octop/overlay/migrations``.
Each file is ``NNN_description.sql`` (SQLite) or ``NNN_description.pg.sql``
(PostgreSQL). Nothing here imports from the upstream migrator, so the two
layers advance independently.
"""

from __future__ import annotations

import logging
import re
from collections.abc import Mapping
from pathlib import Path

from octop.infra.db.pool import DatabasePool

logger = logging.getLogger(__name__)

_DIR = Path(__file__).parent / "migrations"
_SQL_STMT_RE = re.compile(r";\s*\n")
_LEDGER = "_overlay_schema_version"


def _split_pg_sql(sql: str) -> list[str]:
    parts = [p.strip() for p in _SQL_STMT_RE.split(sql)]
    out: list[str] = []
    for part in parts:
        if not part:
            continue
        # Drop leading full-line comments so header+DDL blocks are kept.
        lines = part.splitlines()
        while lines and (not lines[0].strip() or lines[0].lstrip().startswith("--")):
            lines.pop(0)
        cleaned = "\n".join(lines).strip()
        if cleaned:
            out.append(cleaned)
    return out


def _discover(dialect: str = "sqlite") -> list[tuple[int, Path]]:
    out: list[tuple[int, Path]] = []
    if not _DIR.exists():
        return out
    for entry in sorted(_DIR.iterdir()):
        name = entry.name
        if dialect == "postgresql":
            m = re.match(r"^(\d{3})_.*\.pg\.sql$", name)
        else:
            if name.endswith(".pg.sql"):
                continue
            m = re.match(r"^(\d{3})_.*\.sql$", name)
        if m:
            out.append((int(m.group(1)), entry))
    seen: dict[int, Path] = {}
    for version, path in out:
        prior = seen.get(version)
        if prior is not None:
            raise RuntimeError(
                f"Duplicate overlay migration version {version:03d}: "
                f"{prior.name} and {path.name}. "
                "Fold unreleased schema into a single NNN_*.sql / NNN_*.pg.sql pair."
            )
        seen[version] = path
    return out


def _ensure_ledger(db: DatabasePool) -> None:
    ddl = (
        f"CREATE TABLE IF NOT EXISTS {_LEDGER} ("
        "version INTEGER NOT NULL)"
    )
    seed = (
        f"INSERT INTO {_LEDGER} (version) "
        f"SELECT 0 WHERE NOT EXISTS (SELECT 1 FROM {_LEDGER})"
    )
    if db.dialect == "postgresql":
        with db.connect() as conn, conn.transaction():
            conn.execute(ddl)
            conn.execute(seed)
        return
    with db.connect() as conn:
        conn.execute(ddl)
        conn.execute(seed)


def _current_version(db: DatabasePool) -> int:
    with db.connect() as conn:
        row = conn.execute(f"SELECT version FROM {_LEDGER}").fetchone()
    if row is None:
        return 0
    version = row["version"] if isinstance(row, Mapping) else row[0]
    return int(version)


def run_overlay_migrations(db: DatabasePool) -> None:
    """Bring an already-migrated database up to the overlay's latest version.

    Call after upstream ``run_migrations`` — the overlay's tables reference
    upstream ones (``users``, ``agents``, ``channels``). Idempotent: a second
    call applies nothing.
    """
    _ensure_ledger(db)
    for version, path in _discover(db.dialect):
        if version <= _current_version(db):
            continue
        logger.info("Applying overlay migration %03d: %s", version, path.name)
        sql = path.read_text(encoding="utf-8")
        if db.dialect == "postgresql":
            with db.connect() as conn, conn.transaction():
                for stmt in _split_pg_sql(sql):
                    conn.execute(stmt)
                conn.execute(f"UPDATE {_LEDGER} SET version = %s", (version,))
        else:
            with db.connect() as conn:
                conn.executescript(sql)
                conn.execute(f"UPDATE {_LEDGER} SET version = ?", (version,))
