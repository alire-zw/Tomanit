import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { enforceRateLimit } from "../lib/httpRateLimit.js";
import {
  normalizePayerPhone,
  normalizePayerTelegramId,
} from "../lib/merchantInvoiceApi.js";
import { validateMerchantCallbackUrl } from "../lib/merchantInvoiceCallback.js";
import {
  allocatePayToken,
  formatInvoiceCode,
  parseInvoiceCode,
  serializePaymentLink,
} from "../lib/merchantPaymentLink.js";
import { createHttpRateLimiter } from "../lib/rateLimit.js";
import { requireShopApiKey } from "../lib/shopApiAuth.js";

const merchantApiLimiter = createHttpRateLimiter({
  name: "merchant-api",
  max: 60,
  windowMs: 60_000,
});

const MIN_AMOUNT_TOMAN = 10_000;
const MIN_EXPIRES_MINUTES = 5;
const MAX_EXPIRES_MINUTES = 25;

const createInvoiceSchema = z.object({
  amountToman: z.coerce
    .number()
    .int()
    .min(MIN_AMOUNT_TOMAN)
    .max(500_000_000),
  /** Optional payer mobile (09xxxxxxxxx). */
  phone: z.string().trim().min(8).max(20).optional().nullable(),
  /** Optional Telegram numeric user id — invoice payable only by this user.
   *  Always coerce via String — never Number() (precision loss on large ids). */
  telegramId: z
    .preprocess(
      (v) => (v == null || v === "" ? null : String(v).trim()),
      z.string().min(1).max(32).nullable().optional(),
    )
    .optional()
    .nullable(),
  /** Required TTL in minutes (5 … 25). */
  expiresInMinutes: z.coerce
    .number()
    .int()
    .min(MIN_EXPIRES_MINUTES)
    .max(MAX_EXPIRES_MINUTES),
  /** Required HTTPS URL — payment status is POSTed here automatically. */
  callbackUrl: z.string().trim().url().max(512),
});

function serializeApiInvoice(link: Parameters<typeof serializePaymentLink>[0]) {
  const base = serializePaymentLink(link);
  return {
    id: base.id,
    code: base.code,
    payToken: base.payToken,
    amountToman: base.amountToman,
    status: base.status,
    phone: base.phone,
    telegramId: base.telegramId,
    callbackUrl: link.callbackUrl ?? null,
    webUrl: base.webUrl,
    miniAppUrl: base.miniAppUrl,
    /** Alias of webUrl for website integrations */
    url: base.webUrl,
    paidAt: base.paidAt,
    expiresAt: base.expiresAt,
    createdAt: base.createdAt,
  };
}

async function findShopInvoice(shopId: number, ref: string) {
  const key = ref.trim();
  if (!key) return null;

  if (/^\d+$/.test(key)) {
    const byToken = await prisma.merchantPaymentLink.findFirst({
      where: { shopId, code: key },
    });
    if (byToken) return byToken;
  }

  const id = parseInvoiceCode(key);
  if (id != null) {
    const byId = await prisma.merchantPaymentLink.findFirst({
      where: { shopId, id },
    });
    if (byId) return byId;
  }

  return null;
}

export async function merchantApiRoutes(app: FastifyInstance): Promise<void> {
  const guard = [enforceRateLimit(merchantApiLimiter)];

  /** Machine-readable OpenAPI (no auth) — for AI / codegen / clients. */
  app.get("/merchant/v1/openapi.json", async (_request, reply) => {
    const { buildMerchantOpenApiDocument } = await import(
      "../lib/merchantOpenApi.js"
    );
    const { env } = await import("../config/env.js");
    const doc = buildMerchantOpenApiDocument({
      apiBaseUrl: env.PUBLIC_URL,
      appBaseUrl: env.MINI_APP_URL || env.PUBLIC_URL,
    });
    return reply
      .header("Content-Type", "application/json; charset=utf-8")
      .header("Cache-Control", "public, max-age=300")
      .header("Access-Control-Allow-Origin", "*")
      .send(doc);
  });

  /**
   * Create a payable invoice (same product as manual invoice, via API).
   * Auth: Authorization: Bearer TomanIt:{shopId}:{token}
   */
  app.post("/merchant/v1/invoices", { preHandler: guard }, async (request, reply) => {
    const shop = await requireShopApiKey(request, reply);
    if (!shop) return;

    const body = createInvoiceSchema.parse(request.body ?? {});

    const callbackUrl = validateMerchantCallbackUrl(body.callbackUrl);
    if (!callbackUrl) {
      return reply.status(400).send({
        error: "callbackUrl must be a valid HTTPS URL",
        code: "invalid_callback_url",
      });
    }

    let payerPhone: string | null = null;
    if (body.phone != null && String(body.phone).trim()) {
      payerPhone = normalizePayerPhone(body.phone);
      if (!payerPhone) {
        return reply.status(400).send({
          error: "Invalid phone number",
          code: "invalid_phone",
        });
      }
    }

    let payerTelegramId: string | null = null;
    if (body.telegramId != null && String(body.telegramId).trim() !== "") {
      payerTelegramId = normalizePayerTelegramId(body.telegramId);
      if (!payerTelegramId) {
        return reply.status(400).send({
          error: "Invalid telegramId",
          code: "invalid_telegram_id",
        });
      }
    }

    const expiresAt = new Date(
      Date.now() + body.expiresInMinutes * 60 * 1000,
    );

    const draft = await prisma.merchantPaymentLink.create({
      data: {
        shopId: shop.id,
        code: `TMP-${Date.now()}`,
        title: "فاکتور",
        amountToman: BigInt(body.amountToman),
        status: "open",
        source: "api",
        payerPhone,
        payerTelegramId,
        callbackUrl,
        expiresAt,
      },
    });

    const invoiceCode = formatInvoiceCode(draft.id);
    const payToken = await allocatePayToken(draft.id);
    const link = await prisma.merchantPaymentLink.update({
      where: { id: draft.id },
      data: { code: payToken, title: invoiceCode },
    });

    return reply.status(201).send({ invoice: serializeApiInvoice(link) });
  });

  /** Invoice status by pay token or TMNIT-/INV-code. */
  app.get(
    "/merchant/v1/invoices/:ref",
    { preHandler: guard },
    async (request, reply) => {
      const shop = await requireShopApiKey(request, reply);
      if (!shop) return;

      const ref = String((request.params as { ref?: string }).ref || "");
      const link = await findShopInvoice(shop.id, ref);
      if (!link) {
        return reply.status(404).send({ error: "Invoice not found", code: "not_found" });
      }

      if (
        link.expiresAt &&
        link.expiresAt.getTime() < Date.now() &&
        link.status === "open"
      ) {
        const expired = await prisma.merchantPaymentLink.update({
          where: { id: link.id },
          data: { status: "expired" },
        });
        return { invoice: serializeApiInvoice(expired) };
      }

      return { invoice: serializeApiInvoice(link) };
    },
  );
}
