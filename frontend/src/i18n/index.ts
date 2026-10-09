import { ar } from "./locales/ar";
import { de } from "./locales/de";
import { en } from "./locales/en";
import { fa, type FaMessages } from "./locales/fa";
import { ru } from "./locales/ru";
import { zh } from "./locales/zh";
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

const dictionaries: Record<LocaleCode, FaMessages> = {
  fa,
  ar,
  en,
  zh,
  ru,
  de,
};

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
  const fromLocale = getByPath(dictionaries[locale], key);
  const fromFallback = getByPath(dictionaries.fa, key);
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
  const locale = typeof window !== "undefined" ? readStoredLocale() : DEFAULT_LOCALE;
  setActiveLocale(locale);
  return locale;
}
