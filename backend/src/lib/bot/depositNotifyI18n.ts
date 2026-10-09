import type { DepositAssetEmojiKey } from "./premiumEmoji.js";

export type BotLocale = "fa" | "en" | "ar" | "de" | "ru" | "zh";

const SUPPORTED: readonly BotLocale[] = [
  "fa",
  "en",
  "ar",
  "de",
  "ru",
  "zh",
];

export function resolveBotLocale(
  languageCode: string | null | undefined,
): BotLocale {
  const raw = (languageCode ?? "fa").trim().toLowerCase();
  const base = raw.split(/[-_]/)[0] || "fa";
  if ((SUPPORTED as readonly string[]).includes(base)) {
    return base as BotLocale;
  }
  return "fa";
}

const ASSET_NAME: Record<BotLocale, Record<DepositAssetEmojiKey, string>> = {
  fa: {
    trx: "ترون",
    usdt: "تتر",
    bnb: "بایننس",
    matic: "پالیگان",
    gram: "گرام",
  },
  en: {
    trx: "TRON",
    usdt: "Tether",
    bnb: "BNB",
    matic: "Polygon",
    gram: "Gram",
  },
  ar: {
    trx: "ترون",
    usdt: "تيثر",
    bnb: "BNB",
    matic: "بوليجون",
    gram: "جرام",
  },
  de: {
    trx: "TRON",
    usdt: "Tether",
    bnb: "BNB",
    matic: "Polygon",
    gram: "Gram",
  },
  ru: {
    trx: "TRON",
    usdt: "Tether",
    bnb: "BNB",
    matic: "Polygon",
    gram: "Gram",
  },
  zh: {
    trx: "波场",
    usdt: "泰达币",
    bnb: "BNB",
    matic: "Polygon",
    gram: "Gram",
  },
};

const TOMAN: Record<BotLocale, string> = {
  fa: "تومان",
  en: "Toman",
  ar: "تومان",
  de: "Toman",
  ru: "Туман",
  zh: "Toman",
};

type DepositCopy = {
  line1: string;
  line2Full: string;
  line2TomanOnly: string;
  line2FromOnly: string;
  line3Hash: string;
  hashBtn: string;
  miniAppBtn: string;
};

