import { createHash } from "node:crypto";
import { config } from "dotenv";
import { z } from "zod";

config();

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(2344),
  /**
   * Database engine. Change this + run `npm run db:sync` then `npm run db:push`.
   * - mysql (default / XAMPP)
   * - postgresql
   */
  DB_PROVIDER: z.enum(["mysql", "postgresql"]).default("mysql"),
  DB_HOST: z.string().default("localhost"),
  DB_PORT: z.coerce.number().int().positive().optional(),
  DB_NAME: z.string().min(1).default("tomanit"),
  DB_USER: z.string().min(1).default("root"),
  DB_PASSWORD: z.string().default(""),
  /** Optional override; if set, skips building URL from DB_* parts. */
  DATABASE_URL: z.string().optional(),
  /** Telegram bot token for Mini App initData validation + webhook */
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  /**
   * Bot @username without @ (optional — resolved via getMe on boot if empty).
   * Used for t.me deep links to the Mini App.
   */
  TELEGRAM_BOT_USERNAME: z.string().optional(),
  /**
   * Direct-link Mini App short name from BotFather (e.g. "app").
   * If empty, uses Main Mini App form: https://t.me/<bot>?startapp=…
   * If set: https://t.me/<bot>/<short>?startapp=…
   */
  TELEGRAM_MINI_APP_SHORT_NAME: z.string().optional(),
  /** Optional Bot API root when api.telegram.org is blocked */
  TELEGRAM_API_ROOT: z.string().url().default("https://api.telegram.org"),
  /** HTTP(S) proxy for Bot API (Clash/V2Ray). Falls back to WinINET on Windows. */
  TELEGRAM_PROXY: z.string().optional(),
  /** Separate bot that sends successful shop transactions to shop owners. */
  SHOP_REPORT_BOT_TOKEN: z.string().optional(),
  /** Report bot @username without @ (optional — resolved via getMe). */
  SHOP_REPORT_BOT_USERNAME: z.string().optional(),
  /** Public backend base URL (no trailing slash) */
  PUBLIC_URL: z.string().url(),
  /** Mini App frontend URL */
  MINI_APP_URL: z.string().url(),
  WEBHOOK_PATH: z.string().default("/telegram/webhook"),
  WEBHOOK_SECRET: z.string().min(8).optional(),
  FORCE_WEBHOOK_SYNC: z
    .string()
    .optional()
    .transform((v) => v === "1" || v === "true"),
  /** initData max age in seconds (default 1h) */
  AUTH_MAX_AGE_SEC: z.coerce.number().int().positive().default(3_600),
  /** Redis for user/me cache */
  REDIS_URL: z.string().default("redis://localhost:6379"),
  /** Jibit Identicator (inquiry) API */
  JIBIT_API_KEY: z.string().optional(),
  JIBIT_SECRET_KEY: z.string().optional(),
  JIBIT_IDE_BASE_URL: z.string().url().default("https://napi.jibit.ir/ide/v1"),
  /**
   * Iranian exit proxy for Jibit Identicator (card/national-id matching).
   * socks5:// or http:// — falls back to GATEWAY_PROXY when unset.
   */
  JIBIT_PROXY: z.string().optional(),
  /**
   * 32-byte hex key for AES-256-GCM wallet private-key encryption.
   * Required in production. In development, derived from TELEGRAM_BOT_TOKEN if unset.
   */
  WALLET_MASTER_KEY: z.string().optional(),
  /**
   * TRON network: mainnet | nile | shasta
   * Nile/Shasta for safe deposit testing (faucets).
   */
  TRON_NETWORK: z.enum(["mainnet", "nile", "shasta"]).default("mainnet"),
  /** TronGrid API (TRON balances / TRC20) — optional override of preset URL */
  TRONGRID_API_KEY: z.string().optional(),
  TRONGRID_BASE_URL: z.string().url().optional(),
  TRON_USDT_CONTRACT: z.string().optional(),
  /** Ankr / EVM RPC */
  ANKR_API_KEY: z.string().optional(),
  BSC_RPC_URL: z.string().optional(),
  POLYGON_RPC_URL: z.string().optional(),
  BSC_USDT_CONTRACT: z
    .string()
    .default("0x55d398326f99059fF775485246999027B3197955"),
  POLYGON_USDT_CONTRACT: z
    .string()
    .default("0xc2132D05D31c914a87C6611C10748AEb04B58e8F"),
  /** TonCenter */
  TONCENTER_API_KEY: z.string().optional(),
  TONCENTER_BASE_URL: z.string().url().default("https://toncenter.com/api/v2"),
  /** SwapWallet market prices (IRT/toman rates) */
  SWAPWALLET_API_KEY: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const raw = parsed.data;

