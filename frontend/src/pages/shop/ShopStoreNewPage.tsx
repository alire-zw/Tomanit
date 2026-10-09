import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ComponentType,
} from "react";
import { useNavigate } from "react-router-dom";
import { NumeralKeypad } from "../../components/NumeralKeypad";
import { PageHeader } from "../../components/PageHeader";
import { PersianKeypad, filterPersianInput } from "../../components/PersianKeypad";
import { useNotification } from "../../components/Notification";
import ClipboardPasteIcon from "../../components/icons/hugeicons/ClipboardPasteIcon";
import HoldPhoneIcon from "../../components/icons/hugeicons/HoldPhoneIcon";
import ImageUploadIcon from "../../components/icons/hugeicons/ImageUploadIcon";
import Package02Icon from "../../components/icons/hugeicons/Package02Icon";
import RoboticIcon from "../../components/icons/hugeicons/RoboticIcon";
import TeamWorkIcon from "../../components/icons/hugeicons/TeamWorkIcon";
import WebDesign01Icon from "../../components/icons/hugeicons/WebDesign01Icon";
import { useI18n } from "../../context/I18nContext";
import { useTelegram } from "../../hooks/useTelegram";
import { useRelockScrollWhileOpen } from "../../hooks/useRelockScrollWhileOpen";
import { ApiError } from "../../lib/api";
import { formatFaDecimal, formatFaNumber } from "../../lib/format";
import { registerShop } from "../../lib/shop";
import { lockAppScroll, unlockAppScroll } from "../../lib/scrollLock";
import "../../styles/shop-rise.css";
import "./ShopStoreRegister.css";

type SellType = "goods" | "services";
type Channel = "website" | "bot" | "manual";
type VolumeField = "amount" | "count";

type Step = "name" | "sellType" | "volume" | "channel" | "urls" | "logo";

type Choice = {
  id: string;
  titleKey: string;
  hintKey: string;
  Icon: ComponentType<{ size?: number; width?: number; height?: number }>;
};

const SELL_CHOICES: Choice[] = [
  {
    id: "goods",
    titleKey: "myShop.regSellGoods",
    hintKey: "myShop.regSellGoodsHint",
    Icon: Package02Icon,
  },
  {
    id: "services",
    titleKey: "myShop.regSellServices",
    hintKey: "myShop.regSellServicesHint",
    Icon: TeamWorkIcon,
  },
];

const CHANNEL_CHOICES: Choice[] = [
  {
    id: "website",
    titleKey: "myShop.regChannelWebsite",
    hintKey: "myShop.regChannelWebsiteHint",
    Icon: WebDesign01Icon,
  },
  {
    id: "bot",
    titleKey: "myShop.regChannelBot",
    hintKey: "myShop.regChannelBotHint",
    Icon: RoboticIcon,
  },
  {
    id: "manual",
    titleKey: "myShop.regChannelManual",
    hintKey: "myShop.regChannelManualHint",
    Icon: HoldPhoneIcon,
  },
];

const LOGO_MAX_BYTES = 5 * 1024 * 1024;

function stepsFor(channel: Channel | null): Step[] {
  const base: Step[] = ["name", "sellType", "volume", "channel"];
  if (channel === "website" || channel === "bot") base.push("urls");
  base.push("logo");
  return base;
}

function formatLogoSize(
  bytes: number,
  tr: (key: string, params?: Record<string, string | number>) => string,
): string {
  if (bytes < 1024) return tr("myShop.regLogoUnitB", { n: formatFaNumber(bytes) });
  if (bytes < 1024 * 1024) {
    return tr("myShop.regLogoUnitKb", { n: formatFaDecimal(bytes / 1024, 1) });
  }
  return tr("myShop.regLogoUnitMb", { n: formatFaDecimal(bytes / (1024 * 1024), 1) });
}

