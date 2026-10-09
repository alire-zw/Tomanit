import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PageHeader } from "../../components/PageHeader";
import { useI18n } from "../../context/I18nContext";
import { useAuth } from "../../hooks/useAuth";
import { useTelegram } from "../../hooks/useTelegram";
import { apiFetch } from "../../lib/api";
import { formatFaDate, formatFaNumber } from "../../lib/format";
import { applyMerchantPayTelegramChrome } from "../../lib/telegramTheme";
import { useTheme } from "../../context/ThemeContext";
import "../../styles/shop-rise.css";
import "./WalletWithdrawSuccess.css";
import "./WalletGatewayResult.css";

type ChargeView = {
  code: string;
  amountToman: string;
  status: string;
  paymentUrl: string | null;
  trackId: string | null;
  paidAt: string | null;
  createdAt?: string | null;
  gatewayName: string;
  usdtRateToman?: number | null;
};

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

function GatewayResultSkeleton() {
  return (
    <>
      <div className="wallet-wsucc__body">
        <section className="wallet-wsucc__banner wallet-wsucc__banner--skeleton" aria-hidden>
          <span className="wallet-wsucc__skel-mark" />
          <span className="wallet-wsucc__skel-title" />
          <span className="wallet-wsucc__skel-sub" />
        </section>

        <div className="wallet-wsucc__meta wallet-wsucc__meta--skeleton" aria-hidden>
          {[0, 1, 2].map((i) => (
            <div key={i} className="wallet-wsucc__meta-row">
              <span className="wallet-wsucc__skel-key" />
              <span
                className={`wallet-wsucc__skel-value${
                  i === 2 ? " wallet-wsucc__skel-value--wide" : ""
                }`}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="wallet-wsucc__footer" aria-hidden>
        <span className="wallet-wsucc__skel-cta" />
      </div>
    </>
  );
}

export function WalletGatewayResultPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const code = params.get("code") || "";
  const { t } = useI18n();
  const { haptic } = useTelegram();
  const { refresh } = useAuth();
  const [charge, setCharge] = useState<ChargeView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const refreshedRef = useRef(false);

  const load = useCallback(async () => {
    if (!code) {
      setError(t("wallet.gatewayMissingCode"));
      setLoading(false);
      return;
    }
    try {
      const data = await apiFetch<{ charge: ChargeView & { kind?: string } }>(
        `/wallet/gateway-charge/${encodeURIComponent(code)}`,
      );
      if (data.charge.kind === "merchant_invoice") {
        navigate(`/p/result?code=${encodeURIComponent(code)}`, { replace: true });
        return;
      }
      setCharge(data.charge);
      setError(null);
      if (data.charge.status === "completed" && !refreshedRef.current) {
        refreshedRef.current = true;
        void refresh({ force: true, silent: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setLoading(false);
    }
  }, [code, t, refresh, navigate]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!code || !charge) return;
    if (charge.status === "completed" || charge.status === "failed") return;
    const id = window.setInterval(() => {
      void load();
    }, 2500);
    return () => window.clearInterval(id);
  }, [code, charge, load]);

  const goHome = () => {
    haptic("light");
    navigate("/", { replace: true });
  };

  const { colorScheme } = useTheme();
  const isFailed = charge?.status === "failed" || Boolean(error && !charge);
  const isCompleted = charge?.status === "completed";
  const isPending = Boolean(charge && !isFailed && !isCompleted);

  useEffect(() => {
    applyMerchantPayTelegramChrome(isFailed ? "danger" : "accent");
  }, [colorScheme, isFailed]);

  const bannerTitle = !charge
    ? t("wallet.gatewayResultTitle")
    : isCompleted
      ? t("wallet.gatewayStatusSuccess")
      : isFailed
        ? t("wallet.gatewayStatusFailed")
        : t("wallet.gatewayStatusPending");

  const bannerSub = !charge
    ? t("wallet.gatewayResultLoadingSub")
    : isCompleted
      ? t("wallet.gatewayResultSuccessSub")
      : isFailed
        ? t("wallet.gatewayResultFailedSub")
        : t("wallet.gatewayResultPendingSub");

  return (
    <div className="wallet-wsucc">
      <div className="wallet-wsucc__header">
        <PageHeader title={bannerTitle} onBack={goHome} />
      </div>

      {loading && !charge ? (
        <GatewayResultSkeleton />
      ) : (
        <>
          <div className="wallet-wsucc__body">
            <section
              className={`wallet-wsucc__banner shop-rise${
                isFailed || (error && !charge) ? " wallet-wsucc__banner--error" : ""
              }`}
              style={{ "--rise-index": 1 } as CSSProperties}
            >
              <span
                className={`wallet-wsucc__mark${
                  isPending || (loading && !charge) ? " wallet-wsucc__mark--pending" : ""
                }`}
              >
                {isFailed || (error && !charge) ? <AlertIcon /> : <CheckIcon />}
              </span>
              <h2 className="wallet-wsucc__banner-title">{bannerTitle}</h2>
              <p className="wallet-wsucc__banner-sub">{bannerSub}</p>
            </section>

            {error && !charge ? (
              <p className="wallet-wsucc__error shop-rise">{error}</p>
            ) : null}

            {charge ? (
              <div
                className="wallet-wsucc__meta shop-rise"
                style={{ "--rise-index": 2 } as CSSProperties}
              >
                <div className="wallet-wsucc__meta-row wallet-wsucc__meta-row--pair">
                  <div className="wallet-wsucc__pair-item">
                    <span className="wallet-wsucc__meta-key">{t("wallet.amount")}</span>
                    <span className="wallet-wsucc__meta-value">
                      {formatFaNumber(Number(charge.amountToman))} {t("wallet.toman")}
                    </span>
                  </div>
                  <div className="wallet-wsucc__pair-item wallet-wsucc__pair-item--end">
                    <span className="wallet-wsucc__meta-key">{t("wallet.gatewayName")}</span>
                    <span className="wallet-wsucc__meta-value">{charge.gatewayName}</span>
                  </div>
                </div>
                <div className="wallet-wsucc__meta-row">
                  <span className="wallet-wsucc__meta-key">{t("tx.detail.date")}</span>
                  <span className="wallet-wsucc__meta-value">
                    {formatFaDate(charge.paidAt || charge.createdAt || new Date().toISOString())}
                  </span>
                </div>
                <div className="wallet-wsucc__meta-row">
                  <span className="wallet-wsucc__meta-key">
                    {t("wallet.gatewayUsdtPriceAtDeposit")}
                  </span>
                  <span className="wallet-wsucc__meta-value">
                    {typeof charge.usdtRateToman === "number" && charge.usdtRateToman > 0
                      ? `${formatFaNumber(Math.round(charge.usdtRateToman))} ${t("wallet.toman")}`
                      : "—"}
                  </span>
                </div>
              </div>
            ) : null}
          </div>

          <div className="wallet-wsucc__footer">
            {charge?.status === "pending" && charge.paymentUrl ? (
              <button
                type="button"
                className="wallet-wsucc__cta"
                onClick={() => {
                  haptic("medium");
                  window.location.assign(charge.paymentUrl!);
                }}
              >
                {t("wallet.gatewayOpenAgain")}
              </button>
            ) : null}
            <button
              type="button"
              className={`wallet-wsucc__cta${
                charge?.status === "pending" && charge.paymentUrl
                  ? " wallet-wsucc__cta--secondary"
                  : ""
              }`}
              onClick={goHome}
            >
              {t("wallet.gatewayBackHome")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
