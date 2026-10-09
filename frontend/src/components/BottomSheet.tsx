import { useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useRelockScrollWhileOpen } from "../hooks/useRelockScrollWhileOpen";
import { lockAppScroll, unlockAppScroll } from "../lib/scrollLock";
import "./BottomSheet.css";

/** Keep in sync with panelout BottomSheet unmount delay (close 0.42s + buffer). */
export const BOTTOM_SHEET_ANIM_MS = 480;

export type BottomSheetOption = {
  value: string;
  label: string;
  icon?: ReactNode;
};

export type BottomSheetButton = {
  label: string;
  onClick: () => void;
  variant?: "primary" | "default" | "danger";
  disabled?: boolean;
};

type BottomSheetProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children?: ReactNode;
  options?: BottomSheetOption[];
  selectedValue?: string | string[];
  onSelect?: (value: string) => void;
  buttons?: BottomSheetButton[];
  className?: string;
  /** When false, backdrop / Escape do not dismiss the sheet. Default true. */
  dismissible?: boolean;
};

function hasCustomIconColor(icon: ReactNode): boolean {
  if (!icon || typeof icon !== "object" || !("props" in icon)) return false;
  const props = icon.props as { color?: string };
  return typeof props.color === "string";
}

export function BottomSheet({
  open,
  onClose,
  title,
  description,
  children,
  options,
  selectedValue,
  onSelect,
  buttons,
  className,
  dismissible = true,
}: BottomSheetProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  /** Bumps on each open so the panel DOM remounts from a clean closed transform. */
  const [session, setSession] = useState(0);

  useEffect(() => {
    if (open) {
      setSession((value) => value + 1);
      setShouldRender(true);
      setIsVisible(false);
      return;
    }

    setIsVisible(false);
    const timer = window.setTimeout(
      () => setShouldRender(false),
      BOTTOM_SHEET_ANIM_MS,
    );
    return () => window.clearTimeout(timer);
  }, [open]);

  // After closed panel is in the DOM, turn visible (panelout double-rAF)
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
      if (event.key === "Escape" && open && dismissible) onClose();
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [dismissible, open, onClose]);

  const handleSelect = (value: string) => {
    onSelect?.(value);
    onClose();
  };

  if (!shouldRender) return null;

  return createPortal(
    <>
      <div
        key={`backdrop-${session}`}
        className={`bottom-sheet__backdrop${isVisible ? " bottom-sheet__backdrop--visible" : ""}`}
        onClick={dismissible ? onClose : undefined}
        role="presentation"
      />

      <div
        key={`panel-${session}`}
        className={`bottom-sheet__panel${isVisible ? " bottom-sheet__panel--visible" : ""}${className ? ` ${className}` : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="bottom-sheet__header">
          <div className="bottom-sheet__handle" aria-hidden />
          {title ? <h3 className="bottom-sheet__title">{title}</h3> : null}
        </div>

        {options ? (
          <div className="bottom-sheet__options">
            {options.map((option) => {
              const isSelected = Array.isArray(selectedValue)
                ? selectedValue.includes(option.value)
                : selectedValue === option.value;
              const customColor = hasCustomIconColor(option.icon);

              return (
                <button
                  key={option.value}
                  type="button"
                  className={`bottom-sheet__option${isSelected ? " bottom-sheet__option--selected" : ""}`}
                  onClick={() => handleSelect(option.value)}
                >
                  {option.icon ? <span className="bottom-sheet__option-icon">{option.icon}</span> : null}
                  <span
                    className="bottom-sheet__option-label"
                    style={isSelected && customColor ? { color: "var(--text)" } : undefined}
                  >
                    {option.label}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <>
            <div className="bottom-sheet__body">
              {description ? <p className="bottom-sheet__description">{description}</p> : null}
              {children}
            </div>
            {buttons && buttons.length > 0 ? (
              <div className="bottom-sheet__footer">
                <div className="bottom-sheet__actions">
                  {buttons.map((button) => (
                    <button
                      key={button.label}
                      type="button"
                      className={`bottom-sheet__btn bottom-sheet__btn--${button.variant ?? "default"}`}
                      onClick={button.onClick}
                      disabled={button.disabled}
                    >
                      {button.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </>,
    document.body,
  );
}
