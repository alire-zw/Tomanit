const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  gray: "\x1b[90m",
  bgRed: "\x1b[41m",
  bgYellow: "\x1b[43m",
  black: "\x1b[30m",
} as const;

type BootRow = { name: string; detail: string; ok: boolean };

const bootRows: BootRow[] = [];

/** Gregorian → Jalali (Shamsi) */
function toJalali(gy: number, gm: number, gd: number): [number, number, number] {
  const gdm = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let gy2 = gm > 2 ? gy + 1 : gy;
  let days =
    355666 +
    365 * gy +
    Math.floor((gy2 + 3) / 4) -
    Math.floor((gy2 + 99) / 100) +
    Math.floor((gy2 + 399) / 400) +
    gd +
    gdm[gm - 1]!;
  let jy = -1595 + 33 * Math.floor(days / 12053);
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    jy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  const jm = days < 186 ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
  const jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30);
  return [jy, jm, jd];
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Single timestamp: 1404/07/01 18:41:05 */
function shamsiNow(date = new Date()): string {
  const [jy, jm, jd] = toJalali(
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate(),
  );
  return `${jy}/${pad2(jm)}/${pad2(jd)} ${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
}

function text(value: unknown): string {
  if (value == null || value === "") return "";
  if (value instanceof Error) return value.stack || value.message || String(value);
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function pad(value: string, width: number): string {
  return value.length >= width ? value : value + " ".repeat(width - value.length);
}

function stamp(): string {
  return `${c.gray}${shamsiNow()}${c.reset}`;
}

function sectionColor(section: string): string {
  const key = section.toLowerCase();
  if (key === "http") return c.cyan;
  if (key === "auth" || key === "user") return c.magenta;
  if (key === "db" || key === "prisma" || key === "seed") return c.blue;
  if (key === "webhook" || key === "telegram" || key === "bot") return c.green;
  if (key === "boot" || key === "ready") return c.white;
  return c.cyan;
}

function line(section: string, detail?: unknown, stream: "log" | "warn" | "error" = "log") {
  const sec = `${sectionColor(section)}${pad(section, 8)}${c.reset}`;
  const extra = detail != null && detail !== "" ? `  ${c.dim}${text(detail)}${c.reset}` : "";
  console[stream](`  ${stamp()}  ${sec}${extra}`);
}

export const log = {
  header(title = "Tomanit", subtitle = "backend") {
    bootRows.length = 0;
    console.log("");
    console.log(`  ${c.bold}${c.white}${title}${c.reset}  ${c.dim}${subtitle}${c.reset}`);
    console.log("");
  },

  service(name: string, detail = "", ok = true) {
    bootRows.push({ name, detail: text(detail), ok });
  },

  note(message: string, detail?: unknown) {
    const extra = detail != null && detail !== "" ? `  ${c.dim}${text(detail)}${c.reset}` : "";
    console.log(`  ${c.yellow}○${c.reset}  ${c.dim}${message}${c.reset}${extra}`);
  },

  ready(publicUrl?: string) {
    for (const row of bootRows) {
      const dot = row.ok ? `${c.green}●${c.reset}` : `${c.red}●${c.reset}`;
      const detail = row.detail ? `  ${c.dim}${row.detail}${c.reset}` : "";
      console.log(`  ${dot}  ${c.white}${pad(row.name, 10)}${c.reset}${detail}`);
    }
    bootRows.length = 0;

    if (publicUrl) {
      console.log("");
      console.log(`  ${c.cyan}→${c.reset}  ${publicUrl}`);
    }

    console.log("");
    console.log(`  ${c.dim}${"─".repeat(44)}${c.reset}`);
    console.log("");
  },

  /** One-line runtime log with section tag */
  event(section: string, detail?: unknown) {
    line(section, detail, "log");
  },

  info(section: string, detail?: unknown) {
    line(section, detail, "log");
  },

  debug(section: string, detail?: unknown) {
    console.log(
      `  ${stamp()}  ${c.gray}${pad(section, 8)}${c.reset}${
        detail != null && detail !== "" ? `  ${c.dim}${text(detail)}${c.reset}` : ""
      }`,
    );
  },

  http(method: string, path: string, status: number, ms: number) {
    const payload = `${method} ${path}  ${status}  ${ms}ms`;
    if (status >= 500) this.error("http", payload);
    else if (status >= 400) this.warn("http", payload);
    else this.event("http", payload);
  },

  warn(section: string, detail?: unknown) {
    const badge = `${c.bgYellow}${c.black} WARN ${c.reset}`;
    const d = detail != null && detail !== "" ? `  ${c.dim}${text(detail)}${c.reset}` : "";
    console.warn(`  ${stamp()}  ${badge}  ${c.yellow}${pad(section, 8)}${c.reset}${d}`);
  },

  error(section: string, detail?: unknown) {
    const badge = `${c.bgRed}${c.white}${c.bold} ERR  ${c.reset}`;
    const d = detail != null && detail !== "" ? `  ${c.dim}${text(detail)}${c.reset}` : "";
    console.error(`  ${stamp()}  ${badge}  ${c.red}${pad(section, 8)}${c.reset}${d}`);
  },
};
