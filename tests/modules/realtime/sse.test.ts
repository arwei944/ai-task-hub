import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SSEService } from '@/lib/modules/realtime/sse.service';
import { EventBus } from '@/lib/core/event-bus';
import { Logger } from '@/lib/core/logger';

describe('SSEService', () => {
  let sseService: SSEService;
  const logger = new Logger('test');

  beforeEach(() => {
    sseService = new SSEService(logger);
  });

  afterEach(() => {
    sseService.destroy();
  });

  it('should add and track clients', () => {
    const controller = {
      enqueue: vi.fn(),
      close: vi.fn(),
    } as unknown as ReadableStreamDefaultController;

    const client = sseService.addClient(controller, { channels: ['tasks'] });

    expect(client.id).toBeTruthy();
    expect(client.channels.has('tasks')).toBe(true);
    expect(sseService.getClientCount()).toBe(1);
  });

  it('should remove clients', () => {
    const controller = {
      enqueue: vi.fn(),
      close: vi.fn(),
    } as unknown as ReadableStreamDefaultController;

    const client = sseService.addClient(controller);
    sseService.removeClient(client.id);

    expect(sseService.getClientCount()).toBe(0);
  });

  it('should broadcast to clients in the same channel', () => {
    const controller1 = { enqueue: vi.fn(), close: vi.fn() } as unknown as ReadableStreamDefaultController;
    const controller2 = { enqueue: vi.fn(), close: vi.fn() } as unknown as ReadableStreamDefaultController;
    const controller3 = { enqueue: vi.fn(), close: vi.fn() } as unknown as ReadableStreamDefaultController;

    sseService.addClient(controller1, { channels: ['tasks'] });
    sseService.addClient(controller2, { channels: ['tasks'] });
    sseService.addClient(controller3, { channels: ['notifications'] });

    // Reset mocks after initial connection events
    vi.clearAllMocks();

    sseService.broadcast('tasks', {
      type: 'task.created',
      data: { title: 'Test' },
    });

    // Only tasks channel clients should receive
    expect(controller1.enqueue).toHaveBeenCalled();
    expect(controller2.enqueue).toHaveBeenCalled();
    expect(controller3.enqueue).not.toHaveBeenCalled();
  });

  it('should broadcast to global channel subscribers', () => {
    const controller = { enqueue: vi.fn(), close: vi.fn() } as unknown as ReadableStreamDefaultController;

    sseService.addClient(controller, { channels: ['global'] });

    vi.clearAllMocks();

    sseService.broadcast('tasks', {
      type: 'task.created',
      data: { title: 'Test' },
    });

    // Global channel receives all broadcasts
    expect(controller.enqueue).toHaveBeenCalled();
  });

  it('should support subscribing to additional channels', () => {
    const controller = { enqueue: vi.fn(), close: vi.fn() } as unknown as ReadableStreamDefaultController;

    const client = sseService.addClient(controller, { channels: ['tasks'] });
    sseService.subscribe(client.id, ['notifications']);

    expect(client.channels.has('notifications')).toBe(true);
  });

  it('should support unsubscribing from channels', () => {
    const controller = { enqueue: vi.fn(), close: vi.fn() } as unknown as ReadableStreamDefaultController;

    const client = sseService.addClient(controller, { channels: ['tasks', 'notifications'] });
    sseService.unsubscribe(client.id, ['notifications']);

    expect(client.channels.has('notifications')).toBe(false);
    expect(client.channels.has('tasks')).toBe(true);
  });

  it('should support event listeners', () => {
    const callback = vi.fn();
    sseService.on('task.created', callback);

    sseService.broadcast('tasks', {
      type: 'task.created',
      data: { title: 'Test' },
    });

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should support wildcard event listeners', () => {
    const callback = vi.fn();
    sseService.on('*', callback);

    sseService.broadcast('tasks', {
      type: 'task.created',
      data: { title: 'Test' },
    });

    sseService.broadcast('notifications', {
      type: 'notification.new',
      data: { message: 'Test' },
    });

    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('should support channel wildcard listeners', () => {
    const callback = vi.fn();
    sseService.on('channel:tasks', callback);

    sseService.broadcast('tasks', {
      type: 'task.created',
      data: { title: 'Test' },
    });

    sseService.broadcast('notifications', {
      type: 'notification.new',
      data: {},
    });

    // Only tasks channel events
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should remove disconnected clients on send failure', () => {
    const controller = {
      enqueue: vi.fn(() => { throw new Error('disconnected'); }),
      close: vi.fn(),
    } as unknown as ReadableStreamDefaultController;

    const client = sseService.addClient(controller);

    sseService.broadcast('global', {
      type: 'test',
      data: {},
    });

    expect(sseService.getClientCount()).toBe(0);
  });

  it('should return unsubscribe function from on()', () => {
    const callback = vi.fn();
    const unsubscribe = sseService.on('task.created', callback);

    unsubscribe();

    sseService.broadcast('tasks', {
      type: 'task.created',
      data: {},
    });

    expect(callback).not.toHaveBeenCalled();
  });
});

describe('EventBus wildcard support', () => {
  it('should deliver events to wildcard listeners', () => {
    const bus = new EventBus();
    const callback = vi.fn();

    bus.on('*', callback);
    bus.emit({
      type: 'task.created',
      payload: { title: 'Test' },
      timestamp: new Date(),
      source: 'test',
    });

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should deliver events to both specific and wildcard listeners', () => {
    const bus = new EventBus();
    const specificCallback = vi.fn();
    const wildcardCallback = vi.fn();

    bus.on('task.created', specificCallback);
    bus.on('*', wildcardCallback);

    bus.emit({
      type: 'task.created',
      payload: { title: 'Test' },
      timestamp: new Date(),
      source: 'test',
    });

    expect(specificCallback).toHaveBeenCalledTimes(1);
    expect(wildcardCallback).toHaveBeenCalledTimes(1);
  });

  it('should support wildcard with emitAsync', async () => {
    const bus = new EventBus();
    const callback = vi.fn();

    bus.on('*', callback);
    await bus.emitAsync({
      type: 'task.updated',
      payload: {},
      timestamp: new Date(),
      source: 'test',
    });

    expect(callback).toHaveBeenCalledTimes(1);
  });
});
