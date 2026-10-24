/* Вкладка «💡 Банк идей»: только жирные сюжеты, отсортированные по ПОТЕНЦИАЛУ ДЛЯ ВАДИМА —
   рубрика, механика, похожая залетевшая серия (config/ideas.yaml). Свой банк — ⭐ в браузере. */
(function () {
  const KEY = "pult-ideas-bank";
  const WINS = { 24: "24 ч", 72: "3 дня", 168: "7 дней" };
  let view = "top", win = 72;
  let bank = {};
  try { bank = JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch (e) { bank = {}; }
  const saveBank = () => { try { localStorage.setItem(KEY, JSON.stringify(bank)); } catch (e) { /* не страшно */ } };

  const hoursBefore = (iso, ref) => (new Date(ref) - new Date(iso)) / 3600000;
  const potClass = (p) => (p >= 60 ? "hot" : p >= 40 ? "warm" : "");

  function ideaCard(ctx, s, rank) {
    const esc = ctx.esc, i = s.idea || {};
    const meta = (ctx.data.mechanics || {});
    const mechs = (s.mechanics || []).map((m) => meta[m]).filter(Boolean);
    const badges = [];
    if (i.early) badges.push('<span class="b early">🆕 РАННИЙ СИГНАЛ — только что вышло</span>');
    if (s.rising) badges.push('<span class="b rise">🚀 РАСТЁТ</span>');
    if (s.first) badges.push('<span class="b first">🥇 ЕЩЁ НИКТО</span>');
    if (s.in_ru_tg) badges.push(`<span class="b tg">📢 УЖЕ В РУ-ТЕЛЕГЕ (${s.tg_channels.length})</span>`);
    if (i.segment) badges.push(`<span class="b tag">#${esc(i.segment)}</span>`);
    mechs.forEach((m) => badges.push(`<span class="b mechb">${esc(m.label)}</span>`));
    const et = i.etalon;
    const el = document.createElement("article");
    el.className = "card idea" + (bank[s.id] ? " saved" : "");
    el.innerHTML = `
      <div><div class="score ${potClass(i.potential)}" title="Потенциал для тебя 0–100">${i.potential}</div><div class="rank">${rank ? "#" + rank : "потенц."}</div></div>
      <div class="body">
        <div class="badges">${badges.join("")}</div>
        <div class="ttl">${esc(s.title_ru || s.title)}</div>
        ${s.title_ru && s.title_ru !== s.title ? `<div class="orig">${esc(s.title)}</div>` : ""}
        ${et ? `<div class="etalon">📈 Похоже на твою серию: <b>${esc(et.ep)}</b> — ${esc(et.views)} просм., ${esc(et.subs)} подп/1k<br><span>Угол: ${esc(et.angle)}</span></div>` : ""}
        ${i.segment_why ? `<div class="why">Почему рубрика сильная: ${esc(i.segment_why)}</div>` : ""}
        ${mechs.length ? `<details class="mech"><summary>Как подать</summary>${mechs.map((m) => `<p><b>${esc(m.label)}</b> — ${esc(m.hint)}</p>`).join("")}</details>` : ""}
        <div class="meta"><span>📰 <b>${s.outlets_24h}</b> изд. за 24 ч</span><span>🔥 хайп ${s.score}</span>${s.reddit && s.reddit.posts ? `<span>Reddit ▲${s.reddit.score}</span>` : ""}${s.trends && s.trends.length ? "<span>🔎 Google Trends</span>" : ""}</div>
        <ul class="links">${(s.links || []).slice(0, 3).map((l) => `<li><span class="src">${esc(l.source)}:</span> <a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.title)}</a></li>`).join("")}</ul>
        <div class="actions">
          <button class="copy alt star" type="button">${bank[s.id] ? "⭐ В банке" : "☆ В банк идей"}</button>
          <button class="copy ai" type="button">🤖 Сценарий с Claude</button>
          <button class="copy alt pq" type="button">🖼 Плашка</button>
        </div>
      </div>`;
    el.querySelector(".star").onclick = () => {
      if (bank[s.id]) delete bank[s.id]; else bank[s.id] = { savedAt: Date.now(), story: s };
      saveBank();
      ctx.toast(bank[s.id] ? "⭐ Сохранено в банк идей" : "Убрано из банка");
      draw(ctx);
    };
    el.querySelector(".ai").onclick = () => ctx.copyText(ctx.claudeText(s)).then(() => ctx.toast("Скопировано — вставь в чат с Claude"));
    el.querySelector(".pq").onclick = () => window.PultPlaque && window.PultPlaque.open(s, ctx.esc, ctx.toast);
    return el;
  }

  function section(ctx, title, note, list, empty) {
    const wrap = document.createElement("section");
    wrap.innerHTML = `<h2 class="sec">${ctx.esc(title)} ${note ? `<small>${ctx.esc(note)}</small>` : ""}</h2>`;
    if (!list.length) wrap.innerHTML += `<div class="empty">${ctx.esc(empty || "Сейчас ничего жирного.")}</div>`;
    list.forEach((s, n) => wrap.appendChild(ideaCard(ctx, s, n + 1)));
    return wrap;
  }

  function draw(ctx) {
    const el = ctx.el, d = ctx.data;
    const all = (d.stories || []).filter((s) => s.idea && s.idea.fat && hoursBefore(s.last_published, d.generated_at) <= win);
    const byPot = (a, b) => b.idea.potential - a.idea.potential || b.score - a.score;
    const mine = all.filter((s) => s.idea.segment).sort(byPot);
    const finds = all.filter((s) => !s.idea.segment && !s.idea.cooled && ((s.mechanics || []).length || s.idea.etalon)).sort(byPot);
    const saved = Object.values(bank).map((b) => b.story).sort(byPot);
    const cats = ((d.tabs || []).find((t) => t.id === "hype") || {}).categories || [];

    el.innerHTML = `
      <p class="xs-intro">Только <b>жирные</b> сюжеты (6+ изданий, или растёт, или в Google Trends), отсортированы по <b>потенциалу для тебя</b>:
      сила рубрики и механики по твоим цифрам + похожая залетевшая серия + 🥇 «никто не писал». Остывшие темы и война — со штрафом.</p>
      <div class="xs-panel">
        <div class="seg" id="iv">${[["top", "🏆 Топ"], ["rub", "📂 Рубрики"], ["finds", "🎲 Находки"], ["bank", `⭐ Мой банк (${saved.length})`]]
          .map(([k, t]) => `<button data-v="${k}"${view === k ? ' class="on"' : ""}>${t}</button>`).join("")}</div>
        <div class="seg" id="iw">${Object.entries(WINS).map(([k, t]) => `<button data-w="${k}"${+k === win ? ' class="on"' : ""}>${t}</button>`).join("")}</div>
      </div>`;
    const early = all.filter((s) => s.idea.early).sort((a, b) => new Date(b.first_published) - new Date(a.first_published));
    if (view === "top" && early.length) el.appendChild(section(ctx, "🆕 Только что вышло — успей первым", "свежак от крупных изданий в твоих темах", early.slice(0, 6)));
    if (view === "top") el.appendChild(section(ctx, "🏆 Самые жирные под тебя", `${mine.length} идей`, mine.filter((s) => !s.idea.early).slice(0, 15)));
    if (view === "rub") cats.forEach((c) => {
      const list = mine.filter((s) => (s.tags.hype || []).includes(c)).slice(0, 5);
      el.appendChild(section(ctx, "#" + c, list.length ? "" : "", list, "Сейчас в этой рубрике ничего жирного."));
    });
    if (view === "finds") el.appendChild(section(ctx, "🎲 Случайные находки", "вне твоих рубрик, но с твоей механикой или похожей серией", finds.slice(0, 15)));
    if (view === "bank") el.appendChild(section(ctx, "⭐ Мой банк идей", "сохраняется в этом браузере", saved, "Пока пусто — жми «☆ В банк идей» на сюжете."));

    el.querySelectorAll("#iv button").forEach((b) => (b.onclick = () => { view = b.dataset.v; draw(ctx); }));
    el.querySelectorAll("#iw button").forEach((b) => (b.onclick = () => { win = +b.dataset.w; draw(ctx); }));
  }

  Pult.registerTab({ id: "ideas", ownPage: true, render: draw });
})();
