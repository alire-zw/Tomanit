import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { parseIdParam } from "../lib/ids.js";
import { invalidateMeCache, readMeCache } from "../lib/meCache.js";
import { getPublicContactSettings } from "../lib/seed.js";
import { assertImageData, ticketCodeFromId } from "../lib/ticketCode.js";
import { loadUserTickets } from "../lib/userBundle.js";
import { supportWriteLimiter } from "../lib/rateLimit.js";
import { enforceRateLimit } from "../lib/httpRateLimit.js";

const imageDataSchema = z.string().max(900_000).optional();

const createTicketSchema = z
  .object({
    subject: z.string().min(3).max(200),
    body: z.string().max(5000).optional().default(""),
    imageData: imageDataSchema,
  })
  .superRefine((value, ctx) => {
    if (!value.body.trim() && !value.imageData) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "متن یا تصویر الزامی است",
        path: ["body"],
      });
    }
  });

const messageBodySchema = z
  .object({
    body: z.string().max(5000).optional().default(""),
    imageData: imageDataSchema,
  })
  .superRefine((value, ctx) => {
    if (!value.body.trim() && !value.imageData) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "متن یا تصویر الزامی است",
        path: ["body"],
      });
    }
  });

function serializeMessage(m: {
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

export async function supportRoutes(app: FastifyInstance): Promise<void> {
  app.get("/support/contact", async () => {
    return getPublicContactSettings();
  });

  app.register(async (scoped) => {
    scoped.addHook("preHandler", requireAuth);
    scoped.addHook("preHandler", async (request, reply) => {
      if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) {
        await enforceRateLimit(supportWriteLimiter)(request, reply);
      }
    });

    scoped.get("/support/tickets", async (request) => {
      const user = request.user!;
      const cached = await readMeCache(user.telegramId);
      if (cached) {
        return { tickets: cached.tickets, cached: true, cachedAt: cached.cachedAt };
      }

      const { closeDueKycTickets } = await import("../lib/ticketAutoClose.js");
      await closeDueKycTickets();
      const tickets = await loadUserTickets(user.id);
      return { tickets, cached: false };
    });

    scoped.post("/support/tickets", async (request, reply) => {
      const body = createTicketSchema.parse(request.body);
      let imageData: string | null = null;
      try {
        imageData = assertImageData(body.imageData);
      } catch (err) {
        const message = err instanceof Error ? err.message : "تصویر نامعتبر است";
        return reply.status(400).send({ error: message });
      }

      const text = body.body.trim();
      const messageBody = text || (imageData ? "📷 تصویر" : "");

      const ticket = await prisma.$transaction(async (tx) => {
        const created = await tx.supportTicket.create({
          data: {
            code: `TMP-${Date.now()}`,
            userId: request.user!.id,
            subject: body.subject,
            messages: {
              create: {
                sender: "user",
                body: messageBody,
                imageData,
              },
            },
          },
        });
        return tx.supportTicket.update({
          where: { id: created.id },
          data: { code: ticketCodeFromId(created.id) },
          include: { messages: true },
        });
      });

      await invalidateMeCache(request.user!.telegramId);

      return reply.status(201).send({
        ticket: {
          id: String(ticket.id),
          code: ticket.code,
          subject: ticket.subject,
          status: ticket.status,
          createdAt: ticket.createdAt.toISOString(),
        },
      });
    });

    scoped.get("/support/tickets/:id", async (request, reply) => {
      const id = parseIdParam((request.params as { id: string }).id);
      if (id == null) {
        return reply.status(400).send({ error: "Invalid ticket id" });
      }
      const ticket = await prisma.supportTicket.findFirst({
        where: { id, userId: request.user!.id },
        include: {
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
          createdAt: ticket.createdAt.toISOString(),
          updatedAt: ticket.updatedAt.toISOString(),
          messages: ticket.messages.map(serializeMessage),
        },
      };
    });

    scoped.post("/support/tickets/:id/messages", async (request, reply) => {
      const id = parseIdParam((request.params as { id: string }).id);
      if (id == null) {
        return reply.status(400).send({ error: "Invalid ticket id" });
      }
      const body = messageBodySchema.parse(request.body);
      let imageData: string | null = null;
      try {
        imageData = assertImageData(body.imageData);
      } catch (err) {
        const message = err instanceof Error ? err.message : "تصویر نامعتبر است";
        return reply.status(400).send({ error: message });
      }

      const ticket = await prisma.supportTicket.findFirst({
        where: { id, userId: request.user!.id },
      });
      if (!ticket) {
        return reply.status(404).send({ error: "Ticket not found" });
      }
      if (ticket.status === "closed") {
        return reply.status(400).send({ error: "Ticket is closed" });
      }

      const text = body.body.trim();
      const messageBody = text || (imageData ? "📷 تصویر" : "");

      const message = await prisma.supportMessage.create({
        data: {
          ticketId: ticket.id,
          sender: "user",
          body: messageBody,
          imageData,
        },
      });
      await prisma.supportTicket.update({
        where: { id: ticket.id },
        data: { status: "open", updatedAt: new Date() },
      });
      await invalidateMeCache(request.user!.telegramId);
      return reply.status(201).send({
        message: serializeMessage(message),
      });
    });
  });
}
