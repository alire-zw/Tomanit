import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../../components/PageHeader";
import SearchIcon from "../../components/icons/SearchIcon";
import ChatCancelIcon from "../../components/icons/hugeicons/ChatCancelIcon";
import ManagerIcon from "../../components/icons/hugeicons/ManagerIcon";
import ShoppingBag02Icon from "../../components/icons/hugeicons/ShoppingBag02Icon";
import User02Icon from "../../components/icons/hugeicons/User02Icon";
import { useI18n } from "../../context/I18nContext";
import { useTelegram } from "../../hooks/useTelegram";
import { useTelegramBackButton } from "../../hooks/useTelegramBackButton";
import { apiFetch, type UserDto, type UserRole } from "../../lib/api";
import { feeLevelLabel, formatFaNumber, kycLevelLabel } from "../../lib/format";
import "../../styles/shop-rise.css";
import "./Admin.css";
import "./AdminUsers.css";

type UserFilter = "all" | "admin" | "supervisor" | "banned" | "merchant";

type AdminUserListItem = UserDto & {
  hasShop?: boolean;
  shopStatus?: string | null;
  shopName?: string | null;
  wallet?: {
    tomanBalance: string;
    trxBalance: number;
    usdtBalance: number;
    bnbBalance: number;
    maticBalance: number;
    gramBalance: number;
  } | null;
};

