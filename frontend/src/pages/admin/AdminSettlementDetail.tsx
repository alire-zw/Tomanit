import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { EmptyState } from "../../components/EmptyState";
import { PageHeader } from "../../components/PageHeader";
import { useNotification } from "../../components/Notification";
import Copy01Icon from "../../components/icons/hugeicons/Copy01Icon";
import { useI18n } from "../../context/I18nContext";
import { useTelegram } from "../../hooks/useTelegram";
import { formatFaDate, formatFaNumber } from "../../lib/format";
import {
  fetchAdminSettlement,
  updateAdminSettlementStatus,
  type AdminShopSettlement,
  type ShopSettlementStatus,
} from "../../lib/shop";
import "../../styles/shop-rise.css";
import "./Admin.css";

function statusTone(
  status: ShopSettlementStatus,
): "pending" | "approved" | "rejected" {
  if (status === "paid") return "approved";
  if (status === "rejected") return "rejected";
  return "pending";
}

function userLabel(item: AdminShopSettlement) {
  const u = item.user;
  if (u.fullName?.trim()) return u.fullName.trim();
  if (u.username?.trim()) return `@${u.username.trim()}`;
  const name = [u.firstName, u.lastName].filter(Boolean).join(" ").trim();
  if (name) return name;
  return u.telegramId;
}

