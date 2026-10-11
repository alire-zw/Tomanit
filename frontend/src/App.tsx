import { lazy, Suspense, type ComponentType, type ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import { NotificationProvider } from "./components/Notification";
import { PageBoot } from "./components/PageBoot";
import "./components/PageBoot.css";
import { RequireAdmin, RequireFullAdmin } from "./components/RequireAdmin";
import { AuthProvider } from "./hooks/useAuth";
/** Hot bottom-nav tabs — eager so switches never wait on a chunk. */
import { WalletPage } from "./pages/Wallet";
import { MyShopPage } from "./pages/MyShop";
import { ProfilePage } from "./pages/Profile";
import { SupportListPage } from "./pages/support/SupportList";

/** Route-level code splitting for secondary screens. */
function lazyNamed<TModule, TKey extends keyof TModule>(
  loader: () => Promise<TModule>,
  exportName: TKey,
) {
  return lazy(async () => {
    const mod = await loader();
    return { default: mod[exportName] as ComponentType<Record<string, never>> };
  });
}

const ProfileInfoPage = lazyNamed(() => import("./pages/profile/ProfileInfo"), "ProfileInfoPage");
const ProfileVerifyPage = lazyNamed(() => import("./pages/profile/ProfileVerify"), "ProfileVerifyPage");
const ProfileVerifyLevelsPage = lazyNamed(
  () => import("./pages/profile/ProfileVerifyLevels"),
  "ProfileVerifyLevelsPage",
);
const ProfileVerifyIdentityPage = lazyNamed(
  () => import("./pages/profile/ProfileVerifyIdentity"),
  "ProfileVerifyIdentityPage",
);
const ProfileVerifyCardPage = lazyNamed(
  () => import("./pages/profile/ProfileVerifyCard"),
  "ProfileVerifyCardPage",
);
const ProfileVerifyReviewPage = lazyNamed(
  () => import("./pages/profile/ProfileVerifyReview"),
  "ProfileVerifyReviewPage",
);
const ProfileBankcardPage = lazyNamed(
  () => import("./pages/profile/ProfileBankcard"),
  "ProfileBankcardPage",
);
const ProfileSettingsPage = lazyNamed(
  () => import("./pages/profile/ProfileSettings"),
  "ProfileSettingsPage",
);
const SupportListPage = lazyNamed(() => import("./pages/support/SupportList"), "SupportListPage");
const SupportNewPage = lazyNamed(() => import("./pages/support/SupportNew"), "SupportNewPage");
const SupportDetailPage = lazyNamed(
  () => import("./pages/support/SupportDetail"),
  "SupportDetailPage",
);
const AdminHubPage = lazyNamed(() => import("./pages/admin/AdminHub"), "AdminHubPage");
const AdminUsersPage = lazyNamed(() => import("./pages/admin/AdminUsers"), "AdminUsersPage");
const AdminUserDetailPage = lazyNamed(
  () => import("./pages/admin/AdminUserDetail"),
  "AdminUserDetailPage",
);
const AdminTicketsPage = lazyNamed(() => import("./pages/admin/AdminTickets"), "AdminTicketsPage");
const AdminInvoicesPage = lazyNamed(
  () => import("./pages/admin/AdminInvoices"),
  "AdminInvoicesPage",
);
const AdminPricingPage = lazyNamed(() => import("./pages/admin/AdminPricing"), "AdminPricingPage");
const AdminPaymentPage = lazyNamed(() => import("./pages/admin/AdminPayment"), "AdminPaymentPage");
const AdminGatewaysPage = lazyNamed(
  () => import("./pages/admin/AdminGateways"),
  "AdminGatewaysPage",
);
const AdminMasterWalletsPage = lazyNamed(
  () => import("./pages/admin/AdminMasterWallets"),
  "AdminMasterWalletsPage",
);
const AdminSupportSettingsPage = lazyNamed(
  () => import("./pages/admin/AdminSupportSettings"),
  "AdminSupportSettingsPage",
);
const AdminChannelsPage = lazyNamed(
  () => import("./pages/admin/AdminChannels"),
  "AdminChannelsPage",
);
const AdminShopsPage = lazyNamed(() => import("./pages/admin/AdminShops"), "AdminShopsPage");
const AdminShopStatsPage = lazyNamed(
  () => import("./pages/admin/AdminShopStatsPage"),
  "AdminShopStatsPage",
);
const AdminSettlementsPage = lazyNamed(
  () => import("./pages/admin/AdminSettlements"),
  "AdminSettlementsPage",
);
const AdminSettlementDetailPage = lazyNamed(
  () => import("./pages/admin/AdminSettlementDetail"),
  "AdminSettlementDetailPage",
);
const WalletAssetPage = lazyNamed(
  () => import("./pages/wallet/WalletAssetPage"),
  "WalletAssetPage",
);
const WalletDepositCoinListPage = lazyNamed(
  () => import("./pages/wallet/WalletDepositCoinListPage"),
  "WalletDepositCoinListPage",
);
const WalletDepositPage = lazyNamed(
  () => import("./pages/wallet/WalletDepositPage"),
  "WalletDepositPage",
);
const WalletDepositAddressPage = lazyNamed(
  () => import("./pages/wallet/WalletDepositAddressPage"),
  "WalletDepositAddressPage",
);
const WalletTomanDepositPage = lazyNamed(
  () => import("./pages/wallet/WalletTomanDepositPage"),
  "WalletTomanDepositPage",
);
const WalletGatewayChargePage = lazyNamed(
  () => import("./pages/wallet/WalletGatewayChargePage"),
  "WalletGatewayChargePage",
);
const WalletDepositKycPage = lazyNamed(
  () => import("./pages/wallet/WalletDepositKycPage"),
  "WalletDepositKycPage",
);
const WalletGatewayResultPage = lazyNamed(
  () => import("./pages/wallet/WalletGatewayResultPage"),
  "WalletGatewayResultPage",
);
const WalletTomanPage = lazyNamed(
  () => import("./pages/wallet/WalletTomanPage"),
  "WalletTomanPage",
);
const WalletWithdrawCoinListPage = lazyNamed(
  () => import("./pages/wallet/WalletWithdrawCoinListPage"),
  "WalletWithdrawCoinListPage",
);
const WalletWithdrawAmountPage = lazyNamed(
  () => import("./pages/wallet/WalletWithdrawAmountPage"),
  "WalletWithdrawAmountPage",
);
const WalletWithdrawConfirmPage = lazyNamed(
  () => import("./pages/wallet/WalletWithdrawConfirmPage"),
  "WalletWithdrawConfirmPage",
);
const WalletWithdrawFormPage = lazyNamed(
  () => import("./pages/wallet/WalletWithdrawFormPage"),
  "WalletWithdrawFormPage",
);
const WalletWithdrawNetworkPage = lazyNamed(
  () => import("./pages/wallet/WalletWithdrawNetworkPage"),
  "WalletWithdrawNetworkPage",
);
const WalletWithdrawSuccessPage = lazyNamed(
  () => import("./pages/wallet/WalletWithdrawSuccessPage"),
  "WalletWithdrawSuccessPage",
);
const ShopStoresPage = lazyNamed(() => import("./pages/shop/ShopStoresPage"), "ShopStoresPage");
const ShopStoreNewPage = lazyNamed(
  () => import("./pages/shop/ShopStoreNewPage"),
  "ShopStoreNewPage",
);
const ShopPaymentLinksPage = lazyNamed(
  () => import("./pages/shop/ShopPaymentLinksPage"),
  "ShopPaymentLinksPage",
);
const ShopPaymentLinkNewPage = lazyNamed(
  () => import("./pages/shop/ShopPaymentLinkNewPage"),
  "ShopPaymentLinkNewPage",
);
const MerchantPayPage = lazyNamed(
  () => import("./pages/shop/MerchantPayPage"),
  "MerchantPayPage",
);
const MerchantPayResultPage = lazyNamed(
  () => import("./pages/shop/MerchantPayResultPage"),
  "MerchantPayResultPage",
);
const ShopTransactionsPage = lazyNamed(
  () => import("./pages/shop/ShopTransactionsPage"),
  "ShopTransactionsPage",
);
const ShopTransactionDetailPage = lazyNamed(
  () => import("./pages/shop/ShopTransactionDetailPage"),
  "ShopTransactionDetailPage",
);
const ShopSettlementsPage = lazyNamed(
  () => import("./pages/shop/ShopSettlementsPage"),
  "ShopSettlementsPage",
);
const ShopStatsPage = lazyNamed(() => import("./pages/shop/ShopStatsPage"), "ShopStatsPage");
const ShopApiPage = lazyNamed(() => import("./pages/shop/ShopApiPage"), "ShopApiPage");
const ShopGatewaySettingsPage = lazyNamed(
  () => import("./pages/shop/ShopGatewaySettingsPage"),
  "ShopGatewaySettingsPage",
);
const ShopReportBotPage = lazyNamed(
  () => import("./pages/shop/ShopReportBotPage"),
  "ShopReportBotPage",
);
const MerchantApiDocsPage = lazyNamed(
  () => import("./pages/shop/MerchantApiDocsPage"),
  "MerchantApiDocsPage",
);
const NotificationsPage = lazyNamed(() => import("./pages/Notifications"), "NotificationsPage");

function LazyRoute({ children }: { children: ReactNode }) {
  // Local boundary only — never wrap the whole router (that blanks BottomNav).
  return <Suspense fallback={<PageBoot />}>{children}</Suspense>;
}

export default function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <BrowserRouter>
          <Routes>
              <Route element={<AppLayout />}>
                <Route path="/" element={<WalletPage />} />
                <Route path="/shop" element={<MyShopPage />} />
                <Route path="/shop/stores" element={<ShopStoresPage />} />
                <Route path="/shop/stores/new" element={<ShopStoreNewPage />} />
                <Route path="/shop/payment-links" element={<ShopPaymentLinksPage />} />
                <Route path="/shop/payment-links/new" element={<ShopPaymentLinkNewPage />} />
                <Route path="/shop/gateways" element={<Navigate to="/shop/payment-links" replace />} />
                <Route
                  path="/shop/gateways/new"
                  element={<Navigate to="/shop/payment-links/new" replace />}
                />
                <Route path="/shop/transactions" element={<ShopTransactionsPage />} />
                <Route path="/shop/transactions/:id" element={<ShopTransactionDetailPage />} />
                <Route path="/shop/settlements" element={<ShopSettlementsPage />} />
                <Route path="/shop/stats" element={<ShopStatsPage />} />
                <Route path="/shop/api" element={<ShopApiPage />} />
                <Route path="/shop/settings" element={<ShopGatewaySettingsPage />} />
                <Route path="/shop/report-bot" element={<ShopReportBotPage />} />
                <Route path="/docs/merchant-api" element={<MerchantApiDocsPage />} />
                <Route path="/p/result" element={<MerchantPayResultPage />} />
                <Route path="/pay/result" element={<MerchantPayResultPage />} />
                <Route path="/pay/:code" element={<MerchantPayPage />} />
                <Route path="/p/:code" element={<MerchantPayPage />} />
                <Route path="/wallet" element={<Navigate to="/" replace />} />
                <Route path="/wallet/deposit/toman" element={<WalletTomanDepositPage />} />
                <Route path="/wallet/deposit/gateway/result" element={<WalletGatewayResultPage />} />
                <Route path="/wallet/deposit/gateway/kyc" element={<WalletDepositKycPage />} />
                <Route path="/wallet/deposit/gateway" element={<WalletGatewayChargePage />} />
                <Route path="/wallet/deposit" element={<WalletDepositCoinListPage />} />
                <Route
                  path="/wallet/:assetId/deposit/:networkId"
                  element={<WalletDepositAddressPage />}
                />
                <Route path="/wallet/:assetId/deposit" element={<WalletDepositPage />} />
                <Route path="/wallet/withdraw" element={<WalletWithdrawCoinListPage />} />
                <Route
                  path="/wallet/:assetId/withdraw/:networkId/amount"
                  element={<WalletWithdrawAmountPage />}
                />
                <Route
                  path="/wallet/:assetId/withdraw/:networkId/confirm"
                  element={<WalletWithdrawConfirmPage />}
                />
                <Route
                  path="/wallet/:assetId/withdraw/:networkId/success"
                  element={<WalletWithdrawSuccessPage />}
                />
                <Route
                  path="/wallet/:assetId/withdraw/:networkId"
                  element={<WalletWithdrawFormPage />}
                />
                <Route path="/wallet/:assetId/withdraw" element={<WalletWithdrawNetworkPage />} />
                <Route path="/wallet/toman" element={<WalletTomanPage />} />
                <Route path="/wallet/:assetId" element={<WalletAssetPage />} />
                <Route path="/notifications" element={<NotificationsPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route
                  path="/profile/info"
                  element={
                    <LazyRoute>
                      <ProfileInfoPage />
                    </LazyRoute>
                  }
                />
                <Route
                  path="/profile/verify"
                  element={
                    <LazyRoute>
                      <ProfileVerifyLevelsPage />
                    </LazyRoute>
                  }
                />
                <Route
                  path="/profile/verify/terms"
                  element={
                    <LazyRoute>
                      <ProfileVerifyPage />
                    </LazyRoute>
                  }
                />
                <Route
                  path="/profile/verify/identity"
                  element={
                    <LazyRoute>
                      <ProfileVerifyIdentityPage />
                    </LazyRoute>
                  }
                />
                <Route
                  path="/profile/verify/card"
                  element={
                    <LazyRoute>
                      <ProfileVerifyCardPage />
                    </LazyRoute>
                  }
                />
                <Route
                  path="/profile/verify/review"
                  element={
                    <LazyRoute>
                      <ProfileVerifyReviewPage />
                    </LazyRoute>
                  }
                />
                <Route
                  path="/profile/bankcard"
                  element={
                    <LazyRoute>
                      <ProfileBankcardPage />
                    </LazyRoute>
                  }
                />
                <Route
                  path="/profile/settings"
                  element={
                    <LazyRoute>
                      <ProfileSettingsPage />
                    </LazyRoute>
                  }
                />
                <Route path="/support" element={<SupportListPage />} />
                <Route
                  path="/support/new"
                  element={
                    <LazyRoute>
                      <SupportNewPage />
                    </LazyRoute>
                  }
                />
                <Route
                  path="/support/:id"
                  element={
                    <LazyRoute>
                      <SupportDetailPage />
                    </LazyRoute>
                  }
                />
                <Route
                  path="/admin"
                  element={
                    <LazyRoute>
                      <RequireAdmin>
                        <AdminHubPage />
                      </RequireAdmin>
                    </LazyRoute>
                  }
                />
                <Route
                  path="/admin/users"
                  element={
                    <LazyRoute>
                      <RequireFullAdmin>
                        <AdminUsersPage />
                      </RequireFullAdmin>
                    </LazyRoute>
                  }
                />
                <Route
                  path="/admin/users/:id"
                  element={
                    <LazyRoute>
                      <RequireFullAdmin>
                        <AdminUserDetailPage />
                      </RequireFullAdmin>
                    </LazyRoute>
                  }
                />
                <Route
                  path="/admin/tickets"
                  element={
                    <LazyRoute>
                      <RequireAdmin>
                        <AdminTicketsPage />
                      </RequireAdmin>
                    </LazyRoute>
                  }
                />
                <Route
                  path="/admin/shops"
                  element={
                    <LazyRoute>
                      <RequireAdmin>
                        <AdminShopsPage />
                      </RequireAdmin>
                    </LazyRoute>
                  }
                />
                <Route
                  path="/admin/shops/stats"
                  element={
                    <LazyRoute>
                      <RequireAdmin>
                        <AdminShopStatsPage />
                      </RequireAdmin>
                    </LazyRoute>
                  }
                />
                <Route
                  path="/admin/settlements"
                  element={
                    <LazyRoute>
                      <RequireAdmin>
                        <AdminSettlementsPage />
                      </RequireAdmin>
                    </LazyRoute>
                  }
                />
                <Route
                  path="/admin/settlements/:id"
                  element={
                    <LazyRoute>
                      <RequireAdmin>
                        <AdminSettlementDetailPage />
                      </RequireAdmin>
                    </LazyRoute>
                  }
                />
                <Route
                  path="/admin/invoices"
                  element={
                    <LazyRoute>
                      <RequireFullAdmin>
                        <AdminInvoicesPage />
                      </RequireFullAdmin>
                    </LazyRoute>
                  }
                />
                <Route
                  path="/admin/pricing"
                  element={
                    <LazyRoute>
                      <RequireFullAdmin>
                        <AdminPricingPage />
                      </RequireFullAdmin>
                    </LazyRoute>
                  }
                />
                <Route
                  path="/admin/payment"
                  element={
                    <LazyRoute>
                      <RequireFullAdmin>
                        <AdminPaymentPage />
                      </RequireFullAdmin>
                    </LazyRoute>
                  }
                />
                <Route
                  path="/admin/gateways"
                  element={
                    <LazyRoute>
                      <RequireFullAdmin>
                        <AdminGatewaysPage />
                      </RequireFullAdmin>
                    </LazyRoute>
                  }
                />
                <Route
                  path="/admin/master-wallets"
                  element={
                    <LazyRoute>
                      <RequireFullAdmin>
                        <AdminMasterWalletsPage />
                      </RequireFullAdmin>
                    </LazyRoute>
                  }
                />
                <Route
                  path="/admin/support-settings"
                  element={
                    <LazyRoute>
                      <RequireFullAdmin>
                        <AdminSupportSettingsPage />
                      </RequireFullAdmin>
                    </LazyRoute>
                  }
                />
                <Route
                  path="/admin/channels"
                  element={
                    <LazyRoute>
                      <RequireFullAdmin>
                        <AdminChannelsPage />
                      </RequireFullAdmin>
                    </LazyRoute>
                  }
                />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
        </BrowserRouter>
      </NotificationProvider>
    </AuthProvider>
  );
}
