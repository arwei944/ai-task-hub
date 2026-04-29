import { describe, it, expect } from 'vitest';
import { WorkflowParser, parseWorkflowMarkdown } from '@/lib/modules/workflow-engine/config/workflow-parser';

describe('WorkflowParser', () => {
  describe('parse - basic structure', () => {
    it('should parse a minimal workflow with title and steps', () => {
      const markdown = `# My Workflow

## Steps

### 1. Create Task
type: create-task
`;

      const result = parseWorkflowMarkdown(markdown);
      expect(result.name).toBe('My Workflow');
      expect(result.steps).toHaveLength(1);
      expect(result.steps[0].name).toBe('Create Task');
      expect(result.steps[0].type).toBe('create-task');
      expect(result.steps[0].id).toBe('step-1');
    });

    it('should parse title and description', () => {
      const markdown = `# Test Workflow

This is a description line 1.
This is a description line 2.

## Steps

### 1. Step One
type: wait
`;

      const result = parseWorkflowMarkdown(markdown);
      expect(result.name).toBe('Test Workflow');
      expect(result.description).toBe('This is a description line 1.\nThis is a description line 2.');
    });

    it('should handle empty description', () => {
      const markdown = `# No Description

## Steps

### 1. Step
type: wait
`;

      const result = parseWorkflowMarkdown(markdown);
      expect(result.name).toBe('No Description');
      expect(result.description).toBeUndefined();
    });

    it('should return empty name when no H1 found', () => {
      const markdown = `## Steps\n\n### 1. Step\ntype: wait\n`;
      const result = parseWorkflowMarkdown(markdown);
      expect(result.name).toBe('');
    });
  });

  describe('parse - Trigger section', () => {
    it('should parse trigger type and config', () => {
      const markdown = `# Workflow

## Trigger
type: webhook
config: {"url": "https://example.com/hook"}

## Steps

### 1. Step
type: wait
`;

      const result = parseWorkflowMarkdown(markdown);
      expect(result.trigger).toBe('webhook');
      expect(result.triggerConfig).toBe('{"url": "https://example.com/hook"}');
    });

    it('should ignore invalid trigger type', () => {
      const markdown = `# Workflow

## Trigger
type: invalid_trigger

## Steps

### 1. Step
type: wait
`;

      const result = parseWorkflowMarkdown(markdown);
      expect(result.trigger).toBeUndefined();
    });

    it('should parse all valid trigger types', () => {
      const triggers = ['manual', 'webhook', 'schedule', 'event', 'github-issue', 'approval'];
      for (const trigger of triggers) {
        const markdown = `# Workflow\n\n## Trigger\ntype: ${trigger}\n\n## Steps\n\n### 1. Step\ntype: wait\n`;
        const result = parseWorkflowMarkdown(markdown);
        expect(result.trigger).toBe(trigger);
      }
    });
  });

  describe('parse - Variables section', () => {
    it('should parse variables with types and defaults', () => {
      const markdown = `# Workflow

## Variables
- name: string = hello
- count: number = 42
- active: boolean = true
- items: array = [1, 2, 3]
- meta: object = {"key": "value"}

## Steps

### 1. Step
type: wait
`;

      const result = parseWorkflowMarkdown(markdown);
      expect(result.variables).toBeDefined();
      expect(result.variables!.name).toBe('hello');
      expect(result.variables!.count).toBe(42);
      expect(result.variables!.active).toBe(true);
      expect(result.variables!.items).toEqual([1, 2, 3]);
      expect(result.variables!.meta).toEqual({ key: 'value' });
    });

    it('should set type-appropriate defaults for variables without defaults', () => {
      const markdown = `# Workflow

## Variables
- name: string
- count: number
- flag: boolean
- items: array
- meta: object

## Steps

### 1. Step
type: wait
`;

      const result = parseWorkflowMarkdown(markdown);
      expect(result.variables!.name).toBe('');
      expect(result.variables!.count).toBe(0);
      expect(result.variables!.flag).toBe(false);
      expect(result.variables!.items).toEqual([]);
      expect(result.variables!.meta).toEqual({});
    });

    it('should not set variables when section is empty', () => {
      const markdown = `# Workflow\n\n## Steps\n\n### 1. Step\ntype: wait\n`;
      const result = parseWorkflowMarkdown(markdown);
      expect(result.variables).toBeUndefined();
    });
  });

  describe('parse - Steps section', () => {
    it('should parse multiple steps with correct indices', () => {
      const markdown = `# Workflow

## Steps

### 1. First Step
type: create-task

### 2. Second Step
type: update-status

### 3. Third Step
type: wait
`;

      const result = parseWorkflowMarkdown(markdown);
      expect(result.steps).toHaveLength(3);
      expect(result.steps[0].id).toBe('step-1');
      expect(result.steps[0].name).toBe('First Step');
      expect(result.steps[0].type).toBe('create-task');
      expect(result.steps[1].id).toBe('step-2');
      expect(result.steps[2].id).toBe('step-3');
    });

    it('should parse step feedback mode', () => {
      const markdown = `# Workflow

## Steps

### 1. AI Step
type: ai-analyze
feedback: block
`;

      const result = parseWorkflowMarkdown(markdown);
      expect(result.steps[0].feedbackMode).toBe('block');
    });

    it('should ignore invalid feedback mode', () => {
      const markdown = `# Workflow

## Steps

### 1. Step
type: wait
feedback: invalid_mode
`;

      const result = parseWorkflowMarkdown(markdown);
      expect(result.steps[0].feedbackMode).toBeUndefined();
    });

    it('should parse step timeout', () => {
      const markdown = `# Workflow

## Steps

### 1. Step
type: wait
timeout: 5000
`;

      const result = parseWorkflowMarkdown(markdown);
      expect(result.steps[0].timeoutMs).toBe(5000);
    });

    it('should parse step onerror', () => {
      const markdown = `# Workflow

## Steps

### 1. Step
type: wait
onerror: continue
`;

      const result = parseWorkflowMarkdown(markdown);
      expect(result.steps[0].onError).toBe('continue');
    });

    it('should default step type to create-task when not specified', () => {
      const markdown = `# Workflow

## Steps

### 1. My Step
`;

      const result = parseWorkflowMarkdown(markdown);
      expect(result.steps[0].type).toBe('create-task');
    });

    it('should parse step config as JSON', () => {
      const markdown = `# Workflow

## Steps

### 1. Step
type: create-task
config: {"task": {"title": "Hello"}}
`;

      const result = parseWorkflowMarkdown(markdown);
      expect(result.steps[0].config).toEqual({ task: { title: 'Hello' } });
    });

    it('should parse step solo config', () => {
      const markdown = `# Workflow

## Steps

### 1. Step
type: ai-analyze
solo: {"subAgent": "explore", "callMode": "mcp"}
`;

      const result = parseWorkflowMarkdown(markdown);
      expect(result.steps[0].soloSubAgent).toBe('explore');
      expect(result.steps[0].soloCallMode).toBe('mcp');
    });

    it('should parse steps without numbered prefix', () => {
      const markdown = `# Workflow

## Steps

### Create Task
type: create-task

### Wait
type: wait
`;

      const result = parseWorkflowMarkdown(markdown);
      expect(result.steps).toHaveLength(2);
      expect(result.steps[0].name).toBe('Create Task');
      expect(result.steps[1].name).toBe('Wait');
    });
  });

  describe('parse - Retry Policy section', () => {
    it('should parse retry policy with all fields', () => {
      const markdown = `# Workflow

## Retry Policy
max: 5
backoff: exponential
delay: 2000

## Steps

### 1. Step
type: wait
`;

      const result = parseWorkflowMarkdown(markdown);
      expect(result.retryPolicy).toBeDefined();
      expect(result.retryPolicy!.max).toBe(5);
      expect(result.retryPolicy!.backoff).toBe('exponential');
      expect(result.retryPolicy!.delayMs).toBe(2000);
    });

    it('should set default values for partial retry policy', () => {
      const markdown = `# Workflow

## Retry Policy
max: 2

## Steps

### 1. Step
type: wait
`;

      const result = parseWorkflowMarkdown(markdown);
      expect(result.retryPolicy!.max).toBe(2);
      expect(result.retryPolicy!.backoff).toBe('exponential');
      expect(result.retryPolicy!.delayMs).toBe(1000);
    });

    it('should parse all valid backoff strategies', () => {
      const strategies = ['fixed', 'exponential', 'linear'];
      for (const strategy of strategies) {
        const markdown = `# Workflow\n\n## Retry Policy\nbackoff: ${strategy}\n\n## Steps\n\n### 1. Step\ntype: wait\n`;
        const result = parseWorkflowMarkdown(markdown);
        expect(result.retryPolicy!.backoff).toBe(strategy);
      }
    });

    it('should ignore invalid backoff strategy', () => {
      const markdown = `# Workflow\n\n## Retry Policy\nmax: 3\nbackoff: invalid\n\n## Steps\n\n### 1. Step\ntype: wait\n`;
      const result = parseWorkflowMarkdown(markdown);
      expect(result.retryPolicy!.backoff).toBe('exponential'); // default
    });
  });

  describe('parse - Concurrency section', () => {
    it('should parse concurrency limit', () => {
      const markdown = `# Workflow

## Concurrency
limit: 10

## Steps

### 1. Step
type: wait
`;

      const result = parseWorkflowMarkdown(markdown);
      expect(result.concurrencyLimit).toBe(10);
    });
  });

  describe('parse - Timeout section', () => {
    it('should parse timeout in ms', () => {
      const markdown = `# Workflow

## Timeout
ms: 30000

## Steps

### 1. Step
type: wait
`;

      const result = parseWorkflowMarkdown(markdown);
      expect(result.timeoutMs).toBe(30000);
    });
  });

  describe('parse - SOLO Config section', () => {
    it('should parse SOLO config with all fields', () => {
      const markdown = `# Workflow

## SOLO Config
defaultMode: mcp
defaultSubAgent: explore
defaultTimeout: 60000

## Steps

### 1. Step
type: ai-analyze
`;

      const result = parseWorkflowMarkdown(markdown);
      expect(result.soloConfig).toBeDefined();
      expect(result.soloConfig!.defaultMode).toBe('mcp');
      expect(result.soloConfig!.defaultSubAgent).toBe('explore');
      expect(result.soloConfig!.defaultTimeoutMs).toBe(60000);
    });

    it('should ignore invalid SOLO config values', () => {
      const markdown = `# Workflow

## SOLO Config
defaultMode: invalid_mode
defaultSubAgent: invalid_agent

## Steps

### 1. Step
type: ai-analyze
`;

      const result = parseWorkflowMarkdown(markdown);
      expect(result.soloConfig).toBeUndefined();
    });
  });

  describe('parse - edge cases', () => {
    it('should handle CRLF line endings', () => {
      const markdown = "# Workflow\r\n\r\n## Steps\r\n\r\n### 1. Step\r\ntype: wait\r\n";
      const result = parseWorkflowMarkdown(markdown);
      expect(result.name).toBe('Workflow');
      expect(result.steps).toHaveLength(1);
    });

    it('should handle empty markdown', () => {
      const result = parseWorkflowMarkdown('');
      expect(result.name).toBe('');
      expect(result.steps).toHaveLength(0);
    });

    it('should handle markdown with only a title', () => {
      const result = parseWorkflowMarkdown('# Title Only');
      expect(result.name).toBe('Title Only');
      expect(result.steps).toHaveLength(0);
    });

    it('should be case-insensitive for section names', () => {
      const markdown = `# Workflow

## TRIGGER
type: manual

## STEPS

### 1. Step
type: wait
`;

      const result = parseWorkflowMarkdown(markdown);
      expect(result.trigger).toBe('manual');
      expect(result.steps).toHaveLength(1);
    });
  });

  describe('WorkflowParser class', () => {
    it('should be instantiable and produce same results as convenience function', () => {
      const markdown = `# Test\n\n## Steps\n\n### 1. Step\ntype: wait\n`;
      const parser = new WorkflowParser();
      const result = parser.parse(markdown);
      const convenience = parseWorkflowMarkdown(markdown);
      expect(result).toEqual(convenience);
    });
  });
});
