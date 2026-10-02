# 情報Ⅰ 一問一答（第2章 デジタル化と情報デザイン 問題49〜89）

`index.html` をブラウザで開くだけで動く静的サイトです（ビルド・サーバー不要）。

## ファイル
- `index.html` / `style.css` / `app.js` … サイト本体
- `questions.json` … 全72カード（小問は1カードずつ）の問題データ
- `questions.js` … `questions.json` から生成（file:// でも読めるように）。`python3 tools/build_data.py` で再生成
- `figures/` … 問題の図（SVG）
- `source/` … 元データ（`questions.md`、`CLAUDE_CODE_PROMPT.md`）
- `tools/check_data.py` … JSON の文言が `source/questions.md` にそのまま含まれているか、全問そろっているかを検査

## 機能
- 選択式は即時判定、70は複数選択、56・89-2は複数空欄（89-2は順不同）
- 記述・数値は「答えを見る」→「正解した／まちがえた」を自己申告
- 出題順（順番／ランダム）、範囲（全問／基本問題／発展問題／番号指定）、前回まちがえた問題だけ
- 結果画面で正答率とまちがえた問題の一覧、まちがえた問題だけ解き直し
- 正誤記録は localStorage に保存（使えない環境でも動作）
