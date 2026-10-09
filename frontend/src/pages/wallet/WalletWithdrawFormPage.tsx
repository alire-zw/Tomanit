import { useMemo, useRef, useState, type CSSProperties } from "react";
import {
  Navigate,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import { PageHeader } from "../../components/PageHeader";
import { QrAddressScanner } from "../../components/QrAddressScanner";
import QrCodeScanIcon from "../../components/icons/hugeicons/QrCodeScanIcon";
import { useI18n } from "../../context/I18nContext";
import { useTelegram } from "../../hooks/useTelegram";
import {
  getWalletAssetDef,
  isWalletAssetId,
} from "../../lib/walletAssetsCatalog";
import {
  isWalletNetworkId,
  NETWORK_UI,
  withdrawNetworksForAsset,
} from "../../lib/walletNetworks";
import "../../styles/shop-rise.css";
import "./WalletDeposit.css";
import "./WalletWithdraw.css";

type FormLocationState = {
  address?: string;
  from?: "coin-list" | "asset";
};

export function WalletWithdrawFormPage() {
  const { assetId = "", networkId = "" } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useI18n();
  const { haptic } = useTelegram();
  const inputRef = useRef<HTMLInputElement>(null);
  const navState = (location.state as FormLocationState | null) ?? null;
  const [address, setAddress] = useState(navState?.address ?? "");
  const [addressFocused, setAddressFocused] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const showAddressPreview = Boolean(address) && !addressFocused;

  const asset = isWalletAssetId(assetId) ? getWalletAssetDef(assetId) : undefined;
  const network = isWalletNetworkId(networkId) ? NETWORK_UI[networkId] : undefined;
  const allowed =
    asset &&
    asset.id !== "toman" &&
    network &&
    withdrawNetworksForAsset(asset.id).some((n) => n.id === network.id);

  const canContinue = useMemo(() => address.trim().length >= 8, [address]);

  if (!asset || !asset.hasCoinPage || asset.id === "toman" || !network || !allowed) {
    return <Navigate to="/wallet/withdraw" replace />;
  }

  return (
    <div className="wallet-deposit wallet-withdraw wallet-withdraw--form">
      <div className="wallet-deposit__header">
        <PageHeader
          title={t("wallet.withdrawAssetTitle", { asset: t(asset.titleKey) })}
          onBack={() =>
            navigate(`/wallet/${asset.id}/withdraw`, {
              replace: true,
              state: { from: navState?.from ?? "coin-list" },
            })
          }
        />
      </div>

      <div className="wallet-deposit__content wallet-withdraw__form-content">
        <div
          className="wallet-withdraw__transfer-head shop-rise"
          style={{ "--rise-index": 1 } as CSSProperties}
        >
          <span className="wallet-withdraw__transfer-icons" aria-hidden>
            <img
              className="wallet-withdraw__transfer-icon-big"
              src={asset.logo}
              alt=""
              width={24}
              height={24}
              decoding="async"
            />
            <img
              className="wallet-withdraw__transfer-icon-small"
              src={network.logo}
              alt=""
              width={12}
              height={12}
              decoding="async"
            />
          </span>
          <p className="wallet-withdraw__transfer-title">
            <span>
              {t("wallet.withdrawTransferLead", {
                asset: t(asset.titleKey),
              })}
            </span>{" "}
            <span
              className="wallet-withdraw__transfer-net"
              dir="ltr"
              lang="en"
            >
              {network.protocol}
            </span>
          </p>
        </div>

        <div
          className="wallet-withdraw__field shop-rise"
          style={{ "--rise-index": 2 } as CSSProperties}
        >
          <label
            className="wallet-withdraw__field-label"
            htmlFor="withdraw-dest-address"
          >
            {t("wallet.withdrawAddressLabel")}
          </label>
          <div
            className={`wallet-withdraw__field-wrap${
              showAddressPreview ? " wallet-withdraw__field-wrap--preview" : ""
            }`}
          >
            {showAddressPreview ? (
              <button
                type="button"
                className="wallet-withdraw__address-preview"
                dir="ltr"
                lang="en"
                onClick={() => {
                  haptic("light");
                  setAddressFocused(true);
                  requestAnimationFrame(() => inputRef.current?.focus());
                }}
              >
                {address}
              </button>
            ) : null}
            <input
              ref={inputRef}
              id="withdraw-dest-address"
              className={`wallet-withdraw__field-input${
                showAddressPreview ? " wallet-withdraw__field-input--ghost" : ""
              }`}
              type="text"
              inputMode="text"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              dir="ltr"
              lang="en"
              placeholder={t("wallet.withdrawAddressPlaceholder")}
              value={address}
              onChange={(e) => {
                setAddress(e.target.value.replace(/\s+/g, ""));
              }}
              onFocus={() => {
                haptic("light");
                setAddressFocused(true);
              }}
              onBlur={() => setAddressFocused(false)}
            />
            <button
              type="button"
              className="wallet-withdraw__scan-btn"
              aria-label={t("wallet.withdrawScanTitle")}
              onClick={() => {
                haptic("light");
                setScanOpen(true);
              }}
            >
              <QrCodeScanIcon
                variant="bulk-rounded"
                size={20}
                color="currentColor"
              />
            </button>
          </div>
        </div>
      </div>

      <div className="wallet-withdraw__form-footer">
        <button
          type="button"
          className="wallet-withdraw__continue"
          disabled={!canContinue}
          onClick={() => {
            if (!canContinue) return;
            haptic("medium");
            const trimmed = address.trim();
            try {
              sessionStorage.setItem(
                `tomanit.withdraw.address.${asset.id}.${network.id}`,
                trimmed,
              );
            } catch {
              /* ignore */
            }
            navigate(`/wallet/${asset.id}/withdraw/${network.id}/amount`, {
              state: { address: trimmed },
            });
          }}
        >
          {t("common.continue")}
        </button>
      </div>

      <QrAddressScanner
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onScan={(value) => {
          setAddress(value);
        }}
      />
    </div>
  );
}
