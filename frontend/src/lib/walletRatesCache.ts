import type { WalletAssetId } from "./api";

const STORAGE_KEY = "tomanit:wallet:rates:v1";

export type CachedWalletRates = {
  rates: Partial<Record<WalletAssetId, number>>;
  changes: Partial<Record<Exclude<WalletAssetId, "toman">, number>>;
  savedAt: string;
};

function isValidRates(rates: CachedWalletRates["rates"] | undefined): boolean {
  if (!rates) return false;
  for (const id of ["trx", "usdt", "bnb", "matic", "gram"] as const) {
    if (!(Number(rates[id]) > 0)) return false;
  }
  return true;
}

export function readCachedWalletRates(): CachedWalletRates | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedWalletRates;
    if (!isValidRates(parsed.rates)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeCachedWalletRates(
  rates: CachedWalletRates["rates"],
  changes: CachedWalletRates["changes"],
): void {
  if (!isValidRates(rates)) return;
  try {
    const payload: CachedWalletRates = {
      rates,
      changes: changes ?? {},
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore quota / private mode
  }
}
