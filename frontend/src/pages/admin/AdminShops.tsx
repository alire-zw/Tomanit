import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { EmptyState } from "../../components/EmptyState";
import { ImageViewer } from "../../components/ImageViewer";
import { useNotification } from "../../components/Notification";
import { PageHeader } from "../../components/PageHeader";
import ChatCancelIcon from "../../components/icons/hugeicons/ChatCancelIcon";
import ChatDelay01Icon from "../../components/icons/hugeicons/ChatDelay01Icon";
import ChatDone01Icon from "../../components/icons/hugeicons/ChatDone01Icon";
import ChatIcon from "../../components/icons/hugeicons/ChatIcon";
import { useI18n } from "../../context/I18nContext";
import { useTelegram } from "../../hooks/useTelegram";
import { formatFaDate, formatFaNumber } from "../../lib/format";
import { lockAppScroll, unlockAppScroll } from "../../lib/scrollLock";
import {
  approveAdminShop,
  fetchAdminShops,
  rejectAdminShop,
  type AdminShopItem,
  type ShopStoreStatus,
} from "../../lib/shop";
import "../../styles/shop-rise.css";
import "./Admin.css";

type TabId = ShopStoreStatus | "all";

function ShopTabIcon({ id }: { id: TabId }) {
  const props = { size: 15 };
  if (id === "pending") return <ChatDelay01Icon {...props} />;
  if (id === "active") return <ChatDone01Icon {...props} />;
  if (id === "rejected") return <ChatCancelIcon {...props} />;
  return <ChatIcon {...props} />;
}

function userLabel(shop: AdminShopItem) {
  const u = shop.user;
  if (u.fullName?.trim()) return u.fullName.trim();
  if (u.username?.trim()) return `@${u.username.trim()}`;
  const name = [u.firstName, u.lastName].filter(Boolean).join(" ").trim();
  if (name) return name;
  return u.telegramId;
}

function statusTone(status: ShopStoreStatus): "pending" | "approved" | "rejected" {
  if (status === "active") return "approved";
  if (status === "rejected" || status === "suspended") return "rejected";
  return "pending";
}

function channelLabel(channel: AdminShopItem["channel"], t: (k: string) => string) {
  if (channel === "website") return t("myShop.regChannelWebsite");
  if (channel === "bot") return t("myShop.regChannelBot");
  return t("myShop.regChannelManual");
}

function sellLabel(sellType: AdminShopItem["sellType"], t: (k: string) => string) {
  return sellType === "goods" ? t("myShop.regSellGoods") : t("myShop.regSellServices");
}

function ShopItemSkeleton({ index }: { index: number }) {
  return (
    <article
      className="admin-charge-item admin-charge-item--skeleton shop-rise"
      style={{ "--rise-index": Math.min(index + 2, 8) } as CSSProperties}
      aria-hidden
    >
      <div className="admin-charge-item__header">
        <span className="admin-charge-skel admin-charge-skel--thumb" />
        <div className="admin-charge-item__summary">
          <div className="admin-charge-item__title-row">
            <span className="admin-charge-skel admin-charge-skel--user" />
            <span className="admin-charge-skel admin-charge-skel--badge" />
          </div>
          <span className="admin-charge-skel admin-charge-skel--amount" />
        </div>
      </div>
      <div className="admin-charge-item__meta">
        <span className="admin-charge-item__meta-chip admin-charge-item__meta-chip--skel">
          <span className="admin-charge-skel admin-charge-skel--line" />
        </span>
        <span className="admin-charge-item__meta-chip admin-charge-item__meta-chip--skel">
          <span className="admin-charge-skel admin-charge-skel--line admin-charge-skel--line-sm" />
        </span>
      </div>
      <div className="admin-charge-item__actions">
        <span className="admin-charge-skel admin-charge-skel--btn" />
        <span className="admin-charge-skel admin-charge-skel--btn" />
      </div>
    </article>
  );
}

