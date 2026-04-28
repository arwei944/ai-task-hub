// ============================================================
// SSE API Route - /api/sse
// ============================================================
//
// Server-Sent Events endpoint for real-time updates.
// Supports channel subscription via query params: ?channels=tasks,notifications
//

import { getSSEService } from '@/lib/modules/realtime/sse.service';
import { Logger } from '@/lib/core/logger';
import { AuthService } from '@/lib/modules/auth/auth.service';
import { UserRepository } from '@/lib/modules/auth/user.repository';
import { PrismaClient } from '@/generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

const logger = new Logger('sse');

function getAuthService(): AuthService {
  const logger = new Logger('auth');
  const dbPath = process.env.DATABASE_URL?.replace(/^file:/, '') ?? './data/dev.db';
  const adapter = new PrismaBetterSqlite3({ url: dbPath });
  const prisma = new PrismaClient({ adapter });
  const userRepo = new UserRepository(prisma);
  return new AuthService(userRepo, logger);
}

export async function GET(request: Request) {
  // Auth check
  const authService = getAuthService();
  const user = await authService.getUserFromRequest(request);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const sseService = getSSEService(logger);

  const url = new URL(request.url);
  const channelsParam = url.searchParams.get('channels');
  const channels = channelsParam ? channelsParam.split(',').filter(Boolean) : ['global'];

  const userId: string = user.id;

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
