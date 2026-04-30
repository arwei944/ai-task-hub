// ============================================================
// Project Lifecycle Tool Handlers
// ============================================================

import { getPrisma } from '@/lib/db';
import type { ILogger, IEventBus, DomainEvent } from '@/lib/core/types';

export function createProjectToolHandlers(logger: ILogger, eventBus?: IEventBus) {
  return {
    // ---- Agent Registration ----
    register_agent: async (args: Record<string, unknown>) => {
      const prisma = getPrisma();
      try {
        const { name, clientType, clientVersion, capabilities } = args as any;

        // Find or create agent by name + clientType
        let agent = await prisma.agent.findFirst({
          where: { name, clientType: clientType || 'mcp' },
        });

        if (!agent) {
          const apiKey = `agent_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
          agent = await prisma.agent.create({
            data: {
              name,
              clientType: clientType || 'mcp',
              clientVersion: clientVersion || null,
              capabilities: capabilities ? JSON.stringify(capabilities) : null,
              apiKey,
              lastSeenAt: new Date(),
            },
          });
        } else {
          await prisma.agent.update({
            where: { id: agent.id },
            data: {
              lastSeenAt: new Date(),
              ...(clientVersion && { clientVersion }),
              ...(capabilities && { capabilities: JSON.stringify(capabilities) }),
            },
          });
        }

        return {
          agentId: agent.id,
          name: agent.name,
          clientType: agent.clientType,
          message: `Agent "${agent.name}" (${agent.clientType}) registered successfully`,
        };
      } finally {
        await prisma.$disconnect();
      }
    },

    // ---- Project CRUD ----
    create_project: async (args: Record<string, unknown>) => {
      const prisma = getPrisma();
      try {
        const { name, description, priority, techStack, repository, agentId, clientType } = args as any;

        const project = await prisma.project.create({
          data: {
            name,
            description: description || null,
            priority: priority || 'medium',
            techStack: techStack ? JSON.stringify(techStack) : null,
            repository: repository || null,
            creatorId: agentId || null,
            creatorType: 'agent',
            startedAt: new Date(),
          },
        });

        // Log activity
        await prisma.activityLog.create({
          data: {
            projectId: project.id,
            agentId: agentId || null,
            action: 'project_created',
            phase: 'requirements',
            title: `创建项目「${name}」`,
            details: JSON.stringify({ clientType: clientType || 'mcp', priority, techStack }),
          },
        });

        logger.info(`Project created: ${project.id} - ${name}`);

        if (eventBus) {
          eventBus.emit({
            type: 'project.created',
            payload: {
              projectId: project.id,
              name: project.name,
              description: project.description,
              creatorId: agentId,
              creatorType: 'agent',
            },
            timestamp: new Date(),
            source: 'project',
          });
        }

        return { projectId: project.id, name: project.name, phase: project.phase, message: `项目「${name}」创建成功` };
      } finally {
        await prisma.$disconnect();
      }
    },

    update_project: async (args: Record<string, unknown>) => {
      const prisma = getPrisma();
      try {
        const { id, ...updates } = args as any;
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
          },
        });
        return { projectId: project.id, ...project };
      } finally {
        await prisma.$disconnect();
      }
    },

    get_project: async (args: Record<string, unknown>) => {
      const prisma = getPrisma();
      try {
        const { id } = args as any;
        const project = await prisma.project.findUnique({
          where: { id },
          include: {
            tasks: { orderBy: { createdAt: 'desc' }, take: 20 },
            activities: { orderBy: { createdAt: 'desc' }, take: 20 },
            creator: { select: { id: true, name: true, clientType: true } },
          },
        });

        if (!project) return { error: 'Project not found' };

        // Compute stats
        const allTasks = await prisma.task.findMany({ where: { projectId: id } });
        const stats = {
          total: allTasks.length,
          todo: allTasks.filter(t => t.status === 'todo').length,
          inProgress: allTasks.filter(t => t.status === 'in_progress').length,
          done: allTasks.filter(t => t.status === 'done').length,
          closed: allTasks.filter(t => t.status === 'closed').length,
          byPhase: {} as Record<string, number>,
        };
        for (const t of allTasks) {
          stats.byPhase[t.phase] = (stats.byPhase[t.phase] || 0) + 1;
        }

        return { ...project, stats };
      } finally {
        await prisma.$disconnect();
      }
    },

    list_projects: async (args: Record<string, unknown>) => {
      const prisma = getPrisma();
      try {
        const { status, phase, priority } = args as any;
        const where: any = {};
        if (status) where.status = status;
        if (phase) where.phase = phase;
        if (priority) where.priority = priority;

        const projects = await prisma.project.findMany({
          where,
          orderBy: { updatedAt: 'desc' },
          take: 50,
          include: {
            _count: { select: { tasks: true, activities: true } },
            creator: { select: { id: true, name: true, clientType: true } },
          },
        });

        return { projects, total: projects.length };
      } finally {
        await prisma.$disconnect();
      }
    },

    // ---- Task CRUD (project-scoped) ----
    project_create_task: async (args: Record<string, unknown>) => {
      const prisma = getPrisma();
      try {
        const { projectId, title, description, phase, priority, status, parentTaskId, dueDate, tags, agentId, clientType } = args as any;

        // Uniqueness check: prevent duplicate task titles within the same project
        if (projectId && title) {
          const existing = await prisma.task.findFirst({
            where: { projectId: projectId as string, title: title as string },
          });
          if (existing) {
            return { error: `Task "${title}" already exists in this project`, existingTaskId: existing.id };
          }
        }

        const task = await prisma.task.create({
          data: {
            title,
            description: description || null,
            phase: phase || 'implementation',
            priority: priority || 'medium',
            status: status || 'todo',
            projectId: projectId || null,
            parentTaskId: parentTaskId || null,
            dueDate: dueDate ? new Date(dueDate) : null,
            creator: agentId || null,
            source: clientType || 'mcp',
          },
        });

        // Create tags
        if (tags && Array.isArray(tags) && tags.length > 0) {
          for (const tagName of tags) {
            const tag = await prisma.tag.upsert({
              where: { name: tagName },
              update: {},
              create: { name: tagName },
            });
            await prisma.taskTag.create({
              data: { taskId: task.id, tagId: tag.id },
            });
          }
        }

        // Log activity
        await prisma.activityLog.create({
          data: {
            projectId: projectId || null,
            taskId: task.id,
            agentId: agentId || null,
            action: 'task_created',
            phase: phase || 'implementation',
            title: `创建任务「${title}」`,
            details: JSON.stringify({ priority, phase }),
          },
        });

        return { taskId: task.id, title: task.title, phase: task.phase, message: `任务「${title}」创建成功` };
      } finally {
        await prisma.$disconnect();
      }
    },

    project_update_task: async (args: Record<string, unknown>) => {
      const prisma = getPrisma();
      try {
        const { id, agentId, ...updates } = args as any;

        const oldTask = await prisma.task.findUnique({ where: { id } });
        if (!oldTask) return { error: 'Task not found' };

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

        // Log activity
        const changes: string[] = [];
        if (updates.status && updates.status !== oldTask.status) changes.push(`状态: ${oldTask.status} → ${updates.status}`);
        if (updates.progress !== undefined && updates.progress !== oldTask.progress) changes.push(`进度: ${oldTask.progress}% → ${updates.progress}%`);
        if (updates.title && updates.title !== oldTask.title) changes.push(`标题更新`);

        if (changes.length > 0) {
          await prisma.activityLog.create({
            data: {
              projectId: task.projectId || null,
              taskId: task.id,
              agentId: agentId || null,
              action: updates.status === 'done' ? 'task_completed' : 'task_updated',
              phase: task.phase,
              title: `更新任务「${task.title}」: ${changes.join(', ')}`,
            },
          });
        }

        return { taskId: task.id, title: task.title, status: task.status, progress: task.progress };
      } finally {
        await prisma.$disconnect();
      }
    },

    project_list_tasks: async (args: Record<string, unknown>) => {
      const prisma = getPrisma();
      try {
        const { projectId, phase, status, priority, parentTaskId, search } = args as any;
        const where: any = {};
        if (projectId) where.projectId = projectId;
        if (phase) where.phase = phase;
        if (parentTaskId) where.parentTaskId = parentTaskId;
        if (priority) where.priority = priority;
        if (status && Array.isArray(status) && status.length > 0) where.status = { in: status };
        if (search) where.title = { contains: search };

        const tasks = await prisma.task.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: 100,
          include: {
            tags: { include: { tag: true } },
            _count: { select: { subTasks: true } },
          },
        });

        return { tasks, total: tasks.length };
      } finally {
        await prisma.$disconnect();
      }
    },

    // ---- Phase Management ----
    advance_phase: async (args: Record<string, unknown>) => {
      const prisma = getPrisma();
      try {
        const { projectId, phase, summary, agentId } = args as any;

        // Phase guard: validate phase transition order
        const PHASE_ORDER = ['requirements', 'planning', 'architecture', 'implementation', 'testing', 'deployment', 'completed'];
        if (!PHASE_ORDER.includes(phase)) {
          return { error: `Invalid phase "${phase}". Valid phases: ${PHASE_ORDER.join(', ')}` };
        }

        // Read current project state BEFORE updating
        const currentProject = await prisma.project.findUnique({ where: { id: projectId } });
        if (!currentProject) {
          return { error: `Project not found: ${projectId}` };
        }

        const previousPhase = currentProject.phase;
        const currentIndex = PHASE_ORDER.indexOf(previousPhase);
        const targetIndex = PHASE_ORDER.indexOf(phase);

        // Allow: forward progression, staying on same phase, or explicit backward (with warning)
        if (targetIndex < currentIndex) {
          logger.warn(`Phase regression: ${previousPhase} → ${phase} for project ${projectId}`);
        }

        const project = await prisma.project.update({
          where: { id: projectId },
          data: {
            phase,
            ...(phase === 'completed' && { completedAt: new Date(), status: 'completed' }),
          },
        });

        await prisma.activityLog.create({
          data: {
            projectId,
            agentId: agentId || null,
            action: 'phase_changed',
            phase,
            title: `项目阶段推进至「${phase}」`,
            details: JSON.stringify({ summary, previousPhase }),
          },
        });

        // Emit project.phase.changed event
        if (eventBus) {
          eventBus.emit({
            type: 'project.phase.changed',
            payload: {
              projectId,
              phase,
              previousPhase,
            },
            timestamp: new Date(),
            source: 'project',
          });
        }

        return { projectId: project.id, phase: project.phase, previousPhase, message: `阶段已从「${previousPhase}」推进至「${phase}」` };
      } finally {
        await prisma.$disconnect();
      }
    },

    // ---- Activity Log ----
    log_activity: async (args: Record<string, unknown>) => {
      const prisma = getPrisma();
      try {
        const { projectId, taskId, agentId, action, phase, title, details } = args as any;

        const log = await prisma.activityLog.create({
          data: {
            projectId: projectId || null,
            taskId: taskId || null,
            agentId: agentId || null,
            action,
            phase: phase || null,
            title,
            details: details ? JSON.stringify(details) : null,
          },
        });

        return { activityId: log.id, action: log.action, title: log.title, createdAt: log.createdAt };
      } finally {
        await prisma.$disconnect();
      }
    },

    get_activity_log: async (args: Record<string, unknown>) => {
      const prisma = getPrisma();
      try {
        const { projectId, taskId, agentId, action, limit } = args as any;
        const where: any = {};
        if (projectId) where.projectId = projectId;
        if (taskId) where.taskId = taskId;
        if (agentId) where.agentId = agentId;
        if (action) where.action = action;

        const logs = await prisma.activityLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: Math.min(limit || 50, 200),
          include: {
            agent: { select: { id: true, name: true, clientType: true } },
            task: { select: { id: true, title: true } },
          },
        });

        return { activities: logs, total: logs.length };
      } finally {
        await prisma.$disconnect();
      }
    },

    // ---- Summary ----
    get_project_summary: async (args: Record<string, unknown>) => {
      const prisma = getPrisma();
      try {
        const { projectId } = args as any;

        const project = await prisma.project.findUnique({ where: { id: projectId } });
        if (!project) return { error: 'Project not found' };

        const tasks = await prisma.task.findMany({ where: { projectId } });
        const activities = await prisma.activityLog.findMany({
          where: { projectId },
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: { agent: { select: { name: true, clientType: true } } },
        });

        const phaseOrder = ['requirements', 'planning', 'architecture', 'implementation', 'testing', 'deployment', 'completed'];
        const currentPhaseIndex = phaseOrder.indexOf(project.phase);
        // Guard: unknown phase returns 0% instead of negative progress
        const overallProgress = currentPhaseIndex >= 0
          ? Math.round((currentPhaseIndex / (phaseOrder.length - 1)) * 100)
          : 0;

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

        // Agent stats
        const agentIds = [...new Set(tasks.map(t => t.creator).filter((v): v is string => Boolean(v)))];
        const agents = await prisma.agent.findMany({
          where: { id: { in: agentIds } },
          select: { id: true, name: true, clientType: true },
        });

        return {
          project: { id: project.id, name: project.name, phase: project.phase, status: project.status, priority: project.priority },
          overallProgress,
          taskStats,
          agents,
          recentActivities: activities,
        };
      } finally {
        await prisma.$disconnect();
      }
    },
  };
}
