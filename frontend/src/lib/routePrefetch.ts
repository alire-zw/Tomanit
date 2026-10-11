/** Warm lazy route chunks so section switches don't wait on first click. */

type Loader = () => Promise<unknown>;

const ROUTE_LOADERS: { match: (path: string) => boolean; load: Loader }[] = [
  { match: (p) => p === "/", load: () => import("../pages/Wallet") },
  { match: (p) => p === "/shop", load: () => import("../pages/MyShop") },
  {
    match: (p) => p === "/shop/transactions" || p.startsWith("/shop/transactions/"),
    load: () => import("../pages/shop/ShopTransactionsPage"),
  },
  {
    match: (p) => p === "/shop/settlements",
    load: () => import("../pages/shop/ShopSettlementsPage"),
  },
  {
    match: (p) => p === "/shop/payment-links/new",
    load: () => import("../pages/shop/ShopPaymentLinkNewPage"),
  },
  {
    match: (p) => p === "/shop/payment-links" || p.startsWith("/shop/payment-links/"),
    load: () => import("../pages/shop/ShopPaymentLinksPage"),
  },
  {
    match: (p) => p === "/shop/stores/new",
    load: () => import("../pages/shop/ShopStoreNewPage"),
  },
  {
    match: (p) => p === "/shop/stores" || p.startsWith("/shop/stores/"),
    load: () => import("../pages/shop/ShopStoresPage"),
  },
  { match: (p) => p === "/shop/stats", load: () => import("../pages/shop/ShopStatsPage") },
  {
    match: (p) => p === "/shop/report-bot",
    load: () => import("../pages/shop/ShopReportBotPage"),
  },
  { match: (p) => p === "/shop/api", load: () => import("../pages/shop/ShopApiPage") },
  {
    match: (p) => p === "/shop/settings",
    load: () => import("../pages/shop/ShopGatewaySettingsPage"),
  },
  {
    match: (p) => p === "/profile" || p.startsWith("/profile/"),
    load: () => import("../pages/Profile"),
  },
  {
    match: (p) => p === "/support" || p.startsWith("/support/"),
    load: () => import("../pages/support/SupportList"),
  },
  {
    match: (p) => p === "/admin",
    load: () => import("../pages/admin/AdminHub"),
  },
  {
    match: (p) => p === "/admin/users" || p.startsWith("/admin/users/"),
    load: () => import("../pages/admin/AdminUsers"),
  },
  {
    match: (p) => p === "/admin/tickets",
    load: () => import("../pages/admin/AdminTickets"),
  },
  {
    match: (p) => p === "/admin/shops" || p.startsWith("/admin/shops/"),
    load: () => import("../pages/admin/AdminShops"),
  },
  {
    match: (p) => p === "/admin/settlements" || p.startsWith("/admin/settlements/"),
    load: () => import("../pages/admin/AdminSettlements"),
  },
  {
    match: (p) => p === "/admin/gateways",
    load: () => import("../pages/admin/AdminGateways"),
  },
  {
    match: (p) => p === "/admin/invoices",
    load: () => import("../pages/admin/AdminInvoices"),
  },
  {
    match: (p) => p.startsWith("/wallet/"),
    load: () => import("../pages/wallet/WalletAssetPage"),
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

/** Warm shop hub section chunks after the hub itself is on screen. */
export function prefetchShopSections(): void {
  for (const path of [
    "/shop/transactions",
    "/shop/settlements",
    "/shop/payment-links",
    "/shop/stores",
    "/shop/stats",
    "/shop/report-bot",
    "/shop/api",
    "/shop/settings",
  ]) {
    prefetchRoute(path);
  }
}

/** Warm admin section chunks after hub is visible. */
export function prefetchAdminSections(): void {
  for (const path of [
    "/admin/users",
    "/admin/tickets",
    "/admin/shops",
    "/admin/settlements",
    "/admin/gateways",
    "/admin/invoices",
  ]) {
    prefetchRoute(path);
  }
}
