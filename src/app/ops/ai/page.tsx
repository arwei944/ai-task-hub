// ============================================================
// Ops AI Service View - /ops/ai
// ============================================================
//
// AI service monitoring: model status, API usage,
// latency tracking, and configuration.
// ============================================================

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useHealthSSE, type HealthSSEEvent } from '@/lib/hooks/use-health-sse';
import {
  Brain,
  RefreshCw,
  Key,
  Zap,
  Clock,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';

// ---- Types ----

interface AIModelStatus {
  name: string;
  provider: string;
  status: 'active' | 'degraded' | 'unavailable';
  avgLatencyMs: number;
  requestCount24h: number;
  errorRate: number;
  lastUsedAt: number;
}

interface AIUsageRecord {
  id: string;
  model: string;
  type: 'chat' | 'embedding' | 'image';
  tokens: number;
  latencyMs: number;
  timestamp: number;
  success: boolean;
}

// ---- Mock data ----

function generateMockModels(): AIModelStatus[] {
  return [
    { name: 'gpt-4o', provider: 'OpenAI', status: 'active', avgLatencyMs: 1200, requestCount24h: 342, errorRate: 0.02, lastUsedAt: Date.now() - 60000 },
    { name: 'gpt-4o-mini', provider: 'OpenAI', status: 'active', avgLatencyMs: 450, requestCount24h: 1289, errorRate: 0.01, lastUsedAt: Date.now() - 30000 },
    { name: 'text-embedding-3-small', provider: 'OpenAI', status: 'active', avgLatencyMs: 200, requestCount24h: 567, errorRate: 0.005, lastUsedAt: Date.now() - 120000 },
    { name: 'dall-e-3', provider: 'OpenAI', status: 'degraded', avgLatencyMs: 5000, requestCount24h: 23, errorRate: 0.15, lastUsedAt: Date.now() - 300000 },
  ];
}

function generateMockUsage(): AIUsageRecord[] {
  const models = ['gpt-4o', 'gpt-4o-mini', 'text-embedding-3-small', 'dall-e-3'];
  const types: AIUsageRecord['type'][] = ['chat', 'chat', 'chat', 'embedding', 'embedding', 'image'];

  return Array.from({ length: 30 }, (_, i) => ({
    id: `usage-${i}`,
    model: models[Math.floor(Math.random() * models.length)],
    type: types[Math.floor(Math.random() * types.length)],
    tokens: Math.floor(Math.random() * 4000) + 100,
    latencyMs: Math.floor(Math.random() * 3000) + 100,
    timestamp: Date.now() - Math.floor(Math.random() * 3600000),
    success: Math.random() > 0.05,
  })).sort((a, b) => b.timestamp - a.timestamp);
}

// ---- Component ----

export default function OpsAIPage() {
  const [models, setModels] = useState<AIModelStatus[]>([]);
  const [usage, setUsage] = useState<AIUsageRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiHealthStatus, setAiHealthStatus] = useState<string>('unknown');

  const handleEvent = useCallback((event: HealthSSEEvent) => {
    if (event.data.capabilityId === 'ai' && event.data.report) {
      setAiHealthStatus(event.data.report.status);
    }
  }, []);

  const { isConnected } = useHealthSSE({ enabled: true, onEvent: handleEvent });

  useEffect(() => {
    const timer = setTimeout(() => {
      setModels(generateMockModels());
      setUsage(generateMockUsage());
      setLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  function refresh() {
    setLoading(true);
    setTimeout(() => {
      setModels(generateMockModels());
      setUsage(generateMockUsage());
      setLoading(false);
    }, 300);
  }

  const totalRequests = models.reduce((sum, m) => sum + m.requestCount24h, 0);
  const avgErrorRate = models.reduce((sum, m) => sum + m.errorRate, 0) / Math.max(models.length, 1);
  const avgLatency = models.reduce((sum, m) => sum + m.avgLatencyMs, 0) / Math.max(models.length, 1);

  function formatTime(ts: number): string {
    return new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">AI 服务</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            AI 模型状态、用量统计与延迟监控
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

      {/* Health banner */}
      {aiHealthStatus === 'degraded' && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          <span className="text-sm text-amber-700 dark:text-amber-300">AI 服务降级中 — OPENAI_API_KEY 未配置或 API 响应异常</span>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card size="sm">
          <CardContent className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-950 flex items-center justify-center">
              <Brain className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{models.length}</p>
              <p className="text-xs text-gray-500">模型数量</p>
            </div>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-950 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{totalRequests.toLocaleString()}</p>
              <p className="text-xs text-gray-500">24h 请求</p>
            </div>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center">
              <Clock className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{Math.round(avgLatency)}ms</p>
              <p className="text-xs text-gray-500">平均延迟</p>
            </div>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-950 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{(avgErrorRate * 100).toFixed(1)}%</p>
              <p className="text-xs text-gray-500">错误率</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Model cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {models.map(model => (
          <Card key={model.name}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Brain className="w-4 h-4 text-orange-500" />
                  {model.name}
                </CardTitle>
                <Badge
                  className={
                    model.status === 'active'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                      : model.status === 'degraded'
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                        : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                  }
                >
                  {model.status === 'active' ? '正常' : model.status === 'degraded' ? '降级' : '不可用'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-gray-500">提供商</p>
                  <p className="text-gray-900 dark:text-gray-100">{model.provider}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">平均延迟</p>
                  <p className="text-gray-900 dark:text-gray-100">{model.avgLatencyMs}ms</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">24h 请求</p>
                  <p className="text-gray-900 dark:text-gray-100">{model.requestCount24h}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">错误率</p>
                  <p className={`text-gray-900 dark:text-gray-100 ${model.errorRate > 0.1 ? 'text-red-500' : ''}`}>
                    {(model.errorRate * 100).toFixed(1)}%
                  </p>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-xs text-gray-400">
                <span>最近使用: {formatTime(model.lastUsedAt)}</span>
                <Key className="w-3 h-3" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent usage */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-orange-500" />
            最近调用
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
            {usage.map(record => (
              <div key={record.id} className="flex items-center gap-3 py-1.5 px-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <Badge variant="outline" className="text-[10px] font-mono">{record.model}</Badge>
                <Badge variant="outline" className="text-[10px]">{record.type}</Badge>
                <span className="text-xs text-gray-500">{record.tokens} tokens</span>
                <span className="text-xs text-gray-400">{record.latencyMs}ms</span>
                {record.success
                  ? <CheckCircle2 className="w-3 h-3 text-emerald-500 ml-auto" />
                  : <AlertTriangle className="w-3 h-3 text-red-500 ml-auto" />
                }
                <span className="text-xs text-gray-400">{formatTime(record.timestamp)}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
