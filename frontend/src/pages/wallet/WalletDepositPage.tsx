import { useMemo, type CSSProperties, type ReactNode } from "react";
import { Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "../../components/PageHeader";
import { useI18n } from "../../context/I18nContext";
import { useTelegram } from "../../hooks/useTelegram";
import {
  getWalletAssetDef,
  isWalletAssetId,
} from "../../lib/walletAssetsCatalog";
import { depositNetworksForAsset } from "../../lib/walletNetworks";
import "../../styles/shop-rise.css";
import "./WalletDeposit.css";

function NetworkChevron({ flip }: { flip?: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={16}
      height={16}
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden
      style={flip ? { transform: "scaleX(-1)" } : undefined}
    >
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
        d="m15 18-6-6 6-6"
      />
    </svg>
  );
}

type DepositLocationState = {
  from?: "coin-list" | "asset";
};

export function WalletDepositPage() {
  const { assetId = "" } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { t, isRTL } = useI18n();
  const { haptic } = useTelegram();
  const from =
    (location.state as DepositLocationState | null)?.from ?? "coin-list";

  const asset = isWalletAssetId(assetId) ? getWalletAssetDef(assetId) : undefined;
  const networks = useMemo(
    () => (asset && asset.id !== "toman" ? depositNetworksForAsset(asset.id) : []),
    [asset],
  );

  if (!asset || !asset.hasCoinPage || asset.id === "toman") {
    return <Navigate to="/wallet/deposit" replace />;
  }

  if (networks.length === 0) {
    return <Navigate to={`/wallet/${asset.id}`} replace />;
  }

  const chevron = <NetworkChevron flip={!isRTL} />;

  const goBack = () => {
    if (from === "asset") {
      navigate(`/wallet/${asset.id}`, { replace: true });
      return;
    }
    navigate("/wallet/deposit", { replace: true });
  };

  return (
    <div className="wallet-deposit">
      <div className="wallet-deposit__header">
        <PageHeader
          title={t("wallet.depositAssetTitle", { asset: t(asset.titleKey) })}
          onBack={goBack}
        />
      </div>

      <div className="wallet-deposit__content">
        <h5
          className="wallet-deposit__section-title shop-rise"
          style={{ "--rise-index": 1 } as CSSProperties}
        >
          {t("wallet.selectDepositNetwork")}
        </h5>

        <div
          className="wallet-deposit__box shop-rise"
          style={{ "--rise-index": 2 } as CSSProperties}
          role="list"
        >
          {networks.map((network, index) => {
            const row: ReactNode = (
              <button
                key={network.id}
                type="button"
                role="listitem"
                className="wallet-deposit__item"
                onClick={() => {
                  haptic("light");
                  navigate(`/wallet/${asset.id}/deposit/${network.id}`, {
                    state: { from },
                  });
                }}
              >
                <span className="wallet-deposit__item-start">
                  <span className="wallet-deposit__icons" aria-hidden>
                    <img
                      className="wallet-deposit__icon-big"
                      src={asset.logo}
                      alt=""
                      width={32}
                      height={32}
                      decoding="async"
                    />
                    <img
                      className="wallet-deposit__icon-small"
                      src={network.logo}
                      alt=""
                      width={14}
                      height={14}
                      decoding="async"
                    />
                  </span>
                  <span className="wallet-deposit__item-text">
                    <span className="wallet-deposit__item-title">
                      {t(network.nameKey)}
                    </span>
                    <span
                      className="wallet-deposit__item-protocol"
                      lang="en"
                      dir="ltr"
                    >
                      {network.protocol}
                    </span>
                  </span>
                </span>
                <span className="wallet-deposit__item-chevron">{chevron}</span>
              </button>
            );

            if (index === 0) return row;
            return (
              <div key={`${network.id}-wrap`}>
                <div className="wallet-deposit__divider" />
                {row}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
