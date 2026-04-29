// ============================================================
// C-05: SSE Endpoint - No Authentication (Security Vulnerability)
// ============================================================
//
// These tests document the CURRENT behavior of /api/sse:
// The endpoint has NO authentication protection.
// Any unauthenticated client can connect and receive real-time events.
//
// This is a CRITICAL security vulnerability (C-05).

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

describe('C-05: SSE Endpoint - No Authentication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAddClient.mockReturnValue({ id: 'test-client-id' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // C-05-1: Unauthenticated SSE connection succeeds
  it('C-05-1: Unauthenticated SSE connection returns 200 + SSE stream (VULNERABILITY - no auth check)', async () => {
    // This test documents the vulnerability: an SSE connection without any
    // Authorization header still succeeds and returns a live event stream.
    const request = createUnauthenticatedRequest('http://localhost:3000/api/sse');

    // Verify the request has no Authorization header
    expect(request.headers.get('Authorization')).toBeNull();

    const response = await GET(request);

    // VULNERABILITY: Should return 401/403, but currently returns 200
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/event-stream');
    expect(response.headers.get('Cache-Control')).toBe('no-cache, no-transform');
    expect(response.headers.get('Connection')).toBe('keep-alive');
    expect(response.body).toBeInstanceOf(ReadableStream);
  });

  // C-05-2: Subscribe to a specific channel
  it('C-05-2: Should subscribe to specified channel (channels=task-updates)', async () => {
    mockAddClient.mockReturnValue({ id: 'client-channels' });

    const request = createUnauthenticatedRequest(
      'http://localhost:3000/api/sse?channels=task-updates',
    );
    await GET(request);

    expect(mockAddClient).toHaveBeenCalledTimes(1);
    const callArgs = mockAddClient.mock.calls[0];
    expect(callArgs[1]).toEqual({
      userId: 'admin',
      channels: ['task-updates'],
    });
  });

  // C-05-3: Subscribe to multiple channels
  it('C-05-3: Should subscribe to multiple channels (channels=system,task-updates)', async () => {
    mockAddClient.mockReturnValue({ id: 'client-multi' });

    const request = createUnauthenticatedRequest(
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

  // C-05-4: Empty channels param defaults to global
  it('C-05-4: Empty channels param should subscribe to default global channel', async () => {
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

  // C-05-5: Abort signal triggers client cleanup
  it('C-05-5: Abort signal should trigger client cleanup (removeClient)', async () => {
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
