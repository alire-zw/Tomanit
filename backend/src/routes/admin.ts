import type { FastifyInstance } from "fastify";
import type { FeeLevel, Prisma, TicketStatus, UserRole } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import {
  requireAdmin,
  requireStaff,
  serializeUser,
  serializeWallet,
} from "../middleware/auth.js";
import { parseIdParam } from "../lib/ids.js";
import {
  getMergedSettings,
  mergeAndSaveSettings,
  settingsPatchSchema,
} from "../lib/seed.js";
import { assertImageData } from "../lib/ticketCode.js";
import {
  addressFromPrivateKey,
  getOnChainAssetAmount,
} from "../lib/walletChainTransfer.js";
import {
  encryptPrivateKey,
  validateAddress,
} from "../lib/walletCrypto.js";
import { SWEEP_THRESHOLD_TOMAN } from "../lib/walletSweepJob.js";
import { ASSETS } from "../lib/walletAssets.js";
import { invalidateMeCache, invalidateMeCacheByUserId } from "../lib/meCache.js";
import { notifyShopReview } from "../lib/bot/notifyShopReview.js";
import {
  AdminSystemChannelError,
  deleteAdminSystemChannel,
  getAdminSystemChannelsBotInfo,
  listAdminSystemChannels,
  registerAdminSystemChannel,
  setAdminSystemChannelActive,
} from "../lib/systemChannels.js";
import { listAdminAuditForUser, writeAdminAudit } from "../lib/adminAudit.js";
import {
  loadUserTickets,
  serializeMerchantShop,
} from "../lib/userBundle.js";
import {
  getAdminShopSettlement,
  listAdminShopSettlements,
  updateAdminShopSettlementStatus,
} from "../lib/merchantSettlement.js";

const patchTicketSchema = z
  .object({
    status: z.enum(["open", "answered", "closed"]).optional(),
    reply: z.string().max(5000).optional(),
    imageData: z.string().max(900_000).optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.status && !value.reply?.trim() && !value.imageData) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "وضعیت، متن یا تصویر الزامی است",
      });
    }
  });

function serializeAdminMessage(m: {
  id: number;
  sender: string;
  body: string;
  imageData: string | null;
  createdAt: Date;
}) {
  return {
    id: String(m.id),
    sender: m.sender,
    body: m.body,
    imageData: m.imageData ?? null,
    createdAt: m.createdAt.toISOString(),
  };
}

function displayUserLabel(user: {
  telegramId: string;
  username: string | null;
  fullName: string | null;
}): string {
  if (user.fullName?.trim()) return user.fullName.trim();
  if (user.username?.trim()) return `@${user.username.trim()}`;
  return user.telegramId;
}

