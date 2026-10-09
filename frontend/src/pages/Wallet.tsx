import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { BottomSheet } from "../components/BottomSheet";
import { EmptyState } from "../components/EmptyState";
import { useNotification } from "../components/Notification";
import { WalletTxDetailSheet } from "../components/wallet/WalletTxDetailSheet";
import BitcoinCircleIcon from "../components/icons/bitcoin-circle-stroke-rounded";
import DepositCryptoIcon from "../components/icons/DepositCryptoIcon";
import MoneyPending02Icon from "../components/icons/money-pending-02-stroke-rounded";
import MoneyReceiveSquareIcon from "../components/icons/MoneyReceiveSquareIcon";
import MoneyRemove02Icon from "../components/icons/money-remove-02-stroke-rounded";
import MoneySendSquareIcon from "../components/icons/MoneySendSquareIcon";
import Money03Icon from "../components/icons/money-03-stroke-rounded";
import RiyalIcon from "../components/icons/riyal-stroke-rounded";
import SwapIcon from "../components/icons/SwapIcon";
import { useI18n } from "../context/I18nContext";
import { useAuth } from "../hooks/useAuth";
import { useTelegram } from "../hooks/useTelegram";
import { apiFetch, type WalletAssetId, type WalletTransaction } from "../lib/api";
import {
  getRandomCardPattern,
  getWalletHeroBackgroundStyle,
  preloadCardPatterns,
  type CardPatternUrl,
} from "../lib/cardPatterns";
import { formatChangePercentParts, formatFaDate, formatFaDecimal, formatFaNumber } from "../lib/format";
import { getWalletAssetDef, WALLET_ASSETS } from "../lib/walletAssetsCatalog";
import { getWalletAssetBalance } from "../lib/walletUi";
import {
  readCachedWalletRates,
  writeCachedWalletRates,
} from "../lib/walletRatesCache";
import { prefetchWalletCharts } from "../lib/prefetchWalletCharts";
import "../styles/shop-rise.css";
import "./Wallet.css";

type WalletTab = "assets" | "history";

type RatesMap = Partial<Record<WalletAssetId, number>>;
type ChangesMap = Partial<Record<Exclude<WalletAssetId, "toman">, number>>;
const RATES_POLL_MS = 10_000;

function DepositTypeChevron({ flip }: { flip?: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={14}
      height={14}
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden
      style={flip ? { transform: "scaleX(-1)" } : undefined}
    >
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
        d="m15 18-6-6 6-6"
      />
    </svg>
  );
}


function TransactionBadgeIcon({ tx }: { tx: WalletTransaction }) {
  const props = { width: 10, height: 10 };
  if (tx.status === "pending") return <MoneyPending02Icon {...props} />;
  if (tx.status === "failed") return <MoneyRemove02Icon {...props} />;
  if (tx.type === "withdraw" || tx.type === "invoice") return <MoneySendSquareIcon {...props} />;
  if (tx.type === "convert") return <SwapIcon {...props} />;
  if (tx.type === "deposit" || tx.type === "recharge") return <MoneyReceiveSquareIcon {...props} />;
  return <Money03Icon {...props} />;
}

function getAmountClass(tx: WalletTransaction): string {
  if (tx.status === "pending") return "wallet__transaction-amount--pending";
  if (tx.status === "failed") return "wallet__transaction-amount--failed";
  if (tx.type === "withdraw" || tx.type === "invoice") return "wallet__transaction-amount--transfer-out";
  if (tx.type === "deposit" || tx.type === "recharge") return "wallet__transaction-amount--positive";
  return "";
}

function getBadgeClass(tx: WalletTransaction): string {
  if (tx.status === "pending") return "wallet__transaction-badge wallet__transaction-badge--pending";
  if (tx.status === "failed") return "wallet__transaction-badge wallet__transaction-badge--failed";
  if (tx.type === "withdraw" || tx.type === "invoice") {
    return "wallet__transaction-badge wallet__transaction-badge--out";
  }
  if (tx.type === "deposit" || tx.type === "recharge") {
    return "wallet__transaction-badge wallet__transaction-badge--in";
  }
  if (tx.type === "convert") {
    return "wallet__transaction-badge wallet__transaction-badge--convert";
  }
  return "wallet__transaction-badge";
}

