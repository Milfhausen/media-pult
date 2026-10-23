/* Плашка-пруф для монтажа: картинка PNG с заголовком новости.
   Рисуется прямо в браузере (canvas): крупно — заголовок по-русски, мельче — оригинал,
   сверху — источник, снизу — подпись автора. Текст можно поправить перед скачиванием. */
(function () {
  "use strict";
  const SIGN = "Вадим Гайдей | Выживаю в Лондоне";
  const W = 1080, PAD = 72;
  const THEMES = {
    dark: { bg: "#111418", border: "#2b323c", ru: "#ffffff", en: "#aab4c0", src: "#8b96a3", sign: "#ff7a3d", line: "#2b323c", mark: "#ffd400", markText: "#111" },
    light: { bg: "#ffffff", border: "#c8102e", ru: "#111111", en: "#555555", src: "#777777", sign: "#c8102e", line: "#e3e3e3", mark: "#ffd400", markText: "#111" },
  };
  const NUM = /([£$€]?\d[\d\u00a0.,]*(?:\u00a0?(?:%|млн|млрд|тыс\.?))?)/;
  let st = { story: null, theme: "dark", src: 0, mark: true };
  try { Object.assign(st, JSON.parse(localStorage.getItem("pult-plaque") || "{}"), { story: null, src: 0 }); } catch (e) { /* по умолчанию */ }

  function wrap(ctx, text, maxW) {
    const words = text.split(/ +/).filter(Boolean), lines = []; // неразрывный пробел внутри чисел не режем
    let line = "";
    for (const w of words) {
      const t = line ? line + " " + w : w;
      if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
    }
    if (line) lines.push(line);
    return lines;
  }

  // рисуем строку; если в ней есть выделенная цифра — подложка жёлтым
  function drawLine(ctx, line, x, y, size, th, markStr) {
    if (!markStr || !line.includes(markStr)) { ctx.fillText(line, x, y); return; }
    const i = line.indexOf(markStr), before = line.slice(0, i), after = line.slice(i + markStr.length);
    ctx.fillText(before, x, y);
    const bx = x + ctx.measureText(before).width, mw = ctx.measureText(markStr).width;
    ctx.fillStyle = th.mark;
    roundRect(ctx, bx - 8, y - size * 0.86, mw + 16, size * 1.08, 10); ctx.fill();
    ctx.fillStyle = th.markText; ctx.fillText(markStr, bx, y);
    ctx.fillStyle = th.ru; ctx.fillText(after, bx + mw, y);
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  // «70 000», «£1,2 млн» — склеиваем неразрывными пробелами, чтобы число не разъехалось по строкам
  const glueNumbers = (t) => t.replace(/(\d) (?=\d{3}\b)/g, "$1\u00a0").replace(/(\d) (?=(?:%|млн|млрд|тыс))/g, "$1\u00a0");

  function render(canvas, { ru, en, source }) {
    ru = glueNumbers(ru.replace(/\s+/g, " "));
    const th = THEMES[st.theme] || THEMES.dark;
    const ctx = canvas.getContext("2d");
    const inner = W - PAD * 2 - (st.theme === "light" ? 16 : 0);
    const ruSize = ru.length > 110 ? 58 : 68, enSize = 34;
    ctx.font = `800 ${ruSize}px Arial, Helvetica, sans-serif`;
    const ruLines = wrap(ctx, ru, inner);
    ctx.font = `500 ${enSize}px Georgia, "Times New Roman", serif`;
    const enLines = en ? wrap(ctx, en, inner) : [];
    const H = PAD + 40 + 36 + ruLines.length * ruSize * 1.18 + (enLines.length ? 30 + enLines.length * enSize * 1.3 : 0) + 50 + 2 + 40 + 34 + PAD - 10;
    canvas.width = W; canvas.height = Math.round(H);

    ctx.fillStyle = th.bg; roundRect(ctx, 0, 0, W, H, 36); ctx.fill();
    if (st.theme === "light") { ctx.fillStyle = th.border; ctx.fillRect(0, 36, 16, H - 72); }
    else { ctx.strokeStyle = th.border; ctx.lineWidth = 3; roundRect(ctx, 1.5, 1.5, W - 3, H - 3, 35); ctx.stroke(); }

    const x = PAD + (st.theme === "light" ? 16 : 0);
    let y = PAD + 30;
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = th.src; ctx.font = "700 30px Arial, Helvetica, sans-serif";
    ctx.fillText(source ? "Источник: " + source : "", x, y);
    y += 36;

    const m = st.mark ? (ru.match(NUM) || [])[1] : null;
    const markStr = m && /\d/.test(m) ? m.trim() : null;
    ctx.font = `800 ${ruSize}px Arial, Helvetica, sans-serif`;
    for (const line of ruLines) { y += ruSize * 1.18; ctx.fillStyle = th.ru; drawLine(ctx, line, x, y - ruSize * 0.18, ruSize, th, markStr); }

    if (enLines.length) {
      y += 30; ctx.fillStyle = th.en; ctx.font = `500 ${enSize}px Georgia, "Times New Roman", serif`;
      for (const line of enLines) { y += enSize * 1.3; ctx.fillText(line, x, y - enSize * 0.3); }
    }
    y += 50; ctx.fillStyle = th.line; ctx.fillRect(x, y, inner, 2);
    y += 40 + 30; ctx.fillStyle = th.sign; ctx.font = "800 32px Arial, Helvetica, sans-serif";
    ctx.fillText(SIGN, x, y);
  }

  function save() { try { localStorage.setItem("pult-plaque", JSON.stringify({ theme: st.theme, mark: st.mark })); } catch (e) { /* не страшно */ } }

  function open(story, esc, toast) {
    st.story = story; st.src = 0;
    const links = (story.links || []).length ? story.links : [{ source: "", title: story.title }];
    let box = document.getElementById("plaque");
    if (!box) { box = document.createElement("div"); box.id = "plaque"; document.body.appendChild(box); }
    box.innerHTML = `
      <div class="pq-panel" role="dialog" aria-label="Плашка">
        <div class="pq-head"><b>🖼 Плашка для монтажа</b><button class="pq-x" type="button" aria-label="Закрыть">✕</button></div>
        <div class="pq-ctrl">
          <div class="seg"><button data-t="dark">Тёмная</button><button data-t="light">Белая</button></div>
          <label class="chk"><input type="checkbox" class="pq-mark"${st.mark ? " checked" : ""}> выделить цифру</label>
          ${links.length > 1 ? `<label>Источник <select class="pq-src">${links.map((l, i) => `<option value="${i}">${esc(l.source || "—")}</option>`).join("")}</select></label>` : ""}
        </div>
        <label class="pq-l">Заголовок по-русски (можно поправить)<textarea class="pq-ru" rows="3">${esc(story.title_ru || story.title)}</textarea></label>
        <label class="pq-l">Оригинал<textarea class="pq-en" rows="2">${esc(links[0].title || story.title)}</textarea></label>
        <canvas class="pq-canvas"></canvas>
        <div class="actions">
          <button class="copy pq-dl" type="button">⬇️ Скачать PNG</button>
          ${navigator.canShare ? '<button class="copy alt pq-share" type="button">📲 Сохранить / поделиться</button>' : ""}
        </div>
      </div>`;
    box.hidden = false;
    const q = (c) => box.querySelector(c);
    const canvas = q(".pq-canvas");
    const data = () => ({ ru: q(".pq-ru").value.trim(), en: q(".pq-en").value.trim(), source: links[st.src].source });
    const redraw = () => {
      box.querySelectorAll(".seg button").forEach((b) => b.classList.toggle("on", b.dataset.t === st.theme));
      render(canvas, data());
    };
    const fileName = () => `plashka-${(story.id || "news").slice(0, 8)}-${st.theme}.png`;
    const blob = () => new Promise((ok) => canvas.toBlob(ok, "image/png"));

    q(".pq-x").onclick = () => (box.hidden = true);
    box.onclick = (e) => { if (e.target === box) box.hidden = true; };
    box.querySelectorAll(".seg button").forEach((b) => (b.onclick = () => { st.theme = b.dataset.t; save(); redraw(); }));
    q(".pq-mark").onchange = (e) => { st.mark = e.target.checked; save(); redraw(); };
    if (q(".pq-src")) q(".pq-src").onchange = (e) => { st.src = +e.target.value; q(".pq-en").value = links[st.src].title || ""; redraw(); };
    q(".pq-ru").oninput = redraw;
    q(".pq-en").oninput = redraw;
    q(".pq-dl").onclick = async () => {
      const url = URL.createObjectURL(await blob());
      const a = document.createElement("a"); a.href = url; a.download = fileName();
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      toast("Плашка скачана");
    };
    if (q(".pq-share")) q(".pq-share").onclick = async () => {
      const file = new File([await blob()], fileName(), { type: "image/png" });
      if (navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file] }); } catch (e) { /* отменил */ } }
      else toast("Телефон не даёт поделиться — нажми «Скачать PNG»");
    };
    redraw();
  }

  window.PultPlaque = { open, render };
})();
