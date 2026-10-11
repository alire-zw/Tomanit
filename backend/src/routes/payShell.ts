import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fastifyStatic from "@fastify/static";
import formbody from "@fastify/formbody";
import { prisma } from "../db/prisma.js";
import { log } from "../lib/log.js";
import { payProxyLimiter } from "../lib/rateLimit.js";
import { clientIp } from "../lib/httpRateLimit.js";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GATEWAY_ROOT = path.resolve(__dirname, "../../gateway");

const { gatewayFetch } = require(path.join(GATEWAY_ROOT, "lib/gatewayDispatcher.js")) as {
  gatewayFetch: (url: string, options?: Record<string, unknown>) => Promise<Response>;
};

const {
  loadGatewaySession,
  refreshCaptcha,
  getStoredSession,
} = require(path.join(GATEWAY_ROOT, "lib/gatewayService.js")) as {
  loadGatewaySession: (zibalId: string) => Promise<{
    ok: boolean;
    error?: string;
    payment?: Record<string, unknown>;
    zibalId?: string;
  }>;
  refreshCaptcha: (sessionKey: string) => Promise<string>;
  getStoredSession: (sessionKey: string) => { jar: { toHeader: () => string; ingest: (r: Response) => void } } | undefined;
};

const { renderGatewayPage, renderErrorPage } = require(
  path.join(GATEWAY_ROOT, "lib/renderPage.js"),
) as {
  renderGatewayPage: (payment: unknown, zibalId: string) => string;
  renderErrorPage: (message: string, zibalId?: string) => string;
};

const { rewriteSepResultHtml } = require(
  path.join(GATEWAY_ROOT, "lib/rewriteSepHtml.js"),
) as {
  rewriteSepResultHtml: (html: string) => string;
};

const { isValidSvgFile, FALLBACK_SVG } = require(
  path.join(GATEWAY_ROOT, "lib/bundleAssets.js"),
) as {
  isValidSvgFile: (filePath: string) => boolean;
  FALLBACK_SVG: string;
};

const SEP_BASE_URL = "https://sep.shaparak.ir";
const BANKS_DIR = path.join(GATEWAY_ROOT, "assets/bundle/icn/banks");

function htmlReply(reply: FastifyReply, status: number, html: string) {
  return reply
    .status(status)
    .header("Content-Type", "text/html; charset=utf-8")
    .header("Cache-Control", "no-store")
    .send(html);
}

function bodyToUrlEncoded(body: unknown): string {
  if (!body || typeof body !== "object") return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, String(item));
    } else {
      params.append(key, String(value));
    }
  }
  return params.toString();
}

async function lockedPanForTrack(trackId: string): Promise<string | null> {
  if (!trackId) return null;
  const charge = await prisma.gatewayCharge.findFirst({
    where: { trackId },
    include: { bankCard: { select: { cardNumber: true } } },
  });
  const digits = String(charge?.bankCard?.cardNumber || "").replace(/\D/g, "");
  return digits.length === 16 ? digits : null;
}

