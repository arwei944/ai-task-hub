// ============================================================
// System Status / Health Check API Route
// ============================================================

import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

const startTime = Date.now();

export const dynamic = 'force-dynamic';

export async function GET() {
  const healthChecks: Record<string, { status: string; latency?: number; details?: string }> = {};

  // Database health check
  try {
    const dbStart = Date.now();
    const dbPath = process.env.DATABASE_URL?.replace(/^file:/, '') ?? './prisma/dev.db';
    const adapter = new PrismaBetterSqlite3({ url: dbPath });
    const prisma = new PrismaClient({ adapter });

    await prisma.$queryRaw`SELECT 1`;
    const taskCount = await prisma.task.count();
    const userCount = await prisma.user.count();

    await prisma.$disconnect();

    healthChecks.database = {
      status: 'ok',
      latency: Date.now() - dbStart,
      details: `${taskCount} tasks, ${userCount} users`,
    };
  } catch (error: any) {
    healthChecks.database = {
      status: 'error',
      details: error.message,
    };
  }

  // AI configuration check
  healthChecks.ai = {
    status: process.env.OPENAI_API_KEY ? 'configured' : 'not_configured',
    details: process.env.AI_MODEL ?? 'not_set',
  };

  // MCP check
  healthChecks.mcp = {
    status: 'available',
  };

  // Memory usage
  const memUsage = process.memoryUsage();
  const memMB = Math.round(memUsage.rss / 1024 / 1024);

  const status = {
    status: Object.values(healthChecks).every(h => h.status === 'ok' || h.status === 'configured' || h.status === 'available')
      ? 'healthy'
      : 'degraded',
    version: process.env.npm_package_version ?? '1.0.1',
    uptime: Math.round((Date.now() - startTime) / 1000),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV ?? 'development',
    memory: {
      rss: `${memMB}MB`,
      heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
    },
    health: healthChecks,
  };

  const httpStatus = status.status === 'healthy' ? 200 : 503;
  return NextResponse.json(status, { status: httpStatus });
}
