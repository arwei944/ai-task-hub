'use client';

import { useState } from 'react';

interface Task {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  progress: number;
  type: string;
  source?: string;
  assignee?: string | null;
  creator?: string | null;
  dueDate?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  tags?: Array<{ tag: { name: string; color: string } }>;
  _count?: {
    subTasks: number;
    dependencies?: number;
    dependents?: number;
    history?: number;
  };
}

interface TaskDetailDrawerProps {
  task: Task | null;
  open: boolean;
  onClose: () => void;
  onStatusChange?: (taskId: string, status: string) => void;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  todo: { label: '📋 待办', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  in_progress: { label: '🔄 进行中', color: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300' },
  done: { label: '✅ 已完成', color: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300' },
  closed: { label: '🔒 已关闭', color: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400' },
};

const PRIORITY_LABELS: Record<string, { label: string; color: string }> = {
  urgent: { label: '🔴 紧急', color: 'text-red-600 dark:text-red-400' },
  high: { label: '🟠 高', color: 'text-orange-600 dark:text-orange-400' },
  medium: { label: '🟡 中', color: 'text-yellow-600 dark:text-yellow-400' },
  low: { label: '🟢 低', color: 'text-green-600 dark:text-green-400' },
};

const STATUS_FLOW = ['todo', 'in_progress', 'done', 'closed'];

export function TaskDetailDrawer({ task, open, onClose, onStatusChange }: TaskDetailDrawerProps) {
  const [loading, setLoading] = useState(false);

  if (!task || !open) return null;

  const statusInfo = STATUS_LABELS[task.status] ?? STATUS_LABELS.todo;
  const priorityInfo = PRIORITY_LABELS[task.priority] ?? PRIORITY_LABELS.medium;

  const handleStatusChange = async (newStatus: string) => {
    setLoading(true);
    try {
      onStatusChange?.(task.id, newStatus);
    } finally {
      setLoading(false);
    }
  };

  const nextStatus = STATUS_FLOW[STATUS_FLOW.indexOf(task.status) + 1];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white dark:bg-gray-900 shadow-xl z-50 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate pr-4">
            任务详情
          </h2>
          <button
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300 transition-colors"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {/* Title */}
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">{task.title}</h3>
            {task.description && (
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{task.description}</p>
            )}
          </div>

          {/* Status + Priority */}
          <div className="flex flex-wrap gap-2">
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
              {statusInfo.label}
            </span>
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${priorityInfo.color}`}>
              {priorityInfo.label}
            </span>
            {task.type && task.type !== 'general' && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                {task.type}
              </span>
            )}
          </div>

          {/* Progress */}
          <div>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-gray-500 dark:text-gray-400">进度</span>
              <span className="font-medium text-gray-700 dark:text-gray-300">{task.progress}%</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-blue-600 dark:bg-blue-500 h-2 rounded-full transition-all"
                style={{ width: `${task.progress}%` }}
              />
            </div>
          </div>

          {/* Meta info */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <InfoItem label="创建者" value={task.creator ?? '-'} />
            <InfoItem label="负责人" value={task.assignee ?? '未分配'} />
            <InfoItem label="来源" value={task.source ?? '-'} />
            <InfoItem label="截止日期" value={task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '-'} />
            <InfoItem label="创建时间" value={task.createdAt ? new Date(task.createdAt).toLocaleString() : '-'} />
            <InfoItem label="更新时间" value={task.updatedAt ? new Date(task.updatedAt).toLocaleString() : '-'} />
          </div>

          {/* Tags */}
          {task.tags && task.tags.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">标签</h4>
              <div className="flex flex-wrap gap-1.5">
                {task.tags.map((t) => (
                  <span
                    key={t.tag.name}
                    className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                    style={{ backgroundColor: t.tag.color + '20', color: t.tag.color }}
                  >
                    {t.tag.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Counts */}
          {task._count && (
            <div className="flex gap-4 text-sm">
              <span className="text-gray-500 dark:text-gray-400">
                📋 子任务: <span className="font-medium text-gray-700 dark:text-gray-300">{task._count.subTasks}</span>
              </span>
              <span className="text-gray-500 dark:text-gray-400">
                🔗 依赖: <span className="font-medium text-gray-700 dark:text-gray-300">{task._count.dependencies}</span>
              </span>
              <span className="text-gray-500 dark:text-gray-400">
                📝 历史: <span className="font-medium text-gray-700 dark:text-gray-300">{task._count.history}</span>
              </span>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="border-t border-gray-200 dark:border-gray-800 px-6 py-4 flex gap-2">
          {nextStatus && (
            <button
              onClick={() => handleStatusChange(nextStatus)}
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading ? '处理中...' : `推进到 ${STATUS_LABELS[nextStatus]?.label}`}
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    </>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-gray-500 dark:text-gray-400">{label}</span>
      <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{value}</p>
    </div>
  );
}
