import React from "react";
import { useTranslation } from "react-i18next";
import { GameProvider, useGameActions } from "./contexts/GameContext";
import { useGameState } from "./hooks/useGameState";
import { useTelegram } from "./hooks/useTelegram";
import Lobby from "./components/Lobby";
import TrumpSelection from "./components/TrumpSelection";
import GameBoard from "./components/GameBoard";
import GameOver from "./components/GameOver";

function ConnectionGate({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const { connectionOk, phase } = useGameState();
  const { isReconnecting, authError } = useGameActions();

  // NOTE: authError (a failed /miniApp/init call) is intentionally non-blocking now —
  // it's shown as a small banner, not a full-screen wall. The WebSocket connects
  // independently of auth, so the game can still work even if auth is broken/misconfigured.
  const authBanner = authError ? (
    <div className="bg-team1/90 text-white text-xs text-center py-1.5 px-3">
      {t("errors.connection_failed")}
    </div>
  ) : null;

  if (!connectionOk && phase === "connecting") {
    return (
      <>
        {authBanner}
        <div className="flex flex-col items-center justify-center flex-1 gap-4">
          <div className="w-10 h-10 border-4 border-brass-500/30 border-t-brass-400 rounded-full animate-spin" />
          <p className="text-parchment/70 text-sm">
            {isReconnecting ? t("game.reconnecting") : t("game.connecting_desc")}
          </p>
          {isReconnecting && (
            <button
              onClick={() => window.location.reload()}
              className="rounded-lg bg-brass-500 text-felt-950 font-bold px-6 py-2.5 active:scale-95 transition-transform text-sm"
            >
              {t("buttons.retry")}
            </button>
          )}
        </div>
      </>
    );
  }

  return (
    <>
      {authBanner}
      {children}
    </>
  );
}

function Screens() {
  const phase = useGameState((s) => s.phase);

  switch (phase) {
    case "lobby":
      return <Lobby />;
    case "trump_selection":
      return <TrumpSelection />;
    case "playing":
      return <GameBoard />;
    case "game_over":
      return <GameOver />;
    default:
      return <Lobby />;
  }
}

function AppShell() {
  return (
    <div
      dir="rtl"
      className="flex flex-col min-h-screen bg-felt-900 bg-gradient-to-b from-felt-800 to-felt-950 shadow-felt text-parchment font-body overflow-hidden"
    >
      <ConnectionGate>
        <Screens />
      </ConnectionGate>
    </div>
  );
}

export default function App() {
  const { colorScheme } = useTelegram();

  return (
    <GameProvider>
      <div data-theme={colorScheme}>
        <AppShell />
      </div>
    </GameProvider>
  );
}
