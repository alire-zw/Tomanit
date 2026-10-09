import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { EmptyState } from "../../components/EmptyState";
import { PageHeader } from "../../components/PageHeader";
import { useNotification } from "../../components/Notification";
import ClipboardPasteIcon from "../../components/icons/hugeicons/ClipboardPasteIcon";
import MoneyReceiveSquareIcon from "../../components/icons/hugeicons/MoneyReceiveSquareIcon";
import WalletCardsIcon from "../../components/icons/hugeicons/WalletCardsIcon";
import { useI18n } from "../../context/I18nContext";
import { useAuth } from "../../hooks/useAuth";
import { useTelegram } from "../../hooks/useTelegram";
import { ApiError } from "../../lib/api";
import { toPersianDigit } from "../../lib/digits";
import { formatFaDate, formatFaNumber } from "../../lib/format";
import {
  fetchShopHub,
  fetchShopSettlements,
  requestShopSettlement,
  type ShopSettlement,
  type ShopSettlementMethod,
  type ShopTrxDestination,
} from "../../lib/shop";
import { getWalletAssetDef } from "../../lib/walletAssetsCatalog";
import "../../styles/shop-rise.css";
import "../MyShop.css";

const TRX_LOGO = getWalletAssetDef("trx")?.logo ?? "/coins/TRX.png";

/** TODO: restore to 700_000 after testing */
const MIN_AMOUNT = 10_000;
const MAX_AMOUNT = 500_000_000;

function formatCountdown(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return toPersianDigit(`${pad(h)}:${pad(m)}:${pad(s)}`);
}

function normalizeIbanInput(raw: string): string {
  return raw.replace(/\s/g, "").toUpperCase();
}

function isLikelyIban(raw: string): boolean {
  const n = normalizeIbanInput(raw);
  if (/^IR\d{24}$/.test(n)) return true;
  return /^\d{24}$/.test(n);
}

function isLikelyTronAddress(raw: string): boolean {
  return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(raw.trim());
}

function digitsOnly(raw: string): string {
  return raw.replace(/[^\d]/g, "");
}

function formatAmountInput(digits: string): string {
  if (!digits) return "";
  const n = Number.parseInt(digits, 10);
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString("en-US");
}

