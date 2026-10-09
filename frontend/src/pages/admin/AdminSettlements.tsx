import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { EmptyState } from "../../components/EmptyState";
import { PageHeader } from "../../components/PageHeader";
import { useNotification } from "../../components/Notification";
import ChatDelay01Icon from "../../components/icons/hugeicons/ChatDelay01Icon";
import ChatDone01Icon from "../../components/icons/hugeicons/ChatDone01Icon";
import ChatIcon from "../../components/icons/hugeicons/ChatIcon";
import MoneySendSquareIcon from "../../components/icons/hugeicons/MoneySendSquareIcon";
import { useI18n } from "../../context/I18nContext";
import { useTelegram } from "../../hooks/useTelegram";
import { formatFaDate, formatFaNumber } from "../../lib/format";
import {
  fetchAdminSettlements,
  updateAdminSettlementStatus,
  type AdminShopSettlement,
  type ShopSettlementStatus,
} from "../../lib/shop";
import "../../styles/shop-rise.css";
import "./Admin.css";

type TabId = ShopSettlementStatus | "all";

function TabIcon({ id }: { id: TabId }) {
  const props = { size: 15 };
  if (id === "requested") return <ChatDelay01Icon {...props} />;
  if (id === "processing") return <MoneySendSquareIcon {...props} />;
  if (id === "paid") return <ChatDone01Icon {...props} />;
  return <ChatIcon {...props} />;
}

function userLabel(item: AdminShopSettlement) {
  const u = item.user;
  if (u.fullName?.trim()) return u.fullName.trim();
  if (u.username?.trim()) return `@${u.username.trim()}`;
  const name = [u.firstName, u.lastName].filter(Boolean).join(" ").trim();
  if (name) return name;
  return u.telegramId;
}

function statusTone(
  status: ShopSettlementStatus,
): "pending" | "approved" | "rejected" {
  if (status === "paid") return "approved";
  if (status === "rejected") return "rejected";
  return "pending";
}

