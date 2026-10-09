import { env } from "../../config/env.js";
import { callTelegramApi } from "../telegramApi.js";
import { log } from "../log.js";
import { prisma } from "../../db/prisma.js";
import { SHOP_REVIEW_EMOJI, tgPremiumEmoji } from "./premiumEmoji.js";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function shopMiniAppUrl(): string {
  return `${env.MINI_APP_URL.replace(/\/+$/, "")}/shop`;
}

function buildApprovedText(): string {
  const ok = tgPremiumEmoji(
    SHOP_REVIEW_EMOJI.approved.fallback,
    SHOP_REVIEW_EMOJI.approved.id,
  );
  const monitor = tgPremiumEmoji(
    SHOP_REVIEW_EMOJI.monitor.fallback,
    SHOP_REVIEW_EMOJI.monitor.id,
  );
  return [
    `${ok} <b>فروشگاه شما تأیید شد</b>`,
    "",
    `${monitor} درخواست فعال‌سازی <b>درگاه پرداخت</b> فروشگاه شما توسط کارشناسان <b>تومانیت</b> بررسی و <b>تأیید</b> شد. اکنون می‌توانید از خدمات و سرویس‌های پرداخت تومانیت در فروشگاه خود استفاده کرده و درگاه پرداخت را به کسب‌وکار خود متصل کنید.`,
  ].join("\n");
}

function buildRejectedText(reason: string | null): string {
  const ban = tgPremiumEmoji(
    SHOP_REVIEW_EMOJI.rejected.fallback,
    SHOP_REVIEW_EMOJI.rejected.id,
  );
  const monitor = tgPremiumEmoji(
    SHOP_REVIEW_EMOJI.monitor.fallback,
    SHOP_REVIEW_EMOJI.monitor.id,
  );
  const question = tgPremiumEmoji(
    SHOP_REVIEW_EMOJI.question.fallback,
    SHOP_REVIEW_EMOJI.question.id,
  );
  const speak = tgPremiumEmoji(
    SHOP_REVIEW_EMOJI.speak.fallback,
    SHOP_REVIEW_EMOJI.speak.id,
  );
  const reasonLine = reason?.trim()
    ? escapeHtml(reason.trim())
    : "بدون توضیح";

  return [
    `${ban} <b>فروشگاه تأیید نشد</b>`,
    "",
    `${monitor} درخواست فعال‌سازی <b>درگاه پرداخت</b> فروشگاه شما توسط کارشناسان <b>تومانیت</b> بررسی شد، اما در حال حاضر مورد تأیید قرار نگرفت.`,
    "",
    `${question} <b>دلیل:</b> ${reasonLine}`,
    "",
    `${speak} لطفاً موارد اعلام‌شده را بررسی و اصلاح کرده و درخواست خود را <b>مجدداً</b> برای بررسی ارسال کنید.`,
  ].join("\n");
}

export type ShopReviewNotifyInput = {
  userId: number;
  decision: "approved" | "rejected";
  reason?: string | null;
};

/**
 * Telegram bot + HTML premium emoji when a merchant shop is approved/rejected.
 * Failures are logged and never thrown.
 */
export async function notifyShopReview(
  input: ShopReviewNotifyInput,
): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: input.userId },
      select: { telegramId: true },
    });
    if (!user?.telegramId) return;

    const text =
      input.decision === "approved"
        ? buildApprovedText()
        : buildRejectedText(input.reason ?? null);

    await callTelegramApi("sendMessage", {
      chat_id: user.telegramId,
      text,
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "ورود به مینی‌اپ",
              web_app: { url: shopMiniAppUrl() },
              style: "primary",
              icon_custom_emoji_id: SHOP_REVIEW_EMOJI.miniapp.id,
            },
          ],
        ],
      },
    });

    log.event(
      "notify",
      `shop ${input.decision} → tg:${user.telegramId} #${input.userId}`,
    );
  } catch (err) {
    log.warn(
      "notify",
      `shop review notify fail user:${input.userId} — ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
}
