import { env } from "../config/env.js";
import { prisma } from "../db/prisma.js";
import { log } from "./log.js";
import { getBotUsername, resolveBotUsername } from "./botUsername.js";
import { callTelegramApiWithToken } from "./telegramApi.js";
import { REPORT_BOT_EMOJI, tgPremiumEmoji } from "./bot/premiumEmoji.js";

/**
 * Shop report bot — a separate Telegram bot (SHOP_REPORT_BOT_TOKEN) that sends
 * every successful merchant-invoice payment to the shop owner.
 * Runs with long-polling so it needs no extra public webhook route.
 */

const POLL_TIMEOUT_SEC = 25;
const POLL_HTTP_TIMEOUT_MS = (POLL_TIMEOUT_SEC + 15) * 1000;
const RETRY_DELAY_MS = 5_000;

type TgUser = {
  id: number;
  is_bot?: boolean;
  first_name?: string;
  username?: string;
};

type TgMessage = {
  message_id: number;
  chat: { id: number; type: string };
  from?: TgUser;
  text?: string;
};

type ReportBotUpdate = {
  update_id: number;
  message?: TgMessage;
  callback_query?: {
    id: string;
    from: TgUser;
    data?: string;
    message?: TgMessage;
  };
};

type Locale = "fa" | "en";

let polling = false;
let cachedUsername: string | null = null;

export function isShopReportBotConfigured(): boolean {
  return Boolean(env.SHOP_REPORT_BOT_TOKEN);
}

function callReportApi<T>(
  method: string,
  body?: Record<string, unknown>,
  timeoutMs?: number,
): Promise<T> {
  return callTelegramApiWithToken<T>(
    env.SHOP_REPORT_BOT_TOKEN,
    method,
    body,
    timeoutMs,
  );
}

export function getShopReportBotUsername(): string | null {
  return env.SHOP_REPORT_BOT_USERNAME || cachedUsername;
}

export async function resolveShopReportBotUsername(): Promise<string | null> {
  if (!isShopReportBotConfigured()) return null;
  const known = getShopReportBotUsername();
  if (known) return known;
  try {
    const me = await callReportApi<{ username?: string }>("getMe");
    const username = String(me.username || "").trim().replace(/^@/, "");
    if (username) cachedUsername = username;
  } catch (err) {
    log.warn("report-bot", err instanceof Error ? err.message : String(err));
  }
  return cachedUsername;
}

