import { useCallback, useEffect, useRef, useState, type CSSProperties, type UIEvent } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../../components/PageHeader";
import { useI18n } from "../../context/I18nContext";
import { useTelegram } from "../../hooks/useTelegram";
import { getTermsContent, type TermsBullet } from "../../i18n/termsContent";
import { KYC_TERMS_ACCEPTED_KEY } from "../../lib/kycDraft";
import { lockAppScroll, unlockAppScroll } from "../../lib/scrollLock";
import { useRelockScrollWhileOpen } from "../../hooks/useRelockScrollWhileOpen";
import "../../styles/shop-rise.css";
import "./ProfileVerify.css";

const SCROLL_BOTTOM_THRESHOLD_PX = 28;

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

export function ProfileVerifyPage() {
  const navigate = useNavigate();
  const { haptic } = useTelegram();
  const { t, locale } = useI18n();
  const terms = getTermsContent(locale);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [hasReachedBottom, setHasReachedBottom] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    lockAppScroll();
    return () => unlockAppScroll();
  }, []);

  useRelockScrollWhileOpen(true);

  useEffect(() => {
    setHasReachedBottom(false);
  }, [locale]);

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
    checkScrollPosition();
    const el = scrollRef.current;
    if (!el) return;

    const resizeObserver = new ResizeObserver(() => checkScrollPosition());
    resizeObserver.observe(el);
    return () => resizeObserver.disconnect();
  }, [checkScrollPosition, locale]);

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    const el = event.currentTarget;
    const remaining = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (remaining <= SCROLL_BOTTOM_THRESHOLD_PX) {
      setHasReachedBottom(true);
    }
  };

  const handleAccept = () => {
    if (!hasReachedBottom || isSubmitting) return;
    haptic("light");
    setIsSubmitting(true);
    try {
      localStorage.setItem(KYC_TERMS_ACCEPTED_KEY, new Date().toISOString());
      navigate("/profile/verify/identity", { replace: true });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="verify-terms">
      <div className="shop-rise" style={{ "--rise-index": 0 } as CSSProperties}>
        <PageHeader title={t("verify.termsTitle")} onBack={() => navigate("/profile/verify")} />
      </div>

      <div className="verify-terms__body">
        <div
          ref={scrollRef}
          className="verify-terms__scroll shop-rise"
          style={{ "--rise-index": 1 } as CSSProperties}
          onScroll={handleScroll}
        >
          <article className="verify-terms__article">
            <h2 className="verify-terms__heading">{terms.docTitle}</h2>
            <p className="verify-terms__meta">{terms.lastUpdated}</p>

            {terms.sections.map((section, sectionIndex) => (
              <div key={sectionIndex}>
                {section.title ? (
                  <h2
                    className={`verify-terms__heading${
                      section.danger ? " verify-terms__heading--danger" : ""
                    }`}
                  >
                    {section.title}
                  </h2>
                ) : null}

                {section.paragraphs?.map((paragraph, paragraphIndex) => (
                  <p
                    key={`p-${paragraphIndex}`}
                    className={section.danger ? "verify-terms__danger-text" : undefined}
                  >
                    {paragraph}
                  </p>
                ))}

                {section.bullets?.length ? (
                  <ul className="verify-terms__list">
                    {section.bullets.map((item, bulletIndex) => renderBullet(item, bulletIndex))}
                  </ul>
                ) : null}

                {section.table ? (
                  <div className="verify-terms__limits">
                    <table className="verify-terms__table">
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
                              <span className="verify-terms__amount">{row.amount}</span>
                              <span className="verify-terms__unit">{row.unit}</span>
                            </td>
                            {row.monthly != null ? (
                              <td>
                                <span className="verify-terms__amount">{row.monthly}</span>
                                <span className="verify-terms__unit">{row.unit}</span>
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
                    className={section.danger ? "verify-terms__danger-text" : undefined}
                  >
                    {paragraph}
                  </p>
                ))}
              </div>
            ))}

            <p className="verify-terms__end">{terms.endNote}</p>
          </article>
        </div>

        {!hasReachedBottom ? <div className="verify-terms__fade" aria-hidden /> : null}
      </div>

      <footer
        className="verify-terms__footer shop-rise"
        style={{ "--rise-index": 2 } as CSSProperties}
      >
        {!hasReachedBottom ? (
          <p className="verify-terms__scroll-hint">{t("verify.scrollHint")}</p>
        ) : null}
        <button
          type="button"
          className="verify-terms__continue"
          disabled={!hasReachedBottom || isSubmitting}
          onClick={handleAccept}
        >
          {isSubmitting ? t("verify.acceptSubmitting") : t("verify.acceptTerms")}
        </button>
      </footer>
    </div>
  );
}
