import type { BotLocale } from "./depositNotifyI18n.js";
import {
  LANG_FLAG_EMOJI,
  START_UI_EMOJI,
  tgPremiumEmoji,
  type BotLangCode,
} from "./premiumEmoji.js";

export const BOT_LANGS: readonly {
  code: BotLangCode;
  nativeName: string;
}[] = [
  { code: "en", nativeName: "English" },
  { code: "zh", nativeName: "中文" },
  { code: "fa", nativeName: "فارسی" },
  { code: "de", nativeName: "Deutsch" },
  { code: "ru", nativeName: "Русский" },
  { code: "ar", nativeName: "العربية" },
] as const;

export function isBotLangCode(value: string): value is BotLangCode {
  return value in LANG_FLAG_EMOJI;
}

type GlassBtn = {
  text: string;
  icon_custom_emoji_id: string;
  callback_data?: string;
  web_app?: { url: string };
};

function b(text: string): string {
  return `<b>${text}</b>`;
}

export function buildLanguagePickText(
  mode: "firstStart" | "settings" = "firstStart",
): string {
  const eyes = tgPremiumEmoji(
    START_UI_EMOJI.eyes.fallback,
    START_UI_EMOJI.eyes.id,
  );
  const globe = tgPremiumEmoji(
    START_UI_EMOJI.globe.fallback,
    START_UI_EMOJI.globe.id,
  );

  const faAsk = `${globe} لطفاً ${b("زبان موردنظر")} خود را برای ادامه و استفاده از خدمات پلتفرم انتخاب کنید.`;
  const enAsk = `${globe} Please select your ${b("preferred language")} to continue.`;

  if (mode === "settings") {
    return [faAsk, enAsk].join("\n\n");
  }

  return [
    `${eyes} به پلتفرم ${b("تومانیت")} خوش آمدید.`,
    faAsk,
    enAsk,
  ].join("\n\n");
}

type WelcomeCopy = {
  text: string;
  miniAppBtn: string;
  settingsBtn: string;
  supportBtn: string;
};

export function buildStartWelcome(locale: BotLocale): WelcomeCopy {
  const thumbs = tgPremiumEmoji(
    START_UI_EMOJI.thumbsUp.fallback,
    START_UI_EMOJI.thumbsUp.id,
  );
  const money = tgPremiumEmoji(
    START_UI_EMOJI.money.fallback,
    START_UI_EMOJI.money.id,
  );
  const down = tgPremiumEmoji(
    START_UI_EMOJI.down.fallback,
    START_UI_EMOJI.down.id,
  );

  const copy: Record<
    BotLocale,
    {
      hello: string;
      body: string;
      cta: string;
      miniAppBtn: string;
      settingsBtn: string;
      supportBtn: string;
    }
  > = {
    fa: {
      hello: `با سلام و به پلتفرم ${b("تومانیت")} خوش آمدید.`,
      body: `از طریق این ربات می‌توانید به خدمات ${b("خرید، فروش و انتقال رمزارزهای پشتیبانی‌شده")} دسترسی داشته باشید و در صورت داشتن کسب‌وکار، از ${b("درگاه پرداخت رمزارزی")} و خدمات ${b("API")} استفاده کنید.`,
      cta: `برای شروع، روی دکمه زیر بزنید و وارد ${b("مینی‌اپ")} شوید.`,
      miniAppBtn: "ورود به مینی‌اپ",
      settingsBtn: "تنظیمات",
      supportBtn: "پشتیبانی",
    },
    en: {
      hello: `Hello and welcome to the ${b("Tomanit")} platform.`,
      body: `Through this bot you can access ${b("buy, sell, and transfer")} services for supported cryptocurrencies, and if you have a business, use the ${b("crypto payment gateway")} and ${b("API")} services.`,
      cta: `To get started, tap the button below and open the ${b("mini app")}.`,
      miniAppBtn: "Open mini app",
      settingsBtn: "Settings",
      supportBtn: "Support",
    },
    ar: {
      hello: `مرحباً بكم في منصة ${b("تومانيت")}.`,
      body: `من خلال هذا البوت يمكنكم الوصول إلى خدمات ${b("شراء وبيع وتحويل")} العملات الرقمية المدعومة، وإذا كنتم تملكون نشاطاً تجارياً يمكنكم استخدام ${b("بوابة الدفع بالعملات الرقمية")} وخدمات ${b("API")}.`,
      cta: `للبدء، اضغطوا على الزر أدناه وادخلوا إلى ${b("الميني أب")}.`,
      miniAppBtn: "دخول الميني أب",
      settingsBtn: "الإعدادات",
      supportBtn: "الدعم",
    },
    de: {
      hello: `Hallo und willkommen auf der ${b("Tomanit")}-Plattform.`,
      body: `Über diesen Bot können Sie ${b("Kauf-, Verkaufs- und Transferdienste")} für unterstützte Kryptowährungen nutzen und bei Bedarf das ${b("Krypto-Zahlungsgateway")} sowie ${b("API")}-Dienste für Ihr Unternehmen verwenden.`,
      cta: `Tippen Sie zum Starten auf die Schaltfläche unten und öffnen Sie die ${b("Mini-App")}.`,
      miniAppBtn: "Mini-App öffnen",
      settingsBtn: "Einstellungen",
      supportBtn: "Support",
    },
    ru: {
      hello: `Здравствуйте и добро пожаловать на платформу ${b("Tomanit")}.`,
      body: `Через этого бота вы можете пользоваться услугами ${b("покупки, продажи и перевода")} поддерживаемых криптовалют, а также при наличии бизнеса — ${b("крипто-платёжным шлюзом")} и ${b("API")}.`,
      cta: `Чтобы начать, нажмите кнопку ниже и откройте ${b("мини-приложение")}.`,
      miniAppBtn: "Открыть мини-приложение",
      settingsBtn: "Настройки",
      supportBtn: "Поддержка",
    },
    zh: {
      hello: `您好，欢迎来到 ${b("Tomanit")} 平台。`,
      body: `通过本机器人，您可以使用受支持加密货币的${b("买卖与转账")}服务；如有业务需求，还可使用${b("加密支付网关")}和 ${b("API")} 服务。`,
      cta: `点击下方按钮，进入${b("迷你应用")}开始使用。`,
      miniAppBtn: "进入迷你应用",
      settingsBtn: "设置",
      supportBtn: "客服",
    },
  };

  const item = copy[locale];
  return {
    text: [`${thumbs} ${item.hello}`, `${money} ${item.body}`, `${down} ${item.cta}`].join(
      "\n\n",
    ),
    miniAppBtn: item.miniAppBtn,
    settingsBtn: item.settingsBtn,
    supportBtn: item.supportBtn,
  };
}

