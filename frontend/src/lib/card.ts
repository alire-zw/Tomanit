import { toPersianDigit } from "./digits";

export const CARD_NUMBER_LENGTH = 16;

export function appendCardDigit(current: string, digit: string): string {
  if (!/^\d$/.test(digit) || current.length >= CARD_NUMBER_LENGTH) return current;
  return current + digit;
}

export function removeLastCardDigit(current: string): string {
  return current.slice(0, -1);
}

export function formatCardNumberInput(digits: string): string {
  const clean = digits.replace(/\D/g, "").slice(0, CARD_NUMBER_LENGTH);
  return clean.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
}

export function formatCardNumberFa(digits: string): string {
  if (!digits) return "۶۰۳۷ ۹۹۷۷ ۱۲۳۴ ۵۶۷۸";
  return formatCardNumberInput(digits)
    .split("")
    .map((ch) => (/^\d$/.test(ch) ? toPersianDigit(ch) : ch))
    .join("");
}

export function isValidCardNumberLength(digits: string): boolean {
  return digits.replace(/\D/g, "").length === CARD_NUMBER_LENGTH;
}
