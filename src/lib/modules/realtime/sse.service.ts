// ============================================================
// SSE (Server-Sent Events) Service
// ============================================================
//
// Manages SSE client connections and broadcasts events.
// Supports channel-based subscriptions (e.g., "tasks", "notifications").
//

import type { ILogger } from '@/lib/core/types';

export interface SSEClient {
  id: string;
  userId?: string;
  channels: Set<string>;
  controller: ReadableStreamDefaultController;
  createdAt: Date;
}

export interface SSEEvent {
  type: string;       // e.g., "task.created", "task.status_changed", "notification.new"
  channel: string;    // e.g., "tasks", "notifications", "agents"
  data: unknown;
  timestamp: Date;
}

type EventCallback = (event: SSEEvent) => void;

export class SSEService {
  private clients: Map<string, SSEClient> = new Map();
  private eventListeners: Map<string, Set<EventCallback>> = new Map();
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  constructor(private logger?: ILogger) {
    // Start heartbeat to detect disconnected clients
    this.heartbeatInterval = setInterval(() => this.heartbeat(), 30000);
  }

  /**
   * Register a new SSE client
   */
  addClient(
    controller: ReadableStreamDefaultController,
    options?: { userId?: string; channels?: string[] },
  ): SSEClient {
    const clientId = crypto.randomUUID();
    const client: SSEClient = {
      id: clientId,
      userId: options?.userId,
      channels: new Set(options?.channels ?? ['global']),
      controller,
      createdAt: new Date(),
    };

    this.clients.set(clientId, client);
    this.logger?.info(`[SSE] Client connected: ${clientId} (channels: ${[...client.channels].join(', ')})`);

    // Send initial connection event
    this.sendToClient(client, {
      type: 'system.connected',
      channel: 'global',
      data: { clientId, channels: [...client.channels] },
      timestamp: new Date(),
    });

    return client;
  }

  /**
   * Remove a client (on disconnect)
   */
  removeClient(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      this.clients.delete(clientId);
      this.logger?.info(`[SSE] Client disconnected: ${clientId}`);
    }
  }

  /**
   * Subscribe a client to additional channels
   */
  subscribe(clientId: string, channels: string[]): void {
    const client = this.clients.get(clientId);
    if (client) {
      channels.forEach(ch => client.channels.add(ch));
      this.sendToClient(client, {
        type: 'system.subscribed',
        channel: 'global',
        data: { channels: [...client.channels] },
        timestamp: new Date(),
      });
    }
  }

  /**
   * Unsubscribe a client from channels
   */
  unsubscribe(clientId: string, channels: string[]): void {
    const client = this.clients.get(clientId);
    if (client) {
      channels.forEach(ch => client.channels.delete(ch));
    }
  }

  /**
   * Broadcast an event to all clients in a specific channel
   */
  broadcast(channel: string, event: Omit<SSEEvent, 'channel' | 'timestamp'>): void {
    const fullEvent: SSEEvent = {
      ...event,
      channel,
      timestamp: new Date(),
    };

    let sentCount = 0;
    for (const client of this.clients.values()) {
      if (client.channels.has(channel) || client.channels.has('global')) {
        this.sendToClient(client, fullEvent);
        sentCount++;
      }
    }

    // Also notify local event listeners
    this.notifyListeners(fullEvent);

    this.logger?.debug(`[SSE] Broadcast "${event.type}" to ${sentCount} clients (channel: ${channel})`);
  }

  /**
   * Send an event to a specific client
   */
  sendToClient(client: SSEClient, event: SSEEvent): void {
    try {
      const data = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
      const encoder = new TextEncoder();
      client.controller.enqueue(encoder.encode(data));
    } catch {
      // Client likely disconnected
      this.removeClient(client.id);
    }
  }

  /**
   * Register an event listener (for server-side processing)
   */
  on(eventType: string, callback: EventCallback): () => void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, new Set());
    }
    this.eventListeners.get(eventType)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.eventListeners.get(eventType)?.delete(callback);
    };
  }

  /**
   * Get connected client count
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Get all connected client IDs
   */
  getClientIds(): string[] {
    return [...this.clients.keys()];
  }

  /**
   * Send heartbeat to all clients
   */
  private heartbeat(): void {
    const encoder = new TextEncoder();
    const comment = encoder.encode(': heartbeat\n\n');

    for (const [clientId, client] of this.clients.entries()) {
      try {
        client.controller.enqueue(comment);
      } catch {
        this.removeClient(clientId);
      }
    }
  }

  /**
   * Notify local event listeners
   */
  private notifyListeners(event: SSEEvent): void {
    // Notify by exact event type
    const listeners = this.eventListeners.get(event.type);
    if (listeners) {
      for (const cb of listeners) {
        try { cb(event); } catch (e: any) {
          this.logger?.error(`[SSE] Event listener error: ${e.message}`);
        }
      }
    }

    // Notify by channel wildcard
    const channelListeners = this.eventListeners.get(`channel:${event.channel}`);
    if (channelListeners) {
      for (const cb of channelListeners) {
        try { cb(event); } catch (e: any) {
          this.logger?.error(`[SSE] Channel listener error: ${e.message}`);
        }
      }
    }

    // Notify global wildcard
    const globalListeners = this.eventListeners.get('*');
    if (globalListeners) {
      for (const cb of globalListeners) {
        try { cb(event); } catch (e: any) {
          this.logger?.error(`[SSE] Global listener error: ${e.message}`);
        }
      }
    }
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    for (const client of this.clients.values()) {
      try {
        client.controller.close();
      } catch { /* ignore */ }
    }
    this.clients.clear();
    this.eventListeners.clear();
  }
}

// Singleton instance
let _sseService: SSEService | null = null;

export function getSSEService(logger?: ILogger): SSEService {
  if (!_sseService) {
    _sseService = new SSEService(logger);
  }
  return _sseService;
}
