import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { NumeralKeypad } from "../../components/NumeralKeypad";
import { PageHeader } from "../../components/PageHeader";
import { useI18n } from "../../context/I18nContext";
import { useTelegram } from "../../hooks/useTelegram";
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
import { hasAcceptedKycTerms, readKycDraft, writeKycDraft } from "../../lib/kycDraft";
import { lockAppScroll, unlockAppScroll } from "../../lib/scrollLock";
import { useRelockScrollWhileOpen } from "../../hooks/useRelockScrollWhileOpen";
import "../../styles/shop-rise.css";
import "./ProfileVerifyIdentity.css";

type IdentityStep = "nationalId" | "birthDate";

export function ProfileVerifyIdentityPage() {
  const navigate = useNavigate();
  const { haptic } = useTelegram();
  const { t } = useI18n();
  const draft = readKycDraft();

  const [step, setStep] = useState<IdentityStep>("nationalId");
  const [nationalId, setNationalId] = useState(draft.nationalId ?? "");
  const [birthDigits, setBirthDigits] = useState(() =>
    (draft.birthDate ?? "").replace(/\D/g, "").slice(0, 8),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!hasAcceptedKycTerms()) {
      navigate("/profile/verify/terms", { replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    lockAppScroll();
    return () => unlockAppScroll();
  }, []);

  useRelockScrollWhileOpen(true);

  const handleBack = useCallback(() => {
    if (step === "birthDate") {
      haptic("light");
      setStep("nationalId");
      return;
    }
    navigate("/profile/verify/terms");
  }, [haptic, navigate, step]);

  const birthDate = useMemo(() => formatBirthDateInput(birthDigits), [birthDigits]);
  const nationalIdError = useMemo(
    () => (getNationalIdError(nationalId) ? t("verify.nationalIdInvalid") : null),
    [nationalId, t],
  );
  const birthDateError = useMemo(
    () => (getBirthDateError(birthDate) ? t("verify.birthDateInvalid") : null),
    [birthDate, t],
  );

  const canContinueNational = isValidIranNationalId(nationalId);
  const canContinueBirth = isValidJalaliBirthInput(birthDate) && !isSubmitting;

  const handleContinue = () => {
    if (step === "nationalId") {
      if (!canContinueNational) return;
      haptic("light");
      setStep("birthDate");
      return;
    }

    if (!canContinueBirth) return;
    haptic("light");
    setIsSubmitting(true);
    try {
      writeKycDraft({ nationalId, birthDate });
      navigate("/profile/verify/card", {
        replace: true,
        state: { nationalId, birthDate },
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDigit = (digit: string) => {
    if (isSubmitting) return;
    if (step === "nationalId") {
      setNationalId((current) => appendNationalIdDigit(current, digit));
      return;
    }
    setBirthDigits((current) => appendBirthDigit(current, digit));
  };

  const handleBackspace = () => {
    if (isSubmitting) return;
    if (step === "nationalId") {
      setNationalId((current) => removeLastNationalIdDigit(current));
      return;
    }
    setBirthDigits((current) => removeLastBirthDigit(current));
  };

  if (!hasAcceptedKycTerms()) return null;

  const nationalDisplay = formatNationalIdFa(nationalId);
  const birthDisplay = formatBirthDateFa(birthDigits);
  const activeError = step === "nationalId" ? nationalIdError : birthDateError;
  const continueDisabled = step === "nationalId" ? !canContinueNational : !canContinueBirth;
  const continueLabel =
    step === "nationalId"
      ? t("common.continue")
      : isSubmitting
        ? t("verify.acceptSubmitting")
        : t("verify.confirmContinue");

  return (
    <div className="verify-identity">
      <div className="shop-rise" style={{ "--rise-index": 0 } as CSSProperties}>
        <PageHeader
          title={t("verify.identityTitle")}
          onBack={handleBack}
          action={
            <span className="page-header__step">
              {t("verify.stepOf", { current: 1, total: 2 })}
            </span>
          }
        />
      </div>

      <div className="verify-identity__body">
        <section
          className="verify-identity__notice shop-rise"
          style={{ "--rise-index": 1 } as CSSProperties}
        >
          <p className="verify-identity__notice-text">{t("verify.identityNotice")}</p>
        </section>

        <section
          className="verify-identity__stack shop-rise"
          style={{ "--rise-index": 2 } as CSSProperties}
          aria-label={t("verify.reqIdentity")}
        >
          <button
            type="button"
            className={`verify-identity__block${
              step === "nationalId"
                ? " verify-identity__block--active"
                : " verify-identity__block--compact"
            }`}
            onClick={() => {
              if (step !== "nationalId") {
                haptic("light");
                setStep("nationalId");
              }
            }}
          >
            <p className="verify-identity__label">{t("verify.nationalId")}</p>
            <span
              className={`verify-identity__value${
                nationalId ? "" : " verify-identity__value--placeholder"
              }`}
              dir="ltr"
            >
              {nationalDisplay}
            </span>
          </button>

          <div
            className={`verify-identity__block${
              step === "birthDate"
                ? " verify-identity__block--active"
                : " verify-identity__block--compact"
            }`}
          >
            <p className="verify-identity__label">{t("verify.birthDate")}</p>
            <span
              className={`verify-identity__value${
                birthDigits ? "" : " verify-identity__value--placeholder"
              }`}
              dir="ltr"
            >
              {birthDisplay}
            </span>
          </div>

          {activeError ? (
            <p className="verify-identity__error" role="alert">
              {activeError}
            </p>
          ) : null}
        </section>

        <div
          className="verify-identity__keypad shop-rise"
          style={{ "--rise-index": 3 } as CSSProperties}
        >
          <NumeralKeypad onDigit={handleDigit} onBackspace={handleBackspace} />
        </div>
      </div>

      <footer
        className="verify-identity__footer shop-rise"
        style={{ "--rise-index": 4 } as CSSProperties}
      >
        <button
          type="button"
          className="verify-identity__continue"
          disabled={continueDisabled}
          onClick={handleContinue}
        >
          {continueLabel}
        </button>
      </footer>
    </div>
  );
}
