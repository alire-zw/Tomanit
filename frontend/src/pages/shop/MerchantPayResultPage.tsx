import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ComponentType,
} from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import ArrowUpLeft01Icon from "../../components/icons/hugeicons/ArrowUpLeft01Icon";
import ArrowUpRight01Icon from "../../components/icons/hugeicons/ArrowUpRight01Icon";
import HoldPhoneIcon from "../../components/icons/hugeicons/HoldPhoneIcon";
import RoboticIcon from "../../components/icons/hugeicons/RoboticIcon";
import WebDesign01Icon from "../../components/icons/hugeicons/WebDesign01Icon";
import { useI18n } from "../../context/I18nContext";
import { useTheme } from "../../context/ThemeContext";
import { useTelegram } from "../../hooks/useTelegram";
import { localeToBcp47 } from "../../i18n";
import { formatFaNumber } from "../../lib/format";
import {
  applyInvoiceTheme,
  cacheInvoiceTheme,
  clearInvoiceTheme,
  parseInvoiceTheme,
  readCachedInvoiceTheme,
  type InvoiceThemeId,
} from "../../lib/invoiceThemes";
import {
  fetchMerchantPayCharge,
  type MerchantPayCharge,
} from "../../lib/shop";
import { applyMerchantPayTelegramChrome } from "../../lib/telegramTheme";
import "./MerchantPay.css";
import "./MerchantPayResult.css";

const AMOUNT_COLOR = "#fbbf24";

type ChannelIcon = ComponentType<{
  size?: number;
  color?: string;
  variant?: string;
}>;

function channelMeta(
  channel: NonNullable<MerchantPayCharge["shopChannel"]>,
  t: (k: string) => string,
): { label: string; Icon: ChannelIcon } {
  if (channel === "website") {
    return { label: t("myShop.regChannelWebsite"), Icon: WebDesign01Icon };
  }
  if (channel === "bot") {
    return { label: t("myShop.regChannelBot"), Icon: RoboticIcon };
  }
  return { label: t("myShop.regChannelManual"), Icon: HoldPhoneIcon };
}

function CheckIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden>
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.4"
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

function ClockIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden>
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M12 7v5l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0"
      />
    </svg>
  );
}

