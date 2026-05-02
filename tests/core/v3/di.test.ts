// ============================================================
// AI Task Hub v3.0 — DI Container Unit Tests
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { DIContainer } from '@/lib/core/v3/di';

describe('DIContainer', () => {
  let container: DIContainer;

  beforeEach(() => {
    container = new DIContainer();
  });

  describe('register & resolve', () => {
    it('should register and resolve a singleton service', () => {
      container.register('test', () => ({ value: 42 }));
      const service = container.resolve<{ value: number }>('test');
      expect(service.value).toBe(42);
    });

    it('should return the same instance for singleton', () => {
      let count = 0;
      container.register('test', () => {
        count++;
        return { id: count };
      });

      const a = container.resolve<{ id: number }>('test');
      const b = container.resolve<{ id: number }>('test');
      expect(a).toBe(b);
      expect(count).toBe(1);
    });

    it('should create new instance for transient', () => {
      let count = 0;
      container.register('test', () => {
        count++;
        return { id: count };
      }, { singleton: false });

      const a = container.resolve<{ id: number }>('test');
      const b = container.resolve<{ id: number }>('test');
      expect(a).not.toBe(b);
      expect(count).toBe(2);
    });

    it('should resolve dependencies', () => {
      container.register('db', () => ({ url: 'sqlite:dev.db' }));
      container.register('repo', (c) => ({
        db: c.resolve<{ url: string }>('db'),
      }));

      const repo = container.resolve<{ db: { url: string } }>('repo');
      expect(repo.db.url).toBe('sqlite:dev.db');
    });
  });

  describe('error handling', () => {
    it('should throw on unregistered token', () => {
      expect(() => container.resolve('nonexistent')).toThrow('Cannot resolve');
    });

    it('should detect circular dependencies', () => {
      container.register('a', (c) => ({ b: c.resolve('b') }));
      container.register('b', (c) => ({ a: c.resolve('a') }));

      expect(() => container.resolve('a')).toThrow('Circular dependency');
    });
  });

  describe('has & reset', () => {
    it('should check if token exists', () => {
      container.register('test', () => ({}));
      expect(container.has('test')).toBe(true);
      expect(container.has('nonexistent')).toBe(false);
    });

    it('should reset all singletons', () => {
      let count = 0;
      container.register('test', () => {
        count++;
        return { id: count };
      });

      container.resolve('test');
      container.reset();
      container.resolve('test');

      expect(count).toBe(2);
    });
  });

  describe('tags', () => {
    it('should register with tags and find by tag', () => {
      container.register('taskService', () => ({}), { tags: ['service', 'task'] });
      container.register('workflowService', () => ({}), { tags: ['service', 'workflow'] });
      container.register('logger', () => ({}), { tags: ['infra'] });

      expect(container.getByTag('service')).toEqual(['taskService', 'workflowService']);
      expect(container.getByTag('task')).toEqual(['taskService']);
      expect(container.getByTag('nonexistent')).toEqual([]);
    });
  });
});
