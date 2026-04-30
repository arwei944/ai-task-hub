import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createContextToolHandlers } from '@/lib/modules/mcp-server/tools/context-handlers';
import { contextMcpTools } from '@/lib/modules/mcp-server/tools/context-tools';
import type { ILogger } from '@/lib/core/types';

function createMockLogger(): ILogger {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(() => createMockLogger()),
  };
}

/**
 * Create a mock Prisma client with configurable data
 */
function createMockPrisma(overrides: Record<string, any> = {}) {
  const defaultProject = {
    id: 'proj-1',
    name: 'Test Project',
    description: 'A test project',
    phase: 'implementation',
    status: 'active',
    priority: 'medium',
    techStack: '["Next.js","Prisma"]',
    createdAt: new Date('2025-01-01'),
    startedAt: new Date('2025-01-02'),
    completedAt: null,
    updatedAt: new Date('2025-01-10'),
  };

  const defaultTasks = [
    { id: 'task-1', projectId: 'proj-1', title: 'Task 1', status: 'todo', priority: 'medium', phase: 'implementation', progress: 0, dueDate: null, tags: [], _count: { subTasks: 0 } },
    { id: 'task-2', projectId: 'proj-1', title: 'Task 2', status: 'in_progress', priority: 'high', phase: 'implementation', progress: 50, dueDate: null, tags: [], _count: { subTasks: 1 } },
    { id: 'task-3', projectId: 'proj-1', title: 'Task 3', status: 'done', priority: 'low', phase: 'implementation', progress: 100, dueDate: null, tags: [], _count: { subTasks: 0 } },
  ];

  const defaultRequirements = [
    { id: 'req-1', projectId: 'proj-1', title: 'Req 1', status: 'draft', type: 'feature', priority: 3, complexity: 'medium', children: [] },
    { id: 'req-2', projectId: 'proj-1', title: 'Req 2', status: 'approved', type: 'bug', priority: 5, complexity: 'high', children: [] },
    { id: 'req-3', projectId: 'proj-1', title: 'Req 3', status: 'implemented', type: 'feature', priority: 2, complexity: 'low', children: [] },
  ];

  const defaultTestCases = [
    { id: 'tc-1', projectId: 'proj-1', title: 'Test 1', status: 'passed', type: 'unit', _count: { executions: 3 } },
    { id: 'tc-2', projectId: 'proj-1', title: 'Test 2', status: 'failed', type: 'integration', _count: { executions: 1 } },
    { id: 'tc-3', projectId: 'proj-1', title: 'Test 3', status: 'draft', type: 'e2e', _count: { executions: 0 } },
  ];

  const defaultActivities = [
    { id: 'act-1', projectId: 'proj-1', action: 'task_created', phase: 'implementation', title: 'Created task', createdAt: new Date('2025-01-10'), agent: { id: 'a1', name: 'Agent1', clientType: 'mcp' } },
    { id: 'act-2', projectId: 'proj-1', action: 'phase_changed', phase: 'implementation', title: 'Phase changed', createdAt: new Date('2025-01-09'), agent: null },
  ];

  const project = overrides.project ?? defaultProject;
  const tasks = overrides.tasks ?? defaultTasks;
  const requirements = overrides.requirements ?? defaultRequirements;
  const testCases = overrides.testCases ?? defaultTestCases;
  const activities = overrides.activities ?? defaultActivities;

  return {
    project: {
      findUnique: vi.fn().mockResolvedValue(project),
    },
    task: {
      findMany: vi.fn().mockResolvedValue(tasks),
      findUnique: vi.fn().mockResolvedValue(null),
    },
    requirement: {
      findMany: vi.fn().mockResolvedValue(requirements),
      findUnique: vi.fn().mockResolvedValue(null),
    },
    testCase: {
      findMany: vi.fn().mockResolvedValue(testCases),
    },
    activityLog: {
      findMany: vi.fn().mockResolvedValue(activities),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    taskDependency: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    taskHistory: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    $disconnect: vi.fn().mockResolvedValue(undefined),
  };
}

describe('Context Tool Definitions', () => {
  it('should export 2 context tools', () => {
    expect(contextMcpTools).toHaveLength(2);
  });

  it('get_project_context should have correct schema', () => {
    const tool = contextMcpTools.find(t => t.name === 'get_project_context')!;
    expect(tool).toBeDefined();
    expect(tool.description).toContain('项目全貌');

    const schema = tool.inputSchema as any;
    expect(schema.required).toContain('projectId');
    expect(schema.properties.projectId).toBeDefined();
    expect(schema.properties.includeTasks).toBeDefined();
    expect(schema.properties.includeRequirements).toBeDefined();
    expect(schema.properties.includeRecentActivity).toBeDefined();
  });

  it('get_task_context should have correct schema', () => {
    const tool = contextMcpTools.find(t => t.name === 'get_task_context')!;
    expect(tool).toBeDefined();
    expect(tool.description).toContain('任务完整上下文');

    const schema = tool.inputSchema as any;
    expect(schema.required).toContain('taskId');
    expect(schema.properties.taskId).toBeDefined();
  });
});

describe('get_project_context handler', () => {
  let logger: ILogger;
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    logger = createMockLogger();
    mockPrisma = createMockPrisma();
  });

  it('should return complete project context structure', async () => {
    const handlers = createContextToolHandlers(logger, undefined, () => mockPrisma as any);

    const result = await handlers.get_project_context({ projectId: 'proj-1' }) as any;

    // Basic info
    expect(result.basicInfo).toBeDefined();
    expect(result.basicInfo.id).toBe('proj-1');
    expect(result.basicInfo.name).toBe('Test Project');
    expect(result.basicInfo.phase).toBe('implementation');
    expect(result.basicInfo.techStack).toEqual(['Next.js', 'Prisma']);

    // Overall progress
    expect(result.overallProgress).toBeGreaterThanOrEqual(0);
    expect(result.overallProgress).toBeLessThanOrEqual(100);

    // Task stats
    expect(result.taskStats).toBeDefined();
    expect(result.taskStats.total).toBe(3);
    expect(result.taskStats.todo).toBe(1);
    expect(result.taskStats.inProgress).toBe(1);
    expect(result.taskStats.done).toBe(1);
    expect(result.taskStats.byPriority).toBeDefined();
    expect(result.taskStats.byPriority.high).toBe(1);

    // Requirement stats
    expect(result.reqStats).toBeDefined();
    expect(result.reqStats.total).toBe(3);
    expect(result.reqStats.draft).toBe(1);
    expect(result.reqStats.approved).toBe(1);
    expect(result.reqStats.implemented).toBe(1);
    expect(result.reqStats.byType).toBeDefined();
    expect(result.reqStats.byType.feature).toBe(2);
    expect(result.reqStats.byType.bug).toBe(1);

    // Test stats
    expect(result.testStats).toBeDefined();
    expect(result.testStats.total).toBe(3);
    expect(result.testStats.passRate).toBe(Math.round((1 / 3) * 100));
    expect(result.testStats.byStatus.passed).toBe(1);
    expect(result.testStats.byStatus.failed).toBe(1);
    expect(result.testStats.byStatus.draft).toBe(1);

    // Recent activities
    expect(result.recentActivities).toBeDefined();
    expect(result.recentActivities).toHaveLength(2);

    // Available transitions
    expect(result.availableTransitions).toBeDefined();
    expect(Array.isArray(result.availableTransitions)).toBe(true);

    // Risks
    expect(result.risks).toBeDefined();
    expect(Array.isArray(result.risks)).toBe(true);

    // Should NOT include task details by default
    expect(result.tasks).toBeUndefined();
    expect(result.requirements).toBeUndefined();
  });

  it('should include task details when includeTasks is true', async () => {
    const handlers = createContextToolHandlers(logger, undefined, () => mockPrisma as any);

    const result = await handlers.get_project_context({
      projectId: 'proj-1',
      includeTasks: true,
    }) as any;

    expect(result.tasks).toBeDefined();
    expect(result.tasks).toHaveLength(3);
    expect(result.tasks[0]).toHaveProperty('id');
    expect(result.tasks[0]).toHaveProperty('title');
    expect(result.tasks[0]).toHaveProperty('status');
  });

  it('should include requirement details when includeRequirements is true', async () => {
    const handlers = createContextToolHandlers(logger, undefined, () => mockPrisma as any);

    const result = await handlers.get_project_context({
      projectId: 'proj-1',
      includeRequirements: true,
    }) as any;

    expect(result.requirements).toBeDefined();
    expect(result.requirements).toHaveLength(3);
    expect(result.requirements[0]).toHaveProperty('id');
    expect(result.requirements[0]).toHaveProperty('title');
    expect(result.requirements[0]).toHaveProperty('status');
  });

  it('should exclude recent activities when includeRecentActivity is false', async () => {
    const handlers = createContextToolHandlers(logger, undefined, () => mockPrisma as any);

    const result = await handlers.get_project_context({
      projectId: 'proj-1',
      includeRecentActivity: false,
    }) as any;

    expect(result.recentActivities).toBeUndefined();
  });

  it('should throw error for non-existent project', async () => {
    const noProjectPrisma = createMockPrisma();
    noProjectPrisma.project.findUnique.mockResolvedValue(null);
    const handlers = createContextToolHandlers(logger, undefined, () => noProjectPrisma as any);

    await expect(
      handlers.get_project_context({ projectId: 'non-existent' }),
    ).rejects.toThrow('Project not found');
  });

  it('should detect overdue tasks as risks', async () => {
    const pastDate = new Date('2024-01-01');
    const tasksWithOverdue = [
      { id: 'task-1', projectId: 'proj-1', title: 'Overdue Task', status: 'in_progress', priority: 'high', phase: 'implementation', progress: 30, dueDate: pastDate, tags: [], _count: { subTasks: 0 } },
      { id: 'task-2', projectId: 'proj-1', title: 'Normal Task', status: 'todo', priority: 'medium', phase: 'implementation', progress: 0, dueDate: null, tags: [], _count: { subTasks: 0 } },
    ];
    const overduePrisma = createMockPrisma({ tasks: tasksWithOverdue });
    const handlers = createContextToolHandlers(logger, undefined, () => overduePrisma as any);

    const result = await handlers.get_project_context({ projectId: 'proj-1' }) as any;

    expect(result.risks).toContain('1 个进行中的任务已过期');
  });

  it('should detect urgent todo tasks as risks', async () => {
    const urgentTasks = [
      { id: 'task-1', projectId: 'proj-1', title: 'Urgent', status: 'todo', priority: 'urgent', phase: 'implementation', progress: 0, dueDate: null, tags: [], _count: { subTasks: 0 } },
      { id: 'task-2', projectId: 'proj-1', title: 'Urgent2', status: 'todo', priority: 'urgent', phase: 'implementation', progress: 0, dueDate: null, tags: [], _count: { subTasks: 0 } },
    ];
    const urgentPrisma = createMockPrisma({ tasks: urgentTasks });
    const handlers = createContextToolHandlers(logger, undefined, () => urgentPrisma as any);

    const result = await handlers.get_project_context({ projectId: 'proj-1' }) as any;

    expect(result.risks).toContain('2 个紧急任务待处理');
  });

  it('should detect failed tests as risks', async () => {
    const failedTests = [
      { id: 'tc-1', projectId: 'proj-1', title: 'Fail 1', status: 'failed', type: 'unit', _count: { executions: 1 } },
      { id: 'tc-2', projectId: 'proj-1', title: 'Fail 2', status: 'failed', type: 'e2e', _count: { executions: 2 } },
    ];
    const failedPrisma = createMockPrisma({ testCases: failedTests });
    const handlers = createContextToolHandlers(logger, undefined, () => failedPrisma as any);

    const result = await handlers.get_project_context({ projectId: 'proj-1' }) as any;

    expect(result.risks).toContain('2 个测试用例失败');
  });

  it('should compute correct overall progress based on phase', async () => {
    // requirements = index 0 -> 0%, implementation = index 3 -> 50%, completed = index 6 -> 100%
    const implProject = { ...createMockPrisma().project, phase: 'requirements' };
    const implPrisma = createMockPrisma({ project: implProject });
    const handlers = createContextToolHandlers(logger, undefined, () => implPrisma as any);

    const result = await handlers.get_project_context({ projectId: 'proj-1' }) as any;
    expect(result.overallProgress).toBe(0);
  });

  it('should disconnect from prisma after execution', async () => {
    const handlers = createContextToolHandlers(logger, undefined, () => mockPrisma as any);

    await handlers.get_project_context({ projectId: 'proj-1' });

    expect(mockPrisma.$disconnect).toHaveBeenCalledTimes(1);
  });
});

