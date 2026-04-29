import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FeedbackRuleEngine } from '@/lib/modules/workflow-engine/feedback/rule-engine';
import type { WorkflowStep, WorkflowContext } from '@/lib/modules/workflow-engine/types';

function makeMockPrisma(rules: any[] = []) {
  return {
    feedbackRule: {
      findMany: vi.fn().mockResolvedValue(rules),
    },
  };
}

function makeStep(overrides: Partial<WorkflowStep> = {}): WorkflowStep {
  return {
    id: 'step-1',
    name: 'Test Step',
    type: 'create-task',
    config: {},
    ...overrides,
  };
}

function makeContext(overrides: Partial<WorkflowContext> = {}): WorkflowContext {
  return {
    _executionId: 'exec-1',
    _stepId: 'step-1',
    ...overrides,
  };
}

describe('FeedbackRuleEngine', () => {
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = makeMockPrisma();
  });

  describe('evaluate - pre-execute', () => {
    it('should return proceed when no rules match', async () => {
      const engine = new FeedbackRuleEngine(mockPrisma);
      const result = await engine.evaluate({
        step: makeStep(),
        context: makeContext(),
        executionId: 'exec-1',
      });
      expect(result.action).toBe('proceed');
    });

    it('should match step_type trigger', async () => {
      const rules = [{
        name: 'Block AI steps',
        triggerType: 'step_type',
        triggerConfig: JSON.stringify({ stepTypes: ['ai-analyze'] }),
        action: 'block',
        scopeWorkflowId: null,
        scopeStepType: null,
      }];
      mockPrisma = makeMockPrisma(rules);
      const engine = new FeedbackRuleEngine(mockPrisma);

      const result = await engine.evaluate({
        step: makeStep({ type: 'ai-analyze' }),
        context: makeContext(),
        executionId: 'exec-1',
      });

      expect(result.action).toBe('block');
      expect(result.reason).toContain('Block AI steps');
    });

    it('should not match step_type when step type not in list', async () => {
      const rules = [{
        name: 'Block AI steps',
        triggerType: 'step_type',
        triggerConfig: JSON.stringify({ stepTypes: ['ai-analyze'] }),
        action: 'block',
        scopeWorkflowId: null,
        scopeStepType: null,
      }];
      mockPrisma = makeMockPrisma(rules);
      const engine = new FeedbackRuleEngine(mockPrisma);

      const result = await engine.evaluate({
        step: makeStep({ type: 'create-task' }),
        context: makeContext(),
        executionId: 'exec-1',
      });

      expect(result.action).toBe('proceed');
    });

    it('should match always trigger', async () => {
      const rules = [{
        name: 'Always notify',
        triggerType: 'always',
        triggerConfig: '{}',
        action: 'notify',
        scopeWorkflowId: null,
        scopeStepType: null,
      }];
      mockPrisma = makeMockPrisma(rules);
      const engine = new FeedbackRuleEngine(mockPrisma);

      const result = await engine.evaluate({
        step: makeStep(),
        context: makeContext(),
        executionId: 'exec-1',
      });

      expect(result.action).toBe('notify');
      expect(result.reason).toContain('Always notify');
    });

    it('should skip duration trigger in pre-execute', async () => {
      const rules = [{
        name: 'Duration check',
        triggerType: 'duration',
        triggerConfig: JSON.stringify({ thresholdMs: 1000 }),
        action: 'block',
        scopeWorkflowId: null,
        scopeStepType: null,
      }];
      mockPrisma = makeMockPrisma(rules);
      const engine = new FeedbackRuleEngine(mockPrisma);

      const result = await engine.evaluate({
        step: makeStep(),
        context: makeContext(),
        executionId: 'exec-1',
      });

      expect(result.action).toBe('proceed');
    });

    it('should skip token_cost trigger in pre-execute', async () => {
      const rules = [{
        name: 'Token check',
        triggerType: 'token_cost',
        triggerConfig: JSON.stringify({ thresholdTokens: 1000 }),
        action: 'block',
        scopeWorkflowId: null,
        scopeStepType: null,
      }];
      mockPrisma = makeMockPrisma(rules);
      const engine = new FeedbackRuleEngine(mockPrisma);

      const result = await engine.evaluate({
        step: makeStep(),
        context: makeContext(),
        executionId: 'exec-1',
      });

      expect(result.action).toBe('proceed');
    });

    it('should respect scopeStepType filter', async () => {
      const rules = [{
        name: 'Block create-task',
        triggerType: 'always',
        triggerConfig: '{}',
        action: 'block',
        scopeWorkflowId: null,
        scopeStepType: 'create-task',
      }];
      mockPrisma = makeMockPrisma(rules);
      const engine = new FeedbackRuleEngine(mockPrisma);

      // Matching step type
      const result1 = await engine.evaluate({
        step: makeStep({ type: 'create-task' }),
        context: makeContext(),
        executionId: 'exec-1',
      });
      expect(result1.action).toBe('block');

      // Non-matching step type
      const result2 = await engine.evaluate({
        step: makeStep({ type: 'wait' }),
        context: makeContext(),
        executionId: 'exec-1',
      });
      expect(result2.action).toBe('proceed');
    });

    it('should return proceed for invalid triggerConfig JSON', async () => {
      const rules = [{
        name: 'Bad config',
        triggerType: 'step_type',
        triggerConfig: 'not-json',
        action: 'block',
        scopeWorkflowId: null,
        scopeStepType: null,
      }];
      mockPrisma = makeMockPrisma(rules);
      const engine = new FeedbackRuleEngine(mockPrisma);

      const result = await engine.evaluate({
        step: makeStep(),
        context: makeContext(),
        executionId: 'exec-1',
      });

      expect(result.action).toBe('proceed');
    });

    it('should stop at first matching rule', async () => {
      const rules = [
        {
          name: 'First rule',
          triggerType: 'always',
          triggerConfig: '{}',
          action: 'block',
          scopeWorkflowId: null,
          scopeStepType: null,
        },
        {
          name: 'Second rule',
          triggerType: 'always',
          triggerConfig: '{}',
          action: 'notify',
          scopeWorkflowId: null,
          scopeStepType: null,
        },
      ];
      mockPrisma = makeMockPrisma(rules);
      const engine = new FeedbackRuleEngine(mockPrisma);

      const result = await engine.evaluate({
        step: makeStep(),
        context: makeContext(),
        executionId: 'exec-1',
      });

      expect(result.action).toBe('block');
      expect(result.reason).toContain('First rule');
    });
  });

  describe('evaluatePostExecute - post-execute', () => {
    it('should match duration trigger when exceeded', async () => {
      const rules = [{
        name: 'Duration check',
        triggerType: 'duration',
        triggerConfig: JSON.stringify({ thresholdMs: 1000 }),
        action: 'notify',
        scopeWorkflowId: null,
        scopeStepType: null,
      }];
      mockPrisma = makeMockPrisma(rules);
      const engine = new FeedbackRuleEngine(mockPrisma);

      const result = await engine.evaluatePostExecute({
        step: makeStep(),
        context: makeContext(),
        executionId: 'exec-1',
        durationMs: 5000,
      });

      expect(result.action).toBe('notify');
      expect(result.reason).toContain('5000ms exceeded threshold 1000ms');
    });

    it('should not match duration trigger when under threshold', async () => {
      const rules = [{
        name: 'Duration check',
        triggerType: 'duration',
        triggerConfig: JSON.stringify({ thresholdMs: 10000 }),
        action: 'notify',
        scopeWorkflowId: null,
        scopeStepType: null,
      }];
      mockPrisma = makeMockPrisma(rules);
      const engine = new FeedbackRuleEngine(mockPrisma);

      const result = await engine.evaluatePostExecute({
        step: makeStep(),
        context: makeContext(),
        executionId: 'exec-1',
        durationMs: 500,
      });

      expect(result.action).toBe('proceed');
    });

    it('should match token_cost trigger when exceeded', async () => {
      const rules = [{
        name: 'Token check',
        triggerType: 'token_cost',
        triggerConfig: JSON.stringify({ thresholdTokens: 5000 }),
        action: 'block',
        scopeWorkflowId: null,
        scopeStepType: null,
      }];
      mockPrisma = makeMockPrisma(rules);
      const engine = new FeedbackRuleEngine(mockPrisma);

      const result = await engine.evaluatePostExecute({
        step: makeStep(),
        context: makeContext(),
        executionId: 'exec-1',
        durationMs: 100,
        tokensUsed: 10000,
      });

      expect(result.action).toBe('block');
      expect(result.reason).toContain('10000 exceeded threshold 5000');
    });

    it('should not match token_cost when tokens undefined', async () => {
      const rules = [{
        name: 'Token check',
        triggerType: 'token_cost',
        triggerConfig: JSON.stringify({ thresholdTokens: 1000 }),
        action: 'block',
        scopeWorkflowId: null,
        scopeStepType: null,
      }];
      mockPrisma = makeMockPrisma(rules);
      const engine = new FeedbackRuleEngine(mockPrisma);

      const result = await engine.evaluatePostExecute({
        step: makeStep(),
        context: makeContext(),
        executionId: 'exec-1',
        durationMs: 100,
      });

      expect(result.action).toBe('proceed');
    });

    it('should match error trigger with regex pattern', async () => {
      const rules = [{
        name: 'Error pattern',
        triggerType: 'error',
        triggerConfig: JSON.stringify({ errorPatterns: ['timeout', 'rate.?limit'] }),
        action: 'notify',
        scopeWorkflowId: null,
        scopeStepType: null,
      }];
      mockPrisma = makeMockPrisma(rules);
      const engine = new FeedbackRuleEngine(mockPrisma);

      const result = await engine.evaluatePostExecute({
        step: makeStep(),
        context: makeContext(),
        executionId: 'exec-1',
        durationMs: 100,
        errorMessage: 'Request timeout after 30s',
      });

      expect(result.action).toBe('notify');
      expect(result.reason).toContain('timeout');
    });

    it('should match error trigger with regex special chars', async () => {
      const rules = [{
        name: 'Error pattern',
        triggerType: 'error',
        triggerConfig: JSON.stringify({ errorPatterns: ['rate.?limit'] }),
        action: 'block',
        scopeWorkflowId: null,
        scopeStepType: null,
      }];
      mockPrisma = makeMockPrisma(rules);
      const engine = new FeedbackRuleEngine(mockPrisma);

      const result = await engine.evaluatePostExecute({
        step: makeStep(),
        context: makeContext(),
        executionId: 'exec-1',
        durationMs: 100,
        errorMessage: 'rate limit exceeded',
      });

      expect(result.action).toBe('block');
    });

    it('should not match error trigger when no error message', async () => {
      const rules = [{
        name: 'Error pattern',
        triggerType: 'error',
        triggerConfig: JSON.stringify({ errorPatterns: ['timeout'] }),
        action: 'block',
        scopeWorkflowId: null,
        scopeStepType: null,
      }];
      mockPrisma = makeMockPrisma(rules);
      const engine = new FeedbackRuleEngine(mockPrisma);

      const result = await engine.evaluatePostExecute({
        step: makeStep(),
        context: makeContext(),
        executionId: 'exec-1',
        durationMs: 100,
      });

      expect(result.action).toBe('proceed');
    });

    it('should handle invalid regex patterns gracefully', async () => {
      const rules = [{
        name: 'Bad regex',
        triggerType: 'error',
        triggerConfig: JSON.stringify({ errorPatterns: ['[invalid(regex'] }),
        action: 'block',
        scopeWorkflowId: null,
        scopeStepType: null,
      }];
      mockPrisma = makeMockPrisma(rules);
      const engine = new FeedbackRuleEngine(mockPrisma);

      const result = await engine.evaluatePostExecute({
        step: makeStep(),
        context: makeContext(),
        executionId: 'exec-1',
        durationMs: 100,
        errorMessage: 'some error',
      });

      expect(result.action).toBe('proceed');
    });

    it('should use default threshold when not specified in config', async () => {
      const rules = [{
        name: 'Duration default',
        triggerType: 'duration',
        triggerConfig: '{}',
        action: 'notify',
        scopeWorkflowId: null,
        scopeStepType: null,
      }];
      mockPrisma = makeMockPrisma(rules);
      const engine = new FeedbackRuleEngine(mockPrisma);

      // Default threshold is 30000ms
      const result = await engine.evaluatePostExecute({
        step: makeStep(),
        context: makeContext(),
        executionId: 'exec-1',
        durationMs: 31000,
      });

      expect(result.action).toBe('notify');
    });
  });
});
