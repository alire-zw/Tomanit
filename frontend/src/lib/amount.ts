export const MAX_AMOUNT_DIGITS = 12;
/** Gateway deposit limits (تومان) — matches wallet.tomanLimit.10m */
export const GATEWAY_MIN_TOMAN = 10_000;
export const GATEWAY_MAX_TOMAN = 10_000_000;

export function formatAmountFa(digits: string): string {
  if (!digits) return "۰";
  const value = Number.parseInt(digits, 10);
  if (!Number.isFinite(value)) return "۰";
  return value.toLocaleString("fa-IR");
}

export function parseAmountDigits(digits: string): number {
  if (!digits) return 0;
  const value = Number.parseInt(digits, 10);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function isGatewayAmountValid(amount: number): boolean {
  return amount >= GATEWAY_MIN_TOMAN && amount <= GATEWAY_MAX_TOMAN;
}

export function getGatewayAmountError(
  amount: number,
  hasInput: boolean,
): string | null {
  if (!hasInput || amount <= 0) return null;
  if (amount < GATEWAY_MIN_TOMAN) {
    return `حداقل مبلغ ${GATEWAY_MIN_TOMAN.toLocaleString("fa-IR")} تومان است`;
  }
  if (amount > GATEWAY_MAX_TOMAN) {
    return `حداکثر مبلغ ${GATEWAY_MAX_TOMAN.toLocaleString("fa-IR")} تومان است`;
  }
  return null;
}

export function appendAmountDigit(current: string, digit: string): string {
  if (!/^\d$/.test(digit) || current.length >= MAX_AMOUNT_DIGITS) {
    return current;
  }
  if (current === "0") return digit;
  return current + digit;
}

export function removeLastAmountDigit(current: string): string {
  return current.slice(0, -1);
}
