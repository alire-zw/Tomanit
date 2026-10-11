import type {
  CryptoNetwork,
  Prisma,
  Wallet,
  WalletAsset,
  WalletDepositAddress,
  WalletPaymentMethod,
  WalletTransaction,
} from "@prisma/client";
import { prisma } from "../db/prisma.js";
import {
  assetSupportedOnNetwork,
  getAsset,
  NETWORKS,
  type AssetId,
  type NetworkId,
} from "./walletAssets.js";
import { convertAmountLive, getAssetRateToman } from "./swapwallet.js";
import {
  decryptPrivateKey,
  encryptPrivateKey,
  generateNetworkWallet,
  validateAddress,
} from "./walletCrypto.js";
import { notifyCryptoDeposit } from "./bot/notifyCryptoDeposit.js";
import {
  getOnChainAssetAmount,
  sendOnChainAsset,
  userDepositCanFundWithdraw,
} from "./walletChainTransfer.js";
import { log } from "./log.js";
import {
  assertCryptoWithdrawAllowed,
  assertKycWithdrawCaps,
} from "./withdrawLimits.js";

export type BalanceMap = {
  toman: string;
  trx: number;
  usdt: number;
  bnb: number;
  matic: number;
  gram: number;
};

const FLOAT_ASSETS = ["trx", "usdt", "bnb", "matic", "gram"] as const;
type FloatAsset = (typeof FLOAT_ASSETS)[number];

export function getBalanceField(asset: WalletAsset): keyof Wallet {
  switch (asset) {
    case "toman":
      return "tomanBalance";
    case "trx":
      return "trxBalance";
    case "usdt":
      return "usdtBalance";
    case "bnb":
      return "bnbBalance";
    case "matic":
      return "maticBalance";
    case "gram":
      return "gramBalance";
    default: {
      const _exhaustive: never = asset;
      return _exhaustive;
    }
  }
}

export function getBalances(wallet: Wallet): BalanceMap {
  return {
    toman: wallet.tomanBalance.toString(),
    trx: wallet.trxBalance,
    usdt: wallet.usdtBalance,
    bnb: wallet.bnbBalance,
    matic: wallet.maticBalance,
    gram: wallet.gramBalance,
  };
}

function readFloatBalance(wallet: Wallet, asset: FloatAsset): number {
  return wallet[getBalanceField(asset) as keyof Wallet] as number;
}

export function readAssetBalance(wallet: Wallet, asset: WalletAsset): number {
  if (asset === "toman") return Number(wallet.tomanBalance);
  return readFloatBalance(wallet, asset as FloatAsset);
}

export function maskCardNumber(cardNumber: string): string {
  const digits = cardNumber.replace(/\D/g, "");
  if (digits.length < 8) return digits;
  return `${digits.slice(0, 4)} **** **** ${digits.slice(-4)}`;
}

async function resolveUnitPriceToman(asset: WalletAsset): Promise<number | null> {
  if (asset === "toman") return 1;
  try {
    return await getAssetRateToman(asset as AssetId);
  } catch {
    return null;
  }
}

/** USDT/IRT rate snapshot for fiat↔USD display on history rows. */
async function resolveUsdtRateToman(): Promise<number | null> {
  try {
    const rate = await getAssetRateToman("usdt");
    return rate > 0 ? rate : null;
  } catch {
    return null;
  }
}

export async function ensureWallet(userId: number): Promise<Wallet> {
  const existing = await prisma.wallet.findUnique({ where: { userId } });
  if (existing) return existing;
  return prisma.wallet.create({ data: { userId } });
}

export async function ensureDepositAddress(
  userId: number,
  network: CryptoNetwork,
): Promise<WalletDepositAddress> {
  await ensureWallet(userId);

  const existing = await prisma.walletDepositAddress.findUnique({
    where: { userId_network: { userId, network } },
  });
  if (existing) return existing;

  const generated = generateNetworkWallet(network);
  const privateKeyEnc = encryptPrivateKey(generated.privateKey);

  try {
    return await prisma.walletDepositAddress.create({
      data: {
        userId,
        network,
        address: generated.address,
        privateKeyEnc,
      },
    });
  } catch (err) {
    // Race: another request created it
    const again = await prisma.walletDepositAddress.findUnique({
      where: { userId_network: { userId, network } },
    });
    if (again) return again;
    throw err;
  }
}

