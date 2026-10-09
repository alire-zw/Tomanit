import { type CSSProperties } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { PageHeader } from "../../components/PageHeader";
import { useNotification } from "../../components/Notification";
import TomanBankMethodIcon from "../../components/icons/TomanBankMethodIcon";
import TomanCardMethodIcon from "../../components/icons/TomanCardMethodIcon";
import TomanGatewayMethodIcon from "../../components/icons/TomanGatewayMethodIcon";
import { useI18n } from "../../context/I18nContext";
import { useTelegram } from "../../hooks/useTelegram";
import "../../styles/shop-rise.css";
import "./WalletDeposit.css";
import "./WalletTomanDeposit.css";

type TomanDepositLocationState = {
  from?: "home" | "asset";
};

type TomanMethodId =
  | "account"
  | "card"
  | "gateway"
  | "blu_saman"
  | "paya"
  | "pol";

type TomanMethod = {
  id: TomanMethodId;
  titleKey: string;
  tags: string[];
  limitKey: string;
  noteKey: string;
  icon: "blu" | "account" | "card" | "gateway";
  featured?: boolean;
  disabled?: boolean;
  banks?: Array<{ slug: string; alt: string }>;
};

const METHODS: TomanMethod[] = [
  {
    id: "gateway",
    titleKey: "wallet.tomanMethod.gateway",
    tags: ["wallet.tomanPill.instant", "wallet.tomanPill.noFee"],
    limitKey: "wallet.tomanLimit.10m",
    noteKey: "wallet.tomanNote.allBanks",
    icon: "gateway",
  },
  {
    id: "account",
    titleKey: "wallet.tomanMethod.account",
    tags: ["wallet.tomanPill.instant", "wallet.tomanPill.noFee"],
    limitKey: "wallet.tomanLimit.200m",
    noteKey: "wallet.tomanNote.supportedBanks",
    icon: "account",
    disabled: true,
    banks: [
      { slug: "saman", alt: "SAMAN" },
      { slug: "saderat", alt: "SADERAT" },
      { slug: "keshavarzi", alt: "KESHAVARZI" },
      { slug: "mellat", alt: "MELLAT" },
    ],
  },
  {
    id: "card",
    titleKey: "wallet.tomanMethod.card",
    tags: ["wallet.tomanPill.instant", "wallet.tomanPill.noFee"],
    limitKey: "wallet.tomanLimit.15m",
    noteKey: "wallet.tomanNote.allBanks",
    icon: "card",
    disabled: true,
  },
  {
    id: "blu_saman",
    titleKey: "wallet.tomanMethod.bluSaman",
    tags: ["wallet.tomanPill.instant", "wallet.tomanPill.noFee"],
    limitKey: "wallet.tomanLimit.200m",
    noteKey: "wallet.tomanNote.bluOnly",
    icon: "blu",
    featured: true,
    disabled: true,
  },
  {
    id: "paya",
    titleKey: "wallet.tomanMethod.paya",
    tags: ["wallet.tomanPill.noFee"],
    limitKey: "wallet.tomanLimit.200m",
    noteKey: "wallet.tomanNote.allBanks",
    icon: "account",
    disabled: true,
  },
  {
    id: "pol",
    titleKey: "wallet.tomanMethod.pol",
    tags: [
      "wallet.tomanPill.unstable",
      "wallet.tomanPill.instant",
      "wallet.tomanPill.noFee",
    ],
    limitKey: "wallet.tomanLimit.50m",
    noteKey: "wallet.tomanNote.allBanks",
    icon: "account",
    disabled: true,
  },
];

function MethodChevron({ flip }: { flip?: boolean }) {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      style={flip ? { transform: "scaleX(-1)" } : undefined}
    >
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
        d="m15 18-6-6 6-6"
      />
    </svg>
  );
}

