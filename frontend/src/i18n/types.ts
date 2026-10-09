export type LocaleCode = "fa" | "ar" | "en" | "zh" | "ru" | "de";

export type LocaleMeta = {
  code: LocaleCode;
  nativeName: string;
  dir: "rtl" | "ltr";
};

export const DEFAULT_LOCALE: LocaleCode = "fa";
export const LOCALE_STORAGE_KEY = "tomanit.locale";

export const LOCALES: LocaleMeta[] = [
  { code: "fa", nativeName: "فارسی", dir: "rtl" },
  { code: "ar", nativeName: "العربية", dir: "rtl" },
  { code: "en", nativeName: "English", dir: "ltr" },
  { code: "zh", nativeName: "中文", dir: "ltr" },
  { code: "ru", nativeName: "Русский", dir: "ltr" },
  { code: "de", nativeName: "Deutsch", dir: "ltr" },
];

export function isLocaleCode(value: string): value is LocaleCode {
  return LOCALES.some((item) => item.code === value);
}

export function getLocaleMeta(code: LocaleCode): LocaleMeta {
  return LOCALES.find((item) => item.code === code) ?? LOCALES[0]!;
}

export function isRtlLocale(code: LocaleCode): boolean {
  return getLocaleMeta(code).dir === "rtl";
}

/** BCP 47 tag for `Intl` / `toLocaleString`. */
export function localeToBcp47(code: LocaleCode): string {
  switch (code) {
    case "fa":
      return "fa-IR";
    case "ar":
      return "ar-EG";
    case "zh":
      return "zh-CN";
    case "ru":
      return "ru-RU";
    case "de":
      return "de-DE";
    default:
      return "en-US";
  }
}
