import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { log } from "./log.js";

const DEFAULT_SETTINGS: Record<string, unknown> = {
  supportTelegramUsername: "tomanit_support",
  supportContactEnabled: true,
  tronWalletAddress: "TExampleTronWalletAddress123456789",
  pricing: {
    trxBuyRateToman: 8500,
    trxSellRateToman: 8200,
  },
};

/** Keys that may be stored / merged via admin settings API. */
export const ALLOWED_SETTING_KEYS = [
  "supportTelegramUsername",
  "supportContactEnabled",
  "tronWalletAddress",
  "pricing",
] as const;

export type AllowedSettingKey = (typeof ALLOWED_SETTING_KEYS)[number];

const telegramUsernameSchema = z
  .string()
  .trim()
  .min(3)
  .max(32)
  .regex(/^[A-Za-z0-9_]+$/, "Invalid Telegram username");

const tronAddressSchema = z
  .string()
  .trim()
  .regex(/^T[1-9A-HJ-NP-Za-km-z]{33}$/, "Invalid TRON address");

export const settingsPatchSchema = z
  .object({
    supportTelegramUsername: telegramUsernameSchema.optional(),
    supportContactEnabled: z.boolean().optional(),
    tronWalletAddress: tronAddressSchema.optional(),
    pricing: z
      .object({
        trxBuyRateToman: z.number().positive().max(1_000_000_000).optional(),
        trxSellRateToman: z.number().positive().max(1_000_000_000).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

const DEMO_TELEGRAM_IDS = ["1001", "2002"] as const;

/** Remove legacy seeded demo accounts if still present. */
async function purgeLegacyDemoUsers(): Promise<void> {
  const result = await prisma.user.deleteMany({
    where: {
      OR: [
        { telegramId: { in: [...DEMO_TELEGRAM_IDS] } },
        { username: "demo_user" },
      ],
    },
  });
  if (result.count > 0) {
    log.event("seed", `purged ${result.count} demo user(s)`);
  }
}

/** Ensure default app settings exist (no fake users). */
export async function seedIfEmpty(): Promise<void> {
  await purgeLegacyDemoUsers();

  const settingCount = await prisma.appSetting.count();
  if (settingCount > 0) return;

  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await prisma.appSetting.create({
      data: { key, value: JSON.stringify(value) },
    });
  }

  log.event("seed", "default settings");
}

export async function getMergedSettings(): Promise<Record<string, unknown>> {
  const rows = await prisma.appSetting.findMany({
    where: { key: { in: [...ALLOWED_SETTING_KEYS] } },
  });
  const merged: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const row of rows) {
    try {
      merged[row.key] = JSON.parse(row.value) as unknown;
    } catch {
      merged[row.key] = row.value;
    }
  }
  // Never leak unknown / legacy keys to clients or admin UI.
  const out: Record<string, unknown> = {};
  for (const key of ALLOWED_SETTING_KEYS) {
    out[key] = merged[key];
  }
  return out;
}

/** Public-safe projection for /support/contact */
export async function getPublicContactSettings(): Promise<{
  supportTelegramUsername: string | null;
  tronWalletAddress: string;
  pricing: Record<string, unknown>;
}> {
  const settings = await getMergedSettings();
  const enabled = settings.supportContactEnabled !== false;
  const username = String(settings.supportTelegramUsername ?? "").replace(
    /^@/,
    "",
  );
  const validUsername = telegramUsernameSchema.safeParse(username).success
    ? username
    : null;
  return {
    supportTelegramUsername: enabled ? validUsername ?? "tomanit_support" : null,
    tronWalletAddress: tronAddressSchema.safeParse(settings.tronWalletAddress)
      .success
      ? String(settings.tronWalletAddress)
      : "",
    pricing:
      settings.pricing &&
      typeof settings.pricing === "object" &&
      !Array.isArray(settings.pricing)
        ? (settings.pricing as Record<string, unknown>)
        : (DEFAULT_SETTINGS.pricing as Record<string, unknown>),
  };
}

export async function mergeAndSaveSettings(
  patch: z.infer<typeof settingsPatchSchema>,
): Promise<Record<string, unknown>> {
  const current = await getMergedSettings();
  const next = deepMerge(
    current,
    patch as Record<string, unknown>,
  );

  for (const key of ALLOWED_SETTING_KEYS) {
    if (!(key in next)) continue;
    await prisma.appSetting.upsert({
      where: { key },
      create: { key, value: JSON.stringify(next[key]) },
      update: { value: JSON.stringify(next[key]) },
    });
  }

  return getMergedSettings();
}

function deepMerge(
  base: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [key, val] of Object.entries(patch)) {
    if (val === undefined) continue;
    if (
      val !== null &&
      typeof val === "object" &&
      !Array.isArray(val) &&
      typeof out[key] === "object" &&
      out[key] !== null &&
      !Array.isArray(out[key])
    ) {
      out[key] = deepMerge(
        out[key] as Record<string, unknown>,
        val as Record<string, unknown>,
      );
    } else {
      out[key] = val;
    }
  }
  return out;
}

/** @deprecated Prefer ticketCodeFromId after insert. Kept for rare temp placeholders. */
export function randomTicketCode(): string {
  return `TMP-${Date.now()}`;
}

export function randomInvoiceCode(): string {
  return `TMP-${Date.now()}`;
}
