export type InvoiceThemeId =
  | "teal"
  | "orange"
  | "blue"
  | "violet"
  | "rose"
  | "amber";

export const INVOICE_THEME_IDS: InvoiceThemeId[] = [
  "teal",
  "orange",
  "blue",
  "violet",
  "rose",
  "amber",
];

export function parseInvoiceTheme(value: unknown): InvoiceThemeId {
  if (
    value === "teal" ||
    value === "orange" ||
    value === "blue" ||
    value === "violet" ||
    value === "rose" ||
    value === "amber"
  ) {
    return value;
  }
  return "teal";
}

/** Swatch color shown in settings picker. */
export const INVOICE_THEME_SWATCH: Record<InvoiceThemeId, string> = {
  teal: "#0d9488",
  orange: "#ea580c",
  blue: "#2563eb",
  violet: "#7c3aed",
  rose: "#e11d48",
  amber: "#d97706",
};

const THEME_CACHE_PREFIX = "tomanit:invoiceTheme:";

export function cacheInvoiceTheme(token: string, theme: InvoiceThemeId) {
  const key = token.trim();
  if (!key) return;
  try {
    sessionStorage.setItem(`${THEME_CACHE_PREFIX}${key}`, theme);
  } catch {
    // ignore
  }
}

export function readCachedInvoiceTheme(token: string): InvoiceThemeId | null {
  const key = token.trim();
  if (!key) return null;
  try {
    const raw = sessionStorage.getItem(`${THEME_CACHE_PREFIX}${key}`);
    if (!raw) return null;
    return parseInvoiceTheme(raw);
  } catch {
    return null;
  }
}

/**
 * Apply merchant invoice accent + tinted surfaces on <html>.
 * Cleared on leave so the rest of the app keeps the default teal theme.
 */
export function applyInvoiceTheme(theme: InvoiceThemeId | null | undefined) {
  const root = document.documentElement;
  if (!theme || theme === "teal") {
    delete root.dataset.invoiceTheme;
    return;
  }
  root.dataset.invoiceTheme = theme;
}

export function clearInvoiceTheme() {
  delete document.documentElement.dataset.invoiceTheme;
}
