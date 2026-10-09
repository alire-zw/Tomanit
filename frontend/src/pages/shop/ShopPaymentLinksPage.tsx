import { useCallback, useEffect, useMemo, useState, type CSSProperties, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { EmptyState } from "../../components/EmptyState";
import { PageHeader } from "../../components/PageHeader";
import { useNotification } from "../../components/Notification";
import SearchIcon from "../../components/icons/SearchIcon";
import ChatCancelIcon from "../../components/icons/hugeicons/ChatCancelIcon";
import ChatDelay01Icon from "../../components/icons/hugeicons/ChatDelay01Icon";
import ChatDone01Icon from "../../components/icons/hugeicons/ChatDone01Icon";
import ChatIcon from "../../components/icons/hugeicons/ChatIcon";
import Copy01Icon from "../../components/icons/hugeicons/Copy01Icon";
import Delete03Icon from "../../components/icons/hugeicons/Delete03Icon";
import Invoice04Icon from "../../components/icons/hugeicons/Invoice04Icon";
import Unlink01Icon from "../../components/icons/hugeicons/Unlink01Icon";
import { useI18n } from "../../context/I18nContext";
import { useTelegram } from "../../hooks/useTelegram";
import { formatFaNumber } from "../../lib/format";
import {
  deleteShopPaymentLink,
  fetchShopPaymentLinks,
  revokeShopPaymentLink,
  type MerchantPaymentLink,
  type MerchantPaymentLinkStatus,
} from "../../lib/shop";
import "../../styles/shop-rise.css";
import "../MyShop.css";

type TabId = "pending" | "paid" | "unpaid" | "all";

function statusMeta(status: MerchantPaymentLinkStatus, t: (k: string) => string) {
  if (status === "paid") return { cls: "my-shop__badge--ok", label: t("myShop.linkPaid") };
  if (status === "open") return { cls: "my-shop__badge--warn", label: t("myShop.linkOpen") };
  if (status === "expired") return { cls: "my-shop__badge--mute", label: t("myShop.linkExpired") };
  return { cls: "my-shop__badge--err", label: t("myShop.linkCancelled") };
}

function matchesTab(status: MerchantPaymentLinkStatus, tab: TabId): boolean {
  if (tab === "all") return true;
  if (tab === "pending") return status === "open";
  if (tab === "paid") return status === "paid";
  return status === "cancelled" || status === "expired";
}

function TabIcon({ id }: { id: TabId }) {
  const props = { size: 15, color: "currentColor" as const };
  if (id === "pending") return <ChatDelay01Icon {...props} />;
  if (id === "paid") return <ChatDone01Icon {...props} />;
  if (id === "unpaid") return <ChatCancelIcon {...props} />;
  return <ChatIcon {...props} />;
}

export function ShopPaymentLinksPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { haptic } = useTelegram();
  const { notify } = useNotification();
  const [links, setLinks] = useState<MerchantPaymentLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>("all");
  const [query, setQuery] = useState("");

  const tabs: Array<{ id: TabId; label: string }> = [
    { id: "all", label: t("myShop.invoiceTabAll") },
    { id: "pending", label: t("myShop.invoiceTabPending") },
    { id: "paid", label: t("myShop.invoiceTabPaid") },
    { id: "unpaid", label: t("myShop.invoiceTabUnpaid") },
  ];

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchShopPaymentLinks();
      setLinks(data.links);
    } catch (err) {
      setLinks([]);
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/\s+/g, "");
    return links.filter((link) => {
      if (!matchesTab(link.status, tab)) return false;
      if (!q) return true;
      const code = link.code.toLowerCase();
      const digits = code.replace(/^inv-/, "");
      const pay = (link.payToken ?? "").toLowerCase();
      return code.includes(q) || digits.includes(q) || pay.includes(q);
    });
  }, [links, tab, query]);

  const copyUrl = async (url: string) => {
    haptic("light");
    try {
      await navigator.clipboard.writeText(url);
      notify(t("common.copied"), "success");
    } catch {
      notify(t("common.error"), "error");
    }
  };

  const onRevoke = async (link: MerchantPaymentLink) => {
    if (busyId || link.status !== "open") return;
    setBusyId(link.id);
    haptic("light");
    try {
      const { link: updated } = await revokeShopPaymentLink(link.id);
      setLinks((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      try {
        await navigator.clipboard.writeText(updated.url);
      } catch {
        // ignore
      }
      notify(t("myShop.invoiceRevoked"), "success");
    } catch (err) {
      notify(err instanceof Error ? err.message : t("common.error"), "error");
    } finally {
      setBusyId(null);
    }
  };

  const onDelete = async (link: MerchantPaymentLink) => {
    if (busyId || link.status === "paid") return;
    setBusyId(link.id);
    haptic("medium");
    try {
      await deleteShopPaymentLink(link.id);
      setLinks((prev) => prev.filter((item) => item.id !== link.id));
      notify(t("myShop.invoiceDeleted"), "success");
    } catch (err) {
      notify(err instanceof Error ? err.message : t("common.error"), "error");
    } finally {
      setBusyId(null);
    }
  };

  const onSearch = (event: FormEvent) => {
    event.preventDefault();
  };

  const emptyTitle =
    links.length === 0
      ? t("myShop.noPaymentLinksYet")
      : t("myShop.invoiceFilterEmpty");

  return (
    <div className="my-shop my-shop--sub my-shop--invoices-page">
      <div className="my-shop__invoices-sticky">
        <div className="shop-rise" style={{ "--rise-index": 0 } as CSSProperties}>
          <PageHeader
            title={t("myShop.tilePaymentLinks")}
            onBack={() => navigate("/shop")}
            action={
              <button
                type="button"
                className="page-header__action page-header__action--accent"
                onClick={() => {
                  haptic("light");
                  navigate("/shop/payment-links/new");
                }}
              >
                {t("myShop.newInvoice")}
              </button>
            }
          />
        </div>

        <div className="my-shop__tabs shop-rise" style={{ "--rise-index": 1 } as CSSProperties}>
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`my-shop__tabs-btn${tab === item.id ? " my-shop__tabs-btn--active" : ""}`}
              onClick={() => {
                haptic("light");
                setTab(item.id);
              }}
            >
              <TabIcon id={item.id} />
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        <form
          className="my-shop__invoice-search shop-rise"
          style={{ "--rise-index": 2 } as CSSProperties}
          onSubmit={onSearch}
        >
          <SearchIcon width={15} height={15} color="var(--text-muted)" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("myShop.invoiceSearchPh")}
            aria-label={t("myShop.invoiceSearchPh")}
            inputMode="text"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
          />
        </form>
      </div>

      <div className="my-shop__body my-shop__body--invoices">
        {loading ? (
          <div
            className="my-shop__list shop-rise"
            style={{ "--rise-index": 3 } as CSSProperties}
            aria-busy
            aria-label={t("common.loading")}
          >
            {[0, 1, 2, 3, 4].map((index) => (
              <div
                key={index}
                className="my-shop__item my-shop__item--static my-shop__invoice-row my-shop__invoice-row--skeleton"
                aria-hidden
              >
                <span className="my-shop__item-icon my-shop__invoice-skel-icon" />
                <div className="my-shop__item-body">
                  <div className="my-shop__invoice-id-row">
                    <span className="my-shop__invoice-skel-code" />
                    <span className="my-shop__invoice-skel-badge" />
                  </div>
                  <span className="my-shop__invoice-skel-sub" />
                </div>
                <div className="my-shop__item-end my-shop__invoice-actions">
                  <span className="my-shop__invoice-skel-btn" />
                  <span className="my-shop__invoice-skel-btn" />
                  <span className="my-shop__invoice-skel-btn" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <p className="my-shop__hint">{error}</p>
        ) : filtered.length === 0 ? (
          <EmptyState title={emptyTitle} compact />
        ) : (
          <div
            className="my-shop__list shop-rise"
            style={{ "--rise-index": 3 } as CSSProperties}
          >
            {filtered.map((link) => {
              const badge = statusMeta(link.status, t);
              const canMutate = link.status !== "paid";
              return (
                <div key={link.id} className="my-shop__item my-shop__item--static my-shop__invoice-row">
                  <span className="my-shop__item-icon" aria-hidden>
                    <Invoice04Icon variant="bulk-rounded" size={16} color="currentColor" />
                  </span>
                  <div className="my-shop__item-body">
                    <div className="my-shop__invoice-id-row">
                      <span className="my-shop__invoice-code">{link.code}</span>
                      <span className={`my-shop__badge ${badge.cls}`}>{badge.label}</span>
                    </div>
                    <div className="my-shop__item-sub">
                      {formatFaNumber(link.amountToman)} {t("wallet.toman")}
                    </div>
                  </div>
                  <div className="my-shop__item-end my-shop__invoice-actions">
                    {link.status === "open" ? (
                      <button
                        type="button"
                        className="my-shop__icon-btn"
                        aria-label={t("common.copy")}
                        disabled={busyId === link.id}
                        onClick={() => void copyUrl(link.url)}
                      >
                        <Copy01Icon variant="bulk-rounded" size={14} color="currentColor" />
                      </button>
                    ) : null}
                    {link.status === "open" ? (
                      <button
                        type="button"
                        className="my-shop__icon-btn"
                        aria-label={t("myShop.revokeInvoice")}
                        disabled={busyId === link.id}
                        onClick={() => void onRevoke(link)}
                      >
                        <Unlink01Icon variant="bulk-rounded" size={14} color="currentColor" />
                      </button>
                    ) : null}
                    {canMutate ? (
                      <button
                        type="button"
                        className="my-shop__icon-btn my-shop__icon-btn--danger"
                        aria-label={t("myShop.deleteInvoice")}
                        disabled={busyId === link.id}
                        onClick={() => void onDelete(link)}
                      >
                        <Delete03Icon variant="bulk-rounded" size={14} color="currentColor" />
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
