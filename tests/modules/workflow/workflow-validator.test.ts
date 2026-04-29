import { describe, it, expect } from 'vitest';
import { WorkflowValidator, validateWorkflow } from '@/lib/modules/workflow-engine/config/workflow-validator';
import type { CreateWorkflowDTO, WorkflowStep } from '@/lib/modules/workflow-engine/types';

function makeStep(overrides: Partial<WorkflowStep> = {}): WorkflowStep {
  return {
    id: 'step-1',
    name: 'Test Step',
    type: 'create-task',
    config: {},
    ...overrides,
  };
}

function makeDTO(overrides: Partial<CreateWorkflowDTO> = {}): CreateWorkflowDTO {
  return {
    name: 'Test Workflow',
    steps: [makeStep()],
    ...overrides,
  };
}

describe('WorkflowValidator', () => {
  describe('validate - basic structure', () => {
    it('should pass for a valid minimal workflow', () => {
      const dto = makeDTO();
      const result = validateWorkflow(dto);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail when name is empty', () => {
      const dto = makeDTO({ name: '' });
      const result = validateWorkflow(dto);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Workflow name is required and must be non-empty');
    });

    it('should fail when name is whitespace only', () => {
      const dto = makeDTO({ name: '   ' });
      const result = validateWorkflow(dto);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Workflow name is required and must be non-empty');
    });

    it('should fail when steps array is empty', () => {
      const dto = makeDTO({ steps: [] });
      const result = validateWorkflow(dto);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Workflow must have at least one step');
    });

    it('should fail when steps is undefined (not crash)', () => {
      // After fix: validator guards against undefined steps in detectCircularReferences
      const dto = makeDTO({ steps: undefined as any });
      const result = validateWorkflow(dto);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('at least one step'))).toBe(true);
    });
  });

  describe('validateStep - step type validation', () => {
    it('should fail for missing step type', () => {
      const dto = makeDTO({ steps: [makeStep({ type: undefined as any })] });
      const result = validateWorkflow(dto);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('step type is required'))).toBe(true);
    });

    it('should fail for invalid step type', () => {
      const dto = makeDTO({ steps: [makeStep({ type: 'invalid-type' as any })] });
      const result = validateWorkflow(dto);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes("invalid step type 'invalid-type'"))).toBe(true);
    });

    it('should accept all valid step types', () => {
      const validTypes = [
        'create-task', 'update-status', 'ai-analyze', 'send-notification',
        'wait', 'parallel-group', 'condition', 'foreach',
        'invoke-agent', 'http-request', 'transform', 'approval',
      ];
      for (const type of validTypes) {
        const dto = makeDTO({ steps: [makeStep({ type: type as any })] });
        const result = validateWorkflow(dto);
        expect(result.valid).toBe(true);
      }
    });
  });

  describe('validateStep - step name and id', () => {
    it('should fail for missing step name', () => {
      const dto = makeDTO({ steps: [makeStep({ name: '' })] });
      const result = validateWorkflow(dto);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('step name is required'))).toBe(true);
    });

    it('should fail for missing step id', () => {
      const dto = makeDTO({ steps: [makeStep({ id: '' })] });
      const result = validateWorkflow(dto);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('step id is required'))).toBe(true);
    });
  });

  describe('validateStep - nested condition steps', () => {
    it('should validate nested condition then steps', () => {
      const dto = makeDTO({
        steps: [makeStep({
          type: 'condition',
          condition: {
            expression: 'true',
            thenSteps: [{ id: 'nested-1', name: 'Nested', type: 'invalid-type' as any, config: {} }],
          },
        })],
      });
      const result = validateWorkflow(dto);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('condition.then') && e.includes('invalid step type'))).toBe(true);
    });

    it('should validate nested condition else steps', () => {
      const dto = makeDTO({
        steps: [makeStep({
          type: 'condition',
          condition: {
            expression: 'true',
            elseSteps: [{ id: 'nested-1', name: '', type: 'wait', config: {} }],
          },
        })],
      });
      const result = validateWorkflow(dto);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('condition.else') && e.includes('step name is required'))).toBe(true);
    });

    it('should pass for valid nested condition steps', () => {
      const dto = makeDTO({
        steps: [makeStep({
          type: 'condition',
          condition: {
            expression: 'true',
            thenSteps: [{ id: 'nested-1', name: 'Then', type: 'wait', config: {} }],
            elseSteps: [{ id: 'nested-2', name: 'Else', type: 'wait', config: {} }],
          },
        })],
      });
      const result = validateWorkflow(dto);
      expect(result.valid).toBe(true);
    });
  });

  describe('validateStep - parallel group steps', () => {
    it('should validate nested parallel steps', () => {
      const dto = makeDTO({
        steps: [makeStep({
          type: 'parallel-group',
          steps: [{ id: 'p-1', name: '', type: 'wait', config: {} }],
        })],
      });
      const result = validateWorkflow(dto);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('parallel') && e.includes('step name is required'))).toBe(true);
    });

    it('should pass for valid parallel steps', () => {
      const dto = makeDTO({
        steps: [makeStep({
          type: 'parallel-group',
          steps: [{ id: 'p-1', name: 'Parallel', type: 'wait', config: {} }],
        })],
      });
      const result = validateWorkflow(dto);
      expect(result.valid).toBe(true);
    });
  });

  describe('validate - retry policy', () => {
    it('should fail for negative max retries', () => {
      const dto = makeDTO({
        retryPolicy: { max: -1, backoff: 'exponential', delayMs: 1000 },
      });
      const result = validateWorkflow(dto);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Retry policy max must be >= 0');
    });

    it('should fail for negative delayMs', () => {
      const dto = makeDTO({
        retryPolicy: { max: 3, backoff: 'exponential', delayMs: -100 },
      });
      const result = validateWorkflow(dto);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Retry policy delayMs must be >= 0');
    });

    it('should pass for valid retry policy', () => {
      const dto = makeDTO({
        retryPolicy: { max: 3, backoff: 'fixed', delayMs: 500 },
      });
      const result = validateWorkflow(dto);
      expect(result.valid).toBe(true);
    });

    it('should pass for zero max retries', () => {
      const dto = makeDTO({
        retryPolicy: { max: 0, backoff: 'exponential', delayMs: 1000 },
      });
      const result = validateWorkflow(dto);
      expect(result.valid).toBe(true);
    });
  });

  describe('validate - concurrency limit', () => {
    it('should fail for concurrency limit less than 1', () => {
      const dto = makeDTO({ concurrencyLimit: 0 });
      const result = validateWorkflow(dto);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Concurrency limit must be >= 1');
    });

    it('should fail for negative concurrency limit', () => {
      const dto = makeDTO({ concurrencyLimit: -5 });
      const result = validateWorkflow(dto);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Concurrency limit must be >= 1');
    });

    it('should pass for valid concurrency limit', () => {
      const dto = makeDTO({ concurrencyLimit: 10 });
      const result = validateWorkflow(dto);
      expect(result.valid).toBe(true);
    });
  });

  describe('validate - timeout', () => {
    it('should fail for timeout of 0', () => {
      const dto = makeDTO({ timeoutMs: 0 });
      const result = validateWorkflow(dto);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Timeout must be > 0');
    });

    it('should fail for negative timeout', () => {
      const dto = makeDTO({ timeoutMs: -100 });
      const result = validateWorkflow(dto);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Timeout must be > 0');
    });

    it('should pass for valid timeout', () => {
      const dto = makeDTO({ timeoutMs: 30000 });
      const result = validateWorkflow(dto);
      expect(result.valid).toBe(true);
    });
  });

  describe('detectCircularReferences', () => {
    it('should detect circular references in condition branches', () => {
      // step-1 references step-2 in condition, step-2 references step-1 in condition
      const dto: CreateWorkflowDTO = {
        name: 'Circular Workflow',
        steps: [
          {
            id: 'step-1',
            name: 'Step 1',
            type: 'condition',
            config: {},
            condition: {
              expression: 'true',
              thenSteps: [{ id: 'step-2', name: 'Step 2', type: 'wait', config: {} }],
            },
          },
          {
            id: 'step-2',
            name: 'Step 2',
            type: 'condition',
            config: {},
            condition: {
              expression: 'true',
              thenSteps: [{ id: 'step-1', name: 'Step 1', type: 'wait', config: {} }],
            },
          },
        ],
      };
      const result = validateWorkflow(dto);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Circular reference'))).toBe(true);
    });

    it('should pass for non-circular condition references', () => {
      const dto: CreateWorkflowDTO = {
        name: 'Non-Circular Workflow',
        steps: [
          {
            id: 'step-1',
            name: 'Step 1',
            type: 'condition',
            config: {},
            condition: {
              expression: 'true',
              thenSteps: [{ id: 'step-2', name: 'Step 2', type: 'wait', config: {} }],
            },
          },
          {
            id: 'step-2',
            name: 'Step 2',
            type: 'wait',
            config: {},
          },
        ],
      };
      const result = validateWorkflow(dto);
      expect(result.valid).toBe(true);
    });
  });

  describe('WorkflowValidator class', () => {
    it('should produce same results as convenience function', () => {
      const dto = makeDTO();
      const validator = new WorkflowValidator();
      const classResult = validator.validate(dto);
      const fnResult = validateWorkflow(dto);
      expect(classResult).toEqual(fnResult);
    });
  });
});
