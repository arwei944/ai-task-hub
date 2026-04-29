import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Observability } from '@/lib/modules/workflow-engine/observability';

describe('Observability', () => {
  let obs: Observability;
  let mockEventBus: any;
  let mockLogger: any;

  beforeEach(() => {
    mockEventBus = {
      emit: vi.fn(),
    };
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    obs = new Observability(mockEventBus, mockLogger, 100);
  });

  describe('recordStepMetrics', () => {
    it('should record step metrics and emit event', () => {
      obs.recordStepMetrics({
        executionId: 'exec-1',
        stepId: 'step-1',
        stepName: 'Test Step',
        stepType: 'create-task',
        durationMs: 100,
        status: 'completed',
      });

      const metrics = obs.getStepMetrics();
      expect(metrics).toHaveLength(1);
      expect(metrics[0].executionId).toBe('exec-1');
      expect(metrics[0].stepType).toBe('create-task');
      expect(metrics[0].durationMs).toBe(100);
      expect(metrics[0].status).toBe('completed');

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'workflow.step.metrics' }),
      );
    });

    it('should record optional fields', () => {
      obs.recordStepMetrics({
        executionId: 'exec-1',
        stepId: 'step-1',
        stepName: 'Test',
        stepType: 'ai-analyze',
        durationMs: 500,
        status: 'failed',
        tokensUsed: 1000,
        error: 'Something went wrong',
        retryCount: 2,
      });

      const metrics = obs.getStepMetrics();
      expect(metrics[0].tokensUsed).toBe(1000);
      expect(metrics[0].error).toBe('Something went wrong');
      expect(metrics[0].retryCount).toBe(2);
    });
  });

  describe('getStepMetrics - filtering', () => {
    beforeEach(() => {
      obs.recordStepMetrics({
        executionId: 'exec-1', stepId: 's1', stepName: 'A',
        stepType: 'create-task', durationMs: 100, status: 'completed',
      });
      obs.recordStepMetrics({
        executionId: 'exec-2', stepId: 's2', stepName: 'B',
        stepType: 'ai-analyze', durationMs: 200, status: 'failed',
      });
      obs.recordStepMetrics({
        executionId: 'exec-1', stepId: 's3', stepName: 'C',
        stepType: 'create-task', durationMs: 300, status: 'completed',
      });
    });

    it('should filter by executionId', () => {
      const result = obs.getStepMetrics({ executionId: 'exec-1' });
      expect(result).toHaveLength(2);
    });

    it('should filter by stepType', () => {
      const result = obs.getStepMetrics({ stepType: 'create-task' });
      expect(result).toHaveLength(2);
    });

    it('should filter by status', () => {
      const result = obs.getStepMetrics({ status: 'failed' });
      expect(result).toHaveLength(1);
    });

    it('should filter by limit', () => {
      const result = obs.getStepMetrics({ limit: 2 });
      expect(result).toHaveLength(2);
      // Should return the last 2
      expect(result[0].stepId).toBe('s2');
      expect(result[1].stepId).toBe('s3');
    });

    it('should combine multiple filters', () => {
      const result = obs.getStepMetrics({
        executionId: 'exec-1',
        stepType: 'create-task',
      });
      expect(result).toHaveLength(2);
    });

    it('should return empty array when no matches', () => {
      const result = obs.getStepMetrics({ executionId: 'nonexistent' });
      expect(result).toHaveLength(0);
    });
  });

  describe('maxEntries truncation (10000)', () => {
    it('should truncate step metrics when exceeding maxEntries', () => {
      const smallObs = new Observability(undefined, undefined, 5);

      for (let i = 0; i < 8; i++) {
        smallObs.recordStepMetrics({
          executionId: `exec-${i}`,
          stepId: `s-${i}`,
          stepName: `Step ${i}`,
          stepType: 'wait',
          durationMs: i * 10,
          status: 'completed',
        });
      }

      const metrics = smallObs.getStepMetrics();
      expect(metrics).toHaveLength(5);
      // Oldest entries should be removed
      expect(metrics[0].executionId).toBe('exec-3');
      expect(metrics[4].executionId).toBe('exec-7');
    });

    it('should truncate SOLO call history when exceeding maxEntries', () => {
      const smallObs = new Observability(undefined, undefined, 3);

      for (let i = 0; i < 5; i++) {
        smallObs.recordSOLOCall({
          id: `solo-${i}`,
          executionId: `exec-${i}`,
          stepId: `s-${i}`,
          stepName: `Step ${i}`,
          callMode: 'mcp',
          subAgentType: 'explore',
          sessionId: `session-${i}`,
          prompt: `Prompt ${i}`,
          durationMs: 100,
          startedAt: new Date(),
        });
      }

      const history = smallObs.getSOLOCallHistory();
      expect(history).toHaveLength(3);
      expect(history[0].id).toBe('solo-2');
    });

    it('should truncate execution history when exceeding maxEntries', () => {
      const smallObs = new Observability(undefined, undefined, 3);

      for (let i = 0; i < 5; i++) {
        smallObs.recordExecutionStart({
          executionId: `exec-${i}`,
          workflowId: `wf-${i}`,
          workflowName: `Workflow ${i}`,
          triggerType: 'manual',
          totalSteps: 3,
        });
      }

      const metrics = smallObs.getExecutionMetrics();
      expect(metrics).toHaveLength(3);
      expect(metrics[0].executionId).toBe('exec-2');
    });
  });

  describe('recordSOLOCall', () => {
    it('should record SOLO call and log', () => {
      obs.recordSOLOCall({
        id: 'solo-1',
        executionId: 'exec-1',
        stepId: 'step-1',
        stepName: 'AI Step',
        callMode: 'mcp',
        subAgentType: 'explore',
        sessionId: 'session-1',
        prompt: 'Analyze this',
        durationMs: 500,
        startedAt: new Date(),
      });

      const history = obs.getSOLOCallHistory();
      expect(history).toHaveLength(1);
      expect(history[0].callMode).toBe('mcp');
      expect(mockLogger.info).toHaveBeenCalled();
    });

    it('should filter SOLO call history by executionId', () => {
      obs.recordSOLOCall({
        id: 'solo-1', executionId: 'exec-1', stepId: 's1', stepName: 'A',
        callMode: 'mcp', subAgentType: 'explore', sessionId: 'sess-1',
        prompt: 'P1', durationMs: 100, startedAt: new Date(),
      });
      obs.recordSOLOCall({
        id: 'solo-2', executionId: 'exec-2', stepId: 's2', stepName: 'B',
        callMode: 'rest', subAgentType: 'plan', sessionId: 'sess-2',
        prompt: 'P2', durationMs: 200, startedAt: new Date(),
      });

      expect(obs.getSOLOCallHistory({ executionId: 'exec-1' })).toHaveLength(1);
      expect(obs.getSOLOCallHistory({ stepId: 's2' })).toHaveLength(1);
    });
  });

  describe('recordExecutionStart / recordExecutionEnd', () => {
    it('should record execution start and emit event', () => {
      obs.recordExecutionStart({
        executionId: 'exec-1',
        workflowId: 'wf-1',
        workflowName: 'Test Workflow',
        triggerType: 'manual',
        totalSteps: 5,
      });

      const metrics = obs.getExecutionMetrics();
      expect(metrics).toHaveLength(1);
      expect(metrics[0].status).toBe('running');
      expect(metrics[0].totalSteps).toBe(5);
      expect(mockEventBus.emit).toHaveBeenCalled();
    });

    it('should update execution on end', () => {
      obs.recordExecutionStart({
        executionId: 'exec-1',
        workflowId: 'wf-1',
        workflowName: 'Test',
        triggerType: 'manual',
        totalSteps: 5,
      });

      obs.recordExecutionEnd({
        executionId: 'exec-1',
        status: 'completed',
        completedSteps: 5,
        failedSteps: 0,
        totalTokensUsed: 1000,
      });

      const metrics = obs.getExecutionMetrics();
      expect(metrics[0].status).toBe('completed');
      expect(metrics[0].completedSteps).toBe(5);
      expect(metrics[0].totalTokensUsed).toBe(1000);
      expect(metrics[0].durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should handle execution end for unknown execution', () => {
      // Should not throw
      obs.recordExecutionEnd({
        executionId: 'nonexistent',
        status: 'completed',
        completedSteps: 0,
        failedSteps: 0,
      });
    });
  });

  describe('getExecutionMetrics - filtering', () => {
    beforeEach(() => {
      obs.recordExecutionStart({
        executionId: 'exec-1', workflowId: 'wf-1', workflowName: 'W1',
        triggerType: 'manual', totalSteps: 3,
      });
      obs.recordExecutionStart({
        executionId: 'exec-2', workflowId: 'wf-2', workflowName: 'W2',
        triggerType: 'webhook', totalSteps: 2,
      });

      obs.recordExecutionEnd({
        executionId: 'exec-1', status: 'completed', completedSteps: 3, failedSteps: 0,
      });
    });

    it('should filter by workflowId', () => {
      const result = obs.getExecutionMetrics({ workflowId: 'wf-1' });
      expect(result).toHaveLength(1);
    });

    it('should filter by status', () => {
      const result = obs.getExecutionMetrics({ status: 'completed' });
      expect(result).toHaveLength(1);
      const running = obs.getExecutionMetrics({ status: 'running' });
      expect(running).toHaveLength(1);
    });

    it('should filter by limit', () => {
      const result = obs.getExecutionMetrics({ limit: 1 });
      expect(result).toHaveLength(1);
    });
  });

  describe('getWorkflowStats', () => {
    it('should return correct statistics', () => {
      obs.recordExecutionStart({
        executionId: 'exec-1', workflowId: 'wf-1', workflowName: 'W1',
        triggerType: 'manual', totalSteps: 3,
      });
      obs.recordExecutionStart({
        executionId: 'exec-2', workflowId: 'wf-1', workflowName: 'W1',
        triggerType: 'manual', totalSteps: 3,
      });
      obs.recordExecutionEnd({
        executionId: 'exec-1', status: 'completed', completedSteps: 3, failedSteps: 0,
        totalTokensUsed: 500,
      });
      obs.recordExecutionEnd({
        executionId: 'exec-2', status: 'failed', completedSteps: 1, failedSteps: 2,
      });

      const stats = obs.getWorkflowStats('wf-1');
      expect(stats.totalExecutions).toBe(2);
      expect(stats.successRate).toBe(0.5);
    });

    it('should return zeros for unknown workflow', () => {
      const stats = obs.getWorkflowStats('nonexistent');
      expect(stats.totalExecutions).toBe(0);
      expect(stats.successRate).toBe(0);
      expect(stats.avgDurationMs).toBe(0);
      expect(stats.avgTokensUsed).toBe(0);
    });
  });

  describe('getGlobalStats', () => {
    it('should return correct global statistics', () => {
      obs.recordExecutionStart({
        executionId: 'exec-1', workflowId: 'wf-1', workflowName: 'W1',
        triggerType: 'manual', totalSteps: 2,
      });
      obs.recordExecutionEnd({
        executionId: 'exec-1', status: 'completed', completedSteps: 2, failedSteps: 0,
      });

      obs.recordStepMetrics({
        executionId: 'exec-1', stepId: 's1', stepName: 'A',
        stepType: 'wait', durationMs: 100, status: 'completed',
      });
      obs.recordStepMetrics({
        executionId: 'exec-1', stepId: 's2', stepName: 'B',
        stepType: 'wait', durationMs: 200, status: 'completed',
      });

      obs.recordSOLOCall({
        id: 'solo-1', executionId: 'exec-1', stepId: 's1', stepName: 'A',
        callMode: 'mcp', subAgentType: 'explore', sessionId: 'sess-1',
        prompt: 'P', durationMs: 150, startedAt: new Date(),
      });

      const stats = obs.getGlobalStats();
      expect(stats.totalExecutions).toBe(1);
      expect(stats.totalSteps).toBe(2);
      expect(stats.totalSOLOCalls).toBe(1);
      expect(stats.avgStepDurationMs).toBe(150);
      expect(stats.successRate).toBe(1);
    });

    it('should return zeros when no data', () => {
      const stats = obs.getGlobalStats();
      expect(stats.totalExecutions).toBe(0);
      expect(stats.totalSteps).toBe(0);
      expect(stats.totalSOLOCalls).toBe(0);
      expect(stats.avgStepDurationMs).toBe(0);
      expect(stats.successRate).toBe(0);
    });
  });

  describe('emitWorkflowEvent / emitFeedbackEvent', () => {
    it('should emit workflow events via event bus', () => {
      obs.emitWorkflowEvent('test.event', { key: 'value' });
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'workflow.test.event',
          payload: { key: 'value' },
          source: 'workflow-engine',
        }),
      );
    });

    it('should emit feedback events via event bus', () => {
      obs.emitFeedbackEvent('test.feedback', { key: 'value' });
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'feedback.test.feedback',
          payload: { key: 'value' },
        }),
      );
    });

    it('should work without event bus and logger', () => {
      const noDeps = new Observability();
      expect(() => {
        noDeps.emitWorkflowEvent('test', {});
        noDeps.recordStepMetrics({
          executionId: 'e', stepId: 's', stepName: 'S',
          stepType: 'wait', durationMs: 100, status: 'completed',
        });
      }).not.toThrow();
    });
  });
});
