import type { ILogger } from '@/lib/core/types';
import type { ExecutionStateManager } from '@/lib/modules/workflow-engine/execution-state';
import { StepRegistry } from '@/lib/modules/workflow-engine/steps/index';
import { getPrisma } from '@/lib/db';

export function createWorkflowV3ToolHandlers(stateManager: ExecutionStateManager, logger: ILogger) {
  return {
    list_workflow_step_types: async () => {
      const types = StepRegistry.getRegisteredTypes();
      const descriptions: Record<string, string> = {
        'create-task': '创建新任务',
        'update-status': '更新任务状态',
        'ai-analyze': 'AI 分析（通过 SOLO Bridge）',
        'send-notification': '发送通知（SSE 广播）',
        'wait': '延迟等待',
        'parallel-group': '并行执行子步骤',
        'condition': '条件分支',
        'foreach': '数组遍历 + 子步骤',
        'invoke-agent': '调用 SOLO 智能体',
        'http-request': 'HTTP 请求',
        'transform': '数据转换 (map/filter/reduce/pick/omit/merge/template)',
        'approval': '人工审批',
        'sub-workflow': '[v3] 调用另一个工作流',
        'dynamic-step': '[v3] 运行时动态添加步骤',
      };

      return {
        success: true,
        types: types.map(t => ({ type: t, description: descriptions[t] || 'No description' })),
        count: types.length,
      };
    },

    get_workflow_execution_status: async (args: Record<string, unknown>) => {
      const { executionId } = args as any;
      const prisma = getPrisma();
      try {
        const execution = await prisma.workflowExecution.findUnique({
          where: { id: executionId },
          include: {
            stepExecutions: { orderBy: { startedAt: 'asc' } },
            workflow: { select: { name: true } },
          },
        });

        if (!execution) {
          return { success: false, error: 'Execution not found' };
        }

        return {
          success: true,
          execution: {
            id: execution.id,
            workflowName: execution.workflow.name,
            status: execution.status,
            triggerType: execution.triggerType,
            startedAt: execution.startedAt,
            completedAt: execution.completedAt,
            stepCount: execution.stepExecutions.length,
            steps: execution.stepExecutions.map(s => ({
              id: s.id,
              stepName: s.stepName,
              stepType: s.stepType,
              status: s.status,
              startedAt: s.startedAt,
              completedAt: s.completedAt,
              duration: s.duration,
              error: s.error,
            })),
          },
        };
      } finally {
        await prisma.$disconnect();
      }
    },

    pause_workflow_execution: async (args: Record<string, unknown>) => {
      const { executionId } = args as any;
      const prisma = getPrisma();
      try {
        const execution = await prisma.workflowExecution.findUnique({
          where: { id: executionId },
        });

        if (!execution) {
          return { success: false, error: 'Execution not found' };
        }

        if (execution.status !== 'running') {
          return { success: false, error: `Cannot pause execution with status "${execution.status}"` };
        }

        const context = typeof execution.context === 'string'
          ? JSON.parse(execution.context)
          : (execution.context || {});

        // Estimate current step from step executions
        const stepExecutions = await prisma.workflowStepExecution.findMany({
          where: { executionId },
          orderBy: { startedAt: 'asc' },
        });
        const stepIndex = stepExecutions.filter(s => s.status === 'completed').length;

        const paused = await stateManager.pauseExecution(executionId, stepIndex, context);
        if (!paused) {
          return { success: false, error: 'Failed to pause execution' };
        }

        return { success: true, message: `Execution paused at step ${stepIndex}` };
      } finally {
        await prisma.$disconnect();
      }
    },

    resume_workflow_execution: async (args: Record<string, unknown>) => {
      const { executionId } = args as any;
      const checkpoint = await stateManager.resumeExecution(executionId);
      if (!checkpoint) {
        return { success: false, error: 'No checkpoint found or execution not paused' };
      }

      return {
        success: true,
        stepIndex: checkpoint.stepIndex,
        contextKeys: Object.keys(checkpoint.context),
        savedAt: checkpoint.savedAt,
        message: `Execution resumed from step ${checkpoint.stepIndex}`,
      };
    },

    list_paused_executions: async () => {
      const paused = await stateManager.getPausedExecutions();
      return { success: true, executions: paused, count: paused.length };
    },

    invoke_sub_workflow: async (args: Record<string, unknown>) => {
      const { workflowId, workflowName, inputMapping, outputMapping, inheritContext } = args as any;
      const prisma = getPrisma();
      try {
        const targetWorkflow = workflowId
          ? await prisma.workflow.findUnique({ where: { id: workflowId } })
          : await prisma.workflow.findFirst({ where: { name: workflowName, isActive: true } });

        if (!targetWorkflow) {
          return { success: false, error: `Workflow not found (${workflowId ?? workflowName})` };
        }

        return {
          success: true,
          workflow: {
            id: targetWorkflow.id,
            name: targetWorkflow.name,
            description: targetWorkflow.description,
            stepCount: Array.isArray(targetWorkflow.steps) ? targetWorkflow.steps.length : 0,
          },
          message: 'Sub-workflow ready to invoke. Use create_deployment or workflow trigger to execute.',
        };
      } finally {
        await prisma.$disconnect();
      }
    },

    get_workflow_templates: async () => {
      try {
        const { projectTemplates } = await import('@/lib/modules/workflow-engine/templates/project-templates');
        const templates = Object.entries(projectTemplates).map(([key, value]) => ({
          id: key,
          name: (value as any).name || key,
          description: (value as any).description || '',
          stepCount: Array.isArray((value as any).steps) ? (value as any).steps.length : 0,
        }));
        return { success: true, templates, count: templates.length };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },
  };
}
