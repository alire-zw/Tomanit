import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  Navigate,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import { PageHeader } from "../../components/PageHeader";
import { useNotification } from "../../components/Notification";
import { useI18n } from "../../context/I18nContext";
import { useAuth } from "../../hooks/useAuth";
import { useTelegram } from "../../hooks/useTelegram";
import {
  apiFetch,
  ApiError,
  type WalletMutationResponse,
} from "../../lib/api";
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
import "./WalletWithdrawSuccess.css";

type SuccessLocationState = {
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

function clearWithdrawDraft(assetId: string, networkId: string) {
  try {
    sessionStorage.removeItem(addressStorageKey(assetId, networkId));
    sessionStorage.removeItem(amountStorageKey(assetId, networkId));
  } catch {
    /* ignore */
  }
}

function CheckIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden>
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.2"
        d="m5 13 4 4L19 7"
      />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden>
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0"
      />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} fill="none" viewBox="0 0 24 24" aria-hidden>
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
        d="M8 8V6.2c0-1.12 0-1.68.218-2.108a2 2 0 0 1 .874-.874C9.52 3 10.08 3 11.2 3h6.6c1.12 0 1.68 0 2.108.218a2 2 0 0 1 .874.874C21 4.52 21 5.08 21 6.2v6.6c0 1.12 0 1.68-.218 2.108a2 2 0 0 1-.874.874C19.48 16 18.92 16 17.8 16H16M6.2 8h6.6c1.12 0 1.68 0 2.108.218a2 2 0 0 1 .874.874C16 9.52 16 10.08 16 11.2v6.6c0 1.12 0 1.68-.218 2.108a2 2 0 0 1-.874.874C14.48 21 13.92 21 12.8 21H6.2c-1.12 0-1.68 0-2.108-.218a2 2 0 0 1-.874-.874C3 19.48 3 18.92 3 17.8v-6.6c0-1.12 0-1.68.218-2.108a2 2 0 0 1 .874-.874C4.52 8 5.08 8 6.2 8"
      />
    </svg>
  );
}

function ExternalIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} fill="none" viewBox="0 0 24 24" aria-hidden>
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
        d="M14 4h6v6M10 14 20 4M18 13v5.2c0 1.12 0 1.68-.218 2.108a2 2 0 0 1-.874.874C16.48 21.4 15.92 21.4 14.8 21.4H6.2c-1.12 0-1.68 0-2.108-.218a2 2 0 0 1-.874-.874C3 19.88 3 19.32 3 18.2V9.6c0-1.12 0-1.68.218-2.108a2 2 0 0 1 .874-.874C4.52 6.4 5.08 6.4 6.2 6.4H11"
      />
    </svg>
  );
}

