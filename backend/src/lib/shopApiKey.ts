import { randomBytes } from "node:crypto";
import type { MerchantShop } from "@prisma/client";
import { prisma } from "../db/prisma.js";

const SUFFIX_ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

/** `TomanIt:1416:fJKSsbir` — fixed for the shop once issued. */
export function formatShopApiKey(shopId: number, suffix: string): string {
  return `TomanIt:${shopId}:${suffix}`;
}

export function generateShopApiKeySuffix(length = 8): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += SUFFIX_ALPHABET[bytes[i]! % SUFFIX_ALPHABET.length]!;
  }
  return out;
}

export function generateShopApiKey(shopId: number): string {
  return formatShopApiKey(shopId, generateShopApiKeySuffix());
}

export function maskShopApiKey(apiKey: string): string {
  const parts = apiKey.split(":");
  if (parts.length < 3) return "TomanIt:••••••••";
  const suffix = parts[parts.length - 1] ?? "";
  const id = parts[1] ?? "•";
  const tail = suffix.length <= 2 ? "••••" : `••••${suffix.slice(-2)}`;
  return `TomanIt:${id}:${tail}`;
}

/** Issue once and keep forever (re-apply after reject keeps the same key). */
export async function ensureShopApiKey(
  shop: MerchantShop,
): Promise<MerchantShop> {
  if (shop.apiKey?.startsWith("TomanIt:")) return shop;
  const apiKey = generateShopApiKey(shop.id);
  return prisma.merchantShop.update({
    where: { id: shop.id },
    data: { apiKey },
  });
}
