/**
 * Promote a user to admin role.
 *
 * Usage (from backend/):
 *   npx tsx scripts/make-admin.ts
 *   npx tsx scripts/make-admin.ts 1
 *   npx tsx scripts/make-admin.ts --telegram-id=123456789
 */
import { prisma } from "../src/db/prisma.js";

async function main() {
  const args = process.argv.slice(2);
  const tgArg = args.find((a) => a.startsWith("--telegram-id="));
  const telegramId = tgArg?.slice("--telegram-id=".length)?.trim() || null;
  const idArg = args.find((a) => /^\d+$/.test(a));
  const userId = idArg ? Number(idArg) : 1;

  const before = telegramId
    ? await prisma.user.findUnique({
        where: { telegramId },
        select: {
          id: true,
          telegramId: true,
          username: true,
          firstName: true,
          role: true,
        },
      })
    : await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          telegramId: true,
          username: true,
          firstName: true,
          role: true,
        },
      });

  if (!before) {
    console.error(
      telegramId
        ? `User with telegramId=${telegramId} not found`
        : `User id=${userId} not found`,
    );
    process.exit(1);
  }

  console.log("before:", before);

  const after = await prisma.user.update({
    where: { id: before.id },
    data: { role: "admin" },
    select: {
      id: true,
      telegramId: true,
      username: true,
      firstName: true,
      role: true,
    },
  });

  console.log("after:", after);
  console.log(`OK — user #${after.id} is now admin`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
