'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc/client';
import { useToast } from '@/components/ui/toast';

interface ProjectCardProps {
  project: any;
  onClick: (id: string) => void;
  isNewEvent?: boolean;
  onUpdated?: () => void;
}

export function ProjectCard({ project, onClick, isNewEvent, onUpdated }: ProjectCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const { success, error: toastError } = useToast();

  const statusColor = {
    active: 'bg-green-500',
    completed: 'bg-blue-500',
    paused: 'bg-yellow-500',
    archived: 'bg-gray-400',
  }[project.status] || 'bg-gray-400';

  const statusLabel = {
    active: '进行中',
    completed: '已完成',
    paused: '已暂停',
    archived: '已归档',
  }[project.status] || project.status;

  const phaseLabel = {
    requirements: '需求',
    planning: '规划',
    architecture: '架构',
    implementation: '开发',
    testing: '测试',
    deployment: '部署',
    completed: '完成',
  }[project.phase] || project.phase;

  let techStack: string[] = [];
  if (project.techStack) {
    try { techStack = JSON.parse(project.techStack); } catch {}
  }

  return (
    <div
      onClick={() => onClick(project.id)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`group relative cursor-pointer rounded-xl border bg-card p-4 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${
        isNewEvent ? 'animate-pulse-once' : ''
      }`}
    >
      {/* 状态指示灯 */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-2.5 h-2.5 rounded-full ${statusColor} shrink-0 ${
            project.status === 'active' && project.agent?.isActive ? 'animate-pulse' : ''
          }`} />
          <h3 className="font-semibold text-sm truncate">{project.name}</h3>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="px-1.5 py-0.5 text-[10px] rounded bg-muted text-muted-foreground">{phaseLabel}</span>
        </div>
      </div>

      {/* 描述 */}
      {project.description && (
        <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{project.description}</p>
      )}

      {/* 技术栈 */}
      {techStack.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {techStack.slice(0, 4).map((tech: string) => (
            <span key={tech} className="px-1.5 py-0.5 text-[10px] rounded-md bg-primary/5 text-primary/70 border border-primary/10">{tech}</span>
          ))}
          {techStack.length > 4 && (
            <span className="px-1.5 py-0.5 text-[10px] rounded-md bg-muted text-muted-foreground">+{techStack.length - 4}</span>
          )}
        </div>
      )}

      {/* 进度条 */}
      <div className="mb-3">
        <div className="flex justify-between text-xs mb-1.5">
          <span className="text-muted-foreground">进度</span>
          <span className={`font-semibold ${project.progress >= 80 ? 'text-green-500' : project.progress >= 40 ? 'text-yellow-500' : 'text-muted-foreground'}`}>
            {project.progress || 0}%
          </span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ease-out ${
              project.progress >= 80 ? 'bg-green-500' : project.progress >= 40 ? 'bg-yellow-500' : 'bg-primary'
            }`}
            style={{ width: `${project.progress || 0}%` }}
          />
        </div>
      </div>

      {/* Agent 状态 */}
      {project.agent && (
        <div className="flex items-center gap-2 mb-3 px-2 py-1.5 rounded-lg bg-muted/30">
          <div className={`w-1.5 h-1.5 rounded-full ${project.agent.isActive ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
          <span className="text-xs truncate flex-1">{project.agent.name}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
            project.agent.isActive
              ? 'bg-green-500/10 text-green-600 dark:text-green-400'
              : 'bg-gray-500/10 text-gray-500'
          }`}>
            {project.agent.isActive ? '工作中' : '空闲'}
          </span>
        </div>
      )}

      {/* 任务 + 里程碑统计 */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground border-t pt-2">
        <span className="flex items-center gap-1">
          <span>📋</span>
          <span className="font-medium text-foreground">{project.taskStats?.done || 0}</span>
          <span>/</span>
          <span>{project.taskStats?.total || 0}</span>
        </span>
        {project.milestoneStats && (
          <span className="flex items-center gap-1">
            <span>📅</span>
            <span className="font-medium text-foreground">{project.milestoneStats.completed || 0}</span>
            <span>/</span>
            <span>{project.milestoneStats.total || 0}</span>
          </span>
        )}
      </div>

      {/* 最近活动 */}
      {project.recentEvents && project.recentEvents.length > 0 && (
        <div className="mt-2 pt-2 border-t">
          <div className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
            <span className="shrink-0">{project.recentEvents[0].typeIcon || '•'}</span>
            <span className="truncate">{project.recentEvents[0].description}</span>
          </div>
        </div>
      )}

      {/* 悬停操作按钮 */}
      {isHovered && (
        <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); setShowActions(prev => !prev); }}
            className="w-6 h-6 rounded-md bg-muted/80 flex items-center justify-center text-xs hover:bg-muted"
            title="更多操作"
          >
            ⋯
          </button>
          {showActions && (
            <div className="absolute top-7 right-0 z-20 w-32 py-1 rounded-lg border bg-card shadow-lg" onClick={e => e.stopPropagation()}>
              <button
                onClick={async () => {
                  try {
                    const newPhase = project.phase === 'completed' ? 'implementation' : 'completed';
                    await trpc.projectHub.projects.update.mutate({ id: project.id, phase: newPhase });
                    success('阶段已更新', newPhase === 'completed' ? '项目已标记为完成' : '项目已重新开启');
                    onUpdated?.();
                  } catch { toastError('更新失败', '无法更改项目阶段'); }
                  setShowActions(false);
                }}
                className="w-full px-3 py-1.5 text-left text-xs hover:bg-muted transition-colors"
              >
                {project.phase === 'completed' ? '🔄 重新开启' : '✅ 标记完成'}
              </button>
              <button
                onClick={async () => {
                  try {
                    const newStatus = project.status === 'paused' ? 'active' : 'paused';
                    await trpc.projectHub.projects.update.mutate({ id: project.id, status: newStatus });
                    success('状态已更新', newStatus === 'paused' ? '项目已暂停' : '项目已恢复');
                    onUpdated?.();
                  } catch { toastError('更新失败', '无法更改项目状态'); }
                  setShowActions(false);
                }}
                className="w-full px-3 py-1.5 text-left text-xs hover:bg-muted transition-colors"
              >
                {project.status === 'paused' ? '▶️ 恢复项目' : '⏸️ 暂停项目'}
              </button>
              <button
                onClick={() => { onClick(project.id); setShowActions(false); }}
                className="w-full px-3 py-1.5 text-left text-xs hover:bg-muted transition-colors"
              >
                🔍 查看详情
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
