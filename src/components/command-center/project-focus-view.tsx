'use client';

import { useState, useEffect, useCallback } from 'react';
import { trpc } from '@/lib/trpc/client';
import { useToast } from '@/components/ui/toast';

interface ProjectFocusViewProps {
  projectId: string;
  onBack: () => void;
  onOpenTaskDetail?: (taskId: string) => void;
}

export function ProjectFocusView({ projectId, onBack, onOpenTaskDetail }: ProjectFocusViewProps) {
  const [focusData, setFocusData] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const { success, error: toastError } = useToast();

  const fetchFocusData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [data, tasksData] = await Promise.all([
        trpc.commandCenter.projectFocus.query({ projectId }),
        trpc.projectHub.tasks.list.query({ projectId }),
      ]);
      setFocusData(data as any);
      setTasks(((tasksData as any)?.items ?? []) as any[]);
    } catch (err) {
      console.error('[FocusView] Failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchFocusData();
  }, [fetchFocusData, refreshKey]);

  const updateTaskStatus = async (taskId: string, newStatus: string) => {
    try {
      await trpc.projectHub.tasks.updateStatus.mutate({ id: taskId, status: newStatus });
      const statusLabel: Record<string, string> = { todo: '待办', in_progress: '进行中', done: '已完成' };
      success('任务已更新', `状态变更为「${statusLabel[newStatus] || newStatus}」`);
      setRefreshKey(k => k + 1);
    } catch (err) {
      toastError('状态更新失败', '任务状态变更时发生错误');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground animate-pulse">加载项目详情...</div>
      </div>
    );
  }

  if (!focusData?.project) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <div className="text-4xl mb-2">😕</div>
        <div className="text-sm">项目未找到</div>
        <button onClick={onBack} className="mt-2 text-xs text-primary hover:underline">返回全景</button>
      </div>
    );
  }

  const { project, milestones, recentWorkLogs } = focusData;
  const agent = project.agents?.[0] || null;
  const workLogs = recentWorkLogs ?? [];

  // 任务按状态分组
  const todoTasks = tasks.filter((t: any) => t.status === 'todo');
  const inProgressTasks = tasks.filter((t: any) => t.status === 'in_progress');
  const doneTasks = tasks.filter((t: any) => t.status === 'done');

  const statusColor = {
    active: 'bg-green-500', completed: 'bg-blue-500', paused: 'bg-yellow-500', archived: 'bg-gray-400',
  }[project.status] || 'bg-gray-400';

  const phaseLabel: Record<string, string> = {
    requirements: '需求', planning: '规划', architecture: '架构',
    implementation: '开发', testing: '测试', deployment: '部署', completed: '完成',
  };

  // 任务状态转换映射
  const nextStatusMap: Record<string, { left: string | null; right: string }> = {
    todo: { left: null, right: 'in_progress' },
    in_progress: { left: 'todo', right: 'done' },
    done: { left: 'in_progress', right: null },
  };

  const renderTaskColumn = (columnTasks: any[], title: string, color: string) => (
    <div className="flex-1 min-w-[200px]">
      <div className="flex items-center gap-2 mb-3">
        <span className={`w-2 h-2 rounded-full ${color}`} />
        <span className="text-sm font-medium">{title}</span>
        <span className="text-xs text-muted-foreground">({columnTasks.length})</span>
      </div>
      <div className="space-y-2">
        {columnTasks.length === 0 ? (
          <div className="text-xs text-muted-foreground text-center py-4 border border-dashed rounded-lg">暂无任务</div>
        ) : (
          columnTasks.map((task: any) => (
            <div
              key={task.id}
              onClick={() => onOpenTaskDetail?.(task.id)}
              className="group p-3 rounded-lg border bg-card hover:shadow-sm cursor-pointer transition-all"
            >
              <div className="flex items-start justify-between mb-1">
                <span className="text-sm font-medium">{task.title}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                  task.priority === 'high' || task.priority === 'urgent' ? 'bg-red-500/10 text-red-500' :
                  task.priority === 'medium' ? 'bg-yellow-500/10 text-yellow-500' :
                  'bg-muted text-muted-foreground'
                }`}>
                  {task.priority}
                </span>
              </div>
              {task.description && (
                <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{task.description}</p>
              )}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {nextStatusMap[task.status]?.left && (
                  <button
                    onClick={(e) => { e.stopPropagation(); updateTaskStatus(task.id, nextStatusMap[task.status].left!); }}
                    className="px-2 py-0.5 text-[10px] rounded bg-muted hover:bg-muted/80"
                  >← {nextStatusMap[task.status].left === 'todo' ? '待办' : '进行中'}</button>
                )}
                {nextStatusMap[task.status]?.right && (
                  <button
                    onClick={(e) => { e.stopPropagation(); updateTaskStatus(task.id, nextStatusMap[task.status].right); }}
                    className="px-2 py-0.5 text-[10px] rounded bg-primary/10 text-primary hover:bg-primary/20"
                  >{nextStatusMap[task.status].right === 'done' ? '完成' : '开始'} →</button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* 项目头部 */}
      <div className="flex items-start gap-4 p-4 rounded-xl border bg-card">
        <button onClick={onBack} className="mt-1 text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0">
          ← 返回
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <span className={`w-3 h-3 rounded-full ${statusColor}`} />
            <h2 className="text-xl font-bold truncate">{project.name}</h2>
            <span className="px-2 py-0.5 text-xs rounded-md bg-muted">{phaseLabel[project.phase] || project.phase}</span>
            <span className={`text-xs px-2 py-0.5 rounded-md ${
              project.priority === 'high' || project.priority === 'urgent' ? 'bg-red-500/10 text-red-500' : 'bg-muted text-muted-foreground'
            }`}>{project.priority}</span>
          </div>
          {project.description && (
            <p className="text-sm text-muted-foreground mb-2">{project.description}</p>
          )}
          <div className="flex items-center gap-4">
            <div className="flex-1 max-w-xs">
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    (project.progress || 0) >= 80 ? 'bg-green-500' : (project.progress || 0) >= 40 ? 'bg-yellow-500' : 'bg-primary'
                  }`}
                  style={{ width: `${project.progress || 0}%` }}
                />
              </div>
            </div>
            <span className="text-sm font-semibold">{project.progress || 0}%</span>
            {agent && (
              <div className="flex items-center gap-2 ml-4 px-2 py-1 rounded-lg bg-muted/30">
                <div className={`w-2 h-2 rounded-full ${agent.isActive ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                <span className="text-xs">{agent.name}</span>
                <span className="text-[10px] text-muted-foreground">({agent.clientType})</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 任务看板 + Agent 面板 */}
      <div className="flex gap-4">
        {/* 任务看板 */}
        <div className="flex-1 flex gap-4 overflow-x-auto pb-2">
          {renderTaskColumn(todoTasks, '待办', 'bg-gray-400')}
          {renderTaskColumn(inProgressTasks, '进行中', 'bg-yellow-500')}
          {renderTaskColumn(doneTasks, '已完成', 'bg-green-500')}
        </div>

        {/* Agent 面板 */}
        {agent && (
          <div className="w-64 shrink-0 p-4 rounded-xl border bg-card">
            <h3 className="text-sm font-semibold mb-3">🤖 智能体</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">名称</span>
                <span className="font-medium">{agent.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">类型</span>
                <span className="px-1.5 py-0.5 rounded bg-muted">{agent.clientType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">角色</span>
                <span>{agent.role}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">状态</span>
                <span className={agent.isActive ? 'text-green-500' : 'text-muted-foreground'}>
                  {agent.isActive ? '● 工作中' : '○ 空闲'}
                </span>
              </div>
              {agent.capabilities && (
                <div className="pt-2 border-t">
                  <span className="text-muted-foreground">能力</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {(() => { try { return JSON.parse(agent.capabilities).map((c: string) => (
                      <span key={c} className="px-1.5 py-0.5 rounded bg-primary/5 text-primary/70 text-[10px]">{c}</span>
                    )); } catch { return null; } })()}
                  </div>
                </div>
              )}
            </div>

            {/* 最近工作记录 */}
            {workLogs.length > 0 && (
              <div className="mt-4 pt-3 border-t">
                <h4 className="text-xs font-medium text-muted-foreground mb-2">最近工作</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {workLogs.slice(0, 5).map((log: any) => (
                    <div key={log.id} className="text-xs">
                      <div className="flex items-center gap-1">
                        <span className={`w-1.5 h-1.5 rounded-full ${log.autoGenerated ? 'bg-blue-500' : 'bg-green-500'}`} />
                        <span className="truncate">{log.content || log.description || '工作记录'}</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {log.createdAt ? new Date(log.createdAt).toLocaleString('zh-CN') :
                         log.date ? new Date(log.date).toLocaleString('zh-CN') : ''}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 里程碑 */}
      {milestones && milestones.length > 0 && (
        <div className="p-4 rounded-xl border bg-card">
          <h3 className="text-sm font-semibold mb-3">📅 里程碑</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {milestones.map((ms: any) => (
              <div key={ms.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
                <span className={`w-2 h-2 rounded-full ${
                  ms.status === 'completed' ? 'bg-green-500' :
                  ms.status === 'in_progress' ? 'bg-yellow-500' : 'bg-gray-300'
                }`} />
                <span className="text-xs flex-1 truncate">{ms.title}</span>
                {ms.dueDate && (
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(ms.dueDate).toLocaleDateString('zh-CN')}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
