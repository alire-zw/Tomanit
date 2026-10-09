import { useEffect, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import ComplaintIcon from "../../components/icons/complaint-stroke-rounded";
import Ticket02Icon from "../../components/icons/ticket-02-stroke-rounded";
import { EmptyState } from "../../components/EmptyState";
import { useI18n } from "../../context/I18nContext";
import { useAuth } from "../../hooks/useAuth";
import { useTelegram } from "../../hooks/useTelegram";
import { localeToBcp47 } from "../../i18n";
import {
  apiFetch,
  sessionDataChanged,
  type SupportTicketSummary,
} from "../../lib/api";
import {
  supportStatusLabel,
  supportSubjectLabel,
  supportTicketTitle,
} from "../../lib/supportMeta";
import "../../styles/shop-rise.css";
import "./Support.css";

function ArrowIcon({ flip }: { flip?: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="1em"
      height="1em"
      fill="none"
      viewBox="0 0 24 24"
      style={flip ? { transform: "scaleX(-1)" } : undefined}
    >
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="m15 18-6-6 6-6"
      />
    </svg>
  );
}

function TicketSkeleton({ index }: { index: number }) {
  return (
    <div
      className="support__ticket-card support__ticket-card--skeleton shop-rise"
      style={{ "--rise-index": 4 + index } as CSSProperties}
    >
      <span className="support__ticket-skel-icon" />
      <span className="support__ticket-card-body">
        <span className="support__ticket-card-top">
          <span className="support__ticket-skel-title" />
          <span className="support__ticket-skel-badge" />
        </span>
        <span className="support__ticket-skel-meta" />
      </span>
    </div>
  );
}

type SupportListBoot = {
  tickets: SupportTicketSummary[];
  telegramUsername: string | null;
};

/** Dedupes StrictMode double-mount and rapid remounts. */
let supportListInflight: Promise<SupportListBoot> | null = null;
let supportListCache: { at: number; data: SupportListBoot } | null = null;
const SUPPORT_LIST_CACHE_MS = 15_000;

function fetchSupportListBoot(force = false): Promise<SupportListBoot> {
  if (
    !force &&
    supportListCache &&
    Date.now() - supportListCache.at < SUPPORT_LIST_CACHE_MS
  ) {
    return Promise.resolve(supportListCache.data);
  }
  if (!supportListInflight) {
    supportListInflight = Promise.all([
      apiFetch<{ tickets: SupportTicketSummary[] }>("/support/tickets"),
      apiFetch<{ supportTelegramUsername?: string | null }>("/support/contact").catch(
        () => ({ supportTelegramUsername: null }),
      ),
    ])
      .then(([ticketsRes, contactRes]) => {
        const data: SupportListBoot = {
          tickets: ticketsRes.tickets,
          telegramUsername: contactRes.supportTelegramUsername?.replace(/^@/, "") || null,
        };
        supportListCache = { at: Date.now(), data };
        return data;
      })
      .finally(() => {
        supportListInflight = null;
      });
  }
  return supportListInflight;
}

export function SupportListPage() {
  const navigate = useNavigate();
  const { t, locale, isRTL } = useI18n();
  const { haptic, openLink } = useTelegram();
  const { tickets: authTickets, applyTickets } = useAuth();
  const numberLocale = localeToBcp47(locale);
  const chevron = <ArrowIcon flip={!isRTL} />;

  const formatTicketDate = (value: string) =>
    new Date(value).toLocaleDateString(numberLocale, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  const [items, setItems] = useState<SupportTicketSummary[]>(() => authTickets ?? []);
  const [hasFetched, setHasFetched] = useState(() => authTickets !== undefined);
  const [error, setError] = useState<string | null>(null);
  const [telegramUsername, setTelegramUsername] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (authTickets !== undefined) {
      setItems(authTickets);
      setHasFetched(true);
    }

    void (async () => {
      setError(null);
      try {
        const data = await fetchSupportListBoot(true);
        if (cancelled) return;
        setItems((prev) => {
          if (!sessionDataChanged(prev, data.tickets)) return prev;
          applyTickets(data.tickets);
          return data.tickets;
        });
        setTelegramUsername(data.telegramUsername);
      } catch (err) {
        if (cancelled) return;
        if (authTickets === undefined) {
          setItems([]);
          setError(err instanceof Error ? err.message : t("support.loadError"));
        }
        setTelegramUsername(null);
      } finally {
        if (!cancelled) setHasFetched(true);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const telegramUrl = telegramUsername ? `https://t.me/${telegramUsername}` : null;

  const openDirectChat = () => {
    if (!telegramUrl) return;
    haptic("medium");
    openLink(telegramUrl);
  };

  const handleMenuClick = (action: () => void) => {
    haptic("light");
    action();
  };

  const openCount = items.filter((item) => item.status === "open").length;
  const answeredCount = items.filter((item) => item.status === "answered").length;
  const showSkeleton = !hasFetched && items.length === 0 && !error;
  const showStatsSkeleton = !hasFetched && items.length === 0;

  return (
    <div className="support">
      <section className="support__hero shop-rise" style={{ "--rise-index": 0 } as CSSProperties}>
        <div className="support__hero-copy">
          <p className="support__eyebrow">{t("support.center")}</p>
          <h1 className="support__title">{t("support.heroTitle")}</h1>
          <p className="support__lead">{t("support.heroLead")}</p>
        </div>
        <div className="support__stats">
          <div className="support__stat">
            <span className="support__stat-value">
              {showStatsSkeleton ? (
                <span className="support__stat-skel" />
              ) : (
                items.length.toLocaleString(numberLocale)
              )}
            </span>
            <span className="support__stat-label">{t("support.ticketsStat")}</span>
          </div>
          <div className="support__stat">
            <span className="support__stat-value">
              {showStatsSkeleton ? (
                <span className="support__stat-skel" />
              ) : (
                openCount.toLocaleString(numberLocale)
              )}
            </span>
            <span className="support__stat-label">{t("support.open")}</span>
          </div>
          <div className="support__stat">
            <span className="support__stat-value">
              {showStatsSkeleton ? (
                <span className="support__stat-skel" />
              ) : (
                answeredCount.toLocaleString(numberLocale)
              )}
            </span>
            <span className="support__stat-label">{t("support.answered")}</span>
          </div>
        </div>
      </section>

      <h5 className="support__menu-title shop-rise" style={{ "--rise-index": 1 } as CSSProperties}>
        {t("support.quickContact")}
      </h5>
      <div className="support__menu-box shop-rise" style={{ "--rise-index": 2 } as CSSProperties}>
        <button
          type="button"
          className="support__menu-item"
          onClick={() => handleMenuClick(() => navigate("/support/new"))}
        >
          <span className="support__menu-start">
            <span className="support__menu-icon">
              <Ticket02Icon width={18} height={18} />
            </span>
            <span>{t("support.createTicket")}</span>
          </span>
          {chevron}
        </button>
        <div className="support__menu-divider" />
        <button
          type="button"
          className={`support__menu-item${telegramUsername ? "" : " support__menu-item--disabled"}`}
          disabled={!telegramUsername}
          onClick={openDirectChat}
        >
          <span className="support__menu-start">
            <span className="support__menu-icon">
              <ComplaintIcon width={18} height={18} />
            </span>
            <span>{t("support.directChat")}</span>
          </span>
          {chevron}
        </button>
      </div>

      <h5 className="support__menu-title shop-rise" style={{ "--rise-index": 3 } as CSSProperties}>
        {t("support.myTickets")}
      </h5>

      {error ? <p className="support__error">{error}</p> : null}

      {showSkeleton ? (
        <div className="support__ticket-panel shop-rise" style={{ "--rise-index": 4 } as CSSProperties}>
          {[0, 1, 2].map((index) => (
            <TicketSkeleton key={index} index={index} />
          ))}
        </div>
      ) : hasFetched && items.length === 0 ? (
        <div className="support__ticket-panel shop-rise" style={{ "--rise-index": 4 } as CSSProperties}>
          <EmptyState title={t("support.empty")} />
        </div>
      ) : (
        <div className="support__ticket-panel shop-rise" style={{ "--rise-index": 4 } as CSSProperties}>
          {items.map((ticket) => (
            <button
              key={ticket.id}
              type="button"
              className="support__ticket-card"
              onClick={() => handleMenuClick(() => navigate(`/support/${ticket.id}`))}
            >
              <span className="support__ticket-card-icon">
                <Ticket02Icon width={16} height={16} />
              </span>
              <span className="support__ticket-card-body">
                <span className="support__ticket-card-top">
                  <span className="support__ticket-card-title">{supportTicketTitle(ticket.code)}</span>
                  <span
                    className={`support__badge${
                      ticket.status === "answered"
                        ? " support__badge--answered"
                        : ticket.status === "closed"
                          ? " support__badge--closed"
                          : ""
                    }`}
                  >
                    {supportStatusLabel(ticket.status)}
                  </span>
                </span>
                <span className="support__ticket-card-meta">
                  {supportSubjectLabel(ticket.subject)}
                  {" · "}
                  {formatTicketDate(ticket.updatedAt)}
                </span>
              </span>
              <span className="support__ticket-card-arrow">{chevron}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
