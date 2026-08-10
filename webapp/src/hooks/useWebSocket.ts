import { useCallback, useEffect, useRef, useState } from "react";
import type { IncomingMessage, OutgoingMessage } from "../types/game";

const WS_URL = "wss://miniapp-scafolding.leyli4209.workers.dev/ws";

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
      // Add a small delay to ensure the WebView is ready
      setTimeout(() => {
        const url = token ? `${WS_URL}?token=${encodeURIComponent(token)}` : WS_URL;
        console.log("🔌 Connecting to WebSocket:", url);

        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log("✅ WebSocket connected");
          setIsConnected(true);
          setIsReconnecting(false);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log("📩 Received:", data);
            onMessageRef.current(data);
          } catch (err) {
            console.error("❌ Failed to parse message:", err);
          }
        };

        ws.onclose = (event) => {
          console.log("❌ WebSocket disconnected", { code: event.code, reason: event.reason });
          setIsConnected(false);
          wsRef.current = null;
          // Reconnect after 3 seconds
          setTimeout(() => connect(), 3000);
        };

        ws.onerror = (error) => {
          console.error("❌ WebSocket error:", error);
          // Try to reconnect on error
          wsRef.current = null;
          setTimeout(() => connect(), 3000);
        };
      }, 100);
    } catch (error) {
      console.error("❌ Failed to create WebSocket:", error);
      setTimeout(() => connect(), 3000);
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
      // Try to reconnect if not open
      if (!isConnected) {
        connect();
      }
    }
  }, [isConnected, connect]);

  return { isConnected, isReconnecting, send };
}