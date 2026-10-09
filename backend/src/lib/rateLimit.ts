/**
 * Async token-bucket rate limiter (for outbound RPC politeness).
 * Caps average rate at `rps` with a small burst equal to `rps`.
 */
export function createRateLimiter(rps: number, label = "limiter") {
  const capacity = Math.max(1, rps);
  let tokens = capacity;
  let lastRefill = Date.now();
  const waiters: Array<() => void> = [];

  function refill() {
    const now = Date.now();
    const elapsed = now - lastRefill;
    if (elapsed <= 0) return;
    tokens = Math.min(capacity, tokens + (elapsed / 1000) * rps);
    lastRefill = now;
  }

  function pump() {
    refill();
    while (tokens >= 1 && waiters.length > 0) {
      tokens -= 1;
      const next = waiters.shift();
      next?.();
    }
  }

  async function acquire(): Promise<void> {
    refill();
    if (tokens >= 1) {
      tokens -= 1;
      return;
    }
    await new Promise<void>((resolve) => {
      waiters.push(resolve);
    });
  }

  // Drain waiters as tokens refill.
  const timer = setInterval(pump, 50);
  timer.unref?.();

  return {
    label,
    acquire,
    stop() {
      clearInterval(timer);
    },
  };
}

export type RateLimiter = ReturnType<typeof createRateLimiter>;

type WindowBucket = {
  count: number;
  resetAt: number;
};

/**
 * Fixed-window HTTP rate limiter keyed by IP / user / custom string.
 * Returns true when the request is allowed.
 */
export function createHttpRateLimiter(options: {
  /** Max requests per window */
  max: number;
  /** Window length in ms */
  windowMs: number;
  /** Optional prefix for key namespacing */
  name?: string;
}) {
  const buckets = new Map<string, WindowBucket>();
  const { max, windowMs, name = "http" } = options;

  // Periodic cleanup of expired buckets
  const cleaner = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
  }, Math.max(30_000, windowMs));
  cleaner.unref?.();

  return {
    name,
    /** @returns remaining after this hit, or -1 if blocked */
    hit(key: string): { allowed: boolean; remaining: number; retryAfterSec: number } {
      const now = Date.now();
      const fullKey = `${name}:${key}`;
      let bucket = buckets.get(fullKey);
      if (!bucket || bucket.resetAt <= now) {
        bucket = { count: 0, resetAt: now + windowMs };
        buckets.set(fullKey, bucket);
      }
      bucket.count += 1;
      const remaining = Math.max(0, max - bucket.count);
      if (bucket.count > max) {
        return {
          allowed: false,
          remaining: 0,
          retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
        };
      }
      return { allowed: true, remaining, retryAfterSec: 0 };
    },
    stop() {
      clearInterval(cleaner);
      buckets.clear();
    },
  };
}

export type HttpRateLimiter = ReturnType<typeof createHttpRateLimiter>;

/** Shared limiters for sensitive exchange endpoints */
export const authLimiter = createHttpRateLimiter({
  name: "auth",
  max: 60,
  windowMs: 60_000,
});

export const kycLimiter = createHttpRateLimiter({
  name: "kyc",
  max: 8,
  windowMs: 15 * 60_000,
});

export const cardsLimiter = createHttpRateLimiter({
  name: "cards",
  max: 15,
  windowMs: 15 * 60_000,
});

export const walletWriteLimiter = createHttpRateLimiter({
  name: "wallet-write",
  max: 40,
  windowMs: 60_000,
});

export const gatewayWebhookLimiter = createHttpRateLimiter({
  name: "gw-webhook",
  max: 120,
  windowMs: 60_000,
});

export const supportWriteLimiter = createHttpRateLimiter({
  name: "support-write",
  max: 30,
  windowMs: 60_000,
});

export const shopRegisterLimiter = createHttpRateLimiter({
  name: "shop-register",
  max: 8,
  windowMs: 15 * 60_000,
});

export const payProxyLimiter = createHttpRateLimiter({
  name: "pay-proxy",
  max: 90,
  windowMs: 60_000,
});
