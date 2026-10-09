import type { CryptoNetwork, WalletAsset } from "@prisma/client";
import { env } from "../../config/env.js";
import { callTelegramApi } from "../telegramApi.js";
import { log } from "../log.js";
import { prisma } from "../../db/prisma.js";
import {
  DEPOSIT_ASSET_EMOJI,
  DEPOSIT_UI_EMOJI,
  tgPremiumEmoji,
  type DepositAssetEmojiKey,
} from "./premiumEmoji.js";
import {
  buildDepositNotifyContent,
  getAssetDisplayName,
  resolveBotLocale,
} from "./depositNotifyI18n.js";

function isDepositAsset(asset: WalletAsset): asset is DepositAssetEmojiKey {
  return asset in DEPOSIT_ASSET_EMOJI;
}

/** Latin digits + grouping, monospace-ready (wrapped in <code> by templates). */
export function formatLatinAmount(value: number, maxFractionDigits = 6): string {
  if (!Number.isFinite(value)) return "0";
  return value.toLocaleString("en-US", {
    useGrouping: true,
    maximumFractionDigits: maxFractionDigits,
    minimumFractionDigits: 0,
  });
}

export function formatLatinToman(value: number): string {
  return Math.round(value).toLocaleString("en-US", { useGrouping: true });
}

export function explorerTxUrl(
  network: CryptoNetwork | null | undefined,
  txHash: string,
): string | null {
  const hash = txHash.trim();
  if (!hash || !network) return null;

  switch (network) {
    case "tron":
      return `${env.TRON_EXPLORER_URL}/#/transaction/${encodeURIComponent(hash)}`;
    case "bsc":
      return `https://bscscan.com/tx/${encodeURIComponent(hash)}`;
    case "polygon":
      return `https://polygonscan.com/tx/${encodeURIComponent(hash)}`;
    case "ton":
      return `https://tonviewer.com/transaction/${encodeURIComponent(hash)}`;
    default:
      return null;
  }
}

type GlassButton = {
  text: string;
  style: "primary";
  icon_custom_emoji_id: string;
  url?: string;
  web_app?: { url: string };
};

export type CryptoDepositNotifyInput = {
  userId: number;
  asset: WalletAsset;
  amount: number;
  amountToman: number | null;
  network: CryptoNetwork | null;
  fromAddress: string | null;
  txHash: string | null;
};

/**
 * Notify user in Telegram bot when a crypto deposit is credited.
 * Failures are logged and never thrown to the caller.
 */
export async function notifyCryptoDeposit(
  input: CryptoDepositNotifyInput,
): Promise<void> {
  try {
    if (!isDepositAsset(input.asset)) return;

    const user = await prisma.user.findUnique({
      where: { id: input.userId },
      select: { telegramId: true, languageCode: true },
    });
    if (!user?.telegramId) return;

    const locale = resolveBotLocale(user.languageCode);
    const assetEmoji = DEPOSIT_ASSET_EMOJI[input.asset];
    const { monitor, hash: hashEmoji, miniapp } = DEPOSIT_UI_EMOJI;

    const content = buildDepositNotifyContent({
      locale,
      assetEmojiHtml: tgPremiumEmoji(assetEmoji.fallback, assetEmoji.id),
      monitorEmojiHtml: tgPremiumEmoji(monitor.fallback, monitor.id),
      amount: formatLatinAmount(input.amount),
      assetName: getAssetDisplayName(locale, input.asset),
      toman:
        input.amountToman != null && input.amountToman > 0
          ? formatLatinToman(input.amountToman)
          : null,
      fromAddress: input.fromAddress?.trim() || null,
      hasHash: Boolean(input.txHash?.trim()),
    });

    const row: GlassButton[] = [];
    const explorer = input.txHash
      ? explorerTxUrl(input.network, input.txHash)
      : null;

    if (explorer) {
      row.push({
        text: content.hashBtn,
        url: explorer,
        style: "primary",
        icon_custom_emoji_id: hashEmoji.id,
      });
    }

    row.push({
      text: content.miniAppBtn,
      web_app: { url: env.MINI_APP_URL },
      style: "primary",
      icon_custom_emoji_id: miniapp.id,
    });

    await callTelegramApi("sendMessage", {
      chat_id: user.telegramId,
      text: content.text,
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
      reply_markup: {
        inline_keyboard: [row],
      },
    });

    log.event(
      "notify",
      `deposit ${input.asset} → tg:${user.telegramId} #${input.userId}`,
    );
  } catch (err) {
    log.warn(
      "notify",
      `deposit notify fail user:${input.userId} — ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
}
