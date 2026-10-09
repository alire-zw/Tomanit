import { env } from "./config/env.js";
import { log } from "./lib/log.js";
import { seedIfEmpty } from "./lib/seed.js";
import { normalizePaymentCodes } from "./lib/merchantPaymentLink.js";
import { normalizeTicketCodes } from "./lib/ticketCode.js";
import { ensureWebhook } from "./lib/telegramWebhook.js";
import { startTicketAutoCloseJob } from "./lib/ticketAutoClose.js";
import { startSwapWalletRatesJob } from "./lib/swapwallet.js";
import { startSwapWalletChartsJob } from "./lib/swapwalletChart.js";
import { startWalletBalanceJob } from "./lib/walletBalanceJob.js";
import { startWalletSweepJob } from "./lib/walletSweepJob.js";
import { startGatewayDailyResetJob } from "./lib/gatewayDailyReset.js";
import { startServer } from "./app.js";

/** Background jobs must never take down the API process. */
process.on("unhandledRejection", (reason) => {
  const message =
    reason instanceof Error
      ? reason.message
      : typeof reason === "string"
        ? reason
        : String(reason);
  log.warn("process", `unhandledRejection — ${message}`);
});

process.on("uncaughtException", (err) => {
  log.error("process", `uncaughtException — ${err.message}`);
});

async function main() {
  log.header("Tomanit", "backend");

  await seedIfEmpty();
  await normalizeTicketCodes();
  await normalizePaymentCodes();
  log.service("Database", `${env.DB_PROVIDER} · ${env.DB_NAME}`, true);

  const { connectRedis } = await import("./db/redis.js");
  const redisOk = await connectRedis();
  if (!redisOk) {
    log.service("Redis", "unavailable · cache disabled", false);
  }

  startTicketAutoCloseJob();
  if (redisOk) {
    startSwapWalletRatesJob();
    startSwapWalletChartsJob();
  } else {
    log.service("Pricing", "skipped · Redis required", false);
  }
  if (redisOk) {
    const { syncTronNetworkFlag } = await import("./lib/tronNetwork.js");
    await syncTronNetworkFlag();
  } else {
    log.service(
      "TRON",
      `${env.TRON_NETWORK} · ${env.TRONGRID_BASE_URL}`,
      Boolean(env.TRONGRID_API_KEY),
    );
  }
  startWalletBalanceJob();
  startWalletSweepJob();
  startGatewayDailyResetJob();

  await startServer();
  log.service("HTTP", `:${env.PORT}`, true);

  if (env.JIBIT_API_KEY && env.JIBIT_SECRET_KEY) {
    log.service("Jibit", "identicator ready", true);
  } else {
    log.service("Jibit", "keys missing", false);
  }

  try {
    const webhook = await ensureWebhook();
    const via = webhook.proxy ? ` · proxy ${webhook.proxy}` : "";
    log.service(
      "Webhook",
      webhook.updated
        ? `set · ${webhook.url}${via}`
        : `ok · ${webhook.url}${via}`,
      true,
    );
    if (webhook.pendingUpdateCount > 0) {
      log.note("pending updates", String(webhook.pendingUpdateCount));
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.service("Webhook", "skipped", false);
    log.warn("webhook", msg);
  }

  try {
    const { resolveBotUsername } = await import("./lib/botUsername.js");
    const username = await resolveBotUsername();
    if (username) {
      const short = env.TELEGRAM_MINI_APP_SHORT_NAME;
      const deep = short
        ? `https://t.me/${username}/${short}?startapp=…`
        : `https://t.me/${username}?startapp=…`;
      log.service("Bot", `@${username} · invoice links ${deep}`, true);
    } else {
      log.service("Bot", "username unknown · invoice links use HTTPS fallback", false);
    }
  } catch (err) {
    log.warn("bot", err instanceof Error ? err.message : String(err));
  }

  const { startShopReportBot } = await import("./lib/shopReportBot.js");
  startShopReportBot();

  log.service("MiniApp", env.MINI_APP_URL, true);
  log.ready(env.PUBLIC_URL);
  log.event("boot", "API ready");
}

main().catch((err) => {
  log.error("boot", err instanceof Error ? err.message : err);
  process.exit(1);
});
