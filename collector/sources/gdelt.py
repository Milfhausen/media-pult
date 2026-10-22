"""2. GDELT DOC 2.0: сколько разных изданий в мире написали про сюжет за 24 ч (без ключа)."""
import time
from urllib.parse import quote

API = "https://api.gdeltproject.org/api/v2/doc/doc"


def query_for(title, norm):
    words = [w for w in norm.tokens(title) if w.isascii() and len(w) > 2 and not w.isdigit()]
    return " ".join(words[:5])


def count_domains(q, ctx):
    url = f"{API}?query={quote(q)}%20sourcelang:english&mode=ArtList&maxrecords=250&timespan=24h&format=json"
    r = ctx.get(url)
    if not r.text.strip().startswith("{"):
        raise RuntimeError(r.text.strip()[:120] or "пустой ответ")
    return len({a.get("domain") for a in r.json().get("articles", []) if a.get("domain")})


def enrich(stories, cfg, ctx, norm):
    done = 0
    for st in stories[: cfg.get("top_n", 12)]:
        q = query_for(st["title"], norm)
        if len(q.split()) < 2:
            continue
        if done:
            time.sleep(cfg.get("pause_seconds", 6))
        st["gdelt_outlets"] = count_domains(q, ctx)
        st["outlets_24h"] = max(st["outlets_24h"], st["gdelt_outlets"])
        done += 1
    return done
