import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { Wallet, keccak256, getBytes, hexlify, SigningKey } from "ethers";
import { keyPairFromSeed } from "@ton/crypto";
import { WalletContractV4 } from "@ton/ton";
import type { CryptoNetwork } from "@prisma/client";
import { env } from "../config/env.js";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

function resolveMasterKey(): Buffer {
  const hex = env.WALLET_MASTER_KEY?.trim();
  if (hex) {
    if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
      throw new Error("WALLET_MASTER_KEY must be 32-byte hex (64 chars)");
    }
    return Buffer.from(hex, "hex");
  }
  if (env.NODE_ENV === "production") {
    throw new Error("WALLET_MASTER_KEY is required in production");
  }
  // Dev fallback: derive from bot token
  return createHash("sha256")
    .update(env.TELEGRAM_BOT_TOKEN)
    .update("tomanit-wallet-master")
    .digest();
}

export function encryptPrivateKey(plain: string): string {
  const key = resolveMasterKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptPrivateKey(payload: string): string {
  const key = resolveMasterKey();
  const buf = Buffer.from(payload, "base64");
  if (buf.length < IV_LEN + TAG_LEN + 1) {
    throw new Error("Invalid encrypted key payload");
  }
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const data = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString(
    "utf8",
  );
}

const BASE58_ALPHABET =
  "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function base58Encode(bytes: Uint8Array): string {
  if (bytes.length === 0) return "";
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros++;

  // Standard base58 conversion (mutable big-endian digits).
  const digits: number[] = [0];
  for (let i = zeros; i < bytes.length; i++) {
    let carry = bytes[i]!;
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j]! << 8;
      digits[j] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }

  let out = "1".repeat(zeros);
  for (let i = digits.length - 1; i >= 0; i--) {
    out += BASE58_ALPHABET[digits[i]!]!;
  }
  return out;
}

function base58CheckEncode(payload: Uint8Array): string {
  const hash1 = createHash("sha256").update(Buffer.from(payload)).digest();
  const hash2 = createHash("sha256").update(hash1).digest();
  const full = Buffer.concat([Buffer.from(payload), hash2.subarray(0, 4)]);
  return base58Encode(full);
}

/**
 * Normalize TRON address from hex (41… / 0x41…) or base58 (T…).
 * TronGrid TransferContract often returns hex owner/to addresses.
 */
function base58Decode(str: string): Buffer {
  if (!str) return Buffer.alloc(0);
  let zeros = 0;
  while (zeros < str.length && str[zeros] === "1") zeros++;

  const bytes: number[] = [0];
  for (let i = zeros; i < str.length; i++) {
    const ch = str[i]!;
    const val = BASE58_ALPHABET.indexOf(ch);
    if (val < 0) throw new Error("Invalid base58 character");
    let carry = val;
    for (let j = 0; j < bytes.length; j++) {
      carry += bytes[j]! * 58;
      bytes[j] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }

  const out = Buffer.alloc(zeros + bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    out[out.length - 1 - i] = bytes[i]!;
  }
  return out;
}

export function tronAddressToHex(input: string): string {
  const base58 = tronAddressToBase58(input);
  if (!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(base58)) {
    throw new Error("Invalid TRON address");
  }
  const decoded = base58Decode(base58);
  if (decoded.length !== 25) {
    throw new Error("Invalid TRON address length");
  }
  const payload = decoded.subarray(0, 21);
  const checksum = decoded.subarray(21);
  const hash1 = createHash("sha256").update(payload).digest();
  const hash2 = createHash("sha256").update(hash1).digest();
  if (!checksum.equals(hash2.subarray(0, 4))) {
    throw new Error("Invalid TRON address checksum");
  }
  return payload.toString("hex");
}

export function tronAddressToBase58(input: string): string {
  const s = input.trim();
  if (!s) return s;
  if (/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(s)) return s;

  let hex = s.replace(/^0x/i, "");
  if (/^[0-9a-fA-F]{40}$/.test(hex)) hex = `41${hex}`;
  if (!/^[0-9a-fA-F]{42}$/.test(hex) || !hex.toLowerCase().startsWith("41")) {
    return s;
  }
  try {
    return base58CheckEncode(Buffer.from(hex, "hex"));
  } catch {
    return s;
  }
}

/** TRON address from EVM-compatible private key (hex with or without 0x). */
export function ethPrivateKeyToTronAddress(privateKey: string): string {
  const signingKey = new SigningKey(privateKey);
  const pubBytes = getBytes(signingKey.publicKey);
  const hash = keccak256(pubBytes.slice(1)); // drop 0x04
  const addr20 = getBytes(hash).slice(-20);
  const payload = new Uint8Array(21);
  payload[0] = 0x41;
  payload.set(addr20, 1);
  const address = base58CheckEncode(payload);
  if (!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address)) {
    throw new Error(`Invalid TRON address derived: ${address}`);
  }
  return address;
}

export type GeneratedWallet = {
  address: string;
  privateKey: string;
};

/** Real TON Wallet V4R2 bounceable address from 32-byte seed. */
export function tonWalletFromSeed(seed: Buffer): GeneratedWallet {
  if (seed.length !== 32) {
    throw new Error("TON seed must be 32 bytes");
  }
  const keyPair = keyPairFromSeed(seed);
  const wallet = WalletContractV4.create({
    workchain: 0,
    publicKey: keyPair.publicKey,
  });
  const address = wallet.address.toString({
    bounceable: true,
    urlSafe: true,
  });
  return {
    address,
    privateKey: hexlify(seed),
  };
}

export function generateNetworkWallet(
  network: CryptoNetwork,
): GeneratedWallet {
  if (network === "bsc" || network === "polygon") {
    const w = Wallet.createRandom();
    return { address: w.address, privateKey: w.privateKey };
  }

  if (network === "tron") {
    const w = Wallet.createRandom();
    return {
      address: ethPrivateKeyToTronAddress(w.privateKey),
      privateKey: w.privateKey,
    };
  }

  if (network === "ton") {
    return tonWalletFromSeed(randomBytes(32));
  }

  throw Object.assign(new Error(`Unsupported network: ${network}`), {
    statusCode: 400,
  });
}

export function validateAddress(
  network: CryptoNetwork | null | undefined,
  address: string,
): boolean {
  const trimmed = address.trim();
  if (!trimmed || trimmed.length < 8) return false;

  if (!network) {
    // fiat / bank note — just non-empty
    return trimmed.length >= 8 && trimmed.length <= 128;
  }

  if (network === "bsc" || network === "polygon") {
    return /^0x[0-9a-fA-F]{40}$/.test(trimmed);
  }
  if (network === "tron") {
    return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(trimmed);
  }
  if (network === "ton") {
    return /^(EQ|UQ)[A-Za-z0-9_-]{46,}$/.test(trimmed);
  }
  return false;
}