function SettlementSkeleton({ index }: { index: number }) {
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

export function AdminSettlementsPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { haptic } = useTelegram();
  const { notify } = useNotification();

  const tabs: Array<{ id: TabId; label: string }> = [
    { id: "requested", label: t("admin.settlementsTabRequested") },
    { id: "processing", label: t("admin.settlementsTabProcessing") },
    { id: "paid", label: t("admin.settlementsTabPaid") },
    { id: "all", label: t("admin.settlementsTabAll") },
  ];

  const [tab, setTab] = useState<TabId>("requested");
  const [items, setItems] = useState<AdminShopSettlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAdminSettlements(tab);
      setItems(data.settlements);
    } catch (error) {
      notify(error instanceof Error ? error.message : t("common.error"), "error");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [notify, t, tab]);

  useEffect(() => {
    void load();
  }, [load]);

  const setStatus = async (
    id: string,
    status: Extract<ShopSettlementStatus, "processing" | "paid">,
  ) => {
    haptic("medium");
    setBusyId(id);
    try {
      await updateAdminSettlementStatus(id, status);
      notify(
        status === "paid"
          ? t("admin.settlementsMarkedPaid")
          : t("admin.settlementsMarkedProcessing"),
        "success",
      );
      await load();
    } catch (error) {
      notify(error instanceof Error ? error.message : t("common.error"), "error");
    } finally {
      setBusyId(null);
    }
  };

  const statusLabel = (status: ShopSettlementStatus) => {
    if (status === "paid") return t("myShop.settlePaid");
    if (status === "processing") return t("myShop.settleProcessing");
    if (status === "rejected") return t("myShop.settleRejected");
    return t("myShop.settleRequested");
  };

  return (
    <div className="admin-section">
      <div className="shop-rise" style={{ "--rise-index": 0 } as CSSProperties}>
        <PageHeader
          title={t("admin.settlementsPageTitle")}
          onBack={() => navigate("/admin")}
        />
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
            <TabIcon id={item.id} />
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="admin-charge-list" aria-busy="true">
          {[0, 1, 2].map((index) => (
            <SettlementSkeleton key={index} index={index} />
          ))}
        </div>
      ) : null}

      {!loading && items.length === 0 ? (
        <EmptyState title={t("admin.settlementsEmpty")} />
      ) : null}

      {!loading && items.length > 0 ? (
        <div className="admin-charge-list">
          {items.map((row, index) => {
            const tone = statusTone(row.status);
            const canProcessing = row.status === "requested";
            const canPaid = row.status === "requested" || row.status === "processing";
            const methodLabel =
              row.method === "rial"
                ? t("myShop.settleMethodRial")
                : t("myShop.settleMethodTrx");
            const destLabel =
              row.method === "rial"
                ? row.iban ?? "—"
                : row.trxDestination === "in_app"
                  ? t("myShop.settleTrxInApp")
                  : row.trxAddress ?? "—";

            return (
              <article
                key={row.id}
                className={`admin-charge-item admin-charge-item--clickable shop-rise admin-charge-item--${tone}`}
                style={{ "--rise-index": Math.min(index + 2, 8) } as CSSProperties}
                role="button"
                tabIndex={0}
                onClick={() => {
                  haptic("light");
                  navigate(`/admin/settlements/${row.id}`);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    navigate(`/admin/settlements/${row.id}`);
                  }
                }}
              >
                <div className="admin-charge-item__header">
                  <span className="admin-charge-item__thumb" aria-hidden>
                    <span className="admin-charge-item__thumb-fallback">
                      {row.method === "rial" ? "﷼" : "T"}
                    </span>
                  </span>

                  <div className="admin-charge-item__summary">
                    <div className="admin-charge-item__title-row">
                      <h3 className="admin-charge-item__user">{row.shop.name}</h3>
                      <span
                        className={`admin-charge-item__badge admin-charge-item__badge--${tone}`}
                      >
                        {statusLabel(row.status)}
                      </span>
                    </div>
                    <p className="admin-charge-item__amount">
                      <span className="admin-charge-item__amount-num">
                        {formatFaNumber(row.amountToman)}
                      </span>{" "}
                      <span className="admin-charge-item__amount-unit">
                        {t("wallet.toman")}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="admin-charge-item__meta">
                  <span className="admin-charge-item__meta-chip">
                    <span>{userLabel(row)}</span>
                  </span>
                  <span className="admin-charge-item__meta-chip">
                    <span dir="ltr">ID {row.user.telegramId}</span>
                  </span>
                  {row.user.username ? (
                    <span className="admin-charge-item__meta-chip">
                      <span dir="ltr">@{row.user.username}</span>
                    </span>
                  ) : null}
                  <span className="admin-charge-item__meta-chip">
                    <span>{methodLabel}</span>
                  </span>
                  <span className="admin-charge-item__meta-chip">
                    <span dir="ltr">{destLabel}</span>
                  </span>
                  <span className="admin-charge-item__meta-chip">
                    <span>#{row.id}</span>
                  </span>
                  <span className="admin-charge-item__meta-chip">
                    <span>{formatFaDate(row.createdAt)}</span>
                  </span>
                  {row.paidAt ? (
                    <span className="admin-charge-item__meta-chip">
                      <span>
                        {t("admin.settlementsPaidAt")}: {formatFaDate(row.paidAt)}
                      </span>
                    </span>
                  ) : null}
                </div>

                {canProcessing || canPaid ? (
                  <div
                    className="admin-charge-item__actions"
                    onClick={(event) => event.stopPropagation()}
                    onKeyDown={(event) => event.stopPropagation()}
                  >
                    {canProcessing ? (
                      <button
                        type="button"
                        className="admin-charge-item__btn"
                        disabled={busyId === row.id}
                        onClick={() => void setStatus(row.id, "processing")}
                      >
                        {t("admin.settlementsMarkProcessing")}
                      </button>
                    ) : (
                      <span />
                    )}
                    {canPaid ? (
                      <button
                        type="button"
                        className="admin-charge-item__btn admin-charge-item__btn--approve"
                        disabled={busyId === row.id}
                        onClick={() => void setStatus(row.id, "paid")}
                      >
                        {t("admin.settlementsMarkPaid")}
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
