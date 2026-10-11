import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../context/I18nContext";
import { useTelegram } from "../hooks/useTelegram";
import { useRelockScrollWhileOpen } from "../hooks/useRelockScrollWhileOpen";
import { parseWalletQrPayload } from "../lib/parseWalletQr";
import { lockAppScroll, unlockAppScroll } from "../lib/scrollLock";
import "./QrAddressScanner.css";

type Html5QrcodeInstance = InstanceType<
  typeof import("html5-qrcode").Html5Qrcode
>;

type Props = {
  open: boolean;
  onClose: () => void;
  onScan: (address: string) => void;
};

async function safeStop(scanner: Html5QrcodeInstance | null): Promise<void> {
  if (!scanner) return;
  try {
    const state = scanner.getState?.();
    // 2 = SCANNING, 3 = PAUSED (html5-qrcode Html5QrcodeScannerState)
    if (state === 2 || state === 3) {
      await scanner.stop();
    }
  } catch {
    /* already stopped / element gone */
  }
}

export function QrAddressScanner({ open, onClose, onScan }: Props) {
  const { t } = useI18n();
  const { haptic } = useTelegram();
  const reactId = useId().replace(/:/g, "");
  const regionId = `qr-scan-${reactId}`;
  const scannerRef = useRef<Html5QrcodeInstance | null>(null);
  const handledRef = useRef(false);
  const onCloseRef = useRef(onClose);
  const onScanRef = useRef(onScan);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  /** Keep portal mounted until camera is fully released (prevents white crash). */
  const [visible, setVisible] = useState(false);

  onCloseRef.current = onClose;
  onScanRef.current = onScan;

  useRelockScrollWhileOpen(visible);

  useEffect(() => {
    if (!visible) return;
    lockAppScroll();
    return () => {
      unlockAppScroll();
    };
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [visible]);

  // Open → show shell first, then start camera.
  useEffect(() => {
    if (open) {
      setVisible(true);
      setError(null);
      setStarting(true);
      handledRef.current = false;
      return;
    }

    // Close requested: stop camera, then unmount portal.
    let cancelled = false;
    void (async () => {
      await safeStop(scannerRef.current);
      scannerRef.current = null;
      if (!cancelled) {
        setVisible(false);
        setStarting(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open]);

  // Start scanner only while visible+open. html5-qrcode is loaded on demand.
  useEffect(() => {
    if (!open || !visible) return;

    let cancelled = false;

    const start = async () => {
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      if (cancelled || handledRef.current) return;

      const host = document.getElementById(regionId);
      if (!host) {
        setError(t("wallet.withdrawScanError"));
        setStarting(false);
        return;
      }

      // Ensure empty host — never call clear() while React owns the node.
      host.innerHTML = "";

      let scanner: Html5QrcodeInstance;
      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import(
          "html5-qrcode"
        );
        if (cancelled || handledRef.current) return;
        scanner = new Html5Qrcode(regionId, {
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          verbose: false,
        });
      } catch {
        if (!cancelled) {
          setStarting(false);
          setError(t("wallet.withdrawScanError"));
        }
        return;
      }
      if (cancelled || handledRef.current) return;
      scannerRef.current = scanner;

      try {
        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 8,
            qrbox: (viewW, viewH) => {
              const side = Math.floor(Math.min(viewW, viewH) * 0.68);
              return { width: Math.max(180, side), height: Math.max(180, side) };
            },
            aspectRatio: 1,
            disableFlip: false,
          },
          (decoded) => {
            if (handledRef.current || cancelled) return;
            const address = parseWalletQrPayload(decoded);
            if (!address || address.length < 8) return;
            handledRef.current = true;
            haptic("medium");

            void (async () => {
              await safeStop(scanner);
              if (scannerRef.current === scanner) scannerRef.current = null;
              // Apply result after camera teardown so React isn't mid-DOM fight.
              onScanRef.current(address);
              onCloseRef.current();
            })();
          },
          () => undefined,
        );
        if (!cancelled && !handledRef.current) setStarting(false);
      } catch {
        if (!cancelled) {
          setStarting(false);
          setError(t("wallet.withdrawScanError"));
        }
      }
    };

    void start();

    return () => {
      cancelled = true;
    };
  }, [open, visible, regionId, haptic, t]);

  // Unmount safety net
  useEffect(() => {
    return () => {
      void safeStop(scannerRef.current);
      scannerRef.current = null;
    };
  }, []);

  if (!visible) return null;

  return createPortal(
    <div
      className="qr-scanner"
      role="dialog"
      aria-modal="true"
      aria-label={t("wallet.withdrawScanTitle")}
    >
      <div className="qr-scanner__stage">
        <div id={regionId} className="qr-scanner__video" />
        <div className="qr-scanner__shade" aria-hidden />
        <div className="qr-scanner__frame" aria-hidden>
          <span className="qr-scanner__corner qr-scanner__corner--tl" />
          <span className="qr-scanner__corner qr-scanner__corner--tr" />
          <span className="qr-scanner__corner qr-scanner__corner--bl" />
          <span className="qr-scanner__corner qr-scanner__corner--br" />
          <span className="qr-scanner__laser" />
        </div>
      </div>

      <div className="qr-scanner__chrome">
        <button
          type="button"
          className="qr-scanner__close"
          onClick={() => {
            haptic("light");
            onClose();
          }}
        >
          {t("common.close")}
        </button>
        <p className="qr-scanner__title">{t("wallet.withdrawScanTitle")}</p>
        <p className="qr-scanner__hint">
          {error ?? (starting ? t("common.loading") : t("wallet.withdrawScanHint"))}
        </p>
      </div>
    </div>,
    document.body,
  );
}
