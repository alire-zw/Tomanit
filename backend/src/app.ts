import Fastify from "fastify";
import cors from "@fastify/cors";
import { ZodError } from "zod";
import { env } from "./config/env.js";
import { log } from "./lib/log.js";
import { healthRoutes } from "./routes/health.js";
import { authRoutes } from "./routes/auth.js";
import { meRoutes } from "./routes/me.js";
import { walletRoutes } from "./routes/wallet.js";
import { supportRoutes } from "./routes/support.js";
import { adminRoutes } from "./routes/admin.js";
import { channelLockRoutes } from "./routes/channelLock.js";
import { kycRoutes } from "./routes/kyc.js";
import { cardRoutes } from "./routes/cards.js";
import { paymentGatewayRoutes } from "./routes/paymentGateways.js";
import { shopRoutes } from "./routes/shop.js";
import { merchantApiRoutes } from "./routes/merchantApi.js";
import { payShellRoutes } from "./routes/payShell.js";
import { telegramWebhookRoutes } from "./routes/telegramWebhook.js";

function isAllowedCorsOrigin(origin: string): boolean {
  let host: string;
  let originUrl: URL;
  try {
    originUrl = new URL(origin);
    host = originUrl.hostname;
  } catch {
    return false;
  }

  // Always allow the configured Mini App origin (exact match).
  try {
    const mini = new URL(env.MINI_APP_URL);
    if (originUrl.origin === mini.origin) return true;
  } catch {
    // ignore
  }

  if (env.NODE_ENV === "production") {
    // Production: Mini App origin only (+ same host over https variants already covered).
    return false;
  }

  // Development: localhost + LAN for Telegram WebView on device Wi‑Fi
  if (host === "localhost" || host === "127.0.0.1") return true;
  if (
    /^192\.168\.\d{1,3}\.\d{1,3}$/.test(host) ||
    /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host) ||
    /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(host)
  ) {
    return true;
  }
  if (host === "mirall.ir" || host.endsWith(".mirall.ir")) return true;
  return false;
}

export async function buildApp() {
  const app = Fastify({
    logger: false,
    bodyLimit: 1_200_000,
    trustProxy: true,
  });

  app.get("/", async () => ({ ok: true, service: "tomanit-api" }));

  // Security headers on every response
  app.addHook("onSend", async (_request, reply, payload) => {
    void reply.header("X-Content-Type-Options", "nosniff");
    void reply.header("X-Frame-Options", "DENY");
    void reply.header("Referrer-Policy", "no-referrer");
    void reply.header(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=()",
    );
    void reply.header("X-DNS-Prefetch-Control", "off");
    if (env.NODE_ENV === "production") {
      void reply.header(
        "Strict-Transport-Security",
        "max-age=31536000; includeSubDomains",
      );
    }
    // Do not advertise stack
    void reply.removeHeader("x-powered-by");
    return payload;
  });

  await app.register(cors, {
    origin: (origin, cb) => {
      // Non-browser clients (Telegram bot, server webhooks) send no Origin.
      if (!origin) {
        cb(null, true);
        return;
      }
      cb(null, isAllowedCorsOrigin(origin));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Telegram-Init-Data",
      "X-Telegram-Bot-Api-Secret-Token",
    ],
  });

  app.addHook("onResponse", (request, reply, done) => {
    const path = request.url.split("?")[0] || "/";
    // Skip probe / CORS preflight chatter
    if (request.method === "OPTIONS") {
      done();
      return;
    }
    if (
      reply.statusCode < 400 &&
      (path === "/" || path === "/api/health")
    ) {
      done();
      return;
    }
    const ms = Math.round(reply.elapsedTime);
    log.http(request.method, request.url, reply.statusCode, ms);
    done();
  });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      log.warn("valid", error.flatten());
      return reply.status(400).send({
        error: "Validation failed",
        details: error.flatten(),
      });
    }
    const err = error as { statusCode?: number; message?: string };
    const statusCode =
      typeof err.statusCode === "number" ? err.statusCode : 500;
    if (statusCode >= 500) log.error("api", err.message || error);
    else log.warn("api", err.message || "request failed");
    return reply.status(statusCode).send({
      error:
        statusCode === 401
          ? "Unauthorized"
          : statusCode === 429
            ? "Too many requests. Please try again later."
            : err.message || "Internal Server Error",
    });
  });

  await app.register(telegramWebhookRoutes);
  await app.register(payShellRoutes);

  await app.register(
    async (api) => {
      await api.register(healthRoutes);
      await api.register(authRoutes);
      await api.register(meRoutes);
      await api.register(walletRoutes);
      await api.register(supportRoutes);
      await api.register(kycRoutes);
      await api.register(cardRoutes);
      await api.register(paymentGatewayRoutes);
      await api.register(shopRoutes);
      await api.register(merchantApiRoutes);
      await api.register(adminRoutes);
      await api.register(channelLockRoutes);
    },
    { prefix: "/api" },
  );

  return app;
}

export async function startServer() {
  const app = await buildApp();
  await app.listen({ port: env.PORT, host: "0.0.0.0" });
  return app;
}
