import { prisma } from "../db/prisma.js";
import { log } from "./log.js";
import { tehranParts, tehranYesterdayKey } from "./gatewayRouting.js";

const SETTING_KEY = "gateway_last_reset_day";

async function readLastResetDay(): Promise<string | null> {
  const row = await prisma.appSetting.findUnique({ where: { key: SETTING_KEY } });
  return row?.value ?? null;
}

async function writeLastResetDay(day: string): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key: SETTING_KEY },
    create: { key: SETTING_KEY, value: day },
    update: { value: day },
  });
}

/** Roll today's volume into yesterday + daily stats; zero counters (Tehran midnight). */
export async function runGatewayDailyReset(force = false): Promise<number> {
  const today = tehranParts().dateKey;
  const last = await readLastResetDay();

  // First boot: remember today without wiping live counters.
  if (!force && !last) {
    await writeLastResetDay(today);
    return 0;
  }

  if (!force && last === today) return 0;

  const archiveDay = last && last !== today ? last : tehranYesterdayKey();
  const gateways = await prisma.paymentGateway.findMany();
  let resetCount = 0;

  for (const g of gateways) {
    const volume = g.balanceToman;
    const count = g.todayCount;
    const commission = BigInt(
      Math.floor((Number(volume) * Number(g.commissionPercent || 0)) / 100),
    );

    // Prefer summing completed charges for the archived Tehran day when available.
    let commissionToman = commission;
    try {
      const dayStart = tehranDayStartUtc(archiveDay);
      const dayEnd = tehranDayStartUtc(today);
      const charges = await prisma.gatewayCharge.findMany({
        where: {
          gatewayId: g.id,
          status: "completed",
          paidAt: { gte: dayStart, lt: dayEnd },
        },
        select: { commissionToman: true, amountToman: true, commissionPercent: true },
      });
      if (charges.length) {
        commissionToman = charges.reduce((sum, c) => {
          if (c.commissionToman && c.commissionToman > 0n) return sum + c.commissionToman;
          const est = Math.floor(
            (Number(c.amountToman) * Number(c.commissionPercent || g.commissionPercent || 0)) /
              100,
          );
          return sum + BigInt(est);
        }, 0n);
      }
    } catch {
      // keep estimate
    }

    await prisma.$transaction(async (tx) => {
      await tx.gatewayDailyStat.upsert({
        where: {
          gatewayId_day: { gatewayId: g.id, day: archiveDay },
        },
        create: {
          gatewayId: g.id,
          day: archiveDay,
          volumeToman: volume,
          chargeCount: count,
          commissionToman,
        },
        update: {
          volumeToman: volume,
          chargeCount: count,
          commissionToman,
        },
      });

      await tx.paymentGateway.update({
        where: { id: g.id },
        data: {
          yesterdayVolumeToman: volume,
          yesterdayCount: count,
          balanceToman: 0n,
          todayCount: 0,
          lastCapacityAlertAt: null,
        },
      });
    });
    resetCount += 1;
  }

  await writeLastResetDay(today);
  if (resetCount > 0) {
    log.event(
      "gateway-reset",
      `reset ${resetCount} gateway(s) · archived ${archiveDay} → ${today}`,
    );
  }
  return resetCount;
}

/** Approximate UTC instant for YYYY-MM-DD 00:00 in Tehran (UTC+3:30). */
function tehranDayStartUtc(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00.000+03:30`);
}

let timer: ReturnType<typeof setInterval> | null = null;

export function startGatewayDailyResetJob(): void {
  if (timer) return;
  void runGatewayDailyReset().catch((err) => {
    log.warn("gateway-reset", err instanceof Error ? err.message : String(err));
  });
  timer = setInterval(() => {
    void runGatewayDailyReset().catch((err) => {
      log.warn("gateway-reset", err instanceof Error ? err.message : String(err));
    });
  }, 60 * 1000);
  timer.unref?.();
  log.service("GatewayReset", "Tehran midnight job", true);
}
