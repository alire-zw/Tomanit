import type {
  GatewayCharge,
  GatewayChargeStatus,
  MerchantPaymentLink,
  MerchantPaymentLinkStatus,
  Prisma,
  User,
} from "@prisma/client";
import { prisma } from "../db/prisma.js";
import {
  formatInvoiceCode,
  paymentLinkMiniAppUrl,
  paymentLinkWebUrl,
} from "./merchantPaymentLink.js";
import { getAssetRateTomanNearTime } from "./swapwalletChart.js";
import { getAssetRateToman } from "./swapwallet.js";

export type ShopTxStatus = "completed" | "pending" | "failed" | "expired" | "unpaid";
export type ShopTxSource = "manual" | "api";

type ChargeUser = Pick<User, "telegramId" | "username" | "firstName" | "lastName">;

type ChargeWithLink = GatewayCharge & {
  merchantPaymentLink: MerchantPaymentLink | null;
  user?: ChargeUser | null;
};

type LedgerCharge = GatewayCharge & {
  user?: ChargeUser | null;
  gateway?: { displayName: string } | null;
  bankCard?: {
    cardNumber: string;
    bankName: string | null;
    bankSlug: string | null;
    ownerName: string | null;
  } | null;
};

type LinkWithCharge = MerchantPaymentLink & {
  gatewayCharges: LedgerCharge[];
};

function payerUsernameFrom(user: ChargeUser | null | undefined): string | null {
  const u = user?.username?.trim();
  return u ? u : null;
}

function payerFullNameFrom(user: ChargeUser | null | undefined): string | null {
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim();
  return name || null;
}

export function mapShopTxStatus(status: GatewayChargeStatus): ShopTxStatus {
  if (status === "completed") return "completed";
  if (status === "pending") return "pending";
  return "failed";
}

export function mapLinkToShopTxStatus(
  status: MerchantPaymentLinkStatus,
): ShopTxStatus {
  if (status === "paid") return "completed";
  if (status === "open") return "pending";
  if (status === "expired") return "expired";
  return "unpaid";
}

function linkSource(source: string | null | undefined): ShopTxSource {
  return source === "api" ? "api" : "manual";
}

function payerLabelFrom(
  user: ChargeUser | null | undefined,
  link: MerchantPaymentLink | null | undefined,
): string | null {
  const payer =
    user?.firstName ||
    user?.username ||
    user?.telegramId ||
    link?.payerTelegramId ||
    null;
  return payer ? String(payer) : null;
}

function amountTrxFrom(amountToman: number, trxRateToman: number | null): number | null {
  if (!(amountToman > 0) || !(trxRateToman != null && trxRateToman > 0)) return null;
  return amountToman / trxRateToman;
}

export function serializeShopTransaction(
  charge: ChargeWithLink,
  trxRateOverride?: number | null,
) {
  const link = charge.merchantPaymentLink;
  const invoiceAmount = Number(
    charge.invoiceAmountToman ?? link?.amountToman ?? 0,
  );
  const fee = Number(charge.feeToman ?? 0);
  const total = Number(charge.amountToman ?? 0);

  const trxRateToman =
    (typeof charge.trxRateToman === "number" && charge.trxRateToman > 0
      ? charge.trxRateToman
      : null) ??
    (trxRateOverride != null && trxRateOverride > 0 ? trxRateOverride : null);

  return {
    /** Prefer payment-link id so list/detail share one key. */
    id: String(link?.id ?? charge.id),
    chargeCode: charge.code,
    invoiceCode: link ? formatInvoiceCode(link.id) : null,
    title: (() => {
      if (!link) return charge.code;
      const inv = formatInvoiceCode(link.id);
      if (!link.title || /^INV-\d+$/i.test(link.title)) return inv;
      return link.title;
    })(),
    amountToman: invoiceAmount,
    feeToman: fee,
    totalToman: total,
    status: mapShopTxStatus(charge.status),
    linkStatus: link?.status ?? (charge.status === "completed" ? "paid" : "open"),
    source: linkSource(link?.source),
    orderId: link?.orderId ?? null,
    phone: link?.payerPhone ?? null,
    callbackUrl: link?.callbackUrl ?? null,
    paidAt: charge.paidAt?.toISOString() ?? link?.paidAt?.toISOString() ?? null,
    expiresAt: link?.expiresAt?.toISOString() ?? null,
    createdAt: (link?.createdAt ?? charge.createdAt).toISOString(),
    payerTelegramId: link?.payerTelegramId ?? charge.user?.telegramId ?? null,
    payerLabel: payerLabelFrom(charge.user, link),
    trxRateToman,
    amountTrx: amountTrxFrom(invoiceAmount, trxRateToman),
  };
}

