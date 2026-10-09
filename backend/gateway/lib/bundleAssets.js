"use strict";

const fs = require("fs");
const path = require("path");
const { createLogger } = require("./logger");

const log = createLogger("bundle");
const BANKS_DIR = path.join(__dirname, "..", "assets", "bundle", "icn", "banks");

/** Minimal valid fallback SVG for unknown/corrupt bank icons */
const FALLBACK_SVG = `<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="4" fill="#e8ecef"/><text x="12" y="16" text-anchor="middle" font-size="10" fill="#00656a">?</text></svg>`;

function isValidSvgFile(filePath) {
  try {
    const head = fs.readFileSync(filePath, "utf8").slice(0, 80);
    return head.trimStart().startsWith("<svg");
  } catch {
    return false;
  }
}

function serveBankIcon(req, res) {
  const fileName = path.basename(req.params.file);
  const filePath = path.join(BANKS_DIR, fileName);

  if (!filePath.startsWith(BANKS_DIR) || !fs.existsSync(filePath)) {
    log.warn("Bank icon not found, using fallback", { requested: fileName });
    res.setHeader("Content-Type", "image/svg+xml");
    res.setHeader("Cache-Control", "public, max-age=3600");
    return res.status(404).send(FALLBACK_SVG);
  }

  if (!isValidSvgFile(filePath)) {
    log.error("Bank icon corrupt (WAF HTML saved as SVG), using fallback", { file: fileName });
    res.setHeader("Content-Type", "image/svg+xml");
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(FALLBACK_SVG);
  }

  log.debug("Bank icon served", { file: fileName });
  res.setHeader("Content-Type", "image/svg+xml");
  res.setHeader("Cache-Control", "public, max-age=86400");
  return res.sendFile(filePath);
}

function auditBankIconsOnStartup() {
  if (!fs.existsSync(BANKS_DIR)) return;
  const files = fs.readdirSync(BANKS_DIR).filter((f) => f.endsWith(".svg"));
  const corrupt = [];
  const valid = [];
  for (const file of files) {
    if (isValidSvgFile(path.join(BANKS_DIR, file))) valid.push(file);
    else corrupt.push(file);
  }
  log.info("Bank icons audit", { total: files.length, valid: valid.length, corrupt: corrupt.length });
  if (corrupt.length) log.warn("Corrupt bank SVG files (WAF HTML) — fallback icon will be used", { files: corrupt.slice(0, 15), more: corrupt.length > 15 ? corrupt.length - 15 : 0 });
}

module.exports = { serveBankIcon, isValidSvgFile, FALLBACK_SVG, auditBankIconsOnStartup };
