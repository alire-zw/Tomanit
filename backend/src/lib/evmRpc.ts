import { Contract, JsonRpcProvider, formatEther, formatUnits } from "ethers";
import { env } from "../config/env.js";
import { createRateLimiter } from "./rateLimit.js";

const ERC20_ABI = ["function balanceOf(address owner) view returns (uint256)"] as const;

export type EvmNetwork = "bsc" | "polygon";

/** Known USDT decimals — avoids an extra RPC per wallet. */
const USDT_DECIMALS: Record<EvmNetwork, number> = {
  bsc: 18,
  polygon: 6,
};

export type EvmOnChainBalance = {
  network: EvmNetwork;
  address: string;
  native: number;
  nativeSymbol: "bnb" | "matic";
  usdt: number;
  source: "ankr" | "rpc";
};

/**
 * Shared Ankr budget for BSC + Polygon (same API key).
 * Stay under 10 rps with headroom for user-facing requests.
 */
export const ankrLimiter = createRateLimiter(8, "ankr");

function rpcUrl(network: EvmNetwork): string {
  return network === "bsc" ? env.BSC_RPC_URL : env.POLYGON_RPC_URL;
}

function usdtContract(network: EvmNetwork): string {
  return network === "bsc" ? env.BSC_USDT_CONTRACT : env.POLYGON_USDT_CONTRACT;
}

function getProvider(network: EvmNetwork): JsonRpcProvider {
  return new JsonRpcProvider(rpcUrl(network), undefined, {
    staticNetwork: true,
  });
}

async function withAnkrLimit<T>(fn: () => Promise<T>): Promise<T> {
  await ankrLimiter.acquire();
  return fn();
}

export async function getEvmOnChainBalance(
  network: EvmNetwork,
  address: string,
): Promise<EvmOnChainBalance> {
  const trimmed = address.trim();
  if (!/^0x[0-9a-fA-F]{40}$/.test(trimmed)) {
    throw Object.assign(new Error("Invalid EVM address"), { statusCode: 400 });
  }

  const provider = getProvider(network);
  const decimals = USDT_DECIMALS[network];
  const token = new Contract(usdtContract(network), ERC20_ABI, provider);

  // Two RPCs per wallet, both go through the shared Ankr limiter.
  const nativeWei = await withAnkrLimit(() => provider.getBalance(trimmed));
  const raw = await withAnkrLimit(
    () => token.balanceOf(trimmed) as Promise<bigint>,
  );

  const native = Number(formatEther(nativeWei));
  const usdt = Number(formatUnits(raw, decimals));

  return {
    network,
    address: trimmed,
    native: Number.isFinite(native) ? native : 0,
    nativeSymbol: network === "bsc" ? "bnb" : "matic",
    usdt: Number.isFinite(usdt) ? usdt : 0,
    source: env.ANKR_API_KEY ? "ankr" : "rpc",
  };
}

export async function pingEvm(network: EvmNetwork): Promise<{
  ok: boolean;
  message: string;
  blockNumber?: number;
}> {
  try {
    const provider = getProvider(network);
    const blockNumber = await withAnkrLimit(() => provider.getBlockNumber());
    return { ok: true, message: `${network} RPC OK`, blockNumber };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}
