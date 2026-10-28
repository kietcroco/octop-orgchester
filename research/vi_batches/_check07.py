import json
from pathlib import Path

base = Path(__file__).parent
src = json.loads((base / "dashboard/batch_07.json").read_text(encoding="utf-8"))
vi = json.loads((base / "dashboard_vi/batch_07.json").read_text(encoding="utf-8"))
print(list(src.keys()), list(vi.keys()))
print(len(src["models"]), len(vi.get("models", {})))
print(list(vi.get("models", {}))[:25])