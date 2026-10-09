import { env } from "../config/env.js";
import { redis } from "../db/redis.js";
import { log } from "./log.js";
import type { AssetId } from "./walletAssets.js";
import { ASSETS } from "./walletAssets.js";

const SWAPWALLET_PRICES_URL = "https://swapwallet.app/api/v1/market/prices";
/** Single background poll interval — never per-user. */
export const SWAPWALLET_POLL_MS = 10_000;
/** Per-request timeout for SwapWallet HTTP. */
const SWAPWALLET_FETCH_TIMEOUT_MS = 12_000;
/** Retries on transient network / 5xx failures. */
const SWAPWALLET_FETCH_RETRIES = 3;
/** Redis key for the latest live rates blob. */
const REDIS_RATES_KEY = "tomanit:market:rates";
/** Day-open baseline for daily % change (Asia/Tehran calendar day). */
const REDIS_DAY_OPEN_KEY = "tomanit:market:day-open";
/** Live rates blob — keep longer so clients always have a number to show. */
const REDIS_RATES_TTL_SEC = 10 * 60;
/** Midnight snapshot for the Tehran calendar day (kept across the full day + next). */
const REDIS_DAY_OPEN_TTL_SEC = 3 * 24 * 60 * 60;


/**
 * SwapWallet pair → our wallet asset id.
 * MATIC rebranded to POL; GRAM is priced via TON.
 */
const ASSET_PAIR: Record<Exclude<AssetId, "toman">, string> = {
  trx: "TRX/IRT",
  usdt: "USDT/IRT",
  bnb: "BNB/IRT",
  matic: "POL/IRT",
  gram: "TON/IRT",
};

const CRYPTO_ASSETS = Object.keys(ASSET_PAIR) as Array<Exclude<AssetId, "toman">>;

export type WalletRates = Record<AssetId, number>;
/** Daily change percent vs Tehran day-open price (e.g. 1.25 = +1.25%). */
export type WalletChanges = Record<Exclude<AssetId, "toman">, number>;

type DayOpenPayload = {
  /** Tehran calendar date YYYY-MM-DD this snapshot belongs to. */
  dateKey: string;
  /** Prices captured at (or first poll after) 00:00 Asia/Tehran. */
  rates: WalletRates;
  /** ISO time when the midnight snapshot was written. */
  capturedAt: string;
};

type RatesCachePayload = {
  rates: WalletRates;
  changes: WalletChanges;
  source: "swapwallet";
  updatedAt: string;
  dayKey: string;
};

let pollTimer: ReturnType<typeof setInterval> | null = null;
let pollInflight: Promise<void> | null = null;

/** Gregorian YYYY-MM-DD in Asia/Tehran. */
export function tehranDateKey(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function extractPrices(payload: unknown): Record<string, unknown> {
  if (
    payload &&
    typeof payload === "object" &&
    "result" in payload &&
    (payload as { result: unknown }).result &&
    typeof (payload as { result: unknown }).result === "object"
  ) {
    return (payload as { result: Record<string, unknown> }).result;
  }
  if (payload && typeof payload === "object") {
    return payload as Record<string, unknown>;
  }
  return {};
}

function parsePrice(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n >= 100 ? Math.floor(n) : Number(n.toFixed(4));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms).unref?.();
  });
}

function isRetryableFetchError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const message = err instanceof Error ? err.message : String(err);
  if (/fetch failed|timeout|aborted|ECONNRESET|ECONNREFUSED|ETIMEDOUT|UND_ERR|socket|other side closed/i.test(message)) {
    return true;
  }
  const cause = "cause" in err ? (err as { cause?: unknown }).cause : undefined;
  if (cause && cause !== err) return isRetryableFetchError(cause);
  return false;
}

async function fetchSwapWalletPrices(): Promise<Record<string, unknown>> {
  if (!env.SWAPWALLET_API_KEY) {
    throw new Error("SWAPWALLET_API_KEY not configured");
  }

  let lastError: unknown;
  for (let attempt = 1; attempt <= SWAPWALLET_FETCH_RETRIES; attempt++) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), SWAPWALLET_FETCH_TIMEOUT_MS);
    timer.unref?.();
    try {
      const response = await fetch(SWAPWALLET_PRICES_URL, {
        headers: {
          Authorization: `Bearer ${env.SWAPWALLET_API_KEY}`,
          Accept: "application/json",
        },
        signal: ac.signal,
      });

      if (!response.ok) {
        const retryable = response.status >= 500 || response.status === 429;
        const err = new Error(`SwapWallet prices failed: ${response.status}`);
        if (!retryable || attempt >= SWAPWALLET_FETCH_RETRIES) throw err;
        lastError = err;
      } else {
        return extractPrices(await response.json());
      }
    } catch (err) {
      lastError = err;
      if (!isRetryableFetchError(err) && !(err instanceof Error && /SwapWallet prices failed: (5\d\d|429)/.test(err.message))) {
        throw err;
      }
      if (attempt >= SWAPWALLET_FETCH_RETRIES) break;
    } finally {
      clearTimeout(timer);
    }
    await sleep(400 * attempt);
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(String(lastError ?? "SwapWallet fetch failed"));
}

