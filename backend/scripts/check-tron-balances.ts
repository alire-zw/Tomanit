import { PrismaClient } from "@prisma/client";
import { getTronOnChainBalance, pingTronGrid } from "../src/lib/tronGrid.ts";

const prisma = new PrismaClient();

async function main() {
  const ping = await pingTronGrid();
  console.log("ping:", ping);

  const addrs = await prisma.walletDepositAddress.findMany({
    where: { network: "tron" },
    include: { user: { select: { telegramId: true, username: true } } },
  });

  for (const row of addrs) {
    try {
      const bal = await getTronOnChainBalance(row.address);
      console.log(
        JSON.stringify({
          user: row.user.username ?? row.user.telegramId,
          address: row.address,
          trx: bal.trx,
          usdt: bal.usdt,
          createTime: bal.createTime,
        }),
      );
    } catch (err) {
      console.error(
        row.address,
        err instanceof Error ? err.message : err,
      );
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
