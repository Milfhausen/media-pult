"""Главный запуск сбора:  python -m collector.main
Собирает все источники, склеивает сюжеты, считает оценку и пишет data/*.json."""
import sys
from concurrent.futures import ThreadPoolExecutor
from concurrent.futures import TimeoutError as FutTimeout
from datetime import timedelta

import statistics

from .cluster import art_time
from .pipeline import build_stories, formula_text, load_config, tabs_meta
from .scoring import apply_score
from .sources import Ctx, gdelt, google_news, reddit, rss, telegram, trends
from .text import Normalizer
from .translate import translate_stories
from .util import DATA, iso, load_json, load_yaml, now_utc, save_json

SOURCES = [
    ("Google News", "google_news", google_news.fetch),
    ("RSS изданий", "rss", rss.fetch),
    ("Reddit", "reddit", reddit.fetch),
    ("Google Trends", "trends", trends.fetch),
    ("Telegram", "telegram", telegram.fetch),
]
MAX_STORIES = 250


def run_limited(fn, args, seconds):
    pool = ThreadPoolExecutor(max_workers=1)
    try:
        return pool.submit(fn, *args).result(timeout=seconds)
    finally:
        pool.shutdown(wait=False, cancel_futures=True)


def channel_stats(posts):
    """Рейтинг Telegram-каналов: средние (медианные) просмотры на пост."""
    by = {}
    for p in posts:
        by.setdefault(p["source"], []).append(p["extra"].get("views") or 0)
    out = [{"title": t, "avg_views": int(statistics.median(v)), "posts": len(v)} for t, v in by.items()]
    return sorted(out, key=lambda c: -c["avg_views"])


def main():
    cfg = load_config()
    src = cfg["sources"]
    now = now_utc()
    ctx = Ctx(src.get("user_agent", "media-pult"), src.get("timeout_seconds", 20))

    store = {a["id"]: a for a in load_json(DATA / "articles.json", [])}
    for title, key, fn in SOURCES:
        scfg = src.get(key, {})
        if not scfg.get("enabled", True):
            continue
        arg = dict(scfg, channels=cfg["telegram"].get("channels", [])) if key == "telegram" else scfg
        try:
            items = run_limited(fn, (arg, ctx), scfg.get("timeout_seconds", src.get("source_timeout_seconds", 240)))
            ctx.report(title, True, len(items))
        except (Exception, FutTimeout) as e:
            print(f"[!] {title}: {e!r}", file=sys.stderr)
            ctx.report(title, False, error=str(e) or "таймаут")
            continue
        for a in items:
            old = store.get(a["id"])
            a["seen"] = old["seen"] if old else iso(now)
            if old and not a.get("published"):
                a["published"] = old.get("published")
            store[a["id"]] = a  # свежие лайки/просмотры заменяют старые

    keep_from = now - timedelta(days=src.get("history_days", 7))
    tg_from = now - timedelta(hours=src.get("telegram", {}).get("keep_hours", 48))
    articles = [a for a in store.values()
                if art_time(a, now) >= (tg_from if a["kind"] == "telegram" else keep_from)]

    channels = channel_stats([a for a in articles if a["kind"] == "telegram"])
    min_views = src.get("telegram", {}).get("min_avg_views", 0) or 0
    popular = {c["title"] for c in channels if c["avg_views"] >= min_views}
    stories = build_stories([a for a in articles if a["kind"] != "telegram" or a["source"] in popular], cfg, now)

    gcfg = src.get("gdelt", {})
    if gcfg.get("enabled", True):
        try:
            n = run_limited(gdelt.enrich, (stories, gcfg, ctx, Normalizer(cfg["dictionary"].get("terms"))), 150)
            ctx.report("GDELT", True, n)
        except (Exception, FutTimeout) as e:
            ctx.report("GDELT", False, error=str(e) or "таймаут")
        for st in stories:
            apply_score(st, cfg["scoring"])
        stories.sort(key=lambda s: (-s["score"], -s["outlets_total"]))

    by_total = sorted(stories, key=lambda s: -s["outlets_total"])[:100]
    picked = {s["id"]: s for s in stories[:MAX_STORIES]}
    for s in by_total:
        picked.setdefault(s["id"], s)
    out = sorted(picked.values(), key=lambda s: (-s["score"], -s["outlets_total"]))

    tcfg = src.get("translate", {})
    if tcfg.get("enabled", True):
        cache = load_json(DATA / "translations.json", {})
        new, err = translate_stories(out, cache, tcfg.get("max_new_per_run", 80))
        ctx.report("Перевод (Google Translate)", err is None, new, err)
        titles = {s["title"] for s in out}
        save_json(DATA / "translations.json", {k: v for k, v in cache.items() if k in titles})

    save_json(DATA / "articles.json", articles)
    save_json(DATA / "channels.json", channels, indent=1)
    save_json(DATA / "x_searches.json", load_yaml("config/x_searches.yaml"))  # запасная копия для вкладки X
    save_json(DATA / "status.json", {"generated_at": iso(now), "sources": ctx.status}, indent=1)
    save_json(DATA / "stories.json", {
        "generated_at": iso(now), "demo": False,
        "weights": cfg["scoring"].get("weights", {}), "formula": formula_text(cfg["scoring"]),
        "tabs": tabs_meta(cfg), "stories": out,
    })
    bad = [s["name"] for s in ctx.status if not s["ok"]]
    print(f"Готово: {len(articles)} статей, {len(out)} сюжетов. Не ответили: {', '.join(bad) or 'нет'}")


if __name__ == "__main__":
    main()
