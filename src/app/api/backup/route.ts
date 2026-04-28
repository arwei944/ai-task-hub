// ============================================================
// Data Backup API Route
// ============================================================
//
// GET  /api/backup - Export all data as JSON
// POST /api/backup - Import data from JSON
//

import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { AuthService } from '@/lib/modules/auth/auth.service';
import { UserRepository } from '@/lib/modules/auth/user.repository';
import { Logger } from '@/lib/core/logger';

export const dynamic = 'force-dynamic';

function getAuthService(): AuthService {
  const logger = new Logger('auth');
  const dbPath = process.env.DATABASE_URL?.replace(/^file:/, '') ?? './data/dev.db';
  const adapter = new PrismaBetterSqlite3({ url: dbPath });
  const prisma = new PrismaClient({ adapter });
  const userRepo = new UserRepository(prisma);
  return new AuthService(userRepo, logger);
}

async function requireAdmin(request: Request): Promise<{ userId: string } | NextResponse> {
  const authService = getAuthService();
  const user = await authService.getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return { userId: user.id };
}

function getPrisma() {
  const dbPath = process.env.DATABASE_URL?.replace(/^file:/, '') ?? './prisma/dev.db';
  const adapter = new PrismaBetterSqlite3({ url: dbPath });
  return new PrismaClient({ adapter });
}

// Tables to export (in dependency order)
const TABLES = [
  'User', 'Task', 'TaskDependency', 'TaskHistory', 'TaskTag',
  'Tag', 'AIAuditLog', 'Agent', 'AgentOperationLog',
  'Notification', 'NotificationChannel',
  'Deployment', 'Plugin',
] as const;

/**
 * GET /api/backup - Export all data
 */
export async function GET(request: Request) {
  // Auth check
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const prisma = getPrisma();
    const backup: Record<string, unknown[]> = {};
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    for (const table of TABLES) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const records = await (prisma as any)[table.charAt(0).toLowerCase() + table.slice(1)].findMany();
        backup[table] = records.map((r: any) => {
          const { _count, ...rest } = r;
          return rest;
        });
      } catch {
        backup[table] = [];
      }
    }

    await prisma.$disconnect();

    // Save to file
    const backupDir = join(process.cwd(), 'backups');
    if (!existsSync(backupDir)) {
      mkdirSync(backupDir, { recursive: true });
    }
    const filePath = join(backupDir, `backup-${timestamp}.json`);
    writeFileSync(filePath, JSON.stringify(backup, null, 2));

    return NextResponse.json({
      success: true,
      tables: Object.keys(backup),
      recordCounts: Object.fromEntries(Object.entries(backup).map(([k, v]) => [k, v.length])),
      file: filePath,
      timestamp,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

/**
 * POST /api/backup - Import data
 * Body: { data: Record<string, any[]> }
 */
export async function POST(request: Request) {
  // Auth check
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const body = await request.json();
    const { data } = body as { data: Record<string, unknown[]> };

    if (!data || typeof data !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Invalid data format. Expected { data: { TableName: [...] } }' },
        { status: 400 },
      );
    }

    const prisma = getPrisma();
    const results: Record<string, number> = {};

    for (const [table, records] of Object.entries(data)) {
      if (!Array.isArray(records)) continue;

      const modelName = table.charAt(0).toLowerCase() + table.slice(1);

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const model = (prisma as any)[modelName];
        if (!model || typeof model.createMany !== 'function') {
          results[table] = 0;
          continue;
        }

        // Clean records (remove id, timestamps for insert)
        const cleaned = records.map((r: any) => {
          const { id, createdAt, updatedAt, _count, ...rest } = r;
          return rest;
        }).filter((r: any) => Object.keys(r).length > 0);

        if (cleaned.length > 0) {
          await model.createMany({ data: cleaned, skipDuplicates: true });
        }

        results[table] = cleaned.length;
      } catch (error: any) {
        results[`${table}_error`] = error.message;
      }
    }

    await prisma.$disconnect();

    return NextResponse.json({
      success: true,
      imported: results,
      totalRecords: Object.values(results).reduce((sum, v) => sum + (typeof v === 'number' ? v : 0), 0),
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
