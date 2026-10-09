"use strict";

const { auditHtmlPage } = require("./devInspector");
const { createLogger } = require("./logger");

const log = createLogger("pageAudit");

function logRenderedPage(html, zibalId, payment) {
  auditHtmlPage(html, `/start/${zibalId}`);
  log.info("Payment session details", {
    zibalId,
    sessionKey: payment.sessionKey,
    merchantName: payment.merchantName,
    amount: payment.amount,
    timeout: payment.timeout,
    verificationToken: payment.verificationToken ? `${payment.verificationToken.slice(0, 16)}…` : "missing",
    merchantLogos: payment.merchantLogos?.map((l) => l.src) ?? [],
    merchantInfo: payment.merchantInfo,
  });
}

module.exports = { logRenderedPage };
