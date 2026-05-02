// ============================================================
// AI Task Hub v3.0 — LinkageTracer Unit Tests
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { LinkageTracer } from '@/lib/core/v3/linkage-tracer';

describe('LinkageTracer', () => {
  let tracer: LinkageTracer;

  beforeEach(() => {
    tracer = new LinkageTracer({ bufferSize: 100 });
  });

  describe('recordEmit', () => {
    it('should create an active trace on first emit', () => {
      tracer.recordEmit({
        traceId: 'trace-1',
        spanId: 'span-1',
        eventType: 'task.created',
      });

      const traces = tracer.getActiveTraces();
      expect(traces).toHaveLength(1);
      expect(traces[0].traceId).toBe('trace-1');
      expect(traces[0].rootEvent).toBe('task.created');
      expect(traces[0].status).toBe('active');
    });

    it('should not create duplicate traces for same traceId', () => {
      tracer.recordEmit({ traceId: 'trace-1', spanId: 'span-1', eventType: 'task.created' });
      tracer.recordEmit({ traceId: 'trace-1', spanId: 'span-2', eventType: 'task.status.changed' });

      expect(tracer.getActiveTraces()).toHaveLength(1);
    });
  });

  describe('recordComplete', () => {
    it('should add span to active trace', () => {
      tracer.recordEmit({ traceId: 'trace-1', spanId: 'span-1', eventType: 'task.created' });
      tracer.recordComplete({
        traceId: 'trace-1',
        spanId: 'span-2',
        handlerName: 'AI.TaskCreatedHandler',
        duration: 5,
        status: 'success',
      });

      const traces = tracer.getActiveTraces();
      expect(traces[0].spans).toHaveLength(1);
      expect(traces[0].spans[0].handlerName).toBe('AI.TaskCreatedHandler');
      expect(traces[0].spans[0].duration).toBe(5);
    });

    it('should mark trace as degraded on error', () => {
      tracer.recordEmit({ traceId: 'trace-1', spanId: 'span-1', eventType: 'task.created' });
      tracer.recordComplete({
        traceId: 'trace-1',
        spanId: 'span-2',
        handlerName: 'BadHandler',
        duration: 30,
        status: 'error',
        error: 'Timeout',
      });

      const traces = tracer.getActiveTraces();
      expect(traces[0].status).toBe('degraded');
    });
  });

  describe('completeTrace', () => {
    it('should move trace from active to completed', () => {
      tracer.recordEmit({ traceId: 'trace-1', spanId: 'span-1', eventType: 'task.created' });
      tracer.recordComplete({
        traceId: 'trace-1',
        spanId: 'span-2',
        handlerName: 'Handler',
        duration: 5,
        status: 'success',
      });

      tracer.completeTrace('trace-1');

      expect(tracer.getActiveTraces()).toHaveLength(0);
    });
  });

  describe('getStats', () => {
    it('should return correct stats', () => {
      tracer.recordEmit({ traceId: 'trace-1', spanId: 'span-1', eventType: 'task.created' });
      tracer.recordComplete({
        traceId: 'trace-1',
        spanId: 'span-2',
        handlerName: 'Handler',
        duration: 10,
        status: 'success',
      });

      const stats = tracer.getStats();
      expect(stats.activeTraces).toBe(1);
      expect(stats.successRate).toBe(1);
      expect(stats.avgDuration).toBe(10);
    });
  });

  describe('getTopologyHeatmap', () => {
    it('should return topology edges', () => {
      tracer.recordEmit({ traceId: 'trace-1', spanId: 'span-1', eventType: 'task.created' });
      tracer.recordComplete({
        traceId: 'trace-1',
        spanId: 'span-2',
        handlerName: 'AI.TaskCreatedHandler',
        duration: 5,
        status: 'success',
      });
      tracer.recordComplete({
        traceId: 'trace-1',
        spanId: 'span-3',
        handlerName: 'Notify.RuleEngine',
        duration: 1,
        status: 'success',
      });

      const heatmap = tracer.getTopologyHeatmap();
      expect(heatmap.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('alerts', () => {
    it('should generate alert on handler error', () => {
      tracer.recordEmit({ traceId: 'trace-1', spanId: 'span-1', eventType: 'task.created' });
      tracer.recordComplete({
        traceId: 'trace-1',
        spanId: 'span-2',
        handlerName: 'BadHandler',
        duration: 30,
        status: 'error',
        error: 'Timeout',
      });

      const alerts = tracer.getAlerts();
      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe('error_spike');
      expect(alerts[0].severity).toBe('warning');
    });
  });

  describe('pruneStaleTraces', () => {
    it('should prune old active traces', () => {
      tracer.recordEmit({ traceId: 'trace-1', spanId: 'span-1', eventType: 'task.created' });

      // Prune with 0ms maxAge (everything is stale)
      const pruned = tracer.pruneStaleTraces(0);
      expect(pruned).toBe(1);
      expect(tracer.getActiveTraces()).toHaveLength(0);
    });
  });
});
