import { Redis } from "ioredis";
import { env } from "../config/env.js";
import { log } from "../lib/log.js";

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 2,
  lazyConnect: true,
  enableOfflineQueue: false,
});

let readyLogged = false;
let errorLogged = false;

redis.on("ready", () => {
  if (!readyLogged) {
    log.service("Redis", env.REDIS_URL.replace(/\/\/.*@/, "//***@"), true);
    readyLogged = true;
    errorLogged = false;
  }
});

redis.on("error", (err: Error) => {
  if (!errorLogged) {
    log.warn("redis", err.message);
    errorLogged = true;
  }
});

export async function connectRedis(): Promise<boolean> {
  try {
    if (redis.status === "wait") {
      await redis.connect();
    }
    const pong = await redis.ping();
    return pong === "PONG";
  } catch (err) {
    log.warn("redis", err instanceof Error ? err.message : String(err));
    return false;
  }
}

export async function closeRedis(): Promise<void> {
  if (redis.status === "end" || redis.status === "wait") return;
  try {
    await redis.quit();
  } catch {
    redis.disconnect();
  }
}
