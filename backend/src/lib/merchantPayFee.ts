/** Default invoice fee rate (not shown as % in UI). */
export const MERCHANT_INVOICE_FEE_RATE = 0.1;

export type MerchantFeeBearer = "payer" | "merchant" | "split";

export const MERCHANT_FEE_BEARERS: MerchantFeeBearer[] = [
  "payer",
  "merchant",
  "split",
];

export function parseFeeBearer(value: unknown): MerchantFeeBearer {
  if (value === "merchant" || value === "split" || value === "payer") return value;
  return "payer";
}

export function merchantInvoiceFeeToman(amountToman: number): number {
  if (!Number.isFinite(amountToman) || amountToman <= 0) return 0;
  return Math.round(amountToman * MERCHANT_INVOICE_FEE_RATE);
}

/** Portion of the fee charged to the payer (gateway amount − invoice). */
export function merchantInvoicePayerFeeToman(
  amountToman: number,
  feeBearer: MerchantFeeBearer = "payer",
): number {
  const fee = merchantInvoiceFeeToman(amountToman);
  if (feeBearer === "merchant") return 0;
  if (feeBearer === "split") return Math.floor(fee / 2);
  return fee;
}

/** Amount the payer must pay via gateway. */
export function merchantInvoiceTotalToman(
  amountToman: number,
  feeBearer: MerchantFeeBearer = "payer",
): number {
  return amountToman + merchantInvoicePayerFeeToman(amountToman, feeBearer);
}

/** Shop balance credit after a successful payment (full fee always deducted from platform view). */
export function merchantInvoiceCreditToman(
  amountToman: number,
  feeBearer: MerchantFeeBearer = "payer",
): number {
  const fee = merchantInvoiceFeeToman(amountToman);
  const payerFee = merchantInvoicePayerFeeToman(amountToman, feeBearer);
  // credit = invoice − merchant's share of fee = chargeTotal − fullFee
  return amountToman + payerFee - fee;
}
