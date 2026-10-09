import { getActiveLocale, localeToBcp47, t } from "../i18n";

function activeBcp47(): string {
  return localeToBcp47(getActiveLocale());
}

export function formatFaNumber(value: number | string): string {
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return "0";
  return Math.trunc(n).toLocaleString(activeBcp47());
}

export function formatFaDecimal(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return "0";
  return value.toLocaleString(activeBcp47(), {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/** Crypto qty: up to `maxDigits` fraction digits (trailing zeros trimmed). */
export function formatFaCryptoQty(value: number, maxDigits = 3): string {
  if (!Number.isFinite(value)) return "0";
  return value.toLocaleString(activeBcp47(), {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDigits,
  });
}

/** Same as formatFaCryptoQty but always Latin digits (en-US). */
export function formatLatinCryptoQty(value: number, maxDigits = 3): string {
  if (!Number.isFinite(value)) return "0";
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDigits,
  });
}

/** Signed percent parts for market change — sign + value separately for optical align. */
export function formatChangePercentParts(
  value: number,
  digits = 2,
): { sign: "" | "+" | "−"; abs: string } {
  if (!Number.isFinite(value)) {
    return { sign: "", abs: `۰٪` };
  }
  const abs = `${formatFaDecimal(Math.abs(value), digits)}٪`;
  if (value > 0) return { sign: "+", abs };
  if (value < 0) return { sign: "−", abs };
  return { sign: "", abs };
}

/** Signed percent for market change, e.g. +۱٫۲۵٪ / −۰٫۴۰٪ */
export function formatChangePercent(value: number, digits = 2): string {
  const { sign, abs } = formatChangePercentParts(value, digits);
  return `${sign}${abs}`;
}

export function formatFaDate(iso: string): string {
  return new Date(iso).toLocaleDateString(activeBcp47(), {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Chart scrub timestamp in Asia/Tehran — denser detail for short ranges. */
export function formatChartPointTime(
  unixSec: number,
  range: "DAY" | "WEEK" | "MONTH" | "SIX_MONTH" | "YEAR" | "ALL",
): string {
  const date = new Date(unixSec * 1000);
  if (!Number.isFinite(date.getTime())) return "";
  const opts: Intl.DateTimeFormatOptions = {
    timeZone: "Asia/Tehran",
  };
  if (range === "DAY") {
    opts.month = "short";
    opts.day = "numeric";
    opts.hour = "2-digit";
    opts.minute = "2-digit";
  } else if (range === "WEEK" || range === "MONTH") {
    opts.month = "short";
    opts.day = "numeric";
    opts.hour = "2-digit";
    opts.minute = "2-digit";
  } else {
    opts.year = "numeric";
    opts.month = "short";
    opts.day = "numeric";
  }
  return date.toLocaleString(activeBcp47(), opts);
}

export function feeLevelLabel(level: string): string {
  const key = level.toLowerCase();
  const map: Record<string, string> = {
    bronze: "fee.bronze",
    silver: "fee.silver",
    gold: "fee.gold",
    platinum: "fee.platinum",
    vip: "fee.vip",
  };
  return map[key] ? t(map[key]) : level;
}

export function kycLevelLabel(level: string): string {
  const key = level.toLowerCase();
  const map: Record<string, string> = {
    none: "kyc.none",
    basic: "kyc.basic",
    advanced: "kyc.advanced",
  };
  return map[key] ? t(map[key]) : level;
}

export function kycBadgeColor(level: string): string {
  switch (level.toLowerCase()) {
    case "basic":
      return "#F59E0B";
    case "advanced":
      return "#0D9488";
    default:
      return "#94A3B8";
  }
}

export function ticketStatusLabel(status: string): string {
  const map: Record<string, string> = {
    open: "status.open",
    answered: "status.answered",
    closed: "status.closed",
  };
  return map[status] ? t(map[status]) : status;
}

export function txTypeLabel(type: string): string {
  const map: Record<string, string> = {
    deposit: "tx.deposit",
    withdraw: "tx.withdraw",
    convert: "tx.convert",
    recharge: "tx.recharge",
    invoice: "tx.invoice",
  };
  return map[type] ? t(map[type]) : type;
}
