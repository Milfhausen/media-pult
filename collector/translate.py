"""Перевод заголовков на русский: бесплатный Google Translate, запасной — MyMemory (deep-translator).
Переводы запоминаются в кэше, чтобы не переводить одно и то же."""
from concurrent.futures import ThreadPoolExecutor
from concurrent.futures import TimeoutError as FutTimeout


def _translators():
    from deep_translator import GoogleTranslator, MyMemoryTranslator

    return [GoogleTranslator(source="auto", target="ru"), MyMemoryTranslator(source="en-GB", target="ru-RU")]


def translate_stories(stories, cache, max_new=80, timeout=15, translators=None):
    """Если переводчик отказал (например, «слишком много запросов»), переходим к следующему.
    Не ответил никто — показываем оригинал."""
    trs = list(translators) if translators is not None else _translators()
    pool = ThreadPoolExecutor(max_workers=1)
    new, error = 0, None
    for st in stories:
        if st.get("title_ru"):
            continue
        t = st["title"]
        if t in cache:
            st["title_ru"] = cache[t]
            continue
        while trs and new < max_new:
            try:
                ru = pool.submit(trs[0].translate, t).result(timeout=timeout)
                if ru:
                    cache[t] = st["title_ru"] = ru
                    new += 1
                break
            except (Exception, FutTimeout) as e:
                error = e
                trs.pop(0)
    pool.shutdown(wait=False, cancel_futures=True)
    return new, (error if new == 0 else None)
