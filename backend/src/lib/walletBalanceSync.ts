import type { CryptoNetwork, WalletDepositAddress } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import { invalidateMeCache } from "./meCache.js";
import { log } from "./log.js";
import { createRateLimiter } from "./rateLimit.js";
import { getEvmOnChainBalance } from "./evmRpc.js";
import {
  getTronOnChainBalance,
  getTronTrxTransfers,
  getTronUsdtTransfers,
  type TronTransfer,
} from "./tronGrid.js";
import { getTonOnChainBalance } from "./tonCenter.js";
import { applyDeposit } from "./walletService.js";
import type { AssetId, NetworkId } from "./walletAssets.js";

const MIN_DELTA = 1e-8;
/** Match transfer amounts against balance deltas with tiny float slack. */
const AMOUNT_EPS = 1e-6;

/** TronGrid / TonCenter — separate from Ankr, stay polite. */
const tronLimiter = createRateLimiter(5, "trongrid");
const tonLimiter = createRateLimiter(5, "toncenter");

function positiveDelta(current: number, previous: number): number {
  const d = current - previous;
  return d > MIN_DELTA ? d : 0;
}

function nativeAssetFor(network: CryptoNetwork): AssetId | null {
  switch (network) {
    case "tron":
      return "trx";
    case "bsc":
      return "bnb";
    case "polygon":
      return "matic";
    case "ton":
      return "gram";
    default:
      return null;
  }
}

async function fetchOnChain(row: WalletDepositAddress): Promise<{
  native: number;
  usdt: number;
}> {
  switch (row.network) {
    case "tron": {
      await tronLimiter.acquire();
      const bal = await getTronOnChainBalance(row.address);
      return { native: bal.trx, usdt: bal.usdt };
    }
    case "bsc": {
      const bal = await getEvmOnChainBalance("bsc", row.address);
      return { native: bal.native, usdt: bal.usdt };
    }
    case "polygon": {
      const bal = await getEvmOnChainBalance("polygon", row.address);
      return { native: bal.native, usdt: bal.usdt };
    }
    case "ton": {
      await tonLimiter.acquire();
      const bal = await getTonOnChainBalance(row.address);
      return { native: bal.gram, usdt: 0 };
    }
    default:
      return { native: 0, usdt: 0 };
  }
}

function balanceDeltaKey(
  rowId: number,
  asset: string,
  from: number,
  to: number,
): string {
  const f = Math.round(from * 1e8);
  const t = Math.round(to * 1e8);
  return `baldelta:${rowId}:${asset}:${f}:${t}`;
}

async function creditIfNeeded(params: {
  userId: number;
  asset: AssetId;
  amount: number;
  network: NetworkId;
  toAddress: string;
  fromAddress?: string | null;
  txHash?: string | null;
}): Promise<"credited" | "duplicate" | "skipped" | "failed"> {
  if (!(params.amount > MIN_DELTA)) return "skipped";
  // Idempotency requires a hash (on-chain tx id or deterministic baldelta key).
  if (!params.txHash) {
    log.warn(
      "balance",
      `skip hashless credit user:${params.userId} ${params.asset} amt:${params.amount}`,
    );
    return "skipped";
  }
  try {
    await applyDeposit({
      userId: params.userId,
      asset: params.asset,
      amount: params.amount,
      network: params.network,
      note: `on-chain sync ${params.network}`,
      toAddress: params.toAddress,
      fromAddress: params.fromAddress ?? null,
      txHash: params.txHash,
    });
    return "credited";
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Duplicate hash is expected on re-scan — treat as already applied.
    if (/already credited/i.test(msg)) return "duplicate";
    log.warn(
      "balance",
      `credit fail user:${params.userId} ${params.asset} — ${msg}`,
    );
    return "failed";
  }
}

function amountsClose(a: number, b: number): boolean {
  return Math.abs(a - b) <= Math.max(AMOUNT_EPS, b * 1e-9);
}

/**
 * Credit inbound TRON transfers that appeared after the last successful scan.
 * Unexplained balance rises use a deterministic baldelta key (never hashless).
 */
