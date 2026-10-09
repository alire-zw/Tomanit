/** Pull a wallet address out of plain text or URI QR payloads. */
export function parseWalletQrPayload(raw: string): string {
  const text = raw.trim();
  if (!text) return "";

  // ethereum:0xabc... / tron:T... / bitcoin:... ?params
  const uriMatch = text.match(
    /^(?:ethereum|tron|bitcoin|bnb|matic|ton|bitcoincash):([^?/\s]+)/i,
  );
  if (uriMatch?.[1]) return uriMatch[1].trim();

  // EIP-681 style with @chainId
  const eipMatch = text.match(/^ethereum:([^@?\s]+)/i);
  if (eipMatch?.[1]) return eipMatch[1].trim();

  const token = text.split(/\s+/)[0] ?? text;
  return token.replace(/^[@#]/, "").trim();
}
