// ============================================================
// Auto Task Decomposer
// ============================================================
//
// Enhanced version that decomposes tasks AND creates sub-tasks
// in the database automatically.
//

import type { IAIModelAdapter, ChatMessage } from '../ai-model-adapter';
import type { DecompositionResult, DecomposedTask } from '../types';
import type { ILogger } from '@/lib/core/types';
import type { TaskService } from '@/lib/modules/task-core/task.service';

export interface AutoDecomposeResult {
  decomposition: DecompositionResult;
  createdSubTaskIds: string[];
  errors: string[];
}

export class AutoTaskDecomposer {
  constructor(
    private ai: IAIModelAdapter,
    private logger: ILogger,
  ) {}

  /**
   * Decompose a task and optionally create sub-tasks in the database
   */
  async decompose(
    parentTaskId: string,
    taskTitle: string,
    taskDescription?: string,
    taskService?: TaskService,
  ): Promise<AutoDecomposeResult> {
    this.logger.info(`Auto-decomposing task: ${taskTitle}`);

    const decomposition = await this.performDecomposition(taskTitle, taskDescription);

    const result: AutoDecomposeResult = {
      decomposition,
      createdSubTaskIds: [],
      errors: [],
    };

    if (!taskService || decomposition.subTasks.length === 0) {
      return result;
    }

    // Create sub-tasks in database
    for (const subTask of decomposition.subTasks) {
      try {
        const created = await taskService.createTask({
          title: subTask.title,
          description: subTask.description,
          priority: subTask.priority ?? 'medium',
          type: 'subtask',
          parentTaskId: parentTaskId,
        });
        result.createdSubTaskIds.push(created.id);
      } catch (error: any) {
        result.errors.push(`子任务"${subTask.title}"创建失败: ${error.message}`);
        this.logger.error(`Failed to create sub-task "${subTask.title}": ${error.message}`);
      }
    }

    this.logger.info(
      `Auto-decompose complete: ${result.createdSubTaskIds.length} sub-tasks created, ${result.errors.length} errors`,
    );

    return result;
  }

  /**
   * Just decompose without creating sub-tasks
   */
  async preview(taskTitle: string, taskDescription?: string): Promise<DecompositionResult> {
    return this.performDecomposition(taskTitle, taskDescription);
  }

  private async performDecomposition(
    taskTitle: string,
    taskDescription?: string,
  ): Promise<DecompositionResult> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `你是一个任务拆解助手。将复杂的任务拆解为可执行的子任务。

规则：
1. 每个子任务必须具体、可执行，粒度适中（不超过 2 小时工作量）
2. 子任务之间有合理的执行顺序
3. 标注子任务之间的依赖关系（用 order 索引表示）
4. 估算每个子任务的工作量（small=30分钟内/medium=1-2小时/large=半天以上）
5. 给出拆解的理由
6. 通常拆解为 3-8 个子任务，不要过多或过少

返回 JSON 格式：
\`\`\`json
{
  "reasoning": "拆解理由...",
  "subTasks": [
    {
      "title": "子任务标题",
      "description": "子任务描述",
      "priority": "medium",
      "order": 0,
      "dependencies": [],
      "estimatedEffort": "medium"
    }
  ]
}
\`\`\`

只返回 JSON，不要其他文字。`,
      },
      {
        role: 'user',
        content: `请拆解以下任务：\n\n标题：${taskTitle}\n${taskDescription ? `描述：${taskDescription}` : ''}`,
      },
    ];

    try {
      const response = await this.ai.chat(messages, { temperature: 0.3, maxTokens: 4000 });

      const jsonMatch = response.match(/```json\s*([\s\S]*?)```/) || response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        this.logger.warn('Auto-decompose: failed to parse AI response');
        return { subTasks: [], reasoning: 'Failed to parse AI response' };
      }

      const jsonStr = jsonMatch[1] || jsonMatch[0];
      const parsed = JSON.parse(jsonStr);

      return {
        reasoning: parsed.reasoning || '',
        subTasks: (parsed.subTasks || []).map((t: any, i: number) => ({
          title: t.title,
          description: t.description || '',
          priority: t.priority ?? 'medium',
          order: t.order ?? i,
          dependencies: t.dependencies ?? [],
          estimatedEffort: t.estimatedEffort ?? 'medium',
        })),
      };
    } catch (error: any) {
      this.logger.error(`Auto-decompose failed: ${error.message}`);
      return { subTasks: [], reasoning: `Error: ${error.message}` };
    }
  }
}
