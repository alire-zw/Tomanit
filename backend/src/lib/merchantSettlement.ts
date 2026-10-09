import { prisma } from "../db/prisma.js";
import type {
  MerchantSettlementMethod,
  MerchantSettlementStatus,
  MerchantShopSettlement,
  MerchantTrxDestination,
} from "@prisma/client";

/** Each paid shop credit unlocks for settlement after this hold. */
export const SETTLEMENT_HOLD_MS = 12 * 60 * 60 * 1000;

const TRON_ADDRESS = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;

/** Same credit formula as payment success handler. */
export function merchantInvoiceCreditToman(charge: {
  amountToman: bigint | number;
  invoiceAmountToman?: bigint | number | null;
  feeToman?: bigint | number | null;
}): number {
  const amount = Number(charge.amountToman);
  const fee = Number(charge.feeToman ?? 0);
  const invoice = Number(charge.invoiceAmountToman ?? 0);
  if (Number.isFinite(fee) && fee > 0) {
    return Math.max(0, amount - fee);
  }
  if (Number.isFinite(invoice) && invoice > 0) return invoice;
  return Math.max(0, Number.isFinite(amount) ? amount : 0);
}

export type ShopSettlementBalance = {
  availableToman: number;
  pendingToman: number;
  totalSettledToman: number;
  /** Earliest unlock time among still-held credits (ISO via caller). */
  nextUnlockAt: Date | null;
};

/**
 * Split shop credits into settleable vs 12h hold.
 * Settlements (requested/processing/paid) consume credits FIFO by paidAt.
 */
export async function computeShopSettlementBalance(
  shopId: number,
  now: Date = new Date(),
): Promise<ShopSettlementBalance> {
  const [charges, openSettlements, paidSettlements] = await Promise.all([
    prisma.gatewayCharge.findMany({
      where: {
        kind: "merchant_invoice",
        status: "completed",
        paidAt: { not: null },
        merchantPaymentLink: { shopId },
      },
      select: {
        amountToman: true,
        invoiceAmountToman: true,
        feeToman: true,
        paidAt: true,
      },
      orderBy: { paidAt: "asc" },
    }),
    prisma.merchantShopSettlement.aggregate({
      where: {
        shopId,
        status: { in: ["requested", "processing", "paid"] },
      },
      _sum: { amountToman: true },
    }),
    prisma.merchantShopSettlement.aggregate({
      where: { shopId, status: "paid" },
      _sum: { amountToman: true },
    }),
  ]);

  let remainingOut = Number(openSettlements._sum.amountToman ?? 0);
  let availableToman = 0;
  let pendingToman = 0;
  let nextUnlockAt: Date | null = null;
  const nowMs = now.getTime();

  for (const charge of charges) {
    if (!charge.paidAt) continue;
    let credit = merchantInvoiceCreditToman(charge);
    if (credit <= 0) continue;

    if (remainingOut > 0) {
      const used = Math.min(credit, remainingOut);
      credit -= used;
      remainingOut -= used;
    }
    if (credit <= 0) continue;

    const unlockAt = new Date(charge.paidAt.getTime() + SETTLEMENT_HOLD_MS);
    if (unlockAt.getTime() <= nowMs) {
      availableToman += credit;
    } else {
      pendingToman += credit;
      if (!nextUnlockAt || unlockAt.getTime() < nextUnlockAt.getTime()) {
        nextUnlockAt = unlockAt;
      }
    }
  }

  return {
    availableToman,
    pendingToman,
    totalSettledToman: Number(paidSettlements._sum.amountToman ?? 0),
    nextUnlockAt,
  };
}

export function normalizeIranIban(raw: string): string {
  const compact = raw.replace(/\s/g, "").toUpperCase();
  if (/^\d{24}$/.test(compact)) return `IR${compact}`;
  return compact;
}

export function isValidIranIban(raw: string): boolean {
  const iban = normalizeIranIban(raw);
  return /^IR\d{24}$/.test(iban);
}

export function isValidTronAddress(raw: string): boolean {
  return TRON_ADDRESS.test(raw.trim());
}

function maskIban(iban: string | null | undefined): string | null {
  if (!iban) return null;
  const n = normalizeIranIban(iban);
  if (n.length < 8) return n;
  return `${n.slice(0, 4)}••••••••••••••••${n.slice(-4)}`;
}

function maskTronAddress(addr: string | null | undefined): string | null {
  if (!addr) return null;
  const t = addr.trim();
  if (t.length <= 12) return t;
  return `${t.slice(0, 6)}…${t.slice(-6)}`;
}

