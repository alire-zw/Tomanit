import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { EmptyState } from "../../components/EmptyState";
import { PageHeader } from "../../components/PageHeader";
import { ShopTransactionRow } from "../../components/shop/ShopTransactionRow";
import SearchIcon from "../../components/icons/SearchIcon";
import ApiIcon from "../../components/icons/hugeicons/ApiIcon";
import ChatCancelIcon from "../../components/icons/hugeicons/ChatCancelIcon";
import ChatDelay01Icon from "../../components/icons/hugeicons/ChatDelay01Icon";
import ChatDone01Icon from "../../components/icons/hugeicons/ChatDone01Icon";
import ChatIcon from "../../components/icons/hugeicons/ChatIcon";
import Invoice04Icon from "../../components/icons/hugeicons/Invoice04Icon";
import Unlink01Icon from "../../components/icons/hugeicons/Unlink01Icon";
import { useI18n } from "../../context/I18nContext";
import { useTelegram } from "../../hooks/useTelegram";
import {
  fetchShopTransactions,
  type ShopTransaction,
  type ShopTxStatus,
} from "../../lib/shop";
import "../../styles/shop-rise.css";
import "../Wallet.css";
import "../MyShop.css";

type TabId =
  | "all"
  | "api"
  | "manual"
  | "paid"
  | "unpaid"
  | "pending"
  | "expired";

function matchesTab(tx: ShopTransaction, tab: TabId): boolean {
  if (tab === "all") return true;
  if (tab === "api") return tx.source === "api";
  if (tab === "manual") return (tx.source ?? "manual") === "manual";
  if (tab === "paid") return tx.status === "completed" || tx.linkStatus === "paid";
  if (tab === "pending") return tx.status === "pending" || tx.linkStatus === "open";
  if (tab === "expired") return tx.status === "expired" || tx.linkStatus === "expired";
  return tx.status === "unpaid" || tx.linkStatus === "cancelled" || tx.status === "failed";
}

