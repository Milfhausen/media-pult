"""Хайп-оценка 0–100 и метки 🚀 / 🥇 / 📢. Веса — в config/scoring.yaml."""
import math

FORMULA = (
    "Оценка = {outlets}×издания за 24 ч + {growth}×рост за 3 ч + {reddit}×Reddit "
    "+ {trends}×Google Trends + {ru_telegram}×просмотры в ру-Телеге. "
    "Каждая часть от 0 до 1 (логарифм: первые издания/лайки ценнее последующих)."
)


def log_part(value, cap):
    if cap <= 0 or value <= 0:
        return 0.0
    return min(1.0, math.log1p(value) / math.log1p(cap))


def growth_ratio(outlets_3h, outlets_prev_21h):
    """Во сколько раз за последние 3 ч изданий больше, чем в среднем за 3 ч до этого."""
    usual = outlets_prev_21h / 7
    return round(outlets_3h / max(usual, 0.5), 2)


def apply_score(st, cfg):
    w, caps = cfg.get("weights", {}), cfg.get("caps", {})
    ratio = st["growth_ratio"]
    growth = 0.0
    if st["outlets_3h"] >= 2:
        growth = min(1.0, max(0.0, (ratio - 1) / max(caps.get("growth_ratio", 4) - 1, 0.1)))
    r = st["reddit"]
    parts = {
        "outlets": log_part(st["outlets_24h"], caps.get("outlets", 25)),
        "growth": growth,
        "reddit": log_part(r["score"] + 2 * r["comments"], caps.get("reddit", 20000)),
        "trends": 1.0 if st["trends"] else 0.0,
        "ru_telegram": log_part(st["tg_views"], caps.get("ru_telegram_views", 500000)),
    }
    st["score_parts"] = {k: round(w.get(k, 0) * v, 1) for k, v in parts.items()}
    st["score"] = int(round(max(0, min(100, sum(st["score_parts"].values())))))

    rising, first = cfg.get("rising", {}), cfg.get("first", {})
    st["in_ru_tg"] = bool(st["telegram"])
    st["rising"] = st["outlets_3h"] >= rising.get("min_outlets_3h", 3) and ratio >= rising.get("min_ratio", 2)
    st["first"] = st["outlets_24h"] >= first.get("min_outlets_24h", 3) and not st["in_ru_tg"]
    return st
