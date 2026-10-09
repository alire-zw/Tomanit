import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { NumeralKeypad } from "../../components/NumeralKeypad";
import { PageHeader } from "../../components/PageHeader";
import { useI18n } from "../../context/I18nContext";
import { useTelegram } from "../../hooks/useTelegram";
import { detectBankFromCardDigits } from "../../lib/bankDetect";
import {
  appendCardDigit,
  formatCardNumberFa,
  isValidCardNumberLength,
  removeLastCardDigit,
} from "../../lib/card";
import {
  hasAcceptedKycTerms,
  readKycDraft,
  writeKycDraft,
} from "../../lib/kycDraft";
import { lockAppScroll, unlockAppScroll } from "../../lib/scrollLock";
import { useRelockScrollWhileOpen } from "../../hooks/useRelockScrollWhileOpen";
import "../../styles/shop-rise.css";
import "./ProfileVerifyCard.css";

type IdentityNavState = {
  nationalId?: string;
  birthDate?: string;
};

export function ProfileVerifyCardPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { haptic } = useTelegram();
  const { t, locale } = useI18n();

  const navState = (location.state as IdentityNavState | null) ?? null;
  const draft = readKycDraft();
  const nationalId = navState?.nationalId || draft.nationalId || "";
  const birthDate = navState?.birthDate || draft.birthDate || "";
  const identityReady = Boolean(nationalId && birthDate);

  const [cardDigits, setCardDigits] = useState(() => draft.cardDigits ?? "");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    lockAppScroll();
    return () => unlockAppScroll();
  }, []);

  useRelockScrollWhileOpen(true);

  useEffect(() => {
    if (!hasAcceptedKycTerms()) {
      navigate("/profile/verify/terms", { replace: true });
      return;
    }
    if (!identityReady) {
      navigate("/profile/verify/identity", { replace: true });
      return;
    }
    if (navState?.nationalId && navState?.birthDate) {
      writeKycDraft({
        nationalId: navState.nationalId,
        birthDate: navState.birthDate,
      });
    }
    setReady(true);
  }, [identityReady, navigate, navState?.birthDate, navState?.nationalId]);

  const handleBack = useCallback(() => {
    navigate("/profile/verify/identity");
  }, [navigate]);

  const cardDisplay = useMemo(() => formatCardNumberFa(cardDigits), [cardDigits]);
  const detectedBank = useMemo(() => {
    const bank = detectBankFromCardDigits(cardDigits);
    if (!bank || bank.slug === "unknown") return null;
    return bank;
  }, [cardDigits]);
  const canContinue = isValidCardNumberLength(cardDigits);
  const bankLabel = detectedBank
    ? locale === "fa"
      ? detectedBank.nameFa
      : detectedBank.nameEn
    : null;

  const handleContinue = () => {
    if (!canContinue) return;
    haptic("light");
    writeKycDraft({
      nationalId,
      birthDate,
      cardDigits,
      bankName: detectedBank?.nameFa ?? null,
      bankSlug: detectedBank?.slug ?? null,
    });
    navigate("/profile/verify/review", {
      replace: true,
      state: { nationalId, birthDate, cardDigits },
    });
  };

  if (!ready) return null;

  return (
    <div className="verify-card">
      <div className="shop-rise" style={{ "--rise-index": 0 } as CSSProperties}>
        <PageHeader
          title={t("verify.cardNumber")}
          onBack={handleBack}
          action={
            <span className="page-header__step">
              {t("verify.stepOf", { current: 2, total: 2 })}
            </span>
          }
        />
      </div>

      <div className="verify-card__body">
        <section
          className="verify-card__notice shop-rise"
          style={{ "--rise-index": 1 } as CSSProperties}
        >
          <p className="verify-card__notice-text">{t("verify.cardNotice")}</p>
        </section>

        <section
          className="verify-card__amount shop-rise"
          style={{ "--rise-index": 2 } as CSSProperties}
          aria-label={t("verify.cardNumber")}
        >
          <p className="verify-card__label">{t("verify.cardNumber")}</p>
          <div className="verify-card__value-row">
            <span
              className={`verify-card__value${cardDigits ? "" : " verify-card__value--placeholder"}`}
              dir="ltr"
            >
              {cardDisplay}
            </span>
          </div>
          <div
            className={`verify-card__bank${detectedBank ? " verify-card__bank--visible" : ""}`}
            aria-live="polite"
          >
            {detectedBank ? (
              <>
                <img
                  className="verify-card__bank-icon"
                  src={detectedBank.iconSrc}
                  alt=""
                  width={18}
                  height={18}
                />
                <span className="verify-card__bank-name">{bankLabel}</span>
              </>
            ) : null}
          </div>
        </section>

        <div
          className="verify-card__keypad shop-rise"
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
        className="verify-card__footer shop-rise"
        style={{ "--rise-index": 4 } as CSSProperties}
      >
        <button
          type="button"
          className="verify-card__continue"
          disabled={!canContinue}
          onClick={handleContinue}
        >
          {t("verify.continueReview")}
        </button>
      </footer>
    </div>
  );
}
