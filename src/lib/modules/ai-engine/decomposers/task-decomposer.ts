import type { IAIModelAdapter, ChatMessage } from '../ai-model-adapter';
import type { DecompositionResult, DecomposedTask } from '../types';
import type { ILogger } from '@/lib/core/types';

export class TaskDecomposer {
  constructor(
    private ai: IAIModelAdapter,
    private logger: ILogger,
  ) {}

  async decompose(taskTitle: string, taskDescription?: string): Promise<DecompositionResult> {
    this.logger.info(`Decomposing task: ${taskTitle}`);

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `你是一个任务拆解助手。将复杂的任务拆解为可执行的子任务。

规则：
1. 每个子任务必须具体、可执行
2. 子任务之间有合理的执行顺序
3. 标注子任务之间的依赖关系（用 order 索引表示）
4. 估算每个子任务的工作量（small/medium/large）
5. 给出拆解的理由

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
        this.logger.warn('AI response does not contain valid JSON');
        return { subTasks: [], reasoning: 'Failed to parse AI response' };
      }

      const jsonStr = jsonMatch[1] || jsonMatch[0];
      const parsed = JSON.parse(jsonStr);
      const result: DecompositionResult = {
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

      this.logger.info(`Decomposed into ${result.subTasks.length} subtasks`);
      return result;
    } catch (error: any) {
      this.logger.error(`Task decomposition failed: ${error.message}`);
      return { subTasks: [], reasoning: `Error: ${error.message}` };
    }
  }
}
