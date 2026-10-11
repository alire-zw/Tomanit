import { useCallback, useEffect, useState } from "react";
import { onAppResume, startAppLifecycle } from "../lib/appLifecycle";
import { refreshAutoTheme, resolveColorScheme } from "../lib/theme";
import { applyEarlyTelegramChrome, syncTelegramChromeForPath } from "../lib/telegramTheme";

type ColorScheme = "light" | "dark";

/** Survives remounts so AppLayout never blanks the UI after first boot. */
let telegramReadyOnce = false;
/** Ensures ready()/expand run once even if the SDK arrives after first paint. */
let telegramSdkInited = false;

export function useTelegram() {
  const [isReady, setIsReady] = useState(() => telegramReadyOnce);
  const [colorScheme, setColorScheme] = useState<ColorScheme>(() => resolveColorScheme());

  useEffect(() => {
    const stopLifecycle = startAppLifecycle();
    let disposed = false;
    let pollTimer: number | undefined;
    let boundTg: TelegramWebApp | undefined;

    const syncTheme = () => {
      const tg = window.Telegram?.WebApp;
      refreshAutoTheme();
      setColorScheme(resolveColorScheme());
      syncTelegramChromeForPath(window.location.pathname);
      try {
        tg?.disableVerticalSwipes?.();
      } catch {
        // Older clients may not support this.
      }
    };

    const bindTelegram = (tg: TelegramWebApp) => {
      if (disposed || boundTg) return;
      boundTg = tg;
      // Paint cached chrome before ready() — avoids Telegram default header flash.
      applyEarlyTelegramChrome(window.location.pathname);
      // Call ready/expand only on first boot — repeating them on resume
      // can make Telegram WebView visually "reload" the mini-app.
      if (!telegramSdkInited) {
        telegramSdkInited = true;
        tg.ready();
        tg.expand?.();
      }
      try {
        tg.disableVerticalSwipes?.();
      } catch {
        // Older clients may not support this.
      }
      syncTheme();
      tg.onEvent?.("themeChanged", syncTheme);
      requestAnimationFrame(() => {
        syncTelegramChromeForPath(window.location.pathname);
      });
    };

    const existing = window.Telegram?.WebApp;
    if (existing) {
      bindTelegram(existing);
    } else {
      // SDK is loaded async after first paint — wait briefly, then continue without it.
      syncTheme();
      let tries = 0;
      pollTimer = window.setInterval(() => {
        tries += 1;
        const tg = window.Telegram?.WebApp;
        if (tg) {
          window.clearInterval(pollTimer);
          pollTimer = undefined;
          bindTelegram(tg);
          return;
        }
        if (tries >= 50) {
          window.clearInterval(pollTimer);
          pollTimer = undefined;
        }
      }, 40);
    }

    const unsubscribeResume = onAppResume((info) => {
      // Soft chrome/theme sync only — never remount UI or re-ready the WebApp.
      syncTheme();
      // After a long background, nudge expand once (without ready()).
      if (info.hiddenForMs >= 60_000) {
        try {
          window.Telegram?.WebApp?.expand?.();
        } catch {
          // ignore
        }
      }
    });

    telegramReadyOnce = true;
    setIsReady(true);

    return () => {
      disposed = true;
      if (pollTimer) window.clearInterval(pollTimer);
      unsubscribeResume();
      stopLifecycle();
      boundTg?.offEvent?.("themeChanged", syncTheme);
    };
  }, []);

  const haptic = useCallback((style: "light" | "medium" | "heavy" = "light") => {
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.(style);
  }, []);

  const openLink = useCallback((url: string) => {
    const tg = window.Telegram?.WebApp;
    if (tg?.openTelegramLink && url.includes("t.me")) {
      tg.openTelegramLink(url);
      return;
    }
    if (tg?.openLink) {
      tg.openLink(url);
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }, []);

  /** Navigate current Mini App webview (does not open external browser tab). */
  const openInApp = useCallback((url: string) => {
    let parsed: URL;
    try {
      parsed = new URL(url, window.location.href);
    } catch {
      return;
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return;
    // Same-origin Mini App paths, or known pay-shell / payment hosts.
    const sameOrigin = parsed.origin === window.location.origin;
    const payShell =
      parsed.pathname.startsWith("/pay/") ||
      parsed.pathname.includes("/pay/start/");
    const allowedHost =
      sameOrigin ||
      payShell ||
      /\.(mirall\.ir|zibal\.ir|shaparak\.ir)$/i.test(parsed.hostname) ||
      parsed.hostname === "mirall.ir" ||
      parsed.hostname === "zibal.ir" ||
      parsed.hostname === "sep.shaparak.ir";
    if (!allowedHost) return;
    window.location.assign(parsed.toString());
  }, []);

  const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;

  return { isReady, colorScheme, haptic, openLink, openInApp, tgUser };
}
