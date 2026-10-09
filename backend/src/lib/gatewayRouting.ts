/** Tehran calendar helpers for gateway daily caps / hours. */

const TEHRAN = "Asia/Tehran";

export function tehranParts(date = new Date()): {
  year: number;
  month: number;
  day: number;
  hour: number;
  weekday: number;
  dateKey: string;
} {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: TEHRAN,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(date).map((p) => [p.type, p.value]),
  ) as Record<string, string>;

  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  const hour = Number(parts.hour);
  const weekday = weekdayMap[parts.weekday ?? ""] ?? 0;
  const dateKey = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  return { year, month, day, hour, weekday, dateKey };
}

/** Previous Tehran calendar day as YYYY-MM-DD. */
export function tehranYesterdayKey(date = new Date()): string {
  // Walk back hour-by-hour until the Tehran date key changes (handles DST safely).
  const today = tehranParts(date).dateKey;
  let cursor = new Date(date.getTime());
  for (let i = 0; i < 48; i++) {
    cursor = new Date(cursor.getTime() - 60 * 60 * 1000);
    const key = tehranParts(cursor).dateKey;
    if (key !== today) return key;
  }
  return today;
}

export function parseWeekdays(raw: string | null | undefined): number[] | null {
  if (raw == null) return null; // all days
  if (raw.trim() === "") return []; // explicitly none
  const days = raw
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
  return [...new Set(days)];
}

export function serializeWeekdays(days: number[] | null | undefined): string | null {
  if (days === null || days === undefined) return null; // all days
  if (days.length === 0) return ""; // none
  const clean = [...new Set(days.filter((n) => n >= 0 && n <= 6))].sort((a, b) => a - b);
  return clean.join(",");
}

export type GatewayRouteRow = {
  id: number;
  isActive: boolean;
  balanceToman: bigint;
  todayCount: number;
  commissionPercent: number;
  dailyLimitToman: bigint | null;
  dailyCountLimit: number | null;
  minAmountToman: number | null;
  maxAmountToman: number | null;
  openHour: number | null;
  closeHour: number | null;
  activeWeekdays: string | null;
};

export function isGatewayDailyFull(g: {
  balanceToman: bigint;
  todayCount: number;
  dailyLimitToman: bigint | null;
  dailyCountLimit: number | null;
}): boolean {
  if (g.dailyLimitToman != null && g.balanceToman >= g.dailyLimitToman) return true;
  if (g.dailyCountLimit != null && g.todayCount >= g.dailyCountLimit) return true;
  return false;
}

export function gatewayUsageRatio(g: {
  balanceToman: bigint;
  dailyLimitToman: bigint | null;
}): number | null {
  if (g.dailyLimitToman == null || g.dailyLimitToman <= 0n) return null;
  return Number(g.balanceToman) / Number(g.dailyLimitToman);
}

export function isGatewayOpenNow(
  g: Pick<GatewayRouteRow, "openHour" | "closeHour" | "activeWeekdays">,
  now = new Date(),
): boolean {
  const { hour, weekday } = tehranParts(now);
  const days = parseWeekdays(g.activeWeekdays);
  if (days != null && days.length === 0) return false;
  if (days != null && !days.includes(weekday)) return false;

  const open = g.openHour;
  const close = g.closeHour;
  if (open == null || close == null) return true;
  if (open === close) return true; // treat as 24h
  // close is exclusive; allow close=24 for end-of-day
  if (open < close) return hour >= open && hour < close;
  // overnight window e.g. 22 → 6
  return hour >= open || hour < close;
}

export function gatewayAcceptsAmount(
  g: Pick<GatewayRouteRow, "minAmountToman" | "maxAmountToman" | "dailyLimitToman" | "balanceToman" | "dailyCountLimit" | "todayCount">,
  amountToman: number,
): boolean {
  if (!Number.isFinite(amountToman) || amountToman <= 0) return false;
  if (g.minAmountToman != null && amountToman < g.minAmountToman) return false;
  if (g.maxAmountToman != null && amountToman > g.maxAmountToman) return false;
  if (g.dailyCountLimit != null && g.todayCount >= g.dailyCountLimit) return false;
  if (g.dailyLimitToman != null) {
    if (g.balanceToman >= g.dailyLimitToman) return false;
    if (g.balanceToman + BigInt(amountToman) > g.dailyLimitToman) return false;
  }
  return true;
}

export function isGatewayEligibleForCharge(
  g: GatewayRouteRow,
  amountToman: number,
  now = new Date(),
): boolean {
  if (!g.isActive) return false;
  if (!isGatewayOpenNow(g, now)) return false;
  if (!gatewayAcceptsAmount(g, amountToman)) return false;
  return true;
}

/** Prefer least today volume, then lowest commission. */
export function pickGatewayForCharge<T extends GatewayRouteRow>(
  rows: T[],
  amountToman: number,
  now = new Date(),
): T | null {
  const eligible = rows.filter((g) => isGatewayEligibleForCharge(g, amountToman, now));
  if (!eligible.length) return null;
  eligible.sort((a, b) => {
    const vol = a.balanceToman === b.balanceToman ? 0 : a.balanceToman < b.balanceToman ? -1 : 1;
    if (vol !== 0) return vol;
    if (a.commissionPercent !== b.commissionPercent) {
      return a.commissionPercent - b.commissionPercent;
    }
    return a.id - b.id;
  });
  return eligible[0] ?? null;
}

export function calcCommissionToman(amountToman: number, percent: number): number {
  if (!Number.isFinite(amountToman) || amountToman <= 0) return 0;
  if (!Number.isFinite(percent) || percent <= 0) return 0;
  return Math.floor((amountToman * percent) / 100);
}
