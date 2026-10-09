/**
 * Backfill User.fullName (real_name) from BankCard.ownerName.
 *
 * Prefers primary card with a name; otherwise the newest card that has ownerName.
 *
 * Usage: npx tsx scripts/sync-user-names-from-cards.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function clipFullName(name: string): string {
  const trimmed = name.trim();
  return trimmed.length > 128 ? trimmed.slice(0, 128) : trimmed;
}

function normalizePersonName(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .normalize("NFKC")
    .replace(/[\u200c\u200d\u200e\u200f\u202a-\u202e\u2066-\u2069\u00a0\u2000-\u200b\ufeff\u00ad]/g, "")
    .replace(/ي|ى|ۍ|ې/g, "ی")
    .replace(/ك|ګ/g, "ک")
    .replace(/أ|إ|آ|ٱ/g, "ا")
    .replace(/ة|ۀ/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ی")
    .replace(/\s+/g, "")
    .toLowerCase();
}

function namesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = normalizePersonName(a);
  const right = normalizePersonName(b);
  return Boolean(left && right && left === right);
}

async function main() {
  const users = await prisma.user.findMany({
    where: {
      bankCards: { some: { ownerName: { not: null } } },
    },
    select: {
      id: true,
      telegramId: true,
      fullName: true,
      bankCards: {
        where: { ownerName: { not: null } },
        orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
        select: { ownerName: true, isPrimary: true, cardNumber: true },
      },
    },
  });

  let updated = 0;
  let skipped = 0;
  let missing = 0;

  for (const user of users) {
    const card =
      user.bankCards.find((c) => c.isPrimary && c.ownerName?.trim()) ||
      user.bankCards.find((c) => c.ownerName?.trim()) ||
      null;
    const ownerName = card?.ownerName?.trim() || null;
    if (!ownerName) {
      missing += 1;
      continue;
    }

    const next = clipFullName(ownerName);
    if (namesMatch(user.fullName, next)) {
      skipped += 1;
      continue;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { fullName: next },
    });
    updated += 1;
    console.log(
      `user:${user.id} tg:${user.telegramId} card:**${String(card?.cardNumber || "").slice(-4)} ` +
        `"${user.fullName ?? ""}" → "${next}"`,
    );
  }

  console.log(
    JSON.stringify(
      { candidates: users.length, updated, skipped, missing },
      null,
      2,
    ),
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
