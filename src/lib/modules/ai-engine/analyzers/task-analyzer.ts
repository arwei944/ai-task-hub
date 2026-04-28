import type { IAIModelAdapter, ChatMessage } from '../ai-model-adapter';
import type { AnalysisReport } from '../types';
import type { ILogger } from '@/lib/core/types';

export class TaskAnalyzer {
  constructor(
    private ai: IAIModelAdapter,
    private logger: ILogger,
  ) {}

  async generateReport(taskData: {
    totalTasks: number;
    statusCounts: Record<string, number>;
    recentTasks: Array<{ title: string; status: string; priority: string; dueDate: string | null; createdAt: string }>;
  }): Promise<AnalysisReport> {
    this.logger.info('Generating analysis report');

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `你是一个项目分析助手。根据任务数据生成分析报告。

返回 JSON 格式：
\`\`\`json
{
  "summary": "项目整体概况描述（2-3句话）",
  "suggestions": ["建议1", "建议2", "建议3"],
  "risks": ["风险1", "风险2"]
}
\`\`\`

只返回 JSON，不要其他文字。`,
      },
      {
        role: 'user',
        content: `任务数据统计：
- 总任务数：${taskData.totalTasks}
- 状态分布：${JSON.stringify(taskData.statusCounts)}
- 最近任务：${JSON.stringify(taskData.recentTasks.slice(0, 10))}

请生成分析报告。`,
      },
    ];

    try {
      const response = await this.ai.chat(messages, { temperature: 0.5, maxTokens: 2000 });

      const jsonMatch = response.match(/```json\s*([\s\S]*?)```/) || response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return this.generateFallbackReport(taskData);
      }

      const jsonStr = jsonMatch[1] || jsonMatch[0];
      const parsed = JSON.parse(jsonStr);

      const completedTasks = taskData.statusCounts['done'] ?? 0;
      const inProgressTasks = taskData.statusCounts['in_progress'] ?? 0;
      const overdueTasks = taskData.recentTasks.filter(
        (t) => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'done' && t.status !== 'closed',
      ).length;

      return {
        summary: parsed.summary || '',
        totalTasks: taskData.totalTasks,
        completedTasks,
        inProgressTasks,
        overdueTasks,
        completionRate: taskData.totalTasks > 0 ? Math.round((completedTasks / taskData.totalTasks) * 100) : 0,
        suggestions: parsed.suggestions || [],
        risks: parsed.risks || [],
      };
    } catch (error: any) {
      this.logger.error(`Report generation failed: ${error.message}`);
      return this.generateFallbackReport(taskData);
    }
  }

  private generateFallbackReport(taskData: any): AnalysisReport {
    const completedTasks = taskData.statusCounts['done'] ?? 0;
    const inProgressTasks = taskData.statusCounts['in_progress'] ?? 0;
    const overdueTasks = taskData.recentTasks?.filter(
      (t: any) => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'done' && t.status !== 'closed',
    ).length ?? 0;

    const suggestions: string[] = [];
    const risks: string[] = [];

    if (overdueTasks > 0) {
      risks.push(`${overdueTasks} 个任务已超期`);
      suggestions.push('优先处理超期任务，考虑调整截止日期或分配更多资源');
    }

    if (inProgressTasks > 5) {
      suggestions.push('进行中的任务较多，建议集中精力完成当前任务再开始新任务');
    }

    const completionRate = taskData.totalTasks > 0 ? Math.round((completedTasks / taskData.totalTasks) * 100) : 0;
    if (completionRate < 30 && taskData.totalTasks > 5) {
      suggestions.push('完成率较低，建议拆分大任务为更小的子任务');
    }

    return {
      summary: `共 ${taskData.totalTasks} 个任务，完成 ${completedTasks} 个（${completionRate}%），进行中 ${inProgressTasks} 个。`,
      totalTasks: taskData.totalTasks,
      completedTasks,
      inProgressTasks,
      overdueTasks,
      completionRate,
      suggestions,
      risks,
    };
  }
}
