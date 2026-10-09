import { useEffect, useState, type CSSProperties } from "react";
import QRCode from "react-qr-code";
import { Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "../../components/PageHeader";
import { useNotification } from "../../components/Notification";
import AlertDiamondIcon from "../../components/icons/alert-diamond-stroke-rounded";
import CopyIcon from "../../components/icons/CopyIcon";
import InformationCircleIcon from "../../components/icons/information-circle-stroke-rounded";
import { useI18n } from "../../context/I18nContext";
import { useTelegram } from "../../hooks/useTelegram";
import {
  ApiError,
  apiFetch,
  type WalletAssetId,
  type WalletDepositAddressResponse,
} from "../../lib/api";
import {
  getWalletAssetDef,
  isWalletAssetId,
} from "../../lib/walletAssetsCatalog";
import {
  ASSET_DEPOSIT_NETWORKS,
  isWalletNetworkId,
  minDepositLabelForRate,
  NETWORK_UI,
} from "../../lib/walletNetworks";
import {
  readCachedWalletRates,
  writeCachedWalletRates,
} from "../../lib/walletRatesCache";
import "../../styles/shop-rise.css";
import "./WalletDeposit.css";

function ShareIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        d="m8.59 13.51 6.83 3.98m-.01-10.98-6.82 3.98M21 5a3 3 0 1 1-6 0 3 3 0 0 1 6 0M9 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0m12 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0"
      />
    </svg>
  );
}

async function fetchDepositAddress(
  networkId: string,
  signal: AbortSignal,
): Promise<string> {
  try {
    const data = await apiFetch<WalletDepositAddressResponse>(
      `/wallet/deposit-address?network=${encodeURIComponent(networkId)}`,
      { signal, timeoutMs: 25_000 },
    );
    if (data.address) return data.address;
  } catch (err) {
    if (signal.aborted) throw err;
  }

  const list = await apiFetch<{
    addresses: Array<{ network: string; address: string }>;
  }>("/wallet/addresses", { signal, timeoutMs: 25_000 });
  const row = list.addresses.find((a) => a.network === networkId);
  if (!row?.address) {
    throw new ApiError("Address unavailable", 404);
  }
  return row.address;
}

