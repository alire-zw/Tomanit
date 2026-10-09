import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type CSSProperties,
  type UIEvent,
} from "react";
import { useNavigate } from "react-router-dom";
import { NumeralKeypad } from "../../components/NumeralKeypad";
import { useNotification } from "../../components/Notification";
import { PageHeader } from "../../components/PageHeader";
import BankCardIcon from "../../components/icons/BankCardIcon";
import IdIcon from "../../components/icons/IdIcon";
import IdNotVerifiedIcon from "../../components/icons/id-not-verified-stroke-rounded";
import IdVerifiedIcon from "../../components/icons/id-verified-stroke-rounded";
import { useI18n } from "../../context/I18nContext";
import { useAuth } from "../../hooks/useAuth";
import { useRelockScrollWhileOpen } from "../../hooks/useRelockScrollWhileOpen";
import { useTelegram } from "../../hooks/useTelegram";
import { getTermsContent, type TermsBullet } from "../../i18n/termsContent";
import { apiFetch, ApiError, type MeResponse } from "../../lib/api";
import { detectBankFromCardDigits } from "../../lib/bankDetect";
import {
  appendCardDigit,
  formatCardNumberFa,
  isValidCardNumberLength,
  removeLastCardDigit,
} from "../../lib/card";
import { readDepositGatewayPending } from "../../lib/depositPending";
import {
  appendBirthDigit,
  appendNationalIdDigit,
  formatBirthDateFa,
  formatBirthDateInput,
  formatNationalIdFa,
  getBirthDateError,
  getNationalIdError,
  isValidIranNationalId,
  isValidJalaliBirthInput,
  removeLastBirthDigit,
  removeLastNationalIdDigit,
} from "../../lib/identity";
import { needsDepositKyc } from "../../lib/kycGate";
import {
  clearKycDraft,
  hasAcceptedKycTerms,
  KYC_TERMS_ACCEPTED_KEY,
  readKycDraft,
  writeKycDraft,
} from "../../lib/kycDraft";
import { lockAppScroll, unlockAppScroll } from "../../lib/scrollLock";
import "../../styles/shop-rise.css";
import "./WalletDepositKyc.css";

type WizardStep = "terms" | "identity" | "card" | "review";
type IdentitySubStep = "nationalId" | "birthDate";
type CheckStatus = "idle" | "pending" | "success" | "error";
type ReviewPhase = "checking" | "collapsing" | "complete";

type KycVerifyResponse = MeResponse & {
  ok: true;
  card?: {
    last4: string;
    iban: string | null;
    bankName: string | null;
    ownerName: string | null;
  };
};

type ReviewCheck = {
  id: "identity" | "card";
  titleKey: "verify.checkIdentity" | "verify.checkCard";
  status: CheckStatus;
  Icon: ComponentType<{ width?: number; height?: number; color?: string }>;
};

const SCROLL_BOTTOM_THRESHOLD_PX = 28;
const COLLAPSE_MS = 520;
const GATEWAY_RETURN = "/wallet/deposit/gateway";

function statusKey(status: CheckStatus): string {
  if (status === "success") return "verify.statusApproved";
  if (status === "error") return "verify.statusFailed";
  if (status === "idle") return "verify.statusWaiting";
  return "verify.statusChecking";
}

function renderBullet(item: TermsBullet, index: number) {
  if (typeof item === "string") {
    return <li key={index}>{item}</li>;
  }
  return (
    <li key={index}>
      <strong>{item.strong}</strong> {item.text}
    </li>
  );
}

function initialWizardStep(): WizardStep {
  return hasAcceptedKycTerms() ? "identity" : "terms";
}

