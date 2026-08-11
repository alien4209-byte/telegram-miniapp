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

  // Always points at the latest token so a delayed reconnect never uses a stale value.
  const tokenRef = useRef(token);
  tokenRef.current = token;

  // When true, the *next* close event for the current socket was triggered by us
  // (effect cleanup / intentional teardown) and must NOT trigger a reconnect.
  const intentionalCloseRef = useRef(false);

  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    try {
      const currentToken = tokenRef.current;
      const url = currentToken ? `${WS_URL}?token=${encodeURIComponent(currentToken)}` : WS_URL;
      console.log("🔌 Connecting to:", url, "token:", !!currentToken);

      const ws = new WebSocket(url);
      wsRef.current = ws;
      intentionalCloseRef.current = false;

      ws.onopen = () => {
        console.log("✅ WebSocket OPEN");
        setIsConnected(true);
        setIsReconnecting(false);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          onMessageRef.current(data);
        } catch (err) {
          console.error("❌ Failed to parse message:", err);
        }
      };

      ws.onclose = (event) => {
        console.log("❌ WebSocket CLOSED", { code: event.code, reason: event.reason });
        setIsConnected(false);

        // Only this socket's own scheduled reconnect should run, and only if the
        // close wasn't something we asked for (cleanup / token swap).
        if (wsRef.current === ws) {
          wsRef.current = null;
        }
        if (intentionalCloseRef.current) {
          intentionalCloseRef.current = false;
          return;
        }
        setIsReconnecting(true);
        reconnectTimerRef.current = setTimeout(connect, 3000);
      };

      ws.onerror = (error) => {
        console.error("❌ WebSocket ERROR:", error);
        // Don't schedule a reconnect here — the browser will always follow this
        // with a close event, and that handler is solely responsible for retrying.
      };
    } catch (error) {
      console.error("❌ [EXCEPTION] Failed to create WebSocket:", error);
      reconnectTimerRef.current = setTimeout(connect, 3000);
    }
  }, []); // stable identity — never recreated, so effect below never tears down on token change

  // Reconnect deliberately when the token changes post-mount (e.g. anonymous -> authed),
  // but do it via one explicit path, not by changing effect deps.
  const prevTokenRef = useRef(token);
  useEffect(() => {
    if (prevTokenRef.current === token) return;
    prevTokenRef.current = token;
    if (wsRef.current) {
      intentionalCloseRef.current = true;
      wsRef.current.close();
    }
    connect();
  }, [token, connect]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (wsRef.current) {
        intentionalCloseRef.current = true;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // mount once; token changes are handled by the effect above

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