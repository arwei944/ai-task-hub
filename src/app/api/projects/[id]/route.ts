// ============================================================
// Project Detail REST API
// ============================================================

import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

export const dynamic = 'force-dynamic';

function getPrisma() {
  const dbPath = process.env.DATABASE_URL?.replace(/^file:/, '') ?? './prisma/dev.db';
  const adapter = new PrismaBetterSqlite3({ url: dbPath });
  return new PrismaClient({ adapter });
}

// GET /api/projects/[id]/activities
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const prisma = getPrisma();
    const url = new URL(request.url);

    // Route: /api/projects/[id]/activities or /api/projects/[id]/summary
    if (url.pathname.endsWith('/activities')) {
      const logs = await prisma.activityLog.findMany({
        where: { projectId: id },
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: {
          agent: { select: { id: true, name: true, clientType: true } },
          task: { select: { id: true, title: true } },
        },
      });
      await prisma.$disconnect();
      return NextResponse.json({ activities: logs });
    }

    if (url.pathname.endsWith('/summary')) {
      const project = await prisma.project.findUnique({ where: { id } });
      if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

      const tasks = await prisma.task.findMany({ where: { projectId: id } });
      const activities = await prisma.activityLog.findMany({
        where: { projectId: id },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { agent: { select: { name: true, clientType: true } } },
      });

      const phaseOrder = ['requirements', 'planning', 'architecture', 'implementation', 'testing', 'deployment', 'completed'];
      const currentPhaseIndex = phaseOrder.indexOf(project.phase);
      const overallProgress = Math.round((currentPhaseIndex / (phaseOrder.length - 1)) * 100);

      const taskStats = {
        total: tasks.length,
        todo: tasks.filter(t => t.status === 'todo').length,
        inProgress: tasks.filter(t => t.status === 'in_progress').length,
        done: tasks.filter(t => t.status === 'done').length,
        completionRate: tasks.length > 0 ? Math.round((tasks.filter(t => t.status === 'done').length / tasks.length) * 100) : 0,
        byPhase: {} as Record<string, { total: number; done: number }>,
      };
      for (const t of tasks) {
        if (!taskStats.byPhase[t.phase]) taskStats.byPhase[t.phase] = { total: 0, done: 0 };
        taskStats.byPhase[t.phase].total++;
        if (t.status === 'done') taskStats.byPhase[t.phase].done++;
      }

      const agentIds = [...new Set(tasks.map(t => t.creator).filter((v): v is string => Boolean(v)))];
      const agents = await prisma.agent.findMany({
        where: { id: { in: agentIds } },
        select: { id: true, name: true, clientType: true },
      });

      await prisma.$disconnect();
      return NextResponse.json({ project: { id: project.id, name: project.name, phase: project.phase, status: project.status, priority: project.priority }, overallProgress, taskStats, agents, recentActivities: activities });
    }

    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
