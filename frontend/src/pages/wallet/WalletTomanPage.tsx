import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { EmptyState } from "../../components/EmptyState";
import { useNotification } from "../../components/Notification";
import { PageHeader } from "../../components/PageHeader";
import { WalletTxDetailSheet } from "../../components/wallet/WalletTxDetailSheet";
import MoneyPending02Icon from "../../components/icons/money-pending-02-stroke-rounded";
import MoneyReceiveSquareIcon from "../../components/icons/MoneyReceiveSquareIcon";
import MoneyRemove02Icon from "../../components/icons/money-remove-02-stroke-rounded";
import MoneySendSquareIcon from "../../components/icons/MoneySendSquareIcon";
import Money03Icon from "../../components/icons/money-03-stroke-rounded";
import SwapIcon from "../../components/icons/SwapIcon";
import { useI18n } from "../../context/I18nContext";
import { useAuth } from "../../hooks/useAuth";
import { useTelegram } from "../../hooks/useTelegram";
import { apiFetch, type WalletTransaction } from "../../lib/api";
import { formatFaDate, formatFaDecimal, formatFaNumber } from "../../lib/format";
import { getWalletAssetDef } from "../../lib/walletAssetsCatalog";
import {
  readCachedWalletRates,
  writeCachedWalletRates,
} from "../../lib/walletRatesCache";
import { getWalletAssetBalance } from "../../lib/walletUi";
import "../../styles/shop-rise.css";
import "./WalletAsset.css";
import "./WalletTomanPage.css";

type TomanActionId = "deposit" | "withdraw" | "convert";

const RATES_POLL_MS = 10_000;
const asset = getWalletAssetDef("toman")!;

function AssetTxIcon({ tx }: { tx: WalletTransaction }) {
  const props = { width: 16, height: 16 };
  if (tx.status === "pending") return <MoneyPending02Icon {...props} />;
  if (tx.status === "failed") return <MoneyRemove02Icon {...props} />;
  if (tx.type === "withdraw" || tx.type === "invoice" || tx.type === "fee") {
    return <MoneySendSquareIcon {...props} />;
  }
  if (tx.type === "convert") return <SwapIcon {...props} />;
  if (tx.type === "deposit" || tx.type === "recharge" || tx.type === "refund") {
    return <MoneyReceiveSquareIcon {...props} />;
  }
  return <Money03Icon {...props} />;
}

function assetTxIconClass(tx: WalletTransaction): string {
  if (tx.status === "pending") return "coin-page__tx-icon coin-page__tx-icon--pending";
  if (tx.status === "failed") return "coin-page__tx-icon coin-page__tx-icon--failed";
  if (tx.type === "withdraw" || tx.type === "invoice" || tx.type === "fee") {
    return "coin-page__tx-icon coin-page__tx-icon--out";
  }
  if (tx.type === "deposit" || tx.type === "recharge" || tx.type === "refund") {
    return "coin-page__tx-icon coin-page__tx-icon--in";
  }
  if (tx.type === "convert") return "coin-page__tx-icon coin-page__tx-icon--convert";
  return "coin-page__tx-icon";
}

function formatTomanTxAmount(tx: WalletTransaction): {
  value: string;
  tone: "in" | "out" | "muted";
} {
  const abs = formatFaNumber(Math.abs(Math.round(tx.amount)));
  if (tx.status === "pending" || tx.status === "failed") {
    return { value: abs, tone: "muted" };
  }
  if (
    tx.type === "withdraw" ||
    tx.type === "invoice" ||
    tx.type === "fee" ||
    tx.amount < 0
  ) {
    return { value: `-${abs}`, tone: "out" };
  }
  if (
    tx.type === "deposit" ||
    tx.type === "recharge" ||
    tx.type === "refund" ||
    tx.amount > 0
  ) {
    return { value: `+${abs}`, tone: "in" };
  }
  return { value: abs, tone: "muted" };
}

