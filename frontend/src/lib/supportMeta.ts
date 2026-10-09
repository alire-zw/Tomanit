import { t } from "../i18n";

export type SupportCategory = "trade" | "wallet" | "account" | "other";

export const SUPPORT_CATEGORIES: Array<{
  value: SupportCategory;
  labelKey: string;
  hintKey: string;
}> = [
  {
    value: "trade",
    labelKey: "support.catTrade",
    hintKey: "support.catTradeHint",
  },
  {
    value: "wallet",
    labelKey: "support.catWallet",
    hintKey: "support.catWalletHint",
  },
  {
    value: "account",
    labelKey: "support.catAccount",
    hintKey: "support.catAccountHint",
  },
  {
    value: "other",
    labelKey: "support.catOther",
    hintKey: "support.catOtherHint",
  },
];

const CATEGORY_VALUES = new Set<string>(SUPPORT_CATEGORIES.map((item) => item.value));

/** Legacy subjects stored as localized labels before category keys. */
const LEGACY_SUBJECT_TO_CATEGORY: Record<string, SupportCategory> = {
  "خرید و فروش": "trade",
  "Buy & sell": "trade",
  "شراء وبيع": "trade",
  买卖交易: "trade",
  "Покупка и продажа": "trade",
  "Kaufen & verkaufen": "trade",
  "کیف پول و پرداخت": "wallet",
  "Wallet & payments": "wallet",
  "المحفظة والمدفوعات": "wallet",
  "钱包与支付": "wallet",
  "Кошелёк и платежи": "wallet",
  "Wallet & Zahlungen": "wallet",
  "حساب کاربری": "account",
  Account: "account",
  الحساب: "account",
  账户: "account",
  Аккаунт: "account",
  Konto: "account",
  سایر: "other",
  Other: "other",
  أخرى: "other",
  其他: "other",
  Другое: "other",
  Sonstiges: "other",
};

export function resolveSupportCategory(subject: string): SupportCategory | null {
  const trimmed = subject.trim();
  if (CATEGORY_VALUES.has(trimmed)) return trimmed as SupportCategory;
  return LEGACY_SUBJECT_TO_CATEGORY[trimmed] ?? null;
}

/** Display label for a ticket subject (translates category keys + legacy labels). */
export function supportSubjectLabel(subject: string): string {
  const category = resolveSupportCategory(subject);
  if (!category) return subject;
  const meta = SUPPORT_CATEGORIES.find((item) => item.value === category);
  return meta ? t(meta.labelKey) : subject;
}

export function supportStatusLabel(status: string): string {
  switch (status) {
    case "answered":
      return t("support.answered");
    case "closed":
      return t("support.closed");
    default:
      return t("support.open");
  }
}

export function supportTicketTitle(code: string): string {
  return t("support.ticketTitle", { code });
}