function DetailRow({
  label,
  value,
  mono,
  copyValue,
  onCopy,
  copyLabel,
}: {
  label: string;
  value: string;
  mono?: boolean;
  copyValue?: string | null;
  onCopy?: (text: string) => void;
  copyLabel?: string;
}) {
  const canCopy = Boolean(copyValue && onCopy);
  return (
    <div className="admin-settle-detail__row">
      <span className="admin-settle-detail__label">{label}</span>
      <div className="admin-settle-detail__value-wrap">
        <span
          className={`admin-settle-detail__value${mono ? " is-mono" : ""}`}
          dir={mono ? "ltr" : undefined}
        >
          {value}
        </span>
        {canCopy ? (
          <button
            type="button"
            className="admin-settle-detail__copy"
            aria-label={copyLabel}
            onClick={() => onCopy?.(copyValue!)}
          >
            <Copy01Icon size={14} color="currentColor" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function AdminSettlementDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { t } = useI18n();
  const { haptic } = useTelegram();
  const { notify } = useNotification();

  const [item, setItem] = useState<AdminShopSettlement | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) {
      setItem(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchAdminSettlement(id);
      setItem(data.settlement);
    } catch (error) {
      setItem(null);
      notify(error instanceof Error ? error.message : t("common.error"), "error");
    } finally {
      setLoading(false);
    }
  }, [id, notify, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const copyText = async (text: string) => {
    haptic("light");
    try {
      await navigator.clipboard.writeText(text);
      notify(t("common.copied"), "success");
    } catch {
      notify(t("common.error"), "error");
    }
  };

  const setStatus = async (
    status: Extract<ShopSettlementStatus, "processing" | "paid">,
  ) => {
    if (!item) return;
    haptic("medium");
    setBusy(true);
    try {
      const { settlement } = await updateAdminSettlementStatus(item.id, status);
      setItem((prev) => (prev ? { ...prev, ...settlement } : prev));
      notify(
        status === "paid"
          ? t("admin.settlementsMarkedPaid")
          : t("admin.settlementsMarkedProcessing"),
        "success",
      );
    } catch (error) {
      notify(error instanceof Error ? error.message : t("common.error"), "error");
    } finally {
      setBusy(false);
    }
  };

  const statusLabel = (status: ShopSettlementStatus) => {
    if (status === "paid") return t("myShop.settlePaid");
    if (status === "processing") return t("myShop.settleProcessing");
    if (status === "rejected") return t("myShop.settleRejected");
    return t("myShop.settleRequested");
  };

  const tone = item ? statusTone(item.status) : "pending";
  const canProcessing = item?.status === "requested";
  const canPaid = item?.status === "requested" || item?.status === "processing";

  return (
    <div className="admin-section">
      <div className="shop-rise" style={{ "--rise-index": 0 } as CSSProperties}>
        <PageHeader
          title={t("admin.settlementsDetailTitle")}
          onBack={() => navigate("/admin/settlements")}
        />
      </div>

      {loading ? (
        <div className="admin-charge-list" aria-busy="true">
          <article className="admin-charge-item admin-charge-item--skeleton" aria-hidden>
            <div className="admin-charge-item__header">
              <span className="admin-charge-skel admin-charge-skel--thumb" />
              <div className="admin-charge-item__summary">
                <span className="admin-charge-skel admin-charge-skel--user" />
                <span className="admin-charge-skel admin-charge-skel--amount" />
              </div>
            </div>
          </article>
        </div>
      ) : null}

      {!loading && !item ? (
        <EmptyState title={t("admin.settlementsEmpty")} />
      ) : null}

      {!loading && item ? (
        <div className="admin-charge-list">
          <article
            className={`admin-charge-item shop-rise admin-charge-item--${tone}`}
            style={{ "--rise-index": 1 } as CSSProperties}
          >
            <div className="admin-charge-item__header">
              <span className="admin-charge-item__thumb" aria-hidden>
                <span className="admin-charge-item__thumb-fallback">
                  {item.method === "rial" ? "﷼" : "T"}
                </span>
              </span>
              <div className="admin-charge-item__summary">
                <div className="admin-charge-item__title-row">
                  <h3 className="admin-charge-item__user">{item.shop.name}</h3>
                  <span
                    className={`admin-charge-item__badge admin-charge-item__badge--${tone}`}
                  >
                    {statusLabel(item.status)}
                  </span>
                </div>
                <p className="admin-charge-item__amount">
                  <span className="admin-charge-item__amount-num">
                    {formatFaNumber(item.amountToman)}
                  </span>{" "}
                  <span className="admin-charge-item__amount-unit">
                    {t("wallet.toman")}
                  </span>
                </p>
              </div>
            </div>

            <div className="admin-settle-detail__fields">
              <DetailRow
                label={t("admin.settlementsFieldId")}
                value={`#${item.id}`}
                mono
                copyValue={item.id}
                onCopy={copyText}
                copyLabel={t("common.copy")}
              />
              <DetailRow
                label={t("admin.settlementsFieldUser")}
                value={userLabel(item)}
              />
              <DetailRow
                label={t("admin.settlementsFieldTelegramId")}
                value={item.user.telegramId}
                mono
                copyValue={item.user.telegramId}
                onCopy={copyText}
                copyLabel={t("common.copy")}
              />
              {item.user.username ? (
                <DetailRow
                  label={t("admin.settlementsFieldUsername")}
                  value={`@${item.user.username}`}
                  mono
                  copyValue={item.user.username}
                  onCopy={copyText}
                  copyLabel={t("common.copy")}
                />
              ) : null}
              <DetailRow
                label={t("admin.settlementsFieldShop")}
                value={item.shop.name}
              />
              <DetailRow
                label={t("admin.settlementsFieldMethod")}
                value={
                  item.method === "rial"
                    ? t("myShop.settleMethodRial")
                    : t("myShop.settleMethodTrx")
                }
              />
              {item.method === "rial" ? (
                <DetailRow
                  label={t("admin.settlementsFieldIban")}
                  value={item.iban || "—"}
                  mono
                  copyValue={item.iban}
                  onCopy={copyText}
                  copyLabel={t("common.copy")}
                />
              ) : (
                <>
                  <DetailRow
                    label={t("admin.settlementsFieldTrxDest")}
                    value={
                      item.trxDestination === "in_app"
                        ? t("myShop.settleTrxInApp")
                        : t("myShop.settleTrxExternal")
                    }
                  />
                  {item.trxDestination === "external" ? (
                    <DetailRow
                      label={t("admin.settlementsFieldTrxAddress")}
                      value={item.trxAddress || "—"}
                      mono
                      copyValue={item.trxAddress}
                      onCopy={copyText}
                      copyLabel={t("common.copy")}
                    />
                  ) : null}
                </>
              )}
              <DetailRow
                label={t("admin.settlementsFieldCreated")}
                value={formatFaDate(item.createdAt)}
              />
              {item.paidAt ? (
                <DetailRow
                  label={t("admin.settlementsPaidAt")}
                  value={formatFaDate(item.paidAt)}
                />
              ) : null}
            </div>

            {canProcessing || canPaid ? (
              <div className="admin-charge-item__actions">
                {canProcessing ? (
                  <button
                    type="button"
                    className="admin-charge-item__btn"
                    disabled={busy}
                    onClick={() => void setStatus("processing")}
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
                    disabled={busy}
                    onClick={() => void setStatus("paid")}
                  >
                    {t("admin.settlementsMarkPaid")}
                  </button>
                ) : null}
              </div>
            ) : null}
          </article>
        </div>
      ) : null}
    </div>
  );
}
