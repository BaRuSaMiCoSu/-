#!/usr/bin/env python3
"""questions.json から questions.js を生成する（file:// で開いても fetch なしで読めるように）。"""
import json, pathlib

root = pathlib.Path(__file__).resolve().parent.parent
data = json.loads((root / "questions.json").read_text(encoding="utf-8"))
js = "// このファイルは tools/build_data.py で questions.json から生成されます。直接編集しないでください。\n"
js += "window.QUESTIONS = " + json.dumps(data, ensure_ascii=False, indent=1) + ";\n"
(root / "questions.js").write_text(js, encoding="utf-8")
print(f"{len(data)} cards -> questions.js")
