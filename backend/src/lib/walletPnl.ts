import type { WalletAsset, WalletTransaction } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import { getAssetRateToman } from "./swapwallet.js";
import { getAsset, type AssetId } from "./walletAssets.js";
import { ensureWallet, readAssetBalance } from "./walletService.js";

const EPS = 1e-10;

export type AssetPnlResult = {
  asset: AssetId;
  /** Current ledger quantity. */
  quantity: number;
  /** Live IRT price per unit. */
  currentPriceToman: number;
  /** Mark-to-market value of the holding. */
  marketValueToman: number;
  /** Weighted-average cost of remaining inventory (IRT / unit). */
  avgCostToman: number | null;
  /** Total IRT cost basis of remaining inventory. */
  costBasisToman: number;
  /** Unrealized P/L in IRT: market − cost. */
  pnlToman: number | null;
  /** Unrealized P/L percent vs cost basis. */
  pnlPercent: number | null;
  /** True when some inflow lots lacked a stored price (fallback used). */
  priceEstimated: boolean;
  /** How many completed ledger events affected this asset. */
  events: number;
};

type LotEvent =
  | { kind: "credit"; qty: number; unitPrice: number; estimated: boolean }
  | { kind: "debit"; qty: number };

function resolveInflowUnitPrice(params: {
  qty: number;
  unitPriceToman: number | null | undefined;
  amountToman: number | null | undefined;
  fallbackPrice: number | null;
}): { unitPrice: number; estimated: boolean } | null {
  const { qty, unitPriceToman, amountToman, fallbackPrice } = params;
  if (!(qty > EPS)) return null;

  if (unitPriceToman != null && unitPriceToman > 0 && Number.isFinite(unitPriceToman)) {
    return { unitPrice: unitPriceToman, estimated: false };
  }
  if (
    amountToman != null &&
    amountToman > 0 &&
    Number.isFinite(amountToman) &&
    qty > EPS
  ) {
    return { unitPrice: amountToman / qty, estimated: false };
  }
  if (fallbackPrice != null && fallbackPrice > 0) {
    return { unitPrice: fallbackPrice, estimated: true };
  }
  return null;
}

/**
 * Build chronological credit/debit events for one asset from the unified ledger.
 *
 * - deposit / recharge / refund → credit
 * - withdraw / invoice / fee → debit
 * - convert: from-leg debit, to-leg credit (cost = notional IRT of the swap)
 * - Average-cost inventory: debits reduce qty at the running average (not sale price)
 */
function eventsForAsset(
  asset: AssetId,
  txs: WalletTransaction[],
  fallbackPrice: number | null,
): { events: LotEvent[]; priceEstimated: boolean } {
  const events: LotEvent[] = [];
  let priceEstimated = false;

  for (const tx of txs) {
    if (tx.status !== "completed") continue;

    const type = tx.type;

    // Convert: single row — debit `asset`, credit `counterAsset`.
    if (type === "convert") {
      if (tx.asset === asset && tx.amount > EPS) {
        events.push({ kind: "debit", qty: tx.amount });
      }
      if (tx.counterAsset === asset && (tx.counterAmount ?? 0) > EPS) {
        const qty = tx.counterAmount!;
        // Cost of received asset = IRT notional of what was spent (preferred),
        // else stored counter unit price, else fallback.
        let unitPrice: number | null = null;
        let estimated = false;
        if (
          tx.amountToman != null &&
          tx.amountToman > 0 &&
          Number.isFinite(tx.amountToman)
        ) {
          unitPrice = tx.amountToman / qty;
        } else if (
          tx.counterUnitPriceToman != null &&
          tx.counterUnitPriceToman > 0
        ) {
          unitPrice = tx.counterUnitPriceToman;
        } else {
          const resolved = resolveInflowUnitPrice({
            qty,
            unitPriceToman: null,
            amountToman: null,
            fallbackPrice,
          });
          if (resolved) {
            unitPrice = resolved.unitPrice;
            estimated = resolved.estimated;
          }
        }
        if (unitPrice != null) {
          if (estimated) priceEstimated = true;
          events.push({ kind: "credit", qty, unitPrice, estimated });
        }
      }
      continue;
    }

    if (tx.asset !== asset) {
      // Fee charged in this asset on another primary asset row.
      if (
        tx.feeAsset === asset &&
        tx.fee != null &&
        tx.fee > EPS &&
        (type === "withdraw" || type === "fee")
      ) {
        events.push({ kind: "debit", qty: tx.fee });
      }
      continue;
    }

    if (
      type === "deposit" ||
      type === "recharge" ||
      type === "refund"
    ) {
      const resolved = resolveInflowUnitPrice({
        qty: tx.amount,
        unitPriceToman: tx.unitPriceToman,
        amountToman: tx.amountToman,
        fallbackPrice,
      });
      if (resolved) {
        if (resolved.estimated) priceEstimated = true;
        events.push({
          kind: "credit",
          qty: tx.amount,
          unitPrice: resolved.unitPrice,
          estimated: resolved.estimated,
        });
      }
      continue;
    }

    if (type === "withdraw" || type === "invoice" || type === "fee") {
      if (tx.amount > EPS) {
        events.push({ kind: "debit", qty: tx.amount });
      }
      // Extra fee in same asset (if recorded separately on top of amount).
      if (
        tx.feeAsset === asset &&
        tx.fee != null &&
        tx.fee > EPS &&
        type === "withdraw"
      ) {
        events.push({ kind: "debit", qty: tx.fee });
      }
      continue;
    }

    if (type === "adjustment") {
      // Positive adjustment treated as credit at stored/fallback price.
      const resolved = resolveInflowUnitPrice({
        qty: tx.amount,
        unitPriceToman: tx.unitPriceToman,
        amountToman: tx.amountToman,
        fallbackPrice,
      });
      if (resolved) {
        if (resolved.estimated) priceEstimated = true;
        events.push({
          kind: "credit",
          qty: tx.amount,
          unitPrice: resolved.unitPrice,
          estimated: resolved.estimated,
        });
      }
    }
  }

  return { events, priceEstimated };
}

