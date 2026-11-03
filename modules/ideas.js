/* Вкладка «💡 Идеи»: ТЕМЫ ВИДЕО по формулам твоих хитов (config/idea_bank.yaml), а не новости.
   Новость — только «🔥 повод»: если в СМИ сейчас есть сюжет по теме, идея поднимается наверх
   и получает ссылки для Urgency и плашки. ⭐ банк и ✅ «снял» хранятся в этом браузере. */
(function () {
  const BANK_KEY = "pult-ideas-bank2", DONE_KEY = "pult-ideas-done";
  const WINS = { 24: "24 ч", 72: "3 дня", 168: "7 дней" };
  const STATUS = { new: "🆕 Ещё не снимал", return: "🔁 Возврат хита, новый угол", cooled: "🧊 Остыло — только с новым углом" };
  let view = "hot", win = 72, bankCfg = null;
  const load = (k) => { try { return JSON.parse(localStorage.getItem(k) || "{}") || {}; } catch (e) { return {}; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* без памяти */ } };
  let starred = load(BANK_KEY), done = load(DONE_KEY);

  async function loadBank() {
    try {
      const r = await fetch("config/idea_bank.yaml?t=" + Date.now(), { cache: "no-store" });
      if (r.ok && window.jsyaml) return window.jsyaml.load(await r.text()) || {};
    } catch (e) { /* запасной вариант ниже */ }
    const r = await fetch("data/idea_bank.json?t=" + Date.now(), { cache: "no-store" });
    return r.ok ? r.json() : { ideas: [] };
  }

  // слово срабатывает по началу слова, без учёта регистра (как в сборщике)
  function rx(words) {
    const parts = (words || []).map((w) => String(w).toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).filter(Boolean);
    return parts.length ? new RegExp("(?:^|[^\\wа-яё])(?:" + parts.sort((a, b) => b.length - a.length).join("|") + ")", "i") : null;
  }
  const hoursBefore = (iso, ref) => (new Date(ref) - new Date(iso)) / 3600000;
  // повод ищем только в ГЛАВНОМ заголовке сюжета (+ его перевод) — приклеенные статьи не считаются
  const storyText = (s) => (s.title + " \n " + (s.title_ru || "")).toLowerCase();

  // для каждой идеи ищем лучший свежий повод в новостях
  function score(ctx) {
    const d = ctx.data;
    const fresh = (d.stories || []).filter((s) => hoursBefore(s.last_published, d.generated_at) <= win
      && (s.outlets_24h >= 5 || (s.idea && (s.idea.fat || s.idea.early))));  // только жирное
    return (bankCfg.ideas || []).map((idea, i) => {
      const id = "i" + i + "-" + idea.t;
      const re = rx(idea.match);
      const hits = re ? fresh.filter((s) => re.test(storyText(s))).sort((a, b) => b.score - a.score) : [];
      const top = hits[0];
      let boost = 0;
      if (top) boost = Math.min(30, 0.35 * top.score + 2 * Math.min(top.outlets_24h, 8)) + (top.first ? 5 : 0) + (top.rising ? 4 : 0);
      const cooled = idea.status === "cooled";
      const rank = Math.round(Math.max(0, Math.min(100, (idea.base || 40) + (cooled ? boost / 2 - 25 : boost))));
      return { id, idea, hits, top, rank, cooled };
    }).sort((a, b) => b.rank - a.rank);
  }

  function claudeText(x) {
    const it = x.idea, L = [];
    L.push(`Напиши сценарий серии «Выживаю в Лондоне, день X». Тема: ${it.t}.`);
    L.push(`Формат: ${it.fmt}. Рубрика: ${it.seg}.`);
    L.push(`Хук-приговор (черновик, сделай 3 варианта разных типов): «${it.hook}».`);
    if (it.etalon) L.push(`Это похоже на мою серию: ${it.etalon}. Повтори её механику, но с новым углом.`);
    if (it.why) L.push(`Почему тема сильная: ${it.why}`);
    if (it.angle && it.angle !== "—") L.push(`Личная виньетка / персонаж: ${it.angle}.`);
    if (it.details && it.details[0] !== "—") L.push(`Живописные детали, которые я поищу или вспомню: ${it.details.join("; ")}.`);
    if (it.quote && it.quote !== "—") L.push(`Заготовка готовой цитаты: «${it.quote}».`);
    if (x.top) {
      L.push("", "Повод из новостей (для Urgency и плашек-пруфов):");
      x.hits.slice(0, 3).forEach((s) => {
        L.push(`— ${s.title_ru || s.title} (${s.outlets_24h} изд. за 24 ч)`);
        (s.links || []).slice(0, 2).forEach((l) => L.push(`   ${l.source}: ${l.url}`));
      });
    }
    L.push("", "Работай строго по моей библии: прайм-формула 6 блоков, 50–60 сек, личная виньетка в первые 15 сек, 2–3 триггера из банка, минимум одна моя сигнатура, готовая цитата 7–15 слов, один CTA с конкретным тизером завтра, «телеграм/ютуб» голосом не говорить. Дай: 3 хука, сценарий, визуалку-пруфы, обложку в 2 строки, соцстатус переславшего и прогноз по эталонам.");
    return L.join("\n");
  }

  function card(ctx, x, rank) {
    const esc = ctx.esc, it = x.idea;
    const isNew = x.top && window.Pult.isNew && window.Pult.isNew(x.top);
    const badges = [`<span class="b st-${esc(it.status)}">${esc(STATUS[it.status] || it.status)}</span>`, `<span class="b tag">${esc(it.fmt)}</span>`, `<span class="b tag">#${esc(it.seg)}</span>`];
    if (x.top && !x.cooled) badges.unshift(`<span class="b povod">🔥 ПОВОД СЕЙЧАС</span>`);
    const el = document.createElement("article");
    el.className = "card idea2" + (starred[x.id] ? " saved" : "") + (x.cooled ? " cooled" : "");
    el.innerHTML = `
      <div><div class="score ${x.rank >= 70 ? "hot" : x.rank >= 50 ? "warm" : ""}" title="Потенциал темы">${x.rank}</div><div class="rank">${rank ? "#" + rank : ""}</div></div>
      <div class="body">
        <div class="badges">${badges.join("")}</div>
        <div class="ttl big">${esc(it.t)}</div>
        <div class="hook">🎬 «${esc(it.hook)}»</div>
        ${it.etalon ? `<div class="etalon">📈 ${esc(it.etalon)}</div>` : ""}
        ${it.why ? `<div class="why">${esc(it.why)}</div>` : ""}
        <details class="mech"><summary>Как снимать: виньетка, детали, цитата</summary>
          ${it.angle && it.angle !== "—" ? `<p><b>🎭 Личная виньетка:</b> ${esc(it.angle)}</p>` : ""}
          ${it.details && it.details[0] !== "—" ? `<p><b>🔍 3 живописные детали:</b></p><ul>${it.details.map((d) => `<li>${esc(d)}</li>`).join("")}</ul>` : ""}
          ${it.quote && it.quote !== "—" ? `<p><b>💬 Цитата-заготовка:</b> «${esc(it.quote)}»</p>` : ""}
        </details>
        ${x.top ? `<div class="povodbox">${isNew ? '<span class="b new">🆕 НОВОЕ</span> ' : ""}🔥 <b>Повод:</b> ${esc(x.top.title_ru || x.top.title)} <span class="muted">· ${x.top.outlets_24h} изд. за 24 ч${x.hits.length > 1 ? ` · ещё ${x.hits.length - 1} сюж.` : ""}</span>
          <ul class="links">${(x.top.links || []).slice(0, 2).map((l) => `<li><span class="src">${esc(l.source)}:</span> <a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.title)}</a></li>`).join("")}</ul></div>` : ""}
        <div class="actions">
          <button class="copy ai" type="button">🤖 Сценарий с Claude</button>
          <button class="copy alt star" type="button">${starred[x.id] ? "⭐ В банке" : "☆ В банк"}</button>
          <button class="copy alt done" type="button">${done[x.id] ? "↩️ Вернуть" : "✅ Снял"}</button>
          ${x.top ? '<button class="copy alt pq" type="button">🖼 Плашка повода</button>' : ""}
        </div>
      </div>`;
    el.querySelector(".ai").onclick = () => ctx.copyText(claudeText(x)).then(() => ctx.toast("Скопировано — вставь в чат с Claude"));
    el.querySelector(".star").onclick = () => { if (starred[x.id]) delete starred[x.id]; else starred[x.id] = Date.now(); save(BANK_KEY, starred); draw(ctx); };
    el.querySelector(".done").onclick = () => {
      if (done[x.id]) delete done[x.id]; else done[x.id] = Date.now();
      save(DONE_KEY, done);
      ctx.toast(done[x.id] ? "✅ Отмечено как снятое — убрано из списка" : "Вернул в список");
      draw(ctx);
    };
    const pq = el.querySelector(".pq");
    if (pq) pq.onclick = () => window.PultPlaque && window.PultPlaque.open(x.top, ctx.esc, ctx.toast);
    return el;
  }

  function section(ctx, title, note, list, empty) {
    const wrap = document.createElement("section");
    wrap.innerHTML = `<h2 class="sec">${ctx.esc(title)} ${note ? `<small>${ctx.esc(note)}</small>` : ""}</h2>`;
    if (!list.length) wrap.innerHTML += `<div class="empty">${ctx.esc(empty)}</div>`;
    list.forEach((x, n) => wrap.appendChild(card(ctx, x, n + 1)));
    return wrap;
  }

  function draw(ctx) {
    const el = ctx.el;
    const all = score(ctx);
    const open = all.filter((x) => !done[x.id]);
    const hot = open.filter((x) => x.top && !x.cooled);
    const saved = all.filter((x) => starred[x.id]);
    const shot = all.filter((x) => done[x.id]);
    el.innerHTML = `
      <p class="xs-intro"><b>Темы для видео</b> по формулам твоих хитов (Гигиена 2М, Еда 1М, Зубы 683к, Асват 632к, Манифест 11.77 подп/1k…),
      а не новости. Если сейчас в СМИ есть сюжет по теме — идея поднимается наверх с меткой <b>🔥 Повод</b> и ссылками для Urgency и плашки.
      Банк идей — в файле <code>config/idea_bank.yaml</code>.</p>
      <div class="xs-panel">
        <div class="seg" id="iv">${[["hot", `🔥 С поводом (${hot.length})`], ["all", `💎 Все темы (${open.length})`], ["bank", `⭐ Банк (${saved.length})`], ["done", `✅ Снято (${shot.length})`]]
          .map(([k, t]) => `<button data-v="${k}"${view === k ? ' class="on"' : ""}>${t}</button>`).join("")}</div>
        <div class="seg" id="iw">${Object.entries(WINS).map(([k, t]) => `<button data-w="${k}"${+k === win ? ' class="on"' : ""}>повод за ${t}</button>`).join("")}</div>
      </div>`;
    if (view === "hot") el.appendChild(section(ctx, "🔥 Темы, на которые сейчас есть повод", "сила темы + свежий сюжет в СМИ", hot, "Сейчас свежих поводов нет — смотри «Все темы»: твои хиты снимаются и без новости."));
    if (view === "all") {
      el.appendChild(section(ctx, "💎 Все темы по силе", "сначала самые сильные", open.filter((x) => !x.cooled), "Пусто."));
      const cooled = open.filter((x) => x.cooled);
      if (cooled.length) {
        const det = document.createElement("details");
        det.className = "fold";
        det.innerHTML = `<summary>🧊 Остывшие темы (${cooled.length}) — только с совсем новым углом</summary>`;
        cooled.forEach((x) => det.appendChild(card(ctx, x, 0)));
        el.appendChild(det);
      }
    }
    if (view === "bank") el.appendChild(section(ctx, "⭐ Мой банк", "сохраняется в этом браузере", saved, "Пока пусто — жми «☆ В банк» на теме."));
    if (view === "done") el.appendChild(section(ctx, "✅ Уже снял", "не повторяй тему 15–20 серий (правило библии)", shot, "Пока ничего не отмечено."));

    el.querySelectorAll("#iv button").forEach((b) => (b.onclick = () => { view = b.dataset.v; draw(ctx); }));
    el.querySelectorAll("#iw button").forEach((b) => (b.onclick = () => { win = +b.dataset.w; draw(ctx); }));
  }

  Pult.registerTab({
    id: "ideas",
    ownPage: true,
    render(ctx) {
      if (bankCfg) return draw(ctx);
      ctx.el.innerHTML = '<div class="empty">Загружаю банк идей…</div>';
      loadBank().then((c) => { bankCfg = c; draw(ctx); })
        .catch((e) => { ctx.el.innerHTML = `<div class="empty">Не загрузился config/idea_bank.yaml: ${ctx.esc(e.message)}</div>`; });
    },
  });
})();