export function ShopStoreNewPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { haptic } = useTelegram();
  const { notify } = useNotification();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("name");
  const [name, setName] = useState("");
  const [sellType, setSellType] = useState<SellType | null>(null);
  const [amountDigits, setAmountDigits] = useState("");
  const [countDigits, setCountDigits] = useState("");
  const [volumeField, setVolumeField] = useState<VolumeField>("amount");
  const [channel, setChannel] = useState<Channel | null>(null);
  const [siteUrl, setSiteUrl] = useState("");
  const [botUrl, setBotUrl] = useState("");
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [logoFileSize, setLogoFileSize] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const flow = useMemo(() => stepsFor(channel), [channel]);
  const stepIndex = Math.max(0, flow.indexOf(step));
  const stepTotal = flow.length;
  const stepCurrent = stepIndex + 1;

  useEffect(() => {
    lockAppScroll();
    return () => unlockAppScroll();
  }, []);
  useRelockScrollWhileOpen(true);

  const goBack = useCallback(() => {
    haptic("light");
    if (step === "volume" && volumeField === "count") {
      setVolumeField("amount");
      return;
    }
    const idx = flow.indexOf(step);
    if (idx <= 0) {
      navigate("/shop");
      return;
    }
    setStep(flow[idx - 1]!);
  }, [flow, haptic, navigate, step, volumeField]);

  const canContinue = useMemo(() => {
    if (step === "name") return name.trim().length >= 2;
    if (step === "sellType") return sellType != null;
    if (step === "volume") {
      if (volumeField === "amount") return amountDigits.length > 0;
      return amountDigits.length > 0 && countDigits.length > 0;
    }
    if (step === "channel") return channel != null;
    if (step === "urls") {
      if (channel === "website") return siteUrl.trim().length > 3;
      if (channel === "bot") return botUrl.trim().length > 2;
      return true;
    }
    return true;
  }, [
    amountDigits,
    botUrl,
    channel,
    countDigits,
    name,
    sellType,
    siteUrl,
    step,
    volumeField,
  ]);

  const continueLabel =
    step === "logo"
      ? submitting
        ? t("common.loading")
        : t("myShop.regSubmit")
      : t("common.continue");

  const submitRegistration = async (logo: string | null) => {
    if (submitting || !sellType || !channel) return;
    setSubmitting(true);
    try {
      await registerShop({
        name: name.trim(),
        sellType,
        dailyAmountToman: Number(amountDigits) || 0,
        dailyCount: Number(countDigits) || 0,
        channel,
        siteUrl: siteUrl.trim() || null,
        botUrl: botUrl.trim() || null,
        logoDataUrl: logo,
      });
      notify(t("myShop.regSubmitted"), "success");
      navigate("/shop", { replace: true });
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : t("common.error");
      notify(message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const goNext = () => {
    if (submitting) return;
    if (!canContinue && step !== "logo") return;
    haptic("light");

    // Volume step: after amount → focus daily count (like identity wizard)
    if (step === "volume" && volumeField === "amount") {
      if (amountDigits.length === 0) return;
      setVolumeField("count");
      return;
    }

    if (step === "logo") {
      void submitRegistration(logoDataUrl);
      return;
    }

    const idx = flow.indexOf(step);
    const next = flow[idx + 1];
    if (next) setStep(next);
  };

  const clearLogo = () => {
    setLogoDataUrl(null);
    setLogoFileSize(0);
    if (fileRef.current) fileRef.current.value = "";
  };

  const skipLogo = () => {
    if (submitting) return;
    haptic("light");
    clearLogo();
    void submitRegistration(null);
  };

  const appendName = (ch: string) => {
    setName((cur) => filterPersianInput(cur + ch).slice(0, 48));
  };
  const backspaceName = () => setName((cur) => cur.slice(0, -1));

  const appendDigit = (d: string) => {
    if (volumeField === "amount") {
      setAmountDigits((cur) => {
        if (cur.length >= 12) return cur;
        if (cur === "0") return d;
        return cur + d;
      });
      return;
    }
    setCountDigits((cur) => {
      if (cur.length >= 6) return cur;
      if (cur === "0") return d;
      return cur + d;
    });
  };

  const backspaceDigit = () => {
    if (volumeField === "amount") {
      setAmountDigits((cur) => cur.slice(0, -1));
      return;
    }
    setCountDigits((cur) => cur.slice(0, -1));
  };

  const onLogoFile = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      notify(t("myShop.regLogoBadType"), "error");
      return;
    }
    if (file.size > LOGO_MAX_BYTES) {
      notify(t("myShop.regLogoTooBig"), "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : null;
      setLogoDataUrl(result);
      setLogoFileSize(file.size);
    };
    reader.readAsDataURL(file);
  };

  const notice =
    step === "name"
      ? t("myShop.regNameNotice")
      : step === "sellType"
        ? t("myShop.regSellNotice")
        : step === "volume"
          ? t("myShop.regVolumeNotice")
          : step === "channel"
            ? t("myShop.regChannelNotice")
            : step === "urls"
              ? t("myShop.regUrlsNotice")
              : t("myShop.regLogoNotice");

  const amountDisplay =
    amountDigits.length > 0 ? formatFaNumber(Number(amountDigits)) : t("myShop.regAmountPh");
  const countDisplay =
    countDigits.length > 0 ? formatFaNumber(Number(countDigits)) : t("myShop.regCountPh");

  const riseKey = step === "volume" ? `volume-${volumeField}` : step;

  return (
    <div className="shop-reg">
      <div className="shop-rise" style={{ "--rise-index": 0 } as CSSProperties}>
        <PageHeader
          title={t("myShop.createStore")}
          onBack={goBack}
          action={
            <span className="page-header__step">
              {t("verify.stepOf", { current: stepCurrent, total: stepTotal })}
            </span>
          }
        />
      </div>

      <div className="shop-reg__body">
        <section
          key={`notice-${riseKey}`}
          className="shop-reg__notice shop-rise"
          style={{ "--rise-index": 1 } as CSSProperties}
        >
          <p className="shop-reg__notice-text">{notice}</p>
        </section>

        <section
          key={`stack-${riseKey}`}
          className="shop-reg__stack shop-rise"
          style={{ "--rise-index": 2 } as CSSProperties}
        >
          {step === "name" ? (
            <div className="shop-reg__block shop-reg__block--active">
              <p className="shop-reg__label">{t("myShop.regNameLabel")}</p>
              <span
                className={`shop-reg__value${name ? "" : " shop-reg__value--placeholder"}`}
              >
                {name || t("myShop.regNamePh")}
              </span>
            </div>
          ) : null}

          {step === "sellType" ? (
            <div
              className="shop-reg__tiles"
              role="listbox"
              aria-label={t("myShop.regSellNotice")}
            >
              {SELL_CHOICES.map((item) => {
                const Icon = item.Icon;
                const on = sellType === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="option"
                    aria-selected={on}
                    className={`shop-reg__tile${on ? " shop-reg__tile--on" : ""}`}
                    onClick={() => {
                      haptic("light");
                      setSellType(item.id as SellType);
                    }}
                  >
                    <span className="shop-reg__tile-icon" aria-hidden>
                      <Icon size={32} />
                    </span>
                    <span className="shop-reg__tile-copy">
                      <span className="shop-reg__tile-title">{t(item.titleKey)}</span>
                      <span className="shop-reg__tile-hint">{t(item.hintKey)}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}

          {step === "volume" ? (
            <>
              <button
                type="button"
                className={`shop-reg__block${
                  volumeField === "amount"
                    ? " shop-reg__block--active"
                    : " shop-reg__block--compact"
                }`}
                onClick={() => {
                  haptic("light");
                  setVolumeField("amount");
                }}
              >
                <p className="shop-reg__label">{t("myShop.regDailyAmount")}</p>
                <span
                  className={`shop-reg__value shop-reg__value--ltr${
                    amountDigits ? "" : " shop-reg__value--placeholder"
                  }`}
                >
                  {amountDigits ? `${amountDisplay} ${t("wallet.toman")}` : amountDisplay}
                </span>
              </button>
              <button
                type="button"
                className={`shop-reg__block${
                  volumeField === "count"
                    ? " shop-reg__block--active"
                    : " shop-reg__block--compact"
                }`}
                onClick={() => {
                  haptic("light");
                  setVolumeField("count");
                }}
              >
                <p className="shop-reg__label">{t("myShop.regDailyCount")}</p>
                <span
                  className={`shop-reg__value shop-reg__value--ltr${
                    countDigits ? "" : " shop-reg__value--placeholder"
                  }`}
                >
                  {countDisplay}
                </span>
              </button>
            </>
          ) : null}

          {step === "channel" ? (
            <div
              className="shop-reg__tiles shop-reg__tiles--channel"
              role="listbox"
              aria-label={t("myShop.regChannelNotice")}
            >
              {CHANNEL_CHOICES.map((item) => {
                const Icon = item.Icon;
                const on = channel === item.id;
                const wide = item.id === "manual";
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="option"
                    aria-selected={on}
                    className={`shop-reg__tile${wide ? " shop-reg__tile--wide" : ""}${
                      on ? " shop-reg__tile--on" : ""
                    }`}
                    onClick={() => {
                      haptic("light");
                      setChannel(item.id as Channel);
                    }}
                  >
                    <span className="shop-reg__tile-icon" aria-hidden>
                      <Icon size={wide ? 28 : 32} />
                    </span>
                    <span className="shop-reg__tile-copy">
                      <span className="shop-reg__tile-title">{t(item.titleKey)}</span>
                      <span className="shop-reg__tile-hint">{t(item.hintKey)}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}

          {step === "urls" ? (
            <>
              {channel === "website" || channel === "bot" ? (
                <div className="shop-reg__field">
                  <p className="shop-reg__field-label">
                    {channel === "website"
                      ? t("myShop.regWebsiteUrl")
                      : t("myShop.regBotUrl")}
                  </p>
                  <div className="shop-reg__input-wrap">
                    <input
                      className="shop-reg__input"
                      dir="ltr"
                      inputMode="url"
                      autoCapitalize="off"
                      autoCorrect="off"
                      spellCheck={false}
                      value={channel === "website" ? siteUrl : botUrl}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (channel === "website") setSiteUrl(v);
                        else setBotUrl(v);
                      }}
                      placeholder={
                        channel === "website"
                          ? "https://example.com"
                          : "https://t.me/YourBot"
                      }
                    />
                    <button
                      type="button"
                      className="shop-reg__paste"
                      aria-label={t("common.paste")}
                      onClick={async () => {
                        haptic("light");
                        try {
                          const text = (await navigator.clipboard.readText()).trim();
                          if (!text) return;
                          if (channel === "website") setSiteUrl(text);
                          else setBotUrl(text);
                        } catch {
                          notify(t("common.pasteFailed"), "error");
                        }
                      }}
                    >
                      <ClipboardPasteIcon size={20} />
                    </button>
                  </div>
                </div>
              ) : null}
            </>
          ) : null}

          {step === "logo" ? (
            <div className="shop-reg__upload">
              <input
                ref={fileRef}
                className="shop-reg__file"
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  e.target.value = "";
                  onLogoFile(file);
                }}
              />
              {!logoDataUrl ? (
                <button
                  type="button"
                  className="shop-reg__upload-btn"
                  onClick={() => {
                    haptic("light");
                    fileRef.current?.click();
                  }}
                >
                  <span className="shop-reg__upload-btn-icon" aria-hidden>
                    <ImageUploadIcon size={28} />
                  </span>
                  <span className="shop-reg__upload-btn-title">{t("myShop.regLogoPick")}</span>
                  <span className="shop-reg__upload-btn-hint">{t("myShop.regLogoHint")}</span>
                </button>
              ) : (
                <div className="shop-reg__receipt shop-reg__receipt--done">
                  <div className="shop-reg__receipt-main">
                    <div className="shop-reg__receipt-thumb-wrap">
                      <img className="shop-reg__receipt-thumb" src={logoDataUrl} alt="" />
                      <span className="shop-reg__receipt-check" aria-hidden>
                        ✓
                      </span>
                    </div>
                    <div className="shop-reg__receipt-meta">
                      <div className="shop-reg__receipt-title-row">
                        <span className="shop-reg__receipt-name">{t("myShop.regLogoName")}</span>
                        <span className="shop-reg__receipt-badge shop-reg__receipt-badge--done">
                          {t("myShop.regLogoUploaded")}
                        </span>
                      </div>
                      <span className="shop-reg__receipt-size">
                        {t("myShop.regLogoSize", {
                          size: formatLogoSize(logoFileSize, t),
                        })}
                      </span>
                    </div>
                  </div>
                  <div className="shop-reg__receipt-footer">
                    <span className="shop-reg__receipt-footer-hint">{t("myShop.regLogoReady")}</span>
                    <button
                      type="button"
                      className="shop-reg__receipt-remove"
                      onClick={() => {
                        haptic("light");
                        clearLogo();
                      }}
                    >
                      {t("myShop.regLogoRemove")}
                    </button>
                    <button
                      type="button"
                      className="shop-reg__receipt-change"
                      onClick={() => {
                        haptic("light");
                        fileRef.current?.click();
                      }}
                    >
                      {t("myShop.regLogoChange")}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </section>

        {step === "name" ? (
          <div
            key={`keypad-${riseKey}`}
            className="shop-reg__keypad shop-rise"
            style={{ "--rise-index": 3 } as CSSProperties}
          >
            <PersianKeypad
              onChar={appendName}
              onBackspace={backspaceName}
              backspaceDisabled={name.length === 0}
            />
          </div>
        ) : null}

        {step === "volume" ? (
          <div
            key={`keypad-${riseKey}`}
            className="shop-reg__keypad shop-rise"
            style={{ "--rise-index": 3 } as CSSProperties}
          >
            <NumeralKeypad
              onDigit={appendDigit}
              onBackspace={backspaceDigit}
              backspaceDisabled={
                volumeField === "amount" ? amountDigits.length === 0 : countDigits.length === 0
              }
            />
          </div>
        ) : null}
      </div>

      <div
        className={`shop-reg__footer${step === "logo" ? " shop-reg__footer--split" : ""} shop-rise`}
        style={{ "--rise-index": 4 } as CSSProperties}
      >
        <button
          type="button"
          className="shop-reg__continue"
          disabled={step === "logo" ? submitting : !canContinue || submitting}
          onClick={goNext}
        >
          {continueLabel}
        </button>
        {step === "logo" ? (
          <button
            type="button"
            className="shop-reg__skip"
            disabled={submitting}
            onClick={skipLogo}
          >
            {t("myShop.regLogoSkip")}
          </button>
        ) : null}
      </div>
    </div>
  );
}
