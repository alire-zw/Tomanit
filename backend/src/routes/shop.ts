import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { assertImageData } from "../lib/ticketCode.js";
import { enforceRateLimit } from "../lib/httpRateLimit.js";
import { shopRegisterLimiter } from "../lib/rateLimit.js";
import { invalidateMeCache, patchMeCacheShop } from "../lib/meCache.js";
import {
  allocatePayToken,
  formatInvoiceCode,
  serializePaymentLink,
} from "../lib/merchantPaymentLink.js";
import { notifyMerchantInvoiceCallback } from "../lib/merchantInvoiceCallback.js";
import { parseIdParam } from "../lib/ids.js";
import { ensureShopApiKey, maskShopApiKey } from "../lib/shopApiKey.js";
import { loadUserShopHub, serializeMerchantShop } from "../lib/userBundle.js";
import { parseFeeBearer } from "../lib/merchantPayFee.js";
import {
  computeShopSettlementBalance,
  createShopSettlement,
  isValidIranIban,
  isValidTronAddress,
  listShopSettlements,
  normalizeIranIban,
} from "../lib/merchantSettlement.js";
import { notifyShopSettlementAdmin } from "../lib/bot/notifyShopSettlementAdmin.js";
import { computeShopStatsPage } from "../lib/shopTransactions.js";
import {
  isShopReportBotConfigured,
  resolveShopReportBotUsername,
  shopReportBotLink,
} from "../lib/shopReportBot.js";

const reportBotSchema = z.object({ enabled: z.boolean() });

function serializeReportBot(
  shop: {
    reportBotEnabled: boolean;
    reportBotChatId: string | null;
    reportBotLinkedAt: Date | null;
  },
  username: string | null,
) {
  return {
    available: isShopReportBotConfigured(),
    enabled: shop.reportBotEnabled && Boolean(shop.reportBotChatId),
    linked: Boolean(shop.reportBotChatId),
    linkedAt: shop.reportBotLinkedAt?.toISOString() ?? null,
    botUsername: username,
    startUrl: shopReportBotLink(username),
  };
}

/** Dedupe failed-invoice callbacks from result polling (process lifetime). */
const failedCallbackNotified = new Set<number>();

const INVOICE_THEMES = [
  "teal",
  "orange",
  "blue",
  "violet",
  "rose",
  "amber",
] as const;

function serializePublicMerchantCharge(charge: {
  code: string;
  kind: string;
  amountToman: bigint;
  invoiceAmountToman: bigint | null;
  feeToman: bigint;
  status: string;
  paymentUrl: string | null;
  trackId: string | null;
  paidAt: Date | null;
  createdAt: Date;
  gateway: { displayName: string };
  merchantPaymentLink: {
    id: number;
    shop: {
      name: string;
      logoData: string | null;
      sellType: "goods" | "services";
      channel: "website" | "bot" | "manual";
      siteUrl: string | null;
      botUrl: string | null;
      invoiceTheme: string;
      feeBearer: string;
    } | null;
  } | null;
}) {
  const shop = charge.merchantPaymentLink?.shop ?? null;
  return {
    code: charge.code,
    kind: charge.kind,
    amountToman: charge.amountToman.toString(),
    invoiceAmountToman: charge.invoiceAmountToman?.toString() ?? null,
    feeToman: charge.feeToman.toString(),
    status: charge.status,
    paymentUrl: charge.paymentUrl,
    trackId: charge.trackId,
    paidAt: charge.paidAt?.toISOString() ?? null,
    createdAt: charge.createdAt.toISOString(),
    gatewayName: charge.gateway.displayName,
    shopName: shop?.name ?? null,
    shopLogoDataUrl: shop?.logoData ?? null,
    shopSellType: shop?.sellType ?? null,
    shopChannel: shop?.channel ?? null,
    shopSiteUrl: shop?.siteUrl ?? null,
    shopBotUrl: shop?.botUrl ?? null,
    invoiceTheme: shop?.invoiceTheme || "teal",
    feeBearer: parseFeeBearer(shop?.feeBearer),
    invoiceCode: charge.merchantPaymentLink
      ? formatInvoiceCode(charge.merchantPaymentLink.id)
      : null,
  };
}

