import { useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../../components/PageHeader";
import { useNotification } from "../../components/Notification";
import { useI18n } from "../../context/I18nContext";
import { useTelegram } from "../../hooks/useTelegram";
import "../../styles/shop-rise.css";
import "../MyShop.css";

export function ShopGatewayNewPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { haptic } = useTelegram();
  const { notify } = useNotification();
  const [displayName, setDisplayName] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [minAmount, setMinAmount] = useState("10000");
  const [maxAmount, setMaxAmount] = useState("50000000");

  const onSubmit = () => {
    if (!displayName.trim() || !webhookUrl.trim()) {
      notify(t("myShop.formRequired"), "error");
      return;
    }
    haptic("medium");
    notify(t("myShop.soonFeature"), "info");
  };

  return (
    <div className="my-shop my-shop--sub">
      <div className="shop-rise" style={{ "--rise-index": 0 } as CSSProperties}>
        <PageHeader title={t("myShop.createGateway")} onBack={() => navigate("/shop/gateways")} />
      </div>

      <div className="my-shop__body">
        <p className="my-shop__hint shop-rise" style={{ "--rise-index": 1 } as CSSProperties}>
          {t("myShop.createGatewayIntro")}
        </p>

        <div className="my-shop__field shop-rise" style={{ "--rise-index": 2 } as CSSProperties}>
          <label className="my-shop__label" htmlFor="gw-name">
            {t("myShop.fieldGatewayName")}
          </label>
          <input
            id="gw-name"
            className="my-shop__input"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={t("myShop.fieldGatewayNamePh")}
          />
        </div>

        <div className="my-shop__field shop-rise" style={{ "--rise-index": 3 } as CSSProperties}>
          <label className="my-shop__label" htmlFor="gw-hook">
            {t("myShop.fieldWebhook")}
          </label>
          <input
            id="gw-hook"
            className="my-shop__input"
            dir="ltr"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder="https://example.com/webhooks/tomanit"
          />
        </div>

        <div
          className="shop-rise"
          style={
            {
              "--rise-index": 4,
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
            } as CSSProperties
          }
        >
          <div className="my-shop__field">
            <label className="my-shop__label" htmlFor="gw-min">
              {t("myShop.fieldMinAmount")}
            </label>
            <input
              id="gw-min"
              className="my-shop__input"
              inputMode="numeric"
              value={minAmount}
              onChange={(e) => setMinAmount(e.target.value)}
            />
          </div>
          <div className="my-shop__field">
            <label className="my-shop__label" htmlFor="gw-max">
              {t("myShop.fieldMaxAmount")}
            </label>
            <input
              id="gw-max"
              className="my-shop__input"
              inputMode="numeric"
              value={maxAmount}
              onChange={(e) => setMaxAmount(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div
        className="my-shop__footer shop-rise"
        style={{ "--rise-index": 5 } as CSSProperties}
      >
        <button type="button" className="my-shop__cta" onClick={onSubmit}>
          {t("myShop.submitGateway")}
        </button>
      </div>
    </div>
  );
}
