import type { WalletAssetId } from "./api";
import { apiFetch } from "./api";
import {
  readCachedWalletChart,
  writeCachedWalletChart,
  type CachedLineRanges,
} from "./walletChartsCache";

const CRYPTO_IDS = ["trx", "usdt", "bnb", "matic", "gram"] as const;

/** Warm local chart cache from Redis-backed API (non-blocking). */
export async function prefetchWalletCharts(
  assets: Array<Exclude<WalletAssetId, "toman">> = [...CRYPTO_IDS],
): Promise<void> {
  await Promise.all(
    assets.map(async (asset) => {
      try {
        const data = await apiFetch<{ ranges: CachedLineRanges }>(
          `/wallet/chart?asset=${asset}&style=line`,
        );
        if (data.ranges?.DAY?.length) {
          writeCachedWalletChart(asset, data.ranges);
        }
      } catch {
        // keep previous local cache
      }
    }),
  );
}

export function readWarmChartRanges(
  asset: Exclude<WalletAssetId, "toman">,
): CachedLineRanges {
  return readCachedWalletChart(asset)?.ranges ?? {};
}
