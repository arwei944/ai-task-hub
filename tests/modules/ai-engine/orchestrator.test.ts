import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IEventBus, ILogger } from '@/lib/core/types';
import { EventBus } from '@/lib/core/event-bus';
import { AIOrchestrator } from '@/lib/modules/ai-engine/ai-orchestrator';
import { BaseAIHandler } from '@/lib/modules/ai-engine/handlers/base.handler';
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

// --- AIOrchestrator Tests ---

describe('AIOrchestrator', () => {
  let eventBus: IEventBus;
  let logger: ILogger;
  let orchestrator: AIOrchestrator;

  beforeEach(() => {
    eventBus = createEventBus();
    logger = createMockLogger();
    orchestrator = new AIOrchestrator(eventBus, logger);
  });

  it('should register handlers and track event types', () => {
    const handler1 = new TaskCreatedHandler(eventBus, logger);
    const handler2 = new TaskStatusHandler(eventBus, logger);
    const handler3 = new ProjectPhaseHandler(eventBus, logger);

    orchestrator.registerHandler(handler1);
    orchestrator.registerHandler(handler2);
    orchestrator.registerHandler(handler3);

    const registered = orchestrator.getRegisteredHandlers();
    expect(registered).toEqual([
      'task.created',
      'task.status.changed',
      'project.phase.changed',
    ]);
  });

  it('should register handlers in order', () => {
    const handler1 = new TaskCreatedHandler(eventBus, logger);
    const handler2 = new ProjectPhaseHandler(eventBus, logger);

    orchestrator.registerHandler(handler1);
    orchestrator.registerHandler(handler2);

    const registered = orchestrator.getRegisteredHandlers();
    expect(registered[0]).toBe('task.created');
    expect(registered[1]).toBe('project.phase.changed');
  });

  it('should return empty array when no handlers registered', () => {
    expect(orchestrator.getRegisteredHandlers()).toEqual([]);
  });

  it('should clear all handlers on unregisterAll', () => {
    const handler1 = new TaskCreatedHandler(eventBus, logger);
    const handler2 = new TaskStatusHandler(eventBus, logger);

    orchestrator.registerHandler(handler1);
    orchestrator.registerHandler(handler2);
    expect(orchestrator.getRegisteredHandlers()).toHaveLength(2);

    orchestrator.unregisterAll();
    expect(orchestrator.getRegisteredHandlers()).toEqual([]);
  });

  it('should register handlers that actually listen on the event bus', () => {
    const handler = new TaskCreatedHandler(eventBus, logger);
    orchestrator.registerHandler(handler);

    // The handler should have registered itself on the event bus
    // We can verify by checking the listener count
    const listenerCount = (eventBus as EventBus).getListenerCount('task.created');
    expect(listenerCount).toBe(1);
  });

  it('should log registration for each handler', () => {
    const handler1 = new TaskCreatedHandler(eventBus, logger);
    const handler2 = new TaskStatusHandler(eventBus, logger);

    orchestrator.registerHandler(handler1);
    orchestrator.registerHandler(handler2);

    // Each handler.register() calls logger.info
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('task.created'),
    );
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('task.status.changed'),
    );
  });

  it('should work with custom handler implementations', () => {
    class CustomHandler extends BaseAIHandler {
      get eventType() { return 'custom.event'; }
      async handle() { /* no-op */ }
    }

    const customHandler = new CustomHandler(eventBus, logger);
    orchestrator.registerHandler(customHandler);

    const registered = orchestrator.getRegisteredHandlers();
    expect(registered).toContain('custom.event');
  });

  it('should allow re-registration after unregisterAll', () => {
    const handler = new TaskCreatedHandler(eventBus, logger);

    orchestrator.registerHandler(handler);
    expect(orchestrator.getRegisteredHandlers()).toHaveLength(1);

    orchestrator.unregisterAll();
    expect(orchestrator.getRegisteredHandlers()).toHaveLength(0);

    orchestrator.registerHandler(handler);
    expect(orchestrator.getRegisteredHandlers()).toHaveLength(1);
  });
});
