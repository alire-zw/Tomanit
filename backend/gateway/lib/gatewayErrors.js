"use strict";

/**
 * User-facing payment-gateway errors (no provider brand names).
 *
 * PG01 — timeout / cannot connect
 * PG02 — connection dropped mid-flight
 * PG03 — load/parse/HTTP failure
 */

const CODES = {
  TIMEOUT: "PG01",
  DROPPED: "PG02",
  FAIL: "PG03",
};

const MESSAGES = {
  PG01: "اتصال به درگاه پرداخت برقرار نشد. لطفاً چند لحظه بعد دوباره تلاش کنید.",
  PG02: "ارتباط با درگاه پرداخت قطع شد. لطفاً دوباره تلاش کنید.",
  PG03: "بارگذاری درگاه پرداخت ناموفق بود. لطفاً دوباره تلاش کنید.",
};

class GatewayPayError extends Error {
  /**
   * @param {string} code  PG01 | PG02 | PG03
   * @param {string} [technical]
   */
  constructor(code, technical = "") {
    const publicCode = MESSAGES[code] ? code : CODES.FAIL;
    super(MESSAGES[publicCode]);
    this.name = "GatewayPayError";
    this.code = publicCode;
    this.technical = String(technical || "").slice(0, 500);
  }
}

function networkCause(err) {
  if (!err) return "";
  const cause = err && typeof err === "object" ? err.cause : null;
  if (cause && typeof cause === "object") {
    return String(cause.code || cause.message || cause);
  }
  if (err instanceof Error) {
    return err.code ? String(err.code) : err.message;
  }
  return String(err);
}

function classifyNetworkCode(err) {
  const raw = networkCause(err);
  if (/CONNECT_TIMEOUT|ETIMEDOUT|timeout|Timeout/i.test(raw)) return CODES.TIMEOUT;
  if (/ECONNRESET|UND_ERR_SOCKET|socket hang up|socket closed|EPIPE|ECONNABORTED/i.test(raw)) {
    return CODES.DROPPED;
  }
  if (/ECONNREFUSED|EAI_AGAIN|ENOTFOUND|fetch failed|UND_ERR/i.test(raw)) return CODES.TIMEOUT;
  return CODES.FAIL;
}

function isRetryableNetworkError(err) {
  const code = classifyNetworkCode(err);
  return code === CODES.TIMEOUT || code === CODES.DROPPED;
}

/**
 * Map any thrown value to a safe public GatewayPayError.
 * @param {unknown} err
 */
function toGatewayPayError(err) {
  if (err instanceof GatewayPayError) return err;
  const technical = networkCause(err) || (err instanceof Error ? err.message : String(err));
  return new GatewayPayError(classifyNetworkCode(err), technical);
}

/** Strip provider brand names from any accidental public string. */
function sanitizePublicMessage(message) {
  return String(message || "")
    .replace(/زیبال|zibal/gi, "درگاه پرداخت")
    .replace(/شاپرک|shaparak/gi, "درگاه پرداخت")
    .replace(/\bSEP\b/g, "درگاه پرداخت")
    .replace(/\s{2,}/g, " ")
    .trim();
}

module.exports = {
  CODES,
  MESSAGES,
  GatewayPayError,
  networkCause,
  classifyNetworkCode,
  isRetryableNetworkError,
  toGatewayPayError,
  sanitizePublicMessage,
};
