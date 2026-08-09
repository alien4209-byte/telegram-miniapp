import { useEffect, useState } from "react";

// Minimal shape of the Telegram WebApp bridge we rely on.
// The full object is injected globally by https://telegram.org/js/telegram-web-app.js
// (loaded in index.html), which is the most reliable source of truth inside a
// Telegram Mini App regardless of which @telegram-apps/sdk-react version is installed.
interface TelegramWebApp {
  ready: () => void;
  expand: () => void;
  colorScheme: "light" | "dark";
  themeParams: Record<string, string>;
  initData: string;
  headerColor?: string;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  onEvent: (event: string, cb: () => void) => void;
  offEvent: (event: string, cb: () => void) => void;
}

declare global {
  interface Window {
    Telegram?: { WebApp: TelegramWebApp };
  }
}

/** Returns the raw Telegram WebApp bridge, or null when running outside Telegram (e.g. local dev). */
export function getTelegramWebApp(): TelegramWebApp | null {
  return typeof window !== "undefined" && window.Telegram?.WebApp ? window.Telegram.WebApp : null;
}

/**
 * Boots the Telegram Mini App (ready + expand + felt-green theming) and tracks the
 * active color scheme so the UI can adapt to Telegram's dark/light setting.
 */
export function useTelegram() {
  const [colorScheme, setColorScheme] = useState<"light" | "dark">("dark");
  const [initDataRaw, setInitDataRaw] = useState<string>("");

  useEffect(() => {
    const tg = getTelegramWebApp();
    if (!tg) return;

    try {
      tg.ready();
      tg.expand();
      tg.setHeaderColor?.("#0a2e22");
      tg.setBackgroundColor?.("#0a2e22");
      setColorScheme(tg.colorScheme ?? "dark");
      setInitDataRaw(tg.initData ?? "");

      const onThemeChange = () => setColorScheme(tg.colorScheme ?? "dark");
      tg.onEvent("themeChanged", onThemeChange);
      return () => tg.offEvent("themeChanged", onThemeChange);
    } catch {
      // Defensive: never let Telegram bridge quirks crash the app.
    }
  }, []);

  return { colorScheme, initDataRaw, isTelegram: !!getTelegramWebApp() };
}
