/* Пульт управления медийкой — общий движок страницы.
   Вкладки подключаются из config/tabs.yaml, каждая — файл в modules/,
   который вызывает Pult.registerTab({ id, render(ctx) }). */
(function () {
  "use strict";

  const modules = {};
  const state = { data: null, status: null, tabs: [], tabId: null, tag: "", rising: false, first: false, win: 24 };
  const $ = (s) => document.querySelector(s);

  // ---------- помощники ----------
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const londonFmt = new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/London", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const fmtTime = (iso) => (iso ? londonFmt.format(new Date(iso)) : "—");
  const num = (n) => (n >= 1e6 ? (n / 1e6).toFixed(1).replace(".0", "") + " млн" : n >= 1e3 ? (n / 1e3).toFixed(1).replace(".0", "") + " тыс." : String(n || 0));
  function ago(iso) {
    const m = Math.round((Date.now() - new Date(iso)) / 60000);
    if (m < 1) return "только что";
    if (m < 60) return m + " мин назад";
    if (m < 48 * 60) return Math.round(m / 60) + " ч назад";
    return Math.round(m / 1440) + " дн. назад";
  }
  const hoursBefore = (iso, ref) => (new Date(ref) - new Date(iso)) / 3600000;
  function plural(n, one, few, many) {
    const a = n % 10, b = n % 100;
    return a === 1 && b !== 11 ? one : a >= 2 && a <= 4 && (b < 10 || b >= 20) ? few : many;
  }

  async function getJSON(url) {
    const r = await fetch(url + "?t=" + Date.now(), { cache: "no-store" });
    if (!r.ok) throw new Error(url + ": " + r.status);
    return r.json();
  }

  function loadScript(src) {
    return new Promise((ok, fail) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = ok;
      s.onerror = () => fail(new Error("не загрузился " + src));
      document.head.appendChild(s);
    });
  }

  function toast(text) {
    const t = $("#toast");
    t.textContent = text;
    t.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => (t.hidden = true), 1800);
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    toast("Скопировано ✓");
  }

  // ---------- текст «для сценария» ----------
  function scriptText(s) {
    const L = [];
    L.push("🎬 " + (s.title_ru || s.title));
    if (s.title_ru && s.title_ru !== s.title) L.push("🇬🇧 " + s.title);
    L.push("");
    L.push(`Хайп-оценка: ${s.score}/100`);
    L.push(`Изданий за 24 ч: ${s.outlets_24h}` + (s.outlets_3h ? ` (за последние 3 ч: ${s.outlets_3h})` : "") + (s.rising ? " — 🚀 РАСТЁТ" : ""));
    if (s.outlets && s.outlets.length) L.push("Кто писал: " + s.outlets.slice(0, 10).join(", "));
    if (s.speaker) L.push("Кто сказал: " + s.speaker);
    if (s.reddit && s.reddit.posts) L.push(`Reddit: ▲${s.reddit.score} лайков, ${s.reddit.comments} комментариев (${s.reddit.sub || ""})`);
    if (s.trends && s.trends.length) L.push("В Google Trends Британии: " + s.trends.join(", "));
    if (s.first) L.push("🥇 В ру-Телеге ещё никто не написал");
    if (s.in_ru_tg) L.push("📢 Уже в ру-Телеге: " + s.telegram.map((p) => `${p.channel} (${num(p.views)} просм.)`).join(", "));
    L.push("Впервые: " + fmtTime(s.first_published) + " (Лондон)");
    L.push("");
    L.push("Ссылки:");
    (s.links || []).forEach((l) => L.push(`— ${l.source}: ${l.url}`));
    if (s.reddit && s.reddit.url) L.push(`— Reddit: ${s.reddit.url}`);
    return L.join("\n");
  }

  // ---------- карточка сюжета ----------
  function card(s, opts) {
    opts = opts || {};
    const tabId = opts.tabId || state.tabId;
    const cls = s.score >= 60 ? "hot" : s.score >= 35 ? "warm" : "";
    const badges = [];
    if (s.rising) badges.push('<span class="b rise">🚀 РАСТЁТ</span>');
    if (s.first) badges.push('<span class="b first">🥇 ЕЩЁ НИКТО НЕ НАПИСАЛ</span>');
    if (s.in_ru_tg) badges.push('<span class="b tg">📢 УЖЕ В РУ-ТЕЛЕГЕ</span>');
    ((s.tags && s.tags[tabId]) || []).forEach((t) => badges.push(`<span class="b tag">#${esc(t)}</span>`));

    const meta = [`📰 <b>${s.outlets_24h}</b> ${plural(s.outlets_24h, "издание", "издания", "изданий")} за 24 ч`];
    if (s.outlets_3h) meta.push(`за 3 ч: <b>${s.outlets_3h}</b>`);
    meta.push(`🕐 впервые ${fmtTime(s.first_published)}`);
    if (s.reddit && s.reddit.posts) meta.push(`Reddit ▲<b>${num(s.reddit.score)}</b> 💬${num(s.reddit.comments)}`);
    if (s.trends && s.trends.length) meta.push(`🔎 Google Trends: «${esc(s.trends.join(", "))}»`);

    const links = (s.links || []).slice(0, 5).map((l) => `<li><span class="src">${esc(l.source)}:</span> <a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.title)}</a></li>`);
    if (s.reddit && s.reddit.url) links.push(`<li><span class="src">${esc(s.reddit.sub || "Reddit")}:</span> <a href="${esc(s.reddit.url)}" target="_blank" rel="noopener">обсуждение</a></li>`);

    const tg = s.in_ru_tg
      ? `<div class="tgbox">📢 Уже писали: ${s.telegram.length} ${plural(s.telegram.length, "пост", "поста", "постов")}, ${num(s.tg_views)} просмотров<ul>${s.telegram
          .slice(0, 5)
          .map((p) => `<li><b>${esc(p.channel)}</b> · ${num(p.views)} просм. · <a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.text.slice(0, 90))}…</a></li>`)
          .join("")}</ul></div>`
      : "";

    const el = document.createElement("article");
    el.className = "card";
    el.innerHTML = `
      <div><div class="score ${cls}" title="Хайп-оценка 0–100">${s.score}</div>${opts.rank ? `<div class="rank">#${opts.rank}</div>` : ""}</div>
      <div class="body">
        <div class="badges">${badges.join("")}</div>
        <div class="ttl">${esc(s.title_ru || s.title)}</div>
        ${s.title_ru && s.title_ru !== s.title ? `<div class="orig">${esc(s.title)}</div>` : ""}
        ${opts.speaker && s.speaker ? `<div class="speaker">🎙 Кто сказал: <b>${esc(s.speaker)}</b></div>` : ""}
        <div class="meta">${meta.map((m) => `<span>${m}</span>`).join("")}</div>
        <ul class="links">${links.join("")}</ul>
        ${tg}
        <div class="actions"><button class="copy" type="button">📋 Скопировать для сценария</button></div>
      </div>`;
    el.querySelector(".copy").addEventListener("click", () => copyText(scriptText(s)));
    return el;
  }

  // ---------- блоки для модулей ----------
  function section(title, stories, opts) {
    opts = opts || {};
    const wrap = document.createElement("section");
    const h = document.createElement("h2");
    h.className = "sec";
    h.innerHTML = esc(title) + (opts.note ? ` <small>${esc(opts.note)}</small>` : "");
    wrap.appendChild(h);
    if (!stories.length) {
      const e = document.createElement("div");
      e.className = "empty";
      e.textContent = opts.empty || "Пока пусто — попробуй период «7 дней» или сними фильтры.";
      wrap.appendChild(e);
      return wrap;
    }
    stories.forEach((s, i) => wrap.appendChild(card(s, Object.assign({ rank: opts.ranked ? i + 1 : 0 }, opts))));
    return wrap;
  }

  function collapsible(summary, stories, opts) {
    const d = document.createElement("details");
    d.className = (opts && opts.cls) || "more";
    d.innerHTML = `<summary>${summary}</summary>`;
    stories.forEach((s) => d.appendChild(card(s, opts)));
    return d;
  }

  // ---------- фильтры ----------
  function filtered(tabId) {
    const d = state.data;
    let list = d.stories.filter((s) => state.win >= 168 || hoursBefore(s.last_published, d.generated_at) <= state.win);
    if (state.rising) list = list.filter((s) => s.rising);
    if (state.first) list = list.filter((s) => s.first);
    if (state.tag) list = list.filter((s) => ((s.tags && s.tags[tabId]) || []).includes(state.tag));
    if (state.win >= 168) list = list.slice().sort((a, b) => b.outlets_total - a.outlets_total || b.score - a.score);
    return list;
  }

  function fillTags() {
    const tab = state.tabs.find((t) => t.id === state.tabId) || {};
    const sel = $("#f-tag");
    sel.innerHTML = '<option value="">Все</option>' + (tab.categories || []).map((c) => `<option>${esc(c)}</option>`).join("");
    if (!(tab.categories || []).includes(state.tag)) state.tag = "";
    sel.value = state.tag;
  }

  // ---------- отрисовка ----------
  function renderTabs() {
    const nav = $("#tabs");
    nav.innerHTML = "";
    state.tabs.forEach((t) => {
      const b = document.createElement("button");
      b.textContent = t.title;
      b.className = t.id === state.tabId ? "on" : "";
      b.setAttribute("role", "tab");
      b.addEventListener("click", () => switchTab(t.id));
      nav.appendChild(b);
    });
  }

  function switchTab(id) {
    state.tabId = id;
    try { history.replaceState(null, "", "#" + id); } catch (e) { /* ничего */ }
    fillTags();
    renderTabs();
    render();
    window.scrollTo({ top: 0 });
  }

  function render() {
    const view = $("#view");
    view.innerHTML = "";
    const tab = state.tabs.find((t) => t.id === state.tabId);
    const mod = tab && modules[tab.id];
    if (!mod) {
      view.innerHTML = `<div class="empty">Модуль вкладки не загрузился (${esc(tab ? tab.module : "?")}). Проверь config/tabs.yaml.</div>`;
      return;
    }
    try {
      mod.render({ el: view, tab, stories: filtered(tab.id), all: state.data.stories, data: state.data, section, collapsible, card, switchTab, esc });
    } catch (e) {
      console.error(e);
      view.innerHTML = `<div class="empty">Ошибка во вкладке: ${esc(e.message)}</div>`;
    }
  }

  function renderHeader() {
    const d = state.data;
    $("#updated").innerHTML = `Обновлено: <b>${fmtTime(d.generated_at)}</b> (Лондон) · ${ago(d.generated_at)}`;
    $("#formula").textContent = d.formula || "";
    const banners = [];
    if (d.demo) banners.push('<div class="banner demo">🧪 Показаны <b>демо-данные</b> (выдуманные заголовки). Настоящие появятся после первого сбора — см. «Как обновить вручную».</div>');
    else if (hoursBefore(d.generated_at, new Date().toISOString()) > 3) banners.push('<div class="banner warn">⚠️ Данные не обновлялись больше 3 часов. Проверь вкладку Actions на GitHub.</div>');
    const bad = ((state.status && state.status.sources) || []).filter((s) => !s.ok);
    if (bad.length) {
      banners.push(`<div class="banner warn"><details><summary>⚠️ Источник не ответил: ${esc(bad.slice(0, 4).map((s) => s.name).join(", "))}${bad.length > 4 ? ` и ещё ${bad.length - 4}` : ""}</summary><ul>${bad
        .map((s) => `<li><b>${esc(s.name)}</b>: ${esc(s.error || "нет ответа")}</li>`)
        .join("")}</ul><div class="muted">Остальные источники работают — данные показаны без этих.</div></details></div>`);
    }
    $("#banners").innerHTML = banners.join("");
  }

  function bindFilters() {
    $("#f-tag").addEventListener("change", (e) => { state.tag = e.target.value; render(); });
    $("#f-rising").addEventListener("change", (e) => { state.rising = e.target.checked; render(); });
    $("#f-first").addEventListener("change", (e) => { state.first = e.target.checked; render(); });
    document.querySelectorAll("#f-win button").forEach((b) =>
      b.addEventListener("click", () => {
        state.win = +b.dataset.win;
        document.querySelectorAll("#f-win button").forEach((x) => x.classList.toggle("on", x === b));
        render();
      })
    );
  }

  async function loadTabsConfig(dataTabs) {
    let list = null;
    try {
      const r = await fetch("config/tabs.yaml?t=" + Date.now(), { cache: "no-store" });
      if (r.ok && window.jsyaml) list = (window.jsyaml.load(await r.text()) || {}).tabs;
    } catch (e) { /* возьмём из данных */ }
    if (!Array.isArray(list) || !list.length) list = dataTabs || [];
    const byId = {};
    (dataTabs || []).forEach((t) => (byId[t.id] = t));
    return list.map((t) => Object.assign({ categories: [], fold: null }, byId[t.id] || {}, { id: t.id, title: t.title || t.id, module: t.module }));
  }

  async function init() {
    let data, status;
    try {
      data = await getJSON("data/stories.json");
      if (!data.stories || !data.stories.length) throw new Error("пусто");
      status = await getJSON("data/status.json").catch(() => null);
    } catch (e) {
      data = await getJSON("data/sample_stories.json");
      data.demo = true;
      status = await getJSON("data/sample_status.json").catch(() => null);
    }
    state.data = data;
    state.status = status;
    state.tabs = await loadTabsConfig(data.tabs);
    await Promise.all(state.tabs.filter((t) => t.module).map((t) => loadScript(t.module).catch((e) => console.warn(e.message))));
    const want = (location.hash || "").slice(1);
    state.tabId = state.tabs.some((t) => t.id === want) ? want : (state.tabs[0] || {}).id;
    renderHeader();
    bindFilters();
    fillTags();
    renderTabs();
    render();
  }

  window.Pult = { registerTab: (def) => (modules[def.id] = def), scriptText };
  document.addEventListener("DOMContentLoaded", () =>
    init().catch((e) => {
      console.error(e);
      $("#view").innerHTML = `<div class="empty">Не получилось загрузить данные: ${esc(e.message)}</div>`;
    })
  );
})();
