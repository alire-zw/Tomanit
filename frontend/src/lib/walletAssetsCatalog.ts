import type { WalletAssetId } from "./api";

export type WalletAssetDef = {
  id: WalletAssetId;
  symbol: string;
  titleKey: string;
  unitKey: string;
  logo: string;
  subtitleKey?: string;
  /** Crypto assets open a dedicated coin page. */
  hasCoinPage: boolean;
};

export const WALLET_ASSETS: WalletAssetDef[] = [
  {
    id: "toman",
    symbol: "TOMAN",
    titleKey: "wallet.toman",
    unitKey: "wallet.toman",
    logo: "/coins/TOMAN.png",
    subtitleKey: "wallet.rialBalance",
    hasCoinPage: true,
  },
  {
    id: "trx",
    symbol: "TRX",
    titleKey: "wallet.tron",
    unitKey: "wallet.tron",
    logo: "/coins/TRX.png",
    hasCoinPage: true,
  },
  {
    id: "usdt",
    symbol: "USDT",
    titleKey: "wallet.tether",
    unitKey: "wallet.tether",
    logo: "/coins/USDT.png",
    hasCoinPage: true,
  },
  {
    id: "bnb",
    symbol: "BNB",
    titleKey: "wallet.binance",
    unitKey: "wallet.binance",
    logo: "/coins/BNB.png",
    hasCoinPage: true,
  },
  {
    id: "matic",
    symbol: "MATIC",
    titleKey: "wallet.polygon",
    unitKey: "wallet.polygon",
    logo: "/coins/MATIC.png",
    hasCoinPage: true,
  },
  {
    id: "gram",
    symbol: "GRAM",
    titleKey: "wallet.telegram",
    unitKey: "wallet.gram",
    logo: "/coins/GRAM.png?v=2",
    hasCoinPage: true,
  },
];

export function getWalletAssetDef(id: string): WalletAssetDef | undefined {
  return WALLET_ASSETS.find((a) => a.id === id);
}

export function isWalletAssetId(value: string): value is WalletAssetId {
  return WALLET_ASSETS.some((a) => a.id === value);
}
