import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { BottomSheet, BOTTOM_SHEET_ANIM_MS } from "../BottomSheet";
import { useNotification } from "../Notification";
import { useI18n } from "../../context/I18nContext";
import { useTelegram } from "../../hooks/useTelegram";
import type { WalletTransaction } from "../../lib/api";
import { formatFaDate, formatFaCryptoQty, formatFaNumber } from "../../lib/format";
import "./WalletTxDetailSheet.css";

type DetailRow = {
  label: string;
  value: ReactNode;
  valueClassName?: string;
  copyValue?: string | null;
};

/** Keep address/hash/code digits Latin (ASCII 0-9). */
function toLatinDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
}

function shortenMiddle(value: string, head = 10, tail = 8): string {
  const s = toLatinDigits(value.trim());
  if (s.length <= head + tail + 1) return s;
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}

function assetLabel(asset: string, t: (key: string) => string): string {
  const a = asset.toLowerCase();
  if (a === "toman" || a === "irr") return t("wallet.toman");
  if (a === "trx" || a === "tron") return t("wallet.tron");
  if (a === "usdt") return t("wallet.tether");
  if (a === "bnb") return t("wallet.binance");
  if (a === "matic" || a === "pol") return t("wallet.polygon");
  if (a === "gram" || a === "ton") return t("wallet.gram");
  return asset.toUpperCase();
}

function formatAssetAmount(asset: string, amount: number): string {
  if (asset.toLowerCase() === "toman" || asset.toLowerCase() === "irr") {
    return formatFaNumber(Math.abs(Math.round(amount)));
  }
  return formatFaCryptoQty(Math.abs(amount), 3);
}

function resolveUnitPrice(tx: WalletTransaction): number | null {
  if (tx.unitPriceToman != null && tx.unitPriceToman > 0) {
    return tx.unitPriceToman;
  }
  if (tx.amountToman != null && tx.amountToman > 0 && tx.amount > 0) {
    return tx.amountToman / tx.amount;
  }
  return null;
}

function buildRows(
  tx: WalletTransaction,
  t: (key: string) => string,
): DetailRow[] {
  const unitPrice = resolveUnitPrice(tx);
  const fromAddress = tx.fromAddress?.trim() || "";
  const txHash = tx.txHash?.trim() || "";
  const code = tx.code?.trim() || "";

  return [
    {
      label: t("tx.detail.date"),
      value: formatFaDate(tx.createdAt),
    },
    {
      label: t("tx.detail.quantity"),
      value: (
        <>
          <span className="wallet-tx-detail__unit">{assetLabel(tx.asset, t)}</span>
          <span>{formatAssetAmount(tx.asset, tx.amount)}</span>
        </>
      ),
      valueClassName: "wallet-tx-detail__value--amount",
    },
    {
      label: t("tx.detail.priceAtTime"),
      value:
        unitPrice != null ? (
          <>
            <span className="wallet-tx-detail__unit">{t("wallet.toman")}</span>
            <span>{formatFaNumber(Math.round(unitPrice))}</span>
          </>
        ) : (
          "—"
        ),
      valueClassName:
        unitPrice != null ? "wallet-tx-detail__value--amount" : undefined,
    },
    {
      label: t("tx.detail.senderAddress"),
      value: fromAddress ? shortenMiddle(fromAddress, 12, 10) : "—",
      valueClassName: fromAddress
        ? "wallet-tx-detail__value--mono wallet-tx-detail__value--copyable"
        : undefined,
      copyValue: fromAddress || null,
    },
    {
      label: t("tx.detail.txHash"),
      value: txHash ? shortenMiddle(txHash, 12, 10) : "—",
      valueClassName: txHash
        ? "wallet-tx-detail__value--mono wallet-tx-detail__value--copyable"
        : undefined,
      copyValue: txHash || null,
    },
    {
      label: t("tx.detail.trackingCode"),
      value: code ? toLatinDigits(code) : "—",
      valueClassName: code
        ? "wallet-tx-detail__value--mono wallet-tx-detail__value--copyable"
        : undefined,
      copyValue: code || null,
    },
  ];
}

type WalletTxDetailSheetProps = {
  open: boolean;
  transaction: WalletTransaction | null;
  onClose: () => void;
};

export function WalletTxDetailSheet({
  open,
  transaction,
  onClose,
}: WalletTxDetailSheetProps) {
  const { t } = useI18n();
  const { haptic } = useTelegram();
  const { notify } = useNotification();
  /** Keep last tx while close animation runs so content doesn't vanish mid-slide. */
  const [displayTx, setDisplayTx] = useState<WalletTransaction | null>(transaction);

  useEffect(() => {
    if (transaction) setDisplayTx(transaction);
  }, [transaction]);

  useEffect(() => {
    if (open || !displayTx) return;
    const timer = window.setTimeout(() => setDisplayTx(null), BOTTOM_SHEET_ANIM_MS);
    return () => window.clearTimeout(timer);
  }, [open, displayTx]);

  const rows = displayTx ? buildRows(displayTx, t) : [];

  const copyValue = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      haptic("light");
      notify(t("common.copied"), "success");
    } catch {
      notify(t("common.error"), "error");
    }
  };

  return (
    <BottomSheet
      open={open}
      onClose={() => {
        haptic("light");
        onClose();
      }}
      title={t("tx.detail.title")}
      className="wallet-tx-detail-sheet"
    >
      {displayTx ? (
        <div className="wallet-tx-detail__card">
          {rows.map((row) => (
            <div key={row.label} className="wallet-tx-detail__row">
              <span className="wallet-tx-detail__label">{row.label}</span>
              {row.copyValue ? (
                <button
                  type="button"
                  lang="en"
                  className={`wallet-tx-detail__value${
                    row.valueClassName ? ` ${row.valueClassName}` : ""
                  }`}
                  onClick={() => void copyValue(row.copyValue!)}
                >
                  {row.value}
                </button>
              ) : (
                <span
                  lang={row.valueClassName?.includes("mono") ? "en" : undefined}
                  className={`wallet-tx-detail__value${
                    row.valueClassName ? ` ${row.valueClassName}` : ""
                  }`}
                >
                  {row.value}
                </span>
              )}
            </div>
          ))}
        </div>
      ) : null}
    </BottomSheet>
  );
}
