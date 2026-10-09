export const KYC_TERMS_ACCEPTED_KEY = "tomanit.kyc.termsAcceptedAt";
export const KYC_DRAFT_KEY = "tomanit.kyc.draft";

export type KycDraft = {
  nationalId?: string;
  birthDate?: string;
  cardDigits?: string;
  bankName?: string | null;
  bankSlug?: string | null;
};

/** In-memory only — never persist national ID / PAN to localStorage. */
let memoryDraft: KycDraft = {};

function scrubLegacyStorage(): void {
  try {
    localStorage.removeItem(KYC_DRAFT_KEY);
  } catch {
    // ignore
  }
}

export function readKycDraft(): KycDraft {
  scrubLegacyStorage();
  return { ...memoryDraft };
}

export function writeKycDraft(patch: Partial<KycDraft>): KycDraft {
  scrubLegacyStorage();
  memoryDraft = { ...memoryDraft, ...patch };
  return { ...memoryDraft };
}

export function clearKycDraft(): void {
  memoryDraft = {};
  scrubLegacyStorage();
}

export function hasAcceptedKycTerms(): boolean {
  return Boolean(localStorage.getItem(KYC_TERMS_ACCEPTED_KEY));
}
