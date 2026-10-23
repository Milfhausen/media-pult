"""Проверки: склейка сюжетов, оценка, метка 🥇.  Запуск: python -m pytest -q"""
from datetime import timedelta

from collector.pipeline import build_stories, load_config
from collector.scoring import apply_score
from collector.util import article, now_utc

CFG = load_config()
NOW = now_utc()


def news(title, src, h):
    return article("news", title, f"https://x.test/{src}/{title[:20]}", src, NOW - timedelta(hours=h))


def tg(text, ch, h, views=1000):
    return article("telegram", text, f"https://t.me/{ch}/{abs(hash(text))}", ch, NOW - timedelta(hours=h), lang="ru", views=views)


def find(stories, word):
    return [s for s in stories if word.lower() in s["title"].lower()]


def test_same_story_from_different_outlets_is_glued():
    arts = [
        news("MI5 chief: we spend more on Russian threats than during the Cold War", "BBC", 3),
        news("MI5 chief says spending on Russian threats higher than in Cold War", "Guardian", 2),
        news("Teenager stabbed to death outside London school", "Sky", 1),
    ]
    st = build_stories(arts, CFG, NOW)
    assert len(st) == 2
    mi5 = find(st, "mi5")[0]
    assert mi5["outlets_24h"] == 2
    assert set(mi5["outlets"]) == {"BBC", "Guardian"}


def test_russian_post_matches_english_story_via_dictionary():
    arts = [
        news("Farage calls Ukraine one of the most corrupt countries", "GB News", 3),
        news("Farage says Ukraine among most corrupt countries in the world", "Independent", 2),
        tg("Фарадж назвал Украину одной из самых коррумпированных стран мира", "Топор Live", 1, views=50000),
    ]
    st = build_stories(arts, CFG, NOW)
    assert len(st) == 1
    assert st[0]["in_ru_tg"] and st[0]["tg_channels"] == ["Топор Live"]
    assert st[0]["tg_views"] == 50000


def test_telegram_only_story_is_not_shown():
    arts = [news("Rats overrun streets as bin strike continues", "BBC", 2),
            tg("В Москве прошёл парад на Красной площади", "SVTV NEWS", 1)]
    st = build_stories(arts, CFG, NOW)
    assert len(st) == 1 and not st[0]["in_ru_tg"]


def test_first_badge_only_when_no_russian_telegram():
    outlets = ["BBC", "Sky", "Guardian", "Telegraph"]
    arts = [news("Half of Britons would refuse to fight for their country, Ipsos poll finds", o, i + 1)
            for i, o in enumerate(outlets)]
    st = build_stories(arts, CFG, NOW)[0]
    assert st["first"] is True

    arts.append(tg("Половина британцев отказалась бы воевать — опрос Ipsos", "SVTV NEWS", 1))
    st = build_stories(arts, CFG, NOW)[0]
    assert st["first"] is False and st["in_ru_tg"] is True

    few = build_stories(arts[:2], CFG, NOW)[0]  # всего 2 издания — ещё рано для 🥇
    assert few["first"] is False


def base_story(**kw):
    st = {"outlets_24h": 0, "outlets_3h": 0, "growth_ratio": 0, "reddit": {"score": 0, "comments": 0},
          "trends": [], "tg_views": 0, "telegram": []}
    st.update(kw)
    return st


def test_score_grows_with_outlets_and_stays_in_0_100():
    sc = CFG["scoring"]
    low = apply_score(base_story(outlets_24h=2), sc)["score"]
    high = apply_score(base_story(outlets_24h=15), sc)["score"]
    assert 0 <= low < high <= 100
    maxed = apply_score(base_story(outlets_24h=500, outlets_3h=50, growth_ratio=50,
                                   reddit={"score": 10**6, "comments": 10**6}, trends=["x"],
                                   tg_views=10**9, telegram=[{}]), sc)
    assert maxed["score"] == 100


def test_rising_badge():
    sc = CFG["scoring"]
    assert apply_score(base_story(outlets_24h=6, outlets_3h=5, growth_ratio=5), sc)["rising"]
    assert not apply_score(base_story(outlets_24h=6, outlets_3h=1, growth_ratio=5), sc)["rising"]


def test_same_outlet_with_different_names_counted_once():
    arts = [news("MI5 chief: we spend more on Russian threats than during the Cold War", "BBC", 3),
            news("MI5 chief: we spend more on Russian threats than during Cold War", "BBC News", 2),
            news("MI5 chief says Russian threats cost more than Cold War", "The Guardian", 1)]
    st = build_stories(arts, CFG, NOW)[0]
    assert st["outlets_24h"] == 2


def test_translation_falls_back_to_second_translator():
    from collector.translate import translate_stories

    class Broken:
        def translate(self, t):
            raise RuntimeError("too many requests")

    class Ok:
        def translate(self, t):
            return "перевод: " + t

    stories = [{"title": "A"}, {"title": "B"}]
    new, err = translate_stories(stories, {}, translators=[Broken(), Ok()])
    assert new == 2 and err is None and stories[1]["title_ru"] == "перевод: B"


def test_mechanics_hints():
    arts = [news("Judge frees terror suspect on bail over mental health fears", o, i + 1)
            for i, o in enumerate(["BBC", "Sky", "Guardian"])]
    st = build_stories(arts, CFG, NOW)[0]
    assert "aswat" in st["mechanics"]
    arts = [news("Tank barrel production returns to Telford", "BBC", 1)]
    assert "grooming" not in build_stories(arts, CFG, NOW)[0]["mechanics"]
