import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { AdminScreen } from "../../components/AdminScreen";
import LockIcon from "../../components/icons/LockIcon";
import GatewayDeleteIcon from "../../components/icons/GatewayDeleteIcon";
import GatewayEditIcon from "../../components/icons/GatewayEditIcon";
import { useNotification } from "../../components/Notification";
import { useI18n } from "../../context/I18nContext";
import { useTelegram } from "../../hooks/useTelegram";
import {
  deleteAdminSystemChannel,
  fetchAdminSystemChannels,
  fetchAdminSystemChannelsBot,
  registerAdminSystemChannel,
  setAdminSystemChannelActive,
  type AdminSystemChannelSlot,
  type AdminSystemChannelSlotItem,
} from "../../lib/adminSystemChannels";
import "../../styles/shop-rise.css";
import "./Admin.css";
import "./AdminSystemChannels.css";

type ViewMode = "list" | "add";

function ChannelRowSkeleton({ index }: { index: number }) {
  return (
    <div
      className="admin-sys-ch__menu-item admin-sys-ch__menu-item--skel shop-rise"
      style={{ "--rise-index": Math.min(index + 1, 6) } as CSSProperties}
      aria-hidden
    >
      <div className="admin-sys-ch__menu-copy">
        <span className="admin-sys-ch__skel admin-sys-ch__skel--title" />
        <span className="admin-sys-ch__skel admin-sys-ch__skel--hint" />
      </div>
      <span className="admin-sys-ch__skel admin-sys-ch__skel--action" />
    </div>
  );
}

function ChannelAddSkeleton() {
  return (
    <section className="admin-sys-ch__add" aria-busy="true" aria-hidden>
      <span className="admin-sys-ch__skel admin-sys-ch__skel--section" />
      <div className="admin-sys-ch__card admin-sys-ch__card--skel">
        <div className="admin-sys-ch__step">
          <span className="admin-sys-ch__skel admin-sys-ch__skel--num" />
          <span className="admin-sys-ch__skel admin-sys-ch__skel--step" />
        </div>
        <span className="admin-sys-ch__skel admin-sys-ch__skel--btn" />
        <div className="admin-sys-ch__step">
          <span className="admin-sys-ch__skel admin-sys-ch__skel--num" />
          <span className="admin-sys-ch__skel admin-sys-ch__skel--step admin-sys-ch__skel--step-sm" />
        </div>
        <span className="admin-sys-ch__skel admin-sys-ch__skel--label" />
        <span className="admin-sys-ch__skel admin-sys-ch__skel--input" />
        <span className="admin-sys-ch__skel admin-sys-ch__skel--btn" />
      </div>
    </section>
  );
}

function isCommunityGroup(slotKey: AdminSystemChannelSlot) {
  return slotKey === "community_group";
}

const SLOT_LABEL_KEYS: Record<AdminSystemChannelSlot, string> = {
  admin_report: "admin.channelsSlotAdminReport",
  purchase_report: "admin.channelsSlotPurchase",
  notification: "admin.channelsSlotNotify",
  community_group: "admin.channelsSlotGroup",
};

function slotLabel(
  t: (key: string, params?: Record<string, string | number>) => string,
  slot: AdminSystemChannelSlotItem,
) {
  return t(SLOT_LABEL_KEYS[slot.slotKey]) || slot.label;
}

