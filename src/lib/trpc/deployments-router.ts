import { z } from 'zod';
import { createTRPCRouter, protectedProcedure, adminProcedure } from './server';

async function getPrisma() {
  const { getPrisma: _getPrisma } = await import('@/lib/db');
  return _getPrisma();
}

export const deploymentsRouter = createTRPCRouter({
  // List environments
  listEnvironments: protectedProcedure.query(async () => {
    const prisma = await getPrisma();
    try {
      return await prisma.deploymentEnvironment.findMany({ orderBy: { order: 'asc' } });
    } finally { await prisma.$disconnect(); }
  }),

  // List deployments with filters
  listDeployments: protectedProcedure
    .input(z.object({
      environmentId: z.string().optional(),
      status: z.string().optional(),
      limit: z.number().min(1).max(100).optional(),
    }).optional())
    .query(async ({ input }) => {
      const prisma = await getPrisma();
      try {
        const where: Record<string, unknown> = {};
        if (input?.environmentId) where.environmentId = input.environmentId;
        if (input?.status) where.status = input.status;

        return await prisma.deployment.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: input?.limit ?? 20,
          include: { environment: { select: { name: true, displayName: true } } },
        });
      } finally { await prisma.$disconnect(); }
    }),

  // Get deployment summary
  getSummary: protectedProcedure.query(async () => {
    const prisma = await getPrisma();
    try {
      const [total, byStatus, environments] = await Promise.all([
        prisma.deployment.count(),
        prisma.deployment.groupBy({ by: ['status'], _count: true }),
        prisma.deploymentEnvironment.findMany({
          orderBy: { order: 'asc' },
          include: {
            _count: { select: { deployments: true } },
            healthChecks: { where: { isActive: true } },
          },
        }),
      ]);

      const statusMap: Record<string, number> = {};
      for (const g of byStatus) statusMap[g.status] = g._count;

      return {
        total,
        byStatus: statusMap,
        environments: environments.map(e => ({
          id: e.id,
          name: e.name,
          displayName: e.displayName,
          healthStatus: e.healthStatus,
          deploymentCount: e._count.deployments,
          activeChecks: e.healthChecks.length,
        })),
      };
    } finally { await prisma.$disconnect(); }
  }),

  // Get environment health
  getEnvironmentHealth: protectedProcedure.query(async () => {
    const prisma = await getPrisma();
    try {
      return await prisma.deploymentEnvironment.findMany({
        orderBy: { order: 'asc' },
        include: {
          healthChecks: { where: { isActive: true } },
          deployments: { where: { status: 'running' }, orderBy: { createdAt: 'desc' }, take: 1 },
        },
      });
    } finally { await prisma.$disconnect(); }
  }),
});
