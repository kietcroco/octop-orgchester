"""Detect translation drift after pulling a new octop/, and split the new keys
into a fresh batch ready to translate.

Usage (from repo root, after `git submodule update`):
    python octop-orchester/scripts/vi-i18n/sync_batches.py           # report only
    python octop-orchester/scripts/vi-i18n/sync_batches.py --write   # + emit batch

Compares leaf keys of the batches against upstream en.json:
  missing — upstream added these, UI falls back to English until translated
  extra   — we still carry keys upstream removed

--write puts the missing keys into the next free batch_NN.json in both
`<kind>/` (Chinese source) and `<kind>_vi/` (same Chinese text as an
untranslated placeholder). merge.py reads every batch_*.json, so the new file
picks up automatically; nothing else to register.

Exit 0 = batches cover upstream en.json exactly, 1 = drift (or nothing written).
"""
import json
import re
import sys
from pathlib import Path

from check_parity import PATCH_ADDED  # keys we add ourselves, not upstream

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[2]
OCTOP = REPO / "octop"

KINDS = {
    "dashboard": (OCTOP / "dashboard/src/locales/en.json",
                  OCTOP / "dashboard/src/locales/zh.json"),
    "backend": (OCTOP / "src/octop/i18n/en.json",
                OCTOP / "src/octop/i18n/zh.json"),
}


def walk(node, prefix=""):
    """Yield (dotted-leaf-key, value)."""
    if isinstance(node, dict):
        for key, value in node.items():
            yield from walk(value, f"{prefix}.{key}" if prefix else key)
    else:
        yield prefix, node


def batch_leaves(directory: Path) -> dict:
    out = {}
    for f in sorted(directory.glob("batch_*.json")):
        data = json.loads(f.read_text(encoding="utf-8"))
        overlap = set(out) & set(k for k, _ in walk(data))
        if overlap:
            print(f"  WARNING duplicate keys in {f.name}: {sorted(overlap)[:5]}", file=sys.stderr)
        out.update(dict(walk(data)))
    return out


def nest(pairs) -> dict:
    out: dict = {}
    for leaf, value in pairs:
        node = out
        *parents, last = leaf.split(".")
        for part in parents:
            node = node.setdefault(part, {})
        node[last] = value
    return out


def next_batch(directory: Path) -> int:
    nums = [int(m.group(1)) for f in directory.glob("batch_*.json")
            if (m := re.match(r"batch_(\d+)", f.name))]
    return max(nums, default=0) + 1


def main() -> int:
    write = "--write" in sys.argv[1:]
    drifted = False

    for kind, (en_path, zh_path) in KINDS.items():
        for p in (en_path, zh_path):
            if not p.is_file():
                print(f"MISSING upstream file: {p} (submodule not checked out?)", file=sys.stderr)
                return 1

        en = dict(walk(json.loads(en_path.read_text(encoding="utf-8"))))
        zh = dict(walk(json.loads(zh_path.read_text(encoding="utf-8"))))
        covered = batch_leaves(ROOT / kind)

        missing = sorted(k for k in en if k not in covered)
        extra = sorted(k for k in covered if k not in en and k not in PATCH_ADDED)
        drifted |= bool(missing or extra)

        print(f"{kind}: upstream {len(en)} leaves | batch {len(covered)} | "
              f"missing {len(missing)} | extra {len(extra)}")
        for k in missing[:20]:
            print(f"  missing: {k}")
        for k in extra[:20]:
            print(f"  extra:   {k}")

        if missing and write:
            n = next_batch(ROOT / kind)
            name = f"batch_{n:02d}.json"
            # Placeholder text is the Chinese source, so an untranslated line is
            # obvious in dashboard_vi/ (and merge.py counts vi == zh as untranslated).
            payload = nest((k, zh.get(k, en[k])) for k in missing)
            for directory in (ROOT / kind, ROOT / f"{kind}_vi"):
                (directory / name).write_text(
                    json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            print(f"  wrote {name} ({len(missing)} keys) to {kind}/ and {kind}_vi/ — translate {kind}_vi/{name}")

    if drifted and write:
        print("\nnext: translate <kind>_vi/batch_NN.json, then\n"
              "  python octop-orchester/scripts/vi-i18n/merge.py\n"
              "  python octop-orchester/scripts/vi-i18n/check_parity.py")
    return 1 if drifted else 0


if __name__ == "__main__":
    sys.exit(main())
