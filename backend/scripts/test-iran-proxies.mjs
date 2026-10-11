import { readFileSync, writeFileSync } from "node:fs";
import https from "node:https";
import { resolve } from "node:path";
import { ProxyAgent, fetch as undiciFetch } from "undici";
import { SocksProxyAgent } from "socks-proxy-agent";

const listPath = resolve(process.cwd(), "../proxy5-free-proxies.json");
const outPath = resolve(process.cwd(), "../proxy5-sep-working.json");
const TARGET = "https://sep.shaparak.ir/";
const TIMEOUT_MS = 8_000;
const CONCURRENCY = 12;

const proxies = JSON.parse(readFileSync(listPath, "utf8"))
  .filter((p) => p?.ip_address && p?.port)
  .sort((a, b) => (a.latency || 9999) - (b.latency || 9999));

function proxyUrls(p) {
  const host = `${p.ip_address}:${p.port}`;
  const protocols = (p.protocols || []).map((x) => String(x).toUpperCase());
  const urls = [];
  if (protocols.includes("HTTP") || protocols.includes("HTTPS")) {
    urls.push({ type: "http", url: `http://${host}` });
  }
  if (protocols.includes("SOCKS5") || protocols.includes("SOCKS4")) {
    const scheme = protocols.includes("SOCKS4") && !protocols.includes("SOCKS5")
      ? "socks4"
      : "socks5";
    urls.push({ type: "socks", url: `${scheme}://${host}` });
  }
  if (!urls.length) urls.push({ type: "http", url: `http://${host}` });
  return urls;
}

function httpsGetViaSocks(proxyUrl) {
  return new Promise((resolvePromise, reject) => {
    const agent = new SocksProxyAgent(proxyUrl);
    const req = https.get(
      TARGET,
      {
        agent,
        headers: { "User-Agent": "Mozilla/5.0" },
        timeout: TIMEOUT_MS,
      },
      (res) => {
        res.resume();
        resolvePromise({ status: res.statusCode || 0 });
      },
    );
    req.on("timeout", () => {
      req.destroy(new Error("TimeoutError"));
    });
    req.on("error", reject);
  });
}

async function probe(proxyUrl, type) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
  const started = Date.now();
  try {
    if (type === "socks") {
      const res = await httpsGetViaSocks(proxyUrl);
      const ms = Date.now() - started;
      return { ok: res.status > 0 && res.status < 500, status: res.status, ms };
    }
    const agent = new ProxyAgent(proxyUrl);
    const res = await undiciFetch(TARGET, {
      dispatcher: agent,
      signal: ac.signal,
      headers: { "User-Agent": "Mozilla/5.0" },
      redirect: "follow",
    });
    const ms = Date.now() - started;
    return { ok: res.status > 0 && res.status < 500, status: res.status, ms };
  } catch (err) {
    const cause = err?.cause?.code || err?.name || err?.message || "error";
    return { ok: false, status: 0, ms: Date.now() - started, cause: String(cause) };
  } finally {
    clearTimeout(timer);
  }
}

async function mapPool(items, limit, worker) {
  const results = new Array(items.length);
  let i = 0;
  async function run() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await worker(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => run()));
  return results;
}

const jobs = [];
for (const p of proxies) {
  for (const u of proxyUrls(p)) {
    jobs.push({ meta: p, ...u });
  }
}

console.log(`Testing ${jobs.length} endpoints from ${proxies.length} proxies → ${TARGET}`);

const working = [];
let done = 0;

await mapPool(jobs, CONCURRENCY, async (job) => {
  const result = await probe(job.url, job.type);
  done += 1;
  const tag = `${String(done).padStart(3)}/${jobs.length}`;
  if (result.ok) {
    const row = {
      proxy: job.url,
      type: job.type,
      ip_address: job.meta.ip_address,
      port: job.meta.port,
      protocols: job.meta.protocols,
      anonymity: job.meta.anonymity,
      latency_listed: job.meta.latency,
      sep_status: result.status,
      sep_ms: result.ms,
    };
    working.push(row);
    console.log(`OK  ${tag}  ${job.url}  status=${result.status}  ${result.ms}ms`);
  } else {
    console.log(`FAIL ${tag}  ${job.url}  ${result.cause || "fail"}  ${result.ms}ms`);
  }
  return result;
});

working.sort((a, b) => a.sep_ms - b.sep_ms);
writeFileSync(outPath, JSON.stringify(working, null, 2), "utf8");
console.log("\n--- RESULT ---");
console.log(`working: ${working.length}`);
for (const w of working.slice(0, 15)) {
  console.log(`${w.sep_ms}ms  ${w.proxy}  HTTP ${w.sep_status}`);
}
console.log(`wrote ${outPath}`);
