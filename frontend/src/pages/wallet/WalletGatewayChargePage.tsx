import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { NumeralKeypad } from "../../components/NumeralKeypad";
import { PageHeader } from "../../components/PageHeader";
import { useNotification } from "../../components/Notification";
import { useI18n } from "../../context/I18nContext";
import { useAuth } from "../../hooks/useAuth";
import { useTelegram } from "../../hooks/useTelegram";
import { apiFetch } from "../../lib/api";
import {
  appendAmountDigit,
  formatAmountFa,
  getGatewayAmountError,
  isGatewayAmountValid,
  parseAmountDigits,
  removeLastAmountDigit,
} from "../../lib/amount";
import { listBankCards, type BankCardRecord } from "../../lib/bankCards";
import { getBankVisual } from "../../lib/bankDetect";
import {
  readDepositGatewayPending,
  saveDepositGatewayPending,
} from "../../lib/depositPending";
import { resolveDisplayName } from "../../lib/displayName";
import { needsDepositKyc } from "../../lib/kycGate";
import "../../styles/shop-rise.css";
import "./WalletGatewayCharge.css";

type Step = "amount" | "card";

type GatewayNavState = {
  amountDigits?: string;
  step?: Step;
  kycDone?: boolean;
  from?: "home" | "asset";
};

const CARD_PATTERNS = [
  "/pattern/Pattern1.svg",
  "/pattern/Pattern2.svg",
  "/pattern/Pattern3.svg",
  "/pattern/Pattern4.svg",
  "/pattern/Pattern5.svg",
  "/pattern/Pattern6.svg",
  "/pattern/Pattern7.svg",
  "/pattern/Pattern8.svg",
  "/pattern/Pattern9.svg",
  "/pattern/Pattern10.svg",
  "/pattern/Shape1.svg",
  "/pattern/Shape2.svg",
] as const;

function getCardPattern(cardId: number): string {
  return CARD_PATTERNS[cardId % CARD_PATTERNS.length]!;
}

function formatCardNumberDisplay(cardNumber: string): string {
  // API already returns masked PAN like "6037 **** **** 1234"
  if (cardNumber.includes("*")) return cardNumber.trim();
  const clean = cardNumber.replace(/\D/g, "");
  return clean.replace(/(\d{4})(?=\d)/g, "$1 ");
}

