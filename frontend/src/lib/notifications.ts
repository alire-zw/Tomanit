import { apiFetch, type SupportTicketSummary } from "./api";
import { getActiveLocale, localeToBcp47, t } from "../i18n";
import { fetchShopHub, type MerchantShop } from "./shop";
import { supportSubjectLabel } from "./supportMeta";

export type AppNotification = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  href: string;
  kind: "ticket" | "admin-ticket" | "system" | "shop";
};

const READ_KEY_PREFIX = "tomanit.notifications.read.";

function readKey(telegramId: string): string {
  return `${READ_KEY_PREFIX}${telegramId}`;
}

export function readNotificationIds(telegramId: string | null | undefined): Set<string> {
  if (!telegramId) return new Set();
  try {
    const raw = localStorage.getItem(readKey(telegramId));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as string[];
    return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
  } catch {
    return new Set();
  }
}

export function markNotificationsRead(
  telegramId: string | null | undefined,
  ids: string[],
): Set<string> {
  if (!telegramId || ids.length === 0) return readNotificationIds(telegramId);
  const next = readNotificationIds(telegramId);
  for (const id of ids) next.add(id);
  try {
    localStorage.setItem(readKey(telegramId), JSON.stringify([...next]));
  } catch {
    // ignore quota
  }
  return next;
}

export function markAllNotificationsRead(
  telegramId: string | null | undefined,
  notifications: AppNotification[],
): Set<string> {
  return markNotificationsRead(
    telegramId,
    notifications.map((item) => item.id),
  );
}

function formatTicketPreview(ticket: SupportTicketSummary): string {
  const preview = ticket.lastMessage?.body?.trim();
  if (preview) {
    return preview.length > 90 ? `${preview.slice(0, 90)}…` : preview;
  }
  return t("notifications.ticketSubject", {
    subject: supportSubjectLabel(ticket.subject),
  });
}

/** Build inbox items from the user's tickets (answered = new support reply). */
export function notificationsFromTickets(
  tickets: SupportTicketSummary[],
): AppNotification[] {
  return tickets
    .filter((ticket) => ticket.status === "answered")
    .map((ticket) => ({
      id: `ticket-answered:${ticket.id}:${ticket.updatedAt}`,
      title: t("notifications.ticketReply", { code: ticket.code }),
      body: formatTicketPreview(ticket),
      createdAt: ticket.updatedAt,
      href: `/support/${ticket.id}`,
      kind: "ticket" as const,
    }));
}

export function adminOpenTicketsNotification(
  openCount: number,
  latestUpdatedAt?: string,
): AppNotification | null {
  if (openCount <= 0) return null;
  const countLabel = openCount.toLocaleString(localeToBcp47(getActiveLocale()));
  return {
    id: `admin-open:${openCount}:${latestUpdatedAt ?? "0"}`,
    title: t("notifications.adminTicketsTitle"),
    body:
      openCount === 1
        ? t("notifications.adminTicketsOne")
        : t("notifications.adminTicketsMany", { count: countLabel }),
    createdAt: latestUpdatedAt ?? new Date().toISOString(),
    href: "/admin/tickets",
    kind: "admin-ticket",
  };
}

/** In-app inbox item when merchant shop was approved or rejected. */
export function notificationsFromShop(
  shop: MerchantShop | null | undefined,
): AppNotification[] {
  if (!shop?.reviewedAt) return [];
  if (shop.status === "active") {
    return [
      {
        id: `shop-approved:${shop.id}:${shop.reviewedAt}`,
        title: t("notifications.shopApprovedTitle"),
        body: t("notifications.shopApprovedBody"),
        createdAt: shop.reviewedAt,
        href: "/shop",
        kind: "shop",
      },
    ];
  }
  if (shop.status === "rejected") {
    const reason = shop.reviewNote?.trim();
    return [
      {
        id: `shop-rejected:${shop.id}:${shop.reviewedAt}`,
        title: t("notifications.shopRejectedTitle"),
        body: reason
          ? t("notifications.shopRejectedBodyReason", { reason })
          : t("notifications.shopRejectedBody"),
        createdAt: shop.reviewedAt,
        href: "/shop",
        kind: "shop",
      },
    ];
  }
  return [];
}

export async function fetchUserTicketNotifications(): Promise<AppNotification[]> {
  const [ticketsRes, hub] = await Promise.all([
    apiFetch<{ tickets: SupportTicketSummary[] }>("/support/tickets"),
    fetchShopHub().catch(() => null),
  ]);
  return [
    ...notificationsFromTickets(ticketsRes.tickets),
    ...notificationsFromShop(hub?.shop ?? null),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function fetchAdminTicketNotification(): Promise<AppNotification | null> {
  const data = await apiFetch<{
    tickets: Array<{ status: string; updatedAt: string }>;
    total?: number;
  }>("/admin/tickets?status=open&limit=5&page=1");
  const openCount = data.total ?? data.tickets.length;
  const latest = data.tickets[0]?.updatedAt;
  return adminOpenTicketsNotification(openCount, latest);
}
