import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useNavigate } from "react-router-dom";
import { BottomSheet } from "../../components/BottomSheet";
import { EmptyState } from "../../components/EmptyState";
import { NumeralKeypad } from "../../components/NumeralKeypad";
import { useNotification } from "../../components/Notification";
import { PageHeader } from "../../components/PageHeader";
import BankCardIcon from "../../components/icons/BankCardIcon";
import IdNotVerifiedIcon from "../../components/icons/id-not-verified-stroke-rounded";
import IdVerifiedIcon from "../../components/icons/id-verified-stroke-rounded";
import { useI18n } from "../../context/I18nContext";
import { useAuth } from "../../hooks/useAuth";
import { useTelegram } from "../../hooks/useTelegram";
import { ApiError } from "../../lib/api";
import { addBankCard, listBankCards, type BankCardRecord } from "../../lib/bankCards";
import { detectBankFromCardDigits, getBankVisual } from "../../lib/bankDetect";
import {
  appendCardDigit,
  formatCardNumberFa,
  isValidCardNumberLength,
  removeLastCardDigit,
} from "../../lib/card";
import { resolveDisplayName } from "../../lib/displayName";
import "../../styles/shop-rise.css";
import "./ProfileBankcard.css";

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

type CardInquiryStatus = "idle" | "loading" | "success" | "error";

