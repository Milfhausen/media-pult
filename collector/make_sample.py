"""Делает демо-данные data/sample_*.json, чтобы страница работала до первого реального сбора.
Запуск:  python -m collector.make_sample
Все заголовки ниже — ВЫДУМАННЫЕ примеры для проверки интерфейса."""
from datetime import timedelta

from .pipeline import build_stories, formula_text, load_config, tabs_meta
from .util import DATA, article, iso, now_utc, save_json

N, R, T, G = "news", "reddit", "telegram", "trend"

# (вид, сколько часов назад, источник, заголовок, доп. поля)
FIXTURE = [
    # СНГ-радар
    *[(N, h, s, "Britain must be ready to accept casualties in a war, says army chief", {}) for h, s in
      [(2.5, "The Telegraph"), (2.0, "BBC News"), (1.5, "The Guardian"), (1.0, "Sky News"), (0.8, "GB News"),
       (0.6, "The Independent"), (0.4, "Daily Mail"), (20, "The Times")]],
    (R, 1.5, "Reddit r/ukpolitics", "Army chief says Britain must be ready to accept casualties in a war", {"score": 3400, "comments": 1200}),
    *[(N, h, s, "Half of Britons would refuse to fight for their country, Ipsos poll finds", {}) for h, s in
      [(10, "The Independent"), (9, "Sky News"), (8, "Daily Mail"), (6, "The Telegraph"), (5, "GB News")]],
    (T, 4, "Топор Live", "Половина британцев отказалась бы воевать за свою страну — опрос Ipsos", {"views": 182000}),
    *[(N, h, s, "MI5 chief: we spend more on Russian threats than during the Cold War", {}) for h, s in
      [(20, "BBC News"), (18, "The Guardian"), (15, "Reuters"), (12, "The Telegraph"), (9, "Politico Europe"), (6, "Sky News")]],
    (T, 8, "SVTV NEWS", "Глава МИ-5: на угрозы со стороны России Британия тратит больше, чем во время холодной войны", {"views": 95400}),
    (T, 7, "Ateo Breaking", "МИ-5: Россия — главная угроза, расходы больше, чем в холодную войну", {"views": 41000}),
    *[(N, h, s, "Farage calls Ukraine one of the most corrupt countries in the world", {}) for h, s in
      [(7, "GB News"), (6, "The Guardian"), (5, "The Independent"), (3, "Daily Mail")]],
    (R, 5, "Reddit r/ukraine", "Farage calls Ukraine one of the most corrupt countries in the world", {"score": 2100, "comments": 900}),
    *[(N, h, s, "Homes for Ukraine sponsors warn of homelessness as visa extension rules change", {}) for h, s in
      [(9, "The Guardian"), (7, "BBC News"), (4, "The Independent")]],
    *[(N, h, s, "EU suspends visa-free travel for Georgian officials after protest crackdown", {}) for h, s in
      [(14, "Politico Europe"), (12, "Reuters"), (11, "The Guardian")]],
    *[(N, h, s, "Russian-backed saboteurs behind warehouse fire in east London, prosecutors say", {}) for h, s in
      [(16, "Sky News"), (15, "BBC News"), (13, "The Telegraph"), (12, "Daily Mail")]],
    # Хайп-радар
    *[(N, h, s, "Teenager stabbed to death outside London school", {}) for h, s in
      [(2.8, "Sky News"), (2.2, "BBC News"), (2.0, "Daily Mail"), (1.6, "The Independent"), (1.2, "GB News"),
       (1.0, "The Telegraph"), (0.5, "The Guardian"), (0.3, "Evening Standard")]],
    (R, 2, "Reddit r/london", "Teenager stabbed to death outside school in London", {"score": 1500, "comments": 640}),
    *[(N, h, s, "Record 1,200 migrants cross Channel in small boats in single day", {}) for h, s in
      [(11, "GB News"), (10, "Daily Mail"), (9, "The Telegraph"), (8, "BBC News"), (7, "Sky News"), (6, "The Independent"), (5, "Reuters")]],
    (T, 5, "Ateo Breaking", "Рекордные 1200 мигрантов пересекли Ла-Манш на лодках за один день", {"views": 61000}),
    (G, 6, "Google Trends", "small boats", {"traffic": "50000+"}),
    *[(N, h, s, "Family with newborn forced to live in mould-infested council flat", {}) for h, s in
      [(15, "The Independent"), (12, "The Guardian"), (10, "Daily Mail")]],
    (R, 11, "Reddit r/unitedkingdom", "Family with newborn forced to live in mould-infested council flat", {"score": 2800, "comments": 410}),
    *[(N, h, s, "Patients pulling out own teeth as NHS dentist waiting lists hit record", {}) for h, s in
      [(17, "BBC News"), (14, "The Guardian"), (12, "Daily Mail"), (9, "The Independent")]],
    *[(N, h, s, "Pensioners face £300 tax raid on state pension, Treasury figures show", {}) for h, s in
      [(13, "The Telegraph"), (11, "Daily Mail"), (8, "GB News"), (7, "The Independent"), (2, "Sky News")]],
    *[(N, h, s, "Thousands of prisoners released early to ease overcrowding", {}) for h, s in
      [(19, "BBC News"), (16, "Sky News"), (14, "The Telegraph"), (10, "GB News")]],
    *[(N, h, s, "Councils issued 2 million parking fines in a year, raking in £180m", {}) for h, s in
      [(21, "Daily Mail"), (18, "The Telegraph"), (16, "GB News")]],
    *[(N, h, s, "Rats overrun streets as Birmingham bin strike enters eighth week", {}) for h, s in
      [(9, "BBC News"), (8, "Sky News"), (6, "Daily Mail"), (4, "The Guardian")]],
    (R, 7, "Reddit r/CasualUK", "Rats overrun streets as Birmingham bin strike enters eighth week", {"score": 900, "comments": 300}),
    *[(N, h, s, "Train fares to rise 5% from March, rail operators confirm", {}) for h, s in
      [(80, "BBC News"), (79, "The Guardian"), (78, "Sky News"), (77, "The Independent"), (75, "Daily Mail"), (74, "The Telegraph")]],
    # Сюжет только из Telegram — в ТОП попасть не должен
    (T, 3, "Топор Live", "В Москве прошёл парад дронов на Красной площади", {"views": 300000}),
]

