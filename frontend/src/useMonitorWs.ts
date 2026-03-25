import { useCallback, useEffect, useRef, useState } from 'react';
import type { ClientInfo, WsMessage } from './types';

/**
 * Monitor 대시보드 WebSocket 훅.
 * /ws/dashboard에 연결하여 클라이언트 상태를 실시간 수신.
 */
export function useMonitorWs() {
  const [clients, setClients] = useState<Map<string, ClientInfo>>(new Map());
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/dashboard`);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };

    ws.onclose = () => {
      setConnected(false);
      wsRef.current = null;
      reconnectTimer.current = setTimeout(connect, 3000);
    };

    ws.onerror = () => {
      ws.close();
    };

    ws.onmessage = (ev) => {
      try {
        const msg: WsMessage = JSON.parse(ev.data);
        handleMessage(msg);
      } catch { /* ignore */ }
    };
  }, []);

  const handleMessage = useCallback((msg: WsMessage) => {
    switch (msg.type) {
      case 'initial_state':
        setClients(prev => {
          const next = new Map(prev);
          for (const c of (msg.clients || [])) {
            next.set(c.client_id, c as ClientInfo);
          }
          return next;
        });
        break;

      case 'client_connected':
        setClients(prev => {
          const next = new Map(prev);
          next.set(msg.client.client_id, msg.client as ClientInfo);
          return next;
        });
        break;

      case 'client_disconnected':
        setClients(prev => {
          const next = new Map(prev);
          next.delete(msg.client_id);
          return next;
        });
        break;

      case 'status_update':
        setClients(prev => {
          const next = new Map(prev);
          const existing = next.get(msg.client_id);
          if (existing) {
            next.set(msg.client_id, { ...existing, ...msg.status });
          }
          return next;
        });
        break;
    }
  }, []);

  const sendCommand = useCallback((
    targetClientId: string,
    action: string,
    options: Record<string, any> = {},
  ) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'command',
        target_client_id: targetClientId,
        action,
        ...options,
      }));
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return {
    clients: Array.from(clients.values()),
    connected,
    sendCommand,
  };
}
