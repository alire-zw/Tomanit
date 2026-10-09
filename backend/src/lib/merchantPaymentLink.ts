import { randomInt } from "node:crypto";
import type { MerchantPaymentLink } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import { env } from "../config/env.js";
import { getBotUsername } from "./botUsername.js";
import { log } from "./log.js";

const CODE_BASE = 100_000;

/** Public invoice id: TMNIT-100001 for id=1, … */
export function formatInvoiceCode(id: number): string {
  return `TMNIT-${CODE_BASE + id}`;
}

/** Public gateway-charge id: TMNIT-P100001 for id=1, … */
export function formatChargeCode(id: number): string {
  return `TMNIT-P${CODE_BASE + id}`;
}

/** Parse TMNIT-100001 or legacy INV-100001 → link id. */
export function parseInvoiceCode(ref: string): number | null {
  const m = /^(?:TMNIT|INV)-(\d+)$/i.exec(ref.trim());
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return null;
  const id = n - CODE_BASE;
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** Parse TMNIT-P100001 → charge id. */
export function parseChargeCode(ref: string): number | null {
  const m = /^TMNIT-P(\d+)$/i.exec(ref.trim());
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return null;
  const id = n - CODE_BASE;
  return Number.isInteger(id) && id > 0 ? id : null;
}

function isLegacyInvoiceTitle(title: string | null | undefined, invoiceCode: string): boolean {
  if (!title) return true;
  if (title === invoiceCode) return true;
  return /^INV-\d+$/i.test(title);
}

/**
 * Numeric pay token tied to invoice id, e.g. id=1 → "100001482391".
 * Used only in /pay/{token} URLs — not shown as the public invoice id.
 */
export function generatePayToken(invoiceId: number): string {
  const prefix = String(CODE_BASE + invoiceId);
  const suffix = String(randomInt(100000, 1000000)); // 6 digits
  return `${prefix}${suffix}`;
}

/** Allocate a unique pay token for this invoice (retries on rare collisions). */
export async function allocatePayToken(invoiceId: number): Promise<string> {
  for (let attempt = 0; attempt < 16; attempt++) {
    const token = generatePayToken(invoiceId);
    const exists = await prisma.merchantPaymentLink.findUnique({
      where: { code: token },
      select: { id: true },
    });
    if (!exists) return token;
  }
  return `${CODE_BASE + invoiceId}${Date.now().toString().slice(-8)}`;
}

/** Temporary unique code while inserting a gateway charge row. */
export function tempChargeCode(): string {
  return `TMP-${Date.now()}-${randomInt(100000, 999999)}`;
}

/** Assign final public charge code after insert (TMNIT-P…). */
export async function finalizeChargeCode(chargeId: number): Promise<string> {
  const code = formatChargeCode(chargeId);
  await prisma.gatewayCharge.update({
    where: { id: chargeId },
    data: { code },
  });
  return code;
}

/** startapp payload — Telegram allows [A-Za-z0-9_-] only, max 512. */
export function invoiceStartParam(payToken: string): string {
  return `inv_${payToken}`;
}

/** HTTPS link for websites / browsers — opens Mini App SPA via /pay → /p. */
export function paymentLinkWebUrl(payToken: string): string {
  const base = env.MINI_APP_URL.replace(/\/+$/, "");
  return `${base}/pay/${encodeURIComponent(payToken)}`;
}

/** Telegram Direct Mini App deep link (t.me/…?startapp=…). */
export function paymentLinkMiniAppUrl(payToken: string): string | null {
  const startapp = invoiceStartParam(payToken);
  const username = getBotUsername();
  if (!username) return null;
  const short = env.TELEGRAM_MINI_APP_SHORT_NAME;
  const path = short
    ? `https://t.me/${username}/${encodeURIComponent(short)}`
    : `https://t.me/${username}`;
  return `${path}?startapp=${encodeURIComponent(startapp)}`;
}

/**
 * Prefer Telegram Mini App link for in-app sharing; fallback to web URL.
 * @deprecated Prefer webUrl / miniAppUrl fields.
 */
export function paymentLinkPublicUrl(payToken: string): string {
  return paymentLinkMiniAppUrl(payToken) ?? paymentLinkWebUrl(payToken);
}

export function serializePaymentLink(link: MerchantPaymentLink) {
  const invoiceCode = formatInvoiceCode(link.id);
  const webUrl = paymentLinkWebUrl(link.code);
  const miniAppUrl = paymentLinkMiniAppUrl(link.code);
  return {
    id: String(link.id),
    /** Stable invoice id shown in UI (TMNIT-100001). */
    code: invoiceCode,
    /** Current numeric pay-link token (changes on revoke). */
    payToken: link.code,
    title: isLegacyInvoiceTitle(link.title, invoiceCode) ? invoiceCode : link.title,
    amountToman: Number(link.amountToman),
    status: link.status,
    orderId: link.orderId ?? null,
    phone: link.payerPhone ?? null,
    telegramId: link.payerTelegramId ?? null,
    paidAt: link.paidAt?.toISOString() ?? null,
    expiresAt: link.expiresAt?.toISOString() ?? null,
    createdAt: link.createdAt.toISOString(),
    updatedAt: link.updatedAt.toISOString(),
    /** Website / browser payment link */
    webUrl,
    /** Telegram Mini App deep link (null if bot username unknown) */
    miniAppUrl,
    /** Primary share URL (Mini App when available, else web) */
    url: miniAppUrl ?? webUrl,
  };
}

/** Rewrite legacy cuid charge codes + INV-* invoice titles to TMNIT format. */
export async function normalizePaymentCodes(): Promise<void> {
  const charges = await prisma.gatewayCharge.findMany({
    select: { id: true, code: true },
    orderBy: { id: "asc" },
  });
  const chargeFixes = charges.filter((c) => c.code !== formatChargeCode(c.id));

  const links = await prisma.merchantPaymentLink.findMany({
    select: { id: true, title: true },
    orderBy: { id: "asc" },
  });
  const linkFixes = links.filter((l) => {
    const inv = formatInvoiceCode(l.id);
    return isLegacyInvoiceTitle(l.title, inv) && l.title !== inv;
  });

  if (chargeFixes.length === 0 && linkFixes.length === 0) return;

  await prisma.$transaction(async (tx) => {
    for (const charge of chargeFixes) {
      await tx.gatewayCharge.update({
        where: { id: charge.id },
        data: { code: `MIG-C-${charge.id}-${Date.now()}` },
      });
    }
    for (const charge of chargeFixes) {
      await tx.gatewayCharge.update({
        where: { id: charge.id },
        data: { code: formatChargeCode(charge.id) },
      });
    }
    for (const link of linkFixes) {
      await tx.merchantPaymentLink.update({
        where: { id: link.id },
        data: { title: formatInvoiceCode(link.id) },
      });
    }
  });

  log.event(
    "shop",
    `normalized ${chargeFixes.length} charge code(s), ${linkFixes.length} invoice title(s)`,
  );
}