export function serializeShopLedgerItem(
  link: LinkWithCharge,
  trxRateOverride?: number | null,
) {
  const charge = link.gatewayCharges[0] ?? null;
  const invoiceAmount = Number(link.amountToman);
  const fee = Number(charge?.feeToman ?? 0);
  const total = Number(charge?.amountToman ?? link.amountToman);
  const trxRateToman =
    (typeof charge?.trxRateToman === "number" && charge.trxRateToman > 0
      ? charge.trxRateToman
      : null) ??
    (trxRateOverride != null && trxRateOverride > 0 ? trxRateOverride : null);
  const webUrl = paymentLinkWebUrl(link.code);
  const miniAppUrl = paymentLinkMiniAppUrl(link.code);

  return {
    id: String(link.id),
    chargeCode: charge?.code ?? null,
    invoiceCode: formatInvoiceCode(link.id),
    title: (() => {
      const inv = formatInvoiceCode(link.id);
      if (!link.title || /^INV-\d+$/i.test(link.title)) return inv;
      return link.title;
    })(),
    amountToman: invoiceAmount,
    feeToman: fee,
    totalToman: total,
    status: mapLinkToShopTxStatus(link.status),
    linkStatus: link.status,
    source: linkSource(link.source),
    orderId: link.orderId ?? null,
    phone: link.payerPhone ?? null,
    callbackUrl: link.callbackUrl ?? null,
    paidAt: link.paidAt?.toISOString() ?? charge?.paidAt?.toISOString() ?? null,
    expiresAt: link.expiresAt?.toISOString() ?? null,
    createdAt: link.createdAt.toISOString(),
    updatedAt: link.updatedAt.toISOString(),
    payerTelegramId: link.payerTelegramId ?? charge?.user?.telegramId ?? null,
    payerUsername: payerUsernameFrom(charge?.user ?? null),
    payerFullName: payerFullNameFrom(charge?.user ?? null),
    payerLabel: payerLabelFrom(charge?.user, link),
    trxRateToman,
    amountTrx: amountTrxFrom(invoiceAmount, trxRateToman),
    payToken: link.code,
    webUrl,
    miniAppUrl,
    url: miniAppUrl ?? webUrl,
    trackId: charge?.trackId ?? null,
    gatewayOrderId: charge?.gatewayOrderId ?? null,
    gatewayName: charge?.gateway?.displayName ?? null,
    commissionPercent:
      typeof charge?.commissionPercent === "number" ? charge.commissionPercent : null,
    commissionToman: Number(charge?.commissionToman ?? 0),
    cardNumber: charge?.bankCard?.cardNumber
      ? String(charge.bankCard.cardNumber).replace(/\D/g, "") || null
      : null,
    cardBankName: charge?.bankCard?.bankName ?? null,
    cardOwnerName: charge?.bankCard?.ownerName ?? null,
    chargeStatus: charge?.status ?? null,
    chargeCreatedAt: charge?.createdAt?.toISOString() ?? null,
  };
}

export type ShopTransactionDto = ReturnType<typeof serializeShopTransaction>;
export type ShopLedgerItemDto = ReturnType<typeof serializeShopLedgerItem>;

