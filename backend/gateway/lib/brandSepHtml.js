"use strict";

const cheerio = require("cheerio");
const {
  MERCHANT_NAME,
  randomMerchantTerminal,
  randomReference,
  isPaymentAssistantLabel,
} = require("./merchantBranding");

/**
 * Force تومانیت branding + random terminal/reference on any SEP HTML
 * (payment form after culture switch, or success/fail result pages).
 */
function brandSepHtml(html) {
  if (!html || typeof html !== "string") return html;
  if (
    !html.includes("merchant-name") &&
    !html.includes("merchant-info") &&
    !html.includes("نتیجه تراکنش") &&
    !html.includes("response success") &&
    !html.includes("response danger")
  ) {
    return html;
  }

  const $ = cheerio.load(html, { decodeEntities: false });
  const terminal = randomMerchantTerminal();
  const reference = randomReference();

  const $name = $(".merchant-name h2").first();
  if ($name.length) $name.text(MERCHANT_NAME);

  // Result pages sometimes put acceptor name in other spots
  $(".response .merchant-name, .result .merchant-name, h2.merchant-name").each(
    (_, el) => {
      $(el).text(MERCHANT_NAME);
    },
  );

  $(".merchant-info .item, .info-list .item, .detail-list li, .response .item").each(
    (_, el) => {
      const $el = $(el);
      const label = ($el.find("span, .label, dt").first().text() || "").trim();
      const $value = $el.find("em, .value, dd, strong").first();
      const $fallback = $el.find("span").eq(1);
      if (!$value.length && !$fallback.length) return;

      if (isPaymentAssistantLabel(label)) {
        $el.remove();
        return;
      }
      if (
        /شماره\s*پذیرنده|ترمینال|Terminal\s*No|Acceptor\s*No|Merchant\s*ID/i.test(
          label,
        )
      ) {
        ($value.length ? $value : $fallback).text(terminal);
        return;
      }
      if (
        /سایت\s*پذیرنده|ارجاع|مرجع|پیگیری|Reference|RRN|Tracking|Website|Site/i.test(
          label,
        )
      ) {
        const $label = $el.find("span, .label, dt").first();
        if ($label.length && /سایت|Website|Site/i.test(label)) {
          $label.text(/[A-Za-z]/.test(label) ? "Reference No." : "شماره ارجاع");
        }
        ($value.length ? $value : $fallback).text(reference);
      }
    },
  );

  // Drop payment-assistant / partner logos if any slipped through
  $(".merchant-logo, .tomanit-logo").remove();

  return $.html();
}

module.exports = { brandSepHtml, MERCHANT_NAME };
