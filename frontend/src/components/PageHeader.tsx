import { useCallback, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "../context/I18nContext";
import { useTelegramBackButton } from "../hooks/useTelegramBackButton";
import ArrowBackIcon from "./icons/ArrowBackIcon";
import "./PageHeader.css";

type PageHeaderProps = {
  title: string;
  onBack?: () => void;
  /** @deprecated use action */
  showBack?: boolean;
  action?: ReactNode;
  /** @deprecated use action */
  right?: ReactNode;
};

export function PageHeader({ title, onBack, action, right }: PageHeaderProps) {
  const navigate = useNavigate();
  const { t } = useI18n();
  const resolvedAction = action ?? right ?? null;

  const handleBack = useCallback(() => {
    if (onBack) onBack();
    else navigate(-1);
  }, [navigate, onBack]);

  useTelegramBackButton(handleBack);

  return (
    <header className="page-header">
      <div className="page-header__content">
        <button
          type="button"
          className="page-header__back"
          onClick={handleBack}
          aria-label={t("common.back")}
        >
          <ArrowBackIcon width={20} height={20} />
        </button>
        <h1 className="page-header__title">{title}</h1>
        <div className={`page-header__options${resolvedAction ? " page-header__options--filled" : ""}`}>
          {resolvedAction}
        </div>
      </div>
    </header>
  );
}
