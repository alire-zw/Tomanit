import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AdminScreen } from "../../components/AdminScreen";
import { BottomSheet } from "../../components/BottomSheet";
import { EmptyState } from "../../components/EmptyState";
import { useNotification } from "../../components/Notification";
import Money03Icon from "../../components/icons/money-03-stroke-rounded";
import MoneyReceiveSquareIcon from "../../components/icons/MoneyReceiveSquareIcon";
import MoneySendSquareIcon from "../../components/icons/MoneySendSquareIcon";
import SwapIcon from "../../components/icons/SwapIcon";
import CopyIcon from "../../components/icons/CopyIcon";
import ChatIcon from "../../components/icons/hugeicons/ChatIcon";
import ClipboardPasteIcon from "../../components/icons/hugeicons/ClipboardPasteIcon";
import ShoppingBag02Icon from "../../components/icons/hugeicons/ShoppingBag02Icon";
import TransactionHistoryIcon from "../../components/icons/hugeicons/TransactionHistoryIcon";
import WalletCardsIcon from "../../components/icons/hugeicons/WalletCardsIcon";
import { useAuth } from "../../hooks/useAuth";
import { useI18n } from "../../context/I18nContext";
import { useTelegram } from "../../hooks/useTelegram";
import {
  apiFetch,
  type FeeLevel,
  type UserDto,
  type UserRole,
  type WalletAssetId,
  type WalletDto,
  type WalletTransaction,
} from "../../lib/api";
import {
  feeLevelLabel,
  formatFaCryptoQty,
  formatFaDate,
  formatFaDecimal,
  formatFaNumber,
  kycLevelLabel,
} from "../../lib/format";
import { WALLET_ASSETS, getWalletAssetDef } from "../../lib/walletAssetsCatalog";
import { ASSET_DEPOSIT_NETWORKS } from "../../lib/walletNetworks";
import {
  readCachedWalletRates,
  writeCachedWalletRates,
} from "../../lib/walletRatesCache";
import { getWalletAssetBalance } from "../../lib/walletUi";
import "../../styles/shop-rise.css";
import "../Wallet.css";
import "./Admin.css";
import "./AdminUserDetail.css";

type RatesMap = Partial<Record<WalletAssetId, number>>;