function RejectReasonModal({
  isOpen,
  note,
  busy,
  onNoteChange,
  onClose,
  onConfirm,
  title,
  desc,
  confirmLabel,
  cancelLabel,
  placeholder,
}: {
  isOpen: boolean;
  note: string;
  busy: boolean;
  onNoteChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  desc: string;
  confirmLabel: string;
  cancelLabel: string;
  placeholder: string;
}) {
  useEffect(() => {
    if (!isOpen) return;
    lockAppScroll();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      unlockAppScroll();
    };
  }, [busy, isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div className="admin-reject" role="dialog" aria-modal="true" aria-labelledby="admin-shop-reject-title">
      <button
        type="button"
        className="admin-reject__backdrop"
        onClick={() => {
          if (!busy) onClose();
        }}
      />
      <div className="admin-reject__panel">
        <h2 id="admin-shop-reject-title" className="admin-reject__title">
          {title}
        </h2>
        <p className="admin-reject__desc">{desc}</p>
        <textarea
          className="admin-reject__input"
          value={note}
          onChange={(event) => onNoteChange(event.target.value)}
          placeholder={placeholder}
          rows={4}
          maxLength={500}
          disabled={busy}
        />
        <div className="admin-reject__actions">
          <button type="button" className="admin-reject__btn" disabled={busy} onClick={onClose}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className="admin-reject__btn admin-reject__btn--danger"
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? "…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function AdminShopsPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { haptic } = useTelegram();
  const { notify } = useNotification();

  const tabs: Array<{ id: TabId; label: string }> = [
    { id: "pending", label: t("admin.shopsTabPending") },
    { id: "active", label: t("admin.shopsTabActive") },
    { id: "rejected", label: t("admin.shopsTabRejected") },
    { id: "all", label: t("admin.shopsTabAll") },
  ];

  const [tab, setTab] = useState<TabId>("pending");
  const [shops, setShops] = useState<AdminShopItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [viewerSrc, setViewerSrc] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAdminShops(tab);
      setShops(data.shops);
    } catch (error) {
      notify(error instanceof Error ? error.message : t("common.error"), "error");
      setShops([]);
    } finally {
      setLoading(false);
    }
  }, [notify, t, tab]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleApprove = async (id: string) => {
    haptic("medium");
    setBusyId(id);
    try {
      await approveAdminShop(id);
      notify(t("admin.shopsApproved"), "success");
      await load();
    } catch (error) {
      notify(error instanceof Error ? error.message : t("common.error"), "error");
    } finally {
      setBusyId(null);
    }
  };

  const confirmReject = async () => {
    if (rejectId == null) return;
    setBusyId(rejectId);
    try {
      await rejectAdminShop(rejectId, rejectNote.trim() || undefined);
      notify(t("admin.shopsRejected"), "warning");
      setRejectId(null);
      setRejectNote("");
      await load();
    } catch (error) {
      notify(error instanceof Error ? error.message : t("common.error"), "error");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="admin-section">
      <div className="shop-rise" style={{ "--rise-index": 0 } as CSSProperties}>
        <PageHeader title={t("admin.shopsPageTitle")} onBack={() => navigate("/admin")} />
      </div>

      <div className="admin-tabs shop-rise" style={{ "--rise-index": 1 } as CSSProperties}>
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`admin-tabs__btn${tab === item.id ? " admin-tabs__btn--active" : ""}`}
            onClick={() => {
              haptic("light");
              setTab(item.id);
            }}
          >
            <ShopTabIcon id={item.id} />
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="admin-charge-list" aria-busy="true">
          {[0, 1, 2].map((index) => (
            <ShopItemSkeleton key={index} index={index} />
          ))}
        </div>
      ) : null}

      {!loading && shops.length === 0 ? (
        <EmptyState title={t("common.empty")} />
      ) : null}

      {!loading && shops.length > 0 ? (
        <div className="admin-charge-list">
          {shops.map((shop, index) => {
            const tone = statusTone(shop.status);
            const badgeLabel =
              shop.status === "pending"
                ? t("myShop.statusPending")
                : shop.status === "active"
                  ? t("myShop.statusActive")
                  : shop.status === "suspended"
                    ? t("myShop.statusSuspended")
                    : t("admin.shopsRejectedBadge");
            const canReview = shop.status === "pending" || shop.status === "rejected";
            const canReject = shop.status === "pending" || shop.status === "active";

            return (
              <article
                key={shop.id}
                className={`admin-charge-item shop-rise admin-charge-item--${tone}`}
                style={{ "--rise-index": Math.min(index + 2, 8) } as CSSProperties}
              >
                <div className="admin-charge-item__header">
                  {shop.logoDataUrl ? (
                    <button
                      type="button"
                      className="admin-charge-item__thumb"
                      onClick={() => setViewerSrc(shop.logoDataUrl)}
                      aria-label={t("common.viewImage")}
                    >
                      <img src={shop.logoDataUrl} alt="" />
                    </button>
                  ) : (
                    <span className="admin-charge-item__thumb" aria-hidden>
                      <span className="admin-charge-item__thumb-fallback">
                        {shop.name.slice(0, 1)}
                      </span>
                    </span>
                  )}

                  <div className="admin-charge-item__summary">
                    <div className="admin-charge-item__title-row">
                      <h3 className="admin-charge-item__user">{shop.name}</h3>
                      <span className={`admin-charge-item__badge admin-charge-item__badge--${tone}`}>
                        {badgeLabel}
                      </span>
                    </div>
                    <p className="admin-charge-item__amount">
                      <span className="admin-charge-item__amount-num">{userLabel(shop)}</span>
                    </p>
                  </div>
                </div>

                <div className="admin-charge-item__meta">
                  <span className="admin-charge-item__meta-chip">
                    <span>{sellLabel(shop.sellType, t)}</span>
                  </span>
                  <span className="admin-charge-item__meta-chip">
                    <span>{channelLabel(shop.channel, t)}</span>
                  </span>
                  <span className="admin-charge-item__meta-chip">
                    <span>
                      {formatFaNumber(shop.dailyCount)} ·{" "}
                      {formatFaNumber(shop.dailyAmountToman)} {t("wallet.toman")}
                    </span>
                  </span>
                  <span className="admin-charge-item__meta-chip">
                    <span>{formatFaDate(shop.createdAt)}</span>
                  </span>
                  {shop.siteUrl ? (
                    <span className="admin-charge-item__meta-chip">
                      <span dir="ltr">{shop.siteUrl}</span>
                    </span>
                  ) : null}
                  {shop.botUrl ? (
                    <span className="admin-charge-item__meta-chip">
                      <span dir="ltr">{shop.botUrl}</span>
                    </span>
                  ) : null}
                  <span className="admin-charge-item__meta-chip">
                    <span dir="ltr">ID {shop.user.telegramId}</span>
                  </span>
                </div>

                {shop.reviewNote ? (
                  <div className="admin-charge-item__note">
                    <span>{shop.reviewNote}</span>
                  </div>
                ) : null}

                {canReview || canReject ? (
                  <div className="admin-charge-item__actions">
                    {canReview ? (
                      <button
                        type="button"
                        className="admin-charge-item__btn admin-charge-item__btn--approve"
                        disabled={busyId === shop.id}
                        onClick={() => void handleApprove(shop.id)}
                      >
                        {t("admin.shopsApprove")}
                      </button>
                    ) : (
                      <span />
                    )}
                    {canReject ? (
                      <button
                        type="button"
                        className="admin-charge-item__btn admin-charge-item__btn--reject"
                        disabled={busyId === shop.id}
                        onClick={() => {
                          haptic("light");
                          setRejectId(shop.id);
                          setRejectNote("");
                        }}
                      >
                        {t("admin.shopsReject")}
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : null}

      <RejectReasonModal
        isOpen={rejectId != null}
        note={rejectNote}
        busy={busyId != null && busyId === rejectId}
        onNoteChange={setRejectNote}
        onClose={() => {
          if (busyId != null) return;
          setRejectId(null);
          setRejectNote("");
        }}
        onConfirm={() => void confirmReject()}
        title={t("admin.shopsRejectTitle")}
        desc={t("admin.shopsRejectDesc")}
        confirmLabel={t("admin.shopsReject")}
        cancelLabel={t("common.cancel")}
        placeholder={t("admin.shopsRejectPh")}
      />

      <ImageViewer
        isOpen={Boolean(viewerSrc)}
        src={viewerSrc ?? ""}
        onClose={() => setViewerSrc(null)}
      />
    </div>
  );
}
