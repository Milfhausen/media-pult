"""Из списка статей делаем сюжеты: склейка -> цифры -> оценка -> теги."""
import re

from .cluster import art_time, attach_overlap, attach_trends, cluster_articles
from .scoring import FORMULA, apply_score, growth_ratio
from .text import Normalizer, keyword_regex
from .util import hours_ago, iso, load_yaml, make_id


def load_config():
    tabs = []
    for t in load_yaml("config/tabs.yaml").get("tabs", []):
        kw = load_yaml(t["keywords"]) if t.get("keywords") else {}
        fold = kw.get("fold") or None
        tabs.append({
            "id": t["id"],
            "title": t.get("title", t["id"]),
            "module": t.get("module"),
            "categories": kw.get("categories") or {},
            "fold": fold,
        })
    return {
        "scoring": load_yaml("config/scoring.yaml"),
        "dictionary": load_yaml("config/dictionary.yaml"),
        "sources": load_yaml("config/sources.yaml"),
        "telegram": load_yaml("config/telegram_channels.yaml"),
        "tabs": tabs,
    }


def tabs_meta(cfg):
    """Что нужно странице о вкладках (без тяжёлых списков слов)."""
    meta = []
    for t in cfg["tabs"]:
        fold = t["fold"]
        meta.append({
            "id": t["id"], "title": t["title"], "module": t["module"],
            "categories": list(t["categories"]),
            "fold": {"label": fold.get("label"), "link_tab": fold.get("link_tab")} if fold else None,
        })
    return meta


def formula_text(scoring):
    w = {k: scoring.get("weights", {}).get(k, 0) for k in ("outlets", "growth", "reddit", "trends", "ru_telegram")}
    return FORMULA.format(**w)


def build_stories(articles, cfg, now):
    sc = cfg["scoring"]
    cl = sc.get("clustering", {})
    norm = Normalizer(cfg["dictionary"].get("terms"))
    window = cl.get("merge_window_hours", 36)

    base = [a for a in articles if a["kind"] in ("news", "reddit")]
    clusters, idf, index = cluster_articles(base, norm, now, cl.get("similarity", 0.32), window)
    tg = [a for a in articles if a["kind"] == "telegram"]
    attach_overlap(tg, clusters, idf, index, norm, now, cl.get("telegram_match", 0.35), window)
    attach_trends([a for a in articles if a["kind"] == "trend"], clusters, idf, norm, now)

    tab_rx = []
    for t in cfg["tabs"]:
        cats = [(name, keyword_regex(words or [])) for name, words in t["categories"].items()]
        fold_rx = keyword_regex(t["fold"].get("keywords") or []) if t["fold"] else None
        tab_rx.append((t["id"], cats, fold_rx))
    speakers = [(s["label"], [m.lower() for m in s.get("match", [])]) for s in cfg["dictionary"].get("speakers", [])]

    stories = []
    for c in clusters:
        st = make_story(c, now, tab_rx, speakers)
        if st:
            stories.append(apply_score(st, sc))
    stories.sort(key=lambda s: (-s["score"], -s["outlets_total"]))
    return stories


def outlet_key(name):
    """«BBC» из Google News и «BBC News» из RSS — одно издание, считаем один раз."""
    k = re.sub(r"[^a-z0-9а-я ]", "", (name or "").lower()).strip()
    k = re.sub(r"^the ", "", k)
    return re.sub(r" (news|online|uk)$", "", k) or k


def make_story(c, now, tab_rx, speakers):
    news = [a for a in c.members if a["kind"] == "news"]
    reddit = list({a["id"]: a for a in c.members if a["kind"] == "reddit"}.values())
    if not news and not reddit:
        return None
    ago = {a["id"]: hours_ago(art_time(a, now), now) for a in c.members}
    o24 = {outlet_key(a["source"]) for a in news if ago[a["id"]] <= 24}
    o3 = {outlet_key(a["source"]) for a in news if ago[a["id"]] <= 3}
    oprev = {outlet_key(a["source"]) for a in news if 3 < ago[a["id"]] <= 24}

    news_sorted = sorted(news, key=lambda a: art_time(a, now))
    rep = news_sorted[0] if news_sorted else max(reddit, key=lambda a: a["extra"].get("score", 0))
    links, seen = [], set()
    for a in news_sorted:
        if outlet_key(a["source"]) not in seen and a["url"]:
            seen.add(outlet_key(a["source"]))
            links.append({"source": a["source"], "title": a["title"], "url": a["url"],
                          "published": iso(art_time(a, now))})

    r_score = sum(a["extra"].get("score", 0) or 0 for a in reddit)
    r_comm = sum(a["extra"].get("comments", 0) or 0 for a in reddit)
    top_r = max(reddit, key=lambda a: a["extra"].get("score", 0) or 0) if reddit else None

    tg, tg_seen = [], set()
    for p in sorted(c.telegram, key=lambda p: -(p["extra"].get("views") or 0)):
        if p["url"] in tg_seen:
            continue
        tg_seen.add(p["url"])
        tg.append({"channel": p["source"], "text": p["title"][:200], "views": p["extra"].get("views") or 0,
                   "url": p["url"], "published": p.get("published")})

    text = " \n ".join(a["title"] for a in c.members).lower().replace("ё", "е")
    tags, fold = {}, {}
    for tab_id, cats, fold_rx in tab_rx:
        tags[tab_id] = [name for name, rx in cats if rx and rx.search(text)]
        fold[tab_id] = bool(fold_rx and fold_rx.search(text))
    speaker = next((label for label, ms in speakers if any(m in text for m in ms)), None)

    times = [art_time(a, now) for a in c.members]
    return {
        "id": make_id(rep["id"]),
        "title": rep["title"],
        "title_ru": rep["title"] if rep.get("lang") == "ru" else None,
        "lang": rep.get("lang", "en"),
        "first_published": iso(min(times)),
        "last_published": iso(max(times)),
        "outlets_24h": len(o24),
        "outlets_3h": len(o3),
        "outlets_total": len({outlet_key(a["source"]) for a in news}),
        "outlets": sorted({outlet_key(a["source"]): a["source"] for a in news}.values()),
        "growth_ratio": growth_ratio(len(o3), len(oprev)),
        "gdelt_outlets": None,
        "links": links[:5],
        "reddit": {"score": r_score, "comments": r_comm, "posts": len(reddit),
                   "url": top_r["url"] if top_r else None, "sub": top_r["source"] if top_r else None},
        "trends": sorted({t["title"] for t in c.trends}),
        "telegram": tg,
        "tg_views": sum(p["views"] for p in tg),
        "tg_channels": sorted({p["channel"] for p in tg}),
        "tags": tags,
        "fold": fold,
        "speaker": speaker,
    }
