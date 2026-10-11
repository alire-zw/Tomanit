import { prisma } from "../db/prisma.js";
import { ensurePayerWalletTxForCharge } from "./merchantInvoiceWalletTx.js";
import { ensureWallet } from "./walletService.js";
import { getAssetRateToman } from "./swapwallet.js";
import { notifyTomanDeposit } from "./bot/notifyTomanDeposit.js";
import { notifyShopReportTransaction } from "./shopReportBot.js";
import { notifyMerchantInvoiceCallback } from "./merchantInvoiceCallback.js";
import { invalidateMeCache } from "./meCache.js";
import { calcCommissionToman } from "./gatewayRouting.js";
import {
  maybeAlertGatewayCapacity,
  recordGatewayChargeSuccess,
} from "./gatewayAlerts.js";
import { log } from "./log.js";

const chargeInclude = {
  gateway: true,
  merchantPaymentLink: { include: { shop: { include: { user: true } } } },
} as const;

export type GatewayChargeSuccessPayload = {
  trackId: string | number;
  amountToman?: number;
  paidAt?: string;
  refNumber?: string;
};

/**
 * Mark a gateway charge completed and credit wallet/shop.
 * Safe to call when status is pending or failed (verify-race recovery).
 */
export async function finalizeGatewayChargeSuccess(
  chargeId: number,
  payload: GatewayChargeSuccessPayload,
): Promise<{ ok: true; status: "completed" | "already_completed"; credited: boolean }> {
  const charge = await prisma.gatewayCharge.findUnique({
    where: { id: chargeId },
    include: chargeInclude,
  });
  if (!charge) {
    throw Object.assign(new Error("Charge not found"), { statusCode: 404 });
  }
  if (charge.status === "completed") {
    return { ok: true, status: "already_completed", credited: false };
  }
  if (charge.status !== "pending" && charge.status !== "failed") {
    throw Object.assign(new Error(`Charge status ${charge.status}`), {
      statusCode: 409,
    });
  }

  const amountToman = Number(charge.amountToman);
  if (!Number.isFinite(amountToman) || amountToman <= 0) {
    throw Object.assign(new Error("Invalid charge amount"), { statusCode: 400 });
  }
  if (
    payload.amountToman != null &&
    Number(payload.amountToman) !== amountToman
  ) {
    throw Object.assign(new Error("Amount mismatch"), { statusCode: 400 });
  }

  const commissionToman = calcCommissionToman(
    amountToman,
    Number(charge.commissionPercent || charge.gateway.commissionPercent || 0),
  );

  const isMerchantInvoice = charge.kind === "merchant_invoice";
  const invoiceAmountToman = Number(
    charge.invoiceAmountToman ?? charge.merchantPaymentLink?.amountToman ?? 0,
  );

  let usdtRateToman: number | null = null;
  let trxRateToman: number | null = null;
  if (!isMerchantInvoice) {
    try {
      const rate = await getAssetRateToman("usdt");
      usdtRateToman = rate > 0 ? rate : null;
    } catch {
      usdtRateToman = null;
    }
  } else {
    try {
      const rate = await getAssetRateToman("trx");
      trxRateToman = rate > 0 ? rate : null;
    } catch {
      trxRateToman = null;
    }
  }

  let credited = false;
  let shopOwnerTelegramId: string | null = null;
  const trackId = String(payload.trackId);
  const paidAt = payload.paidAt ? new Date(payload.paidAt) : new Date();

  await prisma.$transaction(async (tx) => {
    const claimed = await tx.gatewayCharge.updateMany({
      where: { id: charge.id, status: { in: ["pending", "failed"] } },
      data: {
        status: "completed",
        trackId,
        paidAt,
        commissionToman: BigInt(commissionToman),
        ...(trxRateToman != null ? { trxRateToman } : {}),
      },
    });
    if (claimed.count !== 1) return;

    if (charge.status === "failed") {
      log.info("gateway-charge-recovered", {
        chargeCode: charge.code,
        trackId,
      });
    }

    if (isMerchantInvoice) {
      if (
        !charge.merchantPaymentLinkId ||
        !Number.isFinite(invoiceAmountToman) ||
        invoiceAmountToman <= 0
      ) {
        throw new Error("Invalid merchant invoice charge");
      }

      const linkClaimed = await tx.merchantPaymentLink.updateMany({
        where: { id: charge.merchantPaymentLinkId, status: "open" },
        data: { status: "paid", paidAt },
      });
      if (linkClaimed.count === 1) {
        const shopId = charge.merchantPaymentLink!.shopId;
        const fullFee = Number(charge.feeToman ?? 0);
        const creditToman = Math.max(
          0,
          Number.isFinite(fullFee) && fullFee > 0
            ? amountToman - fullFee
            : invoiceAmountToman,
        );
        await tx.merchantShop.update({
          where: { id: shopId },
          data: { balanceToman: { increment: BigInt(creditToman) } },
        });
        shopOwnerTelegramId =
          charge.merchantPaymentLink?.shop.user.telegramId ?? null;
      }
      if (charge.merchantPaymentLink && !charge.walletTxId) {
        await ensurePayerWalletTxForCharge(
          {
            id: charge.id,
            code: charge.code,
            userId: charge.userId,
            amountToman: charge.amountToman,
            feeToman: charge.feeToman,
            trackId,
            bankCardId: charge.bankCardId,
            paidAt,
            createdAt: charge.createdAt,
            walletTxId: null,
            merchantPaymentLink: charge.merchantPaymentLink,
            gateway: charge.gateway,
          },
          tx,
        );
      }
    } else {
      await ensureWallet(charge.userId);
      await tx.wallet.update({
        where: { userId: charge.userId },
        data: { tomanBalance: { increment: BigInt(amountToman) } },
      });

      const wtx = await tx.walletTransaction.create({
        data: {
          userId: charge.userId,
          type: "recharge",
          status: "completed",
          asset: "toman",
          amount: amountToman,
          amountToman: amountToman,
          unitPriceToman: 1,
          counterUnitPriceToman: usdtRateToman,
          paymentMethod: "payment_gateway",
          bankCardId: charge.bankCardId,
          gatewayName: charge.gateway.displayName,
          gatewayTrackId: trackId,
          gatewayRefId: payload.refNumber ?? null,
          note: charge.description || "شارژ کیف پول",
          completedAt: new Date(),
        },
      });

      await tx.gatewayCharge.update({
        where: { id: charge.id },
        data: { walletTxId: wtx.id },
      });
    }

    await tx.paymentGateway.update({
      where: { id: charge.gatewayId },
      data: {
        balanceToman: { increment: BigInt(amountToman) },
        todayCount: { increment: 1 },
        consecutiveFailCount: 0,
      },
    });
    credited = true;
  });

  if (credited) {
    void recordGatewayChargeSuccess(charge.gatewayId);
    void maybeAlertGatewayCapacity(charge.gatewayId);
    if (isMerchantInvoice) {
      if (shopOwnerTelegramId) {
        void invalidateMeCache(shopOwnerTelegramId);
      }
      if (charge.merchantPaymentLink) {
        const paidLink = {
          ...charge.merchantPaymentLink,
          status: "paid" as const,
          paidAt,
        };
        void notifyMerchantInvoiceCallback({
          link: paidLink,
          status: "paid",
          trackId,
          amountToman: invoiceAmountToman,
        });
        if (shopOwnerTelegramId) {
          void notifyShopReportTransaction(charge.id);
        }
      }
    } else {
      void notifyTomanDeposit({
        userId: charge.userId,
        amountToman,
        usdtRateToman,
        gatewayName: charge.gateway.displayName,
      });
    }
  }

  return { ok: true, status: "completed", credited };
}
