import { useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import Cancel01Icon from "./icons/hugeicons/Cancel01Icon";
import TickDouble03Icon from "./icons/hugeicons/TickDouble03Icon";
import { useI18n } from "../context/I18nContext";
import { useRelockScrollWhileOpen } from "../hooks/useRelockScrollWhileOpen";
import { getBankVisual } from "../lib/bankDetect";
import type { BankCardRecord } from "../lib/bankCards";
import { lockAppScroll, unlockAppScroll } from "../lib/scrollLock";
import "./BankCardPickerModal.css";

const ANIM_MS = 420;
const CHECK_COLOR = "#fbbf24";

type BankCardPickerModalProps = {
  open: boolean;
  onClose: () => void;
  cards: BankCardRecord[];
  selectedId: number | null;
  onSelect: (cardId: number) => void;
  onAddCard: () => void;
};

function cardLast4(card: BankCardRecord): string {
  if (card.last4?.trim()) return card.last4.trim();
  const digits = card.cardNumber.replace(/\D/g, "");
  return digits.slice(-4) || "****";
}

function cardMaskTail(card: BankCardRecord): string {
  return `*** ${cardLast4(card)}`;
}

export function BankCardPickerModal({
  open,
  onClose,
  cards,
  selectedId,
  onSelect,
  onAddCard,
}: BankCardPickerModalProps) {
  const { t, locale } = useI18n();
  const [isVisible, setIsVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const [session, setSession] = useState(0);

  useEffect(() => {
    if (open) {
      setSession((value) => value + 1);
      setShouldRender(true);
      setIsVisible(false);
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
      if (event.key === "Escape" && open) onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, onClose]);

  if (!shouldRender) return null;

  return createPortal(
    <>
      <div
        key={`bcp-backdrop-${session}`}
        className={`bcp-modal__backdrop${isVisible ? " bcp-modal__backdrop--visible" : ""}`}
        onClick={onClose}
        role="presentation"
      />

      <div
        key={`bcp-panel-${session}`}
        className={`bcp-modal__panel${isVisible ? " bcp-modal__panel--visible" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={t("myShop.merchantPayChooseCard")}
      >
        <h3 className="bcp-modal__title">{t("myShop.merchantPayChooseCard")}</h3>

        <div className="bcp-modal__list" role="listbox">
          {cards.map((card) => {
            const visual = getBankVisual(card.bankSlug, card.cardNumber);
            const selected = card.id === selectedId;
            const name =
              card.bankName?.trim() ||
              (locale === "fa" || locale === "ar" ? visual.nameFa : visual.nameFa);

            return (
              <button
                key={card.id}
                type="button"
                role="option"
                aria-selected={selected}
                className={`bcp-modal__item${selected ? " bcp-modal__item--selected" : ""}`}
                onClick={() => onSelect(card.id)}
              >
                <span
                  className="bcp-modal__logo"
                  style={{
                    background: `color-mix(in srgb, ${visual.color1} 18%, var(--surface))`,
                  }}
                >
                  <img
                    src={visual.iconSrc}
                    alt=""
                    width={28}
                    height={28}
                    onError={(event) => {
                      event.currentTarget.src = "/banks/unknown.svg";
                    }}
                  />
                </span>
                <span className="bcp-modal__copy">
                  <span className="bcp-modal__bank">{name}</span>
                  <span className="bcp-modal__mask">{cardMaskTail(card)}</span>
                </span>
                  {selected ? (
                    <span className="bcp-modal__check" aria-hidden>
                      <TickDouble03Icon
                        variant="bulk-rounded"
                        size={16}
                        color={CHECK_COLOR}
                      />
                    </span>
                  ) : (
                    <span className="bcp-modal__check-spacer" aria-hidden />
                  )}
              </button>
            );
          })}

          <button type="button" className="bcp-modal__add" onClick={onAddCard}>
            <span>{t("myShop.merchantPayAddCard")}</span>
            <span className="bcp-modal__add-plus" aria-hidden>
              +
            </span>
          </button>
        </div>

        <div className="bcp-modal__footer">
          <button
            type="button"
            className="bcp-modal__close"
            onClick={onClose}
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
