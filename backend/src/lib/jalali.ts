import { toGregorian, toJalaali } from "jalaali-js";

/** Accepts `YYYY/MM/DD`, `YYYY-MM-DD`, or `YYYYMMDD` shamsi → `YYYYMMDD` */
export function toShamsiYyyymmdd(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (!/^\d{8}$/.test(digits)) return null;
  const y = Number(digits.slice(0, 4));
  const m = Number(digits.slice(4, 6));
  const d = Number(digits.slice(6, 8));
  if (y < 1300 || y > 1500 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  return digits;
}

export function shamsiYyyymmddToDate(yyyymmdd: string): Date | null {
  if (!/^\d{8}$/.test(yyyymmdd)) return null;
  const jy = Number(yyyymmdd.slice(0, 4));
  const jm = Number(yyyymmdd.slice(4, 6));
  const jd = Number(yyyymmdd.slice(6, 8));
  try {
    const g = toGregorian(jy, jm, jd);
    return new Date(Date.UTC(g.gy, g.gm - 1, g.gd));
  } catch {
    return null;
  }
}

/** Gregorian `Date` → shamsi `YYYYMMDD` (UTC calendar day). */
export function dateToShamsiYyyymmdd(date: Date): string | null {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  try {
    const j = toJalaali(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
    const mm = String(j.jm).padStart(2, "0");
    const dd = String(j.jd).padStart(2, "0");
    return `${j.jy}${mm}${dd}`;
  } catch {
    return null;
  }
}

export function normalizeCardNumber(input: string): string {
  return input.replace(/\D/g, "");
}

export function normalizeNationalId(input: string): string {
  return input.replace(/\D/g, "");
}
