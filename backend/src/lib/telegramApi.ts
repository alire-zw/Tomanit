import { env } from "../config/env.js";
import { resolveTelegramProxy, telegramFetch } from "./telegramProxy.js";

const TELEGRAM_TIMEOUT_MS = 20_000;

type TelegramApiResponse<T> = {
  ok: boolean;
  result?: T;
  description?: string;
};

function friendlyFetchError(err: unknown): string {
  const cause =
    err instanceof Error && "cause" in err && err.cause instanceof Error
      ? err.cause.message
      : "";
  const msg = [err instanceof Error ? err.message : String(err), cause]
    .filter(Boolean)
    .join(" · ");
  if (
    /fetch failed|ETIMEDOUT|ECONNREFUSED|ENOTFOUND|AbortError|timeout|ECONNRESET/i.test(
      msg,
    )
  ) {
    const proxy = resolveTelegramProxy();
    if (!proxy) {
      return `${msg} · set TELEGRAM_PROXY (e.g. http://127.0.0.1:12334) or TELEGRAM_API_ROOT`;
    }
    return `${msg} · via ${proxy}`;
  }
  return msg;
}

/** Call Telegram Bot API (uses TELEGRAM_PROXY / WinINET when needed). */
export async function callTelegramApi<T>(
  method: string,
  body?: Record<string, unknown>,
): Promise<T> {
  return callTelegramApiWithToken<T>(env.TELEGRAM_BOT_TOKEN, method, body);
}

/** Same as callTelegramApi but for another bot token (e.g. shop report bot). */
export async function callTelegramApiWithToken<T>(
  token: string,
  method: string,
  body?: Record<string, unknown>,
  timeoutMs: number = TELEGRAM_TIMEOUT_MS,
): Promise<T> {
  let res: Response;
  try {
    res = await telegramFetch(
      `${env.TELEGRAM_API_ROOT}/bot${token}/${method}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(timeoutMs),
      },
    );
  } catch (err) {
    throw new Error(friendlyFetchError(err));
  }
  const data = (await res.json()) as TelegramApiResponse<T>;
  if (!data.ok) {
    throw new Error(data.description || `Telegram API ${method} failed`);
  }
  return data.result as T;
}