export function shopReportBotLink(username: string | null): string | null {
  return username ? `https://t.me/${username}?start=link` : null;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function resolveLocale(languageCode: string | null | undefined): Locale {
  const base = (languageCode || "fa").trim().toLowerCase().split(/[-_]/)[0];
  return base === "fa" ? "fa" : "en";
}

function mono(value: string): string {
  return `<code>${value}</code>`;
}

function formatToman(amount: number, locale: Locale): string {
  const n = Math.max(0, Math.trunc(amount)).toLocaleString("en-US");
  const unit = locale === "fa" ? "تومان" : "toman";
  return `${mono(n)} ${unit}`;
}

function formatDateTime(date: Date, locale: Locale): string {
  try {
    const formatted = new Intl.DateTimeFormat(
      locale === "fa" ? "fa-IR-u-ca-persian-nu-latn" : "en-GB",
      {
        timeZone: "Asia/Tehran",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      },
    ).format(date);
    // e.g. 1405/07/19 - 03:28:40
    return formatted.replace(/,\s*/, " - ");
  } catch {
    return date.toISOString();
  }
}

function formatCard(cardNumber: string | null | undefined): string | null {
  const digits = String(cardNumber || "").replace(/\D/g, "");
  if (!digits) return null;
  return digits.replace(/(\d{4})(?=\d)/g, "$1-");
}

const E = REPORT_BOT_EMOJI;

function pe(key: keyof typeof E): string {
  return tgPremiumEmoji(E[key].fallback, E[key].id);
}

const TEXT = {
  fa: {
    welcomeOn: (shop: string) =>
      [
        `${pe("check")} <b>ربات گزارش آماده است</b>`,
        "",
        `${pe("bell")} گزارش‌های فروشگاه <b>${shop}</b> فعال‌اند.`,
        "هر تراکنش موفق با جزئیات کامل همین‌جا برایتان ارسال می‌شود.",
      ].join("\n"),
    welcomeOff: (shop: string) =>
      [
        `${pe("bell")} <b>ربات گزارش غیرفعال است</b>`,
        "",
        `${pe("alert")} حساب شما به فروشگاه <b>${shop}</b> وصل شد، ولی ارسال گزارش هنوز خاموش است.`,
        "برای فعال‌سازی، از مینی‌اپ تومانیت سوییچ ربات گزارش را روشن کنید.",
      ].join("\n"),
    disabled:
      [
        `${pe("bell")} <b>ربات گزارش غیرفعال شد</b>`,
        "",
        `${pe("alert")} دیگر گزارشی ارسال نمی‌شود.`,
        "هر زمان خواستید از مینی‌اپ تومانیت دوباره فعالش کنید.",
      ].join("\n"),
    noShop:
      [
        `${pe("alert")} برای این حساب تلگرام فروشگاهی ثبت نشده است.`,
        "ابتدا از مینی‌اپ تومانیت فروشگاه خود را بسازید.",
      ].join("\n"),
    statusOn: (shop: string) =>
      `${pe("check")} گزارش تراکنش‌های <b>${shop}</b> فعال است.`,
    statusOff: (shop: string) =>
      [
        `${pe("bell")} گزارش تراکنش‌های <b>${shop}</b> غیرفعال است.`,
        "از مینی‌اپ تومانیت فعالش کنید.",
      ].join("\n"),
    help:
      "دستورات:\n/start — اتصال به ربات\n/stop — توقف گزارش\n/status — وضعیت",
    btnOff: "غیرفعالسازی در مینی‌اپ تومانیت",
    btnOn: "فعالسازی در مینی‌اپ تومانیت",
    btnApp: "ورود به مینی‌اپ تومانیت",
    privateOnly: "این ربات فقط در چت خصوصی کار می‌کند.",
    // transaction report lines
    txOk: "تراکنش موفق",
    invoiceAmount: "مبلغ فاکتور",
    fee: "کارمزد",
    credited: "مبلغ دریافتی",
    payerId: "شناسه پرداخت‌کننده",
    username: "یوزرنیم",
    card: "شماره کارت",
    bank: "بانک",
    cardOwner: "صاحب کارت",
    paidAt: "زمان پرداخت",
    feeBearer: {
      payer: "کسر از پرداخت‌کننده",
      merchant: "کسر از فروشگاه",
      split: "تقسیم کارمزد",
    } as Record<string, string>,
  },
  en: {
    welcomeOn: (shop: string) =>
      [
        `${pe("check")} <b>Report bot is ready</b>`,
        "",
        `${pe("bell")} Reports for <b>${shop}</b> are enabled.`,
        "Every successful payment will be sent here with full details.",
      ].join("\n"),
    welcomeOff: (shop: string) =>
      [
        `${pe("bell")} <b>Report bot is inactive</b>`,
        "",
        `${pe("alert")} Your chat is linked to <b>${shop}</b>, but reports are still off.`,
        "Open the Tomanit mini app and turn on the report bot switch.",
      ].join("\n"),
    disabled:
      [
        `${pe("bell")} <b>Report bot disabled</b>`,
        "",
        `${pe("alert")} Reports are paused.`,
        "You can enable them again anytime from the Tomanit mini app.",
      ].join("\n"),
    noShop:
      [
        `${pe("alert")} No shop is registered for this Telegram account.`,
        "Create your shop in the Tomanit mini app first.",
      ].join("\n"),
    statusOn: (shop: string) =>
      `${pe("check")} Reports for <b>${shop}</b> are enabled.`,
    statusOff: (shop: string) =>
      [
        `${pe("bell")} Reports for <b>${shop}</b> are disabled.`,
        "Enable them in the Tomanit mini app.",
      ].join("\n"),
    help: "Commands:\n/start — link bot\n/stop — pause reports\n/status — status",
    btnOff: "Disable in Tomanit mini app",
    btnOn: "Enable in Tomanit mini app",
    btnApp: "Open Tomanit mini app",
    privateOnly: "This bot only works in private chats.",
    txOk: "Successful payment",
    invoiceAmount: "Invoice amount",
    fee: "Fee",
    credited: "Received amount",
    payerId: "Payer ID",
    username: "Username",
    card: "Card number",
    bank: "Bank",
    cardOwner: "Card holder",
    paidAt: "Paid at",
    feeBearer: {
      payer: "charged to payer",
      merchant: "deducted from shop",
      split: "split fee",
    } as Record<string, string>,
  },
} as const;

/**
 * Open Mini App via the MAIN bot deep link (t.me/…).
 * web_app from the report bot signs initData with the report-bot token → 401 on API.
 */
function mainMiniAppDeepLink(startapp?: string): string {
  const username = getBotUsername();
  if (!username) {
    return env.MINI_APP_URL.replace(/\/+$/, "");
  }
  const short = env.TELEGRAM_MINI_APP_SHORT_NAME?.trim();
  const path = short
    ? `https://t.me/${username}/${encodeURIComponent(short)}`
    : `https://t.me/${username}`;
  return startapp
    ? `${path}?startapp=${encodeURIComponent(startapp)}`
    : path;
}

function miniAppUrlButton(text: string, iconId: string, startapp?: string) {
  return {
    text,
    url: mainMiniAppDeepLink(startapp),
    style: "primary" as const,
    icon_custom_emoji_id: iconId,
  };
}

function toggleKeyboard(locale: Locale, enabled: boolean) {
  const t = TEXT[locale];
  return {
    inline_keyboard: [
      [
        enabled
          ? miniAppUrlButton(t.btnOff, E.warn.id, "reportbot")
          : miniAppUrlButton(t.btnOn, E.monitor.id, "reportbot"),
      ],
    ],
  };
}

function appOnlyKeyboard(locale: Locale) {
  const t = TEXT[locale];
  // Main bot Mini App home (wallet) — auth via main bot initData
  return {
    inline_keyboard: [[miniAppUrlButton(t.btnApp, E.monitor.id)]],
  };
}

async function findOwnerShop(telegramId: number) {
  const user = await prisma.user.findUnique({
    where: { telegramId: String(telegramId) },
    select: {
      id: true,
      languageCode: true,
      merchantShop: {
        select: {
          id: true,
          name: true,
          reportBotEnabled: true,
          reportBotChatId: true,
        },
      },
    },
  });
  return user;
}

async function sendText(
  chatId: number | string,
  text: string,
  replyMarkup?: Record<string, unknown>,
): Promise<void> {
  await callReportApi("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  });
}

/** Link chat for delivery — does NOT turn reports on (enable only from mini app). */
async function linkChat(
  telegramId: number,
  chatId: number,
): Promise<{ locale: Locale; shopName: string; enabled: boolean } | null> {
  const owner = await findOwnerShop(telegramId);
  const shop = owner?.merchantShop;
  if (!owner || !shop) return null;
  await prisma.merchantShop.update({
    where: { id: shop.id },
    data: {
      reportBotChatId: String(chatId),
      reportBotLinkedAt: new Date(),
    },
  });
  log.event("report-bot", `linked shop:${shop.id} tg:${telegramId}`);
  return {
    locale: resolveLocale(owner.languageCode),
    shopName: shop.name,
    enabled: shop.reportBotEnabled,
  };
}

async function setEnabled(
  telegramId: number,
  chatId: number,
  enabled: boolean,
): Promise<{ locale: Locale; shopName: string } | null> {
  const owner = await findOwnerShop(telegramId);
  const shop = owner?.merchantShop;
  if (!owner || !shop) return null;
  await prisma.merchantShop.update({
    where: { id: shop.id },
    data: enabled
      ? {
          reportBotEnabled: true,
          reportBotChatId: String(chatId),
          reportBotLinkedAt: new Date(),
        }
      : { reportBotEnabled: false },
  });
  log.event(
    "report-bot",
    `${enabled ? "enabled" : "disabled"} shop:${shop.id} tg:${telegramId}`,
  );
  return { locale: resolveLocale(owner.languageCode), shopName: shop.name };
}

function commandOf(text: string | undefined): string | null {
  if (!text) return null;
  const [cmd] = text.trim().split(/\s+/, 1);
  if (!cmd?.startsWith("/")) return null;
  return cmd.split("@")[0]!.toLowerCase();
}

async function handleMessage(message: TgMessage): Promise<void> {
  const from = message.from;
  if (!from || from.is_bot) return;
  if (message.chat.type !== "private") {
    await sendText(message.chat.id, TEXT.fa.privateOnly);
    return;
  }

  const cmd = commandOf(message.text);
  const owner = await findOwnerShop(from.id);
  const locale = resolveLocale(owner?.languageCode);
  const t = TEXT[locale];

  if (!owner?.merchantShop) {
    await sendText(message.chat.id, t.noShop, appOnlyKeyboard(locale));
    return;
  }

  if (cmd === "/start") {
    const linked = await linkChat(from.id, message.chat.id);
    if (!linked) {
      await sendText(message.chat.id, t.noShop, appOnlyKeyboard(locale));
      return;
    }
    const shopName = escapeHtml(linked.shopName);
    const text = linked.enabled
      ? t.welcomeOn(shopName)
      : t.welcomeOff(shopName);
    await sendText(message.chat.id, text, toggleKeyboard(locale, linked.enabled));
    return;
  }

  if (cmd === "/stop") {
    await setEnabled(from.id, message.chat.id, false);
    await sendText(
      message.chat.id,
      t.disabled,
      toggleKeyboard(locale, false),
    );
    return;
  }

  const shopName = escapeHtml(owner.merchantShop.name);
  const enabled =
    owner.merchantShop.reportBotEnabled &&
    owner.merchantShop.reportBotChatId === String(message.chat.id);

  if (cmd === "/status") {
    await sendText(
      message.chat.id,
      enabled ? t.statusOn(shopName) : t.statusOff(shopName),
      toggleKeyboard(locale, enabled),
    );
    return;
  }

  await sendText(message.chat.id, t.help, toggleKeyboard(locale, enabled));
}

async function handleCallback(
  cb: NonNullable<ReportBotUpdate["callback_query"]>,
): Promise<void> {
  const data = cb.data || "";
  // Enable/disable UI is web_app only; legacy callbacks just nudge to the mini app.
  if (data === "rb:on" || data === "rb:off") {
    const owner = await findOwnerShop(cb.from.id);
    const locale = resolveLocale(owner?.languageCode);
    await callReportApi("answerCallbackQuery", {
      callback_query_id: cb.id,
      text:
        locale === "fa"
          ? "از دکمه مینی‌اپ تومانیت استفاده کنید."
          : "Use the Tomanit mini app button.",
      show_alert: true,
    });
    return;
  }
  await callReportApi("answerCallbackQuery", { callback_query_id: cb.id });
}

async function handleUpdate(update: ReportBotUpdate): Promise<void> {
  const fromId =
    update.message?.from?.id ?? update.callback_query?.from?.id ?? null;
  const preview =
    update.message?.text ||
    update.callback_query?.data ||
    (update.message ? "message" : "update");
  log.event(
    "report-bot",
    `update #${update.update_id} tg:${fromId ?? "?"} · ${String(preview).slice(0, 80)}`,
  );

  if (update.message) {
    await handleMessage(update.message);
    return;
  }
  if (update.callback_query) {
    await handleCallback(update.callback_query);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Start long-polling the report bot (no-op when token is missing). */
export function startShopReportBot(): void {
  if (!isShopReportBotConfigured() || polling) {
    if (!isShopReportBotConfigured()) {
      log.service("ReportBot", "token missing · disabled", false);
    }
    return;
  }
  polling = true;

  void (async () => {
    try {
      await callReportApi("deleteWebhook", { drop_pending_updates: false });
    } catch (err) {
      log.warn("report-bot", err instanceof Error ? err.message : String(err));
    }

    const username = await resolveShopReportBotUsername();
    log.event(
      "report-bot",
      username ? `@${username} · polling` : "polling · username unknown",
    );

    try {
      await callReportApi("setMyCommands", {
        commands: [
          { command: "start", description: "اتصال به ربات گزارش" },
          { command: "stop", description: "توقف گزارش" },
          { command: "status", description: "وضعیت گزارش" },
        ],
      });
    } catch {
      // optional
    }

    let offset = 0;
    while (polling) {
      try {
        const updates = await callReportApi<ReportBotUpdate[]>(
          "getUpdates",
          {
            offset,
            timeout: POLL_TIMEOUT_SEC,
            allowed_updates: ["message", "callback_query"],
          },
          POLL_HTTP_TIMEOUT_MS,
        );
        for (const update of updates) {
          offset = update.update_id + 1;
          try {
            await handleUpdate(update);
          } catch (err) {
            log.warn(
              "report-bot",
              err instanceof Error ? err.message : String(err),
            );
          }
        }
      } catch (err) {
        log.warn("report-bot", err instanceof Error ? err.message : String(err));
        await sleep(RETRY_DELAY_MS);
      }
    }
  })();
}

/**
 * Send a successful merchant-invoice payment to the shop owner via the report bot.
 * Failures are logged and never thrown.
 */
export async function notifyShopReportTransaction(chargeId: number): Promise<void> {
  if (!isShopReportBotConfigured()) return;
  try {
    await resolveBotUsername();
    const charge = await prisma.gatewayCharge.findUnique({
      where: { id: chargeId },
      include: {
        user: {
          select: {
            telegramId: true,
            username: true,
            firstName: true,
            lastName: true,
          },
        },
        bankCard: {
          select: { cardNumber: true, bankName: true, ownerName: true },
        },
        merchantPaymentLink: {
          include: {
            shop: {
              select: {
                id: true,
                name: true,
                feeBearer: true,
                reportBotEnabled: true,
                reportBotChatId: true,
                user: { select: { languageCode: true } },
              },
            },
          },
        },
      },
    });
    if (!charge || charge.kind !== "merchant_invoice") return;
    if (charge.status !== "completed") return;
    const link = charge.merchantPaymentLink;
    const shop = link?.shop;
    if (!link || !shop?.reportBotEnabled || !shop.reportBotChatId) return;

    const locale = resolveLocale(shop.user.languageCode);
    const t = TEXT[locale];

    const paidTotal = Number(charge.amountToman);
    const invoiceAmount = Number(charge.invoiceAmountToman ?? link.amountToman);
    const fee = Number(charge.feeToman ?? 0);
    const credited = Math.max(0, fee > 0 ? paidTotal - fee : invoiceAmount);
    const bearer = t.feeBearer[shop.feeBearer] ?? shop.feeBearer;

    const payerUsername = charge.user?.username?.trim();
    const payerTelegramId = link.payerTelegramId || charge.user?.telegramId || null;
    const card = formatCard(charge.bankCard?.cardNumber);
    const refId = charge.trackId?.trim() || charge.code;
    const sep = " : ";

    const line = (emoji: keyof typeof E, text: string) =>
      `${pe(emoji)} ${text}`;

    const lines = [
      line("check", `<b>${t.txOk}</b>  |  <b>${escapeHtml(shop.name)}</b>`),
      "",
      line(
        "info",
        `${mono(escapeHtml(refId))}  |  ${mono(escapeHtml(charge.code))}`,
      ),
      "",
      line("cash", `${t.invoiceAmount}${sep}${formatToman(invoiceAmount, locale)}`),
      line(
        "bag",
        `${t.fee}${sep}${formatToman(fee, locale)}  |  <b>${escapeHtml(bearer)}</b>`,
      ),
      line(
        "money",
        `<b>${t.credited}</b>${sep}${formatToman(credited, locale)}`,
      ),
      "",
      payerTelegramId
        ? line(
            "hush",
            `${t.payerId}${sep}${mono(escapeHtml(payerTelegramId))}`,
          )
        : null,
      payerUsername
        ? line(
            "user",
            `${t.username}${sep}<b>@${escapeHtml(payerUsername)}</b>`,
          )
        : null,
      card ? line("card", `${t.card}${sep}${mono(card)}`) : null,
      charge.bankCard?.bankName
        ? line(
            "bank",
            `${t.bank}${sep}<b>${escapeHtml(charge.bankCard.bankName)}</b>`,
          )
        : null,
      charge.bankCard?.ownerName
        ? line(
            "owner",
            `${t.cardOwner}${sep}${escapeHtml(charge.bankCard.ownerName)}`,
          )
        : null,
      "",
      line(
        "clock",
        `${t.paidAt}${sep}${mono(
          formatDateTime(charge.paidAt ?? new Date(), locale),
        )}`,
      ),
    ].filter((row): row is string => row !== null);

    try {
      await sendText(shop.reportBotChatId, lines.join("\n"), appOnlyKeyboard(locale));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Owner blocked the bot or deleted the chat — stop sending.
      if (/blocked by the user|chat not found|user is deactivated/i.test(msg)) {
        await prisma.merchantShop.update({
          where: { id: shop.id },
          data: { reportBotEnabled: false },
        });
      }
      throw err;
    }

    log.event("report-bot", `tx ${charge.code} → shop:${shop.id}`);
  } catch (err) {
    log.warn(
      "report-bot",
      `notify fail charge:${chargeId} — ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
}