function txAssetLogo(asset: string): string {
  const key = asset.toLowerCase() === "irr" ? "toman" : asset.toLowerCase();
  return getWalletAssetDef(key)?.logo ?? "/coins/TOMAN.png";
}

function formatTxAmount(tx: WalletTransaction): string {
  const value = Math.abs(tx.amount);
  const formatted =
    tx.asset.toLowerCase() === "toman" || tx.asset.toLowerCase() === "irr"
      ? formatFaNumber(value)
      : formatFaDecimal(value, 2);
  if (tx.status === "failed") return formatted;
  if (tx.type === "withdraw" || tx.type === "invoice") return `-${formatted}`;
  if (tx.type === "deposit" || tx.type === "recharge") return `+${formatted}`;
  return formatted;
}

function isTomanAsset(asset: string): boolean {
  const a = asset.toLowerCase();
  return a === "toman" || a === "irr";
}

function isUsdtAsset(asset: string): boolean {
  return asset.toLowerCase() === "usdt";
}

/** Prefer snapshot USDT/IRT stored at tx time; fall back to live rate. */
function usdtRateAtTx(tx: WalletTransaction, liveUsdtRate: number | null): number | null {
  if (tx.type !== "convert") {
    if (typeof tx.counterUnitPriceToman === "number" && tx.counterUnitPriceToman > 0) {
      return tx.counterUnitPriceToman;
    }
  }
  if (isUsdtAsset(tx.asset) && typeof tx.unitPriceToman === "number" && tx.unitPriceToman > 0) {
    return tx.unitPriceToman;
  }
  if (
    tx.type === "convert" &&
    tx.counterAsset &&
    isUsdtAsset(tx.counterAsset) &&
    typeof tx.counterUnitPriceToman === "number" &&
    tx.counterUnitPriceToman > 0
  ) {
    return tx.counterUnitPriceToman;
  }
  if (typeof liveUsdtRate === "number" && liveUsdtRate > 0) return liveUsdtRate;
  return null;
}

function txTomanValue(tx: WalletTransaction): number | null {
  if (typeof tx.amountToman === "number" && Number.isFinite(tx.amountToman) && tx.amountToman > 0) {
    return Math.abs(tx.amountToman);
  }
  if (
    typeof tx.unitPriceToman === "number" &&
    tx.unitPriceToman > 0 &&
    Number.isFinite(tx.amount)
  ) {
    return Math.abs(tx.amount * tx.unitPriceToman);
  }
  if (isTomanAsset(tx.asset) && Number.isFinite(tx.amount)) {
    return Math.abs(tx.amount);
  }
  return null;
}

/**
 * Sub-line at tx-time:
 * - crypto → toman equivalent (from unitPriceToman / amountToman)
 * - toman → USDT equivalent (from counterUnitPriceToman USDT/IRT snapshot)
 */
function formatTxEquiv(
  tx: WalletTransaction,
  liveUsdtRate: number | null,
  t: (key: string, vars?: Record<string, string | number>) => string,
): string | null {
  if (isTomanAsset(tx.asset)) {
    const usdtRate = usdtRateAtTx(tx, liveUsdtRate);
    if (usdtRate == null) return null;
    const toman = txTomanValue(tx);
    if (toman == null) return null;
    return t("wallet.txUsdtAtTime", {
      amount: formatFaDecimal(toman / usdtRate, 2),
    });
  }

  const toman = txTomanValue(tx);
  if (toman == null) return null;
  return t("wallet.txTomanAtTime", {
    amount: formatFaNumber(Math.round(toman)),
  });
}

