import type { KycLevel, Wallet } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import { tehranParts } from "./gatewayRouting.js";
import { getAssetRateToman, getWalletRates } from "./swapwallet.js";
import { getAsset, type AssetId } from "./walletAssets.js";

function readCryptoBalance(wallet: Wallet, asset: Exclude<AssetId, "toman">): number {
  switch (asset) {
    case "trx":
      return wallet.trxBalance;
    case "usdt":
      return wallet.usdtBalance;
    case "bnb":
      return wallet.bnbBalance;
    case "matic":
      return wallet.maticBalance;
    case "gram":
      return wallet.gramBalance;
    default:
      return 0;
  }
}

/** 72 hours after a rial (toman) deposit, crypto withdraw is restricted. */
export const RIAL_CRYPTO_LOCK_MS = 72 * 60 * 60 * 1000;

const FIAT_PAYMENT_METHODS = [
  "card_transfer",
  "sheba_transfer",
  "payment_gateway",
  "manual",
] as const;

export type KycLimits = {
  dailyToman: number;
  monthlyToman: number;
  /** Instant crypto-withdraw credit during the 72h rial lock (IRT). */
  instantCreditToman: number;
};

/** Limits by KYC level (toman). Matches product + terms. */
export const KYC_WITHDRAW_LIMITS: Record<KycLevel, KycLimits> = {
  none: {
    dailyToman: 500_000,
    monthlyToman: 5_000_000,
    /** Base level: same as daily cap (shown as instant 72h credit). */
    instantCreditToman: 500_000,
  },
  basic: {
    dailyToman: 5_000_000,
    monthlyToman: 100_000_000,
    instantCreditToman: 500_000,
  },
  advanced: {
    dailyToman: 50_000_000,
    monthlyToman: 1_000_000_000,
    instantCreditToman: 5_000_000,
  },
};

export function limitsForKyc(level: KycLevel | null | undefined): KycLimits {
  return KYC_WITHDRAW_LIMITS[level ?? "none"] ?? KYC_WITHDRAW_LIMITS.none;
}

