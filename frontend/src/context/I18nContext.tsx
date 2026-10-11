import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  applyDocumentLocale,
  bootstrapI18n,
  ensureLocaleLoaded,
  getLocaleMeta,
  isLocaleCode,
  isLocaleLoaded,
  isRtlLocale,
  preloadLocale,
  readStoredLocale,
  setActiveLocale,
  translate,
  writeStoredLocale,
  type LocaleCode,
  type TranslateParams,
} from "../i18n";
import { apiFetch } from "../lib/api";

type I18nContextValue = {
  locale: LocaleCode;
  isRTL: boolean;
  dir: "rtl" | "ltr";
  setLocale: (code: LocaleCode) => void;
  t: (key: string, params?: TranslateParams) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

const LOCALE_EVENT = "tomanit:language";

/** Apply locale from server/user profile without writing back to API. */
export function applyLocaleFromServer(code: string | null | undefined) {
  if (!code || !isLocaleCode(code)) return;
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(LOCALE_EVENT, { detail: code }));
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<LocaleCode>(() => {
    if (typeof window === "undefined") return "fa";
    return bootstrapI18n();
  });
  /** Bumps when a locale catalog finishes loading so `t` re-binds even if code stayed the same. */
  const [catalogEpoch, setCatalogEpoch] = useState(0);

  const applyLocale = useCallback((code: LocaleCode) => {
    setActiveLocale(code);
    setLocaleState(code);
    setCatalogEpoch((n) => n + 1);
  }, []);

  const setLocale = useCallback(
    (code: LocaleCode, options?: { persist?: boolean }) => {
      writeStoredLocale(code);
      // Flip document dir/lang immediately; strings wait for the catalog.
      setActiveLocale(code);

      if (isLocaleLoaded(code)) {
        applyLocale(code);
      } else {
        void ensureLocaleLoaded(code).then(() => {
          applyLocale(code);
        });
      }

      if (options?.persist === false) return;
      void apiFetch("/me", {
        method: "PATCH",
        body: { languageCode: code },
      }).catch(() => {
        // Offline / unauthenticated — local preference still applies.
      });
    },
    [applyLocale],
  );

  const t = useCallback(
    (key: string, params?: TranslateParams) => translate(locale, key, params),
    [locale, catalogEpoch],
  );

  useEffect(() => {
    applyDocumentLocale(locale);
  }, [locale]);

  useEffect(() => {
    const preferred = readStoredLocale();
    setActiveLocale(preferred);
    if (preferred !== "fa") {
      void ensureLocaleLoaded(preferred).then(() => {
        applyLocale(preferred);
      });
    }
  }, [applyLocale]);

  useEffect(() => {
    const onServerLocale = (event: Event) => {
      const code = (event as CustomEvent<string>).detail;
      if (!isLocaleCode(code) || code === locale) return;
      preloadLocale(code);
      setLocale(code, { persist: false });
    };
    window.addEventListener(LOCALE_EVENT, onServerLocale);
    return () => window.removeEventListener(LOCALE_EVENT, onServerLocale);
  }, [locale, setLocale]);

  const value = useMemo<I18nContextValue>(() => {
    const meta = getLocaleMeta(locale);
    return {
      locale,
      isRTL: isRtlLocale(locale),
      dir: meta.dir,
      setLocale: (code) => setLocale(code),
      t,
    };
  }, [locale, setLocale, t, catalogEpoch]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
