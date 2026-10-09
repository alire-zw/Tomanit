import { env } from "../config/env.js";
import { callTelegramApi } from "./telegramApi.js";
import { log } from "./log.js";

let cachedUsername: string | null = null;

/** Prefer env; otherwise last getMe() result. */
export function getBotUsername(): string | null {
  if (env.TELEGRAM_BOT_USERNAME) return env.TELEGRAM_BOT_USERNAME;
  return cachedUsername;
}

/** Resolve @username via getMe (once) for t.me Mini App deep links. */
export async function resolveBotUsername(): Promise<string | null> {
  if (env.TELEGRAM_BOT_USERNAME) {
    cachedUsername = env.TELEGRAM_BOT_USERNAME;
    return cachedUsername;
  }
  if (cachedUsername) return cachedUsername;
  try {
    const me = await callTelegramApi<{ username?: string }>("getMe");
    const username = String(me.username || "")
      .trim()
      .replace(/^@/, "");
    if (username) {
      cachedUsername = username;
      return cachedUsername;
    }
    log.warn("bot", "getMe returned no username");
  } catch (err) {
    log.warn("bot", err instanceof Error ? err.message : String(err));
  }
  return null;
}
