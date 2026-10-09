import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { buildAndCacheMeBundle } from "../lib/userBundle.js";
import { resolveBankMeta } from "../lib/bankMeta.js";
import { JibitError, jibitCardToIban, jibitMatchCardIdentity } from "../lib/jibit.js";
import {
  normalizeCardNumber,
  normalizeNationalId,
  shamsiYyyymmddToDate,
  toShamsiYyyymmdd,
} from "../lib/jalali.js";
import { ticketCodeFromId } from "../lib/ticketCode.js";
import {
  KYC_SUCCESS_MESSAGE,
  KYC_SUCCESS_SUBJECT,
} from "../lib/ticketAutoClose.js";
import { log } from "../lib/log.js";
import { kycLimiter } from "../lib/rateLimit.js";
import { enforceRateLimit } from "../lib/httpRateLimit.js";

const verifySchema = z.object({
  nationalId: z.string().min(10).max(12),
  birthDate: z.string().min(8).max(12),
  cardNumber: z.string().min(16).max(24),
});

export async function kycRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/kyc/verify",
    { preHandler: [enforceRateLimit(kycLimiter), requireAuth] },
    async (request, reply) => {
      const body = verifySchema.parse(request.body);
      const nationalId = normalizeNationalId(body.nationalId);
      const cardNumber = normalizeCardNumber(body.cardNumber);
      const birthYmd = toShamsiYyyymmdd(body.birthDate);

      if (!/^\d{10}$/.test(nationalId)) {
        return reply.status(400).send({ error: "کد ملی نامعتبر است" });
      }
      if (!/^\d{16}$/.test(cardNumber)) {
        return reply.status(400).send({ error: "شماره کارت نامعتبر است" });
      }
      if (!birthYmd) {
        return reply.status(400).send({ error: "تاریخ تولد نامعتبر است" });
      }

      const birthDate = shamsiYyyymmddToDate(birthYmd);
      if (!birthDate) {
        return reply.status(400).send({ error: "تاریخ تولد نامعتبر است" });
      }

      const user = request.user!;
      if (user.kycLevel !== "none" && user.kycVerifiedAt) {
        return reply.status(400).send({ error: "احراز هویت شما قبلاً انجام شده است" });
      }

      const taken = await prisma.user.findFirst({
        where: {
          nationalId,
          NOT: { id: user.id },
        },
        select: { id: true },
      });
      if (taken) {
        return reply.status(409).send({ error: "این کد ملی قبلاً ثبت شده است" });
      }

      try {
        const match = await jibitMatchCardIdentity({
          cardNumber,
          nationalCode: nationalId,
          birthDateYyyymmdd: birthYmd,
        });
        if (!match.matched) {
          return reply.status(400).send({
            error: "اطلاعات کارت با کد ملی و تاریخ تولد مطابقت ندارد",
          });
        }

        const ibanInfo = await jibitCardToIban(cardNumber);
        const now = new Date();
        const { bankName, bankSlug } = resolveBankMeta(ibanInfo.bank);
        const ownerName = ibanInfo.ownerName?.trim() || null;

        const updated = await prisma.$transaction(async (tx) => {
          const nextUser = await tx.user.update({
            where: { id: user.id },
            data: {
              nationalId,
              birthDate,
              termsAcceptedAt: user.termsAcceptedAt ?? now,
              kycLevel: "basic",
              kycVerifiedAt: now,
              ...(ownerName ? { fullName: ownerName } : {}),
            },
          });

          await tx.bankCard.updateMany({
            where: { userId: user.id, isPrimary: true },
            data: { isPrimary: false },
          });

          await tx.bankCard.upsert({
            where: {
              userId_cardNumber: { userId: user.id, cardNumber },
            },
            create: {
              userId: user.id,
              cardNumber,
              iban: ibanInfo.iban,
              depositNumber: ibanInfo.depositNumber,
              bankName,
              bankSlug,
              bankBin: cardNumber.slice(0, 6),
              ownerName: ownerName,
              isPrimary: true,
              isVerified: true,
              matchedAt: now,
            },
            update: {
              iban: ibanInfo.iban,
              depositNumber: ibanInfo.depositNumber,
              bankName,
              bankSlug,
              bankBin: cardNumber.slice(0, 6),
              ownerName: ownerName,
              isPrimary: true,
              isVerified: true,
              matchedAt: now,
            },
          });

          const autoCloseAt = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
          const createdTicket = await tx.supportTicket.create({
            data: {
              code: `TMP-${Date.now()}`,
              userId: user.id,
              subject: KYC_SUCCESS_SUBJECT,
              status: "answered",
              autoCloseAt,
              messages: {
                create: {
                  sender: "admin",
                  body: KYC_SUCCESS_MESSAGE,
                },
              },
            },
          });
          const ticket = await tx.supportTicket.update({
            where: { id: createdTicket.id },
            data: { code: ticketCodeFromId(createdTicket.id) },
          });

          return { nextUser, ticket };
        });

        const payload = await buildAndCacheMeBundle(updated.nextUser);

        log.event(
          "kyc",
          `verified user:${user.id} level:basic card:**${cardNumber.slice(-4)}`,
        );

        return {
          ok: true,
          user: payload.user,
          wallet: payload.wallet,
          tickets: payload.tickets,
          shop: payload.shop,
          card: {
            last4: cardNumber.slice(-4),
            iban: ibanInfo.iban,
            bankName,
            ownerName: ibanInfo.ownerName,
          },
          ticket: {
            id: String(updated.ticket.id),
            code: updated.ticket.code,
          },
        };
      } catch (err) {
        if (err instanceof JibitError) {
          log.warn("kyc", `${err.code}: ${err.message}`);
          return reply.status(err.status >= 400 && err.status < 600 ? err.status : 502).send({
            error: err.message,
            code: err.code,
          });
        }
        throw err;
      }
    },
  );
}
