#!/usr/bin/env python3
"""questions.json の文言が source/questions.md にそのまま含まれているか、全問そろっているかを確認する。"""
import json, pathlib, re, sys

root = pathlib.Path(__file__).resolve().parent.parent
md = (root / "source/questions.md").read_text(encoding="utf-8")
flat = re.sub(r"[\s>*|]+", "", md)  # 改行・引用記号・表の区切りを無視して照合
data = json.loads((root / "questions.json").read_text(encoding="utf-8"))
errors = []

def check(card, label, s):
    if not s:
        return
    for part in s.split("\n"):
        # 小問の前置き（問1）などは原文では **53-1（問1）** の形なので数字部分を除いて照合
        p = re.sub(r"[\s]+", "", part)
        p = re.sub(r"^（問\d）", "", p)
        if p and p not in flat:
            errors.append(f"{card['id']} {label}: {part[:40]}")

for c in data:
    for key in ("stem", "text", "text2", "hint", "explanation", "source", "answer", "answerText"):
        v = c.get(key)
        if isinstance(v, list):
            v = "\n".join(v)
        if key == "text" and re.match(r"^(空欄 [ab]|\[[アイ]\] .*|\(\d\)(\(\d\)（順不同）)?)$", v or ""):
            continue  # 表の「空欄」列から組み立てたラベル
        check(c, key, v)
    for line in c.get("quote", []) + c.get("list", []):
        check(c, "quote", line)
    for ch in c.get("choices", []):
        if ch.get("t"):
            if not any(re.sub(r"\s+", "", ch["k"] + sep + ch["t"]) in flat for sep in (".", "：")):
                errors.append(f"{c['id']} choice: {ch['k']} {ch['t'][:40]}")
        else:
            check(c, "choice", ch["k"])
    for o in c.get("options", []):
        check(c, "option", o)
    for f in c.get("figures", []):
        if not (root / f["src"]).exists():
            errors.append(f"{c['id']} missing figure {f['src']}")

ids = [c["id"] for c in data]
assert len(ids) == len(set(ids)), "duplicate ids"
nums = sorted({c["num"] for c in data})
if nums != list(range(49, 90)):
    errors.append(f"missing problem numbers: {set(range(49, 90)) - set(nums)}")
for c in data:
    if c["type"] in ("single", "multi"):
        keys = {ch["k"] for ch in c["choices"]}
        ans = c["answer"] if isinstance(c["answer"], list) else [c["answer"]]
        if not set(ans) <= keys:
            errors.append(f"{c['id']} answer not in choices")
    if c["type"] == "blanks":
        for b in c["blanks"]:
            if b["answer"] not in c["options"]:
                errors.append(f"{c['id']} blank answer not in options")

print(f"{len(data)} cards, problems {nums[0]}–{nums[-1]}")
print("\n".join(errors) or "OK: all text found verbatim in source")
sys.exit(1 if errors else 0)