function mapPairsToAssets(prices: Record<string, unknown>): WalletRates {
  const rates = { toman: 1 } as WalletRates;
  const missing: string[] = [];

  for (const [assetId, pair] of Object.entries(ASSET_PAIR) as Array<
    [Exclude<AssetId, "toman">, string]
  >) {
    const parsed = parsePrice(prices[pair]);
    if (parsed == null) {
      missing.push(pair);
      continue;
    }
    rates[assetId] = parsed;
  }

  if (missing.length > 0) {
    throw new Error(`SwapWallet missing pairs: ${missing.join(", ")}`);
  }

  return rates;
}

function computeDailyChanges(
  current: WalletRates,
  dayOpen: WalletRates,
): WalletChanges {
  const changes = {} as WalletChanges;
  for (const id of CRYPTO_ASSETS) {
    const open = dayOpen[id];
    const now = current[id];
    if (!(open > 0) || !(now > 0)) {
      changes[id] = 0;
      continue;
    }
    const pct = ((now - open) / open) * 100;
    changes[id] = Math.round(pct * 100) / 100;
  }
  return changes;
}

async function readDayOpen(): Promise<DayOpenPayload | null> {
  try {
    const raw = await redis.get(REDIS_DAY_OPEN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DayOpenPayload;
    if (!parsed?.dateKey || !parsed.rates) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function writeDayOpen(payload: DayOpenPayload): Promise<void> {
  await redis.set(
    REDIS_DAY_OPEN_KEY,
    JSON.stringify(payload),
    "EX",
    REDIS_DAY_OPEN_TTL_SEC,
  );
}

/**
 * Midnight open for Asia/Tehran calendar day.
 * - At 00:00 (first poll of the new day) snapshot current prices into Redis.
 * - Keep that snapshot unchanged until tomorrow 00:00.
 * - Daily % = (now - midnightOpen) / midnightOpen * 100
 */
async function resolveDayOpen(current: WalletRates): Promise<DayOpenPayload> {
  const today = tehranDateKey();
  const existing = await readDayOpen();

  // Same Tehran day → never overwrite midnight baseline.
  if (existing && existing.dateKey === today && existing.rates) {
    return existing;
  }

  // New day (or first boot): this poll is the 00:00 open for today.
  const next: DayOpenPayload = {
    dateKey: today,
    rates: { ...current, toman: 1 },
    capturedAt: new Date().toISOString(),
  };
  await writeDayOpen(next);
  log.event("pricing", `midnight-open ${today}`);
  return next;
}

async function writeRatesToRedis(payload: RatesCachePayload): Promise<void> {
  await redis.set(
    REDIS_RATES_KEY,
    JSON.stringify(payload),
    "EX",
    REDIS_RATES_TTL_SEC,
  );
}

async function readRatesFromRedis(): Promise<RatesCachePayload | null> {
  try {
    const raw = await redis.get(REDIS_RATES_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RatesCachePayload;
    if (
      !parsed?.rates ||
      parsed.source !== "swapwallet" ||
      !(parsed.rates.trx > 0) ||
      !(parsed.rates.usdt > 0) ||
      !(parsed.rates.bnb > 0) ||
      !(parsed.rates.matic > 0) ||
      !(parsed.rates.gram > 0)
    ) {
      return null;
    }
    if (!parsed.changes) {
      parsed.changes = {
        trx: 0,
        usdt: 0,
        bnb: 0,
        matic: 0,
        gram: 0,
      };
    }
    return parsed;
  } catch (err) {
    log.warn("pricing", err instanceof Error ? err.message : String(err));
    return null;
  }
}

/**
 * One SwapWallet → Redis refresh. Safe to call from the poller only.
 * User-facing routes must never call this.
 * Never rejects — concurrent waiters also get a boolean, not a thrown error.
 */
export async function refreshSwapWalletRatesToRedis(): Promise<boolean> {
  if (pollInflight) {
    try {
      await pollInflight;
      return true;
    } catch {
      return false;
    }
  }

  pollInflight = (async () => {
    const prices = await fetchSwapWalletPrices();
    const rates = mapPairsToAssets(prices);
    const dayOpen = await resolveDayOpen(rates);
    const changes = computeDailyChanges(rates, dayOpen.rates);
    const payload: RatesCachePayload = {
      rates,
      changes,
      source: "swapwallet",
      updatedAt: new Date().toISOString(),
      dayKey: dayOpen.dateKey,
    };
    await writeRatesToRedis(payload);
    log.debug(
      "pricing",
      `Redis←SwapWallet TRX=${rates.trx}(${changes.trx}%) USDT=${rates.usdt}(${changes.usdt}%)`,
    );
  })();
  // Ensure rejection is observed even if a concurrent waiter races away.
  void pollInflight.catch(() => undefined);

  try {
    await pollInflight;
    return true;
  } catch (err) {
    log.warn(
      "pricing",
      `SwapWallet poll failed — ${err instanceof Error ? err.message : String(err)}`,
    );
    return false;
  } finally {
    pollInflight = null;
  }
}

/**
 * Start background poller: SwapWallet every 10s → Redis.
 * Users only read Redis via getWalletRates().
 */
export function startSwapWalletRatesJob(): void {
  if (pollTimer) return;
  if (!env.SWAPWALLET_API_KEY) {
    log.service("Pricing", "SWAPWALLET_API_KEY missing", false);
    return;
  }

  const tick = () => {
    void refreshSwapWalletRatesToRedis().catch((err) => {
      log.warn(
        "pricing",
        `SwapWallet tick — ${err instanceof Error ? err.message : String(err)}`,
      );
    });
  };

  void refreshSwapWalletRatesToRedis()
    .then((ok) => {
      log.service(
        "Pricing",
        ok
          ? `SwapWallet → Redis every ${SWAPWALLET_POLL_MS / 1000}s`
          : "SwapWallet poll failed (will retry)",
        ok,
      );
    })
    .catch((err) => {
      log.warn(
        "pricing",
        `SwapWallet boot — ${err instanceof Error ? err.message : String(err)}`,
      );
      log.service("Pricing", "SwapWallet poll failed (will retry)", false);
    });

  pollTimer = setInterval(tick, SWAPWALLET_POLL_MS);
  pollTimer.unref?.();
}

export function stopSwapWalletRatesJob(): void {
  if (!pollTimer) return;
  clearInterval(pollTimer);
  pollTimer = null;
}

/**
 * User-facing rates: Redis only — never calls SwapWallet.
 */
export async function getWalletRates(): Promise<{
  rates: WalletRates;
  changes: WalletChanges;
  source: "swapwallet";
  updatedAt: string;
  dayKey: string;
}> {
  const cached = await readRatesFromRedis();
  if (!cached) {
    throw Object.assign(
      new Error("Live rates not ready — try again shortly"),
      { statusCode: 503 },
    );
  }
  return cached;
}

export async function getAssetRateToman(assetId: AssetId): Promise<number> {
  const { rates } = await getWalletRates();
  const rate = rates[assetId];
  if (!(rate > 0)) {
    throw Object.assign(new Error(`No live rate for ${assetId}`), {
      statusCode: 503,
    });
  }
  return rate;
}

/** Convert using Redis-cached SwapWallet toman rates only. */
export async function convertAmountLive(
  fromAsset: AssetId,
  toAsset: AssetId,
  amount: number,
): Promise<{
  received: number;
  fromRate: number;
  toRate: number;
  amountToman: number;
}> {
  const { rates } = await getWalletRates();
  const fromRate = rates[fromAsset];
  const toRate = rates[toAsset];
  if (!(fromRate > 0) || !(toRate > 0)) {
    throw Object.assign(new Error("Live rate unavailable"), { statusCode: 503 });
  }
  if (!(amount > 0) || !Number.isFinite(amount)) {
    throw Object.assign(new Error("Invalid amount"), { statusCode: 400 });
  }
  const decimals = ASSETS.find((a) => a.id === toAsset)?.decimals ?? 6;
  const result = (amount * fromRate) / toRate;
  const factor = 10 ** decimals;
  const received = Math.floor(result * factor) / factor;
  return {
    received,
    fromRate,
    toRate,
    amountToman: amount * fromRate,
  };
}
