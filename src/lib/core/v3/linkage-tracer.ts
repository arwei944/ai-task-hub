// ============================================================
// AI Task Hub v3.0 — Linkage Tracer (联动追踪器)
// ============================================================
// 环形缓冲区 + traceId 传播 + SSE 实时推送 + 告警
// ============================================================

import type {
  EventType,
  ILinkageTracer,
  LinkageStats,
  LinkageTrace,
  LinkageSpan,
  TopologyEdge,
  LinkageAlert,
} from './types';

/** 环形缓冲区 */
class RingBuffer<T> {
  private buffer: T[] = [];
  private readonly capacity: number;

  constructor(capacity: number) {
    this.capacity = capacity;
  }

  push(item: T): void {
    if (this.buffer.length >= this.capacity) {
      this.buffer.shift();
    }
    this.buffer.push(item);
  }

  getAll(): T[] {
    return [...this.buffer];
  }

  get size(): number {
    return this.buffer.length;
  }

  clear(): void {
    this.buffer = [];
  }
}

export interface LinkageTracerConfig {
  /** 环形缓冲区容量（默认 10000） */
  bufferSize?: number;
  /** 告警阈值：失败率（默认 0.1 = 10%） */
  errorRateThreshold?: number;
  /** 告警阈值：延迟增长百分比（默认 1.0 = 100%） */
  latencyIncreaseThreshold?: number;
}

export class LinkageTracer implements ILinkageTracer {
  private buffer: RingBuffer<LinkageSpan>;
  private activeTraces = new Map<string, LinkageTrace>();
  private completedTraces: RingBuffer<LinkageTrace>;
  private alerts: RingBuffer<LinkageAlert>;
  private errorRateThreshold: number;
  private latencyIncreaseThreshold: number;

  // SSE 广播回调（由 AppKernel 注入）
  private sseBroadcast: ((channel: string, data: unknown) => void) | null = null;

  constructor(config?: LinkageTracerConfig) {
    this.buffer = new RingBuffer(config?.bufferSize ?? 10000);
    this.completedTraces = new RingBuffer(1000);
    this.alerts = new RingBuffer(100);
    this.errorRateThreshold = config?.errorRateThreshold ?? 0.1;
    this.latencyIncreaseThreshold = config?.latencyIncreaseThreshold ?? 1.0;
  }

  /** 注入 SSE 广播函数 */
  setSSEBroadcast(fn: (channel: string, data: unknown) => void): void {
    this.sseBroadcast = fn;
  }

  private broadcast(channel: string, data: unknown): void {
    this.sseBroadcast?.(channel, data);
  }

  // ==================== 记录 ====================

  /** 记录事件发射 */
  recordEmit(params: {
    traceId: string;
    spanId: string;
    eventType: string;
    source?: string;
  }): void {
    const span: LinkageSpan = {
      traceId: params.traceId,
      spanId: params.spanId,
      eventType: params.eventType,
      handlerName: '__emit__',
      duration: 0,
      status: 'success',
      timestamp: Date.now(),
    };
    this.buffer.push(span);

    // 初始化活跃链路
    if (!this.activeTraces.has(params.traceId)) {
      this.activeTraces.set(params.traceId, {
        traceId: params.traceId,
        rootEvent: params.eventType,
        status: 'active',
        startedAt: Date.now(),
        totalDuration: 0,
        spans: [],
      });
    }

    this.broadcast('ops:linkage', {
      type: 'emit',
      traceId: params.traceId,
      eventType: params.eventType,
      source: params.source,
      timestamp: Date.now(),
    });
  }

  /** 记录 handler 完成 */
  recordComplete(params: {
    traceId: string;
    spanId: string;
    handlerName: string;
    duration: number;
    status: 'success' | 'error';
    error?: string;
  }): void {
    const span: LinkageSpan = {
      traceId: params.traceId,
      spanId: params.spanId,
      eventType: '',
      handlerName: params.handlerName,
      duration: params.duration,
      status: params.status,
      error: params.error,
      timestamp: Date.now(),
    };
    this.buffer.push(span);

    // 更新活跃链路
    const trace = this.activeTraces.get(params.traceId);
    if (trace) {
      trace.spans.push(span);
      trace.totalDuration = Math.max(trace.totalDuration, params.duration);
      if (params.status === 'error') {
        trace.status = 'degraded';
      }
    }

    // 广播
    this.broadcast('ops:linkage', {
      type: 'complete',
      traceId: params.traceId,
      handlerName: params.handlerName,
      duration: params.duration,
      status: params.status,
    });

    // 失败告警
    if (params.status === 'error') {
      this.addAlert({
        severity: 'warning',
        type: 'error_spike',
        message: `Handler "${params.handlerName}" failed: ${params.error || 'unknown'}`,
        traceId: params.traceId,
        handlerName: params.handlerName,
      });
    }
  }

