import { type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { EmptyState } from "../../components/EmptyState";
import { PageHeader } from "../../components/PageHeader";
import PlusIcon from "../../components/icons/PlusIcon";
import { useI18n } from "../../context/I18nContext";
import { useTelegram } from "../../hooks/useTelegram";
import "../../styles/shop-rise.css";
import "../MyShop.css";

export function ShopGatewaysPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { haptic } = useTelegram();

  return (
    <div className="my-shop my-shop--sub">
      <div className="shop-rise" style={{ "--rise-index": 0 } as CSSProperties}>
        <PageHeader
          title={t("myShop.tileGateways")}
          onBack={() => navigate("/shop")}
          action={
            <button
              type="button"
              className="my-shop__icon-btn"
              aria-label={t("myShop.createGateway")}
              onClick={() => {
                haptic("light");
                navigate("/shop/gateways/new");
              }}
            >
              <PlusIcon width={18} height={18} />
            </button>
          }
        />
      </div>

      <div className="my-shop__body">
        <p className="my-shop__hint shop-rise" style={{ "--rise-index": 1 } as CSSProperties}>
          {t("myShop.gatewaysIntro")}
        </p>
        <EmptyState title={t("myShop.noGatewaysYet")} compact />
      </div>

      <div
        className="my-shop__footer shop-rise"
        style={{ "--rise-index": 3 } as CSSProperties}
      >
        <button
          type="button"
          className="my-shop__cta"
          onClick={() => {
            haptic("medium");
            navigate("/shop/gateways/new");
          }}
        >
          {t("myShop.createGateway")}
        </button>
      </div>
    </div>
  );
}
