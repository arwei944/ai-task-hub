// ============================================================
// Phase 4 - MCP 使用测试 (S-MCP 精选 3 个)
// ============================================================
//
// 通过直接调用 MCP 工具函数验证行为
// 需要数据库访问
// 不修改源码
//

import { execSync } from 'child_process';
import { join } from 'path';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { PrismaClient } from '@/generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { createProjectToolHandlers } from '@/lib/modules/mcp-server/tools/project-handlers';
import { Logger } from '@/lib/core/logger';

interface McpTestContext {
  prisma: PrismaClient;
  logger: Logger;
  dbPath: string;
  tmpDir: string;
  handlers: ReturnType<typeof createProjectToolHandlers>;
}

function createTempDbPath(): { dbPath: string; tmpDir: string } {
  const tmpDir = mkdtempSync(join(tmpdir(), 'mcp-test-'));
  const dbPath = join(tmpDir, 'test.db');
  return { dbPath, tmpDir };
}

function pushSchema(dbPath: string): void {
  const projectRoot = join(__dirname, '..', '..', '..');
  execSync(
    `npx prisma db push --url "file:${dbPath}" --accept-data-loss 2>&1`,
    {
      stdio: 'pipe',
      cwd: projectRoot,
    },
  );
}

async function createMcpTestContext(): Promise<McpTestContext> {
  const { dbPath, tmpDir } = createTempDbPath();
  pushSchema(dbPath);

  const adapter = new PrismaBetterSqlite3({ url: dbPath });
  const prisma = new PrismaClient({ adapter });
  const logger = new Logger('mcp-test');

  // 设置 DATABASE_URL 环境变量，让 getPrisma() 使用测试数据库
  process.env.DATABASE_URL = `file:${dbPath}`;

  const handlers = createProjectToolHandlers(logger);

  return { prisma, logger, dbPath, tmpDir, handlers };
}

