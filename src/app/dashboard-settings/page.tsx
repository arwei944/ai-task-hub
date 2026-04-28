'use client';

import { useState } from 'react';

interface Widget {
  id: string;
  type: string;
  title: string;
  size: 'sm' | 'md' | 'lg';
  visible: boolean;
}

const DEFAULT_WIDGETS: Widget[] = [
  { id: 'stats', type: 'stats', title: '任务统计', size: 'md', visible: true },
  { id: 'trend', type: 'chart', title: '14 天趋势', size: 'lg', visible: true },
  { id: 'status-dist', type: 'pie', title: '状态分布', size: 'sm', visible: true },
  { id: 'priority-dist', type: 'bar', title: '优先级分布', size: 'sm', visible: true },
  { id: 'risk', type: 'alert', title: '风险预警', size: 'md', visible: true },
  { id: 'notifications', type: 'list', title: '最新通知', size: 'md', visible: true },
  { id: 'ai-insights', type: 'ai', title: 'AI 洞察', size: 'md', visible: false },
  { id: 'team-workload', type: 'bar', title: '团队负载', size: 'md', visible: false },
  { id: 'calendar', type: 'calendar', title: '日历', size: 'lg', visible: false },
  { id: 'recent-activity', type: 'timeline', title: '最近活动', size: 'md', visible: false },
];

const WIDGET_ICONS: Record<string, string> = {
  stats: '📊', chart: '📈', pie: '🥧', bar: '📊', alert: '⚠️',
  list: '📋', ai: '🧠', calendar: '📅', timeline: '🕐',
};

export default function DashboardSettingsPage() {
  const [widgets, setWidgets] = useState<Widget[]>(DEFAULT_WIDGETS);
  const [saved, setSaved] = useState(false);

  const toggleWidget = (id: string) => {
    setWidgets(widgets.map(w => w.id === id ? { ...w, visible: !w.visible } : w));
    setSaved(false);
  };

  const moveWidget = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= widgets.length) return;
    const newWidgets = [...widgets];
    [newWidgets[index], newWidgets[newIndex]] = [newWidgets[newIndex], newWidgets[index]];
    setWidgets(newWidgets);
    setSaved(false);
  };

  const handleSave = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('dashboard-widgets', JSON.stringify(widgets));
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    setWidgets(DEFAULT_WIDGETS);
    setSaved(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">🎛️ 仪表盘设置</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">自定义仪表盘组件布局</p>
          </div>
          <div className="flex gap-2">
            <button onClick={handleReset} className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-800">重置</button>
            <button onClick={handleSave} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${saved ? 'bg-green-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
              {saved ? '✓ 已保存' : '保存'}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          {widgets.map((widget, index) => (
            <div
              key={widget.id}
              className={`bg-white dark:bg-gray-900 rounded-xl shadow-sm border p-4 flex items-center gap-4 transition-opacity ${
                widget.visible ? 'border-gray-200 dark:border-gray-800' : 'border-gray-200 dark:border-gray-800 opacity-50'
              }`}
            >
              <span className="text-xl">{WIDGET_ICONS[widget.type] || '📦'}</span>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-gray-900 dark:text-gray-100 text-sm">{widget.title}</h3>
                <p className="text-xs text-gray-400">{widget.type} · {widget.size === 'sm' ? '小' : widget.size === 'md' ? '中' : '大'}</p>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => moveWidget(index, 'up')} disabled={index === 0} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 text-gray-500">↑</button>
                <button onClick={() => moveWidget(index, 'down')} disabled={index === widgets.length - 1} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 text-gray-500">↓</button>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={widget.visible} onChange={() => toggleWidget(widget.id)} className="sr-only peer" />
                <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
