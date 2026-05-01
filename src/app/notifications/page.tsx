'use client';

import { useState, useEffect, useCallback } from 'react';

// ==================== Types ====================

interface NotificationRule {
  id: string;
  name: string;
  eventPattern: string;
  action: string;
  level: string | null;
  titleTemplate: string | null;
  messageTemplate: string | null;
  channels: string;
  priority: number;
  isActive: boolean;
  createdAt: Date;
}

interface NotificationHistory {
  id: string;
  title: string;
  message: string;
  level: string;
  channel: string;
  isRead: boolean;
  createdAt: Date;
}

interface NotificationPreference {
  id: string;
  userId: string;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  minLevel: string | null;
  disabledEvents: string | null;
}

const LEVEL_COLORS: Record<string, string> = {
  info: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  error: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  success: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
};

const CHANNEL_OPTIONS = ['system', 'browser_push', 'telegram', 'webhook', 'wechat', 'email'];
const EVENT_PATTERN_SUGGESTIONS = ['task.*', 'deployment.*', 'release.*', 'workflow.*', 'agent.*', 'system.*'];
const LEVEL_OPTIONS = ['info', 'warning', 'error', 'success'];
const ACTION_OPTIONS = ['notify', 'log', 'webhook'];

type TabType = 'rules' | 'history' | 'preferences';

// ==================== Component ====================

export default function NotificationsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('rules');
  const [loading, setLoading] = useState(true);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">通知管理</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">通知规则配置、历史记录与偏好设置</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 w-fit">
        {([
          { key: 'rules' as TabType, label: '通知规则' },
          { key: 'history' as TabType, label: '通知历史' },
          { key: 'preferences' as TabType, label: '通知偏好' },
        ]).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm rounded-md transition-colors ${
              activeTab === tab.key
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'rules' && <RulesTab />}
      {activeTab === 'history' && <HistoryTab />}
      {activeTab === 'preferences' && <PreferencesTab />}
    </div>
  );
}

// ==================== Rules Tab ====================