export function ProfileBankcardPage() {
  const navigate = useNavigate();
  const { haptic } = useTelegram();
  const { user } = useAuth();
  const { notify } = useNotification();
  const { t, locale } = useI18n();
  const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
  const holderName = resolveDisplayName(user, tgUser, "");

  const [bankCards, setBankCards] = useState<BankCardRecord[]>([]);
  const [isLoadingCards, setIsLoadingCards] = useState(true);
  const [isAddCardOpen, setIsAddCardOpen] = useState(false);
  const [cardDigits, setCardDigits] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [inquiryStatus, setInquiryStatus] = useState<CardInquiryStatus>("idle");
  const [inquiryError, setInquiryError] = useState<string | null>(null);

  const cardsScrollContainerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);

  const handleBack = useCallback(() => {
    navigate("/profile", { replace: true });
  }, [navigate]);

  const loadCards = useCallback(async () => {
    setIsLoadingCards(true);
    try {
      const response = await listBankCards();
      setBankCards(response.cards);
    } catch (error) {
      notify(
        error instanceof ApiError ? error.message : t("bankCards.loadError"),
        "error",
      );
    } finally {
      setIsLoadingCards(false);
    }
  }, [notify, t]);

  useEffect(() => {
    void loadCards();
  }, [loadCards]);

  const detectedBank = useMemo(() => {
    const bank = detectBankFromCardDigits(cardDigits);
    if (!bank || bank.slug === "unknown") return null;
    return bank;
  }, [cardDigits]);

  const cardDisplay = useMemo(() => formatCardNumberFa(cardDigits), [cardDigits]);
  const canSave =
    isValidCardNumberLength(cardDigits) && Boolean(detectedBank) && !isSaving;
  const bankLabel = detectedBank
    ? locale === "fa"
      ? detectedBank.nameFa
      : detectedBank.nameEn
    : null;

  const handleOpenAddCard = () => {
    haptic("light");
    setCardDigits("");
    setIsAddCardOpen(true);
  };

  const handleCloseAddCard = () => {
    if (isSaving) return;
    setIsAddCardOpen(false);
    setCardDigits("");
  };

  const handleMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!cardsScrollContainerRef.current) return;
    isDragging.current = true;
    startX.current = event.pageX - cardsScrollContainerRef.current.offsetLeft;
    scrollLeft.current = cardsScrollContainerRef.current.scrollLeft;
    cardsScrollContainerRef.current.style.cursor = "grabbing";
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging.current || !cardsScrollContainerRef.current) return;
    event.preventDefault();
    const x = event.pageX - cardsScrollContainerRef.current.offsetLeft;
    const walk = (x - startX.current) * 2;
    cardsScrollContainerRef.current.scrollLeft = scrollLeft.current - walk;
  };

  const handleMouseUp = () => {
    if (!cardsScrollContainerRef.current) return;
    isDragging.current = false;
    cardsScrollContainerRef.current.style.cursor = "grab";
  };

  const closeInquiryModal = () => {
    if (inquiryStatus === "loading") return;
    setInquiryStatus("idle");
    setInquiryError(null);
  };

  const handleAddCard = async () => {
    if (!canSave || !detectedBank || isSaving) return;
    haptic("light");
    setIsSaving(true);
    setIsAddCardOpen(false);
    setInquiryError(null);
    setInquiryStatus("loading");

    try {
      await addBankCard({
        cardNumber: cardDigits,
        bankName: detectedBank.nameFa,
        bankSlug: detectedBank.slug,
        bankBin: detectedBank.bin,
      });
      setCardDigits("");
      haptic("medium");
      setInquiryStatus("success");
      await loadCards();
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : t("bankCards.addError");
      setInquiryError(message);
      setInquiryStatus("error");
      haptic("heavy");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="profile-cards">
      <div className="shop-rise" style={{ "--rise-index": 0 } as CSSProperties}>
        <PageHeader
          title={t("bankCards.sectionCards")}
          onBack={handleBack}
          action={
            <button
              type="button"
              className="page-header__action page-header__action--accent"
              onClick={handleOpenAddCard}
            >
              {t("bankCards.addShort")}
            </button>
          }
        />
      </div>

      <div className="profile-cards__content">
        <h2
          className="profile-cards__section-title shop-rise"
          style={{ "--rise-index": 1 } as CSSProperties}
        >
          {t("bankCards.sectionCards")}
        </h2>

        <div
          className="profile-cards__cards-box shop-rise"
          style={{ "--rise-index": 2 } as CSSProperties}
        >
          {isLoadingCards ? (
            <div
              className="profile-cards__scroll"
              aria-busy="true"
              aria-label={t("bankCards.loadingCards")}
            >
              <div className="profile-cards__wrapper">
                {[0, 1].map((index) => (
                  <div
                    key={index}
                    className="profile-cards__card profile-cards__card--skeleton"
                  >
                    <div className="profile-cards__card-top profile-cards__skeleton-top">
                      <div className="profile-cards__card-header">
                        <div className="profile-cards__skeleton-bank">
                          <span className="profile-cards__skeleton-block profile-cards__skeleton-icon" />
                          <span className="profile-cards__skeleton-block profile-cards__skeleton-name" />
                        </div>
                        <span className="profile-cards__skeleton-block profile-cards__skeleton-badge" />
                      </div>
                    </div>
                    <div className="profile-cards__card-bottom profile-cards__skeleton-bottom">
                      <span className="profile-cards__skeleton-block profile-cards__skeleton-number" />
                      <span className="profile-cards__skeleton-block profile-cards__skeleton-holder" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : bankCards.length === 0 ? (
            <EmptyState title={t("bankCards.empty")} />
          ) : (
            <div
              className="profile-cards__scroll"
              ref={cardsScrollContainerRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              <div className="profile-cards__wrapper">
                {bankCards.map((card) => {
                  const visual = getBankVisual(card.bankSlug, card.cardNumber);
                  const displayName =
                    card.bankName ||
                    (locale === "fa" ? visual.nameFa : visual.nameEn);
                  const cardPattern = getCardPattern(card.id);
                  const holder = card.ownerName?.trim() || holderName || "";

                  return (
                    <div key={card.id} className="profile-cards__card">
                      <div
                        className="profile-cards__card-top"
                        style={{
                          background: `linear-gradient(135deg, ${visual.color1} 0%, ${visual.color2} 100%)`,
                          backgroundImage: `url('${cardPattern}'), linear-gradient(135deg, ${visual.color1} 0%, ${visual.color2} 100%)`,
                          backgroundSize: "cover, cover",
                          backgroundPosition: "center, center",
                          backgroundRepeat: "no-repeat, no-repeat",
                        }}
                      >
                        <div className="profile-cards__card-header">
                          <div className="profile-cards__bank-meta">
                            <img
                              src={visual.iconSrc}
                              alt=""
                              className="profile-cards__bank-icon"
                              width={20}
                              height={20}
                              onError={(event) => {
                                event.currentTarget.src = "/banks/unknown.svg";
                              }}
                            />
                            <span className="profile-cards__bank-name">
                              {displayName}
                            </span>
                          </div>
                          <span
                            className={`profile-cards__verified${
                              card.isVerified
                                ? " profile-cards__verified--ok"
                                : " profile-cards__verified--pending"
                            }`}
                          >
                            {card.isVerified ? (
                              <IdVerifiedIcon width={12} height={12} />
                            ) : (
                              <IdNotVerifiedIcon width={12} height={12} />
                            )}
                            <span>
                              {card.isVerified
                                ? t("bankCards.verified")
                                : t("bankCards.unverified")}
                            </span>
                          </span>
                        </div>
                      </div>
                      <div className="profile-cards__card-bottom">
                        <div className="profile-cards__card-number">
                          {formatCardNumberDisplay(card.cardNumber)}
                        </div>
                        <div className="profile-cards__card-meta">{holder}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <BottomSheet
        open={isAddCardOpen}
        onClose={handleCloseAddCard}
        title={t("bankCards.add")}
        description={t("bankCards.addDesc")}
        className="profile-cards__add-sheet"
        buttons={[
          {
            label: t("common.cancel"),
            onClick: handleCloseAddCard,
            variant: "default",
            disabled: isSaving,
          },
          {
            label: t("common.save"),
            onClick: () => void handleAddCard(),
            variant: "primary",
            disabled: !canSave || isSaving,
          },
        ]}
      >
        <div className="profile-cards__sheet-field">
          <p className="profile-cards__sheet-label">{t("bankCards.cardNumber")}</p>
          <div className="profile-cards__sheet-value-row" dir="ltr">
            <span
              className={`profile-cards__sheet-value${
                cardDigits ? "" : " profile-cards__sheet-value--placeholder"
              }`}
            >
              {cardDisplay}
            </span>
            <span className="profile-cards__sheet-icon" aria-hidden>
              {detectedBank ? (
                <img src={detectedBank.iconSrc} alt="" width={20} height={20} />
              ) : (
                <BankCardIcon width={18} height={18} />
              )}
            </span>
          </div>
          {detectedBank ? (
            <p className="profile-cards__sheet-bank">{bankLabel}</p>
          ) : null}
        </div>

        <div className="profile-cards__sheet-keypad">
          <NumeralKeypad
            onDigit={(digit) => setCardDigits((curr) => appendCardDigit(curr, digit))}
            onBackspace={() => setCardDigits((curr) => removeLastCardDigit(curr))}
          />
        </div>
      </BottomSheet>

      <BottomSheet
        open={inquiryStatus !== "idle"}
        onClose={closeInquiryModal}
        title={
          inquiryStatus === "loading"
            ? t("bankCards.inquiryTitle")
            : inquiryStatus === "success"
              ? t("bankCards.inquirySuccessTitle")
              : t("bankCards.inquiryErrorTitle")
        }
        className="profile-cards__inquiry-sheet"
        buttons={
          inquiryStatus === "loading"
            ? undefined
            : [
                {
                  label:
                    inquiryStatus === "success"
                      ? t("bankCards.ok")
                      : t("common.close"),
                  onClick: closeInquiryModal,
                  variant: inquiryStatus === "success" ? "primary" : "default",
                },
              ]
        }
      >
        <div
          className={`profile-cards__inquiry profile-cards__inquiry--${inquiryStatus}`}
          aria-live="polite"
        >
          {inquiryStatus === "loading" ? (
            <>
              <span className="profile-cards__inquiry-spinner" aria-hidden />
              <p className="profile-cards__inquiry-title">{t("bankCards.inquiryChecking")}</p>
              <p className="profile-cards__inquiry-text">{t("bankCards.inquiryLoading")}</p>
            </>
          ) : null}

          {inquiryStatus === "success" ? (
            <>
              <span className="profile-cards__inquiry-icon profile-cards__inquiry-icon--ok" aria-hidden>
                <IdVerifiedIcon width={28} height={28} />
              </span>
              <p className="profile-cards__inquiry-title">{t("bankCards.inquirySuccess")}</p>
              <p className="profile-cards__inquiry-text">{t("bankCards.inquirySuccessText")}</p>
            </>
          ) : null}

          {inquiryStatus === "error" ? (
            <>
              <span className="profile-cards__inquiry-icon profile-cards__inquiry-icon--err" aria-hidden>
                <IdNotVerifiedIcon width={28} height={28} />
              </span>
              <p className="profile-cards__inquiry-title">{t("bankCards.inquiryFailTitle")}</p>
              <p className="profile-cards__inquiry-text">
                {inquiryError || t("bankCards.inquiryFailFallback")}
              </p>
            </>
          ) : null}
        </div>
      </BottomSheet>
    </div>
  );
}
