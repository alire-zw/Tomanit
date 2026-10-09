import { useCallback, useEffect, useState, type ComponentType, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import BitcoinWalletIcon from "../../components/icons/hugeicons/BitcoinWalletIcon";
import CashierIcon from "../../components/icons/hugeicons/CashierIcon";
import ChartRoseIcon from "../../components/icons/hugeicons/ChartRoseIcon";
import CoinsSwapIcon from "../../components/icons/hugeicons/CoinsSwapIcon";
import CreditCardPosIcon from "../../components/icons/hugeicons/CreditCardPosIcon";
import CustomerService02Icon from "../../components/icons/hugeicons/CustomerService02Icon";
import CustomerSupportIcon from "../../components/icons/hugeicons/CustomerSupportIcon";
import Invoice04Icon from "../../components/icons/hugeicons/Invoice04Icon";
import ManagerIcon from "../../components/icons/hugeicons/ManagerIcon";
import MoneySendSquareIcon from "../../components/icons/hugeicons/MoneySendSquareIcon";
import RefreshIcon from "../../components/icons/hugeicons/RefreshIcon";
import TeamWorkIcon from "../../components/icons/hugeicons/TeamWorkIcon";
import User02Icon from "../../components/icons/hugeicons/User02Icon";
import WalletCardsIcon from "../../components/icons/hugeicons/WalletCardsIcon";
import { useI18n } from "../../context/I18nContext";
import { useAuth } from "../../hooks/useAuth";
import { apiFetch } from "../../lib/api";
import { formatFaNumber } from "../../lib/format";
import "../../styles/shop-rise.css";
import "./Admin.css";

type HugeIcon = ComponentType<{
  width?: number | string;
  height?: number | string;
  size?: number;
  color?: string;
  variant?: string;
  className?: string;
}>;

type HubTile = {
  id: string;
  label: string;
  hint: string;
  path: string;
  Icon: HugeIcon;
};

type Overview = {
  users: number;
  usersToday: number;
  openTickets: number;
  pendingInvoices: number;
  pendingShops?: number;
  pendingSettlements?: number;
  todayTxCount: number;
  todayTxAmount: number;
  todayFeeProfit: number;
  todayChargesCount: number;
  todayChargesAmount: number;
};

function MenuChevron({ flip }: { flip?: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      style={flip ? { transform: "scaleX(-1)" } : undefined}
    >
      <path
        d="M14.5 5.5L8 12l6.5 6.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HubMenu({
  rows,
  onOpen,
  isRTL,
}: {
  rows: HubTile[][];
  onOpen: (path: string) => void;
  isRTL: boolean;
}) {
  return (
    <div className="admin-hub__menu">
      {rows.map((row, rowIndex) => (
        <div
          key={`row-${rowIndex}-${row.map((t) => t.id).join("-")}`}
          className={`admin-hub__menu-row admin-hub__menu-row--${row.length}`}
        >
          {row.map((tile) => {
            const Icon = tile.Icon;
            return (
              <button
                key={tile.id}
                type="button"
                className="admin-hub__menu-item"
                onClick={() => onOpen(tile.path)}
              >
                <span className="admin-hub__menu-icon" aria-hidden>
                  <Icon variant="bulk-rounded" size={18} width={18} height={18} color="currentColor" />
                </span>
                <span className="admin-hub__menu-copy">
                  <span className="admin-hub__menu-label">{tile.label}</span>
                  <span className="admin-hub__menu-hint">{tile.hint}</span>
                </span>
                <span className="admin-hub__menu-chevron" aria-hidden>
                  <MenuChevron flip={!isRTL} />
                </span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export function AdminHubPage() {
  const { isAdmin, isFullAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const { t, isRTL } = useI18n();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadOverview = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const data = await apiFetch<Overview>("/admin/overview");
      setOverview(data);
    } catch (err) {
      setOverview(null);
      setError(err instanceof Error ? err.message : t("admin.overviewError"));
    } finally {
      setRefreshing(false);
    }
  }, [t]);

  useEffect(() => {
    if (!loading && isAdmin) void loadOverview();
  }, [isAdmin, loading, loadOverview]);

  if (!loading && !isAdmin) {
    return (
      <div className="admin admin-page">
        <p className="admin__error">{t("admin.accessDenied")}</p>
      </div>
    );
  }

  const open = (path: string) => navigate(path);
  const o = overview;

  const usersHint = o
    ? t("admin.usersRegistered", { count: formatFaNumber(o.users) })
    : t("admin.usersHint");
  const invoicesHint = o
    ? o.pendingInvoices > 0
      ? t("admin.invoicesPending", { count: formatFaNumber(o.pendingInvoices) })
      : t("admin.invoicesHint")
    : t("admin.invoicesHint");
  const ticketsHint = o
    ? o.openTickets > 0
      ? t("admin.ticketsOpen", { count: formatFaNumber(o.openTickets) })
      : t("admin.ticketsHint")
    : t("admin.ticketsHint");
  const shopsHint = o
    ? (o.pendingShops ?? 0) > 0
      ? t("admin.shopsPending", { count: formatFaNumber(o.pendingShops ?? 0) })
      : t("admin.shopsHint")
    : t("admin.shopsHint");
  const settlementsHint = o
    ? (o.pendingSettlements ?? 0) > 0
      ? t("admin.settlementsPending", {
          count: formatFaNumber(o.pendingSettlements ?? 0),
        })
      : t("admin.settlementsHint")
    : t("admin.settlementsHint");

  /** Rows: 1 · 2 · 1 · 2 — same pattern as MyShop menu */
  const manageRows: HubTile[][] = isFullAdmin
    ? [
        [
          {
            id: "users",
            label: t("admin.users"),
            hint: usersHint,
            path: "/admin/users",
            Icon: User02Icon,
          },
        ],
        [
          {
            id: "invoices",
            label: t("admin.invoicesLabel"),
            hint: invoicesHint,
            path: "/admin/invoices",
            Icon: Invoice04Icon,
          },
          {
            id: "tickets",
            label: t("admin.ticketsLabel"),
            hint: ticketsHint,
            path: "/admin/tickets",
            Icon: CustomerSupportIcon,
          },
        ],
        [
          {
            id: "shops",
            label: t("admin.shopsTitle"),
            hint: shopsHint,
            path: "/admin/shops",
            Icon: CashierIcon,
          },
          {
            id: "shop-stats",
            label: t("admin.shopStatsTitle"),
            hint: t("admin.shopStatsHint"),
            path: "/admin/shops/stats",
            Icon: ChartRoseIcon,
          },
        ],
        [
          {
            id: "settlements",
            label: t("admin.settlementsTitle"),
            hint: settlementsHint,
            path: "/admin/settlements",
            Icon: MoneySendSquareIcon,
          },
          {
            id: "pricing",
            label: t("admin.pricing"),
            hint: t("admin.pricingHint"),
            path: "/admin/pricing",
            Icon: CoinsSwapIcon,
          },
        ],
      ]
    : [
        [
          {
            id: "tickets",
            label: t("admin.ticketsLabel"),
            hint: ticketsHint,
            path: "/admin/tickets",
            Icon: CustomerSupportIcon,
          },
        ],
        [
          {
            id: "shops",
            label: t("admin.shopsTitle"),
            hint: shopsHint,
            path: "/admin/shops",
            Icon: CashierIcon,
          },
          {
            id: "shop-stats",
            label: t("admin.shopStatsTitle"),
            hint: t("admin.shopStatsHint"),
            path: "/admin/shops/stats",
            Icon: ChartRoseIcon,
          },
        ],
        [
          {
            id: "settlements",
            label: t("admin.settlementsTitle"),
            hint: settlementsHint,
            path: "/admin/settlements",
            Icon: MoneySendSquareIcon,
          },
        ],
      ];

  const settingsRows: HubTile[][] = [
    [
      {
        id: "payment",
        label: t("admin.paymentLabel"),
        hint: t("admin.paymentHint"),
        path: "/admin/payment",
        Icon: BitcoinWalletIcon,
      },
    ],
    [
      {
        id: "master-wallets",
        label: t("admin.masterWalletsTitle"),
        hint: t("admin.masterWalletsHint"),
        path: "/admin/master-wallets",
        Icon: WalletCardsIcon,
      },
      {
        id: "gateways",
        label: t("admin.gatewaysTitle"),
        hint: t("admin.gatewaysHint"),
        path: "/admin/gateways",
        Icon: CreditCardPosIcon,
      },
    ],
    [
      {
        id: "support-settings",
        label: t("admin.supportSettings"),
        hint: t("admin.supportHint"),
        path: "/admin/support-settings",
        Icon: CustomerService02Icon,
      },
    ],
    [
      {
        id: "channels",
        label: t("admin.channels"),
        hint: t("admin.channelsHint"),
        path: "/admin/channels",
        Icon: TeamWorkIcon,
      },
    ],
  ];

  return (
    <div className="admin admin-page admin-hub">
      <section
        className="admin-hub__summary shop-rise"
        style={{ "--rise-index": 0 } as CSSProperties}
        aria-label={t("admin.hub")}
      >
        <div className="admin-hub__summary-head">
          <div className="admin-hub__summary-identity">
            <span className="admin-hub__summary-avatar" aria-hidden>
              <ManagerIcon variant="bulk-rounded" size={16} color="currentColor" />
            </span>
            <div className="admin-hub__summary-title-row">
              <h1 className="admin-hub__summary-name">{t("admin.hub")}</h1>
              <span className="admin-hub__summary-badge">{t("admin.statTodayBadge")}</span>
            </div>
          </div>
          <button
            type="button"
            className={`admin-hub__summary-refresh${refreshing ? " is-busy" : ""}`}
            onClick={() => void loadOverview()}
            disabled={refreshing}
            aria-label={t("admin.refreshAria")}
          >
            <RefreshIcon variant="bulk-rounded" size={16} color="currentColor" />
          </button>
        </div>

        <div className="admin-hub__summary-amount">
          <span className="admin-hub__summary-unit">{t("wallet.toman")}</span>
          <span className="admin-hub__summary-value">
            {formatFaNumber(o?.todayFeeProfit ?? 0)}
          </span>
        </div>
        <p className="admin-hub__summary-caption">{t("admin.statFeeProfit")}</p>

        <div className="admin-hub__summary-foot">
          <div className="admin-hub__summary-stats">
            <div className="admin-hub__summary-stat">
              <span className="admin-hub__summary-stat-main">
                {formatFaNumber(o?.usersToday ?? 0)}
              </span>
              <span className="admin-hub__summary-stat-sub">{t("admin.statUsersToday")}</span>
            </div>
            <span className="admin-hub__summary-stat-sep" aria-hidden />
            <div className="admin-hub__summary-stat">
              <span className="admin-hub__summary-stat-main">
                {formatFaNumber(o?.todayTxCount ?? 0)}
                <span className="admin-hub__summary-stat-unit">
                  / {formatFaNumber(o?.todayTxAmount ?? 0)}
                </span>
              </span>
              <span className="admin-hub__summary-stat-sub">{t("admin.statTxToday")}</span>
            </div>
            <span className="admin-hub__summary-stat-sep" aria-hidden />
            <div className="admin-hub__summary-stat">
              <span className="admin-hub__summary-stat-main">
                {formatFaNumber(o?.openTickets ?? 0)}
              </span>
              <span className="admin-hub__summary-stat-sub">{t("admin.statOpenTickets")}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="admin-hub__section shop-rise" style={{ "--rise-index": 1 } as CSSProperties}>
        <HubMenu rows={manageRows} onOpen={open} isRTL={isRTL} />
      </section>

      {error ? <p className="admin__error">{error}</p> : null}

      {isFullAdmin ? (
        <section className="admin-hub__section shop-rise" style={{ "--rise-index": 2 } as CSSProperties}>
          <HubMenu rows={settingsRows} onOpen={open} isRTL={isRTL} />
        </section>
      ) : null}
    </div>
  );
}
