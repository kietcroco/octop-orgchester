"""Check vi.json key parity against the upstream en.json files.

Usage (from repo root, after upgrading octop/):
    python octop-orchester/scripts/vi-i18n/check_parity.py

Compares leaf keys: every key in en.json must exist in vi.json and vice versa,
otherwise the UI falls back to English for the missing ones.
"""
import json
import pathlib
import sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = pathlib.Path(__file__).resolve().parents[3]
OCTOP = ROOT / "octop"
NEW = ROOT / "octop-orchester" / "src"

PAIRS = [
    (OCTOP / "dashboard/src/locales/en.json",
     NEW / "dashboard/src/locales/vi.json"),
    (OCTOP / "src/octop/i18n/en.json",
     NEW / "src/octop/i18n/vi.json"),
]

# Keys this patch adds to en.json/zh.json; they are expected to exist only in vi.
PATCH_ADDED = {"account.langVi"}

# Whole groups a patch adds to en.json/zh.json (so they are legitimately absent
# from the unpatched upstream en.json this script compares against).
PATCH_ADDED_PREFIXES = ("agencies.", "org.", "webhook.", "flows.")
PATCH_ADDED_EXACT = {"nav.agencies", "nav.orgChart", "nav.webhooks", "nav.flows"}


def leaves(node, prefix=""):
    if isinstance(node, dict):
        for key, value in node.items():
            yield from leaves(value, f"{prefix}.{key}" if prefix else key)
    else:
        yield prefix


def main() -> int:
    failed = False
    for en_path, vi_path in PAIRS:
        if not en_path.is_file():
            print(f"MISSING upstream file: {en_path}", file=sys.stderr)
            return 1
        en = set(leaves(json.loads(en_path.read_text(encoding="utf-8"))))
        vi = set(leaves(json.loads(vi_path.read_text(encoding="utf-8"))))
        missing = en - vi
        extra = {
            key
            for key in vi - en - PATCH_ADDED
            if key not in PATCH_ADDED_EXACT
            and not key.startswith(PATCH_ADDED_PREFIXES)
        }
        status = "OK" if not missing and not extra else "LINT FAILED"
        print(f"{vi_path.relative_to(ROOT)}: {len(vi)} leaves | "
              f"missing {len(missing)} | extra {len(extra)} | {status}")
        for key in sorted(missing)[:20]:
            print(f"  missing: {key}")
        for key in sorted(extra)[:20]:
            print(f"  extra:   {key}")
        if missing or extra:
            failed = True
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
