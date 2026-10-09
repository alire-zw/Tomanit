import MoneyReceiveSquareIcon from "../icons/MoneyReceiveSquareIcon";
import { formatFaDate, formatFaDecimal, formatFaNumber } from "../../lib/format";
import type { ShopTransaction, ShopTxStatus } from "../../lib/shop";

type Props = {
  tx: ShopTransaction;
  tomanLabel: string;
  trxEquivLabel: (amount: string) => string;
  statusLabel?: (status: ShopTxStatus) => string;
  sourceLabel?: string | null;
  /** Optional click — when omitted, renders as a static div */
  onClick?: () => void;
};

function statusClass(status: ShopTxStatus): string {
  if (status === "completed") return "my-shop__badge--ok";
  if (status === "pending") return "my-shop__badge--warn";
  if (status === "expired") return "my-shop__badge--mute";
  return "my-shop__badge--err";
}

export function ShopTransactionRow({
  tx,
  tomanLabel,
  trxEquivLabel,
  statusLabel,
  sourceLabel,
  onClick,
}: Props) {
  const title = tx.invoiceCode || tx.chargeCode || tx.title || tx.id;
  const when = formatFaDate(tx.paidAt || tx.createdAt);
  const metaParts = [when, sourceLabel, tx.payerLabel].filter(Boolean);
  const sub = metaParts.join(" · ");
  const equiv =
    tx.amountTrx != null && tx.amountTrx > 0
      ? trxEquivLabel(formatFaDecimal(tx.amountTrx, 2))
      : null;
  const paid = tx.status === "completed";
  const amountCls = paid
    ? "wallet__transaction-amount--positive"
    : "wallet__transaction-amount--neutral";

  const inner = (
    <>
      <div className="wallet__transaction-start">
        <span className="wallet__transaction-logo-wrap" aria-hidden>
          <img
            className="wallet__transaction-logo"
            src="/coins/TOMAN.png"
            alt=""
            width={32}
            height={32}
            decoding="async"
          />
          <span
            className={`wallet__transaction-badge${
              paid ? " wallet__transaction-badge--in" : " wallet__transaction-badge--mute"
            }`}
          >
            <MoneyReceiveSquareIcon width={10} height={10} />
          </span>
        </span>
        <div className="wallet__transaction-info my-shop__tx-info">
          <div className="my-shop__tx-title-row">
            <div className="my-shop__tx-code" dir="ltr" lang="en">
              {title}
            </div>
            {statusLabel ? (
              <span className={`my-shop__badge my-shop__tx-status ${statusClass(tx.status)}`}>
                {statusLabel(tx.status)}
              </span>
            ) : null}
          </div>
          <div className="wallet__transaction-date">{sub}</div>
        </div>
      </div>
      <div className={`wallet__transaction-value-col ${amountCls}`}>
        <span className="wallet__transaction-amount-main">
          <span className="wallet__transaction-unit">{tomanLabel}</span>
          <span className="wallet__transaction-value">
            {paid ? "+" : ""}
            {formatFaNumber(tx.amountToman)}
          </span>
        </span>
        {equiv ? (
          <span className="wallet__transaction-equiv" title={equiv}>
            {equiv}
          </span>
        ) : null}
      </div>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        className="wallet__transaction wallet__transaction--clickable"
        onClick={onClick}
      >
        {inner}
      </button>
    );
  }

  return <div className="wallet__transaction">{inner}</div>;
}
