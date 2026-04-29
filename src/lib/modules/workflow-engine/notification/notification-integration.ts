import type { EventBus } from '@/lib/core/event-bus';
import type { DomainEvent } from '@/lib/core/types';
import type { Logger } from '@/lib/core/logger';
import { getSSEService } from '@/lib/modules/realtime/sse.service';

interface SSEMapping { channel: string; event: string; }

const WORKFLOW_EVENT_SSE_MAP: Record<string, SSEMapping> = {
  'workflow.step.completed': { channel: 'workflows', event: 'step.completed' },
  'workflow.step.failed': { channel: 'workflows', event: 'step.failed' },
  'workflow.execution.completed': { channel: 'workflows', event: 'execution.completed' },
  'workflow.execution.failed': { channel: 'workflows', event: 'execution.failed' },
  'workflow.execution.cancelled': { channel: 'workflows', event: 'execution.cancelled' },
  'workflow.feedback.checkpoint.created': { channel: 'feedback', event: 'checkpoint.created' },
  'workflow.feedback.checkpoint.resolved': { channel: 'feedback', event: 'checkpoint.resolved' },
};

export class WorkflowNotificationIntegration {
  private unsubscribers: Array<() => void> = [];
  constructor(private eventBus?: EventBus, private logger?: Logger) {}

  setupEventListeners(): void {
    if (!this.eventBus) { this.logger?.warn('[WorkflowNotificationIntegration] No EventBus provided'); return; }
    for (const [eventType, mapping] of Object.entries(WORKFLOW_EVENT_SSE_MAP)) {
      const unsubscribe = this.eventBus.on(eventType, (event: DomainEvent) => {
        try { const sseService = getSSEService(); sseService.broadcast(mapping.channel, { type: mapping.event, data: event.payload }); } catch (error) { this.logger?.error(`Failed to broadcast ${eventType}`, { error: error instanceof Error ? error.message : String(error) }); }
      });
      this.unsubscribers.push(unsubscribe);
    }
    this.logger?.info(`[WorkflowNotificationIntegration] Listening to ${Object.keys(WORKFLOW_EVENT_SSE_MAP).length} event types`);
  }

  shutdown(): void { for (const unsubscribe of this.unsubscribers) { try { unsubscribe(); } catch {} } this.unsubscribers = []; this.logger?.info('[WorkflowNotificationIntegration] Shutdown complete'); }
}