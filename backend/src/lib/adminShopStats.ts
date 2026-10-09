import { prisma } from "../db/prisma.js";

function startOfLocalDay(d = new Date()): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function n(v: bigint | number | null | undefined): number {
  const x = Number(v ?? 0);
  return Number.isFinite(x) ? x : 0;
}

type MoneyBucket = { count: number; volumeToman: number };

function emptyBucket(): MoneyBucket {
  return { count: 0, volumeToman: 0 };
}

type DayAgg = {
  volumeToman: number;
  count: number;
  feeToman: number;
  commissionToman: number;
  profitToman: number;
};

function emptyDay(): DayAgg {
  return {
    volumeToman: 0,
    count: 0,
    feeToman: 0,
    commissionToman: 0,
    profitToman: 0,
  };
}

/** Platform-wide merchant shop analytics for admin. */
export async function computeAdminShopStatsPage() {
  const todayStart = startOfLocalDay();
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 6);
  const monthStart = new Date(todayStart);
  monthStart.setDate(monthStart.getDate() - 29);

  const merchantWhere = {
    kind: "merchant_invoice" as const,
    status: "completed" as const,
  };

  const [
    shopStatusGroups,
    settlementStatusGroups,
    lifetimeAgg,
    monthRows,
    yesterdayRows,
    todayPendingAgg,
    linkStatusGroups,
    sourceGroups,
    topShopGroups,
  ] = await Promise.all([
    prisma.merchantShop.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.merchantShopSettlement.groupBy({
      by: ["status"],
      _count: { _all: true },
      _sum: { amountToman: true },
    }),
    prisma.gatewayCharge.aggregate({
      where: merchantWhere,
      _count: { _all: true },
      _sum: {
        invoiceAmountToman: true,
        feeToman: true,
        commissionToman: true,
        amountToman: true,
      },
    }),
    prisma.gatewayCharge.findMany({
      where: {
        ...merchantWhere,
        paidAt: { gte: monthStart },
      },
      select: {
        paidAt: true,
        invoiceAmountToman: true,
        feeToman: true,
        commissionToman: true,
        amountToman: true,
        merchantPaymentLink: {
          select: { amountToman: true, source: true, shopId: true },
        },
      },
    }),
    prisma.gatewayCharge.findMany({
      where: {
        ...merchantWhere,
        paidAt: { gte: yesterdayStart, lt: todayStart },
      },
      select: {
        invoiceAmountToman: true,
        feeToman: true,
        commissionToman: true,
        merchantPaymentLink: { select: { amountToman: true } },
      },
    }),
    prisma.gatewayCharge.aggregate({
      where: {
        kind: "merchant_invoice",
        status: "pending",
      },
      _sum: { invoiceAmountToman: true },
      _count: { _all: true },
    }),
    prisma.merchantPaymentLink.groupBy({
      by: ["status"],
      _count: { _all: true },
      _sum: { amountToman: true },
    }),
    prisma.merchantPaymentLink.groupBy({
      by: ["source"],
      where: { status: "paid" },
      _count: { _all: true },
      _sum: { amountToman: true },
    }),
    prisma.merchantPaymentLink.groupBy({
      by: ["shopId"],
      where: { status: "paid" },
      _count: { _all: true },
      _sum: { amountToman: true },
      orderBy: { _sum: { amountToman: "desc" } },
      take: 8,
    }),
  ]);

  const shopCounts = {
    total: 0,
    active: 0,
    pending: 0,
    rejected: 0,
    suspended: 0,
  };
  for (const g of shopStatusGroups) {
    const c = g._count._all;
    shopCounts.total += c;
    if (g.status === "active") shopCounts.active = c;
    else if (g.status === "pending") shopCounts.pending = c;
    else if (g.status === "rejected") shopCounts.rejected = c;
    else if (g.status === "suspended") shopCounts.suspended = c;
  }

  const settlements = {
    requested: emptyBucket(),
    processing: emptyBucket(),
    paid: emptyBucket(),
    rejected: emptyBucket(),
  };
  for (const g of settlementStatusGroups) {
    const bucket = {
      count: g._count._all,
      volumeToman: n(g._sum.amountToman),
    };
    if (g.status === "requested") settlements.requested = bucket;
    else if (g.status === "processing") settlements.processing = bucket;
    else if (g.status === "paid") settlements.paid = bucket;
    else if (g.status === "rejected") settlements.rejected = bucket;
  }

  const sumRow = (row: {
    invoiceAmountToman: bigint | null;
    feeToman: bigint;
    commissionToman: bigint;
    merchantPaymentLink: { amountToman: bigint } | null;
  }) => {
    const volume = n(
      row.invoiceAmountToman ?? row.merchantPaymentLink?.amountToman,
    );
    const fee = n(row.feeToman);
    const commission = n(row.commissionToman);
    return {
      volume,
      fee,
      commission,
      profit: fee - commission,
    };
  };

  const byDay = new Map<string, DayAgg>();
  let monthVolume = 0;
  let monthCount = 0;
  let monthFee = 0;
  let monthCommission = 0;
  let weekVolume = 0;
  let weekCount = 0;
  let weekFee = 0;
  let weekCommission = 0;
  let todayVolume = 0;
  let todayCount = 0;
  let todayFee = 0;
  let todayCommission = 0;

  for (const row of monthRows) {
    if (!row.paidAt) continue;
    const { volume, fee, commission, profit } = sumRow(row);
    const key = dayKey(row.paidAt);
    const cur = byDay.get(key) ?? emptyDay();
    cur.volumeToman += volume;
    cur.count += 1;
    cur.feeToman += fee;
    cur.commissionToman += commission;
    cur.profitToman += profit;
    byDay.set(key, cur);

    monthVolume += volume;
    monthCount += 1;
    monthFee += fee;
    monthCommission += commission;

    if (row.paidAt >= weekStart) {
      weekVolume += volume;
      weekCount += 1;
      weekFee += fee;
      weekCommission += commission;
    }
    if (row.paidAt >= todayStart) {
      todayVolume += volume;
      todayCount += 1;
      todayFee += fee;
      todayCommission += commission;
    }
  }

  let yesterdayVolume = 0;
  let yesterdayCount = 0;
  let yesterdayFee = 0;
  let yesterdayCommission = 0;
  for (const row of yesterdayRows) {
    const { volume, fee, commission } = sumRow(row);
    yesterdayVolume += volume;
    yesterdayCount += 1;
    yesterdayFee += fee;
    yesterdayCommission += commission;
  }

  const daily: Array<{
    date: string;
    weekday: number;
    volumeToman: number;
    count: number;
    feeToman: number;
    commissionToman: number;
    profitToman: number;
  }> = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(todayStart);
    d.setDate(d.getDate() - i);
    const key = dayKey(d);
    const cur = byDay.get(key) ?? emptyDay();
    daily.push({
      date: key,
      weekday: d.getDay(),
      ...cur,
    });
  }

  const totalVolume = n(lifetimeAgg._sum.invoiceAmountToman);
  const totalCount = lifetimeAgg._count._all;
  const totalFee = n(lifetimeAgg._sum.feeToman);
  const totalCommission = n(lifetimeAgg._sum.commissionToman);
  const totalCharged = n(lifetimeAgg._sum.amountToman);
  const totalProfit = totalFee - totalCommission;
  const avgTicket = totalCount > 0 ? Math.round(totalVolume / totalCount) : 0;

  const statusMap: Record<string, MoneyBucket> = {};
  let invoiceTotalCount = 0;
  for (const g of linkStatusGroups) {
    statusMap[g.status] = {
      count: g._count._all,
      volumeToman: n(g._sum.amountToman),
    };
    invoiceTotalCount += g._count._all;
  }
  const paidCount = statusMap.paid?.count ?? 0;
  const conversionRate =
    invoiceTotalCount > 0
      ? Math.round((paidCount / invoiceTotalCount) * 1000) / 10
      : 0;

  let manualCount = 0;
  let manualVolume = 0;
  let apiCount = 0;
  let apiVolume = 0;
  for (const g of sourceGroups) {
    if (g.source === "api") {
      apiCount += g._count._all;
      apiVolume += n(g._sum.amountToman);
    } else {
      manualCount += g._count._all;
      manualVolume += n(g._sum.amountToman);
    }
  }

  const topShopIds = topShopGroups.map((g) => g.shopId);
  const topShopRows =
    topShopIds.length > 0
      ? await prisma.merchantShop.findMany({
          where: { id: { in: topShopIds } },
          select: {
            id: true,
            name: true,
            status: true,
            logoData: true,
            user: {
              select: {
                telegramId: true,
                username: true,
                fullName: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        })
      : [];
  const shopById = new Map(topShopRows.map((s) => [s.id, s]));

  // Fee/commission per top shop from monthRows (faster than extra queries).
  const shopMoney = new Map<
    number,
    { volume: number; count: number; fee: number; commission: number }
  >();
  for (const row of monthRows) {
    const shopId = row.merchantPaymentLink?.shopId;
    if (shopId == null) continue;
    const { volume, fee, commission } = sumRow(row);
    const cur = shopMoney.get(shopId) ?? {
      volume: 0,
      count: 0,
      fee: 0,
      commission: 0,
    };
    cur.volume += volume;
    cur.count += 1;
    cur.fee += fee;
    cur.commission += commission;
    shopMoney.set(shopId, cur);
  }

  const topShops = topShopGroups.map((g) => {
    const shop = shopById.get(g.shopId);
    const money = shopMoney.get(g.shopId);
    const u = shop?.user;
    const owner =
      u?.fullName?.trim() ||
      (u?.username ? `@${u.username}` : null) ||
      [u?.firstName, u?.lastName].filter(Boolean).join(" ").trim() ||
      u?.telegramId ||
      "—";
    return {
      id: String(g.shopId),
      name: shop?.name ?? `Shop #${g.shopId}`,
      status: shop?.status ?? "active",
      logoDataUrl: shop?.logoData ?? null,
      owner,
      count: money?.count ?? g._count._all,
      volumeToman: money?.volume ?? n(g._sum.amountToman),
      feeToman: money?.fee ?? 0,
      commissionToman: money?.commission ?? 0,
      profitToman: (money?.fee ?? 0) - (money?.commission ?? 0),
    };
  });

  return {
    shops: shopCounts,
    settlements: {
      ...settlements,
      pendingVolumeToman:
        settlements.requested.volumeToman + settlements.processing.volumeToman,
      pendingCount:
        settlements.requested.count + settlements.processing.count,
    },
    stats: {
      todayVolumeToman: todayVolume,
      todayCount,
      todayFeeToman: todayFee,
      todayCommissionToman: todayCommission,
      todayProfitToman: todayFee - todayCommission,
      yesterdayVolumeToman: yesterdayVolume,
      yesterdayCount,
      yesterdayFeeToman: yesterdayFee,
      yesterdayCommissionToman: yesterdayCommission,
      yesterdayProfitToman: yesterdayFee - yesterdayCommission,
      weekVolumeToman: weekVolume,
      weekCount,
      weekFeeToman: weekFee,
      weekCommissionToman: weekCommission,
      weekProfitToman: weekFee - weekCommission,
      monthVolumeToman: monthVolume,
      monthCount,
      monthFeeToman: monthFee,
      monthCommissionToman: monthCommission,
      monthProfitToman: monthFee - monthCommission,
      totalVolumeToman: totalVolume,
      totalCount,
      totalFeeToman: totalFee,
      totalCommissionToman: totalCommission,
      totalProfitToman: totalProfit,
      totalChargedToman: totalCharged,
      avgTicketToman: avgTicket,
      conversionRate,
      invoiceTotalCount,
      pendingInvoiceCount: todayPendingAgg._count._all,
      pendingInvoiceToman: n(todayPendingAgg._sum.invoiceAmountToman),
      daily,
      sources: {
        manual: { count: manualCount, volumeToman: manualVolume },
        api: { count: apiCount, volumeToman: apiVolume },
      },
      invoices: {
        open: statusMap.open ?? emptyBucket(),
        paid: statusMap.paid ?? emptyBucket(),
        expired: statusMap.expired ?? emptyBucket(),
        cancelled: statusMap.cancelled ?? emptyBucket(),
      },
      topShops,
    },
  };
}
