import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  apiFetch,
  clearCachedUser,
  getTelegramInitData,
  getTelegramUserId,
  patchCachedShop,
  patchCachedTickets,
  readCachedUser,
  sessionDataChanged,
  writeCachedUser,
  type MeResponse,
  type MeShopHubDto,
  type SupportTicketSummary,
  type UserDto,
  type WalletDto,
} from "../lib/api";
import { onAppResume, startAppLifecycle } from "../lib/appLifecycle";
import { applyLocaleFromServer } from "../context/I18nContext";

interface AuthContextValue {
  user: UserDto | null;
  wallet: WalletDto | null;
  /** Support ticket list from /me Redis bundle (may be undefined until first /me). */
  tickets: SupportTicketSummary[] | undefined;
  /** Shop hub from /me Redis bundle. */
  shopHub: MeShopHubDto | null | undefined;
  loading: boolean;
  error: string | null;
  /** Staff panel (admin or supervisor) after verified /me */
  isAdmin: boolean;
  /** Full admin only — payments, users, settings, gateways */
  isFullAdmin: boolean;
  /**
   * Cached or verified staff role — for early UI (nav unlock).
   * Do not use for authorizing admin routes; use isAdmin / sessionVerified.
   */
  isStaffCandidate: boolean;
  isAuthenticated: boolean;
  /** True only after a successful /me response this session (not forged cache). */
  sessionVerified: boolean;
  /** True after the first /me attempt this session finished (ok or fail). */
  sessionCheckDone: boolean;
  refresh: (options?: { silent?: boolean; force?: boolean }) => Promise<UserDto | null>;
  applyUser: (user: UserDto, wallet?: WalletDto | null) => void;
  applyTickets: (tickets: SupportTicketSummary[]) => void;
  applyShopHub: (shop: MeShopHubDto | null) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);
/** Align with Redis me-cache TTL so silent /me is not spammy. */
const USER_STALE_MS = 10 * 60_000;
/** Only background-refresh session after a real long pause (avoid mid-work flicker). */
const RESUME_REFRESH_AFTER_MS = 90_000;
const INIT_DATA_WAIT_MS = 2000;

function readBootBundle(): {
  user: UserDto;
  wallet: WalletDto | null;
  tickets?: SupportTicketSummary[];
  shop?: MeShopHubDto | null;
  savedAt: number;
} | null {
  if (typeof window === "undefined") return null;
  const tgId = getTelegramUserId();
  if (!tgId) return null;
  const cached = readCachedUser(tgId);
  if (!cached) return null;
  if (String(cached.user.telegramId) !== String(tgId)) {
    clearCachedUser(cached.user.telegramId);
    return null;
  }
  return {
    user: cached.user,
    wallet: cached.wallet,
    tickets: cached.tickets,
    shop: cached.shop,
    savedAt: cached.savedAt,
  };
}

function hasTelegramShell(): boolean {
  return Boolean(window.Telegram?.WebApp);
}

