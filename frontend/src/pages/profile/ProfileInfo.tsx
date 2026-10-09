import { useEffect, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { BottomSheet } from "../../components/BottomSheet";
import { PageHeader } from "../../components/PageHeader";
import { useNotification } from "../../components/Notification";
import IdIcon from "../../components/icons/IdIcon";
import MailIcon from "../../components/icons/MailIcon";
import TelephoneIcon from "../../components/icons/TelephoneIcon";
import { useI18n } from "../../context/I18nContext";
import { useAuth } from "../../hooks/useAuth";
import { useTelegram } from "../../hooks/useTelegram";
import { apiFetch, type MeResponse } from "../../lib/api";
import "../../styles/shop-rise.css";
import "./ProfileInfo.css";

type EditField = "fullName" | "email" | "phone" | null;

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function ProfileInfoPage() {
  const navigate = useNavigate();
  const { user, loading, error, refresh, applyUser } = useAuth();
  const { notify } = useNotification();
  const { haptic } = useTelegram();
  const { t, isRTL } = useI18n();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [editField, setEditField] = useState<EditField>(null);
  const [tempValue, setTempValue] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    setFullName(user.fullName ?? user.firstName ?? "");
    setEmail(user.email ?? "");
    setPhone(user.phone ?? "");
  }, [user]);

  const canEdit = Boolean(user) && !loading;

  const openEdit = (field: Exclude<EditField, null>, current: string) => {
    haptic("light");
    setTempValue(current);
    setEditField(field);
  };

  const closeEdit = () => {
    if (saving) return;
    setEditField(null);
    setTempValue("");
  };

  const saveField = async () => {
    if (!editField) return;

    const value = tempValue.trim();

    if (editField === "fullName") {
      if (!value) {
        notify(t("info.fullNameRequired"), "error");
        return;
      }
    }

    if (editField === "email") {
      if (!value) {
        notify(t("info.emailRequired"), "error");
        return;
      }
      if (!isValidEmail(value)) {
        notify(t("info.emailInvalid"), "error");
        return;
      }
    }

    if (editField === "phone") {
      if (!value) {
        notify(t("info.phoneRequired"), "error");
        return;
      }
      if (value.length < 5) {
        notify(t("info.phoneInvalid"), "error");
        return;
      }
    }

    setSaving(true);
    try {
      const data = await apiFetch<MeResponse>("/me", {
        method: "PATCH",
        body: { [editField]: value },
      });
      if (data.user) {
        applyUser(data.user, data.wallet ?? undefined);
      }
      await refresh({ silent: true });

      if (editField === "fullName") {
        setFullName(value);
        notify(t("info.fullNameUpdated"));
      } else if (editField === "email") {
        setEmail(value);
        notify(t("info.emailUpdated"));
      } else {
        setPhone(value);
        notify(t("info.phoneUpdated"));
      }

      haptic("light");
      setEditField(null);
      setTempValue("");
    } catch (err) {
      notify(err instanceof Error ? err.message : t("info.updateError"), "error");
    } finally {
      setSaving(false);
    }
  };

  const nameDir = isRTL ? ("rtl" as const) : ("ltr" as const);

  const sheetMeta =
    editField === "fullName"
      ? {
          title: fullName ? t("info.editFullName") : t("info.addFullName"),
          description: t("info.enterFullName"),
          placeholder: t("info.fullName"),
          icon: <IdIcon width={16} height={16} />,
          inputType: "text" as const,
          dir: nameDir,
          maxLength: 80,
          canSave: Boolean(tempValue.trim()),
        }
      : editField === "email"
        ? {
            title: email ? t("info.editEmail") : t("info.addEmail"),
            description: t("info.enterEmail"),
            placeholder: "example@email.com",
            icon: <MailIcon width={16} height={16} />,
            inputType: "email" as const,
            dir: "ltr" as const,
            maxLength: 120,
            canSave: Boolean(tempValue.trim()) && isValidEmail(tempValue),
          }
        : editField === "phone"
          ? {
              title: phone ? t("info.editPhone") : t("info.addPhone"),
              description: t("info.enterPhone"),
              placeholder: "09123456789",
              icon: <TelephoneIcon width={16} height={16} />,
              inputType: "tel" as const,
              dir: "ltr" as const,
              maxLength: 20,
              canSave: tempValue.trim().length >= 5,
            }
          : null;

  return (
    <div className="profile-info">
      <div className="shop-rise" style={{ "--rise-index": 0 } as CSSProperties}>
        <PageHeader title={t("info.accountTitle")} onBack={() => navigate(-1)} />
      </div>

      <div className="profile-info__content">
        <h3 className="profile-info__section-title shop-rise" style={{ "--rise-index": 1 } as CSSProperties}>
          {t("info.title")}
        </h3>

        {error && !user ? (
          <p
            className="profile-info__status profile-info__status--error shop-rise"
            style={{ "--rise-index": 2 } as CSSProperties}
          >
            {error}
          </p>
        ) : null}

        <div className="profile-info__items shop-rise" style={{ "--rise-index": 2 } as CSSProperties}>
          <div className="profile-info__item">
            <div className="profile-info__item-start">
              <span className="profile-info__icon">
                <IdIcon width={18} height={18} />
              </span>
              <div>
                <div className="profile-info__label">{t("info.fullName")}</div>
                <div className="profile-info__value">{loading && !user ? "..." : fullName || "--"}</div>
              </div>
            </div>
            <button
              type="button"
              className="profile-info__edit-btn"
              disabled={!canEdit}
              onClick={() => openEdit("fullName", fullName)}
            >
              {fullName ? t("common.edit") : t("info.add")}
            </button>
          </div>

          <div className="profile-info__divider" />

          <div className="profile-info__item">
            <div className="profile-info__item-start">
              <span className="profile-info__icon">
                <MailIcon width={18} height={18} />
              </span>
              <div>
                <div className="profile-info__label">{t("info.email")}</div>
                <div className="profile-info__value">{loading && !user ? "..." : email || "--"}</div>
              </div>
            </div>
            <button
              type="button"
              className="profile-info__edit-btn"
              disabled={!canEdit}
              onClick={() => openEdit("email", email)}
            >
              {email ? t("common.edit") : t("info.add")}
            </button>
          </div>

          <div className="profile-info__divider" />

          <div className="profile-info__item">
            <div className="profile-info__item-start">
              <span className="profile-info__icon">
                <TelephoneIcon width={18} height={18} />
              </span>
              <div>
                <div className="profile-info__label">{t("info.phone")}</div>
                <div className="profile-info__value" dir="ltr">
                  {loading && !user ? "..." : phone || "--"}
                </div>
              </div>
            </div>
            <button
              type="button"
              className="profile-info__edit-btn"
              disabled={!canEdit}
              onClick={() => openEdit("phone", phone)}
            >
              {phone ? t("common.edit") : t("info.add")}
            </button>
          </div>
        </div>
      </div>

      <BottomSheet
        open={Boolean(editField && sheetMeta)}
        onClose={closeEdit}
        title={sheetMeta?.title ?? ""}
        description={sheetMeta?.description}
        buttons={[
          { label: t("common.cancel"), onClick: closeEdit, disabled: saving },
          {
            label: saving ? t("info.saving") : t("common.save"),
            onClick: () => void saveField(),
            variant: "primary",
            disabled: saving || !sheetMeta?.canSave,
          },
        ]}
      >
        {sheetMeta ? (
          <div className="profile-info__modal-field">
            <input
              type={sheetMeta.inputType}
              value={tempValue}
              onChange={(event) => setTempValue(event.target.value)}
              className="profile-info__input"
              placeholder={sheetMeta.placeholder}
              dir={sheetMeta.dir}
              maxLength={sheetMeta.maxLength}
              disabled={saving}
              autoFocus
            />
            <span className="profile-info__input-icon">{sheetMeta.icon}</span>
          </div>
        ) : null}
      </BottomSheet>
    </div>
  );
}
