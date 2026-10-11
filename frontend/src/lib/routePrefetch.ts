/** Warm lazy route chunks so tab switches don't wait on first click. */

type Loader = () => Promise<unknown>;

const ROUTE_LOADERS: { match: (path: string) => boolean; load: Loader }[] = [
  { match: (p) => p === "/", load: () => import("../pages/Wallet") },
  { match: (p) => p === "/shop" || p.startsWith("/shop/"), load: () => import("../pages/MyShop") },
  {
    match: (p) => p === "/profile" || p.startsWith("/profile/"),
    load: () => import("../pages/Profile"),
  },
  {
    match: (p) => p === "/support" || p.startsWith("/support/"),
    load: () => import("../pages/support/SupportList"),
  },
  {
    match: (p) => p === "/admin" || p.startsWith("/admin/"),
    load: () => import("../pages/admin/AdminHub"),
  },
];

const warmed = new Set<Loader>();

function normalizePath(path: string): string {
  const bare = path.split("?")[0]?.split("#")[0] || "/";
  return bare.replace(/\/+$/, "") || "/";
}

export function prefetchRoute(path: string): void {
  const normalized = normalizePath(path);
  for (const entry of ROUTE_LOADERS) {
    if (!entry.match(normalized)) continue;
    if (warmed.has(entry.load)) return;
    warmed.add(entry.load);
    void entry.load().catch(() => {
      warmed.delete(entry.load);
    });
    return;
  }
}

/** Prefetch the main bottom-nav destinations. */
export function prefetchMainTabs(): void {
  prefetchRoute("/");
  prefetchRoute("/shop");
  prefetchRoute("/profile");
  prefetchRoute("/support");
}
