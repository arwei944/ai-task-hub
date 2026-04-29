import { createTRPCClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '@/lib/trpc/root-router';

export const trpc = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: '/api/trpc',
      // No auth headers needed - server auto-authenticates as admin
    }),
  ],
});
