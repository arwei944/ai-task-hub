import { createTRPCClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from './root-router';

export const trpc = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: '/api/trpc',
      // Batch multiple requests within 10ms into a single HTTP request
      maxURLLength: 2083,
    }),
  ],
});

/**
 * Stale time configuration for different data types (in milliseconds)
 * Used with React Query's `staleTime` option
 */
export const STALE_TIMES = {
  /** Task list: refetch after 10s */
  tasks: 10_000,
  /** Dashboard stats: refetch after 30s */
  dashboard: 30_000,
  /** Notifications: refetch after 15s */
  notifications: 15_000,
  /** Plugin list: refetch after 60s (rarely changes) */
  plugins: 60_000,
  /** Agent list: refetch after 30s */
  agents: 30_000,
  /** Integration list: refetch after 60s */
  integrations: 60_000,
  /** User profile: refetch after 5 min */
  userProfile: 300_000,
  /** System status: refetch after 30s */
  systemStatus: 30_000,
} as const;

/**
 * Cache time configuration (gcTime in React Query)
 * Data stays in cache for this long after becoming stale
 */
export const CACHE_TIMES = {
  /** Short-lived data: 1 min */
  short: 60_000,
  /** Default: 5 min */
  default: 300_000,
  /** Long-lived data: 30 min */
  long: 1_800_000,
} as const;
