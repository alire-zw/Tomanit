import { PrismaClient } from "@prisma/client";
import {
  encryptPrivateKey,
  generateNetworkWallet,
} from "../src/lib/walletCrypto.ts";
import { getTonOnChainBalance } from "../src/lib/tonCenter.ts";

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.walletDepositAddress.findMany({
    where: { network: "ton" },
  });

  for (const row of rows) {
    const generated = generateNetworkWallet("ton");
    await prisma.walletDepositAddress.update({
      where: { id: row.id },
      data: {
        address: generated.address,
        privateKeyEnc: encryptPrivateKey(generated.privateKey),
      },
    });
    const bal = await getTonOnChainBalance(generated.address);
    console.log(
      JSON.stringify({
        userId: row.userId,
        old: row.address,
        address: generated.address,
        ton: bal.ton,
      }),
    );
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
