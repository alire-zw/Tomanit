import { prisma } from "../db/prisma.js";
import { redis } from "../db/redis.js";
import { env } from "../config/env.js";
import { log } from "./log.js";

const NETWORK_FLAG_KEY = "tomanit:tron:active-network";

/**
 * When TRON_NETWORK changes (e.g. mainnet → nile), reset TRON scan snapshots
 * so the next balance job does a fresh baseline instead of false credits.
 */
export async function syncTronNetworkFlag(): Promise<void> {
  const current = env.TRON_NETWORK;
  let previous: string | null = null;
  try {
    previous = await redis.get(NETWORK_FLAG_KEY);
  } catch {
    previous = null;
  }

  if (previous === current) {
    log.service(
      "TRON",
      `${current}${env.TRON_IS_TESTNET ? " testnet" : ""} · ${env.TRONGRID_BASE_URL}`,
      true,
    );
    return;
  }

  try {
    await prisma.walletDepositAddress.updateMany({
      where: { network: "tron" },
      data: {
        lastNative: 0,
        lastUsdt: 0,
        lastCheckedAt: null,
      },
    });
  } catch (err) {
    log.warn(
      "tron",
      `reset scan snapshots failed — ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  try {
    await redis.set(NETWORK_FLAG_KEY, current);
  } catch {
    // ignore
  }

  log.service(
    "TRON",
    previous
      ? `switched ${previous} → ${current} · snapshots reset`
      : `${current}${env.TRON_IS_TESTNET ? " testnet" : ""} · ${env.TRONGRID_BASE_URL}`,
    true,
  );
  if (env.TRON_FAUCET_URL) {
    log.note("TRON faucet", env.TRON_FAUCET_URL);
  }
}