const ledgerChargeInclude = {
  where: { kind: "merchant_invoice" as const },
  orderBy: [{ paidAt: "desc" as const }, { createdAt: "desc" as const }],
  take: 1,
  include: {
    user: {
      select: {
        telegramId: true,
        username: true,
        firstName: true,
        lastName: true,
      },
    },
    gateway: { select: { displayName: true } },
    bankCard: {
      select: {
        cardNumber: true,
        bankName: true,
        bankSlug: true,
        ownerName: true,
      },
    },
  },
};

async function expireStaleOpenLinks(shopId: number): Promise<void> {
  const now = new Date();
  await prisma.merchantPaymentLink.updateMany({
    where: {
      shopId,
      status: "open",
      expiresAt: { lt: now },
    },
    data: { status: "expired" },
  });
}

async function resolveTrxRatesForCharges(
  rows: ChargeWithLink[],
): Promise<Map<number, number>> {
  const out = new Map<number, number>();
  const needLookup: ChargeWithLink[] = [];

  for (const row of rows) {
    if (typeof row.trxRateToman === "number" && row.trxRateToman > 0) {
      out.set(row.id, row.trxRateToman);
    } else {
      needLookup.push(row);
    }
  }

  if (needLookup.length === 0) return out;

  let liveFallback: number | null = null;
  try {
    const live = await getAssetRateToman("trx");
    liveFallback = live > 0 ? live : null;
  } catch {
    liveFallback = null;
  }

  await Promise.all(
    needLookup.map(async (row) => {
      const at = row.paidAt ?? row.createdAt;
      const unix = Math.floor(at.getTime() / 1000);
      let rate = await getAssetRateTomanNearTime("trx", unix);
      if (!(rate != null && rate > 0)) rate = liveFallback;
      if (rate != null && rate > 0) out.set(row.id, rate);
    }),
  );

  return out;
}

