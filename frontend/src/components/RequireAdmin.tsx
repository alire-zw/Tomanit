import { useEffect, useRef, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useI18n } from "../context/I18nContext";

function GuardShell() {
  const { t } = useI18n();
  return (
    <div className="admin admin-page">
      <p className="admin__muted">{t("common.loading")}</p>
    </div>
  );
}

function useAdminSessionGate() {
  const { loading, sessionVerified, sessionCheckDone, refresh } = useAuth();
  const retriedRef = useRef(false);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    if (sessionVerified || loading || retriedRef.current || !sessionCheckDone) return;
    retriedRef.current = true;
    setRetrying(true);
    void refresh({ silent: true, force: true }).finally(() => {
      setRetrying(false);
    });
  }, [loading, refresh, sessionCheckDone, sessionVerified]);

  const waiting = loading || !sessionCheckDone || retrying;
  return { waiting, sessionVerified };
}

/** Staff (admin | supervisor) — tickets / hub overview. */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { isAdmin } = useAuth();
  const { waiting } = useAdminSessionGate();

  if (waiting) return <GuardShell />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}

/** Full admin only — money, users, settings, gateways. */
export function RequireFullAdmin({ children }: { children: ReactNode }) {
  const { isFullAdmin } = useAuth();
  const { waiting } = useAdminSessionGate();

  if (waiting) return <GuardShell />;
  if (!isFullAdmin) return <Navigate to="/admin" replace />;
  return <>{children}</>;
}
