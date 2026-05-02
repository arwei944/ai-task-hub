// ============================================================
// LinkageTracer tRPC Router — 联动追踪运维面板
// ============================================================
// 提供 tRPC 端点用于：
// - 联动统计概览
// - 活跃链路查询
// - 已完成链路查询
// - 拓扑热力图
// - 告警查询与清除
// ============================================================

import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from './server';
import { getKernel } from '@/lib/core/v3/kernel';
import type {
  LinkageTrace,
} from '@/lib/core/v3/types';

// ---- 前端视图类型 ----

/** 活跃链路视图项 */
interface TraceViewItem {
  id: string;           // traceId
  traceId: string;
  eventType: string;    // rootEvent
  source: string;       // 从 rootEvent 提取（如 "task.created" -> "task"）
  target: string;       // 从 spans 的 handlerName 提取
  status: 'success' | 'failed' | 'pending';  // 映射自 'active'/'completed'/'degraded'
  latencyMs: number;    // totalDuration
  timestamp: number;    // startedAt
  error?: string;       // 来自 status 为 'error' 的 span
  spanCount: number;    // spans.length
}

/** 已完成链路视图项 */
interface CompletedTraceViewItem extends TraceViewItem {
  completedAt: number;
}

/**
 * 从 rootEvent 中提取来源模块
 * 例如 "task.created" -> "task", "workflow.step.completed" -> "workflow"
 */
function extractSource(rootEvent: string): string {
  return rootEvent.split('.')[0] || rootEvent;
}

/**
 * 从 spans 中提取目标 handler
 * 优先取第一个非 __emit__ 的 handlerName，否则返回 rootEvent 的 source
 */
function extractTarget(trace: LinkageTrace): string {
  const handlerSpan = trace.spans.find(s => s.handlerName !== '__emit__');
  if (handlerSpan) {
    return handlerSpan.handlerName.split('.')[0] || handlerSpan.handlerName;
  }
  return extractSource(trace.rootEvent);
}

/**
 * 将链路状态映射为前端友好的状态
 * active -> pending, completed -> success, degraded -> failed
 */
function mapStatus(status: LinkageTrace['status']): TraceViewItem['status'] {
  switch (status) {
    case 'active': return 'pending';
    case 'completed': return 'success';
    case 'degraded': return 'failed';
  }
}

/**
 * 从 spans 中提取第一个错误信息
 */
function extractError(trace: LinkageTrace): string | undefined {
  const errorSpan = trace.spans.find(s => s.status === 'error');
  return errorSpan?.error;
}

/**
 * 将 LinkageTrace 转换为前端视图项
 */
function toTraceViewItem(trace: LinkageTrace): TraceViewItem {
  return {
    id: trace.traceId,
    traceId: trace.traceId,
    eventType: trace.rootEvent,
    source: extractSource(trace.rootEvent),
    target: extractTarget(trace),
    status: mapStatus(trace.status),
    latencyMs: trace.totalDuration,
    timestamp: trace.startedAt,
    error: extractError(trace),
    spanCount: trace.spans.length,
  };
}

/**
 * 将已完成的 LinkageTrace 转换为前端视图项（含 completedAt）
 */
function toCompletedTraceViewItem(trace: LinkageTrace): CompletedTraceViewItem {
  return {
    ...toTraceViewItem(trace),
    completedAt: trace.completedAt ?? trace.startedAt,
  };
}

// ---- Router ----

export const linkageRouter = createTRPCRouter({
  // ---- 联动统计概览 ----

  getStats: protectedProcedure.query(async ({ ctx }) => {
    const tracer = getKernel().getTracer();
    return tracer.getStats();
  }),

  // ---- 活跃链路列表 ----

  getActiveTraces: protectedProcedure.query(async ({ ctx }) => {
    const tracer = getKernel().getTracer();
    const traces = tracer.getActiveTraces();
    return traces.map(toTraceViewItem);
  }),

  // ---- 已完成链路列表 ----

  getCompletedTraces: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const tracer = getKernel().getTracer();
      const traces = tracer.getCompletedTraces(input?.limit);
      return traces.map(toCompletedTraceViewItem);
    }),

  // ---- 拓扑热力图 ----

  getTopology: protectedProcedure.query(async ({ ctx }) => {
    const tracer = getKernel().getTracer();
    return tracer.getTopologyHeatmap();
  }),

  // ---- 告警列表 ----

  getAlerts: protectedProcedure.query(async ({ ctx }) => {
    const tracer = getKernel().getTracer();
    return tracer.getAlerts();
  }),

  // ---- 清除告警 ----

  clearAlerts: protectedProcedure.mutation(async ({ ctx }) => {
    const tracer = getKernel().getTracer();
    tracer.clearAlerts();
    return { success: true, message: '告警已清除' };
  }),
});
