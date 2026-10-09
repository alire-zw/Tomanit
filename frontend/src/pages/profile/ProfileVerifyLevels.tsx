import { useCallback, useMemo, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { useNotification } from "../../components/Notification";
import { PageHeader } from "../../components/PageHeader";
import { useI18n } from "../../context/I18nContext";
import { useAuth } from "../../hooks/useAuth";
import { useTelegram } from "../../hooks/useTelegram";
import { hasAcceptedKycTerms } from "../../lib/kycDraft";
import "../../styles/shop-rise.css";
import "./ProfileVerifyLevels.css";

type ReqStatus = "completed" | "pending";

function FingerprintIcon({ color = "currentColor" }: { color?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="none" viewBox="0 0 24 24" aria-hidden>
      <path
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        d="M8.1 21.221a12.16 12.16 0 0 1-2.207-7.002 6.11 6.11 0 0 1 6.106-6.11 6.11 6.11 0 0 1 6.106 6.11"
      />
      <path
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        d="M18.436 20.312c-.11.006-.218.016-.329.016a6.11 6.11 0 0 1-6.106-6.11"
      />
      <path
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        d="M13.27 22a9.16 9.16 0 0 1-4.323-7.781 3.054 3.054 0 1 1 6.107 0 3.054 3.054 0 1 0 6.108 0c0-5.062-4.102-9.164-9.16-9.164-5.059 0-9.16 4.102-9.16 9.164 0 1.128.126 2.226.358 3.286"
      />
      <path
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        d="M20.526 5.863A11.33 11.33 0 0 0 12 2a11.33 11.33 0 0 0-8.525 3.863"
      />
    </svg>
  );
}

function CheckCircleIcon({ color = "var(--success)" }: { color?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.6" />
      <path
        d="M8.2 12.2 10.7 14.7 15.8 9.3"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function EmptyCircleIcon({ color = "currentColor" }: { color?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8.25" stroke={color} strokeWidth="1.6" />
    </svg>
  );
}

function RequirementRow({ status, text }: { status: ReqStatus; text: string }) {
  const done = status === "completed";
  return (
    <div className="verify-levels__req">
      <span
        className={`verify-levels__req-icon${done ? " verify-levels__req-icon--done" : " verify-levels__req-icon--pending"}`}
        aria-hidden
      >
        {done ? <CheckCircleIcon /> : <EmptyCircleIcon />}
      </span>
      <p className="verify-levels__req-text">{text}</p>
    </div>
  );
}

export function ProfileVerifyLevelsPage() {
  const navigate = useNavigate();
  const { haptic } = useTelegram();
  const { user, loading } = useAuth();
  const { notify } = useNotification();
  const { t } = useI18n();

  const kycLevel = user?.kycLevel ?? "none";
  const hasPhone = Boolean(user?.phone?.trim());

  const level1Done = kycLevel === "basic" || kycLevel === "advanced";
  const level2Done = kycLevel === "advanced";

  const currentLevel = useMemo(() => {
    if (kycLevel === "none") return "level1";
    if (kycLevel === "basic") return "level2";
    return "level2";
  }, [kycLevel]);

  const startLevel1 = useCallback(() => {
    haptic("light");
    if (hasAcceptedKycTerms()) {
      navigate("/profile/verify/identity");
    } else {
      navigate("/profile/verify/terms");
    }
  }, [haptic, navigate]);

  const startLevel2 = useCallback(() => {
    haptic("light");
    notify(t("verify.level2Soon"), "info");
  }, [haptic, notify, t]);

  const level1ButtonLabel =
    hasPhone || hasAcceptedKycTerms() ? t("verify.continueLevel1") : t("verify.startLevel1");

  return (
    <div className="verify-levels">
      <div className="shop-rise" style={{ "--rise-index": 0 } as CSSProperties}>
        <PageHeader title={t("verify.title")} onBack={() => navigate("/profile")} />
      </div>

      <div className="verify-levels__body">
        <div
          className="verify-levels__intro shop-rise"
          style={{ "--rise-index": 1 } as CSSProperties}
        >
          <span className="verify-levels__intro-icon" aria-hidden>
            <FingerprintIcon />
          </span>
          <p className="verify-levels__desc">{t("verify.intro")}</p>
        </div>

        {loading && !user ? (
          <p className="verify-levels__loading">{t("common.loading")}</p>
        ) : (
          <>
            <h5
              className="verify-levels__section-title shop-rise"
              style={{ "--rise-index": 2 } as CSSProperties}
            >
              {t("verify.levelsTitle")}
            </h5>

            <div
              className="verify-levels__cards shop-rise"
              style={{ "--rise-index": 3 } as CSSProperties}
            >
              <section className="verify-levels__card verify-levels__card--done">
                <div className="verify-levels__card-head">
                  <h2 className="verify-levels__card-title">{t("verify.baseLevel")}</h2>
                </div>
                <div className="verify-levels__reqs">
                  <RequirementRow status="completed" text={t("verify.reqRegister")} />
                </div>
              </section>

              <div className="verify-levels__divider" />

              <section
                className={`verify-levels__card${level1Done ? " verify-levels__card--done" : ""}${
                  currentLevel === "level1" ? " verify-levels__card--current" : ""
                }`}
              >
                <div className="verify-levels__card-head">
                  <h2 className="verify-levels__card-title">{t("verify.level1")}</h2>
                  {currentLevel === "level1" ? (
                    <span className="verify-levels__badge">{t("verify.currentLevel")}</span>
                  ) : null}
                </div>
                <div className="verify-levels__reqs">
                  <RequirementRow
                    status={hasPhone || level1Done ? "completed" : "pending"}
                    text={t("verify.reqPhone")}
                  />
                  <RequirementRow
                    status={level1Done ? "completed" : "pending"}
                    text={t("verify.reqIdentity")}
                  />
                  <RequirementRow
                    status={level1Done ? "completed" : "pending"}
                    text={t("verify.reqCard")}
                  />
                  {kycLevel === "none" ? (
                    <button type="button" className="verify-levels__btn" onClick={startLevel1}>
                      {level1ButtonLabel}
                    </button>
                  ) : null}
                </div>
              </section>

              <div className="verify-levels__divider" />

              <section
                className={`verify-levels__card${level2Done ? " verify-levels__card--done" : ""}${
                  currentLevel === "level2" && !level2Done ? " verify-levels__card--current" : ""
                }`}
              >
                <div className="verify-levels__card-head">
                  <h2 className="verify-levels__card-title">{t("verify.level2")}</h2>
                  {currentLevel === "level2" && !level2Done ? (
                    <span className="verify-levels__badge">{t("verify.currentLevel")}</span>
                  ) : null}
                  {level2Done ? (
                    <span className="verify-levels__badge">{t("verify.completed")}</span>
                  ) : null}
                </div>
                <div className="verify-levels__reqs">
                  <RequirementRow
                    status={level2Done ? "completed" : "pending"}
                    text={t("verify.reqDocs")}
                  />
                  <RequirementRow
                    status={level2Done ? "completed" : "pending"}
                    text={t("verify.reqSelfie")}
                  />
                  {kycLevel === "basic" ? (
                    <button type="button" className="verify-levels__btn" onClick={startLevel2}>
                      {t("verify.startLevel2")}
                    </button>
                  ) : null}
                </div>
              </section>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
