"""6. Telegram-конкуренты через веб-превью t.me/s/<канал> (без API и ключей)."""
from datetime import datetime

from bs4 import BeautifulSoup

from ..util import article


def parse_views(s):
    s = (s or "").strip().replace(",", ".").upper()
    mult = 1
    if s.endswith("K"):
        mult, s = 1_000, s[:-1]
    elif s.endswith("M"):
        mult, s = 1_000_000, s[:-1]
    try:
        return int(float(s) * mult)
    except ValueError:
        return 0


def parse_page(html, title):
    soup = BeautifulSoup(html, "html.parser")
    out = []
    for m in soup.select(".tgme_widget_message"):
        txt = m.select_one(".tgme_widget_message_text")
        link = m.select_one("a.tgme_widget_message_date")
        if not txt or not link:
            continue
        t = m.select_one("time[datetime]")
        pub = datetime.fromisoformat(t["datetime"]) if t else None
        v = m.select_one(".tgme_widget_message_views")
        out.append(article("telegram", txt.get_text(" ", strip=True)[:600], link["href"], title, pub,
                           lang="ru", views=parse_views(v.get_text() if v else "")))
    return out


def fetch(channels, ctx):
    out, tried, failed = [], 0, 0
    for ch in channels:
        user = (ch.get("username") or "").strip().lstrip("@")
        if not user:
            continue  # пустой юзернейм — пропускаем
        name = ch.get("title") or user
        tried += 1
        try:
            items = parse_page(ctx.get(f"https://t.me/s/{user}").text, name)
            ctx.report(f"Telegram: {name}", bool(items), len(items), None if items else "пусто")
            out += items
        except Exception as e:
            failed += 1
            ctx.report(f"Telegram: {name}", False, error=e)
    if tried and failed == tried:
        raise RuntimeError("ни один Telegram-канал не ответил")
    return out