type SettingsCopy = {
  text: string;
  languageBtn: string;
  developersBtn: string;
  backBtn: string;
};

export function buildSettingsPanel(locale: BotLocale): SettingsCopy {
  const gear = tgPremiumEmoji(
    START_UI_EMOJI.settings.fallback,
    START_UI_EMOJI.settings.id,
  );

  const copy: Record<
    BotLocale,
    {
      welcome: string;
      body: string;
      languageBtn: string;
      developersBtn: string;
      backBtn: string;
    }
  > = {
    fa: {
      welcome: `به بخش ${b("تنظیمات")} خوش آمدید.`,
      body: `در این بخش می‌توانید ${b("زبان پلتفرم")} را تغییر دهید و اطلاعات مربوط به ${b("توسعه‌دهندگان")} را مشاهده کنید. برای دسترسی به هر یک از این امکانات، گزینه موردنظر خود را انتخاب کنید:`,
      languageBtn: "زبان",
      developersBtn: "توسعه دهندگان",
      backBtn: "بازگشت",
    },
    en: {
      welcome: `Welcome to ${b("Settings")}.`,
      body: `Here you can change the ${b("platform language")} and view ${b("developer")} information. Choose an option below:`,
      languageBtn: "Language",
      developersBtn: "Developers",
      backBtn: "Back",
    },
    ar: {
      welcome: `مرحباً بكم في ${b("الإعدادات")}.`,
      body: `هنا يمكنكم تغيير ${b("لغة المنصة")} وعرض معلومات ${b("المطوّرين")}. اختروا أحد الخيارات:`,
      languageBtn: "اللغة",
      developersBtn: "المطوّرون",
      backBtn: "رجوع",
    },
    de: {
      welcome: `Willkommen in den ${b("Einstellungen")}.`,
      body: `Hier können Sie die ${b("Plattformsprache")} ändern und ${b("Entwickler")}-informationen einsehen. Wählen Sie eine Option:`,
      languageBtn: "Sprache",
      developersBtn: "Entwickler",
      backBtn: "Zurück",
    },
    ru: {
      welcome: `Добро пожаловать в ${b("настройки")}.`,
      body: `Здесь вы можете сменить ${b("язык платформы")} и посмотреть информацию о ${b("разработчиках")}. Выберите нужный пункт:`,
      languageBtn: "Язык",
      developersBtn: "Разработчики",
      backBtn: "Назад",
    },
    zh: {
      welcome: `欢迎来到${b("设置")}。`,
      body: `您可以在此更改${b("平台语言")}并查看${b("开发者")}信息。请选择下方选项：`,
      languageBtn: "语言",
      developersBtn: "开发者",
      backBtn: "返回",
    },
  };

  const item = copy[locale];
  return {
    text: [`${gear} ${item.welcome}`, item.body].join("\n\n"),
    languageBtn: item.languageBtn,
    developersBtn: item.developersBtn,
    backBtn: item.backBtn,
  };
}

type DevsCopy = {
  text: string;
  backBtn: string;
};