export function WalletPage() {
  const { t, isRTL } = useI18n();
  const navigate = useNavigate();
  const { wallet, loading: authLoading, isAuthenticated } = useAuth();
  const { notify } = useNotification();
  const { haptic } = useTelegram();
  const [txs, setTxs] = useState<WalletTransaction[]>([]);
  const [hasFetched, setHasFetched] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);
  const [heroPattern] = useState<CardPatternUrl>(() => getRandomCardPattern());
  const [activeTab, setActiveTab] = useState<WalletTab>("assets");
  const [depositSheetOpen, setDepositSheetOpen] = useState(false);
  const [withdrawSheetOpen, setWithdrawSheetOpen] = useState(false);
  const [txSheetOpen, setTxSheetOpen] = useState(false);
  const [selectedTx, setSelectedTx] = useState<WalletTransaction | null>(null);
  const [rates, setRates] = useState<RatesMap>(() => readCachedWalletRates()?.rates ?? {});
  const [changes, setChanges] = useState<ChangesMap>(
    () => readCachedWalletRates()?.changes ?? {},
  );
  const [ratesReady, setRatesReady] = useState(() => Boolean(readCachedWalletRates()));
  const [ratesError, setRatesError] = useState<string | null>(null);
  const ratesReadyRef = useRef(Boolean(readCachedWalletRates()));

  // Keep balance visible while auth revalidates in the background.
  const loading = authLoading && !wallet;

  const rateFor = (id: WalletAssetId): number | null => {
    if (id === "toman") return 1;
    const value = rates[id];
    return typeof value === "number" && value > 0 ? value : null;
  };

  const changeFor = (id: WalletAssetId): number | null => {
    if (id === "toman") return null;
    const value = changes[id];
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  };

  const assetUnit = (asset: string): string => {
    const a = asset.toUpperCase();
    if (a === "TOMAN" || a === "IRR") return t("wallet.toman");
    if (a === "TRX" || a === "TRON") return t("wallet.tron");
    if (a === "USDT") return t("wallet.tether");
    if (a === "BNB") return t("wallet.binance");
    if (a === "MATIC" || a === "POL") return t("wallet.polygon");
    if (a === "GRAM" || a === "TON") return t("wallet.gram");
    return a;
  };

  const txTypeLabel = (type: string): string => {
    const key = `tx.${type}`;
    const label = t(key);
    return label === key ? type : label;
  };

  const assetBalance = (id: WalletAssetId): number => getWalletAssetBalance(wallet, id);

  const assetValueToman = useCallback(
    (id: WalletAssetId): number => {
      const balance = getWalletAssetBalance(wallet, id);
      if (!(balance > 0)) return 0;
      if (id === "toman") return balance;
      const rate = rates[id];
      return typeof rate === "number" && rate > 0 ? balance * rate : 0;
    },
    [wallet, rates],
  );

  /** Total portfolio in toman (fiat + crypto equivalents). */
  const totalToman = useMemo(() => {
    let sum = 0;
    for (const asset of WALLET_ASSETS) {
      sum += assetValueToman(asset.id);
    }
    return Math.round(sum);
  }, [assetValueToman]);

  /** Approximate USD via USDT/IRT rate. */
  const totalUsd = useMemo(() => {
    const usdtRate = rates.usdt;
    if (!(typeof usdtRate === "number" && usdtRate > 0)) return null;
    return totalToman / usdtRate;
  }, [totalToman, rates.usdt]);

  /** Highest toman value first; catalog order as tie-breaker. */
  const sortedAssets = useMemo(() => {
    return [...WALLET_ASSETS].sort((a, b) => {
      const diff = assetValueToman(b.id) - assetValueToman(a.id);
      if (diff !== 0) return diff;
      return (
        WALLET_ASSETS.findIndex((item) => item.id === a.id) -
        WALLET_ASSETS.findIndex((item) => item.id === b.id)
      );
    });
  }, [assetValueToman]);

  const loadTxs = useCallback(async () => {
    setTxError(null);
    try {
      const data = await apiFetch<{ transactions: WalletTransaction[] }>("/wallet/transactions");
      setTxs(data.transactions);
    } catch (err) {
      setTxs([]);
      setTxError(err instanceof Error ? err.message : t("wallet.loadError"));
    } finally {
      setHasFetched(true);
    }
    // Intentionally omit `t` — avoid refetch on every i18n identity change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadRates = useCallback(async () => {
    try {
      const data = await apiFetch<{
        rates: RatesMap;
        changes?: ChangesMap;
        source: string;
      }>("/wallet/rates");
      if (data.source !== "swapwallet" || !data.rates) {
        throw new Error("rates unavailable");
      }
      const next: RatesMap = { toman: 1 };
      const nextChanges: ChangesMap = {};
      for (const id of ["trx", "usdt", "bnb", "matic", "gram"] as const) {
        const value = Number(data.rates[id]);
        if (!(value > 0)) {
          throw new Error("rates unavailable");
        }
        next[id] = value;
        const ch = Number(data.changes?.[id]);
        nextChanges[id] = Number.isFinite(ch) ? ch : 0;
      }
      setRates(next);
      setChanges(nextChanges);
      writeCachedWalletRates(next, nextChanges);
      const firstReady = !ratesReadyRef.current;
      ratesReadyRef.current = true;
      setRatesReady(true);
      setRatesError(null);
      // Charts: warm once after first successful rates — not every 10s poll.
      if (firstReady) void prefetchWalletCharts();
    } catch (err) {
      // Keep last Redis/local cached numbers — never wipe UI with a loading label.
      if (!ratesReadyRef.current) {
        const message = err instanceof Error ? err.message : "rates unavailable";
        setRatesError(message);
        setRatesReady(false);
      }
    }
  }, []);

  useEffect(() => {
    preloadCardPatterns();
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    void loadTxs();
  }, [isAuthenticated, loadTxs]);

  useEffect(() => {
    if (!isAuthenticated) return;
    void loadRates();
    const timer = window.setInterval(() => {
      void loadRates();
    }, RATES_POLL_MS);
    return () => window.clearInterval(timer);
  }, [isAuthenticated, loadRates]);

  const onAction = (label: string) => {
    haptic("light");
    notify(t("wallet.soon", { label }), "info");
  };

  const openDepositSheet = () => {
    haptic("light");
    setDepositSheetOpen(true);
  };

  const closeDepositSheet = () => setDepositSheetOpen(false);

  const openWithdrawSheet = () => {
    haptic("light");
    setWithdrawSheetOpen(true);
  };

  const closeWithdrawSheet = () => setWithdrawSheetOpen(false);

  const onDepositType = (type: "crypto" | "toman") => {
    haptic("light");
    setDepositSheetOpen(false);
    if (type === "crypto") {
      navigate("/wallet/deposit");
      return;
    }
    navigate("/wallet/deposit/toman");
  };

  const onWithdrawType = (type: "crypto" | "toman") => {
    haptic("light");
    setWithdrawSheetOpen(false);
    if (type === "crypto") {
      navigate("/wallet/withdraw");
      return;
    }
    notify(t("wallet.soon", { label: t("wallet.withdrawToman") }), "info");
  };

  const onTabChange = (tab: WalletTab) => {
    if (tab === activeTab) return;
    haptic("light");
    setActiveTab(tab);
  };

  const openAsset = (id: WalletAssetId, hasCoinPage: boolean) => {
    if (!hasCoinPage) return;
    haptic("light");
    navigate(`/wallet/${id}`);
  };

  const showSkeleton = !hasFetched && !txError;

  return (
    <div className="wallet">
      <div className="wallet__top">
        <section
          className="wallet__hero shop-rise"
          style={
            {
              "--rise-index": 0,
              ...getWalletHeroBackgroundStyle(heroPattern),
            } as CSSProperties
          }
          aria-label={t("wallet.balanceAria")}
        >
          <div className="wallet__hero-head">
            <span className="wallet__hero-eyebrow">{t("wallet.balanceTitle")}</span>
            <span className="wallet__hero-badge">
              <DepositCryptoIcon width={12} height={12} />
              {t("wallet.usd")}
            </span>
          </div>

          <div className="wallet__hero-amount">
            {loading ? (
              <span className="wallet__balance-skeleton" aria-label={t("wallet.loadingBalance")} />
            ) : (
              <>
                <span className="wallet__hero-unit">{t("wallet.toman")}</span>
                <span className="wallet__hero-value">{formatFaNumber(totalToman)}</span>
              </>
            )}
          </div>

          <div className="wallet__hero-foot">
            <div className="wallet__hero-chip">
              <span className="wallet__hero-chip-main">
                {loading || totalUsd == null ? (
                  "…"
                ) : (
                  <>
                    {formatFaDecimal(totalUsd, 2)}
                    <span className="wallet__hero-chip-unit">{t("wallet.usd")}</span>
                  </>
                )}
              </span>
              <span className="wallet__hero-chip-sub">{t("wallet.totalUsdHint")}</span>
            </div>
            <button
              type="button"
              className="wallet__hero-cta"
              onClick={() => onAction(t("wallet.buyTrx"))}
            >
              {t("wallet.buyTrx")}
            </button>
          </div>
        </section>

        <div className="wallet__actions shop-rise" style={{ "--rise-index": 1 } as CSSProperties}>
          <button type="button" className="wallet__action" onClick={openDepositSheet}>
            <span className="wallet__action-icon">
              <MoneyReceiveSquareIcon width={20} height={20} />
            </span>
            <span className="wallet__action-label">{t("wallet.deposit")}</span>
          </button>
          <button type="button" className="wallet__action" onClick={openWithdrawSheet}>
            <span className="wallet__action-icon">
              <MoneySendSquareIcon width={20} height={20} />
            </span>
            <span className="wallet__action-label">{t("wallet.withdraw")}</span>
          </button>
          <button type="button" className="wallet__action" onClick={() => onAction(t("wallet.convert"))}>
            <span className="wallet__action-icon">
              <SwapIcon width={20} height={20} />
            </span>
            <span className="wallet__action-label">{t("wallet.convert")}</span>
          </button>
        </div>

        <div
          className="wallet__segment shop-rise"
          style={{ "--rise-index": 2 } as CSSProperties}
          role="tablist"
          aria-label={t("wallet.sectionAria")}
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "assets"}
            className={`wallet__segment-btn${activeTab === "assets" ? " is-active" : ""}`}
            onClick={() => onTabChange("assets")}
          >
            {t("wallet.assets")}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "history"}
            className={`wallet__segment-btn${activeTab === "history" ? " is-active" : ""}`}
            onClick={() => onTabChange("history")}
          >
            {t("wallet.transactions")}
          </button>
        </div>
      </div>

      <div className="wallet__tab-panel shop-rise" style={{ "--rise-index": 3 } as CSSProperties}>
        {activeTab === "assets" ? (
          <div className="wallet__assets" role="tabpanel" aria-label={t("wallet.assets")}>
            {ratesError && !ratesReady ? (
              <EmptyState
                title={t("wallet.ratesUnavailable")}
                action={
                  <button
                    type="button"
                    className="wallet__balance-retry"
                    onClick={() => void loadRates()}
                  >
                    {t("common.retry")}
                  </button>
                }
              />
            ) : (
              sortedAssets.map((asset) => {
                const balance = assetBalance(asset.id);
                const isToman = asset.id === "toman";
                const rate = rateFor(asset.id);
                const usdtRate = rates.usdt;
                const tomanUsdtEquiv =
                  isToman && typeof usdtRate === "number" && usdtRate > 0
                    ? balance / usdtRate
                    : null;
                const change = changeFor(asset.id);
                const changeParts = change != null ? formatChangePercentParts(change) : null;
                const changeTone =
                  change == null
                    ? ""
                    : change > 0
                      ? " wallet__asset-change--up"
                      : change < 0
                        ? " wallet__asset-change--down"
                        : " wallet__asset-change--flat";
                const clickable = asset.hasCoinPage;
                const body = (
                  <>
                    <img
                      src={asset.logo}
                      alt=""
                      className="wallet__asset-logo"
                      width={32}
                      height={32}
                      decoding="async"
                    />
                    <div className="wallet__asset-info">
                      <div className="wallet__asset-title">{t(asset.titleKey)}</div>
                      <div className="wallet__asset-sub">
                        {isToman ? (
                          t("wallet.rialBalance")
                        ) : rate != null ? (
                          <>
                            <span className="wallet__asset-rate">
                              {formatFaNumber(rate)} {t("wallet.toman")}
                            </span>
                            {changeParts ? (
                              <span className={`wallet__asset-change${changeTone}`}>
                                {changeParts.abs}
                              </span>
                            ) : null}
                          </>
                        ) : (
                          <span className="wallet__asset-sub-gap" aria-hidden>
                            {"\u00A0"}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="wallet__asset-value">
                      {isToman ? (
                        <>
                          <span className="wallet__asset-amount-main">
                            {formatFaNumber(balance)} {t("wallet.toman")}
                          </span>
                          <span className="wallet__asset-amount-sub wallet__asset-amount-sub--equiv">
                            {tomanUsdtEquiv != null
                              ? t("wallet.tomanUsdtEquiv", {
                                  amount: formatFaDecimal(tomanUsdtEquiv, 2),
                                })
                              : "—"}
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="wallet__asset-amount-main">
                            {rate != null
                              ? `${formatFaNumber(Math.round(balance * rate))} ${t("wallet.toman")}`
                              : `— ${t("wallet.toman")}`}
                          </span>
                          <span className="wallet__asset-amount-sub">
                            <span className="wallet__asset-amount-unit">{t(asset.unitKey)}</span>
                            <span className="wallet__asset-amount-qty">{formatFaDecimal(balance, 2)}</span>
                          </span>
                        </>
                      )}
                    </div>
                  </>
                );
                return clickable ? (
                  <button
                    key={asset.id}
                    type="button"
                    className="wallet__asset wallet__asset--clickable"
                    onClick={() => openAsset(asset.id, true)}
                  >
                    {body}
                  </button>
                ) : (
                  <div key={asset.id} className="wallet__asset">
                    {body}
                  </div>
                );
              })
            )}
          </div>
        ) : (
          <div className="wallet__transactions" role="tabpanel" aria-label={t("wallet.transactions")}>
            {txError ? (
              <EmptyState
                title={txError}
                action={
                  <button type="button" className="wallet__balance-retry" onClick={() => void loadTxs()}>
                    {t("common.retry")}
                  </button>
                }
              />
            ) : showSkeleton ? (
              [0, 1, 2, 3].map((index) => (
                <div key={index} className="wallet__transaction wallet__transaction--skeleton">
                  <div className="wallet__transaction-start">
                    <span className="wallet__transaction-skeleton-icon" />
                    <div className="wallet__transaction-info">
                      <span className="wallet__transaction-skeleton-title" />
                      <span className="wallet__transaction-skeleton-date" />
                    </div>
                  </div>
                  <span className="wallet__transaction-skeleton-amount" />
                </div>
              ))
            ) : hasFetched && txs.length === 0 ? (
              <EmptyState title={t("wallet.emptyHistory")} />
            ) : (
              txs.map((tx) => {
                const equiv = formatTxEquiv(tx, rates.usdt ?? null, t);
                return (
                  <button
                    key={tx.id}
                    type="button"
                    className="wallet__transaction wallet__transaction--clickable"
                    onClick={() => {
                      haptic("light");
                      setSelectedTx(tx);
                      setTxSheetOpen(true);
                    }}
                  >
                    <div className="wallet__transaction-start">
                      <span className="wallet__transaction-logo-wrap" aria-hidden>
                        <img
                          className="wallet__transaction-logo"
                          src={txAssetLogo(tx.asset)}
                          alt=""
                          width={32}
                          height={32}
                          decoding="async"
                        />
                        <span className={getBadgeClass(tx)}>
                          <TransactionBadgeIcon tx={tx} />
                        </span>
                      </span>
                      <div className="wallet__transaction-info">
                        <div className="wallet__transaction-title">{txTypeLabel(tx.type)}</div>
                        <div className="wallet__transaction-date">{formatFaDate(tx.createdAt)}</div>
                      </div>
                    </div>
                    <div className={`wallet__transaction-value-col ${getAmountClass(tx)}`}>
                      <span className="wallet__transaction-amount-main">
                        <span className="wallet__transaction-unit">{assetUnit(tx.asset)}</span>
                        <span className="wallet__transaction-value">{formatTxAmount(tx)}</span>
                      </span>
                      <span
                        className="wallet__transaction-equiv"
                        title={equiv ?? undefined}
                      >
                        {equiv ?? "—"}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>

      <WalletTxDetailSheet
        open={txSheetOpen}
        transaction={selectedTx}
        onClose={() => setTxSheetOpen(false)}
      />

      <BottomSheet
        open={depositSheetOpen}
        onClose={closeDepositSheet}
        title={t("wallet.depositTypeTitle")}
        className="wallet-deposit-type-sheet"
      >
        <div className="wallet-deposit-type">
          <button
            type="button"
            className="wallet-deposit-type__card"
            onClick={() => onDepositType("crypto")}
          >
            <span className="wallet-deposit-type__icon" aria-hidden>
              <BitcoinCircleIcon width={22} height={22} />
            </span>
            <span className="wallet-deposit-type__info">
              <span className="wallet-deposit-type__name">{t("wallet.depositCrypto")}</span>
              <span className="wallet-deposit-type__desc">{t("wallet.depositCryptoDesc")}</span>
            </span>
            <span className="wallet-deposit-type__arrow">
              <DepositTypeChevron flip={!isRTL} />
            </span>
          </button>

          <button
            type="button"
            className="wallet-deposit-type__card"
            onClick={() => onDepositType("toman")}
          >
            <span className="wallet-deposit-type__icon" aria-hidden>
              <RiyalIcon width={22} height={22} />
            </span>
            <span className="wallet-deposit-type__info">
              <span className="wallet-deposit-type__name">{t("wallet.depositToman")}</span>
              <span className="wallet-deposit-type__desc">{t("wallet.depositTomanDesc")}</span>
            </span>
            <span className="wallet-deposit-type__arrow">
              <DepositTypeChevron flip={!isRTL} />
            </span>
          </button>
        </div>
      </BottomSheet>

      <BottomSheet
        open={withdrawSheetOpen}
        onClose={closeWithdrawSheet}
        title={t("wallet.withdrawTypeTitle")}
        className="wallet-deposit-type-sheet"
      >
        <div className="wallet-deposit-type">
          <button
            type="button"
            className="wallet-deposit-type__card"
            onClick={() => onWithdrawType("toman")}
          >
            <span className="wallet-deposit-type__icon" aria-hidden>
              <RiyalIcon width={22} height={22} />
            </span>
            <span className="wallet-deposit-type__info">
              <span className="wallet-deposit-type__name">{t("wallet.withdrawToman")}</span>
              <span className="wallet-deposit-type__desc">{t("wallet.withdrawTomanDesc")}</span>
            </span>
            <span className="wallet-deposit-type__arrow">
              <DepositTypeChevron flip={!isRTL} />
            </span>
          </button>

          <button
            type="button"
            className="wallet-deposit-type__card"
            onClick={() => onWithdrawType("crypto")}
          >
            <span className="wallet-deposit-type__icon" aria-hidden>
              <BitcoinCircleIcon width={22} height={22} />
            </span>
            <span className="wallet-deposit-type__info">
              <span className="wallet-deposit-type__name">{t("wallet.withdrawCrypto")}</span>
              <span className="wallet-deposit-type__desc">{t("wallet.withdrawCryptoDesc")}</span>
            </span>
            <span className="wallet-deposit-type__arrow">
              <DepositTypeChevron flip={!isRTL} />
            </span>
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
