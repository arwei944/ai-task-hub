/**
 * Shared test helpers for tRPC route integration tests.
 * Uses a file-based SQLite database with schema pushed via prisma db push.
 */
import { execSync } from 'child_process';
import { join } from 'path';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { PrismaClient } from '@/generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { TaskService } from '@/lib/modules/task-core/task.service';
import { TaskRepository } from '@/lib/modules/task-core/task.repository';
import { TaskHistoryRepository } from '@/lib/modules/task-core/task-history.repository';
import { TaskDependencyRepository } from '@/lib/modules/task-core/task-dependency.repository';
import { TaskProgressService } from '@/lib/modules/task-core/task-progress.service';
import { AgentService } from '@/lib/modules/agent-collab/agent.service';
import { AgentRepository } from '@/lib/modules/agent-collab/agent.repository';
import { AgentOperationRepository } from '@/lib/modules/agent-collab/agent-operation.repository';
import { PermissionService } from '@/lib/modules/agent-collab/permission.service';
import { AgentOperationLogger } from '@/lib/modules/agent-collab/operation-logger';
import { WorkflowService } from '@/lib/modules/workflow-engine/workflow.service';
import { StatisticsService } from '@/lib/modules/dashboard/statistics.service';
import { NotificationRepository } from '@/lib/modules/notifications/notification.repository';
import { WebPushService } from '@/lib/modules/notifications/web-push.service';
import { PluginLoader } from '@/lib/modules/plugins/plugin-loader';
import { EventBus } from '@/lib/core/event-bus';
import { Logger } from '@/lib/core/logger';

export interface TestContext {
  prisma: PrismaClient;
  eventBus: EventBus;
  logger: Logger;
  dbPath: string;
  tmpDir: string;
  taskService: TaskService;
  taskRepo: TaskRepository;
  historyRepo: TaskHistoryRepository;
  depRepo: TaskDependencyRepository;
  progressService: TaskProgressService;
  agentService: AgentService;
  agentRepo: AgentRepository;
  operationRepo: AgentOperationRepository;
  permissionService: PermissionService;
  operationLogger: AgentOperationLogger;
  workflowService: WorkflowService;
  statsService: StatisticsService;
  notificationRepo: NotificationRepository;
  pushService: WebPushService;
  pluginLoader: PluginLoader;
}

function createTempDbPath(): { dbPath: string; tmpDir: string } {
  const tmpDir = mkdtempSync(join(tmpdir(), 'ai-task-hub-test-'));
  const dbPath = join(tmpDir, 'test.db');
  return { dbPath, tmpDir };
}

function pushSchema(dbPath: string): void {
  const projectRoot = join(__dirname, '..', '..');
  execSync(
    `npx prisma db push --url "file:${dbPath}" --accept-data-loss 2>&1`,
    {
      stdio: 'pipe',
      cwd: projectRoot,
    },
  );
}

export async function createTestContext(): Promise<TestContext> {
  const { dbPath, tmpDir } = createTempDbPath();

  // Push schema to the test database
  pushSchema(dbPath);

  const adapter = new PrismaBetterSqlite3({ url: dbPath });
  const prisma = new PrismaClient({ adapter });
  const eventBus = new EventBus();
  const logger = new Logger('test');

  const taskRepo = new TaskRepository(prisma);
  const historyRepo = new TaskHistoryRepository(prisma);
  const depRepo = new TaskDependencyRepository(prisma);
  const progressService = new TaskProgressService(taskRepo, logger);
  const taskService = new TaskService(taskRepo, historyRepo, depRepo, progressService, eventBus, logger);

  const agentRepo = new AgentRepository(prisma);
  const operationRepo = new AgentOperationRepository(prisma);
  const agentService = new AgentService(agentRepo, operationRepo, eventBus, logger);
  const permissionService = new PermissionService(taskRepo, logger);
  const operationLogger = new AgentOperationLogger(operationRepo, eventBus, logger);

  const workflowService = new WorkflowService(prisma, taskService, logger);
  const statsService = new StatisticsService(prisma, logger);
  const notificationRepo = new NotificationRepository(prisma);
  const pushService = new WebPushService(logger);
  const pluginLoader = new PluginLoader(prisma, eventBus, logger);

  return {
    prisma,
    eventBus,
    logger,
    dbPath,
    tmpDir,
    taskService,
    taskRepo,
    historyRepo,
    depRepo,
    progressService,
    agentService,
    agentRepo,
    operationRepo,
    permissionService,
    operationLogger,
    workflowService,
    statsService,
    notificationRepo,
    pushService,
    pluginLoader,
  };
}

export async function destroyTestContext(ctx: TestContext): Promise<void> {
  await ctx.prisma.$disconnect();
  try {
    rmSync(ctx.tmpDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}

/** Create a mock tRPC context with a user */
export function createMockContext(user: { id: string; role?: string } = { id: 'test-user-id', role: 'admin' }) {
  return {
    user: {
      id: user.id,
      username: 'test-user',
      email: 'test@example.com',
      role: user.role ?? 'admin',
    },
    req: undefined as unknown as Request,
  } as any;
}
