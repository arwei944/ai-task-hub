'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { trpc } from '@/lib/trpc/client';

// Query key factory
export const ccKeys = {
  overview: ['command-center', 'overview'] as const,
  projectFocus: (id: string) => ['command-center', 'project-focus', id] as const,
  projectTasks: (id: string) => ['command-center', 'project-tasks', id] as const,
  taskList: (projectId: string) => ['command-center', 'tasks', projectId] as const,
};

/**
 * Hook: Fetch command center overview with auto-refresh
 * Auto-refreshes every 30 seconds
 */
export function useCCOverview() {
  return useQuery({
    queryKey: ccKeys.overview,
    queryFn: async () => {
      const data = await trpc.commandCenter.overview.query();
      return data as any;
    },
    refetchInterval: 30_000,       // Auto-refresh every 30s
    refetchOnWindowFocus: true,    // Refresh when tab gains focus
    staleTime: 15_000,             // Consider data stale after 15s
  });
}

/**
 * Hook: Fetch project focus view data
 */
export function useCCProjectFocus(projectId: string | null) {
  return useQuery({
    queryKey: ccKeys.projectFocus(projectId ?? ''),
    queryFn: async () => {
      if (!projectId) return null;
      const [focusData, tasksData] = await Promise.all([
        trpc.commandCenter.projectFocus.query({ projectId }),
        trpc.projectHub.tasks.list.query({ projectId }),
      ]);
      return {
        ...(focusData as any),
        tasks: ((tasksData as any)?.items ?? []) as any[],
      };
    },
    enabled: !!projectId,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
    staleTime: 10_000,
  });
}

/**
 * Hook: Invalidate command center queries (call when SSE events arrive)
 */
export function useCCInvalidate() {
  const queryClient = useQueryClient();

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['command-center'] });
  };

  const invalidateProject = (projectId: string) => {
    queryClient.invalidateQueries({ queryKey: ccKeys.projectFocus(projectId) });
    queryClient.invalidateQueries({ queryKey: ccKeys.overview });
  };

  return { invalidateAll, invalidateProject };
}
