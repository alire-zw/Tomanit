const MAX_WHOLE = 12;

/** Append digit or "." to a crypto amount string (Latin). */
export function appendCryptoAmount(
  current: string,
  key: string,
  maxDecimals = 8,
): string {
  if (key === ".") {
    if (current.includes(".")) return current;
    return current === "" ? "0." : `${current}.`;
  }
  if (!/^\d$/.test(key)) return current;

  if (current === "0") return key;
  if (current === "0.") return `0.${key}`;

  const [whole = "", frac] = current.split(".");
  if (frac !== undefined) {
    if (frac.length >= maxDecimals) return current;
    return `${whole}.${frac}${key}`;
  }
  if (whole.length >= MAX_WHOLE) return current;
  return `${current}${key}`;
}

export function removeLastCryptoAmount(current: string): string {
  return current.slice(0, -1);
}

export function parseCryptoAmount(raw: string): number {
  if (!raw || raw === ".") return 0;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Truncate wallet address for compact headers: ABCD…WXYZ */
export function truncateAddress(address: string, head = 7, tail = 6): string {
  const a = address.trim();
  if (a.length <= head + tail + 4) return a;
  return `${a.slice(0, head)}....${a.slice(-tail)}`;
}
