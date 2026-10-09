import { execFileSync } from "node:child_process";
import { ProxyAgent, fetch as undiciFetch, type Dispatcher } from "undici";

let cachedProxy: string | null | undefined;
let cachedDispatcher: Dispatcher | undefined;

function normalizeProxyUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;

  // WinINET multi-protocol: http=host:port;https=host:port
  if (value.includes("=")) {
    const parts = Object.fromEntries(
      value
        .split(";")
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p) => {
          const i = p.indexOf("=");
          return i === -1
            ? ["http", p]
            : [p.slice(0, i).toLowerCase(), p.slice(i + 1)];
        }),
    ) as Record<string, string>;
    const picked = parts.https || parts.http || parts.all || Object.values(parts)[0];
    if (!picked) return null;
    return normalizeProxyUrl(picked);
  }

  if (/^https?:\/\//i.test(value)) return value.replace(/\/+$/, "");
  return `http://${value}`;
}

function readEnvProxy(): string | null {
  const raw =
    process.env.TELEGRAM_PROXY?.trim() ||
    process.env.HTTPS_PROXY?.trim() ||
    process.env.HTTP_PROXY?.trim() ||
    process.env.ALL_PROXY?.trim() ||
    "";
  return raw ? normalizeProxyUrl(raw) : null;
}

/** Read enabled WinINET user proxy (same stack PowerShell uses). */
function readWinInetProxy(): string | null {
  if (process.platform !== "win32") return null;
  try {
    const enableOut = execFileSync(
      "reg",
      [
        "query",
        "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings",
        "/v",
        "ProxyEnable",
      ],
      { encoding: "utf8", windowsHide: true },
    );
    if (!/ProxyEnable\s+REG_DWORD\s+0x1\b/i.test(enableOut)) return null;

    const serverOut = execFileSync(
      "reg",
      [
        "query",
        "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings",
        "/v",
        "ProxyServer",
      ],
      { encoding: "utf8", windowsHide: true },
    );
    const match = serverOut.match(/ProxyServer\s+REG_SZ\s+(.+)/i);
    if (!match?.[1]) return null;
    return normalizeProxyUrl(match[1].trim());
  } catch {
    return null;
  }
}

/** Resolved proxy URL used for Telegram Bot API (or null = direct). */
export function resolveTelegramProxy(): string | null {
  if (cachedProxy !== undefined) return cachedProxy;
  cachedProxy = readEnvProxy() || readWinInetProxy();
  return cachedProxy;
}

function getDispatcher(): Dispatcher | undefined {
  const proxy = resolveTelegramProxy();
  if (!proxy) return undefined;
  if (!cachedDispatcher) {
    cachedDispatcher = new ProxyAgent(proxy);
  }
  return cachedDispatcher;
}

export type TelegramFetchInit = {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  signal?: AbortSignal;
};

/** fetch() that routes through TELEGRAM_PROXY / system WinINET proxy when set. */
export async function telegramFetch(
  url: string,
  init: TelegramFetchInit = {},
): Promise<Response> {
  const dispatcher = getDispatcher();
  if (!dispatcher) {
    return fetch(url, init);
  }
  return undiciFetch(url, {
    method: init.method,
    headers: init.headers,
    body: init.body,
    signal: init.signal,
    dispatcher,
  }) as unknown as Promise<Response>;
}
