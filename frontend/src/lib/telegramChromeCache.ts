export type ChromeScheme = "light" | "dark";

const CHROME_CACHE_KEY = "tomanit:tgChrome";
const INVOICE_CHROME_PREFIX = "tomanit:tgChrome:invoice:";

/** Defaults match global.css — used before CSS variables exist. */
export const DEFAULT_APP_HEADER: Record<ChromeScheme, string> = {
  light: "#eef6f5",
  dark: "#0c0e0e",
};

export const DEFAULT_APP_BOTTOM: Record<ChromeScheme, string> = {
  light: "#f7fbfb",
  dark: "#000000",
};

type ChromeCache = {
  scheme: ChromeScheme;
  appHeader: string;
  appBottom: string;
  lastInvoiceHeader?: string;
};

function safeParse(raw: string | null): ChromeCache | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Partial<ChromeCache>;
    if (data.scheme !== "light" && data.scheme !== "dark") return null;
    if (typeof data.appHeader !== "string" || !data.appHeader) return null;
    return {
      scheme: data.scheme,
      appHeader: data.appHeader,
      appBottom:
        typeof data.appBottom === "string" && data.appBottom
          ? data.appBottom
          : DEFAULT_APP_BOTTOM[data.scheme],
      lastInvoiceHeader:
        typeof data.lastInvoiceHeader === "string"
          ? data.lastInvoiceHeader
          : undefined,
    };
  } catch {
    return null;
  }
}

export function readChromeCache(): ChromeCache | null {
  try {
    return safeParse(localStorage.getItem(CHROME_CACHE_KEY));
  } catch {
    return null;
  }
}

export function writeAppChromeCache(input: {
  scheme: ChromeScheme;
  header: string;
  bottom: string;
}): void {
  try {
    const prev = readChromeCache();
    const next: ChromeCache = {
      scheme: input.scheme,
      appHeader: input.header,
      appBottom: input.bottom,
      lastInvoiceHeader: prev?.lastInvoiceHeader,
    };
    localStorage.setItem(CHROME_CACHE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

export function writeInvoiceChromeCache(token: string, header: string): void {
  const key = token.trim();
  if (!key || !header) return;
  try {
    sessionStorage.setItem(`${INVOICE_CHROME_PREFIX}${key}`, header);
    const prev = readChromeCache() ?? {
      scheme: "light" as ChromeScheme,
      appHeader: DEFAULT_APP_HEADER.light,
      appBottom: DEFAULT_APP_BOTTOM.light,
    };
    prev.lastInvoiceHeader = header;
    localStorage.setItem(CHROME_CACHE_KEY, JSON.stringify(prev));
  } catch {
    // ignore
  }
}

export function readInvoiceChromeCache(token: string): string | null {
  const key = token.trim();
  if (!key) return null;
  try {
    const raw = sessionStorage.getItem(`${INVOICE_CHROME_PREFIX}${key}`);
    return raw?.trim() || null;
  } catch {
    return null;
  }
}

export function isMerchantPayPath(pathname: string): boolean {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  return (
    normalized === "/p" ||
    normalized.startsWith("/p/") ||
    normalized === "/pay" ||
    normalized.startsWith("/pay/")
  );
}

/** Extract invoice token from /p/:code or /pay/:code (not result). */
export function invoiceTokenFromPath(pathname: string): string | null {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  const match = /^\/(?:p|pay)\/([^/]+)$/.exec(normalized);
  if (!match?.[1]) return null;
  if (match[1] === "result") return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

export function resolveSchemeEarly(): ChromeScheme {
  try {
    const mode = localStorage.getItem("tomanit.themeMode") || "auto";
    if (mode === "dark") return "dark";
    if (mode === "light") return "light";
  } catch {
    // ignore
  }
  try {
    const tgScheme = window.Telegram?.WebApp?.colorScheme;
    if (tgScheme === "dark" || tgScheme === "light") return tgScheme;
  } catch {
    // ignore
  }
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return "light";
}

function readStartParamToken(): string | null {
  try {
    const fromTg = window.Telegram?.WebApp?.initDataUnsafe?.start_param?.trim();
    if (fromTg) {
      const m =
        /^inv_(\d{6,24})$/i.exec(fromTg) ?? /^(\d{6,24})$/.exec(fromTg);
      if (m?.[1]) return m[1];
    }
  } catch {
    // ignore
  }
  try {
    const q = new URLSearchParams(window.location.search);
    const raw = q.get("tgWebAppStartParam")?.trim();
    if (!raw) return null;
    const m = /^inv_(\d{6,24})$/i.exec(raw) ?? /^(\d{6,24})$/.exec(raw);
    return m?.[1] ?? null;
  } catch {
    return null;
  }
}

/**
 * Resolve header color *before* CSS/React are ready.
 * Invoice routes always use plain light/dark app chrome here — seller accent
 * is applied later only after the invoice page has loaded.
 */
export function resolveEarlyHeaderColor(pathname = window.location.pathname): {
  header: string;
  bottom: string;
  scheme: ChromeScheme;
  kind: "app" | "invoice";
} {
  const scheme = resolveSchemeEarly();
  const cache = readChromeCache();
  const startToken = readStartParamToken();
  const pay = isMerchantPayPath(pathname) || Boolean(startToken);

  const header =
    cache?.scheme === scheme ? cache.appHeader : DEFAULT_APP_HEADER[scheme];
  const bottom =
    cache?.scheme === scheme ? cache.appBottom : DEFAULT_APP_BOTTOM[scheme];

  return {
    header,
    bottom,
    scheme,
    // "invoice" only marks the route kind for callers; color stays app chrome.
    kind: pay ? "invoice" : "app",
  };
}
