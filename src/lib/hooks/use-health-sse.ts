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
  onError?: (error: Error) => void;
}

interface UseHealthSSEReturn {
  isConnected: boolean;
  lastEvent: HealthSSEEvent | null;
  eventHistory: HealthSSEEvent[];
  reconnect: () => void;
}

// ---- Constants ----

const MAX_BACKOFF_MS = 30_000;
const MAX_EVENT_HISTORY = 200;

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

  // Refs to hold latest callbacks so the long-running connect() closure
  // always sees the freshest versions without needing to restart.
  const onEventRef = useRef(onEvent);
  const onErrorRef = useRef(onError);
  onEventRef.current = onEvent;
  onErrorRef.current = onError;

  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const abortControllerRef = useRef<AbortController | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backoffRef = useRef(reconnectInterval);

  const connect = useCallback(() => {
    // Clean up any previous connection
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    if (!enabledRef.current) return;

    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) {
      onErrorRef.current?.(new Error('No auth token found in localStorage'));
      // Schedule retry in case the token gets set later (e.g. after login)
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, backoffRef.current);
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    (async () => {
      try {
        const response = await fetch('/api/sse/health', {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'text/event-stream',
          },
          signal: controller.signal,
        });

        if (!response.ok) {
          if (response.status === 401) {
            onErrorRef.current?.(new Error('Authentication failed (401)'));
          } else {
            onErrorRef.current?.(new Error(`SSE connection failed: ${response.status}`));
          }
          setIsConnected(false);
          scheduleReconnect();
          return;
        }

        // Connection established
        setIsConnected(true);
        backoffRef.current = reconnectInterval; // Reset backoff on success

        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            // Parse SSE lines
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const event: HealthSSEEvent = JSON.parse(line.slice(6));
                  setLastEvent(event);
                  setEventHistory(prev => [...prev.slice(-(MAX_EVENT_HISTORY - 1)), event]);
                  onEventRef.current?.(event);
                } catch {
                  // Ignore parse errors for individual events
                }
              }
            }
          }
        } catch (readErr: unknown) {
          // If aborted, don't treat as error
          if (controller.signal.aborted) return;
          onErrorRef.current?.(readErr instanceof Error ? readErr : new Error(String(readErr)));
        }

        // Stream ended normally — reconnect
        setIsConnected(false);
        scheduleReconnect();
      } catch (err: unknown) {
        // Fetch-level error (network, abort, etc.)
        if (controller.signal.aborted) return;
        setIsConnected(false);
        onErrorRef.current?.(err instanceof Error ? err : new Error(String(err)));
        scheduleReconnect();
      }
    })();

    function scheduleReconnect() {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, backoffRef.current);
      // Exponential backoff
      backoffRef.current = Math.min(backoffRef.current * 1.5, MAX_BACKOFF_MS);
    }
  }, [reconnectInterval]);

  const reconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    // Reset backoff for manual reconnect
    backoffRef.current = reconnectInterval;
    setIsConnected(false);
    connect();
  }, [connect, reconnectInterval]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
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
