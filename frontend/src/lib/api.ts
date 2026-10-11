export function getApiBaseUrl(): string {
  return (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
}

export function getAppUrl(): string {
  return (import.meta.env.VITE_APP_URL || "").replace(/\/$/, "");
}

const USER_CACHE_PREFIX = "tomanit.user.";
/** Keep showing cached session this long; silent refresh still runs sooner. */
export const USER_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function getTelegramInitData(): string {
  return window.Telegram?.WebApp?.initData?.trim() || "";
}

/** Live Telegram user id from Mini App only (no demo fallback). */
export function getTelegramUserId(): string | null {
  const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
  return tgUser ? String(tgUser) : null;
}

export function isTelegramWebApp(): boolean {
  return Boolean(window.Telegram?.WebApp?.initData);
}

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** Default request timeout — prevents hung fetches after WebView thaw. */
export const API_FETCH_TIMEOUT_MS = 20_000;

function createTimeoutSignal(ms: number): { signal: AbortSignal; clear: () => void } {
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    const signal = AbortSignal.timeout(ms);
    return { signal, clear: () => undefined };
  }

  const controller = new AbortController();
  const timer = window.setTimeout(() => {
    controller.abort(new DOMException("TimeoutError", "TimeoutError"));
  }, ms);
  return {
    signal: controller.signal,
    clear: () => window.clearTimeout(timer),
  };
}

function mergeAbortSignals(signals: AbortSignal[]): AbortSignal {
  const active = signals.filter(Boolean);
  if (active.length === 1) return active[0]!;
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.any === "function") {
    return AbortSignal.any(active);
  }

  const controller = new AbortController();
  for (const signal of active) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      return controller.signal;
    }
    signal.addEventListener(
      "abort",
      () => {
        controller.abort(signal.reason);
      },
      { once: true },
    );
  }
  return controller.signal;
}

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  auth?: boolean;
  /** Override default API timeout (ms). Set 0 to disable. */
  timeoutMs?: number;
};

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, headers, auth = true, timeoutMs = API_FETCH_TIMEOUT_MS, signal, ...rest } = options;
  const nextHeaders: Record<string, string> = {
    Accept: "application/json",
    ...(headers as Record<string, string>),
  };
  if (body !== undefined) {
    nextHeaders["Content-Type"] = "application/json";
  }

  if (auth) {
    const initData = getTelegramInitData();
    if (!initData) {
      throw new ApiError("ورود فقط از طریق تلگرام ممکن است", 401);
    }
    nextHeaders.Authorization = `tma ${initData}`;
    nextHeaders["X-Telegram-Init-Data"] = initData;
  }

  const base = getApiBaseUrl();
  const url = `${base}/api${path}`;

  const timeout =
    timeoutMs && timeoutMs > 0 ? createTimeoutSignal(timeoutMs) : null;
  const signals: AbortSignal[] = [];
  if (signal) signals.push(signal);
  if (timeout) signals.push(timeout.signal);
  const mergedSignal = signals.length > 0 ? mergeAbortSignals(signals) : undefined;

  try {
    const res = await fetch(url, {
      ...rest,
      headers: nextHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: mergedSignal,
    });

    const text = await res.text();
    let data: unknown = null;
    if (text) {
      try {
        data = JSON.parse(text) as unknown;
      } catch {
        data = text;
      }
    }

    if (!res.ok) {
      const payload =
        typeof data === "object" && data !== null
          ? (data as { error?: unknown; code?: unknown })
          : null;
      const msg =
        payload && "error" in payload && payload.error != null
          ? String(payload.error)
          : `خطای ${res.status}`;
      const code =
        payload && typeof payload.code === "string" ? payload.code : undefined;
      throw new ApiError(msg, res.status, code);
    }

    return data as T;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    // Caller cancelled (unmount / navigation) — don't remap to timeout UX.
    if (signal?.aborted) {
      throw err instanceof Error
        ? err
        : new DOMException("Aborted", "AbortError");
    }
    const name = err instanceof DOMException ? err.name : "";
    const message = err instanceof Error ? err.message : "";
    if (
      name === "TimeoutError" ||
      name === "AbortError" ||
      /timeout|aborted/i.test(message)
    ) {
      throw new ApiError("اتصال برقرار نشد. دوباره تلاش کنید", 408);
    }
    throw new ApiError("خطای شبکه. اتصال را بررسی کنید", 0);
  } finally {
    timeout?.clear();
  }
}

export type UserRole = "user" | "admin" | "supervisor";
export type KycLevel = "none" | "basic" | "advanced";
export type FeeLevel = "bronze" | "silver" | "gold" | "platinum" | "vip";

