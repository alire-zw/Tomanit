"use strict";

/**
 * Outbound HTTP dispatcher for Zibal / SEP.
 *
 * GATEWAY_PROXY examples:
 *   http://user:pass@HOST:PORT
 *   socks5://user:pass@HOST:PORT
 *   socks4://HOST:PORT
 *
 * HTTPS to the bank stays end-to-end encrypted (TLS). The proxy only sees
 * that you connect to shaparak/zibal — not card fields inside HTTPS.
 * Prefer a private Iran VPS; free public proxies die often.
 */

const http = require("node:http");
const https = require("node:https");
const { Agent, ProxyAgent, fetch: undiciFetch } = require("undici");
const { SocksProxyAgent } = require("socks-proxy-agent");
const { createLogger } = require("./logger");

const log = createLogger("gatewayProxy");

let cachedMode = null; // "direct" | "http" | "socks"
let cachedDispatcher = null;
let cachedSocksAgent = null;
let cachedProxyLabel = null;

function normalizeProxyUrl(raw) {
  const value = String(raw || "").trim();
  if (!value) return null;
  if (/^socks[45]h?:\/\//i.test(value)) return value.replace(/\/+$/, "");
  if (/^https?:\/\//i.test(value)) return value.replace(/\/+$/, "");
  return `http://${value}`;
}

function redactProxy(url) {
  return url.replace(/:([^:@/]+)@/, ":****@");
}

function resolveGatewayProxy() {
  return normalizeProxyUrl(process.env.GATEWAY_PROXY || "");
}

function ensureDispatcher() {
  if (cachedMode) return;

  const proxy = resolveGatewayProxy();
  if (!proxy) {
    cachedMode = "direct";
    cachedProxyLabel = null;
    cachedDispatcher = new Agent({
      keepAliveTimeout: 30_000,
      keepAliveMaxTimeout: 60_000,
      connections: 16,
      pipelining: 1,
      connect: {
        family: 4,
        timeout: 8_000,
      },
    });
    return;
  }

  cachedProxyLabel = redactProxy(proxy);
  if (/^socks/i.test(proxy)) {
    cachedMode = "socks";
    cachedSocksAgent = new SocksProxyAgent(proxy);
    log.info("GATEWAY_PROXY enabled (socks)", { proxy: cachedProxyLabel });
    return;
  }

  cachedMode = "http";
  cachedDispatcher = new ProxyAgent(proxy);
  log.info("GATEWAY_PROXY enabled (http)", { proxy: cachedProxyLabel });
}

function getGatewayDispatcher() {
  ensureDispatcher();
  return cachedDispatcher;
}

function getGatewayProxyLabel() {
  ensureDispatcher();
  return cachedProxyLabel;
}

/**
 * Fetch through GATEWAY_PROXY (HTTP or SOCKS) or direct.
 * Returns an undici-like Response ({ ok, status, headers, text, arrayBuffer }).
 */
async function gatewayFetch(url, options = {}) {
  ensureDispatcher();
  const method = options.method || "GET";
  const headers = options.headers || {};
  const body = options.body;

  if (cachedMode !== "socks") {
    return undiciFetch(url, {
      ...options,
      method,
      headers,
      body,
      dispatcher: cachedDispatcher,
      redirect: options.redirect || "follow",
    });
  }

  return fetchViaSocks(url, { method, headers, body, redirect: options.redirect });
}

function fetchViaSocks(url, { method, headers, body, redirect }) {
  const maxRedirects = redirect === "manual" ? 0 : 5;

  function once(targetUrl, hop) {
    return new Promise((resolve, reject) => {
      const parsed = new URL(targetUrl);
      const lib = parsed.protocol === "http:" ? http : https;
      const req = lib.request(
        targetUrl,
        {
          method,
          headers,
          agent: cachedSocksAgent,
          timeout: 20_000,
        },
        (res) => {
          const chunks = [];
          res.on("data", (c) => chunks.push(c));
          res.on("end", () => {
            const buf = Buffer.concat(chunks);
            const status = res.statusCode || 0;
            const location = res.headers.location;
            if (
              hop < maxRedirects &&
              location &&
              status >= 301 &&
              status <= 308 &&
              method === "GET"
            ) {
              const next = new URL(location, targetUrl).toString();
              once(next, hop + 1).then(resolve, reject);
              return;
            }

            const headerMap = new Map();
            for (const [key, value] of Object.entries(res.headers)) {
              if (value == null) continue;
              headerMap.set(String(key).toLowerCase(), Array.isArray(value) ? value.join(", ") : String(value));
            }

            resolve({
              ok: status >= 200 && status < 300,
              status,
              headers: {
                get(name) {
                  return headerMap.get(String(name).toLowerCase()) ?? null;
                },
                raw() {
                  return res.headers;
                },
              },
              async text() {
                return buf.toString("utf8");
              },
              async arrayBuffer() {
                return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
              },
            });
          });
        },
      );
      req.on("timeout", () => {
        req.destroy(Object.assign(new Error("timeout"), { code: "ETIMEDOUT" }));
      });
      req.on("error", reject);
      if (body != null && body !== "") req.write(body);
      req.end();
    });
  }

  return once(url, 0);
}

module.exports = {
  getGatewayDispatcher,
  getGatewayProxyLabel,
  resolveGatewayProxy,
  gatewayFetch,
};