const merchantChargeInclude = {
  gateway: { select: { displayName: true } },
  merchantPaymentLink: {
    include: {
      shop: {
        select: {
          name: true,
          logoData: true,
          sellType: true,
          channel: true,
          siteUrl: true,
          botUrl: true,
          invoiceTheme: true,
          feeBearer: true,
        },
      },
    },
  },
} as const;

const shopSettingsSchema = z.object({
  logoDataUrl: z.string().max(900_000).optional().nullable(),
  invoiceTheme: z.enum(INVOICE_THEMES).optional(),
  feeBearer: z.enum(["payer", "merchant", "split"]).optional(),
});

const registerSchema = z.object({
  name: z.string().trim().min(2).max(128),
  sellType: z.enum(["goods", "services"]),
  dailyAmountToman: z.coerce.number().int().min(0).max(10_000_000_000),
  dailyCount: z.coerce.number().int().min(0).max(1_000_000),
  channel: z.enum(["website", "bot", "manual"]),
  siteUrl: z.string().trim().max(512).optional().nullable(),
  botUrl: z.string().trim().max(512).optional().nullable(),
  logoDataUrl: z.string().max(900_000).optional().nullable(),
});

const createPaymentLinkSchema = z.object({
  amountToman: z.coerce.number().int().min(10_000).max(500_000_000),
});

const createSettlementSchema = z
  .object({
    method: z.enum(["rial", "trx"]),
    // TODO: restore to 700_000 after testing
    amountToman: z.coerce.number().int().min(10_000).max(500_000_000),
    iban: z.string().trim().max(40).optional(),
    trxDestination: z.enum(["in_app", "external"]).optional(),
    trxAddress: z.string().trim().max(128).optional(),
  })
  .superRefine((body, ctx) => {
    if (body.method === "rial") {
      const iban = body.iban ?? "";
      if (!isValidIranIban(iban)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "شماره شبا معتبر نیست",
          path: ["iban"],
        });
      }
    }
    if (body.method === "trx") {
      if (!body.trxDestination) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "مقصد ترون را انتخاب کنید",
          path: ["trxDestination"],
        });
      }
      if (body.trxDestination === "external") {
        const addr = body.trxAddress ?? "";
        if (!isValidTronAddress(addr)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "آدرس ولت TRON معتبر نیست",
            path: ["trxAddress"],
          });
        }
      }
    }
  });

