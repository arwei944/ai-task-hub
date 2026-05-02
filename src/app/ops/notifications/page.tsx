// ============================================================
// Ops Notifications View - /ops/notifications
// ============================================================
//
// Notification system monitoring: delivery stats,
// channel status, rule engine health, and recent notifications.
// ============================================================

'use client';

import { useState, useEffect, useCallback } from 'react';
import { trpc } from '@/lib/trpc/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useHealthSSE, type HealthSSEEvent } from '@/lib/hooks/use-health-sse';
import {
  Bell,
  RefreshCw,
  Mail,
  MessageSquare,
  Webhook,
  CheckCircle2,
  XCircle,
  Clock,
  Send,
  BarChart3,
  Inbox,
} from 'lucide-react';

// ---- Types ----

interface ChannelStatus {
  id: string;
  name: string;
  icon: string;
  status: 'active' | 'degraded' | 'disabled';
  sent24h: number;
  failed24h: number;
  avgLatencyMs: number;
}

interface NotificationRecord {
  id: string;
  type: string;
  channel: string;
  recipient: string;
  subject: string;
  status: 'sent' | 'delivered' | 'failed' | 'pending';
  timestamp: number;
  error?: string;
}

// ---- Component ----

export default function OpsNotificationsPage() {
  const [channels, setChannels] = useState<ChannelStatus[]>([]);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'sent' | 'delivered' | 'failed' | 'pending'>('all');

  const handleEvent = useCallback((event: HealthSSEEvent) => {
    // Could update notification health status
  }, []);

  const { isConnected } = useHealthSSE({ enabled: true, onEvent: handleEvent });

  const fetchData = useCallback(async () => {
    try {
      const [channelStatsRes, deliveryStatsRes, listRes] = await Promise.allSettled([
        trpc.notificationHistory.getChannelStats.query(),
        trpc.notificationHistory.getDeliveryStats.query(),
        trpc.notificationHistory.list.query({ limit: 50 }),
      ]);

      // Channel stats
      const channelStats = channelStatsRes.status === 'fulfilled' ? channelStatsRes.value : { channels: [] };
      setChannels(
        (channelStats.channels ?? []).map((ch: any) => ({
          id: ch.id,
          name: ch.name,
          icon: ch.icon,
          status: ch.status,
          sent24h: ch.sent24h ?? 0,
          failed24h: ch.failed24h ?? 0,
          avgLatencyMs: ch.avgLatencyMs ?? 0,
        })),
      );

      // Notification list → map to NotificationRecord
      const listData = listRes.status === 'fulfilled' ? listRes.value : { items: [], total: 0 };
      const items = (listData.items ?? []) as any[];
      setNotifications(
        items.map((n: any) => {
          let status: NotificationRecord['status'];
          if (n.level === 'error') {
            status = 'failed';
          } else if (n.isRead) {
            status = 'delivered';
          } else {
            status = 'sent';
          }
          return {
            id: n.id,
            type: n.level ?? 'info',
            channel: n.channel ?? 'unknown',
            recipient: 'system',
            subject: n.title ?? '',
            status,
            timestamp: n.createdAt instanceof Date ? n.createdAt.getTime() : new Date(n.createdAt).getTime(),
          };
        }),
      );
    } catch (err) {
      console.error('Ops notifications fetch error:', err);
    }
  }, []);

  useEffect(() => {
    fetchData().finally(() => setLoading(false));
  }, [fetchData]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!loading) {
      const interval = setInterval(fetchData, 30000);
      return () => clearInterval(interval);
    }
  }, [loading, fetchData]);

  function refresh() {
    setLoading(true);
    fetchData().finally(() => setLoading(false));
  }

  const totalSent = channels.reduce((sum, c) => sum + c.sent24h, 0);
  const totalFailed = channels.reduce((sum, c) => sum + c.failed24h, 0);
  const filteredNotifications = filter === 'all' ? notifications : notifications.filter(n => n.status === filter);

  function formatTime(ts: number): string {
    return new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">通知系统</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            通知渠道状态、投递统计与规则引擎监控
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-gray-300'}`} />
            <span className="text-xs text-gray-500">{isConnected ? '实时' : '离线'}</span>
          </div>
          <Button size="sm" variant="outline" onClick={refresh} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card size="sm">
          <CardContent className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-950 flex items-center justify-center">
              <Send className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{totalSent.toLocaleString()}</p>
              <p className="text-xs text-gray-500">24h 发送</p>
            </div>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-950 flex items-center justify-center">
              <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{totalFailed}</p>
              <p className="text-xs text-gray-500">24h 失败</p>
            </div>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {totalSent > 0 ? ((1 - totalFailed / totalSent) * 100).toFixed(1) : '100'}%
              </p>
              <p className="text-xs text-gray-500">投递率</p>
            </div>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-950 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{channels.filter(c => c.status === 'active').length}</p>
              <p className="text-xs text-gray-500">活跃渠道</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Channel cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading && channels.length === 0 ? (
          <>
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-28 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
            ))}
          </>
        ) : channels.length === 0 ? (
          <div className="col-span-full text-center py-8">
            <Inbox className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-400">暂无渠道数据</p>
            <p className="text-xs text-gray-300 mt-1">配置通知渠道后将在此显示</p>
          </div>
        ) : (
          channels.map(ch => (
          <Card key={ch.id} size="sm">
            <CardContent>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{ch.icon}</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{ch.name}</span>
                </div>
                <Badge
                  className={
                    ch.status === 'active'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                      : ch.status === 'degraded'
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                        : 'bg-gray-100 text-gray-500'
                  }
                >
                  {ch.status === 'active' ? '正常' : ch.status === 'degraded' ? '降级' : '禁用'}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-gray-500">发送</p>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{ch.sent24h}</p>
                </div>
                <div>
                  <p className="text-gray-500">失败</p>
                  <p className={`font-medium ${ch.failed24h > 0 ? 'text-red-500' : 'text-gray-900 dark:text-gray-100'}`}>{ch.failed24h}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-gray-500">平均延迟: {ch.avgLatencyMs}ms</p>
                </div>
              </div>
            </CardContent>
          </Card>
          ))
        )}
      </div>

      {/* Recent notifications */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-orange-500" />
              最近通知
            </CardTitle>
            <div className="flex items-center gap-1">
              {(['all', 'sent', 'delivered', 'failed', 'pending'] as const).map(f => (
                <Button
                  key={f}
                  size="sm"
                  variant={filter === f ? 'default' : 'ghost'}
                  onClick={() => setFilter(f)}
                  className="text-xs h-7 px-2"
                >
                  {f === 'all' ? '全部' : f === 'sent' ? '已发送' : f === 'delivered' ? '已送达' : f === 'failed' ? '失败' : '待发'}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
            {loading && notifications.length === 0 ? (
              <div className="space-y-2 animate-pulse">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="h-12 bg-gray-100 dark:bg-gray-800 rounded-lg" />
                ))}
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="text-center py-8">
                <Inbox className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-400">暂无通知记录</p>
                <p className="text-xs text-gray-300 mt-1">通知发送后将在此显示</p>
              </div>
            ) : (
              filteredNotifications.map(notif => (
                <div key={notif.id} className="flex items-center gap-3 py-1.5 px-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <Badge variant="outline" className="text-[10px]">{notif.channel}</Badge>
                  <span className="text-sm text-gray-900 dark:text-gray-100 truncate max-w-[200px]">{notif.subject}</span>
                  <span className="text-xs text-gray-400 truncate max-w-[120px]">{notif.recipient}</span>
                  <div className="ml-auto flex items-center gap-2">
                    {notif.status === 'delivered' && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                    {notif.status === 'sent' && <Send className="w-3 h-3 text-blue-500" />}
                    {notif.status === 'failed' && <XCircle className="w-3 h-3 text-red-500" />}
                    {notif.status === 'pending' && <Clock className="w-3 h-3 text-amber-500" />}
                    <span className="text-xs text-gray-400">{formatTime(notif.timestamp)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
