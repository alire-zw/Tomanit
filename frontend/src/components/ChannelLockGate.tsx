import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import { useI18n } from "../context/I18nContext";
import { useAuth } from "../hooks/useAuth";
import { useTelegram } from "../hooks/useTelegram";
import {
  checkChannelLockMembership,
  fetchChannelLockStatus,
  type ChannelLockItem,
  type ChannelLockSlot,
} from "../lib/channelLockApi";
import { useRelockScrollWhileOpen } from "../hooks/useRelockScrollWhileOpen";
import { lockAppScroll, unlockAppScroll } from "../lib/scrollLock";
import TickDouble03Icon from "./icons/hugeicons/TickDouble03Icon";
import TelegramIcon from "./icons/TelegramIcon";
import "./FlatSelectModal.css";
import "./ChannelLockGate.css";

type ChannelUiState = "idle" | "checking" | "joined";

const ANIM_MS = 420;
const CHECK_COLOR = "#fbbf24";
const VISIBILITY_REFRESH_DEBOUNCE_MS = 900;

function openExternal(url: string) {
  const tg = window.Telegram?.WebApp;
  if (tg?.openTelegramLink && url.includes("t.me/")) {
    tg.openTelegramLink(url);
    return;
  }
  if (tg?.openLink) {
    tg.openLink(url);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

function isBypassPath(pathname: string) {
  const p = pathname.replace(/\/+$/, "") || "/";
  return (
    p.startsWith("/admin") ||
    p.startsWith("/p/") ||
    p === "/p" ||
    p.startsWith("/pay/") ||
    p === "/pay" ||
    p.startsWith("/docs")
  );
}

function isStaffUser(role: string | undefined) {
  return role === "admin" || role === "supervisor";
}

const SLOT_LABEL_KEYS: Record<ChannelLockSlot, string> = {
  purchase_report: "admin.channelLockSlotPurchase",
  notification: "admin.channelLockSlotNotify",
  community_group: "admin.channelLockSlotGroup",
};

const SLOT_BLURB_KEYS: Record<ChannelLockSlot, string> = {
  purchase_report: "admin.channelLockBlurbPurchase",
  notification: "admin.channelLockBlurbNotify",
  community_group: "admin.channelLockBlurbGroup",
};

export function ChannelLockGate() {
  const { pathname } = useLocation();
  const { haptic } = useTelegram();
  const { t } = useI18n();
  const { user, loading: userLoading, isAuthenticated } = useAuth();

  const [isOpen, setIsOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const [session, setSession] = useState(0);
  const [channels, setChannels] = useState<ChannelLockItem[]>([]);
  const [uiState, setUiState] = useState<Partial<Record<ChannelLockSlot, ChannelUiState>>>(
    {},
  );
  const [checkingSlot, setCheckingSlot] = useState<ChannelLockSlot | null>(null);

  const pollRef = useRef<number | null>(null);
  const visibilityTimerRef = useRef<number | null>(null);
  const requestSeqRef = useRef(0);
  const isOpenRef = useRef(false);
  isOpenRef.current = isOpen;

  const gateAllowed =
    isAuthenticated &&
    Boolean(user) &&
    !userLoading &&
    !isStaffUser(user?.role) &&
    !isBypassPath(pathname);

  const stopPolling = useCallback(() => {
    if (pollRef.current != null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setCheckingSlot(null);
  }, []);

  const applyStatus = useCallback(
    (items: ChannelLockItem[], bypassed = false) => {
      setChannels(items);
      setUiState((prev) => {
        const next: Partial<Record<ChannelLockSlot, ChannelUiState>> = { ...prev };
        for (const item of items) {
          if (item.joined) next[item.slotKey] = "joined";
          else if (next[item.slotKey] === "joined") next[item.slotKey] = "idle";
        }
        return next;
      });
      if (bypassed) {
        setIsOpen(false);
        stopPolling();
        return;
      }
      const required = items.some((item) => !item.joined);
      setIsOpen(required);
      if (!required) stopPolling();
    },
    [stopPolling],
  );

  const refreshStatus = useCallback(
    async (options?: { force?: boolean }) => {
      if (!gateAllowed) {
        // Keep existing UI quiet on invoice/pay routes — avoid flash open→close.
        setIsOpen(false);
        stopPolling();
        return;
      }

      const seq = ++requestSeqRef.current;
      try {
        const status = await fetchChannelLockStatus();
        if (seq !== requestSeqRef.current) return;
        if (status.bypassed) {
          applyStatus([], true);
          return;
        }
        applyStatus(status.channels, false);
      } catch {
        // Never close an already-open gate on transient Android WebView errors.
        if (!options?.force && isOpenRef.current) return;
      }
    },
    [applyStatus, gateAllowed, stopPolling],
  );

  // Auth / route ready → one live check (and when route leaves bypass).
  useEffect(() => {
    if (!gateAllowed) {
      setIsOpen(false);
      stopPolling();
      return;
    }
    void refreshStatus({ force: true });
  }, [gateAllowed, refreshStatus, stopPolling, user?.telegramId]);

  // Resume from Telegram channel join — debounced (Android fires many visibility events).
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (!gateAllowed) return;
      if (visibilityTimerRef.current != null) {
        window.clearTimeout(visibilityTimerRef.current);
      }
      visibilityTimerRef.current = window.setTimeout(() => {
        visibilityTimerRef.current = null;
        void refreshStatus({ force: true });
      }, VISIBILITY_REFRESH_DEBOUNCE_MS);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      if (visibilityTimerRef.current != null) {
        window.clearTimeout(visibilityTimerRef.current);
        visibilityTimerRef.current = null;
      }
    };
  }, [gateAllowed, refreshStatus]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  // FlatSelectModal open/close animation
  useEffect(() => {
    if (isOpen) {
      setSession((value) => value + 1);
      setShouldRender(true);
      setIsVisible(false);
      return;
    }
    setIsVisible(false);
    const timer = window.setTimeout(() => setShouldRender(false), ANIM_MS);
    return () => window.clearTimeout(timer);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !shouldRender) return;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setIsVisible(true));
    });
    return () => {
      cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
    };
  }, [isOpen, shouldRender, session]);

  useEffect(() => {
    if (!isOpen) {
      unlockAppScroll();
      return;
    }
    lockAppScroll();
    return () => unlockAppScroll();
  }, [isOpen]);

  useRelockScrollWhileOpen(isOpen);

  const startPolling = (slotKey: ChannelLockSlot) => {
    stopPolling();
    setCheckingSlot(slotKey);
    setUiState((prev) => ({
      ...prev,
      [slotKey]: prev[slotKey] === "joined" ? "joined" : "checking",
    }));

    const tick = async () => {
      try {
        const { channel } = await checkChannelLockMembership(slotKey);
        setChannels((prev) =>
          prev.map((item) => (item.slotKey === slotKey ? channel : item)),
        );
        if (channel.joined) {
          setUiState((prev) => ({ ...prev, [slotKey]: "joined" }));
          haptic("medium");
          stopPolling();
          void refreshStatus({ force: true });
        } else {
          setUiState((prev) => ({ ...prev, [slotKey]: "checking" }));
        }
      } catch {
        setUiState((prev) => ({ ...prev, [slotKey]: "checking" }));
      }
    };

    void tick();
    pollRef.current = window.setInterval(() => {
      void tick();
    }, 2000);
  };

  const handleChannelClick = (channel: ChannelLockItem) => {
    if (channel.joined || uiState[channel.slotKey] === "joined") return;
    haptic("light");
    if (channel.url) openExternal(channel.url);
    startPolling(channel.slotKey);
  };

  if (!shouldRender || channels.length === 0) return null;

  return createPortal(
    <>
      <div
        key={`clk-backdrop-${session}`}
        className={`fsm-modal__backdrop${isVisible ? " fsm-modal__backdrop--visible" : ""}`}
        role="presentation"
      />

      <div
        key={`clk-panel-${session}`}
        className={`fsm-modal__panel channel-lock-fsm${
          isVisible ? " fsm-modal__panel--visible" : ""
        }`}
        role="dialog"
        aria-modal="true"
        aria-label={t("admin.channelLockTitle")}
      >
        <h3 className="fsm-modal__title">{t("admin.channelLockTitle")}</h3>
        <p className="channel-lock-fsm__lead">{t("admin.channelLockLead")}</p>

        <div className="fsm-modal__list" role="listbox">
          {channels.map((channel) => {
            const state: ChannelUiState =
              uiState[channel.slotKey] ?? (channel.joined ? "joined" : "idle");
            const isChecking = state === "checking" || checkingSlot === channel.slotKey;
            const isJoined = state === "joined" || channel.joined;
            const statusText =
              state === "checking"
                ? t("admin.channelLockChecking")
                : state === "joined"
                  ? t("admin.channelLockJoined")
                  : t(SLOT_BLURB_KEYS[channel.slotKey]);

            return (
              <button
                key={channel.slotKey}
                type="button"
                role="option"
                aria-selected={isJoined}
                className={`fsm-modal__item channel-lock-fsm__item${
                  isJoined ? " fsm-modal__item--selected" : ""
                }${isChecking && !isJoined ? " is-checking" : ""}`}
                onClick={() => handleChannelClick(channel)}
                disabled={isJoined}
              >
                <span className="fsm-modal__icon" aria-hidden>
                  <TelegramIcon width={22} height={22} color="currentColor" />
                </span>
                <span className="channel-lock-fsm__copy">
                  <span className="fsm-modal__label">
                    {t(SLOT_LABEL_KEYS[channel.slotKey]) || channel.label}
                  </span>
                  <span
                    className={`channel-lock-fsm__blurb${isChecking ? " is-status" : ""}${
                      isJoined ? " is-ok" : ""
                    }`}
                  >
                    {statusText}
                  </span>
                </span>
                {isJoined ? (
                  <span className="fsm-modal__check" aria-hidden>
                    <TickDouble03Icon
                      variant="bulk-rounded"
                      size={16}
                      color={CHECK_COLOR}
                    />
                  </span>
                ) : (
                  <span className="fsm-modal__check-spacer" aria-hidden />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </>,
    document.body,
  );
}
