import { createTRPCClient, httpBatchLink } from '@trpc/client';
import superjson from 'superjson';
import type { AppRouter } from '@/lib/trpc/root-router';

export const trpc = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: '/api/trpc',
      transformer: superjson,
      headers() {
        if (typeof window !== 'undefined') {
          const token = localStorage.getItem('token');
          if (token) {
            return { Authorization: `Bearer ${token}` };
          }
        }
        return {};
      },
    }),
  ],
});
