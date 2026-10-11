import { randomBytes, timingSafeEqual } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { env } from "../config/env.js";
import { requireAdmin, requireAuth, requireAuthUpsert } from "../middleware/auth.js";
import { sendBotStartToUser } from "../lib/botUpdates.js";
import { parseIdParam } from "../lib/ids.js";
import { log } from "../lib/log.js";
import { gatewayWebhookLimiter } from "../lib/rateLimit.js";
import { clientIp } from "../lib/httpRateLimit.js";
import { recordGatewayChargeFailure } from "../lib/gatewayAlerts.js";
import {
  calcCommissionToman,
  isGatewayDailyFull,
  isGatewayEligibleForCharge,
  pickGatewayForCharge,
  serializeWeekdays,
  gatewayUsageRatio,
} from "../lib/gatewayRouting.js";
import {
  merchantInvoiceFeeToman,
  merchantInvoiceTotalToman,
  parseFeeBearer,
} from "../lib/merchantPayFee.js";
import { notifyMerchantInvoiceCallback } from "../lib/merchantInvoiceCallback.js";
import {
  finalizeChargeCode,
  formatInvoiceCode,
  tempChargeCode,
} from "../lib/merchantPaymentLink.js";
import { finalizeGatewayChargeSuccess } from "../lib/gatewayChargeFinalize.js";
import { redis } from "../db/redis.js";

/** Avoid spamming /start when the same payer re-opens invoices. */
const INVOICE_START_COOLDOWN_SEC = 60 * 60;
const invoiceStartMemory = new Map<string, number>();

async function shouldSendInvoiceStart(telegramId: string): Promise<boolean> {
  const key = `bot:invoice-start:${telegramId}`;
  const now = Date.now();
  try {
    const set = await redis.set(key, "1", "EX", INVOICE_START_COOLDOWN_SEC, "NX");
    return set === "OK";
  } catch {
    const prev = invoiceStartMemory.get(telegramId) ?? 0;
    if (now - prev < INVOICE_START_COOLDOWN_SEC * 1000) return false;
    invoiceStartMemory.set(telegramId, now);
    return true;
  }
}

function generateGatewayApiKey(): string {
  return `tomanit:${randomBytes(32).toString("base64url")}`;
}

type GatewayModel = NonNullable<
  Awaited<ReturnType<typeof prisma.paymentGateway.findFirst>>
>;

function serializeGateway(g: GatewayModel, opts?: { revealKey?: boolean }) {
  const usage = gatewayUsageRatio(g);
  return {
    id: g.id,
    displayName: g.displayName,
    ownerName: g.ownerName,
    backendBaseUrl: g.backendBaseUrl,
    apiKey: opts?.revealKey ? g.apiKey : maskSecret(g.apiKey),
    hasApiKey: Boolean(g.apiKey),
    balanceToman: g.balanceToman.toString(),
    todayCount: g.todayCount,
    yesterdayVolumeToman: g.yesterdayVolumeToman.toString(),
    yesterdayCount: g.yesterdayCount,
    commissionPercent: g.commissionPercent,
    dailyLimitToman: g.dailyLimitToman?.toString() ?? null,
    dailyCountLimit: g.dailyCountLimit,
    minAmountToman: g.minAmountToman,
    maxAmountToman: g.maxAmountToman,
    openHour: g.openHour,
    closeHour: g.closeHour,
    activeWeekdays:
      g.activeWeekdays == null
        ? null
        : g.activeWeekdays.trim() === ""
          ? []
          : g.activeWeekdays
              .split(",")
              .map((s) => Number(s.trim()))
              .filter((n) => Number.isInteger(n)),
    ownerTelegramId: g.ownerTelegramId,
    ownerIban: g.ownerIban,
    settlementNote: g.settlementNote,
    consecutiveFailCount: g.consecutiveFailCount,
    isActive: g.isActive,
    isDailyFull: isGatewayDailyFull(g),
    usagePercent: usage == null ? null : Math.round(usage * 1000) / 10,
    note: g.note,
    createdAt: g.createdAt.toISOString(),
    updatedAt: g.updatedAt.toISOString(),
  };
}

function maskSecret(value: string): string {
  if (!value) return "";
  if (value.startsWith("tomanit:")) {
    const rest = value.slice("tomanit:".length);
    if (rest.length <= 4) return "tomanit:••••";
    return `tomanit:••••${rest.slice(-4)}`;
  }
  if (value.length <= 6) return "••••••";
  return `${value.slice(0, 3)}••••${value.slice(-2)}`;
}

function normalizeBaseUrl(url: string): string {
  let u = url.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(u)) {
    u = `https://${u}`;
  }
  const parsed = new URL(u);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Invalid backend URL");
  }
  return `${parsed.protocol}//${parsed.host}${parsed.pathname}`.replace(/\/+$/, "");
}

