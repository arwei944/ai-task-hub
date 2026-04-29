import type { EventBus } from '@/lib/core/event-bus';
import type { DomainEvent } from '@/lib/core/types';
import type { Logger } from '@/lib/core/logger';
import { getSSEService } from '@/lib/modules/realtime/sse.service';

/**
 * EventBus event type → SSE channel/event mapping
 */
interface SSEMapping {
  channel: string;
  event: string;
}

const WORKFLOW_EVENT_SSE_MAP: Record<string, SSEMapping> = {
  'workflow.step.completed': { channel: 'workflows', event: 'step.completed' },
  'workflow.step.failed': { channel: 'workflows', event: 'step.failed' },
  'workflow.execution.completed': { channel: 'workflows', event: 'execution.completed' },
  'workflow.execution.failed': { channel: 'workflows', event: 'execution.failed' },
  'workflow.execution.cancelled': { channel: 'workflows', event: 'execution.cancelled' },
  'workflow.feedback.checkpoint.created': { channel: 'feedback', event: 'checkpoint.created' },
  'workflow.feedback.checkpoint.resolved': { channel: 'feedback', event: 'checkpoint.resolved' },
};

/**
 * Workflow Notification Integration
 *
 * Subscribes to EventBus workflow events and converts them to SSE notifications
 * for real-time delivery to connected clients.
 */
export class WorkflowNotificationIntegration {
  private unsubscribers: Array<() => void> = [];

  constructor(
    private eventBus?: EventBus,
    private logger?: Logger,
  ) {}

  /**
   * Subscribe to EventBus workflow events and convert them to SSE notifications
   */
  setupEventListeners(): void {
    if (!this.eventBus) {
      this.logger?.warn('[WorkflowNotificationIntegration] No EventBus provided, skipping setup');
      return;
    }

    for (const [eventType, mapping] of Object.entries(WORKFLOW_EVENT_SSE_MAP)) {
      const unsubscribe = this.eventBus.on(eventType, (event: DomainEvent) => {
        try {
          const sseService = getSSEService();
          sseService.broadcast(mapping.channel, {
            type: mapping.event,
            data: event.payload,
          });

          this.logger?.debug(
            `[WorkflowNotificationIntegration] ${eventType} → SSE ${mapping.channel}:${mapping.event}`,
          );
        } catch (error) {
          this.logger?.error(
            `[WorkflowNotificationIntegration] Failed to broadcast ${eventType}`,
            { error: error instanceof Error ? error.message : String(error) },
          );
        }
      });

      this.unsubscribers.push(unsubscribe);
    }

    this.logger?.info(
      `[WorkflowNotificationIntegration] Listening to ${Object.keys(WORKFLOW_EVENT_SSE_MAP).length} workflow event types`,
    );
  }

  /**
   * Cleanup all event listeners
   */
  shutdown(): void {
    for (const unsubscribe of this.unsubscribers) {
      try {
        unsubscribe();
      } catch {
        // Ignore cleanup errors
      }
    }
    this.unsubscribers = [];
    this.logger?.info('[WorkflowNotificationIntegration] Shutdown complete');
  }
}