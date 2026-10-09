import {
  Children,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import { EmptyState } from "../../components/EmptyState";
import { PageHeader } from "../../components/PageHeader";
import { useNotification } from "../../components/Notification";
import ApiIcon from "../../components/icons/hugeicons/ApiIcon";
import ChatCancelIcon from "../../components/icons/hugeicons/ChatCancelIcon";
import ChatDelay01Icon from "../../components/icons/hugeicons/ChatDelay01Icon";
import ChatDone01Icon from "../../components/icons/hugeicons/ChatDone01Icon";
import Copy01Icon from "../../components/icons/hugeicons/Copy01Icon";
import Invoice04Icon from "../../components/icons/hugeicons/Invoice04Icon";
import Unlink01Icon from "../../components/icons/hugeicons/Unlink01Icon";
import { useI18n } from "../../context/I18nContext";
import { useTelegram } from "../../hooks/useTelegram";
import { formatCardNumberFa } from "../../lib/card";
import { formatFaDate, formatFaDecimal, formatFaNumber } from "../../lib/format";
import {
  fetchShopTransaction,
  type ShopTransaction,
  type ShopTxStatus,
} from "../../lib/shop";
import "../../styles/shop-rise.css";
import "../Wallet.css";
import "../MyShop.css";
import "./ShopTransactionDetail.css";

type SectionId = "ids" | "payer" | "payment" | "links";

function heroTone(status: ShopTxStatus): "paid" | "warn" | "bad" | "neutral" {
  if (status === "completed") return "paid";
  if (status === "pending") return "warn";
  if (status === "expired" || status === "unpaid" || status === "failed") return "bad";
  return "neutral";
}

function StatusIcon({ status }: { status: ShopTxStatus }) {
  const props = { size: 18, color: "currentColor" as const };
  if (status === "completed") return <ChatDone01Icon {...props} />;
  if (status === "pending") return <ChatDelay01Icon {...props} />;
  if (status === "expired") return <Unlink01Icon {...props} />;
  return <ChatCancelIcon {...props} />;
}

function statusLabel(status: ShopTxStatus, t: (k: string) => string) {
  if (status === "completed") return t("myShop.txTabPaid");
  if (status === "pending") return t("myShop.txTabPending");
  if (status === "expired") return t("myShop.txTabExpired");
  if (status === "unpaid") return t("myShop.txTabUnpaid");
  return t("myShop.txFailed");
}

function badgeClass(status: ShopTxStatus) {
  if (status === "completed") return "my-shop__badge--ok";
  if (status === "pending") return "my-shop__badge--warn";
  if (status === "expired") return "my-shop__badge--mute";
  return "my-shop__badge--err";
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`txd__panel-chevron${open ? " is-open" : ""}`}
      viewBox="0 0 24 24"
      width={14}
      height={14}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function Cell({
  label,
  value,
  mono,
  muted,
  wide,
  onCopy,
  copyLabel,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
  muted?: boolean;
  wide?: boolean;
  onCopy?: () => void;
  copyLabel?: string;
}) {
  if (value == null || value === "" || value === "—") return null;
  return (
    <div className={`txd__cell${wide ? " txd__cell--row" : ""}`}>
      <span className="txd__key">{label}</span>
      <span
        className={`txd__val${mono ? " txd__val--mono" : ""}${
          muted ? " txd__val--muted" : ""
        }`}
      >
        <span className="txd__val-text">{value}</span>
        {onCopy ? (
          <button
            type="button"
            className="txd__copy"
            aria-label={copyLabel || label}
            onClick={(e) => {
              e.stopPropagation();
              onCopy();
            }}
          >
            <Copy01Icon size={12} color="currentColor" />
          </button>
        ) : null}
      </span>
    </div>
  );
}

function Pair({ children }: { children: ReactNode }) {
  const items = Children.toArray(children).filter(Boolean);
  if (items.length === 0) return null;
  if (items.length === 1) return <>{items[0]}</>;
  return <div className="txd__pair">{items.slice(0, 2)}</div>;
}

function Panel({
  id,
  title,
  meta,
  open,
  onToggle,
  children,
}: {
  id: SectionId;
  title: string;
  meta?: string;
  open: boolean;
  onToggle: (id: SectionId) => void;
  children: ReactNode;
}) {
  return (
    <section className="txd__panel">
      <button
        type="button"
        className="txd__panel-head"
        aria-expanded={open}
        onClick={() => onToggle(id)}
      >
        <span className="txd__panel-title">{title}</span>
        {meta ? <span className="txd__panel-meta">{meta}</span> : null}
        <Chevron open={open} />
      </button>
      <div className={`txd__panel-body${open ? " is-open" : ""}`}>
        <div className="txd__panel-body-inner">
          <div className="txd__grid">{children}</div>
        </div>
      </div>
    </section>
  );
}

function formatCardDisplay(cardNumber: string | null | undefined, localeFa: boolean) {
  const digits = String(cardNumber || "").replace(/\D/g, "");
  if (!digits) return null;
  if (localeFa) return formatCardNumberFa(digits);
  return digits.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
}

export function ShopTransactionDetailPage() {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const { haptic } = useTelegram();
  const { notify } = useNotification();
  const { id } = useParams<{ id: string }>();
  const [tx, setTx] = useState<ShopTransaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<Record<SectionId, boolean>>({
    ids: true,
    payer: false,
    payment: false,
    links: false,
  });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!id) {
        setError(t("common.error"));
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const data = await fetchShopTransaction(id);
        if (cancelled) return;
        setTx(data.transaction);
      } catch (err) {
        if (cancelled) return;
        setTx(null);
        setError(err instanceof Error ? err.message : t("common.error"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, t]);

  const copy = async (value: string) => {
    haptic("light");
    try {
      await navigator.clipboard.writeText(value);
      notify(t("common.copied"), "success");
    } catch {
      notify(t("common.error"), "error");
    }
  };

  const toggle = (section: SectionId) => {
    haptic("light");
    setOpen((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const tone = tx ? heroTone(tx.status) : "neutral";
  const code = tx?.invoiceCode || tx?.chargeCode || tx?.id || "";
  const paid = tx?.status === "completed";
  const toman = t("wallet.toman");
  const sourceLabel =
    tx?.source === "api" ? t("myShop.txTabApi") : t("myShop.txTabManual");
  const SourceIcon = tx?.source === "api" ? ApiIcon : Invoice04Icon;
  const cardDisplay = useMemo(
    () =>
      formatCardDisplay(
        tx?.cardNumber || tx?.cardLast4 || null,
        locale === "fa" || locale === "ar",
      ),
    [tx?.cardNumber, tx?.cardLast4, locale],
  );
  const cardDigits = String(tx?.cardNumber || "").replace(/\D/g, "");
  const hasLinks = Boolean(tx?.webUrl || tx?.miniAppUrl || tx?.callbackUrl);

  return (
    <div className="my-shop my-shop--sub my-shop--invoices-page">
      <div className="my-shop__invoices-sticky">
        <div className="shop-rise" style={{ "--rise-index": 0 } as CSSProperties}>
          <PageHeader
            title={t("myShop.txDetailTitle")}
            onBack={() => navigate("/shop/transactions")}
          />
        </div>
      </div>

      <div className="my-shop__body my-shop__body--invoices">
        {loading ? (
          <div className="txd" aria-busy aria-label={t("common.loading")}>
            <div className="txd__skel txd__skel--hero" />
            <div className="txd__skel txd__skel--money" />
            <div className="txd__skel txd__skel--card" />
            <div className="txd__skel txd__skel--card" />
            <div className="txd__skel txd__skel--card" />
          </div>
        ) : error || !tx ? (
          <EmptyState
            title={error || t("myShop.txDetailNotFound")}
            compact
            action={
              <button
                type="button"
                className="wallet__balance-retry"
                onClick={() => {
                  haptic("light");
                  navigate("/shop/transactions");
                }}
              >
                {t("myShop.tileTransactions")}
              </button>
            }
          />
        ) : (
          <div className="txd">
            <section
              className={`txd__hero${
                tone === "neutral" ? "" : ` txd__hero--${tone}`
              } shop-rise`}
              style={{ "--rise-index": 1 } as CSSProperties}
            >
              <span className="txd__mark" aria-hidden>
                <StatusIcon status={tx.status} />
              </span>
              <p className="txd__kicker">{t("myShop.txDetailHeroKicker")}</p>
              <p className="txd__amount">
                {paid ? "+" : ""}
                {formatFaNumber(tx.amountToman)}
                <small>{toman}</small>
              </p>
              {tx.amountTrx != null && tx.amountTrx > 0 ? (
                <p className="txd__equiv">
                  {t("myShop.txTrxAtTime", {
                    amount: formatFaDecimal(tx.amountTrx, 2),
                  })}
                </p>
              ) : null}
              <div className="txd__chips">
                <span className={`my-shop__badge ${badgeClass(tx.status)}`}>
                  {statusLabel(tx.status, t)}
                </span>
                <span className="my-shop__badge my-shop__badge--info">
                  <SourceIcon size={11} color="currentColor" />
                  &nbsp;{sourceLabel}
                </span>
              </div>
              <button
                type="button"
                className="txd__code-btn"
                onClick={() => void copy(code)}
              >
                <span>{code}</span>
                <Copy01Icon size={12} color="currentColor" />
              </button>
            </section>

            <section
              className="txd__money shop-rise"
              style={{ "--rise-index": 2 } as CSSProperties}
            >
              <div className="txd__money-cell">
                <span className="txd__money-label">{t("myShop.merchantPayTxAmount")}</span>
                <span className="txd__money-value">
                  {formatFaNumber(tx.amountToman)}
                  <small>{toman}</small>
                </span>
              </div>
              <div className="txd__money-cell">
                <span className="txd__money-label">{t("myShop.merchantPayTxFee")}</span>
                <span className="txd__money-value">
                  {formatFaNumber(tx.feeToman)}
                  <small>{toman}</small>
                </span>
              </div>
              <div className="txd__money-cell txd__money-cell--accent">
                <span className="txd__money-label">{t("myShop.merchantPayTxTotal")}</span>
                <span className="txd__money-value">
                  {formatFaNumber(tx.totalToman > 0 ? tx.totalToman : tx.amountToman)}
                  <small>{toman}</small>
                </span>
              </div>
            </section>

            <div className="shop-rise" style={{ "--rise-index": 3 } as CSSProperties}>
              <Panel
                id="ids"
                title={t("myShop.txDetailSectionIds")}
                meta={tx.invoiceCode || undefined}
                open={open.ids}
                onToggle={toggle}
              >
                <Pair>
                  <Cell
                    label={t("myShop.merchantPayId")}
                    value={tx.invoiceCode}
                    mono
                    onCopy={
                      tx.invoiceCode ? () => void copy(tx.invoiceCode!) : undefined
                    }
                    copyLabel={t("common.copy")}
                  />
                  <Cell
                    label={t("myShop.txDetailChargeCode")}
                    value={tx.chargeCode}
                    mono
                    onCopy={
                      tx.chargeCode ? () => void copy(tx.chargeCode!) : undefined
                    }
                    copyLabel={t("common.copy")}
                  />
                </Pair>
                <Pair>
                  <Cell
                    label={t("myShop.txDetailTrackId")}
                    value={tx.trackId}
                    mono
                    onCopy={tx.trackId ? () => void copy(tx.trackId!) : undefined}
                    copyLabel={t("common.copy")}
                  />
                  <Cell
                    label={t("myShop.txDetailOrderId")}
                    value={tx.orderId}
                    mono
                    onCopy={tx.orderId ? () => void copy(tx.orderId!) : undefined}
                    copyLabel={t("common.copy")}
                  />
                </Pair>
                <Cell
                  label={t("myShop.txDetailPayToken")}
                  value={tx.payToken}
                  mono
                  wide
                  onCopy={tx.payToken ? () => void copy(tx.payToken!) : undefined}
                  copyLabel={t("common.copy")}
                />
                <Cell
                  label={t("myShop.txDetailGatewayOrder")}
                  value={tx.gatewayOrderId}
                  mono
                  wide
                />
                <Cell
                  label={t("myShop.paymentLinkTitle")}
                  value={
                    tx.title && tx.title !== tx.invoiceCode ? tx.title : null
                  }
                  wide
                />
              </Panel>
            </div>

            <div className="shop-rise" style={{ "--rise-index": 4 } as CSSProperties}>
              <Panel
                id="payer"
                title={t("myShop.txDetailSectionPayer")}
                meta={
                  tx.payerFullName ||
                  tx.payerLabel ||
                  (tx.payerUsername ? `@${tx.payerUsername}` : undefined)
                }
                open={open.payer}
                onToggle={toggle}
              >
                <Pair>
                  <Cell
                    label={t("myShop.txDetailPayer")}
                    value={tx.payerFullName || tx.payerLabel}
                  />
                  <Cell
                    label={t("myShop.txDetailPayerUsername")}
                    value={tx.payerUsername ? `@${tx.payerUsername}` : null}
                    mono
                  />
                </Pair>
                <Pair>
                  <Cell
                    label={t("myShop.txDetailPayerTelegram")}
                    value={tx.payerTelegramId}
                    mono
                    onCopy={
                      tx.payerTelegramId
                        ? () => void copy(tx.payerTelegramId!)
                        : undefined
                    }
                    copyLabel={t("common.copy")}
                  />
                  <Cell
                    label={t("myShop.txDetailPhone")}
                    value={tx.phone}
                    mono
                  />
                </Pair>
                <Cell
                  label={t("myShop.txDetailCard")}
                  value={
                    cardDisplay
                      ? tx.cardBankName
                        ? `${tx.cardBankName} · ${cardDisplay}`
                        : cardDisplay
                      : null
                  }
                  mono
                  wide
                  onCopy={cardDigits ? () => void copy(cardDigits) : undefined}
                  copyLabel={t("common.copy")}
                />
                <Cell
                  label={t("myShop.txDetailCardOwner")}
                  value={tx.cardOwnerName}
                  wide
                />
              </Panel>
            </div>

            <div className="shop-rise" style={{ "--rise-index": 5 } as CSSProperties}>
              <Panel
                id="payment"
                title={t("myShop.txDetailSectionPayment")}
                meta={tx.paidAt ? formatFaDate(tx.paidAt) : formatFaDate(tx.createdAt)}
                open={open.payment}
                onToggle={toggle}
              >
                <Pair>
                  <Cell label={t("myShop.txDetailSource")} value={sourceLabel} />
                  <Cell
                    label={t("myShop.txDetailGateway")}
                    value={tx.gatewayName}
                  />
                </Pair>
                <Pair>
                  <Cell
                    label={t("myShop.txDetailCommission")}
                    value={
                      tx.commissionPercent != null && tx.commissionPercent > 0
                        ? `${formatFaDecimal(tx.commissionPercent, 2)}٪`
                        : null
                    }
                  />
                  <Cell
                    label={t("myShop.txDetailTrxRate")}
                    value={
                      tx.trxRateToman != null && tx.trxRateToman > 0
                        ? `${formatFaNumber(Math.round(tx.trxRateToman))} ${toman}`
                        : null
                    }
                  />
                </Pair>
                <Pair>
                  <Cell
                    label={t("myShop.storeCreatedAt")}
                    value={formatFaDate(tx.createdAt)}
                  />
                  <Cell
                    label={t("myShop.txDetailPaidAt")}
                    value={tx.paidAt ? formatFaDate(tx.paidAt) : null}
                  />
                </Pair>
                <Pair>
                  <Cell
                    label={t("myShop.txDetailExpiresAt")}
                    value={tx.expiresAt ? formatFaDate(tx.expiresAt) : null}
                  />
                  <Cell
                    label={t("myShop.txDetailChargeAt")}
                    value={
                      tx.chargeCreatedAt
                        ? formatFaDate(tx.chargeCreatedAt)
                        : null
                    }
                  />
                </Pair>
              </Panel>
            </div>

            {hasLinks ? (
              <div
                className="shop-rise"
                style={{ "--rise-index": 6 } as CSSProperties}
              >
                <Panel
                  id="links"
                  title={t("myShop.txDetailSectionLinks")}
                  open={open.links}
                  onToggle={toggle}
                >
                  <Cell
                    label={t("myShop.txDetailWebUrl")}
                    value={tx.webUrl}
                    mono
                    muted
                    wide
                    onCopy={tx.webUrl ? () => void copy(tx.webUrl!) : undefined}
                    copyLabel={t("common.copy")}
                  />
                  <Cell
                    label={t("myShop.txDetailMiniAppUrl")}
                    value={tx.miniAppUrl}
                    mono
                    muted
                    wide
                    onCopy={
                      tx.miniAppUrl ? () => void copy(tx.miniAppUrl!) : undefined
                    }
                    copyLabel={t("common.copy")}
                  />
                  <Cell
                    label={t("myShop.txDetailCallback")}
                    value={tx.callbackUrl}
                    mono
                    muted
                    wide
                    onCopy={
                      tx.callbackUrl
                        ? () => void copy(tx.callbackUrl!)
                        : undefined
                    }
                    copyLabel={t("common.copy")}
                  />
                </Panel>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