export async function ensureAllDepositAddresses(
  userId: number,
): Promise<WalletDepositAddress[]> {
  const rows: WalletDepositAddress[] = [];
  for (const net of NETWORKS) {
    rows.push(await ensureDepositAddress(userId, net.id));
  }
  return rows;
}

type TxClient = Prisma.TransactionClient;

async function creditAsset(
  tx: TxClient,
  wallet: Wallet,
  asset: WalletAsset,
  amount: number,
): Promise<Wallet> {
  if (!(amount > 0) || !Number.isFinite(amount)) {
    throw Object.assign(new Error("Invalid amount"), { statusCode: 400 });
  }

  if (asset === "toman") {
    const delta = BigInt(Math.round(amount));
    if (delta <= 0n) {
      throw Object.assign(new Error("Invalid amount"), { statusCode: 400 });
    }
    return tx.wallet.update({
      where: { id: wallet.id },
      data: { tomanBalance: { increment: delta } },
    });
  }

  const field = getBalanceField(asset);
  return tx.wallet.update({
    where: { id: wallet.id },
    data: { [field]: { increment: amount } },
  });
}

async function debitAsset(
  tx: TxClient,
  wallet: Wallet,
  asset: WalletAsset,
  amount: number,
): Promise<Wallet> {
  if (!(amount > 0) || !Number.isFinite(amount)) {
    throw Object.assign(new Error("Invalid amount"), { statusCode: 400 });
  }

  if (asset === "toman") {
    const delta = BigInt(Math.round(amount));
    if (delta <= 0n) {
      throw Object.assign(new Error("Invalid amount"), { statusCode: 400 });
    }
    const result = await tx.wallet.updateMany({
      where: { id: wallet.id, tomanBalance: { gte: delta } },
      data: { tomanBalance: { decrement: delta } },
    });
    if (result.count !== 1) {
      throw Object.assign(new Error("Insufficient balance"), { statusCode: 400 });
    }
    return tx.wallet.findUniqueOrThrow({ where: { id: wallet.id } });
  }

  const field = getBalanceField(asset);
  const result = await tx.wallet.updateMany({
    where: { id: wallet.id, [field]: { gte: amount } },
    data: { [field]: { decrement: amount } },
  });
  if (result.count !== 1) {
    throw Object.assign(new Error("Insufficient balance"), { statusCode: 400 });
  }
  return tx.wallet.findUniqueOrThrow({ where: { id: wallet.id } });
}

export type LedgerResult = {
  wallet: Wallet;
  transaction: WalletTransaction;
};

export type FiatDepositDetails = {
  paymentMethod: Extract<
    WalletPaymentMethod,
    "card_transfer" | "sheba_transfer" | "payment_gateway" | "manual"
  >;
  bankCardId?: number | null;
  cardNumber?: string | null;
  iban?: string | null;
  depositNumber?: string | null;
  bankName?: string | null;
  gatewayName?: string | null;
  gatewayTrackId?: string | null;
  gatewayRefId?: string | null;
  gatewayAuthority?: string | null;
};

