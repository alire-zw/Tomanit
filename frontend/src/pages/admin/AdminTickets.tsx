import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { EmptyState } from "../../components/EmptyState";
import { ImageViewer } from "../../components/ImageViewer";
import { PageHeader } from "../../components/PageHeader";
import ChatQuestionIcon from "../../components/icons/ChatQuestionIcon";
import CheckmarkBadgeIcon from "../../components/icons/CheckmarkBadgeIcon";
import LockIcon from "../../components/icons/LockIcon";
import NoteIcon from "../../components/icons/NoteIcon";
import Ticket02Icon from "../../components/icons/ticket-02-stroke-rounded";
import UserIcon from "../../components/icons/UserIcon";
import { useNotification } from "../../components/Notification";
import { useI18n } from "../../context/I18nContext";
import { useAuth } from "../../hooks/useAuth";
import { useTelegram } from "../../hooks/useTelegram";
import { localeToBcp47 } from "../../i18n";
import {
  apiFetch,
  type AdminTicketListItem,
  type SupportMessage,
} from "../../lib/api";
import { formatFaNumber, ticketStatusLabel } from "../../lib/format";
import { isImageOnlyMessageBody } from "../../lib/supportImage";
import {
  SUPPORT_CATEGORIES,
  resolveSupportCategory,
  supportSubjectLabel,
  type SupportCategory,
} from "../../lib/supportMeta";
import { lockAppScroll, unlockAppScroll } from "../../lib/scrollLock";
import { useRelockScrollWhileOpen } from "../../hooks/useRelockScrollWhileOpen";
import "../../styles/shop-rise.css";
import "./Admin.css";
import "./AdminTickets.css";

const STATUS_TAB_IDS = ["all", "open", "answered", "closed"] as const;

type StatusTabId = (typeof STATUS_TAB_IDS)[number];
type CategoryFilter = "all" | SupportCategory;