export function WalletTomanPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { haptic } = useTelegram();
  const { notify } = useNotification();
  const { wallet } = useAuth();

  const balance = getWalletAssetBalance(wallet, "toman");
  const [usdtRate, setUsdtRate] = useState<number | null>(() => {
    const cached = readCachedWalletRates()?.rates?.usdt;
    return typeof cached === "number" && cached > 0 ? cached : null;
  });
  const [assetTxs, setAssetTxs] = useState<WalletTransaction[]>([]);
  const [txsFetched, setTxsFetched] = useState(false);
  const [txsError, setTxsError] = useState<string | null>(null);
  const [txSheetOpen, setTxSheetOpen] = useState(false);
  const [selectedTx, setSelectedTx] = useState<WalletTransaction | null>(null);

  const usdtEquiv = useMemo(() => {
    if (!(typeof usdtRate === "number" && usdtRate > 0)) return null;
    return balance / usdtRate;
  }, [balance, usdtRate]);

  const loadRates = useCallback(async () => {
    try {
      const data = await apiFetch<{
        source: string;
        rates: Partial<Record<string, number>>;
      }>("/wallet/rates");
      const value = Number(data.rates?.usdt);
      if (!(data.source === "swapwallet" && value > 0)) return;
      setUsdtRate(value);
      const cached = readCachedWalletRates();
      writeCachedWalletRates(
        { ...(cached?.rates ?? {}), usdt: value, toman: 1 },
        cached?.changes ?? {},
      );
    } catch {
      // keep last known rate
    }
  }, []);

  useEffect(() => {
    void loadRates();
    const timer = window.setInterval(() => void loadRates(), RATES_POLL_MS);
    return () => window.clearInterval(timer);
  }, [loadRates]);

  const loadAssetTxs = useCallback(async () => {
    setTxsError(null);
    try {
      const data = await apiFetch<{ transactions: WalletTransaction[] }>(
        "/wallet/transactions?asset=toman&limit=50",
      );
      setAssetTxs(data.transactions ?? []);
      setTxsFetched(true);
    } catch (err) {
      setTxsError(err instanceof Error ? err.message : t("wallet.loadError"));
      setTxsFetched(true);
    }
  }, [t]);

  useEffect(() => {
    void loadAssetTxs();
  }, [loadAssetTxs, balance]);

  const onAction = (actionId: TomanActionId) => {
    haptic("light");
    if (actionId === "deposit") {
      navigate("/wallet/deposit/toman", { state: { from: "asset" } });
      return;
    }
    notify(t("wallet.soon", { label: t(`wallet.${actionId}`) }), "info");
  };

  const actions: Array<{
    id: TomanActionId;
    labelKey: string;
    icon: ReactNode;
    primary?: boolean;
  }> = [
    {
      id: "deposit",
      labelKey: "wallet.deposit",
      icon: <MoneyReceiveSquareIcon width={22} height={22} />,
    },
    {
      id: "withdraw",
      labelKey: "wallet.withdraw",
      icon: <MoneySendSquareIcon width={22} height={22} />,
    },
    {
      id: "convert",
      labelKey: "wallet.convert",
      primary: true,
      icon: <SwapIcon width={22} height={22} />,
    },
  ];

  return (
    <div className="coin-page toman-page">
      <div className="coin-page__header">
        <PageHeader title={t(asset.titleKey)} onBack={() => navigate("/")} />
      </div>

      <section
        className="coin-page__charts toman-page__top shop-rise"
        style={{ "--rise-index": 1 } as CSSProperties}
      >
        <header className="coin-page__charts-header">
          <div className="coin-page__charts-numbers">
            <p className="coin-page__charts-title">
              {asset.symbol} • {t(asset.titleKey)}
            </p>
            <p className="coin-page__charts-price">
              <span className="coin-page__charts-price-value">
                {formatFaNumber(balance)}
              </span>
              <span className="coin-page__charts-price-unit">
                {t("wallet.toman")}
              </span>
            </p>
            <div className="coin-page__charts-date">
              <p>
                {usdtEquiv != null
                  ? t("wallet.tomanUsdtEquiv", {
                      amount: formatFaDecimal(usdtEquiv, 2),
                    })
                  : "—"}
              </p>
            </div>
          </div>
          <img
            className="coin-page__charts-icon"
            src={asset.logo}
            alt=""
            width={44}
            height={44}
            decoding="async"
          />
        </header>
      </section>

      <h5
        className="coin-page__menu-title shop-rise"
        style={{ "--rise-index": 2 } as CSSProperties}
      >
        {t("wallet.yourAssets")}
      </h5>
      <div
        className="coin-page__menu-box shop-rise"
        style={{ "--rise-index": 3 } as CSSProperties}
        aria-label={t("wallet.yourAssets")}
      >
        <div className="coin-page__holding-row toman-page__holding-row">
          <img
            className="coin-page__holding-logo"
            src={asset.logo}
            alt=""
            width={32}
            height={32}
            decoding="async"
          />
          <div className="coin-page__holding-info">
            <div className="coin-page__holding-title">{t(asset.titleKey)}</div>
            <div className="coin-page__holding-sub">
              {usdtEquiv != null ? (
                <span className="coin-page__holding-sub-qty">
                  {t("wallet.tomanUsdtEquiv", {
                    amount: formatFaDecimal(usdtEquiv, 2),
                  })}
                </span>
              ) : (
                <span className="coin-page__holding-sub-qty">
                  {t("wallet.rialBalance")}
                </span>
              )}
            </div>
          </div>
          <div className="coin-page__holding-value">
            <span className="coin-page__holding-amount-main">
              {formatFaNumber(balance)} {t("wallet.toman")}
            </span>
          </div>
        </div>
      </div>

      <h5
        className="coin-page__menu-title shop-rise"
        style={{ "--rise-index": 4 } as CSSProperties}
      >
        {t("wallet.transactions")}
      </h5>
      <div
        className="coin-page__txs shop-rise"
        style={{ "--rise-index": 5 } as CSSProperties}
        role="list"
        aria-label={t("wallet.transactions")}
      >
        {txsError ? (
          <EmptyState
            title={txsError}
            action={
              <button
                type="button"
                className="coin-page__tx-retry"
                onClick={() => {
                  haptic("light");
                  void loadAssetTxs();
                }}
              >
                {t("common.retry")}
              </button>
            }
          />
        ) : !txsFetched ? (
          [0, 1, 2].map((index) => (
            <div
              key={index}
              className="coin-page__tx coin-page__tx--skeleton"
              aria-hidden
            >
              <div className="coin-page__tx-start">
                <span className="coin-page__tx-skeleton-icon" />
                <div className="coin-page__tx-info">
                  <span className="coin-page__tx-skeleton-title" />
                  <span className="coin-page__tx-skeleton-date" />
                </div>
              </div>
              <span className="coin-page__tx-skeleton-amount" />
            </div>
          ))
        ) : assetTxs.length === 0 ? (
          <EmptyState title={t("wallet.emptyHistory")} />
        ) : (
          assetTxs.map((tx) => {
            const amount = formatTomanTxAmount(tx);
            const shopName =
              tx.type === "invoice"
                ? (tx.shopName || tx.note || "").trim()
                : "";
            const shopLogo =
              tx.type === "invoice" ? tx.shopLogoDataUrl?.trim() || null : null;
            const title =
              shopName ||
              (() => {
                const key = `tx.${tx.type}`;
                const label = t(key);
                return label === key ? tx.type : label;
              })();
            return (
              <button
                key={tx.id}
                type="button"
                className="coin-page__tx coin-page__tx--clickable"
                role="listitem"
                onClick={() => {
                  haptic("light");
                  setSelectedTx(tx);
                  setTxSheetOpen(true);
                }}
              >
                <div className="coin-page__tx-start">
                  {shopName ? (
                    <span className="coin-page__tx-shop-wrap" aria-hidden>
                      {shopLogo ? (
                        <img
                          className="coin-page__tx-shop-logo"
                          src={shopLogo}
                          alt=""
                          width={30}
                          height={30}
                          decoding="async"
                        />
                      ) : (
                        <span className="coin-page__tx-shop-fallback">
                          {shopName.slice(0, 1)}
                        </span>
                      )}
                      <span
                        className={`${assetTxIconClass(tx)} coin-page__tx-shop-badge`}
                      >
                        <AssetTxIcon tx={tx} />
                      </span>
                    </span>
                  ) : (
                    <span className={assetTxIconClass(tx)}>
                      <AssetTxIcon tx={tx} />
                    </span>
                  )}
                  <div className="coin-page__tx-info">
                    <div className="coin-page__tx-title">{title}</div>
                    <div className="coin-page__tx-date">
                      {formatFaDate(tx.createdAt)}
                    </div>
                  </div>
                </div>
                <span
                  className={`coin-page__tx-value-col coin-page__tx-value-col--${amount.tone}`}
                >
                  <span className="coin-page__tx-amount-main" dir="ltr">
                    <span className="coin-page__tx-amount-unit">
                      {t("wallet.toman")}
                    </span>
                    <span className="coin-page__tx-amount-qty">{amount.value}</span>
                  </span>
                </span>
              </button>
            );
          })
        )}
      </div>

      <WalletTxDetailSheet
        open={txSheetOpen}
        transaction={selectedTx}
        onClose={() => setTxSheetOpen(false)}
      />

      <nav
        className="coin-page__nav shop-rise"
        style={{ "--rise-index": 6 } as CSSProperties}
        aria-label={t("wallet.actions")}
      >
        <div className="coin-page__nav-inner">
          {actions.map((action) => (
            <button
              key={action.id}
              type="button"
              className={`coin-page__nav-item${
                action.primary ? " coin-page__nav-item--primary" : ""
              }`}
              onClick={() => onAction(action.id)}
            >
              <span className="coin-page__nav-box">{action.icon}</span>
              <span className="coin-page__nav-label">{t(action.labelKey)}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
