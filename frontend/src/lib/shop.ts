import { apiFetch } from "./api";

export type ShopStoreStatus = "pending" | "active" | "rejected" | "suspended";
export type ShopSellType = "goods" | "services";
export type ShopChannel = "website" | "bot" | "manual";

export type InvoiceThemeId =
  | "teal"
  | "orange"
  | "blue"
  | "violet"
  | "rose"
  | "amber";
export type FeeBearer = "payer" | "merchant" | "split";

export type MerchantShop = {
  id: string;
  name: string;
  sellType: ShopSellType;
  dailyAmountToman: number;
  dailyCount: number;
  channel: ShopChannel;
  siteUrl: string | null;
  botUrl: string | null;
  logoDataUrl: string | null;
  invoiceTheme?: InvoiceThemeId | string;
  feeBearer?: FeeBearer | string;
  status: ShopStoreStatus;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ShopHubPayload = {
  shop: MerchantShop | null;
  balance: {
    availableToman: number;
    pendingToman: number;
    totalSettledToman: number;
    /** ISO — when next held credit unlocks for settlement */
    nextUnlockAt?: string | null;
  };
  stats: {
    todayVolumeToman: number;
    todayCount: number;
    weekVolumeToman: number;
    weekCount: number;
    successRate: number;
    /** All-time completed invoice payments */
    totalCount?: number;
    totalVolumeToman?: number;
  };
  recentTransactions: ShopTransaction[];
};

export type ShopTxStatus = "completed" | "pending" | "failed" | "expired" | "unpaid";
export type ShopTxSource = "manual" | "api";

export type ShopTransaction = {
  /** Payment-link id (shared by list + detail) */
  id: string;
  chargeCode: string | null;
  invoiceCode: string | null;
  title?: string | null;
  amountToman: number;
  feeToman: number;
  totalToman: number;
  status: ShopTxStatus;
  linkStatus?: MerchantPaymentLinkStatus;
  source?: ShopTxSource;
  orderId?: string | null;
  phone?: string | null;
  callbackUrl?: string | null;
  paidAt: string | null;
  expiresAt?: string | null;
  createdAt: string;
  updatedAt?: string | null;
  payerTelegramId: string | null;
  payerUsername?: string | null;
  payerFullName?: string | null;
  payerLabel: string | null;
  /** TRX/IRT rate at payment time */
  trxRateToman: number | null;
  /** Invoice amount ÷ trxRateToman */
  amountTrx: number | null;
  payToken?: string | null;
  webUrl?: string | null;
  miniAppUrl?: string | null;
  url?: string | null;
  trackId?: string | null;
  gatewayOrderId?: string | null;
  gatewayName?: string | null;
  commissionPercent?: number | null;
  commissionToman?: number | null;
  /** Full payer card digits (no spaces) when a charge exists */
  cardNumber?: string | null;
  /** @deprecated use cardNumber */
  cardLast4?: string | null;
  cardBankName?: string | null;
  cardOwnerName?: string | null;
  chargeStatus?: string | null;
  chargeCreatedAt?: string | null;
};

export type ShopRegisterPayload = {
  name: string;
  sellType: ShopSellType;
  dailyAmountToman: number;
  dailyCount: number;
  channel: ShopChannel;
  siteUrl?: string | null;
  botUrl?: string | null;
  logoDataUrl?: string | null;
};

export type AdminShopUser = {
  id: string;
  telegramId: string;
  username: string | null;
  fullName: string | null;
  firstName: string | null;
  lastName: string | null;
};

export type AdminShopItem = MerchantShop & {
  user: AdminShopUser;
};

export type ShopSettlementMethod = "rial" | "trx";
export type ShopSettlementStatus = "requested" | "processing" | "paid" | "rejected";
export type ShopTrxDestination = "in_app" | "external";

export type ShopSettlement = {
  id: string;
  method: ShopSettlementMethod;
  amountToman: number;
  status: ShopSettlementStatus;
  iban: string | null;
  ibanMasked: string | null;
  trxDestination: ShopTrxDestination | null;
  trxAddress: string | null;
  trxAddressMasked: string | null;
  rejectNote: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ShopStatsDaily = {
  date: string;
  weekday: number;
  volumeToman: number;
  count: number;
};

export type ShopStatsBucket = {
  count: number;
  volumeToman: number;
};

export type ShopStatsPayload = {
  shop: MerchantShop;
  stats: {
    todayVolumeToman: number;
    todayCount: number;
    yesterdayVolumeToman: number;
    yesterdayCount: number;
    weekVolumeToman: number;
    weekCount: number;
    successRate: number;
    pendingToman: number;
    totalCount: number;
    totalVolumeToman: number;
    monthVolumeToman: number;
    monthCount: number;
    avgTicketToman: number;
    conversionRate: number;
    invoiceTotalCount: number;
    daily: ShopStatsDaily[];
    sources: {
      manual: ShopStatsBucket;
      api: ShopStatsBucket;
    };
    invoices: {
      open: ShopStatsBucket;
      paid: ShopStatsBucket;
      expired: ShopStatsBucket;
      cancelled: ShopStatsBucket;
    };
  };
  balance: {
    availableToman: number;
    pendingToman: number;
    totalSettledToman: number;
    nextUnlockAt?: string | null;
  };
};

export function fetchShopHub(): Promise<ShopHubPayload> {
  return apiFetch("/shop");
}

export function fetchShopStats(): Promise<ShopStatsPayload> {
  return apiFetch("/shop/stats");
}

export function fetchShopSettlements(): Promise<{ settlements: ShopSettlement[] }> {
  return apiFetch("/shop/settlements");
}

export function requestShopSettlement(payload: {
  method: ShopSettlementMethod;
  amountToman: number;
  iban?: string;
  trxDestination?: ShopTrxDestination;
  trxAddress?: string;
}): Promise<{ settlement: ShopSettlement }> {
  return apiFetch("/shop/settlements", { method: "POST", body: payload });
}

export function fetchShopTransactions(): Promise<{
  transactions: ShopTransaction[];
}> {
  return apiFetch("/shop/transactions");
}

export function fetchShopTransaction(
  id: string,
): Promise<{ transaction: ShopTransaction }> {
  return apiFetch(`/shop/transactions/${encodeURIComponent(id)}`);
}

export type ShopApiKeyPayload = {
  apiKey: string;
  masked: string;
  shopId: string;
  status: string;
};

export function fetchShopApiKey(): Promise<ShopApiKeyPayload> {
  return apiFetch("/shop/api-key");
}

export type ShopReportBotPayload = {
  available: boolean;
  enabled: boolean;
  linked: boolean;
  linkedAt: string | null;
  botUsername: string | null;
  startUrl: string | null;
};

export function fetchShopReportBot(): Promise<ShopReportBotPayload> {
  return apiFetch("/shop/report-bot");
}

export function setShopReportBotEnabled(
  enabled: boolean,
): Promise<ShopReportBotPayload> {
  return apiFetch("/shop/report-bot", { method: "PATCH", body: { enabled } });
}

export function updateShopSettings(payload: {
  logoDataUrl?: string | null;
  invoiceTheme?: InvoiceThemeId;
  feeBearer?: FeeBearer;
}): Promise<{ shop: MerchantShop }> {
  return apiFetch("/shop/settings", { method: "PATCH", body: payload });
}

export type MerchantPaymentLinkStatus = "open" | "paid" | "cancelled" | "expired";

export type MerchantPaymentLink = {
  id: string;
  /** Stable invoice id, e.g. TMNIT-100001 */
  code: string;
  /** Current numeric pay token used in /pay/{token} (rotates on revoke) */
  payToken: string;
  title: string;
  amountToman: number;
  status: MerchantPaymentLinkStatus;
  orderId?: string | null;
  phone?: string | null;
  telegramId?: string | null;
  paidAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Website / browser payment link */
  webUrl?: string | null;
  /** Telegram Mini App deep link */
  miniAppUrl?: string | null;
  /** Primary share URL (Mini App when available) */
  url: string;
};

export function fetchShopPaymentLinks(): Promise<{ links: MerchantPaymentLink[] }> {
  return apiFetch("/shop/payment-links");
}

export function createShopPaymentLink(payload: {
  amountToman: number;
}): Promise<{ link: MerchantPaymentLink }> {
  return apiFetch("/shop/payment-links", { method: "POST", body: payload });
}

export function revokeShopPaymentLink(
  id: string,
): Promise<{ link: MerchantPaymentLink }> {
  return apiFetch(`/shop/payment-links/${encodeURIComponent(id)}/revoke`, {
    method: "POST",
    body: {},
  });
}

export function deleteShopPaymentLink(id: string): Promise<{ ok: true }> {
  return apiFetch(`/shop/payment-links/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export function fetchPublicMerchantPay(code: string): Promise<{
  link: MerchantPaymentLink & {
    shopName: string;
    shopLogoDataUrl: string | null;
    shopSellType: "goods" | "services";
    shopChannel: "website" | "bot" | "manual";
    shopSiteUrl: string | null;
    shopBotUrl: string | null;
    invoiceTheme?: InvoiceThemeId | string;
    feeBearer?: FeeBearer | string;
    payerTelegramId?: string | null;
    /** Gateway charge code — use for /p/result when invoice already paid */
    chargeCode?: string | null;
  };
}> {
  return apiFetch(`/public/merchant-pay/${encodeURIComponent(code)}`, {
    auth: false,
  });
}

export type MerchantPayCharge = {
  code: string;
  kind: "wallet_deposit" | "merchant_invoice";
  amountToman: string;
  invoiceAmountToman: string | null;
  feeToman: string;
  paymentUrl: string | null;
  trackId: string | null;
  status: string;
  paidAt?: string | null;
  createdAt?: string | null;
  gatewayName?: string;
  shopName?: string | null;
  shopLogoDataUrl?: string | null;
  shopSellType?: "goods" | "services" | null;
  shopChannel?: "website" | "bot" | "manual" | null;
  shopSiteUrl?: string | null;
  shopBotUrl?: string | null;
  invoiceTheme?: InvoiceThemeId | string | null;
  feeBearer?: FeeBearer | string | null;
  invoiceCode?: string | null;
};

/** Start gateway payment for a manual invoice (authenticated payer + card). */
export function createMerchantPayCharge(payload: {
  payToken: string;
  cardId: number;
}): Promise<{ charge: MerchantPayCharge }> {
  return apiFetch("/merchant-pay/charge", {
    method: "POST",
    body: payload,
  });
}

/** Notify backend that payer opened an invoice — triggers main-bot /start message. */
export function notifyMerchantPayOpened(): Promise<{ ok: true }> {
  return apiFetch("/merchant-pay/opened", {
    method: "POST",
    body: {},
  });
}

/** Public result lookup (charge code or pay token) — no payer ownership required. */
export function fetchMerchantPayCharge(
  code: string,
): Promise<{ charge: MerchantPayCharge }> {
  return apiFetch(`/public/merchant-pay-result/${encodeURIComponent(code)}`, {
    auth: false,
  });
}

export function registerShop(
  payload: ShopRegisterPayload,
): Promise<{ shop: MerchantShop }> {
  return apiFetch("/shop", { method: "POST", body: payload });
}

export type AdminShopStatsDaily = ShopStatsDaily & {
  feeToman: number;
  commissionToman: number;
  profitToman: number;
};

export type AdminShopStatsPayload = {
  shops: {
    total: number;
    active: number;
    pending: number;
    rejected: number;
    suspended: number;
  };
  settlements: {
    requested: ShopStatsBucket;
    processing: ShopStatsBucket;
    paid: ShopStatsBucket;
    rejected: ShopStatsBucket;
    pendingVolumeToman: number;
    pendingCount: number;
  };
  stats: {
    todayVolumeToman: number;
    todayCount: number;
    todayFeeToman: number;
    todayCommissionToman: number;
    todayProfitToman: number;
    yesterdayVolumeToman: number;
    yesterdayCount: number;
    yesterdayFeeToman: number;
    yesterdayCommissionToman: number;
    yesterdayProfitToman: number;
    weekVolumeToman: number;
    weekCount: number;
    weekFeeToman: number;
    weekCommissionToman: number;
    weekProfitToman: number;
    monthVolumeToman: number;
    monthCount: number;
    monthFeeToman: number;
    monthCommissionToman: number;
    monthProfitToman: number;
    totalVolumeToman: number;
    totalCount: number;
    totalFeeToman: number;
    totalCommissionToman: number;
    totalProfitToman: number;
    totalChargedToman: number;
    avgTicketToman: number;
    conversionRate: number;
    invoiceTotalCount: number;
    pendingInvoiceCount: number;
    pendingInvoiceToman: number;
    daily: AdminShopStatsDaily[];
    sources: {
      manual: ShopStatsBucket;
      api: ShopStatsBucket;
    };
    invoices: {
      open: ShopStatsBucket;
      paid: ShopStatsBucket;
      expired: ShopStatsBucket;
      cancelled: ShopStatsBucket;
    };
    topShops: Array<{
      id: string;
      name: string;
      status: string;
      logoDataUrl: string | null;
      owner: string;
      count: number;
      volumeToman: number;
      feeToman: number;
      commissionToman: number;
      profitToman: number;
    }>;
  };
};

export function fetchAdminShops(
  status?: ShopStoreStatus | "all",
): Promise<{ shops: AdminShopItem[] }> {
  const q =
    status && status !== "all"
      ? `?status=${encodeURIComponent(status)}`
      : "";
  return apiFetch(`/admin/shops${q}`);
}

export function fetchAdminShopStats(): Promise<AdminShopStatsPayload> {
  return apiFetch("/admin/shops/stats");
}

export function approveAdminShop(
  id: string,
): Promise<{ shop: { id: string; status: string } }> {
  return apiFetch(`/admin/shops/${id}/approve`, { method: "POST", body: {} });
}

export function rejectAdminShop(
  id: string,
  note?: string,
): Promise<{ shop: { id: string; status: string; reviewNote: string | null } }> {
  return apiFetch(`/admin/shops/${id}/reject`, {
    method: "POST",
    body: { note: note || undefined },
  });
}

export type AdminShopSettlement = ShopSettlement & {
  shop: {
    id: string;
    name: string;
  };
  user: AdminShopUser;
};

export function fetchAdminSettlements(
  status?: ShopSettlementStatus | "all",
): Promise<{ settlements: AdminShopSettlement[] }> {
  const q =
    status && status !== "all"
      ? `?status=${encodeURIComponent(status)}`
      : "";
  return apiFetch(`/admin/settlements${q}`);
}

export function fetchAdminSettlement(
  id: string,
): Promise<{ settlement: AdminShopSettlement }> {
  return apiFetch(`/admin/settlements/${encodeURIComponent(id)}`);
}

export function updateAdminSettlementStatus(
  id: string,
  status: Extract<ShopSettlementStatus, "processing" | "paid">,
): Promise<{ settlement: ShopSettlement }> {
  return apiFetch(`/admin/settlements/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    body: { status },
  });
}

/** Hub is interactive only when shop is approved. */
export function shopIsActive(shop: MerchantShop | null | undefined): boolean {
  return shop?.status === "active";
}

/** User already submitted an application (any status except none). */
export function shopExists(shop: MerchantShop | null | undefined): boolean {
  return Boolean(shop);
}
