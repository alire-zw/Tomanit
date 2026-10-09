import { useEffect } from "react";
import { onAppResume } from "../lib/appLifecycle";
import { isAppScrollLocked, lockAppScroll } from "../lib/scrollLock";

/**
 * After WebView resume we force-clear sticky scroll locks.
 * Open overlays must re-apply lock so they stay non-scrollable underneath.
 */
export function useRelockScrollWhileOpen(open: boolean) {
  useEffect(() => {
    if (!open) return;
    return onAppResume(() => {
      if (!isAppScrollLocked()) {
        lockAppScroll();
      }
    });
  }, [open]);
}