const COPY: Record<BotLocale, DepositCopy> = {
  fa: {
    line1:
      "{{assetEmoji}} واریز <code>{{amount}}</code> <b>{{asset}}</b> به حساب شما با موفقیت انجام شد.",
    line2Full:
      "مبلغ معادل <code>{{toman}}</code> <b>{{tomanUnit}}</b> بوده و تراکنش از کیف پول <code>{{from}}</code> انجام شده است.",
    line2TomanOnly:
      "مبلغ معادل <code>{{toman}}</code> <b>{{tomanUnit}}</b> به کیف پول شما افزوده شد.",
    line2FromOnly:
      "تراکنش از کیف پول <code>{{from}}</code> انجام شده است.",
    line3Hash:
      "{{monitorEmoji}} هش تراکنش را می‌توانید از دکمه زیر مشاهده کنید:",
    hashBtn: "هش تراکنش",
    miniAppBtn: "ورود به مینی‌اپ",
  },
  en: {
    line1:
      "{{assetEmoji}} Deposit of <code>{{amount}}</code> <b>{{asset}}</b> credited to your account successfully.",
    line2Full:
      "Equivalent value: <code>{{toman}}</code> <b>{{tomanUnit}}</b>. Sent from wallet <code>{{from}}</code>.",
    line2TomanOnly:
      "Equivalent value: <code>{{toman}}</code> <b>{{tomanUnit}}</b> has been added to your wallet.",
    line2FromOnly: "Sent from wallet <code>{{from}}</code>.",
    line3Hash:
      "{{monitorEmoji}} You can view the transaction hash via the button below:",
    hashBtn: "Tx hash",
    miniAppBtn: "Open Mini App",
  },
  ar: {
    line1:
      "{{assetEmoji}} تم إيداع <code>{{amount}}</code> <b>{{asset}}</b> في حسابك بنجاح.",
    line2Full:
      "القيمة المعادلة <code>{{toman}}</code> <b>{{tomanUnit}}</b>، وتمت المعاملة من المحفظة <code>{{from}}</code>.",
    line2TomanOnly:
      "القيمة المعادلة <code>{{toman}}</code> <b>{{tomanUnit}}</b> أُضيفت إلى محفظتك.",
    line2FromOnly: "تمت المعاملة من المحفظة <code>{{from}}</code>.",
    line3Hash:
      "{{monitorEmoji}} يمكنك عرض هاش المعاملة من الزر أدناه:",
    hashBtn: "هاش المعاملة",
    miniAppBtn: "فتح الميني آب",
  },
  de: {
    line1:
      "{{assetEmoji}} Einzahlung von <code>{{amount}}</code> <b>{{asset}}</b> wurde erfolgreich gutgeschrieben.",
    line2Full:
      "Gegenwert: <code>{{toman}}</code> <b>{{tomanUnit}}</b>. Gesendet von Wallet <code>{{from}}</code>.",
    line2TomanOnly:
      "Gegenwert: <code>{{toman}}</code> <b>{{tomanUnit}}</b> wurde Ihrem Wallet gutgeschrieben.",
    line2FromOnly: "Gesendet von Wallet <code>{{from}}</code>.",
    line3Hash:
      "{{monitorEmoji}} Den Transaktions-Hash finden Sie über die Schaltfläche unten:",
    hashBtn: "Tx-Hash",
    miniAppBtn: "Mini-App öffnen",
  },
  ru: {
    line1:
      "{{assetEmoji}} Депозит <code>{{amount}}</code> <b>{{asset}}</b> успешно зачислен на ваш счёт.",
    line2Full:
      "Эквивалент: <code>{{toman}}</code> <b>{{tomanUnit}}</b>. Отправлено с кошелька <code>{{from}}</code>.",
    line2TomanOnly:
      "Эквивалент: <code>{{toman}}</code> <b>{{tomanUnit}}</b> зачислен на ваш кошелёк.",
    line2FromOnly: "Отправлено с кошелька <code>{{from}}</code>.",
    line3Hash:
      "{{monitorEmoji}} Хэш транзакции можно открыть кнопкой ниже:",
    hashBtn: "Хэш Tx",
    miniAppBtn: "Открыть Mini App",
  },
  zh: {
    line1:
      "{{assetEmoji}} 已成功将 <code>{{amount}}</code> <b>{{asset}}</b> 存入您的账户。",
    line2Full:
      "等值金额 <code>{{toman}}</code> <b>{{tomanUnit}}</b>，来自钱包 <code>{{from}}</code>。",
    line2TomanOnly:
      "等值金额 <code>{{toman}}</code> <b>{{tomanUnit}}</b> 已计入您的钱包。",
    line2FromOnly: "来自钱包 <code>{{from}}</code>。",
    line3Hash: "{{monitorEmoji}} 可通过下方按钮查看交易哈希：",
    hashBtn: "交易哈希",
    miniAppBtn: "打开小程序",
  },
};

function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? "");
}

export function getAssetDisplayName(
  locale: BotLocale,
  asset: DepositAssetEmojiKey,
): string {
  return ASSET_NAME[locale][asset];
}

export function getTomanUnit(locale: BotLocale): string {
  return TOMAN[locale];
}

type TomanDepositCopy = {
  line1: string;
  line2UsdtGateway: string;
  line2GatewayOnly: string;
  line2UsdtOnly: string;
  miniAppBtn: string;
};

