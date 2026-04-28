import { createTRPCClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from './root-router';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

export const trpc = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: '/api/trpc',
      maxURLLength: 2083,
      headers() {
        const token = getToken();
        return token ? { Authorization: `Bearer ${token}` } : {};
      },
    }),
  ],
});

/**
 * Stale time configuration for different data types (in milliseconds)
 */
export const STALE_TIMES = {
  tasks: 10_000,
  dashboard: 30_000,
  notifications: 15_000,
  plugins: 60_000,
  agents: 30_000,
  integrations: 60_000,
  userProfile: 300_000,
  systemStatus: 30_000,
} as const;

/**
 * Cache time configuration (gcTime in React Query)
 */
export const CACHE_TIMES = {
  short: 60_000,
  default: 300_000,
  long: 1_800_000,
} as const;
