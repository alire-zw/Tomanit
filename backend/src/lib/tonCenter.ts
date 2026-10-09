import { env } from "../config/env.js";
import { telegramFetch } from "./telegramProxy.js";

const TON_NANOTON = 1_000_000_000;

export type TonOnChainBalance = {
  address: string;
  /** Native TON balance — mapped to app asset `gram`. */
  ton: number;
  gram: number;
  source: "toncenter";
};

function requireKey() {
  if (!env.TONCENTER_API_KEY) {
    throw Object.assign(new Error("TONCENTER_API_KEY is not configured"), {
      statusCode: 503,
    });
  }
}

async function tonFetch<T>(
  path: string,
  query: Record<string, string> = {},
): Promise<T> {
  requireKey();
  const url = new URL(
    `${env.TONCENTER_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`,
  );
  url.searchParams.set("api_key", env.TONCENTER_API_KEY);
  for (const [k, v] of Object.entries(query)) {
    url.searchParams.set(k, v);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const res = await telegramFetch(url.toString(), {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    const data = (await res.json()) as {
      ok?: boolean;
      result?: unknown;
      error?: string;
      description?: string;
    };
    if (!res.ok || data.ok === false) {
      throw Object.assign(
        new Error(data.error || data.description || `TonCenter HTTP ${res.status}`),
        { statusCode: 502 },
      );
    }
    return (data.result ?? data) as T;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Native TON balance via TonCenter.
 * App catalog uses `gram` for the TON-network asset — we expose both fields.
 */
export async function getTonOnChainBalance(
  address: string,
): Promise<TonOnChainBalance> {
  const trimmed = address.trim();
  if (!/^(EQ|UQ)[A-Za-z0-9_-]{46,}$/.test(trimmed)) {
    throw Object.assign(new Error("Invalid TON address"), { statusCode: 400 });
  }

  const raw = await tonFetch<string>("/getAddressBalance", {
    address: trimmed,
  });
  const nano = Number(raw);
  const ton = Number.isFinite(nano) ? nano / TON_NANOTON : 0;

  return {
    address: trimmed,
    ton,
    gram: ton,
    source: "toncenter",
  };
}

export async function pingTonCenter(): Promise<{ ok: boolean; message: string }> {
  try {
    requireKey();
    await tonFetch<unknown>("/getMasterchainInfo");
    return { ok: true, message: "TonCenter OK" };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}
