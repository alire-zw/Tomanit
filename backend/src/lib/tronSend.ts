import { SigningKey, getBytes } from "ethers";
import { env } from "../config/env.js";
import { telegramFetch } from "./telegramProxy.js";
import {
  ethPrivateKeyToTronAddress,
  tronAddressToBase58,
  tronAddressToHex,
} from "./walletCrypto.js";

const TRX_SUN = 1_000_000;
const USDT_DECIMALS = 6;

/**
 * Fee buffers aligned with typical Trust Wallet / Tron fee UX:
 * - plain TRX transfer ≈ 0–0.1 TRX (often free with free bandwidth)
 * - TRC20 without rented energy burns more, but we only gate on a small min
 *   and fall back to master if the broadcast fails.
 */
/** TRX left on deposit address after a sweep (one future native fee). */
export const TRON_FEE_RESERVE_TRX = 1;
/** TRX kept back when sending native TRX from the user wallet (Max-style). */
export const TRON_WITHDRAW_RESERVE_TRX = 0.1;
/** Min TRX on the user wallet before attempting a TRC20 (USDT) send. */
export const TRON_TOKEN_GAS_RESERVE_TRX = 1;

type TronUnsignedTx = {
  visible?: boolean;
  txID: string;
  raw_data?: unknown;
  raw_data_hex?: string;
  [key: string]: unknown;
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
    "TRON-PRO-API-KEY": env.TRONGRID_API_KEY!,
  };
}

async function tronWalletApi<T>(path: string, body: unknown): Promise<T> {
  const url = `${env.TRONGRID_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const res = await telegramFetch(url, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(body),
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
          : typeof data === "object" && data && "message" in data
            ? String((data as { message: string }).message)
            : `TronGrid HTTP ${res.status}`;
      throw Object.assign(new Error(msg), { statusCode: 502 });
    }
    return data as T;
  } finally {
    clearTimeout(timer);
  }
}

function normalizePrivateKey(privateKey: string): string {
  const hex = privateKey.trim().replace(/^0x/i, "");
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw Object.assign(new Error("Invalid private key"), { statusCode: 400 });
  }
  return `0x${hex}`;
}

export function privateKeyToTronAddress(privateKey: string): string {
  return ethPrivateKeyToTronAddress(normalizePrivateKey(privateKey));
}

function signTronTxId(txID: string, privateKey: string): string {
  const key = new SigningKey(normalizePrivateKey(privateKey));
  const digest = getBytes(`0x${txID}`);
  const sig = key.sign(digest);
  const v = Number(sig.v);
  const recovery = Number.isFinite(v) ? (v >= 27 ? v - 27 : v) : 0;
  return `${sig.r.slice(2)}${sig.s.slice(2)}${recovery.toString(16).padStart(2, "0")}`;
}

async function broadcastSigned(
  unsigned: TronUnsignedTx,
  privateKey: string,
): Promise<string> {
  if (!unsigned?.txID) {
    throw Object.assign(new Error("TronGrid did not return txID"), {
      statusCode: 502,
    });
  }
  const signature = signTronTxId(unsigned.txID, privateKey);
  const payload = { ...unsigned, signature: [signature] };
  const result = await tronWalletApi<{
    result?: boolean;
    txid?: string;
    message?: string;
    code?: string;
  }>("/wallet/broadcasttransaction", payload);

  if (result.result === false) {
    let message = result.message || result.code || "Broadcast failed";
    try {
      if (result.message && /^[0-9a-fA-F]+$/.test(result.message)) {
        message = Buffer.from(result.message, "hex").toString("utf8");
      }
    } catch {
      // keep raw
    }
    throw Object.assign(new Error(message), { statusCode: 502 });
  }
  return result.txid || unsigned.txID;
}

function encodeTrc20TransferParameter(toBase58: string, amountRaw: bigint): string {
  const toHex = tronAddressToHex(toBase58).replace(/^41/i, "").toLowerCase();
  const addressWord = toHex.padStart(64, "0");
  const amountWord = amountRaw.toString(16).padStart(64, "0");
  return `${addressWord}${amountWord}`;
}

export async function sendTrx(params: {
  fromPrivateKey: string;
  toAddress: string;
  amountTrx: number;
}): Promise<{ txHash: string; fromAddress: string; toAddress: string }> {
  const toAddress = tronAddressToBase58(params.toAddress);
  const fromAddress = privateKeyToTronAddress(params.fromPrivateKey);

  if (!(params.amountTrx > 0) || !Number.isFinite(params.amountTrx)) {
    throw Object.assign(new Error("Invalid TRX amount"), { statusCode: 400 });
  }
  const sun = Math.round(params.amountTrx * TRX_SUN);
  if (!(sun > 0)) {
    throw Object.assign(new Error("Amount too small"), { statusCode: 400 });
  }

  const unsigned = await tronWalletApi<TronUnsignedTx>("/wallet/createtransaction", {
    owner_address: tronAddressToHex(fromAddress),
    to_address: tronAddressToHex(toAddress),
    amount: sun,
    visible: false,
  });

  const txHash = await broadcastSigned(unsigned, params.fromPrivateKey);
  return { txHash, fromAddress, toAddress };
}

export async function sendTrc20Usdt(params: {
  fromPrivateKey: string;
  toAddress: string;
  amountUsdt: number;
}): Promise<{ txHash: string; fromAddress: string; toAddress: string }> {
  const fromAddress = privateKeyToTronAddress(params.fromPrivateKey);
  const toAddress = tronAddressToBase58(params.toAddress);

  if (!(params.amountUsdt > 0) || !Number.isFinite(params.amountUsdt)) {
    throw Object.assign(new Error("Invalid USDT amount"), { statusCode: 400 });
  }
  const raw = BigInt(Math.round(params.amountUsdt * 10 ** USDT_DECIMALS));
  if (raw <= 0n) {
    throw Object.assign(new Error("Amount too small"), { statusCode: 400 });
  }

  const contract = env.TRON_USDT_CONTRACT;
  if (!contract) {
    throw Object.assign(new Error("TRON USDT contract not configured"), {
      statusCode: 503,
    });
  }

  const trigger = await tronWalletApi<{
    result?: { result?: boolean; message?: string };
    transaction?: TronUnsignedTx;
  }>("/wallet/triggersmartcontract", {
    owner_address: tronAddressToHex(fromAddress),
    contract_address: tronAddressToHex(contract),
    function_selector: "transfer(address,uint256)",
    parameter: encodeTrc20TransferParameter(toAddress, raw),
    fee_limit: 100_000_000,
    call_value: 0,
    visible: false,
  });

  if (trigger.result?.result === false) {
    let message = trigger.result.message || "TRC20 trigger failed";
    try {
      if (/^[0-9a-fA-F]+$/.test(message)) {
        message = Buffer.from(message, "hex").toString("utf8");
      }
    } catch {
      // keep
    }
    throw Object.assign(new Error(message), { statusCode: 502 });
  }
  if (!trigger.transaction?.txID) {
    throw Object.assign(new Error("TRC20 transaction missing"), {
      statusCode: 502,
    });
  }

  const txHash = await broadcastSigned(trigger.transaction, params.fromPrivateKey);
  return { txHash, fromAddress, toAddress };
}
