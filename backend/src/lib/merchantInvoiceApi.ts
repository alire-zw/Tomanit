/** Normalize Iranian mobile to 09xxxxxxxxx, or null if invalid. */
export function normalizePayerPhone(input: string | null | undefined): string | null {
  if (input == null) return null;
  const raw = String(input).trim();
  if (!raw) return null;
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("98") && digits.length === 12) {
    digits = `0${digits.slice(2)}`;
  }
  if (digits.startsWith("9") && digits.length === 10) {
    digits = `0${digits}`;
  }
  if (!/^09\d{9}$/.test(digits)) return null;
  return digits;
}

/** Telegram numeric user id as string digits. */
export function normalizePayerTelegramId(
  input: string | number | null | undefined,
): string | null {
  if (input == null || input === "") return null;
  // Avoid Number() — large Telegram ids can lose precision as JS numbers.
  const digits = String(input).trim().replace(/\D/g, "");
  // Strip leading zeros but keep at least one digit when all zeros (invalid anyway).
  const normalized = digits.replace(/^0+(?=\d)/, "");
  if (normalized.length < 5 || normalized.length > 20) return null;
  return normalized;
}

/** Compare two Telegram ids after normalization. */
export function telegramIdsMatch(
  a: string | number | null | undefined,
  b: string | number | null | undefined,
): boolean {
  const left = normalizePayerTelegramId(a);
  const right = normalizePayerTelegramId(b);
  if (!left || !right) return false;
  return left === right;
}

export function phonesMatch(
  stored: string | null | undefined,
  userPhone: string | null | undefined,
): boolean {
  if (!stored) return true;
  const a = normalizePayerPhone(stored);
  const b = normalizePayerPhone(userPhone);
  if (!a) return true;
  if (!b) return false;
  return a === b;
}