RU = {
    "Britain must be ready to accept casualties in a war, says army chief": "Глава армии: Британия должна быть готова к жертвам в войне",
    "Half of Britons would refuse to fight for their country, Ipsos poll finds": "Половина британцев отказалась бы воевать за страну — опрос Ipsos",
    "MI5 chief: we spend more on Russian threats than during the Cold War": "Глава MI5: на угрозы России тратим больше, чем в холодную войну",
    "Farage calls Ukraine one of the most corrupt countries in the world": "Фарадж назвал Украину одной из самых коррумпированных стран мира",
    "Homes for Ukraine sponsors warn of homelessness as visa extension rules change": "Спонсоры Homes for Ukraine предупреждают о бездомности из-за новых правил продления виз",
    "EU suspends visa-free travel for Georgian officials after protest crackdown": "ЕС отменил безвиз для грузинских чиновников после разгона протестов",
    "Russian-backed saboteurs behind warehouse fire in east London, prosecutors say": "Прокуратура: за пожаром на складе в Лондоне стоят диверсанты, работавшие на Россию",
    "Teenager stabbed to death outside London school": "Подростка зарезали у школы в Лондоне",
    "Record 1,200 migrants cross Channel in small boats in single day": "Рекорд: 1200 мигрантов пересекли Ла-Манш на лодках за один день",
    "Family with newborn forced to live in mould-infested council flat": "Семья с новорождённым вынуждена жить в муниципальной квартире, заросшей плесенью",
    "Patients pulling out own teeth as NHS dentist waiting lists hit record": "Пациенты сами вырывают себе зубы: очереди к стоматологам NHS — рекордные",
    "Pensioners face £300 tax raid on state pension, Treasury figures show": "Пенсионеров ждёт налог £300 на госпенсию — данные Минфина",
    "Thousands of prisoners released early to ease overcrowding": "Тысячи заключённых выпускают досрочно из-за переполненных тюрем",
    "Councils issued 2 million parking fines in a year, raking in £180m": "Советы выписали 2 млн штрафов за парковку за год и заработали £180 млн",
    "Rats overrun streets as Birmingham bin strike enters eighth week": "Крысы на улицах: забастовка мусорщиков в Бирмингеме идёт восьмую неделю",
    "Train fares to rise 5% from March, rail operators confirm": "Билеты на поезда подорожают на 5% с марта",
}


def build_fixture(now):
    arts = []
    for i, (kind, h, src, title, extra) in enumerate(FIXTURE):
        slug = src.lower().replace(" ", "")
        url = f"https://example.org/demo/{slug}/{i}"  # демо-ссылки
        lang = "ru" if kind == T else "en"
        arts.append(article(kind, title, url, src, now - timedelta(hours=h), lang=lang, **extra))
    return arts


def main():
    cfg = load_config()
    now = now_utc()
    stories = build_stories(build_fixture(now), cfg, now)
    for st in stories:
        st["title_ru"] = st["title_ru"] or RU.get(st["title"])
    save_json(DATA / "sample_stories.json", {
        "generated_at": iso(now), "demo": True,
        "weights": cfg["scoring"].get("weights", {}), "formula": formula_text(cfg["scoring"]),
        "tabs": tabs_meta(cfg), "stories": stories,
    }, indent=1)
    save_json(DATA / "sample_status.json", {"generated_at": iso(now), "sources": [
        {"name": "Google News", "ok": True, "count": 412, "error": None, "at": iso(now)},
        {"name": "Reddit", "ok": False, "count": 0, "error": "403 Forbidden (демо-пример ошибки)", "at": iso(now)},
    ]}, indent=1)
    print(f"Демо: {len(stories)} сюжетов")
    for s in stories:
        print(s["score"], "🚀" if s["rising"] else "  ", "🥇" if s["first"] else "  ", "📢" if s["in_ru_tg"] else "  ",
              s["outlets_24h"], s["title"][:60], s["tags"], s["speaker"])


if __name__ == "__main__":
    main()
