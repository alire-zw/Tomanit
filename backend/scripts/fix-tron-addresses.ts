import { PrismaClient } from "@prisma/client";
import {
  decryptPrivateKey,
  ethPrivateKeyToTronAddress,
  generateNetworkWallet,
  encryptPrivateKey,
} from "../src/lib/walletCrypto.ts";

const prisma = new PrismaClient();

async function main() {
  const broken = await prisma.walletDepositAddress.findMany({
    where: { network: "tron" },
  });

  for (const row of broken) {
    let address: string;
    let privateKeyEnc = row.privateKeyEnc;

    if (row.privateKeyEnc && row.address === "undefined") {
      try {
        const pk = decryptPrivateKey(row.privateKeyEnc);
        address = ethPrivateKeyToTronAddress(pk);
      } catch {
        const generated = generateNetworkWallet("tron");
        address = generated.address;
        privateKeyEnc = encryptPrivateKey(generated.privateKey);
      }
    } else if (row.address === "undefined" || !row.address.startsWith("T")) {
      const generated = generateNetworkWallet("tron");
      address = generated.address;
      privateKeyEnc = encryptPrivateKey(generated.privateKey);
    } else {
      continue;
    }

    await prisma.walletDepositAddress.update({
      where: { id: row.id },
      data: { address, privateKeyEnc },
    });
    console.log(`fixed user=${row.userId} -> ${address}`);
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