function formatLocaleDateTime(value: string, locale: string) {
  return new Date(value).toLocaleString(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatLocaleTime(value: string, locale: string) {
  return new Date(value).toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusTabIcon({ id }: { id: StatusTabId }) {
  if (id === "open") return <ChatQuestionIcon width={15} height={15} />;
  if (id === "answered") return <CheckmarkBadgeIcon width={15} height={15} />;
  if (id === "closed") return <LockIcon width={15} height={15} color="currentColor" />;
  return <NoteIcon width={15} height={15} />;
}

function TicketItemSkeleton({ index }: { index: number }) {
  return (
    <article
      className="admin-ticket-item admin-ticket-item--skeleton shop-rise"
      style={{ "--rise-index": Math.min(index + 2, 8) } as CSSProperties}
      aria-hidden
    >
      <div className="admin-ticket-item__header">
        <span className="admin-ticket-skel admin-ticket-skel--icon" />
        <div className="admin-ticket-item__summary">
          <div className="admin-ticket-item__title-row">
            <span className="admin-ticket-skel admin-ticket-skel--title" />
            <span className="admin-ticket-skel admin-ticket-skel--badge" />
          </div>
          <span className="admin-ticket-skel admin-ticket-skel--preview" />
        </div>
      </div>
      <div className="admin-ticket-item__meta">
        <span className="admin-ticket-item__meta-chip admin-ticket-item__meta-chip--skel">
          <span className="admin-ticket-skel admin-ticket-skel--line" />
        </span>
        <span className="admin-ticket-item__meta-chip admin-ticket-item__meta-chip--skel">
          <span className="admin-ticket-skel admin-ticket-skel--line admin-ticket-skel--line-sm" />
        </span>
      </div>
    </article>
  );
}

type TicketDetail = {
  code: string;
  subject: string;
  status: string;
  userLabel: string;
  messages: SupportMessage[];
};

export function AdminTicketsPage() {
  const navigate = useNavigate();
  const { haptic } = useTelegram();
  const { user } = useAuth();
  const { notify } = useNotification();
  const { t, locale } = useI18n();
  const bcp47 = localeToBcp47(locale);
  const allowed = user?.role === "admin" || user?.role === "supervisor";

  const statusTabs = useMemo(
    () =>
      STATUS_TAB_IDS.map((id) => ({
        id,
        label: id === "all" ? t("common.all") : t(`status.${id}`),
      })),
    [t],
  );

  const categoryChips = useMemo(
    () => [
      { value: "all" as const, label: t("common.all") },
      ...SUPPORT_CATEGORIES.map((item) => ({
        value: item.value,
        label: t(item.labelKey),
      })),
    ],
    [t],
  );

  const [status, setStatus] = useState<StatusTabId>("all");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<AdminTicketListItem[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<TicketDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [panelVisible, setPanelVisible] = useState(false);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [viewerSrc, setViewerSrc] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const closePanel = useCallback(() => {
    setPanelVisible(false);
    window.setTimeout(() => {
      setSelectedId(null);
      setDetail(null);
      setReply("");
    }, 280);
  }, []);

  const handleBack = useCallback(() => {
    if (selectedId != null) {
      closePanel();
      return;
    }
    navigate("/admin", { replace: true });
  }, [closePanel, navigate, selectedId]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "20",
      });
      if (status !== "all") params.set("status", status);
      if (category !== "all") params.set("q", category);
      const data = await apiFetch<{
        tickets: AdminTicketListItem[];
        totalPages: number;
      }>(`/admin/tickets?${params.toString()}`);
      const tickets =
        category === "all"
          ? data.tickets
          : data.tickets.filter(
              (ticket) => resolveSupportCategory(ticket.subject) === category,
            );
      setItems(tickets);
      setTotalPages(data.totalPages);
    } catch (error) {
      notify(error instanceof Error ? error.message : t("admin.loadTicketsError"), "error");
    } finally {
      setLoading(false);
    }
  }, [category, notify, page, status, t]);

  useEffect(() => {
    if (!allowed) return;
    void load();
  }, [allowed, load]);

  useEffect(() => {
    setPage(1);
  }, [status, category]);

  const openTicket = async (id: string) => {
    haptic("light");
    setSelectedId(id);
    setDetail(null);
    setDetailLoading(true);
    setPanelVisible(false);
    requestAnimationFrame(() => setPanelVisible(true));
    try {
      const data = await apiFetch<{
        ticket: {
          code: string;
          subject: string;
          status: string;
          userLabel: string;
          messages: SupportMessage[];
        };
      }>(`/admin/tickets/${id}`);
      setDetail({
        code: data.ticket.code,
        subject: data.ticket.subject,
        status: data.ticket.status,
        userLabel: data.ticket.userLabel,
        messages: data.ticket.messages,
      });
    } catch (error) {
      notify(error instanceof Error ? error.message : t("admin.loadTicketError"), "error");
      closePanel();
    } finally {
      setDetailLoading(false);
    }
  };

  const loadDetail = async (id: string) => {
    const data = await apiFetch<{
      ticket: {
        code: string;
        subject: string;
        status: string;
        userLabel: string;
        messages: SupportMessage[];
      };
    }>(`/admin/tickets/${id}`);
    setDetail({
      code: data.ticket.code,
      subject: data.ticket.subject,
      status: data.ticket.status,
      userLabel: data.ticket.userLabel,
      messages: data.ticket.messages,
    });
  };

  useEffect(() => {
    if (!panelVisible) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [detail?.messages.length, panelVisible]);

  useRelockScrollWhileOpen(selectedId != null);

  useEffect(() => {
    if (selectedId == null) return;
    lockAppScroll();
    return () => unlockAppScroll();
  }, [selectedId]);

  const sendReply = async () => {
    if (!selectedId || !reply.trim() || sending) return;
    setSending(true);
    try {
      await apiFetch(`/admin/tickets/${selectedId}`, {
        method: "PATCH",
        body: { reply: reply.trim() },
      });
      haptic("medium");
      setReply("");
      notify(t("admin.replySent"));
      await loadDetail(selectedId);
      await load();
    } catch (error) {
      notify(error instanceof Error ? error.message : t("admin.replyError"), "error");
    } finally {
      setSending(false);
    }
  };

  const closeTicket = async () => {
    if (!selectedId || sending) return;
    if (!window.confirm(t("admin.closeConfirm"))) return;
    setSending(true);
    try {
      await apiFetch(`/admin/tickets/${selectedId}`, {
        method: "PATCH",
        body: {
          reply: reply.trim() || t("admin.closeDefaultReply"),
          status: "closed",
        },
      });
      haptic("medium");
      setReply("");
      notify(t("admin.ticketClosedNotify"), "warning");
      await loadDetail(selectedId);
      await load();
    } catch (error) {
      notify(error instanceof Error ? error.message : t("admin.closeTicketError"), "error");
    } finally {
      setSending(false);
    }
  };

  if (!allowed) return null;

  const chatPanel =
    selectedId != null
      ? createPortal(
          <>
            <button
              type="button"
              className={`admin-ticket-sheet__backdrop${
                panelVisible ? " admin-ticket-sheet__backdrop--visible" : ""
              }`}
              aria-label={t("common.close")}
              onClick={closePanel}
            />
            <div
              className={`admin-ticket-sheet${panelVisible ? " admin-ticket-sheet--visible" : ""}`}
              role="dialog"
              aria-modal="true"
              aria-label={t("admin.ticketChatAria")}
            >
              <div className="admin-ticket-sheet__header">
                <PageHeader
                  title={
                    detail
                      ? t("support.ticketTitle", { code: detail.code })
                      : t("admin.ticketDetail")
                  }
                  onBack={closePanel}
                  action={
                    detail ? (
                      <span
                        className={`admin-ticket-item__badge admin-ticket-item__badge--${detail.status}`}
                      >
                        {ticketStatusLabel(detail.status)}
                      </span>
                    ) : undefined
                  }
                />
                {detail ? (
                  <div className="admin-ticket-sheet__meta">
                    <span className="admin-ticket-sheet__chip">{detail.userLabel}</span>
                    <span className="admin-ticket-sheet__chip">
                      {supportSubjectLabel(detail.subject)}
                    </span>
                  </div>
                ) : null}
              </div>

              <div className="admin-ticket-sheet__scroll">
                {detailLoading && !detail ? (
                  <p className="admin-empty">{t("common.loading")}</p>
                ) : !detail ? (
                  <EmptyState title={t("support.notFound")} />
                ) : (
                  <div className="admin-ticket-sheet__messages">
                    {detail.messages.map((message) => {
                      const isAdmin = message.sender === "admin";
                      const hasImage = Boolean(message.imageData);
                      const showText = !isImageOnlyMessageBody(message.body, hasImage);
                      return (
                        <div
                          key={message.id}
                          className={`admin-ticket-msg admin-ticket-msg--${
                            isAdmin ? "admin" : "user"
                          }`}
                        >
                          {message.imageData ? (
                            <button
                              type="button"
                              className="admin-ticket-msg__image-btn"
                              onClick={() => setViewerSrc(message.imageData!)}
                            >
                              <img src={message.imageData} alt="" />
                            </button>
                          ) : null}
                          {showText ? (
                            <p className="admin-ticket-msg__text">{message.body}</p>
                          ) : null}
                          <span className="admin-ticket-msg__time">
                            {isAdmin ? `${t("admin.senderAdmin")} · ` : `${t("admin.senderUser")} · `}
                            {formatLocaleTime(message.createdAt, bcp47)}
                          </span>
                        </div>
                      );
                    })}
                    <div ref={bottomRef} />
                  </div>
                )}
              </div>

              {detail?.status === "closed" ? (
                <p className="admin-ticket-sheet__closed">{t("support.closedNote")}</p>
              ) : detail ? (
                <div className="admin-ticket-sheet__composer">
                  <textarea
                    className="admin-ticket-sheet__input"
                    rows={2}
                    value={reply}
                    onChange={(event) => setReply(event.target.value)}
                    placeholder={t("admin.replyPlaceholder")}
                    maxLength={4000}
                  />
                  <div className="admin-ticket-sheet__actions">
                    <button
                      type="button"
                      className="admin-charge-item__btn admin-charge-item__btn--reject"
                      disabled={sending}
                      onClick={() => void closeTicket()}
                    >
                      {t("admin.closeTicket")}
                    </button>
                    <button
                      type="button"
                      className="admin-charge-item__btn admin-charge-item__btn--approve"
                      disabled={sending || !reply.trim()}
                      onClick={() => void sendReply()}
                    >
                      {sending ? "…" : t("admin.sendReply")}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </>,
          document.body,
        )
      : null;

  return (
    <div className="admin-section">
      <div className="shop-rise" style={{ "--rise-index": 0 } as CSSProperties}>
        <PageHeader title={t("admin.ticketsPageTitle")} onBack={handleBack} />
      </div>

      <div className="admin-tabs shop-rise" style={{ "--rise-index": 1 } as CSSProperties}>
        {statusTabs.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`admin-tabs__btn${status === item.id ? " admin-tabs__btn--active" : ""}`}
            onClick={() => {
              haptic("light");
              setStatus(item.id);
            }}
          >
            <StatusTabIcon id={item.id} />
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      <div className="admin-ticket-cats shop-rise" style={{ "--rise-index": 2 } as CSSProperties}>
        {categoryChips.map((item) => (
          <button
            key={item.value}
            type="button"
            className={`admin-ticket-cats__chip${
              category === item.value ? " admin-ticket-cats__chip--active" : ""
            }`}
            onClick={() => {
              haptic("light");
              setCategory(item.value);
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="admin-ticket-list" aria-busy="true" aria-label={t("common.loading")}>
          {[0, 1, 2].map((index) => (
            <TicketItemSkeleton key={index} index={index} />
          ))}
        </div>
      ) : null}

      {!loading && items.length === 0 ? <p className="admin-empty">{t("admin.emptyTickets")}</p> : null}

      {!loading && items.length > 0 ? (
        <div className="admin-ticket-list">
          {items.map((ticket, index) => {
            const subjectLabel = supportSubjectLabel(ticket.subject);
            const preview = ticket.lastMessage?.body?.slice(0, 90) || subjectLabel;
            return (
              <button
                key={ticket.id}
                type="button"
                className={`admin-ticket-item shop-rise admin-ticket-item--${ticket.status}`}
                style={{ "--rise-index": Math.min(index + 2, 8) } as CSSProperties}
                onClick={() => void openTicket(ticket.id)}
              >
                <div className="admin-ticket-item__header">
                  <span className="admin-ticket-item__icon">
                    <Ticket02Icon width={18} height={18} />
                  </span>
                  <div className="admin-ticket-item__summary">
                    <div className="admin-ticket-item__title-row">
                      <h3 className="admin-ticket-item__title">
                        {ticket.code}
                        <span className="admin-ticket-item__subject"> · {subjectLabel}</span>
                      </h3>
                      <span
                        className={`admin-ticket-item__badge admin-ticket-item__badge--${ticket.status}`}
                      >
                        {ticketStatusLabel(ticket.status)}
                      </span>
                    </div>
                    <p className="admin-ticket-item__preview">{preview}</p>
                  </div>
                </div>

                <div className="admin-ticket-item__meta">
                  <div className="admin-ticket-item__meta-chip">
                    <UserIcon width={12} height={12} />
                    <span>{ticket.userLabel}</span>
                  </div>
                  <div className="admin-ticket-item__meta-chip">
                    <NoteIcon width={12} height={12} />
                    <span>{subjectLabel}</span>
                  </div>
                  <div className="admin-ticket-item__meta-chip">
                    <span>{formatLocaleDateTime(ticket.updatedAt, bcp47)}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      ) : null}

      {!loading && items.length > 0 ? (
        <div className="admin-ticket-pager">
          <button
            type="button"
            className="admin-ticket-pager__btn"
            disabled={page <= 1 || loading}
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
          >
            {t("common.previous")}
          </button>
          <span>
            {formatFaNumber(page)} / {formatFaNumber(totalPages)}
          </span>
          <button
            type="button"
            className="admin-ticket-pager__btn"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((prev) => prev + 1)}
          >
            {t("common.next")}
          </button>
        </div>
      ) : null}

      {chatPanel}

      <ImageViewer
        isOpen={Boolean(viewerSrc)}
        src={viewerSrc}
        alt=""
        onClose={() => setViewerSrc(null)}
      />
    </div>
  );
}
