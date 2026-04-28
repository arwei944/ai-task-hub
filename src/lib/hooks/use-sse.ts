'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

export interface SSEMessage {
  type: string;
  channel: string;
  data: unknown;
  timestamp: string;
}

interface UseSSEOptions {
  channels?: string[];
  onEvent?: (event: SSEMessage) => void;
  onError?: (error: Event) => void;
  reconnectInterval?: number;
  enabled?: boolean;
}

interface UseSSEReturn {
  isConnected: boolean;
  lastEvent: SSEMessage | null;
  reconnect: () => void;
  eventHistory: SSEMessage[];
}

export function useSSE(options: UseSSEOptions = {}): UseSSEReturn {
  const {
    channels = ['global'],
    onEvent,
    onError,
    reconnectInterval = 3000,
    enabled = true,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<SSEMessage | null>(null);
  const [eventHistory, setEventHistory] = useState<SSEMessage[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    if (!enabled) return;

    const channelsParam = channels.join(',');
    const url = `/api/sse?channels=${encodeURIComponent(channelsParam)}`;

    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
    };

    eventSource.onerror = (error) => {
      setIsConnected(false);
      onError?.(error);

      // Auto reconnect
      if (reconnectInterval > 0) {
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, reconnectInterval);
      }
    };

    // Listen for all event types
    eventSource.addEventListener('system.connected', (e) => {
      const data = JSON.parse((e as MessageEvent).data);
      // Subscribe succeeded
    });

    // Generic message handler for all custom events
    eventSource.onmessage = (e) => {
      try {
        const event: SSEMessage = JSON.parse(e.data);
        setLastEvent(event);
        setEventHistory(prev => [...prev.slice(-99), event]); // Keep last 100
        onEvent?.(event);
      } catch {
        // Ignore parse errors
      }
    };

    // Listen for specific task/agent/notification events
    const eventTypes = [
      'task.created', 'task.updated', 'task.deleted', 'task.status_changed',
      'agent.registered', 'agent.operation',
      'notification.created',
      'module.enabled', 'module.disabled', 'module.hot-reloaded',
    ];

    for (const eventType of eventTypes) {
      eventSource.addEventListener(eventType, (e) => {
        try {
          const event: SSEMessage = JSON.parse((e as MessageEvent).data);
          setLastEvent(event);
          setEventHistory(prev => [...prev.slice(-99), event]);
          onEvent?.(event);
        } catch {
          // Ignore parse errors
        }
      });
    }
  }, [channels.join(','), enabled, reconnectInterval, onEvent, onError]);

  const reconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    setIsConnected(false);
    connect();
  }, [connect]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [connect]);

  return {
    isConnected,
    lastEvent,
    reconnect,
    eventHistory,
  };
}