const TOMAN_COPY: Record<BotLocale, TomanDepositCopy> = {
  fa: {
    line1:
      "{{assetEmoji}} واریز <code>{{amount}}</code> <b>{{tomanUnit}}</b> به حساب شما با موفقیت انجام شد.",
    line2UsdtGateway:
      "مبلغ معادل <code>{{usdt}}</code> <b>تتر</b> بوده و از طریق درگاه <b>{{gateway}}</b> انجام شده است.",
    line2GatewayOnly: "پرداخت از طریق درگاه <b>{{gateway}}</b> انجام شده است.",
    line2UsdtOnly:
      "مبلغ معادل <code>{{usdt}}</code> <b>تتر</b> به کیف پول شما افزوده شد.",
    miniAppBtn: "ورود به مینی‌اپ",
  },
  en: {
    line1:
      "{{assetEmoji}} Deposit of <code>{{amount}}</code> <b>{{tomanUnit}}</b> credited to your account successfully.",
    line2UsdtGateway:
      "Equivalent: <code>{{usdt}}</code> <b>USDT</b> via gateway <b>{{gateway}}</b>.",
    line2GatewayOnly: "Paid via gateway <b>{{gateway}}</b>.",
    line2UsdtOnly:
      "Equivalent: <code>{{usdt}}</code> <b>USDT</b> has been added to your wallet.",
    miniAppBtn: "Open Mini App",
  },
  ar: {
    line1:
      "{{assetEmoji}} تم إيداع <code>{{amount}}</code> <b>{{tomanUnit}}</b> في حسابك بنجاح.",
    line2UsdtGateway:
      "المعادل <code>{{usdt}}</code> <b>تيثر</b> عبر بوابة <b>{{gateway}}</b>.",
    line2GatewayOnly: "تم الدفع عبر بوابة <b>{{gateway}}</b>.",
    line2UsdtOnly:
      "المعادل <code>{{usdt}}</code> <b>تيثر</b> أُضيف إلى محفظتك.",
    miniAppBtn: "فتح الميني آب",
  },
  de: {
    line1:
      "{{assetEmoji}} Einzahlung von <code>{{amount}}</code> <b>{{tomanUnit}}</b> wurde erfolgreich gutgeschrieben.",
    line2UsdtGateway:
      "Gegenwert: <code>{{usdt}}</code> <b>USDT</b> über Gateway <b>{{gateway}}</b>.",
    line2GatewayOnly: "Bezahlt über Gateway <b>{{gateway}}</b>.",
    line2UsdtOnly:
      "Gegenwert: <code>{{usdt}}</code> <b>USDT</b> wurde Ihrem Wallet gutgeschrieben.",
    miniAppBtn: "Mini-App öffnen",
  },
  ru: {
    line1:
      "{{assetEmoji}} Депозит <code>{{amount}}</code> <b>{{tomanUnit}}</b> успешно зачислен на ваш счёт.",
    line2UsdtGateway:
      "Эквивалент: <code>{{usdt}}</code> <b>USDT</b> через шлюз <b>{{gateway}}</b>.",
    line2GatewayOnly: "Оплата через шлюз <b>{{gateway}}</b>.",
    line2UsdtOnly:
      "Эквивалент: <code>{{usdt}}</code> <b>USDT</b> зачислен на ваш кошелёк.",
    miniAppBtn: "Открыть Mini App",
  },
  zh: {
    line1:
      "{{assetEmoji}} 已成功将 <code>{{amount}}</code> <b>{{tomanUnit}}</b> 存入您的账户。",
    line2UsdtGateway:
      "等值 <code>{{usdt}}</code> <b>USDT</b>，通过网关 <b>{{gateway}}</b>。",
    line2GatewayOnly: "通过网关 <b>{{gateway}}</b> 支付。",
    line2UsdtOnly: "等值 <code>{{usdt}}</code> <b>USDT</b> 已计入您的钱包。",
    miniAppBtn: "打开小程序",
  },
};

export function buildTomanDepositNotifyContent(params: {
  locale: BotLocale;
  assetEmojiHtml: string;
  amount: string;
  usdt: string | null;
  gatewayName: string | null;
}): { text: string; miniAppBtn: string } {
  const copy = TOMAN_COPY[params.locale];
  const vars: Record<string, string> = {
    assetEmoji: params.assetEmojiHtml,
    amount: params.amount,
    tomanUnit: getTomanUnit(params.locale),
    usdt: params.usdt ?? "",
    gateway: params.gatewayName ?? "",
  };

  const parts = [fill(copy.line1, vars)];
  if (params.usdt && params.gatewayName) {
    parts.push("", fill(copy.line2UsdtGateway, vars));
  } else if (params.gatewayName) {
    parts.push("", fill(copy.line2GatewayOnly, vars));
  } else if (params.usdt) {
    parts.push("", fill(copy.line2UsdtOnly, vars));
  }

  return {
    text: parts.join("\n"),
    miniAppBtn: copy.miniAppBtn,
  };
}

export function buildDepositNotifyContent(params: {
  locale: BotLocale;
  assetEmojiHtml: string;
  monitorEmojiHtml: string;
  amount: string;
  assetName: string;
  toman: string | null;
  fromAddress: string | null;
  hasHash: boolean;
}): { text: string; hashBtn: string; miniAppBtn: string } {
  const copy = COPY[params.locale];
  const vars: Record<string, string> = {
    assetEmoji: params.assetEmojiHtml,
    monitorEmoji: params.monitorEmojiHtml,
    amount: params.amount,
    asset: params.assetName,
    toman: params.toman ?? "",
    tomanUnit: getTomanUnit(params.locale),
    from: params.fromAddress ?? "",
  };

  const parts = [fill(copy.line1, vars)];

  if (params.toman != null && params.fromAddress) {
    parts.push("", fill(copy.line2Full, vars));
  } else if (params.toman != null) {
    parts.push("", fill(copy.line2TomanOnly, vars));
  } else if (params.fromAddress) {
    parts.push("", fill(copy.line2FromOnly, vars));
  }

  if (params.hasHash) {
    parts.push("", fill(copy.line3Hash, vars));
  }

  return {
    text: parts.join("\n"),
    hashBtn: copy.hashBtn,
    miniAppBtn: copy.miniAppBtn,
  };
}
