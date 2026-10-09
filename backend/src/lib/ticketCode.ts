import { prisma } from "../db/prisma.js";
import { log } from "./log.js";

/** Official ticket id format: T-100001, T-100002, … */
export function ticketCodeFromId(id: number): string {
  return `T-${100_000 + id}`;
}

const IMAGE_RE = /^data:image\/(jpeg|jpg|png|webp|gif);base64,/i;

export function assertImageData(imageData: unknown): string | null {
  if (imageData == null || imageData === "") return null;
  if (
    typeof imageData !== "string" ||
    imageData.length > 900_000 ||
    !IMAGE_RE.test(imageData)
  ) {
    throw Object.assign(new Error("تصویر نامعتبر است"), { statusCode: 400 });
  }
  return imageData;
}

/** Rewrite any legacy ticket codes to T-10000N. */
export async function normalizeTicketCodes(): Promise<void> {
  const tickets = await prisma.supportTicket.findMany({
    select: { id: true, code: true },
    orderBy: { id: "asc" },
  });

  const needsFix = tickets.filter((t) => t.code !== ticketCodeFromId(t.id));
  if (needsFix.length === 0) return;

  await prisma.$transaction(async (tx) => {
    for (const ticket of needsFix) {
      await tx.supportTicket.update({
        where: { id: ticket.id },
        data: { code: `MIG-${ticket.id}-${Date.now()}` },
      });
    }
    for (const ticket of needsFix) {
      await tx.supportTicket.update({
        where: { id: ticket.id },
        data: { code: ticketCodeFromId(ticket.id) },
      });
    }
  });

  log.event("support", `normalized ${needsFix.length} ticket code(s)`);
}
