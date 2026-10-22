"""Общие помощники: пути, конфиги, время, HTTP, разбор RSS."""
import calendar
import hashlib
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import quote_plus

import yaml

ROOT = Path(__file__).resolve().parent.parent
CONFIG = ROOT / "config"
DATA = ROOT / "data"

GNEWS = "https://news.google.com/rss"
GNEWS_PARAMS = "hl=en-GB&gl=GB&ceid=GB:en"


def load_yaml(path):
    path = Path(path)
    if not path.is_absolute():
        path = ROOT / path
    with open(path, encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def load_json(path, default):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return default


def save_json(path, obj, indent=None):
    path = Path(path)
    tmp = path.with_suffix(".tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=indent)
    tmp.replace(path)


def now_utc():
    return datetime.now(timezone.utc).replace(microsecond=0)


def iso(dt):
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ") if dt else None


def parse_iso(s):
    if not s:
        return None
    try:
        dt = datetime.fromisoformat(str(s).replace("Z", "+00:00"))
    except ValueError:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def hours_ago(dt, now):
    return (now - dt) / timedelta(hours=1)


def make_id(*parts):
    return hashlib.sha1("|".join(str(p) for p in parts).encode("utf-8")).hexdigest()[:16]


def article(kind, title, url, source, published=None, lang="en", **extra):
    """Единый формат записи из любого источника."""
    return {
        "id": make_id(kind, url or title),
        "kind": kind,  # news | reddit | telegram | trend
        "title": " ".join((title or "").split()),
        "url": url or "",
        "source": source,
        "lang": lang,
        "published": iso(published) if isinstance(published, datetime) else published,
        "extra": extra,
    }


def gnews_search_url(query):
    return f"{GNEWS}/search?q={quote_plus(query)}&{GNEWS_PARAMS}"


def struct_to_dt(st):
    return datetime.fromtimestamp(calendar.timegm(st), tz=timezone.utc) if st else None


def parse_feed(content, source_name=None, kind="news"):
    """RSS/Atom -> список статей. Для Google News берём издание из <source>."""
    import feedparser

    feed = feedparser.parse(content)
    out = []
    for e in feed.entries:
        title = e.get("title", "")
        src = source_name
        if e.get("source") and e.source.get("title"):
            src = e.source.title
            suffix = " - " + src
            if title.endswith(suffix):
                title = title[: -len(suffix)]
        if not src:
            src = (feed.feed.get("title") or "RSS").strip()
        pub = struct_to_dt(e.get("published_parsed") or e.get("updated_parsed"))
        if title:
            out.append(article(kind, title, e.get("link", ""), src, pub))
    return out