function looksLikeTelegramPostLink(value: string, allowPrivate = false): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  const normalized = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed.replace(/^\/+/, "")}`;
  try {
    const url = new URL(normalized);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (host !== "t.me" && host !== "telegram.me" && host !== "telegram.dog") {
      return false;
    }
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts[0]?.toLowerCase() === "c") {
      if (!allowPrivate) return false;
      const internalId = parts[1] ?? "";
      const messageId = Number.parseInt(parts[2] ?? "", 10);
      return /^\d{5,20}$/.test(internalId) && Number.isFinite(messageId) && messageId > 0;
    }
    const usernameIndex = parts[0]?.toLowerCase() === "s" ? 1 : 0;
    const username = parts[usernameIndex];
    const messageId = Number.parseInt(parts[usernameIndex + 1] ?? "", 10);
    return Boolean(username) && Number.isFinite(messageId) && messageId > 0;
  } catch {
    return false;
  }
}

function looksLikeTelegramGroupLink(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  const normalized = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed.replace(/^\/+/, "")}`;
  try {
    const url = new URL(normalized);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (host !== "t.me" && host !== "telegram.me" && host !== "telegram.dog") {
      return false;
    }
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts[0]?.toLowerCase() === "c") {
      return /^\d{5,20}$/.test(parts[1] ?? "");
    }
    if (parts[0]?.toLowerCase() === "joinchat" && parts[1]) return true;
    if (parts[0]?.startsWith("+") && (parts[0]?.length ?? 0) > 2) return true;
    if (url.searchParams.get("invite")) return true;
    const usernameIndex = parts[0]?.toLowerCase() === "s" ? 1 : 0;
    const username = parts[usernameIndex];
    return Boolean(username && /^[a-zA-Z][a-zA-Z0-9_]{3,31}$/.test(username));
  } catch {
    return false;
  }
}

