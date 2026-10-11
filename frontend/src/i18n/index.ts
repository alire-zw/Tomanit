import { fa, type FaMessages } from "./locales/fa";
import {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  getLocaleMeta,
  isLocaleCode,
  type LocaleCode,
} from "./types";

export type { LocaleCode, LocaleMeta } from "./types";
export {
  DEFAULT_LOCALE,
  LOCALES,
  getLocaleMeta,
  isLocaleCode,
  isRtlLocale,
  localeToBcp47,
} from "./types";

type LocaleLoader = () => Promise<FaMessages>;

/** Persian ships in the main bundle; other languages load on demand. */
const localeLoaders: Record<LocaleCode, LocaleLoader> = {
  fa: async () => fa,
  ar: async () => (await import("./locales/ar")).ar,
  en: async () => (await import("./locales/en")).en,
  zh: async () => (await import("./locales/zh")).zh,
  ru: async () => (await import("./locales/ru")).ru,
  de: async () => (await import("./locales/de")).de,
};

const loadedLocales: Partial<Record<LocaleCode, FaMessages>> = {
  fa,
};

const localePromises = new Map<LocaleCode, Promise<FaMessages>>();

export async function ensureLocaleLoaded(code: LocaleCode): Promise<FaMessages> {
  const existing = loadedLocales[code];
  if (existing) return existing;

  let pending = localePromises.get(code);
  if (!pending) {
    pending = localeLoaders[code]().then((dict) => {
      loadedLocales[code] = dict;
      localePromises.delete(code);
      return dict;
    });
    localePromises.set(code, pending);
  }
  return pending;
}

/** Kick off a locale download without awaiting (warm cache). */
export function preloadLocale(code: LocaleCode): void {
  if (code === "fa" || loadedLocales[code]) return;
  void ensureLocaleLoaded(code).catch(() => {
    // ignore — translate() will fall back to fa
  });
}

let activeLocale: LocaleCode = DEFAULT_LOCALE;

export function readStoredLocale(): LocaleCode {
  try {
    const raw = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (raw && isLocaleCode(raw)) return raw;
  } catch {
    // ignore
  }
  return DEFAULT_LOCALE;
}

export function writeStoredLocale(code: LocaleCode) {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, code);
  } catch {
    // ignore
  }
}

export function getActiveLocale(): LocaleCode {
  return activeLocale;
}

export function setActiveLocale(code: LocaleCode) {
  activeLocale = code;
  applyDocumentLocale(code);
}

export function applyDocumentLocale(code: LocaleCode = activeLocale) {
  if (typeof document === "undefined") return;
  const meta = getLocaleMeta(code);
  document.documentElement.setAttribute("lang", code);
  document.documentElement.setAttribute("dir", meta.dir);
  document.documentElement.dataset.locale = code;
  // Keep 718KB Apple.woff off the Persian critical path.
  if (code !== "fa") {
    void import("../lib/latinFont").then((m) => m.ensureLatinFont());
  }
}

function getByPath(source: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, source);
}

export type TranslateParams = Record<string, string | number>;

export function translate(
  locale: LocaleCode,
  key: string,
  params?: TranslateParams,
): string {
  const dict = loadedLocales[locale] ?? loadedLocales.fa ?? fa;
  const fromLocale = getByPath(dict, key);
  const fromFallback = getByPath(fa, key);
  let text =
    typeof fromLocale === "string"
      ? fromLocale
      : typeof fromFallback === "string"
        ? fromFallback
        : key;

  if (params) {
    for (const [name, value] of Object.entries(params)) {
      text = text.replaceAll(`{{${name}}}`, String(value));
    }
  }
  return text;
}

/** Non-React helper — uses currently active locale. */
export function t(key: string, params?: TranslateParams): string {
  return translate(activeLocale, key, params);
}

export function bootstrapI18n() {
  const locale =
    typeof window !== "undefined" ? readStoredLocale() : DEFAULT_LOCALE;

  // Apply dir/lang immediately; if locale isn't loaded yet, fal back to fa strings.
  setActiveLocale(locale);
  if (locale !== "fa") {
    preloadLocale(locale);
  }
  return locale;
}
