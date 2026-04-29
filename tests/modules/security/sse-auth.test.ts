// ============================================================
// C-05: SSE Endpoint - Authentication for Private Channels
// ============================================================
//
// These tests verify that /api/sse requires Bearer token authentication
// for private channels. The 'global' channel remains open (no auth required).
// Private channels (non-global) require a Bearer token.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// --- Mocks ---

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

vi.mock('@/lib/core/logger', () => ({
  Logger: vi.fn(function (this: any) {
    this.info = vi.fn();
    this.warn = vi.fn();
    this.error = vi.fn();
    this.debug = vi.fn();
  }),
}));

import { GET } from '@/app/api/sse/route';

// Helper: create a mock Request with NO Authorization header
function createUnauthenticatedRequest(url: string, signal?: AbortSignal): Request {
  return new Request(url, {
    method: 'GET',
    signal,
    // Explicitly NO Authorization header
  }) as Request;
}

// Helper: create a mock Request WITH Bearer token
function createAuthenticatedRequest(url: string, signal?: AbortSignal): Request {
  return new Request(url, {
    method: 'GET',
    signal,
    headers: { 'Authorization': 'Bearer valid-token' },
  }) as Request;
}

describe('C-05: SSE Endpoint - Authentication for Private Channels', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAddClient.mockReturnValue({ id: 'test-client-id' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // C-05-1: Global channel (default) does not require authentication
  it('C-05-1: Unauthenticated SSE connection to global channel returns 200', async () => {
    const request = createUnauthenticatedRequest('http://localhost:3000/api/sse');

    // Verify the request has no Authorization header
    expect(request.headers.get('Authorization')).toBeNull();

    const response = await GET(request);

    // Global channel is open - no auth required
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/event-stream');
    expect(response.headers.get('Cache-Control')).toBe('no-cache, no-transform');
    expect(response.headers.get('Connection')).toBe('keep-alive');
    expect(response.body).toBeInstanceOf(ReadableStream);
  });

  // C-05-2: Private channel without auth returns 401
  it('C-05-2: Unauthenticated request to private channel returns 401', async () => {
    const request = createUnauthenticatedRequest(
      'http://localhost:3000/api/sse?channels=task-updates',
    );

    expect(request.headers.get('Authorization')).toBeNull();

    const response = await GET(request);
    const data = await response.json();

    // Private channels require authentication
    expect(response.status).toBe(401);
    expect(data.error).toContain('Authentication required');
  });

  // C-05-3: Private channel with auth returns 200
  it('C-05-3: Authenticated request to private channel returns 200 + SSE stream', async () => {
    mockAddClient.mockReturnValue({ id: 'client-auth' });

    const request = createAuthenticatedRequest(
      'http://localhost:3000/api/sse?channels=task-updates',
    );

    expect(request.headers.get('Authorization')).toBe('Bearer valid-token');

    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/event-stream');
    expect(response.body).toBeInstanceOf(ReadableStream);

    expect(mockAddClient).toHaveBeenCalledTimes(1);
    const callArgs = mockAddClient.mock.calls[0];
    expect(callArgs[1]).toEqual({
      userId: 'admin',
      channels: ['task-updates'],
    });
  });

  // C-05-4: Authenticated request to multiple private channels
  it('C-05-4: Authenticated request to multiple private channels succeeds', async () => {
    mockAddClient.mockReturnValue({ id: 'client-multi' });

    const request = createAuthenticatedRequest(
      'http://localhost:3000/api/sse?channels=system,task-updates',
    );
    await GET(request);

    expect(mockAddClient).toHaveBeenCalledTimes(1);
    const callArgs = mockAddClient.mock.calls[0];
    expect(callArgs[1]).toEqual({
      userId: 'admin',
      channels: ['system', 'task-updates'],
    });
  });

  // C-05-5: Empty channels param defaults to global (no auth needed)
  it('C-05-5: Empty channels param should subscribe to default global channel (no auth needed)', async () => {
    mockAddClient.mockReturnValue({ id: 'client-empty' });

    const request = createUnauthenticatedRequest(
      'http://localhost:3000/api/sse?channels=',
    );
    await GET(request);

    expect(mockAddClient).toHaveBeenCalledTimes(1);
    const callArgs = mockAddClient.mock.calls[0];
    expect(callArgs[1]).toEqual({
      userId: 'admin',
      channels: ['global'],
    });
  });

  // C-05-6: Abort signal triggers client cleanup
  it('C-05-6: Abort signal should trigger client cleanup (removeClient)', async () => {
    const abortController = new AbortController();
    mockAddClient.mockReturnValue({ id: 'client-abort-test' });

    const request = createUnauthenticatedRequest(
      'http://localhost:3000/api/sse',
      abortController.signal,
    );
    await GET(request);

    // Client was added
    expect(mockAddClient).toHaveBeenCalledTimes(1);

    // Trigger abort (simulating client disconnect)
    abortController.abort();

    // Client should be removed
    expect(mockRemoveClient).toHaveBeenCalledWith('client-abort-test');
    expect(mockRemoveClient).toHaveBeenCalledTimes(1);
  });
});