async function destroyMcpTestContext(ctx: McpTestContext): Promise<void> {
  await ctx.prisma.$disconnect();
  try {
    rmSync(ctx.tmpDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}

describe('S-MCP: MCP 使用测试', () => {
  let ctx: McpTestContext;

  beforeAll(async () => {
    ctx = await createMcpTestContext();
  }, 30000);

  afterAll(async () => {
    await destroyMcpTestContext(ctx);
  });

  // -------------------------------------------------------
  // S-MCP-02: 同名任务不可重复创建（修复后行为）
  // -------------------------------------------------------
  describe('S-MCP-02: 同名任务不可重复创建', () => {
    it('使用相同 title 和 projectId 创建两个任务时，第二个应返回错误（唯一性检查）', async () => {
      // 先创建一个项目
      const projectResult = await ctx.handlers.create_project({
        name: 'MCP Test Project',
        description: 'Test project for MCP',
        priority: 'medium',
      }) as any;

      expect(projectResult.projectId).toBeDefined();
      const projectId = projectResult.projectId;

      // 创建第一个任务
      const task1 = await ctx.handlers.project_create_task({
        projectId,
        title: '重复任务标题',
        description: '第一个任务',
        phase: 'implementation',
        priority: 'high',
      }) as any;

      expect(task1.taskId).toBeDefined();
      expect(task1.title).toBe('重复任务标题');

      // 创建同名第二个任务 - 应返回错误（唯一性检查）
      const task2 = await ctx.handlers.project_create_task({
        projectId,
        title: '重复任务标题',
        description: '第二个同名任务',
        phase: 'implementation',
        priority: 'high',
      }) as any;

      // 修复后行为：同名任务被拒绝，返回已有任务信息
      // handler 返回 { taskId, title, phase, message, existingTaskId }
      expect(task2.message).toBeDefined();
      expect(task2.existingTaskId).toBe(task1.taskId);
    });
  });

  // -------------------------------------------------------
  // S-MCP-04: 活动日志 taskId 为 null（验证当前行为）
  // -------------------------------------------------------
  describe('S-MCP-04: 活动日志 taskId 为 null', () => {
    it('create_project 创建的活动日志中 taskId 应为 null', async () => {
      const projectResult = await ctx.handlers.create_project({
        name: 'Activity Log Test Project',
        description: 'Testing activity log taskId null',
      }) as any;

      expect(projectResult.projectId).toBeDefined();

      // 查询活动日志
      const logResult = await ctx.handlers.get_activity_log({
        projectId: projectResult.projectId,
        action: 'project_created',
      }) as any;

      expect(logResult.activities).toBeDefined();
      expect(logResult.activities.length).toBeGreaterThanOrEqual(1);

      const projectCreatedLog = logResult.activities.find(
        (a: any) => a.action === 'project_created'
      );
      expect(projectCreatedLog).toBeDefined();
      // 当前行为：create_project 的活动日志没有 taskId
      expect(projectCreatedLog.taskId).toBeNull();
    });

    it('project_create_task 创建的活动日志中 taskId 应不为 null', async () => {
      // 先创建项目
      const projectResult = await ctx.handlers.create_project({
        name: 'Task Activity Log Project',
      }) as any;

      // 创建任务
      const taskResult = await ctx.handlers.project_create_task({
        projectId: projectResult.projectId,
        title: '测试任务活动日志',
        phase: 'implementation',
      }) as any;

      expect(taskResult.taskId).toBeDefined();

      // 查询活动日志
      const logResult = await ctx.handlers.get_activity_log({
        projectId: projectResult.projectId,
        action: 'task_created',
      }) as any;

      expect(logResult.activities).toBeDefined();

      const taskCreatedLog = logResult.activities.find(
        (a: any) => a.action === 'task_created'
      );
      expect(taskCreatedLog).toBeDefined();
      // task_created 活动日志应有 taskId
      expect(taskCreatedLog.taskId).toBe(taskResult.taskId);
    });
  });

  // -------------------------------------------------------
  // S-MCP-05: 推进阶段但不更新任务时 overallProgress vs completionRate 矛盾
  // -------------------------------------------------------
  describe('S-MCP-05: overallProgress vs completionRate 矛盾', () => {
    it('推进阶段到 testing 但任务未完成时，overallProgress 应大于 completionRate', async () => {
      // 创建项目（默认 phase 为 requirements）
      const projectResult = await ctx.handlers.create_project({
        name: 'Progress Contradiction Project',
        description: 'Testing overallProgress vs completionRate',
      }) as any;

      const projectId = projectResult.projectId;

      // 创建 10 个任务，全部为 todo 状态
      for (let i = 0; i < 10; i++) {
        await ctx.handlers.project_create_task({
          projectId,
          title: `任务 ${i + 1}`,
          phase: 'implementation',
          status: 'todo',
        });
      }

      // 推进阶段到 testing（跳过中间阶段）
      await ctx.handlers.advance_phase({
        projectId,
        phase: 'testing',
        summary: '直接推进到测试阶段',
      });

      // 获取项目摘要
      const summary = await ctx.handlers.get_project_summary({
        projectId,
      }) as any;

      expect(summary.overallProgress).toBeDefined();
      expect(summary.taskStats).toBeDefined();
      expect(summary.taskStats.completionRate).toBeDefined();

      // overallProgress 基于 phaseOrder.indexOf('testing') / 6 * 100 = 4/6 * 100 = 67%
      expect(summary.overallProgress).toBe(67);

      // completionRate = 0/10 * 100 = 0%（所有任务都是 todo）
      expect(summary.taskStats.completionRate).toBe(0);

      // 矛盾：overallProgress(67%) 远大于 completionRate(0%)
      // 这是已知问题：推进阶段不检查任务完成状态
      expect(summary.overallProgress).toBeGreaterThan(summary.taskStats.completionRate);
    });

    it('推进阶段到 completed 但没有完成的任务时，overallProgress=100 但 completionRate=0', async () => {
      const projectResult = await ctx.handlers.create_project({
        name: 'Completed Phase Project',
      }) as any;

      const projectId = projectResult.projectId;

      // 创建 5 个任务，全部 todo
      for (let i = 0; i < 5; i++) {
        await ctx.handlers.project_create_task({
          projectId,
          title: `未完成任务 ${i + 1}`,
          phase: 'implementation',
          status: 'todo',
        });
      }

      // 直接推进到 completed
      await ctx.handlers.advance_phase({
        projectId,
        phase: 'completed',
        summary: '直接标记完成',
      });

      const summary = await ctx.handlers.get_project_summary({ projectId }) as any;

      // overallProgress = 100%（phase 是 completed）
      expect(summary.overallProgress).toBe(100);

      // completionRate = 0%（没有任务完成）
      expect(summary.taskStats.completionRate).toBe(0);

      // 严重矛盾：项目显示 100% 进度但 0% 任务完成率
      expect(summary.overallProgress).toBe(100);
      expect(summary.taskStats.completionRate).toBe(0);
    });
  });
});
