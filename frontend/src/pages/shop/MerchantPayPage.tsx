import { useEffect, useLayoutEffect, useMemo, useState, type ComponentType } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { BankCardAddModal } from "../../components/BankCardAddModal";
import { BankCardPickerModal } from "../../components/BankCardPickerModal";
import { FlatSelectModal } from "../../components/FlatSelectModal";
import { useNotification } from "../../components/Notification";
import ArrowDown02Icon from "../../components/icons/hugeicons/ArrowDown02Icon";
import ArrowLeft02Icon from "../../components/icons/hugeicons/ArrowLeft02Icon";
import ArrowUpLeft01Icon from "../../components/icons/hugeicons/ArrowUpLeft01Icon";
import Cancel01Icon from "../../components/icons/hugeicons/Cancel01Icon";
import ArrowUpRight01Icon from "../../components/icons/hugeicons/ArrowUpRight01Icon";
import HoldPhoneIcon from "../../components/icons/hugeicons/HoldPhoneIcon";
import LanguagesIcon from "../../components/icons/hugeicons/LanguagesIcon";
import MoonStarIcon from "../../components/icons/hugeicons/MoonStarIcon";
import RoboticIcon from "../../components/icons/hugeicons/RoboticIcon";
import Sun02Icon from "../../components/icons/hugeicons/Sun02Icon";
import WavingHand01Icon from "../../components/icons/hugeicons/WavingHand01Icon";
import WebDesign01Icon from "../../components/icons/hugeicons/WebDesign01Icon";
import AiAutoRotateIcon from "../../components/icons/hugeicons/AiAutoRotateIcon";
import { useI18n } from "../../context/I18nContext";
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../hooks/useAuth";
import { useTelegram } from "../../hooks/useTelegram";
import { LOCALES, type LocaleCode } from "../../i18n";
import { getBankVisual } from "../../lib/bankDetect";
import { listBankCards, type BankCardRecord } from "../../lib/bankCards";
import { getTelegramUserId } from "../../lib/api";
import { formatFaNumber } from "../../lib/format";
import {
  merchantInvoicePayerFeeToman,
  merchantInvoiceTotalToman,
  parseFeeBearer,
} from "../../lib/merchantPayFee";
import {
  applyInvoiceTheme,
  cacheInvoiceTheme,
  clearInvoiceTheme,
  parseInvoiceTheme,
  readCachedInvoiceTheme,
  type InvoiceThemeId,
} from "../../lib/invoiceThemes";
import {
  createMerchantPayCharge,
  fetchPublicMerchantPay,
  notifyMerchantPayOpened,
  type MerchantPaymentLink,
} from "../../lib/shop";
import type { ThemeMode } from "../../lib/theme";
import {
  applyMerchantPayTelegramChrome,
  releaseInvoiceTelegramChrome,
} from "../../lib/telegramTheme";
import "./MerchantPay.css";
import "./MerchantPayResult.css";

const AMOUNT_COLOR = "#fbbf24";

