import { useEffect, useMemo, useRef, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { BottomNav } from "./BottomNav";
import { ChannelLockGate } from "./ChannelLockGate";
import { Header } from "./Header";
import { useTelegram } from "../hooks/useTelegram";
import {
  isStartParamConsumed,
  readTelegramStartParam,
  routeFromStartParam,
  START_PARAM_CONSUMED_KEY,
} from "../lib/bootInvoiceDeepLink";
import { dismissBootSplash } from "../lib/bootSplash";
import { prefetchMainTabs } from "../lib/routePrefetch";
import { syncTelegramChromeForPath } from "../lib/telegramTheme";
import "../App.css";

const noBottomNavPrefixes = [
  "/profile/",
  "/support/",
  "/admin/",
  "/wallet/",
  "/shop/",
  "/docs/",
  "/p/",
  "/pay/",
];
const noBottomNavExact = ["/notifications"];

function hasPendingStartParamRoute(): boolean {
  const raw = readTelegramStartParam();
  if (!raw || isStartParamConsumed(raw)) return false;
  return Boolean(routeFromStartParam(raw));
}

export function AppLayout() {
  const { isReady } = useTelegram();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastPathRef = useRef(pathname);
  /** Re-check late start_param injection on some Telegram clients. */
  const [startParamTick, setStartParamTick] = useState(0);

  const pendingInvoiceDeepLink = useMemo(() => {
    const path = pathname.replace(/\/+$/, "") || "/";
    if (path !== "/") return false;
    return hasPendingStartParamRoute();
  }, [pathname, startParamTick]);

  const hideBottomNav =
    pendingInvoiceDeepLink ||
    noBottomNavExact.includes(pathname) ||
    noBottomNavPrefixes.some((p) => pathname.startsWith(p)) ||
    pathname === "/p" ||
    pathname === "/pay";

  const payBleed =
    pendingInvoiceDeepLink ||
    pathname === "/p" ||
    pathname === "/pay" ||
    pathname.startsWith("/p/") ||
    pathname.startsWith("/pay/");

  const docsBleed = pathname.startsWith("/docs/");

  useEffect(() => {
    if (lastPathRef.current === pathname) return;
    lastPathRef.current = pathname;
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [pathname]);

  useEffect(() => {
    syncTelegramChromeForPath(pathname);
  }, [pathname]);

  /** First real screen is ready — fade the boot splash out softly. */
  useEffect(() => {
    dismissBootSplash();
  }, []);

  /** Warm main tab chunks ASAP so the first switch isn't a cold load. */
  useEffect(() => {
    const warm = () => prefetchMainTabs();
    const ric = (
      window as Window & {
        requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      }
    ).requestIdleCallback;
    if (typeof ric === "function") {
      const id = ric(warm, { timeout: 800 });
      return () => {
        (
          window as Window & { cancelIdleCallback?: (id: number) => void }
        ).cancelIdleCallback?.(id);
      };
    }
    const timer = window.setTimeout(warm, 250);
    return () => window.clearTimeout(timer);
  }, []);

  /** Poll briefly — some clients expose start_param after ready(). */
  useEffect(() => {
    const path = pathname.replace(/\/+$/, "") || "/";
    if (path !== "/") return;
    if (hasPendingStartParamRoute()) return;
    let tries = 0;
    const id = window.setInterval(() => {
      tries += 1;
      if (hasPendingStartParamRoute()) {
        setStartParamTick((n) => n + 1);
        window.clearInterval(id);
        return;
      }
      if (tries >= 8) window.clearInterval(id);
    }, 40);
    return () => window.clearInterval(id);
  }, [pathname, isReady]);

  /** Fallback navigate when launched via t.me/...?startapp=… */
  useEffect(() => {
    if (pathname === "/p/result" || pathname === "/pay/result") {
      return;
    }
    const raw = readTelegramStartParam();
    if (!raw) return;
    if (isStartParamConsumed(raw)) return;
    const target = routeFromStartParam(raw);
    if (!target) return;
    try {
      sessionStorage.setItem(START_PARAM_CONSUMED_KEY, raw);
    } catch {
      // ignore
    }
    if (pathname === target) return;
    navigate(target, { replace: true });
  }, [navigate, pathname, isReady, startParamTick]);

  return (
    <div
      className={`app${hideBottomNav ? " app--no-bottom-nav" : ""}${
        payBleed ? " app--pay-bleed" : ""
      }${docsBleed ? " app--docs-bleed" : ""}`}
    >
      <div className="app__scroll" ref={scrollRef}>
        {!pendingInvoiceDeepLink ? <Header /> : null}
        <main className="app__main">
          {pendingInvoiceDeepLink ? (
            <div className="app__pay-boot" aria-busy aria-label="…" />
          ) : (
            <Outlet />
          )}
        </main>
      </div>
      {!hideBottomNav ? <BottomNav /> : null}
      {!pendingInvoiceDeepLink ? <ChannelLockGate /> : null}
    </div>
  );
}
