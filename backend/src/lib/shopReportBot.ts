import { env } from "../config/env.js";
import { prisma } from "../db/prisma.js";
import { log } from "./log.js";
import { callTelegramApiWithToken } from "./telegramApi.js";
import { getBotUsername } from "./botUsername.js";

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

function formatToman(amount: number, locale: Locale): string {
  const n = Math.max(0, Math.trunc(amount)).toLocaleString("en-US");
  return locale === "fa" ? `${n} تومان` : `${n} toman`;
}

function formatDateTime(date: Date, locale: Locale): string {
  try {
    return new Intl.DateTimeFormat(
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
  } catch {
    return date.toISOString();
  }
}

function formatCard(cardNumber: string | null | undefined): string | null {
  const digits = String(cardNumber || "").replace(/\D/g, "");
  if (!digits) return null;
  return digits.replace(/(\d{4})(?=\d)/g, "$1-");
}

const TEXT = {
  fa: {
    linkedTitle: "🤖 <b>ربات گزارش فعال شد</b>",
    linkedBody: (shop: string) =>
      `از این پس هر تراکنش موفق فروشگاه <b>${shop}</b> با جزئیات کامل در همین‌جا برای شما ارسال می‌شود.`,
    disabledTitle: "⏸ <b>ربات گزارش غیرفعال شد</b>",
    disabledBody: "دیگر گزارش تراکنش‌ها ارسال نمی‌شود. هر زمان خواستید دوباره فعالش کنید.",
    noShop:
      "⚠️ برای این حساب تلگرام فروشگاهی ثبت نشده است.\nابتدا از داخل مینی‌اپ تومنیت فروشگاه خود را بسازید.",
    statusOn: (shop: string) => `✅ گزارش تراکنش‌های <b>${shop}</b> فعال است.`,
    statusOff: (shop: string) => `⏸ گزارش تراکنش‌های <b>${shop}</b> غیرفعال است.`,
    help:
      "دستورات:\n/start — فعال‌سازی گزارش\n/stop — توقف گزارش\n/status — وضعیت",
    btnOff: "غیرفعال‌سازی گزارش",
    btnOn: "فعال‌سازی گزارش",
    btnApp: "باز کردن تومنیت",
    privateOnly: "این ربات فقط در چت خصوصی کار می‌کند.",
    // transaction
    txTitle: "✅ <b>تراکنش موفق</b>",
    shop: "🏪 فروشگاه",
    invoiceAmount: "💰 مبلغ فاکتور",
    fee: "🧾 کارمزد",
    paidTotal: "💳 پرداختی خریدار",
    credited: "🏦 واریز به موجودی",
    balance: "💼 موجودی فعلی",
    title: "📄 عنوان",
    invoiceCode: "🔢 شماره فاکتور",
    orderId: "🏷 شناسه سفارش",
    source: "🌐 منبع",
    sourceManual: "دستی",
    sourceApi: "وب‌سرویس",
    payer: "👤 پرداخت‌کننده",
    payerId: "🆔 آیدی تلگرام",
    phone: "📱 موبایل",
    card: "💳 کارت",
    cardOwner: "🪪 صاحب کارت",
    trackId: "🔎 کد پیگیری",
    txId: "🧷 شناسه تراکنش",
    paidAt: "🕒 زمان پرداخت",
    feeBearer: {
      payer: "پرداخت‌کننده",
      merchant: "فروشنده",
      split: "تقسیم",
    } as Record<string, string>,
    payerSection: "<b>اطلاعات پرداخت‌کننده</b>",
    invoiceSection: "<b>اطلاعات فاکتور</b>",
    amountSection: "<b>مبالغ</b>",
  },
  en: {
    linkedTitle: "🤖 <b>Report bot activated</b>",
    linkedBody: (shop: string) =>
      `From now on every successful transaction of <b>${shop}</b> will be sent here with full details.`,
    disabledTitle: "⏸ <b>Report bot disabled</b>",
    disabledBody: "Transaction reports are paused. You can enable them again anytime.",
    noShop:
      "⚠️ No shop is registered for this Telegram account.\nCreate your shop in the Tomanit mini app first.",
    statusOn: (shop: string) => `✅ Reports for <b>${shop}</b> are enabled.`,
    statusOff: (shop: string) => `⏸ Reports for <b>${shop}</b> are disabled.`,
    help: "Commands:\n/start — enable reports\n/stop — pause reports\n/status — status",
    btnOff: "Disable reports",
    btnOn: "Enable reports",
    btnApp: "Open Tomanit",
    privateOnly: "This bot only works in private chats.",
    txTitle: "✅ <b>Successful payment</b>",
    shop: "🏪 Shop",
    invoiceAmount: "💰 Invoice amount",
    fee: "🧾 Fee",
    paidTotal: "💳 Paid by customer",
    credited: "🏦 Credited to balance",
    balance: "💼 Current balance",
    title: "📄 Title",
    invoiceCode: "🔢 Invoice #",
    orderId: "🏷 Order ID",
    source: "🌐 Source",
    sourceManual: "Manual",
    sourceApi: "Web service",
    payer: "👤 Payer",
    payerId: "🆔 Telegram ID",
    phone: "📱 Phone",
    card: "💳 Card",
    cardOwner: "🪪 Card owner",
    trackId: "🔎 Track ID",
    txId: "🧷 Transaction ID",
    paidAt: "🕒 Paid at",
    feeBearer: {
      payer: "payer",
      merchant: "merchant",
      split: "split",
    } as Record<string, string>,
    payerSection: "<b>Payer</b>",
    invoiceSection: "<b>Invoice</b>",
    amountSection: "<b>Amounts</b>",
  },
} as const;

function mainAppUrl(): string {
  const username = getBotUsername();
  if (username) {
    const short = env.TELEGRAM_MINI_APP_SHORT_NAME?.trim();
    return short
      ? `https://t.me/${username}/${encodeURIComponent(short)}?startapp=shop`
      : `https://t.me/${username}?startapp=shop`;
  }
  return env.MINI_APP_URL;
}

function toggleKeyboard(locale: Locale, enabled: boolean) {
  const t = TEXT[locale];
  return {
    inline_keyboard: [
      [
        enabled
          ? { text: t.btnOff, callback_data: "rb:off" }
          : { text: t.btnOn, callback_data: "rb:on" },
      ],
      [{ text: t.btnApp, url: mainAppUrl() }],
    ],
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
    await sendText(message.chat.id, t.noShop, {
      inline_keyboard: [[{ text: t.btnApp, url: mainAppUrl() }]],
    });
    return;
  }

  const shopName = escapeHtml(owner.merchantShop.name);

  if (cmd === "/start") {
    await setEnabled(from.id, message.chat.id, true);
    await sendText(
      message.chat.id,
      `${t.linkedTitle}\n\n${t.linkedBody(shopName)}`,
      toggleKeyboard(locale, true),
    );
    return;
  }

  if (cmd === "/stop") {
    await setEnabled(from.id, message.chat.id, false);
    await sendText(
      message.chat.id,
      `${t.disabledTitle}\n\n${t.disabledBody}`,
      toggleKeyboard(locale, false),
    );
    return;
  }

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
  const chatId = cb.message?.chat.id ?? cb.from.id;
  if (data !== "rb:on" && data !== "rb:off") {
    await callReportApi("answerCallbackQuery", { callback_query_id: cb.id });
    return;
  }

  const enable = data === "rb:on";
  const result = await setEnabled(cb.from.id, chatId, enable);
  await callReportApi("answerCallbackQuery", { callback_query_id: cb.id });
  if (!result) return;

  const t = TEXT[result.locale];
  const shopName = escapeHtml(result.shopName);
  const text = enable
    ? `${t.linkedTitle}\n\n${t.linkedBody(shopName)}`
    : `${t.disabledTitle}\n\n${t.disabledBody}`;

  if (cb.message?.message_id) {
    try {
      await callReportApi("editMessageText", {
        chat_id: chatId,
        message_id: cb.message.message_id,
        text,
        parse_mode: "HTML",
        link_preview_options: { is_disabled: true },
        reply_markup: toggleKeyboard(result.locale, enable),
      });
      return;
    } catch {
      // fall through to a fresh message
    }
  }
  await sendText(chatId, text, toggleKeyboard(result.locale, enable));
}

async function handleUpdate(update: ReportBotUpdate): Promise<void> {
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
          { command: "start", description: "فعال‌سازی گزارش تراکنش‌ها" },
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
                balanceToman: true,
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

    const payerName = [charge.user?.firstName, charge.user?.lastName]
      .filter(Boolean)
      .join(" ")
      .trim();
    const payerUsername = charge.user?.username?.trim();
    const payerLabel =
      [payerName, payerUsername ? `@${payerUsername}` : ""]
        .filter(Boolean)
        .join(" · ") || "—";
    const payerTelegramId = link.payerTelegramId || charge.user?.telegramId || null;
    const card = formatCard(charge.bankCard?.cardNumber);
    const cardLine = card
      ? `<code>${card}</code>${
          charge.bankCard?.bankName
            ? ` · ${escapeHtml(charge.bankCard.bankName)}`
            : ""
        }`
      : null;

    const row = (label: string, value: string | null | undefined) =>
      value ? `${label}: ${value}` : null;

    const lines = [
      `${t.txTitle} · <b>${escapeHtml(shop.name)}</b>`,
      "",
      t.amountSection,
      row(t.invoiceAmount, `<b>${formatToman(invoiceAmount, locale)}</b>`),
      row(t.fee, `${formatToman(fee, locale)} (${escapeHtml(bearer)})`),
      row(t.paidTotal, formatToman(paidTotal, locale)),
      row(t.credited, `<b>${formatToman(credited, locale)}</b>`),
      row(t.balance, formatToman(Number(shop.balanceToman), locale)),
      "",
      t.invoiceSection,
      row(t.title, escapeHtml(link.title)),
      row(t.invoiceCode, `<code>${escapeHtml(link.code)}</code>`),
      row(t.orderId, link.orderId ? `<code>${escapeHtml(link.orderId)}</code>` : null),
      row(t.source, link.source === "api" ? t.sourceApi : t.sourceManual),
      "",
      t.payerSection,
      row(t.payer, escapeHtml(payerLabel)),
      row(t.payerId, payerTelegramId ? `<code>${escapeHtml(payerTelegramId)}</code>` : null),
      row(t.phone, link.payerPhone ? `<code>${escapeHtml(link.payerPhone)}</code>` : null),
      row(t.card, cardLine),
      row(
        t.cardOwner,
        charge.bankCard?.ownerName ? escapeHtml(charge.bankCard.ownerName) : null,
      ),
      "",
      row(t.trackId, charge.trackId ? `<code>${escapeHtml(charge.trackId)}</code>` : null),
      row(t.txId, `<code>${escapeHtml(charge.code)}</code>`),
      row(t.paidAt, formatDateTime(charge.paidAt ?? new Date(), locale)),
    ].filter((line): line is string => line !== null);

    try {
      await sendText(shop.reportBotChatId, lines.join("\n"), {
        inline_keyboard: [[{ text: t.btnApp, url: mainAppUrl() }]],
      });
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