describe('get_task_context handler', () => {
  let logger: ILogger;

  beforeEach(() => {
    logger = createMockLogger();
  });

  it('should return complete task context structure', async () => {
    const task = {
      id: 'task-1',
      projectId: 'proj-1',
      title: 'Implement Auth',
      description: 'Implement auth system',
      status: 'in_progress',
      priority: 'high',
      type: 'feature',
      phase: 'implementation',
      progress: 60,
      source: 'mcp',
      assignee: 'agent-1',
      creator: 'agent-1',
      dueDate: new Date('2025-02-01'),
      startedAt: new Date('2025-01-05'),
      completedAt: null,
      createdAt: new Date('2025-01-01'),
      updatedAt: new Date('2025-01-10'),
      tags: [{ tag: { name: 'auth' } }, { tag: { name: 'security' } }],
      project: { id: 'proj-1', name: 'Test Project', phase: 'implementation' },
    };

    const mockPrisma = {
      task: {
        findUnique: vi.fn().mockResolvedValue(task),
        findMany: vi.fn().mockResolvedValue([]),
      },
      taskDependency: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      taskHistory: {
        findMany: vi.fn().mockResolvedValue([
          { field: 'status', oldValue: 'todo', newValue: 'in_progress', actor: 'agent-1', createdAt: new Date('2025-01-05') },
          { field: 'progress', oldValue: '0', newValue: '30', actor: 'agent-1', createdAt: new Date('2025-01-06') },
        ]),
      },
      testCase: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'tc-1', title: 'Auth login test', status: 'passed', type: 'unit', _count: { executions: 2 } },
        ]),
      },
      activityLog: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      $disconnect: vi.fn().mockResolvedValue(undefined),
    };

    const handlers = createContextToolHandlers(logger, undefined, () => mockPrisma as any);
    const result = await handlers.get_task_context({ taskId: 'task-1' }) as any;

    // Basic info
    expect(result.basicInfo).toBeDefined();
    expect(result.basicInfo.id).toBe('task-1');
    expect(result.basicInfo.title).toBe('Implement Auth');
    expect(result.basicInfo.status).toBe('in_progress');
    expect(result.basicInfo.priority).toBe('high');
    expect(result.basicInfo.progress).toBe(60);
    expect(result.basicInfo.tags).toEqual(['auth', 'security']);
    expect(result.basicInfo.project).toEqual({ id: 'proj-1', name: 'Test Project', phase: 'implementation' });

    // Sub tasks
    expect(result.subTasks).toEqual([]);

    // Dependencies
    expect(result.dependencies).toBeDefined();
    expect(result.dependencies.dependsOn).toEqual([]);
    expect(result.dependencies.dependedBy).toEqual([]);

    // History
    expect(result.history).toHaveLength(2);
    expect(result.history[0].field).toBe('status');
    expect(result.history[0].newValue).toBe('in_progress');

    // Related tests
    expect(result.relatedTests).toHaveLength(1);
    expect(result.relatedTests[0].title).toBe('Auth login test');
    expect(result.relatedTests[0].executionCount).toBe(2);

    // Risks
    expect(result.risks).toBeDefined();
    expect(Array.isArray(result.risks)).toBe(true);

    // Related requirement
    expect(result.relatedRequirement).toBeNull();
  });

  it('should include dependency information', async () => {
    const task = {
      id: 'task-1',
      projectId: 'proj-1',
      title: 'Task',
      description: null,
      status: 'todo',
      priority: 'medium',
      type: 'general',
      phase: 'implementation',
      progress: 0,
      source: 'manual',
      assignee: null,
      creator: null,
      dueDate: null,
      startedAt: null,
      completedAt: null,
      createdAt: new Date('2025-01-01'),
      updatedAt: new Date('2025-01-01'),
      tags: [],
      project: null,
    };

    const mockPrisma = {
      task: {
        findUnique: vi.fn().mockResolvedValue(task),
        findMany: vi.fn().mockResolvedValue([
          { id: 'sub-1', title: 'Sub task', status: 'todo', priority: 'medium', progress: 0 },
        ]),
      },
      taskDependency: {
        findMany: vi.fn()
          .mockResolvedValueOnce([
            { dependsOn: { id: 'dep-1', title: 'Dependency 1', status: 'done', priority: 'high' } },
            { dependsOn: { id: 'dep-2', title: 'Dependency 2', status: 'in_progress', priority: 'medium' } },
          ])
          .mockResolvedValueOnce([
            { task: { id: 'follower-1', title: 'Follower 1', status: 'todo', priority: 'low' } },
          ]),
      },
      taskHistory: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      testCase: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      activityLog: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      $disconnect: vi.fn().mockResolvedValue(undefined),
    };

    const handlers = createContextToolHandlers(logger, undefined, () => mockPrisma as any);
    const result = await handlers.get_task_context({ taskId: 'task-1' }) as any;

    expect(result.dependencies.dependsOn).toHaveLength(2);
    expect(result.dependencies.dependsOn[0].title).toBe('Dependency 1');
    expect(result.dependencies.dependedBy).toHaveLength(1);
    expect(result.dependencies.dependedBy[0].title).toBe('Follower 1');

    expect(result.subTasks).toHaveLength(1);
    expect(result.subTasks[0].title).toBe('Sub task');
  });

  it('should detect blocked dependents as risk', async () => {
    const task = {
      id: 'task-1',
      projectId: 'proj-1',
      title: 'Blocking Task',
      description: null,
      status: 'in_progress',
      priority: 'high',
      type: 'general',
      phase: 'implementation',
      progress: 30,
      source: 'manual',
      assignee: null,
      creator: null,
      dueDate: null,
      startedAt: null,
      completedAt: null,
      createdAt: new Date('2025-01-01'),
      updatedAt: new Date('2025-01-01'),
      tags: [],
      project: null,
    };

    const mockPrisma = {
      task: {
        findUnique: vi.fn().mockResolvedValue(task),
        findMany: vi.fn().mockResolvedValue([]),
      },
      taskDependency: {
        findMany: vi.fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([
            { task: { id: 'f1', title: 'F1', status: 'todo', priority: 'low' } },
            { task: { id: 'f2', title: 'F2', status: 'todo', priority: 'medium' } },
          ]),
      },
      taskHistory: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      testCase: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      activityLog: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      $disconnect: vi.fn().mockResolvedValue(undefined),
    };

    const handlers = createContextToolHandlers(logger, undefined, () => mockPrisma as any);
    const result = await handlers.get_task_context({ taskId: 'task-1' }) as any;

    expect(result.risks).toContain('2 个后续任务被阻塞');
  });

  it('should detect pending dependencies as risk', async () => {
    const task = {
      id: 'task-1',
      projectId: 'proj-1',
      title: 'Task with deps',
      description: null,
      status: 'todo',
      priority: 'medium',
      type: 'general',
      phase: 'implementation',
      progress: 0,
      source: 'manual',
      assignee: null,
      creator: null,
      dueDate: null,
      startedAt: null,
      completedAt: null,
      createdAt: new Date('2025-01-01'),
      updatedAt: new Date('2025-01-01'),
      tags: [],
      project: null,
    };

    const mockPrisma = {
      task: {
        findUnique: vi.fn().mockResolvedValue(task),
        findMany: vi.fn().mockResolvedValue([]),
      },
      taskDependency: {
        findMany: vi.fn()
          .mockResolvedValueOnce([
            { dependsOn: { id: 'd1', title: 'Pending Dep', status: 'in_progress', priority: 'high' } },
          ])
          .mockResolvedValueOnce([]),
      },
      taskHistory: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      testCase: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      activityLog: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      $disconnect: vi.fn().mockResolvedValue(undefined),
    };

    const handlers = createContextToolHandlers(logger, undefined, () => mockPrisma as any);
    const result = await handlers.get_task_context({ taskId: 'task-1' }) as any;

    expect(result.risks).toContain('1 个前置任务未完成');
  });

  it('should throw error for non-existent task', async () => {
    const mockPrisma = {
      task: {
        findUnique: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
      },
      taskDependency: { findMany: vi.fn().mockResolvedValue([]) },
      taskHistory: { findMany: vi.fn().mockResolvedValue([]) },
      testCase: { findMany: vi.fn().mockResolvedValue([]) },
      activityLog: { findFirst: vi.fn().mockResolvedValue(null) },
      $disconnect: vi.fn().mockResolvedValue(undefined),
    };

    const handlers = createContextToolHandlers(logger, undefined, () => mockPrisma as any);

    await expect(
      handlers.get_task_context({ taskId: 'non-existent' }),
    ).rejects.toThrow('Task not found');
  });

  it('should disconnect from prisma after execution', async () => {
    const mockPrisma = {
      task: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'task-1', projectId: null, title: 'T', description: null,
          status: 'todo', priority: 'medium', type: 'general', phase: 'implementation',
          progress: 0, source: 'manual', assignee: null, creator: null, dueDate: null,
          startedAt: null, completedAt: null, createdAt: new Date(), updatedAt: new Date(),
          tags: [], project: null,
        }),
        findMany: vi.fn().mockResolvedValue([]),
      },
      taskDependency: { findMany: vi.fn().mockResolvedValue([]) },
      taskHistory: { findMany: vi.fn().mockResolvedValue([]) },
      testCase: { findMany: vi.fn().mockResolvedValue([]) },
      activityLog: { findFirst: vi.fn().mockResolvedValue(null) },
      $disconnect: vi.fn().mockResolvedValue(undefined),
    };

    const handlers = createContextToolHandlers(logger, undefined, () => mockPrisma as any);
    await handlers.get_task_context({ taskId: 'task-1' });

    expect(mockPrisma.$disconnect).toHaveBeenCalledTimes(1);
  });
});
