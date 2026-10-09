import type { WalletAssetId, WalletNetworkId } from "./api";

/** Networks supported per crypto asset (mirrors backend walletAssets). */
export const ASSET_DEPOSIT_NETWORKS: Record<
  Exclude<WalletAssetId, "toman">,
  WalletNetworkId[]
> = {
  trx: ["tron"],
  usdt: ["tron", "bsc", "polygon"],
  bnb: ["bsc"],
  matic: ["polygon"],
  gram: ["ton"],
};

export type NetworkUiMeta = {
  id: WalletNetworkId;
  /** Native coin logo for the small badge */
  logo: string;
  /** Token standard label e.g. TRC20 */
  protocol: string;
  /** Latin network code for info rows (e.g. TRON) */
  code: string;
  nameKey: string;
};

export const NETWORK_UI: Record<WalletNetworkId, NetworkUiMeta> = {
  tron: {
    id: "tron",
    logo: "/coins/TRX.png",
    protocol: "TRC20",
    code: "TRON",
    nameKey: "wallet.networkLabel.tron",
  },
  bsc: {
    id: "bsc",
    logo: "/coins/BNB.png",
    protocol: "BEP20",
    code: "BSC",
    nameKey: "wallet.networkLabel.bsc",
  },
  polygon: {
    id: "polygon",
    logo: "/coins/MATIC.png",
    protocol: "POLYGON",
    code: "POLYGON",
    nameKey: "wallet.networkLabel.polygon",
  },
  ton: {
    id: "ton",
    logo: "/coins/GRAM.png?v=2",
    protocol: "TON",
    code: "TON",
    nameKey: "wallet.networkLabel.ton",
  },
};

/** Target fiat value for minimum crypto deposit (IRT/Toman). */
export const MIN_DEPOSIT_TOMAN_TARGET = 50_000;

/**
 * Min deposit ≈ 50k toman of the asset, rounded up cleanly.
 * - Cheap / mid coins (e.g. TRX ≈ 70k): round up to 1 full unit when raw ≥ 0.5
 * - Whole units when raw ≥ 1
 * - Expensive coins (e.g. BNB): up to 8 decimal places
 */
export function computeMinDepositAmount(rateToman: number): number {
  if (!(rateToman > 0) || !Number.isFinite(rateToman)) return 0;
  const raw = MIN_DEPOSIT_TOMAN_TARGET / rateToman;

  if (raw >= 1) {
    return Math.ceil(raw - 1e-12);
  }
  // e.g. TRX @ 70k → 0.71 → 1 TRX
  if (raw >= 0.5) {
    return 1;
  }

  let decimals = 8;
  if (raw >= 0.1) decimals = 2;
  else if (raw >= 0.01) decimals = 3;
  else if (raw >= 0.001) decimals = 4;
  else if (raw >= 0.0001) decimals = 5;
  else if (raw >= 0.00001) decimals = 6;
  else if (raw >= 0.000001) decimals = 7;

  const factor = 10 ** decimals;
  const rounded = Math.ceil(raw * factor - 1e-12) / factor;
  return Number(rounded.toFixed(decimals));
}

/** Latin display string, trimmed trailing zeros (max 8 dp). */
export function formatMinDepositAmount(amount: number): string {
  if (!(amount > 0) || !Number.isFinite(amount)) return "";
  if (Number.isInteger(amount) || amount >= 100) {
    return String(Math.round(amount));
  }
  if (amount >= 1) {
    const fixed = amount.toFixed(8).replace(/\.?0+$/, "");
    return fixed || String(amount);
  }
  return amount.toFixed(8).replace(/\.?0+$/, "");
}

export function minDepositLabelForRate(
  rateToman: number,
  symbol: string,
): string | null {
  const amount = computeMinDepositAmount(rateToman);
  const formatted = formatMinDepositAmount(amount);
  if (!formatted) return null;
  return `${formatted} ${symbol}`;
}

export function depositNetworksForAsset(
  assetId: WalletAssetId,
): NetworkUiMeta[] {
  if (assetId === "toman") return [];
  const ids = ASSET_DEPOSIT_NETWORKS[assetId] ?? [];
  return ids.map((id) => NETWORK_UI[id]);
}

/** Same networks as deposit for withdraw. */
export function withdrawNetworksForAsset(
  assetId: WalletAssetId,
): NetworkUiMeta[] {
  return depositNetworksForAsset(assetId);
}

export type WithdrawFeeInfo = {
  /** Fee charged in the asset unit (0 = free). */
  feeAmount: number;
  /** null = no minimum limit */
  minAmount: number | null;
};

/** Static withdraw fee / min per asset+network (display + client checks). */
export const WITHDRAW_FEE: Partial<
  Record<Exclude<WalletAssetId, "toman">, Partial<Record<WalletNetworkId, WithdrawFeeInfo>>>
> = {
  trx: { tron: { feeAmount: 1.1, minAmount: null } },
  usdt: {
    tron: { feeAmount: 1, minAmount: null },
    bsc: { feeAmount: 0.5, minAmount: null },
    polygon: { feeAmount: 0.5, minAmount: null },
  },
  bnb: { bsc: { feeAmount: 0.001, minAmount: null } },
  matic: { polygon: { feeAmount: 0.5, minAmount: null } },
  gram: { ton: { feeAmount: 0.05, minAmount: null } },
};

export function withdrawFeeFor(
  assetId: WalletAssetId,
  networkId: WalletNetworkId,
): WithdrawFeeInfo {
  if (assetId === "toman") return { feeAmount: 0, minAmount: null };
  return (
    WITHDRAW_FEE[assetId]?.[networkId] ?? { feeAmount: 0, minAmount: null }
  );
}

export function isWalletNetworkId(value: string): value is WalletNetworkId {
  return value in NETWORK_UI;
}
