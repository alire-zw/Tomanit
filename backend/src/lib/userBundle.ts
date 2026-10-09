import type { MerchantShop, User } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import { serializeUser, serializeWallet } from "../middleware/auth.js";
import {
  writeMeCache,
  type MeCachePayload,
  type MeShopHub,
  type MeTicketSummary,
} from "./meCache.js";
import { computeShopSettlementBalance } from "./merchantSettlement.js";
import { computeShopTxStats, listShopTransactions } from "./shopTransactions.js";

export function emptyShopHub(): MeShopHub {
  return {
    shop: null,
    balance: {
      availableToman: 0,
      pendingToman: 0,
      totalSettledToman: 0,
      nextUnlockAt: null,
    },
    stats: {
      todayVolumeToman: 0,
      todayCount: 0,
      weekVolumeToman: 0,
      weekCount: 0,
      successRate: 0,
      totalCount: 0,
      totalVolumeToman: 0,
    },
    recentTransactions: [],
  };
}

export function serializeMerchantShop(shop: MerchantShop) {
  return {
    id: String(shop.id),
    name: shop.name,
    sellType: shop.sellType,
    dailyAmountToman: Number(shop.dailyAmountToman),
    dailyCount: shop.dailyCount,
    channel: shop.channel,
    siteUrl: shop.siteUrl,
    botUrl: shop.botUrl,
    logoDataUrl: shop.logoData,
    invoiceTheme: shop.invoiceTheme || "teal",
    feeBearer: shop.feeBearer || "payer",
    status: shop.status,
    reviewNote: shop.reviewNote,
    reviewedAt: shop.reviewedAt?.toISOString() ?? null,
    createdAt: shop.createdAt.toISOString(),
    updatedAt: shop.updatedAt.toISOString(),
  };
}

export async function loadUserTickets(userId: number): Promise<MeTicketSummary[]> {
  const tickets = await prisma.supportTicket.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    include: {
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  return tickets.map((t) => ({
    id: String(t.id),
    code: t.code,
    subject: t.subject,
    status: t.status,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    lastMessage: t.messages[0]
      ? {
          sender: t.messages[0].sender,
          body: t.messages[0].body,
          createdAt: t.messages[0].createdAt.toISOString(),
        }
      : null,
  }));
}

export async function loadUserShopHub(userId: number): Promise<MeShopHub> {
  const shop = await prisma.merchantShop.findUnique({ where: { userId } });
  const hub = emptyShopHub();
  if (!shop) return hub;

  hub.shop = serializeMerchantShop(shop);

  const [recent, stats, settlementBalance] = await Promise.all([
    listShopTransactions(shop.id, { status: "completed", take: 8 }),
    computeShopTxStats(shop.id),
    computeShopSettlementBalance(shop.id),
  ]);
  hub.recentTransactions = recent;
  hub.stats = {
    todayVolumeToman: stats.todayVolumeToman,
    todayCount: stats.todayCount,
    weekVolumeToman: stats.weekVolumeToman,
    weekCount: stats.weekCount,
    successRate: stats.successRate,
    totalCount: stats.totalCount,
    totalVolumeToman: stats.totalVolumeToman,
  };
  hub.balance.availableToman = settlementBalance.availableToman;
  hub.balance.pendingToman = settlementBalance.pendingToman;
  hub.balance.totalSettledToman = settlementBalance.totalSettledToman;
  hub.balance.nextUnlockAt = settlementBalance.nextUnlockAt?.toISOString() ?? null;
  return hub;
}

/** Build user+wallet+tickets+shop and store in Redis (10 min). */
export async function buildAndCacheMeBundle(
  user: User,
): Promise<Omit<MeCachePayload, "cachedAt">> {
  const [walletRow, tickets, shop] = await Promise.all([
    prisma.wallet.findUnique({ where: { userId: user.id } }).then(
      async (w) => w ?? prisma.wallet.create({ data: { userId: user.id } }),
    ),
    loadUserTickets(user.id),
    loadUserShopHub(user.id),
  ]);

  const payload = {
    ok: true as const,
    user: serializeUser(user) as Record<string, unknown>,
    wallet: serializeWallet(walletRow) as Record<string, unknown>,
    tickets,
    shop,
  };

  await writeMeCache(user.telegramId, payload);
  return payload;
}
