import type { FastifyInstance } from "fastify";
import { env } from "../config/env.js";
import {
  handleTelegramUpdate,
  type TelegramUpdate,
} from "../lib/botUpdates.js";
import { log } from "../lib/log.js";
import { assertWebhookSecret } from "../lib/telegramWebhook.js";

/**
 * Telegram Bot webhook endpoint.
 */
export async function telegramWebhookRoutes(app: FastifyInstance): Promise<void> {
  app.post(env.WEBHOOK_PATH, async (request, reply) => {
    const secret = request.headers["x-telegram-bot-api-secret-token"];
    if (!assertWebhookSecret(secret)) {
      return reply.status(401).send({ ok: false, error: "Unauthorized" });
    }

    const update = request.body as TelegramUpdate;
    try {
      await handleTelegramUpdate(update);
    } catch (err) {
      log.error(
        "webhook",
        err instanceof Error ? err.message : err,
      );
    }

    return reply.send({ ok: true });
  });
}
