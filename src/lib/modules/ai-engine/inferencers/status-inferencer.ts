import type { IAIModelAdapter, ChatMessage } from '../ai-model-adapter';
import type { StatusInference } from '../types';
import type { ILogger } from '@/lib/core/types';

export class StatusInferencer {
  constructor(
    private ai: IAIModelAdapter,
    private logger: ILogger,
  ) {}

  async infer(
    taskTitle: string,
    currentStatus: string,
    context: string,
  ): Promise<StatusInference> {
    this.logger.debug(`Inferring status for: ${taskTitle} (current: ${currentStatus})`);

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `你是一个任务状态推断助手。根据任务的当前状态和最新上下文，推断任务应该处于什么状态。

可选状态：todo, in_progress, done, closed

规则：
1. 如果上下文表明任务已经开始执行，建议 in_progress
2. 如果上下文表明任务已完成（如"完成了"、"修好了"、"部署了"），建议 done
3. 如果上下文没有明确的状态变化，保持当前状态
4. 给出推断的理由和置信度

返回 JSON 格式：
\`\`\`json
{
  "suggestedStatus": "in_progress",
  "confidence": 0.8,
  "reasoning": "推断理由"
}
\`\`\`

只返回 JSON，不要其他文字。`,
      },
      {
        role: 'user',
        content: `任务标题：${taskTitle}\n当前状态：${currentStatus}\n最新上下文：${context}`,
      },
    ];

    try {
      const response = await this.ai.chat(messages, { temperature: 0.2 });

      const jsonMatch = response.match(/```json\s*([\s\S]*?)```/) || response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return {
          suggestedStatus: currentStatus,
          confidence: 0,
          reasoning: 'Failed to parse AI response',
        };
      }

      const jsonStr = jsonMatch[1] || jsonMatch[0];
      const parsed = JSON.parse(jsonStr);

      return {
        suggestedStatus: parsed.suggestedStatus ?? currentStatus,
        confidence: Math.min(1, Math.max(0, parsed.confidence ?? 0)),
        reasoning: parsed.reasoning || '',
      };
    } catch (error: any) {
      this.logger.error(`Status inference failed: ${error.message}`);
      return {
        suggestedStatus: currentStatus,
        confidence: 0,
        reasoning: `Error: ${error.message}`,
      };
    }
  }
}
