import { env } from "../config/env.js";
import { telegramFetch } from "./telegramProxy.js";
import { tronAddressToBase58 } from "./walletCrypto.js";

const USDT_DECIMALS = 6;
const TRX_SUN = 1_000_000;

export type TronOnChainBalance = {
  address: string;
  trx: number;
  usdt: number;
  createTime: number | null;
  rawBalanceSun: string;
  source: "trongrid";
};

function requireApiKey() {
  if (!env.TRONGRID_API_KEY) {
    throw Object.assign(new Error("TRONGRID_API_KEY is not configured"), {
      statusCode: 503,
    });
  }
}

function headers(): Record<string, string> {
  requireApiKey();
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    "TRON-PRO-API-KEY": env.TRONGRID_API_KEY,
  };
}

async function tronFetch<T>(
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<T> {
  const url = `${env.TRONGRID_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const res = await telegramFetch(url, {
      method: init?.method ?? "GET",
      headers: headers(),
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: controller.signal,
    });
    const text = await res.text();
    let data: unknown = null;
    if (text) {
      try {
        data = JSON.parse(text) as unknown;
      } catch {
        data = text;
      }
    }
    if (!res.ok) {
      const msg =
        typeof data === "object" && data && "Error" in data
          ? String((data as { Error: string }).Error)
          : typeof data === "object" && data && "error" in data
            ? String((data as { error: string }).error)
            : `TronGrid HTTP ${res.status}`;
      throw Object.assign(new Error(msg), { statusCode: 502 });
    }
    return data as T;
  } finally {
    clearTimeout(timer);
  }
}

type AccountV1 = {
  data?: Array<{
    address?: string;
    balance?: number;
    create_time?: number;
    trc20?: Array<Record<string, string>>;
  }>;
  success?: boolean;
  error?: string;
};

function findUsdtInTrc20(
  trc20: Array<Record<string, string>> | undefined,
): number {
  if (!trc20?.length) return 0;
  const contract = env.TRON_USDT_CONTRACT;
  for (const row of trc20) {
    const raw = row[contract];
    if (raw != null) {
      const n = Number(raw);
      if (Number.isFinite(n)) return n / 10 ** USDT_DECIMALS;
    }
  }
  return 0;
}

/**
 * Fetch live TRX + USDT-TRC20 balances for a base58 TRON address via TronGrid.
 */
export async function getTronOnChainBalance(
  address: string,
): Promise<TronOnChainBalance> {
  const trimmed = address.trim();
  if (!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(trimmed)) {
    throw Object.assign(new Error("Invalid TRON address"), { statusCode: 400 });
  }

  const res = await tronFetch<AccountV1>(
    `/v1/accounts/${encodeURIComponent(trimmed)}`,
  );

  const account = res.data?.[0];
  if (!account) {
    // Address never seen on-chain — valid empty wallet
    return {
      address: trimmed,
      trx: 0,
      usdt: 0,
      createTime: null,
      rawBalanceSun: "0",
      source: "trongrid",
    };
  }

  const sun = Number(account.balance ?? 0);
  const trx = Number.isFinite(sun) ? sun / TRX_SUN : 0;
  const usdt = findUsdtInTrc20(account.trc20);

  return {
    address: trimmed,
    trx,
    usdt,
    createTime: account.create_time ?? null,
    rawBalanceSun: String(account.balance ?? 0),
    source: "trongrid",
  };
}

export type TronTransfer = {
  txId: string;
  from: string;
  to: string;
  amount: number;
  asset: "trx" | "usdt";
  timestamp: number;
  confirmed: boolean;
};

type Trc20TxV1 = {
  data?: Array<{
    transaction_id?: string;
    from?: string;
    to?: string;
    value?: string;
    block_timestamp?: number;
    token_info?: { address?: string; decimals?: number; symbol?: string };
  }>;
};

type TrxTxV1 = {
  data?: Array<{
    txID?: string;
    raw_data?: {
      contract?: Array<{
        parameter?: {
          value?: {
            amount?: number;
            owner_address?: string;
            to_address?: string;
          };
        };
        type?: string;
      }>;
      timestamp?: number;
    };
    ret?: Array<{ contractRet?: string }>;
  }>;
};

/** Recent inbound TRC20 USDT transfers (mainnet). */
export async function getTronUsdtTransfers(
  address: string,
  limit = 20,
): Promise<TronTransfer[]> {
  const trimmed = address.trim();
  const q = new URLSearchParams({
    only_to: "true",
    limit: String(Math.min(limit, 50)),
    contract_address: env.TRON_USDT_CONTRACT,
  });
  const res = await tronFetch<Trc20TxV1>(
    `/v1/accounts/${encodeURIComponent(trimmed)}/transactions/trc20?${q}`,
  );
  return (res.data ?? []).map((row) => {
    const decimals = row.token_info?.decimals ?? USDT_DECIMALS;
    const raw = Number(row.value ?? 0);
    return {
      txId: row.transaction_id ?? "",
      from: tronAddressToBase58(row.from ?? ""),
      to: tronAddressToBase58(row.to ?? ""),
      amount: Number.isFinite(raw) ? raw / 10 ** decimals : 0,
      asset: "usdt" as const,
      timestamp: row.block_timestamp ?? 0,
      confirmed: true,
    };
  });
}

/** Recent TRX transfers involving address. */
export async function getTronTrxTransfers(
  address: string,
  limit = 20,
): Promise<TronTransfer[]> {
  const trimmed = address.trim();
  const q = new URLSearchParams({
    only_to: "true",
    limit: String(Math.min(limit, 50)),
  });
  const res = await tronFetch<TrxTxV1>(
    `/v1/accounts/${encodeURIComponent(trimmed)}/transactions?${q}`,
  );
  const out: TronTransfer[] = [];
  for (const row of res.data ?? []) {
    const c = row.raw_data?.contract?.[0];
    if (c?.type !== "TransferContract") continue;
    const amountSun = Number(c.parameter?.value?.amount ?? 0);
    out.push({
      txId: row.txID ?? "",
      from: tronAddressToBase58(c.parameter?.value?.owner_address ?? ""),
      to: tronAddressToBase58(c.parameter?.value?.to_address ?? ""),
      amount: Number.isFinite(amountSun) ? amountSun / TRX_SUN : 0,
      asset: "trx",
      timestamp: row.raw_data?.timestamp ?? 0,
      confirmed: row.ret?.[0]?.contractRet === "SUCCESS",
    });
  }
  return out;
}

export async function pingTronGrid(): Promise<{
  ok: boolean;
  message: string;
  network?: string;
  baseUrl?: string;
}> {
  try {
    requireApiKey();
    await tronFetch<{ blockID?: string }>("/wallet/getnowblock", {
      method: "POST",
      body: {},
    });
    return {
      ok: true,
      message: `TronGrid OK (${env.TRON_NETWORK})`,
      network: env.TRON_NETWORK,
      baseUrl: env.TRONGRID_BASE_URL,
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : String(err),
      network: env.TRON_NETWORK,
      baseUrl: env.TRONGRID_BASE_URL,
    };
  }
}
