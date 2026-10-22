"""1. Google News RSS (Британия): главная лента + поиск по темам из config/sources.yaml."""
from ..util import GNEWS, GNEWS_PARAMS, gnews_search_url, parse_feed


def fetch(cfg, ctx):
    urls = []
    if cfg.get("top", True):
        urls.append(("Google News: главное", f"{GNEWS}?{GNEWS_PARAMS}"))
    for q in cfg.get("queries", []):
        urls.append((f"Google News: «{q}»", gnews_search_url(q + " when:1d")))
    out, fails = [], 0
    for name, url in urls:
        try:
            out += parse_feed(ctx.get(url).content)
        except Exception as e:  # один запрос упал — остальные продолжаем
            fails += 1
            ctx.report(name, False, error=e)
    if urls and fails == len(urls):
        raise RuntimeError("ни один запрос к Google News не прошёл")
    return out
