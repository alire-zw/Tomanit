import { env } from "../config/env.js";
import { log } from "./log.js";
import { callTelegramApi } from "./telegramApi.js";
import {
  findUserByTelegramId,
  setUserLanguageCode,
  upsertUserFromBotStart,
} from "./users.js";
import { resolveBotLocale, type BotLocale } from "./bot/depositNotifyI18n.js";
import {
  buildDevelopersPanel,
  buildLanguagePickText,
  buildSettingsPanel,
  buildStartWelcome,
  developersKeyboard,
  isBotLangCode,
  languageKeyboard,
  settingsKeyboard,
  welcomeKeyboard,
} from "./bot/startI18n.js";

type TgUser = {
  id: number;
  is_bot?: boolean;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
};

type TgMessage = {
  message_id: number;
  chat: { id: number; type: string };
  from?: TgUser;
  text?: string;
  date?: number;
};

export type TelegramUpdate = {
  update_id: number;
  message?: TgMessage;
  edited_message?: TgMessage;
  callback_query?: {
    id: string;
    from: TgUser;
    data?: string;
    message?: TgMessage;
  };
  my_chat_member?: {
    chat: {
      id: number;
      type: string;
      title?: string;
      username?: string;
    };
    new_chat_member?: {
      status?: string;
      user?: { id?: number; is_bot?: boolean; username?: string };
    };
  };
};

function miniAppBase(): string {
  return env.MINI_APP_URL.replace(/\/+$/, "");
}

function supportMiniAppUrl(): string {
  return `${miniAppBase()}/support`;
}

function isStartCommand(text: string | undefined): boolean {
  if (!text) return false;
  const [cmd] = text.trim().split(/\s+/, 1);
  if (!cmd) return false;
  const base = cmd.split("@")[0]!.toLowerCase();
  return base === "/start";
}

function hasChosenBotLanguage(languageCode: string | null | undefined): boolean {
  if (!languageCode) return false;
  const base = languageCode.trim().toLowerCase().split(/[-_]/)[0] ?? "";
  return isBotLangCode(base);
}

async function resolveLocaleForUser(telegramId: string): Promise<BotLocale> {
  const user = await findUserByTelegramId(telegramId);
  return resolveBotLocale(user?.languageCode);
}

async function sendLanguagePicker(chatId: number): Promise<void> {
  await callTelegramApi("sendMessage", {
    chat_id: chatId,
    text: buildLanguagePickText("firstStart"),
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    reply_markup: {
      inline_keyboard: languageKeyboard(),
    },
  });
}

async function sendWelcome(chatId: number, languageCode: string): Promise<void> {
  const locale = resolveBotLocale(languageCode);
  const content = buildStartWelcome(locale);

  await callTelegramApi("sendMessage", {
    chat_id: chatId,
    text: content.text,
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    reply_markup: {
      inline_keyboard: welcomeKeyboard(locale, miniAppBase(), supportMiniAppUrl()),
    },
  });
}

async function editWelcome(
  chatId: number,
  messageId: number,
  languageCode: string,
): Promise<void> {
  const locale = resolveBotLocale(languageCode);
  const content = buildStartWelcome(locale);

  await callTelegramApi("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text: content.text,
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    reply_markup: {
      inline_keyboard: welcomeKeyboard(locale, miniAppBase(), supportMiniAppUrl()),
    },
  });
}

async function editSettings(
  chatId: number,
  messageId: number,
  locale: BotLocale,
): Promise<void> {
  const content = buildSettingsPanel(locale);
  await callTelegramApi("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text: content.text,
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    reply_markup: {
      inline_keyboard: settingsKeyboard(locale),
    },
  });
}

async function editDevelopers(
  chatId: number,
  messageId: number,
  locale: BotLocale,
): Promise<void> {
  const content = buildDevelopersPanel(locale);
  await callTelegramApi("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text: content.text,
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    reply_markup: {
      inline_keyboard: developersKeyboard(locale),
    },
  });
}

async function editLanguagePickerFromSettings(
  chatId: number,
  messageId: number,
  locale: BotLocale,
): Promise<void> {
  const settings = buildSettingsPanel(locale);
  await callTelegramApi("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text: buildLanguagePickText("settings"),
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    reply_markup: {
      inline_keyboard: languageKeyboard({
        fromSettings: true,
        backCallback: "menu:settings",
        backLabel: settings.backBtn,
      }),
    },
  });
}

