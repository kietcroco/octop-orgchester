import json, sys
sys.stdout.reconfigure(encoding="utf-8")
p = r"D:/Sources/RandD/octop-orgchester/research/vi_batches/dashboard/batch_08.json"
d = json.load(open(p, encoding="utf-8"))
a = d["advancedSettings"]
print("keys:", list(a))
print(json.dumps({k: a[k] for k in ["search", "update"]}, ensure_ascii=False, indent=2))
