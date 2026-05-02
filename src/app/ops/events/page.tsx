// ============================================================
// Ops Events Stream View - /ops/events
// ============================================================
//
// Real-time event stream from EventBus + HealthEventEmitter.
// Shows all system events with filtering and search.
// ============================================================

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useHealthSSE, type HealthSSEEvent } from '@/lib/hooks/use-health-sse';
import { useSSE, type SSEMessage } from '@/lib/hooks/use-sse';
import {
  Radio,
  Search,
  Pause,
  Play,
  Trash2,
  Download,
  Filter,
} from 'lucide-react';

// ---- Types ----

interface UnifiedEvent {
  id: string;
  type: string;
  source: 'health' | 'system';
  timestamp: number;
  data: Record<string, unknown>;
}

// ---- Component ----

export default function OpsEventsPage() {
  const [events, setEvents] = useState<UnifiedEvent[]>([]);
  const [paused, setPaused] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const eventsEndRef = useRef<HTMLDivElement>(null);

  // Health SSE
  const handleHealthEvent = useCallback((event: HealthSSEEvent) => {
    if (paused) return;
    const unified: UnifiedEvent = {
      id: `h-${event.timestamp}-${Math.random().toString(36).slice(2, 6)}`,
      type: event.type,
      source: 'health',
      timestamp: event.timestamp,
      data: event.data as unknown as Record<string, unknown>,
    };
    setEvents(prev => [unified, ...prev].slice(0, 500));
  }, [paused]);

  const { isConnected: healthConnected } = useHealthSSE({
    enabled: true,
    onEvent: handleHealthEvent,
  });

  // System SSE (general events)
  const handleSystemEvent = useCallback((event: SSEMessage) => {
    if (paused) return;
    const unified: UnifiedEvent = {
      id: `s-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: event.type,
      source: 'system',
      timestamp: new Date(event.timestamp).getTime(),
      data: event.data as unknown as Record<string, unknown>,
    };
    setEvents(prev => [unified, ...prev].slice(0, 500));
  }, [paused]);

  const { isConnected: systemConnected } = useSSE({
    channels: ['global'],
    onEvent: handleSystemEvent,
  });

  // Auto-scroll to bottom
  useEffect(() => {
    if (!paused) {
      eventsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [events, paused]);

  // Collect unique event types
  const eventTypes = Array.from(new Set(events.map(e => e.type))).sort();

  // Filter events
  const filteredEvents = events.filter(event => {
    if (typeFilter !== 'all' && event.type !== typeFilter) return false;
    if (search) {
      const searchLower = search.toLowerCase();
      return (
        event.type.toLowerCase().includes(searchLower) ||
        JSON.stringify(event.data).toLowerCase().includes(searchLower)
      );
    }
    return true;
  });

  function clearEvents() {
    setEvents([]);
  }

  function exportEvents() {
    const blob = new Blob([JSON.stringify(filteredEvents, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `events-${new Date().toISOString().slice(0, 19)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function formatTime(ts: number): string {
    return new Date(ts).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
    });
  }

  function getEventColor(type: string): string {
    if (type.includes('degraded') || type.includes('failed') || type.includes('error')) {
      return 'border-l-red-500 bg-red-50/50 dark:bg-red-950/20';
    }
    if (type.includes('recovered') || type.includes('success') || type.includes('completed')) {
      return 'border-l-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20';
    }
    if (type.includes('check') || type.includes('initial')) {
      return 'border-l-blue-500 bg-blue-50/50 dark:bg-blue-950/20';
    }
    if (type.includes('circuit')) {
      return 'border-l-amber-500 bg-amber-50/50 dark:bg-amber-950/20';
    }
    return 'border-l-gray-400 bg-gray-50/50 dark:bg-gray-800/20';
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">事件流</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            实时系统事件与健康事件流
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${healthConnected ? 'bg-emerald-500' : 'bg-gray-300'}`} />
            <span className="text-xs text-gray-500">Health</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${systemConnected ? 'bg-emerald-500' : 'bg-gray-300'}`} />
            <span className="text-xs text-gray-500">System</span>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-[400px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="搜索事件..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
          />
        </div>

        {/* Type filter */}
        <div className="flex items-center gap-1">
          <Filter className="w-3.5 h-3.5 text-gray-400" />
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="text-xs border border-gray-200 dark:border-gray-700 rounded-md px-2 py-1.5 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none"
          >
            <option value="all">全部类型</option>
            {eventTypes.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {/* Actions */}
        <Button size="sm" variant="outline" onClick={() => setPaused(!paused)}>
          {paused ? <Play className="w-3.5 h-3.5 mr-1" /> : <Pause className="w-3.5 h-3.5 mr-1" />}
          {paused ? '继续' : '暂停'}
        </Button>
        <Button size="sm" variant="outline" onClick={clearEvents}>
          <Trash2 className="w-3.5 h-3.5 mr-1" />
          清空
        </Button>
        <Button size="sm" variant="outline" onClick={exportEvents}>
          <Download className="w-3.5 h-3.5 mr-1" />
          导出
        </Button>
      </div>

      {/* Event count */}
      <div className="flex items-center gap-2 text-xs text-gray-400">
        <Radio className="w-3 h-3" />
        <span>{filteredEvents.length} 条事件</span>
        {paused && <Badge variant="secondary" className="text-[10px]">已暂停</Badge>}
      </div>

      {/* Event stream */}
      <Card>
        <CardContent className="p-0">
          <div className="h-[600px] overflow-y-auto font-mono text-xs">
            {filteredEvents.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-400">
                <Radio className="w-5 h-5 mr-2 animate-pulse" />
                等待事件...
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {filteredEvents.map(event => (
                  <div
                    key={event.id}
                    className={`flex items-start gap-3 px-4 py-2 border-l-2 ${getEventColor(event.type)}`}
                  >
                    <span className="text-gray-400 shrink-0 w-[90px]">{formatTime(event.timestamp)}</span>
                    <Badge
                      variant="outline"
                      className={`text-[10px] shrink-0 ${
                        event.source === 'health'
                          ? 'border-orange-300 text-orange-700 dark:border-orange-700 dark:text-orange-300'
                          : 'border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-300'
                      }`}
                    >
                      {event.source}
                    </Badge>
                    <span className="text-gray-900 dark:text-gray-100 shrink-0 w-[180px] truncate">{event.type}</span>
                    <span className="text-gray-500 dark:text-gray-400 truncate flex-1">
                      {JSON.stringify(event.data).slice(0, 120)}
                    </span>
                  </div>
                ))}
                <div ref={eventsEndRef} />
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
