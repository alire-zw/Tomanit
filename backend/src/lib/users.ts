import type { User, Wallet } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import type { TelegramWebAppUser } from "./telegramAuth.js";

export type UserWithWallet = User & { wallet: Wallet | null };

/**
 * Upsert from Telegram Mini App auth (panelout-style).
 * Does not overwrite fullName, phone, email, role, fee/kyc, or ban flags.
 */
export async function upsertUserFromTelegram(
  from: TelegramWebAppUser,
): Promise<UserWithWallet> {
  if (!from?.id) {
    throw Object.assign(new Error("Telegram user id is required"), { statusCode: 401 });
  }

  const telegramId = String(from.id);
  const firstName = from.first_name?.trim() || null;
  const lastName = from.last_name?.trim() || null;
  const username = from.username?.trim() || null;
  /** App default locale is always Persian; users may change it later in settings. */
  const languageCode = "fa";
  const telegramName =
    [firstName, lastName].filter(Boolean).join(" ").trim() || firstName || "کاربر";

  const existing = await prisma.user.findUnique({
    where: { telegramId },
    include: { wallet: true },
  });

  if (!existing) {
    return prisma.user.create({
      data: {
        telegramId,
        firstName: firstName ?? "کاربر",
        lastName,
        username,
        fullName: telegramName,
        languageCode,
        wallet: { create: {} },
      },
      include: { wallet: true },
    });
  }

  const updated = await prisma.user.update({
    where: { id: existing.id },
    data: {
      firstName: firstName ?? existing.firstName,
      lastName,
      username,
      // Keep in-app language preference; only fill if never set.
      languageCode: existing.languageCode ?? languageCode,
    },
    include: { wallet: true },
  });

  if (!updated.wallet) {
    const wallet = await prisma.wallet.create({ data: { userId: updated.id } });
    return { ...updated, wallet };
  }

  return updated;
}

/** Upsert for bot /start without auto-filling language (user picks via buttons). */
export async function upsertUserFromBotStart(
  from: TelegramWebAppUser,
): Promise<UserWithWallet> {
  return upsertUserFromTelegram({
    ...from,
    language_code: undefined,
  });
}

export async function setUserLanguageCode(
  telegramId: string,
  languageCode: string,
): Promise<UserWithWallet | null> {
  const existing = await prisma.user.findUnique({
    where: { telegramId },
    include: { wallet: true },
  });
  if (!existing) return null;

  return prisma.user.update({
    where: { id: existing.id },
    data: { languageCode },
    include: { wallet: true },
  });
}

export async function findUserByTelegramId(
  telegramId: string,
): Promise<UserWithWallet | null> {
  return prisma.user.findUnique({
    where: { telegramId },
    include: { wallet: true },
  });
}

export async function ensureUserWallet(userId: number) {
  const existing = await prisma.wallet.findUnique({ where: { userId } });
  if (existing) return existing;
  return prisma.wallet.create({ data: { userId } });
}
