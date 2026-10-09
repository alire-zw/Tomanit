import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Cancel01Icon from "./icons/hugeicons/Cancel01Icon";
import { NumeralKeypad } from "./NumeralKeypad";
import { useI18n } from "../context/I18nContext";
import { useTelegram } from "../hooks/useTelegram";
import { useRelockScrollWhileOpen } from "../hooks/useRelockScrollWhileOpen";
import { ApiError } from "../lib/api";
import { addBankCard, type BankCardRecord } from "../lib/bankCards";
import { detectBankFromCardDigits } from "../lib/bankDetect";
import {
  appendCardDigit,
  formatCardNumberFa,
  isValidCardNumberLength,
  removeLastCardDigit,
} from "../lib/card";
import { lockAppScroll, unlockAppScroll } from "../lib/scrollLock";
import "./BankCardAddModal.css";

const ANIM_MS = 420;

type BankCardAddModalProps = {
  open: boolean;
  onClose: () => void;
  onSaved: (card: BankCardRecord) => void;
  /** Merchant invoice amount — enables relaxed card verify up to 500k. */
  invoiceAmountToman?: number | null;
};

export function BankCardAddModal({
  open,
  onClose,
  onSaved,
  invoiceAmountToman = null,
}: BankCardAddModalProps) {
  const { t, locale } = useI18n();
  const { haptic } = useTelegram();
  const [isVisible, setIsVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const [session, setSession] = useState(0);
  const [cardDigits, setCardDigits] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setSession((value) => value + 1);
      setShouldRender(true);
      setIsVisible(false);
      setCardDigits("");
      setError(null);
      setSaving(false);
      return;
    }
    setIsVisible(false);
    const timer = window.setTimeout(() => setShouldRender(false), ANIM_MS);
    return () => window.clearTimeout(timer);
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !shouldRender) return;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setIsVisible(true));
    });
    return () => {
      cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
    };
  }, [open, shouldRender, session]);

  useEffect(() => {
    if (!open) {
      unlockAppScroll();
      return;
    }
    lockAppScroll();
    return () => unlockAppScroll();
  }, [open]);

  useRelockScrollWhileOpen(open);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && open && !saving) onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, onClose, saving]);

  const detectedBank = useMemo(() => {
    const bank = detectBankFromCardDigits(cardDigits);
    if (!bank || bank.slug === "unknown") return null;
    return bank;
  }, [cardDigits]);

  const cardDisplay = useMemo(() => formatCardNumberFa(cardDigits), [cardDigits]);
  const canSave =
    isValidCardNumberLength(cardDigits) && Boolean(detectedBank) && !saving;
  const bankLabel = detectedBank
    ? locale === "fa" || locale === "ar"
      ? detectedBank.nameFa
      : detectedBank.nameEn
    : null;

  const handleSave = async () => {
    if (!canSave || !detectedBank) return;
    haptic("medium");
    setSaving(true);
    setError(null);
    try {
      // Backend: Jibit card→IBAN inquiry, owner name check, then DB upsert fields.
      const data = await addBankCard({
        cardNumber: cardDigits,
        bankName: detectedBank.nameFa,
        bankSlug: detectedBank.slug,
        bankBin: detectedBank.bin,
        ...(typeof invoiceAmountToman === "number" && invoiceAmountToman > 0
          ? { invoiceAmountToman }
          : {}),
      });
      haptic("medium");
      onSaved(data.card);
      onClose();
    } catch (err) {
      haptic("heavy");
      if (err instanceof ApiError && err.code === "CARD_OWNED_BY_OTHER") {
        setError(t("bankCards.cardOwnedByOther"));
      } else {
        setError(err instanceof ApiError ? err.message : t("bankCards.addError"));
      }
    } finally {
      setSaving(false);
    }
  };

  if (!shouldRender) return null;

  return createPortal(
    <>
      <div
        key={`bca-backdrop-${session}`}
        className={`bca-modal__backdrop${isVisible ? " bca-modal__backdrop--visible" : ""}`}
        onClick={() => {
          if (!saving) onClose();
        }}
        role="presentation"
      />

      <div
        key={`bca-panel-${session}`}
        className={`bca-modal__panel${isVisible ? " bca-modal__panel--visible" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={t("bankCards.add")}
      >
        <div className="bca-modal__head">
          <h3 className="bca-modal__title">{t("bankCards.add")}</h3>
          {bankLabel && detectedBank ? (
            <p
              className="bca-modal__bank-name"
              style={{ color: detectedBank.color1 }}
            >
              {bankLabel}
            </p>
          ) : null}
        </div>

        <div className="bca-modal__field">
          <p className="bca-modal__label">{t("bankCards.cardNumber")}</p>
          <div className="bca-modal__value-row" dir="ltr">
            <span
              className="bca-modal__bank-badge"
              style={
                detectedBank
                  ? {
                      background: `color-mix(in srgb, ${detectedBank.color1} 18%, var(--surface))`,
                    }
                  : undefined
              }
              aria-hidden
            >
              {detectedBank ? (
                <img
                  src={detectedBank.iconSrc}
                  alt=""
                  width={28}
                  height={28}
                  onError={(event) => {
                    event.currentTarget.src = "/banks/unknown.svg";
                  }}
                />
              ) : null}
            </span>
            <span
              className={`bca-modal__value${
                cardDigits ? "" : " bca-modal__value--placeholder"
              }`}
            >
              {cardDisplay}
            </span>
          </div>
          {error ? <p className="bca-modal__error">{error}</p> : null}
        </div>

        <div className="bca-modal__keypad">
          <NumeralKeypad
            onDigit={(digit) => setCardDigits((curr) => appendCardDigit(curr, digit))}
            onBackspace={() => setCardDigits((curr) => removeLastCardDigit(curr))}
            backspaceDisabled={!cardDigits || saving}
          />
        </div>

        <div className="bca-modal__footer">
          <button
            type="button"
            className="bca-modal__save"
            onClick={() => void handleSave()}
            disabled={!canSave}
          >
            {saving ? t("common.loading") : t("common.save")}
          </button>
          <button
            type="button"
            className="bca-modal__close"
            onClick={onClose}
            disabled={saving}
            aria-label={t("common.cancel")}
          >
            <Cancel01Icon
              variant="bulk-rounded"
              size={24}
              color="currentColor"
              aria-hidden
            />
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}
