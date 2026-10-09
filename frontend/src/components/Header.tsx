import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useNotification } from "./Notification";
import { NotificationsSheet } from "./NotificationsSheet";
import NotificationBubbleIcon from "./icons/notification-bubble-stroke-rounded";
import { useI18n } from "../context/I18nContext";
import { useAuth } from "../hooks/useAuth";
import { useTelegram } from "../hooks/useTelegram";
import { localeToBcp47 } from "../i18n";
import { resolveDisplayName } from "../lib/displayName";
import { feeLevelLabel } from "../lib/format";
import type { FeeLevel } from "../lib/api";
import {
  type AppNotification,
  fetchAdminTicketNotification,
  fetchUserTicketNotifications,
  markNotificationsRead,
  readNotificationIds,
} from "../lib/notifications";
import { defaultAvatar, HEADER_BOX_SIZE } from "./headerConstants";
import "./Header.css";

const hiddenPaths = ["/profile"];

export function Header() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { t, locale } = useI18n();
  const { user, isAdmin } = useAuth();
  const { haptic, tgUser } = useTelegram();
  const { notify } = useNotification();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(() =>
    readNotificationIds(user?.telegramId),
  );

  const userName = resolveDisplayName(user, tgUser, t("profile.defaultName"));
  const userAvatar = tgUser?.photo_url ?? defaultAvatar;
  const feeLevel: FeeLevel = user?.feeLevel ?? "bronze";
  const telegramId = user?.telegramId ?? null;

  const hideHeader =
    hiddenPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`)) ||
    pathname.startsWith("/support/") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/wallet/") ||
    pathname.startsWith("/shop/") ||
    pathname.startsWith("/docs/") ||
    pathname.startsWith("/p/") ||
    pathname.startsWith("/pay/") ||
    pathname === "/notifications";

  const unreadCount = useMemo(
    () => items.filter((item) => !readIds.has(item.id)).length,
    [items, readIds],
  );

  const refreshNotifications = useCallback(async () => {
    if (!telegramId) {
      setItems([]);
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
    if (!telegramId || hideHeader) return;
    void refreshNotifications();
  }, [hideHeader, refreshNotifications, telegramId, locale]);

  useEffect(() => {
    setReadIds(readNotificationIds(telegramId));
  }, [telegramId]);

  if (hideHeader) {
    return null;
  }

  const handleProfileClick = () => {
    haptic("light");
    navigate("/profile");
  };

  const handleNotificationsClick = () => {
    haptic("light");
    setSheetOpen(true);
    void refreshNotifications();
  };

  const handleLevelClick = () => {
    haptic("light");
    notify(t("header.levelSoon"), "info");
  };

  const handleOpenItem = (item: AppNotification) => {
    haptic("light");
    setReadIds(markNotificationsRead(telegramId, [item.id]));
    setSheetOpen(false);
    navigate(item.href);
  };

  const handleViewAll = () => {
    haptic("light");
    setSheetOpen(false);
    navigate("/notifications");
  };

  return (
    <>
      <header className="app-header">
        <nav className="app-header__nav">
          <div className="app-header__row">
            <div className="app-header__user">
              <button
                type="button"
                onClick={handleProfileClick}
                className="app-header__box app-header__avatar-btn"
                style={{ width: HEADER_BOX_SIZE, height: HEADER_BOX_SIZE }}
                aria-label={t("nav.profile")}
              >
                <img src={userAvatar} alt="" className="app-header__avatar" />
              </button>
              <div className="app-header__user-text">
                <span className="app-header__greeting">{t("header.greeting")}</span>
                <span className="app-header__username">{userName}</span>
              </div>
            </div>

            <div className="app-header__actions">
              <button
                type="button"
                onClick={handleLevelClick}
                className={`app-header__level app-header__level--${feeLevel}`}
                style={{ height: HEADER_BOX_SIZE }}
                aria-label={`${t("header.userLevel")} ${feeLevelLabel(feeLevel)}`}
              >
                <span className="app-header__level-label">{t("header.userLevel")}</span>
                <span className="app-header__level-value">{feeLevelLabel(feeLevel)}</span>
              </button>
              <button
                type="button"
                onClick={handleNotificationsClick}
                className={`app-header__box app-header__notify-btn${
                  unreadCount > 0 ? " app-header__notify-btn--unread" : ""
                }`}
                style={{ width: HEADER_BOX_SIZE, height: HEADER_BOX_SIZE }}
                aria-label={
                  unreadCount > 0
                    ? t("header.notificationsUnread", { count: unreadCount })
                    : t("header.notifications")
                }
              >
                <NotificationBubbleIcon width={16} height={16} />
                {unreadCount > 0 ? (
                  <span className="app-header__notify-badge">
                    {unreadCount > 9
                      ? `${(9).toLocaleString(localeToBcp47(locale))}+`
                      : unreadCount.toLocaleString(localeToBcp47(locale))}
                  </span>
                ) : null}
              </button>
            </div>
          </div>
        </nav>
      </header>

      <NotificationsSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        items={items}
        readIds={readIds}
        loading={loading}
        onOpenItem={handleOpenItem}
        onViewAll={handleViewAll}
      />
    </>
  );
}
