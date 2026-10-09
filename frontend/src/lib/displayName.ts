import type { UserDto } from "./api";

type TelegramNameParts = {
  first_name?: string | null;
  last_name?: string | null;
};

/**
 * Prefer DB real name (`fullName` / real_name), then Telegram name, then firstName.
 */
export function resolveDisplayName(
  user: Pick<UserDto, "fullName" | "firstName" | "lastName"> | null | undefined,
  tgUser?: TelegramNameParts | null,
  fallback = "کاربر",
): string {
  const realName = user?.fullName?.trim();
  if (realName) return realName;

  const tgName = [tgUser?.first_name, tgUser?.last_name]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
  if (tgName) return tgName;

  const firstName = user?.firstName?.trim();
  if (firstName) return firstName;

  const lastName = user?.lastName?.trim();
  if (lastName) return lastName;

  return fallback;
}