export async function applyDeposit(params: {
  userId: number;
  asset: AssetId;
  amount: number;
  network?: NetworkId | null;
  txHash?: string | null;
  fromAddress?: string | null;
  toAddress?: string | null;
  confirmations?: number | null;
  blockNumber?: string | null;
  note?: string | null;
  fiat?: FiatDepositDetails | null;
  metadata?: Prisma.InputJsonValue | null;
}): Promise<LedgerResult> {
  const { userId, asset, amount } = params;
  const network = params.network ?? null;

  if (!getAsset(asset)) {
    throw Object.assign(new Error("Unknown asset"), { statusCode: 400 });
  }
  if (!assetSupportedOnNetwork(asset, network)) {
    throw Object.assign(new Error("Asset not supported on this network"), {
      statusCode: 400,
    });
  }

  const unitPriceToman = await resolveUnitPriceToman(asset);
  const amountToman =
    unitPriceToman != null ? unitPriceToman * amount : null;
  const usdtRateToman = await resolveUsdtRateToman();

  const fiat = params.fiat ?? null;
  let paymentMethod: WalletPaymentMethod =
    asset === "toman" ? (fiat?.paymentMethod ?? "manual") : "crypto";

  let bankCardId: number | null = fiat?.bankCardId ?? null;
  let cardNumberMasked: string | null = fiat?.cardNumber
    ? maskCardNumber(fiat.cardNumber)
    : null;
  let iban: string | null = fiat?.iban?.trim() || null;
  let depositNumber: string | null = fiat?.depositNumber?.trim() || null;
  let bankName: string | null = fiat?.bankName?.trim() || null;

  if (bankCardId != null) {
    const card = await prisma.bankCard.findFirst({
      where: { id: bankCardId, userId, revokedAt: null },
    });
    if (!card) {
      throw Object.assign(new Error("Bank card not found"), { statusCode: 404 });
    }
    cardNumberMasked = maskCardNumber(card.cardNumber);
    iban = iban ?? card.iban;
    depositNumber = depositNumber ?? card.depositNumber;
    bankName = bankName ?? card.bankName;
    if (!fiat?.paymentMethod) {
      paymentMethod = card.iban ? "sheba_transfer" : "card_transfer";
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    if (params.txHash && network) {
      const dup = await tx.walletTransaction.findFirst({
        where: { network, txHash: params.txHash },
        select: { id: true },
      });
      if (dup) {
        throw Object.assign(new Error("Transaction already credited"), {
          statusCode: 409,
        });
      }
    }

    const wallet =
      (await tx.wallet.findUnique({ where: { userId } })) ??
      (await tx.wallet.create({ data: { userId } }));

    const updated = await creditAsset(tx, wallet, asset, amount);
    const now = new Date();
    const transaction = await tx.walletTransaction.create({
      data: {
        userId,
        type: "deposit",
        asset,
        amount,
        status: "completed",
        unitPriceToman,
        /** Snapshot USDT/IRT for history fiat↔USD equivalents (non-convert). */
        counterUnitPriceToman: usdtRateToman,
        amountToman,
        network,
        txHash: params.txHash ?? null,
        fromAddress: params.fromAddress ?? null,
        toAddress: params.toAddress ?? null,
        confirmations: params.confirmations ?? null,
        blockNumber: params.blockNumber ?? null,
        paymentMethod,
        bankCardId,
        cardNumberMasked,
        iban,
        depositNumber,
        bankName,
        gatewayName: fiat?.gatewayName ?? null,
        gatewayTrackId: fiat?.gatewayTrackId ?? null,
        gatewayRefId: fiat?.gatewayRefId ?? null,
        gatewayAuthority: fiat?.gatewayAuthority ?? null,
        balanceAfter: readAssetBalance(updated, asset),
        note: params.note ?? "deposit",
        metadata: params.metadata ?? undefined,
        completedAt: now,
      },
    });
    return { wallet: updated, transaction };
  });

  if (asset !== "toman") {
    void notifyCryptoDeposit({
      userId,
      asset,
      amount,
      amountToman,
      network,
      fromAddress: params.fromAddress ?? null,
      txHash: params.txHash ?? null,
    });
  }

  return result;
}

async function getActiveMasterWallet(asset: AssetId, network: NetworkId) {
  return prisma.assetMasterWallet.findFirst({
    where: { asset, network, isActive: true },
  });
}

/**
 * Crypto withdraw: real on-chain send from the user's deposit wallet when possible,
 * otherwise from the asset master wallet (after sweep). Claim balance is debited
 * only after a successful broadcast.
 */