export function WalletDepositAddressPage() {
  const { assetId = "", networkId = "" } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useI18n();
  const { haptic } = useTelegram();
  const { notify } = useNotification();
  const [address, setAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [rateToman, setRateToman] = useState<number | null>(() => {
    if (!isWalletAssetId(assetId) || assetId === "toman") return null;
    const cached = readCachedWalletRates();
    const value = cached?.rates[assetId];
    return value && value > 0 ? value : null;
  });

  const asset = isWalletAssetId(assetId) ? getWalletAssetDef(assetId) : undefined;
  const networkOk = isWalletNetworkId(networkId);
  const network = networkOk ? NETWORK_UI[networkId] : null;
  const supported =
    asset &&
    asset.id !== "toman" &&
    networkOk &&
    (ASSET_DEPOSIT_NETWORKS[asset.id] ?? []).includes(networkId);

  useEffect(() => {
    if (!networkOk) return;

    const ac = new AbortController();
    let alive = true;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const next = await fetchDepositAddress(networkId, ac.signal);
        if (!alive || ac.signal.aborted) return;
        setAddress(next);
      } catch (err) {
        if (!alive || ac.signal.aborted) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (err instanceof ApiError && err.status === 408) {
          if (ac.signal.aborted) return;
        }
        const message =
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : t("common.error");
        setAddress(null);
        setError(message || t("common.timeoutError"));
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
      ac.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [networkId, networkOk, reloadKey]);

  useEffect(() => {
    if (!asset || asset.id === "toman") return;
    const id = asset.id as Exclude<WalletAssetId, "toman">;
    const cached = readCachedWalletRates();
    const cachedRate = cached?.rates[id];
    if (cachedRate && cachedRate > 0) {
      setRateToman(cachedRate);
    }

    const ac = new AbortController();
    let alive = true;
    (async () => {
      try {
        const data = await apiFetch<{
          source?: string;
          rates?: Partial<Record<WalletAssetId, number>>;
          changes?: Partial<Record<Exclude<WalletAssetId, "toman">, number>>;
        }>("/wallet/rates", { signal: ac.signal });
        if (!alive || ac.signal.aborted) return;
        if (data.source !== "swapwallet" || !data.rates) return;
        const next = Number(data.rates[id]);
        if (!(next > 0)) return;
        setRateToman(next);
        writeCachedWalletRates(data.rates, data.changes ?? {});
      } catch {
        // Keep cache / hide min row if unavailable.
      }
    })();

    return () => {
      alive = false;
      ac.abort();
    };
  }, [asset]);

  if (!asset || !asset.hasCoinPage || !supported || !network) {
    return <Navigate to={asset ? `/wallet/${asset.id}/deposit` : "/"} replace />;
  }

  const networkName = t(network.nameKey);
  const networkCode = network.code;
  const minDepositLabel =
    rateToman && rateToman > 0
      ? minDepositLabelForRate(rateToman, asset.symbol)
      : null;

  const copyAddress = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      haptic("light");
      notify(t("wallet.copiedAddress"), "success");
    } catch {
      notify(t("common.error"), "error");
    }
  };

  const shareAddress = async () => {
    if (!address) return;
    const text = `${t(asset.titleKey)} · ${networkName}\n${address}`;
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ text });
        haptic("light");
        return;
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
    }
    await copyAddress();
  };

  return (
    <div className="wallet-deposit">
      <div className="wallet-deposit__header">
        <PageHeader
          title={t("wallet.depositAssetTitle", { asset: t(asset.titleKey) })}
          onBack={() =>
            navigate(`/wallet/${asset.id}/deposit`, {
              replace: true,
              state: (location.state as { from?: string } | null) ?? { from: "coin-list" },
            })
          }
        />
      </div>

      <div
        className="wallet-deposit__address-page shop-rise"
        style={{ "--rise-index": 1 } as CSSProperties}
      >
        {loading ? (
          <div className="wallet-deposit__qr-skel" aria-hidden />
        ) : error ? (
          <div className="wallet-deposit__address-error wallet-deposit__address-error--center">
            <p>{error}</p>
            <button
              type="button"
              className="wallet-deposit__retry"
              onClick={() => setReloadKey((k) => k + 1)}
            >
              {t("common.retry")}
            </button>
          </div>
        ) : address ? (
          <>
            <div className="wallet-deposit__qr-card">
              <div className="wallet-deposit__qr-frame">
                <QRCode
                  value={address}
                  size={168}
                  bgColor="#ffffff"
                  fgColor="#111111"
                  level="H"
                  className="wallet-deposit__qr-svg"
                />
                <div className="wallet-deposit__qr-logo" aria-hidden>
                  <img src={asset.logo} alt="" width={28} height={28} />
                </div>
              </div>
              <button
                type="button"
                className="wallet-deposit__qr-address"
                lang="en"
                dir="ltr"
                onClick={() => void copyAddress()}
              >
                {address}
              </button>
            </div>

            <div className="wallet-deposit__actions">
              <button
                type="button"
                className="wallet-deposit__action"
                onClick={() => void copyAddress()}
              >
                <span className="wallet-deposit__action-btn">
                  <CopyIcon width={18} height={18} />
                </span>
                <span className="wallet-deposit__action-label">{t("common.copy")}</span>
              </button>
              <button
                type="button"
                className="wallet-deposit__action"
                onClick={() => void shareAddress()}
              >
                <span className="wallet-deposit__action-btn">
                  <ShareIcon />
                </span>
                <span className="wallet-deposit__action-label">{t("wallet.share")}</span>
              </button>
            </div>
          </>
        ) : null}

        <div className="wallet-deposit__meta">
          <div className="wallet-deposit__meta-row">
            <span className="wallet-deposit__meta-key">{t("wallet.network")}</span>
            <span className="wallet-deposit__meta-value">
              <span className="wallet-deposit__meta-net" dir="ltr">
                <span className="wallet-deposit__meta-net-icon" aria-hidden>
                  <img src={network.logo} alt="" width={18} height={18} />
                </span>
                <span className="wallet-deposit__meta-net-name" lang="en">
                  {networkCode}
                </span>
              </span>
            </span>
          </div>
          {minDepositLabel ? (
            <div className="wallet-deposit__meta-row">
              <span className="wallet-deposit__meta-key">{t("wallet.minDeposit")}</span>
              <span
                className="wallet-deposit__meta-value wallet-deposit__meta-value--mono"
                lang="en"
                dir="ltr"
              >
                {minDepositLabel}
              </span>
            </div>
          ) : null}
        </div>

        <div className="wallet-deposit__important">
          <h3 className="wallet-deposit__important-title">{t("wallet.importantInfo")}</h3>
          <div className="wallet-deposit__tips">
            <div className="wallet-deposit__tip">
              <div className="wallet-deposit__tip-icon">
                <AlertDiamondIcon width={18} height={18} />
              </div>
              <div className="wallet-deposit__tip-body">
                <strong>{t("wallet.depositRiskTitle")}</strong>
                <p>
                  {t("wallet.depositRiskBody", {
                    asset: asset.symbol,
                    network: networkName,
                  })}
                </p>
              </div>
            </div>
            <div className="wallet-deposit__tip">
              <div className="wallet-deposit__tip-icon">
                <InformationCircleIcon width={18} height={18} />
              </div>
              <div className="wallet-deposit__tip-body">
                <strong>{t("wallet.depositMinTitle")}</strong>
                <p>{t("wallet.depositMinBody")}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
