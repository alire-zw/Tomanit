import { prisma } from "../db/prisma.js";
import { log } from "./log.js";
import { getAssetRateToman } from "./swapwallet.js";
import {
  decryptPrivateKey,
} from "./walletCrypto.js";
import {
  feeReserveFor,
  getOnChainAssetAmount,
  sendOnChainAsset,
} from "./walletChainTransfer.js";
import { ASSETS, type AssetId, type NetworkId } from "./walletAssets.js";
import { readAssetBalance } from "./walletService.js";

/** Sweep user deposit wallets when claim value exceeds this (toman). */
export const SWEEP_THRESHOLD_TOMAN = 2_000_000;

const JOB_INTERVAL_MS = 5 * 60_000;
const JOB_BUDGET_MS = 90_000;
const PAGE_SIZE = 25;

let timer: ReturnType<typeof setInterval> | null = null;
let running = false;

type SweepPair = { asset: AssetId; network: NetworkId };

function sweepPairs(): SweepPair[] {
  const pairs: SweepPair[] = [];
  for (const asset of ASSETS) {
    if (asset.isFiat) continue;
    for (const network of asset.networks) {
      if (network === "ton") continue; // send not implemented yet
      pairs.push({ asset: asset.id, network });
    }
  }
  return pairs;
}

async function sweepOne(params: {
  userId: number;
  asset: AssetId;
  network: NetworkId;
  addressId: number;
  address: string;
  privateKeyEnc: string;
}): Promise<"swept" | "skip" | "error"> {
  const master = await prisma.assetMasterWallet.findFirst({
    where: {
      asset: params.asset,
      network: params.network,
      isActive: true,
    },
  });
  if (!master) return "skip";

  const wallet = await prisma.wallet.findUnique({
    where: { userId: params.userId },
  });
  if (!wallet) return "skip";

  const claim = readAssetBalance(wallet, params.asset);
  if (!(claim > 0)) return "skip";

  const rate = await getAssetRateToman(params.asset);
  if (!(rate > 0)) return "skip";
  if (claim * rate < SWEEP_THRESHOLD_TOMAN) return "skip";

  const onChain = await getOnChainAssetAmount({
    asset: params.asset,
    network: params.network,
    address: params.address,
  });
  const reserve = feeReserveFor(params.asset, params.network);
  const sendable = Math.max(0, onChain - reserve);
  if (!(sendable > 0)) return "skip";

  // Don't send dust relative to claim; send whatever is still on the user address.
  const amount = Math.min(sendable, claim);
  if (!(amount > 0)) return "skip";

  try {
    const result = await sendOnChainAsset({
      asset: params.asset,
      network: params.network,
      fromPrivateKey: decryptPrivateKey(params.privateKeyEnc),
      toAddress: master.address,
      amount,
      source: "user",
    });

    let usdtRateToman: number | null = null;
    try {
      const usdt = await getAssetRateToman("usdt");
      usdtRateToman = usdt > 0 ? usdt : null;
    } catch {
      usdtRateToman = null;
    }

    await prisma.walletTransaction.create({
      data: {
        userId: params.userId,
        type: "adjustment",
        asset: params.asset,
        amount,
        status: "completed",
        unitPriceToman: rate,
        counterUnitPriceToman: usdtRateToman,
        amountToman: rate * amount,
        network: params.network,
        fromAddress: result.fromAddress,
        toAddress: result.toAddress,
        txHash: result.txHash,
        paymentMethod: "internal",
        balanceAfter: claim,
        completedAt: new Date(),
        note: `sweep to master (>=${SWEEP_THRESHOLD_TOMAN} toman)`,
      },
    });

    log.info(
      "sweep",
      `user:${params.userId} ${params.asset}/${params.network} ${amount} → master ${result.txHash}`,
    );
    return "swept";
  } catch (err) {
    log.warn(
      "sweep",
      `user:${params.userId} ${params.asset}/${params.network} — ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
    return "error";
  }
}

export async function runWalletSweepScan(): Promise<{
  checked: number;
  swept: number;
  errors: number;
}> {
  const started = Date.now();
  let checked = 0;
  let swept = 0;
  let errors = 0;
  const pairs = sweepPairs();

  // Only scan addresses that have a configured master for their network assets.
  const masters = await prisma.assetMasterWallet.findMany({
    where: { isActive: true },
    select: { network: true, asset: true },
  });
  if (masters.length === 0) {
    return { checked: 0, swept: 0, errors: 0 };
  }
  const masterNetworks = new Set(masters.map((m) => m.network));

  let cursor = 0;
  while (Date.now() - started < JOB_BUDGET_MS) {
    const rows = await prisma.walletDepositAddress.findMany({
      where: {
        id: { gt: cursor },
        network: { in: [...masterNetworks] },
        privateKeyEnc: { not: null },
      },
      orderBy: { id: "asc" },
      take: PAGE_SIZE,
    });
    if (rows.length === 0) break;

    for (const row of rows) {
      if (Date.now() - started >= JOB_BUDGET_MS) break;
      cursor = row.id;
      if (!row.privateKeyEnc) continue;

      for (const pair of pairs) {
        if (pair.network !== row.network) continue;
        if (!masters.some((m) => m.asset === pair.asset && m.network === pair.network)) {
          continue;
        }
        checked += 1;
        const result = await sweepOne({
          userId: row.userId,
          asset: pair.asset,
          network: pair.network,
          addressId: row.id,
          address: row.address,
          privateKeyEnc: row.privateKeyEnc,
        });
        if (result === "swept") swept += 1;
        if (result === "error") errors += 1;
      }
    }
  }

  return { checked, swept, errors };
}

export function startWalletSweepJob(): void {
  if (timer) return;
  const tick = () => {
    if (running) return;
    running = true;
    void runWalletSweepScan()
      .then((r) => {
        if (r.checked > 0 || r.swept > 0 || r.errors > 0) {
          log.info(
            "sweep",
            `scan checked=${r.checked} swept=${r.swept} errors=${r.errors}`,
          );
        }
      })
      .catch((err) => {
        log.warn(
          "sweep",
          err instanceof Error ? err.message : String(err),
        );
      })
      .finally(() => {
        running = false;
      });
  };
  timer = setInterval(tick, JOB_INTERVAL_MS);
  // First pass shortly after boot.
  setTimeout(tick, 20_000);
  log.service("Sweep", `every ${JOB_INTERVAL_MS / 1000}s · ≥${SWEEP_THRESHOLD_TOMAN} toman`, true);
}

export function stopWalletSweepJob(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
