import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { EmptyState } from "../components/EmptyState";
import { PageHeader } from "../components/PageHeader";
import NotificationBubbleIcon from "../components/icons/notification-bubble-stroke-rounded";
import Ticket02Icon from "../components/icons/ticket-02-stroke-rounded";
import { useI18n } from "../context/I18nContext";
import { useAuth } from "../hooks/useAuth";
import { useTelegram } from "../hooks/useTelegram";
import { localeToBcp47, type LocaleCode } from "../i18n";
import {
  type AppNotification,
  fetchAdminTicketNotification,
  fetchUserTicketNotifications,
  markAllNotificationsRead,
  markNotificationsRead,
  readNotificationIds,
} from "../lib/notifications";
import "../styles/shop-rise.css";
import "./Notifications.css";

function formatDateTime(value: string, locale: LocaleCode): string {
  return new Date(value).toLocaleString(localeToBcp47(locale), {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function kindIcon(kind: AppNotification["kind"]): ReactNode {
  if (kind === "ticket" || kind === "admin-ticket") {
    return <Ticket02Icon width={18} height={18} />;
  }
  return <NotificationBubbleIcon width={18} height={18} />;
}

export function NotificationsPage() {
  const navigate = useNavigate();
  const { t, locale } = useI18n();
  const { haptic } = useTelegram();
  const { user, isAdmin } = useAuth();
  const telegramId = user?.telegramId ?? null;

  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [readIds, setReadIds] = useState<Set<string>>(() => readNotificationIds(telegramId));

  const unreadCount = useMemo(
    () => items.filter((item) => !readIds.has(item.id)).length,
    [items, readIds],
  );

  const load = useCallback(async () => {
    if (!telegramId) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const userItems = await fetchUserTicketNotifications().catch(() => []);
      let adminItem: AppNotification | null = null;
      if (isAdmin) {
        adminItem = await fetchAdminTicketNotification().catch(() => null);
      }
      const next = [...(adminItem ? [adminItem] : []), ...userItems].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      setItems(next);
      setReadIds(readNotificationIds(telegramId));
    } finally {
      setLoading(false);
    }
  }, [isAdmin, telegramId]);

  useEffect(() => {
    void load();
  }, [load, locale]);

  const openItem = (item: AppNotification) => {
    haptic("light");
    setReadIds(markNotificationsRead(telegramId, [item.id]));
    navigate(item.href);
  };

  const markAll = () => {
    haptic("light");
    setReadIds(markAllNotificationsRead(telegramId, items));
  };

  return (
    <div className="notifications shop-rise">
      <PageHeader
        title={t("notifications.title")}
        onBack={() => navigate(-1)}
        action={
          unreadCount > 0 ? (
            <button type="button" className="notifications__mark-all" onClick={markAll}>
              {t("notifications.viewAll")}
            </button>
          ) : undefined
        }
      />

      <section className="notifications__hero" style={{ "--rise-index": 0 } as CSSProperties}>
        <h1 className="notifications__title">{t("notifications.title")}</h1>
      </section>

      {loading ? (
        <div className="notifications__list" style={{ "--rise-index": 1 } as CSSProperties}>
          {[0, 1, 2].map((index) => (
            <div key={index} className="notifications__skel" aria-hidden />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="notifications__empty" style={{ "--rise-index": 1 } as CSSProperties}>
          <EmptyState title={t("notifications.empty")} />
        </div>
      ) : (
        <div className="notifications__list" style={{ "--rise-index": 1 } as CSSProperties}>
          {items.map((item) => {
            const unread = !readIds.has(item.id);
            return (
              <button
                key={item.id}
                type="button"
                className={`notifications__item notifications__item--${item.kind}${
                  unread ? " notifications__item--unread" : " notifications__item--read"
                }`}
                onClick={() => openItem(item)}
              >
                <span className="notifications__item-icon">{kindIcon(item.kind)}</span>
                <span className="notifications__item-body">
                  <span className="notifications__item-top">
                    <span className="notifications__item-title">{item.title}</span>
                    {unread ? <span className="notifications__dot" /> : null}
                  </span>
                  <span className="notifications__item-text">{item.body}</span>
                  <span className="notifications__item-time">
                    {formatDateTime(item.createdAt, locale)}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
