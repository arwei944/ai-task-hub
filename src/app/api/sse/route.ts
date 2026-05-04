// ============================================================
// SSE API Route - /api/sse
// ============================================================
//
// Server-Sent Events endpoint for real-time updates.
// Supports channel subscription via query params: ?channels=tasks,notifications
// Auth: Bearer token required for private channels; public channels (global) are open
//

import { getSSEService } from '@/lib/modules/realtime/sse.service';
import { Logger } from '@/lib/core/logger';
import { getServices, ensureServicesInitialized } from '@/lib/trpc/server';

const logger = new Logger('sse');

export async function GET(request: Request) {
  const sseService = getSSEService(logger);

  const url = new URL(request.url);
  const channelsParam = url.searchParams.get('channels');
  const channels = channelsParam ? channelsParam.split(',').filter(Boolean) : ['global'];

  // Auth check: private channels require Bearer token
  const privateChannels = channels.filter(ch => ch !== 'global');
  let userId: string = 'anonymous';

  if (privateChannels.length > 0) {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Authentication required for private channels' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Verify token and extract userId
    const token = authHeader.slice(7);
    try {
      await ensureServicesInitialized();
      const services = getServices();
      const user = await services.authService.verifyToken(token);
      if (!user) {
        return new Response(
          JSON.stringify({ error: 'Invalid or expired token' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } },
        );
      }
      userId = user.id;
    } catch {
      return new Response(
        JSON.stringify({ error: 'Token verification failed' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      );
    }
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
