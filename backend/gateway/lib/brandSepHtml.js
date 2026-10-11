"use strict";

const cheerio = require("cheerio");
const {
  MERCHANT_NAME,
  randomMerchantTerminal,
  randomReference,
  isPaymentAssistantLabel,
} = require("./merchantBranding");

/** Partner / panel names that must never appear on the SEP shell. */
const FORCED_NAME_RE =
  /وان[\u200c\u00a0\s]*ساب|وانساب|onesub\.?ir|onesub|one[\s_-]*sub/gi;

/**
 * Force تومانیت branding + random terminal/reference on any SEP HTML
 * (payment form after culture switch, or success/fail result pages).
 */
function brandSepHtml(html) {
  if (!html || typeof html !== "string") return html;
  const hasForcedName = FORCED_NAME_RE.test(html);
  FORCED_NAME_RE.lastIndex = 0;
  if (
    !html.includes("merchant-name") &&
    !html.includes("merchant-info") &&
    !html.includes("نتیجه تراکنش") &&
    !html.includes("نتیجه پرداخت") &&
    !html.includes("تراکنش موفق") &&
    !html.includes("response success") &&
    !html.includes("response danger") &&
    !hasForcedName
  ) {
    return html;
  }

  const $ = cheerio.load(html, { decodeEntities: false });
  const terminal = randomMerchantTerminal();
  const reference = randomReference();

  const setName = ($el) => {
    if ($el && $el.length) $el.text(MERCHANT_NAME);
  };

  setName($(".merchant-name h2").first());
  $(".response .merchant-name, .result .merchant-name, h2.merchant-name").each(
    (_, el) => setName($(el)),
  );

  // Result pages: acceptor name often sits in a labeled row
  $(
    ".merchant-info .item, .info-list .item, .detail-list li, .response .item, .purchase-result .item, table tr",
  ).each((_, el) => {
    const $el = $(el);
    const label = (
      $el.find("span, .label, dt, th, td").first().text() || ""
    ).trim();
    const $value = $el.find("em, .value, dd, strong, h2, h3").first();
    const $fallback = $el.children("span, td, em").eq(1);
    const $target = $value.length ? $value : $fallback;

    if (isPaymentAssistantLabel(label)) {
      $el.remove();
      return;
    }

    // Name row (پذیرنده / Merchant / Acceptor) — force تومانیت
    if (
      /^(پذیرنده|نام\s*پذیرنده|فروشگاه|Merchant|Acceptor|Shop)\b/i.test(label) ||
      (/پذیرنده|Merchant|Acceptor/i.test(label) &&
        !/شماره|ترمینال|سایت|Terminal|Website|Site|Reference|پیگیری|ارجاع/i.test(
          label,
        ))
    ) {
      if ($target.length) $target.text(MERCHANT_NAME);
      else if (/وان|onesub|ساب/i.test($el.text())) {
        $el.find("h2, h3, em, strong, span").last().text(MERCHANT_NAME);
      }
      return;
    }

    if (
      /شماره\s*پذیرنده|ترمینال|Terminal\s*No|Acceptor\s*No|Merchant\s*ID/i.test(
        label,
      )
    ) {
      if ($target.length) $target.text(terminal);
      return;
    }

    if (
      /سایت\s*پذیرنده|ارجاع|مرجع|پیگیری|Reference|RRN|Tracking|Website|Site/i.test(
        label,
      )
    ) {
      const $label = $el.find("span, .label, dt, th").first();
      if ($label.length && /سایت|Website|Site/i.test(label)) {
        $label.text(/[A-Za-z]/.test(label) ? "Reference No." : "شماره ارجاع");
      }
      if ($target.length) $target.text(reference);
    }
  });

  // Strip leftover partner names anywhere in visible text nodes
  $("*")
    .contents()
    .each((_, node) => {
      if (node.type !== "text") return;
      const raw = node.data || "";
      if (!FORCED_NAME_RE.test(raw)) {
        FORCED_NAME_RE.lastIndex = 0;
        return;
      }
      FORCED_NAME_RE.lastIndex = 0;
      node.data = raw.replace(FORCED_NAME_RE, MERCHANT_NAME);
    });

  // Drop payment-assistant / partner logos if any slipped through
  $(".merchant-logo, .tomanit-logo").remove();

  let out = $.html();
  // Final pass: any leftover partner brand strings → تومانیت
  out = out.replace(FORCED_NAME_RE, MERCHANT_NAME);
  return out;
}

module.exports = { brandSepHtml, MERCHANT_NAME };
