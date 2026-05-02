import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DIContainer } from '@/lib/core/v3/di';
import { DIResolveError } from '@/lib/core/types';

describe('DIContainer', () => {
  let container: DIContainer;

  beforeEach(() => {
    container = new DIContainer();
  });

  // --- register/resolve 单例 ---
  describe('singleton registration', () => {
    it('should register and resolve a singleton service', () => {
      container.register('logger', () => ({ log: () => 'hello' }));
      const instance = container.resolve<{ log: () => string }>('logger');
      expect(instance.log()).toBe('hello');
    });

    it('should return the same instance for singleton on multiple resolves', () => {
      let counter = 0;
      container.register('counter', () => ({ value: ++counter }));
      const a = container.resolve<{ value: number }>('counter');
      const b = container.resolve<{ value: number }>('counter');
      expect(a).toBe(b);
      expect(a.value).toBe(1);
      expect(b.value).toBe(1);
    });

    it('should warn when re-registering a service', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      container.register('svc', () => ({}));
      container.register('svc', () => ({}));
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('re-registered'));
      warnSpy.mockRestore();
    });
  });

  // --- 瞬态 (transient) ---
  describe('transient registration', () => {
    it('should create a new instance each time for transient', () => {
      let counter = 0;
      container.register('factory', () => ({ id: ++counter }), { singleton: false });
      const a = container.resolve<{ id: number }>('factory');
      const b = container.resolve<{ id: number }>('factory');
      expect(a).not.toBe(b);
      expect(a.id).toBe(1);
      expect(b.id).toBe(2);
    });
  });

  // --- 循环依赖检测 ---
  describe('circular dependency detection', () => {
    it('should throw DIResolveError for circular dependencies', () => {
      container.register('a', (c: any) => c.resolve('b'));
      container.register('b', (c: any) => c.resolve('a'));
      expect(() => container.resolve('a')).toThrow(DIResolveError);
      expect(() => container.resolve('a')).toThrow(/Circular dependency/);
    });

    it('should include token name in circular dependency error', () => {
      container.register('x', (c: any) => c.resolve('y'));
      container.register('y', (c: any) => c.resolve('x'));
      try {
        container.resolve('x');
        expect.unreachable('should have thrown');
      } catch (e) {
        expect((e as DIResolveError).token).toBe('x');
      }
    });

    it('should not false-positive on non-circular dependencies', () => {
      container.register('service', () => ({ name: 'svc' }));
      container.register('consumer', (c: any) => ({ svc: c.resolve('service') }));
      const consumer = container.resolve<{ svc: { name: string } }>('consumer');
      expect(consumer.svc.name).toBe('svc');
    });
  });

  // --- 不存在时抛错 ---
  describe('resolve non-existent', () => {
    it('should throw DIResolveError when resolving unregistered token', () => {
      expect(() => container.resolve('nonexistent')).toThrow(DIResolveError);
    });

    it('should include token name in error', () => {
      try {
        container.resolve('missing');
        expect.unreachable('should have thrown');
      } catch (e) {
        expect((e as DIResolveError).token).toBe('missing');
        expect((e as DIResolveError).message).toContain('missing');
      }
    });
  });

  // --- has ---
  describe('has', () => {
    it('should return true for registered token', () => {
      container.register('svc', () => ({}));
      expect(container.has('svc')).toBe(true);
    });

    it('should return false for unregistered token', () => {
      expect(container.has('nope')).toBe(false);
    });
  });

  // --- reset ---
  describe('reset', () => {
    it('should clear singleton instances but keep registrations', () => {
      let counter = 0;
      container.register('svc', () => ({ id: ++counter }));
      const a = container.resolve<{ id: number }>('svc');
      expect(a.id).toBe(1);
      container.reset();
      const b = container.resolve<{ id: number }>('svc');
      expect(b.id).toBe(2);
      expect(container.has('svc')).toBe(true);
    });
  });

  // --- 标签分组 ---
  describe('tags', () => {
    it('should register services with tags', () => {
      container.register('mailer', () => ({}), { tags: ['notification'] });
      container.register('sms', () => ({}), { tags: ['notification'] });
      container.register('db', () => ({}), { tags: ['storage'] });
      expect(container.getByTag('notification')).toEqual(['mailer', 'sms']);
      expect(container.getByTag('storage')).toEqual(['db']);
    });

    it('should return empty array for non-existent tag', () => {
      expect(container.getByTag('nonexistent')).toEqual([]);
    });

    it('should support multiple tags per service', () => {
      container.register('multi', () => ({}), { tags: ['a', 'b', 'c'] });
      expect(container.getByTag('a')).toEqual(['multi']);
      expect(container.getByTag('b')).toEqual(['multi']);
      expect(container.getByTag('c')).toEqual(['multi']);
    });
  });

  // --- getRegisteredTokens ---
  describe('getRegisteredTokens', () => {
    it('should return all registered token names', () => {
      container.register('a', () => ({}));
      container.register('b', () => ({}));
      container.register('c', () => ({}));
      const tokens = container.getRegisteredTokens();
      expect(tokens).toContain('a');
      expect(tokens).toContain('b');
      expect(tokens).toContain('c');
      expect(tokens).toHaveLength(3);
    });

    it('should return empty array when no services registered', () => {
      expect(container.getRegisteredTokens()).toEqual([]);
    });
  });
});
