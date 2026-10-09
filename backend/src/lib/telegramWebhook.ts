import { timingSafeEqual } from "node:crypto";
import { env } from "../config/env.js";
import { callTelegramApi } from "./telegramApi.js";
import { resolveTelegramProxy } from "./telegramProxy.js";

const ALLOWED_UPDATES = ["message", "callback_query", "my_chat_member"] as const;

type WebhookInfo = {
  url?: string;
  pending_update_count?: number;
};

/**
 * Sets Telegram webhook to PUBLIC_URL + WEBHOOK_PATH when needed.
 */
export async function ensureWebhook(): Promise<{
  updated: boolean;
  url: string;
  pendingUpdateCount: number;
  proxy: string | null;
}> {
  const expected = env.WEBHOOK_URL.replace(/\/+$/, "");
  const proxy = resolveTelegramProxy();
  const info = await callTelegramApi<WebhookInfo>("getWebhookInfo");
  const current = (info.url || "").replace(/\/+$/, "");
  const force = env.FORCE_WEBHOOK_SYNC;

  if (current === expected && !force) {
    return {
      updated: false,
      url: current || expected,
      pendingUpdateCount: info.pending_update_count ?? 0,
      proxy,
    };
  }

  await callTelegramApi("setWebhook", {
    url: expected,
    secret_token: env.WEBHOOK_SECRET,
    drop_pending_updates: false,
    allowed_updates: [...ALLOWED_UPDATES],
  });

  return {
    updated: true,
    url: expected,
    pendingUpdateCount: info.pending_update_count ?? 0,
    proxy,
  };
}

export function assertWebhookSecret(headerValue: unknown): boolean {
  if (typeof headerValue !== "string" || !headerValue) return false;
  const left = Buffer.from(headerValue);
  const right = Buffer.from(env.WEBHOOK_SECRET);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
