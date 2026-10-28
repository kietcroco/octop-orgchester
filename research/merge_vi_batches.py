"""Merge translated vi batches back into vi.json files.

Usage (from repo root):
    python research/merge_vi_batches.py
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BATCHES = ROOT / "vi_batches"

TARGETS = [
    ("dashboard", "octop/dashboard/src/locales/vi.json"),
    ("backend", "octop/src/octop/i18n/vi.json"),
]


def merge(kind: str, out_path: Path) -> int:
    src_dir = BATCHES / f"{kind}_vi"
    files = sorted(src_dir.glob("batch_*.json"))
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
        rc |= merge(kind, ROOT.parent / rel)
    return rc


if __name__ == "__main__":
    sys.exit(main())
