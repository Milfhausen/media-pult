// Бот «первый комментарий» для Telegram-канала Вадима.
// Когда пост из канала попадает в группу обсуждения, бот сразу отвечает на него
// сообщением с кнопками «ЧАТ» и «Все мои соц сети» — это становится первым комментарием.
//
// Работает на Cloudflare Workers (бесплатно). Все настройки — в переменных Worker'а:
//   BOT_TOKEN    — токен от @BotFather (секрет)
//   SECRET       — любое своё слово-пароль (секрет), защищает бота от чужих запросов
//   CHAT_URL     — ссылка для кнопки «ЧАТ»
//   SOCIALS_URL  — ссылка для кнопки «Все мои соц сети»
//   TEXT         — (не обязательно) текст сообщения
//   CHAT_LABEL, SOCIALS_LABEL — (не обязательно) надписи на кнопках

const DEFAULT_TEXT = "⬇️ Заходи в чат и подписывайся на все мои соцсети ⬇️";

async function tg(env, method, body) {
  const r = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return r.json();
}

function keyboard(env) {
  const rows = [];
  if (env.CHAT_URL) rows.push([{ text: env.CHAT_LABEL || "💬 ЧАТ", url: env.CHAT_URL }]);
  if (env.SOCIALS_URL) rows.push([{ text: env.SOCIALS_LABEL || "🌐 Все мои соц сети", url: env.SOCIALS_URL }]);
  return { inline_keyboard: rows };
}

const text = (s, status = 200) =>
  new Response(s, { status, headers: { "content-type": "text/plain; charset=utf-8" } });

export async function handleUpdate(update, env) {
  const m = update.message;
  // is_automatic_forward — это и есть копия поста из канала в группе обсуждения
  if (!m || !m.is_automatic_forward) return null;
  return tg(env, "sendMessage", {
    chat_id: m.chat.id,
    text: env.TEXT || DEFAULT_TEXT,
    reply_parameters: { message_id: m.message_id, allow_sending_without_reply: true },
    reply_markup: keyboard(env),
    link_preview_options: { is_disabled: true },
  });
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);

    // Один раз открыть в браузере: https://<адрес-воркера>/setup?key=<SECRET>
    if (url.pathname === "/setup") {
      if (!env.SECRET || url.searchParams.get("key") !== env.SECRET) return text("❌ Неверный ключ", 403);
      if (!env.BOT_TOKEN) return text("❌ Не задан BOT_TOKEN в настройках Worker'а", 500);
      const r = await tg(env, "setWebhook", {
        url: `${url.origin}/hook`,
        secret_token: env.SECRET,
        allowed_updates: ["message"],
        drop_pending_updates: true,
      });
      const me = await tg(env, "getMe", {});
      return r.ok
        ? text(`✅ Бот @${me.result && me.result.username} подключён. Теперь добавь его админом в группу обсуждения канала.`)
        : text("❌ Telegram ответил: " + r.description, 500);
    }

    if (url.pathname === "/hook" && req.method === "POST") {
      if (req.headers.get("X-Telegram-Bot-Api-Secret-Token") !== env.SECRET) return text("forbidden", 403);
      try {
        await handleUpdate(await req.json(), env);
      } catch (e) {
        console.log("ошибка:", e && e.message);
      }
      return text("ok"); // всегда 200, иначе Telegram будет повторять
    }

    return text("Бот работает 👍");
  },
};
