import type { FastifyReply, FastifyRequest } from "fastify";
import type { MerchantShop } from "@prisma/client";
import { prisma } from "../db/prisma.js";

export type ShopApiRequest = FastifyRequest & {
  merchantShop?: MerchantShop;
};

/** Extract Bearer token from Authorization header. */
export function readBearerToken(request: FastifyRequest): string | null {
  const auth = String(request.headers.authorization || "").trim();
  if (!auth) return null;
  if (auth.toLowerCase().startsWith("bearer ")) {
    const token = auth.slice(7).trim();
    return token || null;
  }
  return null;
}

/**
 * Resolve active merchant shop from `Authorization: Bearer TomanIt:{shopId}:{suffix}`.
 */
export async function resolveShopFromApiKey(
  apiKey: string,
): Promise<MerchantShop | null> {
  const key = apiKey.trim();
  if (!key.startsWith("TomanIt:")) return null;
  const shop = await prisma.merchantShop.findUnique({
    where: { apiKey: key },
  });
  if (!shop || shop.status !== "active") return null;
  return shop;
}

export async function requireShopApiKey(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<MerchantShop | null> {
  const token = readBearerToken(request);
  if (!token) {
    await reply.status(401).send({ error: "Missing API key", code: "unauthorized" });
    return null;
  }
  const shop = await resolveShopFromApiKey(token);
  if (!shop) {
    await reply.status(401).send({ error: "Invalid API key", code: "unauthorized" });
    return null;
  }
  (request as ShopApiRequest).merchantShop = shop;
  return shop;
}
