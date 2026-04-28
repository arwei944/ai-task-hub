// ============================================================
// Event Bridge - EventBus → SSE Broadcast
// ============================================================
//
// Bridges domain events from EventBus to SSE real-time push.
// Maps event types to SSE channels for targeted delivery.
//

import type { IEventBus } from '@/lib/core/types';
import type { DomainEvent } from '@/lib/core/types';
import type { SSEService } from './sse.service';
import type { ILogger } from '@/lib/core/types';

/**
 * Event type → SSE channel mapping
 */
const EVENT_CHANNEL_MAP: Record<string, string> = {
  // Task events → tasks channel
  'task.created': 'tasks',
  'task.updated': 'tasks',
  'task.deleted': 'tasks',
  'task.status_changed': 'tasks',
  'task.priority_changed': 'tasks',
  'task.assigned': 'tasks',
  'task.completed': 'tasks',

  // Agent events → agents channel
  'agent.registered': 'agents',
  'agent.operation': 'agents',
  'agent.operation.completed': 'agents',

  // Notification events → notifications channel
  'notification.created': 'notifications',
  'notification.read': 'notifications',

  // Module events → modules channel
  'module.enabled': 'modules',
  'module.disabled': 'modules',
  'module.hot-reloaded': 'modules',
  'module.update-failed': 'modules',

  // Integration events → integrations channel
  'integration.synced': 'integrations',
  'integration.webhook.received': 'integrations',
};

/**
 * Bridge EventBus events to SSEService broadcasts
 */
export function createEventBridge(
  eventBus: IEventBus,
  sseService: SSEService,
  logger?: ILogger,
): () => void {
  const handler = async (event: DomainEvent) => {
    const channel = EVENT_CHANNEL_MAP[event.type] ?? 'global';

    sseService.broadcast(channel, {
      type: event.type,
      data: event.payload,
    });

    logger?.debug(`[EventBridge] ${event.type} → SSE channel: ${channel}`);
  };

  // Subscribe to all events using wildcard
  const unsubscribe = eventBus.on('*', handler);

  logger?.info('[EventBridge] EventBus → SSE bridge established');

  return unsubscribe;
}