function runAverageCost(events: LotEvent[]): {
  qty: number;
  costToman: number;
} {
  let qty = 0;
  let costToman = 0;

  for (const ev of events) {
    if (ev.kind === "credit") {
      qty += ev.qty;
      costToman += ev.qty * ev.unitPrice;
      continue;
    }

    if (!(ev.qty > EPS) || !(qty > EPS)) continue;
    const take = Math.min(ev.qty, qty);
    const avg = costToman / qty;
    costToman -= take * avg;
    qty -= take;
    if (qty < EPS) {
      qty = 0;
      costToman = 0;
    }
    // Floating dust
    if (Math.abs(costToman) < 1e-6) costToman = 0;
  }

  return { qty, costToman };
}

/**
 * Unrealized P/L for one crypto asset using weighted-average cost basis
 * over the full completed ledger history, reconciled to the live wallet balance.
 */
export async function computeAssetPnl(
  userId: number,
  asset: AssetId,
): Promise<AssetPnlResult> {
  if (asset === "toman") {
    throw Object.assign(new Error("PnL is for crypto assets only"), {
      statusCode: 400,
    });
  }
  if (!getAsset(asset)) {
    throw Object.assign(new Error("Unknown asset"), { statusCode: 400 });
  }

  const wallet = await ensureWallet(userId);
  const quantity = readAssetBalance(wallet, asset as WalletAsset);

  let currentPriceToman: number;
  try {
    currentPriceToman = await getAssetRateToman(asset);
  } catch {
    throw Object.assign(new Error("Live rate unavailable"), { statusCode: 503 });
  }

  const marketValueToman = quantity * currentPriceToman;

  const txs = await prisma.walletTransaction.findMany({
    where: {
      userId,
      status: "completed",
      OR: [
        { asset },
        { counterAsset: asset },
        { feeAsset: asset },
      ],
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });

  const { events, priceEstimated } = eventsForAsset(
    asset,
    txs,
    currentPriceToman,
  );
  const { qty: computedQty, costToman: computedCost } = runAverageCost(events);

  let costBasisToman = computedCost;
  let inventoryQty = computedQty;

  // Reconcile inventory to the live ledger balance so PnL matches what the user sees.
  if (quantity <= EPS) {
    return {
      asset,
      quantity: 0,
      currentPriceToman,
      marketValueToman: 0,
      avgCostToman: null,
      costBasisToman: 0,
      pnlToman: 0,
      pnlPercent: 0,
      priceEstimated,
      events: events.length,
    };
  }

  if (inventoryQty > EPS) {
    if (quantity + EPS < inventoryQty) {
      // Wallet lower than reconstructed lots (rounding / partial history) — scale cost.
      const scale = quantity / inventoryQty;
      costBasisToman = computedCost * scale;
      inventoryQty = quantity;
    } else if (quantity > inventoryQty + EPS) {
      // Missing inflow history for the gap — treat gap at spot (neutral to unrealized).
      const gap = quantity - inventoryQty;
      costBasisToman = computedCost + gap * currentPriceToman;
      inventoryQty = quantity;
    } else {
      inventoryQty = quantity;
      costBasisToman = computedCost;
    }
  } else {
    // No reconstructable cost lots — treat full balance at spot (PnL unknown → 0).
    costBasisToman = quantity * currentPriceToman;
    inventoryQty = quantity;
  }

  const avgCostToman =
    inventoryQty > EPS ? costBasisToman / inventoryQty : null;
  const pnlToman = Math.round(marketValueToman - costBasisToman);
  const pnlPercent =
    costBasisToman > EPS
      ? ((marketValueToman - costBasisToman) / costBasisToman) * 100
      : null;

  return {
    asset,
    quantity,
    currentPriceToman,
    marketValueToman: Math.round(marketValueToman),
    avgCostToman,
    costBasisToman: Math.round(costBasisToman),
    pnlToman,
    pnlPercent:
      pnlPercent == null
        ? null
        : Math.round(pnlPercent * 100) / 100,
    priceEstimated,
    events: events.length,
  };
}
