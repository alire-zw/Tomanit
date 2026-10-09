import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  Navigate,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import { NumeralKeypad } from "../../components/NumeralKeypad";
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
  appendCryptoAmount,
  parseCryptoAmount,
  removeLastCryptoAmount,
  truncateAddress,
} from "../../lib/cryptoAmountInput";
import { toPersianDigit } from "../../lib/digits";
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
import { getWalletAssetBalance } from "../../lib/walletUi";
import { WithdrawLimitsDrawer } from "./WithdrawLimitsDrawer";
import "../../styles/shop-rise.css";
import "./WalletDeposit.css";
import "./WalletWithdraw.css";
import "./WalletWithdrawAmount.css";

type AmountLocationState = {
  address?: string;
};

function withdrawAddressStorageKey(assetId: string, networkId: string) {
  return `tomanit.withdraw.address.${assetId}.${networkId}`;
}

function withdrawAmountStorageKey(assetId: string, networkId: string) {
  return `tomanit.withdraw.amount.${assetId}.${networkId}`;
}

type AmountUnit = "crypto" | "toman";

function formatRawCrypto(n: number): string {
  if (!(n > 0) || !Number.isFinite(n)) return "";
  return n.toFixed(8).replace(/\.?0+$/, "");
}

function formatRawToman(n: number): string {
  if (!(n > 0) || !Number.isFinite(n)) return "";
  return String(Math.round(n));
}

/** Display keypad input with Persian digits (+ thousand sep for toman). */
function formatAmountInputDisplay(raw: string, unit: AmountUnit): string {
  if (!raw) return toPersianDigit("0");
  if (unit === "toman") {
    const n = Number(raw);
    return Number.isFinite(n) ? formatFaNumber(n) : toPersianDigit(raw);
  }
  const hasDot = raw.includes(".");
  const [whole = "0", frac = ""] = raw.split(".");
  const wholeNum = Number(whole);
  const wholeFa = Number.isFinite(wholeNum)
    ? formatFaNumber(wholeNum)
    : toPersianDigit(whole);
  if (!hasDot) return wholeFa;
  return `${wholeFa}٫${toPersianDigit(frac)}`;
}

