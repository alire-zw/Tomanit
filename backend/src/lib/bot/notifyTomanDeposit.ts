import { env } from "../../config/env.js";
import { callTelegramApi } from "../telegramApi.js";
import { log } from "../log.js";
import { prisma } from "../../db/prisma.js";
import {
  DEPOSIT_UI_EMOJI,
  TOMAN_DEPOSIT_EMOJI,
  tgPremiumEmoji,
} from "./premiumEmoji.js";
import {
  buildTomanDepositNotifyContent,
  resolveBotLocale,
} from "./depositNotifyI18n.js";
import { formatLatinAmount, formatLatinToman } from "./notifyCryptoDeposit.js";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type TomanDepositNotifyInput = {
  userId: number;
  amountToman: number;
  usdtRateToman?: number | null;
  gatewayName?: string | null;
};

/**
 * Notify user in Telegram when a toman (gateway) deposit is credited.
 * Failures are logged and never thrown to the caller.
 */
export async function notifyTomanDeposit(
  input: TomanDepositNotifyInput,
): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: input.userId },
      select: { telegramId: true, languageCode: true },
    });
    if (!user?.telegramId) return;

    const locale = resolveBotLocale(user.languageCode);
    const { miniapp } = DEPOSIT_UI_EMOJI;

    let usdt: string | null = null;
    if (
      typeof input.usdtRateToman === "number" &&
      input.usdtRateToman > 0 &&
      input.amountToman > 0
    ) {
      usdt = formatLatinAmount(input.amountToman / input.usdtRateToman, 2);
    }

    const content = buildTomanDepositNotifyContent({
      locale,
      assetEmojiHtml: tgPremiumEmoji(
        TOMAN_DEPOSIT_EMOJI.fallback,
        TOMAN_DEPOSIT_EMOJI.id,
      ),
      amount: formatLatinToman(input.amountToman),
      usdt,
      gatewayName: input.gatewayName?.trim()
        ? escapeHtml(input.gatewayName.trim())
        : null,
    });

    await callTelegramApi("sendMessage", {
      chat_id: user.telegramId,
      text: content.text,
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: content.miniAppBtn,
              web_app: { url: env.MINI_APP_URL },
              style: "primary",
              icon_custom_emoji_id: miniapp.id,
            },
          ],
        ],
      },
    });

    log.event(
      "notify",
      `deposit toman → tg:${user.telegramId} #${input.userId}`,
    );
  } catch (err) {
    log.warn(
      "notify",
      `toman deposit notify fail user:${input.userId} — ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
}
