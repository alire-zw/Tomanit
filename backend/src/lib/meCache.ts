import { redis } from "../db/redis.js";
import { log } from "./log.js";

/** Session bundle TTL — first /me fills Redis; pages stay fast for 10 minutes. */
const ME_TTL_SEC = 10 * 60;

export type MeTicketSummary = {
  id: string;
  code: string;
  subject: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  lastMessage?: {
    sender: string;
    body: string;
    createdAt: string;
  } | null;
};

export type MeShopHub = {
  shop: Record<string, unknown> | null;
  balance: {
    availableToman: number;
    pendingToman: number;
    totalSettledToman: number;
    /** ISO time when the next held credit unlocks for settlement */
    nextUnlockAt: string | null;
  };
  stats: {
    todayVolumeToman: number;
    todayCount: number;
    weekVolumeToman: number;
    weekCount: number;
    successRate: number;
    totalCount: number;
    totalVolumeToman: number;
  };
  recentTransactions: unknown[];
};

export type MeCachePayload = {
  ok: true;
  user: Record<string, unknown>;
  wallet: Record<string, unknown>;
  tickets: MeTicketSummary[];
  shop: MeShopHub;
  cachedAt: string;
};

function meKey(telegramId: string): string {
  return `tomanit:me:${telegramId}`;
}

export async function readMeCache(
  telegramId: string,
): Promise<MeCachePayload | null> {
  try {
    const raw = await redis.get(meKey(telegramId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MeCachePayload;
    if (!parsed?.user || !parsed?.wallet) return null;
    if (!Array.isArray(parsed.tickets)) parsed.tickets = [];
    if (!parsed.shop) {
      parsed.shop = {
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
    return parsed;
  } catch {
    return null;
  }
}

export async function writeMeCache(
  telegramId: string,
  payload: Omit<MeCachePayload, "cachedAt">,
): Promise<void> {
  try {
    const body: MeCachePayload = {
      ...payload,
      tickets: payload.tickets ?? [],
      shop: payload.shop,
      cachedAt: new Date().toISOString(),
    };
    await redis.set(meKey(telegramId), JSON.stringify(body), "EX", ME_TTL_SEC);
  } catch (err) {
    log.warn("cache", err instanceof Error ? err.message : String(err));
  }
}

/** Refresh TTL after a section patch without rebuilding everything. */
export async function touchMeCache(telegramId: string): Promise<void> {
  try {
    await redis.expire(meKey(telegramId), ME_TTL_SEC);
  } catch {
    // ignore
  }
}

export async function patchMeCacheTickets(
  telegramId: string,
  tickets: MeTicketSummary[],
): Promise<void> {
  const cached = await readMeCache(telegramId);
  if (!cached) return;
  await writeMeCache(telegramId, {
    ok: true,
    user: cached.user,
    wallet: cached.wallet,
    tickets,
    shop: cached.shop,
  });
}

export async function patchMeCacheShop(
  telegramId: string,
  shop: MeShopHub,
): Promise<void> {
  const cached = await readMeCache(telegramId);
  if (!cached) return;
  await writeMeCache(telegramId, {
    ok: true,
    user: cached.user,
    wallet: cached.wallet,
    tickets: cached.tickets,
    shop,
  });
}

export async function invalidateMeCache(telegramId: string): Promise<void> {
  try {
    await redis.del(meKey(telegramId));
    log.event("cache", `me invalidate tg:${telegramId}`);
  } catch {
    // ignore
  }
}

export async function invalidateMeCacheByUserId(userId: number): Promise<void> {
  try {
    const { prisma } = await import("../db/prisma.js");
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { telegramId: true },
    });
    if (user?.telegramId) {
      await invalidateMeCache(user.telegramId);
    }
  } catch {
    // ignore
  }
}
