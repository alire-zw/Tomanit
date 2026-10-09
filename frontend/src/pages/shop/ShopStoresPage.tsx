import { useEffect, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { EmptyState } from "../../components/EmptyState";
import { PageHeader } from "../../components/PageHeader";
import PlusIcon from "../../components/icons/PlusIcon";
import ApiIcon from "../../components/icons/hugeicons/ApiIcon";
import ChartRoseIcon from "../../components/icons/hugeicons/ChartRoseIcon";
import HoldPhoneIcon from "../../components/icons/hugeicons/HoldPhoneIcon";
import Invoice04Icon from "../../components/icons/hugeicons/Invoice04Icon";
import PayByCheckIcon from "../../components/icons/hugeicons/PayByCheckIcon";
import RoboticIcon from "../../components/icons/hugeicons/RoboticIcon";
import Settings01Icon from "../../components/icons/hugeicons/Settings01Icon";
import ShoppingBag02Icon from "../../components/icons/hugeicons/ShoppingBag02Icon";
import TransactionHistoryIcon from "../../components/icons/hugeicons/TransactionHistoryIcon";
import WebDesign01Icon from "../../components/icons/hugeicons/WebDesign01Icon";
import { useI18n } from "../../context/I18nContext";
import { useAuth } from "../../hooks/useAuth";
import { useTelegram } from "../../hooks/useTelegram";
import { sessionDataChanged } from "../../lib/api";
import { formatFaDate, formatFaNumber } from "../../lib/format";
import {
  fetchShopHub,
  type MerchantShop,
  type ShopChannel,
  type ShopHubPayload,
  type ShopStoreStatus,
} from "../../lib/shop";
import "../../styles/shop-rise.css";
import "../MyShop.css";
import "./ShopStores.css";

function statusBadge(status: ShopStoreStatus, t: (k: string) => string) {
  if (status === "active") return { cls: "mystore-card__badge--ok", label: t("myShop.statusActive") };
  if (status === "pending") return { cls: "mystore-card__badge--warn", label: t("myShop.statusPending") };
  if (status === "rejected") return { cls: "mystore-card__badge--err", label: t("myShop.statusRejected") };
  return { cls: "mystore-card__badge--mute", label: t("myShop.statusSuspended") };
}

function channelLabel(channel: ShopChannel, t: (k: string) => string) {
  if (channel === "website") return t("myShop.regChannelWebsite");
  if (channel === "bot") return t("myShop.regChannelBot");
  return t("myShop.regChannelManual");
}

function ChannelIcon({ channel }: { channel: ShopChannel }) {
  if (channel === "website") return <WebDesign01Icon size={14} color="currentColor" />;
  if (channel === "bot") return <RoboticIcon size={14} color="currentColor" />;
  return <HoldPhoneIcon size={14} color="currentColor" />;
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`mystore-card__toggle-chevron${open ? " is-open" : ""}`}
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

function stripUrl(url: string) {
  return url.replace(/^https?:\/\//, "");
}

export function ShopStoresPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { haptic } = useTelegram();
  const { shopHub, applyShopHub } = useAuth();
  const [hub, setHub] = useState<ShopHubPayload | null>(() =>
    shopHub !== undefined ? (shopHub as ShopHubPayload) : null,
  );
  const [loading, setLoading] = useState(() => shopHub === undefined);
  const [expanded, setExpanded] = useState(true);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyShopHub]);

  const shop = hub?.shop ?? null;
  const canCreate = !shop || shop.status === "rejected";
  const balance = hub?.balance.availableToman ?? 0;
  const totalCount = hub?.stats.totalCount ?? 0;
  const totalVolume = hub?.stats.totalVolumeToman ?? 0;
  const isActive = shop?.status === "active";

  const toggleExpand = () => {
    haptic("light");
    setExpanded((v) => !v);
  };

  const go = (path: string) => {
    haptic("light");
    navigate(path);
  };

  return (
    <div className="my-shop my-shop--sub">
      <div className="shop-rise" style={{ "--rise-index": 0 } as CSSProperties}>
        <PageHeader
          title={t("myShop.tileStores")}
          onBack={() => navigate("/shop")}
          action={
            canCreate ? (
              <button
                type="button"
                className="my-shop__icon-btn"
                aria-label={t("myShop.createStore")}
                onClick={() => {
                  haptic("light");
                  navigate("/shop/stores/new");
                }}
              >
                <PlusIcon width={18} height={18} />
              </button>
            ) : undefined
          }
        />
      </div>

      <div className="my-shop__body">
        <p className="my-shop__hint shop-rise" style={{ "--rise-index": 1 } as CSSProperties}>
          {t("myShop.storesIntro")}
        </p>

        {loading ? (
          <div
            className="mystore-list shop-rise"
            style={{ "--rise-index": 2 } as CSSProperties}
            aria-busy
            aria-label={t("common.loading")}
          >
            <article className="mystore-card mystore-card--skel">
              <div className="mystore-card__top">
                <span className="mystore-card__icon mystore-card__skel-block" />
                <div className="mystore-card__head">
                  <span className="mystore-card__skel-line mystore-card__skel-line--title" />
                  <span className="mystore-card__skel-line mystore-card__skel-line--meta" />
                </div>
                <span className="mystore-card__skel-btn" />
              </div>
              <div className="mystore-card__summary">
                <span className="mystore-card__skel-chip" />
                <span className="mystore-card__skel-chip" />
                <span className="mystore-card__skel-chip" />
              </div>
            </article>
          </div>
        ) : !shop ? (
          <EmptyState title={t("myShop.noStoresYet")} compact />
        ) : (
          <div
            className="mystore-list shop-rise"
            style={{ "--rise-index": 2 } as CSSProperties}
          >
            <StoreCard
              shop={shop}
              balance={balance}
              totalCount={totalCount}
              totalVolume={totalVolume}
              expanded={expanded}
              active={isActive}
              onToggle={toggleExpand}
              onInvoices={() => go("/shop/payment-links")}
              onTransactions={() => go("/shop/transactions")}
              onSettlements={() => go("/shop/settlements")}
              onStats={() => go("/shop/stats")}
              onApi={() => go("/shop/api")}
              onSettings={() => go("/shop/settings")}
              t={t}
            />
          </div>
        )}
      </div>

      {canCreate ? (
        <div
          className="my-shop__footer shop-rise"
          style={{ "--rise-index": 3 } as CSSProperties}
        >
          <button
            type="button"
            className="my-shop__cta"
            onClick={() => {
              haptic("medium");
              navigate("/shop/stores/new");
            }}
          >
            {t("myShop.createStore")}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function StoreCard({
  shop,
  balance,
  totalCount,
  totalVolume,
  expanded,
  active,
  onToggle,
  onInvoices,
  onTransactions,
  onSettlements,
  onStats,
  onApi,
  onSettings,
  t,
}: {
  shop: MerchantShop;
  balance: number;
  totalCount: number;
  totalVolume: number;
  expanded: boolean;
  active: boolean;
  onToggle: () => void;
  onInvoices: () => void;
  onTransactions: () => void;
  onSettlements: () => void;
  onStats: () => void;
  onApi: () => void;
  onSettings: () => void;
  t: (k: string) => string;
}) {
  const badge = statusBadge(shop.status, t);
  const sellLabel =
    shop.sellType === "services"
      ? t("myShop.regSellServices")
      : t("myShop.regSellGoods");
  const channel = channelLabel(shop.channel, t);
  const linkUrl = shop.siteUrl || shop.botUrl || null;
  const linkLabel = shop.siteUrl
    ? t("myShop.regWebsiteUrl")
    : shop.botUrl
      ? t("myShop.regBotUrl")
      : null;
  const sub =
    (linkUrl ? stripUrl(linkUrl) : null) ||
    sellLabel;

  return (
    <article className={`mystore-card${expanded ? " is-expanded" : ""}`}>
      <div className="mystore-card__top" onClick={onToggle}>
        <span className="mystore-card__icon" aria-hidden>
          {shop.logoDataUrl ? (
            <img src={shop.logoDataUrl} alt="" width={18} height={18} />
          ) : (
            <ShoppingBag02Icon size={18} color="currentColor" />
          )}
        </span>
        <div className="mystore-card__head">
          <strong className="mystore-card__name">{shop.name}</strong>
          <div className="mystore-card__meta">
            <span className="mystore-card__type">{sub}</span>
            <span className={`mystore-card__badge ${badge.cls}`}>{badge.label}</span>
          </div>
        </div>
        <button
          type="button"
          className="mystore-card__toggle"
          aria-expanded={expanded}
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
        >
          <span>{expanded ? t("myShop.storeCollapse") : t("myShop.storeExpand")}</span>
          <ChevronIcon open={expanded} />
        </button>
      </div>

      {!expanded ? (
        <div className="mystore-card__summary" onClick={onToggle}>
          <div className="mystore-card__chip">
            <span className="mystore-card__chip-label">{t("myShop.storeBalance")}</span>
            <strong className="mystore-card__chip-value">
              {formatFaNumber(balance)}
              <small>{t("wallet.toman")}</small>
            </strong>
          </div>
          <div className="mystore-card__chip">
            <span className="mystore-card__chip-label">{t("myShop.storeTxCount")}</span>
            <strong className="mystore-card__chip-value">{formatFaNumber(totalCount)}</strong>
          </div>
          <div className="mystore-card__chip mystore-card__chip--accent">
            <span className="mystore-card__chip-label">{t("myShop.storeTxVolume")}</span>
            <strong className="mystore-card__chip-value">
              {formatFaNumber(totalVolume)}
              <small>{t("wallet.toman")}</small>
            </strong>
          </div>
        </div>
      ) : null}

      <div className={`mystore-card__expandable${expanded ? " is-open" : ""}`}>
        <div className="mystore-card__expandable-inner">
          <div className="mystore-card__stats">
            <div className="mystore-card__stat">
              <span className="mystore-card__stat-label">{t("myShop.storeBalance")}</span>
              <span className="mystore-card__stat-value">
                {formatFaNumber(balance)} {t("wallet.toman")}
              </span>
            </div>
            <div className="mystore-card__stat">
              <span className="mystore-card__stat-label">{t("myShop.storeTxCount")}</span>
              <span className="mystore-card__stat-value">{formatFaNumber(totalCount)}</span>
            </div>
            <div className="mystore-card__stat">
              <span className="mystore-card__stat-label">{t("myShop.storeTxVolume")}</span>
              <span className="mystore-card__stat-value">
                {formatFaNumber(totalVolume)} {t("wallet.toman")}
              </span>
            </div>
          </div>

          <div className="mystore-card__facts">
            <div className="mystore-card__fact-row">
              <div className="mystore-card__fact">
                <span className="mystore-card__fact-label">{t("myShop.merchantPayShopSellType")}</span>
                <span className="mystore-card__fact-value">{sellLabel}</span>
              </div>
              <div className="mystore-card__fact">
                <span className="mystore-card__fact-label">{t("myShop.merchantPayShopChannel")}</span>
                <span className="mystore-card__fact-value mystore-card__fact-value--row">
                  <ChannelIcon channel={shop.channel} />
                  {channel}
                </span>
              </div>
            </div>
            {linkUrl && linkLabel ? (
              <div className="mystore-card__fact">
                <span className="mystore-card__fact-label">{linkLabel}</span>
                <span className="mystore-card__fact-value mystore-card__fact-value--url">
                  {stripUrl(linkUrl)}
                </span>
              </div>
            ) : null}
            <div className="mystore-card__fact-row">
              <div className="mystore-card__fact">
                <span className="mystore-card__fact-label">{t("myShop.regDailyAmount")}</span>
                <span className="mystore-card__fact-value">
                  {formatFaNumber(shop.dailyAmountToman)} {t("wallet.toman")}
                </span>
              </div>
              <div className="mystore-card__fact">
                <span className="mystore-card__fact-label">{t("myShop.regDailyCount")}</span>
                <span className="mystore-card__fact-value">{formatFaNumber(shop.dailyCount)}</span>
              </div>
            </div>
            <div className="mystore-card__fact">
              <span className="mystore-card__fact-label">{t("myShop.storeCreatedAt")}</span>
              <span className="mystore-card__fact-value">{formatFaDate(shop.createdAt)}</span>
            </div>
            {shop.reviewNote?.trim() ? (
              <div className="mystore-card__fact mystore-card__fact--note">
                <span className="mystore-card__fact-label">{t("myShop.storeReviewNote")}</span>
                <span className="mystore-card__fact-value">{shop.reviewNote.trim()}</span>
              </div>
            ) : null}
          </div>

          <div className="mystore-card__actions">
            <button
              type="button"
              className="mystore-card__btn mystore-card__btn--ghost"
              onClick={onInvoices}
              disabled={!active}
            >
              <Invoice04Icon size={14} color="currentColor" />
              <span>{t("myShop.tilePaymentLinks")}</span>
            </button>
            <button
              type="button"
              className="mystore-card__btn mystore-card__btn--ghost"
              onClick={onTransactions}
            >
              <TransactionHistoryIcon size={14} color="currentColor" />
              <span>{t("myShop.tileTransactions")}</span>
            </button>
            <button
              type="button"
              className="mystore-card__btn mystore-card__btn--ghost"
              onClick={onSettlements}
              disabled={!active}
            >
              <PayByCheckIcon size={14} color="currentColor" />
              <span>{t("myShop.tileSettlements")}</span>
            </button>
            <button
              type="button"
              className="mystore-card__btn mystore-card__btn--ghost"
              onClick={onStats}
            >
              <ChartRoseIcon size={14} color="currentColor" />
              <span>{t("myShop.tileStats")}</span>
            </button>
            <button
              type="button"
              className="mystore-card__btn mystore-card__btn--ghost"
              onClick={onApi}
              disabled={!active}
            >
              <ApiIcon size={14} color="currentColor" />
              <span>{t("myShop.tileApi")}</span>
            </button>
            <button
              type="button"
              className="mystore-card__btn mystore-card__btn--ghost"
              onClick={onSettings}
              disabled={!active}
            >
              <Settings01Icon size={14} color="currentColor" />
              <span>{t("myShop.tileGatewaySettings")}</span>
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
