import type { ILogger } from '@/lib/core/types';
import type { IEventBus } from '@/lib/core/types';
import type { AIOrchestrator } from '@/lib/modules/ai-engine/ai-orchestrator';

/** Recent AI suggestions store */
interface AISuggestion {
  type: string;
  eventType: string;
  payload: Record<string, unknown>;
  timestamp: Date;
}

/**
 * Create tool handlers for AI handler management tools.
 */
export function createAIHandlerToolHandlers(
  orchestratorFn: () => AIOrchestrator | null,
  eventBus: IEventBus,
  logger: ILogger,
) {
  // In-memory suggestion store
  const recentSuggestions: AISuggestion[] = [];
  const handlerStats: Record<string, { count: number; lastExecuted?: Date; errors: number }> = {};

  // Track handler execution via event bus
  const trackedEvents = [
    'task.complexity.analyzed',
    'requirement.complexity.analyzed',
    'deployment.risk.detected',
    'deployment.rollback.advice',
    'deployment.pattern.anomaly',
    'workflow.efficiency.report',
    'knowledge.insight.generated',
    'project.health.updated',
    'ai.suggestion',
  ];

  for (const eventType of trackedEvents) {
    eventBus.on(eventType, (event) => {
      const payload = event.payload as Record<string, unknown>;
      recentSuggestions.push({
        type: eventType,
        eventType: event.type,
        payload,
        timestamp: new Date(event.timestamp),
      });

      // Keep only last 100 suggestions
      if (recentSuggestions.length > 100) {
        recentSuggestions.shift();
      }

      // Update stats
      if (!handlerStats[eventType]) {
        handlerStats[eventType] = { count: 0, errors: 0 };
      }
      handlerStats[eventType].count++;
      handlerStats[eventType].lastExecuted = new Date(event.timestamp);
    });
  }

  return {
    ai_list_handlers: async () => {
      const orchestrator = orchestratorFn();
      if (!orchestrator) {
        return {
          success: false,
          error: 'AI Orchestrator not initialized',
        };
      }

      const handlers = orchestrator.getRegisteredHandlers();
      return {
        success: true,
        handlers,
        count: handlers.length,
      };
    },

    ai_trigger_analysis: async (args: Record<string, unknown>) => {
      const { eventType, payload } = args as {
        eventType: string;
        payload: Record<string, unknown>;
      };

      try {
        const event = {
          type: eventType,
          payload,
          timestamp: new Date(),
          source: 'mcp-manual-trigger',
        };

        eventBus.emit(event);

        return {
          success: true,
          message: `Event "${eventType}" triggered for AI analysis`,
          eventType,
          timestamp: new Date(),
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
        };
      }
    },

    ai_get_suggestions: async (args: Record<string, unknown>) => {
      const limit = (args.limit as number) ?? 10;
      const type = args.type as string | undefined;

      let filtered = [...recentSuggestions];

      if (type) {
        filtered = filtered.filter(s => s.type === type || s.eventType.includes(type));
      }

      // Return most recent first
      const results = filtered
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, limit)
        .map(s => ({
          type: s.type,
          payload: s.payload,
          timestamp: s.timestamp.toISOString(),
        }));

      return {
        success: true,
        suggestions: results,
        count: results.length,
        total: recentSuggestions.length,
      };
    },

    ai_handler_stats: async () => {
      const orchestrator = orchestratorFn();
      const handlers = orchestrator?.getRegisteredHandlers() ?? [];

      return {
        success: true,
        registeredHandlers: handlers,
        executionStats: handlerStats,
        totalSuggestions: recentSuggestions.length,
      };
    },
  };
}
