import { prisma } from "../src/db/prisma.js";
import { notifyShopReportTransaction } from "../src/lib/shopReportBot.js";

async function main() {
  const charge = await prisma.gatewayCharge.findFirst({
    where: { kind: "merchant_invoice", status: "completed" },
    orderBy: { id: "desc" },
    select: {
      id: true,
      code: true,
      trackId: true,
      amountToman: true,
      merchantPaymentLink: {
        select: {
          code: true,
          shop: {
            select: {
              id: true,
              name: true,
              reportBotEnabled: true,
              reportBotChatId: true,
            },
          },
        },
      },
    },
  });

  if (!charge) {
    console.error("No completed merchant_invoice found");
    process.exit(1);
  }

  const shop = charge.merchantPaymentLink?.shop;
  console.log("charge:", {
    id: charge.id,
    code: charge.code,
    trackId: charge.trackId,
    invoice: charge.merchantPaymentLink?.code,
    shop: shop?.name,
    reportBotEnabled: shop?.reportBotEnabled,
    reportBotChatId: shop?.reportBotChatId,
  });

  if (!shop?.reportBotChatId) {
    console.error("Shop has no reportBotChatId — cannot send");
    process.exit(1);
  }

  if (!shop.reportBotEnabled) {
    console.log("report bot was off — enabling temporarily for resend…");
    await prisma.merchantShop.update({
      where: { id: shop.id },
      data: { reportBotEnabled: true },
    });
  }

  await notifyShopReportTransaction(charge.id);
  console.log("sent ok");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
