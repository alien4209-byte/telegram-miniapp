import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { useGameState } from "../hooks/useGameState";
import { useWebSocket } from "../hooks/useWebSocket";
import { getTelegramWebApp } from "../hooks/useTelegram";
import type { Suit, CardCode } from "../types/game";

const API_URL = (import.meta.env.VITE_API_URL as string) || "https://miniapp-scafolding.leyli4209.workers.dev";

interface GameActions {
  isConnected: boolean;
  isReconnecting: boolean;
  authError: string | null;
  joinGame: (playerName: string) => void;
  setTrump: (suit: Suit) => void;
  playCard: (card: CardCode) => void;
}

const GameActionsContext = createContext<GameActions | null>(null);

/** Fetches an auth token from /miniApp/init using Telegram's initData. */
async function fetchAuthToken(): Promise<string> {
  const initData = getTelegramWebApp()?.initData ?? "";
  console.log("🔐 Fetching auth token from", `${API_URL}/miniApp/init`, { hasInitData: !!initData });

  const res = await fetch(`${API_URL}/miniApp/init`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ initData }),
  });

  if (!res.ok) {
    throw new Error(`Auth failed with status ${res.status}`);
  }

  const data = (await res.json()) as { token?: string };
  if (!data.token) {
    throw new Error("Auth response missing token");
  }
  console.log("🔐 Auth token received");
  return data.token;
}

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const attemptedRef = useRef(false);

  const handleIncoming = useGameState((s) => s.handleIncoming);
  const setConnectionOk = useGameState((s) => s.setConnectionOk);

  useEffect(() => {
    if (attemptedRef.current) return;
    attemptedRef.current = true;

    fetchAuthToken()
      .then(setToken)
      .catch((err: Error) => {
        console.error("🔐 Auth failed — continuing with an unauthenticated WebSocket connection:", err.message);
        setAuthError(err.message);
      });
  }, []);

  const { isConnected, isReconnecting, send } = useWebSocket({
    token,
    onMessage: handleIncoming,
  });

  useEffect(() => {
    setConnectionOk(isConnected);
  }, [isConnected, setConnectionOk]);

  const setSelfName = useGameState((s) => s.setSelfName);
  const selfName = useGameState((s) => s.selfName);

  const hasAttemptedJoinRef = useRef(false);
  useEffect(() => {
    if (isConnected && hasAttemptedJoinRef.current && selfName) {
      console.log("🔁 (Re)connected — re-sending join for", selfName);
      send({ type: "join", playerName: selfName });
    }
  }, [isConnected, selfName, send]);

  const actions: GameActions = {
    isConnected,
    isReconnecting,
    authError,
    joinGame: (playerName: string) => {
      hasAttemptedJoinRef.current = true;
      setSelfName(playerName);
      send({ type: "join", playerName });
    },
    setTrump: (suit: Suit) => {
      send({ type: "set_trump", suit });
    },
    playCard: (card: CardCode) => {
      send({ type: "play_card", card });
    },
  };

  return <GameActionsContext.Provider value={actions}>{children}</GameActionsContext.Provider>;
}

export function useGameActions(): GameActions {
  const ctx = useContext(GameActionsContext);
  if (!ctx) throw new Error("useGameActions must be used within GameProvider");
  return ctx;
}
