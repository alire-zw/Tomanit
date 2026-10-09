import { type CSSProperties, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../../components/PageHeader";
import { useI18n } from "../../context/I18nContext";
import { useTelegram } from "../../hooks/useTelegram";
import { WALLET_ASSETS } from "../../lib/walletAssetsCatalog";
import "../../styles/shop-rise.css";
import "./WalletDeposit.css";

function AssetChevron({ flip }: { flip?: boolean }) {
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

const CRYPTO_ASSETS = WALLET_ASSETS.filter((a) => a.id !== "toman" && a.hasCoinPage);

export function WalletWithdrawCoinListPage() {
  const navigate = useNavigate();
  const { t, isRTL } = useI18n();
  const { haptic } = useTelegram();
  const chevron = <AssetChevron flip={!isRTL} />;

  return (
    <div className="wallet-deposit">
      <div className="wallet-deposit__header">
        <PageHeader
          title={t("wallet.withdrawCrypto")}
          onBack={() => navigate("/", { replace: true })}
        />
      </div>

      <div className="wallet-deposit__content">
        <h5
          className="wallet-deposit__section-title shop-rise"
          style={{ "--rise-index": 1 } as CSSProperties}
        >
          {t("wallet.selectWithdrawAsset")}
        </h5>

        <div
          className="wallet-deposit__box shop-rise"
          style={{ "--rise-index": 2 } as CSSProperties}
          role="list"
        >
          {CRYPTO_ASSETS.map((asset, index) => {
            const row: ReactNode = (
              <button
                key={asset.id}
                type="button"
                role="listitem"
                className="wallet-deposit__item"
                onClick={() => {
                  haptic("light");
                  navigate(`/wallet/${asset.id}/withdraw`, {
                    state: { from: "coin-list" },
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
                  </span>
                  <span className="wallet-deposit__item-text">
                    <span className="wallet-deposit__item-title">
                      {t(asset.titleKey)}
                    </span>
                    <span className="wallet-deposit__item-protocol" lang="en" dir="ltr">
                      {asset.symbol}
                    </span>
                  </span>
                </span>
                <span className="wallet-deposit__item-chevron">{chevron}</span>
              </button>
            );

            if (index === 0) return row;
            return (
              <div key={`${asset.id}-wrap`}>
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
