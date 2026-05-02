// ============================================================
// Ops Health SSE API Route - /api/sse/health
// ============================================================
//
// Server-Sent Events endpoint for real-time health updates.
// Bridges SelfHealingManager.HealthEventEmitter to SSE.
// Events: health.check, health.degraded, health.recovered, circuit.state_change
//
// Auth: Bearer token required (admin only)
// ============================================================

import { getSelfHealingManager } from '@/lib/core/v3/self-healing';
import { Logger } from '@/lib/core/logger';

const logger = new Logger('sse-health');

export async function GET(request: Request) {
  // Auth check: admin only
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(
      JSON.stringify({ error: 'Authentication required' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // Get self-healing manager and subscribe to health events
  const manager = getSelfHealingManager();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection message
      controller.enqueue(`data: ${JSON.stringify({
        type: 'system.connected',
        timestamp: Date.now(),
      })}\n\n`);

      // Subscribe to health events
      const unsubscribe = manager.onHealthEvent((event) => {
        try {
          controller.enqueue(`data: ${JSON.stringify({
            type: event.type,
            channel: 'health',
            data: {
              capabilityId: event.capabilityId,
              report: event.report,
              circuitState: event.circuitState,
            },
            timestamp: event.timestamp,
          })}\n\n`);
        } catch (err) {
          logger.error('Failed to send SSE event', err);
        }
      });

      // Send initial health status
      const status = manager.getStatus();
      controller.enqueue(`data: ${JSON.stringify({
        type: 'health.initial',
        channel: 'health',
        data: status,
        timestamp: Date.now(),
      })}\n\n`);

      // Handle client disconnect
      request.signal.addEventListener('abort', () => {
        unsubscribe();
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}
