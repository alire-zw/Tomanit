import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useNotification } from "../../components/Notification";
import { PageHeader } from "../../components/PageHeader";
import { EmptyState } from "../../components/EmptyState";
import { WalletTxDetailSheet } from "../../components/wallet/WalletTxDetailSheet";
import Cash02Icon from "../../components/icons/cash-02-stroke-rounded";
import MoneyPending02Icon from "../../components/icons/money-pending-02-stroke-rounded";
import MoneyReceiveSquareIcon from "../../components/icons/MoneyReceiveSquareIcon";
import MoneyRemove02Icon from "../../components/icons/money-remove-02-stroke-rounded";
import MoneySendSquareIcon from "../../components/icons/MoneySendSquareIcon";
import SwapIcon from "../../components/icons/SwapIcon";
import Money03Icon from "../../components/icons/money-03-stroke-rounded";
import { useI18n } from "../../context/I18nContext";
import { useAuth } from "../../hooks/useAuth";
import { useTelegram } from "../../hooks/useTelegram";
import { apiFetch, type WalletAssetId, type WalletTransaction } from "../../lib/api";
import { formatChartPointTime, formatFaCryptoQty, formatFaDate, formatFaDecimal, formatFaNumber } from "../../lib/format";
import {
  getWalletAssetDef,
  isWalletAssetId,
} from "../../lib/walletAssetsCatalog";
import {
  readCachedWalletChart,
  writeCachedWalletChart,
} from "../../lib/walletChartsCache";
import {
  readCachedWalletRates,
  writeCachedWalletRates,
} from "../../lib/walletRatesCache";
import { getWalletAssetBalance } from "../../lib/walletUi";
import {
  CoinPriceChart,
  type ChartCandlePoint,
  type ChartLinePoint,
  type ChartScrubPoint,
} from "./CoinPriceChart";
import "../../styles/shop-rise.css";
import "./WalletAsset.css";

type CoinActionId = "deposit" | "withdraw" | "buy" | "convert";
type RatesMap = Partial<Record<WalletAssetId, number>>;
type ChangesMap = Partial<Record<Exclude<WalletAssetId, "toman">, number>>;
type ChartRange = "DAY" | "WEEK" | "MONTH" | "SIX_MONTH" | "YEAR" | "ALL";
type ChartStyle = "line" | "candle";
type LineRanges = Partial<Record<ChartRange, ChartLinePoint[]>>;
type CandleRanges = Partial<Record<ChartRange, ChartCandlePoint[]>>;

const RATES_POLL_MS = 10_000;

const CHART_PERIODS: Array<{ id: ChartRange; labelKey: string }> = [
  { id: "DAY", labelKey: "wallet.chartPeriod.day" },
  { id: "WEEK", labelKey: "wallet.chartPeriod.week" },
  { id: "MONTH", labelKey: "wallet.chartPeriod.month" },
  { id: "SIX_MONTH", labelKey: "wallet.chartPeriod.sixMonth" },
  { id: "YEAR", labelKey: "wallet.chartPeriod.year" },
  { id: "ALL", labelKey: "wallet.chartPeriod.all" },
];

function signedAmount(value: number): string {
  const abs = formatFaNumber(Math.abs(Math.round(value)));
  if (value > 0) return `+${abs}`;
  if (value < 0) return `-${abs}`;
  return abs;
}

function signedPercent(value: number): string {
  const abs = formatFaDecimal(Math.abs(value), 2);
  if (value > 0) return `+${abs}%`;
  if (value < 0) return `-${abs}%`;
  return `${abs}%`;
}

/** Absolute IRT delta from percent vs day-open: Δ = rate × pct / (100 + pct). */
function absChangeFromPercent(rate: number, pct: number): number {
  if (!Number.isFinite(rate) || !Number.isFinite(pct) || pct === -100) return 0;
  return Math.round((rate * pct) / (100 + pct));
}

function periodDateKey(range: ChartRange): string {
  switch (range) {
    case "DAY":
      return "wallet.today";
    case "WEEK":
      return "wallet.chartPeriod.week";
    case "MONTH":
      return "wallet.chartPeriod.month";
    case "SIX_MONTH":
      return "wallet.chartPeriod.sixMonth";
    case "YEAR":
      return "wallet.chartPeriod.year";
    default:
      return "wallet.chartPeriod.all";
  }
}

function ChartBarsIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M18 20V10m-6 10V4M6 20v-6"
      />
    </svg>
  );
}

