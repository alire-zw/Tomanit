import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { env } from "../config/env.js";
import { requireAuth, serializeWallet } from "../middleware/auth.js";
import { walletWriteLimiter } from "../lib/rateLimit.js";
import { enforceRateLimit } from "../lib/httpRateLimit.js";
import {
  ASSETS,
  NETWORKS,
  getNetwork,
  isCryptoNetwork,
  isWalletAsset,
  type AssetId,
} from "../lib/walletAssets.js";
import {
  applyConvert,
  applyDeposit,
  applyWithdraw,
  ensureAllDepositAddresses,
  ensureDepositAddress,
  ensureWallet,
  getBalances,
} from "../lib/walletService.js";
import {
  getTronOnChainBalance,
  getTronTrxTransfers,
  getTronUsdtTransfers,
  pingTronGrid,
} from "../lib/tronGrid.js";
import { getEvmOnChainBalance, pingEvm } from "../lib/evmRpc.js";
import { getTonOnChainBalance, pingTonCenter } from "../lib/tonCenter.js";
import { getWalletRates } from "../lib/swapwallet.js";
import { explorerTxUrl } from "../lib/bot/notifyCryptoDeposit.js";
import {
  CHART_RANGES,
  getAssetChart,
  getAssetLineCharts,
  isChartRange,
  isChartStyle,
} from "../lib/swapwalletChart.js";
import { computeAssetPnl } from "../lib/walletPnl.js";
import { getWithdrawLimitsSnapshot } from "../lib/withdrawLimits.js";

const assetSchema = z.string().refine(isWalletAsset, "Invalid asset");
const networkSchema = z.string().refine(isCryptoNetwork, "Invalid network");
const cryptoAssetSchema = z
  .string()
  .refine((v) => isWalletAsset(v) && v !== "toman", "Invalid crypto asset");

