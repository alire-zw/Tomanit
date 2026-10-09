import panBinsJson from "../data/panBins.json";

export type DetectedBank = {
  bin: string;
  slug: string;
  nameEn: string;
  nameFa: string;
  iconSrc: string;
  color1: string;
  color2: string;
};

type PanBinRow = {
  bin: string;
  bankName: string;
  bankCode: string;
};

const BINS: PanBinRow[] = Array.isArray(panBinsJson)
  ? panBinsJson
  : Array.isArray((panBinsJson as { default?: PanBinRow[] }).default)
    ? (panBinsJson as { default: PanBinRow[] }).default
    : [];

const BANK_NAMES_FA: Record<string, string> = {
  unknown: "بانک نامشخص",
  mellat: "بانک ملت",
  "export-development": "بانک توسعه صادرات",
  "tosee-taavon": "بانک توسعه تعاون",
  "melli-iran": "بانک ملی ایران",
  mellal: "موسسه اعتباری ملل",
  "mehr-iran": "بانک مهر ایران",
  melli: "بانک ملی",
  saderat: "بانک صادرات",
  keshavarzi: "بانک کشاورزی",
  maskan: "بانک مسکن",
  "credit-istitute-for-development": "موسسه اعتباری توسعه",
  parsian: "بانک پارسیان",
  "industry-mine": "بانک صنعت و معدن",
  ansar: "بانک انصار",
  tejarat: "بانک تجارت",
  "kar-afarin": "بانک کارآفرین",
  "eghtesad-novin": "بانک اقتصاد نوین",
  post: "پست بانک",
  saman: "بانک سامان",
  sarmayeh: "بانک سرمایه",
  ghavamin: "بانک قوامین",
  pasargad: "بانک پاسارگاد",
  sina: "بانک سینا",
  mehr: "بانک مهر",
  hekmat: "بانک حکمت ایرانیان",
  ayandeh: "بانک آینده",
  "iri-central": "بانک مرکزی",
  "middle-east": "بانک خاورمیانه",
  refah: "بانک رفاه",
  sepah: "بانک سپه",
  central: "بانک مرکزی",
  sep: "سپ",
  resalat: "بانک رسالت",
  shahr: "بانک شهر",
  kowsar: "موسسه کوثر",
  tourism: "بانک گردشگری",
  "iran-zamin": "بانک ایران‌زمین",
  dey: "بانک دی",
};

/** Brand-accurate gradients based on Iranian bank identity colors */
const BANK_COLORS: Record<string, { color1: string; color2: string }> = {
  // ملت — طلایی / قرمز رسمی برند (rangebrand.ir)
  mellat: { color1: "#FDBD51", color2: "#D81736" },
  // ملی — سرمه‌ای + زرد هویت کارت ملی
  melli: { color1: "#1E3D7E", color2: "#F7A70B" },
  "melli-iran": { color1: "#1E3D7E", color2: "#F7A70B" },
  // صادرات — بنفش‌آبی برند
  saderat: { color1: "#493E75", color2: "#29166F" },
  // تجارت — آبی سرمه‌ای
  tejarat: { color1: "#4D5988", color2: "#2E428D" },
  // پارسیان — برنزی کارت فیزیکی
  parsian: { color1: "#B17D57", color2: "#5C2E1F" },
  // پاسارگاد — مشکی + طلایی برند
  pasargad: { color1: "#2A2A2A", color2: "#F0C239" },
  // سامان — آبی فیروزه‌ای
  saman: { color1: "#00A8E7", color2: "#006FB8" },
  // مسکن — نارنجی برند
  maskan: { color1: "#F25920", color2: "#9A3412" },
  // رفاه — آبی تیره
  refah: { color1: "#305F7F", color2: "#004B7F" },
  // سپه — نارنجی برند
  sepah: { color1: "#E8651D", color2: "#8B4513" },
  // کشاورزی — سبز + طلایی
  keshavarzi: { color1: "#007A3C", color2: "#14532D" },
  // آینده — قهوه‌ای برند
  ayandeh: { color1: "#B38807", color2: "#522D1D" },
  // شهر — قرمز برند
  shahr: { color1: "#DF343A", color2: "#7F1D1D" },
  // رسالت — آبی روشن
  resalat: { color1: "#00BCE4", color2: "#0C4A6E" },
  // سینا — آبی تیره
  sina: { color1: "#335796", color2: "#19499E" },
  // اقتصاد نوین — بنفش برند
  "eghtesad-novin": { color1: "#97199A", color2: "#4A148C" },
  // کارآفرین — سبز / طلایی
  "kar-afarin": { color1: "#D4AF64", color2: "#157215" },
  // دی — فیروزه‌ای
  dey: { color1: "#008A9F", color2: "#164E63" },
  // گردشگری — قرمز / سبز
  tourism: { color1: "#B01117", color2: "#7F1D1D" },
  // ایران‌زمین — بنفش برند
  "iran-zamin": { color1: "#8E24AA", color2: "#5613A2" },
  // پست‌بانک — سبز
  post: { color1: "#008840", color2: "#14532D" },
  // سرمایه — آبی خاکستری
  sarmayeh: { color1: "#39586F", color2: "#214B6A" },
  // مهر ایران — سبز
  mehr: { color1: "#3AB54A", color2: "#166534" },
  "mehr-iran": { color1: "#289925", color2: "#14532D" },
  // ملل — آبی
  mellal: { color1: "#1D4ED8", color2: "#1E3A8A" },
  // خاورمیانه — نارنجی
  "middle-east": { color1: "#FF8800", color2: "#78350F" },
  // حکمت / انصار / قوامین / کوثر (ادغام‌شده در سپه)
  hekmat: { color1: "#E8651D", color2: "#8B4513" },
  ansar: { color1: "#E8651D", color2: "#8B4513" },
  ghavamin: { color1: "#E8651D", color2: "#8B4513" },
  kowsar: { color1: "#E8651D", color2: "#8B4513" },
  // توسعه تعاون
  "tosee-taavon": { color1: "#0a8999", color2: "#0F4C5C" },
  // صنعت و معدن
  "industry-mine": { color1: "#A88B53", color2: "#3F3A2E" },
  // توسعه صادرات
  "export-development": { color1: "#046B10", color2: "#14532D" },
  // موسسه اعتباری توسعه
  "credit-istitute-for-development": { color1: "#64748B", color2: "#1E293B" },
  // مرکزی
  central: { color1: "#2E8DE0", color2: "#1E3A8A" },
  "iri-central": { color1: "#2E8DE0", color2: "#1E3A8A" },
  unknown: { color1: "#71717A", color2: "#27272A" },
};

