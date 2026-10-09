import {
  Contract,
  JsonRpcProvider,
  Wallet,
  parseEther,
  parseUnits,
} from "ethers";
import { env } from "../config/env.js";
import { ankrLimiter, type EvmNetwork } from "./evmRpc.js";

const ERC20_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
] as const;

const USDT_DECIMALS: Record<EvmNetwork, number> = {
  bsc: 18,
  polygon: 6,
};

/**
 * Native gas dust left after sweeps — Trust Wallet–scale (one simple transfer).
 * BSC transfers are usually ≪ 0.001 BNB; Polygon ≪ 0.05 MATIC.
 */
export const EVM_FEE_RESERVE: Record<EvmNetwork, number> = {
  bsc: 0.001,
  polygon: 0.05,
};

/** Kept back on user-funded native withdraws (Max ≈ balance − fee). */
export const EVM_WITHDRAW_RESERVE: Record<EvmNetwork, number> = {
  bsc: 0.0005,
  polygon: 0.02,
};

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

function normalizePrivateKey(privateKey: string): string {
  const hex = privateKey.trim().replace(/^0x/i, "");
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw Object.assign(new Error("Invalid private key"), { statusCode: 400 });
  }
  return `0x${hex}`;
}

export function privateKeyToEvmAddress(privateKey: string): string {
  return new Wallet(normalizePrivateKey(privateKey)).address;
}

export async function sendEvmNative(params: {
  network: EvmNetwork;
  fromPrivateKey: string;
  toAddress: string;
  amount: number;
}): Promise<{ txHash: string; fromAddress: string; toAddress: string }> {
  if (!(params.amount > 0) || !Number.isFinite(params.amount)) {
    throw Object.assign(new Error("Invalid amount"), { statusCode: 400 });
  }
  const provider = getProvider(params.network);
  const wallet = new Wallet(normalizePrivateKey(params.fromPrivateKey), provider);
  await ankrLimiter.acquire();
  const tx = await wallet.sendTransaction({
    to: params.toAddress.trim(),
    value: parseEther(String(params.amount)),
  });
  return {
    txHash: tx.hash,
    fromAddress: wallet.address,
    toAddress: params.toAddress.trim(),
  };
}

export async function sendEvmUsdt(params: {
  network: EvmNetwork;
  fromPrivateKey: string;
  toAddress: string;
  amountUsdt: number;
}): Promise<{ txHash: string; fromAddress: string; toAddress: string }> {
  if (!(params.amountUsdt > 0) || !Number.isFinite(params.amountUsdt)) {
    throw Object.assign(new Error("Invalid USDT amount"), { statusCode: 400 });
  }
  const provider = getProvider(params.network);
  const wallet = new Wallet(normalizePrivateKey(params.fromPrivateKey), provider);
  const token = new Contract(usdtContract(params.network), ERC20_ABI, wallet);
  const decimals = USDT_DECIMALS[params.network];
  await ankrLimiter.acquire();
  const tx = await token.transfer(
    params.toAddress.trim(),
    parseUnits(String(params.amountUsdt), decimals),
  );
  return {
    txHash: tx.hash as string,
    fromAddress: wallet.address,
    toAddress: params.toAddress.trim(),
  };
}
