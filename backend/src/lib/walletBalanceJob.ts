import { prisma } from "../db/prisma.js";
import { redis } from "../db/redis.js";
import { log } from "./log.js";
import { syncDepositAddress } from "./walletBalanceSync.js";

const JOB_INTERVAL_MS = 60_000;
/** Stop accepting new addresses before the next tick to avoid overlap. */
const JOB_BUDGET_MS = 50_000;
const PAGE_SIZE = 40;
const CURSOR_KEY = "tomanit:wallet:balance-scan:cursor";

let timer: ReturnType<typeof setInterval> | null = null;
let running = false;
/** In-memory cursor fallback when Redis is down. */
let memoryCursor = 0;

async function readCursor(): Promise<number> {
  try {
    const raw = await redis.get(CURSOR_KEY);
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) {
      memoryCursor = n;
      return n;
    }
  } catch {
    // fall through
  }
  return memoryCursor;
}

async function writeCursor(id: number): Promise<void> {
  memoryCursor = id;
  try {
    await redis.set(CURSOR_KEY, String(id), "EX", 7 * 24 * 60 * 60);
  } catch {
    // ignore
  }
}

/**
 * Scan custodial deposit addresses with rate-limited RPC calls.
 * Continues from Redis cursor so large wallet sets rotate across minutes.
 */
export async function runWalletBalanceScan(): Promise<{
  checked: number;
  credited: number;
  errors: number;
}> {
  const started = Date.now();
  let checked = 0;
  let credited = 0;
  let errors = 0;
  let cursor = await readCursor();
  let wrapped = false;

  while (Date.now() - started < JOB_BUDGET_MS) {
    const rows = await prisma.walletDepositAddress.findMany({
      where: { id: { gt: cursor } },
      orderBy: { id: "asc" },
      take: PAGE_SIZE,
    });

    if (rows.length === 0) {
      if (wrapped || cursor === 0) break;
      // Wrap to start for next pages within remaining budget.
      cursor = 0;
      wrapped = true;
      await writeCursor(0);
      continue;
    }

    for (const row of rows) {
      if (Date.now() - started >= JOB_BUDGET_MS) break;

      const result = await syncDepositAddress(row);
      cursor = row.id;
      if (result.checked) checked += 1;
      else errors += 1;
      credited += result.credited;
    }

    await writeCursor(cursor);

    if (rows.length < PAGE_SIZE && wrapped) break;
  }

  return { checked, credited, errors };
}

export function startWalletBalanceJob(): void {
  if (timer) return;

  const tick = () => {
    if (running) {
      log.warn("balance", "previous scan still running — skip tick");
      return;
    }
    running = true;
    void runWalletBalanceScan()
      .then((stats) => {
        if (stats.checked > 0 || stats.credited > 0 || stats.errors > 0) {
          log.event(
            "balance",
            `scan checked:${stats.checked} credited:${stats.credited} errors:${stats.errors}`,
          );
        }
      })
      .catch((err) => {
        log.warn(
          "balance",
          err instanceof Error ? err.message : String(err),
        );
      })
      .finally(() => {
        running = false;
      });
  };

  // First run shortly after boot (let HTTP come up first).
  setTimeout(tick, 5_000).unref?.();
  timer = setInterval(tick, JOB_INTERVAL_MS);
  timer.unref?.();

  log.service("Balance", `on-chain scan every ${JOB_INTERVAL_MS / 1000}s · Ankr ≤8 rps`, true);
}

export function stopWalletBalanceJob(): void {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}
