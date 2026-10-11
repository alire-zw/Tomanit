import { prisma } from "../src/db/prisma.js";
import { env } from "../src/config/env.js";
import { callTelegramApiWithToken } from "../src/lib/telegramApi.js";

/** Dev helper: link the first shop to its owner's Telegram and ping the report bot. */
async function main() {
  const shop = await prisma.merchantShop.findFirst({
    include: { user: { select: { telegramId: true, username: true } } },
    orderBy: { id: "asc" },
  });
  if (!shop?.user.telegramId) {
    throw new Error("No shop / telegram id");
  }

  const chatId = shop.user.telegramId;
  await prisma.merchantShop.update({
    where: { id: shop.id },
    data: {
      reportBotEnabled: true,
      reportBotChatId: chatId,
      reportBotLinkedAt: new Date(),
    },
  });

  await callTelegramApiWithToken(env.SHOP_REPORT_BOT_TOKEN, "sendMessage", {
    chat_id: chatId,
    text:
      "✅ <b>ربات گزارش فعال شد</b>\n\nاز این پس تراکنش‌های موفق فروشگاه <b>" +
      shop.name.replace(/&/g, "&amp;").replace(/</g, "&lt;") +
      "</b> اینجا ارسال می‌شود.\n\nاگر پیامی نگرفتید، در همین ربات /start را بزنید.",
    parse_mode: "HTML",
  });

  console.log(`linked shop #${shop.id} → chat ${chatId} (@${shop.user.username ?? "—"})`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