function formatResultDateTime(
  iso: string,
  locale: string,
  hourWord: string,
): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "—";
  const bcp = localeToBcp47(locale as never);
  const day = date.toLocaleDateString(bcp, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const time = date.toLocaleTimeString(bcp, {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${day} ${hourWord} ${time}`;
}

export function MerchantPayResultPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const code = params.get("code") || "";
  const { t, locale } = useI18n();
  const { haptic } = useTelegram();
  const { colorScheme } = useTheme();
  const [charge, setCharge] = useState<MerchantPayCharge | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [invoiceTheme, setInvoiceTheme] = useState<InvoiceThemeId>(() =>
    readCachedInvoiceTheme(code) ?? "teal",
  );
  const ArrowIcon =
    locale === "fa" || locale === "ar" ? ArrowUpLeft01Icon : ArrowUpRight01Icon;

  useLayoutEffect(() => {
    const cached = readCachedInvoiceTheme(code);
    if (cached) {
      setInvoiceTheme(cached);
      applyInvoiceTheme(cached);
    }
    return () => {
      clearInvoiceTheme();
    };
  }, [code]);

  const load = useCallback(async () => {
    if (!code) {
      setError(t("myShop.merchantPayResultMissing"));
      setLoading(false);
      return;
    }
    try {
      const data = await fetchMerchantPayCharge(code);
      if (data.charge.kind !== "merchant_invoice") {
        navigate(
          `/wallet/deposit/gateway/result?code=${encodeURIComponent(code)}`,
          { replace: true },
        );
        return;
      }
      const theme = parseInvoiceTheme(data.charge.invoiceTheme);
      cacheInvoiceTheme(code, theme);
      if (data.charge.invoiceCode) {
        cacheInvoiceTheme(data.charge.invoiceCode, theme);
      }
      setInvoiceTheme(theme);
      applyInvoiceTheme(theme);
      setCharge(data.charge);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setLoading(false);
    }
  }, [code, navigate, t]);

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

  const isFailed = charge?.status === "failed" || Boolean(error && !charge);
  const isCompleted = charge?.status === "completed";
  const isPending =
    Boolean(charge && !isFailed && !isCompleted) || (loading && !charge);
  const tone = isFailed ? "fail" : isCompleted ? "ok" : "pending";

  useEffect(() => {
    applyMerchantPayTelegramChrome(isFailed ? "danger" : "accent");
  }, [colorScheme, isFailed, invoiceTheme]);

  const title =
    !charge && error
      ? t("myShop.merchantPayResultFailed")
      : isCompleted
        ? t("myShop.merchantPayResultSuccess")
        : isFailed
          ? t("myShop.merchantPayResultFailed")
          : t("myShop.merchantPayResultPending");

  const sub = !charge
    ? error || t("myShop.merchantPayResultLoading")
    : isCompleted
      ? t("myShop.merchantPayResultSuccessSub")
      : isFailed
        ? t("myShop.merchantPayResultFailedSub")
        : t("myShop.merchantPayResultPendingSub");

  const totalAmount = Number(charge?.amountToman ?? 0);
  const feeAmount = Number(charge?.feeToman ?? 0);
  const shopName = charge?.shopName?.trim() || null;
  const shopLogo = charge?.shopLogoDataUrl || null;
  const shopInitial = shopName?.slice(0, 1) || "—";

  const sellLabel =
    charge?.shopSellType === "services"
      ? t("myShop.regSellServices")
      : t("myShop.regSellGoods");

  const channel = charge?.shopChannel
    ? channelMeta(charge.shopChannel, t)
    : null;
  const ChannelIcon = channel?.Icon;
  const channelHref =
    charge?.shopChannel === "website"
      ? charge.shopSiteUrl
      : charge?.shopChannel === "bot"
        ? charge.shopBotUrl
        : null;

  const whenText = useMemo(() => {
    if (!charge) return "—";
    return formatResultDateTime(
      charge.paidAt || charge.createdAt || new Date().toISOString(),
      locale,
      t("myShop.merchantPayResultHour"),
    );
  }, [charge, locale, t]);

  const openChannel = () => {
    if (!channelHref) return;
    haptic("light");
    const tg = window.Telegram?.WebApp;
    if (tg?.openTelegramLink && /t\.me\//i.test(channelHref)) {
      tg.openTelegramLink(channelHref);
      return;
    }
    if (tg?.openLink) {
      tg.openLink(channelHref);
      return;
    }
    window.open(channelHref, "_blank", "noopener,noreferrer");
  };

  const onDone = () => {
    haptic("light");
    const tg = window.Telegram?.WebApp;
    if (tg?.close) {
      tg.close();
      return;
    }
    navigate("/", { replace: true });
  };

  const onRetryGateway = () => {
    if (!charge?.paymentUrl) return;
    haptic("medium");
    window.location.assign(charge.paymentUrl);
  };

  const StatusIcon = isFailed ? AlertIcon : isPending ? ClockIcon : CheckIcon;

  return (
    <div className={`mpr mpr--${tone}`} aria-busy={loading || undefined}>
      <div className="mpr__hero">
        <div className="mpr__status">
          <span className={`mpr__status-mark mpr__status-mark--${tone}`}>
            <StatusIcon />
          </span>
          <div className="mpr__status-copy">
            <p className="mpr__status-kicker">{t("myShop.merchantPayResultTitle")}</p>
            <h1 className="mpr__status-title">{title}</h1>
          </div>
        </div>

        <div className="mpr__amount-block">
          <p className="mpr__amount-label">{t("myShop.merchantPayTxTotal")}</p>
          <p className="mpr__amount-row">
            {loading && !charge ? (
              <>
                <span className="mpr__skel mpr__skel--amount" aria-hidden />
                <span className="mpr__skel mpr__skel--unit" aria-hidden />
              </>
            ) : (
              <>
                <span className="mpr__amount-value">
                  {charge ? formatFaNumber(totalAmount) : "—"}
                </span>
                <span className="mpr__amount-unit">{t("wallet.toman")}</span>
              </>
            )}
          </p>
          <p className="mpr__lead">{sub}</p>
        </div>
      </div>

      <div className="mpr__sheet">
        {loading && !charge ? (
          <div className="mpay__shop mpay__shop--skel" aria-hidden>
            <div className="mpay__shop-head">
              <span className="mpay__shop-avatar mpay__skel mpay__skel--avatar" />
              <div className="mpay__shop-title">
                <span className="mpay__skel mpay__skel--kicker" />
                <span className="mpay__skel mpay__skel--name" />
              </div>
              <span className="mpay__skel mpay__skel--channel" />
            </div>
            <div className="mpay__shop-rule" />
            <div className="mpay__shop-facts">
              <div className="mpay__shop-fact">
                <span className="mpay__skel mpay__skel--fact-label" />
                <span className="mpay__skel mpay__skel--fact-value" />
              </div>
              <div className="mpay__shop-fact">
                <span className="mpay__skel mpay__skel--fact-label" />
                <span className="mpay__skel mpay__skel--fact-value" />
              </div>
            </div>
          </div>
        ) : (
          <div className="mpay__shop">
            <div className="mpay__shop-head">
              <span className="mpay__shop-avatar" aria-hidden>
                {shopLogo ? (
                  <img
                    src={shopLogo}
                    alt=""
                    width={58}
                    height={58}
                    decoding="async"
                  />
                ) : (
                  <span className="mpay__shop-avatar-fallback">{shopInitial}</span>
                )}
              </span>
              <div className="mpay__shop-title">
                <p className="mpay__shop-kicker">{t("myShop.merchantPayShopLabel")}</p>
                <h2 className="mpay__shop-name">{shopName || "—"}</h2>
              </div>
              {channel && ChannelIcon ? (
                channelHref ? (
                  <button
                    type="button"
                    className="mpay__channel-btn"
                    onClick={openChannel}
                    aria-label={channel.label}
                  >
                    <ChannelIcon variant="bulk-rounded" size={14} color="currentColor" />
                    <span>{channel.label}</span>
                  </button>
                ) : (
                  <span className="mpay__channel-btn mpay__channel-btn--static">
                    <ChannelIcon variant="bulk-rounded" size={14} color="currentColor" />
                    <span>{channel.label}</span>
                  </span>
                )
              ) : null}
            </div>

            <div className="mpay__shop-rule" aria-hidden />

            <div className="mpay__shop-facts">
              <div className="mpay__shop-fact">
                <span className="mpay__shop-fact-label">
                  {t("myShop.merchantPayShopSellType")}
                </span>
                <span className="mpay__shop-fact-value">{sellLabel}</span>
              </div>
              <div className="mpay__shop-fact">
                <span className="mpay__shop-fact-label">
                  {t("myShop.merchantPayShopChannel")}
                </span>
                <span className="mpay__shop-fact-value">
                  {channel?.label || "—"}
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="mpr__receipt">
          <div className="mpr__row">
            <span className="mpr__key">{t("myShop.merchantPayId")}</span>
            <span className="mpr__val mpr__val--mono">
              {charge?.invoiceCode || "—"}
            </span>
          </div>
          <div className="mpr__row">
            <span className="mpr__key">{t("myShop.merchantPayTxFee")}</span>
            <span className="mpr__val">
              {charge ? `${formatFaNumber(feeAmount)} ${t("wallet.toman")}` : "—"}
            </span>
          </div>
          <div className="mpr__row">
            <span className="mpr__key">{t("tx.detail.date")}</span>
            <span className="mpr__val">{whenText}</span>
          </div>
        </div>

        <div className="mpr__actions">
          {isPending && charge?.paymentUrl ? (
            <>
              <button type="button" className="mpr__text-action" onClick={onRetryGateway}>
                <span>{t("myShop.merchantPayOpenGateway")}</span>
                <ArrowIcon
                  variant="bulk-rounded"
                  size={23}
                  color={AMOUNT_COLOR}
                  aria-hidden
                />
              </button>
              <div className="mpr__actions-rule" aria-hidden />
              <button
                type="button"
                className="mpr__text-action mpr__text-action--muted"
                onClick={onDone}
              >
                <span>{t("myShop.merchantPayResultDone")}</span>
                <ArrowIcon
                  variant="bulk-rounded"
                  size={23}
                  color={AMOUNT_COLOR}
                  aria-hidden
                />
              </button>
            </>
          ) : (
            <button type="button" className="mpr__text-action" onClick={onDone}>
              <span>{t("myShop.merchantPayResultDone")}</span>
              <ArrowIcon
                variant="bulk-rounded"
                size={23}
                color={AMOUNT_COLOR}
                aria-hidden
              />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
