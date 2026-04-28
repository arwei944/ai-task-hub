import type { IAIModelAdapter, ChatMessage } from '../ai-model-adapter';
import type { ExtractedTask } from '../types';
import type { ILogger } from '@/lib/core/types';

export class TaskExtractor {
  constructor(
    private ai: IAIModelAdapter,
    private logger: ILogger,
  ) {}

  async extract(text: string, options?: { source?: string; creator?: string }): Promise<ExtractedTask[]> {
    this.logger.info(`Extracting tasks from text (${text.length} chars)`);

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `你是一个任务提取助手。从给定的文本中提取所有任务、行动项和待办事项。

规则：
1. 每个任务必须有明确的标题
2. 尽可能推断优先级（urgent/high/medium/low）
3. 为每个任务评估置信度（0-1），表示这个确实是一个任务的确信程度
4. 如果文本中提到截止日期，提取出来
5. 如果可以识别任务类型（feature/bug/improvement/docs），标注出来

返回 JSON 格式：
\`\`\`json
{
  "tasks": [
    {
      "title": "任务标题",
      "description": "任务描述（可选）",
      "priority": "medium",
      "type": "general",
      "dueDate": "2026-05-01（可选）",
      "tags": ["标签1"]（可选）,
      "confidence": 0.9
    }
  ]
}
\`\`\`

只返回 JSON，不要其他文字。`,
      },
      {
        role: 'user',
        content: text,
      },
    ];

    try {
      const response = await this.ai.chat(messages, { temperature: 0.3 });

      const jsonMatch = response.match(/```json\s*([\s\S]*?)```/) || response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        this.logger.warn('AI response does not contain valid JSON');
        return [];
      }

      const jsonStr = jsonMatch[1] || jsonMatch[0];
      const parsed = JSON.parse(jsonStr);
      const tasks: ExtractedTask[] = (parsed.tasks || []).map((t: any) => ({
        title: t.title,
        description: t.description,
        priority: t.priority ?? 'medium',
        type: t.type ?? 'general',
        dueDate: t.dueDate,
        tags: t.tags,
        confidence: Math.min(1, Math.max(0, t.confidence ?? 0.5)),
      }));

      this.logger.info(`Extracted ${tasks.length} tasks`);
      return tasks;
    } catch (error: any) {
      this.logger.error(`Task extraction failed: ${error.message}`);
      return [];
    }
  }
}
