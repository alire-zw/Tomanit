/**
 * Outbound HTTP for Jibit Identicator (KYC / card inquiry).
 *
 * JIBIT_PROXY examples:
 *   socks5://user:pass@HOST:PORT
 *   http://user:pass@HOST:PORT
 *
 * Falls back to GATEWAY_PROXY when JIBIT_PROXY is unset.
 * HTTPS to Jibit stays end-to-end encrypted.
 */

import http from "node:http";
import https from "node:https";
import { Agent, ProxyAgent, fetch as undiciFetch, type Dispatcher } from "undici";
import { SocksProxyAgent } from "socks-proxy-agent";
import { log } from "./log.js";

type ProxyMode = "direct" | "http" | "socks";

let cachedMode: ProxyMode | null = null;
let cachedDispatcher: Dispatcher | null = null;
let cachedSocksAgent: SocksProxyAgent | null = null;
let cachedProxyLabel: string | null = null;

function normalizeProxyUrl(raw: string): string | null {
  const value = String(raw || "").trim();
  if (!value) return null;
  if (/^socks[45]h?:\/\//i.test(value)) return value.replace(/\/+$/, "");
  if (/^https?:\/\//i.test(value)) return value.replace(/\/+$/, "");
  return `http://${value}`;
}

function redactProxy(url: string): string {
  return url.replace(/:([^:@/]+)@/, ":****@");
}

function resolveJibitProxy(): string | null {
  return normalizeProxyUrl(
    process.env.JIBIT_PROXY?.trim() || process.env.GATEWAY_PROXY?.trim() || "",
  );
}

function ensureDispatcher(): void {
  if (cachedMode) return;

  const proxy = resolveJibitProxy();
  if (!proxy) {
    cachedMode = "direct";
    cachedProxyLabel = null;
    cachedDispatcher = new Agent({
      keepAliveTimeout: 30_000,
      keepAliveMaxTimeout: 60_000,
      connections: 8,
      pipelining: 1,
      connect: {
        family: 4,
        timeout: 12_000,
      },
    });
    return;
  }

  cachedProxyLabel = redactProxy(proxy);
  if (/^socks/i.test(proxy)) {
    cachedMode = "socks";
    cachedSocksAgent = new SocksProxyAgent(proxy);
    log.info("jibit", { msg: "JIBIT_PROXY enabled (socks)", proxy: cachedProxyLabel });
    return;
  }

  cachedMode = "http";
  cachedDispatcher = new ProxyAgent(proxy);
  log.info("jibit", { msg: "JIBIT_PROXY enabled (http)", proxy: cachedProxyLabel });
}

export function getJibitProxyLabel(): string | null {
  ensureDispatcher();
  return cachedProxyLabel;
}

export type JibitFetchInit = {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  signal?: AbortSignal;
};

type SocksResponse = {
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
};

function fetchViaSocks(
  url: string,
  init: JibitFetchInit,
): Promise<SocksResponse> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === "http:" ? http : https;
    const req = lib.request(
      url,
      {
        method: init.method || "GET",
        headers: init.headers || {},
        agent: cachedSocksAgent!,
        timeout: 30_000,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => {
          const buf = Buffer.concat(chunks);
          const status = res.statusCode || 0;
          const headerMap = new Map<string, string>();
          for (const [key, value] of Object.entries(res.headers)) {
            if (value == null) continue;
            headerMap.set(key.toLowerCase(), Array.isArray(value) ? value.join(", ") : value);
          }
          resolve({
            ok: status >= 200 && status < 300,
            status,
            headers: {
              get(name: string) {
                return headerMap.get(name.toLowerCase()) ?? null;
              },
            },
            text: async () => buf.toString("utf8"),
          });
        });
      },
    );
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy(new Error("Jibit SOCKS proxy timeout"));
    });
    if (init.signal) {
      if (init.signal.aborted) {
        req.destroy(new Error("Aborted"));
        return;
      }
      init.signal.addEventListener(
        "abort",
        () => {
          req.destroy(new Error("Aborted"));
        },
        { once: true },
      );
    }
    if (init.body) req.write(init.body);
    req.end();
  });
}

/** fetch() that routes Jibit Identicator calls through JIBIT_PROXY / GATEWAY_PROXY. */
export async function jibitFetch(
  url: string,
  init: JibitFetchInit = {},
): Promise<{ ok: boolean; status: number; text(): Promise<string> }> {
  ensureDispatcher();

  if (cachedMode === "socks") {
    return fetchViaSocks(url, init);
  }

  return undiciFetch(url, {
    method: init.method,
    headers: init.headers,
    body: init.body,
    signal: init.signal,
    dispatcher: cachedDispatcher!,
  }) as unknown as Promise<{ ok: boolean; status: number; text(): Promise<string> }>;
}