/** Wait for Telegram to inject initData (shell can exist before data is ready). */
async function waitForTelegramInitData(maxMs = INIT_DATA_WAIT_MS): Promise<string> {
  const existing = getTelegramInitData();
  if (existing) return existing;
  if (!hasTelegramShell()) return "";

  const started = Date.now();
  while (Date.now() - started < maxMs) {
    await new Promise((r) => setTimeout(r, 50));
    const data = getTelegramInitData();
    if (data) return data;
  }
  return getTelegramInitData();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const boot = readBootBundle();
  const [user, setUser] = useState<UserDto | null>(() => boot?.user ?? null);
  const [wallet, setWallet] = useState<WalletDto | null>(() => boot?.wallet ?? null);
  const [tickets, setTickets] = useState<SupportTicketSummary[] | undefined>(
    () => boot?.tickets,
  );
  const [shopHub, setShopHub] = useState<MeShopHubDto | null | undefined>(() => boot?.shop);
  const [loading, setLoading] = useState(() => !boot);
  const [error, setError] = useState<string | null>(null);
  /** Do not trust cached role until /me succeeds. */
  const [sessionVerified, setSessionVerified] = useState(false);
  const [sessionCheckDone, setSessionCheckDone] = useState(false);
  const lastFetchedAtRef = useRef(boot?.savedAt ?? 0);
  const inflightRef = useRef<Promise<UserDto | null> | null>(null);
  const userRef = useRef<UserDto | null>(null);
  const sessionVerifiedRef = useRef(false);
  userRef.current = user;
  sessionVerifiedRef.current = sessionVerified;

  const applyUser = useCallback((next: UserDto, nextWallet?: WalletDto | null) => {
    setUser(next);
    if (nextWallet !== undefined) {
      setWallet(nextWallet);
      writeCachedUser(next, nextWallet);
    } else {
      setWallet((prev) => {
        writeCachedUser(next, prev);
        return prev;
      });
    }
    lastFetchedAtRef.current = Date.now();
  }, []);

  const applyTickets = useCallback((next: SupportTicketSummary[]) => {
    setTickets((prev) => {
      if (prev !== undefined && !sessionDataChanged(prev, next)) return prev;
      return next;
    });
    patchCachedTickets(next);
  }, []);

  const applyShopHub = useCallback((next: MeShopHubDto | null) => {
    setShopHub((prev) => {
      if (prev !== undefined && !sessionDataChanged(prev, next)) return prev;
      return next;
    });
    patchCachedShop(next);
  }, []);

  const refresh = useCallback(async (options?: { silent?: boolean; force?: boolean }) => {
    const silent = Boolean(options?.silent);
    const force = Boolean(options?.force);

    if (
      !force &&
      silent &&
      userRef.current &&
      sessionVerifiedRef.current &&
      lastFetchedAtRef.current &&
      Date.now() - lastFetchedAtRef.current < USER_STALE_MS
    ) {
      return userRef.current;
    }

    if (!force && inflightRef.current) {
      return inflightRef.current;
    }

    // Drop a hung in-flight refresh so a forced background refresh can start.
    if (force) {
      inflightRef.current = null;
    }

    // Never flip loading=true once we already have a session — keeps UI stable.
    if (!silent && !userRef.current) setLoading(true);

    let request!: Promise<UserDto | null>;
    request = (async () => {
      try {
        const initData = await waitForTelegramInitData();
        if (!initData) {
          throw new Error("ورود فقط از طریق تلگرام ممکن است");
        }

        const data = await apiFetch<MeResponse>("/me");
        setUser(data.user);
        setWallet(data.wallet);
        if (data.tickets) setTickets(data.tickets);
        if (data.shop !== undefined) setShopHub(data.shop);
        setSessionVerified(true);
        writeCachedUser(data.user, data.wallet, {
          tickets: data.tickets,
          shop: data.shop,
        });
        lastFetchedAtRef.current = Date.now();
        setError(null);
        applyLocaleFromServer(data.user.languageCode);
        return data.user;
      } catch (err) {
        const message = err instanceof Error ? err.message : "خطا در احراز هویت";
        setError(message);
        // Keep existing session on silent/background failures — don't wipe UI.
        // But never keep a forged admin role if /me never verified this session.
        if (!silent && !userRef.current) {
          setUser(null);
          setWallet(null);
          setTickets(undefined);
          setShopHub(undefined);
          setSessionVerified(false);
          clearCachedUser();
        }
        return userRef.current;
      } finally {
        setLoading(false);
        setSessionCheckDone(true);
        if (inflightRef.current === request) {
          inflightRef.current = null;
        }
      }
    })();

    inflightRef.current = request;
    return request;
  }, []);

  useEffect(() => {
    const stopLifecycle = startAppLifecycle();
    let cancelled = false;
    let booted = false;

    const bootAuth = async () => {
      if (booted) return;
      booted = true;

      const cached = readBootBundle();
      if (cached) {
        setUser(cached.user);
        setWallet(cached.wallet);
        if (cached.tickets !== undefined) setTickets(cached.tickets);
        if (cached.shop !== undefined) setShopHub(cached.shop);
        lastFetchedAtRef.current = cached.savedAt;
        setLoading(false);
        // Background hydrate — UI already shows cached user/wallet.
        void refresh({ silent: true, force: true });
        return;
      }

      await refresh({ silent: false, force: true });
    };

    void bootAuth();

    const unsubscribeResume = onAppResume((info) => {
      if (cancelled) return;
      // Background-only session sync after a real long pause — never remount UI.
      if (info.hiddenForMs >= RESUME_REFRESH_AFTER_MS) {
        void refresh({ silent: true, force: true });
      }
    });

    return () => {
      cancelled = true;
      unsubscribeResume();
      stopLifecycle();
    };
  }, [refresh]);

  const value = useMemo(() => {
    const isStaffRole = user?.role === "admin" || user?.role === "supervisor";
    return {
      user,
      wallet,
      tickets,
      shopHub,
      loading,
      error,
      isAdmin: sessionVerified && isStaffRole,
      isFullAdmin: sessionVerified && user?.role === "admin",
      isStaffCandidate: isStaffRole,
      isAuthenticated: Boolean(user),
      sessionVerified,
      sessionCheckDone,
      refresh,
      applyUser,
      applyTickets,
      applyShopHub,
    };
  }, [
    user,
    wallet,
    tickets,
    shopHub,
    loading,
    error,
    sessionVerified,
    sessionCheckDone,
    refresh,
    applyUser,
    applyTickets,
    applyShopHub,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
