import { Link } from "react-router-dom";
import type { CSSProperties } from "react";
import ChatQuestionIcon from "../components/icons/ChatQuestionIcon";
import DepositCryptoIcon from "../components/icons/DepositCryptoIcon";
import WalletIcon from "../components/icons/WalletIcon";
import "../styles/shop-rise.css";
import "./Home.css";

export function HomePage() {
  return (
    <div className="home">
      <section className="home__hero shop-rise" style={{ "--rise-index": 0 } as CSSProperties}>
        <p className="home__eyebrow">صرافی تلگرامی</p>
        <h1 className="home__brand">تومانیت</h1>
        <p className="home__lead">خرید و فروش TRON با تومان — سریع و امن داخل تلگرام.</p>
        <Link to="/wallet" className="btn btn--primary home__cta">
          رفتن به کیف پول
        </Link>
      </section>

      <h5 className="home__section-title shop-rise" style={{ "--rise-index": 1 } as CSSProperties}>
        امکانات
      </h5>
      <div className="home__menu-box shop-rise" style={{ "--rise-index": 2 } as CSSProperties}>
        <div className="home__menu-item">
          <span className="home__menu-start">
            <span className="home__menu-icon">
              <DepositCryptoIcon width={18} height={18} />
            </span>
            TRON / TRX
          </span>
          <span className="home__menu-meta">نرخ لحظه‌ای</span>
        </div>
        <div className="home__menu-divider" />
        <div className="home__menu-item">
          <span className="home__menu-start">
            <span className="home__menu-icon">
              <WalletIcon width={18} height={18} />
            </span>
            کیف پول تومان
          </span>
          <span className="home__menu-meta">شارژ و تبدیل</span>
        </div>
        <div className="home__menu-divider" />
        <Link to="/support" className="home__menu-item home__menu-item--link">
          <span className="home__menu-start">
            <span className="home__menu-icon">
              <ChatQuestionIcon width={18} height={18} />
            </span>
            پشتیبانی
          </span>
          <span className="home__menu-meta">تیکت آنلاین</span>
        </Link>
      </div>
    </div>
  );
}
