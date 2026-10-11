import { useCallback, useEffect, useRef, useState } from "react";
import {
  applyDocumentLocale,
  ensureLocaleLoaded,
  getActiveLocale,
  getLocaleMeta,
  isLocaleLoaded,
  isRtlLocale,
  translate,
  type LocaleCode,
  type TranslateParams,
} from "../i18n";

/**
 * Locale scoped to merchant-pay / gateway UI only.
 * Does not touch stored preference, /me language, or the rest of the app.
 */
export function useGatewayLocale() {
  const [locale, setLocaleState] = useState<LocaleCode>("fa");
  const [catalogEpoch, setCatalogEpoch] = useState(0);
  const restoreLocaleRef = useRef<LocaleCode | null>(null);

  useEffect(() => {
    if (restoreLocaleRef.current == null) {
      restoreLocaleRef.current = getActiveLocale();
    }
    return () => {
      const restore = restoreLocaleRef.current;
      if (restore) applyDocumentLocale(restore);
    };
  }, []);

  useEffect(() => {
    applyDocumentLocale(locale);
    if (isLocaleLoaded(locale)) {
      setCatalogEpoch((n) => n + 1);
      return;
    }
    let cancelled = false;
    void ensureLocaleLoaded(locale).then(() => {
      if (!cancelled) setCatalogEpoch((n) => n + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [locale]);

  const setLocale = useCallback((code: LocaleCode) => {
    setLocaleState(code);
  }, []);

  const t = useCallback(
    (key: string, params?: TranslateParams) => translate(locale, key, params),
    [locale, catalogEpoch],
  );

  const meta = getLocaleMeta(locale);
  return {
    locale,
    setLocale,
    t,
    isRTL: isRtlLocale(locale),
    dir: meta.dir,
  };
}
