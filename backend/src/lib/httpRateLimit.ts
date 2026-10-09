import type { FastifyReply, FastifyRequest } from "fastify";
import type { HttpRateLimiter } from "./rateLimit.js";

export function clientIp(request: FastifyRequest): string {
  const xf = request.headers["x-forwarded-for"];
  if (typeof xf === "string" && xf.trim()) {
    return xf.split(",")[0]!.trim();
  }
  if (Array.isArray(xf) && xf[0]) {
    return String(xf[0]).split(",")[0]!.trim();
  }
  return request.ip || "unknown";
}

export function rateLimitKey(request: FastifyRequest, extra?: string): string {
  const userPart = request.user?.id != null ? `u:${request.user.id}` : "";
  const ip = clientIp(request);
  return [ip, userPart, extra].filter(Boolean).join("|");
}

/** Fastify preHandler factory — blocks with 429 when over limit. */
export function enforceRateLimit(limiter: HttpRateLimiter, extraKey?: string) {
  return async function rateLimitPreHandler(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const key = rateLimitKey(request, extraKey);
    const result = limiter.hit(key);
    void reply.header("X-RateLimit-Remaining", String(result.remaining));
    if (!result.allowed) {
      void reply.header("Retry-After", String(result.retryAfterSec));
      await reply.status(429).send({
        error: "Too many requests. Please try again later.",
      });
    }
  };
}
