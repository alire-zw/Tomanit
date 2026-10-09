/**
 * Keeps prisma/schema.prisma `provider` in sync with DB_PROVIDER from .env,
 * and ensures DATABASE_URL exists for Prisma CLI.
 */
import { config } from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

config();

const provider = (process.env.DB_PROVIDER || "mysql").trim().toLowerCase();
if (provider !== "mysql" && provider !== "postgresql") {
  console.error(`Unsupported DB_PROVIDER="${provider}". Use mysql or postgresql.`);
  process.exit(1);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const schemaPath = path.join(root, "prisma/schema.prisma");

const schema = fs.readFileSync(schemaPath, "utf8");
const next = schema.replace(
  /(datasource\s+db\s*\{[\s\S]*?provider\s*=\s*")(?:mysql|postgresql|sqlite)(")/,
  `$1${provider}$2`,
);

if (next !== schema) {
  fs.writeFileSync(schemaPath, next, "utf8");
  console.log(`[db:sync] prisma provider -> ${provider}`);
} else {
  const current = schema.match(/provider\s*=\s*"(mysql|postgresql|sqlite)"/)?.[1];
  if (current !== provider) {
    console.error("[db:sync] Could not update datasource provider in schema.prisma");
    process.exit(1);
  }
  console.log(`[db:sync] provider already "${provider}"`);
}

function buildDatabaseUrl() {
  if (process.env.DATABASE_URL?.trim()) return process.env.DATABASE_URL.trim();
  const user = encodeURIComponent(process.env.DB_USER || "root");
  const password = encodeURIComponent(process.env.DB_PASSWORD || "");
  const auth = process.env.DB_PASSWORD ? `${user}:${password}` : user;
  const host = process.env.DB_HOST || "localhost";
  const port =
    process.env.DB_PORT || (provider === "postgresql" ? "5432" : "3306");
  const name = encodeURIComponent(process.env.DB_NAME || "tomanit");
  if (provider === "postgresql") {
    return `postgresql://${auth}@${host}:${port}/${name}?schema=public`;
  }
  return `mysql://${auth}@${host}:${port}/${name}`;
}

const databaseUrl = buildDatabaseUrl();
process.env.DATABASE_URL = databaseUrl;
console.log(`[db:sync] DATABASE_URL ready (${provider})`);
