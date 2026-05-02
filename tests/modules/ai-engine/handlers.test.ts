import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IEventBus, ILogger, DomainEvent } from '@/lib/core/types';
import { EventBus } from '@/lib/core/event-bus';
import { TaskCreatedHandler } from '@/lib/modules/ai-engine/handlers/task-created.handler';
import { TaskStatusHandler } from '@/lib/modules/ai-engine/handlers/task-status.handler';
import { ProjectPhaseHandler } from '@/lib/modules/ai-engine/handlers/project-phase.handler';

// --- Helpers ---

function createMockLogger(): ILogger {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(() => createMockLogger()),
  };
}

function createEventBus(): IEventBus {
  return new EventBus();
}

function createEvent(type: string, payload: unknown): DomainEvent {
  return { type, payload, timestamp: new Date(), source: 'test' };
}

// --- TaskCreatedHandler Tests ---

describe('TaskCreatedHandler', () => {
  let eventBus: IEventBus;
  let logger: ILogger;
  let handler: TaskCreatedHandler;

  beforeEach(() => {
    eventBus = createEventBus();
    logger = createMockLogger();
    handler = new TaskCreatedHandler(eventBus, logger);
  });

  it('should have correct eventType', () => {
    expect(handler.eventType).toBe('task.created');
  });

  it('should register on the event bus', () => {
    handler.register();
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('task.created'),
    );
  });

  it('should classify low complexity for simple tasks', async () => {
    const emittedEvents: DomainEvent[] = [];
    eventBus.on('task.complexity.analyzed', (e) => { emittedEvents.push(e); });

    handler.register();

    eventBus.emit(
      createEvent('task.created', {
        id: 't1',
        title: 'Simple task',
        description: 'Short desc',
        priority: 1,
        projectId: 'p1',
      }),
    );

    // Wait for async handler
    await new Promise((r) => setTimeout(r, 50));

    expect(emittedEvents).toHaveLength(1);
    const payload = emittedEvents[0].payload as any;
    expect(payload.complexity).toBe('low');
    expect(payload.taskId).toBe('t1');
    expect(payload.projectId).toBe('p1');
  });

  it('should classify high complexity for high priority tasks', async () => {
    const emittedEvents: DomainEvent[] = [];
    eventBus.on('task.complexity.analyzed', (e) => { emittedEvents.push(e); });

    handler.register();

    eventBus.emit(
      createEvent('task.created', {
        id: 't2',
        title: 'Urgent task',
        description: 'A normal description',
        priority: 4,
        projectId: 'p1',
      }),
    );

    await new Promise((r) => setTimeout(r, 50));

    expect(emittedEvents).toHaveLength(1);
    const payload = emittedEvents[0].payload as any;
    expect(payload.complexity).toBe('high');
    expect(payload.reasons).toEqual(
      expect.arrayContaining([expect.stringContaining('高优先级')]),
    );
  });

  it('should classify high complexity for long descriptions', async () => {
    const emittedEvents: DomainEvent[] = [];
    eventBus.on('task.complexity.analyzed', (e) => { emittedEvents.push(e); });

    handler.register();

    const longDesc = 'A'.repeat(501);
    eventBus.emit(
      createEvent('task.created', {
        id: 't3',
        title: 'Detailed task',
        description: longDesc,
        priority: 1,
      }),
    );

    await new Promise((r) => setTimeout(r, 50));

    expect(emittedEvents).toHaveLength(1);
    const payload = emittedEvents[0].payload as any;
    expect(payload.complexity).toBe('high');
    expect(payload.reasons).toEqual(
      expect.arrayContaining([expect.stringContaining('描述较长')]),
    );
  });

  it('should classify medium complexity for medium priority', async () => {
    const emittedEvents: DomainEvent[] = [];
    eventBus.on('task.complexity.analyzed', (e) => { emittedEvents.push(e); });

    handler.register();

    eventBus.emit(
      createEvent('task.created', {
        id: 't4',
        title: 'Medium task',
        description: 'A normal description',
        priority: 2,
      }),
    );

    await new Promise((r) => setTimeout(r, 50));

    expect(emittedEvents).toHaveLength(1);
    const payload = emittedEvents[0].payload as any;
    expect(payload.complexity).toBe('medium');
  });

  it('should classify medium complexity for medium-length descriptions', async () => {
    const emittedEvents: DomainEvent[] = [];
    eventBus.on('task.complexity.analyzed', (e) => { emittedEvents.push(e); });

    handler.register();

    const mediumDesc = 'B'.repeat(250);
    eventBus.emit(
      createEvent('task.created', {
        id: 't5',
        title: 'Medium desc task',
        description: mediumDesc,
        priority: 1,
      }),
    );

    await new Promise((r) => setTimeout(r, 50));

    expect(emittedEvents).toHaveLength(1);
    const payload = emittedEvents[0].payload as any;
    expect(payload.complexity).toBe('medium');
  });

  it('should handle string priorities (urgent/high/medium/low)', async () => {
    const emittedEvents: DomainEvent[] = [];
    eventBus.on('task.complexity.analyzed', (e) => { emittedEvents.push(e); });

    handler.register();

    // Test 'urgent' string priority
    eventBus.emit(
      createEvent('task.created', {
        id: 't6',
        title: 'Urgent string task',
        description: 'desc',
        priority: 'urgent',
      }),
    );

    await new Promise((r) => setTimeout(r, 50));

    expect(emittedEvents).toHaveLength(1);
    const payload = emittedEvents[0].payload as any;
    expect(payload.complexity).toBe('high');
  });

  it('should handle missing fields gracefully', async () => {
    const emittedEvents: DomainEvent[] = [];
    eventBus.on('task.complexity.analyzed', (e) => { emittedEvents.push(e); });

    handler.register();

    eventBus.emit(createEvent('task.created', {}));

    await new Promise((r) => setTimeout(r, 50));

    expect(emittedEvents).toHaveLength(1);
    const payload = emittedEvents[0].payload as any;
    expect(payload.complexity).toBe('low');
  });

  it('should emit event with correct source', async () => {
    const emittedEvents: DomainEvent[] = [];
    eventBus.on('task.complexity.analyzed', (e) => { emittedEvents.push(e); });

    handler.register();

    eventBus.emit(
      createEvent('task.created', { id: 't1', title: 'Test' }),
    );

    await new Promise((r) => setTimeout(r, 50));

    expect(emittedEvents[0].source).toBe('ai-engine');
  });
});

