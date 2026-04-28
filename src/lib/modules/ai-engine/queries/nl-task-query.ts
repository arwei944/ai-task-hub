// ============================================================
// Natural Language Task Query
// ============================================================
//
// Allows users to query tasks using natural language.
// e.g., "帮我找出本周到期的紧急任务"
// e.g., "显示所有进行中且优先级为高的任务"
//

import type { IAIModelAdapter, ChatMessage } from '../ai-model-adapter';
import type { ILogger } from '@/lib/core/types';

export interface NLQueryResult {
  intent: 'list' | 'count' | 'summary' | 'unknown';
  filters: {
    status?: string[];
    priority?: string[];
    type?: string[];
    assignee?: string;
    dueBefore?: string;
    dueAfter?: string;
    tags?: string[];
    keyword?: string;
  };
  naturalResponse: string;
  confidence: number;
}

export class NLTaskQuery {
  constructor(
    private ai: IAIModelAdapter,
    private logger: ILogger,
  ) {}

  async query(naturalQuery: string): Promise<NLQueryResult> {
    this.logger.info(`NL Query: ${naturalQuery}`);

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `你是一个任务查询助手。将用户的自然语言查询转换为结构化过滤条件。

支持的过滤维度：
- status: todo, in_progress, done, closed
- priority: urgent, high, medium, low
- type: feature, bug, improvement, documentation, general
- assignee: 用户名
- dueBefore / dueAfter: 日期（ISO 格式）
- tags: 标签名
- keyword: 关键词搜索

意图类型：
- list: 列出任务
- count: 统计数量
- summary: 总结概览
- unknown: 无法理解

返回 JSON 格式：
\`\`\`json
{
  "intent": "list",
  "filters": {
    "status": ["todo", "in_progress"],
    "priority": ["high", "urgent"]
  },
  "naturalResponse": "为您找到以下高优先级的待办和进行中任务...",
  "confidence": 0.9
}
\`\`\`

注意：
1. 日期相关：今天 = 当前日期，本周 = 本周一到周日，本月 = 本月1日到月末
2. 如果用户说"紧急"，对应 priority: ["urgent", "high"]
3. 如果用户说"未完成"，对应 status: ["todo", "in_progress"]
4. naturalResponse 用中文回复，语气友好

只返回 JSON，不要其他文字。`,
      },
      {
        role: 'user',
        content: `当前日期：${new Date().toISOString().split('T')[0]}\n\n用户查询：${naturalQuery}`,
      },
    ];

    try {
      const response = await this.ai.chat(messages, { temperature: 0.2, maxTokens: 2000 });

      const jsonMatch = response.match(/```json\s*([\s\S]*?)```/) || response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        this.logger.warn('NL Query: failed to parse AI response');
        return {
          intent: 'unknown',
          filters: {},
          naturalResponse: '抱歉，我无法理解您的查询。请尝试更具体的描述。',
          confidence: 0,
        };
      }

      const jsonStr = jsonMatch[1] || jsonMatch[0];
      const parsed = JSON.parse(jsonStr);

      const result: NLQueryResult = {
        intent: parsed.intent ?? 'unknown',
        filters: parsed.filters ?? {},
        naturalResponse: parsed.naturalResponse ?? '',
        confidence: parsed.confidence ?? 0.5,
      };

      this.logger.info(`NL Query resolved: intent=${result.intent}, confidence=${result.confidence}`);
      return result;
    } catch (error: any) {
      this.logger.error(`NL Query failed: ${error.message}`);
      return {
        intent: 'unknown',
        filters: {},
        naturalResponse: '查询处理失败，请稍后重试。',
        confidence: 0,
      };
    }
  }
}
