// ============================================================
// HTTP Request Step Tests (Phase 6 - v2.0.0-beta.2)
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HttpRequestStep } from '@/lib/modules/workflow-engine/steps/http-request';

describe('HttpRequestStep', () => {
  let step: HttpRequestStep;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    step = new HttpRequestStep();
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('GET request', () => {
    it('should make a successful GET request and return response data', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        text: async () => JSON.stringify({ message: 'hello' }),
      };

      globalThis.fetch = vi.fn().mockResolvedValue(mockResponse);

      const result = await step.execute(
        { url: 'https://api.example.com/data', method: 'GET' },
        {},
      );

      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      const fetchCall = (globalThis.fetch as any).mock.calls[0];
      expect(fetchCall[0]).toBe('https://api.example.com/data');
      expect(fetchCall[1].method).toBe('GET');

      expect(result).toMatchObject({
        status: 200,
        statusText: 'OK',
        ok: true,
        body: JSON.stringify({ message: 'hello' }),
      });
      expect(result.headers).toHaveProperty('content-type');
    });

    it('should resolve template variables in URL', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        text: async () => '',
      });

      await step.execute(
        { url: 'https://api.example.com/users/{{userId}}' },
        { userId: '123' },
      );

      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://api.example.com/users/123',
        expect.any(Object),
      );
    });
  });

  describe('POST request with body', () => {
    it('should send POST request with body and headers', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        statusText: 'Created',
        headers: new Headers({ 'content-type': 'application/json' }),
        text: async () => '{"id": "new"}',
      });

      const result = await step.execute(
        {
          url: 'https://api.example.com/items',
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token123' },
          body: '{"name": "test"}',
        },
        {},
      );

      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      const fetchCall = (globalThis.fetch as any).mock.calls[0];
      expect(fetchCall[0]).toBe('https://api.example.com/items');
      expect(fetchCall[1].method).toBe('POST');
      expect(fetchCall[1].body).toBe('{"name": "test"}');
      expect(fetchCall[1].headers).toEqual({
        'Content-Type': 'application/json',
        Authorization: 'Bearer token123',
      });

      expect(result).toMatchObject({
        status: 201,
        statusText: 'Created',
        ok: true,
        body: '{"id": "new"}',
      });
    });

    it('should resolve template variables in headers and body', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        text: async () => '',
      });

      await step.execute(
        {
          url: 'https://api.example.com/data',
          method: 'POST',
          headers: { Authorization: 'Bearer {{token}}' },
          body: '{"user": "{{username}}"}',
        },
        { token: 'abc', username: 'john' },
      );

      const fetchCall = (globalThis.fetch as any).mock.calls[0];
      expect(fetchCall[1].headers.Authorization).toBe('Bearer abc');
      expect(fetchCall[1].body).toBe('{"user": "john"}');
    });
  });

  describe('PUT/DELETE/PATCH methods', () => {
    it.each(['PUT', 'DELETE', 'PATCH'] as const)('should support %s method', async (method) => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: method === 'DELETE' ? 204 : 200,
        statusText: 'OK',
        headers: new Headers(),
        text: async () => '',
      });

      const result = await step.execute(
        { url: 'https://api.example.com/resource/1', method },
        {},
      );

      const fetchCall = (globalThis.fetch as any).mock.calls[0];
      expect(fetchCall[1].method).toBe(method);
      expect(result.ok).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should return ok=false for 404 responses', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: new Headers(),
        text: async () => '{"error": "not found"}',
      });

      const result = await step.execute(
        { url: 'https://api.example.com/notfound' },
        {},
      );

      expect(result).toMatchObject({
        status: 404,
        statusText: 'Not Found',
        ok: false,
        error: 'HTTP 404: Not Found',
      });
    });

    it('should return ok=false for 500 responses', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        headers: new Headers(),
        text: async () => 'Server Error',
      });

      const result = await step.execute(
        { url: 'https://api.example.com/error' },
        {},
      );

      expect(result.ok).toBe(false);
      expect(result.status).toBe(500);
      expect(result.error).toContain('HTTP 500');
    });

    it('should handle timeout gracefully', async () => {
      const abortError = new DOMException('The operation was aborted', 'AbortError');
      globalThis.fetch = vi.fn().mockRejectedValue(abortError);

      const result = await step.execute(
        { url: 'https://api.example.com/slow', timeout: 1000 },
        {},
      );

      expect(result).toMatchObject({
        status: 0,
        statusText: 'Timeout',
        ok: false,
        error: expect.stringContaining('timed out'),
      });
    });

    it('should handle network errors', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      await expect(
        step.execute({ url: 'https://api.example.com/fail' }, {}),
      ).rejects.toThrow('HTTP request failed: Network error');
    });

    it('should throw when url is missing', async () => {
      await expect(
        step.execute({}, {}),
      ).rejects.toThrow('http-request step requires "url" in config');
    });

    it('should throw for invalid HTTP method', async () => {
      await expect(
        step.execute({ url: 'https://api.example.com/', method: 'INVALID' }, {}),
      ).rejects.toThrow('Invalid HTTP method: INVALID');
    });
  });

  describe('default behavior', () => {
    it('should default to GET method', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        text: async () => '',
      });

      await step.execute({ url: 'https://api.example.com/' }, {});

      const fetchCall = (globalThis.fetch as any).mock.calls[0];
      expect(fetchCall[1].method).toBe('GET');
    });

    it('should default timeout to 30s', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        text: async () => '',
      });

      await step.execute({ url: 'https://api.example.com/' }, {});

      const fetchCall = (globalThis.fetch as any).mock.calls[0];
      expect(fetchCall[1].signal).toBeDefined();
    });

    it('should not send body for GET requests', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        text: async () => '',
      });

      await step.execute(
        { url: 'https://api.example.com/', method: 'GET', body: 'should be ignored' },
        {},
      );

      const fetchCall = (globalThis.fetch as any).mock.calls[0];
      expect(fetchCall[1].body).toBeUndefined();
    });
  });
});
