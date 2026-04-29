// SSE API Route
import { getSSEService } from '@/lib/modules/realtime/sse.service';
import { Logger } from '@/lib/core/logger';
const logger = new Logger('sse');
export async function GET(request: Request) {
  const sseService = getSSEService(logger);
  const url = new URL(request.url);
  const channelsParam = url.searchParams.get('channels');
  const channels = channelsParam ? channelsParam.split(',').filter(Boolean) : ['global'];
  const userId: string = 'admin';
  const stream = new ReadableStream({
    start(controller) {
      const client = sseService.addClient(controller, { userId, channels });
      request.signal.addEventListener('abort', () => { sseService.removeClient(client.id); controller.close(); });
    },
  });
  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' },
  });
}
