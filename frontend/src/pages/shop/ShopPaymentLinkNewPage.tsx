import { useMemo, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { NumeralKeypad } from "../../components/NumeralKeypad";
import { PageHeader } from "../../components/PageHeader";
import { useNotification } from "../../components/Notification";
import { useI18n } from "../../context/I18nContext";
import { useTelegram } from "../../hooks/useTelegram";
import { ApiError } from "../../lib/api";
import {
  appendAmountDigit,
  formatAmountFa,
  parseAmountDigits,
  removeLastAmountDigit,
} from "../../lib/amount";
import { createShopPaymentLink } from "../../lib/shop";
import "../../styles/shop-rise.css";
import "../wallet/WalletGatewayCharge.css";

const MIN_AMOUNT = 10_000;
const MAX_AMOUNT = 500_000_000;

export function ShopPaymentLinkNewPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { haptic } = useTelegram();
  const { notify } = useNotification();
  const [amountDigits, setAmountDigits] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const amountToman = parseAmountDigits(amountDigits);
  const amountDisplay = amountDigits ? formatAmountFa(amountDigits) : formatAmountFa("0");
  const amountError = useMemo(() => {
    if (!amountDigits) return null;
    if (amountToman < MIN_AMOUNT) return t("myShop.invoiceAmountMin");
    if (amountToman > MAX_AMOUNT) return t("myShop.invoiceAmountMax");
    return null;
  }, [amountDigits, amountToman, t]);
  const canSubmit = amountToman >= MIN_AMOUNT && amountToman <= MAX_AMOUNT && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const { link } = await createShopPaymentLink({ amountToman });
      haptic("medium");
      notify(t("myShop.paymentLinkCreated"), "success");
      try {
        await navigator.clipboard.writeText(link.url);
      } catch {
        // ignore
      }
      navigate("/shop/payment-links", { replace: true });
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

  return (
    <div className="wallet-charge">
      <div className="shop-rise" style={{ "--rise-index": 0 } as CSSProperties}>
        <PageHeader
          title={t("myShop.newInvoice")}
          onBack={() => navigate("/shop/payment-links")}
        />
      </div>

      <div className="wallet-charge__body">
        <section
          className="wallet-charge__amount shop-rise"
          style={{ "--rise-index": 1 } as CSSProperties}
          aria-label={t("myShop.paymentLinkAmount")}
        >
          <p className="wallet-charge__label">{t("myShop.paymentLinkAmount")}</p>
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
            onDigit={(digit) => {
              haptic("light");
              setAmountDigits((current) => appendAmountDigit(current, digit));
            }}
            onBackspace={() => {
              haptic("light");
              setAmountDigits((current) => removeLastAmountDigit(current));
            }}
            backspaceDisabled={!amountDigits}
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
          disabled={!canSubmit}
          onClick={() => void submit()}
        >
          {submitting ? t("common.loading") : t("myShop.newInvoice")}
        </button>
      </footer>
    </div>
  );
}
