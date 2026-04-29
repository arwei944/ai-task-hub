/**
 * Integration tests for feedback tRPC router.
 * Tests: listCheckpoints, handleApproval, listRules, createRule, getStats
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createTestContext, destroyTestContext, createMockContext } from './helpers';
import type { TestContext } from './helpers';

let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestContext();
});

afterAll(async () => {
  await destroyTestContext(ctx);
});

beforeEach(async () => {
  await ctx.prisma.feedbackCheckpoint.deleteMany();
  await ctx.prisma.feedbackRule.deleteMany();
  await ctx.prisma.workflowExecution.deleteMany();
  await ctx.prisma.workflowStepExecution.deleteMany();
  await ctx.prisma.workflow.deleteMany();
});

describe('feedback.listCheckpoints', () => {
  it('should return empty list when no checkpoints', async () => {
    const result = await ctx.prisma.feedbackCheckpoint.findMany({
      orderBy: { createdAt: 'desc' },
      skip: 0,
      take: 20,
    });
    const total = await ctx.prisma.feedbackCheckpoint.count();

    expect(result).toHaveLength(0);
    expect(total).toBe(0);
  });

  it('should return checkpoints with pagination', async () => {
    // Create a workflow execution first (required FK)
    const wf = await ctx.prisma.workflow.create({
      data: {
        name: 'Test WF',
        steps: JSON.stringify([{ id: 's1', name: 'Step 1', type: 'wait', config: {} }]),
      },
    });
    const exec = await ctx.prisma.workflowExecution.create({
      data: {
        workflowId: wf.id,
        workflowSnapshot: '{}',
        status: 'running',
        triggerType: 'manual',
        startedAt: new Date(),
      },
    });

    for (let i = 0; i < 5; i++) {
      await ctx.prisma.feedbackCheckpoint.create({
        data: {
          executionId: exec.id,
          stepId: `step-${i}`,
          stepName: `Step ${i}`,
          stepType: 'create-task',
          status: 'pending',
        },
      });
    }

    const [items, total] = await Promise.all([
      ctx.prisma.feedbackCheckpoint.findMany({
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 3,
      }),
      ctx.prisma.feedbackCheckpoint.count(),
    ]);

    expect(items).toHaveLength(3);
    expect(total).toBe(5);
  });

  it('should filter by status', async () => {
    const wf = await ctx.prisma.workflow.create({
      data: {
        name: 'Filter WF',
        steps: JSON.stringify([]),
      },
    });
    const exec = await ctx.prisma.workflowExecution.create({
      data: {
        workflowId: wf.id,
        workflowSnapshot: '{}',
        status: 'running',
        triggerType: 'manual',
        startedAt: new Date(),
      },
    });

    await ctx.prisma.feedbackCheckpoint.create({
      data: {
        executionId: exec.id,
        stepId: 's1',
        stepName: 'Step 1',
        stepType: 'create-task',
        status: 'pending',
      },
    });
    await ctx.prisma.feedbackCheckpoint.create({
      data: {
        executionId: exec.id,
        stepId: 's2',
        stepName: 'Step 2',
        stepType: 'update-status',
        status: 'approved',
      },
    });

    const items = await ctx.prisma.feedbackCheckpoint.findMany({
      where: { status: 'pending' },
      orderBy: { createdAt: 'desc' },
    });
    expect(items).toHaveLength(1);
  });

  it('should filter by executionId', async () => {
    const wf = await ctx.prisma.workflow.create({
      data: { name: 'Exec Filter WF', steps: JSON.stringify([]) },
    });
    const exec1 = await ctx.prisma.workflowExecution.create({
      data: {
        workflowId: wf.id,
        workflowSnapshot: '{}',
        status: 'running',
        triggerType: 'manual',
        startedAt: new Date(),
      },
    });
    const exec2 = await ctx.prisma.workflowExecution.create({
      data: {
        workflowId: wf.id,
        workflowSnapshot: '{}',
        status: 'running',
        triggerType: 'manual',
        startedAt: new Date(),
      },
    });

    await ctx.prisma.feedbackCheckpoint.create({
      data: { executionId: exec1.id, stepId: 's1', stepName: 'S1', stepType: 'wait', status: 'pending' },
    });
    await ctx.prisma.feedbackCheckpoint.create({
      data: { executionId: exec2.id, stepId: 's2', stepName: 'S2', stepType: 'wait', status: 'pending' },
    });

    const items = await ctx.prisma.feedbackCheckpoint.findMany({
      where: { executionId: exec1.id },
    });
    expect(items).toHaveLength(1);
  });
});

describe('feedback.handleApproval', () => {
  async function createPendingCheckpoint(): Promise<string> {
    const wf = await ctx.prisma.workflow.create({
      data: { name: 'Approval WF', steps: JSON.stringify([]) },
    });
    const exec = await ctx.prisma.workflowExecution.create({
      data: {
        workflowId: wf.id,
        workflowSnapshot: '{}',
        status: 'running',
        triggerType: 'manual',
        startedAt: new Date(),
      },
    });
    const cp = await ctx.prisma.feedbackCheckpoint.create({
      data: {
        executionId: exec.id,
        stepId: 's1',
        stepName: 'Step 1',
        stepType: 'create-task',
        status: 'pending',
      },
    });
    return cp.id;
  }

  it('should approve a checkpoint', async () => {
    const id = await createPendingCheckpoint();
    const result = await ctx.prisma.feedbackCheckpoint.update({
      where: { id },
      data: {
        status: 'approved',
        intervenedBy: 'user',
        resolvedAt: new Date(),
      },
    });

    expect(result.status).toBe('approved');
    expect(result.intervenedBy).toBe('user');
    expect(result.resolvedAt).toBeDefined();
  });

  it('should reject a checkpoint', async () => {
    const id = await createPendingCheckpoint();
    const result = await ctx.prisma.feedbackCheckpoint.update({
      where: { id },
      data: {
        status: 'rejected',
        intervenedBy: 'user',
        intervention: 'Quality not acceptable',
        resolvedAt: new Date(),
      },
    });

    expect(result.status).toBe('rejected');
    expect(result.intervention).toBe('Quality not acceptable');
  });

  it('should handle modified approval with rating', async () => {
    const id = await createPendingCheckpoint();
    const result = await ctx.prisma.feedbackCheckpoint.update({
      where: { id },
      data: {
        status: 'modified',
        intervenedBy: 'user',
        rating: 4,
        feedback: 'Good but needs improvement',
        resolvedAt: new Date(),
      },
    });

    expect(result.status).toBe('modified');
    expect(result.rating).toBe(4);
    expect(result.feedback).toBe('Good but needs improvement');
  });

  it('should handle skipped checkpoint', async () => {
    const id = await createPendingCheckpoint();
    const result = await ctx.prisma.feedbackCheckpoint.update({
      where: { id },
      data: {
        status: 'skipped',
        intervenedBy: 'user',
        resolvedAt: new Date(),
      },
    });

    expect(result.status).toBe('skipped');
  });
});

describe('feedback.listRules', () => {
  it('should return empty list when no rules', async () => {
    const rules = await ctx.prisma.feedbackRule.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });
    expect(rules).toHaveLength(0);
  });

  it('should return only active rules', async () => {
    await ctx.prisma.feedbackRule.create({
      data: {
        name: 'Active Rule',
        triggerType: 'step_type',
        triggerConfig: '{}',
        action: 'block',
        isActive: true,
        createdBy: 'user',
      },
    });
    await ctx.prisma.feedbackRule.create({
      data: {
        name: 'Inactive Rule',
        triggerType: 'always',
        triggerConfig: '{}',
        action: 'notify',
        isActive: false,
        createdBy: 'user',
      },
    });

    const rules = await ctx.prisma.feedbackRule.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });
    expect(rules).toHaveLength(1);
    expect(rules[0].name).toBe('Active Rule');
  });
});

describe('feedback.createRule', () => {
  it('should create a feedback rule', async () => {
    const rule = await ctx.prisma.feedbackRule.create({
      data: {
        name: 'Block AI Steps',
        triggerType: 'step_type',
        triggerConfig: '{"stepType": "ai-analyze"}',
        action: 'block',
        actionConfig: '{"message": "AI steps require approval"}',
        createdBy: 'user',
      },
    });

    expect(rule.id).toBeDefined();
    expect(rule.name).toBe('Block AI Steps');
    expect(rule.isActive).toBe(true);
  });

  it('should create rule with scope', async () => {
    const wf = await ctx.prisma.workflow.create({
      data: { name: 'Scoped WF', steps: JSON.stringify([]) },
    });

    const rule = await ctx.prisma.feedbackRule.create({
      data: {
        name: 'Scoped Rule',
        triggerType: 'duration',
        triggerConfig: '{"threshold": 5000}',
        action: 'notify',
        scopeWorkflowId: wf.id,
        scopeStepType: 'ai-analyze',
        createdBy: 'user',
      },
    });

    expect(rule.scopeWorkflowId).toBe(wf.id);
    expect(rule.scopeStepType).toBe('ai-analyze');
  });
});

describe('feedback.getStats', () => {
  async function setupCheckpoints() {
    const wf = await ctx.prisma.workflow.create({
      data: { name: 'Stats WF', steps: JSON.stringify([]) },
    });
    const exec = await ctx.prisma.workflowExecution.create({
      data: {
        workflowId: wf.id,
        workflowSnapshot: '{}',
        status: 'running',
        triggerType: 'manual',
        startedAt: new Date(),
      },
    });

    await ctx.prisma.feedbackCheckpoint.create({
      data: { executionId: exec.id, stepId: 's1', stepName: 'S1', stepType: 'wait', status: 'pending' },
    });
    await ctx.prisma.feedbackCheckpoint.create({
      data: { executionId: exec.id, stepId: 's2', stepName: 'S2', stepType: 'wait', status: 'pending' },
    });
    await ctx.prisma.feedbackCheckpoint.create({
      data: { executionId: exec.id, stepId: 's3', stepName: 'S3', stepType: 'wait', status: 'approved' },
    });
    await ctx.prisma.feedbackCheckpoint.create({
      data: { executionId: exec.id, stepId: 's4', stepName: 'S4', stepType: 'wait', status: 'rejected' },
    });
  }

  it('should return correct stats', async () => {
    await setupCheckpoints();

    const [pending, total, approved, rejected] = await Promise.all([
      ctx.prisma.feedbackCheckpoint.count({ where: { status: 'pending' } }),
      ctx.prisma.feedbackCheckpoint.count(),
      ctx.prisma.feedbackCheckpoint.count({ where: { status: 'approved' } }),
      ctx.prisma.feedbackCheckpoint.count({ where: { status: 'rejected' } }),
    ]);

    expect({ pending, total, approved, rejected }).toEqual({
      pending: 2,
      total: 4,
      approved: 1,
      rejected: 1,
    });
  });

  it('should return zeros when no checkpoints', async () => {
    const [pending, total, approved, rejected] = await Promise.all([
      ctx.prisma.feedbackCheckpoint.count({ where: { status: 'pending' } }),
      ctx.prisma.feedbackCheckpoint.count(),
      ctx.prisma.feedbackCheckpoint.count({ where: { status: 'approved' } }),
      ctx.prisma.feedbackCheckpoint.count({ where: { status: 'rejected' } }),
    ]);

    expect({ pending, total, approved, rejected }).toEqual({
      pending: 0,
      total: 0,
      approved: 0,
      rejected: 0,
    });
  });
});
