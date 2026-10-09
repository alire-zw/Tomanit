import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Ticket02Icon from "./icons/ticket-02-stroke-rounded";
import NotificationBubbleIcon from "./icons/notification-bubble-stroke-rounded";
import { useI18n } from "../context/I18nContext";
import { useRelockScrollWhileOpen } from "../hooks/useRelockScrollWhileOpen";
import { lockAppScroll, unlockAppScroll } from "../lib/scrollLock";
import type { AppNotification } from "../lib/notifications";
import type { TranslateParams } from "../i18n";
import "./NotificationsSheet.css";

type NotificationsSheetProps = {
  open: boolean;
  onClose: () => void;
  items: AppNotification[];
  readIds: Set<string>;
  loading?: boolean;
  onOpenItem: (item: AppNotification) => void;
  onViewAll: () => void;
};

function formatRelative(
  value: string,
  t: (key: string, params?: TranslateParams) => string,
  locale: string,
): string {
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return t("notifications.justNow");
  if (mins < 60) return t("notifications.minutesAgo", { count: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t("notifications.hoursAgo", { count: hours });
  return date.toLocaleDateString(locale, { month: "short", day: "numeric" });
}

function kindIcon(kind: AppNotification["kind"]): ReactNode {
  if (kind === "ticket" || kind === "admin-ticket") {
    return <Ticket02Icon width={16} height={16} />;
  }
  return <NotificationBubbleIcon width={16} height={16} />;
}

const PREVIEW_LIMIT = 4;

export function NotificationsSheet({
  open,
  onClose,
  items,
  readIds,
  loading = false,
  onOpenItem,
  onViewAll,
}: NotificationsSheetProps) {
  const { t, locale } = useI18n();
  const [isVisible, setIsVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (open) {
      setShouldRender(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setIsVisible(true));
      });
      return;
    }
    setIsVisible(false);
    const timer = window.setTimeout(() => setShouldRender(false), 280);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) {
      unlockAppScroll();
      return;
    }
    lockAppScroll();
    return () => unlockAppScroll();
  }, [open]);

  useRelockScrollWhileOpen(open);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && open) onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, onClose]);

  if (!shouldRender) return null;

  const preview = items.slice(0, PREVIEW_LIMIT);

  return createPortal(
    <>
      <button
        type="button"
        className={`notif-float__backdrop${isVisible ? " notif-float__backdrop--visible" : ""}`}
        aria-label={t("common.close")}
        onClick={onClose}
      />
      <div
        className={`notif-float${isVisible ? " notif-float--visible" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={t("notifications.title")}
      >
        <div className="notif-float__card">
          <div className="notif-float__head">
            <div className="notif-float__head-text">
              <h2 className="notif-float__title">{t("notifications.title")}</h2>
            </div>
            <span className="notif-float__head-icon" aria-hidden>
              <NotificationBubbleIcon width={18} height={18} />
            </span>
          </div>

          <div className="notif-float__list">
            {loading && preview.length === 0 ? (
              <div className="notif-float__empty notif-float__empty--compact">
                {t("common.loading")}
              </div>
            ) : null}

            {!loading && preview.length === 0 ? (
              <div className="notif-float__empty">
                <p className="notif-float__empty-title">{t("notifications.empty")}</p>
              </div>
            ) : null}

            {preview.map((item) => {
              const unread = !readIds.has(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`notif-float__item${unread ? " notif-float__item--unread" : ""}`}
                  onClick={() => onOpenItem(item)}
                >
                  <span className="notif-float__item-icon" aria-hidden>
                    {kindIcon(item.kind)}
                  </span>
                  <span className="notif-float__item-body">
                    <span className="notif-float__item-top">
                      <span className="notif-float__item-title">{item.title}</span>
                      {unread ? <span className="notif-float__dot" /> : null}
                    </span>
                    <span className="notif-float__item-text">{item.body}</span>
                    <span className="notif-float__item-time">
                      {formatRelative(item.createdAt, t, locale)}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="notif-float__footer">
            <button type="button" className="notif-float__cta" onClick={onViewAll}>
              {t("notifications.viewAll")}
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}
