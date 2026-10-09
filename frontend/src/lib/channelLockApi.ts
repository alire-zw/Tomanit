import { apiFetch } from "./api";

export type ChannelLockSlot =
  | "purchase_report"
  | "notification"
  | "community_group";

export type ChannelLockItem = {
  slotKey: ChannelLockSlot;
  label: string;
  title: string;
  username: string;
  chatType: string;
  url: string;
  joined: boolean;
};

export type ChannelLockStatus = {
  required: boolean;
  bypassed: boolean;
  channels: ChannelLockItem[];
};

export function fetchChannelLockStatus() {
  return apiFetch<{ ok: boolean } & ChannelLockStatus>("/channel-lock/status", {
    cache: "no-store",
  });
}

/** Live getChatMember check (same as panelout). */
export function checkChannelLockMembership(slotKey: ChannelLockSlot) {
  return apiFetch<{ ok: boolean; channel: ChannelLockItem }>(
    `/channel-lock/check/${encodeURIComponent(slotKey)}`,
    { cache: "no-store" },
  );
}
