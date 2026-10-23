"""Банк идей: насколько сюжет подходит именно Вадиму (0–100). Настройки — config/ideas.yaml."""
from .text import keyword_regex


def prepare(cfg):
    etalons = [(keyword_regex(e.get("match") or []), e) for e in cfg.get("etalons", [])]
    return {"cfg": cfg, "etalons": etalons}


def is_fat(st, gate):
    """«Только жирное»: мелочь, где «кто-то пукнул», в идеи не попадает."""
    o = st["outlets_24h"]
    return (o >= gate.get("min_outlets_24h", 6)
            or (st["rising"] and o >= gate.get("rising_min_outlets", 4))
            or (st["trends"] and o >= gate.get("trends_min_outlets", 3))
            or st["score"] >= gate.get("min_hype", 45))


def annotate(st, prep, text=None):
    """text=None — пересчёт после GDELT: эталон берём уже найденный."""
    cfg = prep["cfg"]
    w = cfg.get("weights", {})
    segs = cfg.get("segments", {})
    mech_w = cfg.get("mechanics", {})

    seg_hits = [(t, segs[t]["weight"]) for t in st["tags"].get("hype", []) if t in segs]
    best_seg = max(seg_hits, key=lambda x: x[1]) if seg_hits else (None, 0)
    best_mech = max((mech_w.get(m, 0) for m in st.get("mechanics", [])), default=0)
    cooled = "cooled" in st.get("mechanics", [])
    if text is None:
        etalon = (st.get("idea") or {}).get("etalon")
    else:
        etalon = next((e for rx, e in prep["etalons"] if rx and rx.search(text)), None)

    pot = (w.get("hype", 0.45) * st["score"] + w.get("segment", 25) * best_seg[1]
           + w.get("mechanic", 15) * best_mech + (w.get("first", 8) if st["first"] else 0)
           + (w.get("rising", 5) if st["rising"] else 0) + (w.get("etalon", 7) if etalon else 0)
           + (w.get("cooled", -30) if cooled else 0)
           + (w.get("war", -15) if st.get("fold", {}).get("hype") else 0))
    st["idea"] = {
        "fat": is_fat(st, cfg.get("gate", {})),
        "potential": int(round(max(0, min(100, pot)))),
        "segment": best_seg[0],
        "segment_why": segs.get(best_seg[0], {}).get("why") if best_seg[0] else None,
        "etalon": {k: etalon[k] for k in ("ep", "views", "subs", "angle")} if etalon else None,
        "cooled": cooled,
    }
    return st
