import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../../components/PageHeader";
import { useNotification } from "../../components/Notification";
import CoinsSwapIcon from "../../components/icons/hugeicons/CoinsSwapIcon";
import ImageUploadIcon from "../../components/icons/hugeicons/ImageUploadIcon";
import ShoppingBag02Icon from "../../components/icons/hugeicons/ShoppingBag02Icon";
import User02Icon from "../../components/icons/hugeicons/User02Icon";
import { useI18n } from "../../context/I18nContext";
import { useAuth } from "../../hooks/useAuth";
import { useTelegram } from "../../hooks/useTelegram";
import {
  INVOICE_THEME_IDS,
  INVOICE_THEME_SWATCH,
  parseInvoiceTheme,
  type InvoiceThemeId,
} from "../../lib/invoiceThemes";
import { parseFeeBearer, type MerchantFeeBearer } from "../../lib/merchantPayFee";
import {
  fetchShopHub,
  updateShopSettings,
  type MerchantShop,
} from "../../lib/shop";
import "../../styles/shop-rise.css";
import "../MyShop.css";

const LOGO_MAX_BYTES = 5 * 1024 * 1024;

const FEE_OPTIONS: Array<{
  id: MerchantFeeBearer;
  Icon: typeof User02Icon;
}> = [
  { id: "payer", Icon: User02Icon },
  { id: "merchant", Icon: ShoppingBag02Icon },
  { id: "split", Icon: CoinsSwapIcon },
];

