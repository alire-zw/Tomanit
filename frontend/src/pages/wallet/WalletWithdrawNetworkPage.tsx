import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "../../components/PageHeader";
import CursorInfo01Icon from "../../components/icons/hugeicons/CursorInfo01Icon";
import { useI18n } from "../../context/I18nContext";
import { useAuth } from "../../hooks/useAuth";
import { useTelegram } from "../../hooks/useTelegram";
import {
  apiFetch,
  type WalletWithdrawLimitsResponse,
} from "../../lib/api";
import {
  formatFaCryptoQty,
  formatFaNumber,
  formatLatinCryptoQty,
} from "../../lib/format";
import {
  getWalletAssetDef,
  isWalletAssetId,
} from "../../lib/walletAssetsCatalog";
import {
  withdrawFeeFor,
  withdrawNetworksForAsset,
} from "../../lib/walletNetworks";
import { readCachedWalletRates } from "../../lib/walletRatesCache";
import { getWalletAssetBalance } from "../../lib/walletUi";
import { WithdrawLimitsDrawer } from "./WithdrawLimitsDrawer";
import "../../styles/shop-rise.css";
import "./WalletDeposit.css";
import "./WalletWithdraw.css";

function NetworkChevron({ flip }: { flip?: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={14}
      height={14}
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

type WithdrawLocationState = {
  from?: "coin-list" | "asset";
};

export function WalletWithdrawNetworkPage() {
  const { assetId = "" } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { t, isRTL } = useI18n();
  const { haptic } = useTelegram();
  const { wallet } = useAuth();
  const from =
    (location.state as WithdrawLocationState | null)?.from ?? "coin-list";

  const [limitsOpen, setLimitsOpen] = useState(false);
  const [limits, setLimits] = useState<WalletWithdrawLimitsResponse | null>(
    null,
  );
  const [limitsLoading, setLimitsLoading] = useState(false);

  const asset = isWalletAssetId(assetId) ? getWalletAssetDef(assetId) : undefined;
  const networks = useMemo(
    () => (asset && asset.id !== "toman" ? withdrawNetworksForAsset(asset.id) : []),
    [asset],
  );
  const walletBalance = asset ? getWalletAssetBalance(wallet, asset.id) : 0;
  const rate = useMemo(() => {
    if (!asset || asset.id === "toman") return null;
    const cached = readCachedWalletRates()?.rates?.[asset.id];
    return typeof cached === "number" && cached > 0 ? cached : null;
  }, [asset]);

  useEffect(() => {
    if (!asset || asset.id === "toman") return;
    const controller = new AbortController();
    setLimitsLoading(true);
    void apiFetch<WalletWithdrawLimitsResponse>(
      `/wallet/withdraw-limits?asset=${encodeURIComponent(asset.id)}`,
      { signal: controller.signal, timeoutMs: 20_000 },
    )
      .then((data) => {
        if (!controller.signal.aborted) setLimits(data);
      })
      .catch(() => {
        if (!controller.signal.aborted) setLimits(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLimitsLoading(false);
      });
    return () => controller.abort();
  }, [asset]);

  const displayBalance = limits?.withdrawable ?? walletBalance;
  const tomanEquiv =
    limits != null
      ? Math.round(limits.withdrawableToman)
      : rate != null
        ? Math.round(walletBalance * rate)
        : null;

  if (!asset || !asset.hasCoinPage || asset.id === "toman") {
    return <Navigate to="/wallet/withdraw" replace />;
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
    navigate("/wallet/withdraw", { replace: true });
  };

  const openLimits = () => {
    haptic("light");
    setLimitsOpen(true);
    if (!limits && asset.id !== "toman") {
      setLimitsLoading(true);
      void apiFetch<WalletWithdrawLimitsResponse>(
        `/wallet/withdraw-limits?asset=${encodeURIComponent(asset.id)}`,
        { timeoutMs: 20_000 },
      )
        .then(setLimits)
        .catch(() => setLimits(null))
        .finally(() => setLimitsLoading(false));
    }
  };

  return (
    <div className="wallet-deposit wallet-withdraw">
      <div className="wallet-deposit__header">
        <PageHeader
          title={t("wallet.withdrawAssetTitle", { asset: t(asset.titleKey) })}
          onBack={goBack}
        />
      </div>

      <div className="wallet-deposit__content">
        <section
          className="wallet-withdraw__balance shop-rise"
          style={{ "--rise-index": 1 } as CSSProperties}
        >
          <div className="wallet-withdraw__balance-row">
            <div className="wallet-withdraw__balance-label-wrap">
              <p className="wallet-withdraw__balance-label">
                {t("wallet.withdrawableBalance")}
              </p>
              <button
                type="button"
                className="wallet-withdraw__balance-info"
                aria-label={t("wallet.withdrawLimitsTitle")}
                onClick={openLimits}
              >
                <CursorInfo01Icon
                  variant="bulk-rounded"
                  size={16}
                  color="currentColor"
                />
              </button>
            </div>
            <div className="wallet-withdraw__balance-amounts">
              <span className="wallet-withdraw__balance-value" dir="ltr">
                {formatFaCryptoQty(displayBalance, 6)}
                <span className="wallet-withdraw__balance-unit"> {asset.symbol}</span>
              </span>
              <p className="wallet-withdraw__balance-toman">
                {tomanEquiv != null
                  ? t("wallet.withdrawBalanceToman", {
                      amount: formatFaNumber(tomanEquiv),
                    })
                  : "—"}
              </p>
            </div>
          </div>
        </section>

        <h5
          className="wallet-deposit__section-title shop-rise"
          style={{ "--rise-index": 2 } as CSSProperties}
        >
          {t("wallet.selectWithdrawNetwork")}
        </h5>

        <div
          className="wallet-withdraw__networks shop-rise"
          style={{ "--rise-index": 3 } as CSSProperties}
          role="list"
        >
          {networks.map((network) => {
            const fee = withdrawFeeFor(asset.id, network.id);
            return (
              <button
                key={network.id}
                type="button"
                className="wallet-withdraw__net"
                role="listitem"
                onClick={() => {
                  haptic("light");
                  navigate(`/wallet/${asset.id}/withdraw/${network.id}`, {
                    state: { from: from },
                  });
                }}
              >
                <span className="wallet-withdraw__net-main">
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
                  <span className="wallet-withdraw__net-info">
                    <span className="wallet-withdraw__net-title-row">
                      <span className="wallet-withdraw__net-name">
                        {t(network.nameKey)}
                      </span>
                      <span className="wallet-withdraw__net-chevron">{chevron}</span>
                    </span>
                    <span className="wallet-withdraw__net-meta" dir="ltr">
                      <span
                        className="wallet-withdraw__net-protocol"
                        lang="en"
                      >
                        {network.protocol}
                      </span>
                      <span className="wallet-withdraw__net-fee">
                        <span className="wallet-withdraw__net-fee-label">
                          {t("wallet.withdrawFee")}:
                        </span>
                        <span
                          className="wallet-withdraw__net-fee-amount"
                          lang="en"
                        >
                          <span>{formatLatinCryptoQty(fee.feeAmount, 4)}</span>
                          <span className="wallet-withdraw__net-fee-unit">
                            {asset.symbol}
                          </span>
                        </span>
                      </span>
                    </span>
                  </span>
                </span>
                <span className="wallet-withdraw__net-divider" aria-hidden />
                <span className="wallet-withdraw__net-min">
                  <span>{t("wallet.withdrawMin")}</span>
                  <span>
                    {fee.minAmount == null
                      ? t("wallet.withdrawNoLimit")
                      : `${formatFaCryptoQty(fee.minAmount, 4)} ${asset.symbol}`}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <WithdrawLimitsDrawer
        open={limitsOpen}
        onClose={() => setLimitsOpen(false)}
        limits={limits}
        loading={limitsLoading}
      />
    </div>
  );
}
