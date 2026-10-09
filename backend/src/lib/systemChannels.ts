import { prisma } from "../db/prisma.js";
import type { AdminSystemChannel, AdminSystemChannelSlot, User } from "@prisma/client";
import { callTelegramApi } from "./telegramApi.js";
import { getBotUsername, resolveBotUsername } from "./botUsername.js";
import { log } from "./log.js";

export const ADMIN_SYSTEM_CHANNEL_SLOTS = [
  "admin_report",
  "purchase_report",
  "notification",
  "community_group",
] as const satisfies readonly AdminSystemChannelSlot[];

export const CHANNEL_LOCK_SLOTS = [
  "purchase_report",
  "notification",
  "community_group",
] as const satisfies readonly AdminSystemChannelSlot[];

export const ADMIN_SYSTEM_CHANNEL_LABELS: Record<AdminSystemChannelSlot, string> = {
  admin_report: "کانال گزارش ادمین",
  purchase_report: "کانال گزارشات خرید",
  notification: "کانال اطلاع‌رسانی تومانیت",
  community_group: "گروه جامعه تومانیت",
};

export const ADMIN_SYSTEM_CHANNEL_HINTS: Record<AdminSystemChannelSlot, string> = {
  admin_report: "فقط برای ادمین‌ها؛ لینک پست عمومی یا خصوصی قابل قبول است",
  purchase_report: "اطلاع خریدها و سفارش‌های موفق",
  notification: "اطلاع‌رسانی عمومی به کاربران",
  community_group: "عضویت اجباری؛ با ادمین شدن ربات لینک دعوت ساخته می‌شود",
};

type RecentBotGroup = {
  chatId: number;
  title: string;
  username: string | null;
  type: string;
  inviteLink: string | null;
  at: number;
};

const recentBotGroups = new Map<number, RecentBotGroup>();
const RECENT_BOT_GROUPS_MAX_AGE_MS = 30 * 60 * 1000;

export class AdminSystemChannelError extends Error {
  code: string;
  status: number;
  constructor(message: string, code = "INVALID_LINK") {
    super(message);
    this.name = "AdminSystemChannelError";
    this.code = code;
    this.status =
      code === "NOT_FOUND"
        ? 404
        : code === "BOT_NOT_ADMIN" ||
            code === "USER_NOT_ADMIN" ||
            code === "CHANNEL_UNAVAILABLE"
          ? 409
          : 400;
  }
}

export function isChannelLockSlot(slotKey: string): boolean {
  return (CHANNEL_LOCK_SLOTS as readonly string[]).includes(slotKey);
}

export function isAlwaysOnSystemChannel(slotKey: string): boolean {
  return slotKey === "admin_report";
}

export function isCommunityGroupSlot(slotKey: string): boolean {
  return slotKey === "community_group";
}

function assertSlot(slotKey: string): AdminSystemChannelSlot {
  if (!(ADMIN_SYSTEM_CHANNEL_SLOTS as readonly string[]).includes(slotKey)) {
    throw new AdminSystemChannelError("نوع کانال نامعتبر است", "INVALID_SLOT");
  }
  return slotKey as AdminSystemChannelSlot;
}

function isAdminStatus(status: string): boolean {
  return status === "administrator" || status === "creator";
}

function isMemberStatus(status: string): boolean {
  return (
    status === "creator" ||
    status === "administrator" ||
    status === "member" ||
    status === "restricted"
  );
}

function isGroupChatType(type: string): boolean {
  return type === "group" || type === "supergroup";
}

function privateChannelInternalIdToChatId(internalId: string): number | null {
  const id = String(internalId || "").replace(/\D/g, "");
  if (!id) return null;
  return Number(`-100${id}`);
}

