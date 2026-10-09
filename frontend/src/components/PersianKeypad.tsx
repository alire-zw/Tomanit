import { useI18n } from "../context/I18nContext";
import { useTelegram } from "../hooks/useTelegram";
import "./PersianKeypad.css";

/** Persian letters + space / ZWNJ only (no Latin). */
export const PERSIAN_CHAR_RE = /^[\u0600-\u06FF\u200C\s]*$/;

export function filterPersianInput(raw: string): string {
  return [...raw].filter((ch) => PERSIAN_CHAR_RE.test(ch)).join("");
}

type Props = {
  onChar: (char: string) => void;
  onBackspace: () => void;
  backspaceDisabled?: boolean;
};

const ROW_1 = ["ض", "ص", "ث", "ق", "ف", "غ", "ع", "ه", "خ", "ح", "ج", "چ"] as const;
const ROW_2 = ["ش", "س", "ی", "ب", "ل", "ا", "ت", "ن", "م", "ک", "گ"] as const;
const ROW_3 = ["ظ", "ط", "ز", "ر", "ذ", "د", "پ", "و", "ژ", "آ", "ئ"] as const;

export function PersianKeypad({ onChar, onBackspace, backspaceDisabled = false }: Props) {
  const { t } = useI18n();
  const { haptic } = useTelegram();

  const press = (char: string) => {
    haptic("light");
    onChar(char);
  };

  const back = () => {
    if (backspaceDisabled) return;
    haptic("light");
    onBackspace();
  };

  return (
    <div className="persian-keypad" dir="rtl">
      <div className="persian-keypad__row">
        {ROW_1.map((ch) => (
          <button key={ch} type="button" className="persian-keypad__key" onClick={() => press(ch)}>
            {ch}
          </button>
        ))}
      </div>
      <div className="persian-keypad__row">
        {ROW_2.map((ch) => (
          <button key={ch} type="button" className="persian-keypad__key" onClick={() => press(ch)}>
            {ch}
          </button>
        ))}
      </div>
      <div className="persian-keypad__row">
        {ROW_3.map((ch) => (
          <button key={ch} type="button" className="persian-keypad__key" onClick={() => press(ch)}>
            {ch}
          </button>
        ))}
      </div>
      <div className="persian-keypad__row persian-keypad__row--actions">
        <button
          type="button"
          className="persian-keypad__key persian-keypad__key--wide"
          onClick={() => press("\u200c")}
          aria-label={t("myShop.zwnj")}
        >
          {t("myShop.zwnj")}
        </button>
        <button
          type="button"
          className="persian-keypad__key persian-keypad__key--space"
          onClick={() => press(" ")}
          aria-label={t("myShop.space")}
        >
          {t("myShop.space")}
        </button>
        <button
          type="button"
          className={`persian-keypad__key persian-keypad__key--action${
            backspaceDisabled ? " persian-keypad__key--disabled" : ""
          }`}
          onClick={back}
          disabled={backspaceDisabled}
          aria-label={t("common.delete")}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M9 6H20.25C21.2165 6 22 6.7835 22 7.75V16.25C22 17.2165 21.2165 18 20.25 18H9L4 21V6H9Z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <path
              d="M14.5 10.5L17.5 13.5M17.5 10.5L14.5 13.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
