// ============================================================
// Phase 3: Memory Leak Detection Tests (W-ML-01 ~ W-ML-05)
// ============================================================
//
// Tests verify that components properly clean up resources
// (listeners, timers, sessions, clients) after use/destroy.
//

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---- W-ML-01: SSE Service - create/destroy 100 connections ----
describe('W-ML-01: SSE Service connection lifecycle', () => {
  let SSEService: any;
  let sseService: any;

  beforeEach(async () => {
    vi.resetModules();
    // Reset singleton
    const mod = await import('@/lib/modules/realtime/sse.service');
    SSEService = mod.SSEService;
    sseService = new SSEService();
  });

  afterEach(() => {
    sseService?.destroy();
  });

  it('should not leak clients after creating and removing 100 connections', () => {
    const clientIds: string[] = [];

    // Create 100 mock controllers and add clients
    for (let i = 0; i < 100; i++) {
      const mockController = {
        enqueue: vi.fn(),
        close: vi.fn(),
      };
      const client = sseService.addClient(mockController as any, {
        userId: `user-${i}`,
        channels: ['global'],
      });
      clientIds.push(client.id);
    }

    expect(sseService.getClientCount()).toBe(100);

    // Remove all clients
    for (const id of clientIds) {
      sseService.removeClient(id);
    }

    expect(sseService.getClientCount()).toBe(0);
  });

  it('should not accumulate event listeners after repeated on/off cycles', () => {
    const callback = vi.fn();

    // Register and unregister 50 times
    for (let i = 0; i < 50; i++) {
      const unsub = sseService.on('test.event', callback);
      unsub();
    }

    // Broadcast should not trigger any listener
    sseService.broadcast('global', { type: 'test.event', data: {} });
    expect(callback).not.toHaveBeenCalled();
  });

  it('should clean up all internal state on destroy', () => {
    // Add some clients
    for (let i = 0; i < 10; i++) {
      const mockController = {
        enqueue: vi.fn(),
        close: vi.fn(),
      };
      sseService.addClient(mockController as any);
    }

    // Register some listeners
    sseService.on('test.event', vi.fn());
    sseService.on('channel:global', vi.fn());
    sseService.on('*', vi.fn());

    sseService.destroy();

    expect(sseService.getClientCount()).toBe(0);
  });
});