// --- TaskStatusHandler Tests ---

describe('TaskStatusHandler', () => {
  let eventBus: IEventBus;
  let logger: ILogger;
  let handler: TaskStatusHandler;

  beforeEach(() => {
    eventBus = createEventBus();
    logger = createMockLogger();
    handler = new TaskStatusHandler(eventBus, logger);
  });

  it('should have correct eventType', () => {
    expect(handler.eventType).toBe('task.status.changed');
  });

  it('should register on the event bus', () => {
    handler.register();
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('task.status.changed'),
    );
  });

  it('should emit project.health.updated when status becomes done', async () => {
    const emittedEvents: DomainEvent[] = [];
    eventBus.on('project.health.updated', (e) => { emittedEvents.push(e); });

    handler.register();

    eventBus.emit(
      createEvent('task.status.changed', {
        id: 't1',
        taskId: 't1',
        status: 'done',
        previousStatus: 'in_progress',
        projectId: 'p1',
      }),
    );

    await new Promise((r) => setTimeout(r, 50));

    expect(emittedEvents).toHaveLength(1);
    const payload = emittedEvents[0].payload as any;
    expect(payload.projectId).toBe('p1');
    expect(payload.healthScore).toBe(100);
    expect(emittedEvents[0].source).toBe('ai-engine');
  });

  it('should emit project.health.updated when status becomes completed', async () => {
    const emittedEvents: DomainEvent[] = [];
    eventBus.on('project.health.updated', (e) => { emittedEvents.push(e); });

    handler.register();

    eventBus.emit(
      createEvent('task.status.changed', {
        id: 't2',
        status: 'completed',
        previousStatus: 'testing',
        projectId: 'p2',
      }),
    );

    await new Promise((r) => setTimeout(r, 50));

    expect(emittedEvents).toHaveLength(1);
    const payload = emittedEvents[0].payload as any;
    expect(payload.healthScore).toBe(100);
  });

  it('should NOT emit project.health.updated for non-completion statuses', async () => {
    const emittedEvents: DomainEvent[] = [];
    eventBus.on('project.health.updated', (e) => { emittedEvents.push(e); });

    handler.register();

    eventBus.emit(
      createEvent('task.status.changed', {
        id: 't3',
        status: 'in_progress',
        previousStatus: 'todo',
        projectId: 'p1',
      }),
    );

    await new Promise((r) => setTimeout(r, 50));

    expect(emittedEvents).toHaveLength(0);
  });

  it('should handle missing fields gracefully', async () => {
    const emittedEvents: DomainEvent[] = [];
    eventBus.on('project.health.updated', (e) => { emittedEvents.push(e); });

    handler.register();

    eventBus.emit(createEvent('task.status.changed', {}));

    await new Promise((r) => setTimeout(r, 50));

    // No health event since status is undefined (not done/completed)
    expect(emittedEvents).toHaveLength(0);
  });
});

