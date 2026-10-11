"use strict";

const cheerio = require("cheerio");
const { CookieJar } = require("./cookieJar");
const { createLogger } = require("./logger");
const { gatewayFetch, getGatewayProxyLabel } = require("./gatewayDispatcher");

const log = createLogger("gatewayService");

const ZIBAL_BASE = "https://gateway.zibal.ir/start";
const SEP_BASE = "https://sep.shaparak.ir/OnlinePG";
const SEP_ORIGIN = "https://sep.shaparak.ir";

const DEFAULT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "fa-IR,fa;q=0.9,en-US;q=0.8,en;q=0.7",
};

/** @type {Map<string, { jar: CookieJar, zibalId: string, createdAt: number }>} */
const sessionStore = new Map();

const SESSION_TTL_MS = 20 * 60 * 1000;
const FETCH_RETRIES = 2;

function pruneSessions() {
  const now = Date.now();
  for (const [key, value] of sessionStore) {
    if (now - value.createdAt > SESSION_TTL_MS) sessionStore.delete(key);
  }
}

function networkCause(err) {
  const cause = err && typeof err === "object" ? err.cause : null;
  if (!cause) return err instanceof Error ? err.message : String(err);
  return cause.code || cause.message || String(cause);
}

function isRetryableNetworkError(err) {
  const code = String(networkCause(err) || "");
  return /CONNECT_TIMEOUT|ECONNRESET|ECONNREFUSED|ETIMEDOUT|UND_ERR_SOCKET|EAI_AGAIN|ENOTFOUND|fetch failed/i.test(
    code,
  );
}

function friendlyNetworkError(err, hostLabel) {
  const code = String(networkCause(err) || "");
  if (/CONNECT_TIMEOUT|ETIMEDOUT/i.test(code)) {
    return `اتصال به ${hostLabel} برقرار نشد (تایم‌اوت). اگر VPN روشن است، دامنه شاپرک را Direct کنید و دوباره تلاش کنید.`;
  }
  if (/ECONNRESET|UND_ERR_SOCKET/i.test(code)) {
    return `ارتباط با ${hostLabel} قطع شد. لطفاً چند لحظه بعد دوباره تلاش کنید.`;
  }
  return `خطا در ارتباط با ${hostLabel}: ${code}`;
}

async function fetchText(url, options = {}) {
  const method = options.method || "GET";
  let lastErr;

  for (let attempt = 1; attempt <= FETCH_RETRIES; attempt += 1) {
    const started = Date.now();
    log.debug("HTTP request started", { method, url, attempt });
    try {
      const response = await gatewayFetch(url, {
        ...options,
        headers: {
          ...DEFAULT_HEADERS,
          ...(options.headers || {}),
        },
        redirect: "follow",
      });

      const body = await response.text();
      log.debug("HTTP request completed", {
        method,
        url,
        status: response.status,
        durationMs: Date.now() - started,
        bodyLength: body.length,
        attempt,
      });

      return { response, body };
    } catch (err) {
      lastErr = err;
      const cause = networkCause(err);
      log.warn("HTTP request failed", {
        method,
        url,
        attempt,
        durationMs: Date.now() - started,
        cause,
      });
      if (attempt < FETCH_RETRIES && isRetryableNetworkError(err)) {
        await new Promise((r) => setTimeout(r, 400 * attempt));
        continue;
      }
      break;
    }
  }

  const hostLabel = /shaparak\.ir/i.test(url)
    ? "درگاه شاپرک"
    : /zibal\.ir/i.test(url)
      ? "زیبال"
      : "درگاه پرداخت";
  throw new Error(friendlyNetworkError(lastErr, hostLabel));
}

async function fetchZibalToken(zibalId) {
  const url = `${ZIBAL_BASE}/${zibalId}`;
  const { response, body } = await fetchText(url);
  if (!response.ok) {
    throw new Error(`Zibal returned HTTP ${response.status}`);
  }

  const tokenMatch = body.match(/name="token"\s+value="([a-f0-9]{32})"/i);
  if (!tokenMatch) {
    log.error("SEP token not found inside Zibal HTML", { zibalId, preview: body.slice(0, 400) });
    throw new Error("Payment token not found in Zibal response");
  }

  return tokenMatch[1];
}

async function fetchSepPage(token, jar) {
  const url = `${SEP_BASE}/SendToken?token=${encodeURIComponent(token)}`;
  const { response, body } = await fetchText(url, {
    headers: {
      Cookie: jar.toHeader(),
    },
  });

  jar.ingest(response);

  if (!response.ok) {
    throw new Error(`SEP returned HTTP ${response.status}`);
  }

  return body;
}

