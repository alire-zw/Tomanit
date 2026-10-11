/**
 * Suspense fallback while route chunks load.
 * Logo splash lives outside #root (index.html) so it can fade out smoothly;
 * this only keeps the themed background underneath.
 */
export function PageBoot() {
  return <div className="app-splash app-splash--fallback" aria-hidden />;
}