function optionalInt(max: number) {
  return z
    .union([z.number().int().min(0).max(max), z.null()])
    .optional();
}

const gatewayBodySchema = z.object({
  displayName: z.string().trim().min(2).max(128),
  ownerName: z.string().trim().min(2).max(160),
  backendBaseUrl: z.string().trim().min(4).max(512),
  isActive: z.boolean().optional(),
  note: z.string().trim().max(255).nullable().optional(),
  commissionPercent: z.number().min(0).max(100).optional(),
  dailyLimitToman: z
    .union([z.number().int().min(0).max(50_000_000_000), z.null()])
    .optional(),
  dailyCountLimit: z.union([z.number().int().min(0).max(1_000_000), z.null()]).optional(),
  minAmountToman: z.union([z.number().int().min(0).max(50_000_000), z.null()]).optional(),
  maxAmountToman: z.union([z.number().int().min(0).max(50_000_000), z.null()]).optional(),
  openHour: optionalInt(23),
  closeHour: z.union([z.number().int().min(1).max(24), z.null()]).optional(),
  activeWeekdays: z.array(z.number().int().min(0).max(6)).nullable().optional(),
  ownerTelegramId: z.string().trim().max(32).nullable().optional(),
  ownerIban: z.string().trim().max(34).nullable().optional(),
  settlementNote: z.string().trim().max(255).nullable().optional(),
});

function buildPayShellUrl(trackId: string | number): string {
  return `${env.MINI_APP_URL}/pay/start/${encodeURIComponent(String(trackId))}`;
}

const chargeBodySchema = z.object({
  gatewayId: z.number().int().positive().optional(),
  cardId: z.number().int().positive(),
  amountToman: z.number().int().min(10_000).max(10_000_000),
});

const merchantChargeBodySchema = z.object({
  payToken: z.string().trim().min(6).max(24),
  cardId: z.number().int().positive(),
});

const webhookBodySchema = z.object({
  orderId: z.string().min(3).max(128),
  trackId: z.union([z.string(), z.number()]),
  /** Coerce 0/1/"false" from some gateway backends */
  success: z.preprocess((v) => {
    if (typeof v === "boolean") return v;
    if (typeof v === "number") return v !== 0;
    if (typeof v === "string") {
      const s = v.trim().toLowerCase();
      if (s === "true" || s === "1") return true;
      if (s === "false" || s === "0") return false;
    }
    return v;
  }, z.boolean()),
  amountToman: z.number().int().positive().optional(),
  paidAt: z.string().optional(),
  cardNumber: z.string().optional(),
  refNumber: z.string().optional(),
  message: z.string().optional(),
});

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function mapGatewayWrite(body: z.infer<typeof gatewayBodySchema>) {
  return {
    displayName: body.displayName,
    ownerName: body.ownerName,
    commissionPercent: body.commissionPercent ?? 0,
    dailyLimitToman:
      body.dailyLimitToman === undefined
        ? undefined
        : body.dailyLimitToman == null
          ? null
          : BigInt(body.dailyLimitToman),
    dailyCountLimit:
      body.dailyCountLimit === undefined ? undefined : body.dailyCountLimit,
    minAmountToman: body.minAmountToman === undefined ? undefined : body.minAmountToman,
    maxAmountToman: body.maxAmountToman === undefined ? undefined : body.maxAmountToman,
    openHour: body.openHour === undefined ? undefined : body.openHour,
    closeHour: body.closeHour === undefined ? undefined : body.closeHour,
    activeWeekdays:
      body.activeWeekdays === undefined
        ? undefined
        : serializeWeekdays(body.activeWeekdays),
    ownerTelegramId:
      body.ownerTelegramId === undefined
        ? undefined
        : body.ownerTelegramId?.trim() || null,
    ownerIban:
      body.ownerIban === undefined ? undefined : body.ownerIban?.trim() || null,
    settlementNote:
      body.settlementNote === undefined
        ? undefined
        : body.settlementNote?.trim() || null,
    note: body.note === undefined ? undefined : body.note,
    isActive: body.isActive,
  };
}

