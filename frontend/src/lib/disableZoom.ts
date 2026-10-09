/** Lock page scale — no pinch / focus zoom in Telegram & iOS WebView. */

const VIEWPORT_CONTENT =
  "width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no, viewport-fit=cover";

function lockViewportMeta() {
  let meta = document.querySelector('meta[name="viewport"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", "viewport");
    document.head.appendChild(meta);
  }
  if (meta.getAttribute("content") !== VIEWPORT_CONTENT) {
    meta.setAttribute("content", VIEWPORT_CONTENT);
  }
}

function resetVisualViewport() {
  lockViewportMeta();
  if (window.scrollX !== 0 || window.scrollY < 0) {
    window.scrollTo(0, Math.max(0, window.scrollY));
  }
}

export function disableAppZoom() {
  lockViewportMeta();

  const blockGesture = (event: Event) => {
    event.preventDefault();
  };

  // Older WebKit pinch gestures
  document.addEventListener("gesturestart", blockGesture, { passive: false });
  document.addEventListener("gesturechange", blockGesture, { passive: false });
  document.addEventListener("gestureend", blockGesture, { passive: false });

  // Multi-touch pinch
  document.addEventListener(
    "touchmove",
    (event) => {
      if (event.touches.length > 1) event.preventDefault();
    },
    { passive: false },
  );

  // Ctrl/⌘ + wheel zoom (desktop / some WebViews)
  document.addEventListener(
    "wheel",
    (event) => {
      if (event.ctrlKey || event.metaKey) event.preventDefault();
    },
    { passive: false },
  );

  // Keyboard zoom shortcuts
  document.addEventListener("keydown", (event) => {
    if (!(event.ctrlKey || event.metaKey)) return;
    if (event.key === "+" || event.key === "-" || event.key === "=" || event.key === "0") {
      event.preventDefault();
    }
  });

  const vv = window.visualViewport;
  if (vv) {
    vv.addEventListener("resize", resetVisualViewport);
    vv.addEventListener("scroll", resetVisualViewport);
  }

  // Some WebViews rewrite viewport on focus — keep it locked
  document.addEventListener("focusin", () => {
    lockViewportMeta();
    requestAnimationFrame(resetVisualViewport);
  });
}
