const LINK_ID = "tomanit-latin-font";

/** Load Apple.woff stylesheet only when a non-Persian locale is active. */
export function ensureLatinFont(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(LINK_ID)) return;

  const link = document.createElement("link");
  link.id = LINK_ID;
  link.rel = "stylesheet";
  link.href = "/fonts/apple.css";
  document.head.appendChild(link);
}