function defaultPort(provider: "mysql" | "postgresql"): number {
  return provider === "postgresql" ? 5432 : 3306;
}

function buildDatabaseUrl(): string {
  if (raw.DATABASE_URL?.trim()) return raw.DATABASE_URL.trim();

  const user = encodeURIComponent(raw.DB_USER);
  const password = encodeURIComponent(raw.DB_PASSWORD);
  const auth = raw.DB_PASSWORD ? `${user}:${password}` : user;
  const host = raw.DB_HOST;
  const port = raw.DB_PORT ?? defaultPort(raw.DB_PROVIDER);
  const name = encodeURIComponent(raw.DB_NAME);

  if (raw.DB_PROVIDER === "postgresql") {
    return `postgresql://${auth}@${host}:${port}/${name}?schema=public`;
  }

  return `mysql://${auth}@${host}:${port}/${name}`;
}

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

function normalizeWebhookPath(path: string): string {
  const trimmed = path.trim() || "/telegram/webhook";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

export const databaseUrl = buildDatabaseUrl();
process.env.DATABASE_URL = databaseUrl;

const publicUrl = normalizeBaseUrl(raw.PUBLIC_URL);
const miniAppUrl = normalizeBaseUrl(raw.MINI_APP_URL);
const webhookPath = normalizeWebhookPath(raw.WEBHOOK_PATH);

if (raw.NODE_ENV === "production") {
  if (!raw.WEBHOOK_SECRET?.trim()) {
    console.error(
      "WEBHOOK_SECRET is required in production (do not derive from bot token)",
    );
    process.exit(1);
  }
  if (!raw.WALLET_MASTER_KEY?.trim()) {
    console.error(
      "WALLET_MASTER_KEY is required in production (32-byte hex / 64 chars)",
    );
    process.exit(1);
  }
  if (!/^[0-9a-fA-F]{64}$/.test(raw.WALLET_MASTER_KEY.trim())) {
    console.error("WALLET_MASTER_KEY must be 32-byte hex (64 chars)");
    process.exit(1);
  }
}

const webhookSecret =
  raw.WEBHOOK_SECRET?.trim() ||
  createHash("sha256")
    .update(raw.TELEGRAM_BOT_TOKEN)
    .update("tomanit-webhook")
    .digest("hex")
    .slice(0, 32);

export const env = {
  NODE_ENV: raw.NODE_ENV,
  PORT: raw.PORT,
  DB_PROVIDER: raw.DB_PROVIDER,
  DB_HOST: raw.DB_HOST,
  DB_PORT: raw.DB_PORT ?? defaultPort(raw.DB_PROVIDER),
  DB_NAME: raw.DB_NAME,
  DB_USER: raw.DB_USER,
  DB_PASSWORD: raw.DB_PASSWORD,
  DATABASE_URL: databaseUrl,
  TELEGRAM_BOT_TOKEN: raw.TELEGRAM_BOT_TOKEN,
  TELEGRAM_BOT_USERNAME: raw.TELEGRAM_BOT_USERNAME?.trim().replace(/^@/, "") || "",
  TELEGRAM_MINI_APP_SHORT_NAME: raw.TELEGRAM_MINI_APP_SHORT_NAME?.trim().replace(/^\/+/, "") || "",
  TELEGRAM_API_ROOT: raw.TELEGRAM_API_ROOT.replace(/\/+$/, ""),
  TELEGRAM_PROXY: raw.TELEGRAM_PROXY?.trim() || null,
  SHOP_REPORT_BOT_TOKEN: raw.SHOP_REPORT_BOT_TOKEN?.trim() || "",
  SHOP_REPORT_BOT_USERNAME:
    raw.SHOP_REPORT_BOT_USERNAME?.trim().replace(/^@/, "") || "",
  PUBLIC_URL: publicUrl,
  MINI_APP_URL: miniAppUrl,
  WEBHOOK_PATH: webhookPath,
  WEBHOOK_SECRET: webhookSecret,
  WEBHOOK_URL: `${publicUrl}${webhookPath}`,
  FORCE_WEBHOOK_SYNC: Boolean(raw.FORCE_WEBHOOK_SYNC),
  AUTH_MAX_AGE_SEC: raw.AUTH_MAX_AGE_SEC,
  REDIS_URL: raw.REDIS_URL.trim() || "redis://localhost:6379",
  JIBIT_API_KEY: raw.JIBIT_API_KEY?.trim() || "",
  JIBIT_SECRET_KEY: raw.JIBIT_SECRET_KEY?.trim() || "",
  JIBIT_IDE_BASE_URL: (raw.JIBIT_IDE_BASE_URL || "https://napi.jibit.ir/ide/v1").replace(
    /\/+$/,
    "",
  ),
  JIBIT_PROXY: raw.JIBIT_PROXY?.trim() || "",
  WALLET_MASTER_KEY: raw.WALLET_MASTER_KEY?.trim() || null,
  TRON_NETWORK: raw.TRON_NETWORK,
  ...(() => {
    const presets = {
      mainnet: {
        baseUrl: "https://api.trongrid.io",
        usdt: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
        explorer: "https://tronscan.org",
        faucet: null as string | null,
      },
      nile: {
        baseUrl: "https://nile.trongrid.io",
        // Official Nile USDT (TRC20) test token
        usdt: "TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf",
        explorer: "https://nile.tronscan.org",
        faucet: "https://nileex.io/join/getJoinPage",
      },
      shasta: {
        baseUrl: "https://api.shasta.trongrid.io",
        usdt: "TG3XXyExBkPp9nzdajDZsozEu4BkaSJozs",
        explorer: "https://shasta.tronscan.org",
        faucet: "https://www.trongrid.io/shasta",
      },
    } as const;
    const preset = presets[raw.TRON_NETWORK];
    return {
      TRONGRID_API_KEY: raw.TRONGRID_API_KEY?.trim() || "",
      TRONGRID_BASE_URL: (
        raw.TRONGRID_BASE_URL?.trim() || preset.baseUrl
      ).replace(/\/+$/, ""),
      TRON_USDT_CONTRACT: raw.TRON_USDT_CONTRACT?.trim() || preset.usdt,
      TRON_EXPLORER_URL: preset.explorer,
      TRON_FAUCET_URL: preset.faucet,
      TRON_IS_TESTNET: raw.TRON_NETWORK !== "mainnet",
    };
  })(),
  ANKR_API_KEY: raw.ANKR_API_KEY?.trim() || "",
  BSC_RPC_URL:
    raw.BSC_RPC_URL?.trim() ||
    (raw.ANKR_API_KEY?.trim()
      ? `https://rpc.ankr.com/bsc/${raw.ANKR_API_KEY.trim()}`
      : "https://bsc-dataseed.binance.org"),
  POLYGON_RPC_URL:
    raw.POLYGON_RPC_URL?.trim() ||
    (raw.ANKR_API_KEY?.trim()
      ? `https://rpc.ankr.com/polygon/${raw.ANKR_API_KEY.trim()}`
      : "https://polygon-rpc.com"),
  BSC_USDT_CONTRACT:
    raw.BSC_USDT_CONTRACT?.trim() ||
    "0x55d398326f99059fF775485246999027B3197955",
  POLYGON_USDT_CONTRACT:
    raw.POLYGON_USDT_CONTRACT?.trim() ||
    "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
  TONCENTER_API_KEY: raw.TONCENTER_API_KEY?.trim() || "",
  TONCENTER_BASE_URL: (raw.TONCENTER_BASE_URL || "https://toncenter.com/api/v2").replace(
    /\/+$/,
    "",
  ),
  SWAPWALLET_API_KEY: raw.SWAPWALLET_API_KEY?.trim() || "",
};
