import json, sys
sys.stdout.reconfigure(encoding="utf-8")
p = r"D:/Sources/RandD/octop-orgchester/research/vi_batches/dashboard/batch_08.json"
d = json.load(open(p, encoding="utf-8"))
out = {k: d[k] for k in ["agentConfig", "heartbeat", "proactiveConfig", "chatWelcome"]}
print(json.dumps(out, ensure_ascii=False, indent=2))