// --- ProjectPhaseHandler Tests ---

describe('ProjectPhaseHandler', () => {
  let eventBus: IEventBus;
  let logger: ILogger;
  let handler: ProjectPhaseHandler;

  beforeEach(() => {
    eventBus = createEventBus();
    logger = createMockLogger();
    handler = new ProjectPhaseHandler(eventBus, logger);
  });

  it('should have correct eventType', () => {
    expect(handler.eventType).toBe('project.phase.changed');
  });

  it('should register on the event bus', () => {
    handler.register();
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('project.phase.changed'),
    );
  });

  it('should emit suggestion for requirements -> planning', async () => {
    const emittedEvents: DomainEvent[] = [];
    eventBus.on('ai.suggestion', (e) => { emittedEvents.push(e); });

    handler.register();

    eventBus.emit(
      createEvent('project.phase.changed', {
        projectId: 'p1',
        phase: 'planning',
        previousPhase: 'requirements',
      }),
    );

    await new Promise((r) => setTimeout(r, 50));

    expect(emittedEvents).toHaveLength(1);
    const payload = emittedEvents[0].payload as any;
    expect(payload.recommendation).toBe('建议创建项目规划文档');
    expect(payload.type).toBe('phase-recommendation');
    expect(payload.projectId).toBe('p1');
  });

  it('should emit suggestion for planning -> architecture', async () => {
    const emittedEvents: DomainEvent[] = [];
    eventBus.on('ai.suggestion', (e) => { emittedEvents.push(e); });

    handler.register();

    eventBus.emit(
      createEvent('project.phase.changed', {
        projectId: 'p1',
        phase: 'architecture',
        previousPhase: 'planning',
      }),
    );

    await new Promise((r) => setTimeout(r, 50));

    expect(emittedEvents).toHaveLength(1);
    const payload = emittedEvents[0].payload as any;
    expect(payload.recommendation).toBe('建议进行架构评审');
  });

  it('should emit suggestion for architecture -> implementation', async () => {
    const emittedEvents: DomainEvent[] = [];
    eventBus.on('ai.suggestion', (e) => { emittedEvents.push(e); });

    handler.register();

    eventBus.emit(
      createEvent('project.phase.changed', {
        projectId: 'p1',
        phase: 'implementation',
        previousPhase: 'architecture',
      }),
    );

    await new Promise((r) => setTimeout(r, 50));

    expect(emittedEvents).toHaveLength(1);
    const payload = emittedEvents[0].payload as any;
    expect(payload.recommendation).toBe('建议创建工作流模板');
  });

  it('should emit suggestion for implementation -> testing', async () => {
    const emittedEvents: DomainEvent[] = [];
    eventBus.on('ai.suggestion', (e) => { emittedEvents.push(e); });

    handler.register();

    eventBus.emit(
      createEvent('project.phase.changed', {
        projectId: 'p1',
        phase: 'testing',
        previousPhase: 'implementation',
      }),
    );

    await new Promise((r) => setTimeout(r, 50));

    expect(emittedEvents).toHaveLength(1);
    const payload = emittedEvents[0].payload as any;
    expect(payload.recommendation).toBe('建议生成测试计划');
  });

  it('should emit suggestion for testing -> deployment', async () => {
    const emittedEvents: DomainEvent[] = [];
    eventBus.on('ai.suggestion', (e) => { emittedEvents.push(e); });

    handler.register();

    eventBus.emit(
      createEvent('project.phase.changed', {
        projectId: 'p1',
        phase: 'deployment',
        previousPhase: 'testing',
      }),
    );

    await new Promise((r) => setTimeout(r, 50));

    expect(emittedEvents).toHaveLength(1);
    const payload = emittedEvents[0].payload as any;
    expect(payload.recommendation).toBe('建议准备发布说明');
  });

  it('should emit suggestion for deployment -> completed', async () => {
    const emittedEvents: DomainEvent[] = [];
    eventBus.on('ai.suggestion', (e) => { emittedEvents.push(e); });

    handler.register();

    eventBus.emit(
      createEvent('project.phase.changed', {
        projectId: 'p1',
        phase: 'completed',
        previousPhase: 'deployment',
      }),
    );

    await new Promise((r) => setTimeout(r, 50));

    expect(emittedEvents).toHaveLength(1);
    const payload = emittedEvents[0].payload as any;
    expect(payload.recommendation).toBe('建议归档项目并记录经验');
  });

  it('should NOT emit suggestion for unknown phase transitions', async () => {
    const emittedEvents: DomainEvent[] = [];
    eventBus.on('ai.suggestion', (e) => { emittedEvents.push(e); });

    handler.register();

    eventBus.emit(
      createEvent('project.phase.changed', {
        projectId: 'p1',
        phase: 'unknown',
        previousPhase: 'unknown',
      }),
    );

    await new Promise((r) => setTimeout(r, 50));

    expect(emittedEvents).toHaveLength(0);
  });

  it('should emit suggestion with correct source', async () => {
    const emittedEvents: DomainEvent[] = [];
    eventBus.on('ai.suggestion', (e) => { emittedEvents.push(e); });

    handler.register();

    eventBus.emit(
      createEvent('project.phase.changed', {
        phase: 'planning',
        previousPhase: 'requirements',
      }),
    );

    await new Promise((r) => setTimeout(r, 50));

    expect(emittedEvents[0].source).toBe('ai-engine');
  });
});

