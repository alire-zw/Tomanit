import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../../components/PageHeader";
import { useNotification } from "../../components/Notification";
import CheckmarkBadge02Icon from "../../components/icons/hugeicons/CheckmarkBadge02Icon";
import CreditCardIcon from "../../components/icons/hugeicons/CreditCardIcon";
import Invoice04Icon from "../../components/icons/hugeicons/Invoice04Icon";
import MoneyReceiveSquareIcon from "../../components/icons/hugeicons/MoneyReceiveSquareIcon";
import Robot01Icon from "../../components/icons/hugeicons/Robot01Icon";
import UserIcon from "../../components/icons/hugeicons/UserIcon";
import { useI18n } from "../../context/I18nContext";
import { useTelegram } from "../../hooks/useTelegram";
import {
  fetchShopReportBot,
  setShopReportBotEnabled,
  type ShopReportBotPayload,
} from "../../lib/shop";
import "../../styles/shop-rise.css";
import "../MyShop.css";

/** After opening Telegram, poll until the owner presses Start. */
const LINK_POLL_MS = 4_000;
const LINK_POLL_MAX_MS = 120_000;

function openTelegram(url: string) {
  const tg = window.Telegram?.WebApp;
  if (tg?.openTelegramLink && url.includes("t.me/")) {
    tg.openTelegramLink(url);
    return;
  }
  if (tg?.openLink) {
    tg.openLink(url);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

export function ShopReportBotPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { haptic } = useTelegram();
  const { notify } = useNotification();
  const [data, setData] = useState<ShopReportBotPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const pollRef = useRef<number | null>(null);
  const pollStartRef = useRef(0);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const next = await fetchShopReportBot();
      setData(next);
      return next;
    } catch (err) {
      if (!silent) {
        notify(err instanceof Error ? err.message : t("common.error"), "error");
      }
      return null;
    } finally {
      if (!silent) setLoading(false);
    }
  }, [notify, t]);

  const stopPolling = useCallback(() => {
    if (pollRef.current != null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setWaiting(false);
  }, []);

  useEffect(() => {
    void load();
    return () => stopPolling();
  }, [load, stopPolling]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void load(true);
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [load]);

  useEffect(() => {
    if (waiting && data?.enabled) {
      stopPolling();
      notify(t("myShop.reportBotActivated"), "success");
    }
  }, [waiting, data?.enabled, stopPolling, notify, t]);

  const startLinking = () => {
    if (!data?.startUrl) return;
    haptic("medium");
    openTelegram(data.startUrl);
    stopPolling();
    setWaiting(true);
    pollStartRef.current = Date.now();
    pollRef.current = window.setInterval(() => {
      if (Date.now() - pollStartRef.current > LINK_POLL_MAX_MS) {
        stopPolling();
        return;
      }
      void load(true);
    }, LINK_POLL_MS);
  };

  const toggle = async (enabled: boolean) => {
    haptic("light");
    setBusy(true);
    try {
      const next = await setShopReportBotEnabled(enabled);
      setData(next);
      notify(
        enabled ? t("myShop.reportBotActivated") : t("myShop.reportBotDeactivated"),
        "success",
      );
    } catch (err) {
      notify(err instanceof Error ? err.message : t("common.error"), "error");
    } finally {
      setBusy(false);
    }
  };

  const available = data?.available ?? true;
  const enabled = Boolean(data?.enabled);
  const linked = Boolean(data?.linked);
  const statusKey = enabled
    ? "myShop.reportBotStatusOn"
    : linked
      ? "myShop.reportBotStatusPaused"
      : "myShop.reportBotStatusOff";
  const statusClass = enabled
    ? "shop-rbot__status shop-rbot__status--on"
    : linked
      ? "shop-rbot__status shop-rbot__status--paused"
      : "shop-rbot__status";

  const features = [
    { Icon: MoneyReceiveSquareIcon, title: "myShop.reportBotFeatAmounts", desc: "myShop.reportBotFeatAmountsDesc" },
    { Icon: Invoice04Icon, title: "myShop.reportBotFeatInvoice", desc: "myShop.reportBotFeatInvoiceDesc" },
    { Icon: UserIcon, title: "myShop.reportBotFeatPayer", desc: "myShop.reportBotFeatPayerDesc" },
    { Icon: CreditCardIcon, title: "myShop.reportBotFeatCard", desc: "myShop.reportBotFeatCardDesc" },
  ];

  return (
    <div className="my-shop my-shop--sub my-shop--report-bot">
      <div className="shop-rise" style={{ "--rise-index": 0 } as CSSProperties}>
        <PageHeader title={t("myShop.tileReportBot")} onBack={() => navigate("/shop")} />
      </div>

      <div className="my-shop__body">
        <section
          className="shop-rbot__hero shop-rise"
          style={{ "--rise-index": 1 } as CSSProperties}
        >
          <span
            className={`shop-rbot__hero-icon${enabled ? " shop-rbot__hero-icon--on" : ""}`}
            aria-hidden
          >
            <Robot01Icon variant="bulk-rounded" size={30} color="currentColor" />
          </span>
          <h2 className="shop-rbot__hero-title">{t("myShop.reportBotTitle")}</h2>
          <p className="shop-rbot__hero-desc">{t("myShop.reportBotDesc")}</p>
          <span className={statusClass}>
            <span className="shop-rbot__status-dot" aria-hidden />
            {loading ? t("common.loading") : t(statusKey)}
          </span>
          {data?.botUsername ? (
            <span className="shop-rbot__handle" dir="ltr">
              @{data.botUsername}
            </span>
          ) : null}
        </section>

        <section
          className="shop-stats__panel shop-rise"
          style={{ "--rise-index": 2 } as CSSProperties}
        >
          <div className="shop-stats__panel-head">
            <h3 className="shop-stats__panel-title">{t("myShop.reportBotFeaturesTitle")}</h3>
            <span className="shop-rbot__only-success">
              <CheckmarkBadge02Icon variant="bulk-rounded" size={14} color="currentColor" />
              {t("myShop.reportBotOnlySuccess")}
            </span>
          </div>
          <div className="shop-rbot__features">
            {features.map(({ Icon, title, desc }) => (
              <div key={title} className="shop-rbot__feature">
                <span className="shop-rbot__feature-icon" aria-hidden>
                  <Icon variant="bulk-rounded" size={18} color="currentColor" />
                </span>
                <span className="shop-rbot__feature-copy">
                  <span className="shop-rbot__feature-title">{t(title)}</span>
                  <span className="shop-rbot__feature-desc">{t(desc)}</span>
                </span>
              </div>
            ))}
          </div>
        </section>

        {!linked ? (
          <section
            className="shop-stats__panel shop-rise"
            style={{ "--rise-index": 3 } as CSSProperties}
          >
            <div className="shop-stats__panel-head">
              <h3 className="shop-stats__panel-title">{t("myShop.reportBotStepsTitle")}</h3>
            </div>
            <ol className="shop-rbot__steps">
              <li>{t("myShop.reportBotStep1")}</li>
              <li>{t("myShop.reportBotStep2")}</li>
              <li>{t("myShop.reportBotStep3")}</li>
            </ol>
          </section>
        ) : null}

        {!available ? (
          <p className="my-shop__hint shop-rise" style={{ "--rise-index": 4 } as CSSProperties}>
            {t("myShop.reportBotUnavailable")}
          </p>
        ) : null}

        <div className="shop-rbot__actions shop-rise" style={{ "--rise-index": 4 } as CSSProperties}>
          {!linked ? (
            <button
              type="button"
              className="my-shop__cta"
              disabled={loading || !available || !data?.startUrl}
              onClick={startLinking}
            >
              {waiting ? t("myShop.reportBotWaiting") : t("myShop.reportBotActivate")}
            </button>
          ) : enabled ? (
            <button
              type="button"
              className="my-shop__cta my-shop__cta--secondary"
              disabled={busy}
              onClick={() => void toggle(false)}
            >
              {busy ? t("common.loading") : t("myShop.reportBotDeactivate")}
            </button>
          ) : (
            <button
              type="button"
              className="my-shop__cta"
              disabled={busy || !available}
              onClick={() => void toggle(true)}
            >
              {busy ? t("common.loading") : t("myShop.reportBotReactivate")}
            </button>
          )}
          {linked && data?.startUrl ? (
            <button
              type="button"
              className="my-shop__cta my-shop__cta--secondary"
              onClick={() => {
                haptic("light");
                openTelegram(data.startUrl!.replace(/\?start=.*$/, ""));
              }}
            >
              {t("myShop.reportBotOpen")}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
