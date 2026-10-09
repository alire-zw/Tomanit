import { useCallback, useEffect, useMemo, useState, type CSSProperties, type FormEvent } from "react";
import { AdminScreen } from "../../components/AdminScreen";
import BitcoinWalletIcon from "../../components/icons/hugeicons/BitcoinWalletIcon";
import { useNotification } from "../../components/Notification";
import { useI18n } from "../../context/I18nContext";
import { apiFetch } from "../../lib/api";
import { formatFaDecimal, formatFaNumber } from "../../lib/format";
import "../../styles/shop-rise.css";
import "./Admin.css";

type MasterWalletRow = {
  id: number;
  asset: string;
  network: string;
  address: string;
  label: string | null;
  isActive: boolean;
  onChainBalance: number | null;
  createdAt: string;
  updatedAt: string;
};

type CatalogItem = {
  asset: string;
  networks: string[];
  symbol: string;
};

type ListResponse = {
  wallets: MasterWalletRow[];
  sweepThresholdToman: number;
  catalog: CatalogItem[];
};

export function AdminMasterWalletsPage() {
  const { t } = useI18n();
  const { notify } = useNotification();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [wallets, setWallets] = useState<MasterWalletRow[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [threshold, setThreshold] = useState(2_000_000);

  const [asset, setAsset] = useState("usdt");
  const [network, setNetwork] = useState("tron");
  const [privateKey, setPrivateKey] = useState("");
  const [label, setLabel] = useState("");

  const networksForAsset = useMemo(() => {
    const item = catalog.find((c) => c.asset === asset);
    return item?.networks ?? [];
  }, [asset, catalog]);

  useEffect(() => {
    if (networksForAsset.length === 0) return;
    if (!networksForAsset.includes(network)) {
      setNetwork(networksForAsset[0]!);
    }
  }, [network, networksForAsset]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<ListResponse>("/admin/master-wallets");
      setWallets(data.wallets);
      setCatalog(data.catalog);
      setThreshold(data.sweepThresholdToman);
      setAsset((current) =>
        data.catalog.some((c) => c.asset === current)
          ? current
          : (data.catalog[0]?.asset ?? current),
      );
    } catch (err) {
      notify(err instanceof Error ? err.message : t("common.error"), "error");
    } finally {
      setLoading(false);
    }
  }, [notify, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!privateKey.trim()) {
      notify(t("admin.masterWalletsKeyRequired"), "error");
      return;
    }
    setSaving(true);
    try {
      await apiFetch("/admin/master-wallets", {
        method: "POST",
        body: {
          asset,
          network,
          privateKey: privateKey.trim(),
          label: label.trim() || null,
          isActive: true,
        },
      });
      setPrivateKey("");
      setLabel("");
      notify(t("admin.masterWalletsSaved"));
      await load();
    } catch (err) {
      notify(err instanceof Error ? err.message : t("common.error"), "error");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (row: MasterWalletRow) => {
    try {
      await apiFetch(`/admin/master-wallets/${row.id}`, {
        method: "PATCH",
        body: { isActive: !row.isActive },
      });
      await load();
    } catch (err) {
      notify(err instanceof Error ? err.message : t("common.error"), "error");
    }
  };

  const remove = async (row: MasterWalletRow) => {
    try {
      await apiFetch(`/admin/master-wallets/${row.id}`, { method: "DELETE" });
      notify(t("admin.masterWalletsDeleted"));
      await load();
    } catch (err) {
      notify(err instanceof Error ? err.message : t("common.error"), "error");
    }
  };

  return (
    <AdminScreen title={t("admin.masterWalletsTitle")}>
      <p
        className="admin-payment-settings__hint shop-rise"
        style={{ "--rise-index": 1 } as CSSProperties}
      >
        {t("admin.masterWalletsDesc", {
          amount: formatFaNumber(threshold),
        })}
      </p>

      <form
        className="admin-payment-settings__card shop-rise"
        style={{ "--rise-index": 2 } as CSSProperties}
        onSubmit={(e) => void onSubmit(e)}
      >
        <div className="admin-payment-settings__head">
          <span className="admin-payment-settings__icon" aria-hidden>
            <BitcoinWalletIcon variant="bulk-rounded" size={20} color="currentColor" />
          </span>
          <div>
            <h2 className="admin-payment-settings__title">
              {t("admin.masterWalletsAdd")}
            </h2>
            <p className="admin-payment-settings__hint">
              {t("admin.masterWalletsAddHint")}
            </p>
          </div>
        </div>

        <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
          <label className="admin-payment-settings__label">
            {t("admin.masterWalletsAsset")}
            <select
              className="admin-payment-settings__input"
              value={asset}
              onChange={(e) => setAsset(e.target.value)}
            >
              {catalog.map((c) => (
                <option key={c.asset} value={c.asset}>
                  {c.symbol}
                </option>
              ))}
            </select>
          </label>

          <label className="admin-payment-settings__label">
            {t("wallet.network")}
            <select
              className="admin-payment-settings__input"
              value={network}
              onChange={(e) => setNetwork(e.target.value)}
            >
              {networksForAsset.map((n) => (
                <option key={n} value={n}>
                  {t(`wallet.networkLabel.${n}`)}
                </option>
              ))}
            </select>
          </label>

          <label className="admin-payment-settings__label">
            {t("admin.masterWalletsLabel")}
            <input
              className="admin-payment-settings__input"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={t("admin.masterWalletsLabelPh")}
            />
          </label>

          <label className="admin-payment-settings__label">
            {t("admin.masterWalletsPrivateKey")}
            <input
              className="admin-payment-settings__input"
              dir="ltr"
              type="password"
              autoComplete="off"
              value={privateKey}
              onChange={(e) => setPrivateKey(e.target.value)}
              placeholder="0x…"
            />
          </label>
          <p className="admin-payment-settings__note">
            {t("admin.masterWalletsKeyNote")}
          </p>
        </div>

        <button type="submit" className="admin-payment-settings__save" disabled={saving || loading}>
          {saving ? t("common.loading") : t("common.save")}
        </button>
      </form>

      <div
        className="admin-payment-settings__card shop-rise"
        style={{ "--rise-index": 3 } as CSSProperties}
      >
        <h2 className="admin-payment-settings__title">{t("admin.masterWalletsList")}</h2>
        {loading ? (
          <p className="admin-payment-settings__hint">{t("common.loading")}</p>
        ) : wallets.length === 0 ? (
          <p className="admin-payment-settings__hint">{t("admin.masterWalletsEmpty")}</p>
        ) : (
          <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
            {wallets.map((row) => (
              <div
                key={row.id}
                style={{
                  border: "1px solid var(--border-subtle)",
                  borderRadius: 12,
                  padding: 12,
                  display: "grid",
                  gap: 6,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <strong>
                    {row.asset.toUpperCase()} · {t(`wallet.networkLabel.${row.network}`)}
                  </strong>
                  <span style={{ color: row.isActive ? "var(--accent)" : "var(--text-muted)" }}>
                    {row.isActive ? t("admin.gatewaysActive") : t("admin.gatewaysInactive")}
                  </span>
                </div>
                {row.label ? (
                  <div style={{ fontSize: 12, color: varTextMuted() }}>{row.label}</div>
                ) : null}
                <div dir="ltr" style={{ fontSize: 12, wordBreak: "break-all" }}>
                  {row.address}
                </div>
                <div style={{ fontSize: 12, color: varTextMuted() }}>
                  {t("admin.masterWalletsOnChain")}:{" "}
                  {row.onChainBalance != null
                    ? formatFaDecimal(row.onChainBalance, 6)
                    : "—"}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  <button
                    type="button"
                    className="admin-payment-settings__save"
                    style={{ minHeight: 36, fontSize: 12 }}
                    onClick={() => void toggleActive(row)}
                  >
                    {row.isActive
                      ? t("admin.masterWalletsDisable")
                      : t("admin.masterWalletsEnable")}
                  </button>
                  <button
                    type="button"
                    className="admin-payment-settings__save"
                    style={{
                      minHeight: 36,
                      fontSize: 12,
                      background: "transparent",
                      color: "var(--error, #dc2626)",
                      border: "1px solid color-mix(in srgb, var(--error, #dc2626) 40%, var(--border-subtle))",
                    }}
                    onClick={() => void remove(row)}
                  >
                    {t("common.delete")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminScreen>
  );
}

function varTextMuted() {
  return "var(--text-muted)";
}
