// ============================================================
// Self-Healing tRPC Router
// ============================================================
// Provides tRPC endpoints for:
// - Health status overview
// - Circuit breaker status + manual reset
// - DLQ monitoring + manual replay + purge
// ============================================================

import { z } from 'zod';
import { createTRPCRouter, protectedProcedure, adminProcedure } from './server';

export const selfHealingRouter = createTRPCRouter({
  // ---- Health ----

  healthOverview: protectedProcedure.query(async ({ ctx }) => {
    const { getSelfHealingManager } = await import('@/lib/core/v3/self-healing');
    const manager = getSelfHealingManager();
    const status = manager.getStatus();

    return {
      health: status.health,
      circuits: status.circuits,
      dlq: status.dlq,
      timestamp: Date.now(),
    };
  }),

  healthDetail: protectedProcedure
    .input(z.object({ capabilityId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { getSelfHealingManager } = await import('@/lib/core/v3/self-healing');
      const manager = getSelfHealingManager();
      const report = manager.healthMonitor.getReport(input.capabilityId);

      return report ?? { status: 'unknown' as const, details: 'Capability not found', checkedAt: 0 };
    }),

  triggerHealthCheck: adminProcedure.mutation(async ({ ctx }) => {
    const { getSelfHealingManager } = await import('@/lib/core/v3/self-healing');
    const manager = getSelfHealingManager();
    await manager.healthMonitor.runChecks();

    return {
      reports: manager.healthMonitor.getAllReports(),
      overallStatus: manager.healthMonitor.getOverallStatus(),
    };
  }),

  // ---- Circuit Breakers ----

  circuitStatus: protectedProcedure.query(async ({ ctx }) => {
    const { getSelfHealingManager } = await import('@/lib/core/v3/self-healing');
    const manager = getSelfHealingManager();
    return manager.circuitBreakers.getAllStatuses();
  }),

  circuitReset: adminProcedure
    .input(z.object({ breakerId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { getSelfHealingManager } = await import('@/lib/core/v3/self-healing');
      const manager = getSelfHealingManager();
      const breaker = manager.circuitBreakers.get(input.breakerId);

      if (!breaker) {
        return { success: false, message: `Circuit breaker '${input.breakerId}' not found` };
      }

      breaker.reset();
      return {
        success: true,
        message: `Circuit breaker '${input.breakerId}' reset to closed`,
        state: breaker.getState(),
      };
    }),

  // ---- DLQ ----

  dlqList: protectedProcedure.query(async ({ ctx }) => {
    const { getSelfHealingManager } = await import('@/lib/core/v3/self-healing');
    const manager = getSelfHealingManager();
    return {
      entries: manager.dlq.getAll(),
      stats: manager.dlq.getStats(),
    };
  }),

  dlqStats: protectedProcedure.query(async ({ ctx }) => {
    const { getSelfHealingManager } = await import('@/lib/core/v3/self-healing');
    const manager = getSelfHealingManager();
    return manager.dlq.getStats();
  }),

  dlqRemove: adminProcedure
    .input(z.object({ entryId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { getSelfHealingManager } = await import('@/lib/core/v3/self-healing');
      const manager = getSelfHealingManager();
      const removed = manager.dlq.remove(input.entryId);

      return {
        success: removed,
        message: removed ? 'Entry removed' : 'Entry not found',
      };
    }),

  dlqPurgeExhausted: adminProcedure.mutation(async ({ ctx }) => {
    const { getSelfHealingManager } = await import('@/lib/core/v3/self-healing');
    const manager = getSelfHealingManager();
    const purged = manager.dlq.purgeExhausted();

    return {
      purged,
      message: `${purged} exhausted entries purged`,
    };
  }),

  dlqClear: adminProcedure.mutation(async ({ ctx }) => {
    const { getSelfHealingManager } = await import('@/lib/core/v3/self-healing');
    const manager = getSelfHealingManager();
    const cleared = manager.dlq.clear();

    return {
      cleared,
      message: `${cleared} entries cleared`,
    };
  }),
});
