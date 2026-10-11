import { prisma } from "../db/prisma.js";
import { log } from "./log.js";
import { callTelegramApi } from "./telegramApi.js";
import { gatewayUsageRatio } from "./gatewayRouting.js";
import { getActiveAdminSystemChannel } from "./systemChannels.js";

const FAIL_ALERT_THRESHOLD = 3;
const CAPACITY_ALERT_RATIO = 0.8;
const ALERT_COOLDOWN_MS = 6 * 60 * 60 * 1000;
/** Dedupe shell-failure posts for the same track within this window. */
const SHELL_ALERT_DEDUP_MS = 60_000;
const recentShellAlerts = new Map<string, number>();

async function adminChatIds(): Promise<string[]> {
  const admins = await prisma.user.findMany({
    where: { role: { in: ["admin", "supervisor"] } },
    select: { telegramId: true },
  });
  return [...new Set(admins.map((a) => String(a.telegramId)).filter(Boolean))];
}

async function broadcastAdmins(text: string): Promise<void> {
  const ids = await adminChatIds();
  await Promise.all(
    ids.map(async (chatId) => {
      try {
        await callTelegramApi("sendMessage", {
          chat_id: chatId,
          text,
          parse_mode: "HTML",
          link_preview_options: { is_disabled: true },
        });
      } catch (err) {
        log.warn(
          "gateway-alert",
          `tg:${chatId} · ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }),
  );
}

export async function maybeAlertGatewayCapacity(gatewayId: number): Promise<void> {
  const g = await prisma.paymentGateway.findUnique({ where: { id: gatewayId } });
  if (!g || g.dailyLimitToman == null) return;
  const ratio = gatewayUsageRatio(g);
  if (ratio == null || ratio < CAPACITY_ALERT_RATIO) return;

  const last = g.lastCapacityAlertAt?.getTime() ?? 0;
  if (Date.now() - last < ALERT_COOLDOWN_MS) return;

  await prisma.paymentGateway.update({
    where: { id: g.id },
    data: { lastCapacityAlertAt: new Date() },
  });

  const pct = Math.round(ratio * 100);
  const used = g.balanceToman.toString();
  const limit = g.dailyLimitToman.toString();
  await broadcastAdmins(
    `⚠️ <b>Gateway near daily limit</b>\n` +
      `Name: <b>${escapeHtml(g.displayName)}</b>\n` +
      `Usage: ${used} / ${limit} toman (${pct}%)`,
  );
}

export async function recordGatewayChargeFailure(gatewayId: number): Promise<void> {
  const g = await prisma.paymentGateway.update({
    where: { id: gatewayId },
    data: { consecutiveFailCount: { increment: 1 } },
  });

  if (g.consecutiveFailCount < FAIL_ALERT_THRESHOLD) return;
  const last = g.lastFailAlertAt?.getTime() ?? 0;
  if (Date.now() - last < ALERT_COOLDOWN_MS) return;

  await prisma.paymentGateway.update({
    where: { id: g.id },
    data: { lastFailAlertAt: new Date() },
  });

  await broadcastAdmins(
    `🚨 <b>Gateway consecutive failures</b>\n` +
      `Name: <b>${escapeHtml(g.displayName)}</b>\n` +
      `${g.consecutiveFailCount} failed payments in a row`,
  );
}

export async function recordGatewayChargeSuccess(gatewayId: number): Promise<void> {
  await prisma.paymentGateway.update({
    where: { id: gatewayId },
    data: { consecutiveFailCount: 0 },
  });
}

export type GatewayShellFailureAlert = {
  trackId: string;
  code: string;
  userMessage: string;
  technical?: string | null;
  proxy?: string | null;
};

/** Post payment-shell failures to admin_report (never throws). */
export async function notifyGatewayShellFailure(
  input: GatewayShellFailureAlert,
): Promise<void> {
  try {
    const key = `${input.trackId}:${input.code}`;
    const last = recentShellAlerts.get(key) ?? 0;
    if (Date.now() - last < SHELL_ALERT_DEDUP_MS) return;
    recentShellAlerts.set(key, Date.now());
    if (recentShellAlerts.size > 200) {
      const cutoff = Date.now() - SHELL_ALERT_DEDUP_MS;
      for (const [k, at] of recentShellAlerts) {
        if (at < cutoff) recentShellAlerts.delete(k);
      }
    }

    const channel = await getActiveAdminSystemChannel("admin_report");
    if (!channel?.chatId) {
      log.warn("gateway-alert", "shell fail skipped — admin_report missing");
      return;
    }

    const lines = [
      `🚨 <b>خطای درگاه پرداخت</b>`,
      `کد: <code>${escapeHtml(input.code)}</code>`,
      `پیگیری: <code>${escapeHtml(input.trackId || "—")}</code>`,
      `پیام: ${escapeHtml(input.userMessage)}`,
    ];
    if (input.technical) {
      lines.push(`جزئیات: <code>${escapeHtml(input.technical.slice(0, 280))}</code>`);
    }
    if (input.proxy) {
      lines.push(`پروکسی: <code>${escapeHtml(input.proxy)}</code>`);
    }

    await callTelegramApi("sendMessage", {
      chat_id: channel.chatId,
      text: lines.join("\n"),
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
    });
  } catch (err) {
    log.warn(
      "gateway-alert",
      `shell fail notify · ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
