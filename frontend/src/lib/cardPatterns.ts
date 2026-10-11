import type { CSSProperties } from "react";

/** SVG overlays from /public/pattern (panelout set). */
export const CARD_PATTERN_URLS = [
  "/pattern/Pattern1.svg",
  "/pattern/Pattern2.svg",
  "/pattern/Pattern3.svg",
  "/pattern/Pattern5.svg",
  "/pattern/Pattern6.svg",
  "/pattern/Shape2.svg",
  "/pattern/Pattern10.svg",
] as const;

export type CardPatternUrl = (typeof CARD_PATTERN_URLS)[number];

export function getRandomCardPattern(): CardPatternUrl {
  const index = Math.floor(Math.random() * CARD_PATTERN_URLS.length);
  return CARD_PATTERN_URLS[index] ?? CARD_PATTERN_URLS[0]!;
}

const WALLET_GRADIENT =
  "linear-gradient(155deg, #0a3d38 0%, #0f766e 48%, #115e59 100%)";

export function getWalletHeroBackgroundStyle(patternUrl: CardPatternUrl | string): CSSProperties {
  return {
    background: WALLET_GRADIENT,
    ["--wallet-hero-pattern" as string]: `url('${patternUrl}')`,
  };
}

let preloadStarted = false;

/**
 * Warm browser cache for the active hero pattern only.
 * Loading all patterns on boot competed with first paint on slow networks.
 */
export function preloadCardPatterns(preferred?: CardPatternUrl | string): void {
  if (preloadStarted || typeof Image === "undefined") return;
  preloadStarted = true;
  const first = preferred && CARD_PATTERN_URLS.includes(preferred as CardPatternUrl)
    ? (preferred as CardPatternUrl)
    : CARD_PATTERN_URLS[0]!;
  const img = new Image();
  img.decoding = "async";
  img.src = first;
  // Idle-warm the rest so later navigations stay snappy.
  const warmRest = () => {
    for (const url of CARD_PATTERN_URLS) {
      if (url === first) continue;
      const next = new Image();
      next.decoding = "async";
      next.src = url;
    }
  };
  const ric = (
    window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    }
  ).requestIdleCallback;
  if (typeof ric === "function") {
    ric(warmRest, { timeout: 2500 });
  } else {
    globalThis.setTimeout(warmRest, 1200);
  }
}
