import type { ILogger } from '@/lib/core/types';
import type { TriggerDispatcher } from '@/lib/modules/workflow-engine/triggers/trigger-dispatcher';

/**
 * Create MCP tool handlers for GitHub Issue trigger operations
 * @param getDispatcher - Factory function returning the TriggerDispatcher instance
 * @param logger - Logger instance
 * @returns Record of tool name to handler function
 */
export function createGitHubTriggerToolHandlers(
  getDispatcher: () => TriggerDispatcher | null,
  logger: ILogger,
) {
  return {
    /**
     * Manually trigger a workflow with GitHub issue data
     */
    github_trigger_workflow: async (args: Record<string, unknown>) => {
      const dispatcher = getDispatcher();
      if (!dispatcher) {
        return { success: false, error: 'Trigger dispatcher not available' };
      }

      const {
        workflowId,
        action,
        issueTitle,
        issueBody,
        issueNumber,
        issueState,
        issueLabels,
        repository,
        issueUrl,
        author,
      } = args as {
        workflowId: string;
        action?: string;
        issueTitle?: string;
        issueBody?: string;
        issueNumber?: number;
        issueState?: string;
        issueLabels?: string[];
        repository?: string;
        issueUrl?: string;
        author?: string;
      };

      try {
        const payload = {
          action: action ?? 'opened',
          issue: {
            title: issueTitle ?? '',
            body: issueBody ?? '',
            number: issueNumber ?? 0,
            state: issueState ?? 'open',
            labels: (issueLabels ?? []).map(name => ({ name })),
            html_url: issueUrl ?? '',
            user: { login: author ?? '' },
          },
          repository: repository
            ? { full_name: repository, name: repository.split('/').pop() ?? repository }
            : undefined,
        };

        const result = await dispatcher.githubIssueTrigger(workflowId, payload);
        return { success: true, ...result };
      } catch (error: any) {
        logger.error('github_trigger_workflow failed', { error: String(error) });
        return { success: false, error: error.message };
      }
    },

    /**
     * Get GitHub trigger statistics
     */
    github_get_trigger_stats: async () => {
      const dispatcher = getDispatcher();
      if (!dispatcher) {
        return { success: false, error: 'Trigger dispatcher not available' };
      }

      try {
        const stats = dispatcher.getGitHubTriggerStats();
        return { success: true, stats };
      } catch (error: any) {
        logger.error('github_get_trigger_stats failed', { error: String(error) });
        return { success: false, error: error.message };
      }
    },
  };
}
