import type { WalletAssetId } from "./api";

const STORAGE_PREFIX = "tomanit:wallet:chart:line:v1:";

export type ChartRange =
  | "DAY"
  | "WEEK"
  | "MONTH"
  | "SIX_MONTH"
  | "YEAR"
  | "ALL";

export type CachedChartLinePoint = { time: number; value: number };
export type CachedLineRanges = Partial<Record<ChartRange, CachedChartLinePoint[]>>;

export type CachedWalletChart = {
  asset: Exclude<WalletAssetId, "toman">;
  ranges: CachedLineRanges;
  savedAt: string;
};

function storageKey(asset: string): string {
  return `${STORAGE_PREFIX}${asset}`;
}

function isValidRanges(ranges: CachedLineRanges | undefined): boolean {
  return Boolean(ranges?.DAY && ranges.DAY.length > 1);
}

export function readCachedWalletChart(
  asset: Exclude<WalletAssetId, "toman">,
): CachedWalletChart | null {
  try {
    const raw = localStorage.getItem(storageKey(asset));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedWalletChart;
    if (parsed.asset !== asset || !isValidRanges(parsed.ranges)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeCachedWalletChart(
  asset: Exclude<WalletAssetId, "toman">,
  ranges: CachedLineRanges,
): void {
  if (!isValidRanges(ranges)) return;
  try {
    const payload: CachedWalletChart = {
      asset,
      ranges,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(storageKey(asset), JSON.stringify(payload));
  } catch {
    // ignore quota / private mode
  }
}