function parseSepPage(html) {
  const $ = cheerio.load(html);

  const errorBlock = $(".response.danger h3").first().text().trim();
  if (errorBlock) {
    return { ok: false, error: errorBlock };
  }

  const scriptText = $("script")
    .map((_, el) => $(el).html() || "")
    .get()
    .find((s) => s.includes("userSessionKey"));

  const sessionKeyMatch = scriptText?.match(/userSessionKey\s*=\s*"([^"]+)"/);
  const sessionKey = sessionKeyMatch?.[1] || $('input[name="SessionKey"]').first().val()?.toString();

  if (!sessionKey) {
    throw new Error("Session key not found in SEP response");
  }

  const merchantName = $(".merchant-name h2").first().text().trim();
  const amount = $(".purchase-value .value h2").first().text().trim();
  const amountLetters = $(".purchase-value .letters small").first().text().replace(/\s+/g, " ").trim();

  const merchantInfo = [];
  $(".merchant-info .item").each((_, el) => {
    const label = $(el).find("span").first().text().replace(/\s+/g, " ").trim();
    const value = $(el).find("em").first().text().trim();
    // Drop پرداخت‌یار — Tomanit shell never shows payment-assistant row
    if (/پرداخت\s*یار/.test(label)) return;
    if (label || value) merchantInfo.push({ label, value });
  });

  // Never surface merchant photos on the Tomanit / SEP shell
  const merchantLogos = [];

  const timeout = $("[data-timeout]").first().attr("data-timeout") || "599000";
  const verificationToken = $('input[name="__RequestVerificationToken"]').first().val()?.toString() || "";
  const currentYear = $("#Year").attr("data-current-year") || "";

  // When Zibal allowedCards is set, SEP often pre-fills / locks the PAN
  const panRaw = String($("#CardNumber_PanString").val() || "").replace(/\D/g, "");
  const lockedPan = panRaw.length === 16 ? panRaw : null;

  return {
    ok: true,
    sessionKey,
    merchantName,
    amount,
    amountLetters,
    merchantInfo,
    merchantLogos,
    timeout,
    verificationToken,
    currentYear,
    lockedPan,
  };
}

async function fetchSepCaptcha(sessionKey, jar) {
  const url = `${SEP_BASE}/Captcha/Refresh`;
  const { response, body } = await fetchText(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      Cookie: jar.toHeader(),
      "X-Requested-With": "XMLHttpRequest",
      Accept: "application/json, text/javascript, */*; q=0.01",
      Origin: SEP_ORIGIN,
      Referer: `${SEP_BASE}/SendToken`,
    },
    body: new URLSearchParams({
      sessionKey,
      areaName: "OnlinePG",
    }).toString(),
  });

  jar.ingest(response);

  let data;
  try {
    data = JSON.parse(body);
  } catch {
    throw new Error("Invalid captcha response from SEP");
  }

  if (!data.image) {
    throw new Error("Captcha image not returned by SEP");
  }

  return `data:image/JPEG;base64,${data.image}`;
}

/**
 * Load Zibal→SEP session. Captcha is deferred to the browser (getCaptcha)
 * so first paint is ~1 RTT faster.
 */
async function loadGatewaySession(zibalId) {
  const started = Date.now();
  pruneSessions();

  const proxyLabel = getGatewayProxyLabel();
  if (proxyLabel) {
    log.debug("Loading gateway session via proxy", { proxy: proxyLabel, zibalId });
  }

  const jar = new CookieJar();
  const token = await fetchZibalToken(zibalId);
  const sepHtml = await fetchSepPage(token, jar);
  const parsed = parseSepPage(sepHtml);

  if (!parsed.ok) {
    log.warn("Gateway SEP error", {
      zibalId,
      durationMs: Date.now() - started,
      error: parsed.error,
    });
    return { ok: false, error: parsed.error, zibalId };
  }

  sessionStore.set(parsed.sessionKey, {
    jar,
    zibalId,
    createdAt: Date.now(),
  });

  // Warm captcha in background — client also calls getCaptcha() on load.
  void fetchSepCaptcha(parsed.sessionKey, jar)
    .then((captchaSrc) => {
      const stored = sessionStore.get(parsed.sessionKey);
      if (stored) stored.warmCaptcha = captchaSrc;
    })
    .catch(() => {});

  log.info("Gateway session ready", {
    zibalId,
    sessionKey: parsed.sessionKey,
    durationMs: Date.now() - started,
  });

  return {
    ok: true,
    zibalId,
    payment: {
      ...parsed,
      captchaSrc: "",
      deferCaptcha: true,
      sepToken: token,
    },
  };
}

async function refreshCaptcha(sessionKey) {
  const stored = sessionStore.get(sessionKey);
  if (!stored) {
    throw new Error("Session expired. Please reload the payment page.");
  }

  if (stored.warmCaptcha) {
    const src = stored.warmCaptcha;
    stored.warmCaptcha = undefined;
    return src;
  }

  return fetchSepCaptcha(sessionKey, stored.jar);
}

function getStoredSession(sessionKey) {
  return sessionStore.get(sessionKey);
}

module.exports = {
  loadGatewaySession,
  refreshCaptcha,
  getStoredSession,
  sessionStore,
};
