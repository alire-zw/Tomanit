import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { EmptyState } from "../../components/EmptyState";
import { PageHeader } from "../../components/PageHeader";
import ApiIcon from "../../components/icons/hugeicons/ApiIcon";
import Calendar03Icon from "../../components/icons/hugeicons/Calendar03Icon";
import CashierIcon from "../../components/icons/hugeicons/CashierIcon";
import ChartRoseIcon from "../../components/icons/hugeicons/ChartRoseIcon";
import Invoice04Icon from "../../components/icons/hugeicons/Invoice04Icon";
import MoneySendSquareIcon from "../../components/icons/hugeicons/MoneySendSquareIcon";
import Sun01Icon from "../../components/icons/hugeicons/Sun01Icon";
import { useI18n } from "../../context/I18nContext";
import { useTelegramBackButton } from "../../hooks/useTelegramBackButton";
import { formatFaDecimal, formatFaNumber } from "../../lib/format";
import {
  fetchAdminShopStats,
  type AdminShopStatsDaily,
  type AdminShopStatsPayload,
  type ShopStatsBucket,
} from "../../lib/shop";
import "../../styles/shop-rise.css";
import "../MyShop.css";
import "./Admin.css";

type Period = "today" | "week" | "month";

function weekdayLabel(weekday: number, t: (k: string) => string): string {
  if (weekday === 0) return t("myShop.daySun");
  if (weekday === 1) return t("myShop.dayMon");
  if (weekday === 2) return t("myShop.dayTue");
  if (weekday === 3) return t("myShop.dayWed");
  if (weekday === 4) return t("myShop.dayThu");
  if (weekday === 5) return t("myShop.dayFri");
  return t("myShop.daySat");
}

function pct(part: number, total: number): number {
  if (!(total > 0)) return 0;
  return Math.round((part / total) * 1000) / 10;
}

