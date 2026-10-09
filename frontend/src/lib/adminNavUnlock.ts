export const ADMIN_NAV_UNLOCK_EVENT = "tomanit:admin-nav-unlock";

const STORAGE_KEY = "tomanit.admin.nav.unlocked";

export function readAdminNavUnlocked(): boolean {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeAdminNavUnlocked(unlocked: boolean) {
  try {
    if (unlocked) {
      sessionStorage.setItem(STORAGE_KEY, "1");
    } else {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // ignore
  }
  window.dispatchEvent(new Event(ADMIN_NAV_UNLOCK_EVENT));
}
