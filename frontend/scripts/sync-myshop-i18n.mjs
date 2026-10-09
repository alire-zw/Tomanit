import fs from "node:fs";
import path from "node:path";

const dir = path.resolve("src/i18n/locales");
const en = fs.readFileSync(path.join(dir, "en.ts"), "utf8");
const start = en.indexOf("  myShop: {");
const end = en.indexOf("  header: {", start);
if (start < 0 || end < 0) {
  throw new Error(`Could not locate myShop block in en.ts (${start}, ${end})`);
}
const block = en.slice(start, end);

for (const loc of ["de", "ru", "zh"]) {
  const file = path.join(dir, `${loc}.ts`);
  let src = fs.readFileSync(file, "utf8");
  const a = src.indexOf("  myShop: {");
  const b = src.indexOf("  header: {", a);
  if (a < 0 || b < 0) {
    throw new Error(`Could not locate myShop block in ${loc}.ts (${a}, ${b})`);
  }
  src = src.slice(0, a) + block + src.slice(b);
  fs.writeFileSync(file, src);
  console.log("synced", loc);
}
