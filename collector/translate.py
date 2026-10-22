"""Перевод заголовков на русский через бесплатный Google Translate (deep-translator).
Переводы запоминаются в data/translations.json, чтобы не переводить одно и то же."""
from concurrent.futures import ThreadPoolExecutor
from concurrent.futures import TimeoutError as FutTimeout


def translate_stories(stories, cache, max_new=80, timeout=15):
    from deep_translator import GoogleTranslator

    tr = GoogleTranslator(source="auto", target="ru")
    pool = ThreadPoolExecutor(max_workers=1)
    new, error = 0, None
    for st in stories:
        if st.get("title_ru"):
            continue
        t = st["title"]
        if t in cache:
            st["title_ru"] = cache[t]
            continue
        if new >= max_new or error:
            continue
        try:
            ru = pool.submit(tr.translate, t).result(timeout=timeout)
            if ru:
                cache[t] = st["title_ru"] = ru
                new += 1
        except (Exception, FutTimeout) as e:  # не ответил — показываем оригинал
            error = e
    pool.shutdown(wait=False, cancel_futures=True)
    return new, error
