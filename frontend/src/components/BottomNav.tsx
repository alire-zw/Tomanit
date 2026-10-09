import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NavLink } from "react-router-dom";
import { useI18n } from "../context/I18nContext";
import { useAuth } from "../hooks/useAuth";
import { useTelegram } from "../hooks/useTelegram";
import {
  ADMIN_NAV_UNLOCK_EVENT,
  readAdminNavUnlocked,
  writeAdminNavUnlocked,
} from "../lib/adminNavUnlock";
import {
  readProfileCreditsShown,
  writeProfileCreditsShown,
} from "../lib/profileCredits";
import { adminNavItem, iconSize, navItems } from "./navItems";
import "./BottomNav.css";

/** Secret unlock: tap Profile this many times within the window. */
const PROFILE_UNLOCK_TAPS = 3;
const PROFILE_UNLOCK_WINDOW_MS = 4000;

export function BottomNav() {
  const { t } = useI18n();
  const { haptic } = useTelegram();
  const { isAdmin, isStaffCandidate } = useAuth();
  const profileTapCountRef = useRef(0);
  const profileTapTimerRef = useRef<number | null>(null);
  const [adminNavUnlocked, setAdminNavUnlocked] = useState(() => readAdminNavUnlocked());

  useEffect(() => {
    const syncAdminNav = () => setAdminNavUnlocked(readAdminNavUnlocked());
    window.addEventListener(ADMIN_NAV_UNLOCK_EVENT, syncAdminNav);
    return () => window.removeEventListener(ADMIN_NAV_UNLOCK_EVENT, syncAdminNav);
  }, []);

  // Once /me confirms staff, keep admin tab available for this session.
  useEffect(() => {
    if (isAdmin && !readAdminNavUnlocked()) {
      writeAdminNavUnlocked(true);
    }
  }, [isAdmin]);

  const items = useMemo(() => {
    if (!isStaffCandidate || !adminNavUnlocked) return navItems;
    const next = [...navItems];
    const profileIndex = next.findIndex((item) => item.id === "profile");
    if (profileIndex === -1) {
      next.push(adminNavItem);
      return next;
    }
    next.splice(profileIndex + 1, 0, adminNavItem);
    return next;
  }, [adminNavUnlocked, isStaffCandidate]);

  useEffect(() => {
    return () => {
      if (profileTapTimerRef.current !== null) {
        window.clearTimeout(profileTapTimerRef.current);
      }
    };
  }, []);

  const handleProfileTap = useCallback(() => {
    haptic("light");

    const needsCredits = !readProfileCreditsShown();
    // Use cached staff role so taps work before /me finishes verifying.
    const needsAdminUnlock = isStaffCandidate && !readAdminNavUnlocked();

    if (!needsCredits && !needsAdminUnlock) return;

    profileTapCountRef.current += 1;

    if (profileTapTimerRef.current !== null) {
      window.clearTimeout(profileTapTimerRef.current);
    }

    profileTapTimerRef.current = window.setTimeout(() => {
      profileTapCountRef.current = 0;
      profileTapTimerRef.current = null;
    }, PROFILE_UNLOCK_WINDOW_MS);

    if (profileTapCountRef.current < PROFILE_UNLOCK_TAPS) return;

    profileTapCountRef.current = 0;
    if (profileTapTimerRef.current !== null) {
      window.clearTimeout(profileTapTimerRef.current);
      profileTapTimerRef.current = null;
    }

    if (needsCredits) writeProfileCreditsShown(true);
    if (needsAdminUnlock) writeAdminNavUnlocked(true);
    haptic("medium");
  }, [haptic, isStaffCandidate]);

  return (
    <nav className="bottom-nav" aria-label={t("nav.main")}>
      <div className="bottom-nav__inner">
        {items.map((item) => {
          const Icon = item.icon;
          const ActiveIcon = item.activeIcon;
          const isProfile = item.id === "profile";

          return (
            <NavLink
              key={item.id}
              to={item.path}
              end={item.path === "/" || item.path === "/admin"}
              className={({ isActive }) =>
                `bottom-nav__item${isActive ? " bottom-nav__item--active" : ""}`
              }
              onClick={isProfile ? handleProfileTap : () => haptic("light")}
            >
              {({ isActive }) => (
                <>
                  <span className="bottom-nav__icon">
                    <span
                      className={`bottom-nav__glyph${isActive ? "" : " bottom-nav__glyph--visible"}`}
                    >
                      <Icon {...iconSize} />
                    </span>
                    <span
                      className={`bottom-nav__glyph${isActive ? " bottom-nav__glyph--visible" : ""}`}
                    >
                      <ActiveIcon {...iconSize} />
                    </span>
                  </span>
                  <span className="bottom-nav__label">{t(item.labelKey)}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
