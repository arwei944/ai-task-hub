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
      try {
        const data = await trpc.commandCenter.overview.query();
        // Defensive: ensure projects is always an array
        const result = data as any;
        if (result && Array.isArray(result.projects)) {
          return result;
        }
        // Fallback: try to unwrap nested structure
        if (result?.result?.data?.json) {
          return result.result.data.json;
        }
        return { projects: [], total: 0 };
      } catch (err) {
        console.error('[useCCOverview] Query failed:', err);
        return { projects: [], total: 0 };
      }
    },
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    staleTime: 15_000,
    retry: 1,
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
      try {
        const [focusData, tasksData] = await Promise.all([
          trpc.commandCenter.projectFocus.query({ projectId }),
          trpc.projectHub.tasks.list.query({ projectId }),
        ]);
        const focus = focusData as any;
        const tasks = tasksData as any;
        return {
          ...(focus && focus.project ? focus : { project: null }),
          tasks: Array.isArray(tasks?.items) ? tasks.items : [],
        };
      } catch (err) {
        console.error('[useCCProjectFocus] Query failed:', err);
        return { project: null, tasks: [] };
      }
    },
    enabled: !!projectId,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
    staleTime: 10_000,
    retry: 1,
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
