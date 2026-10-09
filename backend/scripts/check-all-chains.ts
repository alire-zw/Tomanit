import { PrismaClient } from "@prisma/client";
import { getEvmOnChainBalance, pingEvm } from "../src/lib/evmRpc.ts";
import { getTonOnChainBalance, pingTonCenter } from "../src/lib/tonCenter.ts";
import { pingTronGrid } from "../src/lib/tronGrid.ts";

const prisma = new PrismaClient();

async function main() {
  console.log("pings:", {
    tron: await pingTronGrid(),
    bsc: await pingEvm("bsc"),
    polygon: await pingEvm("polygon"),
    ton: await pingTonCenter(),
  });

  const rows = await prisma.walletDepositAddress.findMany({
    include: { user: { select: { username: true, telegramId: true } } },
    orderBy: { id: "asc" },
  });

  for (const row of rows) {
    const who = row.user.username ?? row.user.telegramId;
    try {
      if (row.network === "bsc" || row.network === "polygon") {
        const bal = await getEvmOnChainBalance(row.network, row.address);
        console.log(JSON.stringify({ who, ...bal }));
      } else if (row.network === "ton") {
        const bal = await getTonOnChainBalance(row.address);
        console.log(JSON.stringify({ who, ...bal }));
      } else if (row.network === "tron") {
        console.log(JSON.stringify({ who, network: "tron", address: row.address, skip: "checked earlier" }));
      }
    } catch (err) {
      console.error(
        JSON.stringify({
          who,
          network: row.network,
          address: row.address,
          error: err instanceof Error ? err.message : String(err),
        }),
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
