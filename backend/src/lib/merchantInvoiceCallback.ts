import type { MerchantPaymentLink } from "@prisma/client";
import { log } from "./log.js";
import {
  formatInvoiceCode,
  paymentLinkMiniAppUrl,
  paymentLinkWebUrl,
} from "./merchantPaymentLink.js";

export type MerchantInvoiceCallbackStatus = "paid" | "failed" | "expired";

function isHttpsCallback(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:";
  } catch {
    return false;
  }
}

export function validateMerchantCallbackUrl(
  input: string | null | undefined,
): string | null {
  if (input == null) return null;
  const url = String(input).trim();
  if (!url || url.length > 512) return null;
  if (!isHttpsCallback(url)) return null;
  return url;
}

/**
 * Fire-and-forget HTTPS POST to merchant callback with invoice payment status.
 */
export async function notifyMerchantInvoiceCallback(options: {
  link: MerchantPaymentLink;
  status: MerchantInvoiceCallbackStatus;
  trackId?: string | null;
  amountToman?: number | null;
}): Promise<void> {
  const callbackUrl = options.link.callbackUrl?.trim();
  if (!callbackUrl) {
    log.info("merchant-callback", {
      skip: "no callbackUrl",
      invoiceId: options.link.id,
      status: options.status,
    });
    return;
  }
  if (!isHttpsCallback(callbackUrl)) {
    log.warn("merchant-callback", {
      skip: "callbackUrl must be HTTPS",
      invoiceId: options.link.id,
      callbackUrl,
    });
    return;
  }

  const invoiceCode = formatInvoiceCode(options.link.id);
  const amount =
    options.amountToman != null && Number.isFinite(options.amountToman)
      ? Number(options.amountToman)
      : Number(options.link.amountToman);

  const body = {
    event:
      options.status === "paid"
        ? "invoice.paid"
        : options.status === "failed"
          ? "invoice.failed"
          : "invoice.expired",
    invoice: {
      id: String(options.link.id),
      code: invoiceCode,
      payToken: options.link.code,
      amountToman: amount,
      status: options.status === "paid" ? "paid" : options.status,
      phone: options.link.payerPhone ?? null,
      telegramId: options.link.payerTelegramId ?? null,
      trackId: options.trackId ?? null,
      paidAt: options.link.paidAt?.toISOString() ?? null,
      expiresAt: options.link.expiresAt?.toISOString() ?? null,
      webUrl: paymentLinkWebUrl(options.link.code),
      miniAppUrl: paymentLinkMiniAppUrl(options.link.code),
    },
  };

  try {
    log.info("merchant-callback", {
      action: "POST",
      event: body.event,
      invoiceCode,
      callbackUrl,
    });
    const res = await fetch(callbackUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": "Tomanit-MerchantCallback/1.0",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) {
      log.warn(
        "merchant-callback",
        `HTTP ${res.status} for invoice ${invoiceCode}`,
      );
    } else {
      log.info("merchant-callback", { ok: true, event: body.event, invoiceCode });
    }
  } catch (err) {
    log.warn(
      "merchant-callback",
      err instanceof Error ? err.message : "callback failed",
    );
  }
}
