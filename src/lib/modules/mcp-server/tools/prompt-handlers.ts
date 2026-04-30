// ============================================================
// Agent Prompt Template Tool Handlers
// ============================================================
//
// Handlers for the prompt template MCP tools.
// Returns structured guidance for AI agents to follow when
// handling common work scenarios.
//

import type { ILogger } from '@/lib/core/types';
import {
  promptTemplates,
  getScenarioIds,
  getPromptTemplate,
  getScenarioDescriptions,
} from './prompt-templates';
import type { PromptTemplate, PromptTemplateStep } from './prompt-templates';

/**
 * Replace <projectId> placeholder in step params
 */
function replaceProjectId(steps: PromptTemplateStep[], projectId: string): PromptTemplateStep[] {
  return steps.map(step => {
    const params: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(step.params)) {
      if (typeof value === 'string' && value === '<projectId>') {
        params[key] = projectId;
      } else {
        params[key] = value;
      }
    }
    return { ...step, params };
  });
}

/**
 * Create handlers for prompt template tools
 */
export function createPromptToolHandlers(
  logger: ILogger,
  getProjectContext?: (projectId: string) => Promise<Record<string, unknown> | null>,
) {
  return {
    /**
     * Get a structured prompt template for a given scenario.
     * If projectId is provided, replace placeholders with the actual ID
     * and optionally enrich with project-specific context.
     */
    get_agent_prompt: async (args: Record<string, unknown>) => {
      const { scenario, projectId } = args as {
        scenario: string;
        projectId?: string;
      };

      logger.info(`MCP: get_agent_prompt called for scenario "${scenario}"`);

      // Handle list_scenarios as a special case
      if (scenario === 'list_scenarios') {
        const descriptions = getScenarioDescriptions();
        return {
          scenarios: descriptions,
          message: `共 ${descriptions.length} 个可用场景。使用 get_agent_prompt 并指定 scenario 参数获取详细指引。`,
        };
      }

      // Look up template
      const template = getPromptTemplate(scenario);
      if (!template) {
        const available = getScenarioIds();
        return {
          error: `未知场景: "${scenario}"`,
          availableScenarios: available,
          message: `可用场景: ${available.join(', ')}`,
        };
      }

      // Build response
      const result: Record<string, unknown> = {
        scenario: template.id,
        name: template.name,
        objective: template.objective,
        steps: projectId
          ? replaceProjectId(template.steps, projectId)
          : template.steps,
        tips: template.tips,
        outputFormat: template.outputFormat,
      };

      // Optionally enrich with project context if projectId is provided
      if (projectId && getProjectContext) {
        try {
          const context = await getProjectContext(projectId);
          if (context) {
            result.projectContext = {
              projectId,
              message: '以下为项目当前状态，可参考此数据填充模板中的占位符',
              ...context,
            };
          }
        } catch (error: any) {
          logger.warn(`Failed to enrich template with project context: ${error.message}`);
          result.projectContext = {
            projectId,
            error: '无法获取项目上下文，请手动填充模板中的占位符',
          };
        }
      }

      return result;
    },

    /**
     * List all available prompt template scenarios
     */
    list_available_scenarios: async () => {
      logger.info('MCP: list_available_scenarios called');

      const descriptions = getScenarioDescriptions();
      return {
        scenarios: descriptions,
        total: descriptions.length,
        message: `共 ${descriptions.length} 个可用场景模板。使用 get_agent_prompt 获取具体场景的详细指引。`,
      };
    },
  };
}