export function WalletGatewayChargePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, locale } = useI18n();
  const { haptic, openInApp } = useTelegram();
  const { notify } = useNotification();
  const { user } = useAuth();
  const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
  const fallbackHolder = resolveDisplayName(user, tgUser, "");

  const navState = (location.state as GatewayNavState | null) ?? null;
  const pending = readDepositGatewayPending();
  const initialDigits =
    navState?.amountDigits || pending?.amountDigits || "";
  const initialStep: Step =
    navState?.step === "card" && initialDigits ? "card" : "amount";
  const depositFrom = navState?.from ?? pending?.from ?? "home";

  const [step, setStep] = useState<Step>(initialStep);
  const [amountDigits, setAmountDigits] = useState(initialDigits);
  const [from] = useState<"home" | "asset">(depositFrom);
  const [cards, setCards] = useState<BankCardRecord[]>([]);
  const [cardId, setCardId] = useState<number | null>(null);
  const [loadingCards, setLoadingCards] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!navState) return;
    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, navState, navigate]);

  useEffect(() => {
    if (step !== "card" || !needsDepositKyc(user)) return;
    if (!amountDigits) {
      setStep("amount");
      return;
    }
    saveDepositGatewayPending({ amountDigits, from });
    navigate("/wallet/deposit/gateway/kyc", { replace: true });
  }, [amountDigits, from, navigate, step, user]);

  const amountToman = useMemo(
    () => parseAmountDigits(amountDigits),
    [amountDigits],
  );
  const amountDisplay = useMemo(
    () => formatAmountFa(amountDigits),
    [amountDigits],
  );
  const amountError = useMemo(
    () => getGatewayAmountError(amountToman, Boolean(amountDigits)),
    [amountDigits, amountToman],
  );
  const canContinueAmount = isGatewayAmountValid(amountToman);

  const loadCards = useCallback(async () => {
    setLoadingCards(true);
    try {
      const data = await listBankCards();
      setCards(data.cards);
      setCardId((prev) => {
        if (prev != null && data.cards.some((c) => c.id === prev)) return prev;
        const primary = data.cards.find((c) => c.isPrimary);
        return primary?.id ?? data.cards[0]?.id ?? null;
      });
    } catch (err) {
      notify(err instanceof Error ? err.message : t("common.error"), "error");
    } finally {
      setLoadingCards(false);
    }
  }, [notify, t]);

  useEffect(() => {
    if (step !== "card") return;
    void loadCards();
  }, [step, loadCards]);

  const goBack = () => {
    if (step === "card") {
      setStep("amount");
      return;
    }
    navigate("/wallet/deposit/toman", {
      replace: true,
      state: { from },
    });
  };

  const goToCards = () => {
    if (!canContinueAmount) return;
    haptic("light");
    saveDepositGatewayPending({ amountDigits, from });
    if (needsDepositKyc(user)) {
      navigate("/wallet/deposit/gateway/kyc");
      return;
    }
    setStep("card");
  };

  const submit = async () => {
    if (cardId == null || !canContinueAmount) return;
    setSubmitting(true);
    haptic("light");
    try {
      const res = await apiFetch<{
        charge: { code: string; paymentUrl: string | null };
      }>("/wallet/gateway-charge", {
        method: "POST",
        body: { cardId, amountToman },
      });
      if (!res.charge.paymentUrl) {
        notify(t("wallet.gatewayLinkFailed"), "error");
        return;
      }
      openInApp(res.charge.paymentUrl);
    } catch (err) {
      const message =
        err instanceof Error && /verification|احراز|kyc/i.test(err.message)
          ? t("wallet.depositKycRequired")
          : err instanceof Error
            ? err.message
            : t("common.error");
      notify(message, "error");
      if (needsDepositKyc(user)) {
        saveDepositGatewayPending({ amountDigits });
        navigate("/wallet/deposit/gateway/kyc");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const title =
    step === "amount"
      ? t("wallet.gatewayEnterAmount")
      : t("wallet.gatewaySelectCard");

  if (step === "amount") {
    return (
      <div className="wallet-charge">
        <div className="shop-rise" style={{ "--rise-index": 0 } as CSSProperties}>
          <PageHeader title={title} onBack={goBack} />
        </div>

        <div className="wallet-charge__body">
          <section
            className="wallet-charge__amount shop-rise"
            style={{ "--rise-index": 1 } as CSSProperties}
            aria-label={t("wallet.gatewayEnterAmount")}
          >
            <p className="wallet-charge__label">{t("wallet.gatewayChargeLabel")}</p>
            <div className="wallet-charge__value-row">
              <span className="wallet-charge__unit">{t("wallet.toman")}</span>
              <span
                className={`wallet-charge__value${
                  amountDigits ? "" : " wallet-charge__value--placeholder"
                }`}
              >
                {amountDisplay}
              </span>
            </div>
            {amountError ? (
              <p className="wallet-charge__error" role="alert">
                {amountError}
              </p>
            ) : null}
          </section>

          <div
            className="wallet-charge__keypad shop-rise"
            style={{ "--rise-index": 2 } as CSSProperties}
          >
            <NumeralKeypad
              onDigit={(digit) =>
                setAmountDigits((current) => appendAmountDigit(current, digit))
              }
              onBackspace={() =>
                setAmountDigits((current) => removeLastAmountDigit(current))
              }
            />
          </div>
        </div>

        <footer
          className="wallet-charge__footer shop-rise"
          style={{ "--rise-index": 3 } as CSSProperties}
        >
          <button
            type="button"
            className="wallet-charge__continue"
            disabled={!canContinueAmount}
            onClick={goToCards}
          >
            {t("common.continue")}
          </button>
        </footer>
      </div>
    );
  }

  return (
    <div className="wallet-charge wallet-charge--cards">
      <div className="shop-rise" style={{ "--rise-index": 0 } as CSSProperties}>
        <PageHeader title={title} onBack={goBack} />
      </div>

      <div className="wallet-charge__cards-scroll">
        <div
          className="wallet-charge__notice shop-rise"
          style={{ "--rise-index": 1 } as CSSProperties}
        >
          <p className="wallet-charge__notice-text">
            {t("wallet.gatewayCardNotice", { amount: amountDisplay })}
          </p>
        </div>

        {loadingCards ? (
          <div
            className="wallet-charge__visual-list"
            role="status"
            aria-busy="true"
            aria-label={t("common.loading")}
          >
            {[0, 1, 2].map((index) => (
              <div
                key={index}
                className="wallet-charge__visual wallet-charge__visual--skeleton shop-rise"
                style={{ "--rise-index": index + 2 } as CSSProperties}
              >
                <div className="wallet-charge__visual-top wallet-charge__skeleton-top">
                  <div className="wallet-charge__visual-header">
                    <div className="wallet-charge__bank-meta">
                      <span className="wallet-charge__skeleton-block wallet-charge__skeleton-icon" />
                      <span className="wallet-charge__skeleton-block wallet-charge__skeleton-name" />
                    </div>
                    <span className="wallet-charge__skeleton-block wallet-charge__skeleton-badge" />
                  </div>
                </div>
                <div className="wallet-charge__visual-bottom wallet-charge__skeleton-bottom">
                  <div className="wallet-charge__bottom-row">
                    <span className="wallet-charge__skeleton-block wallet-charge__skeleton-number" />
                    <span className="wallet-charge__skeleton-block wallet-charge__skeleton-holder" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : cards.length === 0 ? (
          <>
            <p className="wallet-charge__empty">{t("wallet.gatewayNoCards")}</p>
            <button
              type="button"
              className="wallet-charge__continue"
              onClick={() => navigate("/profile/bankcard")}
            >
              {t("wallet.gatewayAddCard")}
            </button>
          </>
        ) : (
          <div className="wallet-charge__visual-list" role="list">
            {cards.map((card, index) => {
              const selected = card.id === cardId;
              const visual = getBankVisual(card.bankSlug, card.cardNumber);
              const displayName =
                card.bankName ||
                (locale === "fa" ? visual.nameFa : visual.nameEn);
              const pattern = getCardPattern(card.id);
              const holder = card.ownerName?.trim() || fallbackHolder;

              return (
                <button
                  key={card.id}
                  type="button"
                  role="listitem"
                  className={`wallet-charge__visual shop-rise${
                    selected ? " wallet-charge__visual--selected" : ""
                  }`}
                  style={{ "--rise-index": index + 2 } as CSSProperties}
                  onClick={() => {
                    haptic("light");
                    setCardId(card.id);
                  }}
                  aria-pressed={selected}
                >
                  <div
                    className="wallet-charge__visual-top"
                    style={{
                      background: `linear-gradient(135deg, ${visual.color1} 0%, ${visual.color2} 100%)`,
                      backgroundImage: `url('${pattern}'), linear-gradient(135deg, ${visual.color1} 0%, ${visual.color2} 100%)`,
                      backgroundSize: "cover, cover",
                      backgroundPosition: "center, center",
                      backgroundRepeat: "no-repeat, no-repeat",
                    }}
                  >
                    <div className="wallet-charge__visual-header">
                      <div className="wallet-charge__bank-meta">
                        <img
                          src={visual.iconSrc}
                          alt=""
                          className="wallet-charge__bank-icon"
                          width={18}
                          height={18}
                          onError={(event) => {
                            event.currentTarget.src = "/banks/unknown.svg";
                          }}
                        />
                        <span className="wallet-charge__bank-name">
                          {displayName}
                        </span>
                      </div>
                      {selected ? (
                        <span className="wallet-charge__selected-badge">
                          {t("wallet.gatewayCardSelected")}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="wallet-charge__visual-bottom">
                    <div className="wallet-charge__bottom-row">
                      <span className="wallet-charge__card-number" dir="ltr">
                        {formatCardNumberDisplay(card.cardNumber)}
                      </span>
                      {holder ? (
                        <span className="wallet-charge__holder">{holder}</span>
                      ) : null}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {cards.length > 0 ? (
        <footer
          className="wallet-charge__footer shop-rise"
          style={{ "--rise-index": 20 } as CSSProperties}
        >
          <button
            type="button"
            className="wallet-charge__continue"
            disabled={submitting || cardId == null}
            onClick={() => void submit()}
          >
            {submitting ? t("common.loading") : t("wallet.gatewayPay")}
          </button>
        </footer>
      ) : null}
    </div>
  );
}
