import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import {
  checkChannelLockMembership,
  getChannelLockStatus,
  isChannelLockSlot,
} from "../lib/systemChannels.js";

export async function channelLockRoutes(app: FastifyInstance): Promise<void> {
  await app.register(async (scoped) => {
    scoped.addHook("preHandler", requireAuth);

    scoped.get("/channel-lock/status", async (request) => {
      const status = await getChannelLockStatus(request.user!);
      return { ok: true, ...status };
    });

    /** Live membership check (panelout-compatible GET). */
    scoped.get("/channel-lock/check/:slot", async (request, reply) => {
      const slot = decodeURIComponent(
        String((request.params as { slot?: string }).slot || ""),
      );
      if (!isChannelLockSlot(slot)) {
        return reply.status(404).send({ error: "کانال پیدا نشد یا غیرفعال است" });
      }
      const channel = await checkChannelLockMembership(request.user!, slot);
      if (!channel) {
        return reply.status(404).send({ error: "کانال پیدا نشد یا غیرفعال است" });
      }
      return { ok: true, channel };
    });

    scoped.post("/channel-lock/check", async (request, reply) => {
      const body = z
        .object({ slotKey: z.string().trim().min(1).max(64) })
        .parse(request.body);
      if (!isChannelLockSlot(body.slotKey)) {
        return reply.status(400).send({ error: "Invalid slot" });
      }
      const channel = await checkChannelLockMembership(request.user!, body.slotKey);
      if (!channel) {
        return reply.status(404).send({ error: "Not found" });
      }
      return { ok: true, channel };
    });
  });
}