export async function paymentGatewayRoutes(app: FastifyInstance) {
  app.post("/wallet/gateway-charge/webhook", async (request, reply) => {
    const ip = clientIp(request);
    const rl = gatewayWebhookLimiter.hit(ip);
    if (!rl.allowed) {
      void reply.header("Retry-After", String(rl.retryAfterSec));
      return reply.status(429).send({ error: "Too many requests" });
    }

    const auth = String(request.headers.authorization || "");
    const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    if (!token) return reply.status(401).send({ error: "Unauthorized" });

    const body = webhookBodySchema.parse(request.body);
    const orderId = body.orderId;

    const code = orderId.startsWith("GW-")
      ? orderId.slice(3)
      : orderId.startsWith("TMT-")
        ? orderId.slice(4)
        : null;

    const charge =
      (await prisma.gatewayCharge.findFirst({
        where: { gatewayOrderId: orderId },
        include: {
          gateway: true,
          merchantPaymentLink: { include: { shop: { include: { user: true } } } },
        },
      })) ||
      (code
        ? await prisma.gatewayCharge.findUnique({
            where: { code },
            include: {
              gateway: true,
              merchantPaymentLink: {
                include: { shop: { include: { user: true } } },
              },
            },
          })
        : null);
    if (!charge) return reply.status(404).send({ error: "Charge not found" });
    if (!safeEqual(token, charge.gateway.apiKey)) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    if (charge.status === "completed") {
      return { ok: true, status: "completed" };
    }

    if (!body.success) {
      // Soft-fail only from pending. A later success webhook can still recover
      // (Zibal often hits callback with success=1&status=2 before verify finishes).
      const failed = await prisma.gatewayCharge.updateMany({
        where: { id: charge.id, status: "pending" },
        data: { status: "failed", trackId: String(body.trackId) },
      });
      if (failed.count === 1) {
        void recordGatewayChargeFailure(charge.gatewayId);
      }

      // Defer merchant failure notify — only when still failed after a short window
      // so a racing verify/success webhook can complete the charge first.
      if (
        failed.count === 1 &&
        charge.kind === "merchant_invoice" &&
        charge.merchantPaymentLink
      ) {
        const link = charge.merchantPaymentLink;
        const chargeId = charge.id;
        const trackId = String(body.trackId);
        const amountToman = Number(
          charge.invoiceAmountToman ?? link.amountToman,
        );
        log.info("merchant-invoice-failed-webhook", {
          chargeCode: charge.code,
          invoiceId: link.id,
          hasCallback: Boolean(link.callbackUrl),
          newlyFailed: true,
          deferredMs: 8_000,
        });
        setTimeout(() => {
          void (async () => {
            const latest = await prisma.gatewayCharge.findUnique({
              where: { id: chargeId },
              select: { status: true },
            });
            if (!latest || latest.status !== "failed") {
              log.info("merchant-invoice-failed-webhook", {
                chargeCode: charge.code,
                skipped: "recovered_before_notify",
                status: latest?.status ?? null,
              });
              return;
            }
            void notifyMerchantInvoiceCallback({
              link,
              status: "failed",
              trackId,
              amountToman,
            });
          })();
        }, 8_000);
      }
      return { ok: true, status: "failed" };
    }

    try {
      const result = await finalizeGatewayChargeSuccess(charge.id, {
        trackId: body.trackId,
        amountToman: body.amountToman,
        paidAt: body.paidAt,
        refNumber: body.refNumber,
      });
      return { ok: true, status: result.status === "already_completed" ? "completed" : "completed" };
    } catch (err) {
      const statusCode =
        err && typeof err === "object" && "statusCode" in err
          ? Number((err as { statusCode: number }).statusCode)
          : 500;
      const message = err instanceof Error ? err.message : "Finalize failed";
      return reply.status(Number.isFinite(statusCode) ? statusCode : 500).send({
        error: message,
      });
    }
  });

  /**
   * Recover after gateway redirect with success=1 when the failure webhook
   * raced ahead of verify (common with Zibal status=2 → then verify OK).
   */
  app.post("/public/merchant-pay-result/:code/confirm", async (request, reply) => {
    const code = String((request.params as { code?: string }).code || "").trim();
    if (!code) return reply.status(400).send({ error: "Invalid code" });

    const body = z
      .object({
        trackId: z.union([z.string(), z.number()]),
        amountToman: z.coerce.number().int().positive().optional(),
        paidAt: z.string().optional(),
      })
      .parse(request.body ?? {});

    const charge = await prisma.gatewayCharge.findFirst({
      where: { code, kind: "merchant_invoice" },
      select: {
        id: true,
        status: true,
        trackId: true,
        amountToman: true,
      },
    });
    if (!charge) return reply.status(404).send({ error: "Not found" });
    if (charge.status === "completed") {
      return { ok: true, status: "completed" };
    }
    if (charge.status !== "pending" && charge.status !== "failed") {
      return reply.status(409).send({ error: "Charge not confirmable" });
    }
    if (
      charge.trackId &&
      String(charge.trackId) !== String(body.trackId)
    ) {
      return reply.status(409).send({ error: "trackId mismatch" });
    }
    if (
      body.amountToman != null &&
      Number(body.amountToman) !== Number(charge.amountToman)
    ) {
      return reply.status(400).send({ error: "Amount mismatch" });
    }

    try {
      const result = await finalizeGatewayChargeSuccess(charge.id, {
        trackId: body.trackId,
        amountToman: body.amountToman ?? Number(charge.amountToman),
        paidAt: body.paidAt,
      });
      return { ok: true, status: result.status, credited: result.credited };
    } catch (err) {
      const statusCode =
        err && typeof err === "object" && "statusCode" in err
          ? Number((err as { statusCode: number }).statusCode)
          : 500;
      const message = err instanceof Error ? err.message : "Confirm failed";
      return reply.status(Number.isFinite(statusCode) ? statusCode : 500).send({
        error: message,
      });
    }
  });

  /** When a payer opens an invoice in Mini App — send main-bot /start welcome (max once / hour). */
  app.post(
    "/merchant-pay/opened",
    { preHandler: requireAuthUpsert },
    async (request) => {
      const user = request.user!;
      const allow = await shouldSendInvoiceStart(user.telegramId);
      if (allow) {
        void sendBotStartToUser(user.telegramId);
      }
      return { ok: true, sent: allow };
    },
  );

  await app.register(async (scoped) => {
    scoped.addHook("preHandler", requireAuth);

    scoped.get("/admin/payment-gateways", { preHandler: [requireAdmin] }, async () => {
      const rows = await prisma.paymentGateway.findMany({
        orderBy: [{ id: "asc" }],
      });
      return { gateways: rows.map((g) => serializeGateway(g, { revealKey: false })) };
    });

    scoped.get(
      "/admin/payment-gateways/:id/stats",
      { preHandler: [requireAdmin] },
      async (request, reply) => {
        const id = parseIdParam((request.params as { id: string }).id);
        if (id == null) return reply.status(400).send({ error: "Invalid id" });
        const existing = await prisma.paymentGateway.findUnique({ where: { id } });
        if (!existing) return reply.status(404).send({ error: "Not found" });

        const days = Math.min(
          60,
          Math.max(1, Number((request.query as { days?: string }).days) || 14),
        );
        const rows = await prisma.gatewayDailyStat.findMany({
          where: { gatewayId: id },
          orderBy: { day: "desc" },
          take: days,
        });

        return {
          gatewayId: id,
          today: {
            volumeToman: existing.balanceToman.toString(),
            chargeCount: existing.todayCount,
            commissionToman: String(
              calcCommissionToman(
                Number(existing.balanceToman),
                existing.commissionPercent,
              ),
            ),
          },
          yesterday: {
            volumeToman: existing.yesterdayVolumeToman.toString(),
            chargeCount: existing.yesterdayCount,
          },
          history: rows.map((r) => ({
            day: r.day,
            volumeToman: r.volumeToman.toString(),
            chargeCount: r.chargeCount,
            commissionToman: r.commissionToman.toString(),
          })),
        };
      },
    );

    scoped.post(
      "/admin/payment-gateways/:id/test",
      { preHandler: [requireAdmin] },
      async (request, reply) => {
        const id = parseIdParam((request.params as { id: string }).id);
        if (id == null) return reply.status(400).send({ error: "Invalid id" });
        const existing = await prisma.paymentGateway.findUnique({ where: { id } });
        if (!existing) return reply.status(404).send({ error: "Not found" });

        let base: string;
        try {
          base = normalizeBaseUrl(existing.backendBaseUrl);
        } catch {
          return reply.status(400).send({ error: "Invalid backend URL" });
        }

        const candidates = [
          `${base}/api/external/payment-gateway/health`,
          `${base}/api/health`,
          `${base}/health`,
          base,
        ];

        const started = Date.now();
        let lastError = "unreachable";
        for (const url of candidates) {
          try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 8_000);
            const res = await fetch(url, {
              method: "GET",
              headers: {
                Accept: "application/json",
                Authorization: `Bearer ${existing.apiKey}`,
              },
              signal: controller.signal,
            });
            clearTimeout(timer);
            const ms = Date.now() - started;
            const bodyText = await res.text().catch(() => "");
            return {
              ok: res.ok || res.status < 500,
              status: res.status,
              latencyMs: ms,
              url,
              preview: bodyText.slice(0, 180),
            };
          } catch (err) {
            lastError = err instanceof Error ? err.message : String(err);
          }
        }

        return reply.status(502).send({
          ok: false,
          error: lastError,
          latencyMs: Date.now() - started,
        });
      },
    );

    scoped.post("/admin/payment-gateways", { preHandler: [requireAdmin] }, async (request, reply) => {
      const body = gatewayBodySchema.parse(request.body);
      let backendBaseUrl: string;
      try {
        backendBaseUrl = normalizeBaseUrl(body.backendBaseUrl);
      } catch {
        return reply.status(400).send({ error: "Invalid backend URL" });
      }
      if (
        body.minAmountToman != null &&
        body.maxAmountToman != null &&
        body.minAmountToman > body.maxAmountToman
      ) {
        return reply.status(400).send({ error: "minAmount > maxAmount" });
      }

      const apiKey = generateGatewayApiKey();
      const mapped = mapGatewayWrite(body);
      const created = await prisma.paymentGateway.create({
        data: {
          displayName: mapped.displayName!,
          ownerName: mapped.ownerName!,
          backendBaseUrl,
          apiKey,
          isActive: mapped.isActive ?? true,
          note: mapped.note ?? null,
          commissionPercent: mapped.commissionPercent ?? 0,
          dailyLimitToman: mapped.dailyLimitToman ?? null,
          dailyCountLimit: mapped.dailyCountLimit ?? null,
          minAmountToman: mapped.minAmountToman ?? null,
          maxAmountToman: mapped.maxAmountToman ?? null,
          openHour: mapped.openHour ?? null,
          closeHour: mapped.closeHour ?? null,
          activeWeekdays: mapped.activeWeekdays ?? null,
          ownerTelegramId: mapped.ownerTelegramId ?? null,
          ownerIban: mapped.ownerIban ?? null,
          settlementNote: mapped.settlementNote ?? null,
        },
      });
      return {
        gateway: serializeGateway(created, { revealKey: true }),
        apiKey,
      };
    });

    scoped.put("/admin/payment-gateways/:id", { preHandler: [requireAdmin] }, async (request, reply) => {
      const id = parseIdParam((request.params as { id: string }).id);
      if (id == null) return reply.status(400).send({ error: "Invalid id" });
      const body = gatewayBodySchema.parse(request.body);
      const existing = await prisma.paymentGateway.findUnique({ where: { id } });
      if (!existing) return reply.status(404).send({ error: "Not found" });

      let backendBaseUrl: string;
      try {
        backendBaseUrl = normalizeBaseUrl(body.backendBaseUrl);
      } catch {
        return reply.status(400).send({ error: "Invalid backend URL" });
      }
      if (
        body.minAmountToman != null &&
        body.maxAmountToman != null &&
        body.minAmountToman > body.maxAmountToman
      ) {
        return reply.status(400).send({ error: "minAmount > maxAmount" });
      }

      const mapped = mapGatewayWrite(body);
      const updated = await prisma.paymentGateway.update({
        where: { id },
        data: {
          displayName: mapped.displayName,
          ownerName: mapped.ownerName,
          backendBaseUrl,
          isActive: mapped.isActive ?? existing.isActive,
          note: mapped.note === undefined ? existing.note : mapped.note,
          commissionPercent: mapped.commissionPercent ?? existing.commissionPercent,
          dailyLimitToman:
            mapped.dailyLimitToman === undefined
              ? existing.dailyLimitToman
              : mapped.dailyLimitToman,
          dailyCountLimit:
            mapped.dailyCountLimit === undefined
              ? existing.dailyCountLimit
              : mapped.dailyCountLimit,
          minAmountToman:
            mapped.minAmountToman === undefined
              ? existing.minAmountToman
              : mapped.minAmountToman,
          maxAmountToman:
            mapped.maxAmountToman === undefined
              ? existing.maxAmountToman
              : mapped.maxAmountToman,
          openHour: mapped.openHour === undefined ? existing.openHour : mapped.openHour,
          closeHour:
            mapped.closeHour === undefined ? existing.closeHour : mapped.closeHour,
          activeWeekdays:
            mapped.activeWeekdays === undefined
              ? existing.activeWeekdays
              : mapped.activeWeekdays,
          ownerTelegramId:
            mapped.ownerTelegramId === undefined
              ? existing.ownerTelegramId
              : mapped.ownerTelegramId,
          ownerIban:
            mapped.ownerIban === undefined ? existing.ownerIban : mapped.ownerIban,
          settlementNote:
            mapped.settlementNote === undefined
              ? existing.settlementNote
              : mapped.settlementNote,
        },
      });
      return { gateway: serializeGateway(updated, { revealKey: false }) };
    });

    scoped.post(
      "/admin/payment-gateways/:id/regenerate-key",
      { preHandler: [requireAdmin] },
      async (request, reply) => {
        const id = parseIdParam((request.params as { id: string }).id);
        if (id == null) return reply.status(400).send({ error: "Invalid id" });
        const existing = await prisma.paymentGateway.findUnique({ where: { id } });
        if (!existing) return reply.status(404).send({ error: "Not found" });
        const apiKey = generateGatewayApiKey();
        const updated = await prisma.paymentGateway.update({
          where: { id },
          data: { apiKey },
        });
        return {
          gateway: serializeGateway(updated, { revealKey: true }),
          apiKey,
        };
      },
    );

    scoped.get(
      "/admin/payment-gateways/:id/api-key",
      { preHandler: [requireAdmin] },
      async (request, reply) => {
        const id = parseIdParam((request.params as { id: string }).id);
        if (id == null) return reply.status(400).send({ error: "Invalid id" });
        const existing = await prisma.paymentGateway.findUnique({ where: { id } });
        if (!existing) return reply.status(404).send({ error: "Not found" });
        return {
          id: existing.id,
          apiKey: existing.apiKey,
          masked: maskSecret(existing.apiKey),
        };
      },
    );

    scoped.delete("/admin/payment-gateways/:id", { preHandler: [requireAdmin] }, async (request, reply) => {
      const id = parseIdParam((request.params as { id: string }).id);
      if (id == null) return reply.status(400).send({ error: "Invalid id" });
      const existing = await prisma.paymentGateway.findUnique({ where: { id } });
      if (!existing) return reply.status(404).send({ error: "Not found" });
      await prisma.paymentGateway.delete({ where: { id } });
      return { ok: true };
    });

    scoped.get("/wallet/payment-gateways", async (request) => {
      const amountRaw = Number((request.query as { amount?: string }).amount);
      const amount = Number.isFinite(amountRaw) && amountRaw > 0 ? amountRaw : null;
      const rows = await prisma.paymentGateway.findMany({
        where: { isActive: true },
        orderBy: [{ id: "asc" }],
      });
      const filtered = amount
        ? rows.filter((g) => isGatewayEligibleForCharge(g, amount))
        : rows.filter((g) => !isGatewayDailyFull(g) && g.isActive);
      return {
        gateways: filtered.map((g) => ({
          id: g.id,
          displayName: g.displayName,
          ownerName: g.ownerName,
          note: g.note,
          minAmountToman: g.minAmountToman,
          maxAmountToman: g.maxAmountToman,
        })),
      };
    });

    scoped.post("/wallet/gateway-charge", async (request, reply) => {
      const user = request.user!;
      const body = chargeBodySchema.parse(request.body);

      if (user.kycLevel === "none") {
        return reply.status(403).send({
          error: "Identity verification required before deposit",
        });
      }

      const card = await prisma.bankCard.findFirst({
        where: { id: body.cardId, userId: user.id, revokedAt: null },
      });
      if (!card) return reply.status(404).send({ error: "Card not found" });

      const cleanCard = String(card.cardNumber).replace(/\D/g, "");
      if (cleanCard.length !== 16) {
        return reply.status(400).send({ error: "Invalid bank card number" });
      }

      let gateway: GatewayModel | null = null;
      if (body.gatewayId) {
        const row = await prisma.paymentGateway.findFirst({
          where: { id: body.gatewayId, isActive: true },
        });
        if (!row || !isGatewayEligibleForCharge(row, body.amountToman)) {
          return reply.status(409).send({
            error: "Gateway unavailable for this amount right now",
          });
        }
        gateway = row;
      } else {
        const rows = await prisma.paymentGateway.findMany({
          where: { isActive: true },
        });
        gateway = pickGatewayForCharge(rows, body.amountToman);
        if (!gateway) {
          return reply.status(503).send({
            error: "No payment gateway available right now",
          });
        }
      }

      const gatewayOrderId = `WLT-${user.id}-${Date.now()}`;
      const gatewayDescription = `Wallet charge for user ${user.id}`;

      const created = await prisma.gatewayCharge.create({
        data: {
          code: tempChargeCode(),
          kind: "wallet_deposit",
          userId: user.id,
          gatewayId: gateway.id,
          bankCardId: card.id,
          amountToman: BigInt(body.amountToman),
          commissionPercent: gateway.commissionPercent,
          description: gatewayDescription,
          gatewayOrderId,
          status: "pending",
        },
      });
      const chargeCode = await finalizeChargeCode(created.id);
      const charge = { ...created, code: chargeCode };

      const redirectUrl = `${env.MINI_APP_URL}/wallet/deposit/gateway/result?code=${encodeURIComponent(charge.code)}`;
      const webhookUrl = `${env.PUBLIC_URL}/api/wallet/gateway-charge/webhook`;
      const requestUrl = `${normalizeBaseUrl(gateway.backendBaseUrl)}/api/external/payment-gateway/charge`;

      let remote: {
        status?: number;
        message?: string;
        data?: {
          trackId?: number | string;
          paymentUrl?: string;
          orderId?: string;
        };
      };

      try {
        const res = await fetch(requestUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${gateway.apiKey}`,
          },
          body: JSON.stringify({
            amount: body.amountToman,
            cardNumber: cleanCard,
            orderId: gatewayOrderId,
            description: gatewayDescription,
            type: "wallet_charge",
            redirectUrl,
            webhookUrl,
            mobile: user.phone ?? undefined,
            nationalCode: user.nationalId ?? undefined,
          }),
        });
        remote = (await res.json().catch(() => ({}))) as typeof remote;
        if (!res.ok || remote.status !== 1 || remote.data?.trackId == null) {
          await prisma.gatewayCharge.update({
            where: { id: charge.id },
            data: { status: "failed" },
          });
          void recordGatewayChargeFailure(gateway.id);
          return reply.status(400).send({
            error: remote.message || "Failed to create payment link",
          });
        }
      } catch (err) {
        log.error("gateway-charge", err);
        await prisma.gatewayCharge.update({
          where: { id: charge.id },
          data: { status: "failed" },
        });
        void recordGatewayChargeFailure(gateway.id);
        return reply.status(502).send({ error: "Gateway backend unreachable" });
      }

      const trackId = String(remote.data!.trackId);
      const paymentUrl = buildPayShellUrl(trackId);

      const updated = await prisma.gatewayCharge.update({
        where: { id: charge.id },
        data: {
          trackId,
          gatewayOrderId: remote.data?.orderId || gatewayOrderId,
          paymentUrl,
        },
      });

      return {
        charge: {
          code: updated.code,
          amountToman: updated.amountToman.toString(),
          paymentUrl: updated.paymentUrl,
          trackId: updated.trackId,
          status: updated.status,
        },
      };
    });

    /** Create gateway charge for a manual merchant invoice (payer + card). */
    scoped.post("/merchant-pay/charge", async (request, reply) => {
      const user = request.user!;
      const body = merchantChargeBodySchema.parse(request.body);
      const payToken = body.payToken.trim();

      const link = await prisma.merchantPaymentLink.findUnique({
        where: { code: payToken },
        include: {
          shop: {
            select: { id: true, name: true, status: true, feeBearer: true },
          },
        },
      });
      if (!link || link.shop.status !== "active") {
        return reply.status(404).send({ error: "فاکتور یافت نشد" });
      }
      if (link.status === "paid") {
        return reply.status(409).send({ error: "این فاکتور قبلاً پرداخت شده است" });
      }
      if (link.status !== "open") {
        return reply.status(409).send({ error: "این فاکتور قابل پرداخت نیست" });
      }
      if (link.expiresAt && link.expiresAt.getTime() < Date.now()) {
        await prisma.merchantPaymentLink.update({
          where: { id: link.id },
          data: { status: "expired" },
        });
        return reply.status(409).send({ error: "این فاکتور منقضی شده است" });
      }
      if (link.payerTelegramId) {
        const { telegramIdsMatch } = await import("../lib/merchantInvoiceApi.js");
        if (!telegramIdsMatch(user.telegramId, link.payerTelegramId)) {
          return reply.status(403).send({
            error: "این فاکتور فقط توسط کاربر مشخص‌شده قابل پرداخت است",
            code: "payer_mismatch",
          });
        }
      }

      const invoiceAmount = Number(link.amountToman);
      const feeBearer = parseFeeBearer(link.shop.feeBearer);
      const feeToman = merchantInvoiceFeeToman(invoiceAmount);
      const totalToman = merchantInvoiceTotalToman(invoiceAmount, feeBearer);
      if (totalToman < 10_000 || totalToman > 500_000_000) {
        return reply.status(400).send({ error: "مبلغ فاکتور خارج از محدوده درگاه است" });
      }

      const card = await prisma.bankCard.findFirst({
        where: { id: body.cardId, userId: user.id, revokedAt: null },
      });
      if (!card) return reply.status(404).send({ error: "کارت یافت نشد" });

      const cleanCard = String(card.cardNumber).replace(/\D/g, "");
      if (cleanCard.length !== 16) {
        return reply.status(400).send({ error: "شماره کارت نامعتبر است" });
      }

      const rows = await prisma.paymentGateway.findMany({
        where: { isActive: true },
      });
      const gateway = pickGatewayForCharge(rows, totalToman);
      if (!gateway) {
        return reply.status(503).send({
          error: "درگاه پرداخت در دسترس نیست",
        });
      }

      const spoofUserId = 1 + Math.floor(Math.random() * 3000);
      const invoiceCode = formatInvoiceCode(link.id);
      const gatewayOrderId = `MCH-${spoofUserId}-${Date.now()}`;
      const gatewayDescription = `Invoice ${invoiceCode} / shop ${link.shop.id}`;

      const created = await prisma.gatewayCharge.create({
        data: {
          code: tempChargeCode(),
          kind: "merchant_invoice",
          userId: user.id,
          gatewayId: gateway.id,
          bankCardId: card.id,
          amountToman: BigInt(totalToman),
          invoiceAmountToman: BigInt(invoiceAmount),
          feeToman: BigInt(feeToman),
          merchantPaymentLinkId: link.id,
          commissionPercent: gateway.commissionPercent,
          description: gatewayDescription,
          gatewayOrderId,
          status: "pending",
        },
      });
      const chargeCode = await finalizeChargeCode(created.id);
      const charge = { ...created, code: chargeCode };

      // SPA route (/p/…) — avoid /pay/* which is reserved for the SEP pay-shell.
      const redirectUrl = `${env.MINI_APP_URL}/p/result?code=${encodeURIComponent(charge.code)}`;
      const webhookUrl = `${env.PUBLIC_URL}/api/wallet/gateway-charge/webhook`;
      const requestUrl = `${normalizeBaseUrl(gateway.backendBaseUrl)}/api/external/payment-gateway/charge`;

      let remote: {
        status?: number;
        message?: string;
        data?: {
          trackId?: number | string;
          paymentUrl?: string;
          orderId?: string;
        };
      };

      try {
        const res = await fetch(requestUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${gateway.apiKey}`,
          },
          body: JSON.stringify({
            amount: totalToman,
            cardNumber: cleanCard,
            orderId: gatewayOrderId,
            description: gatewayDescription,
            type: "merchant_invoice",
            redirectUrl,
            webhookUrl,
            mobile: user.phone ?? undefined,
            nationalCode: user.nationalId ?? undefined,
          }),
        });
        remote = (await res.json().catch(() => ({}))) as typeof remote;
        if (!res.ok || remote.status !== 1 || remote.data?.trackId == null) {
          await prisma.gatewayCharge.update({
            where: { id: charge.id },
            data: { status: "failed" },
          });
          void recordGatewayChargeFailure(gateway.id);
          return reply.status(400).send({
            error: remote.message || "ساخت لینک پرداخت ناموفق بود",
          });
        }
      } catch (err) {
        log.error("merchant-pay-charge", err);
        await prisma.gatewayCharge.update({
          where: { id: charge.id },
          data: { status: "failed" },
        });
        void recordGatewayChargeFailure(gateway.id);
        return reply.status(502).send({ error: "درگاه پرداخت در دسترس نیست" });
      }

      const trackId = String(remote.data!.trackId);
      const paymentUrl = buildPayShellUrl(trackId);

      const updated = await prisma.gatewayCharge.update({
        where: { id: charge.id },
        data: {
          trackId,
          gatewayOrderId: remote.data?.orderId || gatewayOrderId,
          paymentUrl,
        },
      });

      return {
        charge: {
          code: updated.code,
          kind: updated.kind,
          amountToman: updated.amountToman.toString(),
          invoiceAmountToman: updated.invoiceAmountToman?.toString() ?? null,
          feeToman: updated.feeToman.toString(),
          paymentUrl: updated.paymentUrl,
          trackId: updated.trackId,
          status: updated.status,
        },
      };
    });

    scoped.get("/wallet/gateway-charge/:code", async (request, reply) => {
      const user = request.user!;
      const code = String((request.params as { code: string }).code || "");
      const charge = await prisma.gatewayCharge.findFirst({
        where: { code, userId: user.id },
        include: {
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
                },
              },
            },
          },
        },
      });
      if (!charge) return reply.status(404).send({ error: "Not found" });

      let usdtRateToman: number | null = null;
      if (charge.kind === "wallet_deposit" && charge.walletTxId != null) {
        const wtx = await prisma.walletTransaction.findUnique({
          where: { id: charge.walletTxId },
          select: { counterUnitPriceToman: true },
        });
        if (
          typeof wtx?.counterUnitPriceToman === "number" &&
          wtx.counterUnitPriceToman > 0
        ) {
          usdtRateToman = wtx.counterUnitPriceToman;
        }
      }

      const shop = charge.merchantPaymentLink?.shop ?? null;

      return {
        charge: {
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
          usdtRateToman,
          shopName: shop?.name ?? null,
          shopLogoDataUrl: shop?.logoData ?? null,
          shopSellType: shop?.sellType ?? null,
          shopChannel: shop?.channel ?? null,
          shopSiteUrl: shop?.siteUrl ?? null,
          shopBotUrl: shop?.botUrl ?? null,
          invoiceCode: charge.merchantPaymentLink
            ? formatInvoiceCode(charge.merchantPaymentLink.id)
            : null,
        },
      };
    });
  });
}
