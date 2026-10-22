"""Склейка статей про одну историю в «сюжет».

Каждый заголовок -> набор слов с весами (редкое слово = важнее, это TF-IDF).
Статья попадает в сюжет, если похожа на «середину» сюжета (косинусная близость).
Русские посты из Telegram сравниваются через словарь рус↔англ, имена и цифры.
"""
import math
from collections import Counter, defaultdict
from datetime import timedelta

from .util import parse_iso


class Cluster:
    def __init__(self):
        self.members = []      # статьи news/reddit
        self.tf = Counter()    # сколько статей содержат слово
        self.telegram = []     # посты конкурентов
        self.trends = []       # совпавшие запросы Google Trends
        self.first = self.last = None
        self._norm = None
        self._core = {}

    @property
    def n(self):
        return len(self.members)

    def add(self, art, toks, t):
        self.members.append(art)
        self.tf.update(toks)
        self.first = t if self.first is None or t < self.first else self.first
        self.last = t if self.last is None or t > self.last else self.last
        self._norm = None
        self._core = {}

    def weight(self, tok, idf):
        return idf.get(tok, 0) * self.tf[tok] / self.n

    def norm(self, idf):
        if self._norm is None:
            self._norm = math.sqrt(sum(self.weight(t, idf) ** 2 for t in self.tf)) or 1.0
        return self._norm

    def core(self, idf, k=10):
        if k not in self._core:
            self._core[k] = sorted(self.tf, key=lambda t: -self.weight(t, idf))[:k]
        return self._core[k]


def art_time(a, now):
    t = parse_iso(a.get("published")) or parse_iso(a.get("seen")) or now
    return min(t, now)


def build_idf(token_sets):
    df = Counter()
    for toks in token_sets:
        df.update(toks)
    n = len(token_sets) or 1
    return {t: math.log((n + 1) / (c + 1)) + 1 for t, c in df.items()}, df, n


def cluster_articles(arts, norm, now, similarity=0.32, window_hours=36):
    """arts: статьи news/reddit. Возвращает (сюжеты, idf, индекс слово->сюжеты)."""
    toks = {a["id"]: set(norm.tokens(a["title"])) for a in arts}
    idf, df, n = build_idf(list(toks.values()))
    too_common = max(20, n * 0.05)
    window = timedelta(hours=window_hours)
    clusters, index = [], defaultdict(set)

    for a in sorted(arts, key=lambda x: art_time(x, now)):
        ta, t = toks[a["id"]], art_time(a, now)
        if not ta:
            continue
        na = math.sqrt(sum(idf[x] ** 2 for x in ta))
        cands = set()
        for x in ta:
            if df[x] <= too_common:
                cands |= index[x]
        best, best_s = None, 0.0
        for ci in cands:
            c = clusters[ci]
            if t - c.last > window:
                continue
            shared = [x for x in ta if x in c.tf]
            if len(shared) < 2:
                continue
            s = sum(idf[x] * c.weight(x, idf) for x in shared) / (na * c.norm(idf))
            if s > best_s:
                best, best_s = ci, s
        if best is None or best_s < similarity:
            clusters.append(Cluster())
            best = len(clusters) - 1
        clusters[best].add(a, ta, t)
        for x in ta:
            index[x].add(best)
    return clusters, idf, index


def attach_overlap(items, clusters, idf, index, norm, now, threshold=0.35, window_hours=36, text_key="title"):
    """Прицепить посты Telegram к сюжетам по общим именам/цифрам/словам.
    Доля «ядра» сюжета, найденная в посте, должна быть >= threshold."""
    window = timedelta(hours=window_hours)
    for it in items:
        tp, t = set(norm.tokens(it.get(text_key) or "")), art_time(it, now)
        cands = set()
        for x in tp:
            cands |= index.get(x, set())
        best, best_s = None, 0.0
        for ci in cands:
            c = clusters[ci]
            if t < c.first - window or t > c.last + window:
                continue
            core = c.core(idf)
            shared = [x for x in core if x in tp]
            if len(shared) < 2 or all(x[0].isdigit() for x in shared):
                continue
            total = sum(c.weight(x, idf) for x in core) or 1
            s = sum(c.weight(x, idf) for x in shared) / total
            if s > best_s:
                best, best_s = ci, s
        if best is not None and best_s >= threshold:
            clusters[best].telegram.append(it)


def attach_trends(trends, clusters, idf, norm, now, window_hours=30):
    """Запрос из Google Trends совпал, если все его слова есть среди главных слов сюжета."""
    window = timedelta(hours=window_hours)
    for tr in trends:
        tt = set(norm.tokens(tr["title"]))
        if not tt or sum(idf.get(x, 0) for x in tt) < 2.5:
            continue
        t = art_time(tr, now)
        for c in clusters:
            if abs(t - c.last) <= window and tt <= set(c.core(idf, 15)):
                c.trends.append(tr)
