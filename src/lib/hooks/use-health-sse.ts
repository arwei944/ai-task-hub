'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

// ---- Types ----

export interface HealthSSEEvent {
  type: 'health.check' | 'health.degraded' | 'health.recovered' | 'circuit.state_change' | 'health.initial' | 'system.connected';
  channel: 'health';
  data: {
    capabilityId?: string;
    report?: {
      status: string;
      details?: string;
      metrics?: Record<string, unknown>;
      checkedAt: number;
      latencyMs?: number;
    };
    circuitState?: string;
    health?: Record<string, unknown>;
    circuits?: Record<string, unknown>;
    dlq?: Record<string, unknown>;
  };
  timestamp: number;
}

interface UseHealthSSEOptions {
  enabled?: boolean;
  reconnectInterval?: number;
  onEvent?: (event: HealthSSEEvent) => void;
  onError?: (error: Event) => void;
}

interface UseHealthSSEReturn {
  isConnected: boolean;
  lastEvent: HealthSSEEvent | null;
  eventHistory: HealthSSEEvent[];
  reconnect: () => void;
}

// ---- Hook ----

export function useHealthSSE(options: UseHealthSSEOptions = {}): UseHealthSSEReturn {
  const {
    enabled = true,
    reconnectInterval = 3000,
    onEvent,
    onError,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<HealthSSEEvent | null>(null);
  const [eventHistory, setEventHistory] = useState<HealthSSEEvent[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    if (!enabled) return;

    const url = '/api/sse/health';
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
    };

    eventSource.onerror = (error) => {
      setIsConnected(false);
      onError?.(error);

      if (reconnectInterval > 0) {
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, reconnectInterval);
      }
    };

    eventSource.onmessage = (e) => {
      try {
        const event: HealthSSEEvent = JSON.parse(e.data);
        setLastEvent(event);
        setEventHistory(prev => [...prev.slice(-199), event]); // Keep last 200
        onEvent?.(event);
      } catch {
        // Ignore parse errors
      }
    };
  }, [enabled, reconnectInterval, onEvent, onError]);

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
    eventHistory,
    reconnect,
  };
}
