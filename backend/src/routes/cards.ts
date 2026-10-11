import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { requireAuthUpsert } from "../middleware/auth.js";
import { resolveBankMeta } from "../lib/bankMeta.js";
import { normalizeCardNumber } from "../lib/jalali.js";
import { JibitError, jibitCardToIban } from "../lib/jibit.js";
import { log } from "../lib/log.js";
import { maskCardNumber } from "../lib/walletService.js";
import { cardsLimiter } from "../lib/rateLimit.js";
import { enforceRateLimit } from "../lib/httpRateLimit.js";
import { invalidateMeCacheByUserId } from "../lib/meCache.js";

/** `User.fullName` is VarChar(128); card owner names can be longer. */
function clipFullName(name: string): string {
  const trimmed = name.trim();
  return trimmed.length > 128 ? trimmed.slice(0, 128) : trimmed;
}

/** Invoice amounts at/under this skip KYC name-match when adding a card. */
const RELAXED_CARD_VERIFY_MAX_TOMAN = 500_000;

const addSchema = z.object({
  cardNumber: z.string().min(16).max(24),
  bankName: z.string().trim().min(1).max(128).optional(),
  bankSlug: z.string().trim().min(1).max(64).optional(),
  bankBin: z
    .string()
    .trim()
    .regex(/^\d{6,8}$/)
    .optional(),
  /** Merchant invoice amount — ≤500k skips name-match / KYC reference gate. */
  invoiceAmountToman: z.coerce.number().int().positive().max(500_000_000).optional(),
});

/**
 * Normalize Persian/Arabic person names for cross-bank equality checks.
 * Banks differ on spacing (سید علیرضا vs سیدعلیرضا), ZWNJ, and Arabic/Persian letters.
 */
export function normalizePersonName(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .normalize("NFKC")
    // ZWNJ/ZWJ, LTR/RTL marks, NBSP, thin/narrow spaces, BOM, soft hyphen
    .replace(/[\u200c\u200d\u200e\u200f\u202a-\u202e\u2066-\u2069\u00a0\u2000-\u200b\ufeff\u00ad]/g, "")
    .replace(/ي|ى|ۍ|ې/g, "ی")
    .replace(/ك|ګ/g, "ک")
    .replace(/أ|إ|آ|ٱ/g, "ا")
    .replace(/ة|ۀ/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ی")
    // Collapse ALL remaining whitespace — banks disagree on سید vs سید + space
    .replace(/\s+/g, "")
    .toLowerCase();
}

function namesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = normalizePersonName(a);
  const right = normalizePersonName(b);
  return Boolean(left && right && left === right);
}

function serializeBankCard(card: {
  id: number;
  cardNumber: string;
  iban: string | null;
  depositNumber: string | null;
  bankName: string | null;
  bankSlug: string | null;
  bankBin: string | null;
  ownerName: string | null;
  isPrimary: boolean;
  isVerified: boolean;
  matchedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: card.id,
    // Never expose full PAN to clients — gateway charge uses cardId server-side.
    cardNumber: maskCardNumber(card.cardNumber),
    last4: card.cardNumber.replace(/\D/g, "").slice(-4),
    iban: card.iban,
    depositNumber: card.depositNumber,
    bankName: card.bankName,
    bankSlug: card.bankSlug,
    bankBin: card.bankBin,
    ownerName: card.ownerName,
    isPrimary: card.isPrimary,
    isVerified: card.isVerified,
    matchedAt: card.matchedAt?.toISOString() ?? null,
    createdAt: card.createdAt.toISOString(),
    updatedAt: card.updatedAt.toISOString(),
  };
}

