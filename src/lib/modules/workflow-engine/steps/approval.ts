import type { StepHandler, StepHandlerDeps } from '../types';

export class ApprovalStep implements StepHandler {
  constructor(private deps: StepHandlerDeps) {}
  async execute(config: Record<string, unknown>, context: Record<string, unknown>) {
    const approvalMessage = String(config.message ?? 'Please approve this step');
    const approvalTimeoutMs = Number(config.timeoutMs) || 300000;
    const { PrismaClient } = await import('@/generated/prisma/client');
    const { PrismaBetterSqlite3 } = await import('@prisma/adapter-better-sqlite3');
    const dbPath = process.env.DATABASE_URL?.replace(/^file:/, '') ?? './prisma/dev.db';
    const adapter = new PrismaBetterSqlite3({ url: dbPath });
    const prisma = new PrismaClient({ adapter });
    const checkpoint = await prisma.feedbackCheckpoint.create({
      data: { executionId: String(context._executionId ?? ''), stepId: String(context._stepId ?? ''), stepName: String(context._stepName ?? 'approval'), stepType: 'approval', checkpointType: 'manual', status: 'pending', approvalMode: 'block', contextSnapshot: JSON.stringify({ message: approvalMessage, config, context: { ...context, _soloSessionId: undefined, _stepId: undefined, _stepName: undefined, _stepType: undefined, _executionId: undefined } }) },
    });
    const startTime = Date.now();
    const pollInterval = 3000;
    while (Date.now() - startTime < approvalTimeoutMs) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      const updated = await prisma.feedbackCheckpoint.findUnique({ where: { id: checkpoint.id } });
      if (!updated) continue;
      switch (updated.status) {
        case 'approved': return { approvalStatus: 'approved', checkpointId: checkpoint.id, intervention: updated.intervention };
        case 'rejected': throw new Error(`Approval rejected: ${updated.intervention ?? 'No reason provided'}`);
        case 'modified': return { approvalStatus: 'modified', checkpointId: checkpoint.id, intervention: updated.intervention, modifications: updated.intervention ? JSON.parse(updated.intervention) : undefined };
        case 'skipped': return { approvalStatus: 'skipped', checkpointId: checkpoint.id };
        case 'timeout_expired': return { approvalStatus: 'timeout', checkpointId: checkpoint.id };
      }
    }
    await prisma.feedbackCheckpoint.update({ where: { id: checkpoint.id }, data: { status: 'timeout_expired', resolvedAt: new Date() } });
    return { approvalStatus: 'timeout', checkpointId: checkpoint.id };
  }
}