function shortAddress(address: string): string {
  const value = address.trim();
  if (value.length <= 12) return value;
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function addressForAsset(
  wallet: WalletDto,
  assetId: WalletAssetId,
): string | null {
  if (assetId === "toman") return null;
  const networks = ASSET_DEPOSIT_NETWORKS[assetId] ?? [];
  const addresses = wallet.addresses ?? [];
  for (const network of networks) {
    const found = addresses.find((item) => item.network === network);
    if (found?.address) return found.address;
  }
  return null;
}

type DetailTab = "assets" | "shop" | "tickets" | "transactions" | "audit";

type AdminAuditLog = {
  id: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  meta: Record<string, unknown> | null;
  ip: string | null;
  createdAt: string;
  actor: {
    telegramId: string;
    role: UserRole;
    username: string | null;
    displayName: string | null;
  };
};

type AdminUserTicket = {
  id: string;
  code: string;
  subject: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  lastMessage: {
    sender: string;
    body: string;
    createdAt: string;
  } | null;
};

type AdminUserShop = {
  id: string;
  name: string;
  sellType: string;
  dailyAmountToman: number;
  dailyCount: number;
  channel: string;
  siteUrl: string | null;
  botUrl: string | null;
  logoDataUrl: string | null;
  status: string;
  reviewNote: string | null;
  balanceToman: string;
  apiKey: string | null;
  createdAt: string;
  updatedAt: string;
};

type AdminUserDetailPayload = {
  user: UserDto;
  wallet: WalletDto | null;
  shop: AdminUserShop | null;
  tickets: AdminUserTicket[];
  transactions: WalletTransaction[];
  auditLogs: AdminAuditLog[];
};

type SheetKind =
  | { kind: "ban" }
  | { kind: "balance" }
  | { kind: "role"; role: UserRole }
  | { kind: "fee"; feeLevel: FeeLevel }
  | { kind: "resetKyc" };

const ROLE_OPTIONS: UserRole[] = ["user", "admin", "supervisor"];

function displayName(user: UserDto): string {
  return (
    user.fullName?.trim() ||
    [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
    user.username ||
    user.telegramId
  );
}

function roleLabel(role: UserRole, t: (k: string) => string): string {
  if (role === "admin") return t("admin.roleAdmin");
  if (role === "supervisor") return t("admin.roleSupervisor");
  return t("admin.roleUser");
}

function shopStatusLabel(status: string, t: (k: string) => string): string {
  if (status === "active") return t("myShop.statusActive");
  if (status === "pending") return t("myShop.statusPending");
  if (status === "suspended") return t("myShop.statusSuspended");
  if (status === "rejected") return t("admin.shopsRejectedBadge");
  return status;
}

function ticketStatusLabel(status: string, t: (k: string) => string): string {
  const key = `status.${status}`;
  const label = t(key);
  return label === key ? status : label;
}

function actorLabel(log: AdminAuditLog): string {
  if (log.actor.displayName?.trim()) return log.actor.displayName.trim();
  if (log.actor.username?.trim()) return `@${log.actor.username.trim()}`;
  return String(log.actor.telegramId);
}

function auditActionLabel(
  action: string,
  meta: AdminAuditLog["meta"],
  t: (k: string, params?: Record<string, string | number>) => string,
): string {
  switch (action) {
    case "user.ban":
      return t("admin.auditBan");
    case "user.unban":
      return t("admin.auditUnban");
    case "user.balance.set":
      return t("admin.auditBalance", {
        from: formatFaNumber(Number(meta?.previousBalance ?? 0)),
        to: formatFaNumber(Number(meta?.newBalance ?? 0)),
      });
    case "user.role.set":
      return t("admin.auditRole", {
        from: roleLabel(String(meta?.previousRole) as UserRole, t),
        to: roleLabel(String(meta?.newRole) as UserRole, t),
      });
    case "user.fee_level.set":
      return t("admin.auditFee", {
        from: feeLevelLabel(String(meta?.previousFeeLevel ?? "")),
        to: feeLevelLabel(String(meta?.newFeeLevel ?? "")),
      });
    case "user.kyc_cards.reset":
      return t("admin.auditKycReset", {
        cards: Number(meta?.revokedCardCount ?? 0),
      });
    default:
      return action;
  }
}

function txAssetLogo(asset: string): string {
  const key = asset.toLowerCase() === "irr" ? "toman" : asset.toLowerCase();
  return getWalletAssetDef(key)?.logo ?? "/coins/TOMAN.png";
}

function TransactionBadgeIcon({ tx }: { tx: WalletTransaction }) {
  const props = { width: 10, height: 10 };
  if (tx.type === "withdraw" || tx.type === "invoice") return <MoneySendSquareIcon {...props} />;
  if (tx.type === "convert") return <SwapIcon {...props} />;
  if (tx.type === "deposit" || tx.type === "recharge" || tx.type === "refund") {
    return <MoneyReceiveSquareIcon {...props} />;
  }
  return <Money03Icon {...props} />;
}

function getAmountClass(tx: WalletTransaction): string {
  if (tx.status === "pending") return "wallet__transaction-amount--pending";
  if (tx.status === "failed" || tx.status === "rejected") {
    return "wallet__transaction-amount--failed";
  }
  if (tx.type === "withdraw" || tx.type === "invoice") {
    return "wallet__transaction-amount--transfer-out";
  }
  if (tx.type === "deposit" || tx.type === "recharge" || tx.type === "refund") {
    return "wallet__transaction-amount--positive";
  }
  return "";
}

function getBadgeClass(tx: WalletTransaction): string {
  if (tx.status === "pending") return "wallet__transaction-badge wallet__transaction-badge--pending";
  if (tx.status === "failed" || tx.status === "rejected") {
    return "wallet__transaction-badge wallet__transaction-badge--failed";
  }
  if (tx.type === "withdraw" || tx.type === "invoice") {
    return "wallet__transaction-badge wallet__transaction-badge--out";
  }
  if (tx.type === "deposit" || tx.type === "recharge" || tx.type === "refund") {
    return "wallet__transaction-badge wallet__transaction-badge--in";
  }
  if (tx.type === "convert") {
    return "wallet__transaction-badge wallet__transaction-badge--convert";
  }
  return "wallet__transaction-badge";
}

function formatTxAmount(tx: WalletTransaction): string {
  const value = Math.abs(tx.amount);
  const formatted =
    tx.asset.toLowerCase() === "toman" || tx.asset.toLowerCase() === "irr"
      ? formatFaNumber(value)
      : formatFaDecimal(value, 2);
  if (tx.status === "failed" || tx.status === "rejected") return formatted;
  if (tx.type === "withdraw" || tx.type === "invoice") return `-${formatted}`;
  if (tx.type === "deposit" || tx.type === "recharge" || tx.type === "refund") {
    return `+${formatted}`;
  }
  return formatted;
}

function RowIcon({ children }: { children: ReactNode }) {
  return <span className="wallet__asset-icon">{children}</span>;
}

function DetailSkeleton() {
  return (
    <>
      <div className="admin-user-detail__body">
        <section
          className="admin-user-detail__profile admin-user-detail--skeleton shop-rise"
          style={{ "--rise-index": 1 } as CSSProperties}
          aria-hidden
        >
          <span className="admin-user-detail-skel admin-user-detail-skel--avatar" />
          <div className="admin-user-detail__profile-body">
            <div className="admin-user-detail__profile-top">
              <span className="admin-user-detail-skel admin-user-detail-skel--name" />
              <span className="admin-user-detail-skel admin-user-detail-skel--badge" />
            </div>
            <span className="admin-user-detail-skel admin-user-detail-skel--meta" />
          </div>
        </section>
        <div
          className="admin-user-detail__ops admin-user-detail--skeleton shop-rise"
          style={{ "--rise-index": 2 } as CSSProperties}
          aria-hidden
        >
          <span className="admin-user-detail-skel admin-user-detail-skel--op" />
          <span className="admin-user-detail-skel admin-user-detail-skel--op" />
        </div>
        <dl
          className="admin-user-detail__info admin-user-detail--skeleton shop-rise"
          style={{ "--rise-index": 3 } as CSSProperties}
          aria-hidden
        >
          {[1, 2, 3, 4].map((index) => (
            <div key={index}>
              <span className="admin-user-detail-skel admin-user-detail-skel--label" />
              <span className="admin-user-detail-skel admin-user-detail-skel--value" />
            </div>
          ))}
        </dl>
      </div>
      <div
        className="admin-tabs admin-tabs--5 admin-user-detail--skeleton shop-rise"
        style={{ "--rise-index": 4 } as CSSProperties}
        aria-hidden
      >
        {[1, 2, 3, 4, 5].map((i) => (
          <span key={i} className="admin-user-detail-skel admin-user-detail-skel--tab" />
        ))}
      </div>
    </>
  );
}

export function AdminUserDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useI18n();
  const { haptic } = useTelegram();
  const { user: actor } = useAuth();
  const { notify } = useNotification();

  const [payload, setPayload] = useState<AdminUserDetailPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<DetailTab>("assets");
  const [saving, setSaving] = useState(false);
  const [sheet, setSheet] = useState<SheetKind | null>(null);
  const [balanceInput, setBalanceInput] = useState("");
  const [balanceNote, setBalanceNote] = useState("");
  const [rates, setRates] = useState<RatesMap>(
    () => readCachedWalletRates()?.rates ?? {},
  );

  const user = payload?.user ?? null;
  const wallet = payload?.wallet ?? null;
  const canEdit = Boolean(actor && user && actor.id !== user.id);

  useEffect(() => {
    let cancelled = false;
    void apiFetch<{
      source?: string;
      rates: RatesMap;
      changes?: Partial<Record<Exclude<WalletAssetId, "toman">, number>>;
    }>("/wallet/rates")
      .then((data) => {
        if (cancelled || !data.rates) return;
        setRates(data.rates);
        writeCachedWalletRates(data.rates, data.changes ?? {});
      })
      .catch(() => {
        /* keep cache */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const copyAddress = useCallback(
    async (address: string) => {
      try {
        await navigator.clipboard.writeText(address);
        haptic("light");
        notify(t("common.copied"), "success");
      } catch {
        notify(t("common.error"), "error");
      }
    },
    [haptic, notify, t],
  );

  const tabs = useMemo(
    () =>
      [
        { id: "assets" as const, label: t("admin.userTabAssets"), icon: <WalletCardsIcon size={14} /> },
        { id: "shop" as const, label: t("admin.userTabShop"), icon: <ShoppingBag02Icon size={14} /> },
        { id: "tickets" as const, label: t("admin.userTabTickets"), icon: <ChatIcon size={14} /> },
        {
          id: "transactions" as const,
          label: t("admin.userTabTransactions"),
          icon: <TransactionHistoryIcon size={14} />,
        },
        { id: "audit" as const, label: t("admin.userTabAudit"), icon: <ClipboardPasteIcon size={14} /> },
      ] as const,
    [t],
  );

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await apiFetch<AdminUserDetailPayload>(`/admin/users/${id}/detail`);
      setPayload(data);
      setBalanceInput(String(Math.trunc(Number(data.wallet?.tomanBalance ?? 0))));
      setError(null);
    } catch (err) {
      setPayload(null);
      setError(err instanceof Error ? err.message : t("admin.userDetailLoadError"));
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const closeSheet = useCallback(() => {
    if (saving) return;
    setSheet(null);
  }, [saving]);

  const executeBan = async () => {
    if (!user || !canEdit) return;
    const next = !user.isBanned;
    setSaving(true);
    try {
      const result = await apiFetch<{ user: UserDto }>(`/admin/users/${user.id}/ban`, {
        method: "PATCH",
        body: { isBanned: next },
      });
      setPayload((prev) => (prev ? { ...prev, user: result.user } : prev));
      haptic("medium");
      notify(next ? t("admin.userDetailBannedOk") : t("admin.userDetailUnbannedOk"), "success");
      setSheet(null);
      void load();
    } catch (err) {
      notify(err instanceof Error ? err.message : t("common.error"), "error");
    } finally {
      setSaving(false);
    }
  };

  const executeBalance = async () => {
    if (!user || !canEdit) return;
    const amount = Number(balanceInput.replace(/[^\d]/g, ""));
    if (!Number.isFinite(amount) || amount < 0) {
      notify(t("admin.userDetailBalanceInvalid"), "warning");
      return;
    }
    if (amount === Math.trunc(Number(wallet?.tomanBalance ?? 0))) {
      setSheet(null);
      return;
    }
    setSaving(true);
    try {
      const result = await apiFetch<{
        user: UserDto;
        wallet: WalletDto;
      }>(`/admin/users/${user.id}/balance`, {
        method: "PATCH",
        body: {
          tomanBalance: amount,
          note: balanceNote.trim() || undefined,
        },
      });
      setPayload((prev) =>
        prev
          ? {
              ...prev,
              user: result.user,
              wallet: result.wallet,
            }
          : prev,
      );
      setBalanceInput(String(Math.trunc(Number(result.wallet.tomanBalance))));
      haptic("medium");
      notify(t("admin.userDetailBalanceSaved"), "success");
      setSheet(null);
      setBalanceNote("");
      void load();
    } catch (err) {
      notify(err instanceof Error ? err.message : t("common.error"), "error");
    } finally {
      setSaving(false);
    }
  };

  const executeRole = async () => {
    if (!sheet || sheet.kind !== "role" || !user || !canEdit) return;
    setSaving(true);
    try {
      const result = await apiFetch<{ user: UserDto }>(`/admin/users/${user.id}/role`, {
        method: "PATCH",
        body: { role: sheet.role },
      });
      setPayload((prev) => (prev ? { ...prev, user: result.user } : prev));
      haptic("medium");
      notify(t("admin.userDetailRoleSaved"), "success");
      setSheet(null);
      void load();
    } catch (err) {
      notify(err instanceof Error ? err.message : t("common.error"), "error");
    } finally {
      setSaving(false);
    }
  };

  const executeFee = async () => {
    if (!sheet || sheet.kind !== "fee" || !user || !canEdit) return;
    setSaving(true);
    try {
      const result = await apiFetch<{ user: UserDto }>(`/admin/users/${user.id}/fee-level`, {
        method: "PATCH",
        body: { feeLevel: sheet.feeLevel },
      });
      setPayload((prev) => (prev ? { ...prev, user: result.user } : prev));
      haptic("medium");
      notify(t("admin.userDetailFeeSaved"), "success");
      setSheet(null);
      void load();
    } catch (err) {
      notify(err instanceof Error ? err.message : t("common.error"), "error");
    } finally {
      setSaving(false);
    }
  };

  const executeResetKyc = async () => {
    if (!user || !canEdit) return;
    setSaving(true);
    try {
      const result = await apiFetch<{ user: UserDto; revokedCardCount: number }>(
        `/admin/users/${user.id}/reset-kyc-cards`,
        { method: "POST" },
      );
      setPayload((prev) => (prev ? { ...prev, user: result.user } : prev));
      haptic("medium");
      notify(t("admin.userDetailResetKycOk"), "success");
      setSheet(null);
      void load();
    } catch (err) {
      notify(err instanceof Error ? err.message : t("common.error"), "error");
    } finally {
      setSaving(false);
    }
  };

  const name = user ? displayName(user) : t("admin.userDetailTitle");
  const banNext = user ? !user.isBanned : false;
  const tomanBalance = Math.trunc(Number(wallet?.tomanBalance ?? 0));

  const txTypeLabel = (type: string) => {
    const key = `tx.${type}`;
    const label = t(key);
    return label === key ? type : label;
  };

  const assetUnit = (assetId: WalletAssetId) => {
    const def = getWalletAssetDef(assetId);
    return def ? t(def.unitKey) : assetId.toUpperCase();
  };

  return (
    <AdminScreen title={t("admin.userDetailTitle")} onBack={() => navigate("/admin/users")}>
      <BottomSheet
        open={sheet?.kind === "ban"}
        onClose={closeSheet}
        title={banNext ? t("admin.userDetailBan") : t("admin.userDetailUnban")}
        description={banNext ? t("admin.userDetailBanDesc") : t("admin.userDetailUnbanDesc")}
        buttons={[
          {
            label: saving
              ? t("common.loading")
              : banNext
                ? t("admin.userDetailBan")
                : t("admin.userDetailUnban"),
            variant: banNext ? "danger" : "primary",
            disabled: saving,
            onClick: () => void executeBan(),
          },
        ]}
      />

      <BottomSheet
        open={sheet?.kind === "balance"}
        onClose={closeSheet}
        title={t("admin.userDetailBalanceTitle")}
        description={t("admin.userDetailBalanceCurrent", {
          amount: formatFaNumber(tomanBalance),
        })}
        buttons={[
          {
            label: saving ? t("common.loading") : t("admin.userDetailBalanceSave"),
            variant: "primary",
            disabled: saving || !balanceInput,
            onClick: () => void executeBalance(),
          },
        ]}
      >
        <div className="admin-modal-field">
          <label htmlFor="admin-balance-input">{t("admin.userDetailBalanceNew")}</label>
          <input
            id="admin-balance-input"
            value={balanceInput}
            onChange={(e) => setBalanceInput(e.target.value.replace(/[^\d]/g, ""))}
            inputMode="numeric"
            dir="ltr"
            disabled={saving}
          />
        </div>
        <div className="admin-modal-field">
          <label htmlFor="admin-balance-note">{t("admin.userDetailBalanceNote")}</label>
          <input
            id="admin-balance-note"
            value={balanceNote}
            onChange={(e) => setBalanceNote(e.target.value)}
            placeholder={t("admin.userDetailBalanceNotePh")}
            disabled={saving}
          />
        </div>
      </BottomSheet>

      <BottomSheet
        open={sheet?.kind === "role"}
        onClose={closeSheet}
        title={t("admin.userDetailRoleChange")}
        description={
          sheet?.kind === "role" && user
            ? t("admin.userDetailRoleConfirm", {
                name,
                from: roleLabel(user.role, t),
                to: roleLabel(sheet.role, t),
              })
            : undefined
        }
        buttons={[
          {
            label: saving ? t("common.loading") : t("admin.userDetailRoleConfirmBtn"),
            variant: "primary",
            disabled: saving,
            onClick: () => void executeRole(),
          },
        ]}
      />

      <BottomSheet
        open={sheet?.kind === "fee"}
        onClose={closeSheet}
        title={t("admin.userDetailFeeChange")}
        description={
          sheet?.kind === "fee" && user
            ? t("admin.userDetailFeeConfirm", {
                name,
                from: feeLevelLabel(user.feeLevel),
                to: feeLevelLabel(sheet.feeLevel),
              })
            : undefined
        }
        buttons={[
          {
            label: saving ? t("common.loading") : t("admin.userDetailFeeConfirmBtn"),
            variant: "primary",
            disabled: saving,
            onClick: () => void executeFee(),
          },
        ]}
      />

      <BottomSheet
        open={sheet?.kind === "resetKyc"}
        onClose={closeSheet}
        title={t("admin.userDetailResetKyc")}
        description={t("admin.userDetailResetKycDesc", { name })}
        buttons={[
          {
            label: saving ? t("common.loading") : t("admin.userDetailResetKycConfirm"),
            variant: "danger",
            disabled: saving,
            onClick: () => void executeResetKyc(),
          },
        ]}
      />

      {loading ? <DetailSkeleton /> : null}

      {!loading && error ? (
        <div className="admin-user-detail__body">
          <p className="admin-status admin-status--error">{error}</p>
        </div>
      ) : null}

      {!loading && user ? (
        <>
          <div className="admin-user-detail__body">
            <section
              className={`admin-user-detail__profile shop-rise admin-user-detail__profile--${user.role}${
                user.isBanned ? " admin-user-detail__profile--banned" : ""
              }`}
              style={{ "--rise-index": 1 } as CSSProperties}
            >
              <span className="admin-user-detail__avatar" aria-hidden>
                {(name.slice(0, 1) || "ک").toUpperCase()}
              </span>
              <div className="admin-user-detail__profile-body">
                <div className="admin-user-detail__profile-top">
                  <h2>{name}</h2>
                  <span
                    className={`admin-user-item__badge admin-user-item__badge--${
                      user.isBanned ? "banned" : user.role
                    }`}
                  >
                    {user.isBanned ? t("admin.roleBanned") : roleLabel(user.role, t)}
                  </span>
                </div>
                <p className="admin-user-detail__profile-meta">
                  {user.username ? <span dir="ltr">@{user.username}</span> : null}
                  {user.username ? <span aria-hidden> · </span> : null}
                  <span dir="ltr">{user.telegramId}</span>
                  <span aria-hidden> · </span>
                  <span>
                    {formatFaNumber(tomanBalance)} {t("wallet.toman")}
                  </span>
                </p>
              </div>
            </section>

            {canEdit ? (
              <div
                className="admin-user-detail__ops shop-rise"
                style={{ "--rise-index": 2 } as CSSProperties}
              >
                <button
                  type="button"
                  className={`admin-user-detail__op${
                    user.isBanned
                      ? " admin-user-detail__op--teal"
                      : " admin-user-detail__op--danger"
                  }`}
                  disabled={saving}
                  onClick={() => {
                    haptic("light");
                    setSheet({ kind: "ban" });
                  }}
                >
                  {user.isBanned ? t("admin.userDetailUnban") : t("admin.userDetailBan")}
                </button>
                <button
                  type="button"
                  className="admin-user-detail__op admin-user-detail__op--accent"
                  disabled={saving}
                  onClick={() => {
                    haptic("light");
                    setBalanceInput(String(tomanBalance));
                    setBalanceNote("");
                    setSheet({ kind: "balance" });
                  }}
                >
                  {t("admin.userDetailBalance")}
                </button>
                <button
                  type="button"
                  className="admin-user-detail__op admin-user-detail__op--danger"
                  disabled={saving}
                  onClick={() => {
                    haptic("light");
                    setSheet({ kind: "resetKyc" });
                  }}
                >
                  {t("admin.userDetailResetKyc")}
                </button>
              </div>
            ) : null}

            <dl
              className="admin-user-detail__info shop-rise"
              style={{ "--rise-index": 3 } as CSSProperties}
            >
              <div>
                <dt>{t("admin.userDetailFullName")}</dt>
                <dd>{user.fullName || "—"}</dd>
              </div>
              <div>
                <dt>{t("admin.userDetailPhone")}</dt>
                <dd dir="ltr">{user.phone || "—"}</dd>
              </div>
              <div>
                <dt>{t("admin.userDetailEmail")}</dt>
                <dd>{user.email || "—"}</dd>
              </div>
              <div>
                <dt>{t("admin.userDetailKyc")}</dt>
                <dd>{kycLevelLabel(user.kycLevel)}</dd>
              </div>
              <div>
                <dt>{t("admin.userDetailJoined")}</dt>
                <dd>{formatFaDate(user.createdAt)}</dd>
              </div>
              <div>
                <dt>{t("admin.userDetailFee")}</dt>
                <dd>{feeLevelLabel(user.feeLevel)}</dd>
              </div>
            </dl>

            {canEdit ? (
              <div
                className="admin-user-detail__levels-wrap shop-rise"
                style={{ "--rise-index": 4 } as CSSProperties}
              >
                <span className="admin-user-detail__status-label">
                  {t("admin.userDetailFeeLevel")}
                </span>
                <div className="admin-user-detail__level-grid" role="group" aria-label={t("admin.userDetailFeeLevel")}>
                  <div className="admin-user-detail__level-row admin-user-detail__level-row--3">
                    {(["bronze", "silver", "gold"] as FeeLevel[]).map((level) => {
                      const selected = user.feeLevel === level;
                      return (
                        <button
                          key={level}
                          type="button"
                          aria-pressed={selected}
                          className={`admin-user-detail__level-btn admin-user-detail__level-btn--${level}${
                            selected ? " is-active" : ""
                          }`}
                          disabled={saving}
                          onClick={() => {
                            if (selected) return;
                            haptic("light");
                            setSheet({ kind: "fee", feeLevel: level });
                          }}
                        >
                          {feeLevelLabel(level)}
                        </button>
                      );
                    })}
                  </div>
                  <div className="admin-user-detail__level-row admin-user-detail__level-row--2">
                    {(["platinum", "vip"] as FeeLevel[]).map((level) => {
                      const selected = user.feeLevel === level;
                      return (
                        <button
                          key={level}
                          type="button"
                          aria-pressed={selected}
                          className={`admin-user-detail__level-btn admin-user-detail__level-btn--${level}${
                            selected ? " is-active" : ""
                          }`}
                          disabled={saving}
                          onClick={() => {
                            if (selected) return;
                            haptic("light");
                            setSheet({ kind: "fee", feeLevel: level });
                          }}
                        >
                          {feeLevelLabel(level)}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <span className="admin-user-detail__status-label admin-user-detail__status-label--spaced">
                  {t("admin.userDetailRole")}
                </span>
                <div
                  className="admin-user-detail__level-row admin-user-detail__level-row--3"
                  role="group"
                  aria-label={t("admin.userDetailRole")}
                >
                  {ROLE_OPTIONS.map((role) => {
                    const selected = user.role === role;
                    return (
                      <button
                        key={role}
                        type="button"
                        aria-pressed={selected}
                        className={`admin-user-detail__level-btn admin-user-detail__level-btn--role-${role}${
                          selected ? " is-active" : ""
                        }`}
                        disabled={saving}
                        onClick={() => {
                          if (selected) return;
                          haptic("light");
                          setSheet({ kind: "role", role });
                        }}
                      >
                        {roleLabel(role, t)}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>

          <div
            className="admin-tabs admin-tabs--5 shop-rise"
            style={{ "--rise-index": 6 } as CSSProperties}
            role="tablist"
          >
            {tabs.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                className={`admin-tabs__btn${tab === item.id ? " admin-tabs__btn--active" : ""}`}
                onClick={() => {
                  haptic("light");
                  setTab(item.id);
                }}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </div>

          <div
            className="admin-user-detail__tab-panel shop-rise"
            style={{ "--rise-index": 7 } as CSSProperties}
          >
            {tab === "assets" ? (
              !wallet ? (
                <EmptyState title={t("admin.userDetailNoAssets")} compact />
              ) : (
                <div className="wallet__assets admin-user-detail__rows">
                  {WALLET_ASSETS.map((asset) => {
                    const balance = getWalletAssetBalance(wallet, asset.id);
                    const qty =
                      asset.id === "toman"
                        ? formatFaNumber(balance)
                        : formatFaCryptoQty(balance);
                    const address = addressForAsset(wallet, asset.id);
                    const rate = rates[asset.id];
                    const tomanEquiv =
                      asset.id === "toman"
                        ? balance
                        : typeof rate === "number" && rate > 0
                          ? balance * rate
                          : null;
                    return (
                      <div key={asset.id} className="wallet__asset">
                        <img
                          className="wallet__asset-logo"
                          src={asset.logo}
                          alt=""
                          width={32}
                          height={32}
                        />
                        <div className="wallet__asset-info">
                          <div className="wallet__asset-title">{t(asset.titleKey)}</div>
                          <div className="wallet__asset-sub">
                            <span>{asset.symbol}</span>
                            {address ? (
                              <>
                                <span className="wallet__asset-sub-gap" aria-hidden>
                                  ·
                                </span>
                                <span className="admin-user-detail__asset-addr">
                                  <span className="admin-user-detail__asset-addr-text">
                                    {shortAddress(address)}
                                  </span>
                                  <button
                                    type="button"
                                    className="admin-user-detail__asset-copy"
                                    aria-label={t("common.copy")}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      void copyAddress(address);
                                    }}
                                  >
                                    <CopyIcon width={11} height={11} color="currentColor" />
                                  </button>
                                </span>
                              </>
                            ) : null}
                          </div>
                        </div>
                        <div className="wallet__asset-value">
                          <span className="wallet__asset-amount-main">
                            {asset.id === "toman" ? (
                              qty
                            ) : (
                              <>
                                <span className="wallet__asset-amount-unit">
                                  {assetUnit(asset.id)}
                                </span>{" "}
                                <span className="wallet__asset-amount-qty">{qty}</span>
                              </>
                            )}
                          </span>
                          <span className="wallet__asset-amount-sub wallet__asset-amount-sub--equiv">
                            {tomanEquiv != null
                              ? `${formatFaNumber(Math.round(tomanEquiv))} ${t("wallet.toman")}`
                              : "—"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            ) : null}

            {tab === "shop" ? (
              !payload?.shop ? (
                <EmptyState title={t("admin.userDetailNoShop")} compact />
              ) : (
                <div className="wallet__transactions admin-user-detail__rows">
                  <div className="wallet__transaction">
                    <div className="wallet__transaction-start">
                      {payload.shop.logoDataUrl ? (
                        <img
                          className="wallet__transaction-logo"
                          src={payload.shop.logoDataUrl}
                          alt=""
                          width={32}
                          height={32}
                        />
                      ) : (
                        <RowIcon>
                          <ShoppingBag02Icon size={16} />
                        </RowIcon>
                      )}
                      <div className="wallet__transaction-info">
                        <div className="wallet__transaction-title">{payload.shop.name}</div>
                        <div className="wallet__transaction-date">
                          {shopStatusLabel(payload.shop.status, t)}
                          {" · "}
                          {payload.shop.channel}
                          {" · "}
                          {formatFaDate(payload.shop.createdAt)}
                        </div>
                      </div>
                    </div>
                    <div className="wallet__transaction-value-col">
                      <span className="wallet__transaction-amount-main">
                        {formatFaNumber(Number(payload.shop.balanceToman))}
                      </span>
                      <span className="wallet__transaction-equiv">{t("wallet.toman")}</span>
                    </div>
                  </div>
                  <div className="wallet__transaction">
                    <div className="wallet__transaction-start">
                      <RowIcon>
                        <ShoppingBag02Icon size={16} />
                      </RowIcon>
                      <div className="wallet__transaction-info">
                        <div className="wallet__transaction-title">
                          {t("admin.userDetailShopDaily")}
                        </div>
                        <div className="wallet__transaction-date">
                          {formatFaNumber(payload.shop.dailyCount)}×
                        </div>
                      </div>
                    </div>
                    <div className="wallet__transaction-value-col">
                      <span className="wallet__transaction-amount-main">
                        {formatFaNumber(payload.shop.dailyAmountToman)}
                      </span>
                      <span className="wallet__transaction-equiv">{t("wallet.toman")}</span>
                    </div>
                  </div>
                  {payload.shop.siteUrl ? (
                    <a
                      className="wallet__transaction wallet__transaction--clickable"
                      href={payload.shop.siteUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <div className="wallet__transaction-start">
                        <RowIcon>
                          <ShoppingBag02Icon size={16} />
                        </RowIcon>
                        <div className="wallet__transaction-info">
                          <div className="wallet__transaction-title">
                            {t("admin.userDetailShopWebsite")}
                          </div>
                          <div className="wallet__transaction-date" dir="ltr">
                            {payload.shop.siteUrl}
                          </div>
                        </div>
                      </div>
                    </a>
                  ) : null}
                  {payload.shop.botUrl ? (
                    <a
                      className="wallet__transaction wallet__transaction--clickable"
                      href={payload.shop.botUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <div className="wallet__transaction-start">
                        <RowIcon>
                          <ShoppingBag02Icon size={16} />
                        </RowIcon>
                        <div className="wallet__transaction-info">
                          <div className="wallet__transaction-title">
                            {t("admin.userDetailShopBot")}
                          </div>
                          <div className="wallet__transaction-date" dir="ltr">
                            {payload.shop.botUrl}
                          </div>
                        </div>
                      </div>
                    </a>
                  ) : null}
                </div>
              )
            ) : null}

            {tab === "tickets" ? (
              !payload?.tickets.length ? (
                <EmptyState title={t("admin.userDetailNoTickets")} compact />
              ) : (
                <div className="wallet__transactions admin-user-detail__rows">
                  {payload.tickets.map((ticket) => (
                    <button
                      key={ticket.id}
                      type="button"
                      className="wallet__transaction wallet__transaction--clickable"
                      onClick={() => {
                        haptic("light");
                        navigate("/admin/tickets", { state: { ticketId: ticket.id } });
                      }}
                    >
                      <div className="wallet__transaction-start">
                        <RowIcon>
                          <ChatIcon size={16} />
                        </RowIcon>
                        <div className="wallet__transaction-info">
                          <div className="wallet__transaction-title">{ticket.subject}</div>
                          <div className="wallet__transaction-date">
                            {ticket.code}
                            {" · "}
                            {ticketStatusLabel(ticket.status, t)}
                            {" · "}
                            {formatFaDate(ticket.updatedAt)}
                          </div>
                        </div>
                      </div>
                      <div className="wallet__transaction-value-col">
                        <span className="wallet__transaction-equiv">
                          {ticketStatusLabel(ticket.status, t)}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )
            ) : null}

            {tab === "transactions" ? (
              !payload?.transactions.length ? (
                <EmptyState title={t("admin.userDetailNoTransactions")} compact />
              ) : (
                <div className="wallet__transactions admin-user-detail__rows">
                  {payload.transactions.map((tx) => (
                    <div key={tx.id} className="wallet__transaction">
                      <div className="wallet__transaction-start">
                        <span className="wallet__transaction-logo-wrap">
                          <img
                            className="wallet__transaction-logo"
                            src={txAssetLogo(tx.asset)}
                            alt=""
                            width={32}
                            height={32}
                          />
                          <span className={getBadgeClass(tx)}>
                            <TransactionBadgeIcon tx={tx} />
                          </span>
                        </span>
                        <div className="wallet__transaction-info">
                          <div className="wallet__transaction-title">{txTypeLabel(tx.type)}</div>
                          <div className="wallet__transaction-date">
                            {formatFaDate(tx.createdAt)}
                            {tx.note ? ` · ${tx.note}` : ""}
                          </div>
                        </div>
                      </div>
                      <div className={`wallet__transaction-value-col ${getAmountClass(tx)}`}>
                        <span className="wallet__transaction-amount-main">
                          <span className="wallet__transaction-unit">
                            {tx.asset.toUpperCase()}
                          </span>
                          <span className="wallet__transaction-value">{formatTxAmount(tx)}</span>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : null}

            {tab === "audit" ? (
              !payload?.auditLogs.length ? (
                <EmptyState title={t("admin.userDetailNoAudit")} compact />
              ) : (
                <div className="wallet__transactions admin-user-detail__rows">
                  {payload.auditLogs.map((log) => (
                    <div
                      key={log.id}
                      className="wallet__transaction admin-user-detail__row--tall"
                    >
                      <div className="wallet__transaction-start">
                        <RowIcon>
                          <ClipboardPasteIcon size={16} />
                        </RowIcon>
                        <div className="wallet__transaction-info">
                          <div className="wallet__transaction-title">
                            {auditActionLabel(log.action, log.meta, t)}
                          </div>
                          <div className="wallet__transaction-date">
                            {actorLabel(log)}
                            {log.meta?.note ? ` · ${String(log.meta.note)}` : ""}
                          </div>
                        </div>
                      </div>
                      <div className="wallet__transaction-value-col">
                        <time className="wallet__transaction-equiv" dateTime={log.createdAt}>
                          {formatFaDate(log.createdAt)}
                        </time>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : null}
          </div>
        </>
      ) : null}
    </AdminScreen>
  );
}