async function creditTronInbound(params: {
  row: WalletDepositAddress;
  nativeDelta: number;
  usdtDelta: number;
}): Promise<number> {
  const { row, nativeDelta, usdtDelta } = params;
  const sinceMs = row.lastCheckedAt?.getTime() ?? 0;
  let credited = 0;
  let coveredTrx = 0;
  let coveredUsdt = 0;

  if (nativeDelta > MIN_DELTA) {
    await tronLimiter.acquire();
    let transfers: TronTransfer[] = [];
    try {
      transfers = await getTronTrxTransfers(row.address, 30);
    } catch (err) {
      log.warn(
        "balance",
        `trx transfers fail id:${row.id} — ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }

    const candidates = transfers
      .filter(
        (t) =>
          t.confirmed &&
          t.asset === "trx" &&
          t.amount > MIN_DELTA &&
          Boolean(t.txId) &&
          (sinceMs <= 0 || t.timestamp >= sinceMs),
      )
      .sort((a, b) => b.timestamp - a.timestamp);

    for (const t of candidates) {
      if (coveredTrx >= nativeDelta - AMOUNT_EPS) break;
      const result = await creditIfNeeded({
        userId: row.userId,
        asset: "trx",
        amount: t.amount,
        network: "tron",
        toAddress: row.address,
        fromAddress: t.from || null,
        txHash: t.txId,
      });
      if (result === "credited" || result === "duplicate") {
        if (result === "credited") credited += 1;
        coveredTrx += t.amount;
      }
    }

    const remainder = nativeDelta - coveredTrx;
    if (remainder > MIN_DELTA) {
      // Prefer a single matching transfer by amount if timestamp filter missed it.
      const byAmount = candidates.find(
        (t) => amountsClose(t.amount, remainder) || amountsClose(t.amount, nativeDelta),
      );
      if (byAmount) {
        const result = await creditIfNeeded({
          userId: row.userId,
          asset: "trx",
          amount: byAmount.amount,
          network: "tron",
          toAddress: row.address,
          fromAddress: byAmount.from || null,
          txHash: byAmount.txId,
        });
        if (result === "credited" || result === "duplicate") {
          if (result === "credited") credited += 1;
          coveredTrx += byAmount.amount;
        }
      }
    }

    const still = nativeDelta - coveredTrx;
    if (still > MIN_DELTA) {
      // Do not invent hashless credits — wait for a matching on-chain transfer.
      log.warn(
        "balance",
        `unexplained trx delta id:${row.id} still:${still} (awaiting transfer match)`,
      );
    }
  }

  if (usdtDelta > MIN_DELTA) {
    await tronLimiter.acquire();
    let transfers: TronTransfer[] = [];
    try {
      transfers = await getTronUsdtTransfers(row.address, 30);
    } catch (err) {
      log.warn(
        "balance",
        `usdt transfers fail id:${row.id} — ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }

    const candidates = transfers
      .filter(
        (t) =>
          t.confirmed &&
          t.asset === "usdt" &&
          t.amount > MIN_DELTA &&
          Boolean(t.txId) &&
          (sinceMs <= 0 || t.timestamp >= sinceMs),
      )
      .sort((a, b) => b.timestamp - a.timestamp);

    for (const t of candidates) {
      if (coveredUsdt >= usdtDelta - AMOUNT_EPS) break;
      const result = await creditIfNeeded({
        userId: row.userId,
        asset: "usdt",
        amount: t.amount,
        network: "tron",
        toAddress: row.address,
        fromAddress: t.from || null,
        txHash: t.txId,
      });
      if (result === "credited" || result === "duplicate") {
        if (result === "credited") credited += 1;
        coveredUsdt += t.amount;
      }
    }

    const still = usdtDelta - coveredUsdt;
    if (still > MIN_DELTA) {
      const byAmount = candidates.find(
        (t) => amountsClose(t.amount, still) || amountsClose(t.amount, usdtDelta),
      );
      if (byAmount) {
        const result = await creditIfNeeded({
          userId: row.userId,
          asset: "usdt",
          amount: byAmount.amount,
          network: "tron",
          toAddress: row.address,
          fromAddress: byAmount.from || null,
          txHash: byAmount.txId,
        });
        if (result === "credited" || result === "duplicate") {
          if (result === "credited") credited += 1;
          coveredUsdt += byAmount.amount;
        }
      }
    }

    const leftover = usdtDelta - coveredUsdt;
    if (leftover > MIN_DELTA) {
      log.warn(
        "balance",
        `unexplained usdt delta id:${row.id} leftover:${leftover} (awaiting transfer match)`,
      );
    }
  }

  return credited;
}

/**
 * Sync one custodial deposit address.
 * First observation only snapshots (no credit) to avoid dumping historical balances.
 * Later increases are credited to the user ledger.
 */
export async function syncDepositAddress(
  row: WalletDepositAddress,
): Promise<{ credited: number; checked: boolean }> {
  let credited = 0;
  try {
    const onchain = await fetchOnChain(row);
    const isFirst = row.lastCheckedAt == null;

    if (!isFirst) {
      if (row.network === "tron") {
        credited += await creditTronInbound({
          row,
          nativeDelta: positiveDelta(onchain.native, row.lastNative),
          usdtDelta: positiveDelta(onchain.usdt, row.lastUsdt),
        });
      } else {
        const nativeAsset = nativeAssetFor(row.network);
        if (nativeAsset) {
          const nativeDelta = positiveDelta(onchain.native, row.lastNative);
          const result = await creditIfNeeded({
            userId: row.userId,
            asset: nativeAsset,
            amount: nativeDelta,
            network: row.network,
            toAddress: row.address,
            txHash: balanceDeltaKey(
              row.id,
              nativeAsset,
              row.lastNative,
              onchain.native,
            ),
          });
          if (result === "credited") credited += 1;
        }

        if (row.network !== "ton") {
          const usdtDelta = positiveDelta(onchain.usdt, row.lastUsdt);
          const result = await creditIfNeeded({
            userId: row.userId,
            asset: "usdt",
            amount: usdtDelta,
            network: row.network,
            toAddress: row.address,
            txHash: balanceDeltaKey(
              row.id,
              "usdt",
              row.lastUsdt,
              onchain.usdt,
            ),
          });
          if (result === "credited") credited += 1;
        }
      }
    }

    // Optimistic lock: skip snapshot write if another scanner already advanced it.
    await prisma.walletDepositAddress.updateMany({
      where: {
        id: row.id,
        lastNative: row.lastNative,
        lastUsdt: row.lastUsdt,
      },
      data: {
        lastNative: onchain.native,
        lastUsdt: onchain.usdt,
        lastCheckedAt: new Date(),
      },
    });

    if (credited > 0) {
      try {
        const user = await prisma.user.findUnique({
          where: { id: row.userId },
          select: { telegramId: true },
        });
        if (user?.telegramId) {
          await invalidateMeCache(String(user.telegramId));
        }
      } catch {
        // ignore cache errors
      }
    }

    return { credited, checked: true };
  } catch (err) {
    log.warn(
      "balance",
      `scan fail id:${row.id} ${row.network} — ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
    return { credited: 0, checked: false };
  }
}