const DEFAULT_COLORS = { color1: "#71717A", color2: "#27272A" };

function slugifyBankName(name: string): string {
  const slug = name
    .trim()
    .replace(/[^\w\s]/gi, "")
    .replace(/ /g, "-")
    .replace(/-{2,}/g, "-")
    .toLowerCase();
  return slug || "unknown";
}

function colorsForSlug(slug: string) {
  return BANK_COLORS[slug] ?? DEFAULT_COLORS;
}

export function getBankVisual(slug: string | null | undefined, cardNumber?: string) {
  const fromSlug = slug?.trim();
  if (fromSlug) {
    const colors = colorsForSlug(fromSlug);
    return {
      slug: fromSlug,
      nameFa: BANK_NAMES_FA[fromSlug] ?? fromSlug,
      nameEn: fromSlug,
      iconSrc: `/banks/${fromSlug}.svg`,
      ...colors,
    };
  }

  if (cardNumber) {
    const detected = detectBankFromCardDigits(cardNumber);
    if (detected) {
      return {
        slug: detected.slug,
        nameFa: detected.nameFa,
        nameEn: detected.nameEn,
        iconSrc: detected.iconSrc,
        color1: detected.color1,
        color2: detected.color2,
      };
    }
  }

  return {
    slug: "unknown",
    nameFa: BANK_NAMES_FA.unknown,
    nameEn: "Unknown",
    iconSrc: "/banks/unknown.svg",
    ...DEFAULT_COLORS,
  };
}

export function detectBankFromCardDigits(digits: string): DetectedBank | null {
  try {
    const clean = digits.replace(/\D/g, "");
    if (clean.length < 6) return null;

    const bin = clean.slice(0, 6);
    const row = BINS.find((item) => item.bin === bin);
    if (!row || !row.bankName || row.bankName === "Unknown") {
      const colors = colorsForSlug("unknown");
      return {
        bin,
        slug: "unknown",
        nameEn: "Unknown",
        nameFa: BANK_NAMES_FA.unknown,
        iconSrc: "/banks/unknown.svg",
        ...colors,
      };
    }

    const slug = slugifyBankName(row.bankName);
    const colors = colorsForSlug(slug);
    return {
      bin,
      slug,
      nameEn: row.bankName,
      nameFa: BANK_NAMES_FA[slug] ?? `بانک ${row.bankName}`,
      iconSrc: `/banks/${slug}.svg`,
      ...colors,
    };
  } catch {
    return null;
  }
}
