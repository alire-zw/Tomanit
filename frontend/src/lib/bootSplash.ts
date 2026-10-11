const SPLASH_ID = "boot-splash";
/** Keep the node until the fade fully finishes. */
const HIDE_MS = 950;
/** Tiny hold so the home screen paints under the splash before fade starts. */
const HOLD_MS = 120;

/** Soft-dismiss the HTML boot splash (fade out, then remove). */
export function dismissBootSplash(): void {
  if (typeof document === "undefined") return;
  const el = document.getElementById(SPLASH_ID);
  if (!el || el.dataset.dismissing === "1") return;

  el.dataset.dismissing = "1";
  el.setAttribute("aria-busy", "false");
  // Let taps through immediately — don't block nav while the fade plays.
  el.style.pointerEvents = "none";

  window.setTimeout(() => {
    // Double rAF so the opacity:1 style is committed before transitioning.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.classList.add("app-splash--hide");
      });
    });
  }, HOLD_MS);

  const cleanup = () => {
    el.remove();
  };
  el.addEventListener(
    "transitionend",
    (event) => {
      if (event.target === el && event.propertyName === "opacity") cleanup();
    },
    { once: true },
  );
  window.setTimeout(cleanup, HOLD_MS + HIDE_MS);
}
