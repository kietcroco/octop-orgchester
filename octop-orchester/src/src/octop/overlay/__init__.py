"""Orchester overlay: additive schema the overlay owns end to end.

Everything here is new — no table, column, or version number is shared with
upstream ``octop.infra.db.migrate``. The overlay keeps its own SQL folder
(``octop/overlay/migrations``) and its own ledger table
(``_overlay_schema_version``), so an upstream migration run and an overlay run
can never advance each other's counters, and dropping the overlay layer leaves
upstream's ``_schema_version`` untouched.
"""

from octop.overlay.migrate import run_overlay_migrations

__all__ = ["run_overlay_migrations"]
