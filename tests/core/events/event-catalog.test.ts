import { describe, it, expect } from 'vitest';
import { EVENT_CATALOG, VALID_EVENT_TYPES } from '../../../src/lib/core/events/event-catalog';

describe('EventCatalog', () => {
  it('should define all expected event types', () => {
    const expectedTypes = [
      // Project events
      'project.created',
      'project.phase.changed',
      'project.archived',
      'project.deleted',
      'project.health.updated',
      // Task events
      'task.created',
      'task.status.changed',
      'task.assigned',
      'task.priority.changed',
      'task.completed',
      'task.blocked',
      'task.dependency.added',
      'task.comment.added',
      // Workflow events
      'workflow.triggered',
      'workflow.step.completed',
      'workflow.step.failed',
      'workflow.completed',
      'workflow.failed',
      'workflow.approval.requested',
      'workflow.approval.decided',
      // Release events
      'release.created',
      'release.status.changed',
      'release.published',
      'release.rolled.back',
      // Requirement events
      'requirement.created',
      'requirement.status.changed',
      'requirement.mapped.to.task',
      // Agent events
      'agent.registered',
      'agent.task.claimed',
      'agent.task.completed',
      // Integration events
      'integration.github.push',
      'integration.github.pr.opened',
      'integration.github.pr.merged',
      'integration.github.issue.created',
      // System events
      'system.module.loaded',
      'system.module.unloaded',
      'system.config.changed',
    ];

    for (const type of expectedTypes) {
      expect(EVENT_CATALOG[type as keyof typeof EVENT_CATALOG]).toBeDefined();
    }
  });

  it('VALID_EVENT_TYPES should contain all keys from EVENT_CATALOG', () => {
    const catalogKeys = Object.keys(EVENT_CATALOG);
    expect(VALID_EVENT_TYPES).toHaveLength(catalogKeys.length);
    for (const key of catalogKeys) {
      expect(VALID_EVENT_TYPES).toContain(key);
    }
  });

  it('each event should have domain and description', () => {
    for (const [type, meta] of Object.entries(EVENT_CATALOG)) {
      expect(meta.domain).toBeTypeOf('string');
      expect(meta.domain.length).toBeGreaterThan(0);
      expect(meta.description).toBeTypeOf('string');
      expect(meta.description.length).toBeGreaterThan(0);
    }
  });

  it('should have events across multiple domains', () => {
    const domains = new Set(Object.values(EVENT_CATALOG).map((e) => e.domain));
    expect(domains.size).toBeGreaterThanOrEqual(8);
    expect(domains.has('project')).toBe(true);
    expect(domains.has('task')).toBe(true);
    expect(domains.has('workflow')).toBe(true);
    expect(domains.has('release')).toBe(true);
    expect(domains.has('requirement')).toBe(true);
    expect(domains.has('agent')).toBe(true);
    expect(domains.has('integration')).toBe(true);
    expect(domains.has('system')).toBe(true);
  });

  it('should have at least 30 event types', () => {
    expect(Object.keys(EVENT_CATALOG).length).toBeGreaterThanOrEqual(30);
  });
});
