import { useEffect, useState, type CSSProperties } from "react";
import { AdminScreen } from "../../components/AdminScreen";
import { useI18n } from "../../context/I18nContext";
import { apiFetch } from "../../lib/api";
import { formatFaDate, formatFaNumber } from "../../lib/format";
import "../../styles/shop-rise.css";
import "./Admin.css";

interface InvoiceRow {
  id: string;
  code: string;
  amountToman: string;
  status: string;
  createdAt: string;
}

function statusTone(status: string): "pending" | "approved" | "rejected" {
  const s = status.toLowerCase();
  if (s.includes("reject") || s.includes("fail") || s.includes("cancel")) return "rejected";
  if (s.includes("approv") || s.includes("paid") || s.includes("success") || s.includes("done")) {
    return "approved";
  }
  return "pending";
}

function InvoiceSkeleton({ index }: { index: number }) {
  return (
    <article
      className="admin-charge-item admin-charge-item--skeleton shop-rise"
      style={{ "--rise-index": Math.min(index + 2, 8) } as CSSProperties}
      aria-hidden
    >
      <div className="admin-charge-item__header">
        <div className="admin-charge-item__summary">
          <div className="admin-charge-item__title-row">
            <span className="admin-charge-skel admin-charge-skel--user" />
            <span className="admin-charge-skel admin-charge-skel--badge" />
          </div>
          <span className="admin-charge-skel admin-charge-skel--amount" />
        </div>
      </div>
      <div className="admin-charge-item__meta">
        <span className="admin-charge-item__meta-chip admin-charge-item__meta-chip--skel">
          <span className="admin-charge-skel admin-charge-skel--line" />
        </span>
        <span className="admin-charge-item__meta-chip admin-charge-item__meta-chip--skel">
          <span className="admin-charge-skel admin-charge-skel--line admin-charge-skel--line-sm" />
        </span>
      </div>
    </article>
  );
}

export function AdminInvoicesPage() {
  const { t } = useI18n();
  const [items, setItems] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void apiFetch<{ invoices: InvoiceRow[] }>("/admin/invoices")
      .then((d) => {
        if (!cancelled) {
          setItems(d.invoices);
          setError(null);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : t("common.error"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  return (
    <AdminScreen title={t("admin.invoicesLabel")}>
      {loading ? (
        <div className="admin-charge-list" aria-busy="true">
          {[0, 1, 2].map((index) => (
            <InvoiceSkeleton key={index} index={index} />
          ))}
        </div>
      ) : null}

      {!loading && error ? <p className="admin-empty">{error}</p> : null}

      {!loading && !error && items.length === 0 ? (
        <p className="admin-empty">{t("admin.invoicesEmpty")}</p>
      ) : null}

      {!loading && !error && items.length > 0 ? (
        <div className="admin-charge-list">
          {items.map((inv, index) => {
            const tone = statusTone(inv.status);
            return (
              <article
                key={inv.id}
                className={`admin-charge-item admin-charge-item--${tone} shop-rise`}
                style={{ "--rise-index": Math.min(index + 2, 8) } as CSSProperties}
              >
                <div className="admin-charge-item__header">
                  <div className="admin-charge-item__summary">
                    <div className="admin-charge-item__title-row">
                      <span className="admin-charge-item__user" dir="ltr">
                        {inv.code}
                      </span>
                      <span className={`admin-charge-item__badge admin-charge-item__badge--${tone}`}>
                        {inv.status}
                      </span>
                    </div>
                    <div className="admin-charge-item__amount">
                      <span className="admin-charge-item__amount-num">
                        {formatFaNumber(inv.amountToman)}
                      </span>
                      <span className="admin-charge-item__amount-unit">{t("wallet.toman")}</span>
                    </div>
                  </div>
                </div>
                <div className="admin-charge-item__meta">
                  <span className="admin-charge-item__meta-chip">
                    <span>{formatFaDate(inv.createdAt)}</span>
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}
    </AdminScreen>
  );
}
