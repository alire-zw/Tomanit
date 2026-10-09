import type { UserDto } from "./api";

/** Deposit / gateway payment requires at least basic KYC. */
export function needsDepositKyc(user: UserDto | null | undefined): boolean {
  return !user || user.kycLevel === "none";
}
