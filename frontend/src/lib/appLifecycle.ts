import { forceUnlockAppScroll, isAppScrollLocked } from "./scrollLock";

export type AppResumeInfo = {
  /** How long the document was hidden before this resume (0 if unknown). */
  hiddenForMs: number;
  reason: "visibility" | "focus" | "pageshow" | "telegram";
};

type ResumeListener = (info: AppResumeInfo) => void;

const listeners = new Set<ResumeListener>();
let lastHiddenAt = 0;
let startCount = 0;
let lastResumeAt = 0;

/** Ignore duplicate resume bursts within this window. */
const RESUME_DEBOUNCE_MS = 2_000;
/** Only treat as a real background session after this. */
const MIN_HIDDEN_MS = 3_000;
/** Only force-clear sticky scroll lock after a long sleep. */
const UNLOCK_AFTER_MS = 15_000;

export function onAppResume(listener: ResumeListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emitResume(reason: AppResumeInfo["reason"]) {
  const now = Date.now();
  if (now - lastResumeAt < RESUME_DEBOUNCE_MS) return;
  lastResumeAt = now;

  const hiddenForMs = lastHiddenAt > 0 ? Math.max(0, now - lastHiddenAt) : 0;
  lastHiddenAt = 0;

  // Avoid yanking open sheets mid-work; only clear stale locks after long sleep.
  if (hiddenForMs >= UNLOCK_AFTER_MS && isAppScrollLocked()) {
    forceUnlockAppScroll();
  }

  const info: AppResumeInfo = { hiddenForMs, reason };
  for (const listener of [...listeners]) {
    try {
      listener(info);
    } catch {
      // Ignore listener errors so one failure doesn't block others.
    }
  }
}

function markHidden() {
  if (document.visibilityState === "hidden") {
    lastHiddenAt = Date.now();
  }
}

/**
 * Start global Mini App / WebView lifecycle listeners.
 * Ref-counted so Auth + Telegram hooks can both call it safely.
 */
export function startAppLifecycle(): () => void {
  if (typeof window === "undefined") return () => undefined;

  startCount += 1;
  if (startCount > 1) {
    return () => {
      startCount = Math.max(0, startCount - 1);
    };
  }

  const onVisibility = () => {
    if (document.visibilityState === "hidden") {
      markHidden();
      return;
    }
    if (lastHiddenAt > 0 && Date.now() - lastHiddenAt >= MIN_HIDDEN_MS) {
      emitResume("visibility");
    } else {
      lastHiddenAt = 0;
    }
  };

  const onFocus = () => {
    if (document.visibilityState !== "visible") return;
    if (lastHiddenAt > 0 && Date.now() - lastHiddenAt >= MIN_HIDDEN_MS) {
      emitResume("focus");
    }
  };

  const onPageShow = (event: PageTransitionEvent) => {
    // bfcache restore only — ignore normal first load
    if (event.persisted) {
      emitResume("pageshow");
    }
  };

  const onTelegramActivated = () => {
    // Telegram fires `activated` often; only resume if we were hidden long enough.
    if (lastHiddenAt > 0 && Date.now() - lastHiddenAt >= MIN_HIDDEN_MS) {
      emitResume("telegram");
    }
  };

  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("focus", onFocus);
  window.addEventListener("pageshow", onPageShow);

  const tg = window.Telegram?.WebApp;
  tg?.onEvent?.("activated", onTelegramActivated);

  return () => {
    startCount = Math.max(0, startCount - 1);
    if (startCount > 0) return;

    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("focus", onFocus);
    window.removeEventListener("pageshow", onPageShow);
    tg?.offEvent?.("activated", onTelegramActivated);
  };
}
