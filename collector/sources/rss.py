"""5. RSS крупных изданий. Если RSS не ответил — берём то же издание через Google News (site:...)."""
from ..util import gnews_search_url, parse_feed


def fetch(cfg, ctx):
    out = []
    for f in cfg.get("feeds", []):
        name, items, err = f["name"], [], None
        if f.get("url"):
            try:
                items = parse_feed(ctx.get(f["url"]).content, source_name=name)
            except Exception as e:
                err = e
        if not items and f.get("fallback_site"):
            try:
                items = parse_feed(ctx.get(gnews_search_url(f"site:{f['fallback_site']} when:1d")).content)
                for a in items:
                    a["source"] = name
                if err:
                    err = None
                    name += " (через Google News)"
            except Exception as e:
                err = err or e
        ctx.report(f"RSS: {name}", bool(items) and not err, len(items), err or (None if items else "пусто"))
        out += items
    return out