/** List merchant_invoice charges for a shop (default: completed only). */
export async function listShopTransactions(
  shopId: number,
  options?: { status?: ShopTxStatus | "all"; take?: number },
): Promise<ShopTransactionDto[]> {
  const take = Math.min(200, Math.max(1, options?.take ?? 100));
  const statusOpt = options?.status ?? "completed";

  const where: Prisma.GatewayChargeWhereInput = {
    kind: "merchant_invoice",
    merchantPaymentLink: { shopId },
  };

  if (statusOpt === "failed") {
    where.status = { in: ["failed", "cancelled"] };
  } else if (statusOpt === "completed" || statusOpt === "pending") {
    where.status = statusOpt;
  }

  const rows = await prisma.gatewayCharge.findMany({
    where,
    include: {
      merchantPaymentLink: true,
      user: {
        select: {
          telegramId: true,
          username: true,
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
    take,
  });

  const rates = await resolveTrxRatesForCharges(rows);
  return rows.map((row) => serializeShopTransaction(row, rates.get(row.id) ?? null));
}

/** All shop invoices (manual + API), any status — for the transactions page. */
export async function listShopLedger(
  shopId: number,
  options?: { take?: number },
): Promise<ShopLedgerItemDto[]> {
  const take = Math.min(500, Math.max(1, options?.take ?? 200));
  await expireStaleOpenLinks(shopId);

  const rows = await prisma.merchantPaymentLink.findMany({
    where: { shopId },
    include: { gatewayCharges: ledgerChargeInclude },
    orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
    take,
  });

  const chargeRows: ChargeWithLink[] = [];
  for (const row of rows) {
    const charge = row.gatewayCharges[0];
    if (!charge) continue;
    chargeRows.push({
      ...charge,
      merchantPaymentLink: row,
      user: charge.user ?? null,
    });
  }

  const rates = await resolveTrxRatesForCharges(chargeRows);
  return rows.map((row) => {
    const charge = row.gatewayCharges[0];
    const rate = charge ? rates.get(charge.id) ?? null : null;
    return serializeShopLedgerItem(row, rate);
  });
}

export async function getShopLedgerItem(
  shopId: number,
  linkId: number,
): Promise<ShopLedgerItemDto | null> {
  await expireStaleOpenLinks(shopId);

  const row = await prisma.merchantPaymentLink.findFirst({
    where: { id: linkId, shopId },
    include: { gatewayCharges: ledgerChargeInclude },
  });
  if (!row) return null;

  const charge = row.gatewayCharges[0];
  let rate: number | null = null;
  if (charge) {
    const rates = await resolveTrxRatesForCharges([
      { ...charge, merchantPaymentLink: row },
    ]);
    rate = rates.get(charge.id) ?? null;
  }
  return serializeShopLedgerItem(row, rate);
}

function startOfLocalDay(d = new Date()): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export async function computeShopTxStats(shopId: number) {
  const todayStart = startOfLocalDay();
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 6);

  const [todayCompleted, weekCompleted, weekAll] = await Promise.all([
    prisma.gatewayCharge.findMany({
      where: {
        kind: "merchant_invoice",
        status: "completed",
        merchantPaymentLink: { shopId },
        paidAt: { gte: todayStart },
      },
      select: {
        invoiceAmountToman: true,
        amountToman: true,
        merchantPaymentLink: { select: { amountToman: true } },
      },
    }),
    prisma.gatewayCharge.findMany({
      where: {
        kind: "merchant_invoice",
        status: "completed",
        merchantPaymentLink: { shopId },
        paidAt: { gte: weekStart },
      },
      select: {
        invoiceAmountToman: true,
        amountToman: true,
        merchantPaymentLink: { select: { amountToman: true } },
      },
    }),
    prisma.gatewayCharge.count({
      where: {
        kind: "merchant_invoice",
        merchantPaymentLink: { shopId },
        createdAt: { gte: weekStart },
      },
    }),
  ]);

  const sumInvoice = (
    rows: Array<{
      invoiceAmountToman: bigint | null;
      amountToman: bigint;
      merchantPaymentLink: { amountToman: bigint } | null;
    }>,
  ) =>
    rows.reduce((acc, r) => {
      const n = Number(
        r.invoiceAmountToman ?? r.merchantPaymentLink?.amountToman ?? 0,
      );
      return acc + (Number.isFinite(n) ? n : 0);
    }, 0);

  const todayVolumeToman = sumInvoice(todayCompleted);
  const todayCount = todayCompleted.length;
  const weekVolumeToman = sumInvoice(weekCompleted);
  const weekCount = weekCompleted.length;
  const successRate =
    weekAll > 0 ? Math.round((weekCount / weekAll) * 1000) / 10 : 0;

  const [pendingAgg, lifetimeAgg] = await Promise.all([
    prisma.gatewayCharge.aggregate({
      where: {
        kind: "merchant_invoice",
        status: "pending",
        merchantPaymentLink: { shopId },
      },
      _sum: { invoiceAmountToman: true },
    }),
    prisma.gatewayCharge.aggregate({
      where: {
        kind: "merchant_invoice",
        status: "completed",
        merchantPaymentLink: { shopId },
      },
      _count: true,
      _sum: { invoiceAmountToman: true },
    }),
  ]);

  return {
    todayVolumeToman,
    todayCount,
    weekVolumeToman,
    weekCount,
    successRate,
    pendingToman: Number(pendingAgg._sum.invoiceAmountToman ?? 0),
    totalCount: lifetimeAgg._count,
    totalVolumeToman: Number(lifetimeAgg._sum.invoiceAmountToman ?? 0),
  };
}

function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function invoiceAmountOf(row: {
  invoiceAmountToman: bigint | null;
  merchantPaymentLink: { amountToman: bigint } | null;
}): number {
  const n = Number(
    row.invoiceAmountToman ?? row.merchantPaymentLink?.amountToman ?? 0,
  );
  return Number.isFinite(n) ? n : 0;
}

/** Rich stats payload for merchant /shop/stats page. */
export async function computeShopStatsPage(shopId: number) {
  const todayStart = startOfLocalDay();
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const monthStart = new Date(todayStart);
  monthStart.setDate(monthStart.getDate() - 29);

  const base = await computeShopTxStats(shopId);

  const [monthRows, yesterdayRows, linkStatusGroups, sourceGroups] =
    await Promise.all([
      prisma.gatewayCharge.findMany({
        where: {
          kind: "merchant_invoice",
          status: "completed",
          paidAt: { gte: monthStart },
          merchantPaymentLink: { shopId },
        },
        select: {
          paidAt: true,
          invoiceAmountToman: true,
          merchantPaymentLink: { select: { amountToman: true } },
        },
      }),
      prisma.gatewayCharge.findMany({
        where: {
          kind: "merchant_invoice",
          status: "completed",
          paidAt: { gte: yesterdayStart, lt: todayStart },
          merchantPaymentLink: { shopId },
        },
        select: {
          invoiceAmountToman: true,
          merchantPaymentLink: { select: { amountToman: true } },
        },
      }),
      prisma.merchantPaymentLink.groupBy({
        by: ["status"],
        where: { shopId },
        _count: { _all: true },
        _sum: { amountToman: true },
      }),
      prisma.merchantPaymentLink.groupBy({
        by: ["source"],
        where: { shopId, status: "paid" },
        _count: { _all: true },
        _sum: { amountToman: true },
      }),
    ]);

  const byDay = new Map<string, { volumeToman: number; count: number }>();
  for (const row of monthRows) {
    if (!row.paidAt) continue;
    const key = dayKey(row.paidAt);
    const cur = byDay.get(key) ?? { volumeToman: 0, count: 0 };
    cur.volumeToman += invoiceAmountOf(row);
    cur.count += 1;
    byDay.set(key, cur);
  }

  const daily: Array<{
    date: string;
    weekday: number;
    volumeToman: number;
    count: number;
  }> = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(todayStart);
    d.setDate(d.getDate() - i);
    const key = dayKey(d);
    const cur = byDay.get(key) ?? { volumeToman: 0, count: 0 };
    daily.push({
      date: key,
      weekday: d.getDay(),
      volumeToman: cur.volumeToman,
      count: cur.count,
    });
  }

  const monthVolumeToman = monthRows.reduce(
    (acc, row) => acc + invoiceAmountOf(row),
    0,
  );
  const monthCount = monthRows.length;
  const yesterdayVolumeToman = yesterdayRows.reduce(
    (acc, row) => acc + invoiceAmountOf(row),
    0,
  );
  const yesterdayCount = yesterdayRows.length;

  const statusMap: Record<string, { count: number; volumeToman: number }> = {};
  let invoiceTotalCount = 0;
  for (const g of linkStatusGroups) {
    statusMap[g.status] = {
      count: g._count._all,
      volumeToman: Number(g._sum.amountToman ?? 0),
    };
    invoiceTotalCount += g._count._all;
  }

  let manualCount = 0;
  let manualVolumeToman = 0;
  let apiCount = 0;
  let apiVolumeToman = 0;
  for (const g of sourceGroups) {
    const count = g._count._all;
    const volume = Number(g._sum.amountToman ?? 0);
    if (g.source === "api") {
      apiCount += count;
      apiVolumeToman += volume;
    } else {
      manualCount += count;
      manualVolumeToman += volume;
    }
  }

  const paidCount = statusMap.paid?.count ?? 0;
  const avgTicketToman =
    base.totalCount > 0
      ? Math.round(base.totalVolumeToman / base.totalCount)
      : 0;
  const conversionRate =
    invoiceTotalCount > 0
      ? Math.round((paidCount / invoiceTotalCount) * 1000) / 10
      : 0;

  return {
    ...base,
    yesterdayVolumeToman,
    yesterdayCount,
    monthVolumeToman,
    monthCount,
    avgTicketToman,
    conversionRate,
    invoiceTotalCount,
    daily,
    sources: {
      manual: { count: manualCount, volumeToman: manualVolumeToman },
      api: { count: apiCount, volumeToman: apiVolumeToman },
    },
    invoices: {
      open: statusMap.open ?? { count: 0, volumeToman: 0 },
      paid: statusMap.paid ?? { count: 0, volumeToman: 0 },
      expired: statusMap.expired ?? { count: 0, volumeToman: 0 },
      cancelled: statusMap.cancelled ?? { count: 0, volumeToman: 0 },
    },
  };
}