function MethodIcon({ kind }: { kind: TomanMethod["icon"] }) {
  if (kind === "blu") {
    return (
      <img src="/banks/saman.svg" alt="" width={16} height={16} decoding="async" />
    );
  }
  if (kind === "card") {
    return <TomanCardMethodIcon width={16} height={16} color="currentColor" />;
  }
  if (kind === "gateway") {
    return <TomanGatewayMethodIcon width={16} height={16} color="currentColor" />;
  }
  return <TomanBankMethodIcon width={16} height={16} color="currentColor" />;
}

function badgeTone(key: string): string {
  if (key.includes("usersChoice")) return "choice";
  if (key.includes("instant")) return "ok";
  if (key.includes("unstable")) return "warn";
  return "mute";
}

export function WalletTomanDepositPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, isRTL } = useI18n();
  const { haptic } = useTelegram();
  const { notify } = useNotification();
  const from =
    (location.state as TomanDepositLocationState | null)?.from ?? "home";
  const chevron = <MethodChevron flip={!isRTL} />;

  const goBack = () => {
    if (from === "asset") {
      navigate("/wallet/toman", { replace: true });
      return;
    }
    navigate("/", { replace: true });
  };

  const onPick = (method: TomanMethod) => {
    if (method.disabled) return;
    haptic("light");
    if (method.id === "gateway") {
      navigate("/wallet/deposit/gateway", { state: { from } });
      return;
    }
    notify(t("wallet.soon", { label: t(method.titleKey) }), "info");
  };

  return (
    <div className="wallet-deposit">
      <div className="wallet-deposit__header">
        <PageHeader title={t("wallet.depositToman")} onBack={goBack} />
      </div>

      <div className="wallet-deposit__content wallet-toman">
        <h5
          className="wallet-deposit__section-title shop-rise"
          style={{ "--rise-index": 1 } as CSSProperties}
        >
          {t("wallet.selectTomanMethod")}
        </h5>

        <div className="wallet-toman__list" role="list">
          {METHODS.map((method, index) => {
            const badges = [
              ...(method.featured && !method.disabled
                ? ["wallet.tomanPill.usersChoice"]
                : []),
              ...method.tags,
            ];

            return (
              <button
                key={method.id}
                type="button"
                role="listitem"
                className={`wallet-toman__card shop-rise${
                  method.featured && !method.disabled
                    ? " wallet-toman__card--featured"
                    : ""
                }${method.disabled ? " wallet-toman__card--disabled" : ""}`}
                style={{ "--rise-index": index + 2 } as CSSProperties}
                onClick={() => onPick(method)}
                disabled={method.disabled}
                aria-disabled={method.disabled || undefined}
                title={
                  method.id === "pol" ? t("wallet.tomanNote.polWarn") : undefined
                }
              >
                <div className="wallet-toman__main">
                  <span
                    className={`wallet-toman__icon wallet-toman__icon--${method.icon}`}
                    aria-hidden
                  >
                    <MethodIcon kind={method.icon} />
                  </span>

                  <div className="wallet-toman__body">
                    <div className="wallet-toman__title-row">
                      <span className="wallet-toman__title">
                        {t(method.titleKey)}
                      </span>
                      {!method.disabled ? (
                        <span className="wallet-toman__chevron">{chevron}</span>
                      ) : null}
                    </div>

                    <span className="wallet-toman__limit">{t(method.limitKey)}</span>

                    <div className="wallet-toman__badges">
                      {badges.map((key) => (
                        <span
                          key={key}
                          className={`wallet-toman__badge wallet-toman__badge--${badgeTone(key)}`}
                        >
                          {t(key)}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="wallet-toman__divider" />

                {method.banks ? (
                  <div className="wallet-toman__foot">
                    <span className="wallet-toman__note">{t(method.noteKey)}</span>
                    <span className="wallet-toman__banks" aria-hidden>
                      {method.banks.map((bank) => (
                        <span key={bank.slug} className="wallet-toman__bank">
                          <img
                            src={`/banks/${bank.slug}.svg`}
                            alt=""
                            width={12}
                            height={12}
                            decoding="async"
                          />
                        </span>
                      ))}
                    </span>
                  </div>
                ) : (
                  <p className="wallet-toman__note">{t(method.noteKey)}</p>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
