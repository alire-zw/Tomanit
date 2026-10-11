/** Stable digit string from a seed (same charge → same fake terminal/ref). */
export function stableDigits(seed: string, length: number): string {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let out = "";
  let x = h >>> 0;
  for (let i = 0; i < length; i += 1) {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    out += String(x % 10);
  }
  return out;
}

export const GATEWAY_DISPLAY_NAME = "تومانیت";

export function gatewayTerminalDisplay(seed: string): string {
  return `${stableDigits(`${seed}:term-a`, 8)} / ${stableDigits(`${seed}:term-b`, 8)}`;
}

export function gatewayReferenceDisplay(seed: string): string {
  return stableDigits(`${seed}:ref`, 12);
}
