const START_PARAM_CONSUMED_KEY = "tomanit:startParamConsumed";

/** Parse invoice deep-link startapp (inv_100001482391 or bare digits). */
export function invoiceTokenFromStartParam(raw: string): string | null {
  const value = raw.trim();
  const matched =
    /^inv_(\d{6,24})$/i.exec(value) ?? /^(\d{6,24})$/.exec(value);
  return matched?.[1] ?? null;
}

export function readTelegramStartParam(): string | null {
  try {
    const fromTg = window.Telegram?.WebApp?.initDataUnsafe?.start_param?.trim();
    if (fromTg) return fromTg;
  } catch {
    // ignore
  }
  try {
    const q = new URLSearchParams(window.location.search);
    const fromQuery = q.get("tgWebAppStartParam")?.trim();
    if (fromQuery) return fromQuery;
  } catch {
    // ignore
  }
  return null;
}

function markStartParamConsumed(raw: string) {
  try {
    sessionStorage.setItem(START_PARAM_CONSUMED_KEY, raw);
  } catch {
    // ignore
  }
}

export function isStartParamConsumed(raw: string): boolean {
  try {
    return sessionStorage.getItem(START_PARAM_CONSUMED_KEY) === raw;
  } catch {
    return false;
  }
}

/**
 * Before React mounts: if Mini App was opened with an invoice start_param,
 * rewrite the URL so the first painted route is /p/:token (not wallet home).
 */
export function bootInvoiceDeepLink(): string | null {
  if (typeof window === "undefined") return null;

  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  // Already on pay route — nothing to do.
  if (path === "/p" || path.startsWith("/p/") || path === "/pay" || path.startsWith("/pay/")) {
    return null;
  }

  const raw = readTelegramStartParam();
  if (!raw || isStartParamConsumed(raw)) return null;

  const token = invoiceTokenFromStartParam(raw);
  if (!token) return null;

  const target = `/p/${encodeURIComponent(token)}`;
  markStartParamConsumed(raw);
  const next = `${target}${window.location.search}${window.location.hash}`;
  window.history.replaceState(window.history.state, "", next);
  return target;
}

export { START_PARAM_CONSUMED_KEY };