async function handleStart(message: TgMessage): Promise<void> {
  const from = message.from;
  let languageCode: string | null = null;

  if (from) {
    try {
      const user = await upsertUserFromBotStart({
        id: from.id,
        first_name: from.first_name || "کاربر",
        last_name: from.last_name,
        username: from.username,
        language_code: undefined,
      });
      languageCode = user.languageCode;
      const handle = from.username ? `@${from.username}` : String(from.id);
      log.event("start", `${handle}  #${user.id}`);
    } catch (err) {
      log.error("upsert", err instanceof Error ? err.message : err);
    }
  }

  if (hasChosenBotLanguage(languageCode)) {
    await sendWelcome(message.chat.id, languageCode!);
    return;
  }

  await sendLanguagePicker(message.chat.id);
}

async function ensureUser(from: TgUser): Promise<void> {
  await upsertUserFromBotStart({
    id: from.id,
    first_name: from.first_name || "کاربر",
    last_name: from.last_name,
    username: from.username,
    language_code: undefined,
  });
}

async function handleLanguageCallback(
  callbackId: string,
  from: TgUser,
  data: string,
  message: TgMessage | undefined,
  fromSettings: boolean,
): Promise<void> {
  const prefix = fromSettings ? "setlang:" : "lang:";
  const code = data.slice(prefix.length);
  if (!isBotLangCode(code)) {
    await callTelegramApi("answerCallbackQuery", {
      callback_query_id: callbackId,
      text: "Invalid language",
      show_alert: false,
    });
    return;
  }

  try {
    await ensureUser(from);
    await setUserLanguageCode(String(from.id), code);
  } catch (err) {
    log.error("lang", err instanceof Error ? err.message : err);
  }

  await callTelegramApi("answerCallbackQuery", {
    callback_query_id: callbackId,
  });

  const chatId = message?.chat.id ?? from.id;

  if (fromSettings && message?.message_id) {
    await editSettings(chatId, message.message_id, resolveBotLocale(code));
    log.event("lang", `tg:${from.id} → ${code} (settings)`);
    return;
  }

  if (message?.message_id) {
    try {
      await callTelegramApi("deleteMessage", {
        chat_id: chatId,
        message_id: message.message_id,
      });
    } catch {
      // ignore
    }
  }

  await sendWelcome(chatId, code);
  log.event("lang", `tg:${from.id} → ${code}`);
}

async function handleMenuCallback(
  callbackId: string,
  from: TgUser,
  data: string,
  message: TgMessage | undefined,
): Promise<void> {
  await callTelegramApi("answerCallbackQuery", {
    callback_query_id: callbackId,
  });

  if (!message?.message_id) return;
  const chatId = message.chat.id;
  const locale = await resolveLocaleForUser(String(from.id));

  if (data === "menu:settings") {
    await editSettings(chatId, message.message_id, locale);
    return;
  }

  if (data === "menu:home") {
    const user = await findUserByTelegramId(String(from.id));
    const lang = user?.languageCode ?? locale;
    await editWelcome(chatId, message.message_id, lang);
    return;
  }

  if (data === "menu:lang") {
    await editLanguagePickerFromSettings(chatId, message.message_id, locale);
    return;
  }

  if (data === "menu:devs") {
    await editDevelopers(chatId, message.message_id, locale);
  }
}

/**
 * Process one Telegram update. Errors are logged; webhook should still ACK.
 */
export async function handleTelegramUpdate(update: TelegramUpdate): Promise<void> {
  if (update.my_chat_member) {
    try {
      const { onBotBecameGroupAdmin } = await import("./systemChannels.js");
      const chat = update.my_chat_member.chat;
      const member = update.my_chat_member.new_chat_member;
      const status = member?.status || "";
      const isBot = Boolean(member?.user?.is_bot);
      if (
        isBot &&
        (chat.type === "group" || chat.type === "supergroup") &&
        (status === "administrator" || status === "creator")
      ) {
        await onBotBecameGroupAdmin(chat);
      }
    } catch (err) {
      log.warn("channels", err instanceof Error ? err.message : err);
    }
    return;
  }

  const message = update.message || update.edited_message;
  if (message && isStartCommand(message.text)) {
    await handleStart(message);
    return;
  }

  if (update.callback_query) {
    const { id, from, data, message: cbMessage } = update.callback_query;
    try {
      if (data?.startsWith("lang:")) {
        await handleLanguageCallback(id, from, data, cbMessage, false);
        return;
      }
      if (data?.startsWith("setlang:")) {
        await handleLanguageCallback(id, from, data, cbMessage, true);
        return;
      }
      if (data?.startsWith("menu:")) {
        await handleMenuCallback(id, from, data, cbMessage);
        return;
      }

      await callTelegramApi("answerCallbackQuery", {
        callback_query_id: id,
      });
    } catch (err) {
      log.warn("callback", err instanceof Error ? err.message : err);
    }
  }
}
