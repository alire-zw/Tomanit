import { writeFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const walletCount = await prisma.wallet.count();
  const addressCount = await prisma.walletDepositAddress.count();
  const wallets = await prisma.wallet.findMany({
    take: 20,
    include: { user: { select: { telegramId: true, username: true } } },
  });
  const addresses = await prisma.walletDepositAddress.findMany({
    take: 100,
    orderBy: { id: "asc" },
  });

  const payload = {
    walletCount,
    addressCount,
    wallets: wallets.map((w) => ({
      userId: w.userId,
      telegramId: w.user.telegramId,
      username: w.user.username,
      toman: w.tomanBalance.toString(),
      trx: w.trxBalance,
      usdt: w.usdtBalance,
      bnb: w.bnbBalance,
      matic: w.maticBalance,
      gram: w.gramBalance,
    })),
    addresses: addresses.map((a) => ({
      id: a.id,
      userId: a.userId,
      network: a.network,
      address: a.address,
      hasEncryptedKey: Boolean(a.privateKeyEnc),
      createdAt: a.createdAt.toISOString(),
    })),
  };

  writeFileSync("wallet-inspect.json", JSON.stringify(payload, null, 2), "utf8");
  console.log(`wallets=${walletCount} addresses=${addressCount}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
