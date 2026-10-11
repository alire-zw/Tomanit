import { env } from "../src/config/env.js";
import { callTelegramApiWithToken } from "../src/lib/telegramApi.js";

async function main() {
  const token = env.SHOP_REPORT_BOT_TOKEN;
  console.log("token set:", Boolean(token));
  const me = await callTelegramApiWithToken<{
    username?: string;
    id?: number;
  }>(token, "getMe");
  console.log("me:", me);
  const wh = await callTelegramApiWithToken<Record<string, unknown>>(
    token,
    "getWebhookInfo",
  );
  console.log("webhook:", wh);
  try {
    const updates = await callTelegramApiWithToken<unknown[]>(
      token,
      "getUpdates",
      { timeout: 0, limit: 10 },
      15_000,
    );
    console.log("pending updates:", updates.length);
    console.log(JSON.stringify(updates, null, 2).slice(0, 3000));
  } catch (err) {
    console.log(
      "getUpdates error:",
      err instanceof Error ? err.message : String(err),
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
