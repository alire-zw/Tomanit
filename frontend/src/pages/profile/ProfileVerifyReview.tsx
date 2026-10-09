import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ComponentType,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useNotification } from "../../components/Notification";
import { PageHeader } from "../../components/PageHeader";
import BankCardIcon from "../../components/icons/BankCardIcon";
import IdIcon from "../../components/icons/IdIcon";
import IdNotVerifiedIcon from "../../components/icons/id-not-verified-stroke-rounded";
import IdVerifiedIcon from "../../components/icons/id-verified-stroke-rounded";
import { useI18n } from "../../context/I18nContext";
import { useAuth } from "../../hooks/useAuth";
import { useTelegram } from "../../hooks/useTelegram";
import { apiFetch, ApiError, type MeResponse } from "../../lib/api";
import {
  clearKycDraft,
  hasAcceptedKycTerms,
  readKycDraft,
  writeKycDraft,
} from "../../lib/kycDraft";
import { lockAppScroll, unlockAppScroll } from "../../lib/scrollLock";
import { useRelockScrollWhileOpen } from "../../hooks/useRelockScrollWhileOpen";
import "../../styles/shop-rise.css";
import "./ProfileVerifyReview.css";

type ReviewNavState = {
  nationalId?: string;
  birthDate?: string;
  cardDigits?: string;
};

type KycVerifyResponse = MeResponse & {
  ok: true;
  card?: {
    last4: string;
    iban: string | null;
    bankName: string | null;
    ownerName: string | null;
  };
  ticket?: { id: string; code: string };
};

type CheckStatus = "idle" | "pending" | "success" | "error";
type ReviewPhase = "checking" | "collapsing" | "complete";

type ReviewCheck = {
  id: "identity" | "card";
  titleKey: "verify.checkIdentity" | "verify.checkCard";
  status: CheckStatus;
  Icon: ComponentType<{ width?: number; height?: number; color?: string }>;
};

function statusKey(status: CheckStatus): string {
  if (status === "success") return "verify.statusApproved";
  if (status === "error") return "verify.statusFailed";
  if (status === "idle") return "verify.statusWaiting";
  return "verify.statusChecking";
}

const COLLAPSE_MS = 520;

export function ProfileVerifyReviewPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { haptic } = useTelegram();
  const { notify } = useNotification();
  const { applyUser } = useAuth();
  const { t } = useI18n();

  const navState = (location.state as ReviewNavState | null) ?? null;
  const draft = readKycDraft();
  const nationalId = navState?.nationalId || draft.nationalId || "";
  const birthDate = navState?.birthDate || draft.birthDate || "";
  const cardDigits = navState?.cardDigits || draft.cardDigits || "";
  const readyInput = Boolean(nationalId && birthDate && cardDigits.length === 16);

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
  const applyUserRef = useRef(applyUser);
  const notifyRef = useRef(notify);
  const tRef = useRef(t);
  applyUserRef.current = applyUser;
  notifyRef.current = notify;
  tRef.current = t;

  const allPassed = checks.every((check) => check.status === "success");
  const canContinue = phase === "complete";

  const setCheckStatus = useCallback((id: ReviewCheck["id"], status: CheckStatus) => {
    setChecks((current) =>
      current.map((check) => (check.id === id ? { ...check, status } : check)),
    );
  }, []);

  useEffect(() => {
    lockAppScroll();
    return () => unlockAppScroll();
  }, []);

  useRelockScrollWhileOpen(true);

  useEffect(() => {
    if (!allPassed) return;
    if (phase === "complete") return;

    setPhase("collapsing");
    const timer = window.setTimeout(() => {
      setPhase("complete");
      haptic("medium");
    }, COLLAPSE_MS);

    return () => window.clearTimeout(timer);
  }, [allPassed, haptic, phase]);

  useEffect(() => {
    if (!hasAcceptedKycTerms()) {
      navigate("/profile/verify/terms", { replace: true });
      return;
    }
    if (!readyInput) {
      navigate("/profile/verify/card", { replace: true });
      return;
    }

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
  }, [birthDate, cardDigits, nationalId, navigate, readyInput, setCheckStatus]);

  const handleBack = useCallback(() => {
    if (phase === "complete") {
      navigate("/profile/verify", { replace: true });
      return;
    }
    if (checks.some((check) => check.status === "pending")) return;
    navigate("/profile/verify/card", { replace: true });
  }, [checks, navigate, phase]);

  const handleDone = () => {
    if (!canContinue) return;
    haptic("light");
    navigate("/profile/verify", { replace: true });
  };

  const handleRetry = () => {
    haptic("light");
    navigate("/profile/verify/card", { replace: true });
  };

  const hasError = checks.some((check) => check.status === "error");

  if (!hasAcceptedKycTerms() || !readyInput) return null;

  return (
    <div className="verify-review">
      <div className="shop-rise" style={{ "--rise-index": 0 } as CSSProperties}>
        <PageHeader title={t("verify.reviewTitle")} onBack={handleBack} />
      </div>

      <div className="verify-review__content">
        {phase !== "complete" ? (
          <>
            <h2
              className={`verify-review__section-title shop-rise${
                phase === "collapsing" ? " verify-review__section-title--fade" : ""
              }`}
              style={{ "--rise-index": 1 } as CSSProperties}
            >
              {t("verify.checksStatus")}
            </h2>

            <section
              className={`verify-review__checks shop-rise${
                phase === "collapsing" ? " verify-review__checks--collapsing" : ""
              }`}
              style={{ "--rise-index": 2 } as CSSProperties}
              aria-label={t("verify.checksStatus")}
            >
              {checks.map((check, index) => {
                const { Icon } = check;
                return (
                  <div
                    key={check.id}
                    className={`verify-review__check verify-review__check--${check.status}`}
                    style={{ "--check-index": index } as CSSProperties}
                  >
                    <span className="verify-review__check-icon" aria-hidden>
                      <Icon width={18} height={18} />
                    </span>
                    <div className="verify-review__check-text">
                      <span className="verify-review__check-title">{t(check.titleKey)}</span>
                      <span className="verify-review__check-status">
                        {t(statusKey(check.status))}
                      </span>
                    </div>
                    <span className="verify-review__check-indicator" aria-hidden>
                      {check.status === "pending" ? (
                        <span className="verify-review__pulse-dot" />
                      ) : check.status === "success" ? (
                        <IdVerifiedIcon width={20} height={20} />
                      ) : check.status === "error" ? (
                        <IdNotVerifiedIcon width={20} height={20} />
                      ) : (
                        <span className="verify-review__idle-dot" />
                      )}
                    </span>
                  </div>
                );
              })}
            </section>
          </>
        ) : (
          <section
            className="verify-review__done shop-rise"
            style={{ "--rise-index": 1 } as CSSProperties}
            aria-live="polite"
          >
            <span className="verify-review__done-icon" aria-hidden>
              <IdVerifiedIcon width={28} height={28} />
            </span>
            <p className="verify-review__done-title">{t("verify.reviewSuccess")}</p>
            <p className="verify-review__done-text">{t("verify.reviewSuccessText")}</p>
          </section>
        )}
      </div>

      <footer
        className="verify-review__footer shop-rise"
        style={{ "--rise-index": 3 } as CSSProperties}
      >
        {hasError && phase !== "complete" ? (
          <button type="button" className="verify-review__primary" onClick={handleRetry}>
            {t("verify.editInfo")}
          </button>
        ) : (
          <button
            type="button"
            className="verify-review__primary"
            onClick={handleDone}
            disabled={!canContinue}
          >
            {t("verify.backToVerify")}
          </button>
        )}
      </footer>
    </div>
  );
}
