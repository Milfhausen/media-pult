"""4. Google Trends RSS: что британцы ищут прямо сейчас."""
from ..util import article, struct_to_dt


def fetch(cfg, ctx):
    import feedparser

    feed = feedparser.parse(ctx.get(cfg["url"]).content)
    out = []
    for e in feed.entries:
        out.append(article("trend", e.get("title", ""), e.get("link", "") + "#" + e.get("title", ""),
                           "Google Trends", struct_to_dt(e.get("published_parsed")),
                           traffic=e.get("ht_approx_traffic"), news=e.get("ht_news_item_title")))
    return out
