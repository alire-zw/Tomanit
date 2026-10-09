import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import FolderAttachmentIcon from "../../components/icons/folder-attachment-stroke-rounded";
import { EmptyState } from "../../components/EmptyState";
import { ImageViewer } from "../../components/ImageViewer";
import { PageHeader } from "../../components/PageHeader";
import { useNotification } from "../../components/Notification";
import { useI18n } from "../../context/I18nContext";
import { useTelegram } from "../../hooks/useTelegram";
import { localeToBcp47 } from "../../i18n";
import { apiFetch, type SupportTicketDetail } from "../../lib/api";
import {
  supportStatusLabel,
  supportSubjectLabel,
  supportTicketTitle,
} from "../../lib/supportMeta";
import { compressSupportImage, isImageOnlyMessageBody } from "../../lib/supportImage";
import "../../styles/shop-rise.css";
import "./Support.css";

export function SupportDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { t, locale } = useI18n();
  const { haptic } = useTelegram();
  const { notify } = useNotification();
  const [ticket, setTicket] = useState<SupportTicketDetail | null>(null);
  const [hasFetched, setHasFetched] = useState(false);
  const [draft, setDraft] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [viewerSrc, setViewerSrc] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const formatMessageTime = (value: string) =>
    new Date(value).toLocaleTimeString(localeToBcp47(locale), {
      hour: "2-digit",
      minute: "2-digit",
    });

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const data = await apiFetch<{ ticket: SupportTicketDetail }>(`/support/tickets/${id}`);
      setTicket(data.ticket);
    } catch {
      setTicket(null);
    } finally {
      setHasFetched(true);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [ticket?.messages.length]);

  const pickImage = async (file: File | null) => {
    if (!file) return;
    try {
      const dataUrl = await compressSupportImage(file);
      setImagePreview(dataUrl);
      haptic("light");
    } catch (error) {
      notify(error instanceof Error ? error.message : t("support.imagePickFailed"), "error");
    }
  };

  const send = async () => {
    if (!id || ticket?.status === "closed") return;
    const text = draft.trim();
    if (!text && !imagePreview) return;
    setSending(true);
    try {
      await apiFetch(`/support/tickets/${id}/messages`, {
        method: "POST",
        body: {
          body: text,
          imageData: imagePreview || undefined,
        },
      });
      setDraft("");
      setImagePreview(null);
      haptic("light");
      await load();
    } catch (error) {
      notify(error instanceof Error ? error.message : t("support.sendFailed"), "error");
    } finally {
      setSending(false);
    }
  };

  const headerTitle = ticket ? supportTicketTitle(ticket.code) : t("support.ticket");
  const showSkeleton = !hasFetched && !ticket;
  const canSend = Boolean(draft.trim() || imagePreview);

  return (
    <div className="support support--chat shop-rise">
      <div className="support__top">
        <PageHeader
          title={headerTitle}
          onBack={() => navigate("/support", { replace: true })}
          action={
            ticket ? (
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
            ) : undefined
          }
        />
        {ticket ? (
          <div className="support__chat-meta-row">
            <span className="support__chat-chip">{supportSubjectLabel(ticket.subject)}</span>
            <span className="support__chat-chip support__chat-chip--muted">{ticket.code}</span>
          </div>
        ) : showSkeleton ? (
          <div className="support__chat-meta-row">
            <span className="support__chat-chip-skel" />
            <span className="support__chat-chip-skel support__chat-chip-skel--short" />
          </div>
        ) : null}
      </div>

      <div className="support__scroll">
        {showSkeleton ? (
          <div className="support__messages">
            {[0, 1, 2, 3].map((index) => (
              <div
                key={index}
                className={`support__msg support__msg--skel ${
                  index % 2 === 0 ? "support__msg--user" : "support__msg--admin"
                }`}
              >
                <span className="support__msg-skel-bubble" />
              </div>
            ))}
          </div>
        ) : !ticket ? (
          <EmptyState title={t("support.notFound")} />
        ) : (
          <div className="support__messages">
            {ticket.messages.map((message) => {
              const isUser = message.sender === "user";
              const hasImage = Boolean(message.imageData);
              const showText = !isImageOnlyMessageBody(message.body, hasImage);
              return (
                <div
                  key={message.id}
                  className={`support__msg support__msg--${isUser ? "user" : "admin"}`}
                >
                  {message.imageData ? (
                    <button
                      type="button"
                      className="support__msg-image-btn"
                      onClick={() => setViewerSrc(message.imageData!)}
                    >
                      <img className="support__msg-image" src={message.imageData} alt="" />
                    </button>
                  ) : null}
                  {showText ? <p className="support__msg-text">{message.body}</p> : null}
                  <span className="support__msg-time">{formatMessageTime(message.createdAt)}</span>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {ticket?.status === "closed" ? (
        <p className="support__closed-note">{t("support.closedNote")}</p>
      ) : ticket ? (
        <div className="support__composer-wrap">
          {imagePreview ? (
            <div className="support__attach-preview">
              <img src={imagePreview} alt="" />
              <button
                type="button"
                className="support__attach-remove"
                onClick={() => setImagePreview(null)}
              >
                {t("support.removeImage")}
              </button>
            </div>
          ) : null}
          <div className="support__composer">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="support__file-input"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                event.target.value = "";
                void pickImage(file);
              }}
            />
            <button
              type="button"
              className="support__attach-btn"
              aria-label={t("support.attachPhotoAria")}
              onClick={() => fileRef.current?.click()}
            >
              <FolderAttachmentIcon width={18} height={18} />
            </button>
            <textarea
              className="support__composer-input"
              rows={1}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={t("support.composerPlaceholder")}
              maxLength={4000}
            />
            <button
              type="button"
              className="support__composer-send"
              disabled={sending || !canSend}
              onClick={() => void send()}
            >
              {t("support.send")}
            </button>
          </div>
        </div>
      ) : showSkeleton ? (
        <div className="support__composer-wrap">
          <div className="support__composer">
            <span className="support__composer-skel" />
            <span className="support__composer-skel support__composer-skel--send" />
          </div>
        </div>
      ) : null}

      <ImageViewer
        isOpen={Boolean(viewerSrc)}
        src={viewerSrc}
        alt={t("support.attachmentAlt")}
        onClose={() => setViewerSrc(null)}
      />
    </div>
  );
}
