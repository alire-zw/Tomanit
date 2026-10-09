import { isValidJalaaliDate, jalaaliMonthLength } from "jalaali-js";
import { toPersianDigit } from "./digits";

export const NATIONAL_ID_LENGTH = 10;
export const BIRTH_DIGITS_LENGTH = 8;

export function isValidIranNationalId(code: string): boolean {
  if (!/^\d{10}$/.test(code)) return false;
  if (/^(\d)\1{9}$/.test(code)) return false;

  const check = Number(code[9]);
  const sum = code
    .slice(0, 9)
    .split("")
    .reduce((acc, digit, index) => acc + Number(digit) * (10 - index), 0);
  const remainder = sum % 11;
  return (remainder < 2 && check === remainder) || (remainder >= 2 && check === 11 - remainder);
}

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

export function appendNationalIdDigit(current: string, digit: string): string {
  if (!/^\d$/.test(digit) || current.length >= NATIONAL_ID_LENGTH) return current;
  return current + digit;
}

export function removeLastNationalIdDigit(current: string): string {
  return current.slice(0, -1);
}

export function formatNationalIdFa(digits: string): string {
  if (!digits) return "۰۰۱۲۳۴۵۶۷۸";
  return digits.split("").map(toPersianDigit).join("");
}

export function appendBirthDigit(current: string, digit: string): string {
  if (!/^\d$/.test(digit) || current.length >= BIRTH_DIGITS_LENGTH) return current;
  return current + digit;
}

export function removeLastBirthDigit(current: string): string {
  return current.slice(0, -1);
}

/** Formats birth digits as YYYY/MM/DD while typing. */
export function formatBirthDateInput(digits: string): string {
  const clean = digitsOnly(digits).slice(0, BIRTH_DIGITS_LENGTH);
  if (clean.length <= 4) return clean;
  if (clean.length <= 6) return `${clean.slice(0, 4)}/${clean.slice(4)}`;
  return `${clean.slice(0, 4)}/${clean.slice(4, 6)}/${clean.slice(6)}`;
}

export function formatBirthDateFa(digits: string): string {
  if (!digits) return "۱۳۸۰/۱۱/۰۴";
  return formatBirthDateInput(digits)
    .split("")
    .map((ch) => (/^\d$/.test(ch) ? toPersianDigit(ch) : ch))
    .join("");
}

export function isValidJalaliBirthInput(value: string): boolean {
  const match = /^(\d{4})\/(\d{2})\/(\d{2})$/.exec(value.trim());
  if (!match) return false;
  const jy = Number(match[1]);
  const jm = Number(match[2]);
  const jd = Number(match[3]);
  if (jy < 1300 || jy > 1410) return false;
  if (!isValidJalaaliDate(jy, jm, jd)) return false;
  return jd <= jalaaliMonthLength(jy, jm);
}

export function getNationalIdError(code: string): string | null {
  if (!code) return null;
  if (code.length < NATIONAL_ID_LENGTH) return null;
  if (!isValidIranNationalId(code)) return "کد ملی معتبر نیست";
  return null;
}

export function getBirthDateError(value: string): string | null {
  if (!value || value.length < 10) return null;
  if (!isValidJalaliBirthInput(value)) return "تاریخ تولد معتبر نیست";
  return null;
}
