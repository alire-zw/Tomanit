import { env } from "../../config/env.js";
import { callTelegramApi } from "../telegramApi.js";
import { log } from "../log.js";
import { getActiveAdminSystemChannel } from "../systemChannels.js";
import { getBotUsername, resolveBotUsername } from "../botUsername.js";
import { SHOP_REVIEW_EMOJI, tgPremiumEmoji } from "./premiumEmoji.js";
import type {
  MerchantSettlementMethod,
  MerchantTrxDestination,
} from "@prisma/client";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatToman(amount: number): string {
  return `${Math.trunc(amount).toLocaleString("en-US")} toman`;
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-GB", {
      timeZone: "Asia/Tehran",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return iso;
  }
}

async function miniAppDeepLink(): Promise<string> {
  const username =
    (await resolveBotUsername()) ?? getBotUsername() ?? null;
  if (username) {
    const short = env.TELEGRAM_MINI_APP_SHORT_NAME?.trim();
    return short
      ? `https://t.me/${username}/${encodeURIComponent(short)}`
      : `https://t.me/${username}`;
  }
  return env.MINI_APP_URL.replace(/\/+$/, "");
}

export type ShopSettlementAdminNotifyInput = {
  settlementId: string;
  amountToman: number;
  method: MerchantSettlementMethod;
  iban?: string | null;
  trxDestination?: MerchantTrxDestination | null;
  trxAddress?: string | null;
  createdAt: string;
  shop: {
    id: number | string;
    name: string;
  };
  user: {
    telegramId: string;
    username?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    fullName?: string | null;
  };
};

function methodLabel(method: MerchantSettlementMethod): string {
  return method === "rial" ? "Rial (IBAN)" : "TRON (TRX)";
}

function trxDestLabel(dest: MerchantTrxDestination | null | undefined): string {
  if (dest === "in_app") return "In-app wallet";
  if (dest === "external") return "External wallet";
  return "—";
}

function displayUser(user: ShopSettlementAdminNotifyInput["user"]): string {
  const username = user.username?.trim();
  if (username) return `@${username.replace(/^@/, "")}`;
  const name =
    user.fullName?.trim() ||
    [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return name || "No name";
}

function buildMessage(input: ShopSettlementAdminNotifyInput): string {
  const title = tgPremiumEmoji("📥", SHOP_REVIEW_EMOJI.monitor.id);
  const money = tgPremiumEmoji("💸", "5231005931550030290");
  const lines = [
    `${title} <b>Shop Settlement Request</b>`,
    "",
    `🏪 <b>Shop:</b> ${escapeHtml(input.shop.name)}`,
    `🆔 <b>ShopID:</b> <code>${escapeHtml(String(input.shop.id))}</code>`,
    `🙋 <b>User:</b> ${escapeHtml(displayUser(input.user))}`,
    `📟 <b>UserID:</b> <code>${escapeHtml(input.user.telegramId)}</code>`,
    "",
    `${money} <b>Amount:</b> ${escapeHtml(formatToman(input.amountToman))}`,
    `💱 <b>Method:</b> ${escapeHtml(methodLabel(input.method))}`,
  ];

  if (input.method === "rial") {
    lines.push(
      `🏦 <b>IBAN:</b> <code>${escapeHtml(input.iban?.trim() || "—")}</code>`,
    );
  } else {
    lines.push(
      `🎯 <b>Destination:</b> ${escapeHtml(trxDestLabel(input.trxDestination))}`,
    );
    if (input.trxDestination === "external") {
      lines.push(
        `📍 <b>Address:</b> <code>${escapeHtml(input.trxAddress?.trim() || "—")}</code>`,
      );
    } else {
      lines.push(`📍 <b>Address:</b> In-app wallet (no external address)`);
    }
  }

  lines.push(
    "",
    `📌 <b>Status:</b> Requested`,
    `🧾 <b>Settlement ID:</b> <code>#${escapeHtml(input.settlementId)}</code>`,
    `⏳ <b>Time:</b> ${escapeHtml(formatTime(input.createdAt))}`,
  );

  return lines.join("\n");
}

/**
 * Post settlement request to admin_report channel (English).
 * Channel posts cannot use web_app — URL deep link only.
 * Failures are logged and never thrown.
 */
export async function notifyShopSettlementAdmin(
  input: ShopSettlementAdminNotifyInput,
): Promise<void> {
  try {
    const channel = await getActiveAdminSystemChannel("admin_report");
    if (!channel?.chatId) {
      log.warn("notify", "settlement admin report skipped — channel missing");
      return;
    }

    const deepLink = await miniAppDeepLink();
    const text = buildMessage(input);

    await callTelegramApi("sendMessage", {
      chat_id: channel.chatId,
      text,
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "Open Mini App",
              url: deepLink,
              style: "primary",
              icon_custom_emoji_id: SHOP_REVIEW_EMOJI.miniapp.id,
            },
          ],
        ],
      },
    });

    log.event(
      "notify",
      `settlement #${input.settlementId} → admin_report shop:${input.shop.id}`,
    );
  } catch (err) {
    log.warn(
      "notify",
      `settlement admin report fail #${input.settlementId} — ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
}
