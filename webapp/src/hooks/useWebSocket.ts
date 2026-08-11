import { useCallback, useEffect, useRef, useState } from "react";
import type { IncomingMessage, OutgoingMessage } from "../types/game";

const WS_URL = import.meta.env.VITE_WS_URL;

interface UseWebSocketOptions {
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
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const connect = useCallback(() => {
    try {
      const url = token ? `${WS_URL}?token=${encodeURIComponent(token)}` : WS_URL;
      console.log("🔌 [1/5] Attempting to connect to:", url);
      console.log("🔌 [2/5] Token provided:", !!token);

      const ws = new WebSocket(url);
      wsRef.current = ws;
      console.log("🔌 [3/5] WebSocket instance created");

      ws.onopen = () => {
        console.log("✅ [4/5] WebSocket OPEN - connection established!");
        setIsConnected(true);
        setIsReconnecting(false);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log("📩 [5/5] Message received:", data);
          onMessageRef.current(data);
        } catch (err) {
          console.error("❌ Failed to parse message:", err);
        }
      };

      ws.onclose = (event) => {
        console.log("❌ WebSocket CLOSED", { code: event.code, reason: event.reason, wasClean: event.wasClean });
        setIsConnected(false);
        wsRef.current = null;
        setTimeout(connect, 3000);
      };

      ws.onerror = (error) => {
        console.error("❌ WebSocket ERROR:", error);
        console.error("❌ Error details:", {
          type: error.type,
          target: error.target,
        });
        setTimeout(connect, 3000);
      };
    } catch (error) {
      console.error("❌ [EXCEPTION] Failed to create WebSocket:", error);
      setTimeout(connect, 3000);
    }
  }, [token]);

  useEffect(() => {
    connect();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  const send = useCallback((msg: OutgoingMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
      console.log("📤 Sent:", msg);
    } else {
      console.warn("⚠️ WebSocket not open, message not sent:", msg);
    }
  }, []);

  return { isConnected, isReconnecting, send };
}