// ============================================================
// SSE API Route Integration Tests - /api/sse
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the SSE service module before importing the route
const mockAddClient = vi.fn();
const mockRemoveClient = vi.fn();
const mockSSEService = {
  addClient: mockAddClient,
  removeClient: mockRemoveClient,
  getClientCount: vi.fn(() => 0),
  broadcast: vi.fn(),
  destroy: vi.fn(),
};

vi.mock('@/lib/modules/realtime/sse.service', () => ({
  getSSEService: () => mockSSEService,
}));

// Mock Logger as a class
vi.mock('@/lib/core/logger', () => ({
  Logger: vi.fn(function (this: any) {
    this.info = vi.fn();
    this.warn = vi.fn();
    this.error = vi.fn();
    this.debug = vi.fn();
  }),
}));

// Import after mocks are set up
import { GET } from '@/app/api/sse/route';

function createMockRequest(url: string, signal?: AbortSignal): Request {
  return new Request(url, {
    method: 'GET',
    signal,
  }) as Request;
}

describe('GET /api/sse', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return 200 with SSE headers', async () => {
    mockAddClient.mockReturnValue({ id: 'test-client-id' });

    const request = createMockRequest('http://localhost:3000/api/sse');
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/event-stream');
    expect(response.headers.get('Cache-Control')).toBe('no-cache, no-transform');
    expect(response.headers.get('Connection')).toBe('keep-alive');
    expect(response.headers.get('X-Accel-Buffering')).toBe('no');
  });

  it('should return a ReadableStream body', async () => {
    mockAddClient.mockReturnValue({ id: 'test-client-id' });

    const request = createMockRequest('http://localhost:3000/api/sse');
    const response = await GET(request);

    expect(response.body).toBeInstanceOf(ReadableStream);
  });

  it('should subscribe to default "global" channel when no channels param', async () => {
    mockAddClient.mockReturnValue({ id: 'client-1' });

    const request = createMockRequest('http://localhost:3000/api/sse');
    await GET(request);

    expect(mockAddClient).toHaveBeenCalledTimes(1);
    const callArgs = mockAddClient.mock.calls[0];
    expect(callArgs[1]).toEqual({
      userId: 'admin',
      channels: ['global'],
    });
  });

  it('should subscribe to specified channels from query param', async () => {
    mockAddClient.mockReturnValue({ id: 'client-2' });

    const request = createMockRequest('http://localhost:3000/api/sse?channels=tasks,notifications');
    await GET(request);

    expect(mockAddClient).toHaveBeenCalledTimes(1);
    const callArgs = mockAddClient.mock.calls[0];
    expect(callArgs[1]).toEqual({
      userId: 'admin',
      channels: ['tasks', 'notifications'],
    });
  });

  it('should filter empty channel values from query param', async () => {
    mockAddClient.mockReturnValue({ id: 'client-3' });

    const request = createMockRequest('http://localhost:3000/api/sse?channels=tasks,,notifications,');
    await GET(request);

    const callArgs = mockAddClient.mock.calls[0];
    expect(callArgs[1].channels).toEqual(['tasks', 'notifications']);
  });

  it('should handle single channel in query param', async () => {
    mockAddClient.mockReturnValue({ id: 'client-4' });

    const request = createMockRequest('http://localhost:3000/api/sse?channels=tasks');
    await GET(request);

    const callArgs = mockAddClient.mock.calls[0];
    expect(callArgs[1].channels).toEqual(['tasks']);
  });

  it('should register abort handler to clean up client on disconnect', async () => {
    const abortController = new AbortController();
    mockAddClient.mockReturnValue({ id: 'client-abort' });

    const request = createMockRequest(
      'http://localhost:3000/api/sse',
      abortController.signal,
    );
    await GET(request);

    abortController.abort();

    expect(mockRemoveClient).toHaveBeenCalledWith('client-abort');
  });

  it('should pass userId as "admin" (single admin mode)', async () => {
    mockAddClient.mockReturnValue({ id: 'admin-client' });

    const request = createMockRequest('http://localhost:3000/api/sse');
    await GET(request);

    const callArgs = mockAddClient.mock.calls[0];
    expect(callArgs[1].userId).toBe('admin');
  });

  it('should handle empty channels param gracefully', async () => {
    mockAddClient.mockReturnValue({ id: 'client-empty' });

    const request = createMockRequest('http://localhost:3000/api/sse?channels=');
    await GET(request);

    const callArgs = mockAddClient.mock.calls[0];
    expect(callArgs[1].channels).toEqual(['global']);
  });
});