export function WalletDepositKycPage() {
  const navigate = useNavigate();
  const { haptic } = useTelegram();
  const { notify } = useNotification();
  const { user, applyUser } = useAuth();
  const { t, locale } = useI18n();
  const terms = getTermsContent(locale);
  const draft = readKycDraft();

  const [step, setStep] = useState<WizardStep>(initialWizardStep);
  const [identitySub, setIdentitySub] = useState<IdentitySubStep>("nationalId");
  const [nationalId, setNationalId] = useState(draft.nationalId ?? "");
  const [birthDigits, setBirthDigits] = useState(() =>
    (draft.birthDate ?? "").replace(/\D/g, "").slice(0, 8),
  );
  const [cardDigits, setCardDigits] = useState(() => draft.cardDigits ?? "");
  const [hasReachedBottom, setHasReachedBottom] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [phase, setPhase] = useState<ReviewPhase>("checking");
  const [checks, setChecks] = useState<ReviewCheck[]>([
    {
      id: "identity",
      titleKey: "verify.checkIdentity",
      status: "pending",
      Icon: IdIcon,
    },
    {
      id: "card",
      titleKey: "verify.checkCard",
      status: "idle",
      Icon: BankCardIcon,
    },
  ]);
  const [reviewStarted, setReviewStarted] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const applyUserRef = useRef(applyUser);
  const notifyRef = useRef(notify);
  const tRef = useRef(t);
  applyUserRef.current = applyUser;
  notifyRef.current = notify;
  tRef.current = t;

  useEffect(() => {
    lockAppScroll();
    return () => unlockAppScroll();
  }, []);

  useRelockScrollWhileOpen(true);

  useEffect(() => {
    if (!needsDepositKyc(user)) {
      const pending = readDepositGatewayPending();
      navigate(GATEWAY_RETURN, {
        replace: true,
        state: {
          amountDigits: pending?.amountDigits ?? "",
          step: "card",
          kycDone: true,
        },
      });
    }
  }, [navigate, user]);

  const birthDate = useMemo(() => formatBirthDateInput(birthDigits), [birthDigits]);
  const nationalIdError = useMemo(
    () => (getNationalIdError(nationalId) ? t("verify.nationalIdInvalid") : null),
    [nationalId, t],
  );
  const birthDateError = useMemo(
    () => (getBirthDateError(birthDate) ? t("verify.birthDateInvalid") : null),
    [birthDate, t],
  );
  const cardDisplay = useMemo(() => formatCardNumberFa(cardDigits), [cardDigits]);
  const detectedBank = useMemo(() => {
    const bank = detectBankFromCardDigits(cardDigits);
    if (!bank || bank.slug === "unknown") return null;
    return bank;
  }, [cardDigits]);
  const bankLabel = detectedBank
    ? locale === "fa"
      ? detectedBank.nameFa
      : detectedBank.nameEn
    : null;

  const returnToGatewayAmount = useCallback(() => {
    const pending = readDepositGatewayPending();
    navigate(GATEWAY_RETURN, {
      replace: true,
      state: {
        amountDigits: pending?.amountDigits ?? "",
        step: "amount",
      },
    });
  }, [navigate]);

  const continueToPayment = useCallback(() => {
    const pending = readDepositGatewayPending();
    haptic("light");
    navigate(GATEWAY_RETURN, {
      replace: true,
      state: {
        amountDigits: pending?.amountDigits ?? "",
        step: "card",
        kycDone: true,
      },
    });
  }, [haptic, navigate]);

  const handleBack = useCallback(() => {
    if (step === "review") {
      if (checks.some((check) => check.status === "pending")) return;
      if (phase === "complete") {
        continueToPayment();
        return;
      }
      setReviewStarted(false);
      setPhase("checking");
      setChecks([
        {
          id: "identity",
          titleKey: "verify.checkIdentity",
          status: "pending",
          Icon: IdIcon,
        },
        {
          id: "card",
          titleKey: "verify.checkCard",
          status: "idle",
          Icon: BankCardIcon,
        },
      ]);
      setStep("card");
      return;
    }
    if (step === "card") {
      haptic("light");
      setStep("identity");
      setIdentitySub("birthDate");
      return;
    }
    if (step === "identity") {
      if (identitySub === "birthDate") {
        haptic("light");
        setIdentitySub("nationalId");
        return;
      }
      if (hasAcceptedKycTerms()) {
        returnToGatewayAmount();
        return;
      }
      haptic("light");
      setStep("terms");
      return;
    }
    returnToGatewayAmount();
  }, [
    checks,
    continueToPayment,
    haptic,
    identitySub,
    phase,
    returnToGatewayAmount,
    step,
  ]);

  const checkScrollPosition = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollHeight <= el.clientHeight + SCROLL_BOTTOM_THRESHOLD_PX) {
      setHasReachedBottom(true);
      return;
    }
    const remaining = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (remaining <= SCROLL_BOTTOM_THRESHOLD_PX) {
      setHasReachedBottom(true);
    }
  }, []);

  useEffect(() => {
    if (step !== "terms") return;
    setHasReachedBottom(false);
    checkScrollPosition();
    const el = scrollRef.current;
    if (!el) return;
    const resizeObserver = new ResizeObserver(() => checkScrollPosition());
    resizeObserver.observe(el);
    return () => resizeObserver.disconnect();
  }, [checkScrollPosition, locale, step]);

  const handleTermsScroll = (event: UIEvent<HTMLDivElement>) => {
    const el = event.currentTarget;
    const remaining = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (remaining <= SCROLL_BOTTOM_THRESHOLD_PX) {
      setHasReachedBottom(true);
    }
  };

  const acceptTerms = () => {
    if (!hasReachedBottom || isSubmitting) return;
    haptic("light");
    setIsSubmitting(true);
    try {
      localStorage.setItem(KYC_TERMS_ACCEPTED_KEY, new Date().toISOString());
      setStep("identity");
      setIdentitySub("nationalId");
    } finally {
      setIsSubmitting(false);
    }
  };

  const continueIdentity = () => {
    if (identitySub === "nationalId") {
      if (!isValidIranNationalId(nationalId)) return;
      haptic("light");
      setIdentitySub("birthDate");
      return;
    }
    if (!isValidJalaliBirthInput(birthDate) || isSubmitting) return;
    haptic("light");
    setIsSubmitting(true);
    try {
      writeKycDraft({ nationalId, birthDate });
      setStep("card");
    } finally {
      setIsSubmitting(false);
    }
  };

  const continueCard = () => {
    if (!isValidCardNumberLength(cardDigits)) return;
    haptic("light");
    writeKycDraft({
      nationalId,
      birthDate,
      cardDigits,
      bankName: detectedBank?.nameFa ?? null,
      bankSlug: detectedBank?.slug ?? null,
    });
    setReviewStarted(false);
    setPhase("checking");
    setChecks([
      {
        id: "identity",
        titleKey: "verify.checkIdentity",
        status: "pending",
        Icon: IdIcon,
      },
      {
        id: "card",
        titleKey: "verify.checkCard",
        status: "idle",
        Icon: BankCardIcon,
      },
    ]);
    setStep("review");
  };

  const setCheckStatus = useCallback((id: ReviewCheck["id"], status: CheckStatus) => {
    setChecks((current) =>
      current.map((check) => (check.id === id ? { ...check, status } : check)),
    );
  }, []);

  const allPassed = checks.every((check) => check.status === "success");
  const canContinueReview = phase === "complete";
  const hasReviewError = checks.some((check) => check.status === "error");

  useEffect(() => {
    if (step !== "review") return;
    if (!allPassed || phase === "complete") return;
    setPhase("collapsing");
    const timer = window.setTimeout(() => {
      setPhase("complete");
      haptic("medium");
    }, COLLAPSE_MS);
    return () => window.clearTimeout(timer);
  }, [allPassed, haptic, phase, step]);

  useEffect(() => {
    if (step !== "review" || reviewStarted) return;
    if (!nationalId || !birthDate || cardDigits.length !== 16) {
      setStep("card");
      return;
    }
    setReviewStarted(true);
    writeKycDraft({ nationalId, birthDate, cardDigits });

    let cancelled = false;
    const run = async () => {
      try {
        await new Promise((resolve) => window.setTimeout(resolve, 480));
        if (cancelled) return;
        setCheckStatus("identity", "success");
        setCheckStatus("card", "pending");

        const data = await apiFetch<KycVerifyResponse>("/kyc/verify", {
          method: "POST",
          body: {
            nationalId,
            birthDate,
            cardNumber: cardDigits,
          },
        });
        if (cancelled) return;

        applyUserRef.current(data.user, data.wallet);
        clearKycDraft();
        setCheckStatus("card", "success");
      } catch (error) {
        if (cancelled) return;
        const message =
          error instanceof ApiError
            ? error.message
            : error instanceof Error
              ? error.message
              : tRef.current("verify.reviewFailed");

        setChecks((current) => {
          const next = [...current];
          const activeIndex = next.findIndex(
            (check) => check.status === "pending" || check.status === "idle",
          );
          if (activeIndex >= 0) {
            next[activeIndex] = { ...next[activeIndex], status: "error" };
          }
          return next;
        });
        notifyRef.current(message, "error");
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [
    birthDate,
    cardDigits,
    nationalId,
    reviewStarted,
    setCheckStatus,
    step,
  ]);

  const headerTitle =
    step === "terms"
      ? t("verify.termsTitle")
      : step === "identity"
        ? t("verify.identityTitle")
        : step === "card"
          ? t("verify.cardNumber")
          : t("verify.reviewTitle");

  const stepAction =
    step === "identity" ? (
      <span className="page-header__step">
        {t("verify.stepOf", { current: 1, total: 2 })}
      </span>
    ) : step === "card" ? (
      <span className="page-header__step">
        {t("verify.stepOf", { current: 2, total: 2 })}
      </span>
    ) : undefined;

  if (needsDepositKyc(user) === false) {
    return null;
  }

  return (
    <div className="deposit-kyc">
      <div className="shop-rise" style={{ "--rise-index": 0 } as CSSProperties}>
        <PageHeader title={headerTitle} onBack={handleBack} action={stepAction} />
      </div>

      {step === "terms" ? (
        <>
          <div className="deposit-kyc__body">
            <div className="deposit-kyc__terms-wrap">
              <div
                ref={scrollRef}
                className="deposit-kyc__terms-scroll shop-rise"
                style={{ "--rise-index": 1 } as CSSProperties}
                onScroll={handleTermsScroll}
              >
                <article className="deposit-kyc__terms-article">
                  <h2 className="deposit-kyc__heading">{terms.docTitle}</h2>
                  <p className="deposit-kyc__terms-meta">{terms.lastUpdated}</p>

                  {terms.sections.map((section, sectionIndex) => (
                    <div key={sectionIndex}>
                      {section.title ? (
                        <h2
                          className={`deposit-kyc__heading${
                            section.danger ? " deposit-kyc__heading--danger" : ""
                          }`}
                        >
                          {section.title}
                        </h2>
                      ) : null}

                      {section.paragraphs?.map((paragraph, paragraphIndex) => (
                        <p
                          key={`p-${paragraphIndex}`}
                          className={section.danger ? "deposit-kyc__danger-text" : undefined}
                        >
                          {paragraph}
                        </p>
                      ))}

                      {section.bullets?.length ? (
                        <ul className="deposit-kyc__list">
                          {section.bullets.map((item, bulletIndex) =>
                            renderBullet(item, bulletIndex),
                          )}
                        </ul>
                      ) : null}

                      {section.table ? (
                        <div className="deposit-kyc__limits">
                          <table className="deposit-kyc__table">
                            <thead>
                              <tr>
                                {section.table.headers.map((header) => (
                                  <th key={header} scope="col">
                                    {header}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {section.table.rows.map((row) => (
                                <tr key={row.level}>
                                  <td>{row.level}</td>
                                  <td>
                                    <span className="deposit-kyc__amount">{row.amount}</span>
                                    <span className="deposit-kyc__unit">{row.unit}</span>
                                  </td>
                                  {row.monthly != null ? (
                                    <td>
                                      <span className="deposit-kyc__amount">{row.monthly}</span>
                                      <span className="deposit-kyc__unit">{row.unit}</span>
                                    </td>
                                  ) : null}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : null}

                      {section.paragraphsAfter?.map((paragraph, paragraphIndex) => (
                        <p
                          key={`pa-${paragraphIndex}`}
                          className={section.danger ? "deposit-kyc__danger-text" : undefined}
                        >
                          {paragraph}
                        </p>
                      ))}
                    </div>
                  ))}

                  <p className="deposit-kyc__end">{terms.endNote}</p>
                </article>
              </div>
              {!hasReachedBottom ? <div className="deposit-kyc__fade" aria-hidden /> : null}
            </div>
          </div>
          <footer
            className="deposit-kyc__footer shop-rise"
            style={{ "--rise-index": 2 } as CSSProperties}
          >
            {!hasReachedBottom ? (
              <p className="deposit-kyc__scroll-hint">{t("verify.scrollHint")}</p>
            ) : null}
            <button
              type="button"
              className="deposit-kyc__continue"
              disabled={!hasReachedBottom || isSubmitting}
              onClick={acceptTerms}
            >
              {isSubmitting ? t("verify.acceptSubmitting") : t("verify.acceptTerms")}
            </button>
          </footer>
        </>
      ) : null}

      {step === "identity" ? (
        <>
          <div className="deposit-kyc__body">
            <section
              className="deposit-kyc__notice shop-rise"
              style={{ "--rise-index": 1 } as CSSProperties}
            >
              <p className="deposit-kyc__notice-text">{t("verify.identityNotice")}</p>
            </section>

            <section
              className="deposit-kyc__stack shop-rise"
              style={{ "--rise-index": 2 } as CSSProperties}
              aria-label={t("verify.reqIdentity")}
            >
              <button
                type="button"
                className={`deposit-kyc__block${
                  identitySub === "nationalId"
                    ? " deposit-kyc__block--active"
                    : " deposit-kyc__block--compact"
                }`}
                onClick={() => {
                  if (identitySub !== "nationalId") {
                    haptic("light");
                    setIdentitySub("nationalId");
                  }
                }}
              >
                <p className="deposit-kyc__label">{t("verify.nationalId")}</p>
                <span
                  className={`deposit-kyc__value${
                    nationalId ? "" : " deposit-kyc__value--placeholder"
                  }`}
                  dir="ltr"
                >
                  {formatNationalIdFa(nationalId)}
                </span>
              </button>

              <div
                className={`deposit-kyc__block${
                  identitySub === "birthDate"
                    ? " deposit-kyc__block--active"
                    : " deposit-kyc__block--compact"
                }`}
              >
                <p className="deposit-kyc__label">{t("verify.birthDate")}</p>
                <span
                  className={`deposit-kyc__value${
                    birthDigits ? "" : " deposit-kyc__value--placeholder"
                  }`}
                  dir="ltr"
                >
                  {formatBirthDateFa(birthDigits)}
                </span>
              </div>

              {(identitySub === "nationalId" ? nationalIdError : birthDateError) ? (
                <p className="deposit-kyc__error" role="alert">
                  {identitySub === "nationalId" ? nationalIdError : birthDateError}
                </p>
              ) : null}
            </section>

            <div
              className="deposit-kyc__keypad shop-rise"
              style={{ "--rise-index": 3 } as CSSProperties}
            >
              <NumeralKeypad
                onDigit={(digit) => {
                  if (isSubmitting) return;
                  if (identitySub === "nationalId") {
                    setNationalId((current) => appendNationalIdDigit(current, digit));
                    return;
                  }
                  setBirthDigits((current) => appendBirthDigit(current, digit));
                }}
                onBackspace={() => {
                  if (isSubmitting) return;
                  if (identitySub === "nationalId") {
                    setNationalId((current) => removeLastNationalIdDigit(current));
                    return;
                  }
                  setBirthDigits((current) => removeLastBirthDigit(current));
                }}
              />
            </div>
          </div>
          <footer
            className="deposit-kyc__footer shop-rise"
            style={{ "--rise-index": 4 } as CSSProperties}
          >
            <button
              type="button"
              className="deposit-kyc__continue"
              disabled={
                identitySub === "nationalId"
                  ? !isValidIranNationalId(nationalId)
                  : !isValidJalaliBirthInput(birthDate) || isSubmitting
              }
              onClick={continueIdentity}
            >
              {identitySub === "nationalId"
                ? t("common.continue")
                : isSubmitting
                  ? t("verify.acceptSubmitting")
                  : t("verify.confirmContinue")}
            </button>
          </footer>
        </>
      ) : null}

      {step === "card" ? (
        <>
          <div className="deposit-kyc__body">
            <section
              className="deposit-kyc__notice shop-rise"
              style={{ "--rise-index": 1 } as CSSProperties}
            >
              <p className="deposit-kyc__notice-text">{t("verify.cardNotice")}</p>
            </section>

            <section
              className="deposit-kyc__field shop-rise"
              style={{ "--rise-index": 2 } as CSSProperties}
              aria-label={t("verify.cardNumber")}
            >
              <p className="deposit-kyc__label">{t("verify.cardNumber")}</p>
              <div className="deposit-kyc__value-row">
                <span
                  className={`deposit-kyc__value${
                    cardDigits ? "" : " deposit-kyc__value--placeholder"
                  }`}
                  dir="ltr"
                >
                  {cardDisplay}
                </span>
              </div>
              <div
                className={`deposit-kyc__bank${detectedBank ? " deposit-kyc__bank--visible" : ""}`}
                aria-live="polite"
              >
                {detectedBank ? (
                  <>
                    <img
                      className="deposit-kyc__bank-icon"
                      src={detectedBank.iconSrc}
                      alt=""
                      width={18}
                      height={18}
                    />
                    <span className="deposit-kyc__bank-name">{bankLabel}</span>
                  </>
                ) : null}
              </div>
            </section>

            <div
              className="deposit-kyc__keypad shop-rise"
              style={{ "--rise-index": 3 } as CSSProperties}
            >
              <NumeralKeypad
                onDigit={(digit) => {
                  setCardDigits((current) => appendCardDigit(current, digit));
                }}
                onBackspace={() => {
                  setCardDigits((current) => removeLastCardDigit(current));
                }}
              />
            </div>
          </div>
          <footer
            className="deposit-kyc__footer shop-rise"
            style={{ "--rise-index": 4 } as CSSProperties}
          >
            <button
              type="button"
              className="deposit-kyc__continue"
              disabled={!isValidCardNumberLength(cardDigits)}
              onClick={continueCard}
            >
              {t("verify.continueReview")}
            </button>
          </footer>
        </>
      ) : null}

      {step === "review" ? (
        <>
          <div className="deposit-kyc__content">
            {phase !== "complete" ? (
              <>
                <h2
                  className={`deposit-kyc__section-title shop-rise${
                    phase === "collapsing" ? " deposit-kyc__section-title--fade" : ""
                  }`}
                  style={{ "--rise-index": 1 } as CSSProperties}
                >
                  {t("verify.checksStatus")}
                </h2>

                <section
                  className={`deposit-kyc__checks shop-rise${
                    phase === "collapsing" ? " deposit-kyc__checks--collapsing" : ""
                  }`}
                  style={{ "--rise-index": 2 } as CSSProperties}
                  aria-label={t("verify.checksStatus")}
                >
                  {checks.map((check, index) => {
                    const { Icon } = check;
                    return (
                      <div
                        key={check.id}
                        className={`deposit-kyc__check deposit-kyc__check--${check.status}`}
                        style={{ "--check-index": index } as CSSProperties}
                      >
                        <span className="deposit-kyc__check-icon" aria-hidden>
                          <Icon width={18} height={18} />
                        </span>
                        <div className="deposit-kyc__check-text">
                          <span className="deposit-kyc__check-title">
                            {t(check.titleKey)}
                          </span>
                          <span className="deposit-kyc__check-status">
                            {t(statusKey(check.status))}
                          </span>
                        </div>
                        <span className="deposit-kyc__check-indicator" aria-hidden>
                          {check.status === "pending" ? (
                            <span className="deposit-kyc__pulse-dot" />
                          ) : check.status === "success" ? (
                            <IdVerifiedIcon width={20} height={20} />
                          ) : check.status === "error" ? (
                            <IdNotVerifiedIcon width={20} height={20} />
                          ) : (
                            <span className="deposit-kyc__idle-dot" />
                          )}
                        </span>
                      </div>
                    );
                  })}
                </section>
              </>
            ) : (
              <section
                className="deposit-kyc__done shop-rise"
                style={{ "--rise-index": 1 } as CSSProperties}
                aria-live="polite"
              >
                <span className="deposit-kyc__done-icon" aria-hidden>
                  <IdVerifiedIcon width={28} height={28} />
                </span>
                <p className="deposit-kyc__done-title">{t("verify.reviewSuccess")}</p>
                <p className="deposit-kyc__done-text">
                  {t("wallet.depositKycSuccessText")}
                </p>
              </section>
            )}
          </div>

          <footer
            className="deposit-kyc__footer shop-rise"
            style={{ "--rise-index": 3 } as CSSProperties}
          >
            {hasReviewError && phase !== "complete" ? (
              <button
                type="button"
                className="deposit-kyc__continue"
                onClick={() => {
                  haptic("light");
                  setReviewStarted(false);
                  setPhase("checking");
                  setChecks([
                    {
                      id: "identity",
                      titleKey: "verify.checkIdentity",
                      status: "pending",
                      Icon: IdIcon,
                    },
                    {
                      id: "card",
                      titleKey: "verify.checkCard",
                      status: "idle",
                      Icon: BankCardIcon,
                    },
                  ]);
                  setStep("card");
                }}
              >
                {t("verify.editInfo")}
              </button>
            ) : (
              <button
                type="button"
                className="deposit-kyc__continue"
                onClick={continueToPayment}
                disabled={!canContinueReview}
              >
                {t("wallet.depositKycContinuePay")}
              </button>
            )}
          </footer>
        </>
      ) : null}
    </div>
  );
}
