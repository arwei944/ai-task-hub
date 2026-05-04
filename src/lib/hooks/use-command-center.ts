'use client';

import { useState, useCallback } from 'react';

export type ViewLevel = 'battlefield' | 'focus' | 'detail';
export type LayoutMode = 'grid' | 'free' | 'timeline';

interface DetailItem {
  type: 'task' | 'doc' | 'agent';
  id: string;
}

interface CommandCenterState {
  viewLevel: ViewLevel;
  focusedProjectId: string | null;
  detailItem: DetailItem | null;
  layoutMode: LayoutMode;
  statusFilter: string | null;
  searchQuery: string;
}

const initialState: CommandCenterState = {
  viewLevel: 'battlefield',
  focusedProjectId: null,
  detailItem: null,
  layoutMode: 'grid',
  statusFilter: null,
  searchQuery: '',
};

export function useCommandCenter() {
  const [state, setState] = useState<CommandCenterState>(initialState);

  const focusProject = useCallback((projectId: string) => {
    setState(prev => ({
      ...prev,
      viewLevel: 'focus',
      focusedProjectId: projectId,
      detailItem: null,
    }));
  }, []);

  const openDetail = useCallback((type: DetailItem['type'], id: string) => {
    setState(prev => ({
      ...prev,
      viewLevel: 'detail',
      detailItem: { type, id },
    }));
  }, []);

  const goBack = useCallback(() => {
    setState(prev => {
      if (prev.viewLevel === 'detail') {
        return { ...prev, viewLevel: 'focus', detailItem: null };
      }
      if (prev.viewLevel === 'focus') {
        return { ...prev, viewLevel: 'battlefield', focusedProjectId: null };
      }
      return prev;
    });
  }, []);

  const reset = useCallback(() => {
    setState(initialState);
  }, []);

  const setLayoutMode = useCallback((mode: LayoutMode) => {
    setState(prev => ({ ...prev, layoutMode: mode }));
  }, []);

  const setStatusFilter = useCallback((filter: string | null) => {
    setState(prev => ({ ...prev, statusFilter: filter }));
  }, []);

  const setSearchQuery = useCallback((query: string) => {
    setState(prev => ({ ...prev, searchQuery: query }));
  }, []);

  return {
    state,
    focusProject,
    openDetail,
    goBack,
    reset,
    setLayoutMode,
    setStatusFilter,
    setSearchQuery,
  };
}