export async function walletRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", requireAuth);
  app.addHook("preHandler", async (request, reply) => {
    if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) {
      await enforceRateLimit(walletWriteLimiter)(request, reply);
    }
  });

  app.get("/wallet", async (request) => {
    const wallet = await ensureWallet(request.user!.id);
    return { wallet: serializeWallet(wallet), balances: getBalances(wallet) };
  });

  /** Live TRON chain balances for the user's custodial TRON address. */
  app.get("/wallet/tron/onchain", async (request, reply) => {
    if (!env.TRONGRID_API_KEY) {
      return reply.status(503).send({ error: "TRONGRID_API_KEY not configured" });
    }
    const row = await ensureDepositAddress(request.user!.id, "tron");
    const onchain = await getTronOnChainBalance(row.address);
    return {
      address: row.address,
      network: env.TRON_NETWORK,
      testnet: env.TRON_IS_TESTNET,
      explorerUrl: `${env.TRON_EXPLORER_URL}/#/address/${row.address}`,
      faucetUrl: env.TRON_FAUCET_URL,
      onchain,
      ledger: getBalances(await ensureWallet(request.user!.id)),
    };
  });

  app.get("/wallet/tron/transfers", async (request, reply) => {
    if (!env.TRONGRID_API_KEY) {
      return reply.status(503).send({ error: "TRONGRID_API_KEY not configured" });
    }
    const row = await ensureDepositAddress(request.user!.id, "tron");
    const [usdt, trx] = await Promise.all([
      getTronUsdtTransfers(row.address),
      getTronTrxTransfers(row.address),
    ]);
    return {
      address: row.address,
      transfers: [...usdt, ...trx].sort((a, b) => b.timestamp - a.timestamp),
    };
  });

  app.get("/wallet/tron/ping", async () => pingTronGrid());

  app.get("/wallet/bsc/onchain", async (request) => {
    const row = await ensureDepositAddress(request.user!.id, "bsc");
    const onchain = await getEvmOnChainBalance("bsc", row.address);
    return {
      address: row.address,
      onchain,
      ledger: getBalances(await ensureWallet(request.user!.id)),
    };
  });

  app.get("/wallet/bsc/ping", async () => pingEvm("bsc"));

  app.get("/wallet/polygon/onchain", async (request) => {
    const row = await ensureDepositAddress(request.user!.id, "polygon");
    const onchain = await getEvmOnChainBalance("polygon", row.address);
    return {
      address: row.address,
      onchain,
      ledger: getBalances(await ensureWallet(request.user!.id)),
    };
  });

  app.get("/wallet/polygon/ping", async () => pingEvm("polygon"));

  app.get("/wallet/ton/onchain", async (request, reply) => {
    if (!env.TONCENTER_API_KEY) {
      return reply.status(503).send({ error: "TONCENTER_API_KEY not configured" });
    }
    const row = await ensureDepositAddress(request.user!.id, "ton");
    const onchain = await getTonOnChainBalance(row.address);
    return {
      address: row.address,
      onchain,
      ledger: getBalances(await ensureWallet(request.user!.id)),
    };
  });

  app.get("/wallet/ton/ping", async () => pingTonCenter());

  /** Aggregate live on-chain snapshot for all networks of the current user. */
  app.get("/wallet/onchain", async (request) => {
    const rows = await ensureAllDepositAddresses(request.user!.id);
    const byNet = Object.fromEntries(rows.map((r) => [r.network, r.address]));

    const [tron, bsc, polygon, ton] = await Promise.allSettled([
      byNet.tron && env.TRONGRID_API_KEY
        ? getTronOnChainBalance(byNet.tron)
        : Promise.reject(new Error("tron unavailable")),
      byNet.bsc
        ? getEvmOnChainBalance("bsc", byNet.bsc)
        : Promise.reject(new Error("bsc unavailable")),
      byNet.polygon
        ? getEvmOnChainBalance("polygon", byNet.polygon)
        : Promise.reject(new Error("polygon unavailable")),
      byNet.ton && env.TONCENTER_API_KEY
        ? getTonOnChainBalance(byNet.ton)
        : Promise.reject(new Error("ton unavailable")),
    ]);

    return {
      addresses: byNet,
      onchain: {
        tron: tron.status === "fulfilled" ? tron.value : { error: String(tron.reason?.message ?? tron.reason) },
        bsc: bsc.status === "fulfilled" ? bsc.value : { error: String(bsc.reason?.message ?? bsc.reason) },
        polygon:
          polygon.status === "fulfilled"
            ? polygon.value
            : { error: String(polygon.reason?.message ?? polygon.reason) },
        ton: ton.status === "fulfilled" ? ton.value : { error: String(ton.reason?.message ?? ton.reason) },
      },
      ledger: getBalances(await ensureWallet(request.user!.id)),
    };
  });

  app.get("/wallet/assets", async () => {
    const { rates, changes, source, updatedAt, dayKey } = await getWalletRates();
    return {
      assets: ASSETS.map((a) => ({
        id: a.id,
        symbol: a.symbol,
        networks: a.networks,
        decimals: a.decimals,
        isFiat: a.isFiat,
        rateToman: rates[a.id] ?? a.rateToman,
        changePercent:
          a.id === "toman" ? 0 : (changes[a.id as Exclude<typeof a.id, "toman">] ?? 0),
      })),
      networks: NETWORKS.map((n) => ({
        id: n.id,
        name: n.name,
        assets: n.assets,
      })),
      pricing: { source, updatedAt, dayKey, changes },
    };
  });

  /** Live toman rates from SwapWallet (Redis cache). */
  app.get("/wallet/rates", async (_request, reply) => {
    const { rates, changes, source, updatedAt, dayKey } = await getWalletRates();
    reply.header("Cache-Control", "private, max-age=5");
    return { rates, changes, source, updatedAt, dayKey };
  });

  /** Price chart history from SwapWallet via Redis (line = all ranges; candle = one range). */
  app.get("/wallet/chart", async (request, reply) => {
    const query = z
      .object({
        asset: cryptoAssetSchema,
        range: z.string().optional(),
        style: z.string().default("line"),
      })
      .safeParse(request.query);
    if (!query.success) {
      return reply.status(400).send({ error: "asset query required" });
    }
    const style = query.data.style.toLowerCase();
    if (!isChartStyle(style)) {
      return reply.status(400).send({ error: "invalid style", allowed: ["line", "candle"] });
    }
    try {
      const assetId = query.data.asset as Exclude<AssetId, "toman">;
      reply.header("Cache-Control", "private, max-age=30");
      if (style === "line" && !query.data.range) {
        return await getAssetLineCharts(assetId);
      }
      const rangeRaw = (query.data.range ?? "DAY").toUpperCase();
      if (!isChartRange(rangeRaw)) {
        return reply
          .status(400)
          .send({ error: "invalid range", allowed: CHART_RANGES });
      }
      return await getAssetChart(assetId, rangeRaw, style);
    } catch (err) {
      const status =
        err && typeof err === "object" && "statusCode" in err
          ? Number((err as { statusCode: number }).statusCode)
          : 502;
      const message = err instanceof Error ? err.message : "Chart unavailable";
      return reply.status(Number.isFinite(status) ? status : 502).send({ error: message });
    }
  });

  app.get("/wallet/addresses", async (request) => {
    const rows = await ensureAllDepositAddresses(request.user!.id);
    return {
      addresses: rows.map((r) => ({
        network: r.network,
        address: r.address,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  });

  app.get("/wallet/deposit-address", async (request, reply) => {
    const query = z
      .object({ network: networkSchema })
      .safeParse(request.query);
    if (!query.success) {
      return reply.status(400).send({ error: "network query required" });
    }
    const network = query.data.network;
    const netDef = getNetwork(network)!;
    const row = await ensureDepositAddress(request.user!.id, network);
    return {
      network: row.network,
      address: row.address,
      assets: netDef.assets,
    };
  });

  app.get("/wallet/withdraw-limits", async (request, reply) => {
    const query = z
      .object({ asset: cryptoAssetSchema })
      .safeParse(request.query);
    if (!query.success) {
      return reply.status(400).send({
        error: "Validation failed",
        details: query.error.flatten(),
      });
    }
    const asset = query.data.asset as Exclude<AssetId, "toman">;
    return getWithdrawLimitsSnapshot(request.user!.id, asset);
  });

  app.post("/wallet/withdraw", async (request, reply) => {
    const body = z
      .object({
        asset: assetSchema,
        network: networkSchema.optional().nullable(),
        amount: z.coerce.number().positive(),
        toAddress: z.string().min(8).max(128),
        note: z.string().max(255).optional(),
      })
      .safeParse(request.body);

    if (!body.success) {
      return reply.status(400).send({
        error: "Validation failed",
        details: body.error.flatten(),
      });
    }

    const { asset, amount, toAddress, note } = body.data;
    const network =
      asset === "toman" ? null : (body.data.network ?? null);

    if (asset !== "toman" && !network) {
      return reply.status(400).send({ error: "network required for crypto" });
    }

    try {
      const result = await applyWithdraw({
        userId: request.user!.id,
        asset,
        amount,
        toAddress,
        network,
        note,
      });

      const transaction = serializeTx(result.transaction);
      const txHash = transaction.txHash ?? null;
      return {
        wallet: serializeWallet(result.wallet),
        transaction,
        explorerUrl:
          txHash && network
            ? explorerTxUrl(network, txHash)
            : null,
      };
    } catch (err) {
      const status =
        err instanceof Error && "statusCode" in err
          ? Number((err as { statusCode: number }).statusCode) || 500
          : 500;
      return reply.status(status).send({
        error: err instanceof Error ? err.message : "Withdraw failed",
      });
    }
  });

  /**
   * Dev-only ledger credit for local testing.
   * Production credits must come from verified gateway webhooks or on-chain sync.
   */
  app.post("/wallet/deposit", async (request, reply) => {
    if (env.NODE_ENV === "production") {
      return reply.status(403).send({
        error:
          "Manual deposits are disabled. Use payment gateway or on-chain deposit sync.",
      });
    }

    const body = z
      .object({
        asset: assetSchema,
        network: networkSchema.optional().nullable(),
        amount: z.coerce.number().positive(),
        txHash: z.string().max(128).optional().nullable(),
        fromAddress: z.string().max(128).optional().nullable(),
        toAddress: z.string().max(128).optional().nullable(),
        confirmations: z.coerce.number().int().nonnegative().optional().nullable(),
        blockNumber: z.string().max(32).optional().nullable(),
        note: z.string().max(255).optional(),
        paymentMethod: z
          .enum([
            "card_transfer",
            "sheba_transfer",
            "payment_gateway",
            "manual",
            "crypto",
            "internal",
          ])
          .optional()
          .nullable(),
        bankCardId: z.coerce.number().int().positive().optional().nullable(),
        cardNumber: z.string().max(19).optional().nullable(),
        iban: z.string().max(34).optional().nullable(),
        depositNumber: z.string().max(32).optional().nullable(),
        bankName: z.string().max(128).optional().nullable(),
        gatewayName: z.string().max(64).optional().nullable(),
        gatewayTrackId: z.string().max(128).optional().nullable(),
        gatewayRefId: z.string().max(128).optional().nullable(),
        gatewayAuthority: z.string().max(128).optional().nullable(),
      })
      .safeParse(request.body);

    if (!body.success) {
      return reply.status(400).send({
        error: "Validation failed",
        details: body.error.flatten(),
      });
    }

    const {
      asset,
      amount,
      txHash,
      fromAddress,
      toAddress,
      confirmations,
      blockNumber,
      note,
      paymentMethod,
      bankCardId,
      cardNumber,
      iban,
      depositNumber,
      bankName,
      gatewayName,
      gatewayTrackId,
      gatewayRefId,
      gatewayAuthority,
    } = body.data;
    const network =
      asset === "toman" ? null : (body.data.network ?? null);

    if (asset !== "toman" && !network) {
      return reply.status(400).send({ error: "network required for crypto" });
    }

    const fiat =
      asset === "toman"
        ? {
            paymentMethod:
              paymentMethod === "card_transfer" ||
              paymentMethod === "sheba_transfer" ||
              paymentMethod === "payment_gateway" ||
              paymentMethod === "manual"
                ? paymentMethod
                : ("manual" as const),
            bankCardId,
            cardNumber,
            iban,
            depositNumber,
            bankName,
            gatewayName,
            gatewayTrackId,
            gatewayRefId,
            gatewayAuthority,
          }
        : null;

    const result = await applyDeposit({
      userId: request.user!.id,
      asset,
      amount,
      network,
      txHash,
      fromAddress,
      toAddress,
      confirmations,
      blockNumber,
      note: note ?? (asset === "toman" ? "toman deposit" : "dev/manual deposit"),
      fiat,
    });

    return {
      wallet: serializeWallet(result.wallet),
      transaction: serializeTx(result.transaction),
    };
  });

  app.post("/wallet/convert", async (request, reply) => {
    const body = z
      .object({
        fromAsset: assetSchema,
        toAsset: assetSchema,
        amount: z.coerce.number().positive(),
      })
      .safeParse(request.body);

    if (!body.success) {
      return reply.status(400).send({
        error: "Validation failed",
        details: body.error.flatten(),
      });
    }

    const result = await applyConvert({
      userId: request.user!.id,
      fromAsset: body.data.fromAsset,
      toAsset: body.data.toAsset,
      amount: body.data.amount,
    });

    return {
      wallet: serializeWallet(result.wallet),
      received: result.received,
      transaction: serializeTx(result.transaction),
      transactions: [serializeTx(result.transaction)],
    };
  });

  app.get("/wallet/transactions", async (request, reply) => {
    const query = z
      .object({
        limit: z.coerce.number().int().positive().max(100).optional(),
        asset: assetSchema.optional(),
      })
      .safeParse(request.query);

    if (!query.success) {
      return reply.status(400).send({
        error: "Validation failed",
        details: query.error.flatten(),
      });
    }

    const limit = query.data.limit ?? 50;
    const asset = query.data.asset;
    const txs = await prisma.walletTransaction.findMany({
      where: {
        userId: request.user!.id,
        ...(asset
          ? {
              OR: [
                { asset },
                { counterAsset: asset },
                { feeAsset: asset },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return {
      transactions: txs.map(serializeTx),
    };
  });

  /** Unrealized P/L for one crypto holding (average-cost basis vs live rate). */
  app.get("/wallet/assets/:asset/pnl", async (request, reply) => {
    const params = cryptoAssetSchema.safeParse(
      (request.params as { asset?: string }).asset,
    );
    if (!params.success) {
      return reply.status(400).send({ error: "Invalid asset" });
    }
    try {
      const pnl = await computeAssetPnl(request.user!.id, params.data as AssetId);
      return { pnl };
    } catch (err) {
      const status =
        err instanceof Error && "statusCode" in err
          ? Number((err as { statusCode: number }).statusCode) || 500
          : 500;
      return reply.status(status).send({
        error: err instanceof Error ? err.message : "PnL failed",
      });
    }
  });
}

function serializeTx(tx: {
  id: number;
  code?: string;
  type: string;
  asset: string;
  amount: number;
  counterAsset?: string | null;
  counterAmount?: number | null;
  unitPriceToman?: number | null;
  counterUnitPriceToman?: number | null;
  amountToman?: number | null;
  status: string;
  note: string | null;
  failReason?: string | null;
  network: string | null;
  toAddress: string | null;
  fromAddress: string | null;
  txHash: string | null;
  confirmations?: number | null;
  blockNumber?: string | null;
  fee: number | null;
  feeAsset?: string | null;
  feeToman?: number | null;
  paymentMethod?: string | null;
  bankCardId?: number | null;
  cardNumberMasked?: string | null;
  iban?: string | null;
  depositNumber?: string | null;
  bankName?: string | null;
  gatewayName?: string | null;
  gatewayTrackId?: string | null;
  gatewayRefId?: string | null;
  gatewayAuthority?: string | null;
  groupId?: string | null;
  relatedTxId?: number | null;
  balanceAfter?: number | null;
  metadata?: unknown;
  createdAt: Date;
  updatedAt?: Date;
  completedAt?: Date | null;
}) {
  return {
    id: String(tx.id),
    code: tx.code ?? String(tx.id),
    type: tx.type,
    asset: tx.asset,
    amount: tx.amount,
    counterAsset: tx.counterAsset ?? null,
    counterAmount: tx.counterAmount ?? null,
    unitPriceToman: tx.unitPriceToman ?? null,
    counterUnitPriceToman: tx.counterUnitPriceToman ?? null,
    amountToman: tx.amountToman ?? null,
    status: tx.status,
    note: tx.note,
    failReason: tx.failReason ?? null,
    network: tx.network,
    toAddress: tx.toAddress,
    fromAddress: tx.fromAddress,
    txHash: tx.txHash,
    confirmations: tx.confirmations ?? null,
    blockNumber: tx.blockNumber ?? null,
    fee: tx.fee,
    feeAsset: tx.feeAsset ?? null,
    feeToman: tx.feeToman ?? null,
    paymentMethod: tx.paymentMethod ?? null,
    bankCardId: tx.bankCardId != null ? String(tx.bankCardId) : null,
    cardNumberMasked: tx.cardNumberMasked ?? null,
    iban: tx.iban ?? null,
    depositNumber: tx.depositNumber ?? null,
    bankName: tx.bankName ?? null,
    gatewayName: tx.gatewayName ?? null,
    gatewayTrackId: tx.gatewayTrackId ?? null,
    gatewayRefId: tx.gatewayRefId ?? null,
    gatewayAuthority: tx.gatewayAuthority ?? null,
    groupId: tx.groupId ?? null,
    relatedTxId: tx.relatedTxId != null ? String(tx.relatedTxId) : null,
    balanceAfter: tx.balanceAfter ?? null,
    metadata: tx.metadata ?? null,
    createdAt: tx.createdAt.toISOString(),
    updatedAt: tx.updatedAt?.toISOString() ?? tx.createdAt.toISOString(),
    completedAt: tx.completedAt?.toISOString() ?? null,
  };
}
