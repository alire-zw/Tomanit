import { env } from "../config/env.js";
import { redis } from "../db/redis.js";
import { log } from "./log.js";
import type { AssetId } from "./walletAssets.js";

const CHART_ALL_RANGES_URL =
  "https://swapwallet.app/api/v2/market-data/chart/all-ranges";
const KLINE_URL = "https://swapwallet.app/api/v2/market-data/kline";

const REDIS_LINE_PREFIX = "tomanit:market:chart:line:";
const REDIS_CANDLE_PREFIX = "tomanit:market:chart:candle:";
/** Keep charts warm — users only read Redis. */
const REDIS_TTL_SEC = 15 * 60;
/** Background refresh interval (all tokens × 1 all-ranges call). */
export const CHART_POLL_MS = 120_000;
const CHART_FETCH_TIMEOUT_MS = 20_000;
const CHART_FETCH_RETRIES = 3;

export const CHART_RANGES = [
  "DAY",
  "WEEK",
  "MONTH",
  "SIX_MONTH",
  "YEAR",
  "ALL",
] as const;

export type ChartRange = (typeof CHART_RANGES)[number];
export type ChartStyle = "line" | "candle";

const ASSET_TOKEN: Record<Exclude<AssetId, "toman">, string> = {
  trx: "TRX",
  usdt: "USDT",
  bnb: "BNB",
  matic: "POL",
  gram: "TON",
};

const CRYPTO_ASSETS = Object.keys(ASSET_TOKEN) as Array<Exclude<AssetId, "toman">>;

export type LinePoint = { time: number; value: number };
export type CandlePoint = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

export type LineRanges = Partial<Record<ChartRange, LinePoint[]>>;

type LineBundle = {
  token: string;
  ranges: LineRanges;
  updatedAt: string;
};

export function isChartRange(value: string): value is ChartRange {
  return (CHART_RANGES as readonly string[]).includes(value);
}

export function isChartStyle(value: string): value is ChartStyle {
  return value === "line" || value === "candle";
}

function lineKey(token: string): string {
  return `${REDIS_LINE_PREFIX}${token}`;
}

