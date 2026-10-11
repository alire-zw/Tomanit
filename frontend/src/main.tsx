import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { I18nProvider } from "./context/I18nContext";
import { ThemeProvider } from "./context/ThemeContext";
import { bootInvoiceDeepLink } from "./lib/bootInvoiceDeepLink";
import { disableAppZoom } from "./lib/disableZoom";
import { bootstrapI18n } from "./i18n";
import { applyEarlyTelegramChrome } from "./lib/telegramTheme";
import { bootstrapTheme } from "./lib/theme";
import "./styles/global.css";

bootstrapTheme();
bootstrapI18n();
disableAppZoom();
/** Sync invoice deep-link before first paint — avoids wallet flash. */
bootInvoiceDeepLink();
/** Paint Telegram header from cache immediately (before React / WebApp.ready). */
applyEarlyTelegramChrome();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <I18nProvider>
        <App />
      </I18nProvider>
    </ThemeProvider>
  </StrictMode>,
);
