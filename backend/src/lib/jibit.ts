import { env } from "../config/env.js";
import { jibitFetch } from "./jibitProxy.js";
import { log } from "./log.js";

type TokenBundle = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
};

let cachedTokens: TokenBundle | null = null;

export class JibitError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "JibitError";
  }
}

function requireKeys() {
  if (!env.JIBIT_API_KEY || !env.JIBIT_SECRET_KEY) {
    throw new JibitError("سرویس استعلام پیکربندی نشده است", "jibit.not_configured", 503);
  }
}

async function readJson(res: {
  text(): Promise<string>;
}): Promise<Record<string, unknown>> {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { raw: text };
  }
}

async function generateTokens(): Promise<TokenBundle> {
  requireKeys();
  const res = await jibitFetch(`${env.JIBIT_IDE_BASE_URL}/tokens/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      apiKey: env.JIBIT_API_KEY,
      secretKey: env.JIBIT_SECRET_KEY,
    }),
  });
  const data = await readJson(res);
  if (!res.ok || typeof data.accessToken !== "string") {
    throw new JibitError(
      typeof data.message === "string" ? data.message : "دریافت توکن جیبیت ناموفق بود",
      typeof data.code === "string" ? data.code : "jibit.token_failed",
      res.status || 502,
    );
  }
  return {
    accessToken: data.accessToken,
    refreshToken: typeof data.refreshToken === "string" ? data.refreshToken : "",
    // refresh a bit before typical expiry
    expiresAt: Date.now() + 20 * 60 * 1000,
  };
}

async function getAccessToken(): Promise<string> {
  if (cachedTokens && cachedTokens.expiresAt > Date.now() + 30_000) {
    return cachedTokens.accessToken;
  }
  cachedTokens = await generateTokens();
  return cachedTokens.accessToken;
}

async function jibitGet(pathWithQuery: string): Promise<Record<string, unknown>> {
  const token = await getAccessToken();
  const res = await jibitFetch(`${env.JIBIT_IDE_BASE_URL}${pathWithQuery}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      "X-TRACK-ID": `tomanit-${Date.now()}`,
    },
  });
  const data = await readJson(res);

  if (res.status === 401 || res.status === 403) {
    cachedTokens = null;
    const retryToken = await getAccessToken();
    const retry = await jibitFetch(`${env.JIBIT_IDE_BASE_URL}${pathWithQuery}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${retryToken}`,
        "X-TRACK-ID": `tomanit-retry-${Date.now()}`,
      },
    });
    const retryData = await readJson(retry);
    if (!retry.ok) {
      throw new JibitError(
        typeof retryData.message === "string" ? retryData.message : "خطای سرویس استعلام",
        typeof retryData.code === "string" ? retryData.code : "jibit.request_failed",
        retry.status || 502,
      );
    }
    return retryData;
  }

  if (!res.ok) {
    throw new JibitError(
      typeof data.message === "string" ? data.message : "خطای سرویس استعلام",
      typeof data.code === "string" ? data.code : "jibit.request_failed",
      res.status || 502,
    );
  }
  return data;
}

/** Match card with national code + shamsi birthDate YYYYMMDD */
export async function jibitMatchCardIdentity(input: {
  cardNumber: string;
  nationalCode: string;
  birthDateYyyymmdd: string;
}): Promise<{ matched: boolean }> {
  const qs = new URLSearchParams({
    cardNumber: input.cardNumber,
    nationalCode: input.nationalCode,
    birthDate: input.birthDateYyyymmdd,
  });
  const data = await jibitGet(`/services/matching?${qs.toString()}`);
  return { matched: Boolean(data.matched) };
}

export type JibitIbanInfo = {
  bank: string | null;
  depositNumber: string | null;
  iban: string | null;
  status: string | null;
  ownerName: string | null;
};

/** Convert card to IBAN (`iban=true`) */
export async function jibitCardToIban(cardNumber: string): Promise<JibitIbanInfo> {
  const qs = new URLSearchParams({ number: cardNumber, iban: "true" });
  const data = await jibitGet(`/cards?${qs.toString()}`);
  const ibanInfo =
    data.ibanInfo && typeof data.ibanInfo === "object"
      ? (data.ibanInfo as Record<string, unknown>)
      : null;

  let ownerName: string | null = null;
  const owners = Array.isArray(ibanInfo?.owners) ? ibanInfo.owners : [];
  if (owners.length > 0 && owners[0] && typeof owners[0] === "object") {
    const o = owners[0] as { firstName?: string; lastName?: string };
    ownerName = [o.firstName, o.lastName]
      .map((part) => part?.replace(/[\u200c\u200f\u200e]/g, "").trim())
      .filter(Boolean)
      .join(" ");
  }
  if (!ownerName && data.cardInfo && typeof data.cardInfo === "object") {
    const cardInfo = data.cardInfo as { ownerName?: string };
    ownerName = cardInfo.ownerName?.replace(/[\u200c\u200f\u200e]/g, "").trim() || null;
  }

  const result: JibitIbanInfo = {
    bank: typeof ibanInfo?.bank === "string" ? ibanInfo.bank : null,
    depositNumber:
      typeof ibanInfo?.depositNumber === "string" ? ibanInfo.depositNumber : null,
    iban: typeof ibanInfo?.iban === "string" ? ibanInfo.iban : null,
    status: typeof ibanInfo?.status === "string" ? ibanInfo.status : null,
    ownerName,
  };

  if (!result.iban) {
    log.warn("jibit", "card-to-iban returned empty iban");
    throw new JibitError("دریافت شبا ناموفق بود", "jibit.iban_missing", 502);
  }

  return result;
}
