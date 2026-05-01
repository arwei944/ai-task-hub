// ============================================================
// Lifecycle MCP Tool Handlers
// ============================================================

import type { ILogger } from '@/lib/core/types';
import type { LifecycleService } from '@/lib/modules/lifecycle/lifecycle.service';

export function createLifecycleToolHandlers(service: LifecycleService, logger: ILogger) {
  return {
    request_phase_transition: async (args: Record<string, unknown>) => {
      const { projectId, targetPhase, reason, triggeredBy } = args as any;
      const result = await service.requestTransition({
        projectId,
        targetPhase,
        reason,
        triggeredBy,
      });
      return { ...result, success: true };
    },

    approve_phase_transition: async (args: Record<string, unknown>) => {
      const { transitionId } = args as any;
      const result = await service.approveTransition(transitionId);
      return { ...result, success: true };
    },

    reject_phase_transition: async (args: Record<string, unknown>) => {
      const { transitionId, reason } = args as any;
      const result = await service.rejectTransition(transitionId, reason);
      return { ...result, success: true };
    },

    get_phase_validation: async (args: Record<string, unknown>) => {
      const { projectId, targetPhase } = args as any;
      return service.getPhaseValidation(projectId, targetPhase);
    },

    get_transition_history: async (args: Record<string, unknown>) => {
      const { projectId } = args as any;
      return service.getTransitionHistory(projectId);
    },

    get_available_transitions: async (args: Record<string, unknown>) => {
      const { projectId } = args as any;
      return service.getAvailableTransitions(projectId);
    },
  };
}