export async function cardRoutes(app: FastifyInstance): Promise<void> {
  // Upsert so first-time Mini App openers (e.g. invoice link) get a user row.
  app.get("/cards", { preHandler: requireAuthUpsert }, async (request) => {
    const cards = await prisma.bankCard.findMany({
      where: { userId: request.user!.id, revokedAt: null },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
    });
    return { cards: cards.map(serializeBankCard) };
  });

  app.post(
    "/cards",
    { preHandler: [enforceRateLimit(cardsLimiter), requireAuthUpsert] },
    async (request, reply) => {
    const body = addSchema.parse(request.body);
    const cardNumber = normalizeCardNumber(body.cardNumber);
    if (!/^\d{16}$/.test(cardNumber)) {
      return reply.status(400).send({ error: "شماره کارت باید ۱۶ رقم باشد" });
    }

    const user = request.user!;
    const relaxedVerify =
      typeof body.invoiceAmountToman === "number" &&
      body.invoiceAmountToman > 0 &&
      body.invoiceAmountToman <= RELAXED_CARD_VERIFY_MAX_TOMAN;

    const existingForUser = await prisma.bankCard.findFirst({
      where: {
        userId: user.id,
        cardNumber,
        revokedAt: null,
      },
      select: { id: true },
    });
    if (existingForUser) {
      return reply.status(409).send({
        error: "این کارت قبلاً ثبت شده است",
        code: "CARD_ALREADY_ADDED",
      });
    }

    const ownedByOther = await prisma.bankCard.findFirst({
      where: {
        cardNumber,
        userId: { not: user.id },
        revokedAt: null,
      },
      select: { id: true },
    });
    if (ownedByOther) {
      return reply.status(409).send({
        error:
          "این کارت متعلق به حساب کاربری دیگری است و ثبت نمی‌شود. لطفاً از طریق همان حساب اقدام به پرداخت بفرمایید",
        code: "CARD_OWNED_BY_OTHER",
      });
    }

    const previousCards = await prisma.bankCard.findMany({
      where: { userId: user.id, revokedAt: null },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
      select: { ownerName: true },
    });
    const referenceName =
      previousCards.find((card) => card.ownerName?.trim())?.ownerName?.trim() ||
      user.fullName?.trim() ||
      null;

    if (!relaxedVerify && !referenceName) {
      return reply.status(400).send({
        error: "ابتدا احراز هویت را کامل کنید تا کارت مرجع ثبت شود",
        code: "KYC_REFERENCE_REQUIRED",
      });
    }

    try {
      // Card → IBAN inquiry (شبا + نام صاحب کارت)
      const ibanInfo = await jibitCardToIban(cardNumber);
      const ownerName = ibanInfo.ownerName?.trim() || null;
      const iban = ibanInfo.iban?.trim() || null;

      if (!iban) {
        return reply.status(502).send({
          error: "دریافت شبا ناموفق بود",
          code: "IBAN_MISSING",
        });
      }

      if (!ownerName) {
        return reply.status(400).send({
          error: "نام صاحب کارت از سرویس دریافت نشد",
          code: "OWNER_NAME_MISSING",
        });
      }

      // Full KYC path: name must match reference. Relaxed (≤500k invoice): skip match.
      if (!relaxedVerify && referenceName && !namesMatch(ownerName, referenceName)) {
        return reply.status(400).send({
          error: "نام صاحب این کارت با کارت قبلی شما مطابقت ندارد",
          code: "OWNER_NAME_MISMATCH",
        });
      }

      const { bankName: jibitBankName, bankSlug: jibitBankSlug } = resolveBankMeta(
        ibanInfo.bank,
      );
      const now = new Date();
      const bankName = body.bankName?.trim() || jibitBankName;
      const bankSlug = body.bankSlug?.trim() || jibitBankSlug;
      const bankBin = body.bankBin?.trim() || cardNumber.slice(0, 6);

      const hasPrimary = previousCards.length > 0
        ? await prisma.bankCard.findFirst({
            where: { userId: user.id, isPrimary: true, revokedAt: null },
            select: { id: true },
          })
        : null;

      const card = await prisma.bankCard.create({
        data: {
          userId: user.id,
          cardNumber,
          iban,
          depositNumber: ibanInfo.depositNumber,
          bankName,
          bankSlug,
          bankBin,
          ownerName,
          isPrimary: !hasPrimary,
          isVerified: true,
          matchedAt: now,
        },
      });

      // Keep profile real name aligned with verified card owner (invoice / wallet add).
      const nextFullName = clipFullName(ownerName);
      if (!namesMatch(user.fullName, nextFullName)) {
        await prisma.user.update({
          where: { id: user.id },
          data: { fullName: nextFullName },
        });
        void invalidateMeCacheByUserId(user.id);
      }

      log.event(
        "cards",
        `added user:${user.id} card:**${cardNumber.slice(-4)} via:card-to-iban${
          relaxedVerify ? " relaxed:invoice<=500k" : ""
        } name:${nextFullName}`,
      );

      return reply.status(201).send({ card: serializeBankCard(card), addedAt: now.toISOString() });
    } catch (err) {
      if (err instanceof JibitError) {
        log.warn("cards", `${err.code}: ${err.message}`);
        return reply
          .status(err.status >= 400 && err.status < 600 ? err.status : 502)
          .send({ error: err.message, code: err.code });
      }
      throw err;
    }
  });
}
