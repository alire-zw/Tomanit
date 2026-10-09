import type { WalletDto } from "./api";

export type WalletAssetId = "toman" | "trx" | "usdt" | "bnb" | "matic" | "gram";

export function getWalletAssetBalance(
  wallet: WalletDto | null | undefined,
  id: WalletAssetId,
): number {
  if (!wallet) return 0;
  switch (id) {
    case "toman":
      return Number(wallet.tomanBalance) || 0;
    case "trx":
      return wallet.trxBalance ?? 0;
    case "usdt":
      return wallet.usdtBalance ?? 0;
    case "bnb":
      return wallet.bnbBalance ?? 0;
    case "matic":
      return wallet.maticBalance ?? 0;
    case "gram":
      return wallet.gramBalance ?? 0;
    default:
      return 0;
  }
}
