"""Merge translated vi batches back into the patch source files.

Usage (from repo root):
    python octop-orchester/scripts/vi-i18n/merge.py

Writes the merged JSON to octop-orchester/patches/vi-i18n/src-vi/ so the
upstream submodule is never modified in place. Regenerate patch.diff after.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BATCHES = ROOT
OUT = ROOT.parent.parent / "patches" / "vi-i18n" / "src-vi"

TARGETS = [
    ("dashboard", "dashboard/src/locales/vi.json"),
    ("backend", "src/octop/i18n/vi.json"),
]


def merge(kind: str, out_path: Path) -> int:
    src_dir = BATCHES / f"{kind}_vi"
    files = sorted(f for f in src_dir.glob("batch_*.json") if not f.name.endswith("_partial.json"))
    if not files:
        print(f"  {kind}: no translated batches found in {src_dir}", file=sys.stderr)
        return 1

    merged: dict = {}
    for f in files:
        data = json.loads(f.read_text(encoding="utf-8"))
        overlap = set(merged) & set(data)
        if overlap:
            print(f"  {kind}: WARNING duplicate keys in {f.name}: {sorted(overlap)}", file=sys.stderr)
        merged.update(data)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(merged, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"  {kind}: {len(files)} batches -> {len(merged)} top-level keys -> {out_path}")
    return 0


def main() -> int:
    print("Merging vi batches:")
    rc = 0
    for kind, rel in TARGETS:
        rc |= merge(kind, OUT / rel)
    return rc


if __name__ == "__main__":
    sys.exit(main())
