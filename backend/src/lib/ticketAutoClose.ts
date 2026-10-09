import { prisma } from "../db/prisma.js";
import { log } from "./log.js";

const KYC_SUCCESS_SUBJECT = "احراز هویت موفق";

export const KYC_SUCCESS_MESSAGE = `باسلام، احراز هویت شما با موفقیت انجام شد.

حساب کاربری شما بررسی و تأیید شده است و از این پس می‌توانید از خدمات و امکانات فعال‌شده برای سطح احراز هویت خود استفاده کنید.

در صورت نیاز به راهنمایی یا وجود هرگونه مشکل، می‌توانید از طریق همین تیکت با پشتیبانی در ارتباط باشید.`;

export async function closeDueKycTickets(): Promise<number> {
  const now = new Date();
  try {
    const result = await prisma.supportTicket.updateMany({
      where: {
        status: { not: "closed" },
        autoCloseAt: { lte: now },
      },
      data: { status: "closed" },
    });
    if (result.count > 0) {
      log.event("support", `auto-closed ${result.count} ticket(s)`);
    }
    return result.count;
  } catch (err) {
    log.warn("support", err instanceof Error ? err.message : String(err));
    return 0;
  }
}

let timer: ReturnType<typeof setInterval> | null = null;

export function startTicketAutoCloseJob(): void {
  if (timer) return;
  void closeDueKycTickets();
  timer = setInterval(() => {
    void closeDueKycTickets().catch((err) => {
      log.warn("support", err instanceof Error ? err.message : String(err));
    });
  }, 5 * 60 * 1000);
  timer.unref?.();
}

export { KYC_SUCCESS_SUBJECT };
