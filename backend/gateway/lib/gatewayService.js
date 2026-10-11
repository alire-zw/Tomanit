"use strict";

const cheerio = require("cheerio");
const { CookieJar } = require("./cookieJar");
const { createLogger } = require("./logger");
const { gatewayFetch, getGatewayProxyLabel } = require("./gatewayDispatcher");
const {
  CODES,
  GatewayPayError,
  networkCause,
  isRetryableNetworkError,
  toGatewayPayError,
  sanitizePublicMessage,
} = require("./gatewayErrors");

const log = createLogger("gatewayService");

const START_BASE = "https://gateway.zibal.ir/start";
const SEP_BASE = "https://sep.shaparak.ir/OnlinePG";
const SEP_ORIGIN = "https://sep.shaparak.ir";

const DEFAULT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "fa-IR,fa;q=0.9,en-US;q=0.8,en;q=0.7",
  Connection: "keep-alive",
};

/** @type {Map<string, { jar: CookieJar, trackId: string, createdAt: number, warmCaptcha?: string }>} */
const sessionStore = new Map();

const SESSION_TTL_MS = 20 * 60 * 1000;
const FETCH_RETRIES = 4;

function pruneSessions() {
  const now = Date.now();
  for (const [key, value] of sessionStore) {
    if (now - value.createdAt > SESSION_TTL_MS) sessionStore.delete(key);
  }
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
        proxy: getGatewayProxyLabel(),
      });
      if (attempt < FETCH_RETRIES && isRetryableNetworkError(err)) {
        await new Promise((r) => setTimeout(r, 500 * attempt * attempt));
        continue;
      }
      break;
    }
  }

  throw toGatewayPayError(lastErr);
}

async function fetchStartToken(trackId) {
  const url = `${START_BASE}/${trackId}`;
  const { response, body } = await fetchText(url);
  if (!response.ok) {
    throw new GatewayPayError(CODES.FAIL, `start HTTP ${response.status}`);
  }

  const tokenMatch = body.match(/name="token"\s+value="([a-f0-9]{32})"/i);
  if (!tokenMatch) {
    log.error("Payment token missing in start HTML", {
      trackId,
      preview: body.slice(0, 400),
    });
    throw new GatewayPayError(CODES.FAIL, "payment token missing");
  }

  return tokenMatch[1];
}

async function fetchSepPage(token, jar) {
  const url = `${SEP_BASE}/SendToken?token=${encodeURIComponent(token)}`;
  const { response, body } = await fetchText(url, {
    headers: {
      Cookie: jar.toHeader(),
      Referer: `${START_BASE}/`,
    },
  });

  jar.ingest(response);

  if (!response.ok) {
    throw new GatewayPayError(CODES.FAIL, `sep HTTP ${response.status}`);
  }

  return body;
}

function parseSepPage(html) {
  const $ = cheerio.load(html);

  const errorBlock = $(".response.danger h3").first().text().trim();
  if (errorBlock) {
    return { ok: false, error: sanitizePublicMessage(errorBlock) || MESSAGES_FAIL() };
  }

  const scriptText = $("script")
    .map((_, el) => $(el).html() || "")
    .get()
    .find((s) => s.includes("userSessionKey"));

  const sessionKeyMatch = scriptText?.match(/userSessionKey\s*=\s*"([^"]+)"/);
  const sessionKey = sessionKeyMatch?.[1] || $('input[name="SessionKey"]').first().val()?.toString();

  if (!sessionKey) {
    throw new GatewayPayError(CODES.FAIL, "session key missing");
  }

  const merchantName = $(".merchant-name h2").first().text().trim();
  const amount = $(".purchase-value .value h2").first().text().trim();
  const amountLetters = $(".purchase-value .letters small").first().text().replace(/\s+/g, " ").trim();

  const merchantInfo = [];
  $(".merchant-info .item").each((_, el) => {
    const label = $(el).find("span").first().text().replace(/\s+/g, " ").trim();
    const value = $(el).find("em").first().text().trim();
    if (/پرداخت\s*یار/.test(label)) return;
    if (label || value) merchantInfo.push({ label, value });
  });

  const merchantLogos = [];

  const timeout = $("[data-timeout]").first().attr("data-timeout") || "599000";
  const verificationToken = $('input[name="__RequestVerificationToken"]').first().val()?.toString() || "";
  const currentYear = $("#Year").attr("data-current-year") || "";

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

function MESSAGES_FAIL() {
  return "بارگذاری درگاه پرداخت ناموفق بود. لطفاً دوباره تلاش کنید.";
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
    throw new GatewayPayError(CODES.FAIL, "invalid captcha json");
  }

  if (!data.image) {
    throw new GatewayPayError(CODES.FAIL, "captcha image missing");
  }

  return `data:image/JPEG;base64,${data.image}`;
}

/**
 * Load payment-gateway session. Captcha is deferred to the browser (getCaptcha)
 * so first paint is ~1 RTT faster.
 */
async function loadGatewaySession(trackId) {
  const started = Date.now();
  pruneSessions();

  const proxyLabel = getGatewayProxyLabel();
  if (proxyLabel) {
    log.debug("Loading gateway session via proxy", { proxy: proxyLabel, trackId });
  } else {
    log.warn("Loading gateway session without GATEWAY_PROXY", { trackId });
  }

  try {
    const jar = new CookieJar();
    const token = await fetchStartToken(trackId);
    const sepHtml = await fetchSepPage(token, jar);
    const parsed = parseSepPage(sepHtml);

    if (!parsed.ok) {
      log.warn("Gateway page error", {
        trackId,
        durationMs: Date.now() - started,
        error: parsed.error,
      });
      return {
        ok: false,
        error: parsed.error || MESSAGES_FAIL(),
        code: CODES.FAIL,
        technical: parsed.error || "sep page error",
        trackId,
      };
    }

    sessionStore.set(parsed.sessionKey, {
      jar,
      trackId,
      zibalId: trackId, // backward-compat for older callers
      createdAt: Date.now(),
    });

    void fetchSepCaptcha(parsed.sessionKey, jar)
      .then((captchaSrc) => {
        const stored = sessionStore.get(parsed.sessionKey);
        if (stored) stored.warmCaptcha = captchaSrc;
      })
      .catch(() => {});

    log.info("Gateway session ready", {
      trackId,
      sessionKey: parsed.sessionKey,
      durationMs: Date.now() - started,
      proxy: proxyLabel,
    });

    return {
      ok: true,
      trackId,
      zibalId: trackId,
      payment: {
        ...parsed,
        captchaSrc: "",
        deferCaptcha: true,
        sepToken: token,
      },
    };
  } catch (err) {
    const mapped = toGatewayPayError(err);
    log.warn("Gateway session failed", {
      trackId,
      code: mapped.code,
      technical: mapped.technical,
      durationMs: Date.now() - started,
      proxy: proxyLabel,
    });
    throw mapped;
  }
}

async function refreshCaptcha(sessionKey) {
  const stored = sessionStore.get(sessionKey);
  if (!stored) {
    throw new GatewayPayError(CODES.FAIL, "session expired");
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
  GatewayPayError,
  CODES,
};
