import { useCallback, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useTelegramBackButton } from "../hooks/useTelegramBackButton";
import { PageHeader } from "./PageHeader";
import "../pages/admin/Admin.css";

type AdminScreenProps = {
  title: string;
  /** Optional toolbar under the header (search / tabs) */
  top?: ReactNode;
  /** Right-side header action */
  meta?: ReactNode;
  onBack?: () => void;
  children: ReactNode;
};

/**
 * Admin sub-page shell — same structure as Panelout:
 * PageHeader + optional top toolbar + flush content (lists/cards own horizontal padding).
 */
export function AdminScreen({
  title,
  top,
  meta,
  onBack,
  children,
}: AdminScreenProps) {
  const navigate = useNavigate();

  const handleBack = useCallback(() => {
    if (onBack) onBack();
    else navigate("/admin");
  }, [navigate, onBack]);

  useTelegramBackButton(handleBack);

  return (
    <div className="admin-section admin-page">
      <PageHeader title={title} onBack={handleBack} action={meta} />
      {top ?? null}
      <div className="admin-screen__content">{children}</div>
    </div>
  );
}
