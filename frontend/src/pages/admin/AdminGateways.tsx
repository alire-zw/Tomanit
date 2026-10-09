import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { AdminScreen } from "../../components/AdminScreen";
import { BottomSheet } from "../../components/BottomSheet";
import { useNotification } from "../../components/Notification";
import GatewayCardIcon from "../../components/icons/GatewayCardIcon";
import GatewayCommissionIcon from "../../components/icons/GatewayCommissionIcon";
import GatewayCopyIcon from "../../components/icons/GatewayCopyIcon";
import GatewayDeleteIcon from "../../components/icons/GatewayDeleteIcon";
import GatewayEditIcon from "../../components/icons/GatewayEditIcon";
import GatewayKeyIcon from "../../components/icons/GatewayKeyIcon";
import GatewayLinkIcon from "../../components/icons/GatewayLinkIcon";
import GatewayRegenIcon from "../../components/icons/GatewayRegenIcon";
import GatewayStatsIcon from "../../components/icons/GatewayStatsIcon";
import GatewayTestIcon from "../../components/icons/GatewayTestIcon";
import GatewayTodayIcon from "../../components/icons/GatewayTodayIcon";
import GatewayViewKeyIcon from "../../components/icons/GatewayViewKeyIcon";
import GatewayYesterdayIcon from "../../components/icons/GatewayYesterdayIcon";
import PlusIcon from "../../components/icons/PlusIcon";
import { useI18n } from "../../context/I18nContext";
import { useTelegram } from "../../hooks/useTelegram";
import { apiFetch } from "../../lib/api";
import { formatFaNumber } from "../../lib/format";
import "../../styles/shop-rise.css";
import "./Admin.css";
import "./AdminGateways.css";

type Gateway = {
  id: number;
  displayName: string;
  ownerName: string;
  backendBaseUrl: string;
  apiKey: string;
  balanceToman: string;
  todayCount: number;
  yesterdayVolumeToman: string;
  yesterdayCount: number;
  commissionPercent: number;
  dailyLimitToman: string | null;
  dailyCountLimit: number | null;
  minAmountToman: number | null;
  maxAmountToman: number | null;
  openHour: number | null;
  closeHour: number | null;
  activeWeekdays: number[] | null;
  ownerTelegramId: string | null;
  ownerIban: string | null;
  settlementNote: string | null;
  consecutiveFailCount: number;
  isActive: boolean;
  isDailyFull: boolean;
  usagePercent: number | null;
  note: string | null;
};

type DayStat = {
  day: string;
  volumeToman: string;
  chargeCount: number;
  commissionToman: string;
};

type GatewayStats = {
  gatewayId: number;
  today: { volumeToman: string; chargeCount: number; commissionToman: string };
  yesterday: { volumeToman: string; chargeCount: number };
  history: DayStat[];
};

const WEEKDAY_KEYS = [
  "gatewaysDaySun",
  "gatewaysDayMon",
  "gatewaysDayTue",
  "gatewaysDayWed",
  "gatewaysDayThu",
  "gatewaysDayFri",
  "gatewaysDaySat",
] as const;

const emptyForm = {
  displayName: "",
  ownerName: "",
  backendBaseUrl: "",
  isActive: true,
  note: "",
  commissionPercent: "0",
  dailyLimitToman: "",
  dailyCountLimit: "",
  minAmountToman: "",
  maxAmountToman: "",
  openHour: "",
  closeHour: "",
  activeWeekdays: null as number[] | null,
  ownerTelegramId: "",
  ownerIban: "",
  settlementNote: "",
};

