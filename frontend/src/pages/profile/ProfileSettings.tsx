import { useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { BottomSheet } from "../../components/BottomSheet";
import { PageHeader } from "../../components/PageHeader";
import AiAutoRotateIcon from "../../components/icons/ai-auto-rotate-stroke-rounded";
import Moon01Icon from "../../components/icons/moon-01-stroke-rounded";
import Sun01Icon from "../../components/icons/sun-01-stroke-rounded";
import { useI18n } from "../../context/I18nContext";
import { useTheme } from "../../context/ThemeContext";
import { useTelegram } from "../../hooks/useTelegram";
import { LOCALES, type LocaleCode } from "../../i18n";
import type { ThemeMode } from "../../lib/theme";
import "../../styles/shop-rise.css";
import "./ProfileInfo.css";

export function ProfileSettingsPage() {
  const navigate = useNavigate();
  const { haptic } = useTelegram();
  const { themeMode, setThemeMode } = useTheme();
  const { t, locale, setLocale } = useI18n();
  const [themeOpen, setThemeOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);

  return (
    <div className="profile-info">
      <div className="shop-rise" style={{ "--rise-index": 0 } as CSSProperties}>
        <PageHeader title={t("settings.title")} onBack={() => navigate("/profile")} />
      </div>
      <div className="profile-info__content">
        <h5 className="profile-info__section-title shop-rise" style={{ "--rise-index": 1 } as CSSProperties}>
          {t("settings.sectionAppearance")}
        </h5>
        <div className="profile-info__items shop-rise" style={{ "--rise-index": 2 } as CSSProperties}>
          <button
            type="button"
            className="profile-info__item"
            style={{
              width: "100%",
              border: "none",
              background: "transparent",
              cursor: "pointer",
              font: "inherit",
              color: "inherit",
              textAlign: "start",
            }}
            onClick={() => {
              haptic("light");
              setThemeOpen(true);
            }}
          >
            <div className="profile-info__item-start">
              <div>
                <div className="profile-info__label">{t("settings.theme")}</div>
                <div className="profile-info__value">{t(`settings.themeValue.${themeMode}`)}</div>
              </div>
            </div>
          </button>
          <div className="profile-info__divider" />
          <button
            type="button"
            className="profile-info__item"
            style={{
              width: "100%",
              border: "none",
              background: "transparent",
              cursor: "pointer",
              font: "inherit",
              color: "inherit",
              textAlign: "start",
            }}
            onClick={() => {
              haptic("light");
              setLangOpen(true);
            }}
          >
            <div className="profile-info__item-start">
              <div>
                <div className="profile-info__label">{t("settings.language")}</div>
                <div className="profile-info__value">
                  {LOCALES.find((item) => item.code === locale)?.nativeName ?? locale}
                </div>
              </div>
            </div>
          </button>
        </div>
      </div>

      <BottomSheet
        open={themeOpen}
        onClose={() => setThemeOpen(false)}
        title={t("settings.themePick")}
        options={[
          { value: "auto", label: t("settings.themeValue.auto"), icon: <AiAutoRotateIcon width={18} height={18} /> },
          { value: "light", label: t("settings.themeValue.light"), icon: <Sun01Icon width={18} height={18} /> },
          { value: "dark", label: t("settings.themeValue.dark"), icon: <Moon01Icon width={18} height={18} /> },
        ]}
        selectedValue={themeMode}
        onSelect={(value) => {
          haptic("light");
          setThemeMode(value as ThemeMode);
        }}
      />

      <BottomSheet
        open={langOpen}
        onClose={() => setLangOpen(false)}
        title={t("settings.languagePick")}
        options={LOCALES.map((item) => ({
          value: item.code,
          label: item.nativeName,
        }))}
        selectedValue={locale}
        onSelect={(value) => {
          haptic("light");
          setLocale(value as LocaleCode);
        }}
      />
    </div>
  );
}
