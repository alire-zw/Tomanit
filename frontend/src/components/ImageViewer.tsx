import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../context/I18nContext";
import { useRelockScrollWhileOpen } from "../hooks/useRelockScrollWhileOpen";
import { localeToBcp47 } from "../i18n";
import { lockAppScroll, unlockAppScroll } from "../lib/scrollLock";
import "./ImageViewer.css";

type ImageViewerProps = {
  isOpen: boolean;
  src: string | null;
  alt?: string;
  onClose: () => void;
};

export function ImageViewer({ isOpen, src, alt, onClose }: ImageViewerProps) {
  const { t, locale } = useI18n();
  const [scale, setScale] = useState(1);
  const resolvedAlt = alt ?? t("common.image");
  const percentMark = locale === "fa" || locale === "ar" ? "٪" : "%";
  const scaleLabel = `${Math.round(scale * 100).toLocaleString(localeToBcp47(locale))}${percentMark}`;

  useEffect(() => {
    if (!isOpen) return;
    setScale(1);
    lockAppScroll();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      unlockAppScroll();
    };
  }, [isOpen, onClose]);

  useRelockScrollWhileOpen(isOpen);

  if (!isOpen || !src) return null;

  return createPortal(
    <div className="image-viewer" role="dialog" aria-modal="true" aria-label={t("common.viewImage")}>
      <button type="button" className="image-viewer__backdrop" aria-label={t("common.close")} onClick={onClose} />
      <div className="image-viewer__toolbar">
        <button
          type="button"
          className="image-viewer__tool"
          onClick={() => setScale((value) => Math.max(0.5, Number((value - 0.25).toFixed(2))))}
        >
          −
        </button>
        <span className="image-viewer__scale">{scaleLabel}</span>
        <button
          type="button"
          className="image-viewer__tool"
          onClick={() => setScale((value) => Math.min(3, Number((value + 0.25).toFixed(2))))}
        >
          +
        </button>
        <button type="button" className="image-viewer__close" onClick={onClose}>
          {t("common.close")}
        </button>
      </div>
      <div className="image-viewer__stage">
        <img
          className="image-viewer__img"
          src={src}
          alt={resolvedAlt}
          style={{ transform: `scale(${scale})` }}
          draggable={false}
        />
      </div>
    </div>,
    document.body,
  );
}