function normalizeQuery(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

function matchesQuery(tx: ShopTransaction, rawQuery: string): boolean {
  const q = normalizeQuery(rawQuery);
  if (!q) return true;

  const haystack = [
    tx.invoiceCode,
    tx.chargeCode,
    tx.payToken,
    tx.trackId,
    tx.orderId,
    tx.gatewayOrderId,
    tx.title,
    tx.payerLabel,
    tx.payerUsername,
    tx.payerFullName,
    tx.payerTelegramId,
    tx.phone,
    tx.cardNumber,
    tx.cardLast4,
    String(tx.amountToman || ""),
    String(tx.totalToman || ""),
  ]
    .filter(Boolean)
    .map((v) => normalizeQuery(String(v)));

  return haystack.some((item) => item.includes(q));
}

function TabIcon({ id }: { id: TabId }) {
  const props = { size: 14, color: "currentColor" as const };
  if (id === "api") return <ApiIcon {...props} />;
  if (id === "manual") return <Invoice04Icon {...props} />;
  if (id === "paid") return <ChatDone01Icon {...props} />;
  if (id === "unpaid") return <ChatCancelIcon {...props} />;
  if (id === "pending") return <ChatDelay01Icon {...props} />;
  if (id === "expired") return <Unlink01Icon {...props} />;
  return <ChatIcon {...props} />;
}

export function ShopTransactionsPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { haptic } = useTelegram();
  const [txs, setTxs] = useState<ShopTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [tab, setTab] = useState<TabId>("all");
  const [query, setQuery] = useState("");

  const tabs: Array<{ id: TabId; label: string }> = [
    { id: "all", label: t("myShop.invoiceTabAll") },
    { id: "api", label: t("myShop.txTabApi") },
    { id: "manual", label: t("myShop.txTabManual") },
    { id: "paid", label: t("myShop.txTabPaid") },
    { id: "unpaid", label: t("myShop.txTabUnpaid") },
    { id: "pending", label: t("myShop.txTabPending") },
    { id: "expired", label: t("myShop.txTabExpired") },
  ];

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchShopTransactions();
        if (cancelled) return;
        setTxs(data.transactions ?? []);
      } catch (err) {
        if (cancelled) return;
        setTxs([]);
        setError(err instanceof Error ? err.message : t("common.error"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadTick, t]);

  const filtered = useMemo(
    () => txs.filter((tx) => matchesTab(tx, tab) && matchesQuery(tx, query)),
    [txs, tab, query],
  );

  const statusLabel = (status: ShopTxStatus) => {
    if (status === "completed") return t("myShop.txTabPaid");
    if (status === "pending") return t("myShop.txTabPending");
    if (status === "expired") return t("myShop.txTabExpired");
    if (status === "unpaid") return t("myShop.txTabUnpaid");
    return t("myShop.txFailed");
  };

  const sourceLabel = (tx: ShopTransaction) =>
    tx.source === "api" ? t("myShop.txTabApi") : t("myShop.txTabManual");

  const emptyTitle =
    txs.length === 0
      ? t("myShop.noTransactionsYet")
      : t("myShop.txFilterEmpty");

  const onSearch = (event: FormEvent) => {
    event.preventDefault();
  };

  return (
    <div className="my-shop my-shop--sub my-shop--invoices-page">
      <div className="my-shop__invoices-sticky">
        <div className="shop-rise" style={{ "--rise-index": 0 } as CSSProperties}>
          <PageHeader
            title={t("myShop.tileTransactions")}
            onBack={() => navigate("/shop")}
          />
        </div>

        <div
          className="my-shop__tabs my-shop__tabs--scroll shop-rise"
          style={{ "--rise-index": 1 } as CSSProperties}
        >
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`my-shop__tabs-btn${tab === item.id ? " my-shop__tabs-btn--active" : ""}`}
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

        <form
          className="my-shop__invoice-search shop-rise"
          style={{ "--rise-index": 2 } as CSSProperties}
          onSubmit={onSearch}
        >
          <SearchIcon width={15} height={15} color="var(--text-muted)" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("myShop.txSearchPh")}
            aria-label={t("myShop.txSearchPh")}
            inputMode="search"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />
        </form>
      </div>

      <div className="my-shop__body my-shop__body--invoices">
        {loading ? (
          <div
            className="wallet__transactions shop-rise"
            style={{ "--rise-index": 3 } as CSSProperties}
            aria-busy
            aria-label={t("common.loading")}
          >
            {Array.from({ length: 6 }, (_, index) => (
              <div
                key={index}
                className="wallet__transaction wallet__transaction--skeleton my-shop__tx-row--skeleton"
                aria-hidden
              >
                <div className="wallet__transaction-start">
                  <span className="wallet__transaction-skeleton-icon" />
                  <div className="wallet__transaction-info my-shop__tx-info">
                    <div className="my-shop__tx-title-row">
                      <span className="wallet__transaction-skeleton-title" />
                      <span className="my-shop__tx-skel-badge" />
                    </div>
                    <span className="wallet__transaction-skeleton-date" />
                  </div>
                </div>
                <span className="wallet__transaction-skeleton-amount" />
              </div>
            ))}
          </div>
        ) : error ? (
          <EmptyState
            title={error}
            compact
            action={
              <button
                type="button"
                className="wallet__balance-retry"
                onClick={() => {
                  haptic("light");
                  setReloadTick((n) => n + 1);
                }}
              >
                {t("common.retry")}
              </button>
            }
          />
        ) : filtered.length === 0 ? (
          <EmptyState title={emptyTitle} compact />
        ) : (
          <div
            className="wallet__transactions shop-rise"
            style={{ "--rise-index": 3 } as CSSProperties}
          >
            {filtered.map((tx) => (
              <ShopTransactionRow
                key={tx.id}
                tx={tx}
                tomanLabel={t("wallet.toman")}
                trxEquivLabel={(amount) => t("myShop.txTrxAtTime", { amount })}
                statusLabel={statusLabel}
                sourceLabel={sourceLabel(tx)}
                onClick={() => {
                  haptic("light");
                  navigate(`/shop/transactions/${tx.id}`);
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
