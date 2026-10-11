import { useEffect, useState, type ComponentType, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { EmptyState } from "../components/EmptyState";
import { ShopTransactionRow } from "../components/shop/ShopTransactionRow";
import ApiIcon from "../components/icons/hugeicons/ApiIcon";
import CashierIcon from "../components/icons/hugeicons/CashierIcon";
import ChartRoseIcon from "../components/icons/hugeicons/ChartRoseIcon";
import PayByCheckIcon from "../components/icons/hugeicons/PayByCheckIcon";
import Invoice04Icon from "../components/icons/hugeicons/Invoice04Icon";
import Quiz05Icon from "../components/icons/hugeicons/Quiz05Icon";
import Robot01Icon from "../components/icons/hugeicons/Robot01Icon";
import Settings01Icon from "../components/icons/hugeicons/Settings01Icon";
import TransactionHistoryIcon from "../components/icons/hugeicons/TransactionHistoryIcon";
import type { HugeIconProps } from "../components/icons/hugeicons/constants";
import { useI18n } from "../context/I18nContext";
import { useAuth } from "../hooks/useAuth";
import { useTelegram } from "../hooks/useTelegram";
import { sessionDataChanged } from "../lib/api";
import { formatFaNumber } from "../lib/format";
import {
  fetchShopHub,
  shopIsActive,
  type MerchantShop,
  type ShopHubPayload,
  type ShopStoreStatus,
} from "../lib/shop";
import "../styles/shop-rise.css";
import "./Wallet.css";
import "./MyShop.css";

type Tile = {
  id: string;
  labelKey: string;
  hintKey?: string;
  path: string;
  Icon: ComponentType<HugeIconProps>;
};

/** Rows: 2 · 1 · 2 · 1 · 2 — manual invoice alone on row 2; report bot above API/settings */
const NAV_ROWS: Tile[][] = [
  [
    {
      id: "transactions",
      labelKey: "myShop.tileTransactions",
      hintKey: "myShop.tileTransactionsHint",
      path: "/shop/transactions",
      Icon: TransactionHistoryIcon,
    },
    {
      id: "settlements",
      labelKey: "myShop.tileSettlements",
      hintKey: "myShop.tileSettlementsHint",
      path: "/shop/settlements",
      Icon: PayByCheckIcon,
    },
  ],
  [
    {
      id: "payment-links",
      labelKey: "myShop.tilePaymentLinks",
      hintKey: "myShop.tilePaymentLinksHint",
      path: "/shop/payment-links",
      Icon: Invoice04Icon,
    },
  ],
  [
    {
      id: "stores",
      labelKey: "myShop.tileStores",
      hintKey: "myShop.tileStoresHint",
      path: "/shop/stores",
      Icon: CashierIcon,
    },
    {
      id: "stats",
      labelKey: "myShop.tileStats",
      hintKey: "myShop.tileStatsHint",
      path: "/shop/stats",
      Icon: ChartRoseIcon,
    },
  ],
  [
    {
      id: "report-bot",
      labelKey: "myShop.tileReportBot",
      hintKey: "myShop.tileReportBotHint",
      path: "/shop/report-bot",
      Icon: Robot01Icon,
    },
  ],
  [
    {
      id: "api",
      labelKey: "myShop.tileApi",
      hintKey: "myShop.tileApiHint",
      path: "/shop/api",
      Icon: ApiIcon,
    },
    {
      id: "gateway-settings",
      labelKey: "myShop.tileGatewaySettings",
      hintKey: "myShop.tileGatewaySettingsHint",
      path: "/shop/settings",
      Icon: Settings01Icon,
    },
  ],
];

function shopStatusLabel(status: ShopStoreStatus, t: (k: string) => string): string {
  if (status === "active") return t("myShop.statusActive");
  if (status === "pending") return t("myShop.statusPending");
  if (status === "rejected") return t("myShop.statusRejected");
  return t("myShop.statusSuspended");
}

function shopStatusClass(status: ShopStoreStatus): string {
  if (status === "active") return "my-shop__shop-badge my-shop__shop-badge--on";
  if (status === "pending") return "my-shop__shop-badge my-shop__shop-badge--wait";
  return "my-shop__shop-badge my-shop__shop-badge--off";
}

function MenuChevron({ flip }: { flip?: boolean }) {
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

function statusBarCopy(shop: MerchantShop | null, t: (k: string) => string) {
  if (!shop) {
    return {
      text: t("myShop.emptyTitle"),
      cta: t("myShop.emptyCta"),
      clickable: true,
    };
  }
  if (shop.status === "pending") {
    return {
      text: t("myShop.pendingTitle"),
      cta: t("myShop.pendingCta"),
      clickable: false,
    };
  }
  if (shop.status === "rejected") {
    return {
      text: shop.reviewNote?.trim() || t("myShop.rejectedTitle"),
      cta: t("myShop.rejectedCta"),
      clickable: true,
    };
  }
  if (shop.status === "suspended") {
    return {
      text: t("myShop.suspendedTitle"),
      cta: t("myShop.suspendedCta"),
      clickable: false,
    };
  }
  return null;
}

export function MyShopPage() {
  const { t, isRTL } = useI18n();
  const navigate = useNavigate();
  const { haptic } = useTelegram();
  const { shopHub, applyShopHub } = useAuth();

  const [hub, setHub] = useState<ShopHubPayload | null>(() =>
    shopHub !== undefined ? (shopHub as ShopHubPayload) : null,
  );
  const [loading, setLoading] = useState(() => shopHub === undefined);

  useEffect(() => {
    if (shopHub === undefined) return;
    setHub((prev) => {
      if (prev && !sessionDataChanged(prev, shopHub)) return prev;
      return shopHub as ShopHubPayload;
    });
    setLoading(false);
  }, [shopHub]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await fetchShopHub();
        if (cancelled) return;
        setHub((prev) => {
          if (prev && !sessionDataChanged(prev, data)) return prev;
          return data;
        });
        applyShopHub(data);
      } catch {
        if (!cancelled && shopHub === undefined) setHub(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Mount-only background revalidate (stale-while-revalidate).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyShopHub]);

  const shop = hub?.shop ?? null;
  const active = shopIsActive(shop);
  const isPending = shop?.status === "pending";
  const interactive = active;
  /** Status CTA bar only when no shop / rejected / suspended — not while pending review */
  const showStatusBar = !shop || shop.status === "rejected" || shop.status === "suspended";
  const bar = statusBarCopy(shop, t);
  const shellClass = active
    ? "my-shop"
    : isPending
      ? "my-shop my-shop--pending"
      : "my-shop my-shop--inactive";

  const shopName = shop?.name ?? t("myShop.emptyShopName");
  const shopStatus: ShopStoreStatus = shop?.status ?? "suspended";
  const available = hub?.balance.availableToman ?? 0;
  const pending = hub?.balance.pendingToman ?? 0;
  const todayCount = hub?.stats.todayCount ?? 0;
  const todayVolume = hub?.stats.todayVolumeToman ?? 0;
  const rise = (n: number) => (showStatusBar ? n + 1 : n);

  const goRegister = () => {
    if (shop?.status === "pending" || shop?.status === "suspended") return;
    haptic("light");
    navigate("/shop/stores/new");
  };

  const onNav = (path: string) => {
    if (!interactive) return;
    haptic("light");
    navigate(path);
  };

  return (
    <div className={shellClass}>
      {showStatusBar && bar ? (
        <button
          type="button"
          className="my-shop__status-bar shop-rise"
          style={{ "--rise-index": 0 } as CSSProperties}
          onClick={bar.clickable ? goRegister : undefined}
          disabled={!bar.clickable || loading}
        >
          <span className="my-shop__status-bar-icon" aria-hidden>
            <Quiz05Icon size={18} color="currentColor" />
          </span>
          <span className="my-shop__status-bar-copy">
            <span className="my-shop__status-bar-text">{bar.text}</span>
            <span className="my-shop__status-bar-cta">{bar.cta}</span>
          </span>
        </button>
      ) : null}

      <div className="my-shop__top" aria-disabled={!interactive && !isPending}>
        <section
          className="my-shop__balance shop-rise"
          style={{ "--rise-index": rise(0) } as CSSProperties}
          aria-label={shopName}
        >
          <div className="my-shop__balance-head">
            <div className="my-shop__shop">
              <span className="my-shop__shop-avatar" aria-hidden>
                {shop?.logoDataUrl ? (
                  <img src={shop.logoDataUrl} alt="" width={28} height={28} decoding="async" />
                ) : (
                  <span className="my-shop__shop-avatar-fallback">
                    {shopName.slice(0, 1)}
                  </span>
                )}
              </span>
              <div className="my-shop__shop-title-row">
                <h1 className="my-shop__shop-name">{shopName}</h1>
                <span className={shopStatusClass(shopStatus)}>
                  {shop
                    ? shopStatusLabel(shopStatus, t)
                    : t("myShop.statusInactive")}
                </span>
              </div>
            </div>
          </div>

          <div className="my-shop__balance-amount">
            <span className="my-shop__balance-unit">{t("wallet.toman")}</span>
            <span className="my-shop__balance-value">{formatFaNumber(available)}</span>
          </div>

          <div className="my-shop__balance-foot">
            <div className="my-shop__balance-stats">
              <div className="my-shop__balance-stat">
                <span className="my-shop__balance-stat-main">
                  {formatFaNumber(todayCount)}
                </span>
                <span className="my-shop__balance-stat-sub">{t("myShop.statTodayCount")}</span>
              </div>
              <span className="my-shop__balance-stat-sep" aria-hidden />
              <div className="my-shop__balance-stat">
                <span className="my-shop__balance-stat-main">
                  {formatFaNumber(todayVolume)}
                  <span className="my-shop__balance-stat-unit">{t("wallet.toman")}</span>
                </span>
                <span className="my-shop__balance-stat-sub">{t("myShop.statTodayVolume")}</span>
              </div>
              <span className="my-shop__balance-stat-sep" aria-hidden />
              <div className="my-shop__balance-stat">
                <span className="my-shop__balance-stat-main">
                  {formatFaNumber(pending)}
                  <span className="my-shop__balance-stat-unit">{t("wallet.toman")}</span>
                </span>
                <span className="my-shop__balance-stat-sub">{t("myShop.pendingBalance")}</span>
              </div>
            </div>
          </div>
        </section>

        <section
          className="my-shop__menu shop-rise"
          style={{ "--rise-index": rise(1) } as CSSProperties}
          aria-label={t("myShop.sectionServices")}
        >
          {NAV_ROWS.map((row, rowIndex) => (
            <div
              key={`row-${rowIndex}`}
              className={`my-shop__menu-row my-shop__menu-row--${row.length}`}
            >
              {row.map((tile) => {
                const Icon = tile.Icon;
                return (
                  <button
                    key={tile.id}
                    type="button"
                    className="my-shop__menu-item"
                    disabled={!interactive}
                    onClick={() => onNav(tile.path)}
                  >
                    <span className="my-shop__menu-icon" aria-hidden>
                      <Icon width={18} height={18} size={18} />
                    </span>
                    <span className="my-shop__menu-copy">
                      <span className="my-shop__menu-label">{t(tile.labelKey)}</span>
                      {tile.hintKey ? (
                        <span className="my-shop__menu-hint">{t(tile.hintKey)}</span>
                      ) : null}
                    </span>
                    <span className="my-shop__menu-chevron" aria-hidden>
                      <MenuChevron flip={!isRTL} />
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </section>
      </div>

      <section
        className="my-shop__tx-section shop-rise"
        style={{ "--rise-index": rise(2) } as CSSProperties}
      >
        <div className="my-shop__tx-head">
          <h2 className="my-shop__tx-title">{t("myShop.recentTransactions")}</h2>
          <button
            type="button"
            className="my-shop__ghost-link"
            disabled={!interactive}
            onClick={() => onNav("/shop/transactions")}
          >
            {t("myShop.viewAll")}
          </button>
        </div>

        <div className="wallet__transactions">
          {(hub?.recentTransactions?.length ?? 0) === 0 ? (
            <EmptyState title={t("myShop.noTransactionsYet")} compact />
          ) : (
            hub!.recentTransactions.map((tx) => (
              <ShopTransactionRow
                key={tx.id}
                tx={tx}
                tomanLabel={t("wallet.toman")}
                trxEquivLabel={(amount) =>
                  t("myShop.txTrxAtTime", { amount })
                }
                onClick={() => onNav(`/shop/transactions/${tx.id}`)}
              />
            ))
          )}
        </div>
      </section>
    </div>
  );
}
