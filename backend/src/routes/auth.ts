import type { FastifyInstance } from "fastify";
import { prisma } from "../db/prisma.js";
import {
  requireAuthUpsert,
  serializeUser,
  serializeWallet,
} from "../middleware/auth.js";
import { authLimiter } from "../lib/rateLimit.js";
import { enforceRateLimit } from "../lib/httpRateLimit.js";

/**
 * Auth / session routes.
 * Mini App: GET /auth/me with Authorization: tma <initData>
 */
export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/auth/me",
    { preHandler: [enforceRateLimit(authLimiter), requireAuthUpsert] },
    async (request) => {
      const user = request.user!;
      const wallet =
        (await prisma.wallet.findUnique({ where: { userId: user.id } })) ??
        (await prisma.wallet.create({ data: { userId: user.id } }));

      return {
        ok: true,
        user: serializeUser(user),
        wallet: serializeWallet(wallet),
      };
    },
  );
}
