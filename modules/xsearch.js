/* Вкладка «🐦 X: мнения людей» — бесплатные готовые поиски по X (Twitter).
   Пульт не скачивает твиты (это платно), а собирает ссылку на поиск X с фильтрами:
   свежесть, минимум лайков, без ответов. Поиски — в config/x_searches.yaml. */
(function () {
  const MODES = {
    rising: { label: "🚀 Набирает: 6 ч, от 100 ♥", hours: 6, likes: 100 },
    day: { label: "🔥 Залетело за сутки: от 1000 ♥", hours: 24, likes: 1000 },
    days3: { label: "🏆 За 3 дня: от 3000 ♥", hours: 72, likes: 3000 },
    week: { label: "📅 За неделю: от 5000 ♥", hours: 168, likes: 5000 },
  };
  const KEY = "pult-xsearch";
  let cfg = null;
  let opts = { mode: "day", likes: "", video: false, anyLang: false };
  try { Object.assign(opts, JSON.parse(localStorage.getItem(KEY) || "{}")); } catch (e) { /* по умолчанию */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(opts)); } catch (e) { /* не страшно */ } };

  async function loadConfig() {
    try {
      const r = await fetch("config/x_searches.yaml?t=" + Date.now(), { cache: "no-store" });
      if (r.ok && window.jsyaml) return window.jsyaml.load(await r.text()) || {};
    } catch (e) { /* запасной вариант ниже */ }
    const r = await fetch("data/x_searches.json?t=" + Date.now(), { cache: "no-store" });
    return r.ok ? r.json() : { groups: [] };
  }

  function buildUrl(q, lang, sort) {
    const m = MODES[opts.mode] || MODES.day;
    const likes = +opts.likes || m.likes;
    const since = Math.floor(Date.now() / 1000) - m.hours * 3600;
    let full = `(${q}) min_faves:${likes} since_time:${since} -filter:replies -filter:nativeretweets`;
    if (lang && !opts.anyLang) full += ` lang:${lang}`;
    if (opts.video) full += " filter:videos";
    return `https://x.com/search?q=${encodeURIComponent(full)}&src=typed_query&f=${sort}`;
  }

  function item(esc, title, q, lang) {
    return `<div class="xs-item">
      <div class="t">${esc(title)}</div>
      <div class="q">${esc(q)}</div>
      <div class="xs-btns">
        <a class="top" href="#" data-q="${esc(q)}" data-lang="${esc(lang || "")}" data-sort="top" target="_blank" rel="noopener">🔥 Топ</a>
        <a href="#" data-q="${esc(q)}" data-lang="${esc(lang || "")}" data-sort="live" target="_blank" rel="noopener">⚡ Свежие</a>
      </div></div>`;
  }

  function draw(ctx) {
    const esc = ctx.esc;
    const el = ctx.el;
    const likeOpts = ["", "50", "100", "300", "1000", "3000", "10000", "50000"]
      .map((v) => `<option value="${v}"${opts.likes === v ? " selected" : ""}>${v ? "от " + Number(v).toLocaleString("ru-RU") + " ♥" : "как в режиме"}</option>`)
      .join("");
    const groups = (cfg.groups || []).filter((g) => g && g.items && g.items.length);
    const lists = (cfg.lists || []).filter((l) => l && l.url);

    el.innerHTML = `
      <p class="xs-intro">Готовые поиски по X. Нажми <b>🔥 Топ</b> (самые залетевшие) или <b>⚡ Свежие</b> (новые сверху) — X откроется уже с фильтром:
      только свежее, только с лайками, без ответов и репостов. Ищи там мнения и углы обычных людей для постов.</p>
      <div class="xs-panel">
        <label>Режим <select id="xs-mode">${Object.entries(MODES).map(([k, m]) => `<option value="${k}"${opts.mode === k ? " selected" : ""}>${m.label}</option>`).join("")}</select></label>
        <label>Лайков <select id="xs-likes">${likeOpts}</select></label>
        <label class="chk"><input type="checkbox" id="xs-video"${opts.video ? " checked" : ""}> 🎬 только с видео</label>
        <label class="chk"><input type="checkbox" id="xs-anylang"${opts.anyLang ? " checked" : ""}> 🌍 любой язык</label>
      </div>
      <div class="xs-panel">
        <input id="xs-own" class="xs-search" placeholder="Свой поиск: например  Starmer migrants  или  &quot;Big Ben&quot;" autocomplete="off">
        <div class="xs-btns" style="width:100%">
          <a class="top" href="#" id="xs-own-top" data-sort="top" target="_blank" rel="noopener">🔥 Топ</a>
          <a href="#" id="xs-own-live" data-sort="live" target="_blank" rel="noopener">⚡ Свежие</a>
        </div>
      </div>
      ${lists.length ? `<section class="xs-group"><h2>📋 Мои списки X</h2><div class="xs-grid">${lists
        .map((l) => `<div class="xs-item"><div class="t">${esc(l.title || "Список")}</div><div class="xs-btns"><a class="top" href="${esc(l.url)}" target="_blank" rel="noopener">Открыть</a></div></div>`)
        .join("")}</div></section>` : ""}
      ${groups
        .map((g) => `<section class="xs-group"><h2>${esc(g.name)} <small>${g.items.length}</small></h2><div class="xs-grid">${g.items
          .map((it) => item(esc, it.title, it.q, g.lang))
          .join("")}</div></section>`)
        .join("")}
      <p class="xs-intro">Поиски меняются в файле <code>config/x_searches.yaml</code>. Совет: заведи в X <b>Списки</b> из авторов с хорошими углами и добавь их туда же — лента будет без мусора.</p>`;

    // ссылка собирается в момент нажатия — чтобы «последние 6 ч» считались от «сейчас»
    el.onclick = (e) => {
      const a = e.target.closest("a[data-sort]");
      if (!a) return;
      let q = a.dataset.q;
      if (a.id === "xs-own-top" || a.id === "xs-own-live") {
        q = el.querySelector("#xs-own").value.trim();
        if (!q) { e.preventDefault(); ctx.toast("Сначала впиши, что искать"); return; }
      }
      a.href = buildUrl(q, a.dataset.lang || "", a.dataset.sort);
    };
    const bind = (id, key, val) => el.querySelector(id).addEventListener("change", (e) => { opts[key] = val(e.target); save(); });
    bind("#xs-mode", "mode", (t) => t.value);
    bind("#xs-likes", "likes", (t) => t.value);
    bind("#xs-video", "video", (t) => t.checked);
    bind("#xs-anylang", "anyLang", (t) => t.checked);
  }

  Pult.registerTab({
    id: "xsearch",
    ownPage: true,
    render(ctx) {
      if (cfg) return draw(ctx);
      ctx.el.innerHTML = '<div class="empty">Загружаю поиски…</div>';
      loadConfig()
        .then((c) => { cfg = c; draw(ctx); })
        .catch((e) => { ctx.el.innerHTML = `<div class="empty">Не загрузился config/x_searches.yaml: ${ctx.esc(e.message)}</div>`; });
    },
  });
})();