export async function applyWithdraw(params: {
  userId: number;
  asset: AssetId;
  amount: number;
  toAddress: string;
  network?: NetworkId | null;
  note?: string | null;
  fee?: number | null;
  fiat?: FiatDepositDetails | null;
}): Promise<LedgerResult> {
  const { userId, asset, amount, toAddress } = params;
  const network = params.network ?? null;
  const assetDef = getAsset(asset);

  if (!assetDef) {
    throw Object.assign(new Error('Unknown asset'), { statusCode: 400 });
  }
  if (!assetSupportedOnNetwork(asset, network)) {
    throw Object.assign(new Error('Asset not supported on this network'), {
      statusCode: 400,
    });
  }
  if (asset !== 'toman' && !validateAddress(network, toAddress)) {
    throw Object.assign(new Error('Invalid destination address'), {
      statusCode: 400,
    });
  }

  const unitPriceToman = await resolveUnitPriceToman(asset);
  const amountToman =
    unitPriceToman != null ? unitPriceToman * amount : null;
  const usdtRateToman = await resolveUsdtRateToman();
  const fee = params.fee ?? null;
  const feeToman =
    fee != null && unitPriceToman != null ? fee * unitPriceToman : null;

  const fiat = params.fiat ?? null;
  const paymentMethod: WalletPaymentMethod =
    asset === 'toman'
      ? (fiat?.paymentMethod ?? 'sheba_transfer')
      : 'crypto';

  if (asset === 'toman') {
    await assertKycWithdrawCaps({ userId, amountToman: amount });

    return prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({ where: { userId } });
      if (!wallet) {
        throw Object.assign(new Error('Wallet not found'), { statusCode: 404 });
      }
      await debitAsset(tx, wallet, asset, amount);
      const after = await tx.wallet.findUniqueOrThrow({ where: { userId } });
      const transaction = await tx.walletTransaction.create({
        data: {
          userId,
          type: 'withdraw',
          asset,
          amount,
          status: 'completed',
          unitPriceToman,
          counterUnitPriceToman: usdtRateToman,
          amountToman,
          fee,
          feeAsset: fee != null ? asset : null,
          feeToman,
          network: null,
          toAddress: toAddress.trim(),
          paymentMethod,
          bankCardId: fiat?.bankCardId ?? null,
          cardNumberMasked: fiat?.cardNumber
            ? maskCardNumber(fiat.cardNumber)
            : null,
          iban: fiat?.iban ?? null,
          depositNumber: fiat?.depositNumber ?? null,
          bankName: fiat?.bankName ?? null,
          balanceAfter: readAssetBalance(after, asset),
          completedAt: new Date(),
          note: params.note ?? 'toman withdraw',
        },
      });
      return { wallet: after, transaction };
    });
  }

  if (!network) {
    throw Object.assign(new Error('network required for crypto'), {
      statusCode: 400,
    });
  }

  const wallet = await prisma.wallet.findUnique({ where: { userId } });
  if (!wallet) {
    throw Object.assign(new Error('Wallet not found'), { statusCode: 404 });
  }
  const claim = readAssetBalance(wallet, asset);
  if (!(claim >= amount)) {
    throw Object.assign(new Error('Insufficient balance'), { statusCode: 400 });
  }

  await assertCryptoWithdrawAllowed({
    userId,
    asset: asset as Exclude<AssetId, "toman">,
    amount,
    amountToman,
  });

  const userDeposit = await ensureDepositAddress(userId, network);
  if (!userDeposit.privateKeyEnc) {
    throw Object.assign(new Error('User wallet key missing'), {
      statusCode: 500,
    });
  }

  const pending = await prisma.walletTransaction.create({
    data: {
      userId,
      type: 'withdraw',
      asset,
      amount,
      status: 'processing',
      unitPriceToman,
      counterUnitPriceToman: usdtRateToman,
      amountToman,
      fee,
      feeAsset: fee != null ? asset : null,
      feeToman,
      network,
      fromAddress: userDeposit.address,
      toAddress: toAddress.trim(),
      paymentMethod,
      note: params.note ?? 'on-chain withdraw',
    },
  });

  try {
    const dest = toAddress.trim();
    const userKey = decryptPrivateKey(userDeposit.privateKeyEnc);
    const userFund = await userDepositCanFundWithdraw({
      asset,
      network,
      address: userDeposit.address,
      amount,
    });

    let sendResult: Awaited<ReturnType<typeof sendOnChainAsset>> | null = null;

    // 1) Prefer user's own deposit wallet when it holds the asset (+ gas).
    if (userFund.ok) {
      try {
        sendResult = await sendOnChainAsset({
          asset,
          network,
          fromPrivateKey: userKey,
          toAddress: dest,
          amount,
          source: "user",
        });
        log.info(
          "withdraw",
          `user:${userId} ${asset}/${network} source=user onChain=${userFund.assetOnChain}`,
        );
      } catch (userSendErr) {
        const msg =
          userSendErr instanceof Error ? userSendErr.message : "user send failed";
        log.warn(
          "withdraw",
          `user:${userId} ${asset}/${network} user-wallet send failed → master (${msg})`,
        );
      }
    } else {
      log.info(
        "withdraw",
        `user:${userId} ${asset}/${network} source=master reason=${userFund.reason ?? "n/a"} onChain=${userFund.assetOnChain}`,
      );
    }

    // 2) Otherwise (or if user send failed) pay from the asset master wallet.
    if (!sendResult) {
      const master = await getActiveMasterWallet(asset, network);
      if (!master?.privateKeyEnc) {
        const hint =
          userFund.reason === "insufficient_user_fee_reserve"
            ? " User wallet has the asset but not enough left for network fees — configure a master wallet or withdraw a smaller amount."
            : userFund.reason === "insufficient_user_gas"
              ? " User wallet needs native gas (TRX/BNB/MATIC) for the token send, or configure a master wallet."
              : userFund.ok
                ? " User wallet send failed."
                : " User on-chain balance is insufficient (likely swept).";
        throw Object.assign(
          new Error(
            `No active master wallet configured for ${asset}/${network}.${hint}`,
          ),
          { statusCode: 503 },
        );
      }
      const masterOnChain = await getOnChainAssetAmount({
        asset,
        network,
        address: master.address,
      });
      if (masterOnChain + 1e-12 < amount) {
        throw Object.assign(
          new Error("Insufficient on-chain liquidity for withdraw"),
          { statusCode: 503 },
        );
      }
      sendResult = await sendOnChainAsset({
        asset,
        network,
        fromPrivateKey: decryptPrivateKey(master.privateKeyEnc),
        toAddress: dest,
        amount,
        source: "master",
      });
      log.info(
        "withdraw",
        `user:${userId} ${asset}/${network} source=master onChain=${masterOnChain}`,
      );
    }

    return prisma.$transaction(async (tx) => {
      const current = await tx.wallet.findUniqueOrThrow({ where: { userId } });
      await debitAsset(tx, current, asset, amount);
      const after = await tx.wallet.findUniqueOrThrow({ where: { userId } });
      const transaction = await tx.walletTransaction.update({
        where: { id: pending.id },
        data: {
          status: "completed",
          fromAddress: sendResult!.fromAddress,
          toAddress: sendResult!.toAddress,
          txHash: sendResult!.txHash,
          balanceAfter: readAssetBalance(after, asset),
          completedAt: new Date(),
          note:
            params.note ??
            (sendResult!.source === "master"
              ? "on-chain withdraw from master wallet"
              : "on-chain withdraw from user wallet"),
        },
      });
      return { wallet: after, transaction };
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Withdraw failed';
    log.warn("withdraw", `user:${userId} ${asset}/${network} — ${message}`);
    await prisma.walletTransaction.update({
      where: { id: pending.id },
      data: {
        status: 'failed',
        note: message.slice(0, 250),
      },
    });
    throw Object.assign(new Error(message), {
      statusCode:
        err instanceof Error && 'statusCode' in err
          ? Number((err as { statusCode: number }).statusCode) || 500
          : 500,
    });
  }
}

export async function applyConvert(params: {
  userId: number;
  fromAsset: AssetId;
  toAsset: AssetId;
  amount: number;
}): Promise<{
  wallet: Wallet;
  transaction: WalletTransaction;
  received: number;
}> {
  const { userId, fromAsset, toAsset, amount } = params;

  if (fromAsset === toAsset) {
    throw Object.assign(new Error("Cannot convert asset to itself"), {
      statusCode: 400,
    });
  }
  if (!getAsset(fromAsset) || !getAsset(toAsset)) {
    throw Object.assign(new Error("Unknown asset"), { statusCode: 400 });
  }

  const quote = await convertAmountLive(fromAsset, toAsset, amount);
  if (!(quote.received > 0)) {
    throw Object.assign(new Error("Converted amount too small"), {
      statusCode: 400,
    });
  }

  return prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.findUnique({ where: { userId } });
    if (!wallet) {
      throw Object.assign(new Error("Wallet not found"), { statusCode: 404 });
    }

    await debitAsset(tx, wallet, fromAsset, amount);
    const afterDebit = await tx.wallet.findUniqueOrThrow({ where: { userId } });
    await creditAsset(tx, afterDebit, toAsset, quote.received);

    const updated = await tx.wallet.findUniqueOrThrow({ where: { userId } });
    const now = new Date();
    const transaction = await tx.walletTransaction.create({
      data: {
        userId,
        type: "convert",
        asset: fromAsset,
        amount,
        counterAsset: toAsset,
        counterAmount: quote.received,
        unitPriceToman: quote.fromRate,
        counterUnitPriceToman: quote.toRate,
        amountToman: quote.amountToman,
        paymentMethod: "internal",
        status: "completed",
        balanceAfter: readAssetBalance(updated, fromAsset),
        note: `convert ${fromAsset} → ${toAsset}`,
        completedAt: now,
        metadata: {
          fromAsset,
          toAsset,
          fromAmount: amount,
          toAmount: quote.received,
          fromRate: quote.fromRate,
          toRate: quote.toRate,
        },
      },
    });

    return { wallet: updated, transaction, received: quote.received };
  });
}
