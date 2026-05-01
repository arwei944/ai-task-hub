import { NextRequest } from 'next/server';

async function handler(req: Request) {
  try {
    const { appRouter } = await import('@/lib/trpc/root-router');
    const { createTRPCContext } = await import('@/lib/trpc/server');
    const { fetchRequestHandler } = await import('@trpc/server/adapters/fetch');
    return fetchRequestHandler({
      endpoint: '/api/trpc',
      req,
      router: appRouter,
      createContext: () => createTRPCContext({ req }),
    });
  } catch (error: any) {
    console.error('[tRPC] Handler error:', error?.message, error?.stack);
    return new Response(
      JSON.stringify({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Handler init error: ' + (error?.message || 'unknown') } }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export { handler as GET, handler as POST };
