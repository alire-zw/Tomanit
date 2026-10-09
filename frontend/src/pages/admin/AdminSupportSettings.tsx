import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../../components/PageHeader";
import { useNotification } from "../../components/Notification";
import { useI18n } from "../../context/I18nContext";
import { useTelegram } from "../../hooks/useTelegram";
import { useTelegramBackButton } from "../../hooks/useTelegramBackButton";
import { apiFetch } from "../../lib/api";
import "../../styles/shop-rise.css";
import "./AdminSupportSettings.css";

function normalizeUsername(value: string) {
  return value
    .replace(/^@+/, "")
    .replace(/^https?:\/\/(t\.me|telegram\.me)\//i, "")
    .replace(/\/.*$/, "");
}

type SupportSettings = {
  supportTelegramUsername?: string | null;
  supportContactEnabled?: boolean;
};

export function AdminSupportSettingsPage() {
  const navigate = useNavigate();
  const { haptic } = useTelegram();
  const { notify } = useNotification();
  const { t } = useI18n();
  const [username, setUsername] = useState("");
  const [savedUsername, setSavedUsername] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);

  const handleBack = useCallback(() => {
    navigate("/admin", { replace: true });
  }, [navigate]);

  useTelegramBackButton(handleBack);

  const applySettings = (data: SupportSettings) => {
    const raw = String(data.supportTelegramUsername ?? "").replace(/^@/, "");
    setUsername(raw);
    setSavedUsername(raw || null);
    setEnabled(data.supportContactEnabled !== false && Boolean(raw));
  };

  useEffect(() => {
    let cancelled = false;
    void apiFetch<{ settings: SupportSettings }>("/admin/settings")
      .then((d) => {
        if (cancelled) return;
        applySettings(d.settings ?? {});
      })
      .catch((err) => {
        if (!cancelled) {
          notify(err instanceof Error ? err.message : t("common.error"), "error");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [notify, t]);

  const handleToggle = async () => {
    if (toggling || saving) return;
    if (!enabled && !savedUsername && !username.trim()) {
      haptic("light");
      notify(t("admin.supportNeedUsername"), "error");
      return;
    }
    haptic("light");
    setToggling(true);
    try {
      const nextEnabled = !enabled;
      const res = await apiFetch<{ settings: SupportSettings }>("/admin/settings", {
        method: "PUT",
        body: { supportContactEnabled: nextEnabled },
      });
      applySettings(res.settings);
      notify(
        nextEnabled ? t("admin.supportEnabledNotify") : t("admin.supportDisabledNotify"),
      );
    } catch (err) {
      notify(err instanceof Error ? err.message : t("common.error"), "error");
    } finally {
      setToggling(false);
    }
  };

  const handleSave = async () => {
    if (saving || toggling) return;
    const cleaned = normalizeUsername(username.trim());
    if (cleaned.length < 3) {
      notify(t("admin.supportUsernameInvalid"), "error");
      return;
    }
    haptic("light");
    setSaving(true);
    try {
      const res = await apiFetch<{ settings: SupportSettings }>("/admin/settings", {
        method: "PUT",
        body: {
          supportTelegramUsername: cleaned,
          supportContactEnabled: true,
        },
      });
      applySettings(res.settings);
      notify(t("admin.supportSavedId", { username: cleaned }));
    } catch (err) {
      notify(err instanceof Error ? err.message : t("common.error"), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-support">
      <div className="shop-rise" style={{ "--rise-index": 0 } as CSSProperties}>
        <PageHeader title={t("admin.supportSettings")} onBack={handleBack} />
      </div>

      <div className="admin-support__content">
        <h2
          className="admin-support__section-title shop-rise"
          style={{ "--rise-index": 1 } as CSSProperties}
        >
          {t("admin.supportDirectSection")}
        </h2>

        {loading ? (
          <div
            className="admin-support__card admin-support__card--skeleton shop-rise"
            style={{ "--rise-index": 2 } as CSSProperties}
            aria-hidden="true"
          >
            <div className="admin-support__row">
              <div className="admin-support__copy">
                <span className="admin-support__skel admin-support__skel--title" />
                <span className="admin-support__skel admin-support__skel--hint" />
              </div>
              <span className="admin-support__skel admin-support__skel--switch" />
            </div>
            <div className="admin-support__field">
              <span className="admin-support__skel admin-support__skel--label" />
              <span className="admin-support__skel admin-support__skel--input" />
            </div>
            <span className="admin-support__skel admin-support__skel--btn" />
          </div>
        ) : (
          <div
            className="admin-support__card shop-rise"
            style={{ "--rise-index": 2 } as CSSProperties}
          >
            <div className="admin-support__row">
              <div className="admin-support__copy">
                <span className="admin-support__label">{t("admin.supportDirectLabel")}</span>
                <span className="admin-support__hint">
                  {enabled && savedUsername
                    ? `@${savedUsername}`
                    : t("admin.supportHiddenHint")}
                </span>
              </div>
              <button
                type="button"
                className={`admin-support__switch${enabled ? " is-on" : ""}`}
                onClick={() => void handleToggle()}
                disabled={toggling}
                aria-pressed={enabled}
                aria-label={enabled ? t("admin.supportDisable") : t("admin.supportEnable")}
              >
                <span className="admin-support__switch-thumb" />
              </button>
            </div>

            <div className="admin-support__field">
              <label
                className="admin-support__field-label"
                htmlFor="support-telegram-username"
              >
                {t("admin.supportUsernameLabel")}
              </label>
              <div className="admin-support__input-wrap">
                <span className="admin-support__at">@</span>
                <input
                  id="support-telegram-username"
                  className="admin-support__input"
                  value={username}
                  onChange={(event) =>
                    setUsername(normalizeUsername(event.target.value))
                  }
                  placeholder="tomanit_support"
                  dir="ltr"
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
            </div>

            <button
              type="button"
              className="admin-support__save"
              onClick={() => void handleSave()}
              disabled={saving}
            >
              {saving ? t("common.loading") : t("admin.supportSaveId")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
