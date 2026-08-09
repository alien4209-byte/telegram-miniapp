import { useCallback, useEffect, useRef, useState } from "react";
import type { IncomingMessage, OutgoingMessage } from "../types/game";

// Fallback keeps the app usable even if the Pages env var didn't get set correctly.
const WS_URL = (import.meta.env.VITE_WS_URL as string) || "wss://miniapp-scafolding.bdv94gs62z.workers.dev/ws";
const MAX_RECONNECT_DELAY_MS = 8000;

interface UseWebSocketOptions {
  // token is OPTIONAL: we connect immediately regardless, and attach the token
  // as a query param once/if it becomes available (e.g. after /miniApp/init resolves).
  // This means a slow or failing auth call can never block the socket from opening,
  // which was the previous bug — the UI would hang forever on "Connecting..." if
  // fetchAuthToken() never resolved.
  token: string | null;
  onMessage: (msg: IncomingMessage) => void;
}

interface UseWebSocketReturn {
  isConnected: boolean;
  isReconnecting: boolean;
  send: (msg: OutgoingMessage) => void;
}

export function useWebSocket({ token, onMessage }: UseWebSocketOptions): UseWebSocketReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const attemptRef = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;
  const tokenRef = useRef(token);
  tokenRef.current = token;

  const connect = useCallback(() => {
    const url = tokenRef.current ? `${WS_URL}?token=${encodeURIComponent(tokenRef.current)}` : WS_URL;

    console.log("🔌 Connecting to WebSocket:", url);
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("✅ WebSocket connected");
      attemptRef.current = 0;
      setIsConnected(true);
      setIsReconnecting(false);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as IncomingMessage;
        console.log("📩 Received:", data);
        onMessageRef.current(data);
      } catch (err) {
        console.error("❌ Failed to parse WebSocket message:", event.data, err);
      }
    };

    ws.onclose = (event) => {
      console.log("❌ WebSocket disconnected", { code: event.code, reason: event.reason });
      setIsConnected(false);
      wsRef.current = null;

      const delay = Math.min(1000 * 2 ** attemptRef.current, MAX_RECONNECT_DELAY_MS);
      attemptRef.current += 1;
      setIsReconnecting(true);
      reconnectTimeoutRef.current = setTimeout(connect, delay);
    };

    ws.onerror = (error) => {
      console.error("❌ WebSocket error:", error);
    };
  }, []);

  // Connect once on mount — do NOT wait for a token.
  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If the token arrives/changes after the socket already opened, reconnect once
  // so the new connection is sent with it (covers auth flows where the socket is
  // allowed to connect anonymously first, then needs to authenticate).
  const hadTokenRef = useRef(false);
  useEffect(() => {
    if (token && !hadTokenRef.current) {
      hadTokenRef.current = true;
      if (wsRef.current) {
        console.log("🔑 Token became available, reconnecting to authenticate...");
        wsRef.current.close();
        connect();
      }
    }
  }, [token, connect]);

  const send = useCallback((msg: OutgoingMessage) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
      console.log("📤 Sent:", msg);
    } else {
      console.warn("⚠️ WebSocket not open, message not sent:", msg);
    }
  }, []);

  return { isConnected, isReconnecting, send };
}
