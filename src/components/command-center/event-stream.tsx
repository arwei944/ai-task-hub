'use client';

import { useState } from 'react';

interface SSEEvent {
  type: string;
  data: any;
  timestamp?: string;
}

interface EventStreamProps {
  events: SSEEvent[];
  onEventClick?: (event: SSEEvent) => void;
}

const EVENT_ICONS: Record<string, string> = {
  'task.completed': '✅',
  'task.created': '📋',
  'task.status_changed': '🔄',
  'agent.registered': '🤖',
  'agent.operation': '⚡',
  'project.created': '🆕',
  'project.updated': '📝',
  'milestone.completed': '🎯',
  'milestone.created': '📅',
};

const EVENT_COLORS: Record<string, string> = {
  'task.completed': 'text-green-500',
  'task.created': 'text-blue-500',
  'task.status_changed': 'text-blue-400',
  'agent.registered': 'text-purple-500',
  'agent.operation': 'text-purple-400',
  'project.created': 'text-emerald-500',
  'project.updated': 'text-gray-400',
  'milestone.completed': 'text-green-500',
  'milestone.created': 'text-yellow-500',
};

function formatTime(timestamp: string): string {
  const now = new Date();
  const date = new Date(timestamp);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return '刚刚';
  if (diffMin < 60) return `${diffMin}分钟前`;
  if (diffHour < 24) return `${diffHour}小时前`;
  if (diffDay < 7) return `${diffDay}天前`;
  return date.toLocaleDateString('zh-CN');
}

export function EventStream({ events, onEventClick }: EventStreamProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [filter, setFilter] = useState<string | null>(null);

  const filteredEvents = filter
    ? events.filter(e => e.type.startsWith(filter))
    : events;

  return (
    <div className="border-t bg-card/30">
      {/* 头部 */}
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {isExpanded ? '▼' : '▶'}
          </button>
          <span className="text-xs font-medium text-muted-foreground">实时事件流</span>
          {events.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">{events.length}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {[
            { key: null, label: '全部' },
            { key: 'task', label: '任务' },
            { key: 'agent', label: 'Agent' },
            { key: 'project', label: '项目' },
          ].map(f => (
            <button
              key={f.key ?? 'all'}
              onClick={() => setFilter(f.key)}
              className={`px-1.5 py-0.5 text-[10px] rounded transition-colors ${
                filter === f.key ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* 事件列表 */}
      {isExpanded && (
        <div className="px-4 pb-3 max-h-32 overflow-y-auto space-y-1">
          {filteredEvents.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-2">暂无事件</div>
          ) : (
            filteredEvents.slice(0, 20).map((event, i) => (
              <div
                key={`${event.type}-${i}`}
                onClick={() => onEventClick?.(event)}
                className="flex items-center gap-2 py-1 px-2 rounded-md hover:bg-muted/50 cursor-pointer transition-colors text-xs"
              >
                <span className="shrink-0">{EVENT_ICONS[event.type] || '•'}</span>
                <span className={`truncate flex-1 ${EVENT_COLORS[event.type] || 'text-muted-foreground'}`}>
                  {event.data?.description || event.type}
                </span>
                {event.timestamp && (
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {formatTime(event.timestamp)}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
