// ============================================================
// Workflow-Engine Event Emission Tests (Phase 2 - v2.0.0-alpha.2)
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Observability } from '@/lib/modules/workflow-engine/observability';
import type { EventBus } from '@/lib/core/event-bus';
import type { Logger } from '@/lib/core/logger';

// --- Mocks ---

function createMockEventBus(): EventBus {
  return {
    emit: vi.fn(),
    emitAsync: vi.fn(),
    on: vi.fn(),
    once: vi.fn(),
    off: vi.fn(),
    removeAllListeners: vi.fn(),
    queryEvents: vi.fn(),
    replayEvents: vi.fn(),
    getEventCount: vi.fn(),
  } as any;
}

function createMockLogger(): Logger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(() => createMockLogger()),
  } as any;
}

// --- Tests ---

describe('WorkflowEngine Event Emission', () => {
  let eventBus: EventBus;
  let logger: Logger;
  let observability: Observability;

  beforeEach(() => {
    eventBus = createMockEventBus();
    logger = createMockLogger();
    observability = new Observability(eventBus, logger);
  });

  describe('workflow.triggered event', () => {
    it('should emit workflow.triggered via emitWorkflowEvent', () => {
      observability.emitWorkflowEvent('triggered', {
        workflowId: 'wf-001',
        executionId: 'exec-001',
        triggerType: 'manual',
        triggeredBy: 'user-1',
      });

      expect(eventBus.emit).toHaveBeenCalledTimes(1);
      const call = (eventBus.emit as any).mock.calls[0][0];
      expect(call.type).toBe('workflow.triggered');
      expect(call.source).toBe('workflow-engine');
      expect(call.payload).toMatchObject({
        workflowId: 'wf-001',
        executionId: 'exec-001',
        triggerType: 'manual',
        triggeredBy: 'user-1',
      });
      expect(call.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('workflow.step.completed event', () => {
    it('should emit workflow.step.completed via emitWorkflowEvent', () => {
      observability.emitWorkflowEvent('step.completed', {
        executionId: 'exec-001',
        stepId: 'step-001',
        stepName: 'Create Task',
        durationMs: 1500,
      });

      expect(eventBus.emit).toHaveBeenCalledTimes(1);
      const call = (eventBus.emit as any).mock.calls[0][0];
      expect(call.type).toBe('workflow.step.completed');
      expect(call.source).toBe('workflow-engine');
      expect(call.payload).toMatchObject({
        executionId: 'exec-001',
        stepId: 'step-001',
        stepName: 'Create Task',
        durationMs: 1500,
      });
    });
  });

  describe('workflow.step.failed event', () => {
    it('should emit workflow.step.failed via emitWorkflowEvent', () => {
      observability.emitWorkflowEvent('step.failed', {
        executionId: 'exec-001',
        stepId: 'step-002',
        stepName: 'AI Analyze',
        error: 'Model timeout',
        retryCount: 2,
      });

      expect(eventBus.emit).toHaveBeenCalledTimes(1);
      const call = (eventBus.emit as any).mock.calls[0][0];
      expect(call.type).toBe('workflow.step.failed');
      expect(call.source).toBe('workflow-engine');
      expect(call.payload).toMatchObject({
        executionId: 'exec-001',
        stepId: 'step-002',
        stepName: 'AI Analyze',
        error: 'Model timeout',
        retryCount: 2,
      });
    });
  });

  describe('workflow.completed event', () => {
    it('should emit workflow.completed via emitWorkflowEvent', () => {
      observability.emitWorkflowEvent('completed', {
        executionId: 'exec-001',
        status: 'completed',
      });

      expect(eventBus.emit).toHaveBeenCalledTimes(1);
      const call = (eventBus.emit as any).mock.calls[0][0];
      expect(call.type).toBe('workflow.completed');
      expect(call.source).toBe('workflow-engine');
      expect(call.payload).toMatchObject({
        executionId: 'exec-001',
        status: 'completed',
      });
    });
  });

  describe('workflow.failed event', () => {
    it('should emit workflow.failed via emitWorkflowEvent', () => {
      observability.emitWorkflowEvent('failed', {
        executionId: 'exec-001',
        status: 'failed',
      });

      expect(eventBus.emit).toHaveBeenCalledTimes(1);
      const call = (eventBus.emit as any).mock.calls[0][0];
      expect(call.type).toBe('workflow.failed');
      expect(call.source).toBe('workflow-engine');
      expect(call.payload).toMatchObject({
        executionId: 'exec-001',
        status: 'failed',
      });
    });
  });

  describe('event source consistency', () => {
    it('should always set source to workflow-engine', () => {
      const eventTypes = ['triggered', 'step.completed', 'step.failed', 'completed', 'failed'];

      for (const type of eventTypes) {
        (eventBus.emit as any).mockClear();
        observability.emitWorkflowEvent(type, {});

        const call = (eventBus.emit as any).mock.calls[0][0];
        expect(call.source).toBe('workflow-engine');
      }
    });
  });

  describe('no eventBus', () => {
    it('should not throw when eventBus is not provided', () => {
      const obsNoBus = new Observability(undefined, logger);
      expect(() => {
        obsNoBus.emitWorkflowEvent('triggered', { workflowId: 'wf-001' });
      }).not.toThrow();
    });
  });

  describe('recordStepMetrics emits step.metrics event', () => {
    it('should emit workflow.step.metrics when recording step metrics', () => {
      observability.recordStepMetrics({
        executionId: 'exec-001',
        stepId: 'step-001',
        stepName: 'Create Task',
        stepType: 'create-task',
        durationMs: 500,
        status: 'completed',
      });

      const calls = (eventBus.emit as any).mock.calls;
      const metricsCall = calls.find((c: any) => c[0].type === 'workflow.step.metrics');
      expect(metricsCall).toBeDefined();
      expect(metricsCall[0].payload).toMatchObject({
        executionId: 'exec-001',
        stepId: 'step-001',
        stepName: 'Create Task',
        stepType: 'create-task',
        durationMs: 500,
        status: 'completed',
      });
    });
  });

  describe('recordExecutionStart emits execution.started event', () => {
    it('should emit workflow.execution.started when recording execution start', () => {
      observability.recordExecutionStart({
        executionId: 'exec-001',
        workflowId: 'wf-001',
        workflowName: 'Test Workflow',
        triggerType: 'manual',
        totalSteps: 3,
      });

      const calls = (eventBus.emit as any).mock.calls;
      const startCall = calls.find((c: any) => c[0].type === 'workflow.execution.started');
      expect(startCall).toBeDefined();
      expect(startCall[0].payload).toMatchObject({
        executionId: 'exec-001',
        workflowId: 'wf-001',
        workflowName: 'Test Workflow',
        triggerType: 'manual',
        totalSteps: 3,
      });
    });
  });
});