function numOrNull(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function GatewaySkeleton({ index }: { index: number }) {
  return (
    <article
      className="admin-gw-card admin-gw-card--skeleton shop-rise"
      style={{ "--rise-index": Math.min(index + 2, 8) } as CSSProperties}
      aria-hidden
    >
      <div className="admin-gw-card__head">
        <span className="admin-gw-skel admin-gw-skel--icon" />
        <div className="admin-gw-card__titles">
          <span className="admin-gw-skel admin-gw-skel--title" />
          <span className="admin-gw-skel admin-gw-skel--sub" />
        </div>
        <span className="admin-gw-skel admin-gw-skel--badge" />
      </div>
      <div className="admin-gw-card__rows">
        <span className="admin-gw-skel admin-gw-skel--row" />
        <span className="admin-gw-skel admin-gw-skel--row admin-gw-skel--row-sm" />
      </div>
    </article>
  );
}

export function AdminGatewaysPage() {
  const { t } = useI18n();
  const { notify } = useNotification();
  const { haptic } = useTelegram();
  const [items, setItems] = useState<Gateway[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [keySheetOpen, setKeySheetOpen] = useState(false);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [keyBusy, setKeyBusy] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [stats, setStats] = useState<GatewayStats | null>(null);
  const [statsTitle, setStatsTitle] = useState("");
  const [testBusyId, setTestBusyId] = useState<number | null>(null);

  const weekdayLabels = useMemo(
    () => WEEKDAY_KEYS.map((key) => t(`admin.${key}`)),
    [t],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{ gateways: Gateway[] }>("/admin/payment-gateways");
      setItems(data.gateways);
    } catch (err) {
      notify(err instanceof Error ? err.message : t("common.error"), "error");
    } finally {
      setLoading(false);
    }
  }, [notify, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const closeForm = () => {
    setFormOpen(false);
    setEditingId(null);
    setForm({ ...emptyForm });
  };

  const openAdd = () => {
    haptic("light");
    setEditingId(null);
    setForm({ ...emptyForm });
    setFormOpen(true);
  };

  const openEdit = (g: Gateway) => {
    haptic("light");
    setEditingId(g.id);
    setForm({
      displayName: g.displayName,
      ownerName: g.ownerName,
      backendBaseUrl: g.backendBaseUrl,
      isActive: g.isActive,
      note: g.note ?? "",
      commissionPercent: String(g.commissionPercent ?? 0),
      dailyLimitToman: g.dailyLimitToman ?? "",
      dailyCountLimit: g.dailyCountLimit != null ? String(g.dailyCountLimit) : "",
      minAmountToman: g.minAmountToman != null ? String(g.minAmountToman) : "",
      maxAmountToman: g.maxAmountToman != null ? String(g.maxAmountToman) : "",
      openHour: g.openHour != null ? String(g.openHour) : "",
      closeHour: g.closeHour != null ? String(g.closeHour) : "",
      activeWeekdays: g.activeWeekdays,
      ownerTelegramId: g.ownerTelegramId ?? "",
      ownerIban: g.ownerIban ?? "",
      settlementNote: g.settlementNote ?? "",
    });
    setFormOpen(true);
  };

  const showKey = (apiKey: string) => {
    setRevealedKey(apiKey);
    setKeySheetOpen(true);
  };

  const copyKey = async (key: string) => {
    try {
      await navigator.clipboard.writeText(key);
      notify(t("admin.gatewaysApiKeyCopied"));
      haptic("medium");
    } catch {
      notify(t("common.error"), "error");
    }
  };

  const viewKey = async (id: number) => {
    setKeyBusy(true);
    haptic("light");
    try {
      const res = await apiFetch<{ apiKey: string }>(
        `/admin/payment-gateways/${id}/api-key`,
      );
      showKey(res.apiKey);
    } catch (err) {
      notify(err instanceof Error ? err.message : t("common.error"), "error");
    } finally {
      setKeyBusy(false);
    }
  };

  const openStats = async (g: Gateway) => {
    haptic("light");
    setStatsTitle(g.displayName);
    setStatsOpen(true);
    setStatsLoading(true);
    setStats(null);
    try {
      const res = await apiFetch<GatewayStats>(
        `/admin/payment-gateways/${g.id}/stats?days=14`,
      );
      setStats(res);
    } catch (err) {
      notify(err instanceof Error ? err.message : t("common.error"), "error");
      setStatsOpen(false);
    } finally {
      setStatsLoading(false);
    }
  };

  const testConnection = async (id: number) => {
    setTestBusyId(id);
    haptic("light");
    try {
      const res = await apiFetch<{
        ok: boolean;
        status?: number;
        latencyMs?: number;
        url?: string;
        error?: string;
      }>(`/admin/payment-gateways/${id}/test`, { method: "POST" });
      if (res.ok) {
        notify(
          t("admin.gatewaysTestOk", {
            ms: String(res.latencyMs ?? 0),
            status: String(res.status ?? ""),
          }),
        );
        haptic("medium");
      } else {
        notify(res.error || t("admin.gatewaysTestFail"), "error");
      }
    } catch (err) {
      notify(err instanceof Error ? err.message : t("admin.gatewaysTestFail"), "error");
    } finally {
      setTestBusyId(null);
    }
  };

  const toggleWeekday = (day: number) => {
    setForm((f) => {
      const current = f.activeWeekdays;
      if (current == null) {
        // switching from "all days" → all except toggled off? Start with only this day.
        return { ...f, activeWeekdays: [day] };
      }
      const has = current.includes(day);
      const next = has ? current.filter((d) => d !== day) : [...current, day].sort((a, b) => a - b);
      return { ...f, activeWeekdays: next.length === 7 ? null : next.length ? next : [] };
    });
  };

  const setAllWeekdays = () => setForm((f) => ({ ...f, activeWeekdays: null }));

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const basic = {
        displayName: form.displayName.trim(),
        ownerName: form.ownerName.trim(),
        backendBaseUrl: form.backendBaseUrl.trim(),
      };
      if (editingId == null) {
        const res = await apiFetch<{ gateway: Gateway; apiKey: string }>(
          "/admin/payment-gateways",
          {
            method: "POST",
            body: {
              ...basic,
              isActive: true,
            },
          },
        );
        notify(t("admin.gatewaysCreated"));
        closeForm();
        await load();
        showKey(res.apiKey);
      } else {
        await apiFetch(`/admin/payment-gateways/${editingId}`, {
          method: "PUT",
          body: {
            ...basic,
            isActive: form.isActive,
            note: form.note.trim() || null,
            commissionPercent: Number(form.commissionPercent) || 0,
            dailyLimitToman: numOrNull(form.dailyLimitToman),
            dailyCountLimit: numOrNull(form.dailyCountLimit),
            minAmountToman: numOrNull(form.minAmountToman),
            maxAmountToman: numOrNull(form.maxAmountToman),
            openHour: numOrNull(form.openHour),
            closeHour: numOrNull(form.closeHour),
            activeWeekdays: form.activeWeekdays,
            ownerTelegramId: form.ownerTelegramId.trim() || null,
            ownerIban: form.ownerIban.trim() || null,
            settlementNote: form.settlementNote.trim() || null,
          },
        });
        notify(t("admin.gatewaysUpdated"));
        closeForm();
        await load();
      }
      haptic("medium");
    } catch (err) {
      notify(err instanceof Error ? err.message : t("common.error"), "error");
    } finally {
      setSaving(false);
    }
  };

  const regenerateKey = async (id: number) => {
    if (!window.confirm(t("admin.gatewaysRegenConfirm"))) return;
    setKeyBusy(true);
    try {
      const res = await apiFetch<{ gateway: Gateway; apiKey: string }>(
        `/admin/payment-gateways/${id}/regenerate-key`,
        { method: "POST" },
      );
      notify(t("admin.gatewaysApiKeyRegen"));
      await load();
      showKey(res.apiKey);
    } catch (err) {
      notify(err instanceof Error ? err.message : t("common.error"), "error");
    } finally {
      setKeyBusy(false);
    }
  };

  const remove = async (id: number) => {
    if (!window.confirm(t("admin.gatewaysDeleteConfirm"))) return;
    try {
      await apiFetch(`/admin/payment-gateways/${id}`, { method: "DELETE" });
      notify(t("admin.gatewaysDeleted"));
      if (editingId === id) closeForm();
      await load();
    } catch (err) {
      notify(err instanceof Error ? err.message : t("common.error"), "error");
    }
  };

  const canSave =
    form.displayName.trim().length > 0 &&
    form.ownerName.trim().length > 0 &&
    form.backendBaseUrl.trim().length > 0;

  const statusBadge = (g: Gateway) => {
    if (!g.isActive) return { cls: "admin-gw-card__badge--off", label: t("admin.gatewaysInactive") };
    if (g.isDailyFull) return { cls: "admin-gw-card__badge--full", label: t("admin.gatewaysFull") };
    return { cls: "", label: t("admin.gatewaysActive") };
  };

  return (
    <AdminScreen
      title={t("admin.gatewaysTitle")}
      meta={
        <button
          type="button"
          className="admin-gw__header-add"
          onClick={openAdd}
          aria-label={t("admin.gatewaysAdd")}
        >
          <PlusIcon width={18} height={18} color="currentColor" />
        </button>
      }
    >
      <p className="admin-gw__lead shop-rise" style={{ "--rise-index": 1 } as CSSProperties}>
        {t("admin.gatewaysLead")}
      </p>

      {loading ? (
        <div className="admin-gw__list" aria-busy="true">
          {[0, 1, 2].map((index) => (
            <GatewaySkeleton key={index} index={index} />
          ))}
        </div>
      ) : null}

      {!loading && items.length === 0 ? (
        <div className="admin-gw__empty shop-rise" style={{ "--rise-index": 2 } as CSSProperties}>
          <span className="admin-gw__empty-icon" aria-hidden>
            <GatewayCardIcon width={28} height={28} color="var(--accent)" />
          </span>
          <p className="admin-gw__empty-title">{t("admin.gatewaysEmpty")}</p>
          <p className="admin-gw__empty-hint">{t("admin.gatewaysEmptyHint")}</p>
          <button type="button" className="admin-gw__empty-btn" onClick={openAdd}>
            <PlusIcon width={16} height={16} color="currentColor" />
            {t("admin.gatewaysAdd")}
          </button>
        </div>
      ) : null}

      {!loading && items.length > 0 ? (
        <div className="admin-gw__list">
          {items.map((g, index) => {
            const badge = statusBadge(g);
            return (
              <article
                key={g.id}
                className={`admin-gw-card shop-rise${
                  g.isActive ? "" : " admin-gw-card--off"
                }${g.isDailyFull ? " admin-gw-card--full" : ""}`}
                style={{ "--rise-index": Math.min(index + 2, 8) } as CSSProperties}
              >
                <div className="admin-gw-card__head">
                  <span className="admin-gw-card__icon" aria-hidden>
                    <GatewayCardIcon width={20} height={20} color="currentColor" />
                  </span>
                  <div className="admin-gw-card__titles">
                    <h3 className="admin-gw-card__name">{g.displayName}</h3>
                    <p className="admin-gw-card__owner">{g.ownerName}</p>
                  </div>
                  <span className={`admin-gw-card__badge ${badge.cls}`}>{badge.label}</span>
                </div>

                <div className="admin-gw-card__metrics">
                  <div className="admin-gw-card__metric">
                    <span className="admin-gw-card__metric-label">
                      <GatewayTodayIcon width={12} height={12} color="currentColor" />
                      {t("admin.gatewaysToday")}
                    </span>
                    <span className="admin-gw-card__metric-value">
                      {formatFaNumber(Number(g.balanceToman))}
                      {g.dailyLimitToman
                        ? ` / ${formatFaNumber(Number(g.dailyLimitToman))}`
                        : ""}
                    </span>
                    {g.usagePercent != null ? (
                      <span className="admin-gw-card__metric-sub">
                        {formatFaNumber(g.usagePercent)}٪ · {formatFaNumber(g.todayCount)}{" "}
                        {t("admin.gatewaysTx")}
                      </span>
                    ) : (
                      <span className="admin-gw-card__metric-sub">
                        {formatFaNumber(g.todayCount)} {t("admin.gatewaysTx")}
                      </span>
                    )}
                  </div>
                  <div className="admin-gw-card__metric">
                    <span className="admin-gw-card__metric-label">
                      <GatewayYesterdayIcon width={12} height={12} color="currentColor" />
                      {t("admin.gatewaysYesterday")}
                    </span>
                    <span className="admin-gw-card__metric-value">
                      {formatFaNumber(Number(g.yesterdayVolumeToman))}
                    </span>
                    <span className="admin-gw-card__metric-sub">
                      {formatFaNumber(g.yesterdayCount)} {t("admin.gatewaysTx")}
                    </span>
                  </div>
                  <div className="admin-gw-card__metric">
                    <span className="admin-gw-card__metric-label">
                      <GatewayCommissionIcon width={12} height={12} color="currentColor" />
                      {t("admin.gatewaysCommission")}
                    </span>
                    <span className="admin-gw-card__metric-value">
                      {formatFaNumber(g.commissionPercent)}٪
                    </span>
                  </div>
                </div>

                <div className="admin-gw-card__rows">
                  <div className="admin-gw-card__pair">
                    <div className="admin-gw-card__row">
                      <GatewayLinkIcon width={14} height={14} color="var(--text-muted)" />
                      <span className="admin-gw-card__row-text" dir="ltr" title={g.backendBaseUrl}>
                        {g.backendBaseUrl}
                      </span>
                    </div>
                    <div className="admin-gw-card__row">
                      <GatewayKeyIcon width={14} height={14} color="var(--text-muted)" />
                      <span className="admin-gw-card__row-text" dir="ltr" title={g.apiKey}>
                        {g.apiKey}
                      </span>
                    </div>
                  </div>
                  {(g.minAmountToman != null || g.maxAmountToman != null) && (
                    <div className="admin-gw-card__row">
                      <GatewayCommissionIcon width={14} height={14} color="var(--text-muted)" />
                      <span className="admin-gw-card__row-text">
                        {t("admin.gatewaysAmountRange")}:{" "}
                        {g.minAmountToman != null
                          ? formatFaNumber(g.minAmountToman)
                          : "…"}{" "}
                        –{" "}
                        {g.maxAmountToman != null
                          ? formatFaNumber(g.maxAmountToman)
                          : "…"}
                      </span>
                    </div>
                  )}
                  {g.note ? <p className="admin-gw-card__note">{g.note}</p> : null}
                </div>

                <div className="admin-gw-card__actions">
                  <button
                    type="button"
                    className="admin-gw-card__action"
                    onClick={() => void openStats(g)}
                  >
                    <GatewayStatsIcon width={15} height={15} color="currentColor" />
                    <span>{t("admin.gatewaysStats")}</span>
                  </button>
                  <button
                    type="button"
                    className="admin-gw-card__action"
                    disabled={testBusyId === g.id}
                    onClick={() => void testConnection(g.id)}
                  >
                    <GatewayTestIcon width={15} height={15} color="currentColor" />
                    <span>
                      {testBusyId === g.id
                        ? t("common.loading")
                        : t("admin.gatewaysTest")}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="admin-gw-card__action"
                    disabled={keyBusy}
                    onClick={() => void viewKey(g.id)}
                  >
                    <GatewayViewKeyIcon width={15} height={15} color="currentColor" />
                    <span>{t("admin.gatewaysViewKey")}</span>
                  </button>
                  <button
                    type="button"
                    className="admin-gw-card__action"
                    onClick={() => openEdit(g)}
                  >
                    <GatewayEditIcon width={15} height={15} color="currentColor" />
                    <span>{t("common.edit")}</span>
                  </button>
                  <button
                    type="button"
                    className="admin-gw-card__action"
                    disabled={keyBusy}
                    onClick={() => void regenerateKey(g.id)}
                  >
                    <GatewayRegenIcon width={15} height={15} color="currentColor" />
                    <span>{t("admin.gatewaysRegen")}</span>
                  </button>
                  <button
                    type="button"
                    className="admin-gw-card__action admin-gw-card__action--danger"
                    onClick={() => void remove(g.id)}
                  >
                    <GatewayDeleteIcon width={15} height={15} color="currentColor" />
                    <span>{t("common.delete")}</span>
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}

      <BottomSheet
        open={formOpen}
        onClose={closeForm}
        title={editingId == null ? t("admin.gatewaysAdd") : t("admin.gatewaysEdit")}
        description={
          editingId == null ? t("admin.gatewaysApiKeyAuto") : t("admin.gatewaysLeadShort")
        }
        className={`admin-gw-sheet${editingId == null ? " admin-gw-sheet--create" : ""}`}
        buttons={[
          {
            label: t("common.cancel"),
            onClick: closeForm,
            variant: "default",
            disabled: saving,
          },
          {
            label: saving ? t("common.loading") : t("common.save"),
            onClick: () => void save(),
            variant: "primary",
            disabled: !canSave || saving,
          },
        ]}
      >
        <div className="admin-gw-sheet__stack">
          <div className="admin-gw-sheet__pair">
            <label className="admin-gw-field" htmlFor="gw-display-name">
              <span className="admin-gw-field__label">{t("admin.gatewaysDisplayName")}</span>
              <input
                id="gw-display-name"
                className="admin-gw-field__input"
                placeholder={t("admin.gatewaysDisplayNamePh")}
                value={form.displayName}
                onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
                autoComplete="off"
              />
            </label>

            <label className="admin-gw-field" htmlFor="gw-owner">
              <span className="admin-gw-field__label">{t("admin.gatewaysOwner")}</span>
              <input
                id="gw-owner"
                className="admin-gw-field__input"
                placeholder={t("admin.gatewaysOwnerPh")}
                value={form.ownerName}
                onChange={(e) => setForm((f) => ({ ...f, ownerName: e.target.value }))}
                autoComplete="off"
              />
            </label>
          </div>

          <label className="admin-gw-field" htmlFor="gw-url">
            <span className="admin-gw-field__label">{t("admin.gatewaysBackendUrl")}</span>
            <input
              id="gw-url"
              className="admin-gw-field__input"
              dir="ltr"
              placeholder={t("admin.gatewaysBackendUrlPh")}
              value={form.backendBaseUrl}
              onChange={(e) => setForm((f) => ({ ...f, backendBaseUrl: e.target.value }))}
              autoComplete="off"
              spellCheck={false}
            />
          </label>
        </div>

        {editingId != null ? (
          <>
            <div className="admin-gw-sheet__divider" />
            <div className="admin-gw-sheet__grid">
              <label className="admin-gw-field" htmlFor="gw-commission">
                <span className="admin-gw-field__label">{t("admin.gatewaysCommission")}</span>
                <input
                  id="gw-commission"
                  className="admin-gw-field__input"
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  dir="ltr"
                  value={form.commissionPercent}
                  placeholder="0"
                  onChange={(e) => setForm((f) => ({ ...f, commissionPercent: e.target.value }))}
                />
              </label>
              <label className="admin-gw-field" htmlFor="gw-daily-limit">
                <span className="admin-gw-field__label">{t("admin.gatewaysDailyLimit")}</span>
                <input
                  id="gw-daily-limit"
                  className="admin-gw-field__input"
                  type="number"
                  min={0}
                  dir="ltr"
                  placeholder={t("admin.gatewaysUnlimited")}
                  value={form.dailyLimitToman}
                  onChange={(e) => setForm((f) => ({ ...f, dailyLimitToman: e.target.value }))}
                />
              </label>
              <label className="admin-gw-field" htmlFor="gw-daily-count">
                <span className="admin-gw-field__label">{t("admin.gatewaysDailyCount")}</span>
                <input
                  id="gw-daily-count"
                  className="admin-gw-field__input"
                  type="number"
                  min={0}
                  dir="ltr"
                  placeholder={t("admin.gatewaysUnlimited")}
                  value={form.dailyCountLimit}
                  onChange={(e) => setForm((f) => ({ ...f, dailyCountLimit: e.target.value }))}
                />
              </label>
              <label className="admin-gw-field" htmlFor="gw-min">
                <span className="admin-gw-field__label">{t("admin.gatewaysMinAmount")}</span>
                <input
                  id="gw-min"
                  className="admin-gw-field__input"
                  type="number"
                  min={0}
                  dir="ltr"
                  value={form.minAmountToman}
                  placeholder={t("admin.gatewaysUnlimited")}
                  onChange={(e) => setForm((f) => ({ ...f, minAmountToman: e.target.value }))}
                />
              </label>
              <label className="admin-gw-field" htmlFor="gw-max">
                <span className="admin-gw-field__label">{t("admin.gatewaysMaxAmount")}</span>
                <input
                  id="gw-max"
                  className="admin-gw-field__input"
                  type="number"
                  min={0}
                  dir="ltr"
                  value={form.maxAmountToman}
                  placeholder={t("admin.gatewaysUnlimited")}
                  onChange={(e) => setForm((f) => ({ ...f, maxAmountToman: e.target.value }))}
                />
              </label>
              <label className="admin-gw-field" htmlFor="gw-open">
                <span className="admin-gw-field__label">{t("admin.gatewaysOpenHour")}</span>
                <input
                  id="gw-open"
                  className="admin-gw-field__input"
                  type="number"
                  min={0}
                  max={23}
                  dir="ltr"
                  placeholder="0–23"
                  value={form.openHour}
                  onChange={(e) => setForm((f) => ({ ...f, openHour: e.target.value }))}
                />
              </label>
              <label className="admin-gw-field" htmlFor="gw-close">
                <span className="admin-gw-field__label">{t("admin.gatewaysCloseHour")}</span>
                <input
                  id="gw-close"
                  className="admin-gw-field__input"
                  type="number"
                  min={1}
                  max={24}
                  dir="ltr"
                  placeholder="1–24"
                  value={form.closeHour}
                  onChange={(e) => setForm((f) => ({ ...f, closeHour: e.target.value }))}
                />
              </label>
            </div>

            <div className="admin-gw-field">
              <div className="admin-gw-sheet__label-row">
                <span className="admin-gw-field__label">{t("admin.gatewaysWeekdays")}</span>
                <button type="button" className="admin-gw-sheet__link" onClick={setAllWeekdays}>
                  {t("admin.gatewaysAllDays")}
                </button>
              </div>
              <div className="admin-gw-sheet__days">
                {weekdayLabels.map((label, day) => {
                  const active =
                    form.activeWeekdays == null || form.activeWeekdays.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      className={`admin-gw-sheet__day${active ? " is-on" : ""}`}
                      onClick={() => toggleWeekday(day)}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <label className="admin-gw-field" htmlFor="gw-tg">
              <span className="admin-gw-field__label">{t("admin.gatewaysOwnerTelegram")}</span>
              <input
                id="gw-tg"
                className="admin-gw-field__input"
                dir="ltr"
                value={form.ownerTelegramId}
                placeholder="@username"
                onChange={(e) => setForm((f) => ({ ...f, ownerTelegramId: e.target.value }))}
              />
            </label>

            <label className="admin-gw-field" htmlFor="gw-iban">
              <span className="admin-gw-field__label">{t("admin.gatewaysOwnerIban")}</span>
              <input
                id="gw-iban"
                className="admin-gw-field__input"
                dir="ltr"
                value={form.ownerIban}
                placeholder="IR…"
                onChange={(e) => setForm((f) => ({ ...f, ownerIban: e.target.value }))}
              />
            </label>

            <label className="admin-gw-field" htmlFor="gw-settle">
              <span className="admin-gw-field__label">{t("admin.gatewaysSettlementNote")}</span>
              <input
                id="gw-settle"
                className="admin-gw-field__input"
                value={form.settlementNote}
                onChange={(e) => setForm((f) => ({ ...f, settlementNote: e.target.value }))}
              />
            </label>

            <label className="admin-gw-field" htmlFor="gw-note">
              <span className="admin-gw-field__label">{t("admin.gatewaysNote")}</span>
              <input
                id="gw-note"
                className="admin-gw-field__input"
                value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              />
            </label>

            <div className="admin-gw-sheet__row">
              <button
                type="button"
                className={`admin-gw-sheet__switch${form.isActive ? " is-on" : ""}`}
                onClick={() => setForm((f) => ({ ...f, isActive: !f.isActive }))}
                aria-pressed={form.isActive}
              >
                <span className="admin-gw-sheet__switch-thumb" />
              </button>
              <span className="admin-gw-sheet__switch-label">{t("admin.gatewaysActive")}</span>
            </div>
          </>
        ) : null}
      </BottomSheet>

      <BottomSheet
        open={statsOpen}
        onClose={() => {
          setStatsOpen(false);
          setStats(null);
        }}
        title={t("admin.gatewaysStatsTitle", { name: statsTitle })}
        description={t("admin.gatewaysStatsHint")}
        className="admin-gw-stats-sheet"
        buttons={[
          {
            label: t("common.close"),
            onClick: () => {
              setStatsOpen(false);
              setStats(null);
            },
            variant: "primary",
          },
        ]}
      >
        {statsLoading ? <p className="admin-gw-stats__loading">{t("common.loading")}</p> : null}
        {stats ? (
          <div className="admin-gw-stats">
            <div className="admin-gw-stats__summary">
              <div>
                <span>{t("admin.gatewaysToday")}</span>
                <strong>
                  {formatFaNumber(Number(stats.today.volumeToman))} ·{" "}
                  {formatFaNumber(stats.today.chargeCount)}
                </strong>
              </div>
              <div>
                <span>{t("admin.gatewaysYesterday")}</span>
                <strong>
                  {formatFaNumber(Number(stats.yesterday.volumeToman))} ·{" "}
                  {formatFaNumber(stats.yesterday.chargeCount)}
                </strong>
              </div>
              <div>
                <span>{t("admin.gatewaysCommissionEst")}</span>
                <strong>{formatFaNumber(Number(stats.today.commissionToman))}</strong>
              </div>
            </div>
            <div className="admin-gw-stats__list">
              {stats.history.length === 0 ? (
                <p className="admin-gw-stats__empty">{t("admin.gatewaysStatsEmpty")}</p>
              ) : (
                stats.history.map((row) => (
                  <div key={row.day} className="admin-gw-stats__row">
                    <span className="admin-gw-stats__day" dir="ltr">
                      {row.day}
                    </span>
                    <span>
                      {formatFaNumber(Number(row.volumeToman))} ·{" "}
                      {formatFaNumber(row.chargeCount)} {t("admin.gatewaysTx")}
                    </span>
                    <span className="admin-gw-stats__fee">
                      {formatFaNumber(Number(row.commissionToman))}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : null}
      </BottomSheet>

      <BottomSheet
        open={keySheetOpen && Boolean(revealedKey)}
        onClose={() => {
          setKeySheetOpen(false);
          setRevealedKey(null);
        }}
        title={t("admin.gatewaysApiKey")}
        description={t("admin.gatewaysApiKeyViewHint")}
        className="admin-gw-key-sheet"
        buttons={[
          {
            label: t("common.close"),
            onClick: () => {
              setKeySheetOpen(false);
              setRevealedKey(null);
            },
            variant: "default",
          },
          {
            label: t("admin.gatewaysApiKeyCopy"),
            onClick: () => {
              if (revealedKey) void copyKey(revealedKey);
            },
            variant: "primary",
          },
        ]}
      >
        <div className="admin-gw-key-sheet__box">
          <span className="admin-gw-key-sheet__icon" aria-hidden>
            <GatewayKeyIcon width={22} height={22} color="var(--accent)" />
          </span>
          <code className="admin-gw-key-sheet__value" dir="ltr">
            {revealedKey}
          </code>
          <button
            type="button"
            className="admin-gw-key-sheet__copy"
            onClick={() => {
              if (revealedKey) void copyKey(revealedKey);
            }}
            aria-label={t("admin.gatewaysApiKeyCopy")}
          >
            <GatewayCopyIcon width={16} height={16} color="currentColor" />
          </button>
        </div>
      </BottomSheet>
    </AdminScreen>
  );
}
