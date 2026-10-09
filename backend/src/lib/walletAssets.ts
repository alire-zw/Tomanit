import type { CryptoNetwork, WalletAsset } from "@prisma/client";

export type AssetId = WalletAsset;
export type NetworkId = CryptoNetwork;

export type AssetDef = {
  id: AssetId;
  symbol: string;
  networks: NetworkId[];
  decimals: number;
  isFiat: boolean;
  /** Rate in toman per 1 unit of asset (toman = 1). */
  rateToman: number;
};

export type NetworkDef = {
  id: NetworkId;
  name: string;
  assets: AssetId[];
};

export const ASSETS: AssetDef[] = [
  {
    id: "toman",
    symbol: "TOMAN",
    networks: [],
    decimals: 0,
    isFiat: true,
    rateToman: 1,
  },
  {
    id: "trx",
    symbol: "TRX",
    networks: ["tron"],
    decimals: 6,
    isFiat: false,
    rateToman: 8500,
  },
  {
    id: "usdt",
    symbol: "USDT",
    networks: ["tron", "bsc", "polygon"],
    decimals: 6,
    isFiat: false,
    rateToman: 92_000,
  },
  {
    id: "bnb",
    symbol: "BNB",
    networks: ["bsc"],
    decimals: 8,
    isFiat: false,
    rateToman: 5_200_000,
  },
  {
    id: "matic",
    symbol: "MATIC",
    networks: ["polygon"],
    decimals: 8,
    isFiat: false,
    rateToman: 42_000,
  },
  {
    id: "gram",
    symbol: "GRAM",
    networks: ["ton"],
    decimals: 9,
    isFiat: false,
    rateToman: 18_000,
  },
];

export const NETWORKS: NetworkDef[] = [
  { id: "tron", name: "TRON", assets: ["trx", "usdt"] },
  { id: "bsc", name: "BNB Smart Chain", assets: ["bnb", "usdt"] },
  { id: "polygon", name: "Polygon", assets: ["matic", "usdt"] },
  { id: "ton", name: "TON", assets: ["gram"] },
];

const assetById = new Map(ASSETS.map((a) => [a.id, a]));
const networkById = new Map(NETWORKS.map((n) => [n.id, n]));

export function getAsset(id: string): AssetDef | undefined {
  return assetById.get(id as AssetId);
}

export function getNetwork(id: string): NetworkDef | undefined {
  return networkById.get(id as NetworkId);
}

export function isWalletAsset(value: string): value is AssetId {
  return assetById.has(value as AssetId);
}

export function isCryptoNetwork(value: string): value is NetworkId {
  return networkById.has(value as NetworkId);
}

/** Convert amount of `from` into `to` using toman rates. */
export function convertAmount(
  fromAsset: AssetId,
  toAsset: AssetId,
  amount: number,
): number {
  const from = getAsset(fromAsset);
  const to = getAsset(toAsset);
  if (!from || !to) {
    throw Object.assign(new Error("Unknown asset"), { statusCode: 400 });
  }
  if (!(amount > 0) || !Number.isFinite(amount)) {
    throw Object.assign(new Error("Invalid amount"), { statusCode: 400 });
  }
  const inToman = amount * from.rateToman;
  const result = inToman / to.rateToman;
  const factor = 10 ** to.decimals;
  return Math.floor(result * factor) / factor;
}

export function assetSupportedOnNetwork(
  asset: AssetId,
  network: NetworkId | null | undefined,
): boolean {
  const def = getAsset(asset);
  if (!def) return false;
  if (def.isFiat) return network == null;
  if (!network) return false;
  return def.networks.includes(network);
}
