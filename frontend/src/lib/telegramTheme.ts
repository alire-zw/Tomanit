type ColorScheme = "light" | "dark";

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

function updateMetaThemeColor(color: string) {
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", color);
}

function safeCall(fn: () => void) {
  try {
    fn();
  } catch {
    // Older Telegram clients throw on unsupported methods.
  }
}

function applyTelegramChrome(color: string) {
  const tg = window.Telegram?.WebApp;
  if (!tg) return;
  safeCall(() => tg.setHeaderColor?.(color));
  safeCall(() => tg.setBackgroundColor?.(color));
  safeCall(() => tg.setBottomBarColor?.(readChromeBottom()));
}

export function applyAppTheme(colorScheme: ColorScheme) {
  document.documentElement.dataset.theme = colorScheme;
  document.querySelector('meta[name="color-scheme"]')?.setAttribute("content", colorScheme);
  syncTelegramChromeForPath(window.location.pathname);
}

/** Keep Telegram mini-app header/chrome in sync with app background. */
export function syncTelegramChromeForPath(pathname: string) {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  const isMerchantPay =
    normalized === "/p" ||
    normalized.startsWith("/p/") ||
    normalized === "/pay" ||
    normalized.startsWith("/pay/");

  // Invoice pay: match Telegram header to the current top band.
  if (isMerchantPay) {
    applyMerchantPayTelegramChrome("accent");
    return;
  }

  const bg = readAppBackground();
  updateMetaThemeColor(bg);
  applyTelegramChrome(bg);
}

/** Fixed fail chrome — same in light and dark (do not read theme --danger). */
export const MERCHANT_PAY_FAIL_CHROME = "#dc2626";

/** Fixed expired-invoice chrome (amber / yellow-orange). */
export const MERCHANT_PAY_EXPIRED_CHROME = "#f59e0b";

/** Invoice pay top band: accent / surface / danger / expired. */
export function applyMerchantPayTelegramChrome(
  topBand: "accent" | "surface" | "danger" | "expired",
) {
  const color =
    topBand === "danger"
      ? MERCHANT_PAY_FAIL_CHROME
      : topBand === "expired"
        ? MERCHANT_PAY_EXPIRED_CHROME
        : topBand === "accent"
          ? readAppAccent()
          : readAppSurface();
  updateMetaThemeColor(color);
  applyTelegramChrome(color);
}