function deltaPct(current: number, previous: number): number | null {
  if (!(previous > 0)) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function sliceDaily(
  daily: AdminShopStatsDaily[],
  period: Period,
): AdminShopStatsDaily[] {
  if (period === "today") return daily.slice(-2);
  if (period === "week") return daily.slice(-7);
  return daily;
}

function shortAmount(n: number): string {
  if (n >= 1_000_000) return `${formatFaDecimal(n / 1_000_000, 1)}M`;
  if (n >= 10_000) return `${formatFaNumber(Math.round(n / 1_000))}k`;
  return formatFaNumber(n);
}

function dayNumberLabel(date: string): string {
  const day = Number(date.slice(-2));
  return Number.isFinite(day) ? formatFaNumber(day) : date;
}

function ProChart({
  daily,
  period,
  t,
  tomanLabel,
}: {
  daily: AdminShopStatsDaily[];
  period: Period;
  t: (k: string) => string;
  tomanLabel: string;
}) {
  const [active, setActive] = useState<string | null>(null);
  const max = Math.max(1, ...daily.map((d) => d.volumeToman));
  const tipDay = daily.find((d) => d.date === active) ?? null;
  const last = daily[daily.length - 1];
  const dense = daily.length > 10;

  const labelOf = (day: AdminShopStatsDaily, isToday: boolean) => {
    if (isToday) return t("myShop.statToday");
    if (period === "month") return dayNumberLabel(day.date);
    return weekdayLabel(day.weekday, t);
  };

  return (
    <div className={`shop-stats__chart${dense ? " is-dense" : ""}`}>
      <div className="shop-stats__chart-grid" aria-hidden>
        <span />
        <span />
        <span />
        <span />
      </div>

      {tipDay ? (
        <div className="shop-stats__chart-tip shop-stats__chart-tip--wide" role="status">
          <strong>
            {tipDay.date === last?.date
              ? t("myShop.statToday")
              : `${weekdayLabel(tipDay.weekday, t)} · ${dayNumberLabel(tipDay.date)}`}
          </strong>
          <span>
            {formatFaNumber(tipDay.count)} {t("myShop.transactionsUnit")}
          </span>
          <span>
            {formatFaNumber(tipDay.volumeToman)} {tomanLabel}
          </span>
          <span className="is-fee">
            {t("admin.shopStatsFee")}: {formatFaNumber(tipDay.feeToman)}
          </span>
          <span className="is-cost">
            {t("admin.shopStatsGatewayCost")}:{" "}
            {formatFaNumber(tipDay.commissionToman)}
          </span>
          <span className="is-profit">
            {t("admin.shopStatsProfit")}: {formatFaNumber(tipDay.profitToman)}
          </span>
        </div>
      ) : null}

      <div className="shop-stats__chart-bars" role="img" aria-label={t("myShop.thisWeek")}>
        {daily.map((day) => {
          const h =
            day.volumeToman > 0
              ? Math.max(8, Math.round((day.volumeToman / max) * 100))
              : 3;
          const isOn = active === day.date;
          const isToday = day.date === last?.date;
          return (
            <button
              key={day.date}
              type="button"
              className={`shop-stats__chart-col${isOn ? " is-on" : ""}${
                isToday ? " is-today" : ""
              }`}
              aria-pressed={isOn}
              onMouseEnter={() => setActive(day.date)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(day.date)}
              onBlur={() => setActive(null)}
              onClick={() =>
                setActive((prev) => (prev === day.date ? null : day.date))
              }
            >
              {!dense ? (
                <span className="shop-stats__chart-val">
                  {day.volumeToman > 0 ? shortAmount(day.volumeToman) : ""}
                </span>
              ) : (
                <span className="shop-stats__chart-val" />
              )}
              <span className="shop-stats__chart-track">
                <span
                  className="shop-stats__chart-fill"
                  style={{ height: `${h}%` }}
                />
              </span>
              <span className="shop-stats__chart-label">
                {labelOf(day, isToday)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StatusBoard({
  invoices,
  total,
  t,
  tomanLabel,
}: {
  invoices: {
    paid: ShopStatsBucket;
    open: ShopStatsBucket;
    expired: ShopStatsBucket;
    cancelled: ShopStatsBucket;
  };
  total: number;
  t: (k: string) => string;
  tomanLabel: string;
}) {
  const items = [
    { key: "paid", label: t("myShop.linkPaid"), bucket: invoices.paid, tone: "ok" as const },
    { key: "open", label: t("myShop.linkOpen"), bucket: invoices.open, tone: "warn" as const },
    {
      key: "expired",
      label: t("myShop.linkExpired"),
      bucket: invoices.expired,
      tone: "mute" as const,
    },
    {
      key: "cancelled",
      label: t("myShop.linkCancelled"),
      bucket: invoices.cancelled,
      tone: "danger" as const,
    },
  ];

  return (
    <div className="shop-stats__status">
      <div className="shop-stats__status-stack" aria-hidden={total <= 0}>
        {items.map((item) => {
          const w = pct(item.bucket.count, total);
          if (!(w > 0)) return null;
          return (
            <div
              key={item.key}
              className={`shop-stats__status-seg shop-stats__status-seg--${item.tone}`}
              style={{ width: `${w}%` }}
            />
          );
        })}
      </div>
      <div className="shop-stats__status-grid">
        {items.map((item) => (
          <div
            key={item.key}
            className={`shop-stats__status-card shop-stats__status-card--${item.tone}`}
          >
            <div className="shop-stats__status-card-top">
              <span className="shop-stats__status-dot" aria-hidden />
              <span className="shop-stats__status-name">{item.label}</span>
              <strong className="shop-stats__status-share">
                {formatFaDecimal(pct(item.bucket.count, total), 1)}٪
              </strong>
            </div>
            <p className="shop-stats__status-amount">
              {formatFaNumber(item.bucket.volumeToman)}
              <span> {tomanLabel}</span>
            </p>
            <p className="shop-stats__status-count">
              {formatFaNumber(item.bucket.count)} {t("myShop.transactionsUnit")}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminShopStatsPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("week");
  const [data, setData] = useState<AdminShopStatsPayload | null>(null);

  const goBack = () => navigate("/admin");
  useTelegramBackButton(goBack);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const payload = await fetchAdminShopStats();
        if (!cancelled) setData(payload);
      } catch {
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = data?.stats;
  const shops = data?.shops;
  const settlements = data?.settlements;

  const periodDaily = useMemo(
    () => (stats ? sliceDaily(stats.daily, period) : []),
    [stats, period],
  );

  const periodKpi = useMemo(() => {
    if (!stats) {
      return {
        volume: 0,
        count: 0,
        fee: 0,
        commission: 0,
        profit: 0,
        compare: null as number | null,
      };
    }
    if (period === "today") {
      return {
        volume: stats.todayVolumeToman,
        count: stats.todayCount,
        fee: stats.todayFeeToman,
        commission: stats.todayCommissionToman,
        profit: stats.todayProfitToman,
        compare: deltaPct(stats.todayProfitToman, stats.yesterdayProfitToman),
      };
    }
    if (period === "week") {
      return {
        volume: stats.weekVolumeToman,
        count: stats.weekCount,
        fee: stats.weekFeeToman,
        commission: stats.weekCommissionToman,
        profit: stats.weekProfitToman,
        compare: null,
      };
    }
    return {
      volume: stats.monthVolumeToman,
      count: stats.monthCount,
      fee: stats.monthFeeToman,
      commission: stats.monthCommissionToman,
      profit: stats.monthProfitToman,
      compare: null,
    };
  }, [stats, period]);

  const paidTotal =
    (stats?.sources.manual.count ?? 0) + (stats?.sources.api.count ?? 0);
  const invoiceTotal = stats?.invoiceTotalCount ?? 0;
  const sourceVolTotal =
    (stats?.sources.manual.volumeToman ?? 0) +
    (stats?.sources.api.volumeToman ?? 0);
  const tomanLabel = t("wallet.toman");

  return (
    <div className="my-shop my-shop--sub my-shop--stats-page">
      <div className="my-shop__settle-header">
        <PageHeader title={t("admin.shopStatsTitle")} onBack={goBack} />
      </div>

      <div className="my-shop__body shop-stats">
        {loading ? (
          <div
            className="my-shop__gs-skel shop-rise"
            style={{ "--rise-index": 1 } as CSSProperties}
            aria-busy
            aria-label={t("common.loading")}
          >
            <span className="my-shop__gs-skel-hint" />
            <span className="my-shop__gs-skel-hint my-shop__gs-skel-hint--sm" />
            <span className="my-shop__gs-skel-hint" />
          </div>
        ) : !data || !stats || !shops || !settlements ? (
          <EmptyState title={t("admin.shopStatsEmpty")} compact />
        ) : (
          <>
            <section
              className="my-shop__balance shop-stats__hero shop-rise"
              style={{ "--rise-index": 1, margin: 0 } as CSSProperties}
            >
              <div className="my-shop__balance-head">
                <div className="my-shop__shop">
                  <span className="my-shop__shop-avatar" aria-hidden>
                    <span className="my-shop__shop-avatar-fallback">
                      <CashierIcon size={16} />
                    </span>
                  </span>
                  <div className="my-shop__shop-title-row">
                    <h1 className="my-shop__shop-name">
                      {t("admin.shopsTitle")}
                    </h1>
                    <span className="shop-stats__pill">
                      <ChartRoseIcon size={12} />
                      {t("admin.shopStatsTitle")}
                    </span>
                  </div>
                </div>
              </div>

              <div className="my-shop__balance-amount">
                <span className="my-shop__balance-unit">{tomanLabel}</span>
                <span className="my-shop__balance-value">
                  {formatFaNumber(stats.totalVolumeToman)}
                </span>
              </div>
              <p className="shop-stats__hero-caption">
                {t("myShop.statTotalVolume")}
              </p>

              <div className="my-shop__balance-foot">
                <div className="my-shop__balance-stats">
                  <div className="my-shop__balance-stat">
                    <span className="my-shop__balance-stat-main">
                      {formatFaNumber(stats.totalProfitToman)}
                      <span className="my-shop__balance-stat-unit">
                        {tomanLabel}
                      </span>
                    </span>
                    <span className="my-shop__balance-stat-sub">
                      {t("admin.shopStatsNetProfit")}
                    </span>
                  </div>
                  <span className="my-shop__balance-stat-sep" aria-hidden />
                  <div className="my-shop__balance-stat">
                    <span className="my-shop__balance-stat-main">
                      {formatFaNumber(stats.totalFeeToman)}
                      <span className="my-shop__balance-stat-unit">
                        {tomanLabel}
                      </span>
                    </span>
                    <span className="my-shop__balance-stat-sub">
                      {t("admin.shopStatsFee")}
                    </span>
                  </div>
                  <span className="my-shop__balance-stat-sep" aria-hidden />
                  <div className="my-shop__balance-stat">
                    <span className="my-shop__balance-stat-main">
                      {formatFaNumber(stats.totalCommissionToman)}
                      <span className="my-shop__balance-stat-unit">
                        {tomanLabel}
                      </span>
                    </span>
                    <span className="my-shop__balance-stat-sub">
                      {t("admin.shopStatsGatewayCost")}
                    </span>
                  </div>
                </div>
              </div>
            </section>

            <div
              className="shop-stats__periods shop-rise"
              style={{ "--rise-index": 2 } as CSSProperties}
              role="tablist"
              aria-label={t("myShop.statPeriod")}
            >
              {(
                [
                  ["today", "myShop.statPeriodToday", Sun01Icon],
                  ["week", "myShop.statPeriodWeek", Calendar03Icon],
                  ["month", "myShop.statPeriodMonth", ChartRoseIcon],
                ] as const
              ).map(([id, labelKey, Icon]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={period === id}
                  className={`shop-stats__period${period === id ? " is-active" : ""}`}
                  onClick={() => setPeriod(id)}
                >
                  <Icon size={15} color="currentColor" />
                  <span>{t(labelKey)}</span>
                </button>
              ))}
            </div>

            <section
              className="shop-stats__kpi shop-rise"
              style={{ "--rise-index": 3 } as CSSProperties}
            >
              <div className="shop-stats__kpi-card shop-stats__kpi-card--main">
                <p className="shop-stats__kpi-label">
                  {t("admin.shopStatsProfit")}
                </p>
                <p className="shop-stats__kpi-value">
                  {formatFaNumber(periodKpi.profit)}
                  <span>{tomanLabel}</span>
                </p>
                {period === "today" && periodKpi.compare != null ? (
                  <p
                    className={`shop-stats__kpi-delta${
                      periodKpi.compare >= 0 ? " is-up" : " is-down"
                    }`}
                  >
                    {periodKpi.compare >= 0 ? "+" : ""}
                    {formatFaDecimal(periodKpi.compare, 1)}٪{" "}
                    {t("myShop.statVsYesterday")}
                  </p>
                ) : (
                  <p className="shop-stats__kpi-delta">
                    {formatFaNumber(periodKpi.count)} {t("myShop.transactionsUnit")}
                  </p>
                )}
              </div>
              <div className="shop-stats__kpi-side">
                <div className="shop-stats__kpi-card">
                  <p className="shop-stats__kpi-label">
                    {t("admin.shopStatsFee")}
                  </p>
                  <p className="shop-stats__kpi-value shop-stats__kpi-value--sm">
                    {formatFaNumber(periodKpi.fee)}
                  </p>
                </div>
                <div className="shop-stats__kpi-card">
                  <p className="shop-stats__kpi-label">
                    {t("admin.shopStatsGatewayCost")}
                  </p>
                  <p className="shop-stats__kpi-value shop-stats__kpi-value--sm">
                    {formatFaNumber(periodKpi.commission)}
                  </p>
                </div>
              </div>
            </section>

            <section
              className="shop-stats__panel shop-rise"
              style={{ "--rise-index": 4 } as CSSProperties}
            >
              <div className="shop-stats__panel-head">
                <h2 className="shop-stats__panel-title">
                  {t("admin.shopStatsPnL")}
                </h2>
              </div>
              <div className="shop-stats__cash shop-stats__cash--pnl">
                <div className="shop-stats__cash-cell shop-stats__cash-cell--ok">
                  <span className="shop-stats__cash-label">
                    {t("myShop.statPeriodVolume")}
                  </span>
                  <strong>{formatFaNumber(periodKpi.volume)}</strong>
                </div>
                <div className="shop-stats__cash-cell shop-stats__cash-cell--fee">
                  <span className="shop-stats__cash-label">
                    {t("admin.shopStatsFee")}
                  </span>
                  <strong>{formatFaNumber(periodKpi.fee)}</strong>
                </div>
                <div className="shop-stats__cash-cell shop-stats__cash-cell--cost">
                  <span className="shop-stats__cash-label">
                    {t("admin.shopStatsGatewayCost")}
                  </span>
                  <strong>{formatFaNumber(periodKpi.commission)}</strong>
                </div>
              </div>
              <p className="shop-stats__hint">{t("admin.shopStatsPnLHint")}</p>
            </section>

            <section
              className="shop-stats__panel shop-rise"
              style={{ "--rise-index": 5 } as CSSProperties}
            >
              <div className="shop-stats__panel-head">
                <h2 className="shop-stats__panel-title">
                  {period === "today"
                    ? t("myShop.statToday")
                    : period === "week"
                      ? t("myShop.thisWeek")
                      : t("myShop.statLast30")}
                </h2>
                <span className="shop-stats__panel-meta">
                  {formatFaNumber(periodKpi.volume)} {tomanLabel}
                </span>
              </div>
              {periodDaily.every((d) => d.volumeToman === 0) ? (
                <EmptyState title={t("myShop.noTransactionsYet")} compact />
              ) : (
                <ProChart
                  daily={periodDaily}
                  period={period}
                  t={t}
                  tomanLabel={tomanLabel}
                />
              )}
            </section>

            <section
              className="shop-stats__panel shop-rise"
              style={{ "--rise-index": 6 } as CSSProperties}
            >
              <div className="shop-stats__panel-head">
                <h2 className="shop-stats__panel-title">
                  {t("admin.shopStatsShops")}
                </h2>
                <button
                  type="button"
                  className="my-shop__ghost-link"
                  onClick={() => navigate("/admin/shops")}
                >
                  {t("admin.shopsTitle")}
                </button>
              </div>
              <div className="shop-stats__cash">
                <div className="shop-stats__cash-cell">
                  <span className="shop-stats__cash-label">
                    {t("admin.shopsTabActive")}
                  </span>
                  <strong>{formatFaNumber(shops.active)}</strong>
                </div>
                <div className="shop-stats__cash-cell">
                  <span className="shop-stats__cash-label">
                    {t("admin.shopsTabPending")}
                  </span>
                  <strong>{formatFaNumber(shops.pending)}</strong>
                </div>
                <div className="shop-stats__cash-cell">
                  <span className="shop-stats__cash-label">
                    {t("admin.shopStatsAllShops")}
                  </span>
                  <strong>{formatFaNumber(shops.total)}</strong>
                </div>
              </div>
            </section>

            <section
              className="shop-stats__panel shop-rise"
              style={{ "--rise-index": 7 } as CSSProperties}
            >
              <div className="shop-stats__panel-head">
                <h2 className="shop-stats__panel-title">
                  {t("admin.settlementsTitle")}
                </h2>
                <button
                  type="button"
                  className="my-shop__ghost-link"
                  onClick={() => navigate("/admin/settlements")}
                >
                  {t("myShop.viewAll")}
                </button>
              </div>
              <div className="shop-stats__cash">
                <div className="shop-stats__cash-cell">
                  <span className="shop-stats__cash-label">
                    {t("admin.shopStatsSettlePending")}
                  </span>
                  <strong>
                    {formatFaNumber(settlements.pendingVolumeToman)}
                  </strong>
                </div>
                <div className="shop-stats__cash-cell">
                  <span className="shop-stats__cash-label">
                    {t("myShop.settlePaid")}
                  </span>
                  <strong>
                    {formatFaNumber(settlements.paid.volumeToman)}
                  </strong>
                </div>
                <div className="shop-stats__cash-cell">
                  <span className="shop-stats__cash-label">
                    {t("admin.shopStatsSettleCount")}
                  </span>
                  <strong>{formatFaNumber(settlements.pendingCount)}</strong>
                </div>
              </div>
            </section>

            <section
              className="shop-stats__panel shop-rise"
              style={{ "--rise-index": 8 } as CSSProperties}
            >
              <div className="shop-stats__panel-head">
                <h2 className="shop-stats__panel-title">
                  {t("myShop.statBySource")}
                </h2>
              </div>
              <div className="shop-stats__split" aria-hidden={sourceVolTotal <= 0}>
                <div
                  className="shop-stats__split-a"
                  style={{
                    width: `${pct(stats.sources.manual.volumeToman, sourceVolTotal) || 50}%`,
                  }}
                />
                <div
                  className="shop-stats__split-b"
                  style={{
                    width: `${pct(stats.sources.api.volumeToman, sourceVolTotal) || 50}%`,
                  }}
                />
              </div>
              <div className="shop-stats__source-grid">
                <div className="shop-stats__source-card">
                  <span className="shop-stats__source-icon" aria-hidden>
                    <Invoice04Icon size={15} />
                  </span>
                  <div className="shop-stats__source-body">
                    <span className="shop-stats__source-title">
                      {t("myShop.txTabManual")}
                    </span>
                    <span className="shop-stats__source-sub">
                      {formatFaNumber(stats.sources.manual.count)} ·{" "}
                      {formatFaDecimal(
                        pct(stats.sources.manual.count, paidTotal),
                        1,
                      )}
                      ٪
                    </span>
                    <strong>
                      {formatFaNumber(stats.sources.manual.volumeToman)}{" "}
                      <span>{tomanLabel}</span>
                    </strong>
                  </div>
                </div>
                <div className="shop-stats__source-card">
                  <span className="shop-stats__source-icon" aria-hidden>
                    <ApiIcon size={15} />
                  </span>
                  <div className="shop-stats__source-body">
                    <span className="shop-stats__source-title">
                      {t("myShop.txTabApi")}
                    </span>
                    <span className="shop-stats__source-sub">
                      {formatFaNumber(stats.sources.api.count)} ·{" "}
                      {formatFaDecimal(pct(stats.sources.api.count, paidTotal), 1)}٪
                    </span>
                    <strong>
                      {formatFaNumber(stats.sources.api.volumeToman)}{" "}
                      <span>{tomanLabel}</span>
                    </strong>
                  </div>
                </div>
              </div>
            </section>

            <section
              className="shop-stats__panel shop-rise"
              style={{ "--rise-index": 9 } as CSSProperties}
            >
              <div className="shop-stats__panel-head">
                <h2 className="shop-stats__panel-title">
                  {t("myShop.statByInvoiceStatus")}
                </h2>
                <span className="shop-stats__panel-meta">
                  {formatFaNumber(invoiceTotal)} {t("myShop.transactionsUnit")}
                </span>
              </div>
              <StatusBoard
                invoices={stats.invoices}
                total={invoiceTotal}
                t={t}
                tomanLabel={tomanLabel}
              />
            </section>

            <section
              className="shop-stats__panel shop-rise"
              style={{ "--rise-index": 10 } as CSSProperties}
            >
              <div className="shop-stats__panel-head">
                <h2 className="shop-stats__panel-title">
                  {t("admin.shopStatsTopShops")}
                </h2>
                <span className="shop-stats__panel-meta">
                  {t("myShop.statLast30")}
                </span>
              </div>
              {stats.topShops.length === 0 ? (
                <EmptyState title={t("myShop.noStoresYet")} compact />
              ) : (
                <div className="shop-stats__top-list" role="list">
                  {stats.topShops.map((shop, index) => (
                    <div
                      key={shop.id}
                      className="shop-stats__top-row"
                      role="listitem"
                    >
                      <span className="shop-stats__top-rank" aria-hidden>
                        {formatFaNumber(index + 1)}
                      </span>
                      <span className="shop-stats__top-avatar" aria-hidden>
                        {shop.logoDataUrl ? (
                          <img
                            src={shop.logoDataUrl}
                            alt=""
                            width={28}
                            height={28}
                            decoding="async"
                          />
                        ) : (
                          shop.name.slice(0, 1)
                        )}
                      </span>
                      <div className="shop-stats__top-body">
                        <span className="shop-stats__top-name">{shop.name}</span>
                        <span className="shop-stats__top-sub">
                          {shop.owner} · {formatFaNumber(shop.count)}{" "}
                          {t("myShop.transactionsUnit")}
                        </span>
                      </div>
                      <div className="shop-stats__top-end">
                        <strong>{formatFaNumber(shop.volumeToman)}</strong>
                        <span className="is-profit">
                          {formatFaNumber(shop.profitToman)}{" "}
                          {t("admin.shopStatsProfit")}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <div
              className="shop-stats__actions shop-rise"
              style={{ "--rise-index": 11 } as CSSProperties}
            >
              <button
                type="button"
                className="shop-stats__action"
                onClick={() => navigate("/admin/shops")}
              >
                <span className="shop-stats__action-icon" aria-hidden>
                  <CashierIcon size={16} />
                </span>
                <span className="shop-stats__action-copy">
                  <span className="shop-stats__action-title">
                    {t("admin.shopsTitle")}
                  </span>
                  <span className="shop-stats__action-hint">
                    {t("admin.shopsHint")}
                  </span>
                </span>
              </button>
              <button
                type="button"
                className="shop-stats__action"
                onClick={() => navigate("/admin/settlements")}
              >
                <span className="shop-stats__action-icon" aria-hidden>
                  <MoneySendSquareIcon size={16} />
                </span>
                <span className="shop-stats__action-copy">
                  <span className="shop-stats__action-title">
                    {t("admin.settlementsTitle")}
                  </span>
                  <span className="shop-stats__action-hint">
                    {t("admin.settlementsHint")}
                  </span>
                </span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
