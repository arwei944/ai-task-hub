import type { ILogger } from '@/lib/core/types';
import type { SOLOBridge } from '@/lib/modules/workflow-engine/solo/solo-bridge';
import type { SOLOCallMode, SOLOSubAgentType } from '@/lib/modules/workflow-engine/types';

/**
 * 创建 SOLO Bridge MCP 工具处理器
 *
 * @param getBridge - 获取 SOLOBridge 实例的函数（延迟获取，支持 DI 容器）
 * @param logger - 日志记录器
 * @returns 7 个 MCP 工具处理函数
 */
export function createSOLOBridgeToolHandlers(
  getBridge: () => SOLOBridge | undefined,
  logger: ILogger,
) {
  return {
    /**
     * solo_health_check - 检查 SOLO Bridge 健康状态
     */
    solo_health_check: async () => {
      const bridge = getBridge();
      if (!bridge) {
        return {
          success: false,
          error: 'SOLO Bridge not available (not registered in DI container)',
        };
      }

      try {
        const health = await bridge.getHealth();
        return {
          success: true,
          health,
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
        };
      }
    },

    /**
     * solo_call - 执行 SOLO 调用
     */
    solo_call: async (args: Record<string, unknown>) => {
      const bridge = getBridge();
      if (!bridge) {
        return {
          success: false,
          error: 'SOLO Bridge not available (not registered in DI container)',
        };
      }

      const { prompt, mode, subAgentType, sessionId, timeoutMs, context } = args as {
        prompt: string;
        mode?: SOLOCallMode;
        subAgentType?: SOLOSubAgentType;
        sessionId?: string;
        timeoutMs?: number;
        context?: Record<string, unknown>;
      };

      if (!prompt) {
        return { success: false, error: 'Missing required parameter: prompt' };
      }

      try {
        const result = await bridge.call({
          prompt,
          callMode: mode,
          subAgentType,
          sessionId,
          timeoutMs,
          context,
          stepId: 'mcp-tool',
          executionId: 'mcp-tool',
          stepName: 'MCP solo_call',
        });

        return {
          success: result.success,
          data: result.data,
          error: result.error,
          sessionId: result.sessionId,
          durationMs: result.durationMs,
          tokensUsed: result.tokensUsed,
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
        };
      }
    },

    /**
     * solo_get_records - 获取 SOLO 调用历史记录
     */
    solo_get_records: async (args: Record<string, unknown>) => {
      const bridge = getBridge();
      if (!bridge) {
        return {
          success: false,
          error: 'SOLO Bridge not available (not registered in DI container)',
        };
      }

      const { executionId, stepId, limit } = args as {
        executionId?: string;
        stepId?: string;
        limit?: number;
      };

      try {
        const records = bridge.getRecords({
          executionId,
          stepId,
          limit,
        });

        return {
          success: true,
          records,
          count: records.length,
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
        };
      }
    },

    /**
     * solo_get_sessions - 获取活跃 SOLO 会话
     */
    solo_get_sessions: async () => {
      const bridge = getBridge();
      if (!bridge) {
        return {
          success: false,
          error: 'SOLO Bridge not available (not registered in DI container)',
        };
      }

      try {
        const sessions = bridge.getActiveSessions();
        return {
          success: true,
          sessions,
          count: sessions.length,
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
        };
      }
    },

    /**
     * solo_get_stats - 获取 SOLO Bridge 统计信息
     */
    solo_get_stats: async () => {
      const bridge = getBridge();
      if (!bridge) {
        return {
          success: false,
          error: 'SOLO Bridge not available (not registered in DI container)',
        };
      }

      try {
        const stats = bridge.getStats();
        return {
          success: true,
          stats,
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
        };
      }
    },

    /**
     * solo_pull_tasks - 轮询待处理的 Pull 模式任务
     */
    solo_pull_tasks: async (args: Record<string, unknown>) => {
      const bridge = getBridge();
      if (!bridge) {
        return {
          success: false,
          error: 'SOLO Bridge not available (not registered in DI container)',
        };
      }

      const { maxTasks } = args as { maxTasks?: number };

      try {
        const tasks = bridge.pollPullTasks(maxTasks);
        return {
          success: true,
          tasks,
          count: tasks.length,
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
        };
      }
    },

    /**
     * solo_complete_task - 完成 Pull 模式的任务
     */
    solo_complete_task: async (args: Record<string, unknown>) => {
      const bridge = getBridge();
      if (!bridge) {
        return {
          success: false,
          error: 'SOLO Bridge not available (not registered in DI container)',
        };
      }

      const { taskId, data, error, durationMs, tokensUsed } = args as {
        taskId: string;
        data?: unknown;
        error?: string;
        durationMs?: number;
        tokensUsed?: number;
      };

      if (!taskId) {
        return { success: false, error: 'Missing required parameter: taskId' };
      }

      try {
        const completed = bridge.completePullTask(taskId, {
          data,
          error,
          durationMs: durationMs ?? 0,
          tokensUsed,
        });

        if (!completed) {
          return {
            success: false,
            error: `Task not found or already completed: ${taskId}`,
          };
        }

        return {
          success: true,
          message: `Task ${taskId} completed successfully`,
        };
      } catch (err: any) {
        return {
          success: false,
          error: err.message,
        };
      }
    },
  };
}
