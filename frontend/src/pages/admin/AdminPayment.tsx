import { useEffect, useState, type CSSProperties } from "react";
import { AdminScreen } from "../../components/AdminScreen";
import DepositCryptoIcon from "../../components/icons/DepositCryptoIcon";
import { useNotification } from "../../components/Notification";
import { useI18n } from "../../context/I18nContext";
import { apiFetch } from "../../lib/api";
import "../../styles/shop-rise.css";
import "./Admin.css";

export function AdminPaymentPage() {
  const { notify } = useNotification();
  const { t } = useI18n();
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void apiFetch<{ settings: { tronWalletAddress?: string } }>("/admin/settings")
      .then((d) => {
        if (!cancelled) setAddress(String(d.settings?.tronWalletAddress ?? ""));
      })
      .catch(() => null)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiFetch("/admin/settings", {
        method: "PUT",
        body: { tronWalletAddress: address },
      });
      notify(t("admin.addressSaved"));
    } catch (err) {
      notify(err instanceof Error ? err.message : t("common.error"), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminScreen title={t("admin.paymentLabel")}>
      {loading ? (
        <div
          className="admin-payment-settings__card admin-payment-settings__card--skeleton shop-rise"
          style={{ "--rise-index": 1 } as CSSProperties}
          aria-hidden
        >
          <div className="admin-payment-settings__skeleton-head">
            <span className="admin-payment-settings__skeleton-icon" />
            <div className="admin-payment-settings__skeleton-copy">
              <span className="admin-payment-settings__skeleton-line admin-payment-settings__skeleton-line--title" />
              <span className="admin-payment-settings__skeleton-line admin-payment-settings__skeleton-line--hint" />
            </div>
          </div>
          <span className="admin-payment-settings__skeleton-line admin-payment-settings__skeleton-line--action" />
        </div>
      ) : (
        <form
          className="admin-payment-settings__card shop-rise"
          style={{ "--rise-index": 1 } as CSSProperties}
          onSubmit={(e) => void save(e)}
        >
          <div className="admin-payment-settings__head">
            <span className="admin-payment-settings__icon" aria-hidden>
              <DepositCryptoIcon width={20} height={20} color="currentColor" />
            </span>
            <div>
              <h2 className="admin-payment-settings__title">{t("admin.paymentLabel")}</h2>
              <p className="admin-payment-settings__hint">{t("admin.paymentDesc")}</p>
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <label className="admin-payment-settings__label" htmlFor="admin-tron-address">
              {t("admin.trc20Label")}
            </label>
            <input
              id="admin-tron-address"
              className="admin-payment-settings__input"
              dir="ltr"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
            <p className="admin-payment-settings__note">{t("admin.paymentDesc")}</p>
          </div>

          <button type="submit" className="admin-payment-settings__save" disabled={saving}>
            {saving ? t("common.loading") : t("common.save")}
          </button>
        </form>
      )}
    </AdminScreen>
  );
}