function serializeChannel(row: AdminSystemChannel) {
  const slotKey = row.slotKey;
  const username = String(row.username || "").replace(/^@/, "");
  const inviteLink = row.inviteLink || null;
  const joinUrl =
    inviteLink ||
    (username.startsWith("c/") || username.startsWith("group_")
      ? null
      : username
        ? `https://t.me/${username}`
        : null);

  return {
    slotKey,
    label: ADMIN_SYSTEM_CHANNEL_LABELS[slotKey],
    hint: ADMIN_SYSTEM_CHANNEL_HINTS[slotKey],
    chatId: String(row.chatId),
    username,
    title: row.title,
    chatType: row.chatType || "channel",
    inviteLink,
    joinUrl,
    isActive: Boolean(row.isActive),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function normalizeTelegramUrl(rawLink: string) {
  const trimmed = String(rawLink || "").trim();
  if (!trimmed) {
    throw new AdminSystemChannelError("لینک را وارد کنید", "INVALID_LINK");
  }
  let normalized = trimmed;
  if (!/^https?:\/\//i.test(normalized)) {
    normalized = `https://${normalized.replace(/^\/+/, "")}`;
  }
  let url: URL;
  try {
    url = new URL(normalized);
  } catch {
    throw new AdminSystemChannelError("لینک معتبر نیست", "INVALID_LINK");
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (host !== "t.me" && host !== "telegram.me" && host !== "telegram.dog") {
    throw new AdminSystemChannelError(
      "فقط لینک تلگرام پذیرفته می‌شود",
      "INVALID_LINK",
    );
  }
  const parts = url.pathname
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);
  return { url, parts };
}

export function parseTelegramPostLink(rawLink: string) {
  const { parts } = normalizeTelegramUrl(rawLink);

  if (parts[0]?.toLowerCase() === "c") {
    const internalId = parts[1];
    const messageId = Number.parseInt(parts[2] ?? "", 10);
    if (!/^\d{5,20}$/.test(internalId || "")) {
      throw new AdminSystemChannelError("لینک کانال خصوصی معتبر نیست", "INVALID_LINK");
    }
    if (!Number.isFinite(messageId) || messageId <= 0) {
      throw new AdminSystemChannelError("لینک باید مربوط به یک پست باشد", "INVALID_LINK");
    }
    const chatId = privateChannelInternalIdToChatId(internalId!);
    if (!chatId) {
      throw new AdminSystemChannelError("لینک کانال خصوصی معتبر نیست", "INVALID_LINK");
    }
    return {
      kind: "private" as const,
      chatId,
      internalId: internalId!,
      username: null as string | null,
      messageId,
    };
  }

  const usernameIndex = parts[0]?.toLowerCase() === "s" ? 1 : 0;
  const username = parts[usernameIndex];
  const messageId = Number.parseInt(parts[usernameIndex + 1] ?? "", 10);
  if (!username || !/^[a-zA-Z][a-zA-Z0-9_]{3,31}$/.test(username)) {
    throw new AdminSystemChannelError("لینک پست معتبر نیست", "INVALID_LINK");
  }
  if (!Number.isFinite(messageId) || messageId <= 0) {
    throw new AdminSystemChannelError("لینک باید مربوط به یک پست باشد", "INVALID_LINK");
  }
  return {
    kind: "public" as const,
    chatId: null as number | null,
    internalId: null as string | null,
    username,
    messageId,
  };
}

export function parseTelegramGroupLink(rawLink: string) {
  const { parts, url } = normalizeTelegramUrl(rawLink);

  if (parts[0]?.toLowerCase() === "c") {
    const internalId = parts[1];
    const messageId = Number.parseInt(parts[2] ?? "1", 10);
    if (!/^\d{5,20}$/.test(internalId || "")) {
      throw new AdminSystemChannelError("لینک گروه خصوصی معتبر نیست", "INVALID_LINK");
    }
    const chatId = privateChannelInternalIdToChatId(internalId!);
    if (!chatId) {
      throw new AdminSystemChannelError("لینک گروه خصوصی معتبر نیست", "INVALID_LINK");
    }
    return {
      kind: "private_message" as const,
      chatId,
      internalId: internalId!,
      username: null as string | null,
      messageId: Number.isFinite(messageId) && messageId > 0 ? messageId : 1,
      inviteLink: null as string | null,
    };
  }

  if (parts[0]?.toLowerCase() === "joinchat" && parts[1]) {
    return {
      kind: "invite" as const,
      chatId: null as number | null,
      internalId: null as string | null,
      username: null as string | null,
      messageId: null as number | null,
      inviteLink: `https://t.me/joinchat/${parts[1]}`,
    };
  }

  if (parts[0]?.startsWith("+") && (parts[0]?.length ?? 0) > 2) {
    const hash = parts[0]!.slice(1);
    return {
      kind: "invite" as const,
      chatId: null as number | null,
      internalId: null as string | null,
      username: null as string | null,
      messageId: null as number | null,
      inviteLink: `https://t.me/+${hash}`,
    };
  }

  const inviteParam = url.searchParams.get("invite");
  if (inviteParam) {
    return {
      kind: "invite" as const,
      chatId: null as number | null,
      internalId: null as string | null,
      username: null as string | null,
      messageId: null as number | null,
      inviteLink: `https://t.me/+${inviteParam}`,
    };
  }

  const usernameIndex = parts[0]?.toLowerCase() === "s" ? 1 : 0;
  const username = parts[usernameIndex];
  if (!username || !/^[a-zA-Z][a-zA-Z0-9_]{3,31}$/.test(username)) {
    throw new AdminSystemChannelError(
      "لینک گروه معتبر نیست (عمومی، دعوت خصوصی یا لینک پیام)",
      "INVALID_LINK",
    );
  }
  return {
    kind: "public" as const,
    chatId: null as number | null,
    internalId: null as string | null,
    username,
    messageId: null as number | null,
    inviteLink: `https://t.me/${username}`,
  };
}

type TgChat = {
  id: number;
  type: string;
  title?: string;
  username?: string;
};

type TgChatMember = { status: string };

type TgUser = { id: number; username?: string };

async function resolveBotIdentity() {
  const me = await callTelegramApi<TgUser>("getMe");
  if (!me?.id || !me.username) {
    throw new AdminSystemChannelError("ربات در دسترس نیست", "CHANNEL_UNAVAILABLE");
  }
  return { id: me.id, username: me.username };
}

export async function getAdminSystemChannelsBotInfo() {
  const bot = await resolveBotIdentity();
  await resolveBotUsername();
  return {
    username: bot.username,
    deepLink: `https://t.me/${bot.username}?startchannel&admin=post_messages+edit_messages+delete_messages`,
    groupDeepLink: `https://t.me/${bot.username}?startgroup&admin=invite_users+restrict_members+delete_messages+pin_messages`,
  };
}

export async function listAdminSystemChannels() {
  const rows = await prisma.adminSystemChannel.findMany();
  const bySlot = new Map(rows.map((row) => [row.slotKey, row]));
  return {
    items: ADMIN_SYSTEM_CHANNEL_SLOTS.map((slotKey) => {
      const row = bySlot.get(slotKey);
      return {
        slotKey,
        label: ADMIN_SYSTEM_CHANNEL_LABELS[slotKey],
        hint: ADMIN_SYSTEM_CHANNEL_HINTS[slotKey],
        channel: row ? serializeChannel(row) : null,
      };
    }),
  };
}

async function assertBotAndUserAdmin(
  chatId: number,
  botId: number,
  actorTelegramId: string,
  entityLabel: string,
) {
  let botMember: TgChatMember;
  try {
    botMember = await callTelegramApi<TgChatMember>("getChatMember", {
      chat_id: chatId,
      user_id: botId,
    });
  } catch {
    throw new AdminSystemChannelError(
      `ربات را به‌عنوان ادمین ${entityLabel} اضافه کنید و دوباره تلاش کنید`,
      "BOT_NOT_ADMIN",
    );
  }
  if (!isAdminStatus(botMember.status)) {
    throw new AdminSystemChannelError(`ربات باید ادمین ${entityLabel} باشد`, "BOT_NOT_ADMIN");
  }

  let userMember: TgChatMember;
  try {
    userMember = await callTelegramApi<TgChatMember>("getChatMember", {
      chat_id: chatId,
      user_id: Number(actorTelegramId),
    });
  } catch {
    throw new AdminSystemChannelError(`شما باید ادمین این ${entityLabel} باشید`, "USER_NOT_ADMIN");
  }
  if (!isAdminStatus(userMember.status)) {
    throw new AdminSystemChannelError(
      `فقط ادمین ${entityLabel} می‌تواند آن را ثبت کند`,
      "USER_NOT_ADMIN",
    );
  }
}

async function createBotOwnedInviteLink(chat: TgChat): Promise<string> {
  try {
    const created = await callTelegramApi<{ invite_link?: string }>(
      "createChatInviteLink",
      {
        chat_id: chat.id,
        name: "تومانیت",
        creates_join_request: false,
      },
    );
    if (created?.invite_link) return created.invite_link;
  } catch {
    /* fall through */
  }
  try {
    const exported = await callTelegramApi<string | { invite_link?: string }>(
      "exportChatInviteLink",
      { chat_id: chat.id },
    );
    if (typeof exported === "string" && exported) return exported;
    if (exported && typeof exported === "object" && exported.invite_link) {
      return exported.invite_link;
    }
  } catch {
    /* fall through */
  }
  if (chat.username) return `https://t.me/${chat.username}`;
  throw new AdminSystemChannelError(
    "لینک دعوت گروه ساخته نشد؛ به ربات دسترسی Invite Users بدهید",
    "CHANNEL_UNAVAILABLE",
  );
}

export function rememberBotGroupChat(
  chat: TgChat,
  inviteLink: string | null = null,
) {
  if (!chat?.id || !isGroupChatType(chat.type)) return;
  recentBotGroups.set(Number(chat.id), {
    chatId: Number(chat.id),
    title: chat.title || "",
    username: chat.username || null,
    type: chat.type,
    inviteLink,
    at: Date.now(),
  });
  // Cap map size
  if (recentBotGroups.size > 30) {
    const oldest = [...recentBotGroups.entries()].sort((a, b) => a[1].at - b[1].at)[0];
    if (oldest) recentBotGroups.delete(oldest[0]);
  }
}

function resolveRecentBotGroupForInvite(): RecentBotGroup | null {
  const now = Date.now();
  const fresh = [...recentBotGroups.values()].filter(
    (item) => now - item.at < RECENT_BOT_GROUPS_MAX_AGE_MS,
  );
  return fresh[0] ?? null;
}

export async function onBotBecameGroupAdmin(chat: TgChat) {
  if (!chat?.id || !isGroupChatType(chat.type)) return null;
  let inviteLink: string | null = null;
  try {
    inviteLink = await createBotOwnedInviteLink(chat);
  } catch (err) {
    log.warn(
      "channels",
      `create invite on join fail chat:${chat.id} — ${err instanceof Error ? err.message : err}`,
    );
  }
  rememberBotGroupChat(chat, inviteLink);
  if (inviteLink) {
    await prisma.adminSystemChannel.updateMany({
      where: { chatId: String(chat.id), slotKey: "community_group" },
      data: {
        inviteLink,
        chatType: chat.type,
        title: chat.title?.trim() || undefined,
        username: chat.username ? String(chat.username).toLowerCase() : undefined,
      },
    });
  }
  return inviteLink;
}

async function registerCommunityGroup(actor: User, link: string) {
  const parsed = parseTelegramGroupLink(link);
  const bot = await resolveBotIdentity();

  let chatLookupId: string | number | null = null;
  if (parsed.kind === "public") {
    chatLookupId = `@${parsed.username}`;
  } else if (parsed.kind === "private_message") {
    chatLookupId = parsed.chatId!;
  } else if (parsed.kind === "invite") {
    const recent = resolveRecentBotGroupForInvite();
    if (!recent?.chatId) {
      throw new AdminSystemChannelError(
        "اول ربات را ادمین گروه کنید، سپس حداکثر تا ۳۰ دقیقه لینک دعوت را ثبت کنید — یا لینک یکی از پیام‌های گروه (t.me/c/…) را وارد کنید",
        "CHANNEL_UNAVAILABLE",
      );
    }
    chatLookupId = recent.chatId;
  }

  let chat: TgChat;
  try {
    chat = await callTelegramApi<TgChat>("getChat", { chat_id: chatLookupId });
  } catch {
    throw new AdminSystemChannelError(
      "گروه پیدا نشد؛ ربات را ادمین گروه کنید و دوباره تلاش کنید",
      "CHANNEL_UNAVAILABLE",
    );
  }

  if (!isGroupChatType(chat.type)) {
    throw new AdminSystemChannelError(
      "لینک باید مربوط به یک گروه باشد (نه کانال)",
      "CHANNEL_UNAVAILABLE",
    );
  }

  await assertBotAndUserAdmin(chat.id, bot.id, actor.telegramId, "گروه");

  const recent = resolveRecentBotGroupForInvite();
  const cachedInvite =
    recent && Number(recent.chatId) === Number(chat.id) ? recent.inviteLink : null;
  const inviteLink = cachedInvite || (await createBotOwnedInviteLink(chat));

  const username = chat.username
    ? String(chat.username).toLowerCase()
    : parsed.internalId
      ? `c/${parsed.internalId}`
      : `group_${Math.abs(Number(chat.id))}`;
  const title = chat.title?.trim() || username;

  const row = await prisma.adminSystemChannel.upsert({
    where: { slotKey: "community_group" },
    create: {
      slotKey: "community_group",
      chatId: String(chat.id),
      username,
      title,
      inviteLink,
      chatType: chat.type,
      isActive: true,
    },
    update: {
      chatId: String(chat.id),
      username,
      title,
      inviteLink,
      chatType: chat.type,
      isActive: true,
    },
  });

  rememberBotGroupChat(chat, inviteLink);
  log.info("channels", `register community_group chat:${chat.id} by:${actor.telegramId}`);
  return { channel: serializeChannel(row) };
}

async function registerChannelSlot(
  actor: User,
  slotKey: AdminSystemChannelSlot,
  link: string,
) {
  const parsed = parseTelegramPostLink(link);

  if (parsed.kind === "private" && !isAlwaysOnSystemChannel(slotKey)) {
    throw new AdminSystemChannelError(
      "لینک کانال خصوصی فقط برای «کانال گزارش ادمین» مجاز است. برای قفل عضویت لینک پست عمومی وارد کنید.",
      "PRIVATE_CHANNEL",
    );
  }

  const bot = await resolveBotIdentity();
  const chatLookupId =
    parsed.kind === "private" ? parsed.chatId! : `@${parsed.username}`;

  let chat: TgChat;
  try {
    chat = await callTelegramApi<TgChat>("getChat", { chat_id: chatLookupId });
  } catch {
    throw new AdminSystemChannelError(
      parsed.kind === "private"
        ? "کانال خصوصی پیدا نشد؛ ربات را ادمین کانال کنید و دوباره تلاش کنید"
        : "کانال پیدا نشد یا عمومی نیست",
      "CHANNEL_UNAVAILABLE",
    );
  }

  if (chat.type !== "channel") {
    throw new AdminSystemChannelError(
      "لینک باید مربوط به یک کانال باشد",
      "CHANNEL_UNAVAILABLE",
    );
  }

  await assertBotAndUserAdmin(chat.id, bot.id, actor.telegramId, "کانال");

  const username =
    parsed.kind === "private"
      ? `c/${parsed.internalId}`
      : String(chat.username ?? parsed.username).toLowerCase();
  const title =
    chat.title?.trim() ||
    (parsed.kind === "private" ? `کانال خصوصی ${parsed.internalId}` : username);
  const inviteLink = chat.username ? `https://t.me/${chat.username}` : null;

  const row = await prisma.adminSystemChannel.upsert({
    where: { slotKey },
    create: {
      slotKey,
      chatId: String(chat.id),
      username,
      title,
      inviteLink,
      chatType: "channel",
      isActive: true,
    },
    update: {
      chatId: String(chat.id),
      username,
      title,
      inviteLink,
      chatType: "channel",
      isActive: true,
    },
  });

  log.info(
    "channels",
    `register ${slotKey} ${parsed.kind === "private" ? username : `@${username}`} by:${actor.telegramId}`,
  );
  return { channel: serializeChannel(row) };
}

export async function registerAdminSystemChannel(
  actor: User,
  slotKeyRaw: string,
  link: string,
) {
  const slotKey = assertSlot(slotKeyRaw);
  if (isCommunityGroupSlot(slotKey)) {
    return registerCommunityGroup(actor, link);
  }
  return registerChannelSlot(actor, slotKey, link);
}

export async function setAdminSystemChannelActive(
  slotKeyRaw: string,
  isActive: boolean,
) {
  const slotKey = assertSlot(slotKeyRaw);
  if (isAlwaysOnSystemChannel(slotKey)) {
    throw new AdminSystemChannelError(
      "کانال گزارش ادمین همیشه فعال است و قفل ندارد",
      "INVALID_SLOT",
    );
  }
  const existing = await prisma.adminSystemChannel.findUnique({ where: { slotKey } });
  if (!existing) {
    throw new AdminSystemChannelError("موردی برای این بخش ثبت نشده", "NOT_FOUND");
  }
  const row = await prisma.adminSystemChannel.update({
    where: { slotKey },
    data: { isActive: Boolean(isActive) },
  });
  return { channel: serializeChannel(row) };
}

export async function deleteAdminSystemChannel(slotKeyRaw: string) {
  const slotKey = assertSlot(slotKeyRaw);
  try {
    await prisma.adminSystemChannel.delete({ where: { slotKey } });
  } catch {
    throw new AdminSystemChannelError("موردی برای این بخش ثبت نشده", "NOT_FOUND");
  }
  return { ok: true };
}

export async function getActiveAdminSystemChannel(slotKeyRaw: string) {
  const slotKey = assertSlot(slotKeyRaw);
  const row = await prisma.adminSystemChannel.findFirst({
    where: {
      slotKey,
      OR: [{ isActive: true }, { slotKey: "admin_report" }],
    },
  });
  return row ? serializeChannel(row) : null;
}

function toTelegramChatId(chatId: string): string | number {
  const raw = String(chatId || "").trim();
  if (!raw) return raw;
  // Prefer numeric when safe; keep string for very large ids.
  if (/^-?\d+$/.test(raw)) {
    const asNum = Number(raw);
    if (Number.isSafeInteger(asNum)) return asNum;
    return raw;
  }
  return raw.startsWith("@") ? raw : `@${raw}`;
}

async function checkUserJoinedChannel(
  chatId: string,
  telegramId: string,
  username?: string | null,
) {
  const userId = Number(telegramId);
  if (!Number.isFinite(userId) || userId <= 0) {
    log.warn("channels", `lock check skipped — bad telegramId:${telegramId}`);
    return false;
  }

  const tryIds: Array<string | number> = [toTelegramChatId(chatId)];
  const uname = String(username || "")
    .replace(/^@/, "")
    .trim()
    .toLowerCase();
  if (uname && !uname.startsWith("c/") && !uname.startsWith("group_")) {
    tryIds.push(`@${uname}`);
  }

  let lastError = "";
  for (const id of tryIds) {
    try {
      const member = await callTelegramApi<TgChatMember>("getChatMember", {
        chat_id: id,
        user_id: userId,
      });
      return isMemberStatus(member.status);
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  log.warn(
    "channels",
    `lock check failed chat:${chatId} user:${telegramId} · ${lastError}`,
  );
  return false;
}

function serializeLockChannel(row: AdminSystemChannel, joined: boolean) {
  const username = String(row.username || "").replace(/^@/, "").toLowerCase();
  const inviteLink = row.inviteLink || null;
  const url =
    inviteLink ||
    (username && !username.startsWith("c/") && !username.startsWith("group_")
      ? `https://t.me/${username}`
      : "") ||
    "";
  return {
    slotKey: row.slotKey,
    label: ADMIN_SYSTEM_CHANNEL_LABELS[row.slotKey] ?? row.title,
    title: row.title,
    username,
    chatType: row.chatType || "channel",
    url,
    joined,
  };
}

export async function getChannelLockStatus(user: User) {
  if (user.role === "admin" || user.role === "supervisor") {
    return { required: false, bypassed: true, channels: [] as ReturnType<typeof serializeLockChannel>[] };
  }

  const rows = await prisma.adminSystemChannel.findMany({
    where: {
      isActive: true,
      slotKey: { in: [...CHANNEL_LOCK_SLOTS] },
    },
    orderBy: { createdAt: "asc" },
  });

  if (rows.length === 0) {
    return { required: false, bypassed: false, channels: [] };
  }

  const channels = await Promise.all(
    rows.map(async (row) => {
      const joined = await checkUserJoinedChannel(
        row.chatId,
        user.telegramId,
        row.username,
      );
      return serializeLockChannel(row, joined);
    }),
  );

  return {
    required: channels.some((channel) => !channel.joined),
    bypassed: false,
    channels,
  };
}

export async function checkChannelLockMembership(user: User, slotKeyRaw: string) {
  if (!isChannelLockSlot(slotKeyRaw)) return null;
  const row = await prisma.adminSystemChannel.findFirst({
    where: { slotKey: slotKeyRaw as AdminSystemChannelSlot, isActive: true },
  });
  if (!row) return null;
  const joined = await checkUserJoinedChannel(
    row.chatId,
    user.telegramId,
    row.username,
  );
  return serializeLockChannel(row, joined);
}

/** Prefer env bot username for display. */
export function peekBotUsername(): string {
  return getBotUsername() || "bot";
}
