'use client';

import { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc/client';
import { Breadcrumb } from '@/components/layout/breadcrumb';
import {
  Bell,
  BellOff,
  Mail,
  MessageSquare,
  Send,
  Monitor,
  CheckCircle,
  XCircle,
} from 'lucide-react';

interface NotificationChannel {
  id: string;
  name: string;
  icon: React.ReactNode;
  description: string;
  available: boolean;
}

const CHANNELS: NotificationChannel[] = [
  { id: 'system', name: '系统通知', icon: <Monitor className="w-4 h-4" />, description: '应用内实时通知', available: true },
  { id: 'webpush', name: 'Web Push', icon: <Bell className="w-4 h-4" />, description: '浏览器推送通知', available: typeof window !== 'undefined' && 'Notification' in window },
  { id: 'email', name: '邮件通知', icon: <Mail className="w-4 h-4" />, description: '通过邮件接收通知', available: true },
  { id: 'telegram', name: 'Telegram', icon: <Send className="w-4 h-4" />, description: '通过 Telegram Bot 推送', available: true },
  { id: 'wechat', name: '企业微信', icon: <MessageSquare className="w-4 h-4" />, description: '通过企业微信推送', available: true },
];

export default function NotificationSettingsPage() {
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);
  const [rules, setRules] = useState<Array<{ id: string; eventPattern: string; action: string; isActive: boolean }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setPushSupported('Notification' in window && 'serviceWorker' in navigator);
    // Check current push permission
    if ('Notification' in window) {
      setPushEnabled(Notification.permission === 'granted');
    }
  }, []);

  useEffect(() => {
    const fetchRules = async () => {
      try {
        const data = await trpc.notificationRules.list.query({});
        setRules((Array.isArray(data) ? data : []) as typeof rules);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    fetchRules();
  }, []);

  const handleTogglePush = async () => {
    if (!pushSupported) return;

    if (pushEnabled) {
      // Disable push - revoke permission
      // Note: browsers don't allow revoking permission programmatically
      setPushEnabled(false);
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      setPushEnabled(permission === 'granted');
    } catch (err) {
      console.error('Failed to request notification permission:', err);
    }
  };

  const handleTestPush = async () => {
    if (!pushEnabled) return;
    try {
      // Try to send a test notification
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        await registration.showNotification('AI Task Hub', {
          body: '这是一条测试通知',
          icon: '/favicon.ico',
        });
      }
    } catch (err) {
      console.error('Failed to send test notification:', err);
    }
  };

  const handleToggleRule = async (ruleId: string, currentState: boolean) => {
    try {
      await trpc.notificationRules.update.mutate({ id: ruleId, isActive: !currentState });
      setRules((prev) =>
        prev.map((r) => (r.id === ruleId ? { ...r, isActive: !currentState } : r))
      );
    } catch (err) {
      console.error('Failed to toggle rule:', err);
    }
  };

  return (
    <div className="space-y-6">
      <Breadcrumb />

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-950">
          <Bell className="w-5 h-5 text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">通知设置</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">配置通知渠道和偏好</p>
        </div>
      </div>

      {/* Push Notification */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-5">
        <h2 className="font-medium text-gray-900 dark:text-gray-100 mb-4">推送通知</h2>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${pushEnabled ? 'bg-green-100 dark:bg-green-950' : 'bg-gray-100 dark:bg-gray-800'}`}>
              {pushEnabled ? (
                <Bell className="w-5 h-5 text-green-600 dark:text-green-400" />
              ) : (
                <BellOff className="w-5 h-5 text-gray-400" />
              )}
            </div>
            <div>
              <div className="font-medium text-sm text-gray-900 dark:text-gray-100">
                浏览器推送
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {pushSupported
                  ? pushEnabled
                    ? '已启用'
                    : '未启用'
                  : '当前浏览器不支持'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {pushEnabled && (
              <button
                onClick={handleTestPush}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950 border border-blue-200 dark:border-blue-800 transition-colors"
              >
                发送测试
              </button>
            )}
            <button
              onClick={handleTogglePush}
              disabled={!pushSupported}
              className={`relative w-10 h-6 rounded-full transition-colors ${
                pushEnabled ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
              } ${!pushSupported ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <span
                className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                  pushEnabled ? 'left-5' : 'left-1'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Notification Channels */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-5">
        <h2 className="font-medium text-gray-900 dark:text-gray-100 mb-4">通知渠道</h2>
        <div className="space-y-3">
          {CHANNELS.map((channel) => (
            <div
              key={channel.id}
              className={`flex items-center justify-between p-3 rounded-lg ${
                channel.available
                  ? 'bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800'
                  : 'bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800 opacity-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="text-gray-500 dark:text-gray-400">{channel.icon}</div>
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{channel.name}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{channel.description}</div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {channel.available ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <XCircle className="w-4 h-4 text-gray-300 dark:text-gray-600" />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Notification Rules */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-5">
        <h2 className="font-medium text-gray-900 dark:text-gray-100 mb-4">通知规则</h2>
        {loading ? (
          <div className="text-center py-6 text-gray-400 text-sm">加载中...</div>
        ) : rules.length === 0 ? (
          <div className="text-center py-6 text-gray-400 text-sm">
            暂无通知规则，请在通知管理页面创建
          </div>
        ) : (
          <div className="space-y-2">
            {rules.map((rule) => (
              <div
                key={rule.id}
                className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50"
              >
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {rule.eventPattern}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    动作: {rule.action}
                  </div>
                </div>
                <button
                  onClick={() => handleToggleRule(rule.id, rule.isActive)}
                  className={`relative w-10 h-6 rounded-full transition-colors ${
                    rule.isActive ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                      rule.isActive ? 'left-5' : 'left-1'
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
