import { useMemo, type CSSProperties } from "react";
import {
  Navigate,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import { PageHeader } from "../../components/PageHeader";
import { useI18n } from "../../context/I18nContext";
import { useTelegram } from "../../hooks/useTelegram";
import { truncateAddress } from "../../lib/cryptoAmountInput";
import { formatFaCryptoQty, formatFaNumber } from "../../lib/format";
import {
  getWalletAssetDef,
  isWalletAssetId,
} from "../../lib/walletAssetsCatalog";
import {
  isWalletNetworkId,
  NETWORK_UI,
  withdrawFeeFor,
  withdrawNetworksForAsset,
} from "../../lib/walletNetworks";
import { readCachedWalletRates } from "../../lib/walletRatesCache";
import "../../styles/shop-rise.css";
import "./WalletAsset.css";
import "./WalletWithdrawConfirm.css";

function AmountWithUnit({
  value,
  unit,
  digits,
  emphasis,
}: {
  value: number;
  unit: string;
  digits: number;
  emphasis?: boolean;
}) {
  return (
    <span
      className={`wallet-wconf__qty${
        emphasis ? " wallet-wconf__qty--emphasis" : ""
      }`}
    >
      <span className="wallet-wconf__qty-value">
        {formatFaCryptoQty(value, digits)}
      </span>
      <span className="wallet-wconf__qty-unit">{unit}</span>
    </span>
  );
}

type ConfirmLocationState = {
  address?: string;
  amount?: number;
};

function addressStorageKey(assetId: string, networkId: string) {
  return `tomanit.withdraw.address.${assetId}.${networkId}`;
}

function amountStorageKey(assetId: string, networkId: string) {
  return `tomanit.withdraw.amount.${assetId}.${networkId}`;
}

function readStoredAddress(assetId: string, networkId: string): string {
  try {
    return (
      sessionStorage.getItem(addressStorageKey(assetId, networkId))?.trim() ??
      ""
    );
  } catch {
    return "";
  }
}

function readStoredAmount(assetId: string, networkId: string): number {
  try {
    const raw = sessionStorage.getItem(amountStorageKey(assetId, networkId));
    const n = raw != null ? Number(raw) : 0;
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

export function WalletWithdrawConfirmPage() {
  const { assetId = "", networkId = "" } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useI18n();
  const { haptic } = useTelegram();

  const navState = (location.state as ConfirmLocationState | null) ?? null;
  const address = (
    navState?.address?.trim() ||
    readStoredAddress(assetId, networkId)
  ).trim();
  const amount =
    typeof navState?.amount === "number" && navState.amount > 0
      ? navState.amount
      : readStoredAmount(assetId, networkId);

  const asset = isWalletAssetId(assetId) ? getWalletAssetDef(assetId) : undefined;
  const network = isWalletNetworkId(networkId) ? NETWORK_UI[networkId] : undefined;
  const allowed =
    asset &&
    asset.id !== "toman" &&
    network &&
    withdrawNetworksForAsset(asset.id).some((n) => n.id === network.id) &&
    address.length >= 8 &&
    amount > 0;

  const fee = useMemo(
    () =>
      asset && network && asset.id !== "toman"
        ? withdrawFeeFor(asset.id, network.id)
        : { feeAmount: 0, minAmount: null },
    [asset, network],
  );

  const rate = useMemo(() => {
    if (!asset || asset.id === "toman") return null;
    const cached = readCachedWalletRates()?.rates?.[asset.id];
    return typeof cached === "number" && cached > 0 ? cached : null;
  }, [asset]);

  if (!asset || asset.id === "toman" || !asset.hasCoinPage) {
    return <Navigate to="/wallet/withdraw" replace />;
  }
  if (!network) {
    return <Navigate to={`/wallet/${asset.id}/withdraw`} replace />;
  }
  if (!allowed) {
    return (
      <Navigate
        to={`/wallet/${asset.id}/withdraw/${network.id}/amount`}
        replace
        state={{ address: address.length >= 8 ? address : undefined }}
      />
    );
  }

  const assetLabel = t(asset.titleKey);
  const tomanLabel = t("wallet.toman");
  const receiveAmount = Math.max(0, amount - fee.feeAmount);
  const tomanEquiv = rate != null ? Math.round(amount * rate) : null;
  const receiveToman =
    rate != null ? Math.round(receiveAmount * rate) : null;

  const goBack = () => {
    navigate(`/wallet/${asset.id}/withdraw/${network.id}/amount`, {
      replace: true,
      state: { address },
    });
  };

  const onConfirm = () => {
    haptic("medium");
    try {
      sessionStorage.setItem(addressStorageKey(asset.id, network.id), address);
      sessionStorage.setItem(
        amountStorageKey(asset.id, network.id),
        String(amount),
      );
    } catch {
      /* ignore */
    }
    navigate(`/wallet/${asset.id}/withdraw/${network.id}/success`, {
      replace: true,
      state: { address, amount },
    });
  };

  return (
    <div className="wallet-wconf">
      <div className="wallet-wconf__header">
        <PageHeader
          title={t("wallet.withdrawConfirmTitle")}
          onBack={goBack}
        />
      </div>

      <div className="wallet-wconf__body">
        <header
          className="coin-page__charts-header wallet-wconf__top shop-rise"
          style={{ "--rise-index": 1 } as CSSProperties}
        >
          <div className="coin-page__charts-numbers">
            <p className="coin-page__charts-title">
              {asset.symbol} • {assetLabel}
            </p>
            <p className="coin-page__charts-price">
              <span className="coin-page__charts-price-value">
                {formatFaCryptoQty(amount, 8)}
              </span>
              <span className="coin-page__charts-price-unit">{assetLabel}</span>
            </p>
            {tomanEquiv != null ? (
              <div className="coin-page__charts-compare">
                <span className="coin-page__charts-delta">
                  ≈ {formatFaNumber(tomanEquiv)}
                  <span className="coin-page__charts-delta-unit">
                    {" "}
                    {tomanLabel}
                  </span>
                </span>
              </div>
            ) : null}
          </div>
          <span className="wallet-wconf__top-icon-wrap" aria-hidden>
            <img
              className="coin-page__charts-icon"
              src={asset.logo}
              alt=""
              width={44}
              height={44}
              decoding="async"
            />
            <img
              className="wallet-wconf__top-net"
              src={network.logo}
              alt=""
              width={18}
              height={18}
              decoding="async"
            />
          </span>
        </header>

        <div
          className="wallet-wconf__card shop-rise"
          style={{ "--rise-index": 2 } as CSSProperties}
        >
          <div className="wallet-wconf__row">
            <span className="wallet-wconf__label">
              {t("wallet.withdrawConfirmAssetNetwork")}
            </span>
            <span className="wallet-wconf__value wallet-wconf__asset-net">
              <span>{assetLabel}</span>
              <span className="wallet-wconf__asset-net-sep" aria-hidden>
                ·
              </span>
              <span
                className="wallet-wconf__value--mono"
                dir="ltr"
                lang="en"
              >
                {network.code}
              </span>
            </span>
          </div>

          <div className="wallet-wconf__row">
            <span className="wallet-wconf__label">
              {t("wallet.withdrawAddressLabel")}
            </span>
            <span
              className="wallet-wconf__value wallet-wconf__value--mono"
              dir="ltr"
              lang="en"
            >
              {truncateAddress(address)}
            </span>
          </div>

          <div className="wallet-wconf__row wallet-wconf__row--pair">
            <div className="wallet-wconf__pair-item">
              <span className="wallet-wconf__label">
                {t("wallet.withdrawConfirmAmount")}
              </span>
              <AmountWithUnit
                value={amount}
                unit={assetLabel}
                digits={8}
              />
            </div>
            <div className="wallet-wconf__pair-item wallet-wconf__pair-item--end">
              <span className="wallet-wconf__label">
                {t("wallet.withdrawTransferFee")}
              </span>
              <AmountWithUnit
                value={fee.feeAmount}
                unit={assetLabel}
                digits={4}
              />
            </div>
          </div>

          <div className="wallet-wconf__row wallet-wconf__row--send">
            <div className="wallet-wconf__send-label">
              <span className="wallet-wconf__label">
                {t("wallet.withdrawConfirmSend")}
              </span>
              <span className="wallet-wconf__send-note">
                {t("wallet.withdrawConfirmSendNote")}
              </span>
            </div>
            <div className="wallet-wconf__send-value">
              <AmountWithUnit
                value={receiveAmount}
                unit={assetLabel}
                digits={8}
                emphasis
              />
              {receiveToman != null ? (
                <span className="wallet-wconf__send-fiat">
                  ≈ {formatFaNumber(receiveToman)}
                  <span className="wallet-wconf__qty-unit"> {tomanLabel}</span>
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <p
          className="wallet-wconf__hint shop-rise"
          style={{ "--rise-index": 3 } as CSSProperties}
        >
          {t("wallet.withdrawHint")}
        </p>
      </div>

      <div className="wallet-wconf__footer">
        <button
          type="button"
          className="wallet-wconf__confirm"
          onClick={onConfirm}
        >
          {t("wallet.withdrawConfirmCta")}
        </button>
      </div>
    </div>
  );
}