function AssetTxIcon({ tx }: { tx: WalletTransaction }) {
  const props = { width: 16, height: 16 };
  if (tx.status === "pending" || tx.status === "processing") {
    return <MoneyPending02Icon {...props} />;
  }
  if (tx.status === "failed" || tx.status === "cancelled" || tx.status === "rejected") {
    return <MoneyRemove02Icon {...props} />;
  }
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
  if (tx.status === "pending" || tx.status === "processing") {
    return "coin-page__tx-icon coin-page__tx-icon--pending";
  }
  if (tx.status === "failed" || tx.status === "cancelled" || tx.status === "rejected") {
    return "coin-page__tx-icon coin-page__tx-icon--failed";
  }
  if (tx.type === "withdraw" || tx.type === "invoice" || tx.type === "fee") {
    return "coin-page__tx-icon coin-page__tx-icon--out";
  }
  if (tx.type === "deposit" || tx.type === "recharge" || tx.type === "refund") {
    return "coin-page__tx-icon coin-page__tx-icon--in";
  }
  if (tx.type === "convert") return "coin-page__tx-icon coin-page__tx-icon--convert";
  return "coin-page__tx-icon";
}

/** Resolve the leg of a tx that touches `assetId` for list display. */
function resolveAssetLeg(
  tx: WalletTransaction,
  assetId: string,
): { qty: number; direction: "in" | "out" | "flat" } {
  if (tx.type === "convert") {
    if (tx.asset === assetId) {
      return { qty: tx.amount, direction: "out" };
    }
    if (tx.counterAsset === assetId) {
      return { qty: tx.counterAmount ?? 0, direction: "in" };
    }
  }
  if (
    tx.type === "withdraw" ||
    tx.type === "invoice" ||
    tx.type === "fee"
  ) {
    return { qty: tx.amount, direction: "out" };
  }
  if (
    tx.type === "deposit" ||
    tx.type === "recharge" ||
    tx.type === "refund"
  ) {
    return { qty: tx.amount, direction: "in" };
  }
  return { qty: tx.amount, direction: "flat" };
}

function formatAssetTxAmount(
  tx: WalletTransaction,
  assetId: string,
  liveRate: number | null,
): {
  tomanValue: string;
  cryptoValue: string;
  tone: "in" | "out" | "flat" | "muted";
} {
  const leg = resolveAssetLeg(tx, assetId);
  const cryptoValue = formatFaCryptoQty(Math.abs(leg.qty), 3);

  let tomanRaw: number | null = null;
  if (tx.amountToman != null && tx.amountToman > 0 && Number.isFinite(tx.amountToman)) {
    if (tx.type === "convert") {
      tomanRaw = Math.round(Math.abs(tx.amountToman));
    } else if (tx.asset === assetId) {
      tomanRaw = Math.round(Math.abs(tx.amountToman));
    }
  }
  if (tomanRaw == null && tx.unitPriceToman != null && tx.unitPriceToman > 0 && tx.asset === assetId) {
    tomanRaw = Math.round(Math.abs(leg.qty * tx.unitPriceToman));
  }
  if (
    tomanRaw == null &&
    tx.type === "convert" &&
    tx.counterAsset === assetId &&
    tx.counterUnitPriceToman != null &&
    tx.counterUnitPriceToman > 0
  ) {
    tomanRaw = Math.round(Math.abs(leg.qty * tx.counterUnitPriceToman));
  }
  if (tomanRaw == null && liveRate != null && liveRate > 0) {
    tomanRaw = Math.round(Math.abs(leg.qty * liveRate));
  }

  const tomanValue = tomanRaw != null ? formatFaNumber(tomanRaw) : "—";

  let tone: "in" | "out" | "flat" | "muted" = "flat";
  if (
    tx.status === "failed" ||
    tx.status === "cancelled" ||
    tx.status === "rejected"
  ) {
    tone = "muted";
  } else if (tx.status === "pending" || tx.status === "processing") {
    tone = "flat";
  } else if (leg.direction === "out") {
    tone = "out";
  } else if (leg.direction === "in") {
    tone = "in";
  }

  return { tomanValue, cryptoValue, tone };
}

