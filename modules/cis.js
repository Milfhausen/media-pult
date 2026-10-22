/* Вкладка «🇺🇦🇷🇺 СНГ-радар»: новости UK/EU про Россию, Украину и людей из СНГ.
   ТОП-10 + разбивка по подтемам. Рядом с сюжетом — кто сказал. */
Pult.registerTab({
  id: "cis",
  render(ctx) {
    const id = ctx.tab.id;
    const mine = ctx.stories.filter((s) => s.tags && s.tags[id] && s.tags[id].length);
    const opts = { speaker: true };

    ctx.el.appendChild(ctx.section("ТОП-10 прямо сейчас", mine.slice(0, 10), Object.assign({ ranked: true }, opts)));
    (ctx.tab.categories || []).forEach((cat) => {
      const list = mine.filter((s) => s.tags[id].includes(cat));
      ctx.el.appendChild(ctx.section(cat, list.slice(0, 5), Object.assign({ note: list.length ? `${list.length} сюж.` : "", empty: "Сейчас ничего." }, opts)));
    });
  },
});
