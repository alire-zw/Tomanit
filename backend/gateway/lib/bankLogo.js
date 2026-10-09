"use strict";

const fs = require("fs");
const path = require("path");

let panBinsCache = null;

function loadPanBins() {
  if (panBinsCache) return panBinsCache;
  const filePath = path.join(__dirname, "..", "assets", "js", "panBinsList.js");
  const raw = fs.readFileSync(filePath, "utf8");
  const match = raw.match(/var\s+panBins\s*=\s*(\[[\s\S]*?\])\s*;/);
  if (!match) {
    panBinsCache = [];
    return panBinsCache;
  }
  try {
    // panBins uses single quotes — normalize for JSON
    panBinsCache = Function(`"use strict"; return (${match[1]});`)();
  } catch {
    panBinsCache = [];
  }
  return panBinsCache;
}

/** Same slug rules as getBankName() in app.js */
function bankSlugFromName(bankName) {
  if (!bankName) return "unknown";
  return String(bankName)
    .trim()
    .replace(/[^\w\s]/gi, "")
    .replace(/ /g, "-")
    .replace(/-{2,}/g, "-")
    .toLowerCase() || "unknown";
}

function resolveBankSlugFromPan(panDigits) {
  const bin = String(panDigits || "").replace(/\D/g, "").slice(0, 6);
  if (bin.length !== 6) return "unknown";
  const bins = loadPanBins();
  const hit = bins.find((b) => b && b.bin === bin);
  return bankSlugFromName(hit && hit.bankName);
}

/**
 * Absolute path served by pay shell static + SEP proxy.
 * Prefer /pay/assets/bundle (fast local) — same files as OnlinePG/bundle.
 */
function bankLogoUrl(slug) {
  const safe = String(slug || "unknown").replace(/[^a-z0-9-]/gi, "") || "unknown";
  const filePath = path.join(__dirname, "..", "assets", "bundle", "icn", "banks", `${safe}.svg`);
  if (fs.existsSync(filePath)) {
    return `/pay/assets/bundle/icn/banks/${safe}.svg`;
  }
  // Fallbacks used by SEP naming
  const alts = [`${safe}-bank`, "unknown", "unknown-bank"];
  for (const alt of alts) {
    const p = path.join(__dirname, "..", "assets", "bundle", "icn", "banks", `${alt}.svg`);
    if (fs.existsSync(p)) return `/pay/assets/bundle/icn/banks/${alt}.svg`;
  }
  return `/pay/assets/bundle/icn/banks/unknown.svg`;
}

module.exports = {
  resolveBankSlugFromPan,
  bankLogoUrl,
  bankSlugFromName,
};
