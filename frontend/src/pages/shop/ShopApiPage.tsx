import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../../components/PageHeader";
import { useNotification } from "../../components/Notification";
import Copy01Icon from "../../components/icons/hugeicons/Copy01Icon";
import DocumentCodeIcon from "../../components/icons/hugeicons/DocumentCodeIcon";
import GlassesIcon from "../../components/icons/hugeicons/GlassesIcon";
import { useI18n } from "../../context/I18nContext";
import { useTelegram } from "../../hooks/useTelegram";
import { fetchShopApiKey, type ShopApiKeyPayload } from "../../lib/shop";
import "../../styles/shop-rise.css";
import "../MyShop.css";

function MenuChevron({ flip }: { flip?: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      fill="none"
      viewBox="0 0 24 24"
      style={flip ? { transform: "scaleX(-1)" } : undefined}
      aria-hidden
    >
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="m15 18-6-6 6-6"
      />
    </svg>
  );
}

export function ShopApiPage() {
  const { t, isRTL } = useI18n();
  const navigate = useNavigate();
  const { haptic } = useTelegram();
  const { notify } = useNotification();
  const [revealed, setRevealed] = useState(false);
  const [payload, setPayload] = useState<ShopApiKeyPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchShopApiKey();
      setPayload(data);
    } catch (err) {
      setPayload(null);
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const displayKey = payload
    ? revealed
      ? payload.apiKey
      : payload.masked
    : loading
      ? "TomanIt:••••:••••••••"
      : "—";

  const copyKey = async () => {
    haptic("light");
    if (!payload?.apiKey) {
      notify(error ?? t("common.error"), "error");
      return;
    }
    try {
      await navigator.clipboard.writeText(payload.apiKey);
      notify(t("common.copied"), "success");
    } catch {
      notify(t("common.error"), "error");
    }
  };

  const openDocs = () => {
    haptic("light");
    navigate("/docs/merchant-api");
  };

  return (
    <div className="my-shop my-shop--sub">
      <div className="shop-rise" style={{ "--rise-index": 0 } as CSSProperties}>
        <PageHeader title={t("myShop.tileApi")} onBack={() => navigate("/shop")} />
      </div>

      <div className="my-shop__body my-shop__body--api">
        <div className="my-shop__key-box shop-rise" style={{ "--rise-index": 1 } as CSSProperties}>
          <span className="my-shop__key-value" title={revealed ? payload?.apiKey : undefined}>
            {displayKey}
          </span>
          <button
            type="button"
            className="my-shop__icon-btn"
            aria-label={t("myShop.revealKey")}
            disabled={!payload}
            onClick={() => {
              haptic("light");
              setRevealed((v) => !v);
            }}
          >
            <GlassesIcon
              variant={revealed ? "bulk-rounded" : "twotone-rounded"}
              size={16}
              color="currentColor"
            />
          </button>
          <button
            type="button"
            className="my-shop__icon-btn"
            aria-label={t("common.copy")}
            disabled={!payload}
            onClick={() => void copyKey()}
          >
            <Copy01Icon variant="bulk-rounded" size={16} color="currentColor" />
          </button>
        </div>

        {error ? (
          <p className="my-shop__hint shop-rise" style={{ "--rise-index": 2 } as CSSProperties}>
            {error}
          </p>
        ) : null}

        <div
          className="my-shop__docs-links shop-rise"
          style={{ "--rise-index": 3 } as CSSProperties}
        >
          <button type="button" className="my-shop__docs-row" onClick={openDocs}>
            <span className="my-shop__docs-icon" aria-hidden>
              <DocumentCodeIcon variant="bulk-rounded" size={18} color="currentColor" />
            </span>
            <span className="my-shop__docs-copy">
              <span className="my-shop__docs-title">{t("myShop.apiDocsTitle")}</span>
              <span className="my-shop__docs-desc">{t("myShop.apiDocsDesc")}</span>
            </span>
            <MenuChevron flip={!isRTL} />
          </button>
        </div>
      </div>
    </div>
  );
}
