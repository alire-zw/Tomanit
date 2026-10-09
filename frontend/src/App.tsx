import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import { NotificationProvider } from "./components/Notification";
import { RequireAdmin, RequireFullAdmin } from "./components/RequireAdmin";
import { AuthProvider } from "./hooks/useAuth";
import { ProfilePage } from "./pages/Profile";
import { WalletPage } from "./pages/Wallet";
import { ProfileInfoPage } from "./pages/profile/ProfileInfo";
import { ProfileVerifyPage } from "./pages/profile/ProfileVerify";
import { ProfileVerifyLevelsPage } from "./pages/profile/ProfileVerifyLevels";
import { ProfileVerifyIdentityPage } from "./pages/profile/ProfileVerifyIdentity";
import { ProfileVerifyCardPage } from "./pages/profile/ProfileVerifyCard";
import { ProfileVerifyReviewPage } from "./pages/profile/ProfileVerifyReview";
import { ProfileBankcardPage } from "./pages/profile/ProfileBankcard";
import { ProfileSettingsPage } from "./pages/profile/ProfileSettings";
import { SupportListPage } from "./pages/support/SupportList";
import { SupportNewPage } from "./pages/support/SupportNew";
import { SupportDetailPage } from "./pages/support/SupportDetail";
import { AdminHubPage } from "./pages/admin/AdminHub";
import { AdminUsersPage } from "./pages/admin/AdminUsers";
import { AdminUserDetailPage } from "./pages/admin/AdminUserDetail";
import { AdminTicketsPage } from "./pages/admin/AdminTickets";
import { AdminInvoicesPage } from "./pages/admin/AdminInvoices";
import { AdminPricingPage } from "./pages/admin/AdminPricing";
import { AdminPaymentPage } from "./pages/admin/AdminPayment";
import { AdminGatewaysPage } from "./pages/admin/AdminGateways";
import { AdminMasterWalletsPage } from "./pages/admin/AdminMasterWallets";
import { AdminSupportSettingsPage } from "./pages/admin/AdminSupportSettings";
import { AdminChannelsPage } from "./pages/admin/AdminChannels";
import { AdminShopsPage } from "./pages/admin/AdminShops";
import { AdminShopStatsPage } from "./pages/admin/AdminShopStatsPage";
import { AdminSettlementsPage } from "./pages/admin/AdminSettlements";
import { AdminSettlementDetailPage } from "./pages/admin/AdminSettlementDetail";
import { WalletAssetPage } from "./pages/wallet/WalletAssetPage";
import { WalletDepositCoinListPage } from "./pages/wallet/WalletDepositCoinListPage";
import { WalletDepositPage } from "./pages/wallet/WalletDepositPage";
import { WalletDepositAddressPage } from "./pages/wallet/WalletDepositAddressPage";
import { WalletTomanDepositPage } from "./pages/wallet/WalletTomanDepositPage";
import { WalletGatewayChargePage } from "./pages/wallet/WalletGatewayChargePage";
import { WalletDepositKycPage } from "./pages/wallet/WalletDepositKycPage";
import { WalletGatewayResultPage } from "./pages/wallet/WalletGatewayResultPage";
import { WalletTomanPage } from "./pages/wallet/WalletTomanPage";
import { WalletWithdrawCoinListPage } from "./pages/wallet/WalletWithdrawCoinListPage";
import { WalletWithdrawAmountPage } from "./pages/wallet/WalletWithdrawAmountPage";
import { WalletWithdrawConfirmPage } from "./pages/wallet/WalletWithdrawConfirmPage";
import { WalletWithdrawFormPage } from "./pages/wallet/WalletWithdrawFormPage";
import { WalletWithdrawNetworkPage } from "./pages/wallet/WalletWithdrawNetworkPage";
import { WalletWithdrawSuccessPage } from "./pages/wallet/WalletWithdrawSuccessPage";
import { MyShopPage } from "./pages/MyShop";
import { ShopStoresPage } from "./pages/shop/ShopStoresPage";
import { ShopStoreNewPage } from "./pages/shop/ShopStoreNewPage";
import { ShopPaymentLinksPage } from "./pages/shop/ShopPaymentLinksPage";
import { ShopPaymentLinkNewPage } from "./pages/shop/ShopPaymentLinkNewPage";
import { MerchantPayPage } from "./pages/shop/MerchantPayPage";
import { MerchantPayResultPage } from "./pages/shop/MerchantPayResultPage";
import { ShopTransactionsPage } from "./pages/shop/ShopTransactionsPage";
import { ShopTransactionDetailPage } from "./pages/shop/ShopTransactionDetailPage";
import { ShopSettlementsPage } from "./pages/shop/ShopSettlementsPage";
import { ShopStatsPage } from "./pages/shop/ShopStatsPage";
import { ShopApiPage } from "./pages/shop/ShopApiPage";
import { ShopGatewaySettingsPage } from "./pages/shop/ShopGatewaySettingsPage";
import { ShopReportBotPage } from "./pages/shop/ShopReportBotPage";
import { MerchantApiDocsPage } from "./pages/shop/MerchantApiDocsPage";
import { NotificationsPage } from "./pages/Notifications";

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
              <Route path="/shop/gateways/new" element={<Navigate to="/shop/payment-links/new" replace />} />
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
              <Route path="/wallet/:assetId/deposit/:networkId" element={<WalletDepositAddressPage />} />
              <Route path="/wallet/:assetId/deposit" element={<WalletDepositPage />} />
              <Route path="/wallet/withdraw" element={<WalletWithdrawCoinListPage />} />
              <Route path="/wallet/:assetId/withdraw/:networkId/amount" element={<WalletWithdrawAmountPage />} />
              <Route path="/wallet/:assetId/withdraw/:networkId/confirm" element={<WalletWithdrawConfirmPage />} />
              <Route path="/wallet/:assetId/withdraw/:networkId/success" element={<WalletWithdrawSuccessPage />} />
              <Route path="/wallet/:assetId/withdraw/:networkId" element={<WalletWithdrawFormPage />} />
              <Route path="/wallet/:assetId/withdraw" element={<WalletWithdrawNetworkPage />} />
              <Route path="/wallet/toman" element={<WalletTomanPage />} />
              <Route path="/wallet/:assetId" element={<WalletAssetPage />} />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/profile/info" element={<ProfileInfoPage />} />
              <Route path="/profile/verify" element={<ProfileVerifyLevelsPage />} />
              <Route path="/profile/verify/terms" element={<ProfileVerifyPage />} />
              <Route path="/profile/verify/identity" element={<ProfileVerifyIdentityPage />} />
              <Route path="/profile/verify/card" element={<ProfileVerifyCardPage />} />
              <Route path="/profile/verify/review" element={<ProfileVerifyReviewPage />} />
              <Route path="/profile/bankcard" element={<ProfileBankcardPage />} />
              <Route path="/profile/settings" element={<ProfileSettingsPage />} />
              <Route path="/support" element={<SupportListPage />} />
              <Route path="/support/new" element={<SupportNewPage />} />
              <Route path="/support/:id" element={<SupportDetailPage />} />
              <Route
                path="/admin"
                element={
                  <RequireAdmin>
                    <AdminHubPage />
                  </RequireAdmin>
                }
              />
              <Route
                path="/admin/users"
                element={
                  <RequireFullAdmin>
                    <AdminUsersPage />
                  </RequireFullAdmin>
                }
              />
              <Route
                path="/admin/users/:id"
                element={
                  <RequireFullAdmin>
                    <AdminUserDetailPage />
                  </RequireFullAdmin>
                }
              />
              <Route
                path="/admin/tickets"
                element={
                  <RequireAdmin>
                    <AdminTicketsPage />
                  </RequireAdmin>
                }
              />
              <Route
                path="/admin/shops"
                element={
                  <RequireAdmin>
                    <AdminShopsPage />
                  </RequireAdmin>
                }
              />
              <Route
                path="/admin/shops/stats"
                element={
                  <RequireAdmin>
                    <AdminShopStatsPage />
                  </RequireAdmin>
                }
              />
              <Route
                path="/admin/settlements"
                element={
                  <RequireAdmin>
                    <AdminSettlementsPage />
                  </RequireAdmin>
                }
              />
              <Route
                path="/admin/settlements/:id"
                element={
                  <RequireAdmin>
                    <AdminSettlementDetailPage />
                  </RequireAdmin>
                }
              />
              <Route
                path="/admin/invoices"
                element={
                  <RequireFullAdmin>
                    <AdminInvoicesPage />
                  </RequireFullAdmin>
                }
              />
              <Route
                path="/admin/pricing"
                element={
                  <RequireFullAdmin>
                    <AdminPricingPage />
                  </RequireFullAdmin>
                }
              />
              <Route
                path="/admin/payment"
                element={
                  <RequireFullAdmin>
                    <AdminPaymentPage />
                  </RequireFullAdmin>
                }
              />
              <Route
                path="/admin/gateways"
                element={
                  <RequireFullAdmin>
                    <AdminGatewaysPage />
                  </RequireFullAdmin>
                }
              />
              <Route
                path="/admin/master-wallets"
                element={
                  <RequireFullAdmin>
                    <AdminMasterWalletsPage />
                  </RequireFullAdmin>
                }
              />
              <Route
                path="/admin/support-settings"
                element={
                  <RequireFullAdmin>
                    <AdminSupportSettingsPage />
                  </RequireFullAdmin>
                }
              />
              <Route
                path="/admin/channels"
                element={
                  <RequireFullAdmin>
                    <AdminChannelsPage />
                  </RequireFullAdmin>
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
