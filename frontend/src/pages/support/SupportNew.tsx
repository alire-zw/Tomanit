import { useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import FolderAttachmentIcon from "../../components/icons/folder-attachment-stroke-rounded";
import Money03Icon from "../../components/icons/money-03-stroke-rounded";
import NoteIcon from "../../components/icons/NoteIcon";
import ShopIcon from "../../components/icons/ShopIcon";
import UserIcon from "../../components/icons/UserIcon";
import { PageHeader } from "../../components/PageHeader";
import { useNotification } from "../../components/Notification";
import { useI18n } from "../../context/I18nContext";
import { useTelegram } from "../../hooks/useTelegram";
import { apiFetch } from "../../lib/api";
import {
  SUPPORT_CATEGORIES,
  type SupportCategory,
} from "../../lib/supportMeta";
import { compressSupportImage } from "../../lib/supportImage";
import "../../styles/shop-rise.css";
import "./Support.css";

type Step = "category" | "message";

function ArrowIcon({ flip }: { flip?: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="1em"
      height="1em"
      fill="none"
      viewBox="0 0 24 24"
      style={flip ? { transform: "scaleX(-1)" } : undefined}
    >
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="m15 18-6-6 6-6"
      />
    </svg>
  );
}

function categoryIcon(value: SupportCategory): ReactNode {
  switch (value) {
    case "trade":
      return <ShopIcon width={18} height={18} />;
    case "wallet":
      return <Money03Icon width={18} height={18} />;
    case "account":
      return <UserIcon width={18} height={18} />;
    default:
      return <NoteIcon width={18} height={18} />;
  }
}

export function SupportNewPage() {
  const navigate = useNavigate();
  const { t, isRTL } = useI18n();
  const { haptic } = useTelegram();
  const { notify } = useNotification();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const chevron = <ArrowIcon flip={!isRTL} />;

  const [step, setStep] = useState<Step>("category");
  const [category, setCategory] = useState<SupportCategory | null>(null);
  const [body, setBody] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const selectedMeta = useMemo(
    () => SUPPORT_CATEGORIES.find((item) => item.value === category) ?? null,
    [category],
  );

  const goBack = () => {
    haptic("light");
    if (step === "message") {
      setStep("category");
      return;
    }
    navigate("/support", { replace: true });
  };

  const pickCategory = (value: SupportCategory) => {
    haptic("light");
    setCategory(value);
    setStep("message");
  };

  const pickImage = async (file: File | null) => {
    if (!file) return;
    try {
      const dataUrl = await compressSupportImage(file);
      setImagePreview(dataUrl);
      haptic("light");
    } catch (error) {
      notify(error instanceof Error ? error.message : t("support.imagePickFailed"), "error");
    }
  };

  const submit = async () => {
    if (!category || !selectedMeta) return;
    const text = body.trim();
    if (!text && !imagePreview) {
      notify(t("support.needBodyOrImage"), "error");
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiFetch<{ ticket: { id: string } }>("/support/tickets", {
        method: "POST",
        body: {
          subject: category,
          body: text,
          imageData: imagePreview || undefined,
        },
      });
      haptic("medium");
      navigate(`/support/${res.ticket.id}`, { replace: true });
    } catch (error) {
      notify(error instanceof Error ? error.message : t("support.createFailed"), "error");
    } finally {
      setSubmitting(false);
    }
  };

  const title = step === "category" ? t("support.subjectStep") : t("support.describeStep");
  const canSubmit = Boolean(category && (body.trim() || imagePreview));

  return (
    <div className="support support--sub shop-rise">
      <PageHeader title={title} onBack={goBack} />

      <div className="support__steps" aria-hidden="true">
        {(["category", "message"] as Step[]).map((item, index, list) => {
          const stepIndex = list.indexOf(step);
          const itemIndex = index;
          const active = itemIndex <= Math.max(0, stepIndex);
          const current = item === step;
          return (
            <span
              key={item}
              className={`support__step-dot${active ? " is-active" : ""}${current ? " is-current" : ""}`}
            />
          );
        })}
      </div>

      {step === "category" ? (
        <section className="support__new-block shop-rise" style={{ "--rise-index": 0 } as CSSProperties}>
          <p className="support__intro">{t("support.categoryIntro")}</p>
          <div className="support__pick-list">
            {SUPPORT_CATEGORIES.map((item) => (
              <button
                key={item.value}
                type="button"
                className="support__pick"
                onClick={() => pickCategory(item.value)}
              >
                <span className="support__pick-icon">{categoryIcon(item.value)}</span>
                <span className="support__pick-copy">
                  <span className="support__pick-title">{t(item.labelKey)}</span>
                  <span className="support__pick-hint">{t(item.hintKey)}</span>
                </span>
                <span className="support__pick-arrow">{chevron}</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {step === "message" ? (
        <section className="support__form shop-rise" style={{ "--rise-index": 0 } as CSSProperties}>
          <div className="support__context-stack">
            {selectedMeta ? (
              <div className="support__context">
                <span className="support__context-icon">{categoryIcon(selectedMeta.value)}</span>
                <span className="support__context-text">{t(selectedMeta.labelKey)}</span>
              </div>
            ) : null}
          </div>

          <label className="support__compose-card">
            <span className="support__compose-label">{t("support.yourMessage")}</span>
            <textarea
              className="support__textarea"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder={t("support.messagePlaceholder")}
              maxLength={4000}
            />
          </label>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="support__file-input"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              event.target.value = "";
              void pickImage(file);
            }}
          />

          {imagePreview ? (
            <div className="support__attach-preview support__attach-preview--form">
              <img src={imagePreview} alt="" />
              <div className="support__attach-preview-copy">
                <span>{t("support.imageAttached")}</span>
                <button
                  type="button"
                  className="support__attach-remove"
                  onClick={() => setImagePreview(null)}
                >
                  {t("common.delete")}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="support__attach-row"
              onClick={() => fileRef.current?.click()}
            >
              <span className="support__attach-row-icon">
                <FolderAttachmentIcon width={18} height={18} />
              </span>
              <span className="support__attach-row-copy">
                <span className="support__attach-row-title">{t("support.attachImage")}</span>
                <span className="support__attach-row-hint">{t("support.attachHint")}</span>
              </span>
            </button>
          )}

          <button
            type="button"
            className="support__submit"
            disabled={submitting || !canSubmit}
            onClick={() => void submit()}
          >
            {submitting ? t("support.submitting") : t("support.submitTicket")}
          </button>
        </section>
      ) : null}
    </div>
  );
}
