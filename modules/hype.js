/* Вкладка «🔥 Хайп-радар: Британия и Европа».
   ТОП-10 + остальные сюжеты. Война и Россия–Украина — в сером блоке внизу. */
Pult.registerTab({
  id: "hype",
  render(ctx) {
    const id = ctx.tab.id;
    const main = ctx.stories.filter((s) => !(s.fold && s.fold[id]));
    const folded = ctx.stories.filter((s) => s.fold && s.fold[id]);

    ctx.el.appendChild(ctx.section("ТОП-10 прямо сейчас", main.slice(0, 10), { ranked: true }));
    if (main.length > 10) {
      ctx.el.appendChild(ctx.collapsible(`Ещё сюжеты (${Math.min(main.length - 10, 40)})`, main.slice(10, 50)));
    }
    if (folded.length) {
      const fold = ctx.tab.fold || {};
      const box = ctx.collapsible(`🪖 ${ctx.esc(fold.label || "Война")}: ${folded.length} — подробно смотри СНГ-радар`, folded.slice(0, 15), { cls: "fold" });
      if (fold.link_tab) {
        const b = document.createElement("button");
        b.className = "linkbtn";
        b.textContent = "→ Открыть СНГ-радар";
        b.addEventListener("click", () => ctx.switchTab(fold.link_tab));
        box.insertBefore(b, box.children[1] || null);
      }
      ctx.el.appendChild(box);
    }
  },
});
