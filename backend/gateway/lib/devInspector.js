"use strict";

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");
const { createLogger } = require("./logger");

const log = createLogger("dev", process.env.LOG_LEVEL || "debug");
const IS_DEV = process.env.NODE_ENV === "development" || process.env.LOG_LEVEL === "debug";
const GATEWAY_ROOT = path.join(__dirname, "..");

const RESOURCE_TYPES = {
  css: "CSS",
  js: "JS",
  img: "IMG",
  font: "FONT",
  api: "API",
  sep: "SEP",
  html: "HTML",
  other: "OTHER",
};

function classifyPath(urlPath) {
  const p = urlPath.split("?")[0].toLowerCase();
  if (p.startsWith("/api/sep")) return "sep";
  if (p.startsWith("/api/")) return "api";
  if (/\.(css)(\?|$)/.test(p)) return "css";
  if (/\.(js)(\?|$)/.test(p)) return "js";
  if (/\.(woff2?|ttf|eot)(\?|$)/.test(p)) return "font";
  if (/\.(png|jpe?g|gif|svg|webp|ico)(\?|$)/.test(p)) return "img";
  if (p.startsWith("/start/") || p === "/") return "html";
  return "other";
}

function stripQuery(urlPath) {
  return urlPath.split("?")[0];
}

function localAssetExists(urlPath) {
  const clean = stripQuery(urlPath);
  if (clean.startsWith("/assets/")) {
    return fs.existsSync(path.join(GATEWAY_ROOT, clean.replace(/^\//, "")));
  }
  if (clean.startsWith("/api/sep/OnlinePG/bundle/")) {
    const rel = clean.replace("/api/sep/OnlinePG/bundle/", "");
    return fs.existsSync(path.join(GATEWAY_ROOT, "assets/bundle", rel));
  }
  return null;
}

function auditHtmlPage(html, pageUrl) {
  const $ = cheerio.load(html);
  const scripts = [];
  const styles = [];
  const images = [];
  const externals = [];

  $("script[src]").each((_, el) => {
    const src = $(el).attr("src");
    if (src) scripts.push(src);
  });
  $('link[rel="stylesheet"], link[href*=".css"]').each((_, el) => {
    const href = $(el).attr("href");
    if (href) styles.push(href);
  });
  $("img[src]").each((_, el) => {
    const src = $(el).attr("src");
    if (src && !src.startsWith("data:")) images.push(src.slice(0, 120));
  });

  const allLocal = [...scripts, ...styles, ...images];
  for (const ref of allLocal) {
    if (ref.startsWith("http://") || ref.startsWith("https://")) {
      externals.push(ref.slice(0, 100));
    }
  }

  const scriptVars = {};
  $("script").each((_, el) => {
    const text = $(el).html() || "";
    if (!text.includes("userSessionKey")) return;
    for (const key of ["serverUrl", "actionUrl", "hostAddress", "userSessionKey", "removeEmailUrl"]) {
      const m = text.match(new RegExp(`${key}\\s*=\\s*"([^"]+)"`));
      if (m) scriptVars[key] = m[1];
    }
    const baseM = text.match(/baseUrl:\s*"([^"]*)"/);
    if (baseM) scriptVars.baseUrl = baseM[1];
  });

  const missing = [];
  for (const ref of [...scripts, ...styles]) {
    if (!ref.startsWith("/")) continue;
    const exists = localAssetExists(ref);
    if (exists === false) missing.push(ref);
  }

  log.info("─── PAGE AUDIT ───", { page: pageUrl });
  log.info("Script vars injected", scriptVars);
  log.info("Stylesheets", { count: styles.length, files: styles });
  log.info("Scripts", { count: scripts.length, files: scripts });
  log.info("Images", { count: images.length, files: images.slice(0, 8) });
  if (externals.length) log.warn("External resources (loaded from outside gateway)", { urls: externals });
  if (missing.length) log.error("MISSING local assets referenced in HTML", { files: missing });

  return { scriptVars, scripts, styles, images, externals, missing };
}

function analyzeSepHtml(html) {
  const $ = cheerio.load(html);
  const title = $("title").text().trim();
  const h1 = $("h1").first().text().trim();
  const h2 = $("h2").first().text().trim();
  const h3 = $("h3").first().text().trim();
  const danger = $(".response.danger h3, .response.danger h2").first().text().trim();
  const unauthorized = html.includes("شما مجاز به انجام این عملیات نیستید");
  const success = html.includes("تراکنش موفق") || html.includes("success") || $(".response.success").length > 0;

  return { title, h1, h2, h3, danger, unauthorized, success };
}

function analyzeSepJson(text) {
  try {
    const data = JSON.parse(text);
    const preview = JSON.stringify(data).slice(0, 300);
    const keys = typeof data === "object" && data ? Object.keys(data) : [];
    return { ok: true, keys, preview, itemCount: Array.isArray(data) ? data.length : undefined };
  } catch {
    return { ok: false, preview: text.slice(0, 200) };
  }
}

function redactBody(bodyObj) {
  if (!bodyObj || typeof bodyObj !== "object") return bodyObj;
  const safe = { ...bodyObj };
  for (const key of Object.keys(safe)) {
    const lk = key.toLowerCase();
    if (lk.includes("pin") || lk.includes("cvv") || lk.includes("captcha") || lk.includes("pan") || lk.includes("token")) {
      safe[key] = safe[key] ? `[REDACTED len=${String(safe[key]).length}]` : safe[key];
    }
  }
  return safe;
}

function createDevMiddleware() {
  if (!IS_DEV) {
    return (_req, _res, next) => next();
  }

  return (req, res, next) => {
    const started = Date.now();
    const type = classifyPath(req.originalUrl);
    const typeLabel = RESOURCE_TYPES[type] || type.toUpperCase();

    log.debug(`→ ${req.method} ${req.originalUrl}`, {
      type: typeLabel,
      ip: req.ip,
      referer: req.get("referer") || null,
      contentType: req.get("content-type") || null,
    });

    if (req.method === "POST" && req.body && Object.keys(req.body).length) {
      log.debug("POST body (redacted)", redactBody(req.body));
    }

    const assetCheck = localAssetExists(req.originalUrl);
    if (assetCheck === false) {
      log.error("STATIC FILE NOT FOUND on disk", { path: req.originalUrl });
    }

    res.on("finish", () => {
      const ms = Date.now() - started;
      const status = res.statusCode;
      const level = status >= 500 ? "error" : status >= 400 ? "warn" : "info";
      const icon = status >= 400 ? "✗" : status >= 300 ? "↪" : "✓";

      log[level](`${icon} ${req.method} ${req.originalUrl}`, {
        type: typeLabel,
        status,
        durationMs: ms,
        contentType: res.getHeader("content-type") || null,
        size: res.getHeader("content-length") || null,
      });
    });

    next();
  };
}

module.exports = {
  IS_DEV,
  auditHtmlPage,
  analyzeSepHtml,
  analyzeSepJson,
  createDevMiddleware,
  classifyPath,
  localAssetExists,
};
