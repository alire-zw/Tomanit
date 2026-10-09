import { useNavigate } from "react-router-dom";
import { BottomSheet } from "../../components/BottomSheet";
import { useI18n } from "../../context/I18nContext";
import { useTelegram } from "../../hooks/useTelegram";
import type { WalletWithdrawLimitsResponse } from "../../lib/api";
import { formatLatinCryptoQty } from "../../lib/format";
import "./WithdrawLimitsDrawer.css";

type Props = {
  open: boolean;
  onClose: () => void;
  limits: WalletWithdrawLimitsResponse | null;
  loading?: boolean;
};

function LtrAmount({
  value,
  unit,
  digits = 2,
  unitClass,
}: {
  value: number;
  unit: string;
  digits?: number;
  unitClass?: string;
}) {
  return (
    <span dir="ltr">
      {formatLatinCryptoQty(value, digits)}
      <span className={unitClass}> {unit}</span>
    </span>
  );
}

/** Fill by used amount; tone by how much of the limit is consumed. */
function progressTone(used: number, total: number): "ok" | "warn" | "danger" {
  if (!(total > 0)) return "ok";
  const pct = (used / total) * 100;
  if (pct >= 100) return "danger";
  if (pct >= 80) return "warn";
  return "ok";
}

function LimitSection({
  label,
  remaining,
  used,
  total,
  unit,
  digits = 2,
}: {
  label: string;
  remaining: number;
  used: number;
  total: number;
  unit: string;
  digits?: number;
}) {
  const pct =
    total > 0 ? Math.max(0, Math.min(100, (used / total) * 100)) : 0;
  const tone = progressTone(used, total);
  return (
    <div className="withdraw-limits__section">
      <div className="withdraw-limits__section-head">
        <span className="withdraw-limits__section-label">{label}</span>
        <span className="withdraw-limits__remaining">
          <LtrAmount
            value={remaining}
            unit={unit}
            digits={digits}
            unitClass="withdraw-limits__remaining-unit"
          />
        </span>
      </div>
      <div className="withdraw-limits__progress-row">
        <div
          className="withdraw-limits__track"
          role="progressbar"
          aria-valuenow={Math.round(pct)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className={`withdraw-limits__fill${
              tone === "danger"
                ? " withdraw-limits__fill--danger"
                : tone === "warn"
                  ? " withdraw-limits__fill--warn"
                  : ""
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="withdraw-limits__total">
          <LtrAmount
            value={total}
            unit={unit}
            digits={digits}
            unitClass="withdraw-limits__total-unit"
          />
        </span>
      </div>
    </div>
  );
}

export function WithdrawLimitsDrawer({
  open,
  onClose,
  limits,
  loading,
}: Props) {
  const { t } = useI18n();
  const { haptic } = useTelegram();
  const navigate = useNavigate();

  const kycButton =
    limits?.needsKycUpgrade
      ? [
          {
            label: t("wallet.withdrawLimitsKycCta"),
            variant: "primary" as const,
            onClick: () => {
              haptic("light");
              onClose();
              navigate("/profile/verify");
            },
          },
        ]
      : undefined;

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t("wallet.withdrawLimitsTitle")}
      className="withdraw-limits-sheet"
      buttons={kycButton}
    >
      {!limits && loading ? (
        <p className="withdraw-limits__loading">{t("common.loading")}</p>
      ) : null}

      {limits ? (
        <div className="withdraw-limits">
          <div className="withdraw-limits__balance">
            <p className="withdraw-limits__balance-label">
              {t("wallet.withdrawLimitsBalance")}
            </p>
            <div className="withdraw-limits__amount-line" dir="ltr">
              <span className="withdraw-limits__amount">
                {formatLatinCryptoQty(limits.withdrawable, 6)}
                <span className="withdraw-limits__amount-unit">
                  {" "}
                  {limits.symbol}
                </span>
              </span>
              <span className="withdraw-limits__equiv">
                ≈ {formatLatinCryptoQty(Math.round(limits.withdrawableToman), 0)}
                <span className="withdraw-limits__equiv-unit"> IRT</span>
              </span>
            </div>
          </div>

          <div className="withdraw-limits__card">
            <LimitSection
              label={t("wallet.withdrawLimitsInstant")}
              remaining={limits.lock.instantCreditRemainingToman}
              used={limits.lock.instantCreditUsedToman}
              total={limits.lock.instantCreditTotalToman}
              unit="IRT"
              digits={0}
            />
            <LimitSection
              label={t("wallet.withdrawLimitsDaily")}
              remaining={limits.daily.remainingUsdt}
              used={limits.daily.usedUsdt}
              total={limits.daily.limitUsdt}
              unit="USDT"
              digits={2}
            />
            <LimitSection
              label={t("wallet.withdrawLimitsMonthly")}
              remaining={limits.monthly.remainingUsdt}
              used={limits.monthly.usedUsdt}
              total={limits.monthly.limitUsdt}
              unit="USDT"
              digits={2}
            />
          </div>

          <div className="withdraw-limits__note">
            <p className="withdraw-limits__note-title">
              {t("wallet.withdrawLimitsNoteTitle")}
            </p>
            <p className="withdraw-limits__note-text">
              {t("wallet.withdrawLimitsNoteText")}
            </p>
          </div>
        </div>
      ) : null}
    </BottomSheet>
  );
}