export function ShopGatewaySettingsPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { haptic } = useTelegram();
  const { notify } = useNotification();
  const { applyShopHub } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [shop, setShop] = useState<MerchantShop | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [theme, setTheme] = useState<InvoiceThemeId>("teal");
  const [feeBearer, setFeeBearer] = useState<MerchantFeeBearer>("payer");
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const hub = await fetchShopHub();
        if (cancelled) return;
        applyShopHub(hub);
        const s = hub.shop;
        setShop(s);
        if (s) {
          setTheme(parseInvoiceTheme(s.invoiceTheme));
          setFeeBearer(parseFeeBearer(s.feeBearer));
          setLogoPreview(s.logoDataUrl);
        }
      } catch {
        if (!cancelled) setShop(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applyShopHub]);

  const persist = async (patch: {
    logoDataUrl?: string | null;
    invoiceTheme?: InvoiceThemeId;
    feeBearer?: MerchantFeeBearer;
  }) => {
    setSaving(true);
    try {
      const { shop: updated } = await updateShopSettings(patch);
      setShop(updated);
      setTheme(parseInvoiceTheme(updated.invoiceTheme));
      setFeeBearer(parseFeeBearer(updated.feeBearer));
      setLogoPreview(updated.logoDataUrl);
      const hub = await fetchShopHub();
      applyShopHub(hub);
      notify(t("myShop.gatewaySettingsSaved"), "success");
    } catch (err) {
      notify(err instanceof Error ? err.message : t("common.error"), "error");
    } finally {
      setSaving(false);
    }
  };

  const onLogoFile = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      notify(t("myShop.regLogoBadType"), "error");
      return;
    }
    if (file.size > LOGO_MAX_BYTES) {
      notify(t("myShop.regLogoTooBig"), "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : null;
      if (!result) return;
      setLogoPreview(result);
      haptic("light");
      void persist({ logoDataUrl: result });
    };
    reader.readAsDataURL(file);
  };

  const onThemePick = (id: InvoiceThemeId) => {
    if (id === theme || saving) return;
    haptic("light");
    setTheme(id);
    void persist({ invoiceTheme: id });
  };

  const onFeePick = (id: MerchantFeeBearer) => {
    if (id === feeBearer || saving) return;
    haptic("light");
    setFeeBearer(id);
    void persist({ feeBearer: id });
  };

  const shopName = shop?.name ?? t("myShop.emptyShopName");

  return (
    <div className="my-shop my-shop--sub">
      <div className="shop-rise" style={{ "--rise-index": 0 } as CSSProperties}>
        <PageHeader
          title={t("myShop.tileGatewaySettings")}
          onBack={() => navigate("/shop")}
        />
      </div>

      <div className="my-shop__body">
        {loading ? (
          <div
            className="my-shop__gs-skel shop-rise"
            style={{ "--rise-index": 1 } as CSSProperties}
            aria-busy
            aria-label={t("common.loading")}
          >
            <span className="my-shop__gs-skel-hint" />
            <div className="my-shop__list">
              <div className="my-shop__item my-shop__item--static my-shop__gs-skel-item">
                <span className="my-shop__item-icon my-shop__invoice-skel-icon" />
                <div className="my-shop__item-body">
                  <span className="my-shop__invoice-skel-code" />
                  <span className="my-shop__invoice-skel-sub" />
                </div>
                <div className="my-shop__item-end">
                  <span className="my-shop__invoice-skel-btn" />
                </div>
              </div>
            </div>
            <span className="my-shop__gs-skel-hint my-shop__gs-skel-hint--sm" />
            <div className="my-shop__theme-box my-shop__theme-box--skel">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="my-shop__theme-cell my-shop__theme-cell--skel" aria-hidden>
                  <span className="my-shop__theme-dot my-shop__gs-skel-dot" />
                  <span className="my-shop__gs-skel-line" />
                </div>
              ))}
            </div>
            <span className="my-shop__gs-skel-hint my-shop__gs-skel-hint--sm" />
            <div className="my-shop__docs-links">
              {[0, 1, 2].map((i) => (
                <div key={i} className="my-shop__docs-row my-shop__gs-skel-fee" aria-hidden>
                  <span className="my-shop__docs-icon my-shop__invoice-skel-icon" />
                  <span className="my-shop__docs-copy">
                    <span className="my-shop__invoice-skel-code" />
                    <span className="my-shop__invoice-skel-sub" />
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : !shop ? (
          <p className="my-shop__hint shop-rise" style={{ "--rise-index": 1 } as CSSProperties}>
            {t("myShop.emptyTitle")}
          </p>
        ) : (
          <>
            <p
              className="my-shop__hint shop-rise"
              style={{ "--rise-index": 1 } as CSSProperties}
            >
              {t("myShop.tileGatewaySettingsHint")}
            </p>

            <div
              className="my-shop__list shop-rise"
              style={{ "--rise-index": 2 } as CSSProperties}
            >
              <div className="my-shop__item my-shop__item--static">
                <span className="my-shop__item-icon" aria-hidden>
                  {logoPreview ? (
                    <img src={logoPreview} alt="" width={16} height={16} />
                  ) : (
                    <ShoppingBag02Icon size={16} />
                  )}
                </span>
                <div className="my-shop__item-body">
                  <div className="my-shop__item-title">{shopName}</div>
                  <div className="my-shop__item-sub">{t("myShop.gatewayLogoHint")}</div>
                </div>
                <div className="my-shop__item-end">
                  <button
                    type="button"
                    className="my-shop__icon-btn"
                    aria-label={t("myShop.gatewayLogoChange")}
                    disabled={saving}
                    onClick={() => {
                      haptic("light");
                      fileRef.current?.click();
                    }}
                  >
                    <ImageUploadIcon variant="bulk-rounded" size={14} color="currentColor" />
                  </button>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    e.target.value = "";
                    onLogoFile(file);
                  }}
                />
              </div>
            </div>

            <p
              className="my-shop__hint shop-rise"
              style={{ "--rise-index": 3 } as CSSProperties}
            >
              {t("myShop.gatewayThemeDesc")}
            </p>

            <div
              className="my-shop__theme-box shop-rise"
              style={{ "--rise-index": 4 } as CSSProperties}
              role="list"
              aria-label={t("myShop.gatewayThemeTitle")}
            >
              {INVOICE_THEME_IDS.map((id) => {
                const selected = theme === id;
                return (
                  <button
                    key={id}
                    type="button"
                    role="listitem"
                    className={`my-shop__theme-cell${selected ? " is-active" : ""}`}
                    style={{ "--swatch": INVOICE_THEME_SWATCH[id] } as CSSProperties}
                    aria-pressed={selected}
                    disabled={saving}
                    onClick={() => onThemePick(id)}
                  >
                    <span className="my-shop__theme-dot" aria-hidden />
                    <span className="my-shop__theme-name">
                      {t(`myShop.gatewayTheme_${id}`)}
                    </span>
                  </button>
                );
              })}
            </div>

            <p
              className="my-shop__hint shop-rise"
              style={{ "--rise-index": 5 } as CSSProperties}
            >
              {t("myShop.gatewayFeeDesc")}
            </p>

            <div
              className="my-shop__docs-links shop-rise"
              style={{ "--rise-index": 6 } as CSSProperties}
            >
              {FEE_OPTIONS.map(({ id, Icon }) => {
                const selected = feeBearer === id;
                return (
                  <button
                    key={id}
                    type="button"
                    className={`my-shop__docs-row${selected ? " my-shop__docs-row--active" : ""}`}
                    aria-pressed={selected}
                    disabled={saving}
                    onClick={() => onFeePick(id)}
                  >
                    <span className="my-shop__docs-icon" aria-hidden>
                      <Icon variant="bulk-rounded" size={18} color="currentColor" />
                    </span>
                    <span className="my-shop__docs-copy">
                      <span className="my-shop__docs-title">
                        {t(`myShop.gatewayFee_${id}`)}
                      </span>
                      <span className="my-shop__docs-desc">
                        {t(`myShop.gatewayFee_${id}Hint`)}
                      </span>
                    </span>
                    {selected ? (
                      <span className="my-shop__badge my-shop__badge--ok">
                        {t("myShop.statusActive")}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
