import { describe, it, expect } from 'vitest';
import { eventSchemas } from '../../../src/lib/core/events/schemas';
import { EVENT_CATALOG } from '../../../src/lib/core/events/event-catalog';
import {
  taskCreatedSchema,
  projectCreatedSchema,
  workflowTriggeredSchema,
  releaseCreatedSchema,
  agentRegisteredSchema,
  integrationGithubPushSchema,
  systemModuleLoadedSchema,
} from '../../../src/lib/core/events/schemas';

describe('EventSchemas', () => {
  it('eventSchemas map should have entries for all EVENT_CATALOG types', () => {
    for (const type of Object.keys(EVENT_CATALOG)) {
      expect(eventSchemas[type]).toBeDefined();
    }
  });

  it('taskCreatedSchema should validate correct payload', () => {
    const validPayload = {
      taskId: 'task-1',
      projectId: 'proj-1',
      title: 'Test Task',
      priority: 'high',
    };
    expect(taskCreatedSchema.safeParse(validPayload).success).toBe(true);
  });

  it('taskCreatedSchema should reject invalid payload (missing required fields)', () => {
    const invalidPayload = {
      // missing taskId
      title: 'Test Task',
    };
    expect(taskCreatedSchema.safeParse(invalidPayload).success).toBe(false);
  });

  it('taskCreatedSchema should accept minimal payload', () => {
    const minimalPayload = {
      taskId: 'task-1',
      title: 'Test Task',
    };
    expect(taskCreatedSchema.safeParse(minimalPayload).success).toBe(true);
  });

  it('projectCreatedSchema should validate correct payload', () => {
    const validPayload = {
      projectId: 'proj-1',
      name: 'My Project',
      description: 'A test project',
    };
    expect(projectCreatedSchema.safeParse(validPayload).success).toBe(true);
  });

  it('projectCreatedSchema should reject payload without projectId', () => {
    const invalidPayload = {
      name: 'My Project',
    };
    expect(projectCreatedSchema.safeParse(invalidPayload).success).toBe(false);
  });

  it('workflowTriggeredSchema should validate correct payload', () => {
    const validPayload = {
      workflowId: 'wf-1',
      triggerType: 'manual',
      triggeredBy: 'user-1',
    };
    expect(workflowTriggeredSchema.safeParse(validPayload).success).toBe(true);
  });

  it('releaseCreatedSchema should validate correct payload', () => {
    const validPayload = {
      releaseId: 'rel-1',
      projectId: 'proj-1',
      version: '1.0.0',
      title: 'v1.0.0',
    };
    expect(releaseCreatedSchema.safeParse(validPayload).success).toBe(true);
  });

  it('agentRegisteredSchema should validate correct payload', () => {
    const validPayload = {
      agentId: 'agent-1',
      name: 'Test Agent',
      clientType: 'mcp',
      capabilities: ['task_crud'],
    };
    expect(agentRegisteredSchema.safeParse(validPayload).success).toBe(true);
  });

  it('integrationGithubPushSchema should validate correct payload', () => {
    const validPayload = {
      repo: 'owner/repo',
      branch: 'main',
      commit: 'abc123',
    };
    expect(integrationGithubPushSchema.safeParse(validPayload).success).toBe(true);
  });

  it('integrationGithubPushSchema should reject payload without repo', () => {
    const invalidPayload = {
      branch: 'main',
    };
    expect(integrationGithubPushSchema.safeParse(invalidPayload).success).toBe(false);
  });

  it('systemModuleLoadedSchema should validate correct payload', () => {
    const validPayload = {
      moduleId: 'mod-1',
      version: '1.0.0',
    };
    expect(systemModuleLoadedSchema.safeParse(validPayload).success).toBe(true);
  });

  it('all schemas should be Zod schemas with safeParse method', () => {
    for (const [type, schema] of Object.entries(eventSchemas)) {
      expect(typeof schema.safeParse).toBe('function');
      // Each schema should parse an empty object (may fail validation, but the method exists)
      const result = schema.safeParse({});
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('error');
    }
  });
});
