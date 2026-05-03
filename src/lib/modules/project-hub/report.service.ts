// ============================================================
// Project Report Service - 项目报告自动生成
// ============================================================

import type { ILogger } from '@/lib/core/types';

export class ReportService {
  constructor(
    private prisma: any,
    private logger: ILogger,
  ) {}

  async generateProjectReport(projectId: string): Promise<{ title: string; content: string; format: 'markdown' }> {
    this.logger.info('[ReportService] Generating project report', { projectId });

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        milestones: { orderBy: { sortOrder: 'asc' } },
        agents: { include: { agent: true }, where: { isActive: true } },
        dependencies: true,
        docs: { where: { status: { not: 'archived' } }, orderBy: { updatedAt: 'desc' }, take: 10 },
      },
    });

    if (!project) throw new Error('Project not found');

    // Task stats
    const taskGroups = await this.prisma.task.groupBy({
      by: ['status'],
      where: { projectId },
      _count: true,
    });
    const totalTasks = taskGroups.reduce((s: number, t: any) => s + t._count, 0);
    const doneTasks = taskGroups.find((t: any) => t.status === 'done')?._count ?? 0;
    const inProgressTasks = taskGroups.find((t: any) => t.status === 'in_progress')?._count ?? 0;

    // Work log stats
    const workLogs = await this.prisma.agentWorkLog.findMany({
      where: { projectId },
      include: { projectAgent: { include: { agent: true } } },
    });
    const totalHours = workLogs.reduce((s: number, l: any) => s + l.hours, 0);
    const agentHours: Record<string, number> = {};
    for (const log of workLogs) {
      const name = log.projectAgent?.agent?.name || 'Unknown';
      agentHours[name] = (agentHours[name] || 0) + log.hours;
    }

    // Milestone progress
    const completedMilestones = project.milestones.filter((m: any) => m.status === 'completed').length;
    const totalMilestones = project.milestones.length;
    const milestoneProgress = totalMilestones > 0 ? Math.round((completedMilestones / totalMilestones) * 100) : 0;
    const taskProgress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
    const overallProgress = Math.max(milestoneProgress, taskProgress);

    // Risk assessment
    const overdueMilestones = project.milestones.filter((m: any) => {
      if (m.status === 'completed') return false;
      return m.dueDate && new Date(m.dueDate) < new Date();
    });
    const risks: string[] = [];
    if (overdueMilestones.length > 0) risks.push(`${overdueMilestones.length} 个里程碑已逾期`);
    if (project.agents.length === 0) risks.push('项目无分配智能体');
    if (inProgressTasks > totalTasks * 0.8 && totalTasks > 0) risks.push('任务并行度过高');
    if (totalHours > 0 && totalTasks > 0 && totalHours / doneTasks > 8) risks.push('平均任务工时偏高');

    const now = new Date().toISOString().split('T')[0];

    const content = `# ${project.name} — 项目报告

**生成日期:** ${now}
**项目阶段:** ${project.phase}
**优先级:** ${project.priority}
**整体进度:** ${overallProgress}%

---

## 📊 进度概览

| 指标 | 数值 |
|------|------|
| 整体进度 | ${overallProgress}% |
| 里程碑完成 | ${completedMilestones}/${totalMilestones} (${milestoneProgress}%) |
| 任务完成 | ${doneTasks}/${totalTasks} (${taskProgress}%) |
| 总工时 | ${totalHours.toFixed(1)}h |
| 智能体 | ${project.agents.length} 个 |

---

## 🎯 里程碑

${totalMilestones > 0 ? project.milestones.map((m: any) => `- [${m.status === 'completed' ? 'x' : ' '}] **${m.title}** (${m.status})${m.dueDate ? ` — 截止: ${m.dueDate.split('T')[0]}` : ''}`).join('\n') : '_暂无里程碑_'}

---

## 🤖 团队成员

${project.agents.length > 0 ? project.agents.map((pa: any) => `- **${pa.agent.name}** (${pa.role}) — ${agentHours[pa.agent.name]?.toFixed(1) || '0'}h`).join('\n') : '_暂无分配智能体_'}

---

## 📄 近期文档

${project.docs.length > 0 ? project.docs.slice(0, 5).map((d: any) => `- [${d.title}](${d.id}) [${d.docType}] — 更新于 ${d.updatedAt.split('T')[0]}`).join('\n') : '_暂无文档_'}

---

## ⚠️ 风险评估

${risks.length > 0 ? risks.map(r => `- ⚠️ ${r}`).join('\n') : '✅ 当前无显著风险'}

---

## 📋 待办建议

${overdueMilestones.length > 0 ? '- [ ] 处理逾期里程碑\n' : ''}${project.agents.length === 0 ? '- [ ] 分配智能体到项目\n' : ''}${totalMilestones > 0 && completedMilestones === 0 ? '- [ ] 推进第一个里程碑\n' : ''}- [ ] 更新项目文档
`;

    return {
      title: `${project.name} — 项目报告 (${now})`,
      content,
      format: 'markdown',
    };
  }

  async generateDashboardReport(): Promise<{ title: string; content: string }> {
    this.logger.info('[ReportService] Generating dashboard report');

    const projects = await this.prisma.project.findMany({
      where: { status: { not: 'archived' } },
      include: {
        milestones: true,
        agents: { where: { isActive: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const now = new Date().toISOString().split('T')[0];
    const totalProjects = projects.length;
    const activeProjects = projects.filter((p: any) => p.status === 'active').length;
    const totalMilestones = projects.reduce((s: number, p: any) => s + p.milestones.length, 0);
    const completedMilestones = projects.reduce((s: number, p: any) => s + p.milestones.filter((m: any) => m.status === 'completed').length, 0);

    const content = `# AI Task Hub — 全局报告

**生成日期:** ${now}

## 📊 概览

| 指标 | 数值 |
|------|------|
| 总项目数 | ${totalProjects} |
| 活跃项目 | ${activeProjects} |
| 里程碑完成 | ${completedMilestones}/${totalMilestones} |

## 📋 项目列表

${projects.map((p: any) => {
      const done = p.milestones.filter((m: any) => m.status === 'completed').length;
      const total = p.milestones.length;
      const progress = total > 0 ? Math.round((done / total) * 100) : 0;
      return `- **${p.name}** [${p.status}] [${p.priority}] — 进度 ${progress}% (${p.agents.length} 智能体)`;
    }).join('\n')}
`;

    return { title: `全局报告 (${now})`, content };
  }
}