function candleKey(token: string, range: ChartRange): string {
  return `${REDIS_CANDLE_PREFIX}${token}:${range}`;
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

async function fetchSwapWalletJson(url: string): Promise<unknown> {
  if (!env.SWAPWALLET_API_KEY) {
    throw Object.assign(new Error("SWAPWALLET_API_KEY not configured"), {
      statusCode: 503,
    });
  }

  let lastError: unknown;
  for (let attempt = 1; attempt <= CHART_FETCH_RETRIES; attempt++) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), CHART_FETCH_TIMEOUT_MS);
    timer.unref?.();
    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${env.SWAPWALLET_API_KEY}`,
          Accept: "application/json",
        },
        signal: ac.signal,
      });
      if (!response.ok) {
        const retryable = response.status >= 500 || response.status === 429;
        const err = Object.assign(
          new Error(`SwapWallet chart failed: ${response.status}`),
          { statusCode: 502 },
        );
        if (!retryable || attempt >= CHART_FETCH_RETRIES) throw err;
        lastError = err;
      } else {
        return response.json();
      }
    } catch (err) {
      lastError = err;
      if (
        !isRetryableFetchError(err) &&
        !(err instanceof Error && /SwapWallet chart failed: (5\d\d|429)/.test(err.message))
      ) {
        throw err;
      }
      if (attempt >= CHART_FETCH_RETRIES) break;
    } finally {
      clearTimeout(timer);
    }
    await sleep(500 * attempt);
  }

  throw lastError instanceof Error
    ? lastError
    : Object.assign(new Error(String(lastError ?? "SwapWallet chart fetch failed")), {
        statusCode: 502,
      });
}

function toUnixSec(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n > 1e12 ? n / 1000 : n);
}

function toPrice(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function dedupeByTime<T extends { time: number }>(points: T[]): T[] {
  const map = new Map<number, T>();
  for (const p of points) map.set(p.time, p);
  return [...map.values()].sort((a, b) => a.time - b.time);
}

function parseLinePoints(rows: unknown[]): LinePoint[] {
  const out: LinePoint[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const item = row as { x?: unknown; y?: unknown };
    const time = toUnixSec(item.x);
    const value = toPrice(item.y);
    if (time == null || value == null) continue;
    out.push({ time, value });
  }
  return dedupeByTime(out);
}

function parseCandlePoints(rows: unknown[]): CandlePoint[] {
  const out: CandlePoint[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const item = row as { x?: unknown; y?: unknown };
    const time = toUnixSec(item.x);
    if (time == null || !Array.isArray(item.y) || item.y.length < 4) continue;
    const open = toPrice(item.y[0]);
    const high = toPrice(item.y[1]);
    const low = toPrice(item.y[2]);
    const close = toPrice(item.y[3]);
    if (open == null || high == null || low == null || close == null) continue;
    out.push({ time, open, high, low, close });
  }
  return dedupeByTime(out);
}

function extractResultObject(payload: unknown): Record<string, unknown> | null {
  if (
    payload &&
    typeof payload === "object" &&
    "result" in payload &&
    (payload as { result: unknown }).result &&
    typeof (payload as { result: unknown }).result === "object"
  ) {
    return (payload as { result: Record<string, unknown> }).result;
  }
  return null;
}

function extractDataArray(payload: unknown): unknown[] {
  const result = extractResultObject(payload);
  if (result && Array.isArray(result.data)) return result.data;
  return [];
}

function parseAllRanges(payload: unknown): LineRanges {
  const result = extractResultObject(payload);
  if (!result) return {};
  const ranges: LineRanges = {};
  for (const range of CHART_RANGES) {
    const block = result[range];
    let rows: unknown[] = [];
    if (Array.isArray(block)) {
      rows = block;
    } else if (block && typeof block === "object" && Array.isArray((block as { data?: unknown }).data)) {
      rows = (block as { data: unknown[] }).data;
    }
    const points = parseLinePoints(rows);
    if (points.length > 0) ranges[range] = points;
  }
  return ranges;
}

async function readLineBundle(token: string): Promise<LineBundle | null> {
  try {
    const raw = await redis.get(lineKey(token));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LineBundle;
    if (!parsed?.ranges || typeof parsed.ranges !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

async function writeLineBundle(token: string, ranges: LineRanges): Promise<void> {
  const payload: LineBundle = {
    token,
    ranges,
    updatedAt: new Date().toISOString(),
  };
  await redis.set(lineKey(token), JSON.stringify(payload), "EX", REDIS_TTL_SEC);
}

async function fetchAndCacheLineBundle(token: string): Promise<LineBundle | null> {
  const params = new URLSearchParams({ token, currency: "IRT" });
  const payload = await fetchSwapWalletJson(`${CHART_ALL_RANGES_URL}?${params}`);
  const ranges = parseAllRanges(payload);
  if (Object.keys(ranges).length === 0) return null;
  try {
    await writeLineBundle(token, ranges);
  } catch {
    // ignore redis write
  }
  return { token, ranges, updatedAt: new Date().toISOString() };
}

async function fetchAndCacheCandle(
  token: string,
  range: ChartRange,
): Promise<CandlePoint[]> {
  const params = new URLSearchParams({
    token,
    dataRange: range,
    currency: "IRT",
  });
  const payload = await fetchSwapWalletJson(`${KLINE_URL}?${params}`);
  const points = parseCandlePoints(extractDataArray(payload));
  if (points.length === 0) {
    throw Object.assign(new Error("Chart data unavailable"), { statusCode: 503 });
  }
  try {
    await redis.set(candleKey(token, range), JSON.stringify(points), "EX", REDIS_TTL_SEC);
  } catch {
    // ignore
  }
  return points;
}

/** Closest line-chart price (IRT) for an asset near unix seconds. Redis-only. */
export async function getAssetRateTomanNearTime(
  assetId: Exclude<AssetId, "toman">,
  unixSec: number,
): Promise<number | null> {
  if (!(unixSec > 0)) return null;
  const token = ASSET_TOKEN[assetId];
  const bundle = await readLineBundle(token);
  if (!bundle) return null;

  const prefer: ChartRange[] = ["DAY", "WEEK", "MONTH", "SIX_MONTH", "YEAR", "ALL"];
  let best: LinePoint | null = null;
  let bestDist = Number.POSITIVE_INFINITY;

  for (const range of prefer) {
    const points = bundle.ranges[range];
    if (!points?.length) continue;
    // Binary search nearest
    let lo = 0;
    let hi = points.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (points[mid]!.time < unixSec) lo = mid + 1;
      else hi = mid;
    }
    const candidates = [points[lo], points[Math.max(0, lo - 1)]].filter(
      Boolean,
    ) as LinePoint[];
    for (const p of candidates) {
      const dist = Math.abs(p.time - unixSec);
      if (dist < bestDist && p.value > 0) {
        bestDist = dist;
        best = p;
      }
    }
    // Prefer finer ranges when within a reasonable window
    if (best && bestDist <= 6 * 3600) break;
  }

  return best && best.value > 0 ? best.value : null;
}

/** Redis-only line charts for one asset (all periods). Never blocks on SwapWallet. */
export async function getAssetLineCharts(assetId: Exclude<AssetId, "toman">): Promise<{
  asset: Exclude<AssetId, "toman">;
  token: string;
  style: "line";
  ranges: LineRanges;
  updatedAt: string;
  source: "swapwallet";
}> {
  const token = ASSET_TOKEN[assetId];
  const bundle = await readLineBundle(token);
  if (!bundle || !bundle.ranges.DAY?.length) {
    // Warm Redis in background — client should use local cache meanwhile.
    void fetchAndCacheLineBundle(token).catch(() => undefined);
    throw Object.assign(new Error("Chart data not ready — try again shortly"), {
      statusCode: 503,
    });
  }
  return {
    asset: assetId,
    token,
    style: "line",
    ranges: bundle.ranges,
    updatedAt: bundle.updatedAt,
    source: "swapwallet",
  };
}

export async function getAssetChart(
  assetId: Exclude<AssetId, "toman">,
  range: ChartRange,
  style: ChartStyle,
): Promise<{
  asset: Exclude<AssetId, "toman">;
  token: string;
  range: ChartRange;
  style: ChartStyle;
  points: LinePoint[] | CandlePoint[];
  source: "swapwallet";
}> {
  const token = ASSET_TOKEN[assetId];

  if (style === "line") {
    const bundle = await getAssetLineCharts(assetId);
    const points = bundle.ranges[range];
    if (!points?.length) {
      throw Object.assign(new Error("Chart range unavailable"), { statusCode: 503 });
    }
    return { asset: assetId, token, range, style, points, source: "swapwallet" };
  }

  try {
    const cached = await redis.get(candleKey(token, range));
    if (cached) {
      const parsed = JSON.parse(cached) as CandlePoint[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return { asset: assetId, token, range, style, points: parsed, source: "swapwallet" };
      }
    }
  } catch {
    // ignore
  }

  const points = await fetchAndCacheCandle(token, range);
  return { asset: assetId, token, range, style, points, source: "swapwallet" };
}

let pollTimer: ReturnType<typeof setInterval> | null = null;
let pollInflight: Promise<void> | null = null;

async function refreshAllLineCharts(): Promise<void> {
  if (pollInflight) {
    try {
      await pollInflight;
    } catch {
      // Prior tick failed — this caller must not reject.
    }
    return;
  }

  pollInflight = (async () => {
    let ok = 0;
    for (const assetId of CRYPTO_ASSETS) {
      const token = ASSET_TOKEN[assetId];
      try {
        const bundle = await fetchAndCacheLineBundle(token);
        if (bundle) ok += 1;
      } catch (err) {
        log.warn("Charts", `${token}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    if (ok > 0) {
      log.event("Charts", `Redis←SwapWallet line ${ok}/${CRYPTO_ASSETS.length}`);
    }
  })();
  void pollInflight.catch(() => undefined);

  try {
    await pollInflight;
  } catch (err) {
    log.warn(
      "Charts",
      `refresh failed — ${err instanceof Error ? err.message : String(err)}`,
    );
  } finally {
    pollInflight = null;
  }
}

export function startSwapWalletChartsJob(): void {
  if (pollTimer) return;
  if (!env.SWAPWALLET_API_KEY) return;

  const tick = () => {
    void refreshAllLineCharts().catch((err) => {
      log.warn(
        "Charts",
        `tick — ${err instanceof Error ? err.message : String(err)}`,
      );
    });
  };

  tick();

  pollTimer = setInterval(tick, CHART_POLL_MS);
  pollTimer.unref?.();
  log.service("Charts", `SwapWallet → Redis every ${CHART_POLL_MS / 1000}s`, true);
}

export function stopSwapWalletChartsJob(): void {
  if (!pollTimer) return;
  clearInterval(pollTimer);
  pollTimer = null;
}