function parseAmountInput(raw: string): number {
  const digits = digitsOnly(raw);
  if (!digits) return 0;
  const n = Number.parseInt(digits, 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function statusLabelKey(status: ShopSettlement["status"]): string {
  if (status === "paid") return "myShop.settlePaid";
  if (status === "processing") return "myShop.settleProcessing";
  if (status === "rejected") return "myShop.settleRejected";
  return "myShop.settleRequested";
}

function statusBadgeClass(status: ShopSettlement["status"]): string {
  if (status === "paid") return "my-shop__badge my-shop__badge--ok";
  if (status === "rejected") return "my-shop__badge my-shop__badge--err";
  if (status === "processing") return "my-shop__badge my-shop__badge--warn";
  return "my-shop__badge my-shop__badge--mute";
}

export function ShopSettlementsPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { haptic } = useTelegram();
  const { notify } = useNotification();
  const { applyShopHub } = useAuth();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [availableToman, setAvailableToman] = useState(0);
  const [pendingToman, setPendingToman] = useState(0);
  const [nextUnlockAt, setNextUnlockAt] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [shopActive, setShopActive] = useState(false);
  const [settlements, setSettlements] = useState<ShopSettlement[]>([]);

  const [method, setMethod] = useState<ShopSettlementMethod>("rial");
  const [amountRaw, setAmountRaw] = useState("");
  const [iban, setIban] = useState("");
  const [trxDestination, setTrxDestination] = useState<ShopTrxDestination>("in_app");
  const [trxAddress, setTrxAddress] = useState("");

  const reload = useCallback(async () => {
    const [hub, list] = await Promise.all([fetchShopHub(), fetchShopSettlements()]);
    applyShopHub(hub);
    setAvailableToman(hub.balance.availableToman);
    setPendingToman(hub.balance.pendingToman);
    setNextUnlockAt(hub.balance.nextUnlockAt ?? null);
    setShopActive(hub.shop?.status === "active");
    setSettlements(list.settlements);
  }, [applyShopHub]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await reload();
      } catch {
        if (!cancelled) setSettlements([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reload]);

  useEffect(() => {
    if (!nextUnlockAt) return;
    const unlockMs = Date.parse(nextUnlockAt);
    if (!Number.isFinite(unlockMs)) return;

    const tick = () => {
      const now = Date.now();
      setNowMs(now);
      if (now >= unlockMs) {
        void reload();
      }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [nextUnlockAt, reload]);

  const unlockRemainingMs = useMemo(() => {
    if (!nextUnlockAt || pendingToman <= 0) return 0;
    const unlockMs = Date.parse(nextUnlockAt);
    if (!Number.isFinite(unlockMs)) return 0;
    return Math.max(0, unlockMs - nowMs);
  }, [nextUnlockAt, pendingToman, nowMs]);

  const amountToman = parseAmountInput(amountRaw);

  const amountError = useMemo(() => {
    if (!amountRaw.trim()) return null;
    if (amountToman < MIN_AMOUNT) return t("myShop.settleAmountMin");
    if (amountToman > MAX_AMOUNT) return t("myShop.invoiceAmountMax");
    if (amountToman > availableToman) return t("myShop.settleAmountExceedsBalance");
    return null;
  }, [amountRaw, amountToman, availableToman, t]);

  const ibanError = useMemo(() => {
    if (method !== "rial" || !iban.trim()) return null;
    return isLikelyIban(iban) ? null : t("myShop.settleIbanInvalid");
  }, [iban, method, t]);

  const trxAddressError = useMemo(() => {
    if (method !== "trx" || trxDestination !== "external" || !trxAddress.trim()) {
      return null;
    }
    return isLikelyTronAddress(trxAddress) ? null : t("myShop.settleTrxAddressInvalid");
  }, [method, trxAddress, trxDestination, t]);

  const canSubmit = useMemo(() => {
    if (!shopActive || submitting || amountError || !amountRaw.trim()) return false;
    if (method === "rial") return Boolean(iban.trim()) && !ibanError;
    if (trxDestination === "external") {
      return Boolean(trxAddress.trim()) && !trxAddressError;
    }
    return true;
  }, [
    shopActive,
    submitting,
    amountError,
    amountRaw,
    method,
    iban,
    ibanError,
    trxDestination,
    trxAddress,
    trxAddressError,
  ]);

  const onMethodPick = (next: ShopSettlementMethod) => {
    if (next === method || submitting) return;
    haptic("light");
    setMethod(next);
  };

  const onTrxDestPick = (next: ShopTrxDestination) => {
    if (next === trxDestination || submitting) return;
    haptic("light");
    setTrxDestination(next);
    if (next === "in_app") setTrxAddress("");
  };

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await requestShopSettlement({
        method,
        amountToman,
        iban: method === "rial" ? normalizeIbanInput(iban) : undefined,
        trxDestination: method === "trx" ? trxDestination : undefined,
        trxAddress:
          method === "trx" && trxDestination === "external"
            ? trxAddress.trim()
            : undefined,
      });
      haptic("medium");
      notify(t("myShop.settlementSubmitted"), "success");
      setAmountRaw("");
      setIban("");
      setTrxAddress("");
      await reload();
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

  const useAllBalance = () => {
    if (availableToman <= 0) return;
    haptic("light");
    const capped = Math.min(availableToman, MAX_AMOUNT);
    setAmountRaw(formatAmountInput(String(capped)));
  };

  const pasteInto = async (target: "iban" | "trx") => {
    haptic("light");
    try {
      const text = (await navigator.clipboard.readText()).trim();
      if (!text) return;
      if (target === "iban") setIban(text);
      else setTrxAddress(text);
    } catch {
      notify(t("common.pasteFailed"), "error");
    }
  };

  return (
    <div className="my-shop my-shop--sub my-shop--settlements-page">
      <div className="my-shop__settle-header">
        <PageHeader title={t("myShop.tileSettlements")} onBack={() => navigate("/shop")} />
      </div>

      <div className="my-shop__body">
        {loading ? (
          <div
            className="my-shop__gs-skel shop-rise"
            style={{ "--rise-index": 1 } as CSSProperties}
            aria-busy
            aria-label={t("common.loading")}
          >
            <span className="my-shop__gs-skel-hint" />
            <span className="my-shop__gs-skel-hint my-shop__gs-skel-hint--sm" />
          </div>
        ) : (
          <>
            <section
              className="my-shop__hero my-shop__settle-hero shop-rise"
              style={{ "--rise-index": 1, margin: 0 } as CSSProperties}
            >
              <p className="my-shop__hero-label">{t("myShop.availableBalance")}</p>
              <p className="my-shop__hero-value">
                {formatFaNumber(availableToman)}
                <span className="my-shop__hero-unit">{t("wallet.toman")}</span>
              </p>
              <div className="my-shop__settle-summary-meta">
                <span>
                  {t("myShop.pendingBalance")}{" "}
                  <strong>
                    {formatFaNumber(pendingToman)} {t("wallet.toman")}
                  </strong>
                </span>
                <span className="my-shop__settle-timer" dir="ltr">
                  {pendingToman > 0 && unlockRemainingMs > 0
                    ? formatCountdown(unlockRemainingMs)
                    : toPersianDigit("00:00:00")}
                </span>
              </div>
              <p className="my-shop__hero-meta">{t("myShop.settleHoldHint")}</p>
            </section>

            <div
              className="my-shop__settle-seg shop-rise"
              style={{ "--rise-index": 2 } as CSSProperties}
              role="tablist"
              aria-label={t("myShop.settleTypeTitle")}
            >
              <button
                type="button"
                role="tab"
                aria-selected={method === "rial"}
                className={`my-shop__settle-seg-btn${method === "rial" ? " is-active" : ""}`}
                disabled={!shopActive || submitting}
                onClick={() => onMethodPick("rial")}
              >
                <MoneyReceiveSquareIcon variant="bulk-rounded" size={16} color="currentColor" />
                <span>{t("myShop.settleMethodRial")}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={method === "trx"}
                className={`my-shop__settle-seg-btn${method === "trx" ? " is-active" : ""}`}
                disabled={!shopActive || submitting}
                onClick={() => onMethodPick("trx")}
              >
                <img
                  className="my-shop__settle-coin"
                  src={TRX_LOGO}
                  alt=""
                  width={18}
                  height={18}
                  decoding="async"
                />
                <span>{t("myShop.settleMethodTrx")}</span>
              </button>
            </div>

            {method === "rial" ? (
              <div
                className="my-shop__field shop-rise"
                style={{ "--rise-index": 3 } as CSSProperties}
              >
                <div className="my-shop__field-head">
                  <label className="my-shop__label" htmlFor="settle-iban">
                    {t("myShop.fieldSettleIban")}
                  </label>
                  {ibanError ? (
                    <span className="my-shop__field-error">{ibanError}</span>
                  ) : null}
                </div>
                <div className="my-shop__settle-input-wrap">
                  <input
                    id="settle-iban"
                    className="my-shop__input my-shop__input--with-action"
                    dir="ltr"
                    lang="en"
                    inputMode="text"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    value={iban}
                    disabled={!shopActive || submitting}
                    placeholder={t("myShop.fieldSettleIbanPh")}
                    onChange={(e) => setIban(e.target.value)}
                  />
                  <button
                    type="button"
                    className="my-shop__settle-paste"
                    aria-label={t("common.paste")}
                    disabled={!shopActive || submitting}
                    onClick={() => void pasteInto("iban")}
                  >
                    <ClipboardPasteIcon size={18} color="currentColor" />
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div
                  className="my-shop__settle-seg shop-rise"
                  style={{ "--rise-index": 3 } as CSSProperties}
                  role="tablist"
                  aria-label={t("myShop.settleTrxDestHint")}
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={trxDestination === "in_app"}
                    className={`my-shop__settle-seg-btn${
                      trxDestination === "in_app" ? " is-active" : ""
                    }`}
                    disabled={!shopActive || submitting}
                    onClick={() => onTrxDestPick("in_app")}
                  >
                    <WalletCardsIcon variant="bulk-rounded" size={16} color="currentColor" />
                    <span>{t("myShop.settleTrxInApp")}</span>
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={trxDestination === "external"}
                    className={`my-shop__settle-seg-btn${
                      trxDestination === "external" ? " is-active" : ""
                    }`}
                    disabled={!shopActive || submitting}
                    onClick={() => onTrxDestPick("external")}
                  >
                    <img
                      className="my-shop__settle-coin"
                      src={TRX_LOGO}
                      alt=""
                      width={18}
                      height={18}
                      decoding="async"
                    />
                    <span>{t("myShop.settleTrxExternal")}</span>
                  </button>
                </div>

                {trxDestination === "external" ? (
                  <div
                    className="my-shop__field shop-rise"
                    style={{ "--rise-index": 4 } as CSSProperties}
                  >
                    <div className="my-shop__field-head">
                      <label className="my-shop__label" htmlFor="settle-trx-address">
                        {t("myShop.fieldSettleTrxAddress")}
                      </label>
                      {trxAddressError ? (
                        <span className="my-shop__field-error">{trxAddressError}</span>
                      ) : null}
                    </div>
                    <div className="my-shop__settle-input-wrap">
                      <input
                        id="settle-trx-address"
                        className="my-shop__input my-shop__input--with-action"
                        dir="ltr"
                        lang="en"
                        inputMode="text"
                        autoComplete="off"
                        autoCorrect="off"
                        spellCheck={false}
                        value={trxAddress}
                        disabled={!shopActive || submitting}
                        placeholder={t("myShop.fieldSettleTrxAddressPh")}
                        onChange={(e) => setTrxAddress(e.target.value)}
                      />
                      <button
                        type="button"
                        className="my-shop__settle-paste"
                        aria-label={t("common.paste")}
                        disabled={!shopActive || submitting}
                        onClick={() => void pasteInto("trx")}
                      >
                        <ClipboardPasteIcon size={18} color="currentColor" />
                      </button>
                    </div>
                  </div>
                ) : null}
              </>
            )}

            <div
              className="my-shop__field shop-rise"
              style={{ "--rise-index": 5 } as CSSProperties}
            >
              <div className="my-shop__field-head">
                <label className="my-shop__label" htmlFor="settle-amount">
                  {t("myShop.fieldSettleAmount")}
                </label>
                {amountError ? (
                  <span className="my-shop__field-error">{amountError}</span>
                ) : null}
              </div>
              <div className="my-shop__settle-input-wrap">
                <input
                  id="settle-amount"
                  className="my-shop__input my-shop__input--with-action my-shop__input--with-all"
                  inputMode="numeric"
                  dir="ltr"
                  value={amountRaw}
                  disabled={!shopActive || submitting}
                  placeholder={t("myShop.fieldSettleAmountPh")}
                  onChange={(e) =>
                    setAmountRaw(formatAmountInput(digitsOnly(e.target.value)))
                  }
                />
                <button
                  type="button"
                  className="my-shop__settle-all-btn"
                  disabled={!shopActive || submitting || availableToman <= 0}
                  onClick={useAllBalance}
                >
                  {t("myShop.settleUseMax")}
                </button>
              </div>
            </div>

            <button
              type="button"
              className="my-shop__cta shop-rise"
              style={{ "--rise-index": 6 } as CSSProperties}
              disabled={!canSubmit}
              onClick={() => void submit()}
            >
              {submitting ? t("common.loading") : t("myShop.requestSettlement")}
            </button>

            <h2
              className="my-shop__section-title shop-rise"
              style={{ "--rise-index": 7, marginTop: 4 } as CSSProperties}
            >
              {t("myShop.settlementHistory")}
            </h2>

            {settlements.length === 0 ? (
              <EmptyState title={t("myShop.noSettlementsYet")} compact />
            ) : (
              <div
                className="my-shop__list shop-rise"
                style={{ "--rise-index": 8 } as CSSProperties}
                role="list"
              >
                {settlements.map((row) => {
                  const dest =
                    row.method === "rial"
                      ? row.ibanMasked
                      : row.trxDestination === "in_app"
                        ? t("myShop.settleTrxInApp")
                        : row.trxAddressMasked;
                  return (
                    <div
                      key={row.id}
                      className="my-shop__item my-shop__item--static"
                      role="listitem"
                    >
                      <span className="my-shop__item-icon" aria-hidden>
                        {row.method === "rial" ? (
                          <MoneyReceiveSquareIcon variant="bulk-rounded" size={16} />
                        ) : (
                          <img
                            className="my-shop__settle-coin"
                            src={TRX_LOGO}
                            alt=""
                            width={16}
                            height={16}
                            decoding="async"
                          />
                        )}
                      </span>
                      <div className="my-shop__item-body">
                        <div className="my-shop__item-title">
                          {formatFaNumber(row.amountToman)} {t("wallet.toman")}
                        </div>
                        <div className="my-shop__item-sub">
                          {row.method === "rial"
                            ? t("myShop.settleMethodRial")
                            : t("myShop.settleMethodTrx")}
                          {dest ? ` · ${dest}` : ""}
                          {" · "}
                          {formatFaDate(row.createdAt)}
                        </div>
                      </div>
                      <div className="my-shop__item-end">
                        <span className={statusBadgeClass(row.status)}>
                          {t(statusLabelKey(row.status))}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