// --- Error Isolation Tests ---

describe('Handler Error Isolation', () => {
  it('handler errors should not affect other handlers on the same event', async () => {
    const eventBus = createEventBus();
    const logger = createMockLogger();

    // Create a handler that will throw
    const brokenHandler = new (class extends (await import('@/lib/modules/ai-engine/handlers/base.handler')).BaseAIHandler {
      get eventType() { return 'test.event'; }
      async handle() { throw new Error('Handler exploded!'); }
    })(eventBus, logger);

    // Create a handler that should still work
    let workingHandlerCalled = false;
    const workingHandler = new (class extends (await import('@/lib/modules/ai-engine/handlers/base.handler')).BaseAIHandler {
      get eventType() { return 'test.event'; }
      async handle() { workingHandlerCalled = true; }
    })(eventBus, logger);

    brokenHandler.register();
    workingHandler.register();

    eventBus.emit(createEvent('test.event', {}));

    await new Promise((r) => setTimeout(r, 50));

    // The broken handler should log an error
    expect(logger.error).toHaveBeenCalled();

    // The working handler should still have been called
    expect(workingHandlerCalled).toBe(true);
  });

  it('safeHandle should catch and log errors without throwing', async () => {
    const eventBus = createEventBus();
    const logger = createMockLogger();

    const failingHandler = new (class extends (await import('@/lib/modules/ai-engine/handlers/base.handler')).BaseAIHandler {
      get eventType() { return 'fail.event'; }
      async handle() { throw new Error('Intentional failure'); }
    })(eventBus, logger);

    // Call safeHandle directly
    await failingHandler.safeHandle(createEvent('fail.event', {}));

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('fail.event'),
      expect.any(Error),
    );
  });
});