function formatChannelIdentity(username: string, inviteLink?: string | null) {
  if (inviteLink) return inviteLink.replace(/^https?:\/\//i, "");
  if (username.startsWith("c/") || username.startsWith("group_")) return username;
  return `@${username}`;
}

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

export function AdminChannelsPage() {
  const navigate = useNavigate();
  const { haptic } = useTelegram();
  const { notify } = useNotification();
  const { t } = useI18n();

  const [view, setView] = useState<ViewMode>("list");
  const [items, setItems] = useState<AdminSystemChannelSlotItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [botUsername, setBotUsername] = useState("...");
  const [botDeepLink, setBotDeepLink] = useState("");
  const [botGroupDeepLink, setBotGroupDeepLink] = useState("");
  const [selectedSlot, setSelectedSlot] = useState<AdminSystemChannelSlotItem | null>(
    null,
  );
  const [postLink, setPostLink] = useState("");
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [busySlot, setBusySlot] = useState<AdminSystemChannelSlot | null>(null);

  const handleBack = useCallback(() => {
    if (view === "add") {
      setView("list");
      setSelectedSlot(null);
      setPostLink("");
      setRegisterError(null);
      return;
    }
    navigate("/admin", { replace: true });
  }, [navigate, view]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [bot, channels] = await Promise.all([
        fetchAdminSystemChannelsBot(),
        fetchAdminSystemChannels(),
      ]);
      setBotUsername(bot.username);
      setBotDeepLink(bot.deepLink);
      setBotGroupDeepLink(bot.groupDeepLink || "");
      setItems(channels.items);
    } catch (error) {
      notify(
        error instanceof Error ? error.message : t("admin.channelsLoadError"),
        "error",
      );
    } finally {
      setLoading(false);
    }
  }, [notify, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const openAdd = (slot: AdminSystemChannelSlotItem) => {
    haptic("light");
    setSelectedSlot(slot);
    setPostLink("");
    setRegisterError(null);
    setView("add");
  };

  const handleRegister = async () => {
    if (!selectedSlot || isRegistering) return;
    const link = postLink.trim();
    const isGroup = isCommunityGroup(selectedSlot.slotKey);
    const allowPrivate = selectedSlot.slotKey === "admin_report";
    const valid = isGroup
      ? looksLikeTelegramGroupLink(link)
      : looksLikeTelegramPostLink(link, allowPrivate);

    if (!valid) {
      setRegisterError(
        isGroup
          ? t("admin.channelsInvalidGroupLink")
          : allowPrivate
            ? t("admin.channelsInvalidPrivatePost")
            : t("admin.channelsInvalidPublicPost"),
      );
      return;
    }

    haptic("light");
    setIsRegistering(true);
    setRegisterError(null);
    try {
      await registerAdminSystemChannel(selectedSlot.slotKey, link);
      await load();
      haptic("medium");
      notify(
        t("admin.channelsRegistered", {
          label: slotLabel(t, selectedSlot),
        }),
        "success",
      );
      setView("list");
      setSelectedSlot(null);
      setPostLink("");
    } catch (error) {
      setRegisterError(
        error instanceof Error
          ? error.message
          : isGroup
            ? t("admin.channelsRegisterGroupFailed")
            : t("admin.channelsRegisterFailed"),
      );
    } finally {
      setIsRegistering(false);
    }
  };

  const handleToggleActive = async (slot: AdminSystemChannelSlotItem) => {
    if (!slot.channel || busySlot) return;
    const next = !slot.channel.isActive;
    haptic("light");
    setBusySlot(slot.slotKey);
    try {
      await setAdminSystemChannelActive(slot.slotKey, next);
      await load();
      const entity = isCommunityGroup(slot.slotKey)
        ? t("admin.channelsEntityGroup")
        : t("admin.channelsEntityChannel");
      notify(
        next
          ? t("admin.channelsLockOn", { entity })
          : t("admin.channelsLockOff", { entity }),
        next ? "info" : "success",
      );
    } catch (error) {
      notify(
        error instanceof Error ? error.message : t("common.error"),
        "error",
      );
    } finally {
      setBusySlot(null);
    }
  };

  const handleDelete = async (slot: AdminSystemChannelSlotItem) => {
    if (!slot.channel || busySlot) return;
    const entity = isCommunityGroup(slot.slotKey)
      ? t("admin.channelsEntityGroup")
      : t("admin.channelsEntityChannel");
    if (
      !window.confirm(
        t("admin.channelsDeleteConfirm", {
          entity,
          label: slotLabel(t, slot),
        }),
      )
    ) {
      return;
    }
    haptic("medium");
    setBusySlot(slot.slotKey);
    try {
      await deleteAdminSystemChannel(slot.slotKey);
      await load();
      notify(t("admin.channelsDeleted", { entity }), "success");
    } catch (error) {
      notify(
        error instanceof Error ? error.message : t("common.error"),
        "error",
      );
    } finally {
      setBusySlot(null);
    }
  };

  const selectedIsGroup = selectedSlot
    ? isCommunityGroup(selectedSlot.slotKey)
    : false;

  const pageTitle =
    view === "add" && selectedSlot
      ? slotLabel(t, selectedSlot)
      : t("admin.channelsTitle");

  return (
    <AdminScreen title={pageTitle} onBack={handleBack}>
      {view === "list" ? (
        loading ? (
          <div className="admin-sys-ch__menu" aria-busy="true">
            {[0, 1, 2, 3].map((index) => (
              <ChannelRowSkeleton key={index} index={index} />
            ))}
          </div>
        ) : (
          <div
            className="admin-sys-ch__menu shop-rise"
            style={{ "--rise-index": 1 } as CSSProperties}
          >
            {items.map((slot) => {
              const channel = slot.channel;
              const busy = busySlot === slot.slotKey;
              const isAdminReport = slot.slotKey === "admin_report";
              const isGroup = isCommunityGroup(slot.slotKey);
              const meta = !channel
                ? isAdminReport
                  ? t("admin.channelsMetaAdminUnset")
                  : isGroup
                    ? t("admin.channelsMetaGroupUnset")
                    : t("admin.channelsMetaUnset")
                : isAdminReport
                  ? `${t("admin.channelsMetaAdminOnly")} · ${formatChannelIdentity(channel.username)}`
                  : `${formatChannelIdentity(channel.username, channel.inviteLink)} · ${
                      channel.isActive
                        ? t("admin.channelsMetaLockOn")
                        : t("admin.channelsMetaLockOff")
                    }`;

              return (
                <div
                  key={slot.slotKey}
                  className={`admin-sys-ch__menu-item${
                    channel && !channel.isActive && !isAdminReport ? " is-off" : ""
                  }`}
                >
                  <div className="admin-sys-ch__menu-copy">
                    <span className="admin-sys-ch__menu-label">{slotLabel(t, slot)}</span>
                    <span className="admin-sys-ch__menu-hint" dir="auto">
                      {meta}
                    </span>
                  </div>

                  {channel ? (
                    <div className="admin-sys-ch__menu-actions">
                      {!isAdminReport ? (
                        <button
                          type="button"
                          className={`admin-sys-ch__icon-btn${
                            channel.isActive ? " is-on" : " is-off"
                          }`}
                          disabled={busy}
                          aria-label={
                            channel.isActive
                              ? t("admin.channelsUnlock")
                              : t("admin.channelsLock")
                          }
                          onClick={() => void handleToggleActive(slot)}
                        >
                          <LockIcon width={15} height={15} locked={channel.isActive} />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="admin-sys-ch__icon-btn"
                        disabled={busy}
                        aria-label={t("admin.channelsReplace")}
                        onClick={() => openAdd(slot)}
                      >
                        <GatewayEditIcon />
                      </button>
                      <button
                        type="button"
                        className="admin-sys-ch__icon-btn is-danger"
                        disabled={busy}
                        aria-label={t("common.delete")}
                        onClick={() => void handleDelete(slot)}
                      >
                        <GatewayDeleteIcon />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="admin-sys-ch__add-btn"
                      onClick={() => openAdd(slot)}
                    >
                      {t("admin.channelsAdd")}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )
      ) : selectedSlot && loading ? (
        <ChannelAddSkeleton />
      ) : selectedSlot ? (
        <section
          className="admin-sys-ch__add shop-rise"
          style={{ "--rise-index": 1 } as CSSProperties}
        >
          <p className="admin-sys-ch__section-title">{t("admin.channelsAddGuide")}</p>
          <div className="admin-sys-ch__card">
            <div className="admin-sys-ch__step">
              <span className="admin-sys-ch__step-num">۱</span>
              <p className="admin-sys-ch__step-text">
                {t("admin.channelsStep1", {
                  bot: `@${botUsername}`,
                  entity: selectedIsGroup
                    ? t("admin.channelsEntityGroup")
                    : t("admin.channelsEntityChannel"),
                })}
              </p>
            </div>

            <button
              type="button"
              className="admin-sys-ch__btn admin-sys-ch__btn--ghost"
              disabled={selectedIsGroup ? !botGroupDeepLink : !botDeepLink}
              onClick={() => {
                const link = selectedIsGroup ? botGroupDeepLink : botDeepLink;
                if (!link) return;
                haptic("light");
                openExternal(link);
              }}
            >
              {selectedIsGroup
                ? t("admin.channelsAddBotToGroup")
                : t("admin.channelsAddBotToChannel")}
            </button>

            <div className="admin-sys-ch__step">
              <span className="admin-sys-ch__step-num">۲</span>
              <p className="admin-sys-ch__step-text">
                {selectedIsGroup
                  ? t("admin.channelsStep2Group")
                  : selectedSlot.slotKey === "admin_report"
                    ? t("admin.channelsStep2AdminReport")
                    : t("admin.channelsStep2Public")}
              </p>
            </div>

            <label className="admin-sys-ch__field">
              <span className="admin-sys-ch__field-label">
                {selectedIsGroup
                  ? t("admin.channelsGroupLink")
                  : t("admin.channelsPostLink")}
              </span>
              <input
                className="admin-sys-ch__input"
                value={postLink}
                onChange={(event) => {
                  setPostLink(event.target.value);
                  setRegisterError(null);
                }}
                placeholder={
                  selectedIsGroup
                    ? "https://t.me/+…"
                    : selectedSlot.slotKey === "admin_report"
                      ? "https://t.me/c/…/…"
                      : "https://t.me/channel/123"
                }
                dir="ltr"
                inputMode="url"
              />
              {registerError ? (
                <span className="admin-sys-ch__error">{registerError}</span>
              ) : null}
            </label>

            <button
              type="button"
              className="admin-sys-ch__btn"
              disabled={isRegistering || !postLink.trim()}
              onClick={() => void handleRegister()}
            >
              {isRegistering
                ? t("admin.channelsRegistering")
                : selectedIsGroup
                  ? t("admin.channelsRegisterGroup")
                  : t("admin.channelsRegisterChannel")}
            </button>
          </div>
        </section>
      ) : null}
    </AdminScreen>
  );
}