export interface UserDto {
  id: string;
  telegramId: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  phone: string | null;
  email: string | null;
  role: UserRole;
  kycLevel: KycLevel;
  feeLevel: FeeLevel;
  isBanned: boolean;
  isActive?: boolean;
  languageCode?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WalletDto {
  tomanBalance: string;
  trxBalance: number;
  usdtBalance: number;
  bnbBalance: number;
  maticBalance: number;
  gramBalance: number;
  updatedAt: string;
  addresses?: Array<{ network: string; address: string }>;
}

export type WalletAssetId = "toman" | "trx" | "usdt" | "bnb" | "matic" | "gram";
export type WalletNetworkId = "tron" | "bsc" | "polygon" | "ton";

export interface WalletAssetCatalogItem {
  id: WalletAssetId;
  symbol: string;
  networks: WalletNetworkId[];
  decimals: number;
  isFiat: boolean;
  rateToman: number;
}

export interface WalletNetworkCatalogItem {
  id: WalletNetworkId;
  name: string;
  assets: WalletAssetId[];
}

export interface WalletAssetsResponse {
  assets: WalletAssetCatalogItem[];
  networks: WalletNetworkCatalogItem[];
}

export interface WalletDepositAddressResponse {
  network: string;
  address: string;
  assets: WalletAssetId[];
}

export interface WalletWithdrawLimitsResponse {
  asset: Exclude<WalletAssetId, "toman">;
  symbol: string;
  kycLevel: KycLevel;
  balance: number;
  balanceToman: number;
  withdrawable: number;
  withdrawableToman: number;
  unitPriceToman: number;
  usdtRate: number;
  lock: {
    active: boolean;
    until: string | null;
    depositAt: string | null;
    instantCreditTotalToman: number;
    instantCreditRemainingToman: number;
    instantCreditUsedToman: number;
  };
  daily: {
    limitToman: number;
    usedToman: number;
    remainingToman: number;
    limitUsdt: number;
    usedUsdt: number;
    remainingUsdt: number;
  };
  monthly: {
    limitToman: number;
    usedToman: number;
    remainingToman: number;
    limitUsdt: number;
    usedUsdt: number;
    remainingUsdt: number;
  };
  needsKycUpgrade: boolean;
}

export interface WalletMutationResponse {
  wallet: WalletDto;
  transaction?: WalletTransaction;
  received?: number;
  transactions?: WalletTransaction[];
  /** Block explorer URL for the broadcast tx (withdraw). */
  explorerUrl?: string | null;
}

/** Shop hub snapshot from /me Redis bundle (mirrors backend MeShopHub). */
export interface MeShopHubDto {
  shop: {
    id: string;
    name: string;
    sellType: string;
    dailyAmountToman: number;
    dailyCount: number;
    channel: string;
    siteUrl: string | null;
    botUrl: string | null;
    logoDataUrl: string | null;
    status: string;
    reviewNote: string | null;
    reviewedAt: string | null;
    createdAt: string;
    updatedAt: string;
  } | null;
  balance: {
    availableToman: number;
    pendingToman: number;
    totalSettledToman: number;
    nextUnlockAt?: string | null;
  };
  stats: {
    todayVolumeToman: number;
    todayCount: number;
    weekVolumeToman: number;
    weekCount: number;
    successRate: number;
    totalCount?: number;
    totalVolumeToman?: number;
  };
  recentTransactions: Array<{
    id: string;
    chargeCode: string | null;
    invoiceCode: string | null;
    amountToman: number;
    feeToman: number;
    totalToman: number;
    status: string;
    paidAt: string | null;
    createdAt: string;
    payerTelegramId: string | null;
    payerLabel: string | null;
    trxRateToman: number | null;
    amountTrx: number | null;
  }>;
}

export interface MeResponse {
  ok?: boolean;
  user: UserDto;
  wallet: WalletDto | null;
  tickets?: SupportTicketSummary[];
  shop?: MeShopHubDto | null;
  cached?: boolean;
  cachedAt?: string;
}

export interface WalletTransaction {
  id: string;
  code?: string;
  type: string;
  asset: string;
  amount: number;
  counterAsset?: string | null;
  counterAmount?: number | null;
  unitPriceToman?: number | null;
  counterUnitPriceToman?: number | null;
  amountToman?: number | null;
  status: string;
  note: string | null;
  failReason?: string | null;
  network?: string | null;
  toAddress?: string | null;
  fromAddress?: string | null;
  txHash?: string | null;
  confirmations?: number | null;
  blockNumber?: string | null;
  fee?: number | null;
  feeAsset?: string | null;
  feeToman?: number | null;
  paymentMethod?: string | null;
  bankCardId?: string | null;
  cardNumberMasked?: string | null;
  iban?: string | null;
  depositNumber?: string | null;
  bankName?: string | null;
  gatewayName?: string | null;
  gatewayTrackId?: string | null;
  gatewayRefId?: string | null;
  gatewayAuthority?: string | null;
  groupId?: string | null;
  relatedTxId?: string | null;
  balanceAfter?: number | null;
  metadata?: unknown;
  /** Merchant invoice — shop snapshot for history UI */
  shopName?: string | null;
  shopLogoDataUrl?: string | null;
  shopChannel?: "website" | "bot" | "manual" | string | null;
  shopSiteUrl?: string | null;
  shopBotUrl?: string | null;
  createdAt: string;
  updatedAt?: string;
  completedAt?: string | null;
}

export interface SupportTicketSummary {
  id: string;
  code: string;
  subject: string;
  status: "open" | "answered" | "closed";
  createdAt: string;
  updatedAt: string;
  lastMessage?: {
    sender: "user" | "admin";
    body: string;
    createdAt: string;
  } | null;
}

export interface SupportMessage {
  id: string;
  sender: "user" | "admin";
  body: string;
  imageData?: string | null;
  createdAt: string;
}

export interface SupportTicketDetail extends SupportTicketSummary {
  messages: SupportMessage[];
}

export interface AdminTicketListItem {
  id: string;
  code: string;
  subject: string;
  status: "open" | "answered" | "closed";
  user: {
    telegramId: string;
    username: string | null;
    fullName: string | null;
  };
  userLabel: string;
  createdAt: string;
  updatedAt: string;
  lastMessage?: {
    sender: "user" | "admin";
    body: string;
    createdAt: string;
  } | null;
}

type CachedUserBundle = {
  user: UserDto;
  wallet: WalletDto | null;
  tickets?: SupportTicketSummary[];
  shop?: MeShopHubDto | null;
  savedAt: number;
};

export type CachedSessionExtras = {
  tickets?: SupportTicketSummary[];
  shop?: MeShopHubDto | null;
};

function cacheKey(telegramId: string) {
  return `${USER_CACHE_PREFIX}${telegramId}`;
}

export function readCachedUser(telegramId?: string | null): CachedUserBundle | null {
  const id = telegramId ?? getTelegramUserId();
  if (!id) return null;
  try {
    const raw = localStorage.getItem(cacheKey(id));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedUserBundle;
    if (!parsed?.user?.telegramId) return null;
    if (String(parsed.user.telegramId) !== String(id)) return null;
    if (
      typeof parsed.savedAt === "number" &&
      Date.now() - parsed.savedAt > USER_CACHE_MAX_AGE_MS
    ) {
      localStorage.removeItem(cacheKey(id));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeCachedUser(
  user: UserDto,
  wallet: WalletDto | null,
  extras?: CachedSessionExtras,
) {
  try {
    const existing = readCachedUser(user.telegramId);
    const payload: CachedUserBundle = {
      user,
      wallet,
      tickets: extras?.tickets !== undefined ? extras.tickets : existing?.tickets,
      shop: extras?.shop !== undefined ? extras.shop : existing?.shop,
      savedAt: Date.now(),
    };
    localStorage.setItem(cacheKey(user.telegramId), JSON.stringify(payload));
  } catch {
    // ignore quota / private mode
  }
}

/** Merge user fields into existing cache (keeps wallet when patch /me returns user only). */
export function patchCachedUser(user: UserDto, wallet?: WalletDto | null) {
  const existing = readCachedUser(user.telegramId);
  writeCachedUser(user, wallet !== undefined ? wallet : (existing?.wallet ?? null));
}

export function patchCachedTickets(tickets: SupportTicketSummary[], telegramId?: string | null) {
  const existing = readCachedUser(telegramId);
  if (!existing) return;
  writeCachedUser(existing.user, existing.wallet, { tickets, shop: existing.shop });
}

export function patchCachedShop(shop: MeShopHubDto | null, telegramId?: string | null) {
  const existing = readCachedUser(telegramId);
  if (!existing) return;
  writeCachedUser(existing.user, existing.wallet, { tickets: existing.tickets, shop });
}

/** Cheap deep-equal for deciding whether to update UI from a background refresh. */
export function sessionDataChanged(a: unknown, b: unknown): boolean {
  try {
    return JSON.stringify(a) !== JSON.stringify(b);
  } catch {
    return true;
  }
}

export function clearCachedUser(telegramId?: string | null) {
  const id = telegramId ?? getTelegramUserId();
  if (!id) return;
  try {
    localStorage.removeItem(cacheKey(id));
  } catch {
    // ignore
  }
}
