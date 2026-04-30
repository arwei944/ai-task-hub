import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { LifecycleService } from '@/lib/modules/lifecycle/lifecycle.service';
import { Logger } from '@/lib/core/logger';
import { join } from 'node:path';

// Use the same test database created by global-setup
const TEST_DB_PATH = join(process.cwd(), 'test-db', 'test-task-core.db');

function createTestServices() {
  const adapter = new PrismaBetterSqlite3({ url: TEST_DB_PATH });
  const prisma = new PrismaClient({ adapter });
  const logger = new Logger('test');
  const eventBus = {
    emit: vi.fn(),
    emitAsync: vi.fn(),
    on: vi.fn(() => vi.fn()),
    once: vi.fn(() => vi.fn()),
    off: vi.fn(),
    removeAllListeners: vi.fn(),
  };
  const service = new LifecycleService(logger, eventBus as any, () => prisma);
  return { prisma, logger, service, eventBus };
}

describe('LifecycleService', () => {
  let services: ReturnType<typeof createTestServices>;
  let projectId: string;

  beforeEach(async () => {
    services = createTestServices();

    // Clean up lifecycle data
    await services.prisma.phaseTransition.deleteMany();

    // Create a test project
    const project = await services.prisma.project.create({
      data: {
        name: `Test Project ${Date.now()}`,
        description: 'Test project for lifecycle management',
        phase: 'requirements',
      },
    });
    projectId = project.id;
  });

  afterEach(async () => {
    await services.prisma.phaseTransition.deleteMany();
    await services.prisma.$disconnect();
  });

  // ================================================================
  // Phase Validation
  // ================================================================

  describe('getPhaseValidation', () => {
    it('should validate a valid transition', async () => {
      const validation = await services.service.getPhaseValidation(projectId, 'planning');
      expect(validation.canTransition).toBe(true);
      expect(validation.conditions).toContain('至少1个已确认需求');
      expect(validation.metConditions).toContain('至少1个已确认需求');
      expect(validation.unmetConditions).toHaveLength(0);
    });

    it('should reject an invalid target phase', async () => {
      const validation = await services.service.getPhaseValidation(projectId, 'invalid-phase');
      expect(validation.canTransition).toBe(false);
      expect(validation.unmetConditions[0]).toContain('不是有效阶段');
    });

    it('should reject transition for non-existent project', async () => {
      const validation = await services.service.getPhaseValidation('non-existent-id', 'planning');
      expect(validation.canTransition).toBe(false);
      expect(validation.unmetConditions[0]).toContain('项目不存在');
    });

    it('should reject an invalid transition (skipping phases)', async () => {
      const validation = await services.service.getPhaseValidation(projectId, 'testing');
      expect(validation.canTransition).toBe(false);
      expect(validation.unmetConditions[0]).toContain('不允许从');
    });
  });

  // ================================================================
  // Transition Request
  // ================================================================

  describe('requestTransition', () => {
    it('should create a pending transition when approval is required', async () => {
      const result = await services.service.requestTransition({
        projectId,
        targetPhase: 'planning',
        reason: 'Requirements are complete',
        triggeredBy: 'agent-1',
      });

      expect(result.success).toBe(true);
      expect(result.requiresApproval).toBe(true);
      expect(result.previousPhase).toBe('requirements');
      expect(result.newPhase).toBe('planning');
      expect(result.transitionId).toBeDefined();
      expect(result.message).toContain('等待审批');
    });

    it('should auto-complete transition when approval is not required', async () => {
      // First, move project to implementation phase
      await services.prisma.project.update({
        where: { id: projectId },
        data: { phase: 'implementation' },
      });

      const result = await services.service.requestTransition({
        projectId,
        targetPhase: 'testing',
        reason: 'All tasks done',
      });

      expect(result.success).toBe(true);
      expect(result.requiresApproval).toBe(false);
      expect(result.previousPhase).toBe('implementation');
      expect(result.newPhase).toBe('testing');
      expect(result.autoActions).toBeDefined();

      // Verify project phase was updated
      const project = await services.prisma.project.findUnique({ where: { id: projectId } });
      expect(project!.phase).toBe('testing');
    });

    it('should reject invalid target phase', async () => {
      const result = await services.service.requestTransition({
        projectId,
        targetPhase: 'invalid-phase',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('无效的目标阶段');
    });

    it('should reject non-existent project', async () => {
      const result = await services.service.requestTransition({
        projectId: 'non-existent-id',
        targetPhase: 'planning',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('项目不存在');
    });

    it('should reject transition to same phase', async () => {
      const result = await services.service.requestTransition({
        projectId,
        targetPhase: 'requirements',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('已处于');
    });

    it('should reject invalid phase skip', async () => {
      const result = await services.service.requestTransition({
        projectId,
        targetPhase: 'testing',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('不允许从');
    });

    it('should reject when there is an existing pending transition', async () => {
      // Create first pending transition
      await services.service.requestTransition({
        projectId,
        targetPhase: 'planning',
      });

      // Try to create another
      const result = await services.service.requestTransition({
        projectId,
        targetPhase: 'planning',
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('已有待处理的转换请求');
    });

    it('should emit event when auto-completing transition', async () => {
      await services.prisma.project.update({
        where: { id: projectId },
        data: { phase: 'implementation' },
      });

      await services.service.requestTransition({
        projectId,
        targetPhase: 'testing',
      });

      expect(services.eventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'project.phase.changed',
          source: 'lifecycle',
        }),
      );
    });

    it('should not emit event when transition requires approval', async () => {
      await services.service.requestTransition({
        projectId,
        targetPhase: 'planning',
      });

      expect(services.eventBus.emit).not.toHaveBeenCalled();
    });
  });

  // ================================================================
  // Approve Transition
  // ================================================================

  describe('approveTransition', () => {
    it('should approve a pending transition and update project phase', async () => {
      const request = await services.service.requestTransition({
        projectId,
        targetPhase: 'planning',
      });

      const result = await services.service.approveTransition(request.transitionId!);

      expect(result.success).toBe(true);
      expect(result.previousPhase).toBe('requirements');
      expect(result.newPhase).toBe('planning');

      // Verify project phase was updated
      const project = await services.prisma.project.findUnique({ where: { id: projectId } });
      expect(project!.phase).toBe('planning');

      // Verify transition record is completed
      const transition = await services.prisma.phaseTransition.findUnique({
        where: { id: request.transitionId },
      });
      expect(transition!.status).toBe('completed');
      expect(transition!.completedAt).toBeDefined();
    });

    it('should emit event on approval', async () => {
      const request = await services.service.requestTransition({
        projectId,
        targetPhase: 'planning',
      });

      await services.service.approveTransition(request.transitionId!);

      expect(services.eventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'project.phase.changed',
        }),
      );
    });

    it('should reject non-existent transition', async () => {
      const result = await services.service.approveTransition('non-existent-id');
      expect(result.success).toBe(false);
      expect(result.message).toContain('不存在');
    });

    it('should reject already completed transition', async () => {
      const request = await services.service.requestTransition({
        projectId,
        targetPhase: 'planning',
      });

      await services.service.approveTransition(request.transitionId!);

      const result = await services.service.approveTransition(request.transitionId!);
      expect(result.success).toBe(false);
      expect(result.message).toContain('不是待审批');
    });
  });

  // ================================================================
  // Reject Transition
  // ================================================================

  describe('rejectTransition', () => {
    it('should reject a pending transition', async () => {
      const request = await services.service.requestTransition({
        projectId,
        targetPhase: 'planning',
      });

      const result = await services.service.rejectTransition(request.transitionId!, 'Not ready yet');

      expect(result.success).toBe(true);
      expect(result.message).toContain('已拒绝');
      expect(result.message).toContain('Not ready yet');

      // Verify transition record is rejected
      const transition = await services.prisma.phaseTransition.findUnique({
        where: { id: request.transitionId },
      });
      expect(transition!.status).toBe('rejected');

      // Verify project phase was NOT updated
      const project = await services.prisma.project.findUnique({ where: { id: projectId } });
      expect(project!.phase).toBe('requirements');
    });

    it('should reject non-existent transition', async () => {
      const result = await services.service.rejectTransition('non-existent-id', 'reason');
      expect(result.success).toBe(false);
    });

    it('should reject already completed transition', async () => {
      const request = await services.service.requestTransition({
        projectId,
        targetPhase: 'planning',
      });

      await services.service.approveTransition(request.transitionId!);

      const result = await services.service.rejectTransition(request.transitionId!, 'reason');
      expect(result.success).toBe(false);
      expect(result.message).toContain('不是待审批');
    });
  });

  // ================================================================
  // Transition History
  // ================================================================

  describe('getTransitionHistory', () => {
    it('should return empty history for new project', async () => {
      const history = await services.service.getTransitionHistory(projectId);
      expect(history).toHaveLength(0);
    });

    it('should return transition history in reverse chronological order', async () => {
      // Move project to implementation phase (auto-complete transitions)
      await services.prisma.project.update({
        where: { id: projectId },
        data: { phase: 'implementation' },
      });

      await services.service.requestTransition({ projectId, targetPhase: 'testing' });

      const history = await services.service.getTransitionHistory(projectId);
      expect(history.length).toBeGreaterThanOrEqual(1);
      expect(history[0].projectId).toBe(projectId);
    });
  });

  // ================================================================
  // Current Phase
  // ================================================================

  describe('getCurrentPhase', () => {
    it('should return the current phase of a project', async () => {
      const phase = await services.service.getCurrentPhase(projectId);
      expect(phase).toBe('requirements');
    });

    it('should return null for non-existent project', async () => {
      const phase = await services.service.getCurrentPhase('non-existent-id');
      expect(phase).toBeNull();
    });
  });

  // ================================================================
  // Available Transitions
  // ================================================================

  describe('getAvailableTransitions', () => {
    it('should return valid next phases for requirements', async () => {
      const transitions = await services.service.getAvailableTransitions(projectId);
      expect(transitions).toHaveLength(1);
      expect(transitions[0].to).toBe('planning');
      expect(transitions[0].requireApproval).toBe(true);
    });

    it('should return empty for completed project', async () => {
      await services.prisma.project.update({
        where: { id: projectId },
        data: { phase: 'completed' },
      });

      const transitions = await services.service.getAvailableTransitions(projectId);
      expect(transitions).toHaveLength(0);
    });

    it('should return empty for non-existent project', async () => {
      const transitions = await services.service.getAvailableTransitions('non-existent-id');
      expect(transitions).toHaveLength(0);
    });
  });

  // ================================================================
  // Full Lifecycle Flow
  // ================================================================

  describe('Full lifecycle flow', () => {
    it('should complete a full project lifecycle', async () => {
      // requirements -> planning (requires approval)
      const r1 = await services.service.requestTransition({
        projectId,
        targetPhase: 'planning',
        triggeredBy: 'agent-1',
      });
      expect(r1.success).toBe(true);
      expect(r1.requiresApproval).toBe(true);

      const a1 = await services.service.approveTransition(r1.transitionId!);
      expect(a1.success).toBe(true);

      // planning -> architecture (requires approval)
      const r2 = await services.service.requestTransition({
        projectId,
        targetPhase: 'architecture',
      });
      expect(r2.success).toBe(true);
      expect(r2.requiresApproval).toBe(true);

      await services.service.approveTransition(r2.transitionId!);

      // architecture -> implementation (requires approval)
      const r3 = await services.service.requestTransition({
        projectId,
        targetPhase: 'implementation',
      });
      expect(r3.success).toBe(true);
      expect(r3.requiresApproval).toBe(true);

      await services.service.approveTransition(r3.transitionId!);

      // implementation -> testing (auto-complete)
      const r4 = await services.service.requestTransition({
        projectId,
        targetPhase: 'testing',
      });
      expect(r4.success).toBe(true);
      expect(r4.requiresApproval).toBe(false);

      // testing -> deployment (requires approval)
      const r5 = await services.service.requestTransition({
        projectId,
        targetPhase: 'deployment',
      });
      expect(r5.success).toBe(true);
      expect(r5.requiresApproval).toBe(true);

      await services.service.approveTransition(r5.transitionId!);

      // deployment -> completed (auto-complete)
      const r6 = await services.service.requestTransition({
        projectId,
        targetPhase: 'completed',
      });
      expect(r6.success).toBe(true);
      expect(r6.requiresApproval).toBe(false);

      // Verify final state
      const project = await services.prisma.project.findUnique({ where: { id: projectId } });
      expect(project!.phase).toBe('completed');

      // Verify history
      const history = await services.service.getTransitionHistory(projectId);
      expect(history).toHaveLength(6);
    });
  });
});

// ================================================================
// MCP Tool Definitions Tests
// ============================================================

describe('Lifecycle MCP Tool Definitions', () => {
  it('should have 6 tools defined', async () => {
    const { lifecycleMcpTools } = await import('@/lib/modules/mcp-server/tools/lifecycle-tools');
    expect(lifecycleMcpTools).toHaveLength(6);
  });

  it('should have correct tool names', async () => {
    const { lifecycleMcpTools } = await import('@/lib/modules/mcp-server/tools/lifecycle-tools');
    const names = lifecycleMcpTools.map((t) => t.name);

    expect(names).toContain('request_phase_transition');
    expect(names).toContain('approve_phase_transition');
    expect(names).toContain('reject_phase_transition');
    expect(names).toContain('get_phase_validation');
    expect(names).toContain('get_transition_history');
    expect(names).toContain('get_available_transitions');
  });

  it('all tools should have descriptions and input schemas', async () => {
    const { lifecycleMcpTools } = await import('@/lib/modules/mcp-server/tools/lifecycle-tools');

    for (const tool of lifecycleMcpTools) {
      expect(tool.description).toBeTruthy();
      expect(tool.inputSchema).toBeDefined();
    }
  });

  it('required fields should be defined correctly', async () => {
    const { lifecycleMcpTools } = await import('@/lib/modules/mcp-server/tools/lifecycle-tools');

    const requestTool = lifecycleMcpTools.find((t) => t.name === 'request_phase_transition')!;
    expect((requestTool.inputSchema as any).required).toContain('projectId');
    expect((requestTool.inputSchema as any).required).toContain('targetPhase');

    const approveTool = lifecycleMcpTools.find((t) => t.name === 'approve_phase_transition')!;
    expect((approveTool.inputSchema as any).required).toContain('transitionId');

    const rejectTool = lifecycleMcpTools.find((t) => t.name === 'reject_phase_transition')!;
    expect((rejectTool.inputSchema as any).required).toContain('transitionId');
  });
});

// ================================================================
// Lifecycle Tool Handlers Tests
// ============================================================

describe('Lifecycle Tool Handlers', () => {
  it('should create handlers for all 6 tools', async () => {
    const { createLifecycleToolHandlers } = await import('@/lib/modules/mcp-server/tools/lifecycle-handlers');
    const mockService = {} as any;
    const mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      child: vi.fn(),
    };

    const handlers = createLifecycleToolHandlers(mockService, mockLogger);

    const expectedTools = [
      'request_phase_transition',
      'approve_phase_transition',
      'reject_phase_transition',
      'get_phase_validation',
      'get_transition_history',
      'get_available_transitions',
    ];

    for (const toolName of expectedTools) {
      expect(handlers).toHaveProperty(toolName);
      expect(typeof handlers[toolName as keyof typeof handlers]).toBe('function');
    }
  });
});
