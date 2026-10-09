import { useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Cancel01Icon from "./icons/hugeicons/Cancel01Icon";
import TickDouble03Icon from "./icons/hugeicons/TickDouble03Icon";
import { useI18n } from "../context/I18nContext";
import { useRelockScrollWhileOpen } from "../hooks/useRelockScrollWhileOpen";
import { lockAppScroll, unlockAppScroll } from "../lib/scrollLock";
import "./FlatSelectModal.css";

const ANIM_MS = 420;
const CHECK_COLOR = "#fbbf24";

export type FlatSelectOption = {
  value: string;
  label: string;
  icon?: ReactNode;
};

type FlatSelectModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  options: FlatSelectOption[];
  selectedValue?: string;
  onSelect: (value: string) => void;
};

export function FlatSelectModal({
  open,
  onClose,
  title,
  options,
  selectedValue,
  onSelect,
}: FlatSelectModalProps) {
  const { t } = useI18n();
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
        key={`fsm-backdrop-${session}`}
        className={`fsm-modal__backdrop${isVisible ? " fsm-modal__backdrop--visible" : ""}`}
        onClick={onClose}
        role="presentation"
      />

      <div
        key={`fsm-panel-${session}`}
        className={`fsm-modal__panel${isVisible ? " fsm-modal__panel--visible" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <h3 className="fsm-modal__title">{title}</h3>

        <div className="fsm-modal__list" role="listbox">
          {options.map((option) => {
            const selected = option.value === selectedValue;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={selected}
                className={`fsm-modal__item${
                  selected ? " fsm-modal__item--selected" : ""
                }${option.icon ? "" : " fsm-modal__item--text-only"}`}
                onClick={() => {
                  onSelect(option.value);
                  onClose();
                }}
              >
                {option.icon ? (
                  <span className="fsm-modal__icon">{option.icon}</span>
                ) : null}
                <span className="fsm-modal__label">{option.label}</span>
                {selected ? (
                  <span className="fsm-modal__check" aria-hidden>
                    <TickDouble03Icon
                      variant="bulk-rounded"
                      size={16}
                      color={CHECK_COLOR}
                    />
                  </span>
                ) : (
                  <span className="fsm-modal__check-spacer" aria-hidden />
                )}
              </button>
            );
          })}
        </div>

        <div className="fsm-modal__footer">
          <button
            type="button"
            className="fsm-modal__close"
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
