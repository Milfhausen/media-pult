"""3. Reddit: топ за день. Сначала .json (есть лайки), если заблокировали — .rss (только заголовки)."""
from datetime import datetime, timezone

from ..util import article, parse_feed


def fetch(cfg, ctx):
    out, ok_any = [], False
    for sub in cfg.get("subreddits", []):
        src = f"Reddit r/{sub}"
        try:
            r = ctx.get(f"https://www.reddit.com/r/{sub}/top.json?t=day&limit={cfg.get('limit', 25)}&raw_json=1")
            for ch in r.json()["data"]["children"]:
                d = ch["data"]
                if d.get("stickied"):
                    continue
                out.append(article(
                    "reddit", d["title"], "https://www.reddit.com" + d["permalink"], src,
                    datetime.fromtimestamp(d["created_utc"], tz=timezone.utc),
                    score=d.get("score", 0), comments=d.get("num_comments", 0), link=d.get("url")))
            ctx.report(src, True, len(r.json()["data"]["children"]))
            ok_any = True
        except Exception as e:
            try:
                items = parse_feed(ctx.get(f"https://www.reddit.com/r/{sub}/top/.rss?t=day").content,
                                   source_name=src, kind="reddit")
                for a in items:
                    a["source"] = src
                out += items
                ctx.report(src + " (RSS, без лайков)", True, len(items))
                ok_any = True
            except Exception as e2:
                ctx.report(src, False, error=f"{e} / RSS: {e2}")
    if not ok_any:
        raise RuntimeError("Reddit не ответил ни по одному сабреддиту")
    return out
