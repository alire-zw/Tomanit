import { useEffect, useState, type CSSProperties } from "react";
import { AdminScreen } from "../../components/AdminScreen";
import MoneyBagIcon from "../../components/icons/MoneyBagIcon";
import { useNotification } from "../../components/Notification";
import { useI18n } from "../../context/I18nContext";
import { apiFetch } from "../../lib/api";
import "../../styles/shop-rise.css";
import "./Admin.css";

interface Pricing {
  trxBuyRateToman: number;
  trxSellRateToman: number;
}

export function AdminPricingPage() {
  const { notify } = useNotification();
  const { t } = useI18n();
  const [pricing, setPricing] = useState<Pricing>({
    trxBuyRateToman: 8500,
    trxSellRateToman: 8200,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void apiFetch<{ settings: { pricing?: Pricing } }>("/admin/settings")
      .then((d) => {
        if (!cancelled && d.settings?.pricing) setPricing(d.settings.pricing);
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
      await apiFetch("/admin/settings", { method: "PUT", body: { pricing } });
      notify(t("admin.ratesSaved"));
    } catch (err) {
      notify(err instanceof Error ? err.message : t("common.error"), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminScreen title={t("admin.pricing")}>
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
              <MoneyBagIcon width={20} height={20} color="currentColor" />
            </span>
            <div>
              <h2 className="admin-payment-settings__title">{t("admin.pricing")}</h2>
              <p className="admin-payment-settings__hint">{t("admin.pricingHint")}</p>
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <label className="admin-payment-settings__label" htmlFor="admin-buy-trx">
              {t("admin.buyTrxLabel")}
            </label>
            <input
              id="admin-buy-trx"
              className="admin-payment-settings__input"
              type="number"
              dir="ltr"
              value={pricing.trxBuyRateToman}
              onChange={(e) =>
                setPricing({ ...pricing, trxBuyRateToman: Number(e.target.value) })
              }
            />
          </div>

          <div style={{ marginTop: 12 }}>
            <label className="admin-payment-settings__label" htmlFor="admin-sell-trx">
              {t("admin.sellTrxLabel")}
            </label>
            <input
              id="admin-sell-trx"
              className="admin-payment-settings__input"
              type="number"
              dir="ltr"
              value={pricing.trxSellRateToman}
              onChange={(e) =>
                setPricing({ ...pricing, trxSellRateToman: Number(e.target.value) })
              }
            />
          </div>

          <button type="submit" className="admin-payment-settings__save" disabled={saving}>
            {saving ? t("common.loading") : t("common.save")}
          </button>
        </form>
      )}
    </AdminScreen>
  );
}
