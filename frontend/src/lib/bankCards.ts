import { apiFetch } from "./api";

export type BankCardRecord = {
  id: number;
  /** Masked PAN from API (never full digits). */
  cardNumber: string;
  last4?: string;
  iban: string | null;
  depositNumber: string | null;
  bankName: string | null;
  bankSlug: string | null;
  bankBin: string | null;
  ownerName: string | null;
  isPrimary: boolean;
  isVerified: boolean;
  matchedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export function listBankCards() {
  return apiFetch<{ cards: BankCardRecord[] }>("/cards");
}

export function addBankCard(input: {
  cardNumber: string;
  bankName?: string;
  bankSlug?: string;
  bankBin?: string;
  /** When ≤500k, backend skips KYC name-match for invoice payees. */
  invoiceAmountToman?: number;
}) {
  return apiFetch<{ card: BankCardRecord }>("/cards", {
    method: "POST",
    body: input,
    /** Jibit card→IBAN inquiry can take longer than default. */
    timeoutMs: 45_000,
  });
}
