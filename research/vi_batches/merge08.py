import json, sys
sys.stdout.reconfigure(encoding="utf-8")

base = r"D:/Sources/RandD/octop-orgchester/research/vi_batches/"
src = json.load(open(base + "dashboard/batch_08.json", encoding="utf-8"))
dst = json.load(open(base + "dashboard_vi/batch_08.json", encoding="utf-8"))
fix = json.load(open(base + "adv_fix.json", encoding="utf-8"))

adv = dst["advancedSettings"]
adv.update(fix)
adv = {k: adv[k] for k in src["advancedSettings"]}
dst["advancedSettings"] = adv

ordered = {k: dst[k] for k in src}
out = base + "dashboard_vi/batch_08.json"
with open(out, "w", encoding="utf-8", newline="\n") as f:
    json.dump(ordered, f, ensure_ascii=False, indent=2)
    f.write("\n")


def diff(a, b, path=""):
    errs = []
    for k in a:
        if k not in b:
            errs.append("missing " + path + k)
        elif isinstance(a[k], dict) != isinstance(b[k], dict):
            errs.append("type mismatch " + path + k)
        elif isinstance(a[k], dict):
            errs.extend(diff(a[k], b[k], path + k + "."))
    for k in b:
        if k not in a:
            errs.append("extra " + path + k)
    return errs


errs = diff(src, ordered)
print("top-level order match:", list(ordered) == list(src))
print("key parity:", "OK" if not errs else errs)
print("top keys:", len(ordered), "vs", len(src))