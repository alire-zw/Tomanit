/** Jibit bank code → Persian display name */
export const BANK_CODE_FA: Record<string, string> = {
  MELLI: "بانک ملی",
  MELLAT: "بانک ملت",
  SADERAT: "بانک صادرات",
  TEJARAT: "بانک تجارت",
  PARSIAN: "بانک پارسیان",
  PASARGAD: "بانک پاسارگاد",
  SAMAN: "بانک سامان",
  MASKAN: "بانک مسکن",
  REFAH: "بانک رفاه",
  SEPAH: "بانک سپه",
  AYANDEH: "بانک آینده",
  SHAHR: "بانک شهر",
  RESALAT: "بانک رسالت",
  SINA: "بانک سینا",
  KARAFARIN: "بانک کارآفرین",
  EN: "بانک اقتصاد نوین",
  DEY: "بانک دی",
  TOURISM: "بانک گردشگری",
  IRANZAMIN: "بانک ایران‌زمین",
  POST: "پست بانک",
  SARMAYEH: "بانک سرمایه",
  KESHAVARZI: "بانک کشاورزی",
  ANSAR: "بانک انصار",
  MEHR: "بانک مهر ایران",
};

/** Jibit bank code → frontend icon slug under /banks */
const BANK_CODE_SLUG: Record<string, string> = {
  MELLI: "melli",
  MELLAT: "mellat",
  SADERAT: "saderat",
  TEJARAT: "tejarat",
  PARSIAN: "parsian",
  PASARGAD: "pasargad",
  SAMAN: "saman",
  MASKAN: "maskan",
  REFAH: "refah",
  SEPAH: "sepah",
  AYANDEH: "ayandeh",
  SHAHR: "shahr",
  RESALAT: "resalat",
  SINA: "sina",
  KARAFARIN: "kar-afarin",
  EN: "eghtesad-novin",
  DEY: "dey",
  TOURISM: "tourism",
  IRANZAMIN: "iran-zamin",
  POST: "post",
  SARMAYEH: "sarmayeh",
  KESHAVARZI: "keshavarzi",
  ANSAR: "ansar",
  MEHR: "mehr-iran",
};

export function resolveBankMeta(jibitBank: string | null | undefined): {
  bankName: string | null;
  bankSlug: string | null;
} {
  if (!jibitBank?.trim()) return { bankName: null, bankSlug: null };
  const code = jibitBank.trim().toUpperCase();
  return {
    bankName: BANK_CODE_FA[code] ?? jibitBank,
    bankSlug: BANK_CODE_SLUG[code] ?? code.toLowerCase(),
  };
}
