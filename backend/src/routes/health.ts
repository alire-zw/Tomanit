import type { FastifyInstance } from "fastify";
import { connectRedis, redis } from "../db/redis.js";

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/health", async () => {
    let redisOk = false;
    try {
      redisOk = (await redis.ping()) === "PONG";
    } catch {
      redisOk = false;
    }

    return {
      ok: true,
      service: "tomanit-api",
      redis: redisOk,
      timestamp: new Date().toISOString(),
    };
  });

  // Warm Redis on first health/register without blocking boot
  void connectRedis();
}