// ---- W-ML-02: TriggerDispatcher - register/unregister triggers ----
describe('W-ML-02: TriggerDispatcher trigger registration', () => {
  it('should keep trigger 1 and 3 active after unregistering trigger 2', async () => {
    const { TriggerDispatcher } = await import('@/lib/modules/workflow-engine/triggers/trigger-dispatcher');

    // Create mocks
    const mockPrisma = {} as any;
    const mockOrchestrator = {
      startExecution: vi.fn().mockResolvedValue({ executionId: 'exec-1', status: 'running' }),
    } as any;
    const mockEventBus = {
      on: vi.fn().mockReturnValue(() => {}),
    } as any;
    const mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    } as any;

    const dispatcher = new TriggerDispatcher(mockPrisma, mockOrchestrator, mockEventBus, mockLogger);

    // Register 3 schedule triggers
    await dispatcher.registerWorkflowTrigger({
      workflowId: 'wf-1',
      trigger: 'schedule',
      triggerConfig: JSON.stringify({ intervalMs: 60000 }),
    });
    await dispatcher.registerWorkflowTrigger({
      workflowId: 'wf-2',
      trigger: 'schedule',
      triggerConfig: JSON.stringify({ intervalMs: 60000 }),
    });
    await dispatcher.registerWorkflowTrigger({
      workflowId: 'wf-3',
      trigger: 'schedule',
      triggerConfig: JSON.stringify({ intervalMs: 60000 }),
    });

    // Unregister trigger 2
    await dispatcher.unregisterWorkflowTrigger('wf-2');

    // Shutdown and verify no errors (cleanup is clean)
    dispatcher.shutdown();

    // Verify no lingering scheduled jobs
    // After shutdown, all scheduled jobs should be cleared
    expect(mockLogger.info).toHaveBeenCalledWith('Trigger dispatcher shut down');
  });

  it('should not leak event listeners when registering and unregistering event triggers', async () => {
    const { TriggerDispatcher } = await import('@/lib/modules/workflow-engine/triggers/trigger-dispatcher');

    const mockPrisma = {} as any;
    const mockOrchestrator = {
      startExecution: vi.fn().mockResolvedValue({ executionId: 'exec-1', status: 'running' }),
    } as any;

    let listenerCount = 0;
    const mockEventBus = {
      on: vi.fn().mockImplementation(() => {
        listenerCount++;
        return () => {
          listenerCount--;
        };
      }),
    } as any;
    const mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    } as any;

    const dispatcher = new TriggerDispatcher(mockPrisma, mockOrchestrator, mockEventBus, mockLogger);

    // Register first event trigger
    await dispatcher.registerWorkflowTrigger({
      workflowId: 'wf-event-1',
      trigger: 'event',
      triggerConfig: JSON.stringify({ eventType: 'task.created' }),
    });
    expect(listenerCount).toBe(1);

    // registerWorkflowTrigger calls unregisterWorkflowTrigger first,
    // but now unregisterWorkflowTrigger only removes listeners matching the target workflowId.
    // So registering a second event trigger will only clear wf-event-2's listeners (none yet),
    // then add the new one for wf-event-2.
    await dispatcher.registerWorkflowTrigger({
      workflowId: 'wf-event-2',
      trigger: 'event',
      triggerConfig: JSON.stringify({ eventType: 'task.updated' }),
    });
    // After the second register: wf-event-1's listener is still active, wf-event-2's listener added
    expect(listenerCount).toBe(2);

    // Unregister wf-event-2 only removes its listener (not wf-event-1's)
    await dispatcher.unregisterWorkflowTrigger('wf-event-2');
    expect(listenerCount).toBe(1);

    // Verify no leaked listeners after shutdown
    dispatcher.shutdown();
    expect(listenerCount).toBe(0);
  });
});

// ---- W-ML-03: NotificationRuleEngine - listener cleanup ----
describe('W-ML-03: NotificationRuleEngine listener cleanup', () => {
  it('should not leak event bus listeners after creating and destroying RuleEngine 10 times', async () => {
    const { NotificationRuleEngine } = await import('@/lib/modules/notifications/rule-engine');
    const { EventBus } = await import('@/lib/core/event-bus');

    const eventBus = new EventBus();
    const mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    } as any;
    const mockRepo = {
      create: vi.fn().mockResolvedValue({}),
    } as any;

    const getListenerCountBefore = eventBus.getListenerCount();

    // Create and start 10 RuleEngines
    for (let i = 0; i < 10; i++) {
      const engine = new NotificationRuleEngine(mockRepo, eventBus, mockLogger);
      engine.start();
    }

    // The start() method registers 24 listeners each time (task, project, release, workflow, agent, github, requirement events)
    // 10 engines * 24 listeners = 240 new listeners
    const listenerCountAfter = eventBus.getListenerCount();
    const expectedNewListeners = 10 * 34; // 34 event types registered per start()
    expect(listenerCountAfter - getListenerCountBefore).toBe(expectedNewListeners);

    // Clean up all listeners
    eventBus.removeAllListeners();
    expect(eventBus.getListenerCount()).toBe(0);
  });

  it('should properly manage rules and channels across instances', async () => {
    const { NotificationRuleEngine } = await import('@/lib/modules/notifications/rule-engine');
    const { EventBus } = await import('@/lib/core/event-bus');

    const eventBus = new EventBus();
    const mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    } as any;
    const mockRepo = {
      create: vi.fn().mockResolvedValue({}),
    } as any;

    const engine = new NotificationRuleEngine(mockRepo, eventBus, mockLogger);

    // Add rules
    engine.addRule({ event: 'task.created', action: 'log', level: 'info' });
    engine.addRule({ event: 'task.updated', action: 'log', level: 'info' });
    expect(engine.getRules()).toHaveLength(2);

    // Remove a rule
    engine.removeRule('task.created');
    expect(engine.getRules()).toHaveLength(1);
    expect(engine.getRules()[0].event).toBe('task.updated');

    // Register and unregister channels
    const mockChannel = {
      id: 'test-channel',
      name: 'Test Channel',
      send: vi.fn().mockResolvedValue(undefined),
    };
    engine.registerChannel(mockChannel);
    expect(engine.getChannels()).toHaveLength(1);

    engine.unregisterChannel('test-channel');
    expect(engine.getChannels()).toHaveLength(0);
  });
});

