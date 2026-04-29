import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Logger, generateRequestId, setRequestContext, clearRequestContext, getRequestId } from '@/lib/core/logger';

describe('Logger', () => {
  let logger: Logger;

  beforeEach(() => {
    logger = new Logger('test');
    clearRequestContext();
    delete process.env.LOG_FORMAT;
    delete process.env.NODE_ENV;
    delete process.env.LOG_LEVEL;
  });

  afterEach(() => {
    clearRequestContext();
    delete process.env.LOG_FORMAT;
    delete process.env.NODE_ENV;
    delete process.env.LOG_LEVEL;
  });

  // --- 子日志器创建 ---
  describe('child', () => {
    it('should create a child logger with combined context', () => {
      const child = logger.child('service');
      // child is a Logger instance
      expect(child).toBeInstanceOf(Logger);
    });

    it('should chain multiple child contexts', () => {
      const child1 = logger.child('module');
      const child2 = (child1 as Logger).child('service');
      // Verify by checking the format output
      const logSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      child2.info('test');
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('[test:module:service]'),
      );
      logSpy.mockRestore();
    });
  });

  // --- 日志格式 ---
  describe('log format (human-readable)', () => {
    it('should include timestamp, level, context, and message', () => {
      const logSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      logger.info('hello world');
      expect(logSpy).toHaveBeenCalledTimes(1);
      const output = logSpy.mock.calls[0][0] as string;
      expect(output).toMatch(/\[.*\] \[INFO\] \[test\] hello world/);
      logSpy.mockRestore();
    });

    it('should include extra args in output', () => {
      const logSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      logger.info('message', 'arg1', { key: 'value' });
      const output = logSpy.mock.calls[0][0] as string;
      expect(output).toContain('arg1');
      expect(output).toContain('"key":"value"');
      logSpy.mockRestore();
    });

    it('should use console.error for ERROR level', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      logger.error('fail');
      expect(spy).toHaveBeenCalledTimes(1);
      spy.mockRestore();
    });

    it('should use console.warn for WARN level', () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      logger.warn('warning');
      expect(spy).toHaveBeenCalledTimes(1);
      spy.mockRestore();
    });

    it('should use console.info for INFO level', () => {
      const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
      logger.info('info');
      expect(spy).toHaveBeenCalledTimes(1);
      spy.mockRestore();
    });
  });

  describe('log format (JSON)', () => {
    it('should output JSON when LOG_FORMAT=json', () => {
      process.env.LOG_FORMAT = 'json';
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      logger.info('test message');
      expect(logSpy).toHaveBeenCalled();
      const output = JSON.parse(logSpy.mock.calls[0][0] as string);
      expect(output.level).toBe('INFO');
      expect(output.context).toBe('test');
      expect(output.message).toBe('test message');
      expect(output.timestamp).toBeDefined();
      logSpy.mockRestore();
    });

    it('should output JSON when NODE_ENV=production', () => {
      process.env.NODE_ENV = 'production';
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      logger.info('prod message');
      expect(logSpy).toHaveBeenCalled();
      const output = JSON.parse(logSpy.mock.calls[0][0] as string);
      expect(output.level).toBe('INFO');
      expect(output.message).toBe('prod message');
      logSpy.mockRestore();
    });

    it('should include data object in JSON output', () => {
      process.env.LOG_FORMAT = 'json';
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      logger.info('with data', { userId: '123' });
      expect(logSpy).toHaveBeenCalled();
      const output = JSON.parse(logSpy.mock.calls[0][0] as string);
      expect(output.data).toEqual({ userId: '123' });
      logSpy.mockRestore();
    });
  });

  // --- debug 条件输出 ---
  describe('debug', () => {
    it('should output debug in development mode', () => {
      process.env.NODE_ENV = 'development';
      const spy = vi.spyOn(console, 'debug').mockImplementation(() => {});
      logger.debug('debug msg');
      expect(spy).toHaveBeenCalledTimes(1);
      spy.mockRestore();
    });

    it('should output debug when LOG_LEVEL=debug', () => {
      process.env.LOG_LEVEL = 'debug';
      const spy = vi.spyOn(console, 'debug').mockImplementation(() => {});
      logger.debug('debug msg');
      expect(spy).toHaveBeenCalledTimes(1);
      spy.mockRestore();
    });

    it('should not output debug in production without LOG_LEVEL', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.LOG_LEVEL;
      const spy = vi.spyOn(console, 'debug').mockImplementation(() => {});
      logger.debug('debug msg');
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  // --- 请求追踪 ID ---
  describe('request tracing', () => {
    it('should include requestId in output when set', () => {
      setRequestContext('req-123', '/api/tasks');
      const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
      logger.info('traced message');
      const output = spy.mock.calls[0][0] as string;
      expect(output).toContain('[req-123]');
      spy.mockRestore();
    });

    it('should include requestId in JSON output', () => {
      process.env.LOG_FORMAT = 'json';
      setRequestContext('req-456');
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      logger.info('traced');
      expect(logSpy).toHaveBeenCalled();
      const output = JSON.parse(logSpy.mock.calls[0][0] as string);
      expect(output.requestId).toBe('req-456');
      logSpy.mockRestore();
    });

    it('should include path in JSON output when set', () => {
      process.env.LOG_FORMAT = 'json';
      setRequestContext('req-789', '/api/test');
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      logger.info('path test');
      expect(logSpy).toHaveBeenCalled();
      const output = JSON.parse(logSpy.mock.calls[0][0] as string);
      expect(output.path).toBe('/api/test');
      logSpy.mockRestore();
    });

    it('should not include requestId after clearing context', () => {
      setRequestContext('req-abc');
      clearRequestContext();
      const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
      logger.info('no trace');
      const output = spy.mock.calls[0][0] as string;
      expect(output).not.toContain('[req-abc]');
      spy.mockRestore();
    });
  });

  // --- generateRequestId ---
  describe('generateRequestId', () => {
    it('should return a non-empty string', () => {
      const id = generateRequestId();
      expect(id).toBeTruthy();
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });

    it('should generate unique ids', () => {
      const ids = new Set(Array.from({ length: 100 }, () => generateRequestId()));
      expect(ids.size).toBe(100);
    });
  });

  // --- getRequestId ---
  describe('getRequestId', () => {
    it('should return null when no context is set', () => {
      expect(getRequestId()).toBeNull();
    });

    it('should return the set request id', () => {
      setRequestContext('my-req-id');
      expect(getRequestId()).toBe('my-req-id');
    });
  });
});
