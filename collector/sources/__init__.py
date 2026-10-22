"""Источники. Каждый модуль: fetch(cfg, ctx) -> список статей.
ctx.get(url) — скачать страницу; ctx.report(name, ok, count, error) — записать статус."""
import requests

from ..util import iso, now_utc


class Ctx:
    def __init__(self, user_agent, timeout=20):
        self.s = requests.Session()
        self.s.headers.update({"User-Agent": user_agent, "Accept-Language": "en-GB,en;q=0.9,ru;q=0.8"})
        self.timeout = timeout
        self.status = []

    def get(self, url, **kw):
        r = self.s.get(url, timeout=kw.pop("timeout", self.timeout), **kw)
        r.raise_for_status()
        return r

    def report(self, name, ok, count=0, error=None):
        self.status.append({"name": name, "ok": ok, "count": count,
                            "error": (str(error)[:200] if error else None), "at": iso(now_utc())})
