(function () {
  "use strict";

  var QUESTIONS = window.QUESTIONS || [];
  var STORE_KEY = "joho1-ch2-records-v1";
  var PREF_KEY = "joho1-ch2-prefs-v1";

  // ---------- localStorage（使えない環境でも動くように） ----------
  function load(key, fallback) {
    try {
      var raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }
  function save(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (e) { /* 保存できなくても続行 */ }
  }
  var records = load(STORE_KEY, {});
  if (!records || typeof records !== "object") records = {};

  function record(id, ok) {
    var r = records[id] || { c: 0, w: 0 };
    if (ok) r.c++; else r.w++;
    r.last = ok ? "c" : "w";
    r.t = Date.now();
    records[id] = r;
    save(STORE_KEY, records);
  }

  // ---------- 表示用ユーティリティ ----------
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  // 基数の下付き (2)(10)(16)、べき乗 ^n を整形し、改行を <br> に
  function fmt(s) {
    return esc(s)
      .replace(/([0-9A-F])\((2|10|16)\)/g, "$1<sub>($2)</sub>")
      .replace(/\^([−-]?\d+|n)/g, "<sup>$1</sup>")
      .replace(/\n/g, "<br>");
  }
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function byId(id) {
    for (var i = 0; i < QUESTIONS.length; i++) if (QUESTIONS[i].id === id) return QUESTIONS[i];
    return null;
  }
  function choiceLabel(ch) { return ch.t ? ch.k + ". " + ch.t : ch.k; }
  function answerDisplay(q) {
    if (q.answerText) return q.answerText;
    if (Array.isArray(q.answer)) return q.answer.join("・");
    return q.answer;
  }

  // ---------- 設定画面 ----------
  var nums = [];
  QUESTIONS.forEach(function (q) { if (nums.indexOf(q.num) < 0) nums.push(q.num); });
  nums.sort(function (a, b) { return a - b; });
  nums.forEach(function (n) {
    $("numFrom").appendChild(new Option(String(n), n));
    $("numTo").appendChild(new Option(String(n), n));
  });

  var prefs = load(PREF_KEY, {}) || {};
  function setRadio(name, value) {
    var r = document.querySelector('input[name="' + name + '"][value="' + value + '"]');
    if (r) r.checked = true;
  }
  function getRadio(name) {
    var r = document.querySelector('input[name="' + name + '"]:checked');
    return r ? r.value : null;
  }
  if (prefs.order) setRadio("order", prefs.order);
  if (prefs.range) setRadio("range", prefs.range);
  $("numFrom").value = prefs.from || nums[0];
  $("numTo").value = prefs.to || nums[nums.length - 1];

  function selection() {
    var range = getRadio("range");
    var from = +$("numFrom").value, to = +$("numTo").value;
    if (from > to) { var t = from; from = to; to = t; }
    var onlyWrong = $("onlyWrong").checked;
    return QUESTIONS.filter(function (q) {
      if (range === "basic" && q.level !== "basic") return false;
      if (range === "advanced" && q.level !== "advanced") return false;
      if (range === "num" && (q.num < from || q.num > to)) return false;
      if (onlyWrong && !(records[q.id] && records[q.id].last === "w")) return false;
      return true;
    });
  }

  function refreshSetup() {
    $("numRange").hidden = getRadio("range") !== "num";
    var n = selection().length;
    $("setupCount").textContent = n ? n + "問を出題します" : "該当する問題がありません";
    $("startBtn").disabled = n === 0;

    var ids = Object.keys(records).filter(function (id) { return byId(id); });
    var lastOk = ids.filter(function (id) { return records[id].last === "c"; }).length;
    var lastNg = ids.length - lastOk;
    $("statsText").textContent = ids.length
      ? "全" + QUESTIONS.length + "問中 " + ids.length + "問に挑戦。前回の結果：正解 " + lastOk + "問／まちがい " + lastNg + "問"
      : "まだ記録はありません（全" + QUESTIONS.length + "問）";
    $("resetBtn").hidden = ids.length === 0;
  }

  document.querySelectorAll('#setup input, #setup select').forEach(function (e) {
    e.addEventListener("change", function () {
      save(PREF_KEY, { order: getRadio("order"), range: getRadio("range"), from: $("numFrom").value, to: $("numTo").value });
      refreshSetup();
    });
  });
  $("resetBtn").addEventListener("click", function () {
    if (!window.confirm("正誤の記録をすべて消しますか？")) return;
    records = {};
    save(STORE_KEY, records);
    refreshSetup();
  });
  $("startBtn").addEventListener("click", function () {
    startSession(selection().map(function (q) { return q.id; }));
  });

  // ---------- 出題 ----------
  var session = null;

  function show(screen) {
    ["setup", "quiz", "result"].forEach(function (s) { $(s).hidden = s !== screen; });
    $("homeBtn").hidden = screen === "setup";
    window.scrollTo(0, 0);
  }

  function startSession(ids) {
    if (!ids.length) return;
    if (getRadio("order") === "random") ids = shuffle(ids);
    session = { ids: ids, index: 0, results: {} };
    show("quiz");
    renderCard();
  }

  function renderCard() {
    var q = byId(session.ids[session.index]);
    var total = session.ids.length;
    $("progressBar").style.width = (session.index / total * 100) + "%";
    $("progressText").textContent = (session.index + 1) + " / " + total;

    var card = $("card");
    card.innerHTML = "";

    var head = el("div", "card-head");
    head.appendChild(el("span", "qno", "問題" + esc(q.id)));
    head.appendChild(el("span", "qtitle", esc(q.title)));
    var meta = esc(q.section) + "　〔" + esc(q.tag) + "〕";
    if (q.ref) meta += "　→" + esc(q.ref);
    if (q.stars) meta += '　難易度<span class="stars">' + "★".repeat(q.stars) + "</span>";
    head.appendChild(el("span", "meta", meta));
    card.appendChild(head);

    // 引用ブロックは原文どおり、共通の問題文があればその直後、なければ設問文の直後に置く
    var quote = null;
    if (q.quote) {
      quote = el("blockquote", "quote");
      q.quote.forEach(function (line) { quote.appendChild(el("p", null, fmt(line))); });
    }
    if (q.stem) card.appendChild(el("p", "stem", fmt(q.stem)));
    if (quote && q.stem) card.appendChild(quote);
    card.appendChild(el("p", "qtext", fmt(q.text)));
    if (quote && !q.stem) card.appendChild(quote);
    if (q.list) {
      var ul = el("ul", "qlist");
      q.list.forEach(function (line) { ul.appendChild(el("li", null, esc(line))); });
      card.appendChild(ul);
    }
    (q.figures || []).forEach(function (f) {
      var fig = el("figure", "figure");
      if (f.caption) fig.appendChild(el("figcaption", null, esc(f.caption)));
      var img = document.createElement("img");
      img.src = f.src;
      img.alt = f.alt || "";
      fig.appendChild(img);
      card.appendChild(fig);
    });
    if (q.text2) card.appendChild(el("p", "qtext", fmt(q.text2)));
    if (q.table) card.appendChild(renderTable(q.table));
    if (q.hint) {
      var d = el("details", "hint");
      d.appendChild(el("summary", null, "ヒント"));
      d.appendChild(el("p", null, fmt(q.hint)));
      card.appendChild(d);
    }

    var area = el("div", "answer-area");
    card.appendChild(area);
    if (q.type === "single") renderSingle(q, area);
    else if (q.type === "multi") renderMulti(q, area);
    else if (q.type === "blanks") renderBlanks(q, area);
    else renderSelf(q, area);
  }

  function renderTable(t) {
    var wrap = el("div", "table-wrap");
    var table = document.createElement("table");
    var thead = el("thead");
    var tr = el("tr");
    t.head.forEach(function (h) { tr.appendChild(el("th", null, esc(h))); });
    thead.appendChild(tr);
    table.appendChild(thead);
    var tbody = el("tbody");
    t.rows.forEach(function (row) {
      var r = el("tr");
      row.forEach(function (c, i) { r.appendChild(el(i === 0 ? "th" : "td", null, esc(c))); });
      tbody.appendChild(r);
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
    return wrap;
  }

  function isCompact(choices) {
    return choices.every(function (c) { return !c.t || c.t.length <= 6; });
  }

  function choiceButton(ch) {
    var b = el("button", "choice");
    b.type = "button";
    b.innerHTML = ch.t ? '<span class="key">' + esc(ch.k) + '</span><span>' + fmt(ch.t) + "</span>" : esc(ch.k);
    return b;
  }

  function renderSingle(q, area) {
    var box = el("div", "choices" + (isCompact(q.choices) ? " compact" : ""));
    var buttons = q.choices.map(function (ch) {
      var b = choiceButton(ch);
      b.addEventListener("click", function () {
        var ok = ch.k === q.answer;
        buttons.forEach(function (bb, i) {
          bb.disabled = true;
          if (q.choices[i].k === q.answer) bb.classList.add("correct");
        });
        if (!ok) b.classList.add("wrong");
        finish(q, area, ok);
      });
      box.appendChild(b);
      return b;
    });
    area.appendChild(box);
  }

  function renderMulti(q, area) {
    area.appendChild(el("p", "multi-note", "あてはまるものをすべて選んでから「回答する」を押してください。"));
    var chosen = {};
    var box = el("div", "choices");
    var buttons = q.choices.map(function (ch) {
      var b = choiceButton(ch);
      b.setAttribute("aria-pressed", "false");
      b.addEventListener("click", function () {
        chosen[ch.k] = !chosen[ch.k];
        b.classList.toggle("selected", chosen[ch.k]);
        b.setAttribute("aria-pressed", String(chosen[ch.k]));
        submit.disabled = !Object.keys(chosen).some(function (k) { return chosen[k]; });
      });
      box.appendChild(b);
      return b;
    });
    area.appendChild(box);
    var submit = el("button", "btn primary", "回答する");
    submit.type = "button";
    submit.disabled = true;
    submit.addEventListener("click", function () {
      var ok = true;
      buttons.forEach(function (b, i) {
        var k = q.choices[i].k;
        var should = q.answer.indexOf(k) >= 0;
        b.disabled = true;
        b.classList.remove("selected");
        if (should) b.classList.add("correct");
        if (!!chosen[k] !== should) { ok = false; if (chosen[k]) b.classList.add("wrong"); }
      });
      submit.remove();
      finish(q, area, ok);
    });
    area.appendChild(submit);
  }

  function renderBlanks(q, area) {
    var picks = {};
    var groups = q.blanks.map(function (bl) {
      var wrap = el("div", "blank");
      wrap.appendChild(el("div", "blank-label", esc(bl.label.charAt(0) === "(" ? bl.label : "[" + bl.label + "]")));
      var box = el("div", "choices" + (q.options.every(function (o) { return o.length <= 5; }) ? " compact" : ""));
      var buttons = q.options.map(function (opt) {
        var b = el("button", "choice", fmt(opt));
        b.type = "button";
        b.addEventListener("click", function () {
          picks[bl.label] = opt;
          buttons.forEach(function (bb) { bb.classList.toggle("selected", bb === b); });
          submit.disabled = q.blanks.some(function (x) { return !picks[x.label]; });
        });
        box.appendChild(b);
        return b;
      });
      wrap.appendChild(box);
      area.appendChild(wrap);
      return { blank: bl, buttons: buttons };
    });
    var submit = el("button", "btn primary", "回答する");
    submit.type = "button";
    submit.disabled = true;
    submit.addEventListener("click", function () {
      var answers = q.blanks.map(function (b) { return b.answer; });
      var ok = true;
      var remaining = answers.slice(); // 順不同のときの照合用
      groups.forEach(function (g) {
        var pick = picks[g.blank.label];
        var good;
        if (q.unordered) {
          var at = remaining.indexOf(pick);
          good = at >= 0;
          if (good) remaining.splice(at, 1);
        } else {
          good = pick === g.blank.answer;
        }
        if (!good) ok = false;
        g.buttons.forEach(function (b, i) {
          var opt = q.options[i];
          b.disabled = true;
          b.classList.remove("selected");
          if (opt === pick) b.classList.add(good ? "correct" : "wrong");
          else if (!q.unordered && opt === g.blank.answer) b.classList.add("correct");
        });
      });
      submit.remove();
      finish(q, area, ok);
    });
    area.appendChild(submit);
  }

  function renderSelf(q, area) {
    var reveal = el("button", "btn primary big", "答えを見る");
    reveal.type = "button";
    reveal.addEventListener("click", function () {
      reveal.remove();
      var fb = el("div", "feedback neutral");
      fb.appendChild(el("p", "answer-line", esc(q.answerLabel || "正解") + "：" + fmt(q.answer)));
      area.appendChild(fb);
      var row = el("div", "btn-row");
      var good = el("button", "btn ok", "○ 正解した");
      var bad = el("button", "btn ng", "× まちがえた");
      good.type = bad.type = "button";
      good.addEventListener("click", function () { row.remove(); fb.remove(); finish(q, area, true); });
      bad.addEventListener("click", function () { row.remove(); fb.remove(); finish(q, area, false); });
      row.appendChild(good);
      row.appendChild(bad);
      area.appendChild(row);
      good.focus();
    });
    area.appendChild(reveal);
  }

  function finish(q, area, ok) {
    session.results[q.id] = ok;
    record(q.id, ok);

    var fb = el("div", "feedback " + (ok ? "ok" : "ng"));
    fb.appendChild(el("p", "verdict", ok ? "○ 正解" : "× 不正解"));
    fb.appendChild(el("p", "answer-line", esc(q.answerLabel || "正解") + "：" + fmt(answerDisplay(q))));
    if (q.explanation) {
      var ex = el("p", "explain");
      ex.innerHTML = '<span class="explain-label">解説</span>' + fmt(q.explanation);
      fb.appendChild(ex);
    }
    if (q.source) fb.appendChild(el("p", "source", "出典：" + esc(q.source)));
    area.appendChild(fb);

    var last = session.index === session.ids.length - 1;
    var next = el("button", "btn primary big", last ? "結果を見る" : "次へ");
    next.type = "button";
    next.addEventListener("click", function () {
      if (last) return showResult();
      session.index++;
      renderCard();
      window.scrollTo(0, 0);
    });
    area.appendChild(next);
    next.focus({ preventScroll: true });
    fb.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  // ---------- 結果 ----------
  function wrongIds() {
    return session.ids.filter(function (id) { return session.results[id] === false; });
  }

  function showResult() {
    var answered = session.ids.filter(function (id) { return id in session.results; });
    var correct = answered.filter(function (id) { return session.results[id]; }).length;
    var wrong = wrongIds();
    var rate = answered.length ? Math.round(correct / answered.length * 100) : 0;
    $("rate").textContent = rate + "%";
    $("rateDetail").textContent = answered.length + "問中 " + correct + "問正解" +
      (answered.length < session.ids.length ? "（" + session.ids.length + "問中 " + answered.length + "問に回答）" : "");
    $("retryWrongBtn").hidden = wrong.length === 0;
    $("wrongPanel").hidden = wrong.length === 0;
    var list = $("wrongList");
    list.innerHTML = "";
    wrong.forEach(function (id) {
      var q = byId(id);
      list.appendChild(el("li", null, "<b>" + esc(q.id) + "</b>" + esc(q.title)));
    });
    $("progressBar").style.width = "100%";
    show("result");
  }

  $("retryWrongBtn").addEventListener("click", function () { startSession(wrongIds()); });
  $("backBtn").addEventListener("click", function () { refreshSetup(); show("setup"); });
  $("homeBtn").addEventListener("click", function () {
    if (!$("quiz").hidden && session && Object.keys(session.results).length) {
      if (!window.confirm("途中で終了して結果を表示しますか？")) return;
      return showResult();
    }
    refreshSetup();
    show("setup");
  });

  refreshSetup();
})();
