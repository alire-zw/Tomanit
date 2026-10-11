import type { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import { formatInvoiceCode } from "./merchantPaymentLink.js";

export type MerchantInvoiceTxMeta = {
  kind: "merchant_invoice";
  shopId: number;
  shopName: string;
  invoiceCode: string;
  chargeCode: string;
};

export function parseMerchantInvoiceMeta(
  metadata: unknown,
): MerchantInvoiceTxMeta | null {
  if (!metadata || typeof metadata !== "object") return null;
  const m = metadata as Record<string, unknown>;
  if (m.kind !== "merchant_invoice") return null;
  const shopId = Number(m.shopId);
  const shopName = typeof m.shopName === "string" ? m.shopName.trim() : "";
  const invoiceCode =
    typeof m.invoiceCode === "string" ? m.invoiceCode.trim() : "";
  const chargeCode =
    typeof m.chargeCode === "string" ? m.chargeCode.trim() : "";
  if (!Number.isFinite(shopId) || shopId <= 0 || !shopName) return null;
  return {
    kind: "merchant_invoice",
    shopId,
    shopName,
    invoiceCode,
    chargeCode,
  };
}

type ChargeForPayerTx = {
  id: number;
  code: string;
  userId: number;
  amountToman: bigint;
  feeToman: bigint;
  trackId: string | null;
  bankCardId: number;
  paidAt: Date | null;
  createdAt: Date;
  walletTxId: number | null;
  merchantPaymentLink: {
    id: number;
    shop: { id: number; name: string };
  } | null;
  gateway: { displayName: string };
};

/** Create a payer-facing wallet row for a completed merchant invoice (idempotent). */
export async function ensurePayerWalletTxForCharge(
  charge: ChargeForPayerTx,
  db: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<number | null> {
  if (charge.walletTxId) return charge.walletTxId;
  const link = charge.merchantPaymentLink;
  if (!link?.shop) return null;

  const amountToman = Number(charge.amountToman);
  if (!Number.isFinite(amountToman) || amountToman <= 0) return null;

  const invoiceCode = formatInvoiceCode(link.id);
  const shopName = link.shop.name.trim() || "فروشگاه";
  const metadata: MerchantInvoiceTxMeta = {
    kind: "merchant_invoice",
    shopId: link.shop.id,
    shopName,
    invoiceCode,
    chargeCode: charge.code,
  };

  const wtx = await db.walletTransaction.create({
    data: {
      userId: charge.userId,
      type: "invoice",
      status: "completed",
      asset: "toman",
      amount: amountToman,
      amountToman,
      unitPriceToman: 1,
      fee: Number(charge.feeToman) || null,
      feeAsset: "toman",
      feeToman: Number(charge.feeToman) || null,
      paymentMethod: "payment_gateway",
      bankCardId: charge.bankCardId,
      gatewayName: charge.gateway.displayName,
      gatewayTrackId: charge.trackId,
      note: shopName,
      metadata,
      completedAt: charge.paidAt ?? charge.createdAt,
      createdAt: charge.paidAt ?? charge.createdAt,
    },
  });

  await db.gatewayCharge.update({
    where: { id: charge.id },
    data: { walletTxId: wtx.id },
  });

  return wtx.id;
}

/** Backfill missing payer wallet txs for a user (completed merchant invoices). */
export async function backfillPayerInvoiceWalletTxs(
  userId: number,
): Promise<void> {
  const charges = await prisma.gatewayCharge.findMany({
    where: {
      userId,
      kind: "merchant_invoice",
      status: "completed",
      walletTxId: null,
      merchantPaymentLinkId: { not: null },
    },
    include: {
      gateway: { select: { displayName: true } },
      merchantPaymentLink: {
        select: {
          id: true,
          shop: { select: { id: true, name: true } },
        },
      },
    },
    take: 100,
    orderBy: { id: "desc" },
  });

  for (const charge of charges) {
    try {
      await ensurePayerWalletTxForCharge(charge);
    } catch {
      // ignore race / unique conflicts
    }
  }
}