export async function payShellRoutes(app: FastifyInstance) {
  await app.register(formbody);

  await app.register(fastifyStatic, {
    root: path.join(GATEWAY_ROOT, "assets"),
    prefix: "/pay/assets/",
    decorateReply: false,
  });

  await app.register(fastifyStatic, {
    root: path.join(GATEWAY_ROOT, "assets/bundle"),
    prefix: "/pay/api/sep/OnlinePG/bundle/",
    decorateReply: false,
  });

  app.get("/pay/health", async () => ({ ok: true, service: "tomanit-pay-shell" }));

  /**
   * Manual invoice links: /pay/100001482391
   * Nginx/Vite send all /pay/* here (SEP shell), so hand off to the Mini App SPA at /p/:token.
   */
  app.get("/pay/:token", async (request, reply) => {
    const token = String((request.params as { token?: string }).token || "").trim();
    const reserved = new Set(["start", "health", "assets", "api", "result"]);
    if (token === "result") {
      const qIndex = request.url.indexOf("?");
      const search = qIndex >= 0 ? request.url.slice(qIndex) : "";
      return reply.redirect(`/p/result${search}`, 302);
    }
    if (!token || reserved.has(token) || !/^\d{6,24}$/.test(token)) {
      return reply.status(404).send({ error: "Not found" });
    }
    const link = await prisma.merchantPaymentLink.findUnique({
      where: { code: token },
      select: { id: true },
    });
    if (!link) {
      return reply.status(404).send({ error: "فاکتور یافت نشد" });
    }
    return reply.redirect(`/p/${encodeURIComponent(token)}`, 302);
  });

  app.get("/pay/start/:trackId", async (request, reply) => {
    const trackId = String((request.params as { trackId: string }).trackId || "");
    try {
      const [result, lockedPan] = await Promise.all([
        loadGatewaySession(trackId),
        lockedPanForTrack(trackId),
      ]);
      if (!result.ok || !result.payment) {
        return htmlReply(reply, 502, renderErrorPage(result.error || "Gateway error", trackId));
      }
      const payment = {
        ...result.payment,
        lockedPan: lockedPan || result.payment.lockedPan || null,
      };
      return htmlReply(reply, 200, renderGatewayPage(payment, trackId));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Internal error";
      const cause =
        err instanceof Error && err.cause instanceof Error
          ? err.cause.message
          : err instanceof Error && err.cause && typeof err.cause === "object"
            ? String((err.cause as { code?: string }).code || err.cause)
            : null;
      log.error("pay-start", cause ? `${message} · ${cause}` : err);
      return htmlReply(reply, 500, renderErrorPage(message, trackId));
    }
  });

  // Safety net: cancel/timeout forms used to POST to /pay/start/:id with action="#".
  app.post("/pay/start/:trackId", async (request, reply) => {
    const body = (request.body || {}) as Record<string, unknown>;
    const action = String(body.Action || body.action || "").toLowerCase();
    if (action === "cancel" || action === "failedotp" || action === "changeculture" || action === "purchase") {
      // Forward to SEP OnlinePG through the same proxy pipeline.
      (request as { raw: { url?: string } }).raw.url = "/pay/api/sep/OnlinePG/OnlinePG";
      return proxySep(request, reply);
    }
    return htmlReply(
      reply,
      400,
      renderErrorPage("درخواست پرداخت نامعتبر است. لطفاً دوباره تلاش کنید."),
    );
  });

  app.post("/pay/api/captcha/refresh", async (request, reply) => {
    const sessionKey = String((request.body as { sessionKey?: string })?.sessionKey || "");
    if (!sessionKey) {
      return reply.status(400).send({ ok: false, error: "sessionKey is required" });
    }
    try {
      const captchaSrc = await refreshCaptcha(sessionKey);
      return {
        ok: true,
        image: captchaSrc.replace(/^data:image\/[^;]+;base64,/, ""),
        captchaSrc,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Captcha error";
      return reply.status(502).send({ ok: false, error: message });
    }
  });

  app.get("/pay/api/sep/OnlinePG/bundle/icn/banks/:file", async (request, reply) => {
    const fileName = path.basename(String((request.params as { file: string }).file || ""));
    const filePath = path.join(BANKS_DIR, fileName);
    if (!filePath.startsWith(BANKS_DIR) || !fileName) {
      return reply
        .status(404)
        .header("Content-Type", "image/svg+xml")
        .send(FALLBACK_SVG);
    }
    try {
      const fs = await import("node:fs/promises");
      await fs.access(filePath);
      if (!isValidSvgFile(filePath)) {
        return reply
          .header("Content-Type", "image/svg+xml")
          .header("Cache-Control", "no-store")
          .send(FALLBACK_SVG);
      }
      const buf = await fs.readFile(filePath);
      return reply
        .header("Content-Type", "image/svg+xml")
        .header("Cache-Control", "public, max-age=86400")
        .send(buf);
    } catch {
      return reply
        .status(404)
        .header("Content-Type", "image/svg+xml")
        .send(FALLBACK_SVG);
    }
  });

  app.all("/pay/api/sep/*", async (request, reply) => {
    return proxySep(request, reply);
  });

  // Also match exact /pay/api/sep (no trailing path)
  app.all("/pay/api/sep", async (request, reply) => {
    return proxySep(request, reply);
  });
}

async function proxySep(request: FastifyRequest, reply: FastifyReply) {
  const rl = payProxyLimiter.hit(clientIp(request));
  if (!rl.allowed) {
    void reply.header("Retry-After", String(rl.retryAfterSec));
    return reply.status(429).send({ error: "Too many requests" });
  }

  const originalUrl = request.raw.url || request.url;
  // Prevent path traversal / open proxy abuse — only OnlinePG paths on SEP.
  const sepPathRaw = originalUrl.replace(/^\/pay\/api\/sep/, "") || "/";
  const sepPath = sepPathRaw.split("?")[0] || "/";
  if (
    sepPath.includes("..") ||
    (!sepPath.startsWith("/OnlinePG") &&
      sepPath !== "/" &&
      !sepPath.startsWith("/onlinepg"))
  ) {
    return reply.status(403).send({ error: "Forbidden path" });
  }
  const qs = sepPathRaw.includes("?")
    ? sepPathRaw.slice(sepPathRaw.indexOf("?"))
    : "";
  const sepUrl = `${SEP_BASE_URL}${sepPath}${qs}`;

  const bodyObj = (request.body || {}) as Record<string, unknown>;
  const sessionKey = String(
    bodyObj.SessionKey ??
      bodyObj.sessionKey ??
      (request.query as Record<string, string>)?.SessionKey ??
      (request.query as Record<string, string>)?.sessionKey ??
      "",
  ).trim();

  // Mutations require a known in-memory payment session (anti open-relay).
  const method = request.method.toUpperCase();
  if ((method === "POST" || method === "PUT" || method === "PATCH") && !sessionKey) {
    return reply.status(401).send({ error: "SessionKey required" });
  }
  if (sessionKey) {
    const stored = getStoredSession(sessionKey);
    if (!stored && (method === "POST" || method === "PUT" || method === "PATCH")) {
      return reply.status(401).send({ error: "Invalid or expired session" });
    }
  }

  let cookieHeader = "";
  if (sessionKey) {
    const stored = getStoredSession(sessionKey);
    if (stored) cookieHeader = stored.jar.toHeader();
  }

  const bodyText =
    method === "POST" || method === "PUT" || method === "PATCH"
      ? bodyToUrlEncoded(request.body)
      : "";

  try {
    const upstream = await gatewayFetch(sepUrl, {
      method,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36",
        Accept: String(request.headers.accept || "*/*"),
        "Accept-Language": "fa-IR,fa;q=0.9,en;q=0.8",
        Origin: "https://sep.shaparak.ir",
        Referer: "https://sep.shaparak.ir/OnlinePG/",
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
        ...(bodyText
          ? { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" }
          : {}),
      },
      ...(bodyText ? { body: bodyText } : {}),
      redirect: "follow",
    });

    if (sessionKey) {
      const stored = getStoredSession(sessionKey);
      if (stored) stored.jar.ingest(upstream);
    }

    const contentType = upstream.headers.get("content-type") ?? "text/html";

    if (contentType.includes("image") || contentType.includes("svg")) {
      const buf = Buffer.from(await upstream.arrayBuffer());
      return reply
        .status(upstream.status)
        .header("Content-Type", contentType)
        .header("Cache-Control", "public, max-age=86400")
        .send(buf);
    }

    if (contentType.includes("json") || contentType.includes("javascript")) {
      const text = await upstream.text();
      return reply
        .status(upstream.status)
        .header("Content-Type", contentType)
        .send(text);
    }

    const rawHtml = await upstream.text();
    const html = rewriteSepResultHtml(rawHtml);
    return htmlReply(reply, upstream.status, html);
  } catch (err) {
    const message = err instanceof Error ? err.message : "SEP proxy error";
    log.error("pay-sep-proxy", err);
    return htmlReply(reply, 502, renderErrorPage(`SEP proxy error: ${message}`));
  }
}