export async function shopRoutes(app: FastifyInstance): Promise<void> {
  /** Merchant hub: shop + live balance/stats/recent txs (always fresh). */
  app.get("/shop", { preHandler: requireAuth }, async (request) => {
    const user = request.user!;
    const hub = await loadUserShopHub(user.id);
    await patchMeCacheShop(user.telegramId, hub);
    return { ...hub, cached: false };
  });

  /** Full shop analytics for stats page. */
  app.get("/shop/stats", { preHandler: requireAuth }, async (request, reply) => {
    const shop = await prisma.merchantShop.findUnique({
      where: { userId: request.user!.id },
    });
    if (!shop) {
      return reply.status(404).send({ error: "فروشگاهی ثبت نشده است" });
    }
    const [stats, settlement] = await Promise.all([
      computeShopStatsPage(shop.id),
      computeShopSettlementBalance(shop.id),
    ]);
    return {
      shop: serializeMerchantShop(shop),
      stats,
      balance: {
        availableToman: settlement.availableToman,
        pendingToman: settlement.pendingToman,
        totalSettledToman: settlement.totalSettledToman,
        nextUnlockAt: settlement.nextUnlockAt?.toISOString() ?? null,
      },
    };
  });

  /** Report bot status + activation deep link. */
  app.get("/shop/report-bot", { preHandler: requireAuth }, async (request, reply) => {
    const shop = await prisma.merchantShop.findUnique({
      where: { userId: request.user!.id },
      select: {
        reportBotEnabled: true,
        reportBotChatId: true,
        reportBotLinkedAt: true,
      },
    });
    if (!shop) {
      return reply.status(404).send({ error: "فروشگاهی ثبت نشده است" });
    }
    return serializeReportBot(shop, await resolveShopReportBotUsername());
  });

  /** Enable / disable report bot (enable requires a linked chat). */
  app.patch("/shop/report-bot", { preHandler: requireAuth }, async (request, reply) => {
    const body = reportBotSchema.parse(request.body ?? {});
    const shop = await prisma.merchantShop.findUnique({
      where: { userId: request.user!.id },
      select: { id: true, reportBotChatId: true },
    });
    if (!shop) {
      return reply.status(404).send({ error: "فروشگاهی ثبت نشده است" });
    }
    if (body.enabled && !shop.reportBotChatId) {
      return reply
        .status(409)
        .send({ error: "ابتدا ربات گزارش را در تلگرام استارت کنید" });
    }
    const updated = await prisma.merchantShop.update({
      where: { id: shop.id },
      data: { reportBotEnabled: body.enabled },
      select: {
        reportBotEnabled: true,
        reportBotChatId: true,
        reportBotLinkedAt: true,
      },
    });
    return serializeReportBot(updated, await resolveShopReportBotUsername());
  });

  /** Gateway settings: logo, invoice theme, fee bearer. */
  app.patch("/shop/settings", { preHandler: requireAuth }, async (request, reply) => {
    const body = shopSettingsSchema.parse(request.body ?? {});
    if (
      body.logoDataUrl === undefined &&
      body.invoiceTheme === undefined &&
      body.feeBearer === undefined
    ) {
      return reply.status(400).send({ error: "هیچ تغییری ارسال نشده است" });
    }

    const shop = await prisma.merchantShop.findUnique({
      where: { userId: request.user!.id },
    });
    if (!shop) {
      return reply.status(404).send({ error: "فروشگاهی ثبت نشده است" });
    }
    if (shop.status !== "active") {
      return reply.status(403).send({ error: "فروشگاه باید فعال باشد" });
    }

    const data: {
      logoData?: string | null;
      invoiceTheme?: string;
      feeBearer?: string;
    } = {};
    if (body.logoDataUrl !== undefined) {
      data.logoData = assertImageData(body.logoDataUrl);
    }
    if (body.invoiceTheme !== undefined) {
      data.invoiceTheme = body.invoiceTheme;
    }
    if (body.feeBearer !== undefined) {
      data.feeBearer = body.feeBearer;
    }

    const updated = await prisma.merchantShop.update({
      where: { id: shop.id },
      data,
    });
    await invalidateMeCache(request.user!.telegramId);
    return { shop: serializeMerchantShop(updated) };
  });

  app.post(
    "/shop",
    { preHandler: [enforceRateLimit(shopRegisterLimiter), requireAuth] },
    async (request, reply) => {
      const body = registerSchema.parse(request.body);
      const userId = request.user!.id;

      if (body.channel === "website") {
        const url = (body.siteUrl ?? "").trim();
        if (url.length < 4) {
          return reply.status(400).send({ error: "آدرس سایت الزامی است" });
        }
      }
      if (body.channel === "bot") {
        const url = (body.botUrl ?? "").trim();
        if (url.length < 3) {
          return reply.status(400).send({ error: "آدرس ربات الزامی است" });
        }
      }

      const logoData = assertImageData(body.logoDataUrl ?? null);

      const existing = await prisma.merchantShop.findUnique({
        where: { userId },
      });

      if (existing && (existing.status === "active" || existing.status === "suspended")) {
        return reply.status(409).send({
          error: "فروشگاه شما از قبل ثبت شده است",
        });
      }

      if (existing?.status === "pending") {
        return reply.status(409).send({
          error: "درخواست فروشگاه در انتظار بررسی است",
        });
      }

      const data = {
        name: body.name,
        sellType: body.sellType,
        dailyAmountToman: BigInt(body.dailyAmountToman),
        dailyCount: body.dailyCount,
        channel: body.channel,
        siteUrl: body.channel === "website" ? (body.siteUrl ?? "").trim() || null : null,
        botUrl: body.channel === "bot" ? (body.botUrl ?? "").trim() || null : null,
        logoData,
        status: "pending" as const,
        reviewNote: null,
        reviewedAt: null,
        reviewedById: null,
      };

      let shop = existing
        ? await prisma.merchantShop.update({
            where: { userId },
            data,
          })
        : await prisma.merchantShop.create({
            data: { userId, ...data },
          });

      if (!shop.apiKey?.startsWith("TomanIt:")) {
        shop = await ensureShopApiKey(shop);
      }

      await invalidateMeCache(request.user!.telegramId);

      return reply.status(existing ? 200 : 201).send({ shop: serializeMerchantShop(shop) });
    },
  );

  /** Merchant shop ledger — all invoices (manual + API), any status. */
  app.get("/shop/transactions", { preHandler: requireAuth }, async (request, reply) => {
    const shop = await prisma.merchantShop.findUnique({
      where: { userId: request.user!.id },
    });
    if (!shop) {
      return reply.status(404).send({ error: "فروشگاهی ثبت نشده است" });
    }
    if (shop.status !== "active") {
      return reply.status(403).send({ error: "فروشگاه باید فعال باشد" });
    }

    const { listShopLedger } = await import("../lib/shopTransactions.js");
    const transactions = await listShopLedger(shop.id, { take: 200 });
    return { transactions };
  });

  /** Single invoice / transaction detail. */
  app.get(
    "/shop/transactions/:id",
    { preHandler: requireAuth },
    async (request, reply) => {
      const shop = await prisma.merchantShop.findUnique({
        where: { userId: request.user!.id },
      });
      if (!shop) {
        return reply.status(404).send({ error: "فروشگاهی ثبت نشده است" });
      }
      if (shop.status !== "active") {
        return reply.status(403).send({ error: "فروشگاه باید فعال باشد" });
      }

      const id = Number((request.params as { id?: string }).id);
      if (!Number.isFinite(id) || id <= 0) {
        return reply.status(400).send({ error: "شناسه نامعتبر است" });
      }

      const { getShopLedgerItem } = await import("../lib/shopTransactions.js");
      const transaction = await getShopLedgerItem(shop.id, id);
      if (!transaction) {
        return reply.status(404).send({ error: "تراکنش یافت نشد" });
      }
      return { transaction };
    },
  );

  /** Fixed shop API key (created once, never rotated here). */
  app.get("/shop/api-key", { preHandler: requireAuth }, async (request, reply) => {
    const shop = await prisma.merchantShop.findUnique({
      where: { userId: request.user!.id },
    });
    if (!shop) {
      return reply.status(404).send({ error: "فروشگاهی ثبت نشده است" });
    }

    const withKey = await ensureShopApiKey(shop);
    return {
      apiKey: withKey.apiKey!,
      masked: maskShopApiKey(withKey.apiKey!),
      shopId: String(withKey.id),
      status: withKey.status,
    };
  });

  /** Manual payment links (no merchant web-service required). */
  app.get("/shop/payment-links", { preHandler: requireAuth }, async (request, reply) => {
    const shop = await prisma.merchantShop.findUnique({
      where: { userId: request.user!.id },
    });
    if (!shop) {
      return reply.status(404).send({ error: "فروشگاهی ثبت نشده است" });
    }
    if (shop.status !== "active") {
      return reply.status(403).send({ error: "فروشگاه باید فعال باشد" });
    }

    const links = await prisma.merchantPaymentLink.findMany({
      where: { shopId: shop.id, source: "manual" },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return { links: links.map(serializePaymentLink) };
  });

  app.post("/shop/payment-links", { preHandler: requireAuth }, async (request, reply) => {
    const body = createPaymentLinkSchema.parse(request.body);
    const shop = await prisma.merchantShop.findUnique({
      where: { userId: request.user!.id },
    });
    if (!shop) {
      return reply.status(404).send({ error: "فروشگاهی ثبت نشده است" });
    }
    if (shop.status !== "active") {
      return reply.status(403).send({ error: "فروشگاه باید فعال باشد" });
    }

    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    const draft = await prisma.merchantPaymentLink.create({
      data: {
        shopId: shop.id,
        code: `TMP-${Date.now()}`,
        title: "فاکتور",
        amountToman: BigInt(body.amountToman),
        status: "open",
        source: "manual",
        expiresAt,
      },
    });

    const invoiceCode = formatInvoiceCode(draft.id);
    const payToken = await allocatePayToken(draft.id);
    const link = await prisma.merchantPaymentLink.update({
      where: { id: draft.id },
      data: { code: payToken, title: invoiceCode },
    });

    return reply.status(201).send({ link: serializePaymentLink(link) });
  });

  app.post(
    "/shop/payment-links/:id/revoke",
    { preHandler: requireAuth },
    async (request, reply) => {
      const id = parseIdParam((request.params as { id?: string }).id);
      if (id == null) {
        return reply.status(400).send({ error: "Invalid id" });
      }
      const shop = await prisma.merchantShop.findUnique({
        where: { userId: request.user!.id },
      });
      if (!shop) {
        return reply.status(404).send({ error: "فروشگاهی ثبت نشده است" });
      }
      const link = await prisma.merchantPaymentLink.findFirst({
        where: { id, shopId: shop.id, source: "manual" },
      });
      if (!link) {
        return reply.status(404).send({ error: "فاکتور یافت نشد" });
      }
      if (link.status === "paid") {
        return reply.status(409).send({ error: "فاکتور پرداخت‌شده قابل لغو نیست" });
      }
      if (link.status !== "open") {
        return reply.status(409).send({ error: "فقط لینک فاکتور باز قابل تجدید است" });
      }
      /** Invalidate old /pay/… URL; invoice TMNIT-* stays. Status remains open. */
      const payToken = await allocatePayToken(link.id);
      const updated = await prisma.merchantPaymentLink.update({
        where: { id },
        data: { code: payToken },
      });
      return { link: serializePaymentLink(updated) };
    },
  );

  app.delete(
    "/shop/payment-links/:id",
    { preHandler: requireAuth },
    async (request, reply) => {
      const id = parseIdParam((request.params as { id?: string }).id);
      if (id == null) {
        return reply.status(400).send({ error: "Invalid id" });
      }
      const shop = await prisma.merchantShop.findUnique({
        where: { userId: request.user!.id },
      });
      if (!shop) {
        return reply.status(404).send({ error: "فروشگاهی ثبت نشده است" });
      }
      const link = await prisma.merchantPaymentLink.findFirst({
        where: { id, shopId: shop.id, source: "manual" },
      });
      if (!link) {
        return reply.status(404).send({ error: "فاکتور یافت نشد" });
      }
      if (link.status === "paid") {
        return reply.status(409).send({ error: "فاکتور پرداخت‌شده قابل حذف نیست" });
      }
      await prisma.merchantPaymentLink.delete({ where: { id } });
      return { ok: true };
    },
  );

  /** Public lookup for a manual payment link (payer opens this). */
  app.get("/public/merchant-pay/:code", async (request, reply) => {
    const code = String((request.params as { code?: string }).code || "").trim();
    if (!code) {
      return reply.status(400).send({ error: "Invalid code" });
    }
    const link = await prisma.merchantPaymentLink.findUnique({
      where: { code },
      include: {
        shop: {
          select: {
            name: true,
            logoData: true,
            status: true,
            sellType: true,
            channel: true,
            siteUrl: true,
            botUrl: true,
            invoiceTheme: true,
            feeBearer: true,
          },
        },
      },
    });
    if (!link || link.shop.status !== "active" || link.status === "cancelled") {
      return reply.status(404).send({ error: "فاکتور یافت نشد" });
    }
    if (link.expiresAt && link.expiresAt.getTime() < Date.now() && link.status === "open") {
      await prisma.merchantPaymentLink.update({
        where: { id: link.id },
        data: { status: "expired" },
      });
      link.status = "expired";
    }

    /** Latest gateway charge for this invoice (prefer completed) — for result redirect. */
    const completedCharge = await prisma.gatewayCharge.findFirst({
      where: {
        merchantPaymentLinkId: link.id,
        kind: "merchant_invoice",
        status: "completed",
      },
      orderBy: { paidAt: "desc" },
      select: { code: true },
    });
    const latestCharge =
      completedCharge ??
      (await prisma.gatewayCharge.findFirst({
        where: {
          merchantPaymentLinkId: link.id,
          kind: "merchant_invoice",
        },
        orderBy: { createdAt: "desc" },
        select: { code: true },
      }));
    const chargeCode = latestCharge?.code ?? null;

    return {
      link: {
        ...serializePaymentLink(link),
        shopName: link.shop.name,
        shopLogoDataUrl: link.shop.logoData,
        shopSellType: link.shop.sellType,
        shopChannel: link.shop.channel,
        shopSiteUrl: link.shop.siteUrl,
        shopBotUrl: link.shop.botUrl,
        invoiceTheme: link.shop.invoiceTheme || "teal",
        feeBearer: parseFeeBearer(link.shop.feeBearer),
        /** When set, only this Telegram user may pay. */
        payerTelegramId: link.payerTelegramId ?? null,
        chargeCode,
      },
    };
  });

  /**
   * Public merchant invoice result — by gateway charge code or pay token.
   * No auth / no payer ownership (invoice status is shareable after payment).
   */
  app.get("/public/merchant-pay-result/:code", async (request, reply) => {
    const code = String((request.params as { code?: string }).code || "").trim();
    if (!code) {
      return reply.status(400).send({ error: "Invalid code" });
    }

    let charge = await prisma.gatewayCharge.findFirst({
      where: { code, kind: "merchant_invoice" },
      include: merchantChargeInclude,
    });

    if (!charge && /^\d{6,24}$/.test(code)) {
      const link = await prisma.merchantPaymentLink.findUnique({
        where: { code },
        select: { id: true },
      });
      if (link) {
        charge =
          (await prisma.gatewayCharge.findFirst({
            where: {
              merchantPaymentLinkId: link.id,
              kind: "merchant_invoice",
              status: "completed",
            },
            orderBy: { paidAt: "desc" },
            include: merchantChargeInclude,
          })) ??
          (await prisma.gatewayCharge.findFirst({
            where: {
              merchantPaymentLinkId: link.id,
              kind: "merchant_invoice",
            },
            orderBy: { createdAt: "desc" },
            include: merchantChargeInclude,
          }));
      }
    }

    if (!charge) {
      return reply.status(404).send({ error: "Not found" });
    }

    // Safety net: only notify failure after the charge has stayed failed a while
    // (avoids racing a verify that completes a few seconds later).
    const failedAgeMs = Date.now() - new Date(charge.updatedAt).getTime();
    if (
      charge.status === "failed" &&
      failedAgeMs >= 15_000 &&
      charge.merchantPaymentLink?.callbackUrl &&
      !failedCallbackNotified.has(charge.id)
    ) {
      failedCallbackNotified.add(charge.id);
      void notifyMerchantInvoiceCallback({
        link: charge.merchantPaymentLink,
        status: "failed",
        trackId: charge.trackId,
        amountToman: Number(
          charge.invoiceAmountToman ?? charge.merchantPaymentLink.amountToman,
        ),
      });
    }

    return { charge: serializePublicMerchantCharge(charge) };
  });

  app.get("/shop/settlements", { preHandler: requireAuth }, async (request, reply) => {
    const shop = await prisma.merchantShop.findUnique({
      where: { userId: request.user!.id },
    });
    if (!shop) {
      return reply.status(404).send({ error: "فروشگاهی ثبت نشده است" });
    }
    const settlements = await listShopSettlements(shop.id);
    return { settlements };
  });

  app.post("/shop/settlements", { preHandler: requireAuth }, async (request, reply) => {
    const body = createSettlementSchema.parse(request.body ?? {});
    const shop = await prisma.merchantShop.findUnique({
      where: { userId: request.user!.id },
    });
    if (!shop) {
      return reply.status(404).send({ error: "فروشگاهی ثبت نشده است" });
    }
    if (shop.status !== "active") {
      return reply.status(403).send({ error: "فروشگاه باید فعال باشد" });
    }

    try {
      const settlement = await createShopSettlement({
        shopId: shop.id,
        method: body.method,
        amountToman: body.amountToman,
        iban:
          body.method === "rial"
            ? normalizeIranIban(body.iban ?? "")
            : null,
        trxDestination: body.method === "trx" ? body.trxDestination! : null,
        trxAddress:
          body.method === "trx" && body.trxDestination === "external"
            ? body.trxAddress!.trim()
            : null,
      });
      await invalidateMeCache(request.user!.telegramId);

      const user = request.user!;
      void notifyShopSettlementAdmin({
        settlementId: settlement.id,
        amountToman: settlement.amountToman,
        method: settlement.method,
        iban: settlement.iban,
        trxDestination: settlement.trxDestination,
        trxAddress: settlement.trxAddress,
        createdAt: settlement.createdAt,
        shop: { id: shop.id, name: shop.name },
        user: {
          telegramId: user.telegramId,
          username: user.username ?? null,
          firstName: user.firstName ?? null,
          lastName: user.lastName ?? null,
          fullName: user.fullName ?? null,
        },
      });

      return { settlement };
    } catch (err) {
      const statusCode =
        err && typeof err === "object" && "statusCode" in err
          ? Number((err as { statusCode: number }).statusCode)
          : 500;
      const message =
        err instanceof Error ? err.message : "ثبت درخواست تسویه ناموفق بود";
      return reply.status(statusCode >= 400 && statusCode < 600 ? statusCode : 500).send({
        error: message,
      });
    }
  });
}