  /** 完成链路 */
  completeTrace(traceId: string): void {
    const trace = this.activeTraces.get(traceId);
    if (!trace) return;
    trace.completedAt = Date.now();
    trace.status = trace.spans.some(s => s.status === 'error') ? 'degraded' : 'completed';
    this.activeTraces.delete(traceId);
    this.completedTraces.push(trace);
  }

  // ==================== 查询 ====================

  getStats(): LinkageStats {
    const recent = this.buffer.getAll().slice(-1000);
    const total = recent.length;
    const errors = recent.filter(s => s.status === 'error').length;
    const durations = recent.filter(s => s.duration > 0).map(s => s.duration);

    return {
      activeTraces: this.activeTraces.size,
      successRate: total > 0 ? 1 - errors / total : 1,
      avgDuration: durations.length > 0
        ? durations.reduce((a, b) => a + b, 0) / durations.length
        : 0,
      errorCount: errors,
      throughput: total, // 近期事件数（近似吞吐量）
    };
  }

  getActiveTraces(): LinkageTrace[] {
    return [...this.activeTraces.values()];
  }

  /** 获取已完成的链路（最新的在前） */
  getCompletedTraces(limit?: number): LinkageTrace[] {
    const all = this.completedTraces.getAll();
    const reversed = all.reverse();
    return limit ? reversed.slice(0, limit) : reversed;
  }

  getTopologyHeatmap(): TopologyEdge[] {
    const recent = this.buffer.getAll().slice(-5000);
    const edgeMap = new Map<string, {
      from: string;
      to: string;
      eventType: string;
      count: number;
      successCount: number;
      totalLatency: number;
    }>();

    // 按事件类型分组统计
    for (const span of recent) {
      if (span.handlerName === '__emit__') continue;
      const key = `${span.eventType}→${span.handlerName}`;
      const existing = edgeMap.get(key);
      if (existing) {
        existing.count++;
        if (span.status === 'success') existing.successCount++;
        existing.totalLatency += span.duration;
      } else {
        edgeMap.set(key, {
          from: span.eventType.split('.')[0],
          to: span.handlerName.split('.')[0],
          eventType: span.eventType,
          count: 1,
          successCount: span.status === 'success' ? 1 : 0,
          totalLatency: span.duration,
        });
      }
    }

    return [...edgeMap.values()].map(edge => ({
      from: edge.from,
      to: edge.to,
      eventType: edge.eventType,
      throughput: edge.count,
      successRate: edge.count > 0 ? edge.successCount / edge.count : 1,
      avgLatency: edge.count > 0 ? edge.totalLatency / edge.count : 0,
    }));
  }

  getAlerts(): LinkageAlert[] {
    return this.alerts.getAll();
  }

  // ==================== 告警 ====================

  private addAlert(partial: Omit<LinkageAlert, 'id' | 'timestamp'>): void {
    const alert: LinkageAlert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
      ...partial,
    };
    this.alerts.push(alert);
    this.broadcast('ops:linkage:alert', alert);
  }

  // ==================== 清理 ====================

  /** 清理超时的活跃链路（默认 5 分钟） */
  pruneStaleTraces(maxAgeMs: number = 300_000): number {
    let pruned = 0;
    const now = Date.now();
    for (const [id, trace] of this.activeTraces) {
      if (now - trace.startedAt >= maxAgeMs) {
        trace.completedAt = now;
        trace.status = 'degraded';
        this.completedTraces.push(trace);
        this.activeTraces.delete(id);
        pruned++;
      }
    }
    return pruned;
  }

  clearAlerts(): void {
    this.alerts.clear();
  }
}
