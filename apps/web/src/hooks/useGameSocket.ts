"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AnswerPayload, GameSnapshot } from "@/lib/types";
import { loadReconnectToken, wsUrl } from "@/lib/api";

export type WsEventType =
  | "snapshot"
  | "lobby_update"
  | "countdown"
  | "question"
  | "answer_progress"
  | "answer_locked"
  | "answer_ack"
  | "question_reveal"
  | "leaderboard"
  | "finished"
  | "error"
  | "pong";

export interface WsMessage {
  type: WsEventType;
  payload: Record<string, unknown>;
}

interface UseGameSocketOptions {
  gameId: string;
  role: "host" | "player";
  enabled?: boolean;
  onEvent?: (msg: WsMessage) => void;
}

export function useGameSocket({
  gameId,
  role,
  enabled = true,
  onEvent,
}: UseGameSocketOptions) {
  const [connected, setConnected] = useState(false);
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);
  const [lastEvent, setLastEvent] = useState<WsMessage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const handleMessage = useCallback((msg: WsMessage) => {
    if (msg.type === "snapshot") {
      setSnapshot(msg.payload as unknown as GameSnapshot);
    }
    if (msg.type === "error") {
      const detail = (msg.payload.detail as string) ?? "WebSocket error";
      setError(detail);
    }
    setLastEvent(msg);
    onEventRef.current?.(msg);
  }, []);

  const send = useCallback((type: string, payload: Record<string, unknown> = {}) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type, payload }));
    }
  }, []);

  const sendAnswer = useCallback(
    (payload: AnswerPayload) => send("answer", payload as Record<string, unknown>),
    [send],
  );

  const hostStart = useCallback(() => send("start"), [send]);
  const hostShowLeaderboard = useCallback(() => send("show_leaderboard"), [send]);
  const hostNext = useCallback(() => send("next"), [send]);

  useEffect(() => {
    if (!enabled || !gameId) return;

    let cancelled = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (cancelled) return;
      const url = wsUrl(gameId);
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (role === "host") {
          ws.send(JSON.stringify({ type: "host_hello", payload: {} }));
        } else {
          const token = loadReconnectToken(gameId);
          if (!token) {
            setError("Missing reconnect token");
            ws.close();
            return;
          }
          ws.send(
            JSON.stringify({
              type: "player_hello",
              payload: { reconnect_token: token },
            }),
          );
        }
      };

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data as string) as WsMessage;
          handleMessage(msg);
          if (msg.type === "snapshot") setConnected(true);
        } catch {
          setError("Invalid message from server");
        }
      };

      ws.onerror = () => {
        if (!cancelled) setError("Connection error");
      };

      ws.onclose = () => {
        setConnected(false);
        if (!cancelled) {
          reconnectTimer = setTimeout(connect, 2000);
        }
      };
    };

    connect();

    const ping = setInterval(() => send("ping"), 25000);

    return () => {
      cancelled = true;
      clearInterval(ping);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [enabled, gameId, role, handleMessage, send]);

  return {
    connected,
    snapshot,
    lastEvent,
    error,
    send,
    sendAnswer,
    hostStart,
    hostShowLeaderboard,
    hostNext,
  };
}
