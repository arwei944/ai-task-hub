'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { trpc } from '@/lib/trpc/client';
import { useCommandCenter } from '@/lib/hooks/use-command-center';
import { useSSE } from '@/lib/hooks/use-sse';
import { ProjectCard } from '@/components/command-center/project-card';
import { EventStream } from '@/components/command-center/event-stream';
import { QuickCreateDialog } from '@/components/command-center/quick-create-dialog';

export default function CommandCenterPage() {
  const { state, focusProject, goBack, reset, setLayoutMode, setStatusFilter, setSearchQuery } = useCommandCenter();
  const [overview, setOverview] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  // SSE 事件收集
  const [sseEvents, setSseEvents] = useState<any[]>([]);
  // 记录哪些项目收到了新事件（用于脉搏动画）
  const [newEventProjectIds, setNewEventProjectIds] = useState<Set<string>>(new Set());

  // 快速创建对话框
  const [showQuickCreate, setShowQuickCreate] = useState(false);

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
      // 收集事件到事件流
      setSseEvents(prev => [...prev.slice(-49), event]);

      // 标记收到新事件的项目（触发脉搏动画）
      if (event.data?.projectId) {
        setNewEventProjectIds(prev => {
          const next = new Set(prev);
          next.add(event.data.projectId);
          return next;
        });
        // 1.5秒后清除脉搏动画标记
        setTimeout(() => {
          setNewEventProjectIds(prev => {
            const next = new Set(prev);
            next.delete(event.data.projectId);
            return next;
          });
        }, 1500);
      }

      // 触发数据刷新
      if (event.type?.startsWith('project.') || event.type?.startsWith('task.') || event.type?.startsWith('agent.')) {
        setRefreshKey(k => k + 1);
      }
    },
  });

  // Esc 键返回上一层 / 关闭快速创建
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showQuickCreate) {
          setShowQuickCreate(false);
        } else {
          goBack();
        }
      }
      // ⌘N / Ctrl+N 快速创建
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        setShowQuickCreate(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goBack, showQuickCreate]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground animate-pulse">加载指挥中心...</div>
      </div>
    );
  }

  const projects = overview?.projects ?? [];
  const stats = overview?.stats ?? { total: 0, active: 0, completed: 0, paused: 0, healthScore: 0 };

  // 从 projects 中计算统计（API 返回 enrichedProjects，stats 可能需要从 projects 推导）
  const computedStats = {
    total: projects.length,
    active: projects.filter((p: any) => p.status === 'active').length,
    completed: projects.filter((p: any) => p.status === 'completed').length,
    paused: projects.filter((p: any) => p.status === 'paused').length,
  };
  const displayStats = stats.total > 0 ? stats : computedStats;

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
          <span className="text-muted-foreground">总项目 <strong className="text-foreground">{displayStats.total}</strong></span>
          <span className="text-green-500">进行中 <strong>{displayStats.active}</strong></span>
          <span className="text-blue-500">已完成 <strong>{displayStats.completed}</strong></span>
          <span className="text-yellow-500">暂停 <strong>{displayStats.paused}</strong></span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {/* 快速创建按钮 */}
          <button
            onClick={() => setShowQuickCreate(true)}
            className="px-3 py-1 rounded-md text-xs bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            title="⌘N 快速创建"
          >
            + 新建
          </button>
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
              <ProjectCard
                key={project.id}
                project={project}
                onClick={focusProject}
                isNewEvent={newEventProjectIds.has(project.id)}
              />
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
            <div className="text-sm mb-4">暂无项目</div>
            <button
              onClick={() => setShowQuickCreate(true)}
              className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              创建第一个项目
            </button>
          </div>
        )}
      </div>

      {/* 底部实时事件流 */}
      <EventStream
        events={sseEvents}
        onEventClick={(event) => {
          // 点击事件可以跳转到对应项目
          if (event.data?.projectId) {
            focusProject(event.data.projectId);
          }
        }}
      />

      {/* 快速创建对话框 */}
      <QuickCreateDialog
        open={showQuickCreate}
        onClose={() => setShowQuickCreate(false)}
        onCreated={() => {
          setRefreshKey(k => k + 1);
        }}
      />
    </div>
  );
}