const patchInvoiceSchema = z.object({
  status: z.enum(["pending", "paid", "cancelled"]),
});

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function adminRoutes(app: FastifyInstance): Promise<void> {
  // Staff (admin + supervisor): overview + tickets
  app.get("/admin/overview", { preHandler: requireStaff }, async () => {
    const today = startOfToday();
    const completedToday = {
      status: "completed" as const,
      createdAt: { gte: today },
    };

    const [
      users,
      usersToday,
      openTickets,
      pendingInvoices,
      pendingShops,
      pendingSettlements,
      todayTxAgg,
      todayWalletFeeAgg,
      todayGatewayFeeAgg,
      todayChargesAgg,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: today } } }),
      prisma.supportTicket.count({ where: { status: "open" } }),
      prisma.invoice.count({ where: { status: "pending" } }),
      prisma.merchantShop.count({ where: { status: "pending" } }),
      prisma.merchantShopSettlement.count({
        where: { status: { in: ["requested", "processing"] } },
      }),
      prisma.walletTransaction.aggregate({
        where: completedToday,
        _count: { _all: true },
        _sum: { amountToman: true },
      }),
      prisma.walletTransaction.aggregate({
        where: completedToday,
        _sum: { feeToman: true },
      }),
      prisma.gatewayCharge.aggregate({
        where: {
          status: "completed",
          OR: [{ paidAt: { gte: today } }, { paidAt: null, updatedAt: { gte: today } }],
        },
        _sum: { feeToman: true },
      }),
      prisma.walletTransaction.aggregate({
        where: {
          type: "recharge",
          status: "completed",
          createdAt: { gte: today },
        },
        _count: { _all: true },
        _sum: { amount: true, amountToman: true },
      }),
    ]);

    const todayTxCount = todayTxAgg._count._all;
    const todayTxAmount = Math.round(Number(todayTxAgg._sum.amountToman ?? 0));
    const walletFees = Number(todayWalletFeeAgg._sum.feeToman ?? 0);
    const gatewayFees = Number(todayGatewayFeeAgg._sum.feeToman ?? 0);
    const todayFeeProfit = Math.round(walletFees + gatewayFees);
    const todayChargesCount = todayChargesAgg._count._all;
    const todayChargesAmount = Math.round(
      Number(todayChargesAgg._sum.amountToman ?? todayChargesAgg._sum.amount ?? 0),
    );

    return {
      users,
      usersToday,
      openTickets,
      pendingInvoices,
      pendingShops,
      pendingSettlements,
      todayTxCount,
      todayTxAmount,
      todayFeeProfit,
      todayChargesCount,
      todayChargesAmount,
    };
  });

  app.get("/admin/settlements", { preHandler: requireStaff }, async (request) => {
    const query = request.query as { status?: string };
    const status =
      query.status === "requested" ||
      query.status === "processing" ||
      query.status === "paid" ||
      query.status === "rejected"
        ? query.status
        : undefined;
    const settlements = await listAdminShopSettlements({ status });
    return { settlements };
  });

  app.get("/admin/settlements/:id", { preHandler: requireStaff }, async (request, reply) => {
    const id = parseIdParam((request.params as { id?: string }).id);
    if (id == null) {
      return reply.status(400).send({ error: "Invalid id" });
    }
    const settlement = await getAdminShopSettlement(id);
    if (!settlement) {
      return reply.status(404).send({ error: "Settlement not found" });
    }
    return { settlement };
  });

  const patchSettlementStatusSchema = z.object({
    status: z.enum(["processing", "paid"]),
  });

  app.patch(
    "/admin/settlements/:id/status",
    { preHandler: requireStaff },
    async (request, reply) => {
      const id = parseIdParam((request.params as { id?: string }).id);
      if (id == null) {
        return reply.status(400).send({ error: "Invalid id" });
      }
      const body = patchSettlementStatusSchema.parse(request.body ?? {});
      try {
        const { settlement, userId } = await updateAdminShopSettlementStatus({
          id,
          status: body.status,
        });
        await invalidateMeCacheByUserId(userId);
        return { settlement };
      } catch (err) {
        const statusCode =
          err && typeof err === "object" && "statusCode" in err
            ? Number((err as { statusCode: number }).statusCode)
            : 500;
        const message =
          err instanceof Error ? err.message : "Failed to update settlement";
        return reply
          .status(statusCode >= 400 && statusCode < 600 ? statusCode : 500)
          .send({ error: message });
      }
    },
  );

  const rejectShopSchema = z.object({
    note: z.string().trim().max(500).optional(),
  });

  app.get("/admin/shops/stats", { preHandler: requireStaff }, async () => {
    const { computeAdminShopStatsPage } = await import("../lib/adminShopStats.js");
    return computeAdminShopStatsPage();
  });

  app.get("/admin/shops", { preHandler: requireStaff }, async (request) => {
    const query = request.query as { status?: string };
    const status =
      query.status === "pending" ||
      query.status === "active" ||
      query.status === "rejected" ||
      query.status === "suspended"
        ? query.status
        : undefined;

    const shops = await prisma.merchantShop.findMany({
      where: status ? { status } : undefined,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 100,
      include: {
        user: {
          select: {
            id: true,
            telegramId: true,
            username: true,
            fullName: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return {
      shops: shops.map((shop) => ({
        id: String(shop.id),
        name: shop.name,
        sellType: shop.sellType,
        dailyAmountToman: Number(shop.dailyAmountToman),
        dailyCount: shop.dailyCount,
        channel: shop.channel,
        siteUrl: shop.siteUrl,
        botUrl: shop.botUrl,
        logoDataUrl: shop.logoData,
        status: shop.status,
        reviewNote: shop.reviewNote,
        reviewedAt: shop.reviewedAt?.toISOString() ?? null,
        createdAt: shop.createdAt.toISOString(),
        updatedAt: shop.updatedAt.toISOString(),
        user: {
          id: String(shop.user.id),
          telegramId: shop.user.telegramId,
          username: shop.user.username,
          fullName: shop.user.fullName,
          firstName: shop.user.firstName,
          lastName: shop.user.lastName,
        },
      })),
    };
  });

  app.post("/admin/shops/:id/approve", { preHandler: requireStaff }, async (request, reply) => {
    const id = parseIdParam((request.params as { id?: string }).id);
    if (id == null) {
      return reply.status(400).send({ error: "Invalid id" });
    }
    const shop = await prisma.merchantShop.findUnique({ where: { id } });
    if (!shop) {
      return reply.status(404).send({ error: "فروشگاه یافت نشد" });
    }
    if (shop.status !== "pending" && shop.status !== "rejected") {
      return reply.status(409).send({ error: "این فروشگاه قابل تأیید نیست" });
    }
    const updated = await prisma.merchantShop.update({
      where: { id },
      data: {
        status: "active",
        reviewNote: null,
        reviewedAt: new Date(),
        reviewedById: request.user!.id,
      },
    });
    await invalidateMeCacheByUserId(updated.userId);
    void notifyShopReview({ userId: updated.userId, decision: "approved" });
    return {
      shop: {
        id: String(updated.id),
        status: updated.status,
        reviewedAt: updated.reviewedAt?.toISOString() ?? null,
      },
    };
  });

  app.post("/admin/shops/:id/reject", { preHandler: requireStaff }, async (request, reply) => {
    const id = parseIdParam((request.params as { id?: string }).id);
    if (id == null) {
      return reply.status(400).send({ error: "Invalid id" });
    }
    const body = rejectShopSchema.parse(request.body ?? {});
    const shop = await prisma.merchantShop.findUnique({ where: { id } });
    if (!shop) {
      return reply.status(404).send({ error: "فروشگاه یافت نشد" });
    }
    if (shop.status !== "pending" && shop.status !== "active") {
      return reply.status(409).send({ error: "این فروشگاه قابل رد نیست" });
    }
    const updated = await prisma.merchantShop.update({
      where: { id },
      data: {
        status: "rejected",
        reviewNote: body.note?.trim() || null,
        reviewedAt: new Date(),
        reviewedById: request.user!.id,
      },
    });
    await invalidateMeCacheByUserId(updated.userId);
    void notifyShopReview({
      userId: updated.userId,
      decision: "rejected",
      reason: updated.reviewNote,
    });
    return {
      shop: {
        id: String(updated.id),
        status: updated.status,
        reviewNote: updated.reviewNote,
        reviewedAt: updated.reviewedAt?.toISOString() ?? null,
      },
    };
  });

  app.get("/admin/tickets", { preHandler: requireStaff }, async (request) => {
    const query = request.query as {
      status?: string;
      q?: string;
      page?: string;
      limit?: string;
    };
    const page = Math.max(1, Number.parseInt(query.page || "1", 10) || 1);
    const limit = Math.min(
      50,
      Math.max(1, Number.parseInt(query.limit || "20", 10) || 20),
    );
    const status: TicketStatus | undefined =
      query.status === "open" ||
      query.status === "answered" ||
      query.status === "closed"
        ? query.status
        : undefined;
    const q = query.q?.trim();

    const where: Prisma.SupportTicketWhereInput = {
      ...(status ? { status } : {}),
      ...(q
        ? {
            OR: [
              { code: { contains: q } },
              { subject: { contains: q } },
              { user: { telegramId: { contains: q } } },
              { user: { username: { contains: q } } },
              { user: { fullName: { contains: q } } },
            ],
          }
        : {}),
    };

    const [total, tickets] = await Promise.all([
      prisma.supportTicket.count({ where }),
      prisma.supportTicket.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: {
            select: {
              telegramId: true,
              username: true,
              fullName: true,
            },
          },
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / limit));

    return {
      page,
      limit,
      total,
      totalPages,
      tickets: tickets.map((t) => ({
        id: String(t.id),
        code: t.code,
        subject: t.subject,
        status: t.status,
        user: t.user,
        userLabel: displayUserLabel(t.user),
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
        lastMessage: t.messages[0]
          ? {
              sender: t.messages[0].sender,
              body: t.messages[0].body,
              createdAt: t.messages[0].createdAt.toISOString(),
            }
          : null,
      })),
    };
  });

  app.get(
    "/admin/tickets/:id",
    { preHandler: requireStaff },
    async (request, reply) => {
      const id = parseIdParam((request.params as { id: string }).id);
      if (id == null) {
        return reply.status(400).send({ error: "Invalid ticket id" });
      }
      const ticket = await prisma.supportTicket.findUnique({
        where: { id },
        include: {
          user: {
            select: {
              telegramId: true,
              username: true,
              fullName: true,
            },
          },
          messages: { orderBy: { createdAt: "asc" } },
        },
      });
      if (!ticket) {
        return reply.status(404).send({ error: "Ticket not found" });
      }
      return {
        ticket: {
          id: String(ticket.id),
          code: ticket.code,
          subject: ticket.subject,
          status: ticket.status,
          user: ticket.user,
          userLabel: displayUserLabel(ticket.user),
          createdAt: ticket.createdAt.toISOString(),
          updatedAt: ticket.updatedAt.toISOString(),
          messages: ticket.messages.map(serializeAdminMessage),
        },
      };
    },
  );

  app.patch(
    "/admin/tickets/:id",
    { preHandler: requireStaff },
    async (request, reply) => {
      const id = parseIdParam((request.params as { id: string }).id);
      if (id == null) {
        return reply.status(400).send({ error: "Invalid ticket id" });
      }
      const body = patchTicketSchema.parse(request.body);

      let imageData: string | null = null;
      try {
        imageData = assertImageData(body.imageData);
      } catch (err) {
        const message = err instanceof Error ? err.message : "تصویر نامعتبر است";
        return reply.status(400).send({ error: message });
      }

      const ticket = await prisma.supportTicket.findUnique({ where: { id } });
      if (!ticket) {
        return reply.status(404).send({ error: "Ticket not found" });
      }

      const replyText = body.reply?.trim() || "";
      const hasReply = Boolean(replyText || imageData);
      const nextStatus =
        body.status ?? (hasReply ? "answered" : ticket.status);
      const messageBody = replyText || (imageData ? "📷 تصویر" : "");

      if (hasReply) {
        await prisma.supportMessage.create({
          data: {
            ticketId: ticket.id,
            sender: "admin",
            body: messageBody,
            imageData,
          },
        });
      }

      const updated = await prisma.supportTicket.update({
        where: { id },
        data: {
          status: nextStatus,
          updatedAt: new Date(),
        },
        include: {
          user: {
            select: {
              telegramId: true,
              username: true,
              fullName: true,
            },
          },
          messages: { orderBy: { createdAt: "asc" } },
        },
      });

      await invalidateMeCache(updated.user.telegramId);

      return {
        ticket: {
          id: String(updated.id),
          code: updated.code,
          subject: updated.subject,
          status: updated.status,
          user: updated.user,
          userLabel: displayUserLabel(updated.user),
          createdAt: updated.createdAt.toISOString(),
          updatedAt: updated.updatedAt.toISOString(),
          messages: updated.messages.map(serializeAdminMessage),
        },
      };
    },
  );

  // Full admin only: users, invoices, settings
  await app.register(async (adminOnly) => {
    adminOnly.addHook("preHandler", requireAdmin);

    adminOnly.get("/admin/users", async (request) => {
      const query = request.query as {
        q?: string;
        filter?: string;
      };
      const q = query.q?.trim();
      const filter = (query.filter || "all").trim().toLowerCase();

      const where: Prisma.UserWhereInput = {};
      if (q) {
        where.OR = [
          { telegramId: { contains: q } },
          { username: { contains: q } },
          { fullName: { contains: q } },
          { phone: { contains: q } },
          { email: { contains: q } },
        ];
      }
      if (filter === "banned") {
        where.isBanned = true;
      } else if (filter === "user" || filter === "admin" || filter === "supervisor") {
        where.role = filter as UserRole;
        where.isBanned = false;
      } else if (filter === "merchant") {
        where.merchantShop = { isNot: null };
      }

      const users = await prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 150,
        include: {
          wallet: true,
          merchantShop: { select: { id: true, status: true, name: true } },
        },
      });
      return {
        users: users.map((u) => ({
          ...serializeUser(u),
          hasShop: Boolean(u.merchantShop),
          shopStatus: u.merchantShop?.status ?? null,
          shopName: u.merchantShop?.name ?? null,
          wallet: u.wallet
            ? {
                tomanBalance: u.wallet.tomanBalance.toString(),
                trxBalance: u.wallet.trxBalance,
                usdtBalance: u.wallet.usdtBalance,
                bnbBalance: u.wallet.bnbBalance,
                maticBalance: u.wallet.maticBalance,
                gramBalance: u.wallet.gramBalance,
              }
            : null,
        })),
      };
    });

    adminOnly.get<{ Params: { id: string } }>(
      "/admin/users/:id/detail",
      async (request, reply) => {
        const id = parseIdParam(request.params.id);
        if (id == null) {
          return reply.status(400).send({ error: "Invalid user id" });
        }

        const user = await prisma.user.findUnique({
          where: { id },
          include: {
            wallet: { include: { addresses: true } },
            merchantShop: true,
          },
        });
        if (!user) {
          return reply.status(404).send({ error: "User not found" });
        }

        const [tickets, transactions, auditLogs] = await Promise.all([
          loadUserTickets(user.id),
          prisma.walletTransaction.findMany({
            where: { userId: user.id },
            orderBy: { createdAt: "desc" },
            take: 80,
          }),
          listAdminAuditForUser(user.telegramId, { limit: 50 }),
        ]);

        const wallet = user.wallet
          ? serializeWallet(user.wallet, {
              addresses: user.wallet.addresses.map((a) => ({
                network: a.network,
                address: a.address,
              })),
            })
          : null;

        return {
          user: serializeUser(user),
          wallet,
          shop: user.merchantShop
            ? {
                ...serializeMerchantShop(user.merchantShop),
                balanceToman: user.merchantShop.balanceToman.toString(),
                apiKey: user.merchantShop.apiKey,
              }
            : null,
          tickets,
          transactions: transactions.map((tx) => ({
            id: String(tx.id),
            code: tx.code,
            type: tx.type,
            asset: tx.asset,
            amount: tx.amount,
            counterAsset: tx.counterAsset,
            counterAmount: tx.counterAmount,
            amountToman: tx.amountToman,
            status: tx.status,
            note: tx.note,
            network: tx.network,
            txHash: tx.txHash,
            paymentMethod: tx.paymentMethod,
            createdAt: tx.createdAt.toISOString(),
            completedAt: tx.completedAt?.toISOString() ?? null,
          })),
          auditLogs,
        };
      },
    );

    adminOnly.patch<{ Params: { id: string } }>(
      "/admin/users/:id/ban",
      async (request, reply) => {
        const id = parseIdParam(request.params.id);
        if (id == null) {
          return reply.status(400).send({ error: "Invalid user id" });
        }
        const body = z.object({ isBanned: z.boolean() }).parse(request.body);
        const actor = request.user!;
        if (actor.id === id) {
          return reply.status(400).send({ error: "Cannot modify your own account" });
        }

        const existing = await prisma.user.findUnique({ where: { id } });
        if (!existing) {
          return reply.status(404).send({ error: "User not found" });
        }

        const updated = await prisma.user.update({
          where: { id },
          data: { isBanned: body.isBanned },
        });
        await invalidateMeCache(updated.telegramId);
        await writeAdminAudit({
          request,
          actor,
          action: body.isBanned ? "user.ban" : "user.unban",
          targetType: "user",
          targetId: updated.telegramId,
          meta: {
            targetUserTelegramId: updated.telegramId,
            previousBanned: existing.isBanned,
            newBanned: updated.isBanned,
          },
        });
        return { user: serializeUser(updated) };
      },
    );

    adminOnly.patch<{ Params: { id: string } }>(
      "/admin/users/:id/balance",
      async (request, reply) => {
        const id = parseIdParam(request.params.id);
        if (id == null) {
          return reply.status(400).send({ error: "Invalid user id" });
        }
        const body = z
          .object({
            tomanBalance: z.union([z.number(), z.string()]),
            note: z.string().max(255).optional(),
          })
          .parse(request.body);
        const actor = request.user!;
        if (actor.id === id) {
          return reply.status(400).send({ error: "Cannot modify your own account" });
        }

        const amountRaw =
          typeof body.tomanBalance === "string"
            ? body.tomanBalance.replace(/[^\d]/g, "")
            : String(Math.trunc(body.tomanBalance));
        const amount = BigInt(amountRaw || "0");
        if (amount < 0n) {
          return reply.status(400).send({ error: "Invalid balance" });
        }

        const user = await prisma.user.findUnique({
          where: { id },
          include: { wallet: true },
        });
        if (!user) {
          return reply.status(404).send({ error: "User not found" });
        }

        const wallet =
          user.wallet ??
          (await prisma.wallet.create({ data: { userId: user.id } }));
        const previous = wallet.tomanBalance;
        if (previous === amount) {
          return {
            user: serializeUser(user),
            wallet: serializeWallet(wallet),
            previousBalance: previous.toString(),
            newBalance: amount.toString(),
          };
        }

        const delta = Number(amount - previous);
        const updatedWallet = await prisma.$transaction(async (tx) => {
          const next = await tx.wallet.update({
            where: { userId: user.id },
            data: { tomanBalance: amount },
          });
          await tx.walletTransaction.create({
            data: {
              userId: user.id,
              type: "adjustment",
              status: "completed",
              asset: "toman",
              amount: Math.abs(delta),
              amountToman: Math.abs(delta),
              unitPriceToman: 1,
              paymentMethod: "manual",
              balanceAfter: Number(amount),
              note: body.note?.trim() || "Admin balance adjustment",
              reviewedBy: actor.id,
              reviewedAt: new Date(),
              completedAt: new Date(),
              metadata: {
                kind: "admin_balance_set",
                previousBalance: previous.toString(),
                newBalance: amount.toString(),
                actorTelegramId: actor.telegramId,
              },
            },
          });
          return next;
        });

        await invalidateMeCache(user.telegramId);
        await writeAdminAudit({
          request,
          actor,
          action: "user.balance.set",
          targetType: "user",
          targetId: user.telegramId,
          meta: {
            targetUserTelegramId: user.telegramId,
            previousBalance: previous.toString(),
            newBalance: amount.toString(),
            note: body.note?.trim() || null,
          },
        });

        return {
          user: serializeUser(user),
          wallet: serializeWallet(updatedWallet),
          previousBalance: previous.toString(),
          newBalance: amount.toString(),
        };
      },
    );

    adminOnly.patch<{ Params: { id: string } }>(
      "/admin/users/:id/role",
      async (request, reply) => {
        const id = parseIdParam(request.params.id);
        if (id == null) {
          return reply.status(400).send({ error: "Invalid user id" });
        }
        const body = z
          .object({ role: z.enum(["user", "admin", "supervisor"]) })
          .parse(request.body);
        const actor = request.user!;
        if (actor.id === id) {
          return reply.status(400).send({ error: "Cannot change your own role" });
        }

        const existing = await prisma.user.findUnique({ where: { id } });
        if (!existing) {
          return reply.status(404).send({ error: "User not found" });
        }
        if (existing.role === body.role) {
          return { user: serializeUser(existing) };
        }

        const updated = await prisma.user.update({
          where: { id },
          data: { role: body.role as UserRole },
        });
        await invalidateMeCache(updated.telegramId);
        await writeAdminAudit({
          request,
          actor,
          action: "user.role.set",
          targetType: "user",
          targetId: updated.telegramId,
          meta: {
            targetUserTelegramId: updated.telegramId,
            previousRole: existing.role,
            newRole: updated.role,
          },
        });
        return { user: serializeUser(updated) };
      },
    );

    adminOnly.patch<{ Params: { id: string } }>(
      "/admin/users/:id/fee-level",
      async (request, reply) => {
        const id = parseIdParam(request.params.id);
        if (id == null) {
          return reply.status(400).send({ error: "Invalid user id" });
        }
        const body = z
          .object({
            feeLevel: z.enum(["bronze", "silver", "gold", "platinum", "vip"]),
          })
          .parse(request.body);
        const actor = request.user!;
        if (actor.id === id) {
          return reply.status(400).send({ error: "Cannot modify your own account" });
        }

        const existing = await prisma.user.findUnique({ where: { id } });
        if (!existing) {
          return reply.status(404).send({ error: "User not found" });
        }
        if (existing.feeLevel === body.feeLevel) {
          return { user: serializeUser(existing) };
        }

        const updated = await prisma.user.update({
          where: { id },
          data: { feeLevel: body.feeLevel as FeeLevel },
        });
        await invalidateMeCache(updated.telegramId);
        await writeAdminAudit({
          request,
          actor,
          action: "user.fee_level.set",
          targetType: "user",
          targetId: updated.telegramId,
          meta: {
            targetUserTelegramId: updated.telegramId,
            previousFeeLevel: existing.feeLevel,
            newFeeLevel: updated.feeLevel,
          },
        });
        return { user: serializeUser(updated) };
      },
    );

    adminOnly.get("/admin/invoices", async () => {
      const invoices = await prisma.invoice.findMany({
        orderBy: { createdAt: "desc" },
        take: 200,
        include: {
          user: {
            select: { telegramId: true, fullName: true, username: true },
          },
        },
      });
      return {
        invoices: invoices.map((inv) => ({
          id: String(inv.id),
          code: inv.code,
          userId: String(inv.userId),
          user: inv.user,
          amountToman: inv.amountToman.toString(),
          amountTrx: inv.amountTrx,
          status: inv.status,
          description: inv.description,
          createdAt: inv.createdAt.toISOString(),
        })),
      };
    });

    adminOnly.patch("/admin/invoices/:id", async (request, reply) => {
      const id = parseIdParam((request.params as { id: string }).id);
      if (id == null) {
        return reply.status(400).send({ error: "Invalid invoice id" });
      }
      const body = patchInvoiceSchema.parse(request.body);
      const existing = await prisma.invoice.findUnique({ where: { id } });
      if (!existing) {
        return reply.status(404).send({ error: "Invoice not found" });
      }
      const updated = await prisma.invoice.update({
        where: { id },
        data: { status: body.status },
      });
      return {
        invoice: {
          id: String(updated.id),
          code: updated.code,
          status: updated.status,
          amountToman: updated.amountToman.toString(),
        },
      };
    });

    adminOnly.get("/admin/settings", async () => {
      const settings = await getMergedSettings();
      return { settings };
    });

    adminOnly.put("/admin/settings", async (request, reply) => {
      const parsed = settingsPatchSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "Invalid settings",
          details: parsed.error.flatten(),
        });
      }
      const settings = await mergeAndSaveSettings(parsed.data);
      return { settings };
    });

    const masterWalletBodySchema = z.object({
      asset: z.enum(["trx", "usdt", "bnb", "matic", "gram"]),
      network: z.enum(["tron", "bsc", "polygon", "ton"]),
      privateKey: z.string().min(32).max(200),
      label: z.string().max(64).optional().nullable(),
      isActive: z.boolean().optional(),
    });

    adminOnly.get("/admin/master-wallets", async () => {
      const rows = await prisma.assetMasterWallet.findMany({
        orderBy: [{ asset: "asc" }, { network: "asc" }],
      });

      const wallets = await Promise.all(
        rows.map(async (row) => {
          let onChain: number | null = null;
          try {
            onChain = await getOnChainAssetAmount({
              asset: row.asset,
              network: row.network,
              address: row.address,
            });
          } catch {
            onChain = null;
          }
          return {
            id: row.id,
            asset: row.asset,
            network: row.network,
            address: row.address,
            label: row.label,
            isActive: row.isActive,
            onChainBalance: onChain,
            createdAt: row.createdAt.toISOString(),
            updatedAt: row.updatedAt.toISOString(),
          };
        }),
      );

      return {
        wallets,
        sweepThresholdToman: SWEEP_THRESHOLD_TOMAN,
        catalog: ASSETS.filter((a) => !a.isFiat).map((a) => ({
          asset: a.id,
          networks: a.networks,
          symbol: a.symbol,
        })),
      };
    });

    adminOnly.post("/admin/master-wallets", async (request, reply) => {
      const parsed = masterWalletBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "Validation failed",
          details: parsed.error.flatten(),
        });
      }
      const { asset, network, privateKey, label, isActive } = parsed.data;
      const assetDef = ASSETS.find((a) => a.id === asset);
      if (!assetDef || !assetDef.networks.includes(network)) {
        return reply.status(400).send({
          error: "Asset not supported on this network",
        });
      }
      if (network === "ton") {
        return reply.status(501).send({
          error: "TON master wallet send is not implemented yet",
        });
      }

      let address: string;
      try {
        address = addressFromPrivateKey(network, privateKey);
      } catch (err) {
        return reply.status(400).send({
          error: err instanceof Error ? err.message : "Invalid private key",
        });
      }
      if (!validateAddress(network, address)) {
        return reply.status(400).send({ error: "Derived address is invalid" });
      }

      const row = await prisma.assetMasterWallet.upsert({
        where: { asset_network: { asset, network } },
        create: {
          asset,
          network,
          address,
          privateKeyEnc: encryptPrivateKey(privateKey.trim()),
          label: label?.trim() || null,
          isActive: isActive ?? true,
        },
        update: {
          address,
          privateKeyEnc: encryptPrivateKey(privateKey.trim()),
          label: label?.trim() || null,
          isActive: isActive ?? true,
        },
      });

      return {
        wallet: {
          id: row.id,
          asset: row.asset,
          network: row.network,
          address: row.address,
          label: row.label,
          isActive: row.isActive,
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
        },
      };
    });

    adminOnly.patch("/admin/master-wallets/:id", async (request, reply) => {
      const id = parseIdParam((request.params as { id?: string }).id);
      if (id == null) {
        return reply.status(400).send({ error: "Invalid id" });
      }
      const parsed = z
        .object({
          label: z.string().max(64).optional().nullable(),
          isActive: z.boolean().optional(),
          privateKey: z.string().min(32).max(200).optional(),
        })
        .safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "Validation failed",
          details: parsed.error.flatten(),
        });
      }

      const existing = await prisma.assetMasterWallet.findUnique({
        where: { id },
      });
      if (!existing) {
        return reply.status(404).send({ error: "Not found" });
      }

      let address = existing.address;
      let privateKeyEnc = existing.privateKeyEnc;
      if (parsed.data.privateKey) {
        try {
          address = addressFromPrivateKey(
            existing.network,
            parsed.data.privateKey,
          );
          privateKeyEnc = encryptPrivateKey(parsed.data.privateKey.trim());
        } catch (err) {
          return reply.status(400).send({
            error: err instanceof Error ? err.message : "Invalid private key",
          });
        }
      }

      const row = await prisma.assetMasterWallet.update({
        where: { id },
        data: {
          address,
          privateKeyEnc,
          label:
            parsed.data.label !== undefined
              ? parsed.data.label?.trim() || null
              : undefined,
          isActive: parsed.data.isActive,
        },
      });

      return {
        wallet: {
          id: row.id,
          asset: row.asset,
          network: row.network,
          address: row.address,
          label: row.label,
          isActive: row.isActive,
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
        },
      };
    });

    adminOnly.delete("/admin/master-wallets/:id", async (request, reply) => {
      const id = parseIdParam((request.params as { id?: string }).id);
      if (id == null) {
        return reply.status(400).send({ error: "Invalid id" });
      }
      try {
        await prisma.assetMasterWallet.delete({ where: { id } });
        return { ok: true };
      } catch {
        return reply.status(404).send({ error: "Not found" });
      }
    });

    /** System channels / community group (membership lock slots). */
    adminOnly.get("/admin/system-channels/bot", async () => {
      const bot = await getAdminSystemChannelsBotInfo();
      return { ok: true, ...bot };
    });

    adminOnly.get("/admin/system-channels", async () => {
      const data = await listAdminSystemChannels();
      return { ok: true, ...data };
    });

    adminOnly.post("/admin/system-channels/:slot/register", async (request, reply) => {
      const slot = String((request.params as { slot?: string }).slot || "");
      const body = z.object({ link: z.string().trim().min(3).max(512) }).parse(request.body);
      try {
        const result = await registerAdminSystemChannel(request.user!, slot, body.link);
        return { ok: true, ...result };
      } catch (err) {
        if (err instanceof AdminSystemChannelError) {
          return reply.status(err.status).send({ error: err.message, code: err.code });
        }
        throw err;
      }
    });

    adminOnly.post("/admin/system-channels/:slot/active", async (request, reply) => {
      const slot = String((request.params as { slot?: string }).slot || "");
      const body = z.object({ isActive: z.boolean() }).parse(request.body);
      try {
        const result = await setAdminSystemChannelActive(slot, body.isActive);
        return { ok: true, ...result };
      } catch (err) {
        if (err instanceof AdminSystemChannelError) {
          return reply.status(err.status).send({ error: err.message, code: err.code });
        }
        throw err;
      }
    });

    adminOnly.delete("/admin/system-channels/:slot", async (request, reply) => {
      const slot = String((request.params as { slot?: string }).slot || "");
      try {
        await deleteAdminSystemChannel(slot);
        return { ok: true };
      } catch (err) {
        if (err instanceof AdminSystemChannelError) {
          return reply.status(err.status).send({ error: err.message, code: err.code });
        }
        throw err;
      }
    });
  });
}