export function buildDevelopersPanel(locale: BotLocale): DevsCopy {
  const monitor = tgPremiumEmoji(
    START_UI_EMOJI.monitor.fallback,
    START_UI_EMOJI.monitor.id,
  );

  const copy: Record<BotLocale, { body: string; backBtn: string }> = {
    fa: {
      body: `پلتفرم ${b("تومانیت")} توسط ${b("تیم تومانیت")} توسعه داده شده است. برای پیشنهادها، همکاری فنی یا گزارش باگ می‌توانید از بخش ${b("پشتیبانی")} مینی‌اپ با ما در ارتباط باشید.`,
      backBtn: "بازگشت",
    },
    en: {
      body: `The ${b("Tomanit")} platform is built by the ${b("Tomanit team")}. For suggestions, technical collaboration, or bug reports, contact us via ${b("Support")} in the mini app.`,
      backBtn: "Back",
    },
    ar: {
      body: `تم تطوير منصة ${b("تومانيت")} بواسطة ${b("فريق تومانيت")}. للاقتراحات أو التعاون التقني أو الإبلاغ عن الأخطاء، تواصلوا معنا عبر ${b("الدعم")} في الميني أب.`,
      backBtn: "رجوع",
    },
    de: {
      body: `Die ${b("Tomanit")}-Plattform wird vom ${b("Tomanit-Team")} entwickelt. Für Vorschläge, technische Zusammenarbeit oder Fehlerberichte nutzen Sie bitte den ${b("Support")} in der Mini-App.`,
      backBtn: "Zurück",
    },
    ru: {
      body: `Платформа ${b("Tomanit")} разработана ${b("командой Tomanit")}. Для предложений, технического сотрудничества или сообщений об ошибках свяжитесь с нами через ${b("поддержку")} в мини-приложении.`,
      backBtn: "Назад",
    },
    zh: {
      body: `${b("Tomanit")} 平台由 ${b("Tomanit 团队")}开发。如需建议、技术合作或反馈问题，请通过迷你应用中的${b("客服")}联系我们。`,
      backBtn: "返回",
    },
  };

  const item = copy[locale];
  return {
    text: `${monitor} ${item.body}`,
    backBtn: item.backBtn,
  };
}

export function languageKeyboard(opts?: {
  /** When opened from settings, use setlang: so we return to settings after pick */
  fromSettings?: boolean;
  backCallback?: string;
  backLabel?: string;
}): GlassBtn[][] {
  const prefix = opts?.fromSettings ? "setlang:" : "lang:";
  const buttons: GlassBtn[] = BOT_LANGS.map((lang) => {
    const flag = LANG_FLAG_EMOJI[lang.code];
    return {
      text: lang.nativeName,
      callback_data: `${prefix}${lang.code}`,
      icon_custom_emoji_id: flag.id,
    };
  });

  const rows: GlassBtn[][] = [];
  for (let i = 0; i < buttons.length; i += 2) {
    rows.push(buttons.slice(i, i + 2));
  }

  if (opts?.backCallback && opts.backLabel) {
    rows.push([
      {
        text: opts.backLabel,
        callback_data: opts.backCallback,
        icon_custom_emoji_id: START_UI_EMOJI.down.id,
      },
    ]);
  }

  return rows;
}

export function welcomeKeyboard(
  locale: BotLocale,
  miniAppUrl: string,
  supportUrl: string,
): GlassBtn[][] {
  const content = buildStartWelcome(locale);
  return [
    [
      {
        text: content.miniAppBtn,
        web_app: { url: miniAppUrl },
        icon_custom_emoji_id: START_UI_EMOJI.miniapp.id,
      },
    ],
    [
      {
        text: content.supportBtn,
        web_app: { url: supportUrl },
        icon_custom_emoji_id: START_UI_EMOJI.support.id,
      },
      {
        text: content.settingsBtn,
        callback_data: "menu:settings",
        icon_custom_emoji_id: START_UI_EMOJI.settings.id,
      },
    ],
  ];
}

export function settingsKeyboard(locale: BotLocale): GlassBtn[][] {
  const content = buildSettingsPanel(locale);
  return [
    [
      {
        text: content.languageBtn,
        callback_data: "menu:lang",
        icon_custom_emoji_id: START_UI_EMOJI.globe.id,
      },
      {
        text: content.developersBtn,
        callback_data: "menu:devs",
        icon_custom_emoji_id: START_UI_EMOJI.monitor.id,
      },
    ],
    [
      {
        text: content.backBtn,
        callback_data: "menu:home",
        icon_custom_emoji_id: START_UI_EMOJI.down.id,
      },
    ],
  ];
}

export function developersKeyboard(locale: BotLocale): GlassBtn[][] {
  const content = buildDevelopersPanel(locale);
  return [
    [
      {
        text: content.backBtn,
        callback_data: "menu:settings",
        icon_custom_emoji_id: START_UI_EMOJI.down.id,
      },
    ],
  ];
}
