import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { readMeCache } from "../lib/meCache.js";
import { buildAndCacheMeBundle } from "../lib/userBundle.js";
import { requireAuth, requireAuthUpsert } from "../middleware/auth.js";
import { authLimiter } from "../lib/rateLimit.js";
import { enforceRateLimit } from "../lib/httpRateLimit.js";

const patchMeSchema = z
  .object({
    email: z.string().email().optional(),
    phone: z.string().min(5).max(20).optional(),
    fullName: z.string().min(1).max(200).optional(),
    languageCode: z.enum(["fa", "ar", "en", "zh", "ru", "de"]).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: "At least one field required",
  });

export async function meRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/me",
    { preHandler: [enforceRateLimit(authLimiter), requireAuthUpsert] },
    async (request) => {
      const user = request.user!;
      const telegramId = user.telegramId;

      const cached = await readMeCache(telegramId);
      if (cached) {
        return {
          ok: true,
          user: cached.user,
          wallet: cached.wallet,
          tickets: cached.tickets,
          shop: cached.shop,
          cached: true,
          cachedAt: cached.cachedAt,
        };
      }

      const payload = await buildAndCacheMeBundle(user);

      return {
        ...payload,
        cached: false,
      };
    },
  );

  app.patch(
    "/me",
    { preHandler: [enforceRateLimit(authLimiter), requireAuth] },
    async (request) => {
      const body = patchMeSchema.parse(request.body);
      const updated = await prisma.user.update({
        where: { id: request.user!.id },
        data: body,
      });

      const payload = await buildAndCacheMeBundle(updated);

      return {
        ok: true,
        user: payload.user,
        wallet: payload.wallet,
        tickets: payload.tickets,
        shop: payload.shop,
      };
    },
  );
}