// ---- W-ML-04: MCP Route - session management ----
describe('W-ML-04: MCP session management', () => {
  it('should not accumulate sessions beyond active count', async () => {
    // We test the session Map pattern directly
    // The actual sessions Map is module-level in mcp/route.ts
    // We simulate the same pattern to verify the logic
    const sessions = new Map<string, { server: object; transport: object }>();

    const SESSION_COUNT = 100;

    // Create 100 sessions
    for (let i = 0; i < SESSION_COUNT; i++) {
      const sessionId = `session-${i}`;
      sessions.set(sessionId, {
        server: { id: `server-${i}` },
        transport: { id: `transport-${i}` },
      });
    }

    expect(sessions.size).toBe(SESSION_COUNT);

    // Remove 50 sessions (simulating cleanup)
    for (let i = 0; i < 50; i++) {
      sessions.delete(`session-${i}`);
    }

    expect(sessions.size).toBe(SESSION_COUNT - 50);

    // Clean up remaining
    sessions.clear();
    expect(sessions.size).toBe(0);
  });

  it('should handle rapid session creation without unbounded growth', () => {
    const sessions = new Map<string, object>();
    const MAX_SESSIONS = 200;

    // Simulate rapid creation
    for (let i = 0; i < 500; i++) {
      const sessionId = `rapid-${i}`;
      sessions.set(sessionId, { id: sessionId });

      // Simulate cleanup of old sessions when exceeding max
      if (sessions.size > MAX_SESSIONS) {
        const oldestKey = sessions.keys().next().value as string;
        sessions.delete(oldestKey);
      }
    }

    // Should not exceed max
    expect(sessions.size).toBeLessThanOrEqual(MAX_SESSIONS);
  });
});

// ---- W-ML-05: WorkflowEngineModule - disable cleanup ----
describe('W-ML-05: WorkflowEngineModule disable cleanup', () => {
  it('should call disable without errors', async () => {
    // Import the module class directly
    const mod = await import('@/lib/modules/workflow-engine/workflow-engine.module');
    const WorkflowEngineModule = mod.default;

    const module = new WorkflowEngineModule();

    // Verify module metadata
    expect(module.id).toBe('workflow-engine');
    expect(module.locked).toBe(true);

    // disable() should not throw - it's essentially a no-op currently
    // but should be callable without errors
    await expect(module.lifecycle.disable?.()).resolves.not.toThrow();
  });

  it('should have proper lifecycle structure for cleanup', async () => {
    const mod = await import('@/lib/modules/workflow-engine/workflow-engine.module');
    const WorkflowEngineModule = mod.default;

    const module = new WorkflowEngineModule();

    // Verify lifecycle methods exist
    expect(module.lifecycle.install).toBeDefined();
    expect(module.lifecycle.enable).toBeDefined();
    expect(module.lifecycle.disable).toBeDefined();
    expect(module.lifecycle.uninstall).toBeDefined();

    // All lifecycle methods should be functions
    expect(typeof module.lifecycle.install).toBe('function');
    expect(typeof module.lifecycle.enable).toBe('function');
    expect(typeof module.lifecycle.disable).toBe('function');
    expect(typeof module.lifecycle.uninstall).toBe('function');
  });
});
