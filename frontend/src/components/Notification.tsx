import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../context/I18nContext";
import { isTelegramWebApp } from "../lib/api";
import styles from "./Notification.module.css";

export type NotificationType = "success" | "error" | "warning" | "info";

type NotificationProps = {
  show: boolean;
  message: string;
  type?: NotificationType;
  onClose?: () => void;
  duration?: number;
};

const TYPE_KEYS: Record<NotificationType, string> = {
  success: "common.success",
  error: "common.error",
  warning: "common.warning",
  info: "common.info",
};

const AUTO_DISMISS_MS = 3000;
const EXIT_MS = 520;

export function Notification({
  show,
  message,
  type = "success",
  onClose,
  duration = AUTO_DISMISS_MS,
}: NotificationProps) {
  const { t } = useI18n();
  const [hiding, setHiding] = useState(false);
  const hidingRef = useRef(false);
  const onCloseRef = useRef(onClose);
  const inTelegram = isTelegramWebApp();

  onCloseRef.current = onClose;

  const handleClose = useCallback(() => {
    if (hidingRef.current) return;
    hidingRef.current = true;
    setHiding(true);
    window.setTimeout(() => {
      hidingRef.current = false;
      setHiding(false);
      onCloseRef.current?.();
    }, EXIT_MS);
  }, []);

  useEffect(() => {
    if (!show) {
      hidingRef.current = false;
      setHiding(false);
      return undefined;
    }

    if (!onCloseRef.current || duration <= 0) return undefined;

    const timer = window.setTimeout(handleClose, duration);
    return () => window.clearTimeout(timer);
  }, [show, message, type, duration, handleClose]);

  if (!show) return null;

  return createPortal(
    <div
      className={[
        styles.wrapper,
        hiding ? styles.hide : styles.show,
        inTelegram ? styles.telegram : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div
        className={[styles.notification, styles[type]].join(" ")}
        role="status"
        aria-live="polite"
        onClick={onClose ? handleClose : undefined}
      >
        <div className={styles.glass} aria-hidden="true" />
        <div className={styles.accent} aria-hidden="true" />
        <div className={styles.notificationContent}>
          <div className={styles.notificationTitle}>{t(TYPE_KEYS[type])}</div>
          <div className={styles.notificationMessage}>{message}</div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

interface NotificationContextValue {
  notify: (message: string, type?: NotificationType) => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{
    show: boolean;
    message: string;
    type: NotificationType;
  }>({ show: false, message: "", type: "success" });

  const notify = useCallback((message: string, type: NotificationType = "success") => {
    setToast({ show: true, message, type });
  }, []);

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <Notification
        show={toast.show}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast((prev) => ({ ...prev, show: false }))}
      />
    </NotificationContext.Provider>
  );
}

export function useNotification(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotification must be used within NotificationProvider");
  return ctx;
}