function RulesTab() {
  const [rules, setRules] = useState<NotificationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState<NotificationRule | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formPattern, setFormPattern] = useState('');
  const [formAction, setFormAction] = useState('notify');
  const [formLevel, setFormLevel] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formMessage, setFormMessage] = useState('');
  const [formChannels, setFormChannels] = useState<string[]>(['system']);
  const [formPriority, setFormPriority] = useState(0);
  const [saving, setSaving] = useState(false);

  const fetchRules = useCallback(async () => {
    try {
      const res = await fetch('/api/trpc/notificationRules.list');
      const data = await res.json();
      setRules(data?.result?.data ?? []);
    } catch (err) {
      console.error('Failed to fetch rules:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRules(); }, [fetchRules]);

  const resetForm = () => {
    setFormName('');
    setFormPattern('');
    setFormAction('notify');
    setFormLevel('');
    setFormTitle('');
    setFormMessage('');
    setFormChannels(['system']);
    setFormPriority(0);
    setEditingRule(null);
    setShowForm(false);
  };

  const openCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (rule: NotificationRule) => {
    setEditingRule(rule);
    setFormName(rule.name);
    setFormPattern(rule.eventPattern);
    setFormAction(rule.action);
    setFormLevel(rule.level ?? '');
    setFormTitle(rule.titleTemplate ?? '');
    setFormMessage(rule.messageTemplate ?? '');
    setFormChannels(rule.channels.split(',').filter(Boolean));
    setFormPriority(rule.priority);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formName.trim() || !formPattern.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: formName,
        eventPattern: formPattern,
        action: formAction,
        level: formLevel || undefined,
        titleTemplate: formTitle || undefined,
        messageTemplate: formMessage || undefined,
        channels: formChannels.join(','),
        priority: formPriority,
      };

      if (editingRule) {
        await fetch('/api/trpc/notificationRules.update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, id: editingRule.id }),
        });
      } else {
        await fetch('/api/trpc/notificationRules.create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
      resetForm();
      fetchRules();
    } catch (err) {
      console.error('Failed to save rule:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch('/api/trpc/notificationRules.delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      setDeleteConfirm(null);
      fetchRules();
    } catch (err) {
      console.error('Failed to delete rule:', err);
    }
  };

  const toggleChannel = (ch: string) => {
    setFormChannels(prev =>
      prev.includes(ch) ? prev.filter(c => c !== ch) : [...prev, ch]
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="text-gray-500 dark:text-gray-400">加载中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-500 dark:text-gray-400">
          共 {rules.length} 条规则
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
        >
          创建规则
        </button>
      </div>

      {/* Create/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-800 w-full max-w-lg p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {editingRule ? '编辑规则' : '创建规则'}
            </h2>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">名称</label>
                <input
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white"
                  placeholder="规则名称"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">事件模式</label>
                <input
                  value={formPattern}
                  onChange={e => setFormPattern(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white"
                  placeholder="如 task.*, deployment.*"
                  list="pattern-suggestions"
                />
                <datalist id="pattern-suggestions">
                  {EVENT_PATTERN_SUGGESTIONS.map(s => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">动作</label>
                  <select
                    value={formAction}
                    onChange={e => setFormAction(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white"
                  >
                    {ACTION_OPTIONS.map(a => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">级别</label>
                  <select
                    value={formLevel}
                    onChange={e => setFormLevel(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white"
                  >
                    <option value="">自动</option>
                    {LEVEL_OPTIONS.map(l => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">标题模板</label>
                <input
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white"
                  placeholder="支持 {event}, {source}, {timestamp}"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">消息模板</label>
                <textarea
                  value={formMessage}
                  onChange={e => setFormMessage(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white"
                  placeholder="消息内容模板"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">渠道</label>
                <div className="flex flex-wrap gap-2">
                  {CHANNEL_OPTIONS.map(ch => (
                    <button
                      key={ch}
                      onClick={() => toggleChannel(ch)}
                      className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                        formChannels.includes(ch)
                          ? 'bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-400'
                          : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      {ch}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">优先级</label>
                <input
                  type="number"
                  value={formPriority}
                  onChange={e => setFormPriority(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={resetForm}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !formName.trim() || !formPattern.trim()}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-800 w-full max-w-sm p-6 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">确认删除</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">确定要删除此通知规则吗？此操作不可撤销。</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900"
              >
                取消
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rules Table */}
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">名称</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">事件模式</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">动作</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">级别</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">渠道</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">优先级</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">状态</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {rules.map(rule => (
                <tr key={rule.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{rule.name}</td>
                  <td className="px-4 py-3">
                    <code className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-xs text-gray-700 dark:text-gray-300">
                      {rule.eventPattern}
                    </code>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{rule.action}</td>
                  <td className="px-4 py-3">
                    {rule.level ? (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${LEVEL_COLORS[rule.level] ?? ''}`}>
                        {rule.level}
                      </span>
                    ) : (
                      <span className="text-gray-400 dark:text-gray-500 text-xs">自动</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400 text-xs">{rule.channels}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{rule.priority}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      rule.isActive
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                    }`}>
                      {rule.isActive ? '启用' : '停用'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => openEdit(rule)}
                        className="text-blue-600 dark:text-blue-400 hover:underline text-xs"
                      >
                        编辑
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(rule.id)}
                        className="text-red-600 dark:text-red-400 hover:underline text-xs"
                      >
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rules.length === 0 && (
          <div className="px-6 py-8 text-center text-gray-400 dark:text-gray-500">
            暂无通知规则，点击"创建规则"按钮添加
          </div>
        )}
      </div>
    </div>
  );
}

// ==================== History Tab ====================

function HistoryTab() {
  const [notifications, setNotifications] = useState<NotificationHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterLevel, setFilterLevel] = useState('');
  const [filterChannel, setFilterChannel] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchNotifications = useCallback(async () => {
    try {
      const params: Record<string, unknown> = { limit: 100 };
      if (filterLevel) params.level = filterLevel;
      const res = await fetch('/api/trpc/notifications.list?input=' + encodeURIComponent(JSON.stringify(params)));
      const data = await res.json();
      let items = data?.result?.data ?? [];

      if (filterChannel) {
        items = items.filter((n: NotificationHistory) => n.channel === filterChannel);
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        items = items.filter((n: NotificationHistory) =>
          n.title.toLowerCase().includes(q) || n.message.toLowerCase().includes(q)
        );
      }

      setNotifications(items);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [filterLevel, filterChannel, searchQuery]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  const markAsRead = async (id: string) => {
    try {
      await fetch('/api/trpc/notifications.markAsRead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      fetchNotifications();
    } catch (err) {
      console.error('Failed to mark as read:', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await fetch('/api/trpc/notifications.markAllAsRead', { method: 'POST' });
      fetchNotifications();
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="text-gray-500 dark:text-gray-400">加载中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="搜索标题/消息..."
          className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white w-64"
        />
        <select
          value={filterLevel}
          onChange={e => setFilterLevel(e.target.value)}
          className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white"
        >
          <option value="">全部级别</option>
          {LEVEL_OPTIONS.map(l => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
        <select
          value={filterChannel}
          onChange={e => setFilterChannel(e.target.value)}
          className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white"
        >
          <option value="">全部渠道</option>
          {CHANNEL_OPTIONS.map(ch => (
            <option key={ch} value={ch}>{ch}</option>
          ))}
        </select>
        <button
          onClick={markAllAsRead}
          className="px-3 py-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          全部已读
        </button>
      </div>

      {/* Notifications List */}
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800">
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {notifications.map(notif => (
            <div
              key={notif.id}
              onClick={() => !notif.isRead && markAsRead(notif.id)}
              className={`px-6 py-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors ${
                !notif.isRead ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {!notif.isRead && (
                      <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                    )}
                    <span className="font-medium text-gray-900 dark:text-white truncate">
                      {notif.title}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${LEVEL_COLORS[notif.level] ?? ''}`}>
                      {notif.level}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">{notif.message}</p>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs text-gray-400 dark:text-gray-500">{notif.channel}</div>
                  <div className="text-xs text-gray-400 dark:text-gray-500">
                    {new Date(notif.createdAt).toLocaleString('zh-CN')}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        {notifications.length === 0 && (
          <div className="px-6 py-8 text-center text-gray-400 dark:text-gray-500">
            暂无通知记录
          </div>
        )}
      </div>
    </div>
  );
}

// ==================== Preferences Tab ====================

function PreferencesTab() {
  const [userId, setUserId] = useState('');
  const [quietHoursStart, setQuietHoursStart] = useState('');
  const [quietHoursEnd, setQuietHoursEnd] = useState('');
  const [minLevel, setMinLevel] = useState('');
  const [disabledEvents, setDisabledEvents] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    if (!userId.trim()) return;
    setSaving(true);
    setSaved(false);
    try {
      await fetch('/api/trpc/notificationRules.update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: userId,
          name: `Preference for ${userId}`,
          eventPattern: '*',
          level: minLevel || undefined,
          channels: 'system',
          priority: 0,
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error('Failed to save preferences:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-6 space-y-5">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">通知偏好设置</h2>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">用户 ID</label>
          <input
            value={userId}
            onChange={e => setUserId(e.target.value)}
            className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white"
            placeholder="输入用户 ID"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">安静时段开始</label>
            <input
              type="time"
              value={quietHoursStart}
              onChange={e => setQuietHoursStart(e.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">安静时段结束</label>
            <input
              type="time"
              value={quietHoursEnd}
              onChange={e => setQuietHoursEnd(e.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">最低通知级别</label>
          <select
            value={minLevel}
            onChange={e => setMinLevel(e.target.value)}
            className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white"
          >
            <option value="">全部级别</option>
            {LEVEL_OPTIONS.map(l => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">禁用的事件模式</label>
          <textarea
            value={disabledEvents}
            onChange={e => setDisabledEvents(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white"
            placeholder="每行一个事件模式，如:&#10;system.debug.*&#10;task.status.minor"
          />
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">匹配这些模式的事件将不会触发通知</p>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleSave}
            disabled={saving || !userId.trim()}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? '保存中...' : '保存偏好'}
          </button>
          {saved && (
            <span className="text-sm text-green-600 dark:text-green-400">保存成功</span>
          )}
        </div>
      </div>
    </div>
  );
}