function displayName(user: UserDto): string {
  return (
    user.fullName?.trim() ||
    [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
    user.username ||
    user.telegramId
  );
}

function roleLabel(role: UserRole, t: (key: string) => string): string {
  if (role === "admin") return t("admin.roleAdmin");
  if (role === "supervisor") return t("admin.roleSupervisor");
  return t("admin.roleUser");
}

function UserMeta({ user }: { user: AdminUserListItem }) {
  const { t } = useI18n();
  const parts: Array<{ key: string; ltr?: boolean; content: string }> = [];

  if (user.username) {
    parts.push({ key: "username", ltr: true, content: `@${user.username}` });
  }
  parts.push({ key: "id", ltr: true, content: String(user.telegramId) });
  parts.push({
    key: "balance",
    content: `${formatFaNumber(Number(user.wallet?.tomanBalance ?? 0))} ${t("wallet.toman")}`,
  });
  parts.push({ key: "fee", content: feeLevelLabel(user.feeLevel) });
  if (user.hasShop) {
    parts.push({ key: "shop", content: t("admin.usersFilterMerchants") });
  } else if (!user.isBanned) {
    parts.push({ key: "kyc", content: kycLevelLabel(user.kycLevel) });
  }

  return (
    <div className="admin-user-item__meta">
      {parts.map((part, index) => (
        <span key={part.key} className="admin-user-item__meta-group">
          {index > 0 ? (
            <span className="admin-user-item__meta-sep" aria-hidden />
          ) : null}
          <span
            className={`admin-user-item__meta-part${
              part.ltr ? " admin-user-item__meta-part--ltr" : ""
            }`}
          >
            {part.content}
          </span>
        </span>
      ))}
    </div>
  );
}

function UserItemSkeleton({ index }: { index: number }) {
  return (
    <div
      className="admin-user-item admin-user-item--skeleton shop-rise"
      style={{ "--rise-index": Math.min(index + 2, 8) } as CSSProperties}
      aria-hidden
    >
      <span className="admin-user-skel admin-user-skel--avatar" />
      <div className="admin-user-item__body">
        <span className="admin-user-skel admin-user-skel--name" />
        <span className="admin-user-skel admin-user-skel--sub" />
      </div>
      <span className="admin-user-item__chevron" aria-hidden />
    </div>
  );
}

function FilterIcon({ id }: { id: UserFilter }) {
  const props = { size: 15 };
  if (id === "admin" || id === "supervisor") return <ManagerIcon {...props} />;
  if (id === "merchant") return <ShoppingBag02Icon {...props} />;
  if (id === "banned") return <ChatCancelIcon {...props} />;
  return <User02Icon {...props} />;
}

export function AdminUsersPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { haptic } = useTelegram();
  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<UserFilter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleBack = () => navigate("/admin");
  useTelegramBackButton(handleBack);

  const filters: Array<{ id: UserFilter; label: string }> = useMemo(
    () => [
      { id: "all", label: t("admin.usersFilterAll") },
      { id: "admin", label: t("admin.usersFilterAdmins") },
      { id: "supervisor", label: t("admin.usersFilterSupervisors") },
      { id: "banned", label: t("admin.usersFilterBanned") },
      { id: "merchant", label: t("admin.usersFilterMerchants") },
    ],
    [t],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams();
    if (filter !== "all") params.set("filter", filter);
    const qs = params.toString();
    void apiFetch<{ users: AdminUserListItem[] }>(
      `/admin/users${qs ? `?${qs}` : ""}`,
    )
      .then((d) => {
        if (!cancelled) {
          setUsers(d.users);
          setError(null);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : t("common.error"));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [filter, t]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      const hay = [
        u.fullName,
        u.firstName,
        u.lastName,
        u.username,
        u.telegramId,
        u.email,
        u.phone,
        u.shopName,
        u.feeLevel,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [users, query]);

  const onSearch = (event: FormEvent) => {
    event.preventDefault();
  };

  return (
    <div className="admin-section admin-page admin-users-page">
      <div className="admin-users__sticky">
        <div className="shop-rise" style={{ "--rise-index": 0 } as CSSProperties}>
          <PageHeader title={t("admin.users")} onBack={handleBack} />
        </div>

        <form
          className="admin-users__search shop-rise"
          style={{ "--rise-index": 1 } as CSSProperties}
          onSubmit={onSearch}
        >
          <SearchIcon width={15} height={15} color="var(--text-muted)" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("admin.usersSearchPlaceholder")}
            aria-label={t("admin.usersSearchPlaceholder")}
          />
        </form>

        <div
          className="admin-tabs admin-tabs--5 shop-rise"
          style={{ "--rise-index": 2 } as CSSProperties}
          role="tablist"
          aria-label={t("admin.users")}
        >
          {filters.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={filter === item.id}
              className={`admin-tabs__btn${
                filter === item.id ? " admin-tabs__btn--active" : ""
              }`}
              onClick={() => {
                haptic("light");
                setFilter(item.id);
              }}
            >
              <FilterIcon id={item.id} />
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="admin-users__list" aria-busy="true" aria-label={t("common.loading")}>
          {[0, 1, 2, 3, 4].map((index) => (
            <UserItemSkeleton key={index} index={index} />
          ))}
        </div>
      ) : null}

      {!loading && error ? <p className="admin-empty">{error}</p> : null}

      {!loading && !error && filtered.length === 0 ? (
        <p className="admin-empty">{t("admin.usersEmpty")}</p>
      ) : null}

      {!loading && !error && filtered.length > 0 ? (
        <div className="admin-users__list">
          {filtered.map((user, index) => {
            const name = displayName(user);
            const initial = (name.slice(0, 1) || "؟").toUpperCase();
            return (
              <button
                key={user.id}
                type="button"
                className={`admin-user-item shop-rise admin-user-item--${user.role}${
                  user.isBanned ? " admin-user-item--banned" : ""
                }`}
                style={{ "--rise-index": Math.min(index + 2, 8) } as CSSProperties}
                onClick={() => {
                  haptic("light");
                  navigate(`/admin/users/${user.id}`);
                }}
              >
                <span className="admin-user-item__avatar" aria-hidden>
                  {initial}
                </span>
                <div className="admin-user-item__body">
                  <div className="admin-user-item__top">
                    <p className="admin-user-item__name">{name}</p>
                    <span
                      className={`admin-user-item__badge admin-user-item__badge--${
                        user.isBanned ? "banned" : user.role
                      }`}
                    >
                      {user.isBanned ? t("admin.roleBanned") : roleLabel(user.role, t)}
                    </span>
                  </div>
                  <UserMeta user={user} />
                </div>
                <span className="admin-user-item__chevron" aria-hidden>
                  ›
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
