import type { FastifyRequest } from "fastify";
import type { Prisma, User, UserRole } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import { clientIp } from "./httpRateLimit.js";

type AuditActor = Pick<User, "id" | "telegramId" | "role">;

export type AdminAuditLogDto = {
  id: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  meta: Record<string, unknown> | null;
  ip: string | null;
  createdAt: string;
  actor: {
    telegramId: string;
    role: UserRole;
    username: string | null;
    displayName: string | null;
  };
};

export async function writeAdminAudit(params: {
  request?: FastifyRequest;
  actor: AuditActor;
  action: string;
  targetType?: string | null;
  targetId?: string | number | null;
  meta?: Record<string, unknown> | null;
}): Promise<void> {
  const { actor, action, targetType = null, targetId = null, meta = null } = params;
  let ip: string | null = null;
  try {
    if (params.request) {
      ip = clientIp(params.request);
    }
  } catch {
    ip = null;
  }

  try {
    await prisma.adminAuditLog.create({
      data: {
        actorUserId: actor.id,
        actorTelegramId: actor.telegramId,
        actorRole: actor.role,
        action,
        targetType,
        targetId: targetId != null ? String(targetId) : null,
        meta: meta == null ? undefined : (meta as Prisma.InputJsonValue),
        ip,
      },
    });
  } catch (error) {
    console.warn(
      "[audit]",
      error instanceof Error ? error.message : "failed to write audit log",
    );
  }
}

export async function listAdminAuditForUser(
  telegramId: string,
  { limit = 50 }: { limit?: number } = {},
): Promise<AdminAuditLogDto[]> {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const targetId = String(telegramId);

  const rows = await prisma.adminAuditLog.findMany({
    where: { targetType: "user", targetId },
    orderBy: { createdAt: "desc" },
    take: safeLimit,
  });

  const actorIds = [...new Set(rows.map((r) => r.actorUserId))];
  const actors = actorIds.length
    ? await prisma.user.findMany({
        where: { id: { in: actorIds } },
        select: {
          id: true,
          telegramId: true,
          username: true,
          fullName: true,
          firstName: true,
          lastName: true,
          role: true,
        },
      })
    : [];
  const actorMap = new Map(actors.map((a) => [a.id, a]));

  return rows.map((row) => {
    const actor = actorMap.get(row.actorUserId);
    const displayName =
      actor?.fullName?.trim() ||
      [actor?.firstName, actor?.lastName].filter(Boolean).join(" ").trim() ||
      null;
    return {
      id: String(row.id),
      action: row.action,
      targetType: row.targetType,
      targetId: row.targetId,
      meta: (row.meta as Record<string, unknown> | null) ?? null,
      ip: row.ip,
      createdAt: row.createdAt.toISOString(),
      actor: {
        telegramId: actor?.telegramId ?? row.actorTelegramId,
        role: actor?.role ?? row.actorRole,
        username: actor?.username ?? null,
        displayName,
      },
    };
  });
}