export function WalletWithdrawSuccessPage() {
  const { assetId = "", networkId = "" } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useI18n();
  const { haptic, openLink } = useTelegram();
  const { notify } = useNotification();
  const { user, applyUser, refresh } = useAuth();

  const navState = (location.state as SuccessLocationState | null) ?? null;
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
  const allowed = Boolean(
    asset &&
      asset.id !== "toman" &&
      network &&
      withdrawNetworksForAsset(asset.id).some((n) => n.id === network.id) &&
      address.length >= 8 &&
      amount > 0,
  );

  const [phase, setPhase] = useState<"sending" | "done" | "error">("sending");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [explorerUrl, setExplorerUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const startedRef = useRef(false);
  const inFlightRef = useRef(false);

  const fee =
    asset && network && asset.id !== "toman"
      ? withdrawFeeFor(asset.id, network.id)
      : { feeAmount: 0, minAmount: null };
  const sendAmount = Math.max(0, amount - fee.feeAmount);
  const rate =
    asset && asset.id !== "toman"
      ? (() => {
          const cached = readCachedWalletRates()?.rates?.[asset.id];
          return typeof cached === "number" && cached > 0 ? cached : null;
        })()
      : null;
  const sendToman = rate != null ? Math.round(sendAmount * rate) : null;

  const submitWithdraw = useCallback(async () => {
    if (!asset || !network || asset.id === "toman") return;
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setBusy(true);
    setPhase("sending");
    setError(null);
    setTxHash(null);
    setExplorerUrl(null);
    try {
      const data = await apiFetch<WalletMutationResponse>("/wallet/withdraw", {
        method: "POST",
        body: {
          asset: asset.id,
          network: network.id,
          amount,
          toAddress: address,
        },
        timeoutMs: 60_000,
      });
      if (user) applyUser(user, data.wallet);
      else void refresh({ force: true, silent: true });
      clearWithdrawDraft(asset.id, network.id);
      setTxHash(data.transaction?.txHash?.trim() || null);
      setExplorerUrl(data.explorerUrl?.trim() || null);
      setPhase("done");
      haptic("heavy");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("common.networkError"));
      setPhase("error");
      haptic("heavy");
    } finally {
      inFlightRef.current = false;
      setBusy(false);
    }
  }, [asset, network, amount, address, user, applyUser, refresh, haptic, t]);

  useEffect(() => {
    if (!allowed || startedRef.current) return;
    startedRef.current = true;
    void submitWithdraw();
  }, [allowed, submitWithdraw]);

  if (!asset || asset.id === "toman" || !asset.hasCoinPage) {
    return <Navigate to="/wallet/withdraw" replace />;
  }
  if (!network) {
    return <Navigate to={`/wallet/${asset.id}/withdraw`} replace />;
  }
  if (!allowed) {
    return (
      <Navigate
        to={`/wallet/${asset.id}/withdraw/${network.id}/confirm`}
        replace
      />
    );
  }

  const assetLabel = t(asset.titleKey);
  const isError = phase === "error";
  const displayAmount = sendAmount > 0 ? sendAmount : amount;

  const bannerTitle = isError
    ? t("wallet.withdrawFailedTitle")
    : t("wallet.withdrawSuccessTitle");
  const bannerSub =
    phase === "sending"
      ? t("wallet.withdrawSuccessPending")
      : isError
        ? t("wallet.withdrawFailedSub")
        : t("wallet.withdrawSuccessSub");

  const copyHash = async () => {
    if (!txHash) return;
    try {
      await navigator.clipboard.writeText(txHash);
      haptic("light");
      notify(t("common.copied"), "success");
    } catch {
      notify(t("common.error"), "error");
    }
  };

  return (
    <div className="wallet-wsucc">
      <div className="wallet-wsucc__header">
        <PageHeader
          title={bannerTitle}
          onBack={() => navigate(`/wallet/${asset.id}`, { replace: true })}
        />
      </div>

      <div className="wallet-wsucc__body">
        <section
          className={`wallet-wsucc__banner shop-rise${
            isError ? " wallet-wsucc__banner--error" : ""
          }`}
          style={{ "--rise-index": 1 } as CSSProperties}
        >
          <span
            className={`wallet-wsucc__mark${
              phase === "sending" ? " wallet-wsucc__mark--pending" : ""
            }`}
          >
            {isError ? <AlertIcon /> : <CheckIcon />}
          </span>
          <h2 className="wallet-wsucc__banner-title">{bannerTitle}</h2>
          <p className="wallet-wsucc__banner-sub">{bannerSub}</p>
        </section>

        {isError && error ? (
          <p className="wallet-wsucc__error shop-rise">{error}</p>
        ) : null}

        <div
          className="wallet-wsucc__meta shop-rise"
          style={{ "--rise-index": 2 } as CSSProperties}
        >
          <div className="wallet-wsucc__meta-row">
            <span className="wallet-wsucc__meta-key">
              {t("wallet.withdrawConfirmSend")}
            </span>
            <span className="wallet-wsucc__meta-value wallet-wsucc__meta-value--stack">
              <span>
                {formatFaCryptoQty(displayAmount, 8)}
                <span className="wallet-wsucc__meta-unit"> {assetLabel}</span>
              </span>
              {sendToman != null ? (
                <span className="wallet-wsucc__meta-fiat">
                  ≈ {formatFaNumber(sendToman)} {t("wallet.toman")}
                </span>
              ) : null}
            </span>
          </div>
          <div className="wallet-wsucc__meta-row">
            <span className="wallet-wsucc__meta-key">
              {t("wallet.withdrawConfirmNetwork")}
            </span>
            <span className="wallet-wsucc__meta-value">
              <span className="wallet-wsucc__meta-net">
                <img src={network.logo} alt="" width={16} height={16} />
                <span className="wallet-wsucc__meta-value--mono" dir="ltr" lang="en">
                  {network.code}
                </span>
              </span>
            </span>
          </div>
          <div className="wallet-wsucc__meta-row">
            <span className="wallet-wsucc__meta-key">
              {t("wallet.withdrawAddressLabel")}
            </span>
            <span
              className="wallet-wsucc__meta-value wallet-wsucc__meta-value--mono"
              dir="ltr"
              lang="en"
            >
              {truncateAddress(address)}
            </span>
          </div>
          {txHash ? (
            <div className="wallet-wsucc__meta-row">
              <span className="wallet-wsucc__meta-key">
                {t("tx.detail.txHash")}
              </span>
              <span
                className="wallet-wsucc__meta-value wallet-wsucc__meta-value--mono"
                dir="ltr"
                lang="en"
              >
                {truncateAddress(txHash, 10, 10)}
              </span>
            </div>
          ) : null}
        </div>

        {txHash ? (
          <div
            className="wallet-wsucc__actions shop-rise"
            style={{ "--rise-index": 3 } as CSSProperties}
          >
            <button
              type="button"
              className="wallet-wsucc__action-btn"
              onClick={() => {
                void copyHash();
              }}
            >
              <CopyIcon />
              <span>{t("common.copy")}</span>
            </button>
            {explorerUrl ? (
              <button
                type="button"
                className="wallet-wsucc__action-btn"
                onClick={() => {
                  haptic("light");
                  openLink(explorerUrl);
                }}
              >
                <ExternalIcon />
                <span>{t("wallet.withdrawViewOnExplorer")}</span>
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="wallet-wsucc__footer">
        {isError ? (
          <>
            <button
              type="button"
              className="wallet-wsucc__cta"
              disabled={busy}
              onClick={() => {
                haptic("medium");
                void submitWithdraw();
              }}
            >
              {busy ? t("common.loading") : t("common.retry")}
            </button>
            <button
              type="button"
              className="wallet-wsucc__cta wallet-wsucc__cta--secondary"
              disabled={busy}
              onClick={() => {
                haptic("light");
                navigate(
                  `/wallet/${asset.id}/withdraw/${network.id}/confirm`,
                  { replace: true, state: { address, amount } },
                );
              }}
            >
              {t("common.back")}
            </button>
          </>
        ) : (
          <button
            type="button"
            className="wallet-wsucc__cta"
            disabled={phase === "sending"}
            onClick={() => {
              haptic("light");
              navigate(`/wallet/${asset.id}`, { replace: true });
            }}
          >
            {phase === "sending"
              ? t("common.loading")
              : t("wallet.withdrawSuccessDone")}
          </button>
        )}
      </div>
    </div>
  );
}
