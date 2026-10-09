import { useState } from "react";
import { PageHeader } from "../../components/PageHeader";
import { useNotification } from "../../components/Notification";
import { useI18n } from "../../context/I18nContext";
import "./ProfileInfo.css";

export function ProfileSecurityPage() {
  const { notify } = useNotification();
  const { t } = useI18n();
  const [twoFa, setTwoFa] = useState(false);
  const [loginAlert, setLoginAlert] = useState(true);

  return (
    <div className="profile-info">
      <PageHeader title={t("security.title")} />
      <div className="profile-info__content">
        <h5 className="profile-info__section-title">{t("security.sectionOptions")}</h5>
        <div className="profile-info__items">
          <label className="profile-info__item" style={{ cursor: "pointer" }}>
            <div className="profile-info__item-start">
              <div>
                <div className="profile-info__label">{t("security.twoFa")}</div>
                <div className="profile-info__value">{t("security.twoFaHint")}</div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={twoFa}
              onChange={(e) => {
                setTwoFa(e.target.checked);
                notify(e.target.checked ? t("security.twoFaOn") : t("security.twoFaOff"));
              }}
            />
          </label>
          <div className="profile-info__divider" />
          <label className="profile-info__item" style={{ cursor: "pointer" }}>
            <div className="profile-info__item-start">
              <div>
                <div className="profile-info__label">{t("security.loginAlert")}</div>
              </div>
            </div>
            <input type="checkbox" checked={loginAlert} onChange={(e) => setLoginAlert(e.target.checked)} />
          </label>
        </div>

        <h5 className="profile-info__section-title">{t("security.sectionPin")}</h5>
        <div className="profile-info__items">
          <div className="profile-info__item" style={{ flexDirection: "column", alignItems: "stretch", gap: 10 }}>
            <p className="profile-info__value" style={{ margin: 0 }}>
              {t("security.pinHint")}
            </p>
            <button
              type="button"
              className="profile-info__edit-btn"
              onClick={() => notify(t("common.soon"), "info")}
            >
              {t("security.setPin")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
