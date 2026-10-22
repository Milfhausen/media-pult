"""Превращение заголовка в набор «смысловых» слов + словарь рус↔англ."""
import re

WORD = re.compile(r"[a-z]+|[а-я]+|\d+(?:\.\d+)?")
THOUSANDS = re.compile(r"(?<=\d)[,  ](?=\d{3}\b)")
DECIMAL = re.compile(r"(?<=\d),(?=\d)")

STOP = set("""
a an the and or but if of to in on at by for from with without into onto over under about after before
as is are was were be been being has have had do does did will would could should may might must can
this that these those it its he she they them his her their we our you your i me my not no yes
says say said told tells new news live latest update updates video watch photos how why what who when where
which than then there here up down out more most less very just also only after amid via vs per year years
day days week weeks today yesterday tomorrow first last one two three man woman men women people
и в во не на с со что как по к ко за из у о об от до для же но а или ли бы это то так все всё был была были
он она они его ее её их мы вы ты я уже ещё еще при над под про без через после перед когда где кто чем чтобы
также только очень может будет было есть нет да этот эта эти этого этой свой своих свои который которая которые
""".split())


def _is_cyr(w):
    return "а" <= w[0] <= "я"


class Normalizer:
    """Знает словарь из config/dictionary.yaml и приводит слова к общему виду."""

    def __init__(self, terms=None):
        self.phrases, self.prefix, self.exact = [], [], {}
        for canon, aliases in (terms or {}).items():
            canon = str(canon).lower()
            self.exact[canon] = canon
            for al in aliases or []:
                al = str(al).lower().replace("ё", "е").strip()
                if not al:
                    continue
                if re.search(r"[^a-zа-я]", al):
                    rx = re.compile(r"(?<![\w-])" + re.escape(al) + r"(?![\w-])")
                    self.phrases.append((rx, canon))
                elif len(al) >= 4:
                    self.prefix.append((al, canon))
                else:
                    self.exact[al] = canon
        self.prefix.sort(key=lambda x: -len(x[0]))
        self._memo = {}

    def canon(self, w):
        if w in self._memo:
            return self._memo[w]
        r = self.exact.get(w)
        if r is None:
            for al, c in self.prefix:
                if w.startswith(al):
                    r = c
                    break
        if r is None:
            r = w
            if not _is_cyr(w) and not w[0].isdigit() and len(w) > 4:
                if w.endswith("ies"):
                    r = w[:-3] + "y"
                elif w.endswith("s") and not w.endswith("ss"):
                    r = w[:-1]
        self._memo[w] = r
        return r

    def tokens(self, text):
        t = (text or "").lower().replace("ё", "е")
        t = DECIMAL.sub(".", THOUSANDS.sub("", t))
        for rx, canon in self.phrases:
            t = rx.sub(" " + canon + " ", t)
        out = []
        for w in WORD.findall(t):
            if w in STOP or (len(w) < 2 and not w.isdigit()):
                continue
            c = self.canon(w)
            if c not in STOP:
                out.append(c)
        return out


def keyword_regex(words):
    """Слово срабатывает, если с него начинается слово в тексте (без учёта регистра)."""
    parts = [re.escape(str(w).lower().replace("ё", "е")) for w in words if str(w).strip()]
    if not parts:
        return None
    return re.compile(r"(?<![\wа-я])(?:" + "|".join(sorted(parts, key=len, reverse=True)) + ")", re.I)
