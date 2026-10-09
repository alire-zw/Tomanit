/** Parse positive integer route params (MySQL/Postgres autoincrement ids). */
export function parseIdParam(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}