export type SerializedShopSettlement = {
  id: string;
  method: MerchantSettlementMethod;
  amountToman: number;
  status: MerchantSettlementStatus;
  iban: string | null;
  ibanMasked: string | null;
  trxDestination: MerchantTrxDestination | null;
  trxAddress: string | null;
  trxAddressMasked: string | null;
  rejectNote: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export function serializeShopSettlement(
  row: MerchantShopSettlement,
): SerializedShopSettlement {
  return {
    id: String(row.id),
    method: row.method,
    amountToman: Number(row.amountToman),
    status: row.status,
    iban: row.iban,
    ibanMasked: maskIban(row.iban),
    trxDestination: row.trxDestination,
    trxAddress: row.trxAddress,
    trxAddressMasked: maskTronAddress(row.trxAddress),
    rejectNote: row.rejectNote,
    paidAt: row.paidAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listShopSettlements(
  shopId: number,
  take = 50,
): Promise<SerializedShopSettlement[]> {
  const rows = await prisma.merchantShopSettlement.findMany({
    where: { shopId },
    orderBy: { createdAt: "desc" },
    take,
  });
  return rows.map(serializeShopSettlement);
}

export type CreateShopSettlementInput = {
  shopId: number;
  method: MerchantSettlementMethod;
  amountToman: number;
  iban?: string | null;
  trxDestination?: MerchantTrxDestination | null;
  trxAddress?: string | null;
};

export type AdminShopSettlement = SerializedShopSettlement & {
  shop: {
    id: string;
    name: string;
  };
  user: {
    id: string;
    telegramId: string;
    username: string | null;
    fullName: string | null;
    firstName: string | null;
    lastName: string | null;
  };
};

export async function listAdminShopSettlements(options?: {
  status?: MerchantSettlementStatus;
  take?: number;
}): Promise<AdminShopSettlement[]> {
  const rows = await prisma.merchantShopSettlement.findMany({
    where: options?.status ? { status: options.status } : undefined,
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: options?.take ?? 100,
    include: {
      shop: {
        select: {
          id: true,
          name: true,
          user: {
            select: {
              id: true,
              telegramId: true,
              username: true,
              fullName: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      },
    },
  });

  return rows.map((row) => ({
    ...serializeShopSettlement(row),
    shop: {
      id: String(row.shop.id),
      name: row.shop.name,
    },
    user: {
      id: String(row.shop.user.id),
      telegramId: row.shop.user.telegramId,
      username: row.shop.user.username,
      fullName: row.shop.user.fullName,
      firstName: row.shop.user.firstName,
      lastName: row.shop.user.lastName,
    },
  }));
}

export async function getAdminShopSettlement(
  id: number,
): Promise<AdminShopSettlement | null> {
  const row = await prisma.merchantShopSettlement.findUnique({
    where: { id },
    include: {
      shop: {
        select: {
          id: true,
          name: true,
          user: {
            select: {
              id: true,
              telegramId: true,
              username: true,
              fullName: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      },
    },
  });
  if (!row) return null;
  return {
    ...serializeShopSettlement(row),
    shop: {
      id: String(row.shop.id),
      name: row.shop.name,
    },
    user: {
      id: String(row.shop.user.id),
      telegramId: row.shop.user.telegramId,
      username: row.shop.user.username,
      fullName: row.shop.user.fullName,
      firstName: row.shop.user.firstName,
      lastName: row.shop.user.lastName,
    },
  };
}

export async function updateAdminShopSettlementStatus(params: {
  id: number;
  status: Extract<MerchantSettlementStatus, "processing" | "paid">;
}): Promise<{ settlement: SerializedShopSettlement; userId: number }> {
  const existing = await prisma.merchantShopSettlement.findUnique({
    where: { id: params.id },
    include: { shop: { select: { userId: true } } },
  });
  if (!existing) {
    throw Object.assign(new Error("Settlement not found"), { statusCode: 404 });
  }

  if (existing.status === "paid" || existing.status === "rejected") {
    throw Object.assign(new Error("This settlement can no longer be updated"), {
      statusCode: 409,
    });
  }

  if (params.status === "processing" && existing.status !== "requested") {
    throw Object.assign(
      new Error("Only requested settlements can move to processing"),
      { statusCode: 409 },
    );
  }

  if (
    params.status === "paid" &&
    existing.status !== "requested" &&
    existing.status !== "processing"
  ) {
    throw Object.assign(
      new Error("Only requested/processing settlements can be marked paid"),
      { statusCode: 409 },
    );
  }

  const updated = await prisma.merchantShopSettlement.update({
    where: { id: params.id },
    data: {
      status: params.status,
      paidAt: params.status === "paid" ? new Date() : existing.paidAt,
    },
  });

  return {
    settlement: serializeShopSettlement(updated),
    userId: existing.shop.userId,
  };
}

export async function createShopSettlement(
  input: CreateShopSettlementInput,
): Promise<SerializedShopSettlement> {
  const amount = BigInt(input.amountToman);

  const balance = await computeShopSettlementBalance(input.shopId);
  if (input.amountToman > balance.availableToman) {
    throw Object.assign(
      new Error(
        balance.pendingToman > 0
          ? "مبلغ از موجودی قابل تسویه بیشتر است؛ بخشی هنوز در دوره ۱۲ ساعته است"
          : "موجودی قابل تسویه کافی نیست",
      ),
      { statusCode: 400 },
    );
  }

  const row = await prisma.$transaction(async (tx) => {
    const updated = await tx.merchantShop.updateMany({
      where: {
        id: input.shopId,
        balanceToman: { gte: amount },
      },
      data: { balanceToman: { decrement: amount } },
    });
    if (updated.count === 0) {
      throw Object.assign(new Error("موجودی کافی برای تسویه نیست"), {
        statusCode: 400,
      });
    }

    return tx.merchantShopSettlement.create({
      data: {
        shopId: input.shopId,
        method: input.method,
        amountToman: amount,
        iban: input.iban ?? null,
        trxDestination: input.trxDestination ?? null,
        trxAddress: input.trxAddress ?? null,
      },
    });
  });

  return serializeShopSettlement(row);
}
