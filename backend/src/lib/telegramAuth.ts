import { createHmac, timingSafeEqual } from "node:crypto";

export type TelegramWebAppUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  photo_url?: string;
};

/**
 * Validates Telegram Mini App initData (HMAC-SHA256).
 * @see https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export function validateTelegramInitData(
  initData: string,
  botToken: string,
  { maxAgeSeconds = 86_400 }: { maxAgeSeconds?: number } = {},
): {
  user: TelegramWebAppUser;
  authDate: number;
  queryId: string | null;
  startParam: string | null;
} {
  if (!initData || typeof initData !== "string") {
    throw Object.assign(new Error("Missing Telegram init data"), { statusCode: 401 });
  }

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) {
    throw Object.assign(new Error("Invalid Telegram init data"), { statusCode: 401 });
  }

  params.delete("hash");
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const computed = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  const computedBuf = Buffer.from(computed, "hex");
  const hashBuf = Buffer.from(hash, "hex");
  if (
    computedBuf.length !== hashBuf.length ||
    !timingSafeEqual(computedBuf, hashBuf)
  ) {
    throw Object.assign(new Error("Telegram init data signature mismatch"), {
      statusCode: 401,
    });
  }

  const authDate = Number(params.get("auth_date") || 0);
  if (!authDate) {
    throw Object.assign(new Error("Invalid Telegram auth_date"), { statusCode: 401 });
  }

  const age = Math.floor(Date.now() / 1000) - authDate;
  if (maxAgeSeconds > 0 && age > maxAgeSeconds) {
    throw Object.assign(new Error("Telegram init data expired"), { statusCode: 401 });
  }

  const userRaw = params.get("user");
  if (!userRaw) {
    throw Object.assign(new Error("Telegram user missing in init data"), {
      statusCode: 401,
    });
  }

  let user: TelegramWebAppUser;
  try {
    user = JSON.parse(userRaw) as TelegramWebAppUser;
  } catch {
    throw Object.assign(new Error("Invalid Telegram user payload"), { statusCode: 401 });
  }

  if (!user?.id) {
    throw Object.assign(new Error("Telegram user id missing"), { statusCode: 401 });
  }

  return {
    user,
    authDate,
    queryId: params.get("query_id") || null,
    startParam: params.get("start_param") || null,
  };
}

export function extractInitData(headers: Record<string, unknown>): string | null {
  const auth = headers.authorization;
  if (typeof auth === "string" && auth.toLowerCase().startsWith("tma ")) {
    return auth.slice(4).trim();
  }

  const header =
    headers["x-telegram-init-data"] ?? headers["x-telegram-initdata"];
  if (typeof header === "string" && header.trim()) {
    return header.trim();
  }
  if (Array.isArray(header) && typeof header[0] === "string") {
    return header[0].trim();
  }

  return null;
}