function tehranDayStartUtc(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00.000+03:30`);
}

function addTehranDays(dateKey: string, days: number): string {
  const base = tehranDayStartUtc(dateKey).getTime();
  return tehranParts(new Date(base + days * 24 * 60 * 60 * 1000)).dateKey;
}

/** Start of current Tehran calendar day (UTC Date). */
export function tehranTodayStart(): Date {
  return tehranDayStartUtc(tehranParts().dateKey);
}

/** Start of the Tehran day that is 29 days before today (rolling 30-day window). */
export function tehranRolling30dStart(): Date {
  const today = tehranParts().dateKey;
  return tehranDayStartUtc(addTehranDays(today, -29));
}

function tomanToUsdt(toman: number, usdtRate: number): number {
  if (!(usdtRate > 0) || !Number.isFinite(toman)) return 0;
  return toman / usdtRate;
}

function clampNonNeg(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

async function sumWithdrawToman(
  userId: number,
  since: Date,
): Promise<number> {
  const rows = await prisma.walletTransaction.findMany({
    where: {
      userId,
      type: "withdraw",
      status: { in: ["completed", "processing", "pending"] },
      createdAt: { gte: since },
    },
    select: { amountToman: true, amount: true, asset: true, unitPriceToman: true },
  });

  let total = 0;
  for (const row of rows) {
    if (typeof row.amountToman === "number" && Number.isFinite(row.amountToman)) {
      total += row.amountToman;
      continue;
    }
    if (row.asset === "toman") {
      total += row.amount;
      continue;
    }
    if (
      typeof row.unitPriceToman === "number" &&
      Number.isFinite(row.unitPriceToman)
    ) {
      total += row.amount * row.unitPriceToman;
    }
  }
  return total;
}

async function latestRialDepositAt(userId: number): Promise<Date | null> {
  const row = await prisma.walletTransaction.findFirst({
    where: {
      userId,
      type: "deposit",
      asset: "toman",
      status: "completed",
      OR: [
        { paymentMethod: { in: [...FIAT_PAYMENT_METHODS] } },
        { paymentMethod: null },
      ],
    },
    orderBy: { completedAt: "desc" },
    select: { completedAt: true, createdAt: true },
  });
  if (!row) return null;
  return row.completedAt ?? row.createdAt;
}

export type WithdrawLimitsSnapshot = {
  asset: Exclude<AssetId, "toman">;
  symbol: string;
  kycLevel: KycLevel;
  balance: number;
  balanceToman: number;
  withdrawable: number;
  withdrawableToman: number;
  unitPriceToman: number;
  usdtRate: number;
  lock: {
    active: boolean;
    until: string | null;
    depositAt: string | null;
    instantCreditTotalToman: number;
    instantCreditRemainingToman: number;
    instantCreditUsedToman: number;
  };
  daily: {
    limitToman: number;
    usedToman: number;
    remainingToman: number;
    limitUsdt: number;
    usedUsdt: number;
    remainingUsdt: number;
  };
  monthly: {
    limitToman: number;
    usedToman: number;
    remainingToman: number;
    limitUsdt: number;
    usedUsdt: number;
    remainingUsdt: number;
  };
  needsKycUpgrade: boolean;
};

export async function getWithdrawLimitsSnapshot(
  userId: number,
  asset: Exclude<AssetId, "toman">,
): Promise<WithdrawLimitsSnapshot> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { kycLevel: true },
  });
  const kycLevel = user?.kycLevel ?? "none";
  const caps = limitsForKyc(kycLevel);

  let wallet = await prisma.wallet.findUnique({ where: { userId } });
  if (!wallet) {
    wallet = await prisma.wallet.create({ data: { userId } });
  }
  const balance = readCryptoBalance(wallet, asset);

  let unitPriceToman = 0;
  try {
    unitPriceToman = await getAssetRateToman(asset);
  } catch {
    unitPriceToman = 0;
  }
  const balanceToman = unitPriceToman > 0 ? balance * unitPriceToman : 0;

  const rates = await getWalletRates();
  const usdtRate = rates.rates.usdt > 0 ? rates.rates.usdt : 0;

  const dayStart = tehranTodayStart();
  const monthStart = tehranRolling30dStart();
  const [usedDaily, usedMonthly] = await Promise.all([
    sumWithdrawToman(userId, dayStart),
    sumWithdrawToman(userId, monthStart),
  ]);

  const remainingDailyToman = clampNonNeg(caps.dailyToman - usedDaily);
  const remainingMonthlyToman = clampNonNeg(caps.monthlyToman - usedMonthly);

  const depositAt = await latestRialDepositAt(userId);
  let lockActive = false;
  let lockUntil: Date | null = null;
  if (depositAt) {
    const until = new Date(depositAt.getTime() + RIAL_CRYPTO_LOCK_MS);
    if (until.getTime() > Date.now()) {
      lockActive = true;
      lockUntil = until;
    }
  }

  // Instant credit usage tracks today's withdraws (same window as daily).
  // During an active 72h rial lock, also count from the deposit moment.
  let instantUsed = usedDaily;
  if (lockActive && depositAt && depositAt.getTime() < dayStart.getTime()) {
    instantUsed = await sumWithdrawToman(userId, depositAt);
  }
  const instantTotal = caps.instantCreditToman;
  const instantRemaining = clampNonNeg(instantTotal - instantUsed);

  // Daily / monthly always apply. Instant credit caps only during 72h rial lock.
  let withdrawableToman = Math.min(
    balanceToman,
    remainingDailyToman,
    remainingMonthlyToman,
  );
  if (lockActive) {
    withdrawableToman = Math.min(withdrawableToman, instantRemaining);
  }
  const withdrawable =
    unitPriceToman > 0 ? withdrawableToman / unitPriceToman : 0;

  return {
    asset,
    symbol: getAsset(asset)?.symbol ?? asset.toUpperCase(),
    kycLevel,
    balance,
    balanceToman,
    withdrawable: clampNonNeg(withdrawable),
    withdrawableToman: clampNonNeg(withdrawableToman),
    unitPriceToman,
    usdtRate,
    lock: {
      active: lockActive,
      until: lockUntil?.toISOString() ?? null,
      depositAt: depositAt?.toISOString() ?? null,
      instantCreditTotalToman: instantTotal,
      instantCreditRemainingToman: instantRemaining,
      instantCreditUsedToman: Math.min(instantUsed, instantTotal),
    },
    daily: {
      limitToman: caps.dailyToman,
      usedToman: usedDaily,
      remainingToman: remainingDailyToman,
      limitUsdt: tomanToUsdt(caps.dailyToman, usdtRate),
      usedUsdt: tomanToUsdt(usedDaily, usdtRate),
      remainingUsdt: tomanToUsdt(remainingDailyToman, usdtRate),
    },
    monthly: {
      limitToman: caps.monthlyToman,
      usedToman: usedMonthly,
      remainingToman: remainingMonthlyToman,
      limitUsdt: tomanToUsdt(caps.monthlyToman, usdtRate),
      usedUsdt: tomanToUsdt(usedMonthly, usdtRate),
      remainingUsdt: tomanToUsdt(remainingMonthlyToman, usdtRate),
    },
    needsKycUpgrade: kycLevel !== "advanced",
  };
}

/** Daily / monthly KYC caps for toman (or any) withdraw notional. */
export async function assertKycWithdrawCaps(params: {
  userId: number;
  amountToman: number;
}): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { kycLevel: true },
  });
  const caps = limitsForKyc(user?.kycLevel);
  const [usedDaily, usedMonthly] = await Promise.all([
    sumWithdrawToman(params.userId, tehranTodayStart()),
    sumWithdrawToman(params.userId, tehranRolling30dStart()),
  ]);
  if (params.amountToman > caps.dailyToman - usedDaily + 1e-6) {
    throw Object.assign(new Error("Daily withdraw limit exceeded"), {
      statusCode: 403,
      code: "DAILY_LIMIT",
    });
  }
  if (params.amountToman > caps.monthlyToman - usedMonthly + 1e-6) {
    throw Object.assign(new Error("Monthly withdraw limit exceeded"), {
      statusCode: 403,
      code: "MONTHLY_LIMIT",
    });
  }
}

/** Throws 403/400-shaped errors if crypto withdraw is not allowed. */
export async function assertCryptoWithdrawAllowed(params: {
  userId: number;
  asset: Exclude<AssetId, "toman">;
  amount: number;
  amountToman: number | null;
}): Promise<void> {
  const snap = await getWithdrawLimitsSnapshot(params.userId, params.asset);
  const amountToman =
    params.amountToman != null && Number.isFinite(params.amountToman)
      ? params.amountToman
      : snap.unitPriceToman > 0
        ? params.amount * snap.unitPriceToman
        : null;

  if (amountToman == null) {
    throw Object.assign(new Error("Unable to price withdraw"), {
      statusCode: 503,
    });
  }

  if (params.amount > snap.withdrawable + 1e-12) {
    if (snap.lock.active && snap.lock.instantCreditRemainingToman <= 0) {
      throw Object.assign(
        new Error(
          "Crypto withdraw locked for 72 hours after rial deposit",
        ),
        { statusCode: 403, code: "RIAL_CRYPTO_LOCK" },
      );
    }
    throw Object.assign(new Error("Exceeds withdrawable balance"), {
      statusCode: 403,
      code: "WITHDRAW_LIMIT",
    });
  }

  if (amountToman > snap.daily.remainingToman + 1e-6) {
    throw Object.assign(new Error("Daily withdraw limit exceeded"), {
      statusCode: 403,
      code: "DAILY_LIMIT",
    });
  }
  if (amountToman > snap.monthly.remainingToman + 1e-6) {
    throw Object.assign(new Error("Monthly withdraw limit exceeded"), {
      statusCode: 403,
      code: "MONTHLY_LIMIT",
    });
  }
}
