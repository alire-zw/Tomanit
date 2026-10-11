/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_APP_URL?: string;
  readonly VITE_API_PROXY_TARGET?: string;
  readonly VITE_ALLOWED_HOSTS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface TelegramWebApp {
  ready: () => void;
  expand: () => void;
  close: () => void;
  openTelegramLink: (url: string) => void;
  openLink: (url: string) => void;
  disableVerticalSwipes?: () => void;
  enableVerticalSwipes?: () => void;
  enableClosingConfirmation?: () => void;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  setBottomBarColor?: (color: string) => void;
  onEvent?: (eventType: string, callback: () => void) => void;
  offEvent?: (eventType: string, callback: () => void) => void;
  initData?: string;
  initDataUnsafe?: {
    start_param?: string;
    user?: {
      id: number;
      first_name?: string;
      last_name?: string;
      username?: string;
      language_code?: string;
      is_premium?: boolean;
      photo_url?: string;
    };
  };
  HapticFeedback?: {
    impactOccurred: (style: "light" | "medium" | "heavy") => void;
  };
  BackButton?: {
    show: () => void;
    hide: () => void;
    onClick: (callback: () => void) => void;
    offClick: (callback: () => void) => void;
    isVisible?: boolean;
  };
  colorScheme?: "light" | "dark";
}

interface Window {
  __tomanitThemeReady?: boolean;
  __tomanitBootChrome?: () => boolean;
  Telegram?: { WebApp: TelegramWebApp };
}
