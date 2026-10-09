import { useCallback, useEffect, useState } from "react";
import { onAppResume, startAppLifecycle } from "../lib/appLifecycle";
import { refreshAutoTheme, resolveColorScheme } from "../lib/theme";
import { syncTelegramChromeForPath } from "../lib/telegramTheme";

type ColorScheme = "light" | "dark";

/** Survives remounts so AppLayout never blanks the UI after first boot. */
let telegramReadyOnce = false;

export function useTelegram() {
  const [isReady, setIsReady] = useState(() => telegramReadyOnce);
  const [colorScheme, setColorScheme] = useState<ColorScheme>(() => resolveColorScheme());

  useEffect(() => {
    const stopLifecycle = startAppLifecycle();
    const tg = window.Telegram?.WebApp;

    const syncTheme = () => {
      refreshAutoTheme();
      setColorScheme(resolveColorScheme());
      syncTelegramChromeForPath(window.location.pathname);
      try {
        tg?.disableVerticalSwipes?.();
      } catch {
        // Older clients may not support this.
      }
    };

    if (tg) {
      // Call ready/expand only on first boot — repeating them on resume
      // can make Telegram WebView visually "reload" the mini-app.
      if (!telegramReadyOnce) {
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
    } else {
      syncTheme();
    }

    const unsubscribeResume = onAppResume((info) => {
      // Soft chrome/theme sync only — never remount UI or re-ready the WebApp.
      syncTheme();
      // After a long background, nudge expand once (without ready()).
      if (info.hiddenForMs >= 60_000) {
        try {
          tg?.expand?.();
        } catch {
          // ignore
        }
      }
    });

    telegramReadyOnce = true;
    setIsReady(true);

    return () => {
      unsubscribeResume();
      stopLifecycle();
      tg?.offEvent?.("themeChanged", syncTheme);
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
