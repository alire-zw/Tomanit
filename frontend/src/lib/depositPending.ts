const GATEWAY_PENDING_KEY = "tomanit.deposit.gateway.pending";

export type DepositGatewayPending = {
  amountDigits: string;
  from?: "home" | "asset";
};

export function saveDepositGatewayPending(data: DepositGatewayPending): void {
  try {
    sessionStorage.setItem(GATEWAY_PENDING_KEY, JSON.stringify(data));
  } catch {
    // ignore quota / private mode
  }
}

export function readDepositGatewayPending(): DepositGatewayPending | null {
  try {
    const raw = sessionStorage.getItem(GATEWAY_PENDING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DepositGatewayPending;
    if (!parsed?.amountDigits || typeof parsed.amountDigits !== "string") {
      return null;
    }
    return {
      amountDigits: parsed.amountDigits.replace(/\D/g, ""),
      from: parsed.from === "asset" ? "asset" : "home",
    };
  } catch {
    return null;
  }
}

export function clearDepositGatewayPending(): void {
  try {
    sessionStorage.removeItem(GATEWAY_PENDING_KEY);
  } catch {
    // ignore
  }
}
