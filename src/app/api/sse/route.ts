// ============================================================
// SSE API Route - /api/sse
// ============================================================
//
// Server-Sent Events endpoint for real-time updates.
// Supports channel subscription via query params: ?channels=tasks,notifications
//

import { getSSEService } from '@/lib/modules/realtime/sse.service';
import { Logger } from '@/lib/core/logger';

const logger = new Logger('sse');

export async function GET(request: Request) {
  const sseService = getSSEService(logger);

  const url = new URL(request.url);
  const channelsParam = url.searchParams.get('channels');
  const channels = channelsParam ? channelsParam.split(',').filter(Boolean) : ['global'];

  // Extract userId from token if available
  const authHeader = request.headers.get('authorization');
  let userId: string | undefined;
  if (authHeader?.startsWith('Bearer ')) {
    // Simple extraction - full verification done by AuthService if needed
    userId = undefined; // Will be set by auth middleware context if available
  }

  const stream = new ReadableStream({
    start(controller) {
      const client = sseService.addClient(controller, { userId, channels });

      // Handle client disconnect
      request.signal.addEventListener('abort', () => {
        sseService.removeClient(client.id);
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
