'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ClientMessage, ServerMessage } from '@/types/game';

type ServerMessageType = ServerMessage['type'];
type PayloadOf<T extends ServerMessageType> = Extract<ServerMessage, { type: T }>['payload'];
type Handlers = Partial<{ [K in ServerMessageType]: (payload: PayloadOf<K>) => void }>;

const MAX_RECONNECT_DELAY_MS = 10000;
const HEARTBEAT_MS = 15000;

// roomId/playerId가 정해지면 /ws/:roomId 에 네이티브 WebSocket으로 연결하고,
// 연결되자마자 hello로 소켓을 플레이어에 바인딩한다. 연결이 끊기면 지수 백오프로 재연결.
export function useGameSocket(roomId: string | null, playerId: string | null, handlers: Handlers) {
  const wsRef = useRef<WebSocket | null>(null);
  const handlersRef = useRef(handlers);
  const [connected, setConnected] = useState(false);

  // 재연결 시 재구독할 필요 없이 항상 최신 핸들러를 참조하도록 유지 (렌더 중이 아니라 effect에서 갱신).
  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    if (!roomId || !playerId) return;
    const activeRoomId = roomId;
    const activePlayerId = playerId;

    let closedByUs = false;
    let reconnectAttempt = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

    function connect() {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws/${activeRoomId}`);
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectAttempt = 0;
        setConnected(true);
        ws.send(JSON.stringify({ type: 'hello', playerId: activePlayerId } satisfies ClientMessage));
        // 서버가 라운드 전환 타이머를 놓쳤을 때를 대비한 주기적 신호(자연 치유) + 연결 유지.
        heartbeatTimer = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' } satisfies ClientMessage));
        }, HEARTBEAT_MS);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as ServerMessage;
          const handler = handlersRef.current[msg.type] as ((payload: unknown) => void) | undefined;
          handler?.(msg.payload);
        } catch {
          // 잘못된 메시지는 무시
        }
      };

      ws.onclose = () => {
        setConnected(false);
        if (heartbeatTimer) clearInterval(heartbeatTimer);
        if (closedByUs) return;
        const delay = Math.min(1000 * 2 ** reconnectAttempt, MAX_RECONNECT_DELAY_MS);
        reconnectAttempt += 1;
        reconnectTimer = setTimeout(connect, delay);
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect();

    return () => {
      closedByUs = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      wsRef.current?.close();
    };
  }, [roomId, playerId]);

  const sendMessage = useCallback((msg: ClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  return { sendMessage, connected };
}