export function WalletAssetPage() {
  const { assetId = "" } = useParams<{ assetId: string }>();
  const navigate = useNavigate();
  const { t } = useI18n();
  const { haptic } = useTelegram();
  const { notify } = useNotification();
  const { wallet } = useAuth();

  const [holdingPnl, setHoldingPnl] = useState<number | null>(null);
  const [holdingPnlPct, setHoldingPnlPct] = useState<number | null>(null);
  const [assetTxs, setAssetTxs] = useState<WalletTransaction[]>([]);
  const [txsFetched, setTxsFetched] = useState(false);
  const [txsError, setTxsError] = useState<string | null>(null);
  const [selectedTx, setSelectedTx] = useState<WalletTransaction | null>(null);
  const [txSheetOpen, setTxSheetOpen] = useState(false);
  const asset = isWalletAssetId(assetId) ? getWalletAssetDef(assetId) : undefined;

  const [rate, setRate] = useState<number | null>(null);
  const [changePct, setChangePct] = useState<number | null>(null);
  const [chartRange, setChartRange] = useState<ChartRange>("DAY");
  const [chartStyle, setChartStyle] = useState<ChartStyle>("line");
  const [lineRanges, setLineRanges] = useState<LineRanges>(() => {
    if (!asset || asset.id === "toman") return {};
    return readCachedWalletChart(asset.id)?.ranges ?? {};
  });
  const [candleRanges, setCandleRanges] = useState<CandleRanges>({});
  const [chartError, setChartError] = useState(false);
  const [scrub, setScrub] = useState<ChartScrubPoint | null>(null);

  const applyRates = useCallback(
    (rates: RatesMap, changes: ChangesMap) => {
      if (!asset || asset.id === "toman") {
        setRate(null);
        setChangePct(null);
        return;
      }
      const nextRate = rates[asset.id];
      setRate(nextRate != null && nextRate > 0 ? nextRate : null);
      const nextChange = changes[asset.id as Exclude<WalletAssetId, "toman">];
      setChangePct(nextChange != null && Number.isFinite(nextChange) ? nextChange : null);
    },
    [asset],
  );

  const loadRates = useCallback(async () => {
    if (!asset || asset.id === "toman") return;
    try {
      const data = await apiFetch<{
        rates: RatesMap;
        changes?: ChangesMap;
        source: string;
      }>("/wallet/rates");
      if (data.source !== "swapwallet" || !data.rates) return;

      const next: RatesMap = { toman: 1 };
      const nextChanges: ChangesMap = {};
      for (const id of ["trx", "usdt", "bnb", "matic", "gram"] as const) {
        const value = Number(data.rates[id]);
        if (!(value > 0)) return;
        next[id] = value;
        const ch = Number(data.changes?.[id]);
        nextChanges[id] = Number.isFinite(ch) ? ch : 0;
      }
      writeCachedWalletRates(next, nextChanges);
      applyRates(next, nextChanges);
    } catch {
      // Keep last cached numbers.
    }
  }, [applyRates, asset]);

  /** Redis → localStorage; UI already shows cache so no loading flash. */
  const loadLineCharts = useCallback(async () => {
    if (!asset || asset.id === "toman") return;
    try {
      const data = await apiFetch<{
        ranges: LineRanges;
        style: "line";
      }>(`/wallet/chart?asset=${asset.id}&style=line`);
      if (!data.ranges?.DAY?.length) {
        if (!readCachedWalletChart(asset.id)?.ranges.DAY?.length) {
          setChartError(true);
        }
        return;
      }
      writeCachedWalletChart(asset.id, data.ranges);
      setLineRanges(data.ranges);
      setChartError(false);
    } catch {
      if (!readCachedWalletChart(asset.id)?.ranges.DAY?.length) {
        setChartError(true);
      }
    }
  }, [asset]);

  const loadCandleRange = useCallback(
    async (range: ChartRange) => {
      if (!asset || asset.id === "toman") return;
      let skip = false;
      setCandleRanges((prev) => {
        if (prev[range]?.length) skip = true;
        return prev;
      });
      if (skip) return;
      try {
        const data = await apiFetch<{
          points: ChartCandlePoint[];
        }>(`/wallet/chart?asset=${asset.id}&range=${range}&style=candle`);
        if (!Array.isArray(data.points) || data.points.length === 0) return;
        setCandleRanges((prev) =>
          prev[range]?.length ? prev : { ...prev, [range]: data.points },
        );
      } catch {
        // keep previous
      }
    },
    [asset],
  );

  useEffect(() => {
    const cached = readCachedWalletRates();
    if (cached) applyRates(cached.rates, cached.changes);
    else {
      setRate(null);
      setChangePct(null);
    }
    void loadRates();
    const timer = window.setInterval(() => {
      void loadRates();
    }, RATES_POLL_MS);
    return () => window.clearInterval(timer);
  }, [applyRates, loadRates]);

  useEffect(() => {
    if (!asset || asset.id === "toman") {
      setLineRanges({});
      setCandleRanges({});
      setScrub(null);
      setChartRange("DAY");
      setChartStyle("line");
      return;
    }
    setLineRanges(readCachedWalletChart(asset.id)?.ranges ?? {});
    setCandleRanges({});
    setScrub(null);
    setChartError(false);
    setChartRange("DAY");
    setChartStyle("line");
    void loadLineCharts();
  }, [asset, loadLineCharts]);

  useEffect(() => {
    if (chartStyle !== "candle" || !asset || asset.id === "toman") return;
    for (const period of CHART_PERIODS) {
      void loadCandleRange(period.id);
    }
  }, [asset, chartStyle, loadCandleRange]);

  const chartPoints: ChartLinePoint[] | ChartCandlePoint[] = useMemo(() => {
    if (chartStyle === "candle") {
      return candleRanges[chartRange] ?? [];
    }
    return lineRanges[chartRange] ?? [];
  }, [candleRanges, chartRange, chartStyle, lineRanges]);

  const onAction = useCallback(
    (actionId: CoinActionId) => {
      haptic("light");
      if (actionId === "deposit" && asset) {
        navigate(`/wallet/${asset.id}/deposit`, { state: { from: "asset" } });
        return;
      }
      if (actionId === "withdraw" && asset) {
        navigate(`/wallet/${asset.id}/withdraw`, { state: { from: "asset" } });
        return;
      }
      notify(t("wallet.soon", { label: t(`wallet.${actionId}`) }), "info");
    },
    [asset, haptic, navigate, notify, t],
  );

  const chartStats = useMemo(() => {
    if (chartPoints.length < 2) return null;
    const first = chartPoints[0]!;
    const last = chartPoints[chartPoints.length - 1]!;
    const open = "value" in first ? first.value : first.open;
    const close = "value" in last ? last.value : last.close;
    if (!(open > 0) || !(close > 0)) return null;
    let high = 0;
    for (const p of chartPoints) {
      const v = "value" in p ? p.value : p.high;
      if (v > high) high = v;
    }
    const abs = Math.round(close - open);
    const pct = Math.round(((close - open) / open) * 10000) / 100;
    return { close, abs, pct, high: high > 0 ? high : close };
  }, [chartPoints]);

  const rangeHigh = chartStats?.high ?? null;

  const periodOpen = useMemo(() => {
    if (!chartPoints[0]) return null;
    const first = chartPoints[0];
    return "value" in first ? first.value : first.open;
  }, [chartPoints]);

  const holdingQty =
    asset && asset.id !== "toman" ? getWalletAssetBalance(wallet, asset.id) : 0;

  useEffect(() => {
    if (!asset || asset.id === "toman" || !asset.hasCoinPage) {
      setHoldingPnl(null);
      setHoldingPnlPct(null);
      return;
    }

    let cancelled = false;
    const loadPnl = async () => {
      try {
        const data = await apiFetch<{
          pnl: {
            pnlToman: number | null;
            pnlPercent: number | null;
            quantity: number;
          };
        }>(`/wallet/assets/${asset.id}/pnl`);
        if (cancelled) return;
        setHoldingPnl(
          data.pnl.pnlToman != null && Number.isFinite(data.pnl.pnlToman)
            ? data.pnl.pnlToman
            : null,
        );
        setHoldingPnlPct(
          data.pnl.pnlPercent != null && Number.isFinite(data.pnl.pnlPercent)
            ? data.pnl.pnlPercent
            : null,
        );
      } catch {
        if (!cancelled) {
          setHoldingPnl(null);
          setHoldingPnlPct(null);
        }
      }
    };

    void loadPnl();
    const timer = window.setInterval(() => void loadPnl(), RATES_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [asset, holdingQty, rate]);

  const loadAssetTxs = useCallback(async () => {
    if (!asset || asset.id === "toman" || !asset.hasCoinPage) return;
    setTxsError(null);
    try {
      const data = await apiFetch<{ transactions: WalletTransaction[] }>(
        `/wallet/transactions?asset=${asset.id}&limit=50`,
      );
      setAssetTxs(data.transactions ?? []);
      setTxsFetched(true);
    } catch (err) {
      setTxsError(err instanceof Error ? err.message : t("wallet.loadError"));
      setTxsFetched(true);
    }
  }, [asset, t]);

  useEffect(() => {
    void loadAssetTxs();
  }, [loadAssetTxs, holdingQty]);

  if (asset?.id === "toman") {
    return <Navigate to="/wallet/toman" replace />;
  }

  if (!asset || !asset.hasCoinPage) {
    return <Navigate to="/" replace />;
  }

  const holdingToman =
    rate != null && rate > 0 ? Math.round(holdingQty * rate) : 0;

  const actions: Array<{
    id: CoinActionId;
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
    {
      id: "buy",
      labelKey: "wallet.buy",
      icon: <Cash02Icon width={22} height={22} />,
    },
  ];

  const periodTone =
    chartStats == null
      ? "flat"
      : chartStats.pct > 0
        ? "up"
        : chartStats.pct < 0
          ? "down"
          : "flat";

  const displayPrice = scrub?.price ?? chartStats?.close ?? rate ?? null;
  const displayAbs =
    scrub && periodOpen != null
      ? Math.round(scrub.price - periodOpen)
      : chartRange === "DAY" && rate != null && changePct != null
        ? absChangeFromPercent(rate, changePct)
        : chartStats?.abs ?? null;
  const displayPct =
    scrub && periodOpen != null && periodOpen > 0
      ? Math.round(((scrub.price - periodOpen) / periodOpen) * 10000) / 100
      : chartRange === "DAY" && changePct != null
        ? changePct
        : chartStats?.pct ?? null;

  const changeTone =
    displayPct == null
      ? "flat"
      : displayPct > 0
        ? "up"
        : displayPct < 0
          ? "down"
          : "flat";

  const dateLabel = scrub
    ? formatChartPointTime(scrub.time, chartRange)
    : t(periodDateKey(chartRange));

  return (
    <div className="coin-page">
      <div className="coin-page__header">
        <PageHeader title={t(asset.titleKey)} onBack={() => navigate("/")} />
      </div>

      <section
        className="coin-page__charts shop-rise"
        style={{ "--rise-index": 1 } as CSSProperties}
      >
        <header className="coin-page__charts-header">
          <div className="coin-page__charts-numbers">
            <p className="coin-page__charts-title">
              {asset.symbol} • {t(asset.titleKey)}
            </p>
            <p className="coin-page__charts-price">
              {displayPrice != null ? (
                <>
                  <span className="coin-page__charts-price-value">
                    {formatFaNumber(displayPrice)}
                  </span>
                  <span className="coin-page__charts-price-unit">
                    {t("wallet.toman")}
                  </span>
                </>
              ) : (
                <>
                  <span className="coin-page__charts-price-value">—</span>
                  <span className="coin-page__charts-price-unit">
                    {t("wallet.toman")}
                  </span>
                </>
              )}
            </p>
            {displayAbs != null && displayPct != null ? (
              <div className="coin-page__charts-compare">
                <span className="coin-page__charts-delta" dir="ltr">
                  {signedAmount(displayAbs)}
                  <span className="coin-page__charts-delta-unit"> IRT</span>
                </span>
                <span
                  className={`coin-page__charts-pct coin-page__charts-pct--${changeTone}`}
                  dir="ltr"
                >
                  {signedPercent(displayPct)}
                </span>
              </div>
            ) : null}
            <div className="coin-page__charts-date">
              <p>{dateLabel}</p>
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

        <div className="coin-page__chart shop-rise" style={{ "--rise-index": 2 } as CSSProperties}>
          {chartError && chartStyle === "line" && !lineRanges.DAY?.length ? (
            <div className="coin-page__chart-empty">
              <p>{t("wallet.chartUnavailable")}</p>
              <button
                type="button"
                className="coin-page__chart-retry"
                onClick={() => void loadLineCharts()}
              >
                {t("common.retry")}
              </button>
            </div>
          ) : chartPoints.length > 0 ? (
            <div className="coin-page__chart-stage">
              {rangeHigh != null ? (
                <span className="coin-page__chart-high" dir="auto">
                  <span className="coin-page__chart-high-label">
                    {t("wallet.chartRangeHigh")}
                  </span>
                  <span className="coin-page__chart-high-value" dir="ltr">
                    {formatFaNumber(rangeHigh)}
                  </span>
                </span>
              ) : null}
              <CoinPriceChart
                style={chartStyle}
                points={chartPoints}
                tone={periodTone}
                onScrub={setScrub}
              />
            </div>
          ) : (
            <div className="coin-page__chart-empty" aria-hidden />
          )}
        </div>

        <div
          className="coin-page__chart-footer shop-rise"
          style={{ "--rise-index": 3 } as CSSProperties}
        >
          <button
            type="button"
            className={`coin-page__chart-style${
              chartStyle === "candle" ? " is-active" : ""
            }`}
            aria-label={t("wallet.chartStyleToggle")}
            onClick={() => {
              haptic("light");
              setScrub(null);
              setChartStyle((prev) => (prev === "line" ? "candle" : "line"));
            }}
          >
            <ChartBarsIcon />
          </button>
          <div className="coin-page__chart-periods" role="tablist" aria-label={t("wallet.chartPeriods")}>
            {CHART_PERIODS.map((period) => (
              <button
                key={period.id}
                type="button"
                role="tab"
                aria-selected={chartRange === period.id}
                className={`coin-page__chart-period${
                  chartRange === period.id ? " is-selected" : ""
                }`}
                onClick={() => {
                  if (chartRange === period.id) return;
                  haptic("light");
                  setScrub(null);
                  setChartRange(period.id);
                }}
              >
                {t(period.labelKey)}
              </button>
            ))}
          </div>
        </div>
      </section>

      <h5
        className="coin-page__menu-title shop-rise"
        style={{ "--rise-index": 4 } as CSSProperties}
      >
        {t("wallet.yourAssets")}
      </h5>
      <div
        className="coin-page__menu-box shop-rise"
        style={{ "--rise-index": 5 } as CSSProperties}
        aria-label={t("wallet.yourAssets")}
      >
        <div className="coin-page__holding-row">
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
              <span className="coin-page__holding-sub-qty">
                {formatFaDecimal(holdingQty, 2)}
              </span>
              <span className="coin-page__holding-sub-unit">{t(asset.unitKey)}</span>
            </div>
          </div>
          <div className="coin-page__holding-value">
            <span className="coin-page__holding-amount-main">
              {formatFaNumber(holdingToman)} {t("wallet.toman")}
            </span>
          </div>
        </div>
        <div className="coin-page__holding-row coin-page__holding-row--meta">
          <span className="coin-page__holding-meta-label">
            {t("wallet.potentialPnl")}
          </span>
          <span
            className={`coin-page__holding-meta-value${
              holdingPnl == null
                ? ""
                : holdingPnl > 0
                  ? " is-up"
                  : holdingPnl < 0
                    ? " is-down"
                    : ""
            }`}
            dir="ltr"
          >
            {holdingPnl == null ? (
              "—"
            ) : (
              <>
                <span>{formatFaNumber(Math.abs(Math.round(holdingPnl)))}</span>
                {holdingPnlPct != null ? (
                  <span className="coin-page__holding-meta-pct">
                    {" "}
                    ({formatFaDecimal(Math.abs(holdingPnlPct), 2)}%)
                  </span>
                ) : null}
              </>
            )}
          </span>
        </div>
      </div>

      <h5
        className="coin-page__menu-title shop-rise"
        style={{ "--rise-index": 6 } as CSSProperties}
      >
        {t("wallet.transactions")}
      </h5>
      <div
        className="coin-page__txs shop-rise"
        style={{ "--rise-index": 7 } as CSSProperties}
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
            const amount = formatAssetTxAmount(tx, asset.id, rate);
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
                  <span className={assetTxIconClass(tx)}>
                    <AssetTxIcon tx={tx} />
                  </span>
                  <div className="coin-page__tx-info">
                    <div className="coin-page__tx-title">
                      {(() => {
                        const key = `tx.${tx.type}`;
                        const label = t(key);
                        return label === key ? tx.type : label;
                      })()}
                    </div>
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
                    <span className="coin-page__tx-amount-qty">
                      {amount.tomanValue}
                    </span>
                  </span>
                  <span className="coin-page__tx-amount-sub" dir="ltr">
                    <span className="coin-page__tx-amount-unit">
                      {t(asset.unitKey)}
                    </span>
                    <span className="coin-page__tx-amount-qty">
                      {amount.cryptoValue}
                    </span>
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
        style={{ "--rise-index": 8 } as CSSProperties}
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