export function WalletWithdrawAmountPage() {
  const { assetId = "", networkId = "" } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useI18n();
  const { haptic } = useTelegram();
  const { wallet } = useAuth();

  const navAddress =
    ((location.state as AmountLocationState | null)?.address ?? "").trim();
  const [address, setAddress] = useState(() => {
    if (navAddress.length >= 8) return navAddress;
    try {
      return (
        sessionStorage
          .getItem(withdrawAddressStorageKey(assetId, networkId))
          ?.trim() ?? ""
      );
    } catch {
      return "";
    }
  });

  const [amountRaw, setAmountRaw] = useState("");
  const [inputUnit, setInputUnit] = useState<AmountUnit>("crypto");
  const [limitsOpen, setLimitsOpen] = useState(false);
  const [limits, setLimits] = useState<WalletWithdrawLimitsResponse | null>(
    null,
  );
  const [limitsLoading, setLimitsLoading] = useState(false);

  const asset = isWalletAssetId(assetId) ? getWalletAssetDef(assetId) : undefined;
  const network = isWalletNetworkId(networkId) ? NETWORK_UI[networkId] : undefined;
  const networkAllowed = Boolean(
    asset &&
      asset.id !== "toman" &&
      network &&
      withdrawNetworksForAsset(asset.id).some((n) => n.id === network.id),
  );

  // Keep address across remounts / lost location.state (Telegram WebView).
  useEffect(() => {
    if (!assetId || !networkId) return;
    const key = withdrawAddressStorageKey(assetId, networkId);
    if (navAddress.length >= 8) {
      setAddress(navAddress);
      try {
        sessionStorage.setItem(key, navAddress);
      } catch {
        /* ignore */
      }
      return;
    }
    try {
      const cached = (sessionStorage.getItem(key) ?? "").trim();
      setAddress(cached.length >= 8 ? cached : "");
    } catch {
      setAddress("");
    }
  }, [assetId, networkId, navAddress]);

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

  const walletBalance =
    asset && asset.id !== "toman"
      ? getWalletAssetBalance(wallet, asset.id)
      : 0;

  useEffect(() => {
    if (!assetId || !isWalletAssetId(assetId) || assetId === "toman") return;
    const controller = new AbortController();
    setLimitsLoading(true);
    void apiFetch<WalletWithdrawLimitsResponse>(
      `/wallet/withdraw-limits?asset=${encodeURIComponent(assetId)}`,
      { signal: controller.signal, timeoutMs: 20_000 },
    )
      .then((data) => {
        if (!controller.signal.aborted) setLimits(data);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        const name =
          err && typeof err === "object" && "name" in err
            ? String((err as { name?: string }).name)
            : "";
        if (name === "AbortError") return;
        setLimits(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLimitsLoading(false);
      });
    return () => controller.abort();
  }, [assetId]);

  if (!asset || asset.id === "toman" || !asset.hasCoinPage) {
    return <Navigate to="/wallet/withdraw" replace />;
  }
  if (!network || !networkAllowed) {
    return <Navigate to={`/wallet/${asset.id}/withdraw`} replace />;
  }
  if (address.length < 8) {
    return (
      <Navigate
        to={`/wallet/${asset.id}/withdraw/${network.id}`}
        replace
      />
    );
  }

  const withdrawable = limits != null ? limits.withdrawable : walletBalance;
  const inputValue = parseCryptoAmount(amountRaw);
  const unitPrice = rate != null && rate > 0 ? rate : null;
  const canUseToman = unitPrice != null;
  const cryptoAmount =
    inputUnit === "crypto"
      ? inputValue
      : unitPrice != null
        ? inputValue / unitPrice
        : 0;
  const tomanAmount =
    inputUnit === "toman"
      ? inputValue
      : unitPrice != null
        ? Math.round(inputValue * unitPrice)
        : 0;
  const secondaryValue =
    inputUnit === "crypto" ? tomanAmount : cryptoAmount;
  const assetLabel = t(asset.titleKey);
  const tomanLabel = t("wallet.toman");
  const secondaryUnit = inputUnit === "crypto" ? tomanLabel : assetLabel;
  const primaryUnit = inputUnit === "crypto" ? assetLabel : tomanLabel;
  const maxDecimals = inputUnit === "crypto" ? 8 : 0;
  const amountDisplay = formatAmountInputDisplay(amountRaw, inputUnit);
  const secondaryDisplay =
    inputUnit === "crypto"
      ? formatFaNumber(secondaryValue)
      : formatFaCryptoQty(secondaryValue, 6);

  const canContinue =
    cryptoAmount > 0 &&
    cryptoAmount <= withdrawable + 1e-12 &&
    (fee.minAmount == null || cryptoAmount >= fee.minAmount) &&
    cryptoAmount > fee.feeAmount;

  const shortAddress = truncateAddress(address);

  const swapInputUnit = () => {
    if (unitPrice == null) return;
    haptic("light");
    if (inputUnit === "crypto") {
      setAmountRaw(
        inputValue > 0 ? formatRawToman(inputValue * unitPrice) : "",
      );
      setInputUnit("toman");
      return;
    }
    setAmountRaw(
      inputValue > 0 ? formatRawCrypto(inputValue / unitPrice) : "",
    );
    setInputUnit("crypto");
  };

  return (
    <div className="wallet-wamt">
      <div className="wallet-wamt__header">
        <PageHeader
          title={t("wallet.withdrawAssetTitle", { asset: t(asset.titleKey) })}
          onBack={() =>
            navigate(`/wallet/${asset.id}/withdraw/${network.id}`, {
              replace: true,
              state: { address },
            })
          }
        />
      </div>

      <div className="wallet-wamt__body">
        <div
          className="wallet-wamt__head shop-rise"
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
          <p className="wallet-wamt__head-text">
            {t("wallet.withdrawAmountToAddress", {
              asset: t(asset.titleKey),
              address: shortAddress,
            })}
          </p>
        </div>

        <div
          className="wallet-wamt__amount-card shop-rise"
          style={{ "--rise-index": 2 } as CSSProperties}
        >
          <div className="wallet-wamt__amount-row" dir="ltr">
            <span
              className={`wallet-wamt__amount-value${
                amountRaw ? "" : " wallet-wamt__amount-value--placeholder"
              }`}
            >
              {amountDisplay}
            </span>
            <div className="wallet-wamt__amount-meta">
              <span className="wallet-wamt__symbol">{primaryUnit}</span>
              <span className="wallet-wamt__vline" aria-hidden />
              <button
                type="button"
                className="wallet-wamt__max"
                onClick={() => {
                  haptic("light");
                  if (!(withdrawable > 0)) return;
                  if (inputUnit === "crypto") {
                    setAmountRaw(formatRawCrypto(withdrawable));
                    return;
                  }
                  if (unitPrice == null) return;
                  setAmountRaw(formatRawToman(withdrawable * unitPrice));
                }}
              >
                {t("wallet.withdrawMax")}
              </button>
            </div>
          </div>

          <div className="wallet-wamt__divider" aria-hidden />

          <button
            type="button"
            className="wallet-wamt__fiat"
            dir="ltr"
            disabled={!canUseToman}
            onClick={swapInputUnit}
            aria-label={
              inputUnit === "crypto"
                ? t("wallet.withdrawEnterInToman")
                : t("wallet.withdrawEnterInCrypto", { asset: assetLabel })
            }
          >
            <svg
              className="wallet-wamt__fiat-icon"
              xmlns="http://www.w3.org/2000/svg"
              width={14}
              height={14}
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.8"
                d="M11 4H6.8c-1.68 0-2.52 0-3.162.327a3 3 0 0 0-1.311 1.311C2 6.28 2 7.12 2 8.8v8.4c0 1.68 0 2.52.327 3.162a3 3 0 0 0 1.311 1.311C4.28 22 5.12 22 6.8 22h8.4c1.68 0 2.52 0 3.162-.327a3 3 0 0 0 1.311-1.311C20 19.72 20 18.88 20 17.2V13M8 16h1.675c.489 0 .733 0 .963-.055.204-.05.4-.13.579-.24.201-.123.374-.296.72-.642L21.5 5.5a2.121 2.121 0 0 0-3-3l-9.563 9.563c-.346.346-.519.519-.642.72a2 2 0 0 0-.24.579c-.055.23-.055.474-.055.963z"
              />
            </svg>
            <span className="wallet-wamt__fiat-value">
              {secondaryDisplay}
              <span className="wallet-wamt__fiat-unit"> {secondaryUnit}</span>
            </span>
          </button>
        </div>

        <div
          className="wallet-wamt__receipt shop-rise"
          style={{ "--rise-index": 3 } as CSSProperties}
        >
          <button
            type="button"
            className="wallet-wamt__receipt-row wallet-wamt__receipt-row--btn"
            onClick={() => {
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
            }}
          >
            <span className="wallet-wamt__receipt-label wallet-wamt__receipt-label--link">
              {t("wallet.withdrawableBalance")}
              <CursorInfo01Icon
                variant="bulk-rounded"
                size={13}
                color="currentColor"
              />
            </span>
            <span className="wallet-wamt__receipt-value" dir="ltr">
              {limitsLoading && limits == null && !(walletBalance > 0)
                ? "…"
                : formatFaCryptoQty(withdrawable, 6)}
              <span className="wallet-wamt__receipt-unit"> {assetLabel}</span>
            </span>
          </button>
          <div className="wallet-wamt__receipt-row">
            <span className="wallet-wamt__receipt-label">
              {t("wallet.withdrawTransferFee")}
            </span>
            <span className="wallet-wamt__receipt-value" dir="ltr">
              {formatFaCryptoQty(fee.feeAmount, 4)}
              <span className="wallet-wamt__receipt-unit"> {assetLabel}</span>
            </span>
          </div>
        </div>
      </div>

      <div className="wallet-wamt__dock">
        <div className="wallet-wamt__keypad">
          <NumeralKeypad
            decimal={maxDecimals > 0}
            backspaceDisabled={!amountRaw}
            onDigit={(key) => {
              setAmountRaw((prev) =>
                appendCryptoAmount(prev, key, maxDecimals),
              );
            }}
            onBackspace={() => {
              setAmountRaw((prev) => removeLastCryptoAmount(prev));
            }}
          />
        </div>
        <button
          type="button"
          className="wallet-wamt__next"
          disabled={!canContinue}
          onClick={() => {
            if (!canContinue) return;
            haptic("medium");
            try {
              sessionStorage.setItem(
                withdrawAmountStorageKey(asset.id, network.id),
                String(cryptoAmount),
              );
              sessionStorage.setItem(
                withdrawAddressStorageKey(asset.id, network.id),
                address,
              );
            } catch {
              /* ignore */
            }
            navigate(`/wallet/${asset.id}/withdraw/${network.id}/confirm`, {
              state: { address, amount: cryptoAmount },
            });
          }}
        >
          {t("wallet.withdrawNextStep")}
        </button>
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
