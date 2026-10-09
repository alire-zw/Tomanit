"use strict";

const path = require("path");
const express = require("express");
const { BUNDLE_ALIASES } = require("./rewriteSepHtml");
const { serveBankIcon } = require("./bundleAssets");

const GATEWAY_ROOT = path.join(__dirname, "..");

/** Express routes for SEP-style /OnlinePG/* asset paths used in result pages */
function mountSepAssetAliases(app) {
  for (const [sepPath, localPath] of BUNDLE_ALIASES) {
    const filePath = path.join(GATEWAY_ROOT, localPath.replace(/^\//, ""));
    app.get(sepPath, (_req, res) => {
      res.sendFile(filePath);
    });
  }

  // Bank icons under /OnlinePG/bundle/icn/banks/
  app.get("/OnlinePG/bundle/icn/banks/:file", serveBankIcon);

  // Other bundle static files (favicons etc.)
  app.use("/OnlinePG/bundle", express.static(path.join(GATEWAY_ROOT, "assets/bundle")));
}

module.exports = { mountSepAssetAliases };
