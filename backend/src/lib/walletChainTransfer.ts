import type { CryptoNetwork, WalletAsset } from "@prisma/client";
import { getEvmOnChainBalance, type EvmNetwork } from "./evmRpc.js";
import {
  EVM_FEE_RESERVE,
  EVM_WITHDRAW_RESERVE,
  privateKeyToEvmAddress,
  sendEvmNative,
  sendEvmUsdt,
} from "./evmSend.js";
import { getTronOnChainBalance } from "./tronGrid.js";
import {
  privateKeyToTronAddress,
  sendTrc20Usdt,
  sendTrx,
  TRON_FEE_RESERVE_TRX,
  TRON_TOKEN_GAS_RESERVE_TRX,
  TRON_WITHDRAW_RESERVE_TRX,
} from "./tronSend.js";
import { assetSupportedOnNetwork, type AssetId, type NetworkId } from "./walletAssets.js";

export type ChainSendResult = {
  txHash: string;
  fromAddress: string;
  toAddress: string;
  source: "user" | "master";
};

export async function getOnChainAssetAmount(params: {
  asset: AssetId;
  network: NetworkId;
  address: string;
}): Promise<number> {
  const { asset, network, address } = params;
  if (!assetSupportedOnNetwork(asset, network)) return 0;

  if (network === "tron") {
    const bal = await getTronOnChainBalance(address);
    if (asset === "trx") return bal.trx;
    if (asset === "usdt") return bal.usdt;
    return 0;
  }

  if (network === "bsc" || network === "polygon") {
    const bal = await getEvmOnChainBalance(network, address);
    if (asset === "bnb" && network === "bsc") return bal.native;
    if (asset === "matic" && network === "polygon") return bal.native;
    if (asset === "usdt") return bal.usdt;
    return 0;
  }

  // TON / GRAM on-chain send not implemented yet
  return 0;
}

export function feeReserveFor(asset: AssetId, network: NetworkId): number {
  if (network === "tron") {
    return asset === "trx" ? TRON_FEE_RESERVE_TRX : 0;
  }
  if (network === "bsc" || network === "polygon") {
    if (asset === "bnb" || asset === "matic") {
      return EVM_FEE_RESERVE[network];
    }
  }
  return 0;
}

/** Fee buffer when deciding if the user wallet can fund a withdraw (Trust Max-style). */
export function withdrawReserveFor(asset: AssetId, network: NetworkId): number {
  if (network === "tron" && asset === "trx") {
    return TRON_WITHDRAW_RESERVE_TRX;
  }
  if (network === "bsc" || network === "polygon") {
    if (asset === "bnb" || asset === "matic") {
      return EVM_WITHDRAW_RESERVE[network];
    }
  }
  return 0;
}

function tronTokenGasReserve(): number {
  return TRON_TOKEN_GAS_RESERVE_TRX;
}

/**
 * Whether the user's deposit address can fund an on-chain withdraw of `amount`.
 * - Must hold enough of the asset on-chain.
 * - Native coins must keep a small fee dust after the send (not the large sweep reserve).
 * - Tokens also need enough native gas on the same address.
 */
export async function userDepositCanFundWithdraw(params: {
  asset: AssetId;
  network: NetworkId;
  address: string;
  amount: number;
}): Promise<{ ok: boolean; assetOnChain: number; reason?: string }> {
  const { asset, network, address, amount } = params;
  const assetOnChain = await getOnChainAssetAmount({ asset, network, address });
  if (!(assetOnChain + 1e-12 >= amount)) {
    return {
      ok: false,
      assetOnChain,
      reason: "insufficient_user_asset",
    };
  }

  // Native: leave a small dust after sending (sweep uses a larger reserve separately).
  if (asset === "trx" || asset === "bnb" || asset === "matic") {
    const reserve = withdrawReserveFor(asset, network);
    if (!(assetOnChain + 1e-12 >= amount + reserve)) {
      return {
        ok: false,
        assetOnChain,
        reason: "insufficient_user_fee_reserve",
      };
    }
    return { ok: true, assetOnChain };
  }

  // Tokens: need native gas on the deposit address.
  if (asset === "usdt") {
    if (network === "tron") {
      const trx = await getOnChainAssetAmount({
        asset: "trx",
        network: "tron",
        address,
      });
      if (!(trx + 1e-12 >= tronTokenGasReserve())) {
        return {
          ok: false,
          assetOnChain,
          reason: "insufficient_user_gas",
        };
      }
      return { ok: true, assetOnChain };
    }
    if (network === "bsc" || network === "polygon") {
      const nativeAsset = network === "bsc" ? "bnb" : "matic";
      const native = await getOnChainAssetAmount({
        asset: nativeAsset,
        network,
        address,
      });
      const reserve = withdrawReserveFor(nativeAsset, network);
      if (!(native + 1e-12 >= reserve)) {
        return {
          ok: false,
          assetOnChain,
          reason: "insufficient_user_gas",
        };
      }
      return { ok: true, assetOnChain };
    }
  }

  return { ok: true, assetOnChain };
}

export function addressFromPrivateKey(
  network: CryptoNetwork,
  privateKey: string,
): string {
  if (network === "tron") return privateKeyToTronAddress(privateKey);
  if (network === "bsc" || network === "polygon") {
    return privateKeyToEvmAddress(privateKey);
  }
  throw Object.assign(new Error("Unsupported network for key derivation"), {
    statusCode: 400,
  });
}

export async function sendOnChainAsset(params: {
  asset: WalletAsset;
  network: CryptoNetwork;
  fromPrivateKey: string;
  toAddress: string;
  amount: number;
  source: "user" | "master";
}): Promise<ChainSendResult> {
  const { asset, network, fromPrivateKey, toAddress, amount, source } = params;

  if (network === "ton" || asset === "gram" || asset === "toman") {
    throw Object.assign(
      new Error("On-chain withdraw is not supported for this asset/network yet"),
      { statusCode: 501 },
    );
  }

  if (network === "tron") {
    if (asset === "trx") {
      const sent = await sendTrx({
        fromPrivateKey,
        toAddress,
        amountTrx: amount,
      });
      return { ...sent, source };
    }
    if (asset === "usdt") {
      const sent = await sendTrc20Usdt({
        fromPrivateKey,
        toAddress,
        amountUsdt: amount,
      });
      return { ...sent, source };
    }
  }

  if (network === "bsc" || network === "polygon") {
    const evmNet = network as EvmNetwork;
    if (
      (asset === "bnb" && network === "bsc") ||
      (asset === "matic" && network === "polygon")
    ) {
      const sent = await sendEvmNative({
        network: evmNet,
        fromPrivateKey,
        toAddress,
        amount,
      });
      return { ...sent, source };
    }
    if (asset === "usdt") {
      const sent = await sendEvmUsdt({
        network: evmNet,
        fromPrivateKey,
        toAddress,
        amountUsdt: amount,
      });
      return { ...sent, source };
    }
  }

  throw Object.assign(
    new Error("Asset/network combination not supported for on-chain send"),
    { statusCode: 400 },
  );
}
