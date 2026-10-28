import json
from pathlib import Path

def flatten_keys(obj, prefix=""):
    keys = set()
    if isinstance(obj, dict):
        for k, v in obj.items():
            keys |= flatten_keys(v, f"{prefix}.{k}" if prefix else k)
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            keys |= flatten_keys(v, f"{prefix}[{i}]")
    elif isinstance(obj, str):
        keys.add(prefix)
    return keys

base = Path(__file__).parent
src = json.loads((base / "dashboard/batch_07.json").read_text(encoding="utf-8"))
vi = json.loads((base / "dashboard_vi/batch_07.json").read_text(encoding="utf-8"))
src_keys = flatten_keys(src)
vi_keys = flatten_keys(vi)
assert src_keys == vi_keys, f"Key mismatch: missing={src_keys-vi_keys} extra={vi_keys-src_keys}"
print("batch_07 OK: leaf keys match")
