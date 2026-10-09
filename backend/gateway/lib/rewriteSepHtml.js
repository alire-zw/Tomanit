"use strict";

const { createLogger } = require("./logger");

const log = createLogger("rewriteSepHtml");

const PAY_PREFIX = "/pay";

/** Map SEP bundle paths to local Tomanit assets under /pay */
const BUNDLE_ALIASES = [
  ["/OnlinePG/bundle/js/libs/jquery/validate", `${PAY_PREFIX}/assets/js/validate.js`],
  ["/OnlinePG/bundle/js/libs/jquery", `${PAY_PREFIX}/assets/js/jquery.js`],
  ["/OnlinePG/bundle/js/libs/helpers", `${PAY_PREFIX}/assets/js/helpers.js`],
  ["/OnlinePG/bundle/js/app", `${PAY_PREFIX}/assets/js/app.js`],
  ["/OnlinePG/bundle/css/app", `${PAY_PREFIX}/assets/css/app.css`],
  ["/OnlinePG/baseData/panBinsList", `${PAY_PREFIX}/assets/js/panBinsList.js`],
];

/**
 * Rewrite SEP result/error HTML so asset URLs work on the integrated /pay shell.
 */
function rewriteSepResultHtml(html) {
  let out = html;

  // Favicons are not mirrored under /pay — keep them on SEP origin to avoid 404 WARN noise.
  out = out.replace(
    /(href|src)="(\/OnlinePG\/bundle\/fav\/[^"]+)"/gi,
    '$1="https://sep.shaparak.ir$2"',
  );
  out = out.replace(
    /(href|src)='(\/OnlinePG\/bundle\/fav\/[^']+)'/gi,
    "$1='https://sep.shaparak.ir$2'",
  );

  for (const [from, to] of BUNDLE_ALIASES) {
    const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out.replace(new RegExp(`(href|src)="${escaped}(\\?[^"]*)?"`, "gi"), `$1="${to}"`);
    out = out.replace(new RegExp(`(href|src)='${escaped}(\\?[^']*)?'`, "gi"), `$1='${to}'`);
  }

  out = out.replace(/(href|src)="\/OnlinePG\/bundle\//gi, `$1="${PAY_PREFIX}/api/sep/OnlinePG/bundle/`);
  out = out.replace(/(href|src)='\/OnlinePG\/bundle\//gi, `$1='${PAY_PREFIX}/api/sep/OnlinePG/bundle/`);

  out = out.replace(/(href|src|action)="\/OnlinePG\//gi, `$1="${PAY_PREFIX}/api/sep/OnlinePG/`);
  out = out.replace(/(href|src|action)='\/OnlinePG\//gi, `$1='${PAY_PREFIX}/api/sep/OnlinePG/`);

  // Local gateway asset paths if SEP HTML already pointed at /assets
  out = out.replace(/(href|src)="\/assets\//gi, `$1="${PAY_PREFIX}/assets/`);
  out = out.replace(/(href|src)='\/assets\//gi, `$1='${PAY_PREFIX}/assets/`);

  if (out.includes("نتیجه تراکنش") || out.includes("response success") || out.includes("response danger")) {
    const themeLink = `<link href="${PAY_PREFIX}/assets/css/tomanit.css?v=14" rel="stylesheet">`;
    if (!out.includes("tomanit.css")) {
      out = out.replace("</head>", `  ${themeLink}\n</head>`);
    }
  }

  log.debug("SEP HTML rewritten for /pay shell", {
    originalLength: html.length,
    rewrittenLength: out.length,
  });
  return out;
}

module.exports = { rewriteSepResultHtml, BUNDLE_ALIASES, PAY_PREFIX };
