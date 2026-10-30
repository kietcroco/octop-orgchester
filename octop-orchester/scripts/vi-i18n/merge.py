"""Merge translated vi batches into the new-file tree.

Usage (from repo root):
    python octop-orchester/scripts/vi-i18n/merge.py

Writes the merged JSON to octop-orchester/src/ (which mirrors octop's own
tree), never into the octop/ submodule. Patches that wrap existing files live
in octop-orchester/patches/; these two are whole new files, so they are plain
copies instead of patches.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BATCHES = ROOT
OUT = ROOT.parent.parent / "src"

TARGETS = [
    ("dashboard", "dashboard/src/locales/vi.json"),
    ("backend", "src/octop/i18n/vi.json"),
]


def deep_merge(dst: dict, src: dict) -> list:
    """Merge src into dst one level at a time; return top-level keys in both."""
    overlap = []
    for key, value in src.items():
        if isinstance(value, dict) and isinstance(dst.get(key), dict):
            # Both batches hold part of the same group — merge inside it
            # instead of letting the later batch drop the earlier one's keys.
            nested = deep_merge(dst[key], value)
            overlap += [f"{key}.{k}" for k in nested]
        else:
            if key in dst:
                overlap.append(key)
            dst[key] = value
    return overlap


def merge(kind: str, out_path: Path) -> int:
    src_dir = BATCHES / f"{kind}_vi"
    files = sorted(f for f in src_dir.glob("batch_*.json") if not f.name.endswith("_partial.json"))
    if not files:
        print(f"  {kind}: no translated batches found in {src_dir}", file=sys.stderr)
        return 1

    merged: dict = {}
    for f in files:
        data = json.loads(f.read_text(encoding="utf-8"))
        overlap = deep_merge(merged, data)
        if overlap:
            print(f"  {kind}: WARNING duplicate keys in {f.name}: {overlap[:5]}", file=sys.stderr)

    # sync_batches.py seeds a new batch with the Chinese source as placeholder,
    # so a *_vi batch that still matches its counterpart is untranslated.
    same_as_source = [f.name for f in files
                      if (BATCHES / kind / f.name).is_file()
                      and (BATCHES / kind / f.name).read_bytes() == f.read_bytes()]

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(merged, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"  {kind}: {len(files)} batches -> {len(merged)} top-level keys -> {out_path}")
    if same_as_source:
        print(f"  {kind}: WARNING untranslated batch (identical to source): "
              f"{' '.join(same_as_source)}", file=sys.stderr)
    return 0


def main() -> int:
    print("Merging vi batches:")
    rc = 0
    for kind, rel in TARGETS:
        rc |= merge(kind, OUT / rel)
    return rc


if __name__ == "__main__":
    sys.exit(main())
