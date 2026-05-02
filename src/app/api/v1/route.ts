// ============================================================
// REST API v1 - For any AI agent that can send HTTP requests
// ============================================================
// Authentication: X-API-Key header (Agent apiKey)
// All AI tools (Trae, Cursor, ChatGPT, etc.) can use this API
//

import { NextResponse } from 'next/server';
import { Prisma } from '@/generated/prisma/client';
import { getPrisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Auth middleware: validate X-API-Key
async function authenticate(request: Request) {
  const apiKey = request.headers.get('x-api-key');
  if (!apiKey) {
    return { error: NextResponse.json({ error: 'Missing X-API-Key header', code: 'UNAUTHORIZED' }, { status: 401 }), agent: null };
  }

  const prisma = getPrisma();
  const agent = await prisma.agent.findUnique({ where: { apiKey } });
  if (!agent || !agent.isActive) {
    await prisma.$disconnect();
    return { error: NextResponse.json({ error: 'Invalid API key', code: 'FORBIDDEN' }, { status: 403 }), agent: null };
  }

  // Update last seen
  await prisma.agent.update({ where: { id: agent.id }, data: { lastSeenAt: new Date() } });
  await prisma.$disconnect();
  return { error: null, agent };
}

// Helper: read JSON body
async function readBody(request: Request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

// ==================== POST /api/v1/register ====================
// Register a new agent, get API key
export async function POST(request: Request) {
  const body = await readBody(request);
  if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

  const { action } = body;

  // Register endpoint doesn't need API key
  if (action === 'register') {
    const { name, clientType, clientVersion, capabilities } = body;
    if (!name || !clientType) {
      return NextResponse.json({ error: 'name and clientType are required' }, { status: 400 });
    }

    const prisma = getPrisma();
    try {
      let agent = await prisma.agent.findFirst({ where: { name, clientType } });

      if (!agent) {
        const apiKey = `ath_${clientType}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
        agent = await prisma.agent.create({
          data: {
            name,
            clientType,
            clientVersion: clientVersion || null,
            capabilities: capabilities ? JSON.stringify(capabilities) : null,
            apiKey,
            lastSeenAt: new Date(),
          },
        });
      } else {
        await prisma.agent.update({
          where: { id: agent.id },
          data: { lastSeenAt: new Date(), ...(clientVersion && { clientVersion }) },
        });
      }

      return NextResponse.json({
        agentId: agent.id,
        apiKey: agent.apiKey,
        name: agent.name,
        clientType: agent.clientType,
        message: `Agent "${agent.name}" registered. Use X-API-Key: ${agent.apiKey}`,
      });
    } finally {
      await prisma.$disconnect();
    }
  }

  // All other actions require API key
  const { error, agent } = await authenticate(request);
  if (error) return error;

  const prisma = getPrisma();
  try {
    // ==================== Project ====================
    if (action === 'create_project') {
      const { name, description, priority, techStack, repository } = body;
      if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });

      const project = await prisma.project.create({
        data: {
          name, description: description || null, priority: priority || 'medium',
          techStack: techStack ? JSON.stringify(techStack) : null,
          repository: repository || null,
          creatorId: agent!.id, creatorType: 'agent', startedAt: new Date(),
        },
      });

      await prisma.activityLog.create({
        data: {
          projectId: project.id, agentId: agent!.id, action: 'project_created',
          phase: 'requirements', title: `创建项目「${name}」`,
          details: JSON.stringify({ clientType: agent!.clientType }),
        },
      });

      return NextResponse.json({ projectId: project.id, name: project.name, phase: project.phase });
    }

    if (action === 'update_project') {
      const { id, ...updates } = body;
      if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
      const project = await prisma.project.update({
        where: { id },
        data: {
          ...(updates.name && { name: updates.name }),
          ...(updates.description !== undefined && { description: updates.description }),
          ...(updates.phase && { phase: updates.phase }),
          ...(updates.status && { status: updates.status }),
          ...(updates.priority && { priority: updates.priority }),
          ...(updates.techStack && { techStack: JSON.stringify(updates.techStack) }),
          ...(updates.repository !== undefined && { repository: updates.repository }),
          ...(updates.phase && updates.phase === 'completed' && { completedAt: new Date(), status: 'completed' }),
        },
      });
      return NextResponse.json({ projectId: project.id, phase: project.phase, status: project.status });
    }

    if (action === 'get_project') {
      const { id } = body;
      if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

      const project = await prisma.project.findUnique({
        where: { id },
        include: { _count: { select: { tasks: true, activities: true } } },
      });
      if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

      const tasks = await prisma.task.findMany({ where: { projectId: id } });
      const stats = {
        total: tasks.length,
        todo: tasks.filter((t: any) => t.status === 'todo').length,
        inProgress: tasks.filter((t: any) => t.status === 'in_progress').length,
        done: tasks.filter((t: any) => t.status === 'done').length,
      };

      return NextResponse.json({ ...project, stats });
    }

    if (action === 'list_projects') {
      const { status, phase } = body;
      const where: Prisma.ProjectWhereInput = {};
      if (status) where.status = status as string;
      if (phase) where.phase = phase as string;

      const projects = await prisma.project.findMany({
        where, orderBy: { updatedAt: 'desc' },
        include: { _count: { select: { tasks: true, activities: true } } },
      });
      return NextResponse.json({ projects, total: projects.length });
    }

    // ==================== Task ====================
    if (action === 'create_task') {
      const { projectId, title, description, phase, priority, status, parentTaskId, dueDate, tags } = body;
      if (!title) return NextResponse.json({ error: 'title is required' }, { status: 400 });

      const task = await prisma.task.create({
        data: {
          title, description: description || null,
          phase: phase || 'implementation', priority: priority || 'medium',
          status: status || 'todo', projectId: projectId || null,
          parentTaskId: parentTaskId || null,
          dueDate: dueDate ? new Date(dueDate) : null,
          creator: agent!.id, source: agent!.clientType,
        },
      });

      if (tags && Array.isArray(tags)) {
        for (const tagName of tags) {
          const tag = await prisma.tag.upsert({ where: { name: tagName }, update: {}, create: { name: tagName } });
          await prisma.taskTag.create({ data: { taskId: task.id, tagId: tag.id } });
        }
      }

      await prisma.activityLog.create({
        data: {
          projectId: projectId || null, taskId: task.id, agentId: agent!.id,
          action: 'task_created', phase: phase || 'implementation',
          title: `创建任务「${title}」`,
        },
      });

      return NextResponse.json({ taskId: task.id, title: task.title, phase: task.phase, status: task.status });
    }

    if (action === 'update_task') {
      const { id, ...updates } = body;
      if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

      const oldTask = await prisma.task.findUnique({ where: { id } });
      if (!oldTask) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

      const task = await prisma.task.update({
        where: { id },
        data: {
          ...(updates.title && { title: updates.title }),
          ...(updates.description !== undefined && { description: updates.description }),
          ...(updates.status && { status: updates.status }),
          ...(updates.priority && { priority: updates.priority }),
          ...(updates.progress !== undefined && { progress: updates.progress }),
          ...(updates.phase && { phase: updates.phase }),
          ...(updates.status === 'done' && { completedAt: new Date() }),
          ...(updates.status === 'in_progress' && !oldTask.startedAt && { startedAt: new Date() }),
        },
      });

      const changes: string[] = [];
      if (updates.status && updates.status !== oldTask.status) changes.push(`${oldTask.status} → ${updates.status}`);
      if (updates.progress !== undefined) changes.push(`进度 ${updates.progress}%`);

      if (changes.length > 0) {
        await prisma.activityLog.create({
          data: {
            projectId: task.projectId || null, taskId: task.id, agentId: agent!.id,
            action: updates.status === 'done' ? 'task_completed' : 'task_updated',
            phase: task.phase, title: `更新任务「${task.title}」: ${changes.join(', ')}`,
          },
        });
      }

      return NextResponse.json({ taskId: task.id, title: task.title, status: task.status, progress: task.progress });
    }

    if (action === 'list_tasks') {
      const { projectId, phase, status, parentTaskId, search } = body;
      const where: Prisma.TaskWhereInput = {};
      if (projectId) where.projectId = projectId;
      if (phase) where.phase = phase as string;
      if (parentTaskId) where.parentTaskId = parentTaskId;
      if (status) where.status = { in: Array.isArray(status) ? status : [status] };
      if (search) where.title = { contains: search as string };

      const tasks = await prisma.task.findMany({
        where, orderBy: { createdAt: 'desc' },
        include: { tags: { include: { tag: true } }, _count: { select: { subTasks: true } } },
      });
      return NextResponse.json({ tasks, total: tasks.length });
    }

    // ==================== Phase ====================
    if (action === 'advance_phase') {
      const { projectId, phase, summary } = body;
      if (!projectId || !phase) return NextResponse.json({ error: 'projectId and phase required' }, { status: 400 });

      const project = await prisma.project.update({
        where: { id: projectId },
        data: {
          phase,
          ...(phase === 'completed' && { completedAt: new Date(), status: 'completed' }),
        },
      });

      await prisma.activityLog.create({
        data: {
          projectId, agentId: agent!.id, action: 'phase_changed', phase,
          title: `阶段推进至「${phase}」`,
          details: JSON.stringify({ summary }),
        },
      });

      return NextResponse.json({ projectId: project.id, phase: project.phase });
    }

    // ==================== Activity ====================
    if (action === 'log_activity') {
      const { projectId, taskId, action: act, phase, title, details } = body;
      if (!act || !title) return NextResponse.json({ error: 'action and title required' }, { status: 400 });

      const log = await prisma.activityLog.create({
        data: {
          projectId: projectId || null, taskId: taskId || null, agentId: agent!.id,
          action: act, phase: phase || null, title,
          details: details ? JSON.stringify(details) : null,
        },
      });
      return NextResponse.json({ activityId: log.id, action: log.action, title: log.title });
    }

    if (action === 'get_activities') {
      const { projectId, taskId, limit } = body;
      const where: Prisma.ActivityLogWhereInput = {};
      if (projectId) where.projectId = projectId;
      if (taskId) where.taskId = taskId;

      const activities = await prisma.activityLog.findMany({
        where, orderBy: { createdAt: 'desc' }, take: Math.min(limit || 50, 200),
        include: { agent: { select: { name: true, clientType: true } } },
      });
      return NextResponse.json({ activities, total: activities.length });
    }

    // ==================== Summary ====================
    if (action === 'get_summary') {
      const { projectId } = body;
      if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 });

      const project = await prisma.project.findUnique({ where: { id: projectId } });
      if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

      const tasks = await prisma.task.findMany({ where: { projectId } });
      const phaseOrder = ['requirements', 'planning', 'architecture', 'implementation', 'testing', 'deployment', 'completed'];
      const overallProgress = Math.round((phaseOrder.indexOf(project.phase) / (phaseOrder.length - 1)) * 100);

      return NextResponse.json({
        project: { id: project.id, name: project.name, phase: project.phase, status: project.status },
        overallProgress,
        tasks: { total: tasks.length, todo: tasks.filter((t: any) => t.status === 'todo').length, inProgress: tasks.filter((t: any) => t.status === 'in_progress').length, done: tasks.filter((t: any) => t.status === 'done').length },
        agent: { id: agent!.id, name: agent!.name, clientType: agent!.clientType },
      });
    }

    return NextResponse.json({ error: `Unknown action: ${action}`, availableActions: [
      'register', 'create_project', 'update_project', 'get_project', 'list_projects',
      'create_task', 'update_task', 'list_tasks', 'advance_phase',
      'log_activity', 'get_activities', 'get_summary',
    ] }, { status: 400 });
  } finally {
    await prisma.$disconnect();
  }
}
