import type { FastifyReply, FastifyRequest } from "fastify";
import type { User } from "@prisma/client";
import { env } from "../config/env.js";
import { extractInitData, validateTelegramInitData } from "../lib/telegramAuth.js";
import {
  findUserByTelegramId,
  upsertUserFromTelegram,
} from "../lib/users.js";

declare module "fastify" {
  interface FastifyRequest {
    user?: User;
    telegramUser?: {
      id: number;
      first_name?: string;
      last_name?: string;
      username?: string;
    };
  }
}

type AuthOptions = {
  forceUpsert?: boolean;
  allowBanned?: boolean;
};

function isWriteMethod(method: string): boolean {
  return ["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase());
}

async function resolveAuthedUser(
  request: FastifyRequest,
  options: AuthOptions = {},
): Promise<User> {
  const initData = extractInitData(
    request.headers as unknown as Record<string, unknown>,
  );

  if (!initData) {
    throw Object.assign(new Error("Unauthorized"), { statusCode: 401 });
  }

  if (!env.TELEGRAM_BOT_TOKEN) {
    throw Object.assign(new Error("Bot token is not configured"), {
      statusCode: 500,
    });
  }

  const validated = validateTelegramInitData(initData, env.TELEGRAM_BOT_TOKEN, {
    maxAgeSeconds: env.AUTH_MAX_AGE_SEC,
  });
  request.telegramUser = validated.user;

  const shouldUpsert = options.forceUpsert || isWriteMethod(request.method);
  const row = shouldUpsert
    ? await upsertUserFromTelegram(validated.user)
    : (await findUserByTelegramId(String(validated.user.id))) ??
      (await upsertUserFromTelegram(validated.user));

  return row;
}

export async function attachUserFromHeader(
  request: FastifyRequest,
  reply: FastifyReply,
  options: AuthOptions = {},
): Promise<void> {
  try {
    const user = await resolveAuthedUser(request, options);
    if (user.isBanned && !options.allowBanned) {
      await reply.status(403).send({ error: "Account banned" });
      return;
    }
    if (!user.isActive && !options.allowBanned) {
      await reply.status(403).send({ error: "Account inactive" });
      return;
    }
    request.user = user;
  } catch (error) {
    if (reply.sent) return;
    const err = error as { statusCode?: number; message?: string };
    const status = typeof err.statusCode === "number" ? err.statusCode : 401;
    await reply.status(status).send({
      error: status === 401 ? "Unauthorized" : err.message || "Unauthorized",
    });
  }
}

export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  await attachUserFromHeader(request, reply);
}

export async function requireAuthUpsert(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  await attachUserFromHeader(request, reply, { forceUpsert: true });
}

/** Staff: admin or supervisor (tickets / overview). */
export async function requireStaff(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  await attachUserFromHeader(request, reply);
  if (reply.sent) return;
  if (request.user?.role !== "admin" && request.user?.role !== "supervisor") {
    await reply.status(403).send({ error: "Staff access required" });
  }
}

/**
 * Full admin only — payments, gateways, settings, users, invoices.
 * Supervisors must not reach money / secrets surfaces.
 */
export async function requireAdmin(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  await attachUserFromHeader(request, reply);
  if (reply.sent) return;
  if (request.user?.role !== "admin") {
    await reply.status(403).send({ error: "Admin access required" });
  }
}

export function serializeUser(user: User) {
  return {
    id: String(user.id),
    telegramId: user.telegramId,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    fullName: user.fullName,
    phone: user.phone,
    email: user.email,
    role: user.role,
    kycLevel: user.kycLevel,
    feeLevel: user.feeLevel,
    isBanned: user.isBanned,
    isActive: user.isActive,
    languageCode: user.languageCode,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export function serializeWallet(
  wallet: {
    tomanBalance: bigint;
    trxBalance: number;
    usdtBalance?: number;
    bnbBalance?: number;
    maticBalance?: number;
    gramBalance?: number;
    updatedAt: Date;
  },
  options?: {
    addresses?: Array<{ network: string; address: string }>;
  },
) {
  const base = {
    tomanBalance: wallet.tomanBalance.toString(),
    trxBalance: wallet.trxBalance,
    usdtBalance: wallet.usdtBalance ?? 0,
    bnbBalance: wallet.bnbBalance ?? 0,
    maticBalance: wallet.maticBalance ?? 0,
    gramBalance: wallet.gramBalance ?? 0,
    updatedAt: wallet.updatedAt.toISOString(),
  };
  if (options?.addresses) {
    return {
      ...base,
      addresses: options.addresses.map((a) => ({
        network: a.network,
        address: a.address,
      })),
    };
  }
  return base;
}
