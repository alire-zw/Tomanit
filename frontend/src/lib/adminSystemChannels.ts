import { apiFetch } from "./api";

export type AdminSystemChannelSlot =
  | "admin_report"
  | "purchase_report"
  | "notification"
  | "community_group";

export type AdminSystemChannel = {
  slotKey: AdminSystemChannelSlot;
  label: string;
  hint: string;
  chatId: string;
  username: string;
  title: string;
  chatType?: string;
  inviteLink?: string | null;
  joinUrl?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AdminSystemChannelSlotItem = {
  slotKey: AdminSystemChannelSlot;
  label: string;
  hint: string;
  channel: AdminSystemChannel | null;
};

export function fetchAdminSystemChannelsBot() {
  return apiFetch<{
    ok: boolean;
    username: string;
    deepLink: string;
    groupDeepLink?: string;
  }>("/admin/system-channels/bot");
}

export function fetchAdminSystemChannels() {
  return apiFetch<{ ok: boolean; items: AdminSystemChannelSlotItem[] }>(
    "/admin/system-channels",
  );
}

export function registerAdminSystemChannel(
  slotKey: AdminSystemChannelSlot,
  link: string,
) {
  return apiFetch<{ ok: boolean; channel: AdminSystemChannel }>(
    `/admin/system-channels/${encodeURIComponent(slotKey)}/register`,
    { method: "POST", body: { link } },
  );
}

export function setAdminSystemChannelActive(
  slotKey: AdminSystemChannelSlot,
  isActive: boolean,
) {
  return apiFetch<{ ok: boolean; channel: AdminSystemChannel }>(
    `/admin/system-channels/${encodeURIComponent(slotKey)}/active`,
    { method: "POST", body: { isActive } },
  );
}

export function deleteAdminSystemChannel(slotKey: AdminSystemChannelSlot) {
  return apiFetch<{ ok: boolean }>(
    `/admin/system-channels/${encodeURIComponent(slotKey)}`,
    { method: "DELETE" },
  );
}
