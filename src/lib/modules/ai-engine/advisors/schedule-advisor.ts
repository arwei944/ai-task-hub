// ============================================================
// Smart Scheduling & Priority Advisor
// ============================================================
//
// Analyzes task workload and suggests optimal scheduling
// and priority adjustments.
//

import type { IAIModelAdapter, ChatMessage } from '../ai-model-adapter';
import type { ILogger } from '@/lib/core/types';

export interface TaskSummary {
  id: string;
  title: string;
  status: string;
  priority: string;
  progress: number;
  dueDate?: string | null;
  assignee?: string | null;
  createdAt: string;
}

export interface ScheduleSuggestion {
  taskId: string;
  taskTitle: string;
  suggestion: string;       // e.g., "建议提升优先级"
  reason: string;           // e.g., "即将到期且进度不足"
  suggestedPriority?: string;
  suggestedDueDate?: string;
  risk: 'low' | 'medium' | 'high';
}

export interface ScheduleReport {
  overallAssessment: string;
  workloadLevel: 'light' | 'moderate' | 'heavy' | 'overloaded';
  suggestions: ScheduleSuggestion[];
  dailyPlan: Array<{
    date: string;
    focus: string;
    tasks: string[];
  }>;
  riskAlerts: string[];
}

export class ScheduleAdvisor {
  constructor(
    private ai: IAIModelAdapter,
    private logger: ILogger,
  ) {}

  async analyze(tasks: TaskSummary[]): Promise<ScheduleReport> {
    this.logger.info(`Analyzing schedule for ${tasks.length} tasks`);

    const activeTasks = tasks.filter(t => t.status !== 'closed' && t.status !== 'done');
    const taskContext = activeTasks
      .slice(0, 50) // Limit to prevent token overflow
      .map(t => `- [${t.id}] ${t.title} | 状态:${t.status} 优先级:${t.priority} 进度:${t.progress}%${t.dueDate ? ` 截止:${t.dueDate}` : ''}${t.assignee ? ` 负责人:${t.assignee}` : ''}`)
      .join('\n');

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `你是一个智能排期助手。分析任务列表，给出排期建议和风险预警。

工作负载评估：
- light: 待办任务 < 5 个
- moderate: 待办任务 5-15 个
- heavy: 待办任务 15-25 个
- overloaded: 待办任务 > 25 个

风险等级：
- low: 正常推进
- medium: 需要关注
- high: 需要立即处理

返回 JSON 格式：
\`\`\`json
{
  "overallAssessment": "整体评估...",
  "workloadLevel": "moderate",
  "suggestions": [
    {
      "taskId": "xxx",
      "taskTitle": "任务标题",
      "suggestion": "建议提升优先级",
      "reason": "即将到期且进度不足",
      "suggestedPriority": "high",
      "risk": "high"
    }
  ],
  "dailyPlan": [
    {
      "date": "2026-04-28",
      "focus": "完成紧急任务",
      "tasks": ["task-id-1", "task-id-2"]
    }
  ],
  "riskAlerts": ["任务A即将到期", "任务B进度严重滞后"]
}
\`\`\`

注意：
1. 重点关注即将到期、进度不足的任务
2. dailyPlan 最多规划未来 7 天
3. suggestions 最多给出 10 条
4. 所有文字用中文
5. 只返回 JSON`,
      },
      {
        role: 'user',
        content: `当前日期：${new Date().toISOString().split('T')[0]}\n\n任务列表：\n${taskContext}`,
      },
    ];

    try {
      const response = await this.ai.chat(messages, { temperature: 0.3, maxTokens: 4000 });

      const jsonMatch = response.match(/```json\s*([\s\S]*?)```/) || response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        this.logger.warn('Schedule analysis: failed to parse AI response');
        return {
          overallAssessment: '分析失败',
          workloadLevel: 'moderate',
          suggestions: [],
          dailyPlan: [],
          riskAlerts: [],
        };
      }

      const jsonStr = jsonMatch[1] || jsonMatch[0];
      const parsed = JSON.parse(jsonStr);

      const result: ScheduleReport = {
        overallAssessment: parsed.overallAssessment ?? '',
        workloadLevel: parsed.workloadLevel ?? 'moderate',
        suggestions: (parsed.suggestions ?? []).map((s: any) => ({
          taskId: s.taskId ?? '',
          taskTitle: s.taskTitle ?? '',
          suggestion: s.suggestion ?? '',
          reason: s.reason ?? '',
          suggestedPriority: s.suggestedPriority,
          suggestedDueDate: s.suggestedDueDate,
          risk: s.risk ?? 'medium',
        })),
        dailyPlan: (parsed.dailyPlan ?? []).map((d: any) => ({
          date: d.date ?? '',
          focus: d.focus ?? '',
          tasks: d.tasks ?? [],
        })),
        riskAlerts: parsed.riskAlerts ?? [],
      };

      this.logger.info(`Schedule analysis complete: ${result.suggestions.length} suggestions, ${result.riskAlerts.length} alerts`);
      return result;
    } catch (error: any) {
      this.logger.error(`Schedule analysis failed: ${error.message}`);
      return {
        overallAssessment: `分析失败: ${error.message}`,
        workloadLevel: 'moderate',
        suggestions: [],
        dailyPlan: [],
        riskAlerts: [],
      };
    }
  }
}
