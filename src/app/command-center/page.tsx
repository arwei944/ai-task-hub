'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useCommandCenter } from '@/lib/hooks/use-command-center';
import { useSSE } from '@/lib/hooks/use-sse';
import { useCCOverview, useCCInvalidate } from '@/lib/hooks/use-command-center-query';
import { useToast } from '@/components/ui/toast';
import { ProjectCard } from '@/components/command-center/project-card';
import { EventStream } from '@/components/command-center/event-stream';
import { QuickCreateDialog } from '@/components/command-center/quick-create-dialog';
import { ProjectFocusView } from '@/components/command-center/project-focus-view';
import { DetailDrawer } from '@/components/command-center/detail-drawer';
import { StatsDashboard } from '@/components/command-center/stats-dashboard';

export default function CommandCenterPage() {
  const { state, focusProject, openDetail, goBack, reset, setLayoutMode, setStatusFilter, setSearchQuery } = useCommandCenter();

  // React Query hooks
  const { data: overview, isLoading, error } = useCCOverview();
  const { invalidateAll } = useCCInvalidate();

  // Toast notifications
  const { info } = useToast();

  // SSE 事件收集
  const [sseEvents, setSseEvents] = useState<any[]>([]);
  // 记录哪些项目收到了新事件（用于脉搏动画）
  const [newEventProjectIds, setNewEventProjectIds] = useState<Set<string>>(new Set());

  // SSE 连接状态
  const [sseConnected, setSseConnected] = useState(false);

  // 快速创建对话框
  const [showQuickCreate, setShowQuickCreate] = useState(false);

  // 搜索防抖
  const searchTimerRef = useRef<NodeJS.Timeout>();

  // Toast 事件消息映射
  const eventMessages: Record<string, string> = {
    'project.created': '🆕 新项目已创建',
    'project.phase.changed': '📋 项目阶段已变更',
    'project.status.changed': '🔄 项目状态已更新',
    'task.created': '📝 新任务已创建',
    'task.status_changed': '✅ 任务状态已变更',
    'task.completed': '🎉 任务已完成',
    'agent.registered': '🤖 新智能体已注册',
    'work-log.created': '💼 新工作日志已记录',
    'milestone.completed': '🏆 里程碑已完成',
  };

  // SSE 实时订阅
  useSSE({
    channels: ['projects', 'agents', 'tasks', 'events', 'notifications'],
    onEvent: (event: any) => {
      // 连接状态
      if (event.type === 'system.connected') {
        setSseConnected(true);
      }

      // 收集事件到事件流
      setSseEvents(prev => [...prev.slice(-49), event]);

      // Toast notification for important events
      if (eventMessages[event.type]) {
        const desc = event.data?.description || event.data?.name || event.data?.title || '';
        info(eventMessages[event.type], typeof desc === 'string' ? desc.slice(0, 50) : '');
      }

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

      // 触发 React Query 数据刷新
      if (event.type?.startsWith('project.') || event.type?.startsWith('task.') || event.type?.startsWith('agent.')) {
        invalidateAll();
      }
    },
  });

  // 搜索防抖处理
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setSearchQuery(value);
    }, 300);
  };

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

  // 清理搜索定时器
  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, []);

  // 错误状态处理
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <div className="text-4xl mb-2">⚠️</div>
        <div className="text-sm mb-2">数据加载失败</div>
        <button onClick={() => invalidateAll()} className="text-xs text-primary hover:underline">点击重试</button>
      </div>
    );
  }

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
      {/* 统计仪表盘 */}
      <div className="flex items-center gap-4 px-6 py-3 border-b bg-card/50">
        <StatsDashboard projects={projects} />
        <div className="ml-auto flex items-center gap-2">
          {/* SSE 连接状态指示器 */}
          <span
            className={`w-2 h-2 rounded-full ${sseConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}
            title={sseConnected ? '实时连接中' : '未连接'}
          />
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
          defaultValue={state.searchQuery}
          onChange={handleSearchChange}
          className="ml-auto w-48 px-3 py-1 text-sm rounded-md border bg-background"
        />
      </div>

      {/* 主内容区 */}
      <div className="flex-1 overflow-auto p-6">
        {state.viewLevel === 'battlefield' && (
          state.layoutMode === 'free' ? (
            <div className="relative w-full h-full min-h-[500px]">
              {searchedProjects.map((project: any, index: number) => {
                const col = index % 4;
                const row = Math.floor(index / 4);
                return (
                  <div
                    key={project.id}
                    onClick={() => focusProject(project.id)}
                    className="absolute w-72 cursor-move"
                    style={{
                      left: `${col * 300 + 16}px`,
                      top: `${row * 220 + 16}px`,
                    }}
                  >
                    <ProjectCard project={project} onClick={focusProject} onUpdated={invalidateAll} />
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {searchedProjects.map((project: any) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onClick={focusProject}
                  isNewEvent={newEventProjectIds.has(project.id)}
                  onUpdated={invalidateAll}
                />
              ))}
            </div>
          )
        )}

        {state.viewLevel === 'focus' && state.focusedProjectId && (
          <ProjectFocusView
            projectId={state.focusedProjectId}
            onBack={goBack}
            onOpenTaskDetail={(taskId) => openDetail('task', taskId)}
          />
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
          invalidateAll();
        }}
      />

      {/* 第三层：详情抽屉 */}
      <DetailDrawer
        item={state.detailItem}
        projectId={state.focusedProjectId || undefined}
        onClose={goBack}
      />
    </div>
  );
}
