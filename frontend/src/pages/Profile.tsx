import { useEffect, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { BottomSheet } from "../components/BottomSheet";
import { useNotification } from "../components/Notification";
import CheckmarkBadgeIcon from "../components/icons/CheckmarkBadgeIcon";
import CollaborationIcon from "../components/icons/CollaborationIcon";
import CopyIcon from "../components/icons/CopyIcon";
import CreditCardIcon from "../components/icons/CreditCardIcon";
import InstagramIcon from "../components/icons/InstagramIcon";
import SettingsIcon from "../components/icons/SettingsIcon";
import SocialMediaIcon from "../components/icons/SocialMediaIcon";
import TelegramIcon from "../components/icons/TelegramIcon";
import UserIcon from "../components/icons/UserIcon";
import { useI18n } from "../context/I18nContext";
import { useAuth } from "../hooks/useAuth";
import { useTelegram } from "../hooks/useTelegram";
import { feeLevelLabel, kycLevelLabel } from "../lib/format";
import { resolveDisplayName } from "../lib/displayName";
import type { FeeLevel } from "../lib/api";
import {
  PROFILE_CREDITS_EVENT,
  readProfileCreditsShown,
} from "../lib/profileCredits";
import "../styles/shop-rise.css";
import "./Profile.css";

const defaultAvatar =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4MCIgaGVpZ2h0PSI4MCIgdmlld0JveD0iMCAwIDI0IDI0Ij48cGF0aCBmaWxsPSIjOTRhM2I4IiBkPSJNMTIgMkM2LjQ0IDIgMiA2LjQ4IDIgMTJzNC40OCAxMCAxMCAxMCAxMC00LjQ4IDEwLTEwUzE3LjUyIDIgMTIgMnptMCAzYzEuNjYgMCAzIDEuMzQgMyAzcy0xLjM0IDMtMyAzLTMtMS4zNC0zLTMgMS4zNC0zIDMtM3ptMCAxNC4yYy0yLjUgMC00LjcxLTEuMjgtNi0zLjIyLjAzLTEuOTkgNC0zLjA4IDYtMy4wOCAxLjk5IDAgNS45NyAxLjA5IDYgMy4wOC0xLjI5IDEuOTQtMy41IDMuMjItNiAzLjIyeiIvPjwvc3ZnPg==";

function ArrowIcon({ flip }: { flip?: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="1em"
      height="1em"
      fill="none"
      viewBox="0 0 24 24"
      style={flip ? { transform: "scaleX(-1)" } : undefined}
    >
      <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m15 18-6-6 6-6" />
    </svg>
  );
}

export function ProfilePage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { notify } = useNotification();
  const { openLink, tgUser, haptic } = useTelegram();
  const { t, isRTL } = useI18n();
  const [socialOpen, setSocialOpen] = useState(false);
  const [showCredits, setShowCredits] = useState(() => readProfileCreditsShown());

  useEffect(() => {
    const syncCredits = () => setShowCredits(readProfileCreditsShown());
    window.addEventListener(PROFILE_CREDITS_EVENT, syncCredits);
    return () => window.removeEventListener(PROFILE_CREDITS_EVENT, syncCredits);
  }, []);

  const displayName = resolveDisplayName(user, tgUser, t("profile.defaultName"));
  const avatar = tgUser?.photo_url || defaultAvatar;
  const userId = user?.id ? String(user.id) : "";
  const kyc = user?.kycLevel ?? "none";
  const feeLevel: FeeLevel = user?.feeLevel ?? "bronze";
  const chevron = <ArrowIcon flip={!isRTL} />;

  const copyUserId = async () => {
    if (!userId) return;
    try {
      await navigator.clipboard.writeText(userId);
      notify(t("common.copied"));
    } catch {
      notify(t("profile.copyIdFailed"), "error");
    }
  };

  const menuClick = (action: () => void) => action();

  return (
    <div className="profile">
      <div className="profile__header shop-rise" style={{ "--rise-index": 0 } as CSSProperties}>
        <div className="profile__info">
          <div className="profile__avatar">
            <img src={avatar} alt="" width={56} height={56} />
          </div>
          <div className="profile__text">
            <div className="profile__name">{loading && !user ? "…" : displayName}</div>
            <div className="profile__user-id">
              {t("profile.userId")} <span>{userId || t("profile.userIdMissing")}</span>
              {userId ? (
                <button
                  type="button"
                  className="profile__copy"
                  onClick={() => void copyUserId()}
                  title={t("common.copy")}
                  aria-label={t("common.copy")}
                >
                  <CopyIcon width={14} height={14} />
                </button>
              ) : null}
            </div>
          </div>
          <div className="profile__spacer" />
          <button
            type="button"
            className={`profile__level-badge profile__level-badge--${feeLevel}`}
            onClick={() => {
              haptic("light");
              notify(t("header.levelSoon"), "info");
            }}
            aria-label={`${t("header.userLevel")} ${feeLevelLabel(feeLevel)}`}
          >
            <span className="profile__level-label">{t("header.userLevel")}</span>
            <span className="profile__level-value">{feeLevelLabel(feeLevel)}</span>
          </button>
        </div>
      </div>

      <h5 className="profile__menu-title shop-rise" style={{ "--rise-index": 1 } as CSSProperties}>
        {t("profile.sectionAccount")}
      </h5>
      <div className="profile__menu-box shop-rise" style={{ "--rise-index": 2 } as CSSProperties}>
        <button type="button" className="profile__menu-item" onClick={() => menuClick(() => navigate("/profile/info"))}>
          <span className="profile__menu-start">
            <span className="profile__menu-icon">
              <UserIcon width={18} height={18} />
            </span>
            {t("profile.info")}
          </span>
          {chevron}
        </button>
        <div className="profile__menu-divider" />
        <button type="button" className="profile__menu-item" onClick={() => menuClick(() => navigate("/profile/verify"))}>
          <span className="profile__menu-start">
            <span className="profile__menu-icon">
              <CheckmarkBadgeIcon width={18} height={18} />
            </span>
            {t("profile.verify")}
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="badge" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
              {kycLevelLabel(kyc)}
            </span>
            {chevron}
          </span>
        </button>
        <div className="profile__menu-divider" />
        <button type="button" className="profile__menu-item" onClick={() => menuClick(() => navigate("/profile/bankcard"))}>
          <span className="profile__menu-start">
            <span className="profile__menu-icon">
              <CreditCardIcon width={18} height={18} />
            </span>
            {t("profile.bankCards")}
          </span>
          {chevron}
        </button>
        <div className="profile__menu-divider" />
        <button type="button" className="profile__menu-item" onClick={() => menuClick(() => navigate("/profile/settings"))}>
          <span className="profile__menu-start">
            <span className="profile__menu-icon">
              <SettingsIcon width={18} height={18} />
            </span>
            {t("profile.settings")}
          </span>
          {chevron}
        </button>
      </div>

      <h5 className="profile__menu-title shop-rise" style={{ "--rise-index": 3 } as CSSProperties}>
        {t("profile.sectionOther")}
      </h5>
      <div className="profile__menu-box shop-rise" style={{ "--rise-index": 4 } as CSSProperties}>
        <div className="profile__menu-item profile__menu-item--disabled">
          <span className="profile__menu-start">
            <span className="profile__menu-icon">
              <CollaborationIcon width={18} height={18} />
            </span>
            {t("profile.collab")}
          </span>
          {chevron}
        </div>
        <div className="profile__menu-divider" />
        <button type="button" className="profile__menu-item" onClick={() => menuClick(() => setSocialOpen(true))}>
          <span className="profile__menu-start">
            <span className="profile__menu-icon">
              <SocialMediaIcon width={18} height={18} />
            </span>
            {t("profile.social")}
          </span>
          {chevron}
        </button>
      </div>

      {showCredits ? (
        <p className="profile__credits shop-rise" style={{ "--rise-index": 5 } as CSSProperties}>
          <span>{t("profile.creditsMade")}</span>
          <span className="profile__credits-heart" aria-hidden>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 21s-7.2-4.6-9.6-9A5.4 5.4 0 0 1 12 5.2 5.4 5.4 0 0 1 21.6 12c-2.4 4.4-9.6 9-9.6 9z" />
            </svg>
          </span>
          <span>{t("profile.creditsBy")}</span>
          <a
            className="profile__credits-link"
            href="https://t.me/alire_zw"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => haptic("light")}
          >
            علیرضا میرحسینی
          </a>
        </p>
      ) : null}

      <BottomSheet
        open={socialOpen}
        onClose={() => setSocialOpen(false)}
        title={t("profile.socialTitle")}
        options={[
          {
            value: "telegram",
            label: t("profile.socialTelegram"),
            icon: <TelegramIcon width={18} height={18} color="#0088cc" />,
          },
          {
            value: "instagram",
            label: t("profile.socialInstagram"),
            icon: <InstagramIcon width={18} height={18} color="#E4405F" />,
          },
        ]}
        selectedValue={["telegram", "instagram"]}
        onSelect={(value) => {
          haptic("light");
          if (value === "telegram") {
            openLink("https://t.me/tomanit");
          } else if (value === "instagram") {
            openLink("https://instagram.com/tomanit");
          }
        }}
      />
    </div>
  );
}
