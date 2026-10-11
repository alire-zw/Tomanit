import {
  invoiceTokenFromPath,
  isMerchantPayPath,
  resolveEarlyHeaderColor,
  writeAppChromeCache,
  writeInvoiceChromeCache,
  type ChromeScheme,
} from "./telegramChromeCache";

type ColorScheme = "light" | "dark";

/** True only after invoice page finished loading and set seller chrome. */
let invoiceChromeActive = false;

function readAppBackground(): string {
  return getComputedStyle(document.documentElement).getPropertyValue("--bg").trim() || "#eef6f5";
}

function readAppSurface(): string {
  return (
    getComputedStyle(document.documentElement).getPropertyValue("--surface").trim() ||
    getComputedStyle(document.documentElement).getPropertyValue("--card-background").trim() ||
    readAppBackground()
  );
}

function readAppAccent(): string {
  return (
    getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() ||
    "#0d9488"
  );
}

function readChromeBottom(): string {
  return (
    getComputedStyle(document.documentElement).getPropertyValue("--chrome-bottom").trim() ||
    "#000000"
  );
}

function readScheme(): ChromeScheme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function updateMetaThemeColor(color: string) {
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", color);
}

/** Clear boot-time inline styles that would pin the wrong light/dark paint. */
function clearBootInlinePaint() {
  document.documentElement.style.removeProperty("background");
  document.documentElement.style.removeProperty("background-color");
  if (document.body) {
    document.body.style.removeProperty("background");
    document.body.style.removeProperty("background-color");
  }
}

function safeCall(fn: () => void) {
  try {
    fn();
  } catch {
    // Older Telegram clients throw on unsupported methods.
  }
}

function applyTelegramChrome(header: string, bottom?: string) {
  const tg = window.Telegram?.WebApp;
  if (!tg) return;
  safeCall(() => tg.setHeaderColor?.(header));
  safeCall(() => tg.setBackgroundColor?.(header));
  safeCall(() => tg.setBottomBarColor?.(bottom ?? readChromeBottom()));
}

function persistAppChrome(header: string, bottom: string) {
  writeAppChromeCache({
    scheme: readScheme(),
    header,
    bottom,
  });
}

function persistInvoiceChrome(header: string) {
  const token = invoiceTokenFromPath(window.location.pathname);
  writeInvoiceChromeCache(token || "last", header);
  // Keep app chrome cache on the plain light/dark colors for the next cold start.
  persistAppChrome(readAppBackground(), readChromeBottom());
}

function markReactThemeActive() {
  try {
    (window as Window & { __tomanitThemeReady?: boolean }).__tomanitThemeReady = true;
  } catch {
    // ignore
  }
}

function applyAppChromeFromCss() {
  const bg = readAppBackground();
  const bottom = readChromeBottom();
  updateMetaThemeColor(bg);
  applyTelegramChrome(bg, bottom);
  persistAppChrome(bg, bottom);
}

/** Leave seller accent; back to plain light/dark app chrome. */
export function releaseInvoiceTelegramChrome() {
  invoiceChromeActive = false;
  applyAppChromeFromCss();
}

export function applyAppTheme(colorScheme: ColorScheme) {
  markReactThemeActive();
  clearBootInlinePaint();

  const root = document.documentElement;
  root.dataset.theme = colorScheme;
  root.style.colorScheme = colorScheme;
  document
    .querySelector('meta[name="color-scheme"]')
    ?.setAttribute("content", colorScheme);

  void root.offsetHeight;
  syncTelegramChromeForPath(window.location.pathname);
}

/**
 * Apply cached / default Telegram header colors immediately — before CSS/React.
 * After React theme is ready, this becomes a no-op so it cannot fight settings.
 * Invoice routes use plain light/dark here (no seller accent yet).
 */
export function applyEarlyTelegramChrome(pathname = window.location.pathname): void {
  try {
    if ((window as Window & { __tomanitThemeReady?: boolean }).__tomanitThemeReady) {
      return;
    }
  } catch {
    // continue
  }

  const { header, bottom, scheme } = resolveEarlyHeaderColor(pathname);
  const root = document.documentElement;
  root.dataset.theme = scheme;
  root.style.colorScheme = scheme;
  updateMetaThemeColor(header);
  applyTelegramChrome(header, bottom);
}

/** Keep Telegram mini-app header/chrome in sync with app background. */
export function syncTelegramChromeForPath(pathname: string) {
  const normalized = pathname.replace(/\/+$/, "") || "/";

  if (isMerchantPayPath(normalized)) {
    // Until the invoice page opts in, keep neutral light/dark chrome.
    if (!invoiceChromeActive) {
      applyAppChromeFromCss();
    }
    return;
  }

  invoiceChromeActive = false;
  applyAppChromeFromCss();
}

/** Fixed fail chrome — same in light and dark (do not read theme --danger). */
export const MERCHANT_PAY_FAIL_CHROME = "#dc2626";

/** Fixed success chrome — green, not seller invoice accent. */
export const MERCHANT_PAY_SUCCESS_CHROME = "#16a34a";

/** Fixed expired-invoice chrome (amber / yellow-orange). */
export const MERCHANT_PAY_EXPIRED_CHROME = "#f59e0b";

/** Invoice pay top band: accent / surface / danger / success / expired. */
export function applyMerchantPayTelegramChrome(
  topBand: "accent" | "surface" | "danger" | "success" | "expired",
) {
  invoiceChromeActive = true;
  const color =
    topBand === "danger"
      ? MERCHANT_PAY_FAIL_CHROME
      : topBand === "success"
        ? MERCHANT_PAY_SUCCESS_CHROME
        : topBand === "expired"
          ? MERCHANT_PAY_EXPIRED_CHROME
          : topBand === "accent"
            ? readAppAccent()
            : readAppSurface();
  const bottom = readChromeBottom();
  updateMetaThemeColor(color);
  applyTelegramChrome(color, bottom);
  persistInvoiceChrome(color);
}