function ExpiredClockIcon() {
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

function isInvoiceExpired(link: {
  status: string;
  expiresAt?: string | null;
}): boolean {
  if (link.status === "expired") return true;
  if (!link.expiresAt) return false;
  const ts = new Date(link.expiresAt).getTime();
  return Number.isFinite(ts) && ts < Date.now();
}

type PublicLink = MerchantPaymentLink & {
  shopName: string;
  shopLogoDataUrl: string | null;
  shopSellType: "goods" | "services";
  shopChannel: "website" | "bot" | "manual";
  shopSiteUrl: string | null;
  shopBotUrl: string | null;
  invoiceTheme?: string;
  feeBearer?: string;
  payerTelegramId?: string | null;
  chargeCode?: string | null;
};

type ChannelIcon = ComponentType<{
  size?: number;
  color?: string;
  variant?: string;
}>;

function channelMeta(
  channel: PublicLink["shopChannel"],
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

function cardLast4(card: BankCardRecord): string {
  if (card.last4?.trim()) return card.last4.trim();
  const digits = card.cardNumber.replace(/\D/g, "");
  return digits.slice(-4) || "****";
}

function cardMaskTail(card: BankCardRecord): string {
  return `*** ${cardLast4(card)}`;
}

function cardDisplayName(card: BankCardRecord, locale: LocaleCode): string {
  if (card.bankName?.trim()) return card.bankName.trim();
  const visual = getBankVisual(card.bankSlug, card.cardNumber);
  return locale === "fa" || locale === "ar" ? visual.nameFa : visual.nameFa;
}

export function MerchantPayPage() {
  const { code = "" } = useParams();
  const { t, locale, setLocale } = useI18n();
  const { themeMode, colorScheme, setThemeMode } = useTheme();
  const navigate = useNavigate();
  const { haptic, openInApp } = useTelegram();
  const { notify } = useNotification();
  const { refresh, user } = useAuth();
  const [link, setLink] = useState<PublicLink | null>(null);
  const [loading, setLoading] = useState(true);
  const [langOpen, setLangOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [cardSheetOpen, setCardSheetOpen] = useState(false);
  const [cardAddOpen, setCardAddOpen] = useState(false);
  const [phase, setPhase] = useState<"intro" | "next">("intro");
  const [cards, setCards] = useState<BankCardRecord[]>([]);
  const [cardsLoading, setCardsLoading] = useState(true);
  const [cardId, setCardId] = useState<number | null>(null);
  const [cardRequired, setCardRequired] = useState(false);
  const [cardErrorPulse, setCardErrorPulse] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [invoiceTheme, setInvoiceTheme] = useState<InvoiceThemeId>("teal");
  /** Seller theme/chrome only after invoice payload is loaded. */
  const [themeReady, setThemeReady] = useState(false);
  const ArrowIcon =
    locale === "fa" || locale === "ar" ? ArrowUpLeft01Icon : ArrowUpRight01Icon;

  /** Keep boot/splash on plain light/dark — no seller tint until data arrives. */
  useLayoutEffect(() => {
    clearInvoiceTheme();
    setThemeReady(false);
    setInvoiceTheme(readCachedInvoiceTheme(code) ?? "teal");
    releaseInvoiceTelegramChrome();
    return () => {
      clearInvoiceTheme();
      releaseInvoiceTelegramChrome();
    };
  }, [code]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLink(null);
    setPhase("intro");
    setThemeReady(false);
    clearInvoiceTheme();
    void (async () => {
      if (!code.trim()) {
        if (!cancelled) {
          setLoading(false);
        }
        return;
      }
      try {
        const data = await fetchPublicMerchantPay(code.trim());
        if (cancelled) return;
        const next = data.link;
        /** Already paid → payment result page, not the invoice intro. */
        if (next.status === "paid") {
          const resultRef = next.chargeCode || next.payToken || code.trim();
          const theme = parseInvoiceTheme(next.invoiceTheme);
          cacheInvoiceTheme(code.trim(), theme);
          cacheInvoiceTheme(resultRef, theme);
          navigate(
            `/p/result?code=${encodeURIComponent(resultRef)}`,
            { replace: true },
          );
          return;
        }
        const theme = parseInvoiceTheme(next.invoiceTheme);
        cacheInvoiceTheme(code.trim(), theme);
        if (next.payToken) cacheInvoiceTheme(next.payToken, theme);
        setInvoiceTheme(theme);
        applyInvoiceTheme(theme);
        setLink(next);
        setThemeReady(true);
        // Open invoice → main bot /start (welcome / language). Paid path uses result page.
        void refresh({ force: true, silent: true })
          .then(() => notifyMerchantPayOpened())
          .catch(() => {});
      } catch {
        if (!cancelled) {
          setLink(null);
          setThemeReady(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code, navigate, refresh]);

  const invoiceExpired = Boolean(link && isInvoiceExpired(link));
  const feeBearer = parseFeeBearer(link?.feeBearer);

  useEffect(() => {
    if (!themeReady || !link) return;
    if (invoiceExpired) {
      applyMerchantPayTelegramChrome("expired");
      return;
    }
    applyMerchantPayTelegramChrome(phase === "next" ? "surface" : "accent");
  }, [phase, colorScheme, invoiceExpired, invoiceTheme, themeReady, link]);

  useEffect(() => {
    let cancelled = false;
    setCardsLoading(true);
    void (async () => {
      // Upsert payer via /me (requireAuthUpsert) — first-time invoice openers get a user row.
      await refresh({ force: true, silent: true });
      if (cancelled) return;
      try {
        const data = await listBankCards();
        if (cancelled) return;
        setCards(data.cards);
        setCardId((prev) => {
          if (prev != null && data.cards.some((c) => c.id === prev)) return prev;
          const primary = data.cards.find((c) => c.isPrimary);
          return primary?.id ?? data.cards[0]?.id ?? null;
        });
      } catch {
        if (!cancelled) {
          setCards([]);
          setCardId(null);
        }
      } finally {
        if (!cancelled) setCardsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const sellLabel =
    link?.shopSellType === "services"
      ? t("myShop.regSellServices")
      : t("myShop.regSellGoods");

  const channel = link ? channelMeta(link.shopChannel, t) : null;
  const channelHref =
    link?.shopChannel === "website"
      ? link.shopSiteUrl
      : link?.shopChannel === "bot"
        ? link.shopBotUrl
        : null;
  const ChannelIcon = channel?.Icon;

  const selectedCard = useMemo(
    () => cards.find((c) => c.id === cardId) ?? null,
    [cards, cardId],
  );

  const amountToman = link?.amountToman ?? 0;
  const feeToman = merchantInvoicePayerFeeToman(amountToman, feeBearer);
  const totalToman = merchantInvoiceTotalToman(amountToman, feeBearer);

  const normalizeTgId = (value: string | number | null | undefined): string | null => {
    if (value == null || value === "") return null;
    const digits = String(value).trim().replace(/\D/g, "").replace(/^0+(?=\d)/, "");
    return digits.length >= 5 && digits.length <= 20 ? digits : null;
  };

  const lockedTo = normalizeTgId(link?.payerTelegramId ?? link?.telegramId);
  const currentTelegramId =
    normalizeTgId(user?.telegramId) ?? normalizeTgId(getTelegramUserId());
  const payerLocked = Boolean(lockedTo);
  const payerAllowed =
    !payerLocked ||
    (currentTelegramId != null && lockedTo != null && currentTelegramId === lockedTo);

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

  const onContinue = () => {
    if (loading || !link || link.status !== "open" || phase !== "intro") return;
    if (payerLocked && lockedTo) {
      const liveId =
        normalizeTgId(user?.telegramId) ?? normalizeTgId(getTelegramUserId());
      if (liveId === lockedTo) {
        haptic("medium");
        setPhase("next");
        return;
      }
      // Auth may still be hydrating — refresh once, then re-check.
      if (!liveId && typeof refresh === "function") {
        void refresh({ force: true }).then((nextUser) => {
          const after =
            normalizeTgId(nextUser?.telegramId) ??
            normalizeTgId(getTelegramUserId());
          if (after === lockedTo) {
            haptic("medium");
            setPhase("next");
            return;
          }
          haptic("heavy");
          notify(t("myShop.merchantPayPayerLocked"), "error");
        });
        return;
      }
      haptic("heavy");
      notify(t("myShop.merchantPayPayerLocked"), "error");
      return;
    }
    haptic("medium");
    setPhase("next");
  };

  const onBackToIntro = () => {
    if (phase !== "next") return;
    haptic("light");
    setCardSheetOpen(false);
    setCardAddOpen(false);
    setCardRequired(false);
    setPhase("intro");
  };

  const onCancel = () => {
    haptic("light");
    const tg = window.Telegram?.WebApp;
    if (tg?.close) {
      tg.close();
      return;
    }
    navigate("/", { replace: true });
  };

  const onCardRowClick = () => {
    haptic("light");
    setCardRequired(false);
    setCardSheetOpen(true);
  };

  const onConfirmPay = () => {
    if (phase !== "next" || !link || link.status !== "open" || submitting) return;
    if (!payerAllowed) {
      haptic("heavy");
      notify(t("myShop.merchantPayPayerLocked"), "error");
      return;
    }
    if (!selectedCard) {
      setCardRequired(true);
      setCardErrorPulse((n) => n + 1);
      haptic("heavy");
      return;
    }
    setCardRequired(false);
    haptic("medium");
    setSubmitting(true);
    void (async () => {
      try {
        const { charge } = await createMerchantPayCharge({
          payToken: link.payToken,
          cardId: selectedCard.id,
        });
        if (!charge.paymentUrl) {
          notify(t("myShop.merchantPayGatewayFailed"), "error");
          return;
        }
        openInApp(charge.paymentUrl);
      } catch (err) {
        notify(
          err instanceof Error ? err.message : t("myShop.merchantPayGatewayFailed"),
          "error",
        );
      } finally {
        setSubmitting(false);
      }
    })();
  };

  const introLeaving = phase === "next";
  const selectedVisual = selectedCard
    ? getBankVisual(selectedCard.bankSlug, selectedCard.cardNumber)
    : null;

  if (invoiceExpired && link) {
    const shopName = link.shopName?.trim() || "—";
    const shopLogo = link.shopLogoDataUrl || null;
    const shopInitial = shopName.slice(0, 1) || "—";
    return (
      <div className="mpr mpr--expired">
        <div className="mpr__hero">
          <div className="mpr__status">
            <span className="mpr__status-mark mpr__status-mark--expired">
              <ExpiredClockIcon />
            </span>
            <div className="mpr__status-copy">
              <p className="mpr__status-kicker">{t("myShop.merchantPayInvoice")}</p>
              <h1 className="mpr__status-title">
                {t("myShop.merchantPayExpiredTitle")}
              </h1>
            </div>
          </div>

          <div className="mpr__amount-block">
            <p className="mpr__amount-label">{t("myShop.merchantPayAmountLabel")}</p>
            <p className="mpr__amount-row">
              <span className="mpr__amount-value">
                {formatFaNumber(link.amountToman)}
              </span>
              <span className="mpr__amount-unit">{t("wallet.toman")}</span>
            </p>
            <p className="mpr__lead">{t("myShop.merchantPayExpiredSub")}</p>
          </div>
        </div>

        <div className="mpr__sheet">
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
                <h2 className="mpay__shop-name">{shopName}</h2>
              </div>
            </div>
          </div>

          <div className="mpr__receipt">
            <div className="mpr__row">
              <span className="mpr__key">{t("myShop.merchantPayId")}</span>
              <span className="mpr__val mpr__val--mono">{link.code || "—"}</span>
            </div>
          </div>

          <div className="mpr__actions">
            <button type="button" className="mpr__text-action" onClick={onCancel}>
              <span>{t("myShop.merchantPayResultDone")}</span>
              <ArrowIcon
                variant="bulk-rounded"
                size={23}
                color="#1a1400"
                aria-hidden
              />
            </button>
          </div>
        </div>
      </div>
    );
  }

  const bootingTheme = loading && !themeReady;

  return (
    <div
      className={`mpay${introLeaving ? " mpay--next" : ""}${bootingTheme ? " mpay--boot" : ""}`}
      aria-busy={loading || undefined}
    >
      <div className="mpay__bands" aria-hidden>
        <div className="mpay__band mpay__band--accent" />
        <div className="mpay__band mpay__band--surface" />
      </div>

      <div className="mpay__top">
        <div
          className={`mpay__intro-fade${introLeaving ? " mpay__intro-fade--out" : ""}`}
        >
          <div className="mpay__topbar">
            <button
              type="button"
              className="mpay__chip mpay__chip--icon"
              onClick={() => {
                haptic("light");
                setLangOpen(true);
              }}
              aria-label={t("settings.language")}
              disabled={introLeaving}
            >
              <LanguagesIcon
                variant="bulk-rounded"
                size={16}
                color="currentColor"
                aria-hidden
              />
            </button>
            <button
              type="button"
              className="mpay__chip mpay__chip--icon"
              onClick={() => {
                haptic("light");
                setThemeOpen(true);
              }}
              aria-label={t("settings.themePick")}
              disabled={introLeaving}
            >
              {colorScheme === "dark" ? (
                <MoonStarIcon
                  variant="bulk-rounded"
                  size={16}
                  color="currentColor"
                  aria-hidden
                />
              ) : (
                <Sun02Icon
                  variant="bulk-rounded"
                  size={16}
                  color="currentColor"
                  aria-hidden
                />
              )}
            </button>
            {loading ? (
              <span className="mpay__chip mpay__chip--id mpay__chip--skel" aria-hidden>
                <span className="mpay__skel mpay__skel--id" />
              </span>
            ) : (
              <span className="mpay__chip mpay__chip--id" title={t("myShop.merchantPayId")}>
                {link?.code ?? "—"}
              </span>
            )}
          </div>

          <div className="mpay__copy">
            <p className="mpay__hello">
              <span>{t("myShop.merchantPayHello")}</span>
              <WavingHand01Icon
                variant="bulk-rounded"
                size={32}
                color="currentColor"
                aria-hidden
              />
            </p>
            <p className="mpay__label">{t("myShop.merchantPayAmountLabel")}</p>
            <p className="mpay__amount-row">
              {loading ? (
                <>
                  <span className="mpay__skel mpay__skel--amount" aria-hidden />
                  <span className="mpay__skel mpay__skel--unit" aria-hidden />
                </>
              ) : (
                <>
                  <span className="mpay__amount-value">
                    {link ? formatFaNumber(link.amountToman) : "—"}
                  </span>
                  <span className="mpay__amount-unit">{t("wallet.toman")}</span>
                </>
              )}
            </p>
          </div>

          <div className="mpay__actions">
            <button
              type="button"
              className="mpay__text-action"
              onClick={onContinue}
              disabled={loading || !link || link.status !== "open" || introLeaving}
            >
              <span>{t("myShop.merchantPayContinue")}</span>
              <ArrowIcon variant="bulk-rounded" size={23} color={AMOUNT_COLOR} aria-hidden />
            </button>
            <div className="mpay__actions-rule" aria-hidden />
            <button
              type="button"
              className="mpay__text-action mpay__text-action--muted"
              onClick={onCancel}
              disabled={introLeaving}
            >
              <span>{t("myShop.merchantPayCancel")}</span>
              <ArrowIcon variant="bulk-rounded" size={23} color={AMOUNT_COLOR} aria-hidden />
            </button>
          </div>
        </div>

        <div
          className={`mpay__checkout${introLeaving ? " mpay__checkout--in" : ""}`}
          aria-hidden={!introLeaving}
        >
          <button
            type="button"
            className="mpay__checkout-close"
            onClick={onBackToIntro}
            aria-label={t("common.cancel")}
            tabIndex={introLeaving ? 0 : -1}
          >
            <Cancel01Icon
              variant="bulk-rounded"
              size={24}
              color="currentColor"
              aria-hidden
            />
          </button>

          <div className="mpay__checkout-block mpay__checkout-block--amount">
            <p className="mpay__checkout-kicker">{t("myShop.merchantPayDueLabel")}</p>
            <p className="mpay__checkout-amount">
              <span className="mpay__checkout-amount-value">
                {link ? formatFaNumber(link.amountToman) : "—"}
              </span>
              <span className="mpay__checkout-amount-unit">{t("wallet.toman")}</span>
            </p>
          </div>

          <div className="mpay__flow" aria-hidden>
            <span className="mpay__flow-line" />
            <span className="mpay__flow-icon">
              <ArrowDown02Icon
                variant="bulk-rounded"
                size={18}
                color="currentColor"
              />
            </span>
          </div>

          <div
            key={cardRequired ? `card-err-${cardErrorPulse}` : "card-ok"}
            className={`mpay__checkout-block mpay__checkout-block--card${
              cardRequired ? " mpay__checkout-block--card-error" : ""
            }`}
          >
            <p className="mpay__checkout-kicker">{t("myShop.merchantPayFromCard")}</p>

            {cardsLoading ? (
              <div className="mpay__card-row mpay__card-row--skel" aria-hidden>
                <span className="mpay__skel mpay__skel--card-logo" />
                <span className="mpay__card-row-copy">
                  <span className="mpay__skel mpay__skel--card-name" />
                  <span className="mpay__skel mpay__skel--card-mask" />
                </span>
              </div>
            ) : selectedCard && selectedVisual ? (
              <button
                type="button"
                className="mpay__card-row"
                onClick={onCardRowClick}
              >
                <span
                  className="mpay__card-logo"
                  style={{
                    background: `color-mix(in srgb, ${selectedVisual.color1} 18%, var(--surface))`,
                  }}
                >
                  <img
                    src={selectedVisual.iconSrc}
                    alt=""
                    width={28}
                    height={28}
                    onError={(event) => {
                      event.currentTarget.src = "/banks/unknown.svg";
                    }}
                  />
                </span>
                <span className="mpay__card-row-copy">
                  <span className="mpay__card-bank">
                    {cardDisplayName(selectedCard, locale)}
                  </span>
                  <span className="mpay__card-mask">
                    {cardMaskTail(selectedCard)}
                  </span>
                </span>
                <ArrowLeft02Icon
                  variant="bulk-rounded"
                  size={20}
                  color="currentColor"
                  aria-hidden
                />
              </button>
            ) : (
              <button
                type="button"
                className="mpay__card-row mpay__card-row--empty"
                onClick={onCardRowClick}
              >
                <span className="mpay__card-row-copy">
                  <span className="mpay__card-bank">{t("myShop.merchantPayNoCard")}</span>
                  <span className="mpay__card-mask">{t("myShop.merchantPayAddCard")}</span>
                </span>
                <ArrowLeft02Icon
                  variant="bulk-rounded"
                  size={20}
                  color="currentColor"
                  aria-hidden
                />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="mpay__bottom">
        <div
          className={`mpay__intro-fade${introLeaving ? " mpay__intro-fade--out" : ""}`}
        >
          {loading ? (
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
          ) : link && channel && ChannelIcon ? (
            <div className="mpay__shop">
              <div className="mpay__shop-head">
                <span className="mpay__shop-avatar" aria-hidden>
                  {link.shopLogoDataUrl ? (
                    <img
                      src={link.shopLogoDataUrl}
                      alt=""
                      width={58}
                      height={58}
                      decoding="async"
                    />
                  ) : (
                    <span className="mpay__shop-avatar-fallback">
                      {link.shopName.slice(0, 1)}
                    </span>
                  )}
                </span>
                <div className="mpay__shop-title">
                  <p className="mpay__shop-kicker">{t("myShop.merchantPayShopLabel")}</p>
                  <h2 className="mpay__shop-name">{link.shopName}</h2>
                </div>
                {channelHref ? (
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
                )}
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
                  <span className="mpay__shop-fact-value">{channel.label}</span>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div
          className={`mpay__summary${introLeaving ? " mpay__summary--in" : ""}`}
          aria-hidden={!introLeaving}
        >
          <div className="mpay__summary-main">
            <div className="mpay__summary-rows">
              <div className="mpay__summary-row">
                <span className="mpay__summary-label">
                  {t("myShop.merchantPayTxAmount")}
                </span>
                <span className="mpay__summary-value">
                  <span className="mpay__summary-num">
                    {link ? formatFaNumber(amountToman) : "—"}
                  </span>
                  <span className="mpay__summary-unit">{t("wallet.toman")}</span>
                </span>
              </div>
              <div className="mpay__summary-row">
                <span className="mpay__summary-label">
                  {t("myShop.merchantPayTxFee")}
                </span>
                <span className="mpay__summary-value">
                  <span className="mpay__summary-num">
                    {link ? formatFaNumber(feeToman) : "—"}
                  </span>
                  <span className="mpay__summary-unit">{t("wallet.toman")}</span>
                </span>
              </div>
              <div className="mpay__summary-row">
                <span className="mpay__summary-label">
                  {t("myShop.merchantPayTxTotal")}
                </span>
                <span className="mpay__summary-value mpay__summary-value--strong">
                  <span className="mpay__summary-num">
                    {link ? formatFaNumber(totalToman) : "—"}
                  </span>
                  <span className="mpay__summary-unit">{t("wallet.toman")}</span>
                </span>
              </div>
            </div>

            <div className="mpay__summary-mid" aria-hidden>
              <div className="mpay__summary-rule" />
            </div>
          </div>

          <div className="mpay__summary-action">
            <button
              type="button"
              className="mpay__summary-confirm"
              onClick={onConfirmPay}
              disabled={
                !introLeaving ||
                !link ||
                link.status !== "open" ||
                submitting
              }
              tabIndex={introLeaving ? 0 : -1}
            >
              <span>
                {submitting
                  ? t("myShop.merchantPayConfirmPending")
                  : t("myShop.merchantPayConfirm")}
              </span>
              <ArrowIcon
                variant="bulk-rounded"
                size={32}
                color={AMOUNT_COLOR}
                aria-hidden
              />
            </button>
          </div>

          <p className="mpay__summary-disclaimer">
            {t("myShop.merchantPayConfirmHint")}
          </p>
        </div>
      </div>

      <FlatSelectModal
        open={langOpen}
        onClose={() => setLangOpen(false)}
        title={t("settings.languagePick")}
        options={LOCALES.map((item) => ({
          value: item.code,
          label: item.nativeName,
        }))}
        selectedValue={locale}
        onSelect={(value) => {
          haptic("light");
          setLocale(value as LocaleCode);
        }}
      />

      <FlatSelectModal
        open={themeOpen}
        onClose={() => setThemeOpen(false)}
        title={t("settings.themePick")}
        options={[
          {
            value: "auto",
            label: t("settings.themeValue.auto"),
            icon: (
              <AiAutoRotateIcon
                variant="bulk-rounded"
                size={22}
                color="currentColor"
              />
            ),
          },
          {
            value: "light",
            label: t("settings.themeValue.light"),
            icon: (
              <Sun02Icon variant="bulk-rounded" size={22} color="currentColor" />
            ),
          },
          {
            value: "dark",
            label: t("settings.themeValue.dark"),
            icon: (
              <MoonStarIcon variant="bulk-rounded" size={22} color="currentColor" />
            ),
          },
        ]}
        selectedValue={themeMode}
        onSelect={(value) => {
          haptic("light");
          setThemeMode(value as ThemeMode);
        }}
      />

      <BankCardPickerModal
        open={cardSheetOpen}
        onClose={() => setCardSheetOpen(false)}
        cards={cards}
        selectedId={cardId}
        onSelect={(id) => {
          haptic("light");
          setCardId(id);
          setCardRequired(false);
          setCardSheetOpen(false);
        }}
        onAddCard={() => {
          haptic("light");
          setCardSheetOpen(false);
          setCardAddOpen(true);
        }}
      />

      <BankCardAddModal
        open={cardAddOpen}
        onClose={() => setCardAddOpen(false)}
        invoiceAmountToman={link?.amountToman ?? null}
        onSaved={(card) => {
          setCards((prev) => {
            if (prev.some((item) => item.id === card.id)) return prev;
            return [card, ...prev];
          });
          setCardId(card.id);
          setCardRequired(false);
        }}
      />
    </div>
  );
}
