'use client';

import { useEffect, useState, useCallback } from 'react';
import { trpc } from '@/lib/trpc/client';
import { useCommandCenter } from '@/lib/hooks/use-command-center';
import { useSSE } from '@/lib/hooks/use-sse';

export default function CommandCenterPage() {
  const { state, focusProject, goBack, reset, setLayoutMode, setStatusFilter, setSearchQuery } = useCommandCenter();
  const [overview, setOverview] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  // 获取指挥中心概览数据（命令式调用，匹配项目现有模式）
  const fetchOverview = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await trpc.commandCenter.overview.query();
      setOverview(data as any);
    } catch (err) {
      console.error('[CommandCenter] Failed to fetch overview:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview, refreshKey]);

  // SSE 实时订阅
  useSSE({
    channels: ['projects', 'agents', 'tasks', 'events'],
    onEvent: (event: any) => {
      if (event.type?.startsWith('project.') || event.type?.startsWith('task.') || event.type?.startsWith('agent.')) {
        setRefreshKey(k => k + 1);
      }
    },
  });

  // Esc 键返回上一层
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        goBack();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goBack]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground animate-pulse">加载指挥中心...</div>
      </div>
    );
  }

  const projects = overview?.projects ?? [];
  const stats = overview?.stats ?? { total: 0, active: 0, completed: 0, paused: 0, healthScore: 0 };

  // 筛选
  const filteredProjects = state.statusFilter
    ? projects.filter((p: any) => p.status === state.statusFilter)
    : projects;

  // 搜索
  const searchedProjects = state.searchQuery
    ? filteredProjects.filter((p: any) =>
        p.name.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
        p.description?.toLowerCase().includes(state.searchQuery.toLowerCase())
      )
    : filteredProjects;

  return (
    <div className="h-full flex flex-col">
      {/* 统计条 */}
      <div className="flex items-center gap-4 px-6 py-3 border-b bg-card/50">
        <div className="flex items-center gap-6 text-sm">
          <span className="text-muted-foreground">总项目 <strong className="text-foreground">{stats.total}</strong></span>
          <span className="text-green-500">进行中 <strong>{stats.active}</strong></span>
          <span className="text-blue-500">已完成 <strong>{stats.completed}</strong></span>
          <span className="text-yellow-500">暂停 <strong>{stats.paused}</strong></span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {/* 视图切换 */}
          <button
            onClick={() => setLayoutMode('grid')}
            className={`px-3 py-1 rounded-md text-xs transition-colors ${state.layoutMode === 'grid' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
          >
            网格
          </button>
          <button
            onClick={() => setLayoutMode('free')}
            className={`px-3 py-1 rounded-md text-xs transition-colors ${state.layoutMode === 'free' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
          >
            自由
          </button>
        </div>
      </div>

      {/* 筛选栏 */}
      <div className="flex items-center gap-2 px-6 py-2 border-b">
        {[
          { key: null, label: '全部' },
          { key: 'active', label: '进行中' },
          { key: 'completed', label: '已完成' },
          { key: 'paused', label: '暂停' },
          { key: 'archived', label: '已归档' },
        ].map(filter => (
          <button
            key={filter.key ?? 'all'}
            onClick={() => setStatusFilter(filter.key)}
            className={`px-3 py-1 rounded-full text-xs transition-colors ${
              state.statusFilter === filter.key
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {filter.label}
          </button>
        ))}
        <input
          type="text"
          placeholder="搜索项目..."
          value={state.searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="ml-auto w-48 px-3 py-1 text-sm rounded-md border bg-background"
        />
      </div>

      {/* 主内容区 */}
      <div className="flex-1 overflow-auto p-6">
        {state.viewLevel === 'battlefield' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {searchedProjects.map((project: any) => (
              <div
                key={project.id}
                onClick={() => focusProject(project.id)}
                className="group cursor-pointer rounded-xl border bg-card p-4 transition-all hover:shadow-lg hover:-translate-y-0.5"
              >
                {/* 项目头部 */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${
                      project.status === 'active' ? 'bg-green-500' :
                      project.status === 'completed' ? 'bg-blue-500' :
                      project.status === 'paused' ? 'bg-yellow-500' : 'bg-gray-400'
                    }`} />
                    <h3 className="font-medium text-sm truncate max-w-[180px]">{project.name}</h3>
                  </div>
                  <span className="text-xs text-muted-foreground">{project.priority}</span>
                </div>

                {/* 技术栈 */}
                {project.techStack && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {(() => {
                      try { return JSON.parse(project.techStack).slice(0, 3).map((tech: string) => (
                        <span key={tech} className="px-1.5 py-0.5 text-[10px] rounded bg-muted text-muted-foreground">{tech}</span>
                      )); } catch { return null; }
                    })()}
                  </div>
                )}

                {/* 进度条 */}
                <div className="mb-3">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">进度</span>
                    <span className="font-medium">{project.progress || 0}%</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-500"
                      style={{ width: `${project.progress || 0}%` }}
                    />
                  </div>
                </div>

                {/* Agent 状态 */}
                {project.agent && (
                  <div className="flex items-center gap-2 mb-3 text-xs">
                    <span className="text-muted-foreground">🤖</span>
                    <span className="truncate">{project.agent.name}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                      project.agent.isActive ? 'bg-green-500/10 text-green-500' : 'bg-gray-500/10 text-gray-500'
                    }`}>
                      {project.agent.isActive ? '工作中' : '空闲'}
                    </span>
                  </div>
                )}

                {/* 任务统计 */}
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>📋 {project.taskStats?.done || 0}/{project.taskStats?.total || 0}</span>
                  {project.milestoneStats && (
                    <span>📅 {project.milestoneStats.completed || 0}/{project.milestoneStats.total || 0}</span>
                  )}
                </div>

                {/* 最近活动 */}
                {project.recentEvents && project.recentEvents.length > 0 && (
                  <div className="mt-3 pt-3 border-t">
                    <div className="text-xs text-muted-foreground truncate">
                      {project.recentEvents[0].description}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {state.viewLevel === 'focus' && state.focusedProjectId && (
          <div>
            <button onClick={goBack} className="mb-4 text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
              ← 返回全景
            </button>
            <div className="text-muted-foreground text-sm">项目聚焦视图开发中...</div>
          </div>
        )}

        {searchedProjects.length === 0 && state.viewLevel === 'battlefield' && (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <div className="text-4xl mb-2">🎯</div>
            <div className="text-sm">暂无项目</div>
          </div>
        )}
      </div>
    </div>
  );